"""Rebuild greenhouse collision from fixed architecture, water and placed prop footprints."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT / "public/assets/greenhouse"
PATH = FOLDER / "map.json"
data = json.loads(PATH.read_text(encoding="utf-8"))
W, H, tile = data["width"], data["height"], data["tileSize"]
grid = [[0] * W for _ in range(H)]

# The upper greenhouse has permanent shelving, a console and window wall.
for y in range(10):
    grid[y] = data["collision"][y][:]
# The window's curved sill and the desk console are handled by fitted
# rectangles below, not coarse tiles.
for y in range(4):
    grid[y][14:26] = [0] * 12
grid[4][14:26] = [0] * 12
for y in range(10, 18):
    for left, right in ((0, 13), (27, 40)):
        if y in (10, 11, 13, 14, 16, 17):
            grid[y][left:right] = [1] * (right - left)
for y in list(range(18, 21)) + list(range(24, 27)):
    grid[y][0] = grid[y][W - 1] = 1
grid[H - 1] = [1] * W

# Water cannot be walked through. The glass corridor spans rows 21–23 above it.
for y, row in enumerate(data["terrain"]):
    if 21 <= y <= 23:
        continue
    for x, terrain in enumerate(row):
        if terrain == "A":
            grid[y][x] = 1

def image_size(name):
    path = FOLDER / "props" / (name.replace("{season}", "spring") + ".webp")
    with Image.open(path) as image:
        return image.size

rects = []
for prop in data["decor"]:
    if prop["sprite"].startswith("corridor_light_"):
        prop["block"] = True
    if not prop.get("block"):
        continue
    name = prop["sprite"]
    width, height = image_size(name)
    width *= prop["scale"]
    height *= prop["scale"]
    if name == "sofa":
        footprint_width, footprint_height = width * .94, height * .86
    elif name.startswith("corridor_light_"):
        footprint_width, footprint_height = width * .9, height * .30
    elif name == "fire_table":
        footprint_width, footprint_height = width * .82, height * .7
    elif name.startswith("tree_"):
        footprint_width, footprint_height = 65, 58
    elif name.startswith("placed_"):
        footprint_width, footprint_height = width * .65, height * .33
    elif name.startswith("rock_"):
        footprint_width, footprint_height = width * .8, height * .58
    else:
        footprint_width, footprint_height = width * .75, height * .55
    centre_x, bottom = prop["x"] * tile, prop["y"] * tile
    rects.append({
        "x": round((centre_x - footprint_width / 2) / tile, 3),
        "y": round((bottom - footprint_height) / tile, 3),
        "w": round(footprint_width / tile, 3),
        "h": round(footprint_height / tile, 3),
    })

# Follow the panoramic window's curved lower frame in narrow strips. The glass
# above each strip is solid; with the foot radius the player's shadow stays
# clear of the visible sill. The frame is drawn under the player.
# Feet stop this many world pixels below the frame's lowest opaque pixel.
SILL_MARGIN = 2
window = next(prop for prop in data["decor"] if prop["sprite"] == "window_frame")
with Image.open(FOLDER / "props/window_frame.webp") as frame:
    alpha = frame.getchannel("A")
    width, height = frame.size
    left = window["x"] * tile - width * window["scale"] / 2
    top = window["y"] * tile - height * window["scale"]
    for start in range(0, width, 8):
        end = min(start + 8, width)
        column_bottoms = [max((y for y in range(height) if alpha.getpixel((x, y)) > 128), default=-1)
                          for x in range(start, end)]
        bottom = max(column_bottoms)
        if bottom < 0:
            continue
        # Round the edges, not the width, so neighbouring strips share an edge.
        strip_left = round((left + start * window["scale"]) / tile, 4)
        strip_right = round((left + end * window["scale"]) / tile, 4)
        rects.append({
            "x": strip_left,
            "y": round(top / tile, 4),
            "w": round(strip_right - strip_left, 4),
            "h": round(((bottom + 1) * window["scale"] + SILL_MARGIN) / tile, 4),
        })

# The desk console blocks its legs and front panel (the lower two thirds of
# the sprite), trimmed a few pixels at the sides so the player can stand close.
desk = next(prop for prop in data["decor"] if prop["sprite"] == "desk_console")
desk_width, desk_height = image_size("desk_console")
desk_top = desk["y"] * tile - (desk_height - 64) * desk["scale"]
rects.append({
    "x": round((desk["x"] * tile - (desk_width / 2 - 6) * desk["scale"]) / tile, 4),
    "y": round(desk_top / tile, 4),
    "w": round((desk_width - 12) * desk["scale"] / tile, 4),
    "h": round((desk["y"] * tile - desk_top) / tile, 4),
})

# The workstation approach stays on the open floor just below the desk, and
# its clickable area reaches that approach point.
console = next(item for item in data["interactions"] if item["id"] == "console")
console["area"] = [17, 3, 6, 3]
console["stand"] = [round(desk["x"], 4), round(desk["y"] + .35, 4)]

sofa = next(prop for prop in data["decor"] if prop["sprite"] == "sofa")
sofa_width, sofa_height = image_size("sofa")
sofa["id"] = "sofa"
sofa["size"] = [sofa_width, sofa_height]
sofa_left = sofa["x"] - sofa_width / (2 * tile)
# The upholstery seams in sofa.webp are at x=160 and x=260 pixels.
# Adjacent hit areas share a boundary but never overlap.
seats = (("left", .21, .56, 20.7, 0, 160), ("middle", .5, .5, 21.3, 160, 260), ("right", .79, .56, 24.2, 260, sofa_width))
data["interactions"] = [item for item in data["interactions"] if not item["id"].startswith("sofa-")]
for name, u, v, stand_x, first_px, last_px in seats:
    seat_x = sofa["x"] + (u - .5) * sofa_width / tile
    data["interactions"].append({
        "id": f"sofa-{name}", "kind": "seat", "label": "坐下",
        "text": "", "area": [sofa_left + first_px / tile, sofa["y"] - 2, (last_px - first_px) / tile, 2],
        "stand": [stand_x, 18.2], "seat": {"decor": "sofa", "position": [u, v]},
        "exit": [seat_x, 17.6],
    })

data["collision"] = grid
data["collisionRects"] = rects
PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {len(rects)} furniture footprints")
