"""工程區場景：產生地面圖、厚重門、走廊前景與 map.json。目前只有結構（牆、地板、門），機台之後再擺。

用法：uv run --with pillow --with numpy python tools/art/engineering_build.py
輸出到 public/assets/engineering/：
  ground.webp      地面（L0）：室內地板、北牆與左右牆、下方走廊（牆、地板、星空）
  door_frame.webp  門框（蓋在門片上；角色走在門洞裡時再蓋一次）
  door_left.webp / door_right.webp  兩片門扇，程式依開門程度往兩側滑進牆裡
  foreground.webp  走廊外側欄杆，蓋在角色上面
  map.json         碰撞、出入口、門

室內是程式畫的斜俯視材質（左上 45 度光源，配色照生成家具.md：油污深灰、外露螺栓、警示黃），
之後要換成生圖素材時，只換 ground.webp 與門的三張圖，map.json 的座標不變。
下方走廊沿用居住區 A 走廊的素材：柱子、素面牆板、地板、欄杆、星空原樣切出來拼，不重畫。
"""
import json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'public/assets/corridor-a')
OUT = os.path.join(ROOT, 'public/assets/engineering')
T = 96
W, ROOM_H = 16, 19          # 寬 16 格；室內第 0–18 列（0–2 列是北牆立面）
WALL_ROWS = 3
O = ROOM_H * T              # 走廊素材的原點 y（走廊牆頂接在室內地板下緣）
CORRIDOR_H = 996            # 居住區走廊素材的高度
H = math.ceil((O + CORRIDOR_H) / T)
CROP_X = 252                # 從走廊素材切哪一段：讓地板上的燈光落在門正下方（門 2 的中心 1020 → 768）
RNG = np.random.default_rng(7)

# 室內地面，第 3–18 列、第 1–14 欄。. 防滑鋼板｜g 管線溝蓋板｜h 警示條紋｜x 油污
# 位置對應 engineering_objects.py 的 v5 機台分區；機台腳下鋪鋼板。
FLOOR = [  # 依 v5 分區：製造機前與維修區四周畫警示條紋、西牆公用設備旁一條管線溝，油污在油桶、製造機、維修區旁
    "..............",  # 3
    "..............",  # 4
    "......x.......",  # 5
    "..gggggghhhhhh",  # 6  製造機前的警示區；管線溝從西牆接過來
    "..g........x..",  # 7
    "..g...........",  # 8
    "..g..hhhh.....",  # 9  維修區四周
    "..g..h..h.....",  # 10
    "..g..h..h.....",  # 11
    "..g.xhhhh.....",  # 12
    "..g...........",  # 13
    "..g...........",  # 14
    "..g...........",  # 15
    "..............",  # 16
    ".....hhhh.....",  # 17 大門前
    "....xhhhh.....",  # 18
]

# 門：門洞 4 格寬（第 6–9 欄，x 576–960），大型物件推得進去；穿過走廊牆面（第 19–22 列）
DOOR_ZONE = (506, 1030)                 # 牆上留給門框的那一段
OPEN_X, OPEN_W = 576, 384
WALL_BASE = O + 346                     # 走廊牆腳（地板素材從這裡開始）
OPEN_TOP = O + 66
OPEN_H = WALL_BASE - OPEN_TOP
CAP_H = OPEN_TOP - O                    # 牆頂前景：牆簷（素材 y 0–30）加上門楣，共 66 px，畫在角色上面
FEET_UNDER_CAP = 58                     # 室內角色腳點最多走到牆頂下 58 px（同 A-1 房間南牆 72 − 腳圈 14），下半身被牆擋住、露出胸口以上

def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def noise(w, h, scale, seed):
    """平滑雜訊 0–1：低解析亂數放大。"""
    r = np.random.default_rng(seed)
    small = Image.fromarray((r.random((max(2, h // scale), max(2, w // scale))) * 255).astype(np.uint8))
    return np.asarray(small.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255

def shade(img, amount):
    """amount：與圖同大小的陣列，>0 變亮、<0 變暗。"""
    a = np.asarray(img).astype(np.float32)
    a[..., :3] = np.clip(a[..., :3] * (1 + amount[..., None]), 0, 255)
    return Image.fromarray(a.astype(np.uint8), img.mode)

def bolt(d, x, y, r=5):
    d.ellipse([x - r, y - r + 1, x + r, y + r + 1], fill=(20, 23, 26, 160))          # 右下陰影
    d.ellipse([x - r, y - r, x + r, y + r], fill=rgb('#80878e'), outline=rgb('#2a2f34'))
    d.ellipse([x - r + 2, y - r + 2, x, y], fill=rgb('#aab1b8'))                      # 左上反光

# ---------- 室內地板 ----------
def steel_floor(w, h):
    """防滑鋼板：2×2 格一片，片與片之間有接縫，四角螺栓，表面有菱形防滑紋。"""
    img = Image.new('RGBA', (w, h), rgb('#4b5157') + (255,))
    d = ImageDraw.Draw(img)
    for py in range(0, h, T * 2):
        for px in range(0, w, T * 2):
            tone = RNG.integers(-6, 7)
            base = tuple(int(c + tone) for c in rgb('#4b5157'))
            d.rectangle([px, py, px + 2 * T - 1, py + 2 * T - 1], fill=base + (255,))
            for yy in range(py + 10, py + 2 * T - 6, 14):            # 防滑紋：交錯的短斜條
                for xx in range(px + 10 + (7 if (yy // 14) % 2 else 0), px + 2 * T - 8, 14):
                    if (xx // 14 + yy // 14) % 2:
                        d.line([xx, yy + 3, xx + 5, yy], fill=tuple(c + 14 for c in base) + (255,), width=2)
                        d.line([xx + 1, yy + 4, xx + 6, yy + 1], fill=tuple(c - 12 for c in base) + (255,), width=1)
                    else:
                        d.line([xx, yy, xx + 5, yy + 3], fill=tuple(c + 14 for c in base) + (255,), width=2)
                        d.line([xx + 1, yy + 1, xx + 6, yy + 4], fill=tuple(c - 12 for c in base) + (255,), width=1)
            d.line([px, py, px + 2 * T - 1, py], fill=rgb('#6c737a'), width=2)        # 左上受光
            d.line([px, py, px, py + 2 * T - 1], fill=rgb('#6c737a'), width=2)
            d.line([px, py + 2 * T - 2, px + 2 * T - 1, py + 2 * T - 2], fill=rgb('#2b3035'), width=3)
            d.line([px + 2 * T - 2, py, px + 2 * T - 2, py + 2 * T - 1], fill=rgb('#2b3035'), width=3)
            for bx, by in ((14, 14), (2 * T - 16, 14), (14, 2 * T - 16), (2 * T - 16, 2 * T - 16)):
                bolt(d, px + bx, py + by, 4)
    return img

def grating(w, h):
    """管線溝蓋板：深色溝槽上一條條格柵，透出底下的管線。"""
    img = Image.new('RGBA', (w, h), rgb('#1d2125') + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * .55, w, h * .55 + 14], fill=rgb('#5a4130'))                   # 溝底的管子
    d.line([0, h * .55 + 2, w, h * .55 + 2], fill=rgb('#8a6448'), width=2)
    for y in range(8, h - 6, 11):
        d.rectangle([6, y, w - 7, y + 4], fill=rgb('#5d646b'))
        d.line([6, y, w - 7, y], fill=rgb('#7f878e'))
    d.rectangle([0, 0, w - 1, h - 1], outline=rgb('#3a4046'), width=6)
    d.line([0, 0, w, 0], fill=rgb('#737a81'), width=2); d.line([0, 0, 0, h], fill=rgb('#737a81'), width=2)
    for bx, by in ((10, 10), (w - 11, 10), (10, h - 11), (w - 11, h - 11)):
        bolt(d, bx, by, 3)
    return img

def hazard(w, h, phase=0):
    """警示黃黑斜紋，磨損處露出底下的鋼板。"""
    img = Image.new('RGBA', (w, h))
    yy, xx = np.mgrid[0:h, 0:w]
    stripe = ((xx + yy + phase) // 26) % 2 == 0
    a = np.zeros((h, w, 4), np.uint8)
    a[stripe] = rgb('#d9aa2b') + (255,)
    a[~stripe] = rgb('#26292d') + (255,)
    wear = noise(w, h, 9, 11 + phase) > .8
    a[wear] = rgb('#5a5f64') + (255,)
    return Image.fromarray(a)

def build_room():
    room = Image.new('RGBA', (W * T, O), (0, 0, 0, 0))
    floor = steel_floor(W * T, O)
    room.alpha_composite(floor)
    g = grating(T, T)
    hz = hazard(W * T, O)
    mask_h = Image.new('L', (W * T, O), 0); dm = ImageDraw.Draw(mask_h)
    for r, row in enumerate(FLOOR):
        y = (r + WALL_ROWS) * T
        for c, ch in enumerate(row):
            x = (c + 1) * T
            if ch == 'g': room.alpha_composite(g, (x, y))
            if ch == 'h': dm.rectangle([x, y, x + T - 1, y + T - 1], fill=255)
    room.paste(hz, (0, 0), mask_h)
    # 警示區外緣的金屬壓條
    dz = ImageDraw.Draw(room)
    hm = np.asarray(mask_h) > 0
    edge = hm & ~np.asarray(Image.fromarray(hm.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(9))).astype(bool)
    a = np.asarray(room).copy(); a[edge] = rgb('#3b4045') + (255,); room = Image.fromarray(a)
    # 油污：不規則深色斑，加一點反光；旁邊散幾顆螺帽
    d = ImageDraw.Draw(room)
    stain = Image.new('L', (W * T, O), 0)
    for r, row in enumerate(FLOOR):
        for c, ch in enumerate(row):
            if ch != 'x': continue
            cx, cy = (c + 1.5) * T, (r + WALL_ROWS + .5) * T
            n = noise(T * 2, T * 2, 9, r * 31 + c)
            yy, xx = np.mgrid[0:T * 2, 0:T * 2]
            dist = np.hypot(xx - T, (yy - T) * 1.4) / T
            blob = Image.fromarray(((n - dist * .9) > .05).astype(np.uint8) * 120).filter(ImageFilter.GaussianBlur(6))
            stain.paste(blob, (int(cx - T), int(cy - T)), blob)
            for _ in range(3):
                nx, ny = cx + RNG.integers(-40, 40), cy + RNG.integers(-30, 30)
                d.regular_polygon((nx, ny, 5), 6, fill=rgb('#8b9197'), outline=rgb('#2a2f34'))
                d.ellipse([nx - 2, ny - 2, nx + 2, ny + 2], fill=rgb('#2a2f34'))
    dark = Image.new('RGBA', (W * T, O), (16, 14, 12, 255))
    room = Image.composite(dark, room, stain)
    # 整體的髒污與刮痕
    grime = noise(W * T, O, 48, 3) - .5
    room = shade(room, grime * .22)
    d = ImageDraw.Draw(room)
    for _ in range(140):
        x, y = RNG.integers(T, (W - 1) * T), RNG.integers(WALL_ROWS * T, O)
        ang, ln = RNG.uniform(0, math.pi), RNG.integers(8, 30)
        d.line([x, y, x + math.cos(ang) * ln, y + math.sin(ang) * ln], fill=(150, 156, 162, 70), width=1)
    # 天花板燈打下來的光圈（暖白）
    light = np.zeros((O, W * T), np.float32)
    yy, xx = np.mgrid[0:O, 0:W * T]
    for lx, ly in ((4.5, 6), (11.5, 6), (4.5, 12.5), (11.5, 12.5), (8, 17)):
        light += np.exp(-(((xx - lx * T) / 220) ** 2 + ((yy - ly * T) / 160) ** 2)) * .18
    room = shade(room, light - .06)
    # 北牆往下、左牆往右的陰影（光從左上來）
    sh = np.zeros((O, W * T), np.float32)
    top = WALL_ROWS * T
    sh[top:top + 60] -= np.linspace(.45, 0, 60)[:, None]
    sh[:, T:T + 40] -= np.linspace(.4, 0, 40)[None, :]
    room = shade(room, sh)
    return room

def north_wall():
    """北牆立面（三格高）：深灰鋼板、外露螺栓、兩條管線、牆腳警示條。"""
    w, h = W * T, WALL_ROWS * T
    img = Image.new('RGBA', (w, h), rgb('#3c4349') + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 22], fill=rgb('#23282d')); d.line([0, 22, w, 22], fill=rgb('#596067'), width=2)  # 牆頂
    for x in range(0, w, 192):                                   # 直向肋條
        d.rectangle([x, 24, x + 14, h - 30], fill=rgb('#30363b'))
        d.line([x + 1, 24, x + 1, h - 30], fill=rgb('#5c636a'), width=2)
        for y in range(44, h - 40, 52): bolt(d, x + 7, y, 4)
    for x in range(14, w, 192):                                   # 鋼板接縫與鉚釘
        d.line([x, 120, x + 178, 120], fill=rgb('#2b3035'), width=2); d.line([x, 122, x + 178, 122], fill=rgb('#4f565c'), width=1)
        for bx in range(x + 18, x + 178, 40): bolt(d, bx, 34, 3); bolt(d, bx, 228, 3)
    # 管線：粗的灰管、細的銅管，法蘭與吊架
    for y0, r, col, hi in ((150, 16, '#6d757c', '#9aa2a9'), (190, 10, '#8a5a34', '#c08257')):
        d.rectangle([0, y0 - r, w, y0 + r], fill=rgb(col))
        d.line([0, y0 - r + 4, w, y0 - r + 4], fill=rgb(hi), width=3)
        d.line([0, y0 + r, w, y0 + r], fill=rgb('#22262a'), width=3)
        for x in range(96, w, 384):
            d.rectangle([x - 7, y0 - r - 4, x + 7, y0 + r + 4], fill=rgb('#4a5157'), outline=rgb('#202428'))
            bolt(d, x, y0 - r + 1, 2); bolt(d, x, y0 + r - 1, 2)
    for x in range(240, w, 384):                                  # 灰管上的警示環
        d.rectangle([x, 134, x + 26, 166], fill=rgb('#d9aa2b'))
        for k in range(0, 26, 10): d.polygon([(x + k, 134), (x + k + 5, 134), (x + k + 5 - 4, 166), (x + k - 4, 166)], fill=rgb('#26292d'))
    hz = hazard(w, 26, 5); img.alpha_composite(hz, (0, h - 30))   # 牆腳
    d.line([0, h - 31, w, h - 31], fill=rgb('#5c636a'), width=2)
    d.rectangle([0, h - 4, w, h], fill=rgb('#1c2024'))
    img = shade(img, (noise(w, h, 40, 9) - .5) * .25 + np.linspace(.08, -.08, w)[None, :])
    return img

def side_wall(h):
    """左右牆頂（俯視看到的牆頭）。"""
    img = Image.new('RGBA', (T, h), rgb('#262b30') + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 0, T - 11, h], fill=rgb('#31373c'))
    d.line([10, 0, 10, h], fill=rgb('#5a6168'), width=3)
    d.line([T - 11, 0, T - 11, h], fill=rgb('#191c20'), width=3)
    for y in range(40, h, 96): bolt(d, T // 2, y, 4)
    return img

# ---------- 走廊（沿用居住區 A 走廊素材） ----------
def corridor_wall():
    """居住區 A 走廊的牆面切成「素面牆板」與「柱子」兩種片段，拼出沒有住宅門的一段牆，中間留給厚重門。"""
    wall = Image.open(os.path.join(SRC, 'wall.webp')).convert('RGBA')
    plain = delight(wall.crop((282, 0, 412, wall.height)), 30)   # 素面牆板（門框左邊那一段），洗掉住宅門燈打上去的暖光
    pillar = wall.crop((186, 0, 282, wall.height))  # 柱子（含青色燈條）
    out = Image.new('RGBA', (W * T, wall.height))
    def fill(x0, x1):
        x = x0
        while x < x1:
            piece = plain.crop((0, 0, min(plain.width, x1 - x), plain.height)); out.alpha_composite(piece, (x, 0)); x += piece.width
    layout = [('plain', 150), ('pillar', 96), ('plain', 260), ('plain', DOOR_ZONE[1] - DOOR_ZONE[0]), ('plain', 260), ('pillar', 96), ('plain', 150)]
    x = 0
    for kind, width in layout:
        if kind == 'plain': fill(x, x + width)
        else: out.alpha_composite(pillar, (x, 0))
        x += width
    assert x == W * T
    return out

def door_art():
    """厚重隔音門：門框（柱、門楣、警示燈）與兩片門扇。門洞 192 × OPEN_H。"""
    fx0, fx1 = DOOR_ZONE
    fw, fh = fx1 - fx0, WALL_BASE - O + 6
    frame = Image.new('RGBA', (fw, fh))
    d = ImageDraw.Draw(frame)
    ox = OPEN_X - fx0
    top = OPEN_TOP - O
    # 外框陰影與厚框
    d.rectangle([8, top - 46, fw - 9, fh - 1], fill=rgb('#23282c'))
    d.rectangle([14, top - 40, fw - 15, fh - 1], fill=rgb('#3d444a'))
    d.line([14, top - 40, fw - 15, top - 40], fill=rgb('#6c737a'), width=3)
    d.line([14, top - 40, 14, fh], fill=rgb('#6c737a'), width=3)
    # 門楣：警示斜紋
    hz = hazard(fw - 40, 26, 3); frame.alpha_composite(hz, (20, top - 32))
    d.rectangle([20, top - 32, fw - 21, top - 6], outline=rgb('#1d2125'), width=2)
    # 兩側門柱：斜紋＋螺栓
    for px in (ox - 50, ox + OPEN_W + 6):
        d.rectangle([px, top - 4, px + 44, fh - 1], fill=rgb('#353b41'))
        frame.alpha_composite(hazard(16, fh - top - 20, 9), (px + 14, top + 8))
        d.line([px, top - 4, px, fh], fill=rgb('#68707a'), width=2)
        for y in range(top + 20, fh - 10, 60): bolt(d, px + 7, y, 4); bolt(d, px + 37, y, 4)
    # 門洞內側的陰影邊（門片滑進去的牆槽）
    d.rectangle([ox - 6, top - 6, ox - 1, fh - 1], fill=rgb('#15181b'))
    d.rectangle([ox + OPEN_W, top - 6, ox + OPEN_W + 5, fh - 1], fill=rgb('#15181b'))
    d.rectangle([ox - 6, top - 6, ox + OPEN_W + 5, top - 1], fill=rgb('#15181b'))
    # 門洞挖空，門扇從後面露出來
    frame.paste((0, 0, 0, 0), (ox, top, ox + OPEN_W, fh))
    # 門楣上的警示燈座
    lx = fw // 2
    d.rounded_rectangle([lx - 22, top - 66, lx + 22, top - 42], 6, fill=rgb('#2b3035'), outline=rgb('#15181b'), width=2)
    d.ellipse([lx - 14, top - 64, lx + 14, top - 44], fill=rgb('#b8641c'), outline=rgb('#5a2f0c'), width=2)
    d.ellipse([lx - 8, top - 61, lx + 1, top - 54], fill=rgb('#ffcf8a'))
    # 門扇：深色厚鋼板、橫向補強、內緣警示斜紋、中間的觀察窗
    def panel(left):
        pw = OPEN_W // 2
        p = Image.new('RGBA', (pw, OPEN_H), rgb('#4d545b') + (255,))
        pd = ImageDraw.Draw(p)
        for y in (40, OPEN_H // 2, OPEN_H - 50):
            pd.rectangle([6, y, pw - 7, y + 14], fill=rgb('#3a4046')); pd.line([6, y, pw - 7, y], fill=rgb('#737a81'), width=2)
        inner = pw - 18 if left else 0
        p.alpha_composite(hazard(18, OPEN_H, 13 if left else 0), (inner, 0))
        wx = 18 if left else 24
        pd.rounded_rectangle([wx, 70, wx + 40, 120], 5, fill=rgb('#13232b'), outline=rgb('#22282d'), width=3)
        pd.line([wx + 6, 76, wx + 18, 76], fill=rgb('#4dd0e1'), width=2)             # 窗內透出的青光
        for y in range(16, OPEN_H - 10, 48): bolt(pd, 10 if left else pw - 11, y, 3)
        pd.line([0, 0, pw, 0], fill=rgb('#7a8188'), width=2)
        pd.line([0, 0, 0, OPEN_H], fill=rgb('#6a7178') if left else rgb('#2b3035'), width=2)
        pd.line([pw - 1, 0, pw - 1, OPEN_H], fill=rgb('#2b3035') if left else rgb('#6a7178'), width=2)
        return shade(p, (noise(pw, OPEN_H, 20, 21 if left else 22) - .5) * .25)
    return frame, panel(True), panel(False)

def doorway_floor():
    """門洞裡看得到的地面：室內鋼板往下延伸，越深越暗，門檻有一條警示紋。"""
    img = steel_floor(OPEN_W, OPEN_H + 20).crop((0, 0, OPEN_W, OPEN_H))
    img = shade(img, -np.linspace(.15, .55, OPEN_H)[:, None] * np.ones((1, OPEN_W)))
    img.alpha_composite(hazard(OPEN_W, 18, 1), (0, OPEN_H - 18))
    return img

def write_cap():
    """牆頂前景：走廊牆頂 CAP_H 高的一條（牆簷＋門楣），連同門框頂端一起切下來，畫在角色上面（室內角色走到牆後時下半身被擋住）。
    門框換圖後（engineering_door.py cut）要重跑一次。"""
    ground = Image.open(os.path.join(OUT, 'ground.webp')).convert('RGBA')
    cap = ground.crop((0, O, W * T, O + CAP_H))
    frame = Image.open(os.path.join(OUT, 'door_frame.webp')).convert('RGBA')
    cap.alpha_composite(frame.crop((0, 0, frame.width, CAP_H)), (DOOR_ZONE[0], 0))
    cap.save(os.path.join(OUT, 'wall_cap.webp'), lossless=True)

def delight(img, sigma, keep_x=None):
    """把素材裡畫死的燈光洗掉：大範圍模糊得出光照起伏，每列以整列中位數當基準，除掉起伏、保留紋路。
    青色燈條不參與計算也不改色（不然會被抹糊）。keep_x：這個 x 附近的光留著（例：大門正下方有門燈）。"""
    a = np.asarray(img).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:]
    glow = (rgb[..., 2] - rgb[..., 0] > 45) & (rgb[..., 2] > 150)          # 青色燈條
    w = ((alpha[..., 0] > 0) & ~glow).astype(np.float32)
    blur = lambda ch: np.asarray(Image.fromarray(ch).filter(ImageFilter.GaussianBlur(sigma)), np.float32)
    def lowpass(ch):   # 只用一般像素的加權模糊
        scale = 255 / max(ch.max(), 1)
        num = np.asarray(Image.fromarray(np.clip(ch * w * scale / 255 * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(sigma)), np.float32)
        den = blur((w * 255).astype(np.uint8))
        return num / np.maximum(den, 1) * 255 / scale
    low = np.stack([lowpass(rgb[..., c]) for c in range(3)], -1)
    base = np.median(np.where(w[..., None] > 0, low, np.nan), axis=1, keepdims=True)
    base = np.where(np.isnan(base), low, base)
    gain = np.clip(base / np.maximum(low, 1), .8, 1.05)
    if keep_x is not None:
        keep = np.exp(-((np.arange(rgb.shape[1])[None, :, None] - keep_x) / 150) ** 2)
        gain = gain * (1 - keep) + keep
    gain = np.where(glow[..., None], 1, gain)
    return Image.fromarray(np.concatenate([np.clip(rgb * gain, 0, 255), alpha], -1).astype(np.uint8), 'RGBA')

def main():
    os.makedirs(OUT, exist_ok=True)
    ground = Image.new('RGBA', (W * T, H * T), (6, 13, 22, 255))
    # 走廊：星空、地板、牆（照居住區走廊的疊放順序）
    space = Image.open(os.path.join(SRC, 'space.webp')).convert('RGBA').crop((CROP_X, 0, CROP_X + W * T, 147))
    floor = Image.open(os.path.join(SRC, 'floor.webp')).convert('RGBA').crop((CROP_X, 0, CROP_X + W * T, 452))
    for sigma in (50, 28): floor = delight(floor, sigma, OPEN_X + OPEN_W // 2)   # 洗兩輪：大範圍先壓、小範圍再補
    fg = Image.open(os.path.join(SRC, 'foreground.webp')).convert('RGBA').crop((CROP_X, 0, CROP_X + W * T, 103))
    for y in range(O + 849, H * T, 147): ground.alpha_composite(space, (0, y))
    ground.alpha_composite(floor, (0, O + 346))
    ground.alpha_composite(corridor_wall(), (0, O))
    ground.alpha_composite(doorway_floor(), (OPEN_X, OPEN_TOP))
    # 室內
    ground.alpha_composite(build_room(), (0, 0))
    ground.alpha_composite(north_wall(), (0, 0))
    sw = side_wall(O)
    ground.alpha_composite(sw, (0, 0)); ground.alpha_composite(sw.transpose(Image.FLIP_LEFT_RIGHT), ((W - 1) * T, 0))
    # 門旁的工程部招牌（居住區走廊的同款招牌）
    sign = Image.open(os.path.join(ROOT, 'public/assets/corridor-signs/sign-engineering.webp')).convert('RGBA')
    ground.alpha_composite(sign, (DOOR_ZONE[1] + 60, O + 150))
    ground.convert('RGB').save(os.path.join(OUT, 'ground.webp'), lossless=True)
    fg.save(os.path.join(OUT, 'foreground.webp'), lossless=True)
    frame, left, right = door_art()
    frame.save(os.path.join(OUT, 'door_frame.webp'), lossless=True)
    left.save(os.path.join(OUT, 'door_left.webp'), lossless=True)
    right.save(os.path.join(OUT, 'door_right.webp'), lossless=True)

    # ---- map.json ----
    corridor_top, corridor_bottom = (O + 397) // T, (O + 775) // T   # 走廊可走帶：素材 y 397–775，取落在裡面的整列
    passage = {'x': OPEN_X // T, 'y': ROOM_H, 'w': OPEN_W // T, 'h': corridor_top - ROOM_H}
    collision = []
    for y in range(H):
        row = []
        for x in range(W):
            if y < WALL_ROWS: row.append(1)
            elif y < ROOM_H: row.append(1 if x in (0, W - 1) else 0)
            elif y == ROOM_H: row.append(1 if x in (0, W - 1) else 0)   # 牆簷底下那一列：開放，由下面的 collisionRects 決定能走多深
            elif y < corridor_top: row.append(0 if passage['x'] <= x < passage['x'] + passage['w'] else 1)
            elif y < corridor_bottom: row.append(0)
            else: row.append(1)
        collision.append(row)
    # 機台（engineering_objects.py v6）：圖切好了（props/<名稱>.webp 存在）才擺上去。
    # 位置是遊戲 px（底部中心），碰撞是從底邊往上 depth 格的精細矩形（collisionRects），點擊範圍是整張圖
    from engineering_objects import OBJECTS, SEATS, SHARED_SPRITE
    decor, items, object_rects = [], [], []
    r4 = lambda v: round(v, 4)
    for oid, label, cx, bottom, width, depth, _sheet, _order, text, stand in OBJECTS:
        sprite = SHARED_SPRITE.get(oid, oid)
        path = os.path.join(OUT, 'props', f'{sprite}.webp')
        if not os.path.exists(path): continue
        w, h = Image.open(path).size
        decor.append({'sprite': sprite, 'id': oid, 'x': r4(cx / T), 'y': r4(bottom / T), 'scale': 1, 'block': depth > 0})
        if depth:
            pad = min(12, w * .06)
            object_rects.append({'x': r4((cx - w / 2 + pad) / T), 'y': r4(bottom / T - depth), 'w': r4((w - 2 * pad) / T), 'h': depth})
        if text:
            sx, sy = stand or (cx, bottom + 40)
            items.append({'id': oid, 'kind': 'machine', 'label': label, 'text': text,
                          'area': [r4((cx - w / 2) / T), r4((bottom - h) / T), r4(w / T), r4(h / T)], 'stand': [r4(sx / T), r4(sy / T)]})
    for sid, sprite, cx, bottom in SEATS:
        if os.path.exists(os.path.join(OUT, 'props', f'{sprite}.webp')):
            decor.append({'sprite': sprite, 'id': sid, 'x': r4(cx / T), 'y': r4(bottom / T), 'scale': 1})
    mid = (corridor_top + corridor_bottom) / 2
    # 互動站位自動挑：從入口出發走得到、在互動範圍內（離圖 ≤ 48 px）、最靠近物件正前方中點的位置
    stop_ = math.ceil((O + FEET_UNDER_CAP + 22) / T * 10000) / 10000
    all_rects = [(0, stop_, passage['x'], corridor_top - stop_), (passage['x'] + passage['w'], stop_, W - passage['x'] - passage['w'], corridor_top - stop_)] +                 [(r['x'], r['y'], r['w'], r['h']) for r in object_rects]
    def free(px, py, R=24):
        if px < R or py < R or px > W * T - R or py > H * T - R: return False
        for ty in range(int((py - R) // T), min(H - 1, int((py + R) // T)) + 1):
            for tx in range(int((px - R) // T), min(W - 1, int((px + R) // T)) + 1):
                if collision[ty][tx] and math.hypot(px - max(tx * T, min(px, tx * T + T)), py - max(ty * T, min(py, ty * T + T))) < R: return False
        for rx, ry, rw, rh in all_rects:
            x0, y0 = rx * T, ry * T
            if math.hypot(px - max(x0, min(px, x0 + rw * T)), py - max(y0, min(py, y0 + rh * T))) < R: return False
        return True
    STEP = 12
    start = (round(2 * T / STEP), round(mid * T / STEP))
    seen, todo = {start}, [start]
    while todo:
        gx, gy = todo.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (gx + dx, gy + dy)
            if n not in seen and free(n[0] * STEP, n[1] * STEP): seen.add(n); todo.append(n)
    for it in items:
        ax, ay, aw, ah = (v * T for v in it['area'])
        fx, fy = ax + aw / 2, ay + ah + 30                       # 正前方中點
        def ok(g):
            px, py = g[0] * STEP, g[1] * STEP
            d = math.hypot(px - max(ax, min(px, ax + aw)), py - max(ay, min(py, ay + ah)))
            near_seat = any(abs(px - scx) < 50 and -60 < py - sb < 30 for _, _, scx, sb in SEATS)   # 不要站在椅子上
            return 0 < d <= 48 and not near_seat
        best = min((g for g in seen if ok(g)), key=lambda g: math.hypot(g[0] * STEP - fx, g[1] * STEP - fy), default=None)
        if best is None: raise SystemExit(f'{it["id"]}: 找不到走得到的互動站位')
        it['stand'] = [r4(best[0] * STEP / T), r4(best[1] * STEP / T)]
    stop = math.ceil((O + FEET_UNDER_CAP + 22) / T * 10000) / 10000   # 腳圈半徑 22：腳點停在牆頂下 FEET_UNDER_CAP（無條件進位，不會差一點點就擋住）
    wall_rects = [{'x': 0, 'y': stop, 'w': passage['x'], 'h': corridor_top - stop},
                  {'x': passage['x'] + passage['w'], 'y': stop, 'w': W - passage['x'] - passage['w'], 'h': corridor_top - stop}]
    data = {
        'tileSize': T, 'width': W, 'height': H,
        'legend': {'0': '可行走', '1': '碰撞'},
        'note': '由 tools/art/engineering_build.py 產生，不要手改。室內第 0–18 列（0–2 列北牆），下方是沿用居住區走廊素材的走廊：左通居住區 C、右通 D。門要按 E（或點門）才開，走遠自己關；門關著時尋路不穿過門洞，門沒開完時程式擋住不讓走進去。',
        'collision': collision,
        'collisionRects': wall_rects + object_rects,
        'entrances': [
            {'x': 0, 'y': corridor_top, 'w': 1, 'h': corridor_bottom - corridor_top, 'to': 'residential_c', 'label': '往居住區 C', 'spawn': [2, mid]},
            {'x': W - 1, 'y': corridor_top, 'w': 1, 'h': corridor_bottom - corridor_top, 'to': 'residential_d', 'label': '往居住區 D', 'spawn': [W - 2, mid]},
        ],
        'door': {
            'id': 'blast-door', 'label': '厚重隔音門', 'passage': passage, 'closedFrom': O + FEET_UNDER_CAP + 22,
            'opening': [OPEN_X, OPEN_TOP, OPEN_W, OPEN_H],
            'frame': {'src': 'door_frame.webp', 'x': DOOR_ZONE[0], 'y': O},
            'panels': {'left': 'door_left.webp', 'right': 'door_right.webp'},
            'lamp': [(DOOR_ZONE[0] + DOOR_ZONE[1]) // 2, OPEN_TOP - 54],
            'trigger': 150, 'openSeconds': 1.4,
        },
        'foreground': [{'src': 'wall_cap.webp', 'x': 0, 'y': O}, {'src': 'foreground.webp', 'x': 0, 'y': O + 746}],
        'interactions': items,
        'decor': decor,
    }
    with open(os.path.join(OUT, 'map.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    write_cap()
    print('ground', ground.size, 'map', W, 'x', H, 'corridor rows', corridor_top, '-', corridor_bottom - 1, 'passage', passage)

if __name__ == '__main__':
    main()
