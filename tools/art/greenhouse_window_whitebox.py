"""溫室北側：挑高穹頂觀景窗（含左右柱）＋貼著窗台的工作桌（右端內建工作站螢幕）、植栽監測機的白模，給 GPT 照輪廓上材質。
尺寸是遊戲實際像素（一格 96 px、頂面每格深 24 px，同 whitebox.py），畫在 1536×1024 一張圖上，
生成後各件照這裡的框切下來、不用再猜比例。框的位置寫進 greenhouse_window_boxes.json。

地圖位置（public/assets/greenhouse/map.json）：
  觀景窗      x14–25, y0 起  12 格寬；上緣平直、兩側直邊，下緣往房間內凸成圓弧，中央最深約 4.56 格（凸進 y4）
              玻璃用六角框分割，靠圓弧邊緣是不規則五角形（使用者 2026-10-01 草圖）
  工作桌      x15–24, y5     10×1 格；桌面深（頂面 72 px）、正面矮（48 px），緊貼穹頂最低點；右端立工作站螢幕
  監測機      (13,2)、(26,1) 1×1 格、高 2 格   → 96×216
（原本 y5 的工作檯與 y7 的工作站，依使用者參考圖改成貼窗的一張桌子。）
"""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw

T, TOP = 96, 24
LINE, FRONT, LID, GLASS, DARK = (70, 76, 86), (226, 230, 236), (250, 251, 253), (190, 214, 226), (60, 66, 76)
BG = (200, 200, 210)
OUT = Path(__file__).with_name('greenhouse_window_whitebox.png')


def block(d, x, base, w, depth, h):
    """w 格寬、depth 格深、h 格高：正面＋薄頂面，底邊左端在 (x, base)。回傳正面框。"""
    fw, fh, th = w * T, round(h * T), depth * TOP
    d.rectangle((x, base - fh - th, x + fw, base - fh), fill=LID, outline=LINE, width=3)
    d.rectangle((x, base - fh, x + fw, base), fill=FRONT, outline=LINE, width=3)
    return x, base - fh, x + fw, base


def main():
    im = Image.new('RGB', (1536, 1024), BG); d = ImageDraw.Draw(im)
    boxes = {}
    # 1. 穹頂觀景窗 12 格寬（使用者草圖：無柱、上緣平直、下緣往房間內凸成圓弧，中央比 4 格深再多 BULGE px）
    x0, y0 = 40, 60
    W, SIDE, BULGE = 12 * T, 4 * T - 110, 4 * T + 54 - (4 * T - 110)   # 兩側直邊高 SIDE，之後圓弧到中央最低點
    y1 = y0 + SIDE + BULGE
    mask = Image.new('L', im.size, 0); md = ImageDraw.Draw(mask)
    md.rectangle((x0, y0, x0 + W, y0 + SIDE), fill=255)
    md.pieslice((x0, y0 + SIDE - BULGE, x0 + W, y1), 0, 180, fill=255)
    im.paste(GLASS, (0, 0) + im.size, mask)
    # 六角格框線，靠邊緣被圓弧切成不規則的五角形
    r = 110                                                                          # 六角框半徑（使用者要大一點）
    hexes = Image.new('RGBA', im.size, (0, 0, 0, 0)); hd = ImageDraw.Draw(hexes)
    for row in range(-1, 6):
        for col in range(-1, 13):
            hx = x0 + col * r * 1.5; hy = y0 + row * r * math.sqrt(3) + (col % 2) * r * math.sqrt(3) / 2
            hd.polygon([(hx + r * math.cos(math.pi / 3 * k), hy + r * math.sin(math.pi / 3 * k)) for k in range(6)], outline=LINE + (255,), width=4)
    im.paste(hexes, (0, 0), Image.composite(hexes.getchannel('A'), Image.new('L', im.size, 0), mask))
    d.line((x0, y0, x0 + W, y0), fill=LINE, width=5)                                  # 上緣（貼牆）
    d.line((x0, y0, x0, y0 + SIDE), fill=LINE, width=5); d.line((x0 + W, y0, x0 + W, y0 + SIDE), fill=LINE, width=5)
    d.arc((x0, y0 + SIDE - BULGE, x0 + W, y1), 0, 180, fill=LINE, width=5)          # 凸出的圓弧下緣
    boxes['window'] = (x0, y0, x0 + W, y1)
    # 2. 監測機 ×2（1×1×2）：正面上半一塊螢幕
    for i, mx in enumerate((1260, 1400)):
        a = block(d, mx, 424, 1, 1, 2)
        d.rectangle((a[0] + 16, a[1] + 24, a[2] - 16, a[1] + 96), fill=DARK, outline=LINE, width=3)
        boxes[f'monitor_{i + 1}'] = (a[0], a[1] - TOP, a[2], a[3])
    # 3. 工作桌 10×1：桌面深（使用者草圖：頂面 72、正面只 48），右端桌後立工作站螢幕
    base2, dtop, dfront = 940, 72, 48
    dx0, dx1 = 40, 40 + 10 * T
    d.rectangle((dx0, base2 - dfront - dtop, dx1, base2 - dfront), fill=LID, outline=LINE, width=4)
    d.rectangle((dx0, base2 - dfront, dx1, base2), fill=FRONT, outline=LINE, width=3)
    for i in range(1, 5): d.line((dx0 + i * 2 * T, base2 - dfront, dx0 + i * 2 * T, base2), fill=LINE, width=3)
    sx0 = dx0 + 7 * T
    d.rectangle((sx0, base2 - dfront - dtop - 72, sx0 + 160, base2 - dfront - dtop + 16), fill=DARK, outline=LINE, width=3)
    boxes['desk'] = (dx0, base2 - dfront - dtop - 72, dx1, base2)
    im.save(OUT)
    OUT.with_name('greenhouse_window_boxes.json').write_text(json.dumps(boxes, indent=1), encoding='utf-8')
    print(boxes)


if __name__ == '__main__':
    main()
