"""Export one PSD layer to PNG so it can be eyeballed against the shipped art.

Usage: psd_export_layer.py <psd> <layer-name-substring> <out.png>
"""
import sys
from psd_tools import PSDImage

psd = PSDImage.open(sys.argv[1])
needle, out = sys.argv[2], sys.argv[3]

for layer in psd.descendants():
    if layer.is_group() or layer.bbox == (0, 0, 0, 0) or needle not in layer.name:
        continue
    image = layer.composite()
    image.save(out)
    x0, y0, x1, y1 = layer.bbox
    print(f'{layer.name}  bbox {x0},{y0} {x1-x0}x{y1-y0}  saved {out} ({image.width}x{image.height})')
    break
else:
    print(f'no layer matching "{needle}"')
