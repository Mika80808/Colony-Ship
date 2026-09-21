from pathlib import Path
from PIL import Image
atlas=Image.new('RGBA',(688,516)); preview=Image.new('RGBA',(688,516),'#435265')
for i in range(12):
 im=Image.open(f'tmp/sprites/frames/{i+1:02d}.png').convert('RGBA'); pos=((i%4)*172+6,(i//4)*172+6)
 atlas.alpha_composite(im,pos); preview.alpha_composite(im,pos)
atlas.save('public/assets/lucian/walk.png'); preview.save('tmp/sprites/preview.png')
