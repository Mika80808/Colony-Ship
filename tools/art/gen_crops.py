"""照 greenhouse_crop_prompts.md 用 GPT Image 生溫室作物圖，存到 crops/raw/。

用法（需 OPENAI_API_KEY）：
  python tools/art/gen_crops.py lettuce        # 先只生萵苣確認畫風
  python tools/art/gen_crops.py                # 其餘 16 種，都帶 lettuce.png 當參考圖
  python tools/art/gen_crops.py kale mint      # 只生指定幾種
已存在的檔案會跳過，加 --force 重生。"""
import base64, os, re, sys
from pathlib import Path
import requests

HERE = Path(__file__).resolve().parent
DOC = HERE / 'greenhouse_crop_prompts.md'
RAW = HERE / 'crops/raw'
MODEL = os.environ.get('GPT_IMAGE_MODEL', 'gpt-image-1')
GREY_BG = {'radish', 'blueberry', 'perilla'}
API = 'https://api.openai.com/v1/images'

text = DOC.read_text(encoding='utf-8')
common = re.search(r'## 共用提示詞\s*```\n(.*?)```', text, re.S).group(1)
crops = {m[0]: m[1].strip() for m in re.findall(r'### \d+\. \S+ ([a-z ]+?)\n\s*```\n(.*?)```', text, re.S)}
crops = {k.replace(' ', '_'): v for k, v in crops.items()}


def prompt_for(name):
    p = re.sub(r'Crop: <作物描述>', crops[name], common)
    if name in GREY_BG:
        p = p.replace('solid magenta #FF00FF', 'solid neutral grey #808080')
    if name != 'lettuce':
        p = ('Match the exact pixel art style, outline, shading, palette approach, '
             'scale and layout of the reference image.\n\n' + p)
    return p


def generate(name, key):
    headers = {'Authorization': f'Bearer {key}'}
    data = {'model': MODEL, 'prompt': prompt_for(name), 'size': '1536x1024', 'n': 1}
    if name == 'lettuce':
        r = requests.post(f'{API}/generations', headers=headers, json=data, timeout=600)
    else:
        with open(RAW / 'lettuce.png', 'rb') as ref:
            r = requests.post(f'{API}/edits', headers=headers, data=data,
                              files={'image[]': ('lettuce.png', ref, 'image/png')}, timeout=600)
    r.raise_for_status()
    (RAW / f'{name}.png').write_bytes(base64.b64decode(r.json()['data'][0]['b64_json']))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv
    key = os.environ['OPENAI_API_KEY']
    RAW.mkdir(parents=True, exist_ok=True)
    names = args or [n for n in crops if n != 'lettuce']
    if any(n != 'lettuce' for n in names) and not (RAW / 'lettuce.png').exists():
        sys.exit('先生 lettuce 並確認畫風，其餘作物要拿它當參考圖。')
    for n in names:
        if n not in crops: sys.exit(f'未知作物：{n}（可用：{", ".join(crops)}）')
        if (RAW / f'{n}.png').exists() and not force:
            print(f'skip {n}'); continue
        print(f'gen  {n} ...', flush=True)
        generate(n, key)


if __name__ == '__main__':
    main()
