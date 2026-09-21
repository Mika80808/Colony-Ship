"""Chroma-key and split the approved furniture atlas; requires Pillow and numpy."""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
im=Image.open(ROOT/'tmp/sprites/furniture-chroma.png').convert('RGBA')
pixels=np.array(im); rgb=pixels[:,:,:3].astype('int16')
key=(rgb[:,:,0]-rgb[:,:,1]>70)&(rgb[:,:,2]-rgb[:,:,1]>70)
pixels[key,3]=0
im=Image.fromarray(pixels)
objects=[('desk',(30,45,415,445)),('lounge',(430,90,775,450)),('wardrobe',(780,35,1068,440)),('bed',(1090,75,1515,430)),('shower',(50,480,350,970)),('sink',(450,495,740,925)),('toilet',(830,540,1030,925)),('shelf',(1135,560,1505,910))]
for name,box in objects:
    item=im.crop(box); item=item.crop(item.getbbox()); item.save(ROOT/f'public/assets/furniture/{name}.png')
    assert item.getchannel('A').getextrema()==(0,255)
print('Eight furniture cutouts saved with alpha.')
