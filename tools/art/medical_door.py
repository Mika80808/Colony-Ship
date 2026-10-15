"""醫療室南側大門：把門的原圖切成遊戲用的門框與兩片門扇。

用法：python tools/art/medical_door.py cut [原圖]
  原圖預設 tools/art/medical/raw/medical_entrance_door_v2.png（玻璃自動門，背景透明）
  輸出 public/assets/medical/door_frame.webp、door_left.webp、door_right.webp

醫療室不用運大型貨物，門照人與推床的需要定：門框外寬 6 格（288），外框是正方形 288 × 288，底部貼走廊牆腳。
門洞（兩片玻璃門扇合起來）照原圖量：184 × 236，兩片各 92 寬。
座標都是門框圖內的世界 px，門框圖左上角＝走廊牆頂、門框左緣。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
RAW = HERE / 'medical' / 'raw'
OUT = HERE.parent.parent / 'public' / 'assets' / 'medical'
SOURCE = RAW / 'medical_entrance_door_v2.png'
FW, FH = 288, 349                 # 門框圖：寬 6 格，高到走廊牆腳（345）再多 4 px 門檻
OUTER = (0, 61, FW, FH)           # 門框外緣：原圖外框 1044 × 1044 縮成 288 × 288
OPEN = (52, 107, 236, 343)        # 門洞＝兩片門扇合起來的範圍（原圖 x 296–962、y 330–1185）
LIGHT = (FW // 2, 99)             # 門楣燈條中心，門在動的時候閃


def cut(raw=SOURCE):
    """原圖去背（含洋紅殘邊），外框對齊門框外框縮放，門洞切成兩片門扇，門框挖空門洞。"""
    im = Image.open(raw).convert('RGBA')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (a[..., 3] < 20) | ((r - g > 40) & (b - g > 40))          # 透明，或偏紫紅（洋紅底留下的殘邊）
    rgba = np.asarray(im).copy()
    rgba[bg] = 0
    ys, xs = np.where(~bg)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    sx = (OUTER[2] - OUTER[0]) / (right - left + 1)
    sy = (OUTER[3] - OUTER[1]) / (bottom - top + 1)
    src = Image.fromarray(rgba)
    scaled = src.resize((round(src.width * sx), round(src.height * sy)), Image.LANCZOS)
    frame = Image.new('RGBA', (FW, FH))
    frame.alpha_composite(scaled, (round(OUTER[0] - left * sx), round(OUTER[1] - top * sy)))
    door = frame.crop(OPEN)
    half = (OPEN[2] - OPEN[0]) // 2
    OUT.mkdir(parents=True, exist_ok=True)
    door.crop((0, 0, half, door.height)).save(OUT / 'door_left.webp', lossless=True)
    door.crop((half, 0, door.width, door.height)).save(OUT / 'door_right.webp', lossless=True)
    frame.paste((0, 0, 0, 0), OPEN)
    frame.save(OUT / 'door_frame.webp', lossless=True)
    print('cut ok: frame', frame.size, 'panels', half, 'x', door.height)


if __name__ == '__main__':
    {'cut': cut}[sys.argv[1]](*sys.argv[2:])
