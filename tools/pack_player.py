from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
atlas=Image.new('RGBA',(688,516)); preview=Image.new('RGBA',(688,516),'#435265')
for i in range(12):
    im=Image.open(ROOT / f'tmp/sprites/player-frames/{i+1:02d}.png').convert('RGBA')
    assert im.getchannel('A').getextrema()==(0,255)
    pos=((i%4)*172+6,(i//4)*172+6)
    atlas.alpha_composite(im,pos); preview.alpha_composite(im,pos)
atlas.save(ROOT / 'public/assets/player/walk.png')
preview.save(ROOT / 'tmp/sprites/player-preview.png')
