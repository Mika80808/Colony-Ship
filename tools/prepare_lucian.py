"""Remove the generated neutral checkerboard without erasing enclosed costume pixels.

Run with Pillow and numpy. Source is the imagegen extraction attempt in tmp/sprites.
The original user-provided artwork is never modified.
"""
from pathlib import Path
from collections import deque
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'tmp/sprites/lucian-extraction-source.png').convert('RGB')
slots = []
for row, (top, bottom) in enumerate([(0, 363), (363, 702), (702, 1024)]):
    for left, right in [(100, 410), (450, 770), (790, 1110), (1120, 1460)]:
        crop = source.crop((left, top, right, bottom)).convert('RGBA')
        rgb = np.array(crop)[:, :, :3].astype('int16')
        eligible = ((rgb.max(axis=2) - rgb.min(axis=2)) < 35) & (rgb.min(axis=2) > 65)
        mask = Image.fromarray(np.pad(eligible.astype('uint8') * 255, 1, constant_values=255)).copy()
        ImageDraw.floodfill(mask, (0, 0), 128, thresh=0)
        foreground = np.array(mask)[1:-1, 1:-1] != 128
        # Retain the largest connected silhouette; discard isolated background specks.
        visited = np.zeros_like(foreground)
        largest = []
        height, width = foreground.shape
        for y, x in zip(*np.where(foreground)):
            if visited[y, x]:
                continue
            queue = deque([(y, x)])
            visited[y, x] = True
            component = []
            while queue:
                cy, cx = queue.popleft()
                component.append((cy, cx))
                for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
                    if 0 <= ny < height and 0 <= nx < width and foreground[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((ny, nx))
            if len(component) > len(largest):
                largest = component
        alpha = np.zeros_like(foreground, dtype='uint8')
        for y, x in largest:
            alpha[y, x] = 255
        crop.putalpha(Image.fromarray(alpha))
        slots.append(crop.crop(crop.getbbox()))

# Convert irregular source cells to a horizontal strip for the shared normalizer.
strip = Image.new('RGBA', (384 * 12, 384))
for i, crop in enumerate(slots):
    strip.alpha_composite(crop, (i * 384 + (384 - crop.width) // 2, 384 - crop.height))
strip.save(ROOT / 'tmp/sprites/lucian-strip.png')
print('Extracted 12 complete silhouettes to a transparent strip.')

