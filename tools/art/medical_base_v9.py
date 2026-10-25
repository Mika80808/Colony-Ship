"""醫療室 v9 底圖：從使用者給的素材圖切地磚與牆，照 medical_plan_v9.json 拼成一格 48 px 的底圖。

用法：python tools/art/medical_base_v9.py（先跑 medical_plan_v9.py 產生 json）
來源（tools/art/medical/raw/）：
  medical_floor_resin.png  四色霧面樹脂地板（2026-10-17，取代小方格磁磚），每色 4 × 4 片大方板：左上綠、右上淺藍、左下藍灰、右下米白
  medical_walls_ref.jpg    牆的參考圖：海軍藍牆頂（深色描邊＋亮邊＋底部斜面）、白色牆面＋踢腳板
  medical_corridor_ref.jpg 居住區走廊一個柱間（corridor-a x=1274 起，門與燈已清掉），寬 517 可左右重複；
                           只到地板底（754 px），下面的欄杆與窗外星空從 public/assets/corridor-a 同一段補上
  repaint_{nw,ne,sw,se}.png GPT 照 base_v9.png 分四塊重畫的質感版（作法與 prompt 見 tools/art/medical/prompts.md）
輸出 tools/art/medical/base_v9.png：室內 48 列＋走廊原尺寸 996 px，補到整格（69 列，1680 × 3312）。這張是腳本拼的版本，
也是重畫的輸入圖；四張重畫圖都在時，遊戲底圖改用重畫版（室內換掉，走廊不變）。
使用者手修的整張底圖 tools/art/medical/ground.webp 在的話，以它為準（尺寸要跟地圖一樣 1680 × 3312，牆線不能動，
碰撞與牆的遮擋都照格線算）。手修從 public/assets/medical/ground.webp 開始改，PSD 原檔放 場景/。
走廊不縮放：角色在每個場景都是 148 世界單位高，走廊要跟居住區走廊一樣大；室內一格 48 所以房間相對角色比較小。
程式只做切割、縮放、拼接：地板切中間四片（縫中線到縫中線，可無縫重複），一片 2 × 2 格；牆頂與牆面取參考圖的剖面像素照牆線鋪。
另外寫 public/assets/medical/map.json：碰撞（牆、病床與櫃台佔位、門洞）、牆的遮擋片（walls：從底圖切牆頂那一條，
角色走到橫牆後面時畫在角色上面）、自動玻璃門。大門圖要先用 python tools/art/cut.py door medical 切好。
"""
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image

import cut

DOOR = cut.door_geometry('medical')    # 大門的門框、門洞、燈條位置（從門的原圖量，見 medical_objects.door()）

HERE = Path(__file__).resolve().parent
RAW = HERE / 'medical' / 'raw'
PLAN = json.loads((HERE / 'medical' / 'medical_plan_v9.json').read_text(encoding='utf-8'))
T = PLAN['tileSize']
W, H = PLAN['width'], PLAN['height']
INTERIOR_ROWS = 48            # 南牆（第 48 列）以下是走廊
CORRIDOR_X, CORRIDOR_H = 1274, 996       # 柱間在 corridor-a 的位置；走廊素材總高
CORRIDOR_WALL = 345                      # 走廊素材：牆面到 y 345 為止
ENTRANCE_W, ENTRANCE_LINTEL = DOOR['frame'][0], 66   # 牆上切口＝門框外寬（6 格），門框的門楣、門柱蓋住切口邊緣
ROWS = -(-(INTERIOR_ROWS * T + CORRIDOR_H) // T)                 # 整張地圖的列數
CORRIDOR_TOP = (INTERIOR_ROWS * T + 397) // T                    # 走廊可走帶：素材 y 397–775，取落在裡面的整列
CORRIDOR_BOTTOM = (INTERIOR_ROWS * T + 775) // T

# ── 地板：霧面樹脂大方板，每色取中間四片（縫中線到縫中線），一片 2 × 2 格 ─────────
SHEET = Image.open(RAW / 'medical_floor_resin.png').convert('RGB')
PANEL = 2 * T
QUAD = {'green': (0, 0), 'ward': (630, 0), 'research': (0, 629), 'cream': (630, 629)}   # 象限左上角（洋紅間隔之後）
SEAMS = (156.5, 313.25, 469.5)   # 象限內三條接縫的中線（相對象限左上角，從原圖量）
# 色調對回原本四色地磚的平均色（素材表顏色偏飽和），只留材質的明暗變化
TARGET = {'green': (235.7, 242.9, 238.8), 'ward': (236.0, 241.3, 244.9),
          'research': (226.3, 231.8, 236.3), 'cream': (240.0, 239.3, 237.2)}


def panels(name):
    ox, oy = QUAD[name]
    out = []
    for gy in range(2):
        for gx in range(2):
            box = (round(ox + SEAMS[gx]), round(oy + SEAMS[gy]), round(ox + SEAMS[gx + 1]), round(oy + SEAMS[gy + 1]))
            out.append(np.array(SHEET.crop(box).resize((PANEL, PANEL), Image.LANCZOS)).astype(float))
    mean = np.mean([p.reshape(-1, 3).mean(0) for p in out], 0)
    return [np.clip(p - mean + TARGET[name], 0, 255).astype(np.uint8) for p in out]


FLOORS = {name: panels(name) for name in QUAD}
REGION_FLOOR = {'surgery': 'green', 'clinic': 'green', 'ward': 'ward',
                'med-research': 'research', 'drug-research': 'research'}
CREAM_ORIGIN = (840 - PANEL // 2, 0)   # 公共區一整片連通：大方板以主通道中線（大門中心 x 840）對稱排


def floor_of(x, y):
    """這格的地板材質與方板排列的原點（px）：有隔牆的房間從房間左上角排，公共區整片一起排。"""
    for region in PLAN['regions']:
        rx, ry, rw, rh = region['rect']
        if rx <= x < rx + rw and ry <= y < ry + rh:
            name = REGION_FLOOR.get(region['id'], 'cream')
            return name, (rx * T, ry * T) if name != 'cream' else CREAM_ORIGIN
    if x == 11 and 9 <= y < 11:          # 手術室側門開口接病區
        return 'ward', (12 * T, 4 * T)
    if 5 <= x < 7 and 14 <= y < 17:      # 診間北門（手術室與診間之間）
        return 'green', (1 * T, 17 * T)
    return 'cream', CREAM_ORIGIN


def floor_texture(name, origin, height, width, seed=9):
    """整張地圖大小的地板：每片隨機挑四片之一。不旋轉：切片時接縫只會落在固定的兩邊，轉了就會有的邊有縫、有的沒有。"""
    ox, oy = origin
    out = np.zeros((height, width, 3), np.uint8)
    for py in range(-1, height // PANEL + 2):
        for px_ in range(-1, width // PANEL + 2):
            rng = random.Random(f'{seed}:{name}:{px_}:{py}')
            tile = rng.choice(FLOORS[name])
            x0, y0 = ox % PANEL + (px_ - 1) * PANEL, oy % PANEL + (py - 1) * PANEL
            xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + PANEL, width), min(y0 + PANEL, height)
            if xa < xb and ya < yb:
                out[ya:yb, xa:xb] = tile[ya - y0:yb - y0, xa - x0:xb - x0]
    return out


# ── 牆：從參考圖取剖面 ─────────────────────────────────────────────
WALL_REF = RAW / 'medical_walls_ref.jpg'   # 只有重拼底圖時要；已改用手修底圖（tools/art/medical/ground.webp）時可以不在
if WALL_REF.exists():
    REF = np.array(Image.open(RAW / 'medical_walls_ref.jpg').convert('RGB'))
    TOP_EDGE = REF[0:8, 700]                    # 牆頂上緣（北牆）：深色描邊→亮邊→藍
    LEFT_EDGE = REF[600, 0:8]                   # 牆頂左緣（西牆）
    RIGHT_EDGE = REF[600, 29:35][::-1]          # 牆頂右緣：深色描邊＋暗斜面（由外往內）
    FRONT_EDGE = REF[408:424, 300][::-1]        # 橫牆牆頂下緣（面向鏡頭的斜面，由外往內）
    NAVY = REF[8:30, 560:700]                   # 牆頂中間的藍色材質
    FACE_IN = REF[424:486, 300]                 # 內牆牆面：上亮線、白、踢腳板、底線
    FACE_OUT = REF[40:104, 700]                 # 北牆牆面
FACE_SIDE = np.array([[12, 17, 20], [12, 17, 20], [120, 124, 126]], np.uint8)  # 牆面在門洞、牆端的側邊


def stretch(profile, height, top=3, bottom=13):
    """牆面剖面：上緣與踢腳板保留原像素，中間白牆拉到需要的高度。"""
    middle = profile[top:len(profile) - bottom]
    idx = np.linspace(0, len(middle) - 1, height - top - bottom).round().astype(int)
    return np.concatenate([profile[:top], middle[idx], profile[len(profile) - bottom:]])


def run_length(mask, axis, reverse):
    """每個像素沿某方向往外數，還有幾格同一塊（1 = 緊貼邊緣）。"""
    m = np.flip(mask, axis) if reverse else mask
    out = np.zeros(m.shape, np.int32)
    acc = np.zeros(m.shape[1 - axis], np.int32)
    for i in range(m.shape[axis]):
        line = m[i] if axis == 0 else m[:, i]
        acc = np.where(line, acc + 1, 0)
        if axis == 0:
            out[i] = acc
        else:
            out[:, i] = acc
    return np.flip(out, axis) if reverse else out


def px(rect):
    x, y, w, h = rect
    return slice(round(y * T), round((y + h) * T)), slice(round(x * T), round((x + w) * T))


def build():
    image = np.zeros((ROWS * T, W * T, 4), np.uint8)
    textures = {}
    for y in range(INTERIOR_ROWS):
        for x in range(W):
            key = floor_of(x, y)
            if key not in textures:
                textures[key] = floor_texture(*key, INTERIOR_ROWS * T, W * T)
            image[y * T:(y + 1) * T, x * T:(x + 1) * T, :3] = textures[key][y * T:(y + 1) * T, x * T:(x + 1) * T]
            image[y * T:(y + 1) * T, x * T:(x + 1) * T, 3] = 255

    top = np.zeros((ROWS * T, W * T), bool)
    face = np.zeros_like(top)
    face_kind = np.zeros(top.shape, np.uint8)        # 1 內牆、2 北牆
    for wall in PLAN['walls']:
        x, y, w, h = wall['rect']
        if y >= INTERIOR_ROWS:
            continue
        h = min(h, INTERIOR_ROWS - y)
        if wall['dir'] == 'v':
            top[px((x, y, w, h))] = True
        else:
            top[px((x, y, w, 1))] = True
            face[px((x, y + 1, w, h - 1))] = True
            face_kind[px((x, y + 1, w, h - 1))] = 2 if y == 0 else 1
    for item in PLAN['wallFaces']:
        face[px(item['rect'])] = True
        face_kind[px(item['rect'])] = 1
    face &= ~top
    for door in PLAN['doors']:
        x, y, w, h = door['rect']
        if y >= INTERIOR_ROWS:
            continue
        hole = px((x, y + 1, w, h - 1) if door['lintel'] else (x, y, w, h))
        top[hole] = face[hole] = False

    rgb = image[:, :, :3]
    # 牆面：每一段依自己的高度把剖面拉長，橫向一致。
    rows = run_length(face, 0, False)           # 這一列在牆面裡是第幾列（從上往下）
    below = run_length(face, 0, True)
    for kind, profile in ((1, FACE_IN), (2, FACE_OUT)):
        sel = face & (face_kind == kind)
        heights = (rows + below - 1)[sel]
        for height in np.unique(heights):
            column = stretch(profile, int(height))
            pick = sel & (rows + below - 1 == height)
            rgb[pick] = column[rows[pick] - 1]
    side_l = run_length(face, 1, False)
    side_r = run_length(face, 1, True)
    for dist in range(len(FACE_SIDE)):
        rgb[face & (side_l == dist + 1)] = FACE_SIDE[dist]
        rgb[face & (side_r == dist + 1)] = FACE_SIDE[dist]

    # 牆頂：先鋪藍色材質，再依離邊緣的距離套剖面（上、左用亮邊；右用暗斜面；下緣是面向鏡頭的厚斜面）。
    ny, nx = NAVY.shape[:2]
    yy, xx = np.nonzero(top)
    rgb[yy, xx] = NAVY[yy % ny, xx % nx]
    d_up, d_down = run_length(top, 0, False), run_length(top, 0, True)
    d_left, d_right = run_length(top, 1, False), run_length(top, 1, True)
    for profile, dist in ((FRONT_EDGE, d_down), (RIGHT_EDGE, d_right),
                          (LEFT_EDGE, d_left), (TOP_EDGE, d_up)):
        for i, color in enumerate(profile):
            rgb[top & (dist == i + 1)] = color
    corridor(image)
    return Image.fromarray(image, 'RGBA')


def corridor_source():
    """一個柱間的完整走廊（996 高）：使用者清過的柱間＋corridor-a 同一段的欄杆與星空。"""
    ref = Image.open(RAW / 'medical_corridor_ref.jpg').convert('RGBA')
    full = Image.new('RGBA', (ref.width, CORRIDOR_H), (0, 0, 0, 255))
    src = HERE.parent.parent / 'public' / 'assets' / 'corridor-a'
    for name, y in (('space', 849), ('floor', 346), ('foreground', 746)):   # 照 manifest.json 的位置疊
        layer = Image.open(src / f'{name}.webp').convert('RGBA')
        full.alpha_composite(layer.crop((CORRIDOR_X, 0, CORRIDOR_X + ref.width, layer.height)), (0, y))
    full.paste(ref, (0, 0))
    return np.array(full.convert('RGB'))


def corridor(image):
    """南牆＋走廊（原尺寸）：柱間重複鋪滿寬度，讓一個柱間正對入口；入口切開牆面、鋪醫療室地磚接到走廊。"""
    src = corridor_source()
    sw = src.shape[1]
    door = next(d for d in PLAN['doors'] if d['rect'][1] == INTERIOR_ROWS)
    dx, _, dw, _ = door['rect']
    offset = round(sw / 2 - (dx + dw / 2) * T) % sw
    band = src[:, (np.arange(W * T) + offset) % sw]
    top = INTERIOR_ROWS * T
    rest = image.shape[0] - top - band.shape[0]
    if rest > 0:                                           # 補到整格，沿用最下面一列（星空）
        band = np.concatenate([band, np.repeat(band[-1:], rest, axis=0)])
    image[top:, :, :3] = band
    image[top:, :, 3] = 255
    # 入口：門框外寬的切口，以規劃的門中心為準；門楣以下的牆面換成醫療室地磚（門框裝上去會蓋住邊緣）。
    y0, y1 = top + ENTRANCE_LINTEL, top + CORRIDOR_WALL
    centre = round((dx + dw / 2) * T)
    x0, x1 = centre - ENTRANCE_W // 2, centre + ENTRANCE_W // 2
    image[y0:y1, x0:x1, :3] = floor_texture('cream', CREAM_ORIGIN, y1, x1)[y0:y1, x0:x1]
    for i, color in enumerate(FACE_SIDE):                  # 牆切開的兩側補深色邊
        image[y0:y1, x0 + i, :3] = color
        image[y0:y1, x1 - 1 - i, :3] = color


# ── 碰撞與牆的遮擋（數值照 問題修正紀錄.md「牆與遮擋」）─────────────────
FEET_UNDER_CAP = 58     # 從北邊走到橫牆後面，腳點最多走進牆頂線以下 58 px
COVER = 66              # 牆頂往下這麼高的一條畫在角色上面（58 + 角色圖多畫的 5 px，取跟工程區一樣的 66）
RADIUS = 22             # 腳圈半徑（src/game/facility.ts 的 RADIUS）
STOP = FEET_UNDER_CAP + RADIUS      # 碰撞從牆頂線以下 80 px 開始


def cell(x, y):
    return PLAN['layout'][y][x]


def edge_runs():
    """橫牆的北緣：牆格（含門楣）正上方是地板，左右連成至少兩格（直牆側門下方那一格牆端不算，角色不會走到它後面）。
    回傳 (列, 起欄, 止欄)。"""
    def edge(x, y):
        return y > 0 and cell(x, y) in 'WD' and cell(x, y - 1) not in 'WD' and \
            (cell(x, y) == 'W' or any(d['lintel'] and d['rect'][0] <= x < d['rect'][0] + d['rect'][2] and d['rect'][1] == y
                                      for d in PLAN['doors']))
    runs = []
    for y in range(1, INTERIOR_ROWS):
        x = 0
        while x < W:
            if not edge(x, y):
                x += 1
                continue
            x0 = x
            while x < W and edge(x, y):
                x += 1
            if x - x0 >= 2:
                runs.append((y, x0, x))
    return runs


def spans(cols):
    """連續的欄分成 [起, 止) 段。"""
    out = []
    for c in cols:
        if out and out[-1][1] == c:
            out[-1][1] = c + 1
        else:
            out.append([c, c + 1])
    return out


HEAD_PAD = 14   # 頭寬一半（36，頭寬 72）減腳圈半徑（22）
SHADOW_GAP = 3  # 物件碰撞比圖寬出的 px：影子半寬 23 − 腳圈 22，再留 2 px
SHOW_DEPTH = 92  # 物件碰撞上緣最低在圖上緣往下幾 px：角色高 140 − 露出頭肩 70 ＋ 腳圈 22


def collision(corridor_top, passage, frame_x, frame_top):
    """整格碰撞表＋精細矩形（格為單位）＋牆的遮擋片（px）。
    室內：牆、櫃台、病床佔的格擋住；門洞可走。橫牆北緣讓腳點走進牆頂線以下 58 px，牆頂往下 66 px 那條畫在角色上面。
    南牆（走廊牆）跟工程區一樣：牆頂後面可以走 58 px，其他擋住，只留門洞。"""
    r4 = lambda v: round(v, 4)
    grid = [[0] * W for _ in range(ROWS)]
    for y in range(INTERIOR_ROWS):
        for x in range(W):
            grid[y][x] = 1 if cell(x, y) in 'WBC' else 0
    rects, walls = [], []
    for y, x0, x1 in edge_runs():
        doors = [x for x in range(x0, x1) if cell(x, y) == 'D']
        solid = [x for x in range(x0, x1) if cell(x, y) == 'W']
        for x in solid:
            grid[y][x] = grid[y + 1][x] = 0
        for a, b in spans(solid):
            rects.append({'x': a, 'y': r4(y + STOP / T), 'w': b - a, 'h': r4(2 - STOP / T)})
        bottom = []
        for x in solid:                       # 這段牆往下連到哪一列（角色從南邊最多走到這裡）
            yy = y
            while cell(x, yy) == 'W':
                yy += 1
            bottom.append(yy)
        walls.append({
            'rects': [[a * T, y * T, (b - a) * T, COVER] for a, b in spans(solid)] +
                     [[a * T, y * T, (b - a) * T, T] for a, b in spans(doors)],   # 門洞上方只有門楣（牆頂）
            'bottom': min(bottom) * T, 'left': x0 * T, 'right': x1 * T,
        })
    # 直牆內側多擋一條：碰撞只算腳圈（半徑 22），角色頭寬 72，貼牆時頭會凸進牆裡 14 px（門洞兩側不擋，免得門變窄）
    for y in range(INTERIOR_ROWS):
        for x in range(1, W - 1):
            if grid[y][x] or cell(x, y) in 'WD':
                continue
            if cell(x + 1, y) == 'W':
                rects.append({'x': r4(x + 1 - HEAD_PAD / T), 'y': y, 'w': r4(HEAD_PAD / T), 'h': 1})
            if cell(x - 1, y) == 'W':
                rects.append({'x': x, 'y': y, 'w': r4(HEAD_PAD / T), 'h': 1})
    # 南牆：牆頂一列、往下 STOP 為止可走；門洞以外擋住到走廊
    top = INTERIOR_ROWS * T
    px0, px1 = passage['x'], passage['x'] + passage['w']
    for y in range(INTERIOR_ROWS, ROWS):
        for x in range(W):
            if y < INTERIOR_ROWS + 2:
                grid[y][x] = 1 if x in (0, W - 1) else 0
            elif y < corridor_top:
                grid[y][x] = 0 if int(px0) <= x < -(-px1 // 1) else 1
            else:
                grid[y][x] = 0 if y < CORRIDOR_BOTTOM else 1
    stop = r4(-(-(top + STOP) * 10000 // T) / 10000)       # 無條件進位，不會差零點幾 px 就擋住
    rects += [{'x': 0, 'y': stop, 'w': r4(px0), 'h': r4(corridor_top - stop)},
              {'x': r4(px1), 'y': stop, 'w': r4(W - px1), 'h': r4(corridor_top - stop)}]
    walls.append({   # 門框那一段只蓋門框上方的牆；門框本身在角色走進門洞時另外畫在上面
        'rects': [[0, top, frame_x, COVER], [frame_x, top, DOOR['frame'][0], frame_top],
                  [frame_x + DOOR['frame'][0], top, W * T - frame_x - DOOR['frame'][0], COVER]],
        'bottom': corridor_top * T,
    })
    return grid, rects, walls


# ── 重畫版：四塊縮回原尺寸，沿切線接起來 ───────────────────────────────
REPAINT = {'nw': (0, 0, 864, 1296), 'ne': (816, 0, 1680, 1296), 'sw': (0, 1008, 864, 2304), 'se': (816, 1008, 1680, 2304)}
CUT_X, CUT_Y = 840, 1152      # 主通道中線（大門中心）、診間南牆那條地板接縫；兩塊重疊的地方只在切線兩側小範圍漸變
BLEND_X, BLEND_Y = 24, 16


def repainted(ground):
    paths = {k: RAW / f'repaint_{k}.png' for k in REPAINT}
    if not all(p.exists() for p in paths.values()):
        return ground
    acc = np.zeros((INTERIOR_ROWS * T, W * T, 3))
    weight = np.zeros((INTERIOR_ROWS * T, W * T, 1))
    for k, (x0, y0, x1, y1) in REPAINT.items():
        im = np.array(Image.open(paths[k]).convert('RGB').resize((x1 - x0, y1 - y0), Image.LANCZOS)).astype(float)
        xs, ys = np.arange(x0, x1), np.arange(y0, y1)
        wx = np.clip((xs - CUT_X + BLEND_X) / (2 * BLEND_X), 0, 1) if x0 else np.clip((CUT_X + BLEND_X - xs) / (2 * BLEND_X), 0, 1)
        wy = np.clip((ys - CUT_Y + BLEND_Y) / (2 * BLEND_Y), 0, 1) if y0 else np.clip((CUT_Y + BLEND_Y - ys) / (2 * BLEND_Y), 0, 1)
        m = (wy[:, None] * wx[None, :])[:, :, None] + 1e-6
        acc[y0:y1, x0:x1] += im * m
        weight[y0:y1, x0:x1] += m
    out = np.array(ground)
    out[:INTERIOR_ROWS * T, :, :3] = (acc / weight).round().astype(np.uint8)
    print('底圖用重畫版（raw/repaint_*.png）')
    return Image.fromarray(out, 'RGBA')


ART = HERE / 'medical' / 'ground.webp'


def hand_edited(ground):
    if not ART.exists():
        return ground
    art = Image.open(ART).convert('RGBA')
    if art.size != ground.size:
        raise SystemExit(f'{ART.name} 是 {art.size[0]} × {art.size[1]}，要跟地圖一樣 {ground.size[0]} × {ground.size[1]}（從 public/assets/medical/ground.webp 開始改，不要裁切或縮放）')
    print('底圖用手修版（tools/art/medical/ground.webp）')
    return art


def install(ground):
    """放進遊戲：ground.webp、走廊欄杆前景、map.json（碰撞、牆的遮擋、大門）。"""
    out = HERE.parent.parent / 'public' / 'assets' / 'medical'
    out.mkdir(parents=True, exist_ok=True)
    ground.convert('RGB').save(out / 'ground.webp', lossless=True)
    # 走廊欄杆：corridor-a 的前景同一段，照底圖的柱間位置重複鋪
    door = next(d for d in PLAN['doors'] if d['rect'][1] == INTERIOR_ROWS)
    dx, _, dw, _ = door['rect']
    sw = Image.open(RAW / 'medical_corridor_ref.jpg').width
    offset = round(sw / 2 - (dx + dw / 2) * T) % sw
    fg = np.array(Image.open(HERE.parent.parent / 'public' / 'assets' / 'corridor-a' / 'foreground.webp')
                  .convert('RGBA').crop((CORRIDOR_X, 0, CORRIDOR_X + sw, 103)))
    Image.fromarray(fg[:, (np.arange(W * T) + offset) % sw]).save(out / 'foreground.webp', lossless=True)
    top = INTERIOR_ROWS * T
    mid = (CORRIDOR_TOP + CORRIDOR_BOTTOM) / 2
    cx = round((dx + dw / 2) * T)
    fx = cx - DOOR['frame'][0] // 2
    ox0, oy0, ox1, oy1 = DOOR['open']
    frame = out / 'door_frame.webp'
    if not frame.exists():
        raise SystemExit('先跑 python tools/art/cut.py door medical 切出大門')
    alpha = np.array(Image.open(frame).convert('RGBA'))[:, :, 3]
    frame_top = int(np.nonzero(alpha.max(1))[0][0])          # 門框圖上方透明的那幾列
    passage = {'x': round((fx + ox0) / T, 4), 'y': INTERIOR_ROWS, 'w': round((ox1 - ox0) / T, 4), 'h': CORRIDOR_TOP - INTERIOR_ROWS}
    grid, rects, walls = collision(CORRIDOR_TOP, passage, fx, frame_top)
    # 物件（tools/art/medical_objects.py 的 PLACE）：圖切好了（props/<圖名>.webp 存在）才擺
    import medical_objects as objects
    decor = []
    for y in range(INTERIOR_ROWS):                       # 櫃台、病床照圖擺：規劃的佔位格不再整格擋，改用 PLACE 的碰撞
        for x in range(W):
            if cell(x, y) in getattr(objects, 'PLAN_FROM_ART', ()):
                grid[y][x] = 0
    for name, (src, box, mode) in getattr(objects, 'LAYERS', {}).items():   # 一張圖拆成幾層
        if not (out / 'props' / f'{src}.webp').exists():
            continue
        im = Image.open(out / 'props' / f'{src}.webp').convert('RGBA')
        part = Image.new('RGBA', im.size, (0, 0, 0, 0))
        if mode == 'clear':
            part = im.copy()
            part.paste((0, 0, 0, 0), box)
        else:
            part.paste(im.crop(box), box[:2])
        (part.crop(box) if mode == 'crop' else part).save(out / 'props' / f'{name}.webp', lossless=True)
    for oid, sprite, cx, bottom, block, *extra in getattr(objects, 'PLACE', []):
        if sprite is None:                               # 只有碰撞
            bx, by, bw, bh = block
            rects.append({'x': bx, 'y': by, 'w': bw, 'h': bh})
            continue
        if not (out / 'props' / f'{sprite}.webp').exists():
            continue
        decor.append({'sprite': sprite, 'id': oid, 'x': round(cx / T, 4), 'y': round(bottom / T, 4), 'scale': objects.SCALE,
                      'block': bool(block), 'size': list(Image.open(out / 'props' / f'{sprite}.webp').size), **(extra[0] if extra else {})})
        if block:
            bx, by, bw, bh = block
            # 上緣：角色站到物件後面最深處，頭和肩（頭頂往下 70 px）還要露在圖上緣之上，所以碰撞上緣最低在圖上緣往下 SHOW_DEPTH
            alpha = np.array(Image.open(out / 'props' / f'{sprite}.webp').convert('RGBA'))[:, :, 3]
            h, w = alpha.shape
            art_top, art_left = bottom - h * objects.SCALE, cx - w * objects.SCALE / 2
            opaque_top = art_top + np.nonzero(alpha.max(1) > 40)[0][0] * objects.SCALE
            if (opaque_top + SHOW_DEPTH) / T < by:
                bh, by = round(by + bh - (opaque_top + SHOW_DEPTH) / T, 4), round((opaque_top + SHOW_DEPTH) / T, 4)
            # 左右至少蓋到圖在這幾列的實際寬度外 3 px：影子（半寬 23）比腳圈（22）寬 1 px，貼著物件時影子才不會壓到圖
            rows = alpha[max(0, int((by * T - art_top) / objects.SCALE)):min(h, int(((by + bh) * T - art_top) / objects.SCALE))]
            cols = np.nonzero(rows.max(0) > 40)[0] if rows.size else []
            if len(cols):
                x0 = min(bx, (art_left + cols[0] * objects.SCALE - SHADOW_GAP) / T)
                x1 = max(bx + bw, (art_left + (cols[-1] + 1) * objects.SCALE + SHADOW_GAP) / T)
                bx, bw = round(x0, 4), round(x1 - x0, 4)
            rects.append({'x': bx, 'y': by, 'w': bw, 'h': bh})
    data = {
        'tileSize': T, 'width': W, 'height': ROWS,
        'legend': {'0': '可行走', '1': '碰撞'},
        'note': '由 tools/art/medical_base_v9.py 產生，不要手改。室內第 0–47 列（v9 格局），第 48 列起是居住區走廊（左通 B、右通 C）。'
                '櫃台、病床的碰撞照圖給（medical_objects.py 的 PLACE）。walls 是牆頂那一條，依 bottom 跟角色排前後；大門是靠近自動開的玻璃門。',
        'collision': grid,
        'collisionRects': rects,
        'walls': walls,
        'decor': decor,
        'interactions': getattr(objects, 'INTERACTIONS', []),
        'entrances': [
            {'x': 0, 'y': CORRIDOR_TOP, 'w': 1, 'h': CORRIDOR_BOTTOM - CORRIDOR_TOP, 'to': 'residential_b', 'label': '往居住區 B', 'spawn': [4, mid]},
            {'x': W - 1, 'y': CORRIDOR_TOP, 'w': 1, 'h': CORRIDOR_BOTTOM - CORRIDOR_TOP, 'to': 'residential_c', 'label': '往居住區 C', 'spawn': [W - 4, mid]},
        ],
        'door': {
            'id': 'medical-door', 'label': '醫療室大門', 'auto': True,
            'passage': passage,
            'closedFrom': top + STOP,
            'opening': [fx + ox0, top + oy0, ox1 - ox0, oy1 - oy0],
            'frame': {'src': 'door_frame.webp', 'x': fx, 'y': top},
            'panels': {'left': 'door_left.webp', 'right': 'door_right.webp'},
            'lamp': [fx + DOOR['light'][0], top + DOOR['light'][1]],
            'trigger': 120, 'openSeconds': .6,
        },
        'foreground': [{'src': 'foreground.webp', 'x': 0, 'y': top + 746}],
    }
    (out / 'map.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print('已放進 public/assets/medical：ground.webp、foreground.webp、map.json', W, 'x', ROWS)

if __name__ == '__main__':
    out = HERE / 'medical' / 'base_v9.png'
    if WALL_REF.exists():
        ground = build()
        ground.save(out)
        print('已產生', out.relative_to(HERE.parent.parent))
        install(hand_edited(repainted(ground)))
    elif ART.exists():
        print('沒有牆的參考圖：不重拼底圖，直接用手修版（tools/art/medical/ground.webp）')
        install(Image.open(ART).convert('RGBA'))
    else:
        raise SystemExit('找不到 raw/medical_walls_ref.jpg，也沒有手修底圖 tools/art/medical/ground.webp')
