"""Dump a room PSD's layer tree so the extractor can be designed against reality.

Reads nothing but structure: name, kind, visibility, bounding box. Run with the
project venv:  tools/.venv/Scripts/python.exe tools/psd_inspect.py <file.psd>
"""
import sys
from pathlib import Path
from psd_tools import PSDImage


def walk(node, depth=0):
    for layer in node:
        box = layer.bbox
        empty = box == (0, 0, 0, 0)
        size = '         -' if empty else f'{box[2]-box[0]:5d}x{box[3]-box[1]:<4d}'
        at = '        -' if empty else f'{box[0]:5d},{box[1]:<4d}'
        flag = 'G' if layer.is_group() else ('-' if layer.visible else 'h')
        print(f'{flag} {"  " * depth}{layer.name[:44]:<{44 - depth * 2}} {at}  {size}')
        if layer.is_group():
            walk(layer, depth + 1)


psd = PSDImage.open(sys.argv[1] if len(sys.argv) > 1 else 'Room-A1.psd')
print(f'canvas {psd.width} x {psd.height}   colour mode {psd.color_mode}')
print(f'{"":<46} {"at":<9}  {"size":<10}')
print('-' * 72)
walk(psd)
print('-' * 72)
print('G = group, h = hidden')
