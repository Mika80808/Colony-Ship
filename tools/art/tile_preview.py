"""把材質重複拼成 3x3 預覽，檢查四邊接縫。改完材質先跑這個看看。

用法：tile_preview.py <textures_dir>   → 在 <textures_dir>/_preview/ 輸出每張的 3x3 拼接圖
"""
import os, sys
from PIL import Image

src = sys.argv[1]; out = os.path.join(src, '_preview'); os.makedirs(out, exist_ok=True)
for name in sorted(f for f in os.listdir(src) if f.endswith('.png')):
    t = Image.open(os.path.join(src, name)).convert('RGB')
    w, h = t.size; sheet = Image.new('RGB', (w * 3, h * 3))
    for y in range(3):
        for x in range(3): sheet.paste(t, (x * w, y * h))
    sheet.save(os.path.join(out, name)); print('preview', name, f'{w}x{h}')
