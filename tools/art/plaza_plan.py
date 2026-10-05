"""中央廣場規劃圖：產出 plaza_reference.png 與 plaza_plan.json，並做連通／窄道／死路／站位檢查。

用法：python tools/art/plaza_plan.py [輸出資料夾]（預設 tools/art/plaza）
改配置就改 LAYOUT 的字母格，重跑即可。這只是規劃階段（starport-scene-props 步驟 2），
地面底圖與物件之後照該流程用 Codex 生成；plaza_plan.json 的 terrain 給 facility_ground.py 用。

分區與動線（32 × 28 格，每格 96 px）：
- 第 0–2 列北牆立面，北門（往研究室）在中央；南牆第 26–27 列，南門往醫療室；西門往工程區、東門往溫室。
- 北牆下沿一排商店，由西到東：服飾店、物資店（無人，24 小時）｜北門通道｜餐廳（8–20）、酒吧（20–02）。
  餐廳與酒吧相鄰，共用東側的用餐座位；無人店靠西，鄰近投影區。
- 正中央是中央塔（圓形，8 格直徑），電梯門朝南（上艦橋、下接駁口，兼貨梯）；塔四周一圈 3 格寬的環形步道。
- 西側：電子投影區（圓形投影台＋面向它的四張長椅），娛樂與會議用。
- 東側：用餐座位（六張四人桌），緊鄰餐廳與酒吧。
- 南側：植栽帶（兩塊草地各兩棵樹、花叢、花台、兩張長椅），南門在中間。
"""
import json, sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name('plaza'))
OUT.mkdir(parents=True, exist_ok=True)
CELL = 48

LAYOUT = [
    "##############====##############",  # 0  北牆立面；北門往研究室
    "##############====##############",  # 1
    "##############====##############",  # 2
    "#cc..ffmmmmll......KKKKKbAAAA..#",  # 3  服飾店（衣架、試衣艙）｜物資店（販賣牆、取貨櫃）｜北門通道｜餐廳廚房出餐口＋菜單板｜酒吧後吧酒架
    "#cc..ff........................#",  # 4  餐廳、酒吧的櫃台後走道
    "#..................rrrrr..aaaaa#",  # 5  餐廳櫃台｜吧台（櫃台旁留 1 格進出）
    "#..k.....k.....................#",  # 6  自助終端；吧台前放高腳凳（不擋路，decor）
    "#....p.........................#",  # 7  西側立燈
    "#........wwwwwwwwwwwwww.......p#",  # 8  環形步道（北）；東側立燈
    "#hhh.....wwwwwwwwwwwwwwdd..dd..#",  # 9  投影台 3×3；東側用餐桌
    "#hhh...nnwww..TTTT..wwwdd..dd..#",  # 10 中央塔頂端；長椅面向投影台
    "#hhh.....www.TTTTTT.www........#",  # 11
    "#........wwwTTTTTTTTwww........#",  # 12
    "=......nnwwwTTTTTTTTwwwdd..dd..=",  # 13 西門往工程區；東門往溫室
    "=..nn....wwwTTTTTTTTwwwdd..dd..=",  # 14
    "=........wwwTTTTTTTTwww........=",  # 15
    "#........www.TTTTTT.www........#",  # 16
    "#........www..TVVT..wwwdd..dd..#",  # 17 電梯門（朝南）
    "#........wwwwwwwwwwwwwwdd..dd..#",  # 18 環形步道（南）
    "#p.......wwwwwwwwwwwwww.......p#",  # 19
    "#..............................#",  # 20
    "#..............................#",  # 21
    "#.GGGGGGgG..nn....nn..GgGGGGGG.#",  # 22 植栽帶：草地、樹、長椅
    "#.GgGGGGGGFF........FFGGGGGGgG.#",  # 23 花台
    "#.GGGGGGGG..........GGGGGGGG...#",  # 24
    "#..............................#",  # 25
    "##############====##############",  # 26 南牆；南門往醫療室
    "##############====##############",  # 27
]

# key: (名稱, 顏色, 可走)
LEGEND = {
    '#': ('外牆', '#56626b', False),
    '=': ('門洞', '#e5735a', True),
    '.': ('廣場鋪面', '#dcdcd6', True),
    'w': ('環形步道', '#c3cdd4', True),
    'G': ('草地', '#8fbf6a', True),
    'g': ('樹（樹幹格）', '#3e7a3a', False),
    'F': ('花台', '#b57bb0', False),
    'p': ('立燈', '#f0d36b', False),
    'T': ('中央塔', '#2f6f8f', False),
    'V': ('電梯門（上艦橋／下接駁口）', '#4dd0e1', False),
    'c': ('展示衣架', '#d98ca0', False),
    'f': ('試衣艙', '#c56c86', False),
    'k': ('自助終端', '#e8b33a', False),
    'm': ('自動販賣牆', '#5b7fc4', False),
    'l': ('取貨櫃', '#7a8fc7', False),
    'K': ('餐廳廚房出餐口', '#e09b5a', False),
    'r': ('餐廳櫃台', '#b08a5a', False),
    'b': ('菜單看板', '#c0504d', False),
    'A': ('後吧酒架', '#7c6f9b', False),
    'a': ('吧台', '#9b7bb8', False),
    'd': ('四人餐桌', '#c7a27a', False),
    'h': ('電子投影台', '#4dd0e1', False),
    'n': ('長椅', '#a3764f', False),
}

# 給 facility_ground.py 的地面字母（跟溫室同一套：P 淺色鋪面、W 步道、G 草地）
TERRAIN_OF = {'G': 'G', 'g': 'G', 'w': 'W'}

LABELS = [  # (文字, 中心 x, 中心 y)，tile 單位
    ('服飾店 24h', 3.5, 6.5), ('物資店 24h', 9.5, 6.5), ('北門 → 研究室', 16, 1.5),
    ('餐廳 8–20', 21.5, 6.5), ('酒吧 20–02', 28, 6.5),
    ('中央塔', 16, 13), ('電梯', 16, 17.5), ('環形步道', 16, 8.5),
    ('電子投影區', 3.5, 12.5), ('用餐座位', 27, 11.5),
    ('← 工程區', 3.5, 15.5), ('溫室 →', 28.5, 15.5),
    ('植栽帶', 5.5, 21.3), ('植栽帶', 25.5, 21.3), ('南門 → 醫療室', 16, 26.8),
]

# 商店與營業時間（給 src/game/shopHours.ts 對照；close <= open 表示跨午夜）
SHOPS = [
    {"id": "clothing", "name": "服飾店", "staffed": False, "open": "00:00", "close": "24:00", "area": [1, 3, 6, 4]},
    {"id": "supply", "name": "物資店", "staffed": False, "open": "00:00", "close": "24:00", "area": [7, 3, 6, 4]},
    {"id": "restaurant", "name": "餐廳", "staffed": True, "open": "08:00", "close": "20:00", "area": [19, 3, 6, 4], "menu": ["主餐", "副餐", "湯品"]},
    {"id": "bar", "name": "酒吧", "staffed": True, "open": "20:00", "close": "02:00", "area": [25, 3, 6, 4], "menu": ["酒精", "飲料", "甜點"]},
]

INTERACTIONS = [  # stand 是暫定值，之後擺物件時由程式挑（starport-scene-props 步驟 5）
    {"id": "elevator", "kind": "elevator", "label": "中央塔電梯", "text": "往上直達艦橋，往下是接駁口；貨物也走這部。", "area": [15, 17, 2, 1], "stand": [16, 18.5]},
    {"id": "clothing-rack", "kind": "shop", "label": "展示衣架", "text": "幾套常服與工作服掛在架上，尺寸標籤朝外。", "area": [1, 3, 2, 2], "stand": [3.5, 4.5]},
    {"id": "fitting-pod", "kind": "shop", "label": "試衣艙", "text": "艙門一關，鏡面就會投影出穿上去的樣子。", "area": [5, 3, 2, 2], "stand": [4.5, 4.5]},
    {"id": "clothing-terminal", "kind": "terminal", "label": "服飾店自助終端", "text": "無人商店，刷手環結帳，24 小時。", "area": [3, 6, 1, 1], "stand": [3.5, 7.5]},
    {"id": "vending-wall", "kind": "shop", "label": "自動販賣牆", "text": "日用品、零食與飲料排成一整面牆，缺貨的格子亮著橘燈。", "area": [7, 3, 4, 1], "stand": [8.5, 4.5]},
    {"id": "pickup-locker", "kind": "shop", "label": "取貨櫃", "text": "預訂的物資會送到這裡，掃手環就開櫃。", "area": [11, 3, 2, 1], "stand": [11.5, 4.5]},
    {"id": "supply-terminal", "kind": "terminal", "label": "物資店自助終端", "text": "無人商店，刷手環結帳，24 小時。", "area": [9, 6, 1, 1], "stand": [9.5, 7.5]},
    {"id": "restaurant-counter", "kind": "counter", "label": "餐廳櫃台", "text": "主餐、副餐、湯品，營業時間 8:00–20:00。", "area": [19, 5, 5, 1], "stand": [21.5, 6.5]},
    {"id": "menu-board", "kind": "sign", "label": "菜單看板", "text": "今日主餐寫在最上面，下面是副餐和湯品。", "area": [24, 3, 1, 1], "stand": [24.5, 4.5]},
    {"id": "bar-counter", "kind": "counter", "label": "吧台", "text": "酒精、飲料、甜點，營業時間 20:00–02:00。", "area": [26, 5, 5, 1], "stand": [28.5, 6.5]},
    {"id": "holo-stage", "kind": "holo", "label": "電子投影台", "text": "平常放影片和球賽，開會時投出艦內各區的畫面。", "area": [1, 9, 3, 3], "stand": [4.5, 10.5]},
]

H, W = len(LAYOUT), len(LAYOUT[0])
assert all(len(r) == W for r in LAYOUT), [i for i, r in enumerate(LAYOUT) if len(r) != W]
walk = [[LEGEND[c][2] for c in row] for row in LAYOUT]

# 門洞：北（研究室）、西（工程區）、東（溫室）、南（醫療室）
def door_cells(pred):
    return [(x, y) for y in range(H) for x in range(W) if LAYOUT[y][x] == '=' and pred(x, y)]
north, south = door_cells(lambda x, y: y < 3), door_cells(lambda x, y: y >= H - 2)
west, east = door_cells(lambda x, y: x == 0), door_cells(lambda x, y: x == W - 1)
def rect(cells):
    xs, ys = [c[0] for c in cells], [c[1] for c in cells]
    return {"x": min(xs), "y": min(ys), "w": max(xs) - min(xs) + 1, "h": max(ys) - min(ys) + 1}
entrances = [
    {**rect(north), "to": "lab", "label": "往研究室", "spawn": [16, 3.5]},
    {**rect(west), "to": "engineering", "label": "往工程區", "spawn": [1.5, 14]},
    {**rect(east), "to": "greenhouse", "label": "往溫室", "spawn": [W - 1.5, 14]},
    {**rect(south), "to": "medical", "label": "往醫療室", "spawn": [16, 24.5]},
]

# ---- 檢查 ----
W_ = lambda x, y: 0 <= x < W and 0 <= y < H and walk[y][x]
def flood(start):
    seen, q = {start}, deque([start])
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if W_(x + dx, y + dy) and (x + dx, y + dy) not in seen:
                seen.add((x + dx, y + dy)); q.append((x + dx, y + dy))
    return seen
seen = flood(north[0])
cells = [(x, y) for y in range(H) for x in range(W) if walk[y][x]]
unreached = [c for c in cells if c not in seen]
is_door = lambda x, y: LAYOUT[y][x] == '='
dead = [(x, y) for x, y in cells if sum(W_(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1 and not is_door(x, y)]
narrow = [(x, y) for x, y in cells if not is_door(x, y) and ((not W_(x - 1, y) and not W_(x + 1, y)) or (not W_(x, y - 1) and not W_(x, y + 1)))]
for it in INTERACTIONS:
    sx, sy = it['stand']
    assert (int(sx), int(sy)) in seen, (it['id'], 'stand 不可達')
for e in entrances:
    assert (int(e['spawn'][0]), int(e['spawn'][1])) in seen, (e['to'], 'spawn 不可達')
inner = sum(1 for y in range(3, H - 2) for x in range(1, W - 1))
body_walk = sum(1 for x, y in cells if 3 <= y < H - 2 and 0 < x < W - 1)
report = {'可走格（室內）': body_walk, '室內格': inner, '可走比例': round(body_walk / inner, 2),
          '走不到': unreached, '死路': dead, '一格窄道': narrow}
print(json.dumps(report, ensure_ascii=False))

# ---- JSON ----
terrain = [''.join(TERRAIN_OF.get(c, 'P') for c in row) for row in LAYOUT]
data = {
    "tileSize": 96, "width": W, "height": H,
    "legend": {"0": "可行走", "1": "碰撞"},
    "note": "中央廣場規劃（tools/art/plaza_plan.py 產生）。第 0–2 列北牆立面、26–27 列南牆；四個門洞通研究室（北）、工程區（西）、溫室（東）、醫療室（南）。中央塔電梯另外處理（上艦橋、下接駁口）。物件碰撞之後改成 collisionRects，這裡先用整格。",
    "collision": [[0 if w else 1 for w in row] for row in walk],
    "layout": LAYOUT,
    "layoutLegend": {k: v[0] for k, v in LEGEND.items()},
    "terrainLegend": {"P": "淺色鋪面", "W": "步道", "G": "草地"},
    "terrain": terrain,
    "entrances": entrances,
    "shops": SHOPS,
    "interactions": INTERACTIONS,
}
(OUT / 'plaza_plan.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')

# ---- PNG ----
def font(size, bold=False):
    for path in (['C:/Windows/Fonts/msjhbd.ttc'] if bold else ['C:/Windows/Fonts/msjh.ttc']) + ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/System/Library/Fonts/PingFang.ttc']:
        try: return ImageFont.truetype(path, size)
        except OSError: continue
    return ImageFont.load_default()
img = Image.new('RGB', (W * CELL, H * CELL))
d = ImageDraw.Draw(img)
small, big = font(11), font(18, bold=True)
lum = lambda h: (int(h[1:3], 16) * 299 + int(h[3:5], 16) * 587 + int(h[5:7], 16) * 114) / 1000
for y, row in enumerate(LAYOUT):
    for x, c in enumerate(row):
        col = LEGEND[c][1]
        d.rectangle([x * CELL, y * CELL, (x + 1) * CELL - 1, (y + 1) * CELL - 1], fill=col, outline='#2b3238')
        d.text((x * CELL + 2, y * CELL + 1), f'{x},{y}', font=small, fill='#1b1f23' if lum(col) > 140 else '#e8ecef')
for text, cx, cy in LABELS:
    d.text((cx * CELL, cy * CELL), text, font=big, anchor='mm', fill='white', stroke_width=4, stroke_fill='#1b1f23')
img.save(OUT / 'plaza_reference.png')
print('saved', img.size, OUT)
