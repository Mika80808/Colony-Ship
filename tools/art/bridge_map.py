"""艦橋：產生設施場景格式（FacilityScene 用）的 map.json、底圖、擺設與前景。

用法：python tools/art/bridge_map.py
讀  public/assets/bridge-v3/ 的原圖（背景、井口、外環、平台、椅子、控制台、盆栽）
寫  public/assets/bridge-v3/map.json、ground.webp、parapet.webp、props/<物件>.webp

座標：素材座標 1254 × 1090，世界放大 1.5 倍（1881 × 1635 px）。圖一律用最近鄰放大，跟原本畫面一樣。
碰撞：照原本艦橋的判斷（地板多邊形、平台外環的凸起邊緣、家具的接地範圍、腳底 12 × 7 的探測點），
  每 3 px 算一次「腳點能不能站」；不能站、而且離能站的地方超過腳圈半徑的部分，整格的記進 collision，
  其餘切成橫條矩形。遊戲用腳圈（半徑 22）檢查，能站的範圍就跟原本一樣（誤差在 3 px 內）。
底圖：背景、井口、外環、靜止的平台、家具影子都畫進去；抵達演出時平台上升由遊戲另外畫（src/game/bridgeExtras.ts）。
重跑會產生同樣的結果。
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/bridge-v3'
S = 1.5                     # 素材座標 → 世界 px
W, H = 1254, 1090           # 素材座標的場景大小
WW, WH = round(W * S), round(H * S)
T = 32                      # 一格 32 px
STEP = 3                    # 碰撞取樣間距（世界 px）
RADIUS = 22                 # 腳圈半徑（src/game/facility.ts 的 RADIUS）

# —— 原本 src/game/bridge.ts 的地板與碰撞（素材座標）——
FLOOR = [(139, 307), (169, 228), (315, 191), (939, 191), (1086, 228), (1115, 307), (1115, 816), (1060, 886),
         (998, 934), (256, 934), (198, 888), (139, 816)]
OBSTACLES = [(458, 253, 338, 103), (458, 211, 74, 67), (722, 211, 74, 67), (590, 192, 74, 70),
             (242, 512, 77, 193), (208, 459, 79, 68), (208, 693, 79, 65),
             (935, 512, 77, 193), (967, 459, 79, 68), (967, 693, 79, 65),
             (148, 557, 84, 91), (1022, 557, 84, 91), (164, 221, 57, 45), (1034, 221, 57, 45)]
FOOT = (12, 7)
LANDING = (627, 807)        # 抵達演出結束站的位置；從星圖來也站這裡
INTERACTIONS = [            # id, 標籤, kind, 站位, 點擊範圍 (x, y, 寬, 高), 文字
    ('lift', '開啟星圖', 'map', (627, 615), (502, 498, 250, 204), '中央廣場與艦橋之間的升降平台。目的地由星圖選擇。'),
    ('command', '查看指揮台', 'info', (627, 398), (458, 210, 338, 148), '指揮台正顯示全艦航行狀態。值勤人員抬頭向你示意，隨後讓出螢幕前的視線。'),
    ('navigation', '查看導航台', 'info', (365, 608), (207, 458, 112, 302), '導航台上標示著目前航線與周邊星域。幾道藍色訊號安靜地沿著座標移動。'),
    ('comms', '查看補給船船期', 'board', (889, 608), (935, 458, 112, 302), '通訊台維持著各艙區的聯絡與貨船進出港。'),
    ('window', '眺望星空', 'info', (850, 223), (325, 0, 606, 99), '觀景窗外，行星的弧面泛著淡藍色光。艦橋的低鳴聲讓這片星空顯得更加安靜。'),
]
NEAR = 62                   # E 鍵感應：離站位這麼近（素材座標，原本的距離）

# —— 原本 src/game/bridgeArt.ts：圖的裁切範圍與擺放位置 ——
ART = {
    'background': ('bridge-background-clean.webp', (0, 0, 1254, 1254)),
    'ring': ('elevator-ring-v2.webp', (76, 72, 1179, 1107)),
    'well': ('elevator_well_clean.webp', (313, 354, 942, 894)),
    'captain-chair-v2': ('captain-chair-v2.webp', (356, 314, 898, 911)),
    'left-chair-v2': ('left-chair-v2.webp', (286, 260, 903, 984)),
    'right-chair-v2': ('right-chair-v2.webp', (347, 245, 999, 1006)),
    'right_planter': ('right_planter.webp', (271, 179, 1008, 1066)),
    'command_console': ('command_console.webp', (269, 164, 1505, 704)),
    'left_console': ('left_console.webp', (411, 79, 876, 1160)),
    'right_console': ('right_console.webp', (467, 125, 862, 1083)),
}
PIECES = [  # decor id, 圖, 擺放 (x, y, 寬, 高)
    ('captain-chair', 'captain-chair-v2', (588, 164, 78, 97)), ('left-chair', 'left-chair-v2', (148, 533, 84, 118)),
    ('right-chair', 'right-chair-v2', (1022, 533, 84, 118)), ('planter-left', 'right_planter', (154, 151, 74, 115)),
    ('planter-right', 'right_planter', (1026, 151, 74, 115)), ('command-console', 'command_console', (458, 210, 338, 147)),
    ('left-console', 'left_console', (207, 458, 112, 302)), ('right-console', 'right_console', (935, 458, 112, 302)),
]
PLATFORM_SRC = (290, 331, 965, 856)     # elevator_platform.webp 的裁切（左、上、右、下）
PLATFORM_DST = (508, 503, 238, 196)
PARAPET = (130, 944, 994, 136)          # 南側矮牆：背景這一塊蓋在角色上面


def inside_floor(x, y):
    inside = np.zeros_like(x, dtype=bool)
    for i in range(len(FLOOR)):
        (ax, ay), (bx, by) = FLOOR[i], FLOOR[i - 1]
        cross = (ay > y) != (by > y)
        with np.errstate(divide='ignore', invalid='ignore'):
            xi = (bx - ax) * (y - ay) / (by - ay) + ax
        inside ^= cross & (x < xi)
    return inside


def on_rim(x, y):
    front_gap = (np.abs(x - 627) < 39) & (y >= 601)
    outer = ((x - 627) / 163) ** 2 + ((y - 601) / 145) ** 2
    inner = ((x - 627) / 113) ** 2 + ((y - 601) / 95) ** 2
    return (outer < 1) & (inner > 1) & ~front_gap


def walkable(x, y):
    """原本 bridgeWalkable：腳點和上下左右四個探測點都在地板上、不在凸起邊緣上，腳底範圍不碰家具。"""
    ok = np.ones_like(x, dtype=bool)
    for dx, dy in ((0, 0), (-FOOT[0], 0), (FOOT[0], 0), (0, -FOOT[1]), (0, FOOT[1])):
        ok &= inside_floor(x + dx, y + dy) & ~on_rim(x + dx, y + dy)
    for rx, ry, rw, rh in OBSTACLES:
        ok &= ~((x + FOOT[0] > rx) & (x - FOOT[0] < rx + rw) & (y + FOOT[1] > ry) & (y - FOOT[1] < ry + rh))
    return ok


def collision():
    """能站的範圍 → 碰撞：離能站的地方超過腳圈半徑的取樣點就是「硬」的；整格都硬的記在格子，其他切橫條。"""
    ys, xs = np.mgrid[0:WH:STEP, 0:WW:STEP].astype(float) + STEP / 2
    free = walkable(xs / S, ys / S)
    hard = ndimage.distance_transform_edt(~free, sampling=STEP) > RADIUS
    cols, rows = -(-WW // T), -(-WH // T)
    grid = [[0] * cols for _ in range(rows)]
    per = T // STEP
    for ty in range(rows):
        for tx in range(cols):
            block = hard[ty * T // STEP:(ty + 1) * T // STEP, tx * T // STEP:(tx + 1) * T // STEP]
            if block.size and block.shape == (per, per) and block.all():
                grid[ty][tx] = 1
    # 整格擋掉的不用再切；剩下的每列連續一段當一條，上下列同一段就併起來
    rest = hard.copy()
    for ty in range(rows):
        for tx in range(cols):
            if grid[ty][tx]:
                rest[ty * per:(ty + 1) * per, tx * per:(tx + 1) * per] = False
    rects, open_runs = [], {}
    for r in range(rest.shape[0] + 1):
        row = rest[r] if r < rest.shape[0] else np.zeros(rest.shape[1], bool)
        runs, c = [], 0
        while c < len(row):
            if row[c]:
                start = c
                while c < len(row) and row[c]:
                    c += 1
                runs.append((start, c))
            else:
                c += 1
        nxt = {}
        for run in runs:
            nxt[run] = open_runs.pop(run, r)
        for (a, b), top in open_runs.items():
            rects.append({'x': round(a * STEP / T, 4), 'y': round(top * STEP / T, 4), 'w': round((b - a) * STEP / T, 4), 'h': round((r - top) * STEP / T, 4)})
        open_runs = nxt
    return grid, rects, free


def crop(name):
    file, box = ART[name]
    return Image.open(OUT / file).convert('RGBA').crop(box)


def place(name_or_img, rect):
    """原圖裁切後用最近鄰縮放到擺放範圍（世界 px），回傳圖與左上角。"""
    img = crop(name_or_img) if isinstance(name_or_img, str) else name_or_img
    x, y, w, h = rect
    return img.resize((round(w * S), round(h * S)), Image.NEAREST), (round(x * S), round(y * S))


def ellipse_mask(cx, cy, rx, ry):
    mask = Image.new('L', (WW, WH), 0)
    ImageDraw.Draw(mask).ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=255)
    return mask


def layer(img, at):
    canvas = Image.new('RGBA', (WW, WH), (0, 0, 0, 0))
    canvas.alpha_composite(img, at)
    return canvas


def build_ground():
    ground = Image.new('RGBA', (WW, WH), (9, 18, 28, 255))
    bg = crop('background').resize((round(1254 * S), round(1254 * S)), Image.NEAREST)
    ground.alpha_composite(bg.crop((0, 0, WW, WH)))
    # 井口（橢圓裡先填深色）
    well = Image.new('RGBA', (WW, WH), (7, 16, 30, 255))
    well.alpha_composite(layer(*place('well', (499, 487, 256, 226))))
    ground.paste(well, (0, 0), ellipse_mask(627, 601, 127, 106))
    # 外環後半、平台、外環前半（演出結束後的靜止狀態）
    ring = layer(*place('ring', (462, 452, 330, 300)))
    split = round(601 * S)
    back = ring.copy(); back.paste((0, 0, 0, 0), (0, split, WW, WH))
    ground.alpha_composite(back)
    platform_src = Image.open(OUT / 'elevator_platform.webp').convert('RGBA').crop(PLATFORM_SRC)
    platform = layer(*place(platform_src, PLATFORM_DST))
    clip = np.minimum(np.array(ellipse_mask(627, 601, 119, 101)), np.array(ellipse_mask(627, 601, 119, 98)))
    platform.putalpha(Image.fromarray(np.minimum(np.array(platform)[:, :, 3], clip).astype(np.uint8)))
    ground.alpha_composite(platform)
    front = ring.copy(); front.paste((0, 0, 0, 0), (0, 0, WW, split))
    ground.alpha_composite(front)
    # 家具影子（原本畫在每件家具前面，都在地上）
    shade = Image.new('RGBA', (WW, WH), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shade)
    for _, _, (x, y, w, h) in PIECES:
        cx, cy, rx, ry = (x + w / 2) * S, (y + h - 3) * S, w * .39 * S, 5 * S
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(4, 12, 24, round(.13 * 255)))
    ground.alpha_composite(shade)
    return ground, bg


def main():
    grid, rects, _ = collision()
    ground, bg = build_ground()
    ground.save(OUT / 'ground.webp', lossless=True)
    px, py, pw, ph = PARAPET
    bg.crop((round(px * S), round(py * S), round((px + pw) * S), round((py + ph) * S))).save(OUT / 'parapet.webp', lossless=True)
    (OUT / 'props').mkdir(exist_ok=True)
    decor = []
    for decor_id, art, rect in PIECES:
        img, _ = place(art, rect)
        img.save(OUT / 'props' / f'{decor_id}.webp', lossless=True)
        x, y, w, h = rect
        decor.append({'sprite': decor_id, 'id': decor_id, 'x': round((x + w / 2) * S / T, 4), 'y': round((y + h) * S / T, 4), 'scale': 1, 'size': list(img.size)})
    tile = lambda v: round(v * S / T, 4)
    interactions = [{
        'id': i, 'kind': kind, 'label': label, 'text': text if kind == 'info' else '',
        'area': [tile(v) for v in area], 'stand': [tile(stand[0]), tile(stand[1])],
        'near': [tile(stand[0] - NEAR), tile(stand[1] - NEAR), tile(2 * NEAR), tile(2 * NEAR)],
    } for i, label, kind, stand, area, text in INTERACTIONS]
    data = {
        'tileSize': T, 'width': len(grid[0]), 'height': len(grid), 'world': [WW, WH], 'speed': 160,
        'legend': {'0': '可行走', '1': '碰撞'},
        'note': '由 tools/art/bridge_map.py 產生，不要手改。素材座標 1254 × 1090 放大 1.5 倍；抵達演出、值勤人員、照明在 src/game/bridgeExtras.ts。',
        'collision': grid, 'collisionRects': rects,
        'entrances': [], 'arrivals': {'default': {'at': [tile(LANDING[0]), tile(LANDING[1])], 'facing': 'down'}},
        'interactions': interactions, 'decor': decor,
        'foreground': [{'src': 'parapet.webp', 'x': round(px * S), 'y': round(py * S)}],
    }
    (OUT / 'map.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    print(f'bridge-v3: {sum(map(sum, grid))} 格整格碰撞、{len(rects)} 塊矩形、{len(decor)} 件擺設、{len(interactions)} 個互動')


if __name__ == '__main__':
    main()
