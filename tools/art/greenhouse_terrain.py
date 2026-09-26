"""從溫室規劃圖（每格 64px）取樣顏色，產生地面類型格 terrain 與擺設清單 props，寫回 map.json。
只需跑一次；之後改地面就直接改 map.json 的 terrain 字串。

地面：W 步道  P 淺色鋪面  G 草地  D 休憩木平台  A 水  S 菜圃土壤
擺設（畫在地面之上的物件，底下的地面另外推定）：
  R 垂直種植架  B 灌木花叢  T 樹  O 石塊  Q 花盆  K 工作台  C 監控終端  N 觀景窗  X 柱  E 入口
"""
import json, sys
from collections import Counter
from PIL import Image

PALETTE = {
    'W': (216, 216, 216), 'R': (56, 104, 80), 'B': (104, 168, 104), 'G': (168, 200, 160),
    'A': (104, 184, 200), 'X': (88, 104, 112), 'S': (136, 104, 72), 'N': (120, 208, 224),
    'P': (224, 224, 208), 'O': (184, 176, 168), 'K': (136, 160, 176), 'D': (200, 184, 152),
    'T': (40, 88, 40), 'Q': (176, 136, 88), 'E': (224, 112, 88), 'C': (224, 176, 56),
    'S2': (240, 224, 192),  # 菜圃白框
}
PROPS = set('RBTOQKCNXE')

def classify(im, x, y):
    votes = Counter()
    for dx in range(8, 64, 7):
        for dy in range(20, 64, 7):
            r, g, b = im.getpixel((x * 64 + dx, y * 64 + dy))
            if max(r, g, b) > 244 or max(r, g, b) < 50: continue  # 標題文字的白字與黑邊
            k = min(PALETTE, key=lambda k: sum((a - c) ** 2 for a, c in zip((r, g, b), PALETTE[k])))
            votes[k[0]] += 1
    return votes.most_common(1)[0][0]

def ground_under(grid, x, y, walk):
    """擺設底下的地面。可走的擺設格（已被改成綠地的）直接變草地。"""
    c = grid[y][x]
    if c not in PROPS: return c
    if walk and c in 'BTOQ': return 'G'
    if c == 'O':  # 池塘裡的石頭坐在水上
        near = Counter(grid[j][i] for i, j in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)) if 0 <= i < 40 and 0 <= j < 28)
        return 'A' if near['A'] >= 2 else 'G'
    return {'B': 'G', 'T': 'G', 'Q': 'P'}.get(c, 'W')

def main(ref, map_path):
    im = Image.open(ref).convert('RGB')
    m = json.load(open(map_path, encoding='utf8'))
    grid = [[classify(im, x, y) for x in range(m['width'])] for y in range(m['height'])]
    terrain, props = [], []
    for y in range(m['height']):
        row = ''
        for x in range(m['width']):
            walk = m['collision'][y][x] == 0
            row += ground_under(grid, x, y, walk)
            c = grid[y][x]
            if c in PROPS and not (walk and c in 'BTOQ'): props.append({'kind': c, 'x': x, 'y': y})
        terrain.append(row)
    m['terrainLegend'] = {'W': '步道', 'P': '淺色鋪面', 'G': '草地', 'D': '休憩木平台', 'A': '水', 'S': '菜圃土壤'}
    m['terrain'] = terrain
    m['props'] = props
    return m, grid

if __name__ == '__main__':
    m, grid = main(sys.argv[1], sys.argv[2])
    for y, row in enumerate(grid): print(f'{y:2} ' + ''.join(row) + '   ' + m['terrain'][y])
    print(Counter(p['kind'] for p in m['props']))
    if '--write' in sys.argv:
        from json import dumps
        py = lambda v: '[' + ', '.join(map(py, v)) + ']' if isinstance(v, list) else '{' + ', '.join(dumps(k, ensure_ascii=False) + ': ' + py(x) for k, x in v.items()) + '}' if isinstance(v, dict) else dumps(v, ensure_ascii=False)
        open(sys.argv[2], 'w', encoding='utf8').write(py(m))
