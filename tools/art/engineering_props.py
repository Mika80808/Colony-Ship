"""工程區機台切圖：生好的物件圖 → public/assets/engineering/props/<名稱>.webp。清單在 engineering_objects.py（v6）。

用法：uv run --with pillow --with numpy --with scipy python tools/art/engineering_props.py <sheet> [原圖]
  sheet 是批次名稱（例 batch9_desks），原圖預設 tools/art/engineering/raw/<sheet>.png。
  `all` 一次切全部批次。

做法（流程見 .claude/skills/starport-scene-props/）：
1. 去背：透明或洋紅；偏紫紅的像素一律去掉，貼著背景的淡紫邊再削一圈。
2. 找出圖上的每一塊物件；相距不到 40 px 的先併成同一件（並排的油桶），剩下的碎塊（散落零件）併給 80 px 內最近的大塊，太遠的丟掉。
3. 由上到下、由左到右排序，對到 engineering_objects.sheets() 裡的順序；數量對不上就報錯，不猜。
4. 縮放到清單裡的遊戲寬度（量自擺設參考圖），高度照原圖比例。
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engineering_objects import sheets

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'tools/art/engineering/raw')
OUT = os.path.join(ROOT, 'public/assets/engineering/props')
# 格子排得比較擠的表：併塊距離調小，免得把上下相鄰的兩件併成一件
JOIN = {'batch18_logistics': 10, 'batch19_crew_corner': 10}

def remove_background(im):
    a = np.asarray(im).astype(np.int16)
    bg = (a[..., 3] < 20) | ((a[..., 0] > 190) & (a[..., 1] < 90) & (a[..., 2] > 190))
    magenta = (a[..., 0] > 120) & (a[..., 2] > 120) & (a[..., 1] < np.minimum(a[..., 0], a[..., 2]) - 50)
    near_bg = np.asarray(Image.fromarray(((bg | magenta) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    tinted = near_bg & ((a[..., 0] + a[..., 2]) / 2 - a[..., 1] > 28)
    rgba = np.asarray(im).copy(); rgba[bg | magenta | tinted] = 0
    return rgba

def objects_in(rgba, expected, join=40, absorb=80):
    """回傳依閱讀順序排好的物件外框 [(x0, y0, x1, y1)]。
    相距不到 join px 的塊先併成同一件（例：並排的兩個油桶、散落的螺絲）；剩下的碎塊併給 absorb px 內最近的大塊。"""
    solid = rgba[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    found = ndimage.find_objects(lab)
    groups = [{'rect': [b[1].start, b[0].start, b[1].stop, b[0].stop], 'area': int((lab[b] == i + 1).sum()), 'labels': [i + 1]} for i, b in enumerate(found)]
    gap = lambda a, b: max(0, a[0] - b[2], b[0] - a[2]) + max(0, a[1] - b[3], b[1] - a[3])
    merged = True
    while merged:
        merged = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                if gap(groups[i]['rect'], groups[j]['rect']) < join:
                    a, b = groups[i], groups.pop(j)
                    a['rect'] = [min(a['rect'][0], b['rect'][0]), min(a['rect'][1], b['rect'][1]), max(a['rect'][2], b['rect'][2]), max(a['rect'][3], b['rect'][3])]
                    a['area'] += b['area']; a['labels'] += b['labels']; merged = True
                    break
            if merged: break
    groups.sort(key=lambda g: -g['area'])
    big, rest = groups[:expected], groups[expected:]
    if len(big) < expected or big[-1]['area'] < big[0]['area'] * .01:
        raise SystemExit(f'找到 {sum(g["area"] > groups[0]["area"] * .01 for g in groups)} 塊大物件，清單要 {expected} 件')
    for g in rest:
        target = min(big, key=lambda b: gap(b['rect'], g['rect']))
        if gap(target['rect'], g['rect']) < absorb:
            r, o = g['rect'], target['rect']; target['rect'] = [min(o[0], r[0]), min(o[1], r[1]), max(o[2], r[2]), max(o[3], r[3])]
        else:
            rgba[np.isin(lab, g['labels'])] = 0                         # 太遠的雜點丟掉
    items = [g['rect'] for g in big]
    # 閱讀順序：先依中心 y 分列（同一列的中心 y 差不到物件高度的一半），再由左到右
    items.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, row = [], [items[0]]
    for b in items[1:]:
        if (b[1] + b[3]) / 2 - (row[-1][1] + row[-1][3]) / 2 < min(b[3] - b[1], row[-1][3] - row[-1][1]) / 2: row.append(b)
        else: rows.append(row); row = [b]
    rows.append(row)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]

def cut(sheet, raw=None):
    plan = sheets()[sheet]
    im = Image.open(raw or os.path.join(RAW, f'{sheet}.png')).convert('RGBA')
    rgba = remove_background(im)
    boxes = objects_in(rgba, len(plan), join=JOIN.get(sheet, 40))
    src = Image.fromarray(rgba)
    os.makedirs(OUT, exist_ok=True)
    for (order, name, width, height), (x0, y0, x1, y1) in zip(plan, boxes):
        piece = src.crop((x0, y0, x1, y1))
        k = height / piece.height if height else width / piece.width        # 預設照寬度；HEIGHT_FIT 的照高度
        piece = piece.resize((round(piece.width * k), round(piece.height * k)), Image.LANCZOS)
        piece.save(os.path.join(OUT, f'{name}.webp'), lossless=True)
        print(f'{sheet} #{order} {name}: {piece.width}x{piece.height}')

if __name__ == '__main__':
    if sys.argv[1] == 'all':
        for s in sheets(): cut(s)
    else:
        cut(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
