"""把 Codex 產出的地面材質表（3x2 格、洋紅間隔）切成 6 張可無縫重複的材質。
規則紋理（步道、收邊地磚、木平台）依接縫週期裁切；不規則紋理（草、水、土）用半位移混合消除接縫。
每張輸出 SIZE x SIZE，代表 2x2 格。等於遊戲實際像素（一格 96px），手修時一個像素就是遊戲裡一個像素。
已存在的材質不會被覆蓋（可能是手動修改過的），要重切請加 --force。

用法：greenhouse_textures.py <sheet.png> <out_dir> [--force]
"""
import sys, os
import numpy as np
from PIL import Image

SIZE = 192
NAMES = ['walkway', 'edge', 'lawn', 'deck', 'water', 'soil']
PERIODIC = {'walkway': 'xy', 'edge': 'xy', 'deck': 'y'}
# 裁出來的週期只有 1 公尺時，重複成 2x2 湊滿 2 公尺（收邊地磚 0.5m 一塊，偵測到的完整週期只有兩塊）
REPEAT = {'edge': 2}

def swatches(a):
    magenta = (a[..., 0] > 200) & (a[..., 1] < 80) & (a[..., 2] > 200)
    def runs(mask):  # 非洋紅的連續區段
        out, start = [], None
        for i, m in enumerate(mask):
            if not m and start is None: start = i
            if m and start is not None: out.append((start, i)); start = None
        if start is not None: out.append((start, len(mask)))
        return [r for r in out if r[1] - r[0] > 100]
    cols, rows = runs(magenta.mean(0) > .5), runs(magenta.mean(1) > .5)
    return [(x0, y0, x1, y1) for (y0, y1) in rows for (x0, x1) in cols]

def seams(profile):
    """亮度剖面中的接縫中心。"""
    dark = profile < profile.mean() - 1.5 * profile.std()
    idx, out, run = np.flatnonzero(dark), [], []
    for i in idx:
        if run and i != run[-1] + 1: out.append(int(np.mean(run))); run = []
        run.append(i)
    if run: out.append(int(np.mean(run)))
    return out

def periodic_crop(a, axes):
    lum = a[..., :3].mean(2)
    x0, x1, y0, y1 = 0, a.shape[1], 0, a.shape[0]
    if 'x' in axes:
        s = seams(lum.mean(0)); x0, x1 = s[0], s[-1]
    if 'y' in axes:
        s = seams(lum.mean(1)); y0, y1 = s[0], s[-1]
    return a[y0:y1, x0:x1]

def blend_seamless(a):
    """中心保留原圖、邊緣換成半位移版本：位移版的邊緣原本就相連，所以四邊無縫。"""
    a = a.astype(np.float32)
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    wy = 1 - np.abs(np.linspace(-1, 1, h))[:, None]
    wx = 1 - np.abs(np.linspace(-1, 1, w))[None, :]
    weight = np.clip(np.minimum(wy, wx) * 3, 0, 1)[..., None]
    return (a * weight + rolled * (1 - weight)).astype(np.uint8)

def main(sheet, out, force=False):
    os.makedirs(out, exist_ok=True)
    a = np.asarray(Image.open(sheet).convert('RGB'))
    boxes = swatches(a)
    assert len(boxes) == 6, f'expected 6 swatches, found {len(boxes)}'
    for name, (x0, y0, x1, y1) in zip(NAMES, boxes):
        path = os.path.join(out, f'{name}.png')
        if os.path.exists(path) and not force: print(name, 'exists, skipped'); continue
        s = a[y0 + 4:y1 - 4, x0 + 4:x1 - 4]  # 去掉洋紅滲色的外框
        s = periodic_crop(s, PERIODIC[name]) if name in PERIODIC else blend_seamless(s)
        if name == 'deck': s = blend_seamless_x(s)
        if name in REPEAT: s = np.tile(s, (REPEAT[name], REPEAT[name], 1))
        Image.fromarray(s).resize((SIZE, SIZE), Image.LANCZOS).save(path)
        print(name, (x0, y0, x1, y1), s.shape[:2])

def blend_seamless_x(a):
    """木板只在左右方向做接縫混合（上下已按板縫週期裁好）。"""
    a = a.astype(np.float32); w = a.shape[1]
    rolled = np.roll(a, w // 2, 1)
    weight = np.clip((1 - np.abs(np.linspace(-1, 1, w))) * 3, 0, 1)[None, :, None]
    return (a * weight + rolled * (1 - weight)).astype(np.uint8)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], '--force' in sys.argv)
