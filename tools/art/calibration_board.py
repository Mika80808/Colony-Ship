"""星際港素材校準板：1024x1024、16x16 格（64px）、三個白色量體、左上 45 度光源。
生圖時當 image1，傳達斜俯視角度、格子比例與光源方向。規格見 starport-asset-gen 技能第七節。"""
import sys
from PIL import Image, ImageDraw

T, TOP = 64, 16                       # 每格 64px；頂面每格深度只給 16px
BASE = 11 * T                         # 三個量體共用的底邊基線
im = Image.new('RGBA', (1024, 1024), (236, 238, 240, 255))
d = ImageDraw.Draw(im)
for i in range(17):
    d.line([(i * T, 0), (i * T, 1024)], fill=(150, 154, 160), width=1)
    d.line([(0, i * T), (1024, i * T)], fill=(150, 154, 160), width=1)

def volume(tx, w, h, label):
    """w 格寬、h 格高的量體，底邊落在 BASE。"""
    x0, x1 = tx * T, (tx + w) * T
    front_top = BASE - h * T
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([x0 + 12, front_top - TOP + 8, x1 + 12, BASE + 8], fill=(0, 0, 0, 89))
    im.alpha_composite(shadow)
    d.rectangle([x0, front_top - TOP, x1, front_top], fill=(255, 255, 255), outline=(60, 64, 70), width=2)   # 頂面最亮
    d.rectangle([x0, front_top, x1, BASE], fill=(222, 226, 232), outline=(60, 64, 70), width=2)            # 正面次之
    d.text((x0 + 6, BASE + 12), label, fill=(40, 44, 50))

volume(2, 1, 1, 'A 1x1x1')
volume(5, 2, 1, 'B 2x1x1')
volume(9, 1, 2, 'C 1x1x2')
# 光源箭頭：從左上 45 度射入
d.line([(40, 40), (150, 150)], fill=(230, 150, 20), width=6)
d.polygon([(150, 150), (118, 146), (146, 118)], fill=(230, 150, 20))
d.text((40, 160), 'LIGHT 45deg', fill=(160, 100, 10))
im.convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else 'calibration_board.png')
