"""用 PSD 拼場景：PSD 裡每個看得見的圖層＝一件物件，自動擺進 map.json、自動算碰撞（editor_layout.py 呼叫）。

開關：地圖編輯器工具列的「自動擺放」（匯出檔 _raw.settings.autoPlace，預設開）。
場景腳本已經擺過的圖（map.json 的 decor 裡有同名 sprite、沒有 from 的）不動，照場景腳本的。

每件物件照「圖的不透明高度」分兩種（規則跟 footprint.py 同一套，SHOW_DEPTH＝92 世界 px）：
  矮的（≤ 92 px）   整張圖都是碰撞。角色從後面最多走到圖的上緣外，身體全在物件上方，永遠不會被它蓋到，
                    所以不用單獨一層：併成一張「<PSD 檔名>-ground」圖，排在最底下（decor 的 sortY 0，跟底圖一樣在角色底下）。
  高的（> 92 px）   單獨一張圖、跟角色排前後；碰撞從圖的底邊往上到「圖的上緣往下 92 px」，
                    角色走到後面最深處時下半身被蓋住、頭和肩露在上面。
矮的也保持單獨一層的情況：會互動、有互動狀態圖（要換圖）、圖疊在單獨一層的物件前面（併進地面會被那件蓋住）。
碰撞沿著圖的輪廓切條（footprint.outline）；背後剩下的走道不到 72 px（頭寬）就往上接到牆或別的物件，不留縫。
例外（地圖編輯器標）：圖層設「不擋」＝沒有碰撞（地毯、地貼）；圖層下有手畫的碰撞＝用手畫的，不自動算。
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image

import footprint
from footprint import ALPHA, SHOW_DEPTH

SCALE = .5   # 切出來的圖是 2 倍尺寸
SEAL = 72    # 走道最窄要這麼寬（頭寬）；物件背後剩不到這麼多就接到牆（SKILL 碰撞規則 3、5）


def r4(v):
    return round(v, 4)


def overlaps(a, b):
    return min(a[2], b[2]) - max(a[0], b[0]) > 1 and min(a[3], b[3]) - max(a[1], b[1]) > 1


def standing_boxes(m, props):
    """已經在場景裡、會跟角色排前後的東西：(圖的範圍, 排序線)。場景腳本擺的 decor 和牆頂。"""
    T, out = m['tileSize'], []
    for d in m.get('decor', []):
        if d.get('sortY') == 0:
            continue
        f = props / f'{d["sprite"]}.webp'
        if not f.exists():
            continue
        w, h = (v * d['scale'] for v in Image.open(f).size)
        out.append(((d['x'] * T - w / 2, d['y'] * T - h, d['x'] * T + w / 2, d['y'] * T), d.get('sortY', d['y']) * T))
    for w in m.get('walls', []):
        if w.get('rects'):
            xs = [r[0] for r in w['rects']] + [r[0] + r[2] for r in w['rects']]
            ys = [r[1] for r in w['rects']] + [r[1] + r[3] for r in w['rects']]
            out.append(((min(xs), min(ys), max(xs), max(ys)), w['bottom']))
    return out


def solid(m, x, y, own):
    T, grid = m['tileSize'], m.get('collision') or []
    if y < 0:
        return True
    tx, ty = int(x // T), int(y // T)
    if 0 <= ty < len(grid) and 0 <= tx < len(grid[0]) and grid[ty][tx]:
        return True
    return any(id(r) not in own and r['x'] * T <= x < (r['x'] + r['w']) * T and r['y'] * T <= y < (r['y'] + r['h']) * T
               for r in m.get('collisionRects', []))


def seal(m, rects):
    """一件物件的碰撞背後到牆（或別的碰撞）剩不到 SEAL px：往上接過去。左、中、右各量一次，都碰到東西才接，接到最遠的那個。"""
    T, own = m['tileSize'], {id(r) for r in rects}
    for r in rects:
        top, gaps = r['y'] * T, []
        for x in (r['x'] * T + 4, (r['x'] + r['w'] / 2) * T, (r['x'] + r['w']) * T - 4):
            gap = next((d for d in range(1, SEAL, 2) if solid(m, x, top - d, own)), None)
            if gap is None:
                break
            gaps.append(gap)
        else:
            if max(gaps) > 1:
                r['y'], r['h'] = r4(r['y'] - max(gaps) / T), r4(r['h'] + max(gaps) / T)


def place(m, folder, psd, raw, layout, assets, note, say, split=()):
    T, props = m['tileSize'], assets / folder / 'props'
    roles = raw.get('roles') or {}
    open_ = set(raw.get('noBlock') or [])
    hand = {c['layer'] for c in raw.get('cols', []) if c.get('layer')}
    acting = {i['layer'] for i in raw.get('inters', []) if i.get('layer')}
    scripted = {d['sprite'] for d in m.get('decor', [])} | set(split)
    items, kept = [], []
    for name, L in layout.items():
        if name.startswith('_') or name.endswith('-active') or roles.get(name) in ('base', 'state', 'skip'):
            continue
        if name in scripted:
            kept.append(name)
            continue
        f = props / f'{name}.webp'
        if not f.exists():
            note(name, f'圖還沒切，先跑 python tools/art/cut.py psd {folder} <PSD>')
            continue
        img = Image.open(f).convert('RGBA')
        alpha = np.asarray(img)[..., 3]
        rows = np.nonzero(alpha.max(1) > ALPHA)[0]
        if not len(rows):
            continue
        h = (rows[-1] + 1 - rows[0]) * SCALE
        why = ('會互動' if name in acting else '有互動狀態圖' if f'{name}-active' in layout
               else f'高 {h:g} px' if h > SHOW_DEPTH else None)
        items.append({'name': name, 'img': img, 'alpha': alpha, 'h': h, 'x': L['x'], 'bottom': L['bottom'],
                      'box': (L['left'], L['top'], L['right'], L['bottom']), 'why': why})

    # 矮的併進地面；疊在單獨一層的東西前面的不能併（會被那件蓋住），一直檢查到沒有新的
    fixed = standing_boxes(m, props)
    while True:
        alone = fixed + [(it['box'], it['bottom']) for it in items if it['why']]
        moved = [it for it in items if not it['why'] and any(overlaps(it['box'], b) and it['bottom'] > s for b, s in alone)]
        if not moved:
            break
        for it in moved:
            it['why'] = '疊在別的物件前面'

    ground = f'{Path(psd).stem}-ground'
    baked = sorted((it for it in items if not it['why']), key=lambda it: it['bottom'])
    if baked:
        x0, y0 = min(it['box'][0] for it in baked), min(it['box'][1] for it in baked)
        x1, y1 = max(it['box'][2] for it in baked), max(it['box'][3] for it in baked)
        canvas = Image.new('RGBA', (math.ceil((x1 - x0) / SCALE) + 2, math.ceil((y1 - y0) / SCALE) + 2), (0, 0, 0, 0))
        for it in baked:
            canvas.alpha_composite(it['img'], (round((it['box'][0] - x0) / SCALE), round((it['box'][1] - y0) / SCALE)))
        canvas.save(props / f'{ground}.webp', lossless=True)
        w, h = (v * SCALE for v in canvas.size)
        m['decor'].append({'sprite': ground, 'id': ground, 'x': r4((x0 + w / 2) / T), 'y': r4((y0 + h) / T),
                           'scale': SCALE, 'sortY': 0, 'from': psd})
    elif (props / f'{ground}.webp').exists():
        (props / f'{ground}.webp').unlink()   # 這張是產生的，沒有東西要併就刪掉
    for it in items:
        if it['why']:
            m['decor'].append({'sprite': it['name'], 'id': it['name'], 'x': r4(it['x'] / T), 'y': r4(it['bottom'] / T),
                               'scale': SCALE, 'from': psd})

    auto = []
    for it in items:
        if it['name'] in open_ or it['name'] in hand:
            continue
        depth = it['h'] if it['h'] <= SHOW_DEPTH else it['h'] - SHOW_DEPTH
        rects = footprint.outline(it['alpha'], SCALE, it['x'], it['bottom'], T, depth / T)
        for r in rects:
            r.update({'label': it['name'], 'from': psd})
            if it['why']:
                r['of'] = it['name']   # 單獨一層的才掛（排前後用）；併進地面的那件不在 decor 裡
        m['collisionRects'] += rects
        auto.append(rects)
    for rects in auto:   # 全部擺完再接牆：背後的東西（牆、別件物件）都在了才量得準
        seal(m, rects)

    say(f'  自動擺放：單獨一層 {sum(1 for it in items if it["why"])} 件、併進地面 {len(baked)} 件'
        + (f'（{ground}.webp）' if baked else ''))
    for it in items:
        if it['why']:
            say(f'    單獨一層 {it["name"]}：{it["why"]}')
    if baked:
        say(f'    併進地面：{"、".join(it["name"] for it in baked)}')
    if open_ & {it['name'] for it in items}:
        say(f'    不擋：{"、".join(sorted(open_ & {it["name"] for it in items}))}')
    if hand & {it['name'] for it in items}:
        say(f'    用手畫的碰撞：{"、".join(sorted(hand & {it["name"] for it in items}))}')
    if kept:
        say(f'    場景腳本已經擺了，不動：{"、".join(kept)}')
    return {it['name'] for it in baked}
