"""溫室物件碰撞：照圖重算 public/assets/greenhouse/map.json 裡每件擋路物件的 collisionRects（規則在 footprint.py）。

用法：python tools/art/greenhouse_collision.py [--dry]
  每件 block 的 decor 要有 id 和 depth（物件在地上佔的深度，格）。碰撞沿著圖的輪廓切成幾塊（footprint.outline），都帶 of＝物件 id；
  種植架（map.json 的 racks）也照外框圖算，of＝rack-x,y，深度是架子佔的格數；它佔的整格碰撞會清掉。
  沒有 of 的矩形（全景窗窗台那排細條）不動。移動物件、換圖、改 depth 後重跑。
  --dry 只印出新舊差異，不寫檔。
季節換圖的樹（sprite 有 {season}）四季各算一次取聯集；flip 的物件圖左右翻過來算。
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

import footprint

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / 'public/assets/greenhouse/map.json'
PROPS = ROOT / 'public/assets/greenhouse/props'
SEASONS = ['spring', 'summer', 'autumn', 'winter']


def alpha_of(sprite, flip=False):
    a = np.array(Image.open(PROPS / f'{sprite}.webp').convert('RGBA'))[:, :, 3]
    return a[:, ::-1] if flip else a


def stacked(alphas):
    """幾張圖底部置中疊在一起（季節圖高度可能差一兩 px），取每個像素最不透明的。"""
    h, w = max(a.shape[0] for a in alphas), max(a.shape[1] for a in alphas)
    out = np.zeros((h, w), np.uint8)
    for a in alphas:
        y, x = h - a.shape[0], (w - a.shape[1]) // 2
        out[y:, x:x + a.shape[1]] = np.maximum(out[y:, x:x + a.shape[1]], a)
    return out


def rects_for(d, T):
    sprites = [d['sprite'].replace('{season}', s) for s in SEASONS] if '{season}' in d['sprite'] else [d['sprite']]
    alpha = stacked([alpha_of(s, d.get('flip')) for s in sprites])
    return [{**r, 'of': d['id']} for r in footprint.outline(alpha, d['scale'], d['x'] * T, d['y'] * T, T, d['depth'])]


def rack_rects(rack, T):
    """種植架：外框圖（rack_shelf／rack_trellis）放大 meta.scale 倍、左上角在 (x, y+h) 格往上一張圖高，深度＝架子佔的格數 h。"""
    meta = json.loads((MAP.parent / 'racks.json').read_text(encoding='utf-8'))
    alpha = alpha_of_file(MAP.parent / f"rack_{rack['kind']}.webp")
    cx = rack['x'] * T + meta['width'] * meta['scale'] / 2
    return [{**r, 'of': rack_id(rack)} for r in footprint.outline(alpha, meta['scale'], cx, (rack['y'] + rack['h']) * T, T, rack['h'])]


def rack_id(rack):
    return f"rack-{rack['x']},{rack['y']}"   # 跟 src/game/racks.ts 的 rackKey 同一組座標


def alpha_of_file(path):
    return np.array(Image.open(path).convert('RGBA'))[:, :, 3]


def main(dry=False):
    m = json.loads(MAP.read_text(encoding='utf-8'))
    T = m['tileSize']
    blocks = [d for d in m['decor'] if d.get('block')]
    missing = [d['sprite'] for d in blocks if 'id' not in d or 'depth' not in d]
    if missing:
        sys.exit(f'這些擋路物件缺 id 或 depth：{missing}')
    old = {}
    for r in m['collisionRects']:
        if 'of' in r:
            old.setdefault(r['of'], []).append(r)
    racks = m.get('racks', [])
    new = [r for d in blocks for r in rects_for(d, T)] + [r for k in racks for r in rack_rects(k, T)]
    show = lambda rs: f"{len(rs)} 塊，外框 " + ('%.3f,%.3f %.3f×%.3f' % tuple(footprint.union(rs)[k] for k in 'xywh'))
    for oid in [d['id'] for d in blocks] + [rack_id(k) for k in racks]:
        o, n = old.get(oid, []), [r for r in new if r['of'] == oid]
        if o != n:
            print(f"{oid:<16} {show(o) if o else '(新)'}  →  {show(n)}")
    # 種植架不再用整格擋：佔的格子清成可走，改由上面照圖算的矩形擋
    cleared = sum(m['collision'][y][x] for k in racks for y in range(k['y'], k['y'] + k['h']) for x in range(k['x'], k['x'] + k['w']))
    if cleared:
        print(f'種植架佔的 {cleared} 格整格碰撞清掉')
    if dry:
        return
    for k in racks:
        for y in range(k['y'], k['y'] + k['h']):
            for x in range(k['x'], k['x'] + k['w']):
                m['collision'][y][x] = 0
    m['collisionRects'] = new + [r for r in m['collisionRects'] if 'of' not in r]
    MAP.write_text(json.dumps(m, ensure_ascii=False), encoding='utf-8')
    print(f'寫入 {len(blocks)} 件物件、{len(racks)} 座種植架、{len(new)} 塊碰撞')


if __name__ == '__main__':
    main('--dry' in sys.argv)
