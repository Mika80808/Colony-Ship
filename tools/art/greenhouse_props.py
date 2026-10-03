"""溫室自然區的花叢與樹：把使用者放在 場景/溫室/raw/ 的整張圖切成單張，存到 public/assets/greenhouse/props/。

- flower.png：5×4 格花叢 → flower_01.png … flower_20.png（由左到右、由上到下）。
- tree.png：7 棵樹 → tree_pine、tree_apple、tree_willow，以及同一棵楓樹的四季
  tree_maple_spring／summer／autumn／winter（使用者指定右邊四棵依序為春夏秋冬）。
切點取預期位置附近最空的那一欄／列；半透明的霧邊（alpha < ALPHA_CUT）清掉，
樹底下 GPT 多畫的白色地面污漬（淺色、低彩度、在樹幹底下）也清掉。輸出保留原解析度，放進地圖時再縮放。
"""
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT.parent / '場景/溫室/raw'
OUT = ROOT / 'public/assets/greenhouse/props'
ALPHA_CUT = 90
TREES = ['tree_pine', 'tree_apple', 'tree_willow', 'tree_maple_spring', 'tree_maple_summer', 'tree_maple_autumn', 'tree_maple_winter']


def cuts(occ, n):
    """長度 len(occ) 平均分 n 段，每個分界在 ±1/3 段寬內找最空的位置。"""
    step, out = len(occ) / n, []
    for i in range(1, n):
        c, r = round(i * step), round(step / 3)
        out.append(c - r + int(np.argmin(occ[c - r:c + r])))
    return [0, *out, len(occ)]


def clean(a, trunk_floor=False):
    a = a.copy()
    a[a[..., 3] < ALPHA_CUT, 3] = 0
    a[a[..., 3] > 0, 3] = 255
    if trunk_floor:                     # 白色地面污漬：淺色、低彩度
        rgb = a[..., :3].astype(int)
        whiteish = (rgb.min(-1) > 170) & (rgb.max(-1) - rgb.min(-1) < 40)
        a[whiteish & (np.arange(a.shape[0])[:, None] > a.shape[0] * .8), 3] = 0
    lab, n = ndimage.label(a[..., 3] > 0)
    if n:                               # 只留最大的一塊和貼著它的碎片，零星雜點丟掉
        sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= max(60, sizes.max() * .01)])
        a[~keep, 3] = 0
    ys, xs = np.where(a[..., 3] > 0)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def split_sheet(path, cols, rows):
    a = np.array(Image.open(path).convert('RGBA'))
    solid = a[..., 3] >= ALPHA_CUT
    xs, ys = cuts(solid.sum(0), cols), cuts(solid.sum(1), rows)
    return [a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]] for r in range(rows) for c in range(cols)]


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for i, piece in enumerate(split_sheet(RAW / 'flower.png', 5, 4)):
        Image.fromarray(clean(piece)).save(OUT / f'flower_{i + 1:02d}.webp', lossless=True)
    for name, piece in zip(TREES, split_sheet(RAW / 'tree.png', 7, 1)):
        im = clean(piece, trunk_floor=True)
        Image.fromarray(im).save(OUT / f'{name}.webp', lossless=True)
        print(name, im.shape[1], im.shape[0])
