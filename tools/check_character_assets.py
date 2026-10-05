"""角色素材盤點與驗收。

不帶參數：列出 public/assets 下每個角色資料夾缺哪些素材、哪些規格不符。
  python tools/check_character_assets.py

--raw <資料夾>：驗收 Codex 交來的表情圖原圖（處理前），全過才進下一步。
  python tools/check_character_assets.py --raw tools/art/blaze/raw/expressions

規格（與遊戲讀取端一致）：
- 表情圖 neutral／happy／sad／angry／surprised／shy，514×514，同一套構圖（頭不跳位）。
- portrait 512×512（角色卡）、profile 540×960 透明背景（立繪）。
- walk 688×688、4×4 格、每格 172，腳底在 y=166（tools/pack_walk_sheet.py 產出）。
- 玩家只有行走圖 688×516（4×3），外觀由玩家自填，不做頭像與立繪。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'public' / 'assets'
CHARACTERS = ['lucian', 'blaze', 'Aiden', 'Ethan', 'Luca']
EXPRESSIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy']
CELL, FEET_Y = 172, 166


def check_walk(path, problems):
    im = Image.open(path).convert('RGBA')
    if im.size != (688, 688):
        problems.append(f'walk 尺寸 {im.size}，應為 688×688（先跑 tools/pack_walk_sheet.py）')
        return
    alpha = np.array(im)[:, :, 3]
    for r in range(4):
        for c in range(4):
            cell = alpha[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] > 20
            if not cell.any():
                problems.append(f'walk 第 {r + 1} 列第 {c + 1} 格是空的')
                continue
            bottom = np.where(cell.any(axis=1))[0][-1]
            if abs(bottom - (FEET_Y - 1)) > 2:
                problems.append(f'walk 第 {r + 1} 列第 {c + 1} 格腳底在 y={bottom + 1}，應為 {FEET_Y}')


def audit():
    total = 0
    for name in CHARACTERS:
        folder = ASSETS / name
        problems, missing = [], []
        for expr in EXPRESSIONS:
            path = folder / f'{expr}.webp'
            if not path.exists():
                missing.append(f'表情 {expr}')
            elif Image.open(path).size != (514, 514):
                problems.append(f'{expr} 尺寸 {Image.open(path).size}，應為 514×514')
        for file, size, label in [('portrait.webp', (512, 512), '角色卡 portrait'), ('profile.webp', (540, 960), '立繪 profile')]:
            path = folder / file
            if not path.exists():
                missing.append(label)
            elif Image.open(path).size != size:
                problems.append(f'{file} 尺寸 {Image.open(path).size}，應為 {size[0]}×{size[1]}')
        if (folder / 'walk.webp').exists():
            check_walk(folder / 'walk.webp', problems)
        else:
            missing.append('行走圖 walk')
        status = '齊全' if not missing and not problems else ''
        print(f'== {name} {status}')
        for m in missing:
            print(f'  缺：{m}')
        for p in problems:
            print(f'  不符：{p}')
        total += len(missing) + len(problems)
    player = ASSETS / 'player' / 'walk.webp'
    size = Image.open(player).size if player.exists() else None
    print(f'== player 行走圖 {size}' + ('' if size == (688, 516) else '（應為 688×516）'))
    return total


def content_box(im):
    """非背景（非近白、非透明）區域的外框。"""
    a = np.array(im.convert('RGBA')).astype(int)
    fg = (a[:, :, 3] > 20) & (a[:, :, :3].min(axis=2) < 235)
    ys, xs = np.where(fg)
    return xs.min(), ys.min(), xs.max(), ys.max()


def check_raw(folder):
    folder = Path(folder)
    problems = []
    files = {}
    for expr in EXPRESSIONS:
        found = [p for p in folder.glob(f'{expr}.*') if p.suffix.lower() in ('.png', '.webp')]
        if not found:
            problems.append(f'缺 {expr}.png')
        else:
            files[expr] = Image.open(found[0])
    for expr, im in files.items():
        w, h = im.size
        if w != h or w < 512:
            problems.append(f'{expr} 尺寸 {im.size}，應為正方形且至少 512')
        rgba = np.array(im.convert('RGBA')).astype(int)
        # 只看上方兩角：半身像的肩膀本來就會碰到下緣。
        corners = [rgba[:8, :8], rgba[:8, -8:]]
        clean = [((c[:, :, 3] < 20) | (c[:, :, :3].min(axis=2) >= 235)).all() for c in corners]
        if not all(clean):
            problems.append(f'{expr} 上方兩角不是純白或透明背景（可能有格紋、洋紅或場景）')
    if 'neutral' in files:
        ref = files['neutral']
        rx0, ry0, rx1, ry1 = content_box(ref)
        for expr, im in files.items():
            if expr == 'neutral' or im.size != ref.size:
                continue
            x0, y0, x1, y1 = content_box(im)
            tol = ref.size[0] * 0.06
            if abs(y0 - ry0) > tol or abs(x0 - rx0) > tol or abs(x1 - rx1) > tol:
                problems.append(f'{expr} 頭部位置和 neutral 差太多（構圖跳位）')
    for p in problems:
        print(f'  不符：{p}')
    print('原圖驗收通過' if not problems else f'原圖驗收未過：{len(problems)} 項')
    return len(problems)


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--raw':
        sys.exit(1 if check_raw(sys.argv[2]) else 0)
    sys.exit(1 if audit() else 0)
