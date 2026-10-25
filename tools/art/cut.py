"""共用切圖工具：所有場景的物件與門都用這一支切，場景只提供資料。

用法：
  python tools/art/cut.py props <場景> <批次|all> [原圖]   物件表 → public/assets/<場景>/props/<名稱>.webp
  python tools/art/cut.py door <場景> [原圖]                門 → public/assets/<場景>/door_frame.webp、door_left.webp、door_right.webp
  python tools/art/cut.py psd <場景> <PSD 路徑>            使用者在 PSD 排好的物件 → public/assets/<場景>/props/<圖層名>.webp
                                                          ＋ tools/art/<場景>/layout_<PSD 檔名>.json（每件的世界座標）

原圖預設在 tools/art/<場景>/raw/。場景資料寫在 tools/art/<場景>_objects.py：
  sheets()  物件表：{批次: [(順序, 名稱, 遊戲寬, 遊戲高或 None)]}（給高度＝照高度縮放）
  JOIN      選填：{批次: 併塊距離}，格子排得擠的表調小，免得把相鄰的兩件併成一件
  KEEP_ALPHA 選填：{批次, ...} 物件本身有半透明（玻璃）的批次，不做 clean_edges
  CANVAS    選填：{圖層名: 另一個圖層名}，PSD 匯入時把這層墊到那層的畫布（同位置、同底邊，例：配藥櫃的玻璃墊到櫃體）
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
   物件表再跑 clean_edges：實心補滿、柔邊換成物件本色、外圍陰影霧刪掉。
2. 物件表：找出每一塊物件；相距不到 JOIN px 的先併成同一件（並排的油桶），剩下的碎塊併給 80 px 內最近的大塊，太遠的丟掉。
   由上到下、由左到右排序，對到 sheets() 的順序；數量對不上就報錯，不猜。縮放到清單裡的遊戲寬度（或高度）。
3. 門：主體外框對齊門框外緣後，門洞切成兩片門扇（半透明保留），門框挖空門洞。
4. PSD：使用者把物件擺在一層「底圖位置」（遊戲底圖裁一塊、放大）上排位置與大小。先用影像比對找出那層在遊戲底圖的
   哪裡、放大幾倍，再把其他看得見的圖層換算成世界座標，存成 2 倍尺寸（一格 96，map.json 用 scale 0.5）。
   圖層名取到第一個括號或空白前（「pharmacy-dispensing-glass（2倍尺寸）」→ pharmacy-dispensing-glass）。
"""
import importlib
import json
import re
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


def clean_edges(rgba, solid=128, edge=2):
    """整理 GPT 透明底的髒邊。GPT 的「不透明」常只有 alpha 253、輪廓線半透明，外圍還有一圈半透明陰影霧。
    alpha ≥ solid 的算實心、補成 255；實心外 edge px 內的柔邊保留透明度，但顏色換成最近實心像素的顏色（去掉灰黑陰影色）；
    再往外的半透明（陰影、光暈、霧）全刪。物件本身要半透明（玻璃）的批次在 <場景>_objects.py 的 KEEP_ALPHA 列出來就不跑。"""
    from scipy import ndimage
    al = rgba[..., 3].astype(np.int16)
    core = al >= solid
    al[~ndimage.binary_dilation(core, iterations=edge)] = 0
    al[al < 16] = 0
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    soft = (al > 0) & ~core
    rgba[..., :3][soft] = rgba[iy[soft], ix[soft], :3]
    al[core] = 255
    rgba[..., 3] = al
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
    if sheet not in getattr(data, 'KEEP_ALPHA', ()):
        rgba = clean_edges(rgba)
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


BASE_LAYER = '底圖位置'


def _ncc(image, template):
    """正規化互相關：回傳 (分數, (y, x))，template 在 image 裡最像的左上角。"""
    from scipy.signal import fftconvolve
    t = template - template.mean()
    ones = np.ones(t.shape)
    num = fftconvolve(image, t[::-1, ::-1], mode='valid')
    s1 = fftconvolve(image, ones, mode='valid')
    s2 = fftconvolve(image * image, ones, mode='valid')
    den = np.sqrt(np.maximum(s2 - s1 * s1 / t.size, 1e-9) * (t * t).sum())
    r = num / den
    i = np.unravel_index(np.argmax(r), r.shape)
    return float(r[i]), (int(i[0]), int(i[1]))


def locate_base(base, ground):
    """底圖位置圖層 → (放大倍率, 圖層左上角在世界的 x, y, 相似度)。先在 1/4 尺寸掃倍率，再在原尺寸附近細找。"""
    gray = lambda im: np.asarray(im.convert('L')).astype(float)
    g = gray(ground)
    g4 = gray(ground.resize((ground.width // 4, ground.height // 4), Image.BOX))
    best = None
    for k in np.arange(1.0, 4.0, 0.02):
        w, h = round(base.width / k / 4), round(base.height / k / 4)
        if w > g4.shape[1] or h > g4.shape[0] or w < 24 or h < 24:
            continue
        score, (y, x) = _ncc(g4, gray(base.resize((w, h), Image.BOX)))
        if not best or score > best[0]:
            best = (score, k, x * 4, y * 4)
    _, k0, x0, y0 = best
    for k in np.arange(k0 - .03, k0 + .03, .001):
        w, h = round(base.width / k), round(base.height / k)
        bx, by = max(0, x0 - 12), max(0, y0 - 12)
        window = g[by:min(g.shape[0], y0 + h + 12), bx:min(g.shape[1], x0 + w + 12)]
        if window.shape[0] < h or window.shape[1] < w:
            continue
        score, (y, x) = _ncc(window, gray(base.resize((w, h), Image.LANCZOS)))
        if score > best[0] or best[1] == k0:
            best = (score, k, bx + x, by + y)
    score, k, x, y = best
    return base.width / round(base.width / k), x, y, score


def psd(scene, path):
    from psd_tools import PSDImage
    doc = PSDImage.open(path)
    layers = [l for l in doc.descendants() if not l.is_group() and l.is_visible()]
    base = next((l for l in layers if l.name.strip() == BASE_LAYER), None)
    if base is None:
        raise SystemExit(f'PSD 裡要有一層「{BASE_LAYER}」（遊戲底圖裁一塊），用來換算座標')
    k, ox, oy, score = locate_base(base.composite().convert('RGB'), Image.open(out_dir(scene) / 'ground.webp').convert('RGB'))
    if score < .8:
        raise SystemExit(f'「{BASE_LAYER}」在遊戲底圖上找不到（相似度 {score:.2f}）：底圖改過的話，重新放一層目前的底圖')
    bx, by = base.bbox[:2]
    wx, wy = (lambda px: (px - bx) / k + ox), (lambda py: (py - by) / k + oy)
    info = {}
    for l in layers:
        if l is base:
            continue
        name = re.split(r'[（(\s]', l.name.strip())[0]
        x0, y0, x1, y1 = l.bbox
        sprite = l.composite().convert('RGBA').resize((round((x1 - x0) * 2 / k), round((y1 - y0) * 2 / k)), Image.LANCZOS)
        info[name] = {'sprite': sprite, 'left': wx(x0), 'top': wy(y0), 'right': wx(x1), 'bottom': wy(y1)}
    for name, host in getattr(scene_data(scene), 'CANVAS', {}).items():   # 墊到另一層的畫布：同位置、同底邊
        d, h = info[name], info[host]
        canvas = Image.new('RGBA', h['sprite'].size, (0, 0, 0, 0))
        canvas.alpha_composite(d['sprite'], (round((d['left'] - h['left']) * 2), round((d['top'] - h['top']) * 2)))
        info[name] = {**h, 'sprite': canvas}
    props_dir = out_dir(scene) / 'props'
    props_dir.mkdir(parents=True, exist_ok=True)
    layout = {'_base': {'psd': Path(path).name, 'scale': round(k, 4), 'origin': [round(ox, 1), round(oy, 1)], 'match': round(score, 3)}}
    for name, d in info.items():
        d['sprite'].save(props_dir / f'{name}.webp', lossless=True)
        layout[name] = {'x': round((d['left'] + d['right']) / 2, 1), 'bottom': round(d['bottom'], 1),
                        'left': round(d['left'], 1), 'top': round(d['top'], 1), 'right': round(d['right'], 1), 'size': list(d['sprite'].size)}
        print(f"{name}: 中心 {layout[name]['x']}、底邊 {layout[name]['bottom']}、2 倍圖 {d['sprite'].size}")
    target = ART / scene / f'layout_{Path(path).stem}.json'
    target.write_text(json.dumps(layout, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'psd ok: 底圖位置放大 {k:.3f} 倍、左上角 ({ox}, {oy})、相似度 {score:.3f} → {target.relative_to(ROOT)}')


if __name__ == '__main__':
    command, scene, *rest = sys.argv[1:]
    {'props': props, 'door': door, 'psd': psd}[command](scene, *rest)
