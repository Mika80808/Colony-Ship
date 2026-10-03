"""工程區厚重門：產生生圖用白模，以及把生好的原圖切成遊戲用的門框與兩片門扇。

用法（uv run --with pillow --with numpy python tools/art/engineering_door.py ...）：
  whitebox <out.png>          畫 1024 × 1024 白模（洋紅底），生圖時當 image1，模型照輪廓上材質
  cut <raw.png>               原圖 → public/assets/engineering/door_frame.webp、door_left.webp、door_right.webp
                              目前的原圖：tools/art/engineering/raw/batch1_door.png

幾何從 engineering_build.py 讀（目前門框 524 × 352，門洞 4 格寬 384 × 280，兩片門扇各 192 寬），
白模放大 SCALE 倍。切圖時以原圖裡非背景的外框對齊門框外框，門洞照固定比例切出來，所以生圖時外框比例不能變。
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public/assets/engineering')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engineering_build import DOOR_ZONE, OPEN_X, OPEN_W, OPEN_TOP, WALL_BASE, O   # 幾何以產生腳本為準
FW, FH = DOOR_ZONE[1] - DOOR_ZONE[0], WALL_BASE - O + 6     # 門框圖大小（遊戲 px）
OUTER = (8, OPEN_TOP - O - 46, FW - 8, FH)                    # 門框外緣（不含頂上的警示燈座）
LAMP = (FW // 2 - 22, 0, FW // 2 + 22, 24)                    # 警示燈座
OPEN = (OPEN_X - DOOR_ZONE[0], OPEN_TOP - O, OPEN_X - DOOR_ZONE[0] + OPEN_W, WALL_BASE - O)   # 門洞＝兩片門扇合起來的範圍
SCALE = 1.8
# 門洞四周留在門框上的邊（左、上、右、下，遊戲 px）：門洞內緣的深色框、上緣燈條、底部門檻不跟著門扇滑走
KEEP = (10, 6, 10, 16)
MAGENTA = (255, 0, 255)

def whitebox(out):
    W = 1024
    img = Image.new('RGB', (W, W), MAGENTA)
    d = ImageDraw.Draw(img)
    ox, oy = (W - FW * SCALE) / 2, (W - FH * SCALE) / 2
    box = lambda r: [ox + r[0] * SCALE, oy + r[1] * SCALE, ox + r[2] * SCALE - 1, oy + r[3] * SCALE - 1]
    d.rectangle(box(OUTER), fill=(214, 214, 214), outline=(70, 70, 70), width=4)
    d.rectangle(box(LAMP), fill=(232, 232, 232), outline=(70, 70, 70), width=4)
    d.rectangle(box(OPEN), fill=(168, 168, 168), outline=(55, 55, 55), width=4)
    mid = ox + (OPEN[0] + OPEN[2]) / 2 * SCALE
    d.line([mid, oy + OPEN[1] * SCALE, mid, oy + OPEN[3] * SCALE], fill=(40, 40, 40), width=5)   # 兩片門扇的接縫
    # 光源箭頭（左上 45 度）
    d.line([40, 40, 110, 110], fill=(255, 255, 255), width=6); d.polygon([(110, 110), (84, 106), (106, 84)], fill=(255, 255, 255))
    img.save(out)

def cut(raw):
    im = Image.open(raw).convert('RGBA')
    a = np.asarray(im).astype(np.int16)
    # 背景：透明，或接近洋紅
    bg = (a[..., 3] < 20) | ((a[..., 0] > 200) & (a[..., 1] < 70) & (a[..., 2] > 200))
    rgba = np.asarray(im).copy(); rgba[bg] = 0
    ys, xs = np.where(~bg)
    # 外框以門框主體為準：忽略最上面窄窄一條燈座（寬度不到外框一半的列）
    cols = (~bg).sum(1); width = xs.max() - xs.min()
    body = np.where(cols > width * .5)[0]
    top, bottom, left, right = body.min(), ys.max(), xs.min(), xs.max()
    src = Image.fromarray(rgba)
    sx = (OUTER[2] - OUTER[0]) / (right - left + 1); sy = (OUTER[3] - OUTER[1]) / (bottom - top + 1)
    scaled = src.resize((round(src.width * sx), round(src.height * sy)), Image.LANCZOS)
    frame = Image.new('RGBA', (FW, FH))
    frame.alpha_composite(scaled, (round(OUTER[0] - left * sx), round(OUTER[1] - top * sy)))
    door = frame.crop(OPEN)
    half = (OPEN[2] - OPEN[0]) // 2
    door.crop((0, 0, half, door.height)).save(os.path.join(OUT, 'door_left.webp'), lossless=True)
    door.crop((half, 0, door.width, door.height)).save(os.path.join(OUT, 'door_right.webp'), lossless=True)
    frame.paste((0, 0, 0, 0), (OPEN[0] + KEEP[0], OPEN[1] + KEEP[1], OPEN[2] - KEEP[2], OPEN[3] - KEEP[3]))
    frame.save(os.path.join(OUT, 'door_frame.webp'), lossless=True)
    print('cut ok: frame', frame.size, 'panels', half, 'x', door.height)

if __name__ == '__main__':
    {'whitebox': whitebox, 'cut': cut}[sys.argv[1]](sys.argv[2])
