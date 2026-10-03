"""把 12 張行走幀拼成 688×516 遊戲圖集（4 欄方向 × 3 幀，每格 172px、內縮 6px）。

取代原本幾乎相同的 pack_player.py 與 pack_lucian.py。
幀圖取 <frames_dir>/01.png ~ 12.png；預覽圖存在 <frames_dir> 旁的 preview.png。

用法：pack_walk_atlas.py <frames_dir> <out.webp> [--check-alpha]
  --check-alpha  要求每幀 alpha 只有 0 與 255（玩家流程的保證，去背來源不一定成立）
例：
  python tools/pack_walk_atlas.py tmp/sprites/player-frames public/assets/player/walk.webp --check-alpha
  python tools/pack_walk_atlas.py tmp/sprites/frames public/assets/lucian/walk.webp
"""
import sys
from pathlib import Path
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if len(args) != 2:
    sys.exit(__doc__)
frames_dir, out = Path(args[0]), Path(args[1])
check_alpha = '--check-alpha' in sys.argv

atlas = Image.new('RGBA', (688, 516))
preview = Image.new('RGBA', (688, 516), '#435265')
for i in range(12):
    im = Image.open(frames_dir / f'{i + 1:02d}.png').convert('RGBA')
    if check_alpha:
        assert im.getchannel('A').getextrema() == (0, 255), f'{i + 1:02d}.png alpha 不是純 0/255'
    pos = ((i % 4) * 172 + 6, (i // 4) * 172 + 6)
    atlas.alpha_composite(im, pos)
    preview.alpha_composite(im, pos)
atlas.save(out, lossless=True)
preview.save(frames_dir.parent / 'preview.png')
print('wrote', out, 'and', frames_dir.parent / 'preview.png')
