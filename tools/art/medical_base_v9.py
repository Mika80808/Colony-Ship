"""醫療室 v9 底圖：從使用者給的素材圖切地磚與牆，照 medical_plan_v9.json 拼成一格 48 px 的底圖。

用法：python tools/art/medical_base_v9.py（先跑 medical_plan_v9.py 產生 json）
來源（tools/art/medical/raw/）：
  medical_floor_tiles.png  四色地磚表，每色 4 × 4 塊：左上綠、右上淺藍、左下藍灰、右下米白
  medical_walls_ref.jpg    牆的參考圖：海軍藍牆頂（深色描邊＋亮邊＋底部斜面）、白色牆面＋踢腳板
  medical_corridor_ref.jpg 居住區走廊一個柱間（corridor-a x=1274 起，門與燈已清掉），寬 517 可左右重複；
                           只到地板底（754 px），下面的欄杆與窗外星空從 public/assets/corridor-a 同一段補上
輸出 tools/art/medical/base_v9.png：室內 48 列＋走廊原尺寸 996 px，補到整格（69 列，1680 × 3312）。
走廊不縮放：角色在每個場景都是 148 世界單位高，走廊要跟居住區走廊一樣大；室內一格 48 所以房間相對角色比較小。
程式只做切割、縮放、拼接：地磚切中間四塊（縫中線到縫中線，可無縫重複），牆頂與牆面取參考圖的剖面像素照牆線鋪。
"""
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image

import medical_door

HERE = Path(__file__).resolve().parent
RAW = HERE / 'medical' / 'raw'
PLAN = json.loads((HERE / 'medical' / 'medical_plan_v9.json').read_text(encoding='utf-8'))
T = PLAN['tileSize']
W, H = PLAN['width'], PLAN['height']
INTERIOR_ROWS = 48            # 南牆（第 48 列）以下是走廊
CORRIDOR_X, CORRIDOR_H = 1274, 996       # 柱間在 corridor-a 的位置；走廊素材總高
CORRIDOR_WALL = 345                      # 走廊素材：牆面到 y 345 為止
ENTRANCE_W, ENTRANCE_LINTEL = medical_door.FW, 66   # 牆上切口＝門框外寬（6 格），門框的門楣、門柱蓋住切口邊緣
ROWS = -(-(INTERIOR_ROWS * T + CORRIDOR_H) // T)                 # 整張地圖的列數

# ── 地磚：每色取中間四塊，縮成一格一塊 ──────────────────────────────
SHEET = Image.open(RAW / 'medical_floor_tiles.png').convert('RGB')
SWATCH = {'green': (41, 41), 'ward': (335, 41), 'research': (41, 335), 'cream': (335, 335)}
GROUT = (63.5, 125.5, 187.5)  # 色塊內三條縫的中線（相對色塊左上角）


def tiles(name):
    ox, oy = SWATCH[name]
    out = []
    for gy in range(2):
        for gx in range(2):
            box = (round(ox + GROUT[gx]), round(oy + GROUT[gy]),
                   round(ox + GROUT[gx + 1]), round(oy + GROUT[gy + 1]))
            out.append(np.array(SHEET.crop(box).resize((T, T), Image.LANCZOS)))
    return out


FLOORS = {name: tiles(name) for name in SWATCH}
REGION_FLOOR = {'surgery': 'green', 'clinic': 'green', 'ward': 'ward',
                'med-research': 'research', 'drug-research': 'research'}


def floor_of(x, y):
    for region in PLAN['regions']:
        rx, ry, rw, rh = region['rect']
        if rx <= x < rx + rw and ry <= y < ry + rh:
            return REGION_FLOOR.get(region['id'], 'cream')
    if x == 11 and 9 <= y < 11:          # 手術室側門開口接病區
        return 'ward'
    if 5 <= x < 7 and 14 <= y < 17:      # 診間北門（手術室與診間之間）
        return 'green'
    return 'cream'


# ── 牆：從參考圖取剖面 ─────────────────────────────────────────────
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
    rng = random.Random(9)
    for y in range(INTERIOR_ROWS):
        for x in range(W):
            image[y * T:(y + 1) * T, x * T:(x + 1) * T, :3] = rng.choice(FLOORS[floor_of(x, y)])
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
    tile = FLOORS['cream'][0]
    yy, xx = np.mgrid[y0:y1, x0:x1]
    image[y0:y1, x0:x1, :3] = tile[yy % T, xx % T]
    for i, color in enumerate(FACE_SIDE):                  # 牆切開的兩側補深色邊
        image[y0:y1, x0 + i, :3] = color
        image[y0:y1, x1 - 1 - i, :3] = color


def install(ground):
    """放進遊戲看尺寸：ground.webp、走廊欄杆前景、最小的 map.json（碰撞先全部可走）。"""
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
    corridor_top, corridor_bottom = (top + 397) // T, (top + 775) // T   # 走廊可走帶：素材 y 397–775
    mid = (corridor_top + corridor_bottom) / 2
    data = {
        'tileSize': T, 'width': W, 'height': ROWS,
        'note': '暫時版（2026-10-15）：只為了在遊戲裡看尺寸，碰撞全部可走。由 tools/art/medical_base_v9.py 產生，不要手改。',
        'collision': [[0] * W for _ in range(ROWS)],
        'entrances': [
            {'x': 0, 'y': corridor_top, 'w': 1, 'h': corridor_bottom - corridor_top, 'to': 'residential_b', 'label': '往居住區 B', 'spawn': [4, mid]},
            {'x': W - 1, 'y': corridor_top, 'w': 1, 'h': corridor_bottom - corridor_top, 'to': 'residential_c', 'label': '往居住區 C', 'spawn': [W - 4, mid]},
        ],
        'foreground': [{'src': 'foreground.webp', 'x': 0, 'y': top + 746}],
    }
    if (out / 'door_frame.webp').exists():
        cx = round((dx + dw / 2) * T)
        fx = cx - medical_door.FW // 2
        ox0, oy0, ox1, oy1 = medical_door.OPEN
        data['door'] = {
            'id': 'medical-door', 'label': '醫療室大門',
            'passage': {'x': (fx + ox0) / T, 'y': INTERIOR_ROWS, 'w': (ox1 - ox0) / T, 'h': corridor_top - INTERIOR_ROWS},
            'closedFrom': top + 58 + 22,
            'opening': [fx + ox0, top + oy0, ox1 - ox0, oy1 - oy0],
            'frame': {'src': 'door_frame.webp', 'x': fx, 'y': top},
            'panels': {'left': 'door_left.webp', 'right': 'door_right.webp'},
            'lamp': [fx + medical_door.LIGHT[0], top + medical_door.LIGHT[1]],
            'trigger': 150, 'openSeconds': 1.0,
        }
    (out / 'map.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print('已放進 public/assets/medical：ground.webp、foreground.webp、map.json', W, 'x', ROWS)

if __name__ == '__main__':
    out = HERE / 'medical' / 'base_v9.png'
    ground = build()
    ground.save(out)
    install(ground)
    print('已產生', out.relative_to(HERE.parent.parent))
