"""Compare an extracted room layout against the hand-tuned one.

A-1 is already correct in-game, so it doubles as the extractor's test case.
Comparing the two boxes directly is misleading: the shipped art was trimmed by
hand and inconsistently, so a piece can have a very different box and still draw
every pixel in the same place. What has to match is where the *opaque* pixels
land -- reference position plus however much transparent padding that PNG kept.

Usage: room_diff.py <extracted.json> <reference.json>
"""
import json
import sys
from pathlib import Path

from PIL import Image

from roomart import placed_box

ROOT = Path(__file__).resolve().parents[1]
ROOMS = ROOT / 'public/assets/rooms'


def boxes(doc):
    return {p['id']: p for p in doc.get('decals', []) + doc.get('objects', [])}


def opaque(piece):
    """Where this piece's art sits in the room, padding discounted."""
    path = ROOMS / piece['image']
    return placed_box(Image.open(path), piece) if path.exists() else None


sys.stdout.reconfigure(encoding='utf-8')
got = boxes(json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')))
want = boxes(json.loads(Path(sys.argv[2]).read_text(encoding='utf-8')))
shell = json.loads((ROOMS / 'shell.json').read_text(encoding='utf-8'))
want.update({p['id']: p for p in shell['fixtures']})

print(f'{"piece":<18} {"extracted":<20} {"shipped pixels":<20} drift')
print('-' * 74)
worst, missing = 0, []
for ident in sorted(want):
    a, b = got.get(ident), opaque(want[ident])
    if a is None:
        missing.append(ident)
        continue
    span = lambda t: f'{t[0]},{t[1]} {t[2]}x{t[3]}'
    mine = (a['x'], a['y'], a['width'], a['height'])
    if b is None:
        print(f'{ident:<18} {span(mine):<20} {"(no png)":<20}')
        continue
    drift = max(abs(m - r) for m, r in zip(mine, b))
    worst = max(worst, drift)
    flag = '' if drift <= 2 else ('  <-- check' if drift <= 8 else '  <-- WRONG')
    print(f'{ident:<18} {span(mine):<20} {span(b):<20} {drift}px{flag}')

print('-' * 74)
print(f'worst drift {worst}px over {len(want) - len(missing)} compared pieces')

# Collision is the half that never touches the PSD: it round-trips through the
# catalogue as fractions of the piece, so it has to come back where it started.
print('\ncollision rects rebuilt from furniture.json:')
worst_solid, checked = 0, 0
for ident in sorted(want):
    a, b = got.get(ident), want[ident]
    if a is None or not b.get('solid'):
        continue
    if len(a.get('solid', [])) != len(b['solid']):
        print(f'  {ident}: {len(a.get("solid", []))} rects, expected {len(b["solid"])}')
        continue
    for mine, ref in zip(a['solid'], b['solid']):
        checked += 1
        off = max(abs(mine[k] - ref[k]) for k in ('x', 'y', 'width', 'height'))
        worst_solid = max(worst_solid, off)
        if off > 4:
            print(f'  {ident}: {mine} vs {ref}  off by {off}px')
print(f'  worst {worst_solid}px over {checked} rects')

extra = sorted(set(got) - set(want))
if missing:
    print(f'not produced by the extractor: {", ".join(missing)}')
if extra:
    print(f'extracted but not in the reference: {", ".join(extra)}')
