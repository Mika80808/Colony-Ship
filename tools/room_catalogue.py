"""Derive the furniture catalogue from the hand-tuned A-1 room.

A PSD only knows where the art sits. Collision boxes, labels and inspect text
were authored by hand, and a sofa in room A-7 wants the same collision box as
the one in A-1 -- just somewhere else on the floor. So we lift those per-piece
facts out of Lucian's furnishing (furnishings/lucian.json, the A-1 art) once, keyed by id, and the extractor re-attaches them to
whatever position the PSD reports.

Offsets are measured from where the art begins rather than from the piece box,
because the two disagree: the shipped PNGs were trimmed by hand and some kept
tens of pixels of transparent padding. The art is what a collision box was
drawn against, so the art is what it has to stay anchored to.

Usage: room_catalogue.py [--write]
"""
import json
import sys
from pathlib import Path

from PIL import Image

from roomart import placed_box

ROOT = Path(__file__).resolve().parents[1]
ROOMS = ROOT / 'public/assets/rooms'
OUT = ROOMS / 'furniture.json'

sys.stdout.reconfigure(encoding='utf-8')
shell = json.loads((ROOMS / 'shell.json').read_text(encoding='utf-8'))
layout = json.loads((ROOMS / 'furnishings/lucian.json').read_text(encoding='utf-8'))

catalogue, skipped = {}, []
for piece in layout['decals']:
    # Decals lie flat on the floor: no collision, no depth sorting, drawn before
    # anything else. The extractor only needs to know which ids behave that way.
    catalogue[piece['id']] = {'kind': 'decal'}

for piece in shell['fixtures'] + layout['objects']:
    art = placed_box(Image.open(ROOMS / piece['image']), piece)
    if art is None:
        skipped.append(piece['id'])
        continue
    ax, ay, _, ah = art

    entry = {}
    # Depth is normally the bottom of the art; anything else was a deliberate
    # nudge (the blanket sorts with its bed, not with its own shorter box).
    offset = piece['depth'] - (ay + ah)
    if offset:
        entry['depthOffset'] = offset
    for key in ('label', 'inspectText'):
        if key in piece:
            entry[key] = piece[key]
    if piece.get('solid'):
        entry['solid'] = [{
            'dx': rect['x'] - ax,
            'dy': rect['y'] - ay,
            'width': rect['width'],
            'height': rect['height'],
        } for rect in piece['solid']]
    catalogue[piece['id']] = entry

if '--write' in sys.argv:
    OUT.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'wrote {OUT} with {len(catalogue)} entries')
else:
    print(json.dumps(catalogue, ensure_ascii=False, indent=2))
if skipped:
    print(f'no art found, left out: {", ".join(skipped)}')
