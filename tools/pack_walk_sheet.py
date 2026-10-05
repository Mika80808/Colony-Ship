"""Normalise an NPC walk sheet to the layout RoomScene reads.

Input: a transparent 4x4 sheet of any size, columns = facing (down, up, left,
right), rows = the four walk frames. The generator never spaces cells evenly,
so the grid is found from the gaps between opaque runs rather than by dividing
the canvas.

Output: 688x688, 172px cells, the same spec as Lucian's walk.webp --
feet on y=166 (RoomScene draws the sprite 166/172 above the floor point),
centred on x=86, and one scale for the whole sheet chosen so the first
standing frame is as tall as Lucian's (or a little shorter, when that would
push the tallest step frame out of its cell). A single scale keeps the walk
bob the artist drew; scaling each frame to fit would flatten it.

Usage: pack_walk_sheet.py <source> <out.webp>
"""
import sys

import numpy as np
from PIL import Image

CELL, FEET_Y, CENTRE_X = 172, 166, 86
STAND_HEIGHT = 152  # Lucian's first standing frame, measured from walk.webp
ALPHA = 20


def runs(mask_1d):
    """Contiguous index ranges where the mask is set, as (start, end_exclusive)."""
    idx = np.where(mask_1d)[0]
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i > prev + 1:
            out.append((start, prev + 1))
            start = i
        prev = i
    out.append((start, prev + 1))
    return out


def main():
    source, target = sys.argv[1], sys.argv[2]
    sheet = Image.open(source).convert('RGBA')
    opaque = np.array(sheet)[:, :, 3] > ALPHA
    cols, rows = runs(opaque.any(axis=0)), runs(opaque.any(axis=1))
    if len(cols) != 4 or len(rows) != 4:
        sys.exit(f'expected a 4x4 grid, found {len(cols)} columns and {len(rows)} rows of art')

    cells = [[sheet.crop((c0, r0, c1, r1)) for c0, c1 in cols] for r0, r1 in rows]
    cells = [[cell.crop(cell.getbbox()) for cell in row] for row in cells]
    scale = STAND_HEIGHT / cells[0][0].height
    # A tall step frame (big bob or a hair flick) would poke out of the cell;
    # shrink the whole sheet just enough instead of cropping that one frame.
    tallest = max(cell.height for row in cells for cell in row)
    if tallest * scale > FEET_Y:
        scale = FEET_Y / tallest
        print(f'tallest frame {tallest}px: scale lowered to fit the cell')

    atlas = Image.new('RGBA', (CELL * 4, CELL * 4))
    for r, row in enumerate(cells):
        for c, cell in enumerate(row):
            w, h = max(1, round(cell.width * scale)), max(1, round(cell.height * scale))
            if h > FEET_Y:
                sys.exit(f'frame r{r} c{c} would be {h}px tall and poke out of its cell')
            art = cell.resize((w, h), Image.LANCZOS)
            atlas.alpha_composite(art, (c * CELL + CENTRE_X - w // 2, r * CELL + FEET_Y - h))
    atlas.save(target, 'WEBP', lossless=True, method=6)
    print(f'scale {scale:.3f} -> {target}')


if __name__ == '__main__':
    main()
