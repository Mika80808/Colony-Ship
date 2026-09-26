"""把手繪（或 AI 生成）的草地組件重組成可無縫拼接的 A2 autotile（一格 96px → 192x288）。

來源圖是白底，需要三個組件的範圍（x0,y0,x1,y1，原圖像素）：
  --fill    無縫填充用的整片草（大約 1 格）
  --island  2x2 格的草島（四邊與四個外角的葉緣從這裡取）
  --preview 單獨一叢（只拿來當 A2 左上的預覽格，遊戲不會用到）

組法（全部用「相對中心材質的差值」處理，所以往內一定淡回中心、不會有接縫）：
- 中心：填充草縮成 96px，半位移混合成 1 格週期。
- 四邊：草島的外緣帶，沿著邊的方向做半位移混合 → 1 格週期，相鄰格接得上。
- 外角：草島的四個角，靠近接邊處淡進該邊的延續，所以角和邊接得上。
- 內角：由「上面那格的直邊」和「旁邊那格的橫邊」各自的延續疊起來，兩側一定接得上。
白底用「大片白色連通區」判斷，小白花不會被挖掉。

用法：autotile_from_art.py <art.png> <out.png> --fill x0 y0 x1 y1 --island x0 y0 x1 y1 --preview x0 y0 x1 y1
"""
import argparse
import numpy as np
from PIL import Image
from scipy import ndimage

T, Q = 96, 48

def load_rgba(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    white = a.min(2) > 235
    lab, n = ndimage.label(white)
    sizes = ndimage.sum(white, lab, range(1, n + 1))
    bg = np.isin(lab, 1 + np.flatnonzero(sizes > 3000))
    fg = ndimage.binary_erosion(~bg, iterations=2)  # 去掉貼著白底的淺色光暈
    return np.dstack([a, fg * 255.0])

def piece(art, box, size):
    """裁出組件、縮到指定大小，回傳 premultiplied RGBA（0~1）。"""
    x0, y0, x1, y1 = box
    crop = art[y0:y1, x0:x1] / 255.0
    pm = np.dstack([crop[..., :3] * crop[..., 3:], crop[..., 3:]])
    out = [np.asarray(Image.fromarray((pm[..., i] * 255).astype(np.uint8)).resize(size, Image.LANCZOS), np.float32) / 255 for i in range(4)]
    return np.dstack(out)

def seamless(a):
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    weight = np.clip(np.minimum(1 - np.abs(np.linspace(-1, 1, h))[:, None], 1 - np.abs(np.linspace(-1, 1, w))[None, :]) * 3, 0, 1)[..., None]
    return a * weight + rolled * (1 - weight)

def periodic(delta, axis):
    """沿 axis 方向把長度 96 的帶子修成首尾相接（週期 1 格）。"""
    n = delta.shape[axis]
    w = 1 - np.abs(np.linspace(-1, 1, n))
    w = w[None, :, None] if axis == 1 else w[:, None, None]
    return delta * w + np.roll(delta, n // 2, axis) * (1 - w)

def over(top, bottom):
    return top + bottom * (1 - top[..., 3:])

def build(art, fill_box, island_box, preview_box):
    center = seamless(piece(art, fill_box, (T, T)))
    center[..., 3] = 1
    C = np.tile(center, (2, 2, 1))                       # 192x192，與 A2 區塊對齊（座標 mod 96）

    # 2x2 區塊：外緣帶取草島，往內淡回中心；存成相對中心的差值
    island = piece(art, island_box, (2 * T, 2 * T))
    ys, xs = np.mgrid[0:2 * T, 0:2 * T] + .5
    edge = np.minimum(np.minimum(xs, 2 * T - xs), np.minimum(ys, 2 * T - ys))
    w = np.clip((44 - edge) / 14, 0, 1)[..., None]
    D = (island * w + C * (1 - w)) - C

    # 四邊：週期化（上下邊沿 x、左右邊沿 y；中段 48..144）
    D[0:Q, Q:3 * Q] = periodic(D[0:Q, Q:3 * Q], 1)
    D[3 * Q:, Q:3 * Q] = periodic(D[3 * Q:, Q:3 * Q], 1)
    D[Q:3 * Q, 0:Q] = periodic(D[Q:3 * Q, 0:Q], 0)
    D[Q:3 * Q, 3 * Q:] = periodic(D[Q:3 * Q, 3 * Q:], 0)

    # 外角：靠接邊處淡進該邊的延續（邊的週期是 96，所以延續就是差 96 的那一欄／列）
    ramp = np.clip((np.arange(Q) - 28) / 20, 0, 1)      # 0..1，越靠內側越接近邊
    for cy in (0, 3 * Q):
        for cx in (0, 3 * Q):
            corner = D[cy:cy + Q, cx:cx + Q].copy()
            # 橫向：接上／下邊
            src_x = np.arange(cx, cx + Q) + (T if cx == 0 else -T)
            wx = (ramp if cx == 0 else ramp[::-1])[None, :, None]
            corner = corner * (1 - wx) + D[cy:cy + Q][:, src_x] * wx
            # 縱向：接左／右邊
            src_y = np.arange(cy, cy + Q) + (T if cy == 0 else -T)
            wy = (ramp if cy == 0 else ramp[::-1])[:, None, None]
            corner = corner * (1 - wy) + D[src_y][:, cx:cx + Q] * wy
            D[cy:cy + Q, cx:cx + Q] = corner
    block = C + D

    # 內角：直邊的延續（上下方那格）疊上橫邊的延續（左右那格）
    def q(rows, cols): return block[rows[0]:rows[1], cols[0]:cols[1]]
    inner = np.zeros((T, T, 4), np.float32)
    # (quarter 位置 in 內角格, 直邊來源, 橫邊來源)；座標是區塊內（0..192）
    specs = {
        (0, 0): (((96, 144), (0, 48)), ((0, 48), (96, 144))),     # 左上：左邊 (0,4) 列、上邊 (2,2) 欄
        (0, 1): (((96, 144), (144, 192)), ((0, 48), (48, 96))),   # 右上：右邊 (3,4)、上邊 (1,2)
        (1, 0): (((48, 96), (0, 48)), ((144, 192), (96, 144))),   # 左下：左邊 (0,3)、下邊 (2,5)
        (1, 1): (((48, 96), (144, 192)), ((144, 192), (48, 96))), # 右下：右邊 (3,3)、下邊 (1,5)
    }
    for (r, c), (vert, horiz) in specs.items():
        a, b = q(*vert), q(*horiz)
        inner[r * Q:(r + 1) * Q, c * Q:(c + 1) * Q] = over(a, b) * .5 + over(b, a) * .5

    sheet = np.zeros((3 * T, 2 * T, 4), np.float32)
    sheet[T:, :] = block
    sheet[:T, T:] = inner
    sheet[:T, :T] = piece(art, preview_box, (T, T))
    alpha = np.clip(sheet[..., 3:], 1e-6, 1)
    rgb = np.clip(sheet[..., :3] / alpha, 0, 1) * (sheet[..., 3:] > 1e-4)
    return Image.fromarray((np.dstack([rgb, sheet[..., 3:]]) * 255).round().astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('art'); p.add_argument('out')
    for k in ('fill', 'island', 'preview'): p.add_argument(f'--{k}', nargs=4, type=int, required=True)
    a = p.parse_args()
    build(load_rgba(a.art), a.fill, a.island, a.preview).save(a.out)
    print('saved', a.out)
