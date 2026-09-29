"""挑高藤架（空架）：沿用三層架的外框，拿掉中間兩層，只留底部種植槽，
中間從頂部橫樑垂下吊線，讓藤蔓順著往上爬。輸出左端／中段／右端各 48×144，中段可無限重複。"""
import numpy as np
from PIL import Image
from collections import deque
from pathlib import Path

SEG = 48
HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parents[1] / 'public/assets/greenhouse'
src = np.array(Image.open(HERE / 'greenhouse_rack_base.png').convert('RGB')).astype(np.int32)
H = src.shape[0]

# 外圍白底去背（與三層架同一套）
alpha = np.full(src.shape[:2], 255, np.uint8)
near = src.min(axis=2) >= 244
seen = np.zeros(src.shape[:2], bool)
q = deque([(y, x) for x in range(144) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, 143)])
while q:
    y, x = q.popleft()
    if not (0 <= y < H and 0 <= x < 144) or seen[y, x] or not near[y, x]: continue
    seen[y, x] = True; alpha[y, x] = 0
    q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
for y in range(H):                      # 中段每列全透明或全不透明，重複時不出現缺口
    if 0 < (alpha[y, 48:96] == 0).sum() < 24:
        for x in range(48, 96):
            if alpha[y, x] == 0: alpha[y, x] = 255; src[y, x] = src[y, x - 1]

OPEN_TOP, OPEN_BOT = 25, 99             # 頂部燈條下緣到底部種植槽上緣
IN_L, IN_R = 16, 127                    # 立柱內緣；這段裡原本是層板與卡扣
CLEAN = 28                              # 這一列只有立柱、沒有層板，拿來補立柱內緣
out = src.copy()
for y in range(OPEN_TOP, OPEN_BOT + 1):
    out[y, IN_L:20] = src[CLEAN, IN_L:20]; alpha[y, IN_L:20] = alpha[CLEAN, IN_L:20]
    out[y, 124:IN_R] = src[CLEAN, 124:IN_R]; alpha[y, 124:IN_R] = alpha[CLEAN, 124:IN_R]
    alpha[y, 20:124] = 0
    for x in list(range(IN_L, 20)) + list(range(124, IN_R)):   # 補來的那列帶到層板間的白底
        if out[y, x].min() >= 220: alpha[y, x] = 0

# 吊線：每 24 px 一條（每段 2 條，週期 48），頂端掛鉤、底端綁在種植槽
WIRE, HOOK = (176, 184, 190), (96, 102, 110)
def px(y, x, c, a=255):
    out[y, x] = c; alpha[y, x] = a
for x in range(20, 124):
    if x % 24 != 12: continue
    for dx in (-1, 0, 1): px(OPEN_TOP, x + dx, HOOK)
    px(OPEN_TOP + 1, x, HOOK)
    for y in range(OPEN_TOP + 2, OPEN_BOT + 2):
        px(y, x, WIRE, 200)
    px(OPEN_BOT + 1, x, HOOK)

rgba = Image.fromarray(np.dstack([np.clip(out, 0, 255).astype(np.uint8), alpha]), 'RGBA')
L = rgba.crop((0, 0, SEG, H)); M = rgba.crop((SEG, 0, 2 * SEG, H)); R = rgba.crop((2 * SEG, 0, 3 * SEG, H))
for name, im in (('left', L), ('mid', M), ('right', R)):
    im.save(OUT_DIR / f'farm_rack_trellis_{name}.png')
rgba.save(OUT_DIR / 'farm_rack_trellis.png')
