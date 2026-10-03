"""把使用者在 Photoshop 擺好的樹圖層轉成 map.json 的 decor。

使用者流程（工作資料夾 場景/溫室/photoshop/）：
  1. 開 溫室參考圖_3840x2688.png（地面＋種植架＋花，1:1 遊戲座標）。
  2. 新增透明圖層，把同資料夾的 tree_*.png（已是遊戲尺寸）拖進來擺，可縮放、翻轉。
  3. 只輸出那個圖層：3840×2688、透明背景 PNG。可以分成好幾張（例：tree.png、tree maple_spring.png、shrub.png）。
這支腳本：
  - 找出每張圖層裡每一棵樹／灌木（相連的不透明區塊），底部中心 = 種的位置；
  - 跟 props/ 裡的樹比對（含左右翻轉），認得出來就用原圖名稱，楓樹改寫成 tree_maple_{season} 會跟著季節換色；
    認不出來（改過顏色、合成過）就把那塊直接切成 props/placed_NN.webp；
  - 覆寫 map.json 裡原本的樹（tree_*、placed_*），花不動；樹幹所在那格設成不可走。
用法：greenhouse_tree_layer.py <圖層.png> [...]（不給就讀 photoshop/ 資料夾裡所有整張地圖大小的 PNG，參考圖除外）
"""
import json, sys
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
G = ROOT / 'public/assets/greenhouse'
PS = ROOT.parent / '場景/溫室/photoshop'
TREES = ['tree_pine', 'tree_apple', 'tree_willow', 'tree_maple_spring', 'tree_maple_summer', 'tree_maple_autumn', 'tree_maple_winter', 'shrub']
PLANTS = ('tree_', 'placed_', 'shrub')   # decor 裡由這支腳本管理的項目（花不動）
MATCH = 28          # 平均色差低於這個才算認得（0–255）


def identify(piece):
    """回傳 (名稱, 縮放, 是否翻轉)；認不出來回傳 None。"""
    best = None
    for name in TREES:
        src = Image.open(G / 'props' / f'{name}.webp').convert('RGBA')
        ref = np.asarray(src.resize(piece.size, Image.LANCZOS), np.float32)
        for flip in (False, True):
            r = ref[:, ::-1] if flip else ref
            a = np.asarray(piece, np.float32)
            both = (r[..., 3] > 128) & (a[..., 3] > 128)
            either = (r[..., 3] > 128) | (a[..., 3] > 128)
            if both.sum() < either.sum() * .8: continue          # 輪廓對不上
            err = np.abs(r[..., :3] - a[..., :3])[both].mean()
            if best is None or err < best[0]: best = (err, name, piece.height / src.height, flip)
    return None if best is None or best[0] > MATCH else best[1:]


def pieces(im):
    """一張圖層裡的每一塊：(裁下的圖, 左, 上, 右, 下)。相距 3 px 內的碎片算同一塊，框只框真正不透明的部分。"""
    solid = np.asarray(im)[..., 3] > 40
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    for i, sl in enumerate(ndimage.find_objects(lab)):
        ys, xs = np.where((lab[sl] == i + 1) & solid[sl])
        if len(ys) < 2000: continue                               # 雜點
        box = (sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1)
        yield (im.crop(box), *box)


def main(layers):
    m = json.loads((G / 'map.json').read_text(encoding='utf-8'))
    T = m['tileSize']
    old = [d for d in m.get('decor', []) if d['sprite'].startswith(PLANTS)]
    for d in old:
        if d.get('block'): m['collision'][min(m['height'] - 1, int(d['y'] - .01))][int(d['x'])] = 0
    decor = [d for d in m.get('decor', []) if d not in old]
    found_all = [(p, box) for layer in layers for p, *box in pieces(check(Image.open(layer).convert('RGBA'), m, layer))]
    for i, (piece, (l, t, r, b)) in enumerate(found_all):
        x, y = (l + r) / 2 / T, b / T
        found = identify(piece)
        if found:
            name, scale, flip = found
            sprite = 'tree_maple_{season}' if name.startswith('tree_maple_') else name
            entry = {'sprite': sprite, 'x': round(x, 3), 'y': round(y, 3), 'scale': round(scale, 4), 'block': True}
            if flip: entry['flip'] = True
        else:
            sprite = f'placed_{i + 1:02d}'
            piece.save(G / 'props' / f'{sprite}.webp', lossless=True)
            entry = {'sprite': sprite, 'x': round(x, 3), 'y': round(y, 3), 'scale': 1, 'block': True}
        tx, ty = int(x), min(m['height'] - 1, int(y - .01))
        m['collision'][ty][tx] = 1
        decor.append(entry)
        print(entry['sprite'], f'({x:.2f}, {y:.2f})', 'scale', entry['scale'], 'flip' if entry.get('flip') else '')
    m['decor'] = decor
    (G / 'map.json').write_text(json.dumps(m, ensure_ascii=False), encoding='utf-8')


def check(im, m, path):
    T = m['tileSize']
    assert im.size == (m['width'] * T, m['height'] * T), f'{path} 要是整張地圖大小 {m["width"] * T}×{m["height"] * T}，目前是 {im.size}'
    return im


if __name__ == '__main__':
    args = [Path(a) for a in sys.argv[1:]]
    if not args:
        m = json.loads((G / 'map.json').read_text(encoding='utf-8'))
        full = (m['width'] * m['tileSize'], m['height'] * m['tileSize'])   # 圖層是整張地圖大小；素材小圖、參考圖不算
        args = sorted(p for p in PS.glob('*.png') if not p.name.startswith('溫室參考圖') and Image.open(p).size == full)
    print('layers:', ', '.join(p.name for p in args))
    main(args)
