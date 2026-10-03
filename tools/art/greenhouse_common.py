"""greenhouse_layer_props.py 與 greenhouse_tree_layer.py 的共用部分：
路徑常數、map.json 讀寫、整張地圖大小檢查、圖層切塊 pieces()。
"""
import json
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
G = ROOT / 'public/assets/greenhouse'
PS = ROOT.parent / '場景/溫室/photoshop'


def load_map():
    return json.loads((G / 'map.json').read_text(encoding='utf-8'))


def save_map(m):
    (G / 'map.json').write_text(json.dumps(m, ensure_ascii=False), encoding='utf-8')


def check_size(im, m, path):
    """圖層必須是整張地圖大小（1:1 遊戲座標）。"""
    full = (m['width'] * m['tileSize'], m['height'] * m['tileSize'])
    assert im.size == full, f'{path} 要是整張地圖大小 {full}，目前是 {im.size}'
    return im


def pieces(im, gap, min_px, mask=False):
    """一張圖層裡的每一塊不透明區域：(裁下的圖, 左, 上, 右, 下)。

    gap：相距多少 px 內的碎片算同一塊；min_px：少於這個像素數算雜點丟掉；
    mask=True 時把裁下範圍裡別塊的像素清透明（框內只留這一塊）。
    """
    solid = np.asarray(im)[..., 3] > 40
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=gap))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        mine = (lab[sl] == i + 1) & solid[sl]
        ys, xs = np.where(mine)
        if len(ys) < min_px: continue
        box = (sl[1].start + xs.min(), sl[0].start + ys.min(), sl[1].start + xs.max() + 1, sl[0].start + ys.max() + 1)
        crop = im.crop(box)
        if mask:
            a = np.asarray(crop).copy()
            a[..., 3] *= mine[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
            crop = Image.fromarray(a)
        out.append((crop, *box))
    return out
