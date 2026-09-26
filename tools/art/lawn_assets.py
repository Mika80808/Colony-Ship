"""把 Codex 生的草地素材整理成可手修的零件（遊戲實際像素，一格 96px）：

- <textures>/lawn_field.png      大片草地，四邊無縫（半位移混合），鋪滿整張地圖用
- <textures>/lawn_clumps/NN.png  一個個葉團（透明背景），沿水邊與草地上散放用

原圖比例：草地原圖 1536 寬＝約 8 公尺（192px/m），遊戲 96px/m，所以兩張原圖都縮 SCALE=0.5。
已存在的零件不會覆蓋（可能是手修過的），要重做請加 --force。

用法：lawn_assets.py <field_raw.png> <clumps_raw.png> <textures_dir> [--force]
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SCALE = .5

def seamless(a):
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    weight = np.clip(np.minimum(1 - np.abs(np.linspace(-1, 1, h))[:, None], 1 - np.abs(np.linspace(-1, 1, w))[None, :]) * 3, 0, 1)[..., None]
    return a * weight + rolled * (1 - weight)

def field(src, out):
    im = Image.open(src).convert('RGB')
    im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)
    a = seamless(np.asarray(im, np.float32))
    Image.fromarray(a.round().astype(np.uint8)).save(out); print('field', out, im.size)

def clumps(src, out_dir):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (np.minimum(r, b) - g > 70) & (r > 150) & (b > 150)
    fg = ndimage.binary_erosion(~magenta, iterations=2)      # 去掉洋紅滲色的外緣
    fg = ndimage.binary_opening(fg, iterations=1)
    lab, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(-sizes) if sizes[i] > 800]
    os.makedirs(out_dir, exist_ok=True)
    boxes = sorted(((ndimage.find_objects((lab == k).astype(int))[0], k) for k in keep), key=lambda t: (t[0][0].start // 200, t[0][1].start))
    for i, ((ys, xs), k) in enumerate(boxes):
        mask = (lab[ys, xs] == k).astype(np.float32)
        rgb = a[ys, xs] * mask[..., None]                     # premultiplied，縮小時邊緣不帶洋紅
        size = (max(1, round(mask.shape[1] * SCALE)), max(1, round(mask.shape[0] * SCALE)))
        small = [np.asarray(Image.fromarray(c.astype(np.uint8)).resize(size, Image.LANCZOS), np.float32) for c in (*np.moveaxis(rgb, 2, 0), mask * 255)]
        alpha = np.clip(small[3], 0, 255)
        color = np.clip(np.dstack(small[:3]) / np.maximum(alpha[..., None] / 255, 1e-3), 0, 255)
        Image.fromarray(np.dstack([color, alpha]).round().astype(np.uint8), 'RGBA').save(os.path.join(out_dir, f'{i:02d}.png'))
    print('clumps', len(boxes), out_dir)

if __name__ == '__main__':
    field_src, clumps_src, tex = sys.argv[1:4]
    force = '--force' in sys.argv
    f_out, c_out = os.path.join(tex, 'lawn_field.png'), os.path.join(tex, 'lawn_clumps')
    if force or not os.path.exists(f_out): field(field_src, f_out)
    else: print('lawn_field.png exists, skipped')
    if force or not os.path.isdir(c_out): clumps(clumps_src, c_out)
    else: print('lawn_clumps/ exists, skipped')
