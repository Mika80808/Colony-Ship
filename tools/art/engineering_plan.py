"""工程區規劃圖：產出 engineering_reference.png 與 engineering_collision.json，並做連通 / 窄道 / 死路檢查。"""
import json, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
CELL = 64

LAYOUT = [
    "####################",  # 0
    "#ppppeeeeeeeeeepppp#",  # 1
    "#ppppeeEEEEEEeepppp#",  # 2
    "#ppppeeEEEEEEeepppp#",  # 3
    "#ppppeeEEEEEEeepppp#",  # 4
    "#ppppeeEEEEEEeepppp#",  # 5
    "#ppppeeeeeeeeeepppp#",  # 6
    "#ppphhhhhhhhhhhhppp#",  # 7
    "#pppg..........gppp#",  # 8
    "#VVVg.CC....CC.gPPP#",  # 9
    "#VVVg..........gPPP#",  # 10
    "#VVVC..........gPPP#",  # 11
    "#VVVC..........gPPP#",  # 12
    "#VVVg..........gPPP#",  # 13
    "#VVVg..........gPPP#",  # 14
    "#TTTg..........gPPP#",  # 15
    "#TTTg..........gPPP#",  # 16
    "#TTTg..........gSSS#",  # 17
    "#TTTg.BB.......gSSS#",  # 18
    "#TTTg.BB....KK.gSSS#",  # 19
    "#TTTg.BB....KK.gSSS#",  # 20
    "#TTTg.......KK.gSSS#",  # 21
    "#MMMh..........gSSS#",  # 22
    "#MMMh..........gSSS#",  # 23
    "#MMMh..........gSSS#",  # 24
    "#MMMh..........gSSS#",  # 25
    "#.......hhhh.......#",  # 26
    "#.......hhhh.......#",  # 27
    "########DDDD########",  # 28
    "########DDDD########",  # 29
    "rrrrrrrrrrrrrrrrrrrr",  # 30
    "rrrrrrrrrrrrrrrrrrrr",  # 31
    "rrrrrrrrrrrrrrrrrrrr",  # 32
    "RRRRRRRRRRRRRRRRRRRR",  # 33
]

# key: (名稱, 顏色, 可走)
LEGEND = {
    '#': ('外牆', '#56626b', False),
    'p': ('能源管道', '#c7702e', False),
    'e': ('引擎外殼', '#2e8b99', False),
    'E': ('反物質引擎核心', '#4dd0e1', False),
    'h': ('警示黃黑條紋地面', '#f4e07a', True),
    'g': ('管線溝蓋板（格柵）', '#a3adb3', True),
    '.': ('防滑鋼板地面', '#dcdcd6', True),
    'C': ('控制台', '#e8b33a', False),
    'V': ('重力維持裝置', '#8a78c9', False),
    'P': ('配電盤', '#5b7fc4', False),
    'T': ('工具架', '#8d5a3b', False),
    'B': ('檢修工作台', '#b08a5a', False),
    'K': ('貨箱', '#9aa84a', False),
    'S': ('備品貨架', '#5e6b2b', False),
    'M': ('維修中機台', '#c0504d', False),
    'D': ('厚重隔音門', '#e5735a', True),
    'r': ('走廊地板', '#b9c4cc', True),
    'R': ('走廊外側欄杆', '#3d474e', False),
}

LABELS = [  # (文字, 中心 x, 中心 y)，tile 單位
    ('反物質引擎核心', 10, 3.5), ('能源管道', 2.5, 4), ('能源管道', 17.5, 4),
    ('引擎監控台', 7, 9.5), ('引擎監控台', 13, 9.5), ('重力維持系統', 2, 11.5),
    ('重力控制台', 4.5, 12), ('配電盤', 17.5, 12.5), ('工具架', 2, 18.5),
    ('檢修工作台', 7, 21.5), ('貨箱', 13, 20.5), ('備品倉儲', 17.5, 21.5),
    ('維修區', 2, 24), ('厚重隔音門', 10, 29), ('走廊', 10, 31.5),
    ('← 居住區 C', 2.2, 31.5), ('居住區 D →', 17.8, 31.5),
]

INTERACTIONS = [
    {"id": "engine-core", "kind": "engine", "label": "反物質引擎核心", "text": "（待寫）", "area": [5, 1, 10, 6], "stand": [10, 7.5]},
    {"id": "engine-console-left", "kind": "console", "label": "引擎監控台", "text": "（待寫）", "area": [6, 9, 2, 1], "stand": [7, 10.5]},
    {"id": "engine-console-right", "kind": "console", "label": "引擎監控台", "text": "（待寫）", "area": [12, 9, 2, 1], "stand": [13, 10.5]},
    {"id": "gravity", "kind": "gravity", "label": "重力維持裝置", "text": "（待寫）", "area": [1, 9, 3, 6], "stand": [4.5, 14]},
    {"id": "gravity-console", "kind": "console", "label": "重力控制台", "text": "（待寫）", "area": [4, 11, 1, 2], "stand": [5.5, 12]},
    {"id": "power-panel", "kind": "panel", "label": "配電盤", "text": "（待寫）", "area": [16, 9, 3, 8], "stand": [15.5, 12.5]},
    {"id": "tool-rack", "kind": "rack", "label": "工具架", "text": "（待寫）", "area": [1, 15, 3, 7], "stand": [4.5, 18]},
    {"id": "workbench", "kind": "workbench", "label": "檢修工作台", "text": "（待寫）", "area": [6, 18, 2, 3], "stand": [8.5, 19.5]},
    {"id": "repair-bay", "kind": "repair", "label": "維修中機台", "text": "（待寫）", "area": [1, 22, 3, 4], "stand": [4.5, 23.5]},
    {"id": "storage", "kind": "storage", "label": "備品倉儲", "text": "（待寫）", "area": [16, 17, 3, 9], "stand": [15.5, 21]},
]

EFFECTS = [  # 階段 7 的動畫 / 特效位置草案
    {"target": "engine-core", "effects": ["核心發光呼吸", "能量粒子上升"]},
    {"target": "pipes", "effects": ["接頭偶爾噴蒸氣"]},
    {"target": "engine-console-left", "effects": ["螢幕掃描線", "燈號閃爍"]},
    {"target": "engine-console-right", "effects": ["螢幕掃描線", "燈號閃爍"]},
    {"target": "gravity", "effects": ["環形線圈旋轉（逐格 2–4 張）", "紫色微光"]},
    {"target": "power-panel", "effects": ["指示燈閃爍", "偶爾電弧火花"]},
    {"target": "repair-bay", "effects": ["焊接火花", "焊接光點閃爍"]},
    {"target": "door", "effects": ["門片滑開", "警示燈旋轉", "開到底噴蒸氣"]},
]

H, W = len(LAYOUT), len(LAYOUT[0])
assert all(len(r) == W for r in LAYOUT), [i for i, r in enumerate(LAYOUT) if len(r) != W]
walk = [[LEGEND[c][2] for c in row] for row in LAYOUT]

# ---- 檢查 ----
start = (0, 31)
seen, q = {start}, deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H and walk[ny][nx] and (nx, ny) not in seen:
            seen.add((nx, ny)); q.append((nx, ny))
W_ = lambda x, y: 0 <= x < W and 0 <= y < H and walk[y][x]
cells = [(x, y) for y in range(H) for x in range(W) if walk[y][x]]
unreached = [c for c in cells if c not in seen]
dead = [(x, y) for x, y in cells if sum(W_(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1 and not (x in (0, W - 1) and y >= 30)]
narrow = [(x, y) for x, y in cells if y < 30 and ((not W_(x - 1, y) and not W_(x + 1, y)) or (not W_(x, y - 1) and not W_(x, y + 1)))]
narrow = [c for c in narrow if LAYOUT[c[1]][c[0]] != 'D']
top_walk = [c for c in cells if c[1] < 2]
for it in INTERACTIONS:
    sx, sy = it['stand']
    assert (int(sx), int(sy)) in seen, (it['id'], 'stand 不可達')
print('可走格', len(cells), '走不到', unreached, '死路', dead, '一格窄道', narrow, '最上兩列可走', top_walk)

# ---- JSON ----
entrances = [
    {"x": 0, "y": 30, "w": 1, "h": 3, "to": "residential_c", "label": "往居住區 C", "spawn": [1.5, 31.5]},
    {"x": W - 1, "y": 30, "w": 1, "h": 3, "to": "residential_d", "label": "往居住區 D", "spawn": [W - 1.5, 31.5]},
]
data = {
    "tileSize": 96, "width": W, "height": H,
    "legend": {"0": "可行走", "1": "碰撞"},
    "note": "工程區本體 20×30（第 0–29 列，含底部牆與厚重門），第 30–33 列是下方走廊：左通居住區 C、右通 D。門 (8–11, 28–29) 在同一張地圖裡開關，不切換場景；門關著時由程式把門格設為碰撞。",
    "collision": [[0 if w else 1 for w in row] for row in walk],
    "layout": LAYOUT,
    "layoutLegend": {k: v[0] for k, v in LEGEND.items()},
    "entrances": entrances,
    "door": {"id": "blast-door", "label": "厚重隔音門", "x": 8, "y": 28, "w": 4, "h": 2},
    "interactions": INTERACTIONS,
    "effects": EFFECTS,
}
with open(f'{OUT}/engineering_collision.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

# ---- PNG ----
img = Image.new('RGB', (W * CELL, H * CELL))
d = ImageDraw.Draw(img)
small = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 13)
big = ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', 26)
lum = lambda h: (int(h[1:3], 16) * 299 + int(h[3:5], 16) * 587 + int(h[5:7], 16) * 114) / 1000
for y, row in enumerate(LAYOUT):
    for x, c in enumerate(row):
        col = LEGEND[c][1]
        d.rectangle([x * CELL, y * CELL, (x + 1) * CELL - 1, (y + 1) * CELL - 1], fill=col, outline='#2b3238')
        d.text((x * CELL + 3, y * CELL + 2), f'{x},{y}', font=small, fill='#1b1f23' if lum(col) > 140 else '#e8ecef')
for text, cx, cy in LABELS:
    d.text((cx * CELL, cy * CELL), text, font=big, anchor='mm', fill='white', stroke_width=4, stroke_fill='#1b1f23')
img.save(f'{OUT}/engineering_reference.png')
print('saved', img.size)
