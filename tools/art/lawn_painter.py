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
EDGE_SPACING = 20    # 水岸葉團間距（px）
EDGE_INSET = 12      # 葉團中心往草地內縮多少（px）；越小伸進水面越多
SHORE = 26           # 水面靠岸加深的寬度（px）
INNER_PER_TILE = .15 # 草地中間每格平均散放幾個葉團
SEED = 7
# 邊緣陰影（使用者 2026-10-02 要求拿掉，全設 0；要恢復原本的值：.22／.25／.3／.16）
EDGE_DARK = 0        # 草地靠水那一圈加深
SHORE_DARK = 0       # 靠岸的水加深
DROP_DARK = 0        # 草在水面上的投影
TIP_SHADOW = 0       # 草尖的右下投影
EDGE_CLUMPS = False  # 水岸與草地中間蓋葉團（2026-10-02 改用無描邊的淡彩小葉團 batch9，密密排成蓬鬆的草邊）
CLUMP_SCALE = .62    # 葉團整體縮放（素材約 70 px → 35 px，參考圖的草邊是一片片小葉子）
RIM = 'leaves'       # 草地的邊：'leaves'＝草地材質本身長出一圈細草尖（使用者 2026-10-02：邊緣是草不是葉子，現行）；
                     # 'clumps'＝小葉團排成蓬鬆草邊；'spill'＝草地材質淡淡漫過去
LEAF_STEP = 5        # 草叢間距（px），每叢 3–4 根草
LEAF_LEN = (12, 24)  # 草尖長度（px）
LEAF_LIGHT = 1.07    # 草尖比草地亮一點
RIM_SPACING = 19     # 草邊葉團間距（px），越小越密
RIM_OUT = (-6, 10)   # 葉團中心越過邊線伸進地磚幾 px（隨機）
SHADOW = .14         # 葉團的右下投影濃度

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
    tiled = tiled * (1 - EDGE_DARK * rim[..., None])
    base = np.asarray(img, np.float32)
    to_grass = ndimage.distance_transform_edt(grass < .5).astype(np.float32)          # 水面上每一點到草緣的距離
    shore = np.clip(1 - to_grass / SHORE, 0, 1) * (1 - grass)      # 靠岸的水比較深
    drop = np.roll(np.roll(grass, 7, 0), 6, 1)                      # 草往右下的投影
    drop = ndimage.gaussian_filter(drop, 4).astype(np.float32) * (1 - grass)
    base = base * (1 - (SHORE_DARK * shore + DROP_DARK * drop)[..., None])
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
    if EDGE_CLUMPS:
        stamps = [(y, x, 1.0) for y, x in points] + [(y, x, .7) for y, x in inner]
        stamps.sort(key=lambda s: s[0])                             # 下面的蓋在上面
        for y, x, scale in stamps: stamp(canvas, clumps, y, x, scale)
    print(f'lawn painted: {len(points) if EDGE_CLUMPS else 0} edge clumps, {len(inner) if EDGE_CLUMPS else 0} inner clumps')
    if RIM == 'leaves':                                             # 水岸也長一圈葉尖
        _leaf_rim(canvas, grass > .5, grass <= .5, tex_dir, 11)
    paint.water = grass < .5                                        # 畫面上實際的水面（給魚的遮罩用，見 facility_ground.water_mask）
    return canvas

def load_clumps(tex_dir):
    return [Image.open(p).convert('RGBA') for p in sorted(glob.glob(os.path.join(tex_dir, 'lawn_clumps', '*.png')))]

def stamp(canvas, clumps, y, x, scale, top=None):
    """蓋一個葉團：中心在 (x, y)；給 top 則改成讓葉團上緣對齊 top。隨機只看自己的位置。"""
    rng = np.random.default_rng([SEED, int(y if top is None else top), int(x)])
    c = clumps[rng.integers(len(clumps))]
    s = scale * CLUMP_SCALE * rng.uniform(.8, 1.15)
    c = c.resize((max(1, round(c.width * s)), max(1, round(c.height * s))), Image.LANCZOS)
    if rng.random() < .5: c = c.transpose(Image.FLIP_LEFT_RIGHT)
    px, py = int(x - c.width / 2), int(y - c.height / 2) if top is None else int(top)
    shadow = Image.new('RGBA', c.size, (0, 0, 0, 0))
    shadow.putalpha(c.getchannel('A').point(lambda a: int(a * SHADOW)))
    canvas.paste(shadow, (px + 4, py + 3), shadow)
    canvas.paste(c, (px, py), c)

SPILL_REACH = 54     # 草溢到地磚上最遠幾 px（實際距離由雜訊決定，形成不規則舌狀邊）
SPILL_GRAIN = 22     # 雜訊的平滑程度（px），越大舌狀邊越寬、越少
SPILL_ALPHA = .94    # 溢出去的草有多實（1＝完全蓋住地磚）
SPILL_RIM = .10      # 溢出邊緣那一圈淡淡變亮多少（參考圖的淡邊線）
MOSS_SPOTS = .985    # 地磚上零星苔痕的門檻（越接近 1 越少）
FRINGE_REACH = 24    # 走廊等覆蓋貼圖下緣，草往上溢多少

def _noise(shape, sigma, seed):
    """0–1 的平滑雜訊，用排名攤平，門檻比例才穩定。"""
    n = ndimage.gaussian_filter(np.random.default_rng([SEED, seed]).standard_normal(shape), sigma)
    return (np.argsort(np.argsort(n, axis=None)).reshape(shape) / n.size).astype(np.float32)

def _lawn_tile(tex_dir, W, H):
    field = np.asarray(Image.open(os.path.join(tex_dir, 'lawn_field.png')).convert('RGB'), np.float32)
    return np.tile(field, (H // field.shape[0] + 1, W // field.shape[1] + 1, 1))[:H, :W]

def _spill(canvas, lawn, target, reach, tex_dir, seed, spots=None):
    """lawn（草地，bool H×W）往 target（可以被草蓋的地方）溢出去：離草地 reach×雜訊 以內的地方鋪上同一張草地材質，
    邊緣羽化 1 px、加一圈淡淡的亮邊。spots 另外給零星苔痕的位置。半解析度算距離與雜訊，省時間。"""
    H, W = target.shape
    h2, w2 = H // 2, W // 2
    half = lambda a: np.asarray(Image.fromarray(a.astype(np.uint8) * 255).resize((w2, h2), Image.NEAREST)) > 127
    dist = ndimage.distance_transform_edt(~half(lawn)) * 2
    reach_map = reach * (.2 + .8 * _noise((h2, w2), SPILL_GRAIN / 2, seed) ** 1.4)   # 至少溢一點，原本的直線格子邊才看不出來
    m = (dist < reach_map) & half(target)
    if spots is not None: m |= half(spots)
    m = ndimage.binary_opening(m, iterations=1)                                   # 去掉一兩 px 的毛邊
    full = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((W, H), Image.BILINEAR), np.float32) / 255
    a = np.clip((full - .35) / .3, 0, 1)                                           # 羽化成 1–2 px 的軟邊
    rim = a * (1 - ndimage.minimum_filter(a, 5))                                  # 只在邊緣那一圈
    grass = _lawn_tile(tex_dir, W, H) * (1 + SPILL_RIM * rim[..., None])
    base = np.asarray(canvas, np.float32)
    out = base * (1 - SPILL_ALPHA * a[..., None]) + grass * (SPILL_ALPHA * a[..., None])
    canvas.paste(Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)))
    return int((a > .5).sum())

def _leaf_rim(canvas, lawn, target, tex_dir, seed):
    """草地（lawn）挨著 target 的邊長出一圈尖葉：沿邊每 LEAF_STEP 一片，朝外伸 LEAF_LEN，
    葉子裡填同一張草地材質（稍亮），沒有描邊，只有很淡的右下投影。回傳葉片數。"""
    from PIL import ImageDraw
    H, W = lawn.shape
    edge = lawn & ~ndimage.binary_erosion(lawn, iterations=2) & ndimage.binary_dilation(target, iterations=4)
    pts = spaced(np.argwhere(edge[::2, ::2]) * 2, LEAF_STEP, np.random.default_rng([SEED, seed]))
    d = ndimage.gaussian_filter(ndimage.distance_transform_edt(lawn).astype(np.float32) - ndimage.distance_transform_edt(~lawn).astype(np.float32), 4)
    gy, gx = np.gradient(d)
    leaf = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(leaf)
    for y, x in pts:
        r = np.random.default_rng([SEED, seed, int(y), int(x)])
        n = np.hypot(gy[y, x], gx[y, x]) or 1
        out = np.arctan2(-gy[y, x] / n, -gx[y, x] / n)                         # 朝草地外
        for k in range(r.integers(3, 5)):                                       # 一叢 3–4 根細草，扇形散開、微彎
            ang = out + r.uniform(-.75, .75)
            L = r.uniform(*LEAF_LEN); w = r.uniform(3, 4.6)
            ux, uy = np.cos(ang), np.sin(ang); vx, vy = -uy, ux
            bend = r.uniform(-.25, .25) * L
            bx, by = x - ux * 3 + r.uniform(-2, 2), y - uy * 3 + r.uniform(-2, 2)
            mx, my = bx + ux * L * .55 + vx * bend * .4, by + uy * L * .55 + vy * bend * .4
            tx, ty = bx + ux * L + vx * bend, by + uy * L + vy * bend
            dr.polygon([(bx + vx * w / 2, by + vy * w / 2), (mx + vx * w * .3, my + vy * w * .3), (tx, ty),
                        (mx - vx * w * .3, my - vy * w * .3), (bx - vx * w / 2, by - vy * w / 2)], fill=255)
    m = (np.asarray(leaf, np.float32) / 255) * (~lawn)
    shadow = ndimage.shift(m, (2, 2), order=0) * (1 - m) * TIP_SHADOW
    grass = _lawn_tile(tex_dir, W, H) * LEAF_LIGHT
    base = np.asarray(canvas, np.float32) * (1 - shadow[..., None])
    out = base * (1 - m[..., None]) + grass * m[..., None]
    canvas.paste(Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)))
    return len(pts)

def _rim(canvas, lawn, target, tex_dir, seed):
    """草地（lawn）挨著 target 的那條邊，密密排一圈小葉團（RIM_SPACING 一個），中心往 target 那側推 RIM_OUT。"""
    clumps = load_clumps(tex_dir)
    edge = lawn & ~ndimage.binary_erosion(lawn, iterations=2) & ndimage.binary_dilation(target, iterations=3)
    pts = spaced(np.argwhere(edge[::2, ::2]) * 2, RIM_SPACING, np.random.default_rng([SEED, seed]))
    dist_in = ndimage.distance_transform_edt(lawn)          # 推的方向：沿著草地距離的反梯度
    gy, gx = np.gradient(ndimage.gaussian_filter(dist_in.astype(np.float32), 3))
    stamps = []
    for y, x in pts:
        r = np.random.default_rng([SEED, seed, int(y), int(x)])
        n = np.hypot(gy[y, x], gx[y, x]) or 1
        out = r.uniform(*RIM_OUT)
        stamps.append((int(y - gy[y, x] / n * out), int(x - gx[y, x] / n * out), r.uniform(.7, 1.1)))
    stamps.sort(key=lambda s: s[0])
    for y, x, s in stamps: stamp(canvas, clumps, y, x, s)
    return len(stamps)

def fringe(canvas, terrain, T, tex_dir, edge_y, x0, x1, overlap=FRINGE_REACH):
    """覆蓋貼圖（例如玻璃走廊）的下緣：下方是草地的地方，草淡淡往上溢 overlap px。"""
    if not available(tex_dir): return
    W, H = canvas.size
    row = edge_y // T
    lawn = np.zeros((H, W), bool); target = np.zeros((H, W), bool)
    for x in range(len(terrain[0])):
        if 0 <= row < len(terrain) and terrain[row][x] == 'G' and x0 <= x * T < x1:
            lawn[edge_y:edge_y + T, x * T:(x + 1) * T] = True
    target[max(0, edge_y - overlap):edge_y, x0:x1] = True
    n = _leaf_rim(canvas, lawn, target, tex_dir, 21) if RIM == 'leaves' else _rim(canvas, lawn, target, tex_dir, 21) if RIM == 'clumps' else _spill(canvas, lawn, target, overlap, tex_dir, 21)
    print(f'grass fringe: {n} px along y={edge_y}')

def creep(canvas, terrain, T, tex_dir, paved, wall, hidden=frozenset()):
    """草漫到地磚上（淡彩、無描邊）：草地挨著地磚的地方，草地材質依雜訊溢出成不規則的舌狀，邊緣淡淡的；
    牆腳與開放地磚上零星幾塊苔痕。hidden（被擺設蓋住的格子）、外牆不畫。"""
    if not available(tex_dir): return
    W, H = canvas.size
    rows, cols = len(terrain), len(terrain[0])
    cell = lambda pred: np.kron(np.array([[pred(x, y) for x in range(cols)] for y in range(rows)], bool), np.ones((T, T), bool))[:H, :W]
    lawn = cell(lambda x, y: terrain[y][x] == 'G')
    target = cell(lambda x, y: terrain[y][x] in paved and not wall(x, y) and (x, y) not in hidden)
    near_wall = cell(lambda x, y: terrain[y][x] in paved and (x, y) not in hidden and not wall(x, y) and (wall(x - 1, y) or wall(x + 1, y)))
    h2, w2 = H // 2, W // 2
    up = lambda a: np.asarray(Image.fromarray(a.astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 127
    spots = target & up((_noise((h2, w2), 4, 33) > MOSS_SPOTS) & (_noise((h2, w2), 30, 34) > .7)) | (target & near_wall & up(_noise((h2, w2), 4, 35) > MOSS_SPOTS - .01))
    if RIM == 'leaves':
        n = _leaf_rim(canvas, lawn, target, tex_dir, 32)
        print(f'grass creep: {n} leaf tips'); return
    if RIM == 'clumps':
        n = _rim(canvas, lawn, target, tex_dir, 32)
        print(f'grass creep: {n} rim clumps'); return
    n = _spill(canvas, lawn, target, SPILL_REACH, tex_dir, 32, spots)
    print(f'grass creep: {n} px of spill')

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
