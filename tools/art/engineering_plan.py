"""工程區規劃圖：產出 engineering_reference.png 與 engineering_collision.json，並做連通 / 窄道 / 死路檢查。

用法：uv run --with pillow python tools/art/engineering_plan.py <輸出資料夾>
改配置就改 LAYOUT 的字母格，重跑即可。
"""
import json, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
CELL = 64

# 本體 16×20（第 0–19 列，含底牆與門），第 20–23 列是下方走廊。
# 欄位：0 牆｜1–2 靠牆高機台｜3–4 走道｜5–6 機台島｜7–8 主走道｜9–10 機台島｜11–12 走道｜13–14 靠牆高機台｜15 牆
LAYOUT = [
    "################",  # 0
    "#ppppFffffFpppp#",  # 1
    "#PPCCFffffFCCvv#",  # 2
    "#PP..FffffF..vv#",  # 3
    "#PP..FFFFFF..vv#",  # 4
    "#PPhhhhhhhhhhvv#",  # 5
    "#TTgg..x...ggGG#",  # 6
    "#TTggQQ..AAggGG#",  # 7
    "#TTggQQ..AAggGG#",  # 8
    "#TTggQQ..AAgxGG#",  # 9
    "#WWgg......ggGG#",  # 10
    "#WWgg..x...ggSS#",  # 11
    "#WWggBB..MMggSS#",  # 12
    "#WWxgBB..MMgxSS#",  # 13
    "#WWggc...WWggSS#",  # 14
    "#kkgg.x....ggXX#",  # 15
    "#kk...hhhh...XX#",  # 16
    "#kk..xhhhh...XX#",  # 17
    "######DDDD######",  # 18
    "######DDDD######",  # 19
    "rrrrrrrrrrrrrrrr",  # 20
    "rrrrrrrrrrrrrrrr",  # 21
    "rrrrrrrrrrrrrrrr",  # 22
    "RRRRRRRRRRRRRRRR",  # 23
]

# key: (名稱, 顏色, 可走)
LEGEND = {
    '#': ('外牆', '#56626b', False),
    'p': ('能源管道（靠牆）', '#c7702e', False),
    'F': ('大型製造機', '#2e8b99', False),
    'f': ('製造機加工艙（發光）', '#4dd0e1', False),
    'h': ('警示黃黑條紋地面', '#f4e07a', True),
    'g': ('管線溝蓋板（格柵）', '#a3adb3', True),
    '.': ('防滑鋼板地面', '#dcdcd6', True),
    'x': ('地面油污／散落零件（可走）', '#b8a98c', True),
    'C': ('控制台', '#e8b33a', False),
    'P': ('配電盤', '#5b7fc4', False),
    'v': ('管線閥門組', '#b5523b', False),
    'T': ('工具牆', '#8d5a3b', False),
    'Q': ('研發桌', '#3f9e8f', False),
    'A': ('組裝機械手臂', '#d06f9c', False),
    'G': ('材料架（板材、管材、線材）', '#7a8794', False),
    'W': ('待修品（貨架／棧板）', '#c2185b', False),
    'B': ('檢修工作台', '#b08a5a', False),
    'M': ('維修中機台', '#c0504d', False),
    'S': ('零件貨架', '#5e6b2b', False),
    'X': ('耗材油桶', '#6f4e37', False),
    'c': ('推車', '#e09b5a', False),
    'k': ('置物櫃＋咖啡機', '#7c6f9b', False),
    'D': ('厚重隔音門', '#e5735a', True),
    'r': ('走廊地板', '#b9c4cc', True),
    'R': ('走廊外側欄杆', '#3d474e', False),
}

LABELS = [  # (文字, 中心 x, 中心 y)，tile 單位
    ('大型製造機', 8, 2.5), ('能源管道', 2.5, 1.5), ('能源管道', 13.5, 1.5),
    ('製造控制', 4, 2.5), ('區段監控', 12, 2.5), ('配電盤', 2, 4), ('管線閥門', 14, 4),
    ('工具牆', 2, 8), ('研發桌', 6, 8.5), ('組裝手臂', 10, 8.5), ('材料架', 14, 8.5),
    ('待修品架', 2, 12.5), ('工作台', 6, 13), ('維修中', 10, 13), ('待修品', 10, 14.5), ('零件貨架', 14, 13),
    ('休息角', 2, 16.5), ('耗材油桶', 14, 16.5), ('厚重隔音門', 8, 19),
    ('走廊', 8, 21.5), ('← 居住區 C', 2.2, 21.5), ('居住區 D →', 13.8, 21.5),
]

# 頭頂物件：不佔碰撞，之後做成前景層蓋在角色上面（tile 單位）
OVERHEAD = [
    {"id": "cable-tray", "label": "頭頂電纜架", "x": 1, "y": 10, "w": 14, "h": 1},
    {"id": "crane", "label": "天車軌道", "x": 8, "y": 11, "w": 5, "h": 4},
]

INTERACTIONS = [
    {"id": "fabricator", "kind": "fabricator", "label": "大型製造機", "text": "加工艙裡正在成形一批管件接頭，噴頭來回移動，光一明一滅。", "area": [5, 1, 6, 4], "stand": [8, 5.5]},
    {"id": "fab-console", "kind": "console", "label": "製造機控制台", "text": "排程上列著幾筆零件訂單，最上面那筆標著「急件」。", "area": [3, 2, 2, 1], "stand": [4, 3.5]},
    {"id": "section-monitor", "kind": "console", "label": "區段監控台", "text": "這一段外環的電力與管線壓力都顯示在螢幕上，有一格閃著黃燈。", "area": [11, 2, 2, 1], "stand": [12, 3.5]},
    {"id": "power-panel", "kind": "panel", "label": "配電盤", "text": "一整排斷路器，每個開關旁都貼著手寫標籤。", "area": [1, 2, 2, 4], "stand": [3.5, 5.5]},
    {"id": "valves", "kind": "valves", "label": "管線閥門組", "text": "幾個手輪閥門和壓力錶，其中一支指針微微抖動。", "area": [13, 2, 2, 4], "stand": [12.5, 5.5]},
    {"id": "tool-wall", "kind": "rack", "label": "工具牆", "text": "扳手、焊槍和量具照輪廓掛好，只有一格是空的。", "area": [1, 6, 2, 4], "stand": [3.5, 8]},
    {"id": "rnd-bench", "kind": "rnd", "label": "研發桌", "text": "拆開的原型機攤在桌上，旁邊的示波器跳著波形。", "area": [5, 7, 2, 3], "stand": [7.5, 8]},
    {"id": "robot-arm", "kind": "robot", "label": "組裝機械手臂", "text": "機械手臂把小零件一個個裝進外殼，動作很穩。", "area": [9, 7, 2, 3], "stand": [11.5, 8]},
    {"id": "materials", "kind": "storage", "label": "材料架", "text": "板材、管材和一捲捲線材，按尺寸分格堆放。", "area": [13, 6, 2, 5], "stand": [12.5, 7]},
    {"id": "repair-queue", "kind": "storage", "label": "待修品架", "text": "從艦上各處送回來的故障設備，每件都綁著寫了地點的吊牌。", "area": [1, 10, 2, 5], "stand": [3.5, 12]},
    {"id": "workbench", "kind": "workbench", "label": "檢修工作台", "text": "桌面上有拆到一半的設備，螺絲按順序排在磁盤裡。", "area": [5, 12, 2, 2], "stand": [6.5, 14.5]},
    {"id": "repair", "kind": "repair", "label": "維修中機台", "text": "外殼被打開了，裡面有一片燒黑的電路板。", "area": [9, 12, 2, 2], "stand": [8.5, 13]},
    {"id": "repair-pallet", "kind": "storage", "label": "待修品", "text": "剛送來的一台故障設備，吊牌上寫著「居住區 C」。", "area": [9, 14, 2, 1], "stand": [8.5, 14.5]},
    {"id": "parts-shelves", "kind": "storage", "label": "零件貨架", "text": "一格格標好編號的零件盒。", "area": [13, 11, 2, 4], "stand": [12.5, 13]},
    {"id": "break-corner", "kind": "break", "label": "休息角", "text": "置物櫃上貼著班表，咖啡機旁擺著一個沾了油漬的馬克杯。", "area": [1, 15, 2, 3], "stand": [3.5, 16]},
]

EFFECTS = [  # 階段 7 的動畫 / 特效位置草案
    {"target": "fabricator", "effects": ["加工艙發光呼吸", "噴頭雷射光點", "偶爾噴冷卻蒸氣"]},
    {"target": "pipes", "effects": ["接頭偶爾噴蒸氣"]},
    {"target": "fab-console", "effects": ["螢幕掃描線", "燈號閃爍"]},
    {"target": "section-monitor", "effects": ["螢幕掃描線", "黃燈閃爍"]},
    {"target": "power-panel", "effects": ["指示燈閃爍", "偶爾電弧火花"]},
    {"target": "valves", "effects": ["壓力錶指針抖動", "閥門滲出蒸氣"]},
    {"target": "rnd-bench", "effects": ["示波器波形", "原型機小燈閃爍"]},
    {"target": "robot-arm", "effects": ["手臂來回組裝（逐格 2–4 張）"]},
    {"target": "repair", "effects": ["焊接火花", "焊接光點閃爍"]},
    {"target": "break-corner", "effects": ["咖啡機冒熱氣"]},
    {"target": "door", "effects": ["門片滑開", "警示燈旋轉", "開到底噴蒸氣"]},
]

H, W = len(LAYOUT), len(LAYOUT[0])
assert all(len(r) == W for r in LAYOUT), [i for i, r in enumerate(LAYOUT) if len(r) != W]
walk = [[LEGEND[c][2] for c in row] for row in LAYOUT]
CORRIDOR_Y = next(y for y, row in enumerate(LAYOUT) if row[0] == 'r')

# ---- 檢查 ----
start = (0, CORRIDOR_Y + 1)
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
dead = [(x, y) for x, y in cells if sum(W_(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) <= 1 and not (x in (0, W - 1) and y >= CORRIDOR_Y)]
narrow = [(x, y) for x, y in cells if y < CORRIDOR_Y and ((not W_(x - 1, y) and not W_(x + 1, y)) or (not W_(x, y - 1) and not W_(x, y + 1)))]
narrow = [c for c in narrow if LAYOUT[c[1]][c[0]] != 'D']
top_walk = [c for c in cells if c[1] < 2]
for it in INTERACTIONS:
    sx, sy = it['stand']
    assert (int(sx), int(sy)) in seen, (it['id'], 'stand 不可達')
inner = sum(1 for y in range(CORRIDOR_Y - 2) for x in range(W) if LAYOUT[y][x] != '#')
body_walk = sum(1 for x, y in cells if y < CORRIDOR_Y - 2)
report = {'可走格（本體）': body_walk, '本體室內格': inner, '可走比例': round(body_walk / inner, 2),
          '走不到': unreached, '死路': dead, '一格窄道': narrow, '最上兩列可走': top_walk}
print(json.dumps(report, ensure_ascii=False))

# ---- JSON ----
entrances = [
    {"x": 0, "y": CORRIDOR_Y, "w": 1, "h": 3, "to": "residential_c", "label": "往居住區 C", "spawn": [1.5, CORRIDOR_Y + 1.5]},
    {"x": W - 1, "y": CORRIDOR_Y, "w": 1, "h": 3, "to": "residential_d", "label": "往居住區 D", "spawn": [W - 1.5, CORRIDOR_Y + 1.5]},
]
door_x = LAYOUT[CORRIDOR_Y - 1].index('D')
data = {
    "tileSize": 96, "width": W, "height": H,
    "legend": {"0": "可行走", "1": "碰撞"},
    "note": f"工程區本體 {W}×{CORRIDOR_Y}（第 0–{CORRIDOR_Y - 1} 列，含底牆與厚重門），第 {CORRIDOR_Y}–{H - 1} 列是下方走廊：左通居住區 C、右通 D。門在同一張地圖裡開關，不切換場景；門關著時由程式把門格設為碰撞。overhead 是頭頂物件，不佔碰撞，做成前景層。",
    "collision": [[0 if w else 1 for w in row] for row in walk],
    "layout": LAYOUT,
    "layoutLegend": {k: v[0] for k, v in LEGEND.items()},
    "entrances": entrances,
    "door": {"id": "blast-door", "label": "厚重隔音門", "x": door_x, "y": CORRIDOR_Y - 2, "w": LAYOUT[CORRIDOR_Y - 1].count('D'), "h": 2},
    "overhead": OVERHEAD,
    "interactions": INTERACTIONS,
    "effects": EFFECTS,
}
with open(f'{OUT}/engineering_collision.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)

# ---- PNG ----
img = Image.new('RGB', (W * CELL, H * CELL))
d = ImageDraw.Draw(img)
small = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 13)
big = ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', 22)
lum = lambda h: (int(h[1:3], 16) * 299 + int(h[3:5], 16) * 587 + int(h[5:7], 16) * 114) / 1000
for y, row in enumerate(LAYOUT):
    for x, c in enumerate(row):
        col = LEGEND[c][1]
        d.rectangle([x * CELL, y * CELL, (x + 1) * CELL - 1, (y + 1) * CELL - 1], fill=col, outline='#2b3238')
        d.text((x * CELL + 3, y * CELL + 2), f'{x},{y}', font=small, fill='#1b1f23' if lum(col) > 140 else '#e8ecef')
for o in OVERHEAD:  # 頭頂物件畫虛線框
    x0, y0, x1, y1 = o['x'] * CELL + 3, o['y'] * CELL + 3, (o['x'] + o['w']) * CELL - 4, (o['y'] + o['h']) * CELL - 4
    for a, b in (((x0, y0), (x1, y0)), ((x0, y1), (x1, y1)), ((x0, y0), (x0, y1)), ((x1, y0), (x1, y1))):
        n = max(1, int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) // 14))
        for i in range(0, n, 2):
            t0, t1 = i / n, min(1, (i + 1) / n)
            d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill='#ff3b6b', width=4)
    d.text((x1 - 4, y0 + 6), o['label'], font=small, anchor='ra', fill='#ff3b6b', stroke_width=3, stroke_fill='white')
for text, cx, cy in LABELS:
    d.text((cx * CELL, cy * CELL), text, font=big, anchor='mm', fill='white', stroke_width=4, stroke_fill='#1b1f23')
img.save(f'{OUT}/engineering_reference.png')
print('saved', img.size)
