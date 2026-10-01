"""溫室種植架外框：從 greenhouse_rack_base.png（左端／中段／右端各 48 px）拼成一整排 12 格，
輸出兩種空架，作物由遊戲依生長階段疊上去：

- rack_shelf.png   層架：三層托盤，開口補深色背板。
- rack_trellis.png 藤架：保留頂框與最下層托盤，中間拆空，每株一根木支柱（支柱屬於架子，一開始就架好）。
- racks.json       作物擺放位置（素材像素，遊戲裡放大 2 倍畫：一排 576×144 → 12×3 格）。

rack_shelf.png／rack_trellis.png 產生後使用者手動修過細節（改得更對稱，尺寸與層高、支柱位置不變），
所以預設不覆蓋已存在的圖，只重寫 racks.json；真的要從頭重產才加 --force（手修的部分會不見）。
"""
import json
import numpy as np
from collections import deque
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/greenhouse'
SEG, CELLS = 48, 12
BACK = (30, 40, 44)                  # 層架開口裡的深色背板
TIERS = [(24, 46), (58, 80), (93, 115)]   # 每層（開口頂, 托盤底線）
X0, X1 = 19, SEG * CELLS - 20        # 左右立柱內側
STAKE_TOP, STAKE_BASE = 26, 115      # 藤架支柱上下端；作物底線 = STAKE_BASE
STAKE_W = 5                          # 比作物圖扣掉的支柱寬（約 4.5 px）略寬，接縫不露底
STAKE_GAP = 64                       # 支柱間距 = 每株作物寬
WOOD = [(92, 58, 34), (138, 92, 52), (170, 120, 70)]


def base_row():
    src = np.array(Image.open(Path(__file__).with_name('greenhouse_rack_base.png')).convert('RGB')).astype(np.int32)
    H, W = src.shape[:2]
    alpha = np.full((H, W), 255, np.uint8)
    near = src.min(axis=2) >= 244                  # 白底從外框往內 flood fill 成透明
    seen = np.zeros((H, W), bool)
    q = deque([(y, x) for x in range(W) for y in (0, H - 1)] + [(y, x) for y in range(H) for x in (0, W - 1)])
    while q:
        y, x = q.popleft()
        if not (0 <= y < H and 0 <= x < W) or seen[y, x] or not near[y, x]: continue
        seen[y, x] = True; alpha[y, x] = 0
        q.extend([(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)])
    cols = list(range(0, SEG)) + list(range(SEG, 2 * SEG)) * (CELLS - 2) + list(range(2 * SEG, 3 * SEG))
    return src[:, cols].copy(), alpha[:, cols].copy()


def fill_openings(rgb, alpha, rows):
    """開口裡還沒被 flood fill 掉的白底（被托盤圍住）一樣補成背板。"""
    for top, bottom in rows:
        blk = rgb[top:bottom, X0:X1 + 1]
        white = (blk.min(axis=2) >= 220) | (alpha[top:bottom, X0:X1 + 1] == 0)
        blk[white] = BACK
        alpha[top:bottom, X0:X1 + 1][white] = 255


def shelf():
    rgb, alpha = base_row()
    fill_openings(rgb, alpha, [(t, t + 10) for t, _ in TIERS])
    return rgb, alpha


def trellis():
    rgb, alpha = base_row()
    # 中間兩層托盤拆掉：頂框燈條以下到最下層托盤之間，立柱內側全補背板
    y0, y1 = TIERS[0][0], TIERS[2][0] + 8
    rgb[y0:y1, X0:X1 + 1] = BACK; alpha[y0:y1, X0:X1 + 1] = 255
    n = (X1 - X0) // STAKE_GAP
    pad = (X1 - X0 - n * STAKE_GAP) // 2
    stakes = [X0 + pad + STAKE_GAP // 2 + i * STAKE_GAP for i in range(n)]
    for sx in stakes:
        l = sx - STAKE_W // 2
        for dx in range(STAKE_W):
            c = WOOD[0] if dx in (0, STAKE_W - 1) else WOOD[2] if dx == 1 else WOOD[1]
            rgb[STAKE_TOP:STAKE_BASE + 2, l + dx] = c; alpha[STAKE_TOP:STAKE_BASE + 2, l + dx] = 255
    for wy in (52, 84):                  # 支柱之間拉兩條細鋼索
        rgb[wy, X0:X1 + 1] = (150, 160, 164); alpha[wy, X0:X1 + 1] = 255
    return (rgb, alpha), stakes


def save(name, rgb, alpha):
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha]), 'RGBA').save(OUT / name)


if __name__ == '__main__':
    import sys
    force = '--force' in sys.argv
    (t_rgb, t_alpha), stakes = trellis()
    for name, img in (('rack_shelf.png', shelf()), ('rack_trellis.png', (t_rgb, t_alpha))):
        if force or not (OUT / name).exists(): save(name, *img)
        else: print(f'{name} 已存在（使用者手修過），不覆蓋；要重產請加 --force')
    meta = {
        'scale': 2, 'width': SEG * CELLS, 'height': 144,
        'shelf': {'x0': X0, 'x1': X1, 'baselines': [b + 1 for _, b in TIERS], 'maxHeight': 22},
        'trellis': {'x0': X0, 'x1': X1, 'baseline': STAKE_BASE + 1, 'stakes': stakes},
    }
    (OUT / 'racks.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')
    print('stakes', stakes)
