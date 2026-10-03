"""把使用者在 Photoshop 擺好位置的圖層（整張地圖大小 3840×2688、透明底）原樣放進 map.json 的 decor。
跟 greenhouse_tree_layer.py 不同：不比對素材、不換季，圖層裡每一塊不透明區域直接切成 props/<名稱>[_N].webp，
位置就是它在圖層上的位置（底部中心），前後排序看底部，縮放 1。重跑會先移除同名的舊項目。
擋路的格子不在這裡改（大型擺設的佔地要看形狀），直接改 map.json 的 collision。

用法：greenhouse_layer_props.py <圖層.png>=<名稱> [...]
例：  greenhouse_layer_props.py 觀景窗框.png=window_frame 觀景窗植物.png=window_plants
"""
import sys
from PIL import Image
from pathlib import Path

from greenhouse_common import G, PS, check_size, load_map, pieces, save_map


def main(pairs):
    m = load_map()
    T = m['tileSize']
    for layer, name in pairs:
        im = check_size(Image.open(layer).convert('RGBA'), m, layer)
        # 相距 6 px 內算同一塊（例如桌上的小東西和桌子）；框內只留這一塊，由左到右編號。
        found = sorted(pieces(im, gap=6, min_px=500, mask=True), key=lambda p: p[1])
        m['decor'] = [d for d in m.get('decor', []) if not (d['sprite'] == name or d['sprite'].startswith(name + '_'))]
        for i, (piece, l, t, r, b) in enumerate(found):
            sprite = name if len(found) == 1 else f'{name}_{i + 1}'
            piece.save(G / 'props' / f'{sprite}.webp', lossless=True)
            m['decor'].append({'sprite': sprite, 'x': round((l + r) / 2 / T, 4), 'y': round(b / T, 4), 'scale': 1})
            print(f'{layer.name} → {sprite}  x {l}–{r}  y {t}–{b}（格 {l / T:.2f}–{r / T:.2f}, {t / T:.2f}–{b / T:.2f}）')
    save_map(m)


if __name__ == '__main__':
    pairs = []
    for arg in sys.argv[1:]:
        path, name = arg.rsplit('=', 1)
        p = Path(path)
        pairs.append((p if p.exists() else PS / p, name))
    main(pairs)
