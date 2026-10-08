"""醫療室場景：產生地面圖、隔間牆、自動滑門、走廊前景與 map.json。目前只有結構（牆、地板、門），家具與機台之後再擺。

用法：uv run --with pillow --with numpy python tools/art/medical_build.py
配置讀 tools/art/medical/medical_plan.json（medical_plan.py 產生）；規劃圖的第 0 列外牆在這裡畫成 3 格高的北牆立面，
所以規劃圖的列號 +2 才是地圖列號（NORTH_SHIFT）。
輸出到 public/assets/medical/：
  ground.webp      地面（L0）：室內地板、北牆立面、左右牆、下方走廊
  props/wall_*.webp  室內的牆（規劃圖的 WALLS）：當 decor 依底邊跟角色排前後
牆一律「牆頂畫在線上、牆面往下垂」：一般內牆跟走廊牆一樣高（346 px，牆面直接用走廊牆的素材），
病房之間是薄牆（110 px）；直牆從上面只看得到牆頂，下端沒接牆的地方露出往下垂的牆面。
  door_frame.webp / door_left.webp / door_right.webp  自動滑門
  wall_cap.webp、foreground.webp  走廊牆頂與外側欄杆，蓋在角色上面
  map.json         碰撞（含薄牆 collisionRects）、出入口、門、隔間牆 decor
另存 tools/art/medical/base_full.png（全部疊起來的底圖，給擺設參考圖用）與 base_preview.png（縮半）。

風格：2090 年高科技太空站醫療區，白色複合板＋霧面石墨、圓角、嵌入燈條（薄荷青），明亮乾淨；休息區暖色木地板。
下方走廊沿用居住區 A 走廊素材，作法同 engineering_build.py。
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from engineering_build import delight, noise, shade, rgb   # 共用：洗燈光、雜訊、明暗

ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'public/assets/corridor-a')
OUT = os.path.join(ROOT, 'public/assets/medical')
PLAN = json.load(open(os.path.join(HERE, 'medical/medical_plan.json'), encoding='utf-8'))
T = 96
NORTH_SHIFT = 2                       # 規劃圖第 0 列 → 地圖第 0–2 列北牆立面
WALL_ROWS = 3
W = PLAN['width']                     # 24
ROOM_H = PLAN['door']['y'] + NORTH_SHIFT   # 室內到第 21 列，第 22 列起是走廊牆面
O = ROOM_H * T
CORRIDOR_H = 996
H = math.ceil((O + CORRIDOR_H) / T)
CROP_X = 383                          # 走廊素材切哪一段：門 3（中心 1535）落在大門中心 1152
RNG = np.random.default_rng(11)

NORMAL_H = PLAN['wallHeights']['normal']   # 一般內牆＝走廊牆高 346 px
THIN_H = PLAN['wallHeights']['thin']       # 病房隔牆 110 px
TH_N, TH_T = 16, 7                    # 直牆半厚（px）：一般內牆、薄牆

# 規劃圖座標（欄, 列）的區塊，列號未加 NORTH_SHIFT
LOUNGE = (9, 1, 7, 6)                 # 居家休息區：暖色木地板
RESEARCH = [(1, 1, 7, 6), (17, 1, 7, 6)]
WINDOW = (10, 4)                      # 休息區北牆舷窗

# 門：門洞 4 格寬（第 10–13 欄），推床進得來
OPEN_X, OPEN_W = PLAN['door']['x'] * T, PLAN['door']['w'] * T
DOOR_ZONE = (OPEN_X - 70, OPEN_X + OPEN_W + 70)
WALL_BASE = O + 346
OPEN_TOP = O + 66
OPEN_H = WALL_BASE - OPEN_TOP
CAP_H = OPEN_TOP - O
FEET_UNDER_CAP = 58

WHITE, WHITE_HI, WHITE_LO = rgb('#e9eef1'), rgb('#f7fafb'), rgb('#c9d2d8')
GRAPHITE, GRAPHITE_HI, GRAPHITE_LO = rgb('#3a4249'), rgb('#5d666e'), rgb('#22282d')
MINT = rgb('#4dd0e1')

def py(r): return round((r + NORTH_SHIFT) * T)   # 規劃圖列號（可帶小數）→ 地圖 px

# ---------- 地板 ----------
def tile_floor(w, h, base, seam, seed):
    """白色防滑地磚：一格一片，色調微微不同，細接縫，表面細顆粒。"""
    img = Image.new('RGBA', (w, h), base + (255,))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(seed)
    for y in range(0, h, T):
        for x in range(0, w, T):
            t = int(r.integers(-3, 4))
            d.rectangle([x, y, x + T - 1, y + T - 1], fill=tuple(c + t for c in base) + (255,))
            d.line([x, y, x + T - 1, y], fill=tuple(min(255, c + 8) for c in base) + (255,), width=1)
            d.line([x, y, x, y + T - 1], fill=tuple(min(255, c + 8) for c in base) + (255,), width=1)
            d.line([x, y + T - 1, x + T - 1, y + T - 1], fill=seam + (255,), width=2)
            d.line([x + T - 1, y, x + T - 1, y + T - 1], fill=seam + (255,), width=2)
    grain = (noise(w, h, 2, seed + 1) - .5) * .04 + (noise(w, h, 60, seed + 2) - .5) * .015
    return shade(img, grain)

def wood_floor(w, h, seed):
    """休息區的木地板：橫向長條木板，接縫錯開。"""
    img = Image.new('RGBA', (w, h), rgb('#b98a5e') + (255,))
    d = ImageDraw.Draw(img)
    r = np.random.default_rng(seed)
    ph = 24
    for i, y in enumerate(range(0, h, ph)):
        x = -int(r.integers(0, 160))
        while x < w:
            ln = int(r.integers(150, 260))
            t = int(r.integers(-14, 12))
            col = tuple(int(c + t) for c in rgb('#c29467'))
            d.rectangle([x, y, x + ln - 2, y + ph - 2], fill=col + (255,))
            d.line([x, y, x + ln - 2, y], fill=tuple(min(255, c + 18) for c in col) + (255,))
            d.line([x + ln - 2, y, x + ln - 2, y + ph - 2], fill=rgb('#7d5634') + (255,), width=2)
            x += ln
        d.line([0, y + ph - 1, w, y + ph - 1], fill=rgb('#7d5634') + (255,), width=2)
    grain = noise(w, h, 3, seed + 3)
    streak = np.asarray(Image.fromarray((grain * 255).astype(np.uint8)).resize((w // 12 + 1, h)).resize((w, h)), np.float32) / 255
    return shade(img, (streak - .5) * .16)

def build_room():
    w, h = W * T, O
    room = Image.new('RGBA', (w, h))
    room.alpha_composite(tile_floor(w, h, rgb('#e4eaec'), rgb('#c3ccd1'), 5))
    for cx, cy, cw, ch in RESEARCH:      # 研究室：偏冷的淺灰藍地磚
        room.alpha_composite(tile_floor(cw * T, ch * T, rgb('#d9e2e7'), rgb('#b6c2c9'), 6 + cx), (cx * T, py(cy)))
    lx, ly, lw, lh = LOUNGE
    room.alpha_composite(wood_floor(lw * T, lh * T, 9), (lx * T, py(ly)))
    d = ImageDraw.Draw(room)
    # 天花板燈的柔光（暖白），光從左上
    light = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    for gx, gy in ((4, 4), (12.5, 4), (20, 4), (4.5, 13), (12, 13), (19, 13), (3.5, 24), (8, 24), (12, 21), (19, 21), (19, 28), (12, 28)):
        light += np.exp(-(((xx - gx * T) / 260) ** 2 + ((yy - py(gy)) / 200) ** 2)) * .06
    room = shade(room, light - .03)
    # 北牆往下、左牆往右的陰影
    sh = np.zeros((h, w), np.float32)
    top = WALL_ROWS * T
    sh[top:top + 50] -= np.linspace(.22, 0, 50)[:, None]
    sh[:, T:T + 36] -= np.linspace(.18, 0, 36)[None, :]
    return shade(room, sh)

# ---------- 北牆立面與側牆 ----------
def north_wall():
    """北牆立面（三格高）：白色複合板、薄荷燈條、石墨牆腳；研究室兩段是淺色牆面（資料投影在上面，不另外畫），休息區是暖色牆板加舷窗。"""
    w, h = W * T, WALL_ROWS * T
    img = Image.new('RGBA', (w, h), WHITE + (255,))
    d = ImageDraw.Draw(img)
    lx, _, lw, _ = LOUNGE
    d.rectangle([lx * T, 0, (lx + lw) * T, h], fill=rgb('#e6d9c6'))                  # 休息區暖色牆板
    for x in range(0, w, 192):                                                       # 板材接縫
        d.line([x, 30, x, h - 30], fill=WHITE_LO, width=2); d.line([x + 2, 30, x + 2, h - 30], fill=WHITE_HI, width=1)
    d.line([0, 150, w, 150], fill=WHITE_LO, width=1)
    d.rectangle([0, 0, w, 24], fill=GRAPHITE); d.line([0, 24, w, 24], fill=GRAPHITE_HI, width=2)   # 牆頂
    d.rounded_rectangle([0, 40, w, 48], 4, fill=MINT)                                 # 上緣燈條
    d.line([0, 41, w, 41], fill=rgb('#c9f6fb'), width=2)
    d.rectangle([0, h - 30, w, h], fill=GRAPHITE); d.line([0, h - 30, w, h - 30], fill=GRAPHITE_HI, width=2)  # 牆腳
    d.line([0, h - 36, w, h - 36], fill=MINT, width=3)
    wx0, ww = WINDOW                                                                  # 舷窗：圓角長窗看出去是星空
    x0, x1 = wx0 * T + 18, (wx0 + ww) * T - 18
    space = Image.open(os.path.join(SRC, 'space.webp')).convert('RGBA')
    sky = space.crop((900, 0, 900 + (x1 - x0), space.height)).resize((x1 - x0, h - 130))
    mask = Image.new('L', sky.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, sky.width - 1, sky.height - 1], 28, fill=255)
    d.rounded_rectangle([x0 - 12, 62, x1 + 12, h - 46], 36, fill=rgb('#f4f6f7'), outline=WHITE_LO, width=3)
    img.paste(sky, (x0, 74), mask)
    d.rounded_rectangle([x0, 74, x1 - 1, 74 + sky.height - 1], 28, outline=GRAPHITE_LO, width=3)
    d.line([x0 + 30, 90, x0 + 90, 90], fill=(255, 255, 255, 120), width=3)            # 玻璃反光
    img = shade(img, (noise(w, h, 40, 9) - .5) * .06 + np.linspace(.04, -.04, w)[None, :])
    return img

def side_wall(h):
    """左右外牆的牆頂（俯視）：石墨外框、白色頂面、一條燈條。"""
    img = Image.new('RGBA', (T, h), GRAPHITE + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle([12, 0, T - 13, h], fill=rgb('#d5dde2'))
    d.line([12, 0, 12, h], fill=WHITE_HI, width=3)
    d.line([T - 13, 0, T - 13, h], fill=GRAPHITE_LO, width=3)
    d.line([T // 2, 0, T // 2, h], fill=MINT, width=2)
    return img

# ---------- 室內的牆 ----------
_PANEL = None
def panel_strip(width):
    """走廊牆的素面牆板（洗掉門燈）橫向拼到 width 寬，切到牆腳 346 px：上面一條深色牆頂、牆板、深色牆腳。"""
    global _PANEL
    if _PANEL is None:
        wall = Image.open(os.path.join(SRC, 'wall.webp')).convert('RGBA')
        _PANEL = delight(wall.crop((282, 0, 412, NORMAL_H)), 30)
    out = Image.new('RGBA', (width, NORMAL_H))
    x = 0
    while x < width:
        piece = _PANEL.crop((0, 0, min(_PANEL.width, width - x), NORMAL_H)); out.alpha_composite(piece, (x, 0)); x += piece.width
    return out

def jambs(img):
    """牆段兩端（門洞、轉角）加深色收邊，看起來是有厚度的牆。"""
    d = ImageDraw.Draw(img)
    w, h = img.size
    d.rectangle([0, 0, 7, h - 1], fill=rgb('#39434c')); d.line([1, 0, 1, h - 1], fill=rgb('#6b7782'), width=2)
    d.rectangle([w - 8, 0, w - 1, h - 1], fill=rgb('#2a323a'))
    return img

def cap_strip(w, h):
    """直牆從上面看到的牆頂：跟走廊牆頂同色的深色長條，左邊受光。"""
    img = Image.new('RGBA', (w, h), rgb('#3a434c') + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w - 1, h - 1], outline=rgb('#1f262d'), width=2)
    d.line([3, 2, 3, h - 3], fill=rgb('#6b7782'), width=2)
    return img

def thin_face(w):
    """薄牆往下垂的牆面（110 px）：白色牆板、深色牆腳。"""
    img = Image.new('RGBA', (w, THIN_H), WHITE + (255,))
    d = ImageDraw.Draw(img)
    img = shade(img, np.linspace(.03, -.06, THIN_H)[:, None] * np.ones((1, w)))
    d = ImageDraw.Draw(img)
    d.rectangle([0, THIN_H - 12, w - 1, THIN_H - 1], fill=GRAPHITE)
    d.rectangle([0, 0, w - 1, THIN_H - 1], outline=GRAPHITE_LO, width=2)
    return img

def build_walls():
    """規劃圖的 WALLS → [(圖名, 圖, 中心 x px, 底邊 y px, 碰撞矩形 px)]。底邊是牆面的牆腳，拿來跟角色排前後。"""
    out = []
    for i, wall in enumerate(PLAN['walls']):
        if wall['dir'] == 'h':
            x0, x1, top = wall['x0'] * T, wall['x1'] * T, py(wall['y'])
            img = jambs(panel_strip(x1 - x0))
            rect = (x0, top + FEET_UNDER_CAP + 22, x1, top + NORMAL_H)       # 牆後可以站進牆頂底下 58 px
            out.append((f"wall_{i:02d}", img, (x0 + x1) / 2, top + NORMAL_H, rect))
            continue
        normal = wall['kind'] == 'normal'
        th, fh = (TH_N, NORMAL_H) if normal else (TH_T, THIN_H)
        x, y0, y1 = wall['x'] * T, py(wall['y0']), py(wall['y1'])
        bottom = y1 + (fh if wall['face'] else 0)
        img = Image.new('RGBA', (2 * th, bottom - y0))
        if y1 > y0: img.alpha_composite(cap_strip(2 * th, y1 - y0), (0, 0))
        if wall['face']:
            face = jambs(panel_strip(2 * th)) if normal else thin_face(2 * th)
            img.alpha_composite(face, (0, y1 - y0))
        rect = (x - th, y0, x + th, bottom)
        out.append((f"wall_{i:02d}", img, x, bottom, rect))
    return out

# ---------- 走廊（沿用居住區 A 走廊素材） ----------
def corridor_wall():
    wall = Image.open(os.path.join(SRC, 'wall.webp')).convert('RGBA')
    plain = delight(wall.crop((282, 0, 412, wall.height)), 30)
    pillar = wall.crop((186, 0, 282, wall.height))
    out = Image.new('RGBA', (W * T, wall.height))
    def fill(x0, x1):
        x = x0
        while x < x1:
            piece = plain.crop((0, 0, min(plain.width, x1 - x), plain.height)); out.alpha_composite(piece, (x, 0)); x += piece.width
    def side(length):
        inner = length - 150 - 96 - 96
        return [('plain', 150), ('pillar', 96), ('plain', inner // 2), ('pillar', 96), ('plain', inner - inner // 2)]
    left, right = side(DOOR_ZONE[0]), side(W * T - DOOR_ZONE[1])[::-1]
    layout = left + [('plain', DOOR_ZONE[1] - DOOR_ZONE[0])] + right
    x = 0
    for kind, width in layout:
        if kind == 'plain': fill(x, x + width)
        else: out.alpha_composite(pillar, (x, 0))
        x += width
    assert x == W * T, x
    return out

def door_art():
    """白色自動滑門：圓角厚框、兩側薄荷燈條、門楣綠十字燈；門扇白色、上半霧面玻璃。門洞 OPEN_W × OPEN_H。"""
    fx0, fx1 = DOOR_ZONE
    fw, fh = fx1 - fx0, WALL_BASE - O + 6
    frame = Image.new('RGBA', (fw, fh))
    d = ImageDraw.Draw(frame)
    ox, top = OPEN_X - fx0, OPEN_TOP - O
    d.rounded_rectangle([6, top - 50, fw - 7, fh + 20], 22, fill=GRAPHITE)
    d.rounded_rectangle([12, top - 44, fw - 13, fh + 20], 18, fill=rgb('#f1f4f6'))
    d.line([30, top - 42, fw - 30, top - 42], fill=WHITE_HI, width=3)
    for px in (ox - 46, ox + OPEN_W + 8):                                       # 門柱燈條
        d.rounded_rectangle([px + 14, top + 10, px + 24, fh - 16], 5, fill=MINT)
        d.line([px + 16, top + 14, px + 16, fh - 20], fill=rgb('#c9f6fb'), width=2)
    d.rectangle([ox - 6, top - 6, ox + OPEN_W + 5, fh - 1], fill=GRAPHITE_LO)  # 門洞內側
    frame.paste((0, 0, 0, 0), (ox, top, ox + OPEN_W, fh))
    lx = fw // 2                                                                # 門楣綠十字燈
    d.rounded_rectangle([lx - 26, top - 44, lx + 26, top - 8], 8, fill=GRAPHITE, outline=GRAPHITE_LO, width=2)
    d.rectangle([lx - 5, top - 38, lx + 5, top - 14], fill=rgb('#3ddc84'))
    d.rectangle([lx - 14, top - 31, lx + 14, top - 21], fill=rgb('#3ddc84'))
    def panel(left):
        pw = OPEN_W // 2
        p = Image.new('RGBA', (pw, OPEN_H), WHITE + (255,))
        pd = ImageDraw.Draw(p)
        gx0, gx1 = (20, pw - 30) if left else (30, pw - 20)
        pd.rounded_rectangle([gx0, 30, gx1, OPEN_H * .58], 10, fill=rgb('#cfe7ec'), outline=WHITE_LO, width=3)   # 霧面玻璃
        pd.line([gx0 + 14, 46, gx0 + 60, 46], fill=(255, 255, 255, 200), width=3)
        inner = pw - 10 if left else 4
        pd.rectangle([inner, 0, inner + 5, OPEN_H], fill=MINT)                 # 門縫燈條
        pd.rectangle([0, OPEN_H - 18, pw, OPEN_H], fill=GRAPHITE)
        pd.line([0, 0, pw, 0], fill=WHITE_HI, width=2)
        pd.line([0 if left else pw - 1, 0, 0 if left else pw - 1, OPEN_H], fill=WHITE_LO, width=2)
        return shade(p, np.linspace(.03, -.08, OPEN_H)[:, None] * np.ones((1, pw)))
    return frame, panel(True), panel(False)

def doorway_floor():
    img = tile_floor(OPEN_W, OPEN_H, rgb('#e4eaec'), rgb('#c3ccd2'), 21)
    img = shade(img, -np.linspace(.08, .4, OPEN_H)[:, None] * np.ones((1, OPEN_W)))
    ImageDraw.Draw(img).rectangle([0, OPEN_H - 14, OPEN_W, OPEN_H], fill=GRAPHITE)   # 門檻
    return img

def main():
    os.makedirs(os.path.join(OUT, 'props'), exist_ok=True)
    ground = Image.new('RGBA', (W * T, H * T), (6, 13, 22, 255))
    space = Image.open(os.path.join(SRC, 'space.webp')).convert('RGBA').crop((CROP_X, 0, CROP_X + W * T, 147))
    floor = Image.open(os.path.join(SRC, 'floor.webp')).convert('RGBA').crop((CROP_X, 0, CROP_X + W * T, 452))
    for sigma in (50, 28): floor = delight(floor, sigma, OPEN_X + OPEN_W // 2)
    fg = Image.open(os.path.join(SRC, 'foreground.webp')).convert('RGBA').crop((CROP_X, 0, CROP_X + W * T, 103))
    for y in range(O + 849, H * T, 147): ground.alpha_composite(space, (0, y))
    ground.alpha_composite(floor, (0, O + 346))
    ground.alpha_composite(corridor_wall(), (0, O))
    ground.alpha_composite(doorway_floor(), (OPEN_X, OPEN_TOP))
    ground.alpha_composite(build_room(), (0, 0))
    ground.alpha_composite(north_wall(), (0, 0))
    sw = side_wall(O)
    ground.alpha_composite(sw, (0, 0)); ground.alpha_composite(sw.transpose(Image.FLIP_LEFT_RIGHT), ((W - 1) * T, 0))
    sign = Image.open(os.path.join(ROOT, 'public/assets/corridor-signs/sign-medical.webp')).convert('RGBA')
    ground.alpha_composite(sign, (DOOR_ZONE[1] + 60, O + 150))
    ground.convert('RGB').save(os.path.join(OUT, 'ground.webp'), lossless=True)
    fg.save(os.path.join(OUT, 'foreground.webp'), lossless=True)
    frame, left, right = door_art()
    frame.save(os.path.join(OUT, 'door_frame.webp'), lossless=True)
    left.save(os.path.join(OUT, 'door_left.webp'), lossless=True)
    right.save(os.path.join(OUT, 'door_right.webp'), lossless=True)
    walls = build_walls()
    for old in os.listdir(os.path.join(OUT, 'props')):
        if old.startswith('wall_'): os.remove(os.path.join(OUT, 'props', old))
    for name, img, *_ in walls: img.save(os.path.join(OUT, 'props', f'{name}.webp'), lossless=True)
    cap = ground.crop((0, O, W * T, O + CAP_H)); cap.alpha_composite(frame.crop((0, 0, frame.width, CAP_H)), (DOOR_ZONE[0], 0))
    cap.save(os.path.join(OUT, 'wall_cap.webp'), lossless=True)

    # 疊成完整底圖（隔間牆、關著的門）給規劃與擺設參考圖用
    full = ground.copy()
    for _, img, cx, bottom, _r in sorted(walls, key=lambda w: w[3]):
        full.alpha_composite(img, (int(cx - img.width / 2), int(bottom - img.height)))
    full.alpha_composite(left, (OPEN_X, OPEN_TOP)); full.alpha_composite(right, (OPEN_X + OPEN_W // 2, OPEN_TOP))
    full.alpha_composite(frame, (DOOR_ZONE[0], O))
    full.alpha_composite(fg, (0, O + 746))
    full.convert('RGB').save(os.path.join(HERE, 'medical/base_full.png'))
    full.resize((full.width // 2, full.height // 2), Image.LANCZOS).convert('RGB').save(os.path.join(HERE, 'medical/base_preview.png'))

    # ---- map.json（只有結構；家具之後由物件清單加上）----
    corridor_top, corridor_bottom = (O + 397) // T, (O + 775) // T
    passage = {'x': OPEN_X // T, 'y': ROOM_H, 'w': OPEN_W // T, 'h': corridor_top - ROOM_H}
    collision = []
    for y in range(H):
        row = []
        for x in range(W):
            if y < WALL_ROWS: row.append(1)
            elif y <= ROOM_H: row.append(1 if x in (0, W - 1) else 0)
            elif y < corridor_top: row.append(0 if passage['x'] <= x < passage['x'] + passage['w'] else 1)
            elif y < corridor_bottom: row.append(0)
            else: row.append(1)
        collision.append(row)
    r4 = lambda v: round(v, 4)
    for *_, (rx0, ry0, rx1, ry1) in walls:
        for ty in range(H):
            for tx in range(W):
                cx, cy = (tx + .5) * T, (ty + .5) * T
                if rx0 <= tx * T and (tx + 1) * T <= rx1 and ry0 <= cy <= ry1: collision[ty][tx] = 1
    thin = [{'x': r4(rx0 / T), 'y': r4(ry0 / T), 'w': r4((rx1 - rx0) / T), 'h': r4((ry1 - ry0) / T)} for *_, (rx0, ry0, rx1, ry1) in walls]
    stop = math.ceil((O + FEET_UNDER_CAP + 22) / T * 10000) / 10000
    wall_rects = [{'x': 0, 'y': stop, 'w': passage['x'], 'h': corridor_top - stop},
                  {'x': passage['x'] + passage['w'], 'y': stop, 'w': W - passage['x'] - passage['w'], 'h': corridor_top - stop}]
    mid = (corridor_top + corridor_bottom) / 2
    data = {
        'tileSize': T, 'width': W, 'height': H,
        'legend': {'0': '可行走', '1': '碰撞'},
        'note': '由 tools/art/medical_build.py 產生，不要手改。室內第 0–31 列（0–2 列北牆立面），下方是沿用居住區走廊素材的走廊：左通居住區 B、右通 C。室內的牆都是 decor（依牆腳跟角色排前後），碰撞在 collisionRects；一般內牆跟走廊牆一樣高，病房之間是薄牆。目前只有結構，家具與互動之後加。',
        'collision': collision,
        'collisionRects': wall_rects + thin,
        'entrances': [
            {'x': 0, 'y': corridor_top, 'w': 1, 'h': corridor_bottom - corridor_top, 'to': 'residential_b', 'label': '往居住區 B', 'spawn': [2, mid]},
            {'x': W - 1, 'y': corridor_top, 'w': 1, 'h': corridor_bottom - corridor_top, 'to': 'residential_c', 'label': '往居住區 C', 'spawn': [W - 2, mid]},
        ],
        'door': {
            'id': 'auto-door', 'label': '自動滑門', 'passage': passage, 'closedFrom': O + FEET_UNDER_CAP + 22,
            'opening': [OPEN_X, OPEN_TOP, OPEN_W, OPEN_H],
            'frame': {'src': 'door_frame.webp', 'x': DOOR_ZONE[0], 'y': O},
            'panels': {'left': 'door_left.webp', 'right': 'door_right.webp'},
            'lamp': [(DOOR_ZONE[0] + DOOR_ZONE[1]) // 2, OPEN_TOP - 26],
            'trigger': 150, 'openSeconds': .8,
        },
        'foreground': [{'src': 'wall_cap.webp', 'x': 0, 'y': O}, {'src': 'foreground.webp', 'x': 0, 'y': O + 746}],
        'interactions': [],
        'decor': [{'sprite': name, 'id': name, 'x': r4(cx / T), 'y': r4(bottom / T), 'scale': 1} for name, _, cx, bottom, _r in walls],
    }
    with open(os.path.join(OUT, 'map.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print('ground', ground.size, 'map', W, 'x', H, 'corridor rows', corridor_top, '-', corridor_bottom - 1, 'walls', len(walls), 'thin rects', len(thin))

if __name__ == '__main__':
    main()
