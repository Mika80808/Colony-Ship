"""Where a piece of room art actually begins and ends.

Every tool here has to agree on that answer -- the extractor when it crops a PSD
layer, the catalogue when it works out how far a collision rect sits from the
art, the diff when it checks the two against each other. One disagreement and
they silently measure from different origins, so the rule lives here once.
"""
import numpy as np

ALPHA_FLOOR = 10  # fainter than this is a soft edge the shipped art trims away
SPECK = 0.01      # a real edge covers this fraction of the art; a stray dot does not


def content_box(image, floor=ALPHA_FLOOR):
    """Bounding box of the art, ignoring specks. None if there is nothing.

    Plain getbbox() is not enough: these layers carry the odd stray speck tens
    of pixels clear of the art, faint enough to be invisible but opaque enough
    to survive any sensible alpha cutoff. The box is what drives depth sorting
    and anchors collision, so a row or column only counts when a real share of
    it is covered -- which a speck never manages.
    """
    covered = np.array(image.convert('RGBA').getchannel('A')) > floor
    height, width = covered.shape
    xs = np.flatnonzero(covered.sum(axis=0) >= max(3, height * SPECK))
    ys = np.flatnonzero(covered.sum(axis=1) >= max(3, width * SPECK))
    if not xs.size or not ys.size:
        return None
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


def placed_box(image, piece):
    """Where a shipped PNG's art sits in room coordinates, padding discounted."""
    box = content_box(image)
    if box is None:
        return None
    # A layout may draw the art at a size other than the file's; carry the scale.
    sx = piece['width'] / image.width
    sy = piece['height'] / image.height
    return (round(piece['x'] + box[0] * sx), round(piece['y'] + box[1] * sy),
            round((box[2] - box[0]) * sx), round((box[3] - box[1]) * sy))
