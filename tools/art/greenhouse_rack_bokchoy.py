"""青江菜栽種架：左端柱 / 中段（可無限重複）/ 右端柱，各 48×144。
植株排列以 48 px 為週期，所以任意段數接起來都無縫。"""
import numpy as np, random, math
from PIL import Image
from collections import deque
from pathlib import Path
OUT_DIR = Path(__file__).resolve().parents[2] / 'public/assets/greenhouse'
SEG = 48
src = np.array(Image.open(Path(__file__).with_name('greenhouse_rack_base.png')).convert('RGB')).astype(np.int32)
H = src.shape[0]
alpha0 = np.full(src.shape[:2], 255, np.uint8)
near = src.min(axis=2) >= 244
seen = np.zeros(src.shape[:2], bool)
q = deque([(y, x) for x in range(144) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, 143)])
while q:
    y, x = q.popleft()
    if not (0 <= y < H and 0 <= x < 144) or seen[y, x] or not near[y, x]: continue
    seen[y, x] = True; alpha0[y, x] = 0
    q.extend([(y+1, x), (y-1, x), (y, x+1), (y, x-1)])

# 中段每一橫列要嘛全透明、要嘛全不透明，避免重複時出現規律的缺口
for y in range(H):
    seg = alpha0[y, 48:96]
    if 0 < (seg == 0).sum() < 24:
        for x in range(48, 96):
            if alpha0[y, x] == 0: alpha0[y, x] = 255; src[y, x] = src[y, x - 1]
N_MID = 26 - 2                      # 一排 13 格地圖 = 26 段
cols = list(range(0, 48)) + list(range(48, 96)) * N_MID + list(range(96, 144))
out = src[:, cols].copy(); alpha = alpha0[:, cols].copy()
W = out.shape[1]
tiers = [(25, 46), (59, 80), (94, 115)]
X0, X1 = 19, W - 20
GAP = (20, 36, 26)
STEM = [(120, 146, 104), (184, 206, 158), (226, 238, 206), (246, 250, 234)]
LEAF = [(22, 58, 34), (40, 92, 48), (62, 128, 58), (96, 164, 74), (150, 204, 104)]

def put(y, x, c, top, bottom):
    if top <= y <= bottom and X0 <= x <= X1:
        out[y, x] = c; alpha[y, x] = 255

def plant(bx, by, s, top, bottom, rnd, dim=1.0):
    pal_l = [tuple(int(v * dim) for v in c) for c in LEAF]
    pal_s = [tuple(int(v * dim) for v in c) for c in STEM]
    n = 5
    angs = sorted([-90 + (i - (n - 1) / 2) * 16 + rnd.uniform(-5, 5) for i in range(n)], key=lambda t: -abs(t + 90))
    for t in angs:
        th = math.radians(t); ux, uy = math.cos(th), math.sin(th)
        spread = abs(t + 90) / 32
        Ls = s * (0.42 - 0.08 * spread); Lb = s * (0.62 - 0.1 * spread); Wb = s * 0.2
        mx, my = bx + ux * (Ls + Lb * .5), by + uy * (Ls + Lb * .5)
        for y in range(int(my - Lb), int(my + Lb) + 1):
            for x in range(int(mx - Lb), int(mx + Lb) + 1):
                dx, dy = x + .5 - mx, y + .5 - my
                u = (dx * ux + dy * uy) / (Lb * .5); v = (-dx * uy + dy * ux) / Wb
                d = u * u + v * v
                if d > 1: continue
                lit = -(dx * .7 + dy * .7) / Wb
                if d > .7: c = pal_l[0]
                elif abs(v) < .2 and u < .6: c = pal_s[2] if u < -.2 else pal_l[4]
                elif lit > .5: c = pal_l[4]
                elif lit > 0: c = pal_l[3]
                elif lit > -.6: c = pal_l[2]
                else: c = pal_l[1]
                put(y, x, c, top, bottom)
        steps = int(Ls * 2) + 2
        for k in range(steps + 1):
            f = k / steps
            px, py = bx + ux * Ls * f, by + uy * Ls * f
            half = 1.6 * (1 - f) + 0.7
            for o in np.arange(-half, half + .01, .5):
                x = int(px + (-uy) * o); y = int(py + ux * o)
                edge = abs(o) > half - .6
                c = pal_s[0] if edge and o > 0 else pal_s[1] if o > 0.3 else pal_s[3] if o < -.3 else pal_s[2]
                put(y, x, c, top, bottom)

STEP = 12                             # 每段 4 株，週期 48
for ti, (top, lip) in enumerate(tiers):
    out[top:lip + 1, X0:X1 + 1] = GAP; alpha[top:lip + 1, X0:X1 + 1] = 255
    for row, (off, by, size, dim, bot) in enumerate([(6, lip - 2, 24, .72, lip), (0, lip + 2, 21, 1.0, lip + 2)]):
        for x in range(off - SEG, W + SEG, STEP):
            k = (x // STEP) % (SEG // STEP)   # 同一週期位置 → 同一株的長相
            rnd = random.Random(ti * 100 + row * 10 + k)
            jx = rnd.uniform(-1, 1); js = rnd.uniform(-2, 1.5)
            plant(x + jx, by, size + js, top, bot, rnd, dim)

rgba = np.dstack([np.clip(out, 0, 255).astype(np.uint8), alpha])
A = rgba.copy()
for y in range(1, H - 1):
    for x in range(1, W - 1):
        if A[y, x, 3] and (A[y-1:y+2, x-1:x+2, 3] > 0).sum() <= 2: A[y, x, 3] = 0
row = Image.fromarray(A, 'RGBA')
mid_at = SEG * (1 + N_MID // 2)
row.crop((0, 0, SEG, H)).save(OUT_DIR / 'farm_rack_bokchoy_left.png')
row.crop((mid_at, 0, mid_at + SEG, H)).save(OUT_DIR / 'farm_rack_bokchoy_mid.png')
row.crop((W - SEG, 0, W, H)).save(OUT_DIR / 'farm_rack_bokchoy_right.png')

# 驗證：用三段重新拼一排，應與整排渲染逐像素相同
L, M, R = (np.array(Image.open(OUT_DIR / f'farm_rack_bokchoy_{n}.png')) for n in ('left', 'mid', 'right'))
re = np.concatenate([L] + [M] * N_MID + [R], axis=1)
print('seamless:', np.array_equal(re[:, SEG:W - SEG], A[:, SEG:W - SEG]), 'ends:', np.array_equal(re, A))
Image.fromarray(np.concatenate([L, M, R], axis=1)).save(OUT_DIR / 'farm_rack_bokchoy.png')
