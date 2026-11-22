"""居住區房間：產生設施場景格式（FacilityScene 用）的 map.json 與底圖，每位住戶一份（加上沒有陳設的空房）。

用法：python tools/art/room_map.py
讀  public/assets/rooms/shell.json（所有房間共用的殼：牆、地板、浴室、房門）
    public/assets/rooms/furnishings/<住戶>.json（住戶的家具、地毯、座位、床、巡遊點）
寫  public/assets/rooms/<住戶>/map.json、ground.webp、props/<物件>.webp（照擺放大小縮好的圖）
    public/assets/rooms/empty/…（空房）
    public/assets/rooms/shell/cut/…（前景牆、淋浴間拆成的後半與玻璃，所有房間共用）

座標：房間 1254 × 1254 px，一格 24 px。
碰撞：照原本房間的判斷（地板範圍、北牆分兩段、南側矮牆可以走進去 72 px、牆兩側多擋 36 px、
  家具接地範圍、腳底 28 × 14 的範圍）每 3 px 算一次腳點能不能站，換成整格碰撞＋橫條矩形（跟艦橋同一套做法）。
排前後：家具照原本的排序線（depth），不是圖的底邊；坐著、躺著的排序線也照原本。
淋浴、房門動畫、沙發扶手在 src/game/roomExtras.ts。重跑會產生同樣的結果。
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
ROOMS = ROOT / 'public/assets/rooms'
T = 24
STEP = 3
RADIUS = 22                         # 腳圈半徑（src/game/facility.ts 的 RADIUS）
FOOT = (28, 14)                     # 原本房間的腳底範圍（半寬、半深）
ACTOR_HEIGHT = 148
SEATED_SHIFT = .3 * ACTOR_HEIGHT    # 原本坐姿畫在腳點往上 .85 個身高，設施場景是 .55：座位點往上移 .3 個身高，畫面一樣
INSPECT_REACH = 55                  # 原本 E 鍵查看家具的距離
SEAT_REACH = 55                     # 原本離座位入口這麼近才能坐
BED_REACH = 65                      # 原本離床的入口這麼近才能上床
SHOWER_PANEL = (15, 75, 114, 119)   # 淋浴間圖（144 × 210）裡玻璃的範圍
DOOR_REACH = (190, 930, 432)        # 原本 nearRoomDoor：x 190–432、y ≥ 930 都能按 E 出門
DOOR_CLICK = (220, 980, 402)        # 原本點這塊（x 220–402、y ≥ 980）就走去出門


def touches(px, py, rect, side):
    x, y, w, h = rect['x'], rect['y'], rect['width'], rect['height']
    return (px + side >= x) & (px - side <= x + w) & (py + FOOT[1] >= y) & (py - FOOT[1] <= y + h)


def walkable(shell, solids, px, py):
    """原本 roomNavigation.isWalkable。"""
    f = shell['floor']
    north = np.where(px < f['northY']['splitX'], f['northY']['left'], f['northY']['right'])
    ok = (px >= f['minX'] + f['sideClearance']) & (px <= f['maxX'] - f['sideClearance']) \
        & (py >= north + FOOT[1]) & (py <= f['southWallLine'] + f['southWallOverlap'] - FOOT[1])
    for wall in shell['walls']:
        ok &= ~touches(px, py, wall, f['sideClearance'])
    for rect in solids:
        ok &= ~touches(px, py, rect, FOOT[0])
    return ok


def collision(shell, solids):
    W, H = shell['width'], shell['height']
    ys, xs = np.mgrid[0:H:STEP, 0:W:STEP].astype(float) + STEP / 2
    free = walkable(shell, solids, xs, ys)
    hard = ndimage.distance_transform_edt(~free, sampling=STEP) > RADIUS
    cols, rows, per = -(-W // T), -(-H // T), T // STEP
    grid = [[0] * cols for _ in range(rows)]
    rest = hard.copy()
    for ty in range(rows):
        for tx in range(cols):
            block = hard[ty * per:(ty + 1) * per, tx * per:(tx + 1) * per]
            if block.shape == (per, per) and block.all():
                grid[ty][tx] = 1
                rest[ty * per:(ty + 1) * per, tx * per:(tx + 1) * per] = False
    rects, open_runs = [], {}
    for r in range(rest.shape[0] + 1):
        row = rest[r] if r < rest.shape[0] else np.zeros(rest.shape[1], bool)
        edges = np.flatnonzero(np.diff(np.concatenate(([0], row.astype(np.int8), [0]))))
        nxt = {}
        for a, b in zip(edges[::2], edges[1::2]):
            nxt[(a, b)] = open_runs.pop((a, b), r)
        for (a, b), top in open_runs.items():
            rects.append({'x': round(a * STEP / T, 4), 'y': round(top * STEP / T, 4), 'w': round((b - a) * STEP / T, 4), 'h': round((r - top) * STEP / T, 4)})
        open_runs = nxt
    # 遊戲裡（腳圈）確定能站的地方：離「硬」的點超過腳圈半徑，再留 2 px（挑站位用，站位一定要走得到）
    stands = ndimage.distance_transform_edt(~hard, sampling=STEP) > RADIUS + 2
    return grid, rects, stands, xs, ys


def stand_near(rect, free, xs, ys):
    """查看家具時站的位置：能站的地方裡，離這件家具接地範圍最近、優先在它前面（下方）。"""
    x, y, w, h = rect['x'], rect['y'], rect['width'], rect['height']
    dx = np.maximum(np.maximum(x - xs, 0), xs - (x + w))
    dy = np.maximum(np.maximum(y - ys, 0), ys - (y + h))
    score = np.hypot(dx, dy) + np.where(ys < y + h / 2, 30, 0)
    score = np.where(free, score, np.inf)
    i = np.unravel_index(np.argmin(score), score.shape)
    return float(xs[i]), float(ys[i])


def fit(path, size):
    return Image.open(path).convert('RGBA').resize(size, Image.LANCZOS) if Image.open(path).size != size else Image.open(path).convert('RGBA')


def shower_layers(shell):
    """原本 showerDoor.createShowerLayers：淋浴間去掉玻璃（裡面畫成漸層的牆），玻璃另外一張。"""
    piece = next(p for p in shell['fixtures'] if p['id'] == 'shower')
    art = Image.open(ROOMS / piece['image']).convert('RGBA')
    px, py, pw, ph = SHOWER_PANEL
    back = art.copy()
    t = np.linspace(0, 1, ph)[:, None]
    stops = [(0, (0x52, 0x67, 0x71)), (.72, (0x6b, 0x87, 0x92)), (1, (0x83, 0x9b, 0xa2))]
    color = np.zeros((ph, 1, 3))
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        k = np.clip((t - a) / (b - a), 0, 1)
        inside = (t >= a) & (t <= b)
        color = np.where(inside[..., None], np.array(ca) + (np.array(cb) - np.array(ca)) * k[..., None], color)
    fill = np.concatenate([np.repeat(color, pw, axis=1), np.full((ph, pw, 1), 255)], axis=2).astype(np.uint8)
    back.paste(Image.fromarray(fill, 'RGBA'), (px, py))
    glass = Image.new('RGBA', art.size, (0, 0, 0, 0))
    glass.paste(art.crop((px, py, px + pw, py + ph)), (px, py))
    return piece, back, glass


def build(shell, furnishing, folder):
    out = ROOMS / folder
    (out / 'props').mkdir(parents=True, exist_ok=True)
    cut = ROOMS / 'shell/cut'
    cut.mkdir(parents=True, exist_ok=True)
    W, H = shell['width'], shell['height']
    pieces = shell['fixtures'] + furnishing.get('objects', [])
    solids = [r for p in pieces for r in p.get('solid', [])] + furnishing.get('looseSolids', [])
    grid, rects, free, xs, ys = collision(shell, solids)

    # 底圖：殼、地毯、在角色後面的牆
    ground = fit(ROOMS / shell['base'], (W, H))
    for d in furnishing.get('decals', []):
        ground.alpha_composite(fit(ROOMS / d['image'], (d['width'], d['height'])), (d['x'], d['y']))
    foreground = []
    for o in shell['overlays']:
        img = Image.open(ROOMS / o['image']).convert('RGBA')
        if o.get('src'):
            sx, sy, sw, sh = o['src']
            img = img.crop((sx, sy, sx + sw, sy + sh))
        dx, dy, dw, dh = o['dst']
        img = img.resize((dw, dh), Image.LANCZOS) if img.size != (dw, dh) else img
        if o['order'] == 'behind':
            ground.alpha_composite(img, (dx, dy))
        else:
            img.save(cut / f'front-{o["id"]}.webp', lossless=True)
            foreground.append({'src': f'../shell/cut/front-{o["id"]}.webp', 'x': dx, 'y': dy})
    ground.convert('RGB').save(out / 'ground.webp', lossless=True)

    # 家具：照擺放大小縮好；淋浴間只放去掉玻璃的後半（玻璃與水霧在 roomExtras.ts）
    shower, shower_back, shower_glass = shower_layers(shell)
    shower_back.save(cut / 'shower-back.webp', lossless=True)
    shower_glass.save(cut / 'shower-glass.webp', lossless=True)
    decor = []
    for p in pieces:
        size = (p['width'], p['height'])
        img = shower_back.resize(size, Image.LANCZOS) if p['id'] == 'shower' else fit(ROOMS / p['image'], size)
        img.save(out / 'props' / f'{p["id"]}.webp', lossless=True)
        sort_y = p['depth'] if p['id'] != 'shower' else p['y'] + SHOWER_PANEL[1] / 210 * p['height']
        decor.append({'sprite': p['id'], 'id': p['id'], 'x': round((p['x'] + p['width'] / 2) / T, 4), 'y': round((p['y'] + p['height']) / T, 4),
                      'sortY': round(sort_y / T, 4), 'scale': 1, 'size': list(size)})
    by_id = {p['id']: p for p in pieces}
    tile = lambda v: round(v / T, 4)
    rel = lambda piece, x, y: [round((x - piece['x']) / piece['width'], 4), round((y - piece['y']) / piece['height'], 4)]
    box = lambda r: [tile(r['x']), tile(r['y']), tile(r['width']), tile(r['height'])]
    around = lambda x, y, r: [tile(x - r), tile(y - r), tile(2 * r), tile(2 * r)]

    interactions = []
    # 座位：坐的位置照原本畫面，排序線＝家具排序線＋0.5（角色在椅子前面）
    for seat in furnishing.get('seats', []):
        piece, (sx, sy), access = by_id[seat['id']], (seat['position']['x'], seat['position']['y'] - SEATED_SHIFT), seat['access']
        interactions.append({'id': f'seat-{seat["id"]}', 'kind': 'seat', 'label': piece.get('label', '坐下'), 'text': '',
                             'area': box(piece), 'stand': [tile(access['x']), tile(access['y'])], 'near': around(access['x'], access['y'], SEAT_REACH),
                             'seat': {'decor': seat['id'], 'position': rel(piece, sx, sy)}, 'exit': [tile(access['x']), tile(access['y'])],
                             'facing': seat['direction'], 'sortY': tile(by_id[seat['id']]['depth'] + .5)})
    # 床：左右兩側各一個，點床的左半或右半選邊；從入口上床，起身回到入口
    bed = furnishing.get('bed')
    if bed and bed.get('id'):
        piece, access = by_id[bed['id']], bed['access']
        ax0, ay0 = min(a['x'] for a in access) - BED_REACH, min(a['y'] for a in access) - BED_REACH
        ax1, ay1 = max(a['x'] for a in access) + BED_REACH, max(a['y'] for a in access) + BED_REACH
        for side, x, entry in (('left', bed['leftX'], access[0]), ('right', bed['rightX'], access[1])):
            half = dict(piece, x=piece['x'] + (piece['width'] / 2 if side == 'right' else 0), width=piece['width'] / 2)
            interactions.append({'id': f'bed-{side}', 'kind': 'bed', 'label': piece.get('label', '床'), 'text': '',
                                 'area': box(half), 'stand': [tile(entry['x']), tile(entry['y'])], 'near': [tile(ax0), tile(ay0), tile(ax1 - ax0), tile(ay1 - ay0)],
                                 'seat': {'decor': bed['id'], 'position': rel(piece, x, bed['restY'])}, 'exit': [tile(entry['x']), tile(entry['y'])],
                                 'sortY': tile(bed['actorDepth'])})
    # 查看：有說明文字的家具，站在它前面按 E 或點它
    for p in pieces:
        if not p.get('inspectText'):
            continue
        r = p['solid'][0]
        sx, sy = stand_near(r, free, xs, ys)
        interactions.append({'id': f'inspect-{p["id"]}', 'kind': 'info', 'label': p.get('label', p['id']), 'text': p['inspectText'],
                             'area': box(p), 'stand': [tile(sx), tile(sy)],
                             'near': [tile(r['x'] - INSPECT_REACH), tile(r['y'] - INSPECT_REACH), tile(r['width'] + 2 * INSPECT_REACH), tile(r['height'] + 2 * INSPECT_REACH)]})
    # 淋浴：點淋浴間就走到蓮蓬頭下面（站進去就在洗澡，roomExtras.ts）
    zone = shell['showerZone']
    zx, zy = zone['x'] + zone['width'] / 2, zone['y'] + zone['height'] / 2
    interactions.append({'id': 'shower', 'kind': 'shower', 'label': shower.get('label', '淋浴間'), 'text': '',
                         'area': box(shower), 'stand': [tile(zx), tile(zy)], 'near': box(zone)})
    # 房門：點門或在門前按 E，走到門口，門打開、畫面淡出，回到走廊（roomExtras.ts）
    door, ex = by_id['room-door'], shell['exit']
    interactions.append({'id': 'room-door', 'kind': 'room-door', 'label': door.get('label', '房門'), 'text': '',
                         'area': [tile(DOOR_CLICK[0]), tile(DOOR_CLICK[1]), tile(DOOR_CLICK[2] - DOOR_CLICK[0]), tile(H - DOOR_CLICK[1])],
                         'stand': [tile(ex['x']), tile(ex['y'])],
                         'near': [tile(DOOR_REACH[0]), tile(DOOR_REACH[1]), tile(DOOR_REACH[2] - DOOR_REACH[0]), tile(H - DOOR_REACH[1])]})

    data = {
        'tileSize': T, 'width': len(grid[0]), 'height': len(grid), 'world': [W, H], 'speed': 160,
        'legend': {'0': '可行走', '1': '碰撞'},
        'note': f'由 tools/art/room_map.py 從 shell.json 與住戶陳設產生，不要手改。住戶：{furnishing.get("occupant") or "（空房）"}。',
        'collision': grid, 'collisionRects': rects, 'entrances': [],
        'arrivals': {'default': {'at': [tile(ex['x']), tile(ex['y'])], 'facing': 'up'}},
        'interactions': interactions, 'decor': decor, 'foreground': foreground,
        'patrol': [[tile(p['x']), tile(p['y'])] for p in furnishing.get('patrol', [])],
        'shower': {'piece': [shower['x'], shower['y'], shower['width'], shower['height']], 'depth': shower['depth'], 'zone': [zone['x'], zone['y'], zone['width'], zone['height']]},
    }
    (out / 'map.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print(f'rooms/{folder}: {sum(map(sum, grid))} 格整格碰撞、{len(rects)} 塊矩形、{len(decor)} 件家具、{len(interactions)} 個互動')


def main():
    shell = json.loads((ROOMS / 'shell.json').read_text(encoding='utf-8'))
    build(shell, {'occupant': ''}, 'empty')
    for path in sorted((ROOMS / 'furnishings').glob('*.json')):
        build(shell, json.loads(path.read_text(encoding='utf-8')), path.stem)


if __name__ == '__main__':
    main()
