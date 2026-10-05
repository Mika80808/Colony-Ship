"""把表情圖原圖縮成遊戲用的 514×514 無損 WebP。

原圖先用 tools/check_character_assets.py --raw 驗收過再跑。

用法：python tools/prepare_expressions.py <原圖資料夾> <輸出資料夾>
例：  python tools/prepare_expressions.py tools/art/blaze/raw/expressions public/assets/blaze
"""
import sys
from pathlib import Path

from PIL import Image

EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
SIZE = 514


def main():
    source, target = Path(sys.argv[1]), Path(sys.argv[2])
    for expr in EXPRESSIONS:
        found = [p for p in source.glob(f'{expr}.*') if p.suffix.lower() in ('.png', '.webp')]
        if not found:
            sys.exit(f'缺 {expr} 原圖')
        im = Image.open(found[0]).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
        im.save(target / f'{expr}.webp', 'WEBP', lossless=True, method=6)
        print(f'{found[0].name} -> {target / (expr + ".webp")}')


if __name__ == '__main__':
    main()
