"""Report where a PNG's pixels actually are, at two alpha thresholds.

Layer boxes from a PSD include soft edges that a hand-trimmed export drops, so
comparing opaque extents tells a trim difference apart from different artwork.
"""
import sys
from PIL import Image

for path in sys.argv[1:]:
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    soft = alpha.point(lambda v: 255 if v > 10 else 0).getbbox()
    hard = alpha.point(lambda v: 255 if v > 200 else 0).getbbox()
    span = lambda b: f'{b[2]-b[0]}x{b[3]-b[1]} at {b[0]},{b[1]}' if b else 'empty'
    print(f'{path}\n  file {im.width}x{im.height}   alpha>10: {span(soft)}   alpha>200: {span(hard)}')
