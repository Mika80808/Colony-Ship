"""Rebuild greenhouse collision from fixed architecture, water and placed prop footprints."""
import json
import struct
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
# The window's curved sill is handled by fitted rectangles below, not coarse tiles.
# Row 4 belongs to the desk console and remains blocked.
for y in range(4):
    grid[y][14:26] = [0] * 12
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
    path = FOLDER / "props" / (name.replace("{season}", "spring") + ".png")
    with path.open("rb") as image:
        image.seek(16)
        return struct.unpack(">II", image.read(8))

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
# above each strip is solid; the floor below the visible sill stays walkable.
window = next(prop for prop in data["decor"] if prop["sprite"] == "window_frame")
with Image.open(FOLDER / "props/window_frame.png") as frame:
    alpha = frame.getchannel("A")
    width, height = frame.size
    left = window["x"] * tile - width * window["scale"] / 2
    top = window["y"] * tile - height * window["scale"]
    for start in range(0, width, 24):
        end = min(start + 24, width)
        column_bottoms = [max((y for y in range(height) if alpha.getpixel((x, y)) > 128), default=-1)
                          for x in range(start, end)]
        bottom = min(column_bottoms)
        if bottom < 0:
            continue
        rects.append({
            "x": round((left + start * window["scale"]) / tile, 4),
            "y": round(top / tile, 4),
            "w": round((end - start) * window["scale"] / tile, 4),
            "h": round((bottom + 1) * window["scale"] / tile, 4),
            "bodyBlock": True,
        })

# Keep the workstation approach on the open floor below the actor-sized
# window clearance, and let its clickable area reach that approach point.
console = next(item for item in data["interactions"] if item["id"] == "console")
console["area"] = [17, 3, 6, 3]
console["stand"] = [20, 6]

sofa = next(prop for prop in data["decor"] if prop["sprite"] == "sofa")
sofa_width, _ = image_size("sofa")
sofa_left = sofa["x"] - sofa_width / (2 * tile)
# The upholstery seams in sofa.png are at x=160 and x=260 pixels.
# Adjacent hit areas share a boundary but never overlap.
seats = (("left", -1.25, 20.7, 0, 160), ("middle", 0, 21.3, 160, 260), ("right", 1.25, 24.2, 260, sofa_width))
data["interactions"] = [item for item in data["interactions"] if not item["id"].startswith("sofa-")]
for name, offset, stand_x, first_px, last_px in seats:
    seat_x = sofa["x"] + offset
    data["interactions"].append({
        "id": f"sofa-{name}", "kind": "seat", "label": "坐下",
        "text": "在沙發上稍作休息。", "area": [sofa_left + first_px / tile, sofa["y"] - 2, (last_px - first_px) / tile, 2],
        "stand": [stand_x, 18.2], "seat": [seat_x, sofa["y"] - .12],
        "exit": [seat_x, 17.6],
    })

data["collision"] = grid
data["collisionRects"] = rects
PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {len(rects)} furniture footprints")
