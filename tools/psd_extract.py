"""Turn a room PSD into the PNGs and furnishing JSON the game loads.

Every room shares one shell (walls, floor, bathroom), so a room PSD only has
to describe where its furniture sits. That furniture belongs to a character,
not a room: the output is keyed by occupant (an NPC id), and it follows that
character to whichever room they live in.

Output mirrors public/assets/rooms/, so copying it over is the whole install:
    furniture/<occupant>/<id>.webp     this character's own pieces
    decals/<occupant>/<id>.webp        their rugs
    furnishings/<occupant>.json        where everything sits
then register the occupant in FURNISHINGS (src/game/roomRuntime.ts).

Piece ids are global -- furniture.json keys collision by id -- so:
    * shell fixtures (walls, door, wc, basin, shower) are skipped; shell.json owns them
    * an id that already exists elsewhere (furniture/common/ or another character)
      is reused when the art is pixel-identical, and refused when it is not:
      two different sofas cannot both be called "sofa". Rename the layer
      (<occupant>-sofa, sofa-grey...) or map it in psd_aliases.json.

This walks the layer tree, trims each visible layer to its opaque pixels,
writes the image, and emits the furnishing JSON with collision and labels
re-attached from furniture.json. Hidden layers are left out and listed.

Layer naming
    BG_*, FG_Wall*   shell art, already extracted once -- skipped here
    OBJ_<id>         depth-sorted furniture
    FG_<id>          same, kept for art that draws over the actor
    Door_*           depth-sorted, id taken from psd_aliases.json
One layer is one piece: merge layers in the PSD if two bits of art ship as one
image. Names that are not already ids can be mapped in tools/psd_aliases.json.

Usage: psd_extract.py <room.psd> <occupant-id> [--out DIR]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage

from roomart import ALPHA_FLOOR, content_box

ROOT = Path(__file__).resolve().parents[1]
ROOMS = ROOT / 'public/assets/rooms'


def render(layer):
    """Flatten a layer to RGBA. Layer effects need scikit-image; the raw pixels
    are a fine stand-in since we trim the glow those effects produce anyway."""
    try:
        image = layer.composite()
    except ImportError:
        image = layer.topil()
    return image.convert('RGBA') if image else None


def trim(image, origin, floor=ALPHA_FLOOR):
    """Crop to the art and report where the crop landed in the room."""
    box = content_box(image, floor)
    if box is None:
        return None, None
    return image.crop(box), (origin[0] + box[0], origin[1] + box[1])


def piece_id(name, aliases):
    name = name.strip()  # trailing spaces in layer names are easy to not notice
    mapped = aliases.get(name)
    # A PSD is allowed two layers called the same thing. When that happens the
    # alias lists the ids in document order instead of a single name.
    if isinstance(mapped, list):
        return mapped.pop(0) if mapped else name
    if mapped:
        return mapped
    for prefix in ('OBJ_', 'FG_', 'DECAL_'):
        if name.startswith(prefix):
            return name[len(prefix):]
    return name


def main():
    sys.stdout.reconfigure(encoding='utf-8')  # layer names are Chinese; the console default is not
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2:
        sys.exit(__doc__)
    psd_path, occupant = args[0], args[1]
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else ROOT / 'tmp/extract' / occupant
    floor = int(sys.argv[sys.argv.index('--alpha') + 1]) if '--alpha' in sys.argv else ALPHA_FLOOR
    (out / 'furniture' / occupant).mkdir(parents=True, exist_ok=True)
    (out / 'decals' / occupant).mkdir(parents=True, exist_ok=True)
    (out / 'furnishings').mkdir(parents=True, exist_ok=True)
    shell_ids = {piece['id'] for piece in json.loads((ROOMS / 'shell.json').read_text(encoding='utf-8'))['fixtures']}
    conflicts, reused, shell_skipped = [], [], []

    catalogue = json.loads((ROOMS / 'furniture.json').read_text(encoding='utf-8'))
    alias_file = ROOT / 'tools/psd_aliases.json'
    aliases = json.loads(alias_file.read_text(encoding='utf-8')) if alias_file.exists() else {}

    psd = PSDImage.open(psd_path)
    objects, decals, unknown, empty, hidden = [], [], [], [], []

    for layer in psd.descendants():
        if layer.is_group() or layer.bbox == (0, 0, 0, 0):
            continue
        if layer.name.startswith(('BG_', 'FG_Wall')):
            continue
        # A hidden layer is left out on purpose (reference art, an old version),
        # but say so: composite() would otherwise hand back a blank image and it
        # would be reported as empty, which reads like a broken layer.
        if not layer.is_visible():
            hidden.append(layer.name)
            continue

        image = render(layer)
        cropped, origin = trim(image, layer.bbox, floor) if image else (None, None)
        if cropped is None:
            empty.append(layer.name)
            continue

        ident = piece_id(layer.name, aliases)
        if ident in shell_ids:
            shell_skipped.append(ident)
            continue
        entry = catalogue.get(ident)
        if entry is None:
            unknown.append(f'{layer.name} -> {ident}')
            entry = {}

        decal = entry.get('kind') == 'decal'
        folder = 'decals' if decal else 'furniture'
        rel = f'{folder}/{occupant}/{ident}.webp'
        # Same id already shipped for someone else (or as a common piece)?
        elsewhere = [path for path in (ROOMS / folder).glob(f'*/{ident}.webp') if path.parent.name != occupant]
        if elsewhere:
            existing = Image.open(elsewhere[0]).convert('RGBA')
            if existing.size == cropped.size and np.array_equal(np.array(existing), np.array(cropped)):
                rel = elsewhere[0].relative_to(ROOMS).as_posix()
                reused.append(f'{ident} -> {rel}')
            else:
                conflicts.append(f'{layer.name} -> {ident} (already {elsewhere[0].relative_to(ROOMS).as_posix()})')
                continue
        else:
            # Lossless, because the alpha this writes is the alpha the next run reads
            # back to decide where the art begins -- and that box anchors collision.
            cropped.save(out / rel, 'WEBP', lossless=True, quality=100, method=6)

        piece = {
            'id': ident,
            'image': rel,
            'x': origin[0],
            'y': origin[1],
            'width': cropped.width,
            'height': cropped.height,
        }
        if decal:
            decals.append(piece)
            continue

        # Pieces sort by the line where they meet the floor: their bottom edge,
        # unless the catalogue nudges them (a blanket sorts with its bed).
        piece['depth'] = piece['y'] + piece['height'] + entry.get('depthOffset', 0)
        for key in ('label', 'inspectText'):
            if key in entry:
                piece[key] = entry[key]
        if entry.get('solid'):
            piece['solid'] = [{
                'x': piece['x'] + rect['dx'],
                'y': piece['y'] + rect['dy'],
                'width': rect['width'],
                'height': rect['height'],
            } for rect in entry['solid']]
        objects.append(piece)

    objects.sort(key=lambda p: p['depth'])

    # Positions come from the art; the rest is gameplay authoring that no PSD
    # knows about, so an existing room keeps what was tuned by hand.
    target = out / 'furnishings' / f'{occupant}.json'
    installed = ROOMS / 'furnishings' / f'{occupant}.json'
    source = target if target.exists() else installed
    previous = json.loads(source.read_text(encoding='utf-8')) if source.exists() else {}
    layout = {
        'occupant': occupant,
        'shell': 'shell.json',
        'decals': decals,
        'objects': objects,
        'looseSolids': previous.get('looseSolids', []),
        'seats': previous.get('seats', []),
        'patrol': previous.get('patrol', []),
        'bed': previous.get('bed', {}),
    }
    target.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'{len(objects)} objects, {len(decals)} decals -> {target}')
    if hidden:
        print(f'skipped (hidden in the PSD -- show the layer to export it): {", ".join(hidden)}')
    if empty:
        print(f'skipped (no opaque pixels): {", ".join(empty)}')
    if shell_skipped:
        print(f'skipped (shell fixtures, owned by shell.json): {", ".join(shell_skipped)}')
    if reused:
        print('\nreused, art identical to an existing piece:')
        for line in reused:
            print(f'  {line}')
    if conflicts:
        print('\nNOT EXPORTED -- id already used by different art; rename the layer:')
        for line in conflicts:
            print(f'  {line}')
    if unknown:
        print(f'\nnot in furniture.json -- no collision or label was attached:')
        for line in unknown:
            print(f'  {line}')


if __name__ == '__main__':
    main()
