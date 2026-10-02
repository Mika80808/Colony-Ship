"""把 場景/溫室/raw/batch6_garden.png（GPT 照 greenhouse_garden_whitebox.py 的比例框畫的 7 件）切成單張，
縮成遊戲尺寸存到 public/assets/greenhouse/props/，並複製一份到 場景/溫室/photoshop/ 給使用者擺位置。
GPT 沒完全照框畫（偏大、位置偏），所以不用框切：找不透明區塊、由左到右對應 ITEMS 順序，
再依 ITEMS 裡該件的遊戲高度（鏟子平放，改用寬度）等比例縮放。
"""
import shutil
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT.parent / '場景/溫室/raw/batch6_garden.png'
OUT = ROOT / 'public/assets/greenhouse/props'
PS = ROOT.parent / '場景/溫室/photoshop'
ITEMS = [  # (名稱, 依哪一邊縮, 遊戲尺寸 px)
    ('watering_can', 'h', 45), ('trowel', 'w', 40), ('seed_bags', 'h', 40), ('plant_sign', 'h', 52),
    ('basket', 'h', 48), ('lamp_low', 'h', 80), ('lamp_tall', 'h', 250),
]
ALPHA_CUT = 90


def main():
    a = np.array(Image.open(SRC).convert('RGBA'))
    a[a[..., 3] < ALPHA_CUT, 3] = 0                                   # 清掉半透明光暈
    solid = a[..., 3] > 0
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=14))   # 水滴、土屑跟本體算同一件
    parts = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        mine = (lab[sl] == i + 1) & solid[sl]
        if mine.sum() < 800: continue
        parts.append((sl[1].start, sl, mine))
    parts.sort(key=lambda p: p[0])
    assert len(parts) == len(ITEMS), f'找到 {len(parts)} 件，預期 {len(ITEMS)} 件'
    for (name, side, size), (_, sl, mine) in zip(ITEMS, parts):
        piece = a[sl].copy(); piece[~mine, 3] = 0
        ys, xs = np.where(mine)
        piece = piece[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = piece.shape[:2]
        f = size / (h if side == 'h' else w)
        im = Image.fromarray(piece).resize((max(1, round(w * f)), max(1, round(h * f))), Image.LANCZOS)
        im.save(OUT / f'{name}.png'); shutil.copy(OUT / f'{name}.png', PS / f'{name}.png')
        print(name, im.size)


if __name__ == '__main__':
    main()
