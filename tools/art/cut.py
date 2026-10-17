"""共用切圖工具：所有場景的物件與門都用這一支切，場景只提供資料。

用法：
  python tools/art/cut.py props <場景> <批次|all> [原圖]   物件表 → public/assets/<場景>/props/<名稱>.webp
  python tools/art/cut.py door <場景> [原圖]                門 → public/assets/<場景>/door_frame.webp、door_left.webp、door_right.webp

原圖預設在 tools/art/<場景>/raw/。場景資料寫在 tools/art/<場景>_objects.py：
  sheets()  物件表：{批次: [(順序, 名稱, 遊戲寬, 遊戲高或 None)]}（給高度＝照高度縮放）
  JOIN      選填：{批次: 併塊距離}，格子排得擠的表調小，免得把相鄰的兩件併成一件
  door()    門的規格 dict：
              source    原圖檔名（在 raw/ 裡）
              frame     門框圖大小 (寬, 高)，座標都是門框圖內的世界 px
              門框外緣二選一：
                outer   固定外框 (x0, y0, x1, y1)，原圖主體拉伸對齊它（白模生出來、比例固定的圖）
                省略    原圖等比例縮到門框寬，底部貼門框圖底（從原圖量外框，換圖不用改數字）
              門洞二選一：open（門框圖座標）或 src_open（原圖座標，自動換算）
              keep      選填：門洞四周留在門框上的邊 (左, 上, 右, 下)
              src_light_y  選填：原圖裡門楣燈條的高度，換算成 geometry 的 light
              after     選填：切完要跑的函式（例：工程區重產牆簷前景）

做法（流程見 .claude/skills/starport-scene-props/）：
1. 去背：透明或洋紅；貼著背景的淡紫邊再削一圈（物件本身偏紫的地方不動）。
2. 物件表：找出每一塊物件；相距不到 JOIN px 的先併成同一件（並排的油桶），剩下的碎塊併給 80 px 內最近的大塊，太遠的丟掉。
   由上到下、由左到右排序，對到 sheets() 的順序；數量對不上就報錯，不猜。縮放到清單裡的遊戲寬度（或高度）。
3. 門：主體外框對齊門框外緣後，門洞切成兩片門扇（半透明保留），門框挖空門洞。
"""
import importlib
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ART = Path(__file__).resolve().parent
ROOT = ART.parent.parent
sys.path.insert(0, str(ART))


def raw_dir(scene):
    return ART / scene / 'raw'


def out_dir(scene):
    return ROOT / 'public' / 'assets' / scene


def scene_data(scene):
    return importlib.import_module(f'{scene}_objects')


def remove_background(im):
    """去背：透明、洋紅，以及貼著背景的淡紫邊（只削靠近背景的，物件本身偏紫的地方不動）。回傳 RGBA 陣列。"""
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (a[..., 3] < 20) | ((r > 190) & (g < 90) & (b > 190))
    magenta = (r > 120) & (b > 120) & (g < np.minimum(r, b) - 50)
    near_bg = np.asarray(Image.fromarray(((bg | magenta) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    tinted = near_bg & ((r + b) / 2 - g > 28)
    rgba = np.asarray(im).copy()
    rgba[bg | magenta | tinted] = 0
    return rgba


# ── 物件表 ─────────────────────────────────────────────────────────

def objects_in(rgba, expected, join=40, absorb=80):
    """回傳依閱讀順序排好的物件外框 [(x0, y0, x1, y1)]。
    相距不到 join px 的塊先併成同一件；剩下的碎塊併給 absorb px 內最近的大塊，太遠的清掉。"""
    from scipy import ndimage
    solid = rgba[..., 3] > 0
    lab, _ = ndimage.label(ndimage.binary_closing(solid, iterations=3))
    found = ndimage.find_objects(lab)
    groups = [{'rect': [b[1].start, b[0].start, b[1].stop, b[0].stop], 'area': int((lab[b] == i + 1).sum()), 'labels': [i + 1]}
              for i, b in enumerate(found)]
    gap = lambda a, b: max(0, a[0] - b[2], b[0] - a[2]) + max(0, a[1] - b[3], b[1] - a[3])
    merged = True
    while merged:
        merged = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                if gap(groups[i]['rect'], groups[j]['rect']) < join:
                    a, b = groups[i], groups.pop(j)
                    a['rect'] = [min(a['rect'][0], b['rect'][0]), min(a['rect'][1], b['rect'][1]),
                                 max(a['rect'][2], b['rect'][2]), max(a['rect'][3], b['rect'][3])]
                    a['area'] += b['area']
                    a['labels'] += b['labels']
                    merged = True
                    break
            if merged:
                break
    groups.sort(key=lambda g: -g['area'])
    big, rest = groups[:expected], groups[expected:]
    if len(big) < expected or big[-1]['area'] < big[0]['area'] * .01:
        raise SystemExit(f'找到 {sum(g["area"] > groups[0]["area"] * .01 for g in groups)} 塊大物件，清單要 {expected} 件')
    for g in rest:
        target = min(big, key=lambda b: gap(b['rect'], g['rect']))
        if gap(target['rect'], g['rect']) < absorb:
            r, o = g['rect'], target['rect']
            target['rect'] = [min(o[0], r[0]), min(o[1], r[1]), max(o[2], r[2]), max(o[3], r[3])]
        else:
            rgba[np.isin(lab, g['labels'])] = 0
    items = sorted((g['rect'] for g in big), key=lambda b: (b[1] + b[3]) / 2)
    # 閱讀順序：先依中心 y 分列（同一列的中心 y 差不到物件高度的一半），再由左到右
    rows, row = [], [items[0]]
    for b in items[1:]:
        if (b[1] + b[3]) / 2 - (row[-1][1] + row[-1][3]) / 2 < min(b[3] - b[1], row[-1][3] - row[-1][1]) / 2:
            row.append(b)
        else:
            rows.append(row)
            row = [b]
    rows.append(row)
    return [b for r in rows for b in sorted(r, key=lambda b: b[0])]


def props(scene, sheet, raw=None):
    data = scene_data(scene)
    if sheet == 'all':
        for name in data.sheets():
            props(scene, name)
        return
    plan = data.sheets()[sheet]
    im = Image.open(raw or raw_dir(scene) / f'{sheet}.png').convert('RGBA')
    rgba = remove_background(im)
    boxes = objects_in(rgba, len(plan), join=getattr(data, 'JOIN', {}).get(sheet, 40))
    src = Image.fromarray(rgba)
    out = out_dir(scene) / 'props'
    out.mkdir(parents=True, exist_ok=True)
    for (order, name, width, height), box in zip(plan, boxes):
        piece = src.crop(box)
        k = height / piece.height if height else width / piece.width
        piece = piece.resize((round(piece.width * k), round(piece.height * k)), Image.LANCZOS)
        piece.save(out / f'{name}.webp', lossless=True)
        print(f'{sheet} #{order} {name}: {piece.width}x{piece.height}')


# ── 門 ─────────────────────────────────────────────────────────────

def door_geometry(scene, raw=None):
    """門框外緣、門洞、燈條位置（門框圖座標），以及把原圖貼進門框圖的縮放與位移。"""
    spec = scene_data(scene).door()
    im = Image.open(raw or raw_dir(scene) / spec['source']).convert('RGBA')
    rgba = remove_background(im)
    solid = rgba[..., 3] > 0
    ys, xs = np.where(solid)
    left, right, bottom = xs.min(), xs.max(), ys.max()
    body = np.where(solid.sum(1) > (right - left) * .5)[0]       # 門框主體：忽略頂上窄窄的燈座
    top = body.min()
    fw, fh = spec['frame']
    if 'outer' in spec:
        outer = spec['outer']
        sx = (outer[2] - outer[0]) / (right - left + 1)
        sy = (outer[3] - outer[1]) / (bottom - top + 1)
    else:
        sx = sy = fw / (right - left + 1)
        outer = (0, fh - round((bottom - top + 1) * sy), fw, fh)
    to_frame = lambda x, y: (round(outer[0] + (x - left) * sx), round(outer[1] + (y - top) * sy))
    opening = tuple(spec['open']) if 'open' in spec else to_frame(*spec['src_open'][:2]) + to_frame(*spec['src_open'][2:])
    light = (fw // 2, to_frame(0, spec['src_light_y'])[1]) if 'src_light_y' in spec else None
    offset = (round(outer[0] - left * sx), round(outer[1] - top * sy))
    return {'frame': (fw, fh), 'outer': outer, 'open': opening, 'light': light,
            'scale': (sx, sy), 'offset': offset, 'rgba': rgba, 'spec': spec}


def door(scene, raw=None):
    geo = door_geometry(scene, raw)
    spec, opening = geo['spec'], geo['open']
    src = Image.fromarray(geo['rgba'])
    scaled = src.resize((round(src.width * geo['scale'][0]), round(src.height * geo['scale'][1])), Image.LANCZOS)
    frame = Image.new('RGBA', geo['frame'])
    frame.alpha_composite(scaled, geo['offset'])
    panels = frame.crop(opening)
    half = (opening[2] - opening[0]) // 2
    out = out_dir(scene)
    out.mkdir(parents=True, exist_ok=True)
    panels.crop((0, 0, half, panels.height)).save(out / 'door_left.webp', lossless=True)
    panels.crop((half, 0, panels.width, panels.height)).save(out / 'door_right.webp', lossless=True)
    kl, kt, kr, kb = spec.get('keep', (0, 0, 0, 0))
    frame.paste((0, 0, 0, 0), (opening[0] + kl, opening[1] + kt, opening[2] - kr, opening[3] - kb))
    frame.save(out / 'door_frame.webp', lossless=True)
    if spec.get('after'):
        spec['after']()
    print('door ok:', scene, 'frame', frame.size, 'outer', geo['outer'], 'opening', opening, 'panels', half, 'x', panels.height)


if __name__ == '__main__':
    command, scene, *rest = sys.argv[1:]
    {'props': props, 'door': door}[command](scene, *rest)
