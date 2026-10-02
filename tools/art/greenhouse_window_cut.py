"""把 GPT 照白模（greenhouse_window_whitebox.py）上好材質的 場景/溫室/raw/batch5_window.png 切成單張，
存到 public/assets/greenhouse/props/：window_dome、desk_research、monitor_plant_1／2。
每一件取「和白模框重疊最多」的那塊不透明區域（GPT 輪廓會稍微偏），清掉半透明霧邊，裁到實際內容。
放進地圖時再依白模寬度（= 佔的格數 × 96）決定縮放，見 map.json 的 decor。
"""
import json
import numpy as np
from PIL import Image
from pathlib import Path
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT.parent / '場景/溫室/raw/batch5_window.png'
BOXES = json.loads(Path(__file__).with_name('greenhouse_window_boxes.json').read_text(encoding='utf-8'))
OUT = ROOT / 'public/assets/greenhouse/props'
NAMES = {'window': 'window_dome', 'desk': 'desk_research', 'monitor_1': 'monitor_plant_1', 'monitor_2': 'monitor_plant_2'}
ALPHA_CUT = 90


def main():
    a = np.array(Image.open(SRC).convert('RGBA'))
    a[a[..., 3] < ALPHA_CUT, 3] = 0
    solid = a[..., 3] > 0
    lab, _ = ndimage.label(ndimage.binary_dilation(solid, iterations=6))   # 桌上器材和桌子算同一塊
    for key, (x0, y0, x1, y1) in BOXES.items():
        ids, counts = np.unique(lab[y0:y1, x0:x1][solid[y0:y1, x0:x1]], return_counts=True)
        mine = (lab == ids[np.argmax(counts)]) & solid
        ys, xs = np.where(mine)
        piece = a.copy(); piece[~mine, 3] = 0
        piece = piece[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        Image.fromarray(piece).save(OUT / f'{NAMES[key]}.png')
        print(NAMES[key], 'white-box', x1 - x0, 'x', y1 - y0, '→ cut', piece.shape[1], 'x', piece.shape[0])


if __name__ == '__main__':
    main()
