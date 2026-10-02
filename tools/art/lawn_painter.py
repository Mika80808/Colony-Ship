"""草地「遮罩＋葉團」畫法（取代 autotile，給 facility_ground.py 用）。

地面是事先拼好的一整張圖，所以草地不用受 autotile 的限制：
1. 草地範圍＝所有不是水的格子（步道、土壤等之後會蓋在草上）。把水的格子放大到整張圖後模糊、
   加一點低頻雜訊再取門檻 → 圓滑、自然起伏的水岸，圓角大小由 ROUND 決定。
   （畫面上的水岸會比碰撞格圓一點；葉團只會伸進水面，不會讓可走的格子看起來像水。）
2. 大片草地材質（lawn_field.png）鋪滿，只露出在草地範圍內；水岸內側稍微加深，水面上有草的投影。
3. 沿水岸每隔 EDGE_SPACING 蓋一個葉團（lawn_clumps/*.png 隨機挑、隨機縮放與左右翻轉），
   葉團下方在水面上投影；草地中間也零星散放小葉團，打破材質的重複感。
隨機種子固定，同樣的輸入每次拼出一樣的結果；而且每個葉團的隨機只看它自己的位置，
改一小塊地圖只會影響附近，不會讓整張圖的葉團全部重洗。
"""
import os, glob
import numpy as np
from PIL import Image
from scipy import ndimage

ROUND = 26           # 水岸圓角的模糊半徑（px）；越大越圓
WOBBLE = .12         # 水岸起伏幅度
EDGE_SPACING = 30    # 水岸葉團間距（px）
EDGE_INSET = 12      # 葉團中心往草地內縮多少（px）；越小伸進水面越多
SHORE = 26           # 水面靠岸加深的寬度（px）
INNER_PER_TILE = .25 # 草地中間每格平均散放幾個葉團
FRINGE_OVERLAP = 20  # 走廊等覆蓋貼圖下緣，草尖往上蓋過邊線幾 px
SEED = 7

def available(tex_dir):
    return os.path.exists(os.path.join(tex_dir, 'lawn_field.png')) and glob.glob(os.path.join(tex_dir, 'lawn_clumps', '*.png'))

def paint(img, terrain, T, tex_dir):
    W, H = img.size
    # 1. 水岸：半解析度算，省時間
    hw, hh = W // 2, H // 2
    water = np.array([[c == 'A' for c in row] for row in terrain], np.float32)
    v = np.asarray(Image.fromarray(water * 255).resize((hw, hh), Image.NEAREST), np.float32) / 255
    v = ndimage.gaussian_filter(v, ROUND / 2)
    noise = ndimage.gaussian_filter(np.random.default_rng([SEED, 0]).standard_normal((hh, hw)), 10)
    v = v + WOBBLE * noise / noise.std()
    v = np.asarray(Image.fromarray(v.astype(np.float32)).resize((W, H), Image.BILINEAR), np.float32)
    grass = np.clip((.5 - v) / .03, 0, 1).astype(np.float32)        # 1 草、0 水，邊緣 1~2px 漸變（整張圖很大，全程用 float32 省記憶體）

    # 2. 草地材質＋水岸明暗
    field = Image.open(os.path.join(tex_dir, 'lawn_field.png')).convert('RGB')
    tiled = np.tile(np.asarray(field, np.float32), (H // field.height + 1, W // field.width + 1, 1))[:H, :W]
    rim = np.clip((v - .3) / .2, 0, 1) * grass                      # 草緣內側加深
    tiled = tiled * (1 - .22 * rim[..., None])
    base = np.asarray(img, np.float32)
    to_grass = ndimage.distance_transform_edt(grass < .5).astype(np.float32)          # 水面上每一點到草緣的距離
    shore = np.clip(1 - to_grass / SHORE, 0, 1) * (1 - grass)      # 靠岸的水比較深
    drop = np.roll(np.roll(grass, 7, 0), 6, 1)                      # 草往右下的投影
    drop = ndimage.gaussian_filter(drop, 4).astype(np.float32) * (1 - grass)
    base = base * (1 - (.25 * shore + .3 * drop)[..., None])
    out = tiled * grass[..., None] + base * (1 - grass[..., None])
    canvas = Image.fromarray(out.round().astype(np.uint8))

    # 3. 葉團
    clumps = load_clumps(tex_dir)
    inset = ndimage.binary_erosion(grass > .5, iterations=EDGE_INSET)
    edge = inset & ~ndimage.binary_erosion(inset, iterations=2)
    points = spaced(np.argwhere(edge), EDGE_SPACING, np.random.default_rng([SEED, 1]))
    visible = np.array([[c == 'G' for c in row] for row in terrain], bool)
    vis = np.asarray(Image.fromarray(visible).resize((W, H), Image.NEAREST))
    vis = ndimage.binary_erosion(vis, iterations=36) & (grass > .99)
    cand = np.argwhere(vis[::8, ::8]) * 8
    # 每個候選點（8px 一個，每格 144 個）依自己座標的雜湊決定要不要放，密度 INNER_PER_TILE
    h = (cand[:, 0].astype(np.uint64) * 73856093 ^ cand[:, 1].astype(np.uint64) * 19349663 ^ SEED * 83492791) % 1000003 / 1000003
    inner = cand[h < INNER_PER_TILE / 144]
    stamps = [(y, x, 1.0) for y, x in points] + [(y, x, .7) for y, x in inner]
    stamps.sort(key=lambda s: s[0])                                 # 下面的蓋在上面
    for y, x, scale in stamps: stamp(canvas, clumps, y, x, scale)
    print(f'lawn painted: {len(points)} edge clumps, {len(inner)} inner clumps')
    return canvas

def load_clumps(tex_dir):
    return [Image.open(p).convert('RGBA') for p in sorted(glob.glob(os.path.join(tex_dir, 'lawn_clumps', '*.png')))]

def stamp(canvas, clumps, y, x, scale, top=None):
    """蓋一個葉團：中心在 (x, y)；給 top 則改成讓葉團上緣對齊 top。隨機只看自己的位置。"""
    rng = np.random.default_rng([SEED, int(y if top is None else top), int(x)])
    c = clumps[rng.integers(len(clumps))]
    s = scale * rng.uniform(.8, 1.15)
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    if rng.random() < .5: c = c.transpose(Image.FLIP_LEFT_RIGHT)
    px, py = int(x - c.width / 2), int(y - c.height / 2) if top is None else int(top)
    shadow = Image.new('RGBA', c.size, (0, 0, 0, 0))
    shadow.putalpha(c.getchannel('A').point(lambda a: int(a * .3)))
    canvas.paste(shadow, (px + 6, py + 5), shadow)
    canvas.paste(c, (px, py), c)

def fringe(canvas, terrain, T, tex_dir, edge_y, x0, x1, overlap=FRINGE_OVERLAP):
    """沿一條水平邊（例如走廊下緣）補一排葉團，草尖往上蓋過邊線 overlap px；邊下方是草地的地方才放。"""
    if not available(tex_dir): return
    clumps = load_clumps(tex_dir)
    row = edge_y // T
    n = 0
    for x in range(x0 + EDGE_SPACING // 2, x1, EDGE_SPACING):
        if 0 <= row < len(terrain) and terrain[row][x // T] == 'G':
            stamp(canvas, clumps, 0, x, 1.0, top=edge_y - overlap); n += 1
    print(f'grass fringe: {n} clumps along y={edge_y}')

CREEP_SPACING = 30   # 草地挨著地磚的邊上，葉團間距（px）
CREEP_INTO = (-4, 22) # 葉團中心越過邊線、伸進地磚幾 px（隨機；負的＝縮回草地，邊上留缺口）
CREEP_SKIP = .25     # 每個位置不放的機率，邊不會像修剪過的樹籬
CREEP_SCALE = (.5, .85)
WALL_TUFT = .45      # 牆腳小草叢的縮放
WALL_CHANCE = .4     # 每格牆腳長草的機率
SEAM_TUFT = .26      # 地磚接縫小草叢的縮放
SEAM_CHANCE = .07    # 每格地磚（非遮擋處）在角落長一小撮草的機率

def creep(canvas, terrain, T, tex_dir, paved, wall, hidden=frozenset()):
    """草侵入地磚：
    1. 草地挨著地磚（paved 裡的地面）的邊上一排葉團，草尖蓋過邊線，直線邊不再那麼整齊；
    2. 地磚挨著外牆（wall(x, y) 為真）的牆腳零星小草叢；
    3. 開放地磚的接縫零星一小撮草。hidden 是被擺設蓋住的格子，不用浪費在那裡。
    位置隨機只看自己的座標，改地圖只影響附近。"""
    if not available(tex_dir): return
    clumps = load_clumps(tex_dir)
    H, W = len(terrain), len(terrain[0])
    at = lambda x, y: terrain[y][x] if 0 <= x < W and 0 <= y < H else None
    rnd = lambda *k: np.random.default_rng([SEED, 9, *k])
    stamps = []
    for y in range(H):
        for x in range(W):
            c = at(x, y)
            if c == 'G':
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if at(x + dx, y + dy) not in paved or wall(x + dx, y + dy): continue
                    # 邊線中點往地磚那側推 CREEP_INTO，沿邊每 CREEP_SPACING 一個，帶一點抖動
                    n = max(1, round(T / CREEP_SPACING))
                    for i in range(n):
                        r = rnd(x, y, dx + 2, dy + 2, i)
                        if r.random() < CREEP_SKIP: continue
                        t, into = (i + .5) / n * T + r.uniform(-8, 8), r.uniform(*CREEP_INTO)
                        cx = x * T + (T if dx > 0 else 0 if dx < 0 else t) + dx * into
                        cy = y * T + (T if dy > 0 else 0 if dy < 0 else t) + dy * into
                        stamps.append((cy, cx, r.uniform(*CREEP_SCALE)))
            elif c in paved and not wall(x, y) and (x, y) not in hidden:
                for dx in (-1, 1):
                    if wall(x + dx, y) and rnd(x, y, 5, dx + 2).random() < WALL_CHANCE:
                        r = rnd(x, y, 6, dx + 2)
                        stamps.append((y * T + r.uniform(.2, .9) * T, x * T + (0 if dx < 0 else T) - dx * 10, WALL_TUFT * r.uniform(.8, 1.2)))
                r = rnd(x, y, 7)
                if r.random() < SEAM_CHANCE:
                    stamps.append((y * T + r.choice([0, T]) + r.uniform(-4, 4), x * T + r.choice([0, T]) + r.uniform(-4, 4), SEAM_TUFT * r.uniform(.8, 1.2)))
    stamps.sort(key=lambda s: s[0])
    for y, x, scale in stamps: stamp(canvas, clumps, int(y), int(x), scale)
    print(f'grass creep: {len(stamps)} clumps')

def spaced(pts, spacing, rng):
    """從候選點裡挑出彼此至少相距 spacing 的點（隨機順序，格子雜湊加速）。"""
    pts = pts[rng.permutation(len(pts))]
    grid, keep = {}, []
    for y, x in pts:
        gy, gx = y // spacing, x // spacing
        ok = True
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for qy, qx in grid.get((gy + dy, gx + dx), ()):
                    if (qy - y) ** 2 + (qx - x) ** 2 < spacing ** 2: ok = False; break
                if not ok: break
            if not ok: break
        if ok:
            grid.setdefault((gy, gx), []).append((y, x)); keep.append((y, x))
    return keep
