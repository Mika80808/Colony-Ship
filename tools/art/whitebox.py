"""器材白模：正面斜俯視的精確輪廓（只有正面＋薄頂面，看不到側面），給生圖模型照著上材質。
AI 只靠文字抓不準角度，所以幾何由程式決定（starport-asset-gen 第八節）。

一格 T px；頂面每格深度 TOP px（規範：64px 格配 16px，這裡等比例）。每件的底邊中點＝錨點。
用法：whitebox.py <out.png>
"""
import sys
from PIL import Image, ImageDraw

T = 96
TOP = T // 4
LINE, FRONT, LID, SHADOW = (70, 76, 86), (226, 230, 236), (250, 251, 253), (0, 0, 0, 80)
BG = (255, 0, 255)

def block(d, shadow, x, base, w, depth, h):
    """w 格寬、depth 格深、h 格高的方塊，底邊左端在 (x, base)。回傳正面範圍。"""
    fw, fh, th = w * T, h * T, depth * TOP
    shadow.rectangle((x + 12, base - fh - th + 8, x + fw + 12, base + 8), fill=SHADOW)
    if d is None: return None
    d.rectangle((x, base - fh - th, x + fw, base - fh), fill=LID, outline=LINE, width=3)
    d.rectangle((x, base - fh, x + fw, base), fill=FRONT, outline=LINE, width=3)
    return x, base - fh, x + fw, base

def draw(d, shadow):
    """畫全部器材；d 為 None 時只畫陰影（陰影要先畫、壓在物件底下）。"""
    items = []
    # 1. 種植架模組 2x2x3：四層架、左右兩根柱
    r = block(d, shadow, 60, 430, 2, 2, 3)
    if r:
        x0, y0, x1, y1 = r
        for i in range(1, 4): d.line((x0, y0 + i * (y1 - y0) / 4, x1, y0 + i * (y1 - y0) / 4), fill=LINE, width=3)
        for x in (x0 + 14, x1 - 14): d.line((x, y0, x, y1), fill=LINE, width=2)
    items.append('1 rack module 2x2x3')
    # 2. 端蓋 1x2x3：一塊面板＋小螢幕
    r = block(d, shadow, 340, 430, 1, 2, 3)
    if r:
        x0, y0, x1, y1 = r
        d.rectangle((x0 + 22, y0 + 90, x1 - 22, y0 + 150), outline=LINE, width=3)
    items.append('2 end cap 1x2x3')
    # 3. 花台 2x1x1
    block(d, shadow, 540, 430, 2, 1, 1)
    items.append('3 planter 2x1x1')
    # 4. 盆栽的盆 1x1x1（圓柱：正面矩形＋頂面橢圓）
    px, base = 820, 430
    shadow.ellipse((px + 10, base - 12, px + T + 16, base + 14), fill=SHADOW)
    if d:
        d.rectangle((px, base - T, px + T, base), fill=FRONT, outline=LINE, width=3)
        d.ellipse((px, base - T - TOP // 2 - 6, px + T, base - T + TOP // 2 + 6), fill=LID, outline=LINE, width=3)
    items.append('4 plant pot 1x1x1 (cylinder)')
    return items

def main(out):
    sh = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    draw(None, ImageDraw.Draw(sh))
    im = Image.alpha_composite(Image.new('RGBA', sh.size, BG + (255,)), sh).convert('RGB')
    items = draw(ImageDraw.Draw(im), ImageDraw.Draw(Image.new('RGBA', sh.size)))
    im.save(out); print('saved', out, items)

if __name__ == '__main__':
    main(sys.argv[1])
