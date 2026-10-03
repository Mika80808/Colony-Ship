"""溫室作物：把 tools/art/crops/raw/<作物>.webp（GPT 生的三階段 1536×1024 透明圖；還沒轉檔的 .png 也讀得到）
切成三張生長階段小圖 public/assets/greenhouse/crops/<作物>_<1|2|3>.webp。

- 三階段在原圖大約各佔三分之一；切點取 512／1024 附近最空的那一欄，不靠固定間距。
- 藤架作物的支柱在原圖是純青色 #00FFFF（照 crops/stake_template.png 畫），這裡扣成透明，
  遊戲裡由藤架貼圖的支柱補上；支柱中心就是每張小圖的 anchor x（寫進 crops.json）。
- 同一種作物三階段用同一個縮放比例，生長比例不變：層架作物以可採收那階段塞滿一層開口為準；
  藤架作物以支柱長度對齊藤架貼圖的支柱為準，底線固定在支柱底端。
- 輸出為素材原生像素（遊戲裡放大 2 倍畫，跟種植架一樣）。
"""
import json
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'tools/art/crops/raw'
OUT = ROOT / 'public/assets/greenhouse/crops'
SHELF_H = 22          # 層架每層開口高度（素材像素）
STAKE_ART = (26, 116)        # 藤架貼圖的支柱上下端（素材像素），見 greenhouse_racks.py
# GPT 不會完全照模板（crops/stake_template.png）的位置畫支柱，所以每張圖實際量：支柱中心、頂端、底端（= 植株底線）。
TRELLIS = {'pea', 'cherry_tomato', 'dwarf_lemon', 'grape', 'passion_fruit'}


def cyan_mask(a):
    """純青色支柱與它的反鋸齒邊。"""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    return (a[..., 3] > 0) & (g > 150) & (b > 150) & (r < 110) & (np.abs(g - b) < 60)


def measure_stake(cyan, plant, x0, x1):
    """某一階段（x0–x1 欄）的支柱：中心欄、頂端列、底端列（支柱底端或植株底，取較低者）。"""
    band = cyan[:, x0:x1]
    cols = np.where(band.sum(0) > 50)[0] + x0
    cx = int(round(cols.mean()))
    rows = np.where(cyan[:, cx - 3:cx + 4].any(1))[0]
    near = plant[:, max(0, cx - 60):cx + 60]
    bottom = max(rows.max(), np.where(near.any(1))[0].max())
    return cx, rows.min(), bottom + 1


def split(mask):
    occ = mask.sum(0)
    cuts = []
    for c in (512, 1024):
        lo, hi = c - 160, c + 160
        cuts.append(lo + int(np.argmin(occ[lo:hi])))
    return [(0, cuts[0]), (cuts[0], cuts[1]), (cuts[1], mask.shape[1])]


def shrink(im, f):
    w, h = max(1, round(im.width * f)), max(1, round(im.height * f))
    small = np.array(im.resize((w, h), Image.BOX))
    small[..., 3] = np.where(small[..., 3] >= 110, 255, 0)
    return Image.fromarray(small, 'RGBA')


def raw_path(name):
    """原圖轉成無損 WebP 後優先讀 .webp；還沒轉的仍讀 .png。"""
    webp = RAW / f'{name}.webp'
    return webp if webp.exists() else RAW / f'{name}.png'


def process(name):
    a = np.array(Image.open(raw_path(name)).convert('RGBA'))
    trellis = name in TRELLIS
    if trellis:
        cyan = cyan_mask(a)
        a[cyan, 3] = 0
    mask = a[..., 3] > 128
    stages = []
    for i, (x0, x1) in enumerate(split(mask)):
        sub = mask[:, x0:x1]
        ys, xs = np.where(sub)
        box = (x0 + xs.min(), ys.min(), x0 + xs.max() + 1, ys.max() + 1)
        stages.append(box)
    if trellis:
        stakes = [measure_stake(cyan, mask, x0, x1) for x0, x1 in split(mask | cyan)]
        f = (STAKE_ART[1] - STAKE_ART[0]) / float(np.median([b - t for _, t, b in stakes]))
    else:
        base = max(b[3] for b in stages)                 # 共同底線
        f = SHELF_H / max(base - b[1] for b in stages)
    meta = []
    im = Image.fromarray(a, 'RGBA')
    for i, (l, t, r, b) in enumerate(stages):
        if trellis:                                      # 以支柱為中心左右對稱取框，anchor 就在正中；底邊是支柱底
            cx, top, b = stakes[i]
            half = max(cx - l, r - cx)
            l, r, t = cx - half, cx + half, min(t, b - round((STAKE_ART[1] - STAKE_ART[0]) / f))
        else:
            b = base
        crop = im.crop((l, t, r, b))
        small = shrink(crop, f)
        bb = small.getbbox()
        if not trellis and bb:                           # 層架作物修掉縮圖後左右多出的空欄
            small = small.crop((bb[0], 0, bb[2], small.height))
        small.save(OUT / f'{name}_{i + 1}.webp', lossless=True)
        meta.append({'w': small.width, 'h': small.height, 'anchor': small.width // 2})
    return {'kind': 'trellis' if trellis else 'shelf', 'stages': meta}


if __name__ == '__main__':
    import sys
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / 'crops.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {}
    names = sys.argv[1:] or sorted({p.stem for p in RAW.glob('*') if p.suffix in ('.webp', '.png')})
    for n in names:
        manifest[n] = process(n)
        print(n, [(s['w'], s['h']) for s in manifest[n]['stages']])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
