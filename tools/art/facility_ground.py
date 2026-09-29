"""依 map.json 的 terrain 把地面拼成設施底圖（L0），溫室、工程區共用。改了 terrain 或材質就重跑，不用重新生圖。

map.json 的 ground 設定每個設施用哪些地面、疊放順序與材質檔名：
  "ground": {"layers": [{"key": "A", "texture": "water"}, ...], "plotFrame": "edge"}
layers 由下往上排，最下層先鋪滿整張。
"overlays": [{"texture": "corridor", "x": 0, "y": 21, "w": 40, "h": 3}] 是疊在最上面的橫向長條貼圖（例如走廊），
單位是格：貼圖高度縮放到 h 格、只在左右方向重複，可以半透明（溫室走廊透出底下的池塘）。
加 "grassFringe": "bottom" 時，下緣挨著草地的地方補一排葉團，草尖蓋到貼圖上（lawn_painter.FRINGE_OVERLAP）。
覆蓋貼圖不佔地面格，底下照常是 terrain 畫出的水或草。特殊效果依材質名稱觸發：lawn（遮罩＋葉團）、water（水邊陰影）、deck（外緣木條）；
工程區沒有水和草，就不會用到它們（之後中央廣場可能會用）。

每種地面有兩種畫法，擇一（草地另有第三種，優先）：
- 草地「遮罩＋葉團」（材質名 lawn）：<textures>/lawn_field.png 加 <textures>/lawn_clumps/*.png 都在時使用，見 lawn_painter.py。
  圓滑水岸、沿岸隨機葉團，沒有每格重複的問題。
- autotile：<textures>/autotiles/<名稱>.png，RPG Maker MZ A2 排版（2x3 格，本專案一格 96px → 192x288；
  其他尺寸只要是 2:3 會自動縮放）。依鄰格自動組出邊與角，邊緣透明處露出下層。
- 平面材質：<textures>/<名稱>.png（正方形、四邊無縫、代表 2x2 格），邊緣用程式畫：
  木平台外緣深色木條、水邊內側陰影。

溫室的疊放順序：水 < 草地 < 土壤 < 步道 < 淺色鋪面 < 木平台（水在最底，草地長在水邊，地磚鋪在草地上）。
判斷邊與角時，比自己高的地面格也算「同類」：草地挨著步道不畫草緣，草一路延伸到地磚底下。
autotile 的每個四分之一格，底下先鋪「那個角落挨著的較低地面」（例如草地挨水的那一角鋪水面），
所以草緣透明處露出的是真正的鄰居，不會透出別層的邊。

用法：facility_ground.py <map.json> <textures_dir> <out.webp>
"""
import json, os, sys
import lawn_painter
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

EDGE = 16       # 菜圃外框地磚寬
TRIM = 8        # 平面木平台的外緣木條寬
SHADE = 18      # 平面水面的內側陰影寬

# A2 autotile 以四分之一格為單位的來源座標（欄, 列），同 RPG Maker 的 FLOOR_AUTOTILE_TABLE。
# 每個四分之一格看兩個直向鄰格 h（左/右）、v（上/下）和斜角 d。
QUARTERS = {  # quarter: (dx, dy, center, inner, outer, v_edge（上下不同）, h_edge（左右不同）)
    'tl': (-1, -1, (2, 4), (2, 0), (0, 2), (2, 2), (0, 4)),
    'tr': (1, -1, (1, 4), (3, 0), (3, 2), (1, 2), (3, 4)),
    'bl': (-1, 1, (2, 3), (2, 1), (0, 5), (2, 5), (0, 3)),
    'br': (1, 1, (1, 3), (3, 1), (3, 5), (1, 5), (3, 3)),
}

def autotile_quarter(inside, x, y, quarter):
    dx, dy, center, inner, outer, v_edge, h_edge = QUARTERS[quarter]
    h, v, d = inside(x + dx, y), inside(x, y + dy), inside(x + dx, y + dy)
    if h and v: return center if d else inner
    if not h and not v: return outer
    return v_edge if h else h_edge

def main(map_path, tex_dir, out):
    m = json.load(open(map_path, encoding='utf8'))
    T, W, H, terrain = m['tileSize'], m['width'], m['height'], m['terrain']
    TEXTURE = {l['key']: l['texture'] for l in m['ground']['layers']}
    PRIORITY = ''.join(l['key'] for l in m['ground']['layers'])  # 由下往上
    Q = T // 2
    doorway = lambda x, y: any(e['x'] <= x < e['x'] + e['w'] and e['y'] <= y < e['y'] + e['h'] for e in m['entrances'])
    # 外圍牆（左右兩欄、最下一排，入口除外）與地圖外都當作「同類」，不在牆邊畫收邊
    wall = lambda x, y: not (0 <= x < W and 0 <= y < H) or ((x in (0, W - 1) or y == H - 1) and not doorway(x, y))
    at = lambda x, y: terrain[y][x] if 0 <= x < W and 0 <= y < H else None
    near = lambda x, y: None if wall(x, y) else at(x, y)
    rank = lambda c: PRIORITY.index(c)
    cells = [(x, y) for y in range(H) for x in range(W)]
    img = Image.new('RGB', (W * T, H * T))

    def full_texture(name):
        """平面材質鋪滿整張，按格取用，相鄰格紋理連續。"""
        t = Image.open(os.path.join(tex_dir, f'{name}.png')).convert('RGB').resize((2 * T, 2 * T), Image.LANCZOS)
        f = Image.new('RGB', img.size)
        for yy in range(0, H * T, 2 * T):
            for xx in range(0, W * T, 2 * T): f.paste(t, (xx, yy))
        return f
    sheets = {}
    for layer, name in TEXTURE.items():
        path = os.path.join(tex_dir, 'autotiles', f'{name}.png')
        if not os.path.exists(path): continue
        sheet = Image.open(path).convert('RGBA')
        if sheet.size != (2 * T, 3 * T):
            assert sheet.width * 3 == sheet.height * 2, f'{path} must be 2:3 (A2 autotile)'
            sheet = sheet.resize((2 * T, 3 * T), Image.NEAREST)
        sheets[layer] = sheet
    surfaces = {}
    def surface(layer):
        """某種地面「完整鋪開、沒有邊」的樣子：autotile 用中心四塊拼，平面材質直接鋪。"""
        if layer not in surfaces:
            if layer in sheets:
                s = sheets[layer]; tile = Image.new('RGB', (T, T))
                for i, quarter in enumerate(('tl', 'tr', 'bl', 'br')):
                    cx, cy = QUARTERS[quarter][2]
                    tile.paste(s.crop((cx * Q, cy * Q, (cx + 1) * Q, (cy + 1) * Q)).convert('RGB'), ((i % 2) * Q, (i // 2) * Q))
                f = Image.new('RGB', img.size)
                for yy in range(0, H * T, T):
                    for xx in range(0, W * T, T): f.paste(tile, (xx, yy))
                surfaces[layer] = f
            else:
                surfaces[layer] = full_texture(TEXTURE[layer])
        return surfaces[layer]
    def underlay(x, y, quarter, layer):
        """四分之一格底下該鋪的地面：這個角落挨著的較低地面裡最高的那種；步道已經鋪好就不用再鋪。"""
        dx, dy = QUARTERS[quarter][:2]
        lower = [n for n in (near(x + dx, y), near(x, y + dy), near(x + dx, y + dy)) if n and rank(n) < rank(layer)]
        best = max(lower, key=rank, default=None)
        return surface(best) if best and best != PRIORITY[0] and best not in painted else None  # 最底層與畫好的草已經鋪滿

    img.paste(surface(PRIORITY[0]))  # 最底層（水）先鋪滿整張，任何透明處最後都會露出它
    painted = set()                  # 用遮罩畫法鋪滿的層：它已經在所有較高地面底下，不用再補 underlay
    for layer in PRIORITY:
        name = TEXTURE[layer]
        if layer != PRIORITY[0] and not any(layer in row for row in terrain): continue  # 地圖上沒用到的層不需要材質檔
        if name == 'lawn' and lawn_painter.available(tex_dir):
            img = lawn_painter.paint(img, terrain, T, tex_dir); painted.add(layer)
            print(layer, name, 'painted'); continue
        inside = lambda x, y, L=layer: wall(x, y) or rank(at(x, y)) >= rank(L)
        sheet = sheets.get(layer)
        if sheet:
            for x, y in cells:
                if at(x, y) != layer: continue
                for i, quarter in enumerate(('tl', 'tr', 'bl', 'br')):
                    px, py = x * T + (i % 2) * Q, y * T + (i // 2) * Q
                    under = underlay(x, y, quarter, layer)
                    if under: img.paste(under.crop((px, py, px + Q, py + Q)), (px, py))
                    cx, cy = autotile_quarter(inside, x, y, quarter)
                    piece = sheet.crop((cx * Q, cy * Q, (cx + 1) * Q, (cy + 1) * Q))
                    img.paste(piece, (px, py), piece)
            print(layer, name, 'autotile')
            continue
        # 平面材質只鋪自己的格子，底下要露什麼由 underlay 決定
        region = [(x, y) for x, y in cells if at(x, y) == layer]
        tex = full_texture(name)
        for x, y in region:
            box = (x * T, y * T, (x + 1) * T, (y + 1) * T); img.paste(tex.crop(box), box)
        own = [(x, y) for x, y in cells if at(x, y) == layer]
        if name == 'deck': deck_trim(img, own, near, tex, T, layer)
        if name == 'water': img = water_shade(img, own, near, T, layer)
        print(layer, name, 'flat')

    # 菜圃外框：相鄰的菜圃合成一塊，只圍最外面一圈（菜圃之間不畫框）
    if m.get('plots'):
        frame = full_texture(m['ground']['plotFrame'])
        plot = {(x, y) for p in m['plots'] for x in range(p['x'], p['x'] + p['w']) for y in range(p['y'], p['y'] + p['h'])}
        for x, y in plot:
            for side, (dx, dy) in SIDES.items():
                if (x + dx, y + dy) not in plot:
                    r = side_rect(x, y, side, EDGE, T); img.paste(frame.crop(r), r)

    for o in m['ground'].get('overlays', []):
        draw_overlay(img, o, os.path.join(tex_dir, f"{o['texture']}.png"), T)
        if o.get('grassFringe') == 'bottom':  # 下方的草離鏡頭比較近，草尖蓋到覆蓋貼圖的下緣
            lawn_painter.fringe(img, terrain, T, tex_dir, (o['y'] + o['h']) * T, o['x'] * T, (o['x'] + o['w']) * T)
        print('overlay', o['texture'])
    img.save(out, quality=86)
    print('saved', out, img.size)

def draw_overlay(img, o, path, T):
    """橫向長條覆蓋貼圖：縮到 h 格高，以地圖 x=0 為起點左右重複，依透明度疊在最上面。"""
    src = Image.open(path).convert('RGBA')
    h = o['h'] * T
    strip = src.resize((max(1, round(src.width * h / src.height)), h), Image.LANCZOS)
    x0, x1 = o['x'] * T, (o['x'] + o['w']) * T
    band = Image.new('RGBA', (x1 - x0, h), (0, 0, 0, 0))
    for sx in range(-(x0 % strip.width), x1 - x0, strip.width): band.paste(strip, (sx, 0))
    img.paste(band, (x0, o['y'] * T), band)

SIDES = {'n': (0, -1), 's': (0, 1), 'w': (-1, 0), 'e': (1, 0)}
def side_rect(x, y, side, width, T):
    x0, y0 = x * T, y * T
    return {'n': (x0, y0, x0 + T, y0 + width), 's': (x0, y0 + T - width, x0 + T, y0 + T),
            'w': (x0, y0, x0 + width, y0 + T), 'e': (x0 + T - width, y0, x0 + T, y0 + T)}[side]

def deck_trim(img, own, near, tex, T, key):
    trim = ImageEnhance.Brightness(tex).enhance(.62)
    for x, y in own:
        for side, (dx, dy) in SIDES.items():
            n = near(x + dx, y + dy)
            if n is not None and n != key:
                r = side_rect(x, y, side, TRIM, T); img.paste(trim.crop(r), r)

def water_shade(img, own, near, T, key):
    shade = Image.new('L', img.size, 0); d = ImageDraw.Draw(shade)
    water = Image.new('L', img.size, 0); dw = ImageDraw.Draw(water)
    for x, y in own:
        dw.rectangle((x * T, y * T, (x + 1) * T - 1, (y + 1) * T - 1), fill=255)
        for side, (dx, dy) in SIDES.items():
            if near(x + dx, y + dy) not in (key, None): d.rectangle(side_rect(x, y, side, SHADE // 2, T), fill=170)
    shade = shade.filter(ImageFilter.GaussianBlur(SHADE / 3))
    return Image.composite(Image.new('RGB', img.size, (10, 50, 55)), img, ImageChops.multiply(shade, water))

if __name__ == '__main__':
    main(*sys.argv[1:4])
