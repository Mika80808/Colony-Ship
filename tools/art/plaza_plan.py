"""中央廣場規劃圖（v2）：圓形廣場＋十字通道，外圍星空。產出分區預覽 png，並做連通檢查。

用法：uv run --with pillow python tools/art/plaza_plan.py [輸出資料夾，預設 tools/art/plaza]
改配置就改下面的常數與矩形，重跑即可。這份只看分區與動線，不拿去生圖。
全艦配置參考：tools/art/plaza/station_layout_ref.png（上研究室、右農業區、下醫療室、左工程區）。
"""
import json, os, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'tools/art/plaza'
CELL = 36
W, H = 44, 44               # 格（每格 96 px ≈ 1 公尺）
CX, CY, R = 22, 23, 18      # 廣場圓心（格線交點）、半徑
TOWER_R = 4.2               # 中央塔半徑（直筒）
LANE = 4                    # 十字通道寬

# key: (名稱, 顏色, 可走)
LEGEND = {
    '*': ('星空（底圖，不可走）', '#141a2e', False),
    '.': ('廣場地坪', '#dcdcd6', True),
    ',': ('十字主軸步道', '#c9d6de', True),
    'r': ('十字通道（往外環）', '#b9c4cc', True),
    'T': ('中央塔（直筒，塔身往上畫到地圖頂）', '#5b7fc4', False),
    'E': ('電梯門（兼貨梯）', '#9fc3ff', False),
    'R': ('餐廳（NPC，開放式櫃台）', '#d07a4a', False),
    'q': ('廚房進貨口', '#f2a65a', False),
    'B': ('酒吧（NPC，開放式吧台）', '#7c4f9b', False),
    'o': ('吧台高腳椅（可坐）', '#c9b3dd', True),
    'S': ('物資店（無人，小店面）', '#b08a5a', False),
    'C': ('服飾店（無人，小店面）', '#c27ba0', False),
    't': ('餐桌（美食街座位）', '#a07850', False),
    'P': ('樹（大植栽盆）', '#3f8f4f', False),
    'f': ('花圃', '#8fcf7a', False),
}

grid = [['*'] * W for _ in range(H)]
cell_in = lambda x, y, rad: (x + .5 - CX) ** 2 + (y + .5 - CY) ** 2 <= rad * rad
on_axis = lambda x, y: CX - LANE // 2 <= x < CX + LANE // 2 or CY - LANE // 2 <= y < CY + LANE // 2

def fill(c, x, y, w=1, h=1):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            grid[yy][xx] = c

def free(x, y, w, h):
    return all(grid[yy][xx] == '.' for yy in range(y, y + h) for xx in range(x, x + w))

# ---- 圓形廣場＋十字通道 ----
for y in range(H):
    for x in range(W):
        if cell_in(x, y, R):
            grid[y][x] = ',' if on_axis(x, y) else '.'
        elif on_axis(x, y) and (CX - LANE // 2 <= x < CX + LANE // 2 or CY - LANE // 2 <= y < CY + LANE // 2):
            grid[y][x] = 'r'

# ---- 中央塔（只有基座佔地；塔身是前景層）----
for y in range(H):
    for x in range(W):
        if cell_in(x, y, TOWER_R):
            grid[y][x] = 'T'
TOWER_BOTTOM = max(y for y in range(H) if 'T' in grid[y])
fill('E', CX - 2, TOWER_BOTTOM, 4, 1)      # 電梯門開在南面，正對南通道

# ---- 北半圈：兩間有 NPC 的大店面，正面朝鏡頭，夾著北通道與塔身 ----
# 底邊（店門那一列）一定在圓內；後方超出圓的部分畫在星空前面。
fill('B', 7, 9, 10, 4)                     # 酒吧（西北），右緣停在塔身外
fill('o', 8, 13, 8, 1)                     # 吧台前的高腳椅
fill('R', 27, 9, 10, 4)                    # 餐廳（東北，離農業區通道近，蔬果推過來最短）
fill('q', 35, 12, 2, 1)                    # 進貨口在餐廳店面右端

# ---- 東西兩側：無人小店，也是正面 ----
fill('S', 6, 16, 5, 3)                     # 物資店（西，北通道下方）
fill('C', 33, 16, 5, 3)                    # 服飾店（東）

# ---- 美食街座位：環繞中央塔 ----
for y in range(CY - 13, CY + 13, 3):
    for x in range(CX - 13, CX + 13, 4):
        tx, ty = x, y
        d = ((tx + 1 - CX) ** 2 + (ty + .5 - CY) ** 2) ** .5
        behind_tower = ty < CY and tx + 2 > CX - TOWER_R - .5 and tx < CX + TOWER_R + .5   # 塔身會擋住
        if 7 <= d <= 12.5 and not behind_tower and not any(on_axis(tx + i, ty) for i in (-1, 0, 1, 2)) and free(tx, ty - 1, 2, 3):
            fill('t', tx, ty, 2, 1)

# ---- 植栽：斜角大植栽、外緣花圃 ----
for x, y in ((9, 32), (33, 32), (13, 36), (29, 36)):
    if free(x, y, 2, 2):
        fill('P', x, y, 2, 2)
for x, y, w in ((15, 39, 4), (25, 39, 4), (5, 26, 3), (36, 26, 3)):
    if free(x, y, w, 1):
        fill('f', x, y, w, 1)

LAYOUT = [''.join(row) for row in grid]

LABELS = [  # (文字, 中心 x, 中心 y)，格
    ('酒吧 20–02', 12, 11), ('餐廳 08–20', 32, 11), ('進貨口', 37.8, 13.6),
    ('物資店', 8.5, 17.5), ('服飾店', 35.5, 17.5),
    ('中央塔', CX, CY - 1), ('電梯 ↑艦橋 ↓接駁口', CX, TOWER_BOTTOM + 1.6),
    ('美食街座位', CX - 9, CY + 7), ('美食街座位', CX + 9, CY + 7),
    ('↑ 研究室', CX + 4.8, 1.5), ('農業區 →', W - 2.6, CY - 3), ('↓ 醫療室', CX + 4.8, H - 1.5), ('← 工程區', 2.6, CY - 3),
]

# ---- 檢查：從南通道走得到每一塊可走格 ----
walk = [[LEGEND[c][2] for c in row] for row in LAYOUT]
start = (CX, H - 1)
seen, q = {start}, deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H and walk[ny][nx] and (nx, ny) not in seen:
            seen.add((nx, ny)); q.append((nx, ny))
cells = [(x, y) for y in range(H) for x in range(W) if walk[y][x]]
unreached = [c for c in cells if c not in seen]
facade_ok = all(cell_in(x, y, R) for c in 'RBSCq' for y, row in enumerate(LAYOUT) for x, ch in enumerate(row)
                if ch == c and (y + 1 >= H or LAYOUT[y + 1][x] not in 'RBSCq'))
hidden = [(x, y) for x, y in cells if y < CY and CX - TOWER_R <= x + .5 <= CX + TOWER_R and not cell_in(x, y, TOWER_R)]
print(json.dumps({'可走格': len(cells), '走不到': unreached, '店門都在圓內': facade_ok,
                  '被塔身擋住的可走格': len(hidden)}, ensure_ascii=False))
assert not unreached and facade_ok

# ---- PNG ----
os.makedirs(OUT, exist_ok=True)
img = Image.new('RGB', (W * CELL, H * CELL))
d = ImageDraw.Draw(img)
small = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 10)
big = ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', 19)
lum = lambda h: (int(h[1:3], 16) * 299 + int(h[3:5], 16) * 587 + int(h[5:7], 16) * 114) / 1000
for y, row in enumerate(LAYOUT):
    for x, c in enumerate(row):
        col = LEGEND[c][1]
        d.rectangle([x * CELL, y * CELL, (x + 1) * CELL - 1, (y + 1) * CELL - 1], fill=col,
                    outline='#1d2338' if c == '*' else '#2b3238')
        if x % 5 == 0 and y % 5 == 0:
            d.text((x * CELL + 2, y * CELL + 1), f'{x},{y}', font=small, fill='#1b1f23' if lum(col) > 140 else '#8090b0')
d.ellipse([(CX - R) * CELL, (CY - R) * CELL, (CX + R) * CELL, (CY + R) * CELL], outline='#f4e07a', width=2)
# 塔身：從基座往上畫到地圖頂，蓋在角色上面（半透明示意）
over = Image.new('RGBA', img.size, (0, 0, 0, 0))
od = ImageDraw.Draw(over)
od.rectangle([(CX - TOWER_R) * CELL, 0, (CX + TOWER_R) * CELL, CY * CELL], fill=(91, 127, 196, 110), outline=(255, 59, 107, 255), width=3)
img = Image.alpha_composite(img.convert('RGBA'), over).convert('RGB')
d = ImageDraw.Draw(img)
d.text((CX * CELL, 6 * CELL), '塔身（前景）\n玩家在後面時\n半透明', font=big, anchor='mm', align='center',
       fill='white', stroke_width=4, stroke_fill='#1b1f23')
for text, lx, ly in LABELS:
    d.text((lx * CELL, ly * CELL), text, font=big, anchor='mm', fill='white', stroke_width=4, stroke_fill='#1b1f23')
img.save(f'{OUT}/plaza_plan_v2.png')
print('saved', img.size)
