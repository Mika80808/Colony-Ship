"""Convert game art from PNG to lossless WebP, in place.

Lossless is not a preference here, it is a requirement. The room pipeline reads
alpha to decide where a piece of art begins and ends, and that box drives depth
sorting and anchors every collision rect. Lossy WebP rewrites alpha, which would
move furniture by a few pixels with nothing to show for it in the diff.

So every file is decoded back and compared pixel by pixel before the PNG is
removed. One mismatch aborts the whole run with the originals untouched.

Usage: to_webp.py <dir> [<dir> ...] [--write]
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]


def convert(png: Path, write: bool) -> tuple[int, int]:
    """Return (png bytes, webp bytes). Raises if the round trip is not exact."""
    source = Image.open(png).convert('RGBA')
    webp = png.with_suffix('.webp')
    source.save(webp, 'WEBP', lossless=True, quality=100, method=6)

    check = Image.open(webp).convert('RGBA')
    if check.size != source.size or ImageChops.difference(source, check).getbbox() is not None:
        webp.unlink(missing_ok=True)
        raise SystemExit(f'ABORT: {png.name} did not survive the round trip unchanged')

    sizes = (png.stat().st_size, webp.stat().st_size)
    # The PNG is left behind on purpose. Writing the new file and retiring the
    # old one are separate decisions, and this tool should not be the thing that
    # deletes the only copy of some art if a path somewhere still points at it.
    if not write:
        webp.unlink()
    return sizes


def main():
    write = '--write' in sys.argv
    targets = [ROOT / arg for arg in sys.argv[1:] if not arg.startswith('--')]
    if not targets:
        sys.exit(__doc__)

    sys.stdout.reconfigure(encoding='utf-8')
    total_png = total_webp = count = 0
    for target in targets:
        for png in sorted(target.rglob('*.png')):
            before, after = convert(png, write)
            total_png += before
            total_webp += after
            count += 1

    verb = 'wrote' if write else 'would write'
    print(f'{verb} {count} files: {total_png / 1048576:.1f}MB -> {total_webp / 1048576:.1f}MB '
          f'({100 * (total_png - total_webp) / max(1, total_png):.0f}% smaller)')
    print('every file verified pixel-identical')
    print('the PNGs are still there -- delete them once nothing points at them'
          if write else 'dry run -- pass --write to create the WebP files')


if __name__ == '__main__':
    main()
