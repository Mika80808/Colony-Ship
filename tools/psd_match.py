"""Match PSD layers to the known-good a-1.json pieces by box overlap.

The PSD names furniture in Chinese and the JSON uses English ids, so rather than
guessing the mapping we score every pair by intersection-over-union. Layers that
score poorly on their own are then retried as composites: several game assets
were cut as one image from what the PSD keeps as two layers.
"""
import json
import sys
from itertools import combinations
from pathlib import Path
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[1]
ROOMS = ROOT / 'public/assets/rooms'


def iou(a, b):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    ix = max(0, min(ax1, bx1) - max(ax0, bx0))
    iy = max(0, min(ay1, by1) - max(ay0, by0))
    inter = ix * iy
    union = (ax1 - ax0) * (ay1 - ay0) + (bx1 - bx0) * (by1 - by0) - inter
    return inter / union if union else 0.0


def union_box(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


psd = PSDImage.open(sys.argv[1])
shell = json.loads((ROOMS / 'shell.json').read_text(encoding='utf-8'))
layout = json.loads((ROOMS / 'a-1.json').read_text(encoding='utf-8'))
pieces = {p['id']: (p['x'], p['y'], p['x'] + p['width'], p['y'] + p['height'])
          for p in shell['fixtures'] + layout['objects'] + layout['decals']}
loose = [(r['x'], r['y'], r['x'] + r['width'], r['y'] + r['height']) for r in layout['looseSolids']]

def trimmed_box(layer):
    """Layer boxes include soft glow the shipped PNGs were trimmed of, so compare
    the opaque extent instead -- that is also what the extractor will export.

    Raw layer pixels are enough here and avoid pulling in scikit-image, which
    psd-tools only needs to render layer effects (the very glow we are dropping).
    """
    x0, y0, _, _ = layer.bbox
    try:
        image = layer.composite()
    except ImportError:
        image = layer.topil()
    if image is None:
        return layer.bbox
    inner = image.convert('RGBA').getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    if not inner:
        return layer.bbox
    return (x0 + inner[0], y0 + inner[1], x0 + inner[2], y0 + inner[3])


layers = [(layer.name, trimmed_box(layer)) for layer in psd.descendants()
          if not layer.is_group() and layer.bbox != (0, 0, 0, 0)
          and not layer.name.startswith(('BG_', 'FG_Wall'))]

taken, rows = set(), []
for name, box in layers:
    best = max(pieces.items(), key=lambda kv: iou(box, kv[1]))
    rows.append((name, box, best[0], iou(box, best[1])))

print(f'{"PSD layer":<24} {"box":<22} {"best a-1.json match":<18} IoU')
print('-' * 78)
for name, box, ident, score in rows:
    mark = 'ok    ' if score >= 0.80 else ('weak  ' if score >= 0.5 else 'POOR  ')
    print(f'{name[:23]:<24} {f"{box[0]},{box[1]} {box[2]-box[0]}x{box[3]-box[1]}":<22} {ident:<18} {mark}{score:.2f}')
    if score >= 0.80:
        taken.add(ident)

print('-' * 78)
weak = [r for r in rows if r[3] < 0.80]
print(f'{len(rows) - len(weak)}/{len(rows)} layers map cleanly (IoU >= 0.80)\n')

# Game art is sometimes one image where the PSD keeps several layers. Try the
# largest groupings first so a genuine triple is not consumed by a weaker pair.
print('Composite candidates - layers whose union matches one piece better:')
claimed_layers, found = set(), False
for size in (3, 2):
    for combo in combinations(weak, size):
        names = [c[0] for c in combo]
        if any(n in claimed_layers for n in names):
            continue
        merged = union_box([c[1] for c in combo])
        ident, ibox = max(pieces.items(), key=lambda kv: iou(merged, kv[1]))
        score = iou(merged, ibox)
        if ident in taken or score < 0.80 or score <= max(c[3] for c in combo):
            continue
        found = True
        print(f'  {" + ".join(names)}  ->  {ident}  IoU {score:.2f}')
        taken.add(ident)
        claimed_layers.update(names)
if not found:
    print('  (none)')
orphans = [n for n, _, _, s in weak if n not in claimed_layers and s < 0.80]
if orphans:
    print(f'\nWeak layers still unexplained: {", ".join(orphans)}')

print('\nLoose solids (collision with no art of its own in the JSON):')
for box in loose:
    name, score = max(((n, iou(b, box)) for n, b in layers), key=lambda t: t[1])
    print(f'  {box[0]},{box[1]} {box[2]-box[0]}x{box[3]-box[1]}  <-  {name}  IoU {score:.2f}')

print(f'\n{len(pieces) - len(taken)} JSON pieces still unclaimed:')
print('  ' + ', '.join(sorted(set(pieces) - taken)))
