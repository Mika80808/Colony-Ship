"""把 GPT 的「像素風」圖整理成真正的像素畫：找出隱含的像素格 → 每格收成一個顏色 → 減色 → 放大回原尺寸。

用法：
  python tools/art/pixel_snap.py 原圖.png [--colors 32] [--grid 自動] [--out 輸出.png]
輸出：<原圖>_snap.png（原尺寸，最近鄰放大）與 <原圖>_snap_1x.png（一格一像素）。

做法：
1. 格子：從水平／垂直邊緣的週期找出格子大小（3–12 px）和起點。
2. 每格取色：一般取中間 2x2 的中位數（避開邊上的混色）；格子裡夠多明顯偏暗的像素 → 取暗色（保描邊）；
   夠多明顯偏亮 → 取亮色（保星星、細高光）。
3. 減色：k-means，依「顏色種類」取樣（小面積的葉子也分得到色），不是依像素數。
4. 孤立點：跟周圍很像的單點併掉；高對比單點（星星）保留。
透明圖會保留 alpha（每格取多數決，只有全透明／不透明）。
"""
import argparse
import warnings
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.vq import kmeans2


def find_grid(lum, lo=3.0, hi=8.0):
    """回傳 (x 格寬, y 格高, x 起點, y 起點)，可以是小數（GPT 的格子常是 4.9 這種）。
    兩個方向分開找；上限 8 px，免得抓到牆板接縫這種大週期。"""
    # 自動偵測只找整數格（兩方向同一格寬）：小數格寬的誤差會一路累積、越到後面越錯位。
    # GPT 沒照固定格子畫的圖自動抓不準，就用 --grid 手動指定。
    def spectrum(axis):
        g = np.abs(np.diff(lum, axis=axis)).sum(axis=1 - axis)   # g[i]：第 i 與 i+1 個像素之間的邊緣強度
        g = g - np.convolve(g, np.ones(15) / 15, 'same')
        n = np.arange(len(g))
        return {p: (g * np.exp(2j * np.pi * n / p)).sum() / np.abs(g).sum() for p in range(int(lo), int(hi) + 1)}
    sx, sy = spectrum(1), spectrum(0)
    p = max(sx, key=lambda p: abs(sx[p]) + abs(sy[p]))
    off = lambda s: (-np.angle(s) / (2 * np.pi) * p + 1) % p
    return float(p), float(p), round(off(sx[p])), round(off(sy[p]))


def snap(im, colors=32, grid=None, dark=45, bright=45, min_dark=None, min_bright=None):
    rgba = np.asarray(im.convert('RGBA')).astype(np.float32)
    A, alpha = rgba[..., :3], rgba[..., 3]
    px, py, ox, oy = grid or find_grid(A.mean(2))
    H, W = A.shape[:2]
    nx, ny = int((W - ox) // px), int((H - oy) // py)
    K = max(2, int(round(min(px, py))))   # 每格取 K x K 個取樣點
    xs = (ox + np.arange(nx)[:, None] * px + (np.arange(K)[None] + .5) * px / K).astype(int).clip(0, W - 1)
    ys = (oy + np.arange(ny)[:, None] * py + (np.arange(K)[None] + .5) * py / K).astype(int).clip(0, H - 1)
    blk = A[ys[:, :, None, None], xs[None, None]].transpose(0, 2, 1, 3, 4)   # (ny, nx, K, K, 3)
    P = K
    cells = blk.reshape(ny, nx, P * P, 3)
    c0, c1 = P // 2 - 1, P // 2 + 1
    low = np.median(blk[:, :, c0:c1, c0:c1].reshape(ny, nx, -1, 3), axis=2)
    lum = cells.mean(-1)
    med = np.median(lum, axis=2, keepdims=True)
    min_dark = min_dark or max(2, P * P // 4)
    min_bright = min_bright or max(2, P * P // 5)

    def pick(mask):
        m = np.where(mask[..., None], cells, np.nan)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)  # 沒有暗／亮像素的格子
            return mask.sum(2), np.nan_to_num(np.nanmedian(m, axis=2))
    nb, bc = pick(lum > med + bright)
    nd, dc = pick(lum < med - dark)
    low = np.where((nb >= min_bright)[..., None], bc, low)
    low = np.where((nd >= min_dark)[..., None], dc, low)   # 描邊優先

    a = alpha[ys[:, :, None, None], xs[None, None]].transpose(0, 2, 1, 3).reshape(ny, nx, -1)
    solid = (a > 127).mean(-1) >= .5

    flat = low.reshape(-1, 3)
    use = flat[solid.reshape(-1)] if (~solid).any() else flat
    key = (use // 8).astype(int)
    _, idx = np.unique(key[:, 0] * 1024 + key[:, 1] * 32 + key[:, 2], return_index=True)
    pal, _ = kmeans2(np.vstack([use[idx], use]), colors, seed=1, minit='++', iter=40)
    pal = np.clip(pal, 0, 255)
    lab = np.concatenate([((flat[i:i + 65536, None] - pal[None]) ** 2).sum(-1).argmin(1)
                          for i in range(0, len(flat), 65536)]).reshape(ny, nx)
    for _ in range(2):
        c3 = np.stack([ndimage.uniform_filter((lab == k).astype(np.float32), 3, mode='nearest') * 9
                       for k in range(colors)], -1)
        same = np.take_along_axis(c3, lab[..., None], -1)[..., 0] - 1
        maj = c3.argmax(-1)
        lone = (same < .5) & (np.abs(pal[lab].mean(-1) - pal[maj].mean(-1)) < 40)
        lab[lone] = maj[lone]
    out = np.dstack([pal[lab], np.where(solid, 255, 0)]).astype(np.uint8)
    small = Image.fromarray(out, 'RGBA')
    # 放大回原尺寸：每個原圖像素對回它所屬的格子（格寬可以是小數）
    gx = np.clip(((np.arange(W) - ox) // px).astype(int), 0, nx - 1)
    gy = np.clip(((np.arange(H) - oy) // py).astype(int), 0, ny - 1)
    big = Image.fromarray(out[gy[:, None], gx[None]], 'RGBA')
    return small, big, (px, py, ox, oy)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--colors', type=int, default=32)
    ap.add_argument('--grid', type=float, nargs=4, metavar=('W', 'H', 'X', 'Y'), help='手動指定格寬、格高、起點')
    ap.add_argument('--out')
    args = ap.parse_args()
    src = Path(args.src)
    im = Image.open(src)
    small, big, grid = snap(im, args.colors, tuple(args.grid) if args.grid else None)
    out = Path(args.out) if args.out else src.with_name(src.stem + '_snap.png')
    keep_alpha = im.mode in ('RGBA', 'LA', 'P')
    (big if keep_alpha else big.convert('RGB')).save(out)
    (small if keep_alpha else small.convert('RGB')).save(out.with_name(out.stem + '_1x.png'))
    print(f'格子 {grid[0]:.2f}x{grid[1]:.2f}px 起點 ({grid[2]:.1f}, {grid[3]:.1f}) → {small.width}x{small.height}，{args.colors} 色 → {out}')
