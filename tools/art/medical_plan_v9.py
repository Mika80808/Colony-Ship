"""醫療室 v9 平面規劃（依使用者 2026-10-15 手修格局圖）；不修改遊戲地圖。

用法：python tools/art/medical_plan_v9.py
需要 Pillow。輸出 tools/art/medical/ 的 medical_plan_v9.png（規劃圖）、medical_plan_v9.json、
medical_whitebox_v9.png（白模：一格 48 px，只有地板、牆頂、牆面、門洞，給生圖模型照著畫底圖）。
"""
from collections import deque
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).resolve().parent / 'medical'
CELL, TILE = 28, 48           # TILE：美術圖塊 48 × 48 px；CELL：規劃圖上一格的大小
WIDTH, HEIGHT = 35, 56
CORRIDOR_Y = 52
MARGIN, HEADER, FOOTER = 32, 100, 115
FACE_ROWS = 3                     # 內牆跟北牆一樣高：4 列（牆頂 1 列＋牆面 3 列）
NORMAL_H, CAP_H = FACE_ROWS * TILE, TILE
WALL_CAP, WALL_FACE, FLOOR = '#6d8088', '#d2dadd', '#f5f6f4'
WARD_FLOOR = '#eaf2fa'
LAYOUT = [['.' for _ in range(WIDTH)] for _ in range(HEIGHT)]
WALLS, DOORS, WALL_FACES = [], [], []


def fill(rect, symbol):
    x, y, w, h = rect
    for row in range(y, y + h):
        for col in range(x, x + w):
            LAYOUT[row][col] = symbol


def wall(rect, direction, label):
    WALLS.append({'rect': list(rect), 'dir': direction, 'label': label})
    fill(rect, 'W')


def door(rect, label, framed=True, floor=FLOOR, lintel=False):
    """framed：畫綠框的門；否則是直牆開口，只畫地板。lintel：橫牆門洞，第一列牆頂保留當門楣。"""
    DOORS.append({'rect': list(rect), 'label': label, 'lintel': lintel,
                  'framed': framed, 'floor': floor})
    fill(rect, 'D')


def side_door(x, y, label, floor):
    """直牆上的門：上方先垂完牆面，再開兩格開口（直牆末端先垂完牆面再開門）。"""
    WALL_FACES.append({'rect': [x, y - FACE_ROWS, 1, FACE_ROWS], 'label': '直牆末端下垂牆面', 'bottom': y})
    fill((x, y - FACE_ROWS, 1, FACE_ROWS), 'W')
    door((x, y, 1, 2), label, framed=False, floor=floor)


REGIONS = [
    {'id': 'surgery', 'label': '手術室', 'rect': [1, 4, 10, 9], 'color': '#e4f2ed'},
    {'id': 'ward', 'label': '三床病區', 'rect': [12, 4, 22, 9], 'color': WARD_FLOOR},
    {'id': 'clinic', 'label': '診間', 'rect': [1, 17, 12, 7], 'color': '#e4f2ed'},
    {'id': 'pharmacy', 'label': '藥局', 'rect': [22, 17, 12, 7], 'color': '#e4f2ed'},
    {'id': 'waiting', 'label': '候診區', 'rect': [1, 28, 12, 8], 'color': FLOOR},
    {'id': 'lounge', 'label': '居家休息區', 'rect': [22, 27, 12, 9], 'color': FLOOR},
    {'id': 'med-research', 'label': '醫療研究室', 'rect': [1, 40, 12, 8], 'color': '#e8edf5'},
    {'id': 'drug-research', 'label': '藥物研究室', 'rect': [22, 40, 12, 8], 'color': '#e8edf5'},
]
for region in REGIONS:
    fill(region['rect'], 'R' if 'research' in region['id'] else '.')

# 橫牆：牆頂 1 列＋牆面；北牆、內牆都是 4 列（牆面往下長，佔掉下方房間的列）。
wall((0, 0, WIDTH, 4), 'h', '北外牆')
wall((1, 13, 12, 4), 'h', '手術室南牆／診間北牆')
wall((21, 13, 13, 4), 'h', '病區南牆／藥局北牆')
wall((1, 24, 13, 4), 'h', '診間南牆')
wall((1, 36, 12, 4), 'h', '醫療研究室北牆')
wall((22, 36, 12, 4), 'h', '藥物研究室北牆')
wall((0, 48, WIDTH, 4), 'h', '南牆及入口')
wall((0, 55, WIDTH, 1), 'h', '走廊外側欄杆')
# 直牆：從上面只看得到牆頂，畫成深色。
wall((0, 0, 1, 48), 'v', '西外牆')
wall((34, 0, 1, 48), 'v', '東外牆')
wall((11, 0, 1, 6), 'v', '手術室東牆（門以上）')
wall((11, 11, 1, 2), 'v', '手術室東牆（門以下）')
wall((13, 13, 1, 11), 'v', '診間東牆')
wall((13, 36, 1, 3), 'v', '醫療研究室東牆（門以上）')
wall((13, 44, 1, 4), 'v', '醫療研究室東牆（門以下）')
wall((21, 36, 1, 3), 'v', '藥物研究室西牆（門以上）')
wall((21, 44, 1, 4), 'v', '藥物研究室西牆（門以下）')

side_door(11, 9, '手術室側門（通病區）', WARD_FLOOR)
side_door(13, 42, '醫療研究室門', FLOOR)
side_door(21, 42, '藥物研究室門', FLOOR)
door((5, 13, 2, 4), '診間北門（直通手術室）', lintel=True)
door((5, 24, 2, 4), '診間南門（通候診區）', lintel=True)
door((16, 48, 3, 4), '南側自動滑門', lintel=True)

# 半牆櫃台只擋佔地：西側從主通道取藥，南側從休息區取藥；西側中段留工作出入口。
COUNTERS = [
    {'rect': [21, 17, 1, 4], 'dir': 'v', 'label': '西側取藥櫃台'},
    {'rect': [21, 23, 1, 1], 'dir': 'v', 'label': '西側櫃台轉角'},
    {'rect': [21, 24, 13, 1], 'dir': 'h', 'label': '南側取藥櫃台'},
]
for counter in COUNTERS:
    fill(counter['rect'], 'C')
door((21, 21, 1, 2), '藥局工作出入口')

# 病區南側對主通道開口，開口掛一道跟主通道同寬的橫向拉簾，預設收在東側。
CURTAINS = [{'id': 'ward-curtain', 'label': '中間床拉簾', 'rect': [14, 13, 7, 0.15],
             'defaultState': 'open', 'note': '病區對主通道的開口；橫向軌道，向東收簾。'}]

BEDS = [{'id': f'bed-{i + 1}', 'rect': [x, 4, 3, 6]} for i, x in enumerate((15, 21, 27))]
for bed in BEDS:
    fill(bed['rect'], 'B')
fill((0, CORRIDOR_Y, WIDTH, 3), 'r')


def validate():
    """門視為開啟；檢查所有空地、所有分區與兩側入口均可達。"""
    walk = {(x, y) for y, row in enumerate(LAYOUT) for x, c in enumerate(row)
            if c not in ('W', 'B', 'C')}
    start = (1, CORRIDOR_Y + 1)
    seen, queue = {start}, deque([start])
    neighbors = lambda p: [(p[0] + dx, p[1] + dy)
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    while queue:
        for point in neighbors(queue.popleft()):
            if point in walk and point not in seen:
                seen.add(point)
                queue.append(point)
    unreached = sorted(walk - seen)
    dead = sorted(p for p in walk if p[1] < CORRIDOR_Y
                  and sum(n in walk for n in neighbors(p)) <= 1)
    narrow = sorted((x, y) for x, y in walk if y < CORRIDOR_Y and LAYOUT[y][x] != 'D'
                    and (((x - 1, y) not in walk and (x + 1, y) not in walk)
                         or ((x, y - 1) not in walk and (x, y + 1) not in walk)))
    for region in REGIONS:
        x, y, w, h = region['rect']
        assert any((cx, cy) in seen for cy in range(y, y + h)
                   for cx in range(x, x + w)), region['label']
    for opening in DOORS:
        x, y, w, h = opening['rect']
        assert all((cx, cy) in seen for cy in range(y, y + h)
                   for cx in range(x, x + w)), opening['label']
    assert (WIDTH - 2, CORRIDOR_Y + 1) in seen
    # 診間東側封牆，只能從候診區南門進、北門直通手術室。
    assert all(LAYOUT[y][13] == 'W' for y in range(13, 24))
    for face in WALL_FACES:
        x, y, w, h = face['rect']
        assert y + h == face['bottom']
        assert any(d['rect'][0] == x and d['rect'][1] == face['bottom'] for d in DOORS)
    assert all(LAYOUT[y][x] == '.' for y in range(10, 13) for x in range(12, 34))  # 床尾通路
    assert all(LAYOUT[13][x] == '.' for x in range(14, 21))  # 病區對主通道的開口（拉簾）
    assert all(LAYOUT[y][20] == '.' for y in range(17, 21))  # 西側取藥站位
    assert all(LAYOUT[26][x] == '.' for x in range(21, 34))  # 南側取藥站位
    assert not unreached, unreached
    assert not dead, dead
    assert not narrow, narrow
    return {'可走格': len(walk), '走不到': unreached, '死路': dead,
            '一格窄道': narrow, '已連通分區': len(REGIONS), '已連通門洞': len(DOORS)}


def render():
    image = Image.new('RGB', (WIDTH * CELL + MARGIN * 2,
                             HEIGHT * CELL + HEADER + FOOTER), '#ffffff')
    draw = ImageDraw.Draw(image)
    # 由系統字型目錄尋找，專案不寫磁碟機絕對路徑。
    fonts = Path(os.environ['WINDIR']) / 'Fonts'
    font = ImageFont.truetype(str(fonts / 'msjh.ttc'), 23)
    medium = ImageFont.truetype(str(fonts / 'msjh.ttc'), 19)
    small = ImageFont.truetype(str(fonts / 'msjh.ttc'), 17)
    title = ImageFont.truetype(str(fonts / 'msjhbd.ttc'), 30)

    def box(rect):
        x, y, w, h = rect
        return (MARGIN + x * CELL, HEADER + y * CELL,
                MARGIN + (x + w) * CELL, HEADER + (y + h) * CELL)

    def label(text, x, y, face=font, color='#293f4b'):
        draw.text((MARGIN + x * CELL, HEADER + y * CELL), text,
                  font=face, fill=color, anchor='mm')

    draw.text((MARGIN, 18), '醫療室平面規劃 v9', font=title, fill='#253e48')
    draw.text((MARGIN, 62), '藥局雙面半牆櫃台＋中間病床拉簾｜每格 48 × 48 px｜內牆、北牆都是 4 列',
              font=small, fill='#62757b')
    draw.rectangle(box((0, 0, WIDTH, HEIGHT)), fill=FLOOR)
    for region in REGIONS:
        draw.rectangle(box(region['rect']), fill=region['color'])
    draw.rectangle(box((0, CORRIDOR_Y, WIDTH, 3)), fill='#e5eaed')
    for y in range(HEIGHT + 1):
        draw.line((MARGIN, HEADER + y * CELL, MARGIN + WIDTH * CELL,
                   HEADER + y * CELL), fill='#e4e8e8')
    for x in range(WIDTH + 1):
        draw.line((MARGIN + x * CELL, HEADER, MARGIN + x * CELL,
                   HEADER + HEIGHT * CELL), fill='#e4e8e8')
    # 橫牆：灰色牆面＋上緣一列深色牆頂；直牆從上面只看得到牆頂，整條深色。
    for item in WALLS:
        x, y, w, h = item['rect']
        if item['dir'] == 'h':
            draw.rectangle(box(item['rect']), fill=WALL_FACE, outline=WALL_CAP, width=1)
            draw.rectangle(box((x, y, w, 1)), fill=WALL_CAP)
        else:
            draw.rectangle(box(item['rect']), fill=WALL_CAP)
    for face in WALL_FACES:
        draw.rectangle(box(face['rect']), fill=WALL_FACE)
    # 櫃台：直的整段畫實；南側櫃台是一條櫃面加下方低矮立面。
    for counter in COUNTERS:
        x, y, w, h = counter['rect']
        if counter['dir'] == 'h':
            draw.rectangle(box((x, y + 0.4, w, 1.1)), fill='#dcc6a3', outline='#997c50')
            draw.rectangle(box((x, y - 0.4, w, 0.8)), fill='#b99863', outline='#80633e', width=2)
        else:
            draw.rectangle(box(counter['rect']), fill='#b99863', outline='#80633e', width=2)
    for opening in DOORS:
        x, y, w, h = opening['rect']
        if not opening['framed']:
            draw.rectangle(box(opening['rect']), fill=opening['floor'])
            continue
        # 橫牆的牆頂保留為門楣；可走門洞位於其下方，不把門楣當碰撞。
        rect = (x, y + 1, w, h - 1) if opening['lintel'] else (x, y, w, h)
        draw.rectangle(box(rect), fill='#def6f0', outline='#328c7d', width=2)
    for bed in BEDS:
        x, y, w, h = bed['rect']
        draw.rounded_rectangle(box(bed['rect']), radius=7, fill='#b9d5e8',
                               outline='#627f92', width=2)
        x0, y0, x1, _ = box(bed['rect'])
        draw.rounded_rectangle((x0 + 8, y0 + 8, x1 - 8, y0 + 30),
                               radius=4, fill='#ffffff')
        label('病床', x + w / 2, y + 3.1, small)
    for region in REGIONS:
        x, y, w, h = region['rect']
        label(region['label'], x + w / 2, y + (-2 if region['id'] == 'ward' else h / 2))
    # 紫色虛線是拉簾軌道；東端短褶線表示收簾位置。
    cx, cy, cw, _ = CURTAINS[0]['rect']
    draw.rectangle(box((cx + 0.04, cy + 0.1, cw - 0.25, 1.4)), fill=WARD_FLOOR)
    for step in range(12):
        x = cx + 0.15 + step * 0.5
        draw.line((MARGIN + x * CELL, HEADER + (cy + 0.3) * CELL,
                   MARGIN + (x + 0.3) * CELL, HEADER + (cy + 0.3) * CELL), fill='#95639c', width=3)
    for step in range(5):
        x = cx + cw - 0.9 + step * 0.1
        draw.line((MARGIN + x * CELL, HEADER + (cy + 0.15) * CELL,
                   MARGIN + x * CELL, HEADER + (cy + 0.65) * CELL), fill='#95639c', width=2)
    label('中間床拉簾', cx + cw / 2 - 0.07, cy + 0.93, medium, '#82558a')
    label('半牆取藥櫃台', 28, 24.9, small, '#75532e')
    label('← 取藥', 23.5, 19, small, '#75532e')
    draw.rectangle(box((26, 26, 4, 2)), outline='#c88c35', width=2)
    label('取藥等候', 28, 27, small, '#986522')
    label('主通道', 17.5, 31, small, '#70868c')
    label('入口', 17.5, 50, small)
    label('← 居住區 B', 4, CORRIDOR_Y + 1.5, small)
    label('居住區 C →', 31, CORRIDOR_Y + 1.5, small)
    label('走廊', 17.5, CORRIDOR_Y + 1.5, small)
    footer_y = HEADER + HEIGHT * CELL + 18
    for index, text in enumerate((
        '綠框：門 2 格、大門 3 格；手術室、研究室的門是直牆開口；深色牆頂、灰色牆面。',
        '棕色：半牆櫃台（左／下側取藥）；紫色：可開合拉簾，圖示為收起。',
        '本圖為格局規劃，尚未套用遊戲；家具、互動站位與精細碰撞另行配置。',
    )):
        draw.text((MARGIN, footer_y + index * 27), text, font=small, fill='#62757b')
    return image


def whitebox():
    """白模：一格 TILE px、斜俯視，只有地板、牆頂、牆面、門洞，沒有文字、家具、櫃台、拉簾。
    牆頂（從上面看的面）最亮、牆面次之；所有牆頂、牆面各自合成一整塊再描邊，接頭不留縫。
    光從左上，牆的右下方落一條接地陰影。"""
    import numpy as np
    T = TILE
    H, W = HEIGHT * T, WIDTH * T
    top = np.zeros((H, W), bool)       # 牆頂
    front = np.zeros((H, W), bool)     # 牆面

    def px(rect):
        x, y, w, h = rect
        return slice(round(y * T), round((y + h) * T)), slice(round(x * T), round((x + w) * T))

    for item in WALLS:
        x, y, w, h = item['rect']
        if item['dir'] == 'v':
            top[px(item['rect'])] = True
        elif h == 1:   # 走廊外側欄杆：矮，頂面窄
            front[px(item['rect'])] = True
            top[px((x, y, w, 1 / 3))] = True
        else:
            front[px(item['rect'])] = True
            top[px((x, y, w, 1))] = True
    for item in WALL_FACES:
        front[px(item['rect'])] = True
    front &= ~top
    for opening in DOORS:
        x, y, w, h = opening['rect']
        hole = px((x, y + 1, w, h - 1) if opening['lintel'] else (x, y, w, h))
        top[hole] = front[hole] = False

    floor = np.full((H, W, 3), (223, 226, 224), np.uint8)
    for y, row in enumerate(LAYOUT):
        for x, c in enumerate(row):
            if c == 'R':
                floor[px((x, y, 1, 1))] = (214, 220, 228)
            elif c == 'r':
                floor[px((x, y, 1, 1))] = (211, 216, 219)
    floor[::T, :] = floor[:, ::T] = (205, 210, 207)          # 格線，讓模型抓得到一格的大小
    wall = top | front
    shadow = np.zeros_like(wall)
    shadow[8:, 8:] = wall[:-8, :-8]
    floor[shadow & ~wall] = (floor[shadow & ~wall] * 0.82).astype(np.uint8)
    floor[front] = (182, 189, 194)
    floor[top] = (244, 245, 246)
    # 描邊：牆頂、牆面、地板三種區域的交界畫 2 px 深色線。
    kind = top * 2 + front * 1
    edge = np.zeros_like(wall)
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0), (0, 2), (2, 0)):
        shifted = np.roll(kind, (dy, dx), axis=(0, 1))
        edge |= (shifted != kind) & ((kind > 0) | (shifted > 0))
    edge &= wall
    floor[edge] = (89, 100, 107)
    return Image.fromarray(floor)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = validate()
    data = {
        'version': 9, 'revision': '依使用者 2026-10-15 手修格局圖', 'status': '使用者定案，尚未套用遊戲',
        'tileSize': TILE, 'width': WIDTH, 'height': HEIGHT,
        'note': '規劃專用格式。門洞為開啟狀態；精細碰撞待重建底圖時處理。',
        'layout': [''.join(row) for row in LAYOUT],
        'layoutLegend': {'.': '公共區醫療地磚', 'R': '研究區地磚', 'W': '牆或欄杆',
                         'D': '門洞', 'B': '病床佔位', 'C': '半牆櫃台佔地', 'r': '走廊'},
        'regions': REGIONS, 'walls': WALLS, 'wallFaces': WALL_FACES,
        'doors': DOORS, 'beds': BEDS, 'counters': COUNTERS, 'curtains': CURTAINS,
        'reservations': [{'id': 'pharmacy-wait', 'rect': [26, 26, 4, 2], 'blocking': False}],
        'wallHeights': {'normal': NORMAL_H, 'cap': CAP_H},
        'entrances': [{'to': 'residential_b', 'spawn': [1.5, CORRIDOR_Y + 1.5]},
                      {'to': 'residential_c', 'spawn': [33.5, CORRIDOR_Y + 1.5]}],
        'validation': report,
    }
    (OUT / 'medical_plan_v9.json').write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    render().save(OUT / 'medical_plan_v9.png')
    whitebox().save(OUT / 'medical_whitebox_v9.png')
    print(json.dumps(report, ensure_ascii=False))
    print('已產生 medical_plan_v9.png、medical_plan_v9.json、medical_whitebox_v9.png')


if __name__ == '__main__':
    main()
