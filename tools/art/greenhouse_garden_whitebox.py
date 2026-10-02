"""溫室菜田周邊小物與庭園燈的比例框（白模），給 GPT 照框的大小與位置畫，一件一框。
框是「遊戲尺寸 × 3」（細節多一點，切好後縮回 1/3）；遊戲裡一格 96 px、角色高 148 px。
框的位置寫進 greenhouse_garden_boxes.json，生成後依框切圖。

  watering_can  澆水壺       遊戲約 60×45
  trowel        小鏟子       約 40×20（斜放在地上）
  seed_bags     種子袋（2 包靠在一起） 約 34×40
  plant_sign    作物木名牌   約 36×52（插在土裡的小木牌）
  basket        竹籃         約 70×48
  lamp_tall     庭園立燈     約 48×250（比角色高一點）
  lamp_low      步道矮燈     約 36×80
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

S = 3
ITEMS = {  # 名稱: (遊戲寬, 遊戲高)
    'watering_can': (60, 45), 'trowel': (40, 20), 'seed_bags': (34, 40), 'plant_sign': (36, 52),
    'basket': (70, 48), 'lamp_low': (36, 80), 'lamp_tall': (48, 250),
}
LINE, FILL, BG = (70, 76, 86), (226, 230, 236), (200, 200, 210)
OUT = Path(__file__).with_name('greenhouse_garden_whitebox.png')


def main():
    im = Image.new('RGB', (1536, 1024), BG); d = ImageDraw.Draw(im)
    boxes, x, base = {}, 60, 900                      # 全部站在同一條地面線上，看得出彼此大小
    for name, (w, h) in ITEMS.items():
        W, H = w * S, h * S
        d.rectangle((x, base - H, x + W, base), fill=FILL, outline=LINE, width=4)
        boxes[name] = (x, base - H, x + W, base)
        x += W + 60
    d.line((30, base + 2, 1506, base + 2), fill=LINE, width=2)
    im.save(OUT)
    OUT.with_name('greenhouse_garden_boxes.json').write_text(json.dumps(boxes, indent=1), encoding='utf-8')
    print(boxes, 'right edge', x)


if __name__ == '__main__':
    main()
