"""Extract the solid magenta player sheet; preserve the original in tmp/sprites."""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / 'tmp/sprites/player-source.png').convert('RGBA')
pixels = np.array(source)
rgb = pixels[:, :, :3].astype('int16')
magenta = (rgb[:, :, 0] - rgb[:, :, 1] > 70) & (rgb[:, :, 2] - rgb[:, :, 1] > 70)
pixels[magenta, 3] = 0
source = Image.fromarray(pixels)
strip = Image.new('RGBA', (384 * 12, 384))
for row in range(3):
    for col in range(4):
        frame = source.crop((col * 384, round(row * 1024/3), (col+1) * 384, round((row+1) * 1024/3)))
        bbox = frame.getbbox()
        assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < frame.width and bbox[3] < frame.height, 'A frame is clipped'
        frame = frame.crop(bbox)
        strip.alpha_composite(frame, ((row*4+col)*384 + (384-frame.width)//2, 384-frame.height))
strip.save(ROOT / 'tmp/sprites/player-strip.png')
