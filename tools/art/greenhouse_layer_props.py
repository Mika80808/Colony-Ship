"""把使用者在 Photoshop 擺好位置的圖層（整張地圖大小 3840×2688、透明底）原樣放進 map.json 的 decor。
跟 greenhouse_tree_layer.py 不同：不比對素材、不換季，圖層裡每一塊不透明區域直接切成 props/<名稱>[_N].png，
位置就是它在圖層上的位置（底部中心），前後排序看底部，縮放 1。重跑會先移除同名的舊項目。
擋路的格子不在這裡改（大型擺設的佔地要看形狀），直接改 map.json 的 collision。

用法：greenhouse_layer_props.py <圖層.png>=<名稱> [...]
例：  greenhouse_layer_props.py 觀景窗框.png=window_frame 觀景窗植物.png=window_plants
"""
import json, sys
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
G = ROOT / 'public/assets/greenhouse'
PS = ROOT.parent / '場景/溫室/photoshop'


def pieces(im, min_px=500):
    """圖層裡每一塊（相距 6 px 內算同一塊，例如桌上的小東西和桌子）：(裁下的圖, 左, 上, 右, 下)。"""
    solid = np.asarray(im)[..., 3] > 40
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        mine = (lab[sl] == i + 1) & solid[sl]
        ys, xs = np.where(mine)
        if len(ys) < min_px: continue
        box = (sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1)
        crop = np.asarray(im.crop(box)).copy()
        crop[..., 3] *= mine[ys.min():ys.max() + 1, xs.min():xs.max() + 1]   # 只留這一塊，別的碎片不要
        out.append((Image.fromarray(crop), *box))
    return sorted(out, key=lambda p: p[1])                                   # 由左到右編號


def main(pairs):
    m = json.loads((G / 'map.json').read_text(encoding='utf-8'))
    T, full = m['tileSize'], (m['width'] * m['tileSize'], m['height'] * m['tileSize'])
    for layer, name in pairs:
        im = Image.open(layer).convert('RGBA')
        assert im.size == full, f'{layer} 要是整張地圖大小 {full}，目前是 {im.size}'
        found = pieces(im)
        m['decor'] = [d for d in m.get('decor', []) if not (d['sprite'] == name or d['sprite'].startswith(name + '_'))]
        for i, (piece, l, t, r, b) in enumerate(found):
            sprite = name if len(found) == 1 else f'{name}_{i + 1}'
            piece.save(G / 'props' / f'{sprite}.png')
            m['decor'].append({'sprite': sprite, 'x': round((l + r) / 2 / T, 4), 'y': round(b / T, 4), 'scale': 1})
            print(f'{layer.name} → {sprite}  x {l}–{r}  y {t}–{b}（格 {l / T:.2f}–{r / T:.2f}, {t / T:.2f}–{b / T:.2f}）')
    (G / 'map.json').write_text(json.dumps(m, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    pairs = []
    for arg in sys.argv[1:]:
        path, name = arg.rsplit('=', 1)
        p = Path(path)
        pairs.append((p if p.exists() else PS / p, name))
    main(pairs)
