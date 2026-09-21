"""Compare a room PSD's layer boxes against the hand-built JSON for that room.

A-1 already has known-good data, so this reports exactly how much of it the PSD
could have produced on its own -- which decides how much of the remaining rooms
can be automated. Run with the project venv.
"""
import json
import sys
from pathlib import Path
from psd_tools import PSDImage

ROOT = Path(__file__).resolve().parents[1]
ROOMS = ROOT / 'public/assets/rooms'

# Layer name -> id in the JSON. Duplicated names are disambiguated by position.
BY_NAME = {
    'OBJ_地毯3': 'rug-bedroom', 'OBJ_地毯3 拷貝': 'rug-living', 'OBJ_地毯2': 'mat-bath',
    'OBJ_冰箱': 'fridge', 'OBJ_滑板': 'skateboard', 'OBJ_遊戲櫃': 'game-cabinet',
    'Door_A1_Out': 'door-a1-out', 'Chair for desk': 'desk-chair', 'OBJ_浴室': 'shower',
    'OBJ_Bed_Base': 'bed-base', 'FG_Bed_Blanket': 'bed-blanket', 'OBJ_vr': 'vr-headset',
}
BY_POSITION = {(365, 354): 'sofa-west', (525, 394): 'sofa-center', (580, 551): 'sofa-south'}

psd = PSDImage.open(sys.argv[1])
shell = json.loads((ROOMS / 'shell.json').read_text(encoding='utf-8'))
layout = json.loads((ROOMS / 'a-1.json').read_text(encoding='utf-8'))
known = {p['id']: p for p in shell['fixtures'] + layout['objects'] + layout['decals']}

found, missing = {}, []
for layer in psd.descendants():
    if layer.is_group() or layer.bbox == (0, 0, 0, 0):
        continue
    x0, y0, x1, y1 = layer.bbox
    base = layer.name.split('(')[0].strip()
    ident = BY_POSITION.get((x0, y0)) or BY_NAME.get(base)
    if ident:
        found[ident] = (x0, y0, x1 - x0, y1 - y0, layer.name)

print(f'{"id":<16} {"PSD layer box":<22} {"JSON box":<22} match')
print('-' * 74)
exact = 0
for ident, (x, y, w, h, name) in sorted(found.items()):
    want = known.get(ident)
    if not want:
        print(f'{ident:<16} {"":<22} -- not in JSON')
        continue
    j = (want['x'], want['y'], want['width'], want['height'])
    ok = (x, y, w, h) == j
    exact += ok
    delta = '' if ok else f'  off by {x-j[0]:+d},{y-j[1]:+d} size {w-j[2]:+d},{h-j[3]:+d}'
    print(f'{ident:<16} {f"{x},{y} {w}x{h}":<22} {f"{j[0]},{j[1]} {j[2]}x{j[3]}":<22} {"EXACT" if ok else "differs"}{delta}')

print('-' * 74)
print(f'{exact}/{len(found)} layers reproduce the JSON box exactly')
absent = sorted(set(known) - set(found))
print(f'\n{len(absent)} pieces have NO layer of their own in the PSD:')
print('  ' + ', '.join(absent))
