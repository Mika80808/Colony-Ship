"""居住區走廊 A–D：從 manifest.json 產生設施場景格式（FacilityScene 用）的 map.json、底圖與房門圖。

用法：python tools/art/corridor_map.py
讀  public/assets/corridor-<x>/manifest.json（素材位置，跟原本的走廊場景同一份）
寫  public/assets/corridor-<x>/map.json、ground.webp
    public/assets/corridor-a/doors/door-<n>_{frame,left,right}.webp（四條走廊共用 A 的房門圖）
    public/assets/corridor-a/props/<物件>.webp（A 走廊的擺設；設施場景從 props/ 讀）

一格 40 px（3560 × 996 的世界：89 × 25 格，高度用 world 補齊）。碰撞全用精細矩形：
  牆面那一大塊、欄杆下面那一塊（腳點能走 y 397–775，跟原本一樣），擺設照圖算（footprint.py）。
房門：門框跟牆一起畫進底圖，門洞填深色；遊戲畫兩片門扇往兩側滑開，門框圖蓋在上面。開到底淡出、進房間。
重跑會產生同樣的結果。
"""
import json
import editor_layout
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import footprint

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'public/assets'
T = 40
WIDTH, HEIGHT = 3560, 996
FLOOR_TOP, FLOOR_BOTTOM = 397, 775      # 腳點能站的上下界（原本 corridor.ts 的 walkable）
EXIT_BAND = 45                          # 左右兩端這麼寬是出入口（腳點走進去、往外走就離開）
SPAWN = (500, 530)                      # 從星圖來時站的位置
STAND_Y = 415                           # 用房門、看招牌時站的高度
ARRIVE_Y = 530                          # 從房間或設施回到走廊時站的高度
RADIUS = 22                             # 腳圈半徑（src/game/facility.ts 的 RADIUS）
NEAR = 100                              # E 鍵感應：離站位這麼近（原本走廊的距離）

# 跟 src/game/corridor.ts 的 CORRIDORS 對應：左右兩端是哪個設施
CORRIDORS = {
    'a': {'letter': 'A', 'left': 'research', 'right': 'greenhouse'},
    'b': {'letter': 'B', 'left': 'greenhouse', 'right': 'medical'},
    'c': {'letter': 'C', 'left': 'medical', 'right': 'engineering'},
    'd': {'letter': 'D', 'left': 'engineering', 'right': 'research'},
}
NAMES = {'research': '研究室', 'greenhouse': '溫室', 'medical': '醫療室', 'engineering': '工程部'}
SECTOR = {'research': 'lab', 'greenhouse': 'greenhouse', 'medical': 'medical', 'engineering': 'engineering'}
WALKABLE = {'greenhouse', 'medical', 'engineering'}   # 有場景、走得進去的設施（src/game/facility.ts 的 FACILITIES）
DECORATIVE_SIGNS = {('A', 'greenhouse')}              # A 走廊的溫室招牌只是指引，不傳送

# 擺設的接地碰撞（原本 corridor.ts 的 COLLISIONS）：只取上緣，算出物件在地上佔多深；左右照圖
OLD_FOOTPRINT_TOP = {'decor-1': 347, 'decor-2': 346, 'decor-3': 338, 'cart': 693, 'bench-1': 452, 'bench-2': 452}

# 房門圖 121 × 149：門洞是去掉兩個上斜角的六邊形（原本 corridorDoor.ts 的 opening）；門扇從中線往兩側滑
DOOR_OPENING = [(32, 7), (89, 7), (105, 24), (105, 148), (16, 148), (16, 24)]
OPENING_BOX = (16, 7, 106, 149)         # 門扇的範圍（左、上、右、下，右下不含），包住整個門洞；中線 x = 61
OPENING_COLOR = (16, 29, 40, 255)       # 門開時門洞裡的顏色 #101d28
BENCH_SEAT_OFFSET = 37                  # 長椅兩個座位離中線的距離
SEAT_Y = 446.6                          # 坐下時腳點高度：坐姿圖的位置跟原本走廊一樣


def asset_image(folder, asset):
    src = asset.get('src') or f'/assets/{folder}/{asset["id"]}.webp'
    return Image.open(ASSETS / src.removeprefix('/assets/')).convert('RGBA')


def opening_mask(size):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).polygon(DOOR_OPENING, fill=255)
    return mask


def cut_door(door_id, art):
    """門框（門洞挖空）、左右門扇（只有門洞裡的部分），存到 corridor-a/doors/。"""
    out = ASSETS / 'corridor-a/doors'
    out.mkdir(exist_ok=True)
    mask = opening_mask(art.size)
    frame = art.copy()
    frame.putalpha(Image.fromarray(np.minimum(np.array(art)[:, :, 3], 255 - np.array(mask)).astype(np.uint8)))
    leaves = Image.new('RGBA', art.size, (0, 0, 0, 0))
    leaves.paste(art, (0, 0), mask)
    x0, y0, x1, y1 = OPENING_BOX
    mid = (x0 + x1) // 2
    frame.save(out / f'{door_id}_frame.webp', lossless=True)
    leaves.crop((x0, y0, mid, y1)).save(out / f'{door_id}_left.webp', lossless=True)
    leaves.crop((mid, y0, x1, y1)).save(out / f'{door_id}_right.webp', lossless=True)


def tiles(x, y, w, h):
    return {'x': round(x / T, 4), 'y': round(y / T, 4), 'w': round(w / T, 4), 'h': round(h / T, 4)}


def build(key, cfg):
    folder = f'corridor-{key}'
    letter = cfg['letter']
    assets = json.loads((ASSETS / folder / 'manifest.json').read_text(encoding='utf-8'))
    by_id = {a['id']: a for a in assets}
    rel = (lambda path: path) if key == 'a' else (lambda path: f'../corridor-a/{path}')

    # 底圖：太空、地板、牆，再疊上房門（門洞填深色）和招牌
    ground = Image.new('RGBA', (WIDTH, HEIGHT), (6, 13, 22, 255))
    for layer in ('space', 'floor', 'wall'):
        a = by_id[layer]
        ground.alpha_composite(asset_image(folder, a).resize((a['width'], a['height'])), (a['x'], a['y']))
    doors, arrivals = [], {}
    for a in sorted((a for a in assets if a['kind'] == 'door'), key=lambda a: a['x']):
        art = asset_image(folder, a)
        if key == 'a':
            cut_door(a['id'], art)
        # 門洞填深色（門開時看到的），只填原圖完全不透明的地方：門洞底下那排半透明的邊照原樣疊在地板上，關門時跟原圖一模一樣
        inside, alpha = np.array(opening_mask(art.size)) > 0, np.array(art)[:, :, 3]
        closed = art.copy()
        closed.paste(Image.new('RGBA', art.size, OPENING_COLOR), (0, 0), Image.fromarray(((inside & (alpha == 255)) * 255).astype(np.uint8)))
        closed.putalpha(Image.fromarray(np.where(inside, np.where(alpha == 255, 255, 0), alpha).astype(np.uint8)))
        ground.alpha_composite(closed, (a['x'], a['y']))
        n = a['id'].split('-')[1]
        room, cx = f'{letter}-{n}', a['x'] + a['width'] / 2
        x0, y0, x1, y1 = OPENING_BOX
        doors.append({
            'id': a['id'], 'label': f'{room} 房門', 'passage': tiles(a['x'], a['y'], a['width'], a['height']),
            'opening': [a['x'] + x0, a['y'] + y0, x1 - x0, y1 - y0],
            'frame': {'src': rel(f'doors/{a["id"]}_frame.webp'), 'x': a['x'], 'y': a['y']},
            'panels': {'left': rel(f'doors/{a["id"]}_left.webp'), 'right': rel(f'doors/{a["id"]}_right.webp')},
            'trigger': 200, 'openSeconds': .5, 'to': room,
            'stand': [cx, STAND_Y], 'near': [cx - NEAR, STAND_Y - NEAR, 2 * NEAR, 2 * NEAR],
        })
        arrivals[room] = {'at': [round(round(cx) / T, 4), ARRIVE_Y / T], 'facing': 'down'}
    arrivals['default'] = {'at': [SPAWN[0] / T, SPAWN[1] / T], 'facing': 'down'}

    interactions, entrances = [], []
    for a in (a for a in assets if a['kind'] == 'sign'):
        ground.alpha_composite(asset_image(folder, a).resize((a['width'], a['height'])), (a['x'], a['y']))
        facility = a['id'].removeprefix('sign-')
        cx = a['x'] + a['width'] / 2
        side = 'left' if cfg['left'] == facility else 'right'
        sector = SECTOR[facility]
        portal = facility in WALKABLE
        if (letter, facility) not in DECORATIVE_SIGNS:
            interactions.append({
                'id': a['id'], 'kind': 'exit' if portal else 'sign', 'label': f'{NAMES[facility]}方向',
                'text': '' if portal else f'{NAMES[facility]}位於走廊{"左" if side == "left" else "右"}側方向，目前尚未開放。',
                'area': [round(v / T, 4) for v in (a['x'], a['y'], a['width'], a['height'])],
                'stand': [round(cx / T, 4), STAND_Y / T],
                'near': [round(v / T, 4) for v in (cx - NEAR, STAND_Y - NEAR, 2 * NEAR, 2 * NEAR)],
                **({'to': sector} if portal else {}),
            })
        # 那一側的設施走得進去：走廊那一端是出入口，從那裡回來時站在招牌下面
        if facility in WALKABLE:
            x = 0 if side == 'left' else WIDTH - EXIT_BAND
            spawn_x = max(80, min(WIDTH - 80, cx))
            entrances.append({**tiles(x, FLOOR_TOP, EXIT_BAND, FLOOR_BOTTOM - FLOOR_TOP), 'to': sector, 'label': NAMES[facility],
                              'spawn': [round(round(spawn_x) / T, 4), ARRIVE_Y / T]})

    # 碰撞：牆面（腳點最高到 397）、欄杆下面（腳點最低到 775），擺設照圖算
    rects = [tiles(0, 0, WIDTH, FLOOR_TOP - RADIUS), tiles(0, FLOOR_BOTTOM + RADIUS, WIDTH, HEIGHT - FLOOR_BOTTOM - RADIUS)]
    decor = []
    for a in (a for a in assets if a['kind'] in ('object', 'bench')):
        art = asset_image(folder, a)
        props = ASSETS / folder / 'props'
        props.mkdir(exist_ok=True)
        art.save(props / f'{a["id"]}.webp', lossless=True)
        bottom, cx = a['y'] + a['height'], a['x'] + a['width'] / 2
        depth = round((bottom - OLD_FOOTPRINT_TOP[a['id']]) / T, 4)
        decor.append({'sprite': a['id'], 'id': a['id'], 'x': round(cx / T, 4), 'y': round(bottom / T, 4), 'scale': a['width'] / art.width,
                      'block': True, 'depth': depth, 'size': list(art.size)})
        alpha = np.array(art)[:, :, 3]
        rects += [{**r, 'of': a['id']} for r in footprint.outline(alpha, a['width'] / art.width, cx, bottom, T, depth)]
        if a['kind'] == 'bench':
            # 兩人座：左右各一個座位，點擊範圍各半張椅子，E 鍵在椅子前方感應，起身站回座位前面
            for side, sign in (('left', -1), ('right', 1)):
                seat_x = cx + sign * BENCH_SEAT_OFFSET
                half = [a['x'] + (a['width'] / 2 if sign > 0 else 0), a['y'], a['width'] / 2, a['height']]
                interactions.append({
                    'id': f'{a["id"]}-{side}', 'kind': 'seat', 'label': '坐下休息', 'text': '',
                    'area': [round(v / T, 4) for v in half], 'stand': [round(seat_x / T, 4), 544 / T],
                    'near': [round(v / T, 4) for v in (cx - NEAR, 544 - NEAR, 2 * NEAR, 2 * NEAR)],
                    'seat': {'decor': a['id'], 'position': [round(.5 + sign * BENCH_SEAT_OFFSET / a['width'], 4), round(1 + (SEAT_Y - bottom) / a['height'], 4)]},
                    'exit': [round(seat_x / T, 4), 544 / T],
                })

    fg = by_id['foreground']
    data = {
        'tileSize': T, 'width': WIDTH // T, 'height': -(-HEIGHT // T), 'world': [WIDTH, HEIGHT],
        'legend': {'0': '可行走', '1': '碰撞'},
        'note': f'由 tools/art/corridor_map.py 從 manifest.json 產生，不要手改。居住區 {letter} 走廊：左端{NAMES[cfg["left"]]}、右端{NAMES[cfg["right"]]}。',
        'collision': [[0] * (WIDTH // T) for _ in range(-(-HEIGHT // T))],
        'collisionRects': rects,
        'entrances': entrances,
        'arrivals': arrivals,
        'interactions': interactions,
        'decor': decor,
        'doors': doors,
        'foreground': [{'src': rel('foreground.webp') if key != 'a' else 'foreground.webp', 'x': fg['x'], 'y': fg['y']}],
    }
    ground.save(ASSETS / folder / 'ground.webp', lossless=True)
    editor_layout.apply(data, folder)   # 地圖編輯器的標註（tools/art/editor/）
    (ASSETS / folder / 'map.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print(f'{folder}: {len(doors)} 扇門、{len(entrances)} 個出入口、{len(decor)} 件擺設、{len(rects)} 塊碰撞')


if __name__ == '__main__':
    for key, cfg in CORRIDORS.items():
        build(key, cfg)
