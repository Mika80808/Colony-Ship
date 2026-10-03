"""工程區機台：白模表（生圖用）與配置預覽。清單在 engineering_objects.py。

用法（uv run --with pillow --with numpy python tools/art/engineering_props.py ...）：
  whitebox <資料夾>   每個批次一張 1024 × 1024 白模表（洋紅底、遊戲實際像素），外加 props_sheets.json 記每件在表上的位置（之後切圖用）
  preview <out.png>   把白模照 engineering_objects.py 的位置擺到工程區地面圖上，生圖前先確認配置
  cut <批次> <原圖> <props_sheets.json>   原圖切成 public/assets/engineering/props/<id>.webp
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engineering_objects import OBJECTS, T, TOP, EXTRA_TOP, sprite_size

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LINE, FRONT, LID, INNER = (70, 76, 86), (226, 230, 236), (250, 251, 253), (200, 204, 210)
MAGENTA = (255, 0, 255)

def draw_object(d, oid, x0, base, w, dep, h):
    """一件白模，畫出這件東西真正的輪廓：桌子有桌腳、底下是空的；手臂是一節一節；層架是開放的。
    沒畫到的地方保持背景（白模表上是洋紅），生圖模型才不會把每件都填成實心櫃子。不寫字。
    (x0, base) 是佔地底邊左端；畫的範圍不超出 寬 w 格 × (h 格 + d × 24 px)。回傳外框。"""
    fw, fh, th = round(w * T), round(h * T), round(dep * TOP)
    x1, top = x0 + fw, base - fh

    def box(a, c, ytop, ybot, depth=0):
        """方塊：薄頂面 depth px＋正面。"""
        if depth: d.rectangle((a, ytop - depth, c, ytop), fill=LID, outline=LINE, width=3)
        d.rectangle((a, ytop, c, ybot), fill=FRONT, outline=LINE, width=3)

    def post(a, ytop, ybot, width=14):
        d.rectangle((a, ytop, a + width, ybot), fill=FRONT, outline=LINE, width=3)

    def bar(*pts, width=22):
        """有描邊的粗桿（手臂、管子）。"""
        d.line(pts, fill=LINE, width=width + 6, joint='curve'); d.line(pts, fill=FRONT, width=width, joint='curve')

    def wheel(cx, cy, r):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=FRONT, outline=LINE, width=3)
        d.line((cx - r, cy, cx + r, cy), fill=LINE, width=3); d.line((cx, cy - r, cx, cy + r), fill=LINE, width=3)

    def cyl(a, c, ytop, ybot):
        """直立圓柱：正面矩形＋頂面橢圓。"""
        d.rectangle((a, ytop, c, ybot), fill=FRONT, outline=LINE, width=3)
        d.ellipse((a, ytop - 12, c, ytop + 12), fill=LID, outline=LINE, width=3)

    L = lambda *p: d.line(p, fill=LINE, width=3)
    R = lambda a, b, c, e: d.rectangle((a, b, c, e), outline=LINE, width=3)

    if oid == 'fabricator':
        box(x0, x1, base - 36, base)                                      # 底座
        bar(x0 + 40, base - 36, x0 + 40, top - th + 16, width=18)         # 龍門架兩根柱
        bar(x1 - 120, base - 36, x1 - 120, top - th + 16, width=18)
        bar(x0 + 30, top - th + 16, x1 - 110, top - th + 16, width=20)    # 龍門架橫樑
        box(x0 + 70, x1 - 140, top + 40, base - 36, th - 30)              # 加工艙本體
        R(x0 + 110, top + 70, x1 - 180, base - 80)                        # 觀察窗
        cyl(x1 - 100, x1 - 20, top + 70, base - 36)                       # 側邊材料罐
    elif oid in ('fab-console', 'section-monitor'):
        box(x0 + 8, x1 - 8, base - 52, base, 20)                          # 矮桌
        box(x0 + 30, x1 - 30, top - th + 4, base - 64)                    # 立在桌面後緣的斜螢幕
        R(x0 + 40, top - th + 14, x1 - 40, base - 74)
    elif oid == 'power-panel':
        for cx in (x0 + 40, x0 + 96, x0 + 152): bar(cx, top - th, cx, top + 30, width=16)   # 頂上的電纜管
        box(x0, x1, top + 20, base, th - 20)
        for c in range(2):
            for r in range(3): R(x0 + 12 + c * 86, top + 40 + r * 80, x0 + 92 + c * 86, top + 110 + r * 80)
    elif oid == 'valves':
        box(x0 + 16, x1 - 16, base - 70, base, 20)                        # 底下的泵浦座
        bar(x0 + 40, base - 70, x0 + 40, top - th + 10, width=26)         # 兩根直管
        bar(x1 - 44, base - 70, x1 - 44, top - th + 10, width=26)
        rows = (top + 40, top + 140, top + 230)
        for y in rows: bar(x0 + 20, y, x1 - 20, y, width=22)              # 三根橫管
        for i, y in enumerate(rows): wheel(x0 + 82 + (i % 2) * 30, y, 26)  # 手輪閥
        for y in (top + 90, top + 190): d.ellipse((x1 - 70, y - 14, x1 - 42, y + 14), fill=FRONT, outline=LINE, width=3)   # 壓力錶
    elif oid == 'tool-wall':
        d.rectangle((x0 + 8, top - th, x1 - 8, base - 160), fill=FRONT, outline=LINE, width=3)   # 上面的掛板（薄板，靠牆）
        for gy in range(top - th + 20, base - 170, 20):
            for gx in range(x0 + 22, x1 - 16, 20): d.point((gx, gy), fill=LINE)
        box(x0, x1, base - 130, base, 30)                                 # 下面的抽屜櫃
        for r in range(3): R(x0 + 12, base - 118 + r * 38, x1 - 12, base - 88 + r * 38)
    elif oid in ('repair-queue', 'materials', 'parts-shelves'):
        for i in range(4):                                                # 四層開放層板，層與層之間是空的
            y = round(base - 12 - i * (fh + th - 40) / 3.4)
            box(x0, x1, y - 8, y + 4, 22 if i == 3 else 10)
        for x in (x0, x1 - 14): post(x, top - th, base)                   # 兩側立柱
    elif oid == 'lockers':
        box(x0, x1, top, base, th)
        L((x0 + x1) / 2, top, (x0 + x1) / 2, base)
        d.rectangle(((x0 + x1) / 2 + 10, top + 70, x1 - 10, top + 170), fill=INNER, outline=LINE, width=3)   # 右櫃打開的層格
        box((x0 + x1) / 2 + 24, x1 - 30, top + 110, top + 166)            # 咖啡機
    elif oid == 'crates':
        box(x0 + 30, x0 + 140, base - 140, base - 92, 20)                 # 上面一箱，錯開
        box(x0, x0 + 92, base - 72, base, 20); box(x0 + 100, x1, base - 72, base, 20)   # 下排兩箱
    elif oid == 'drums':
        for cx in (x0 + fw / 4, x0 + fw * 3 / 4):
            cyl(cx - 44, cx + 44, top + 12, base)
            L(cx - 44, top + fh / 3, cx + 44, top + fh / 3); L(cx - 44, top + fh * 2 / 3, cx + 44, top + fh * 2 / 3)
    elif oid == 'rnd-bench':
        slab = base - 84
        box(x0 + 16, x0 + 90, slab - th + 6 - 64, slab - th + 6, 14)      # 桌上的示波器
        box(x0, x1, slab, slab + 14, th)                                  # 桌面
        box(x0 + 106, x1 - 20, slab - 30, slab - 4, 10)                   # 拆開的原型機
        for x in (x0 + 6, x1 - 20): post(x, slab + 14, base)              # 桌腳
        box(x0 + 10, x1 - 10, base - 30, base - 20)                       # 下層架
    elif oid == 'robot-arm':
        box(x0 + 52, x1 - 52, base - 50, base, 22)                        # 底座
        cyl(x0 + 76, x1 - 76, base - 86, base - 50)                       # 旋轉座
        bar(x0 + 96, base - 86, x0 + 70, top + 60, x1 - 40, top + 26, width=24)   # 手臂兩節
        wheel(x0 + 70, top + 60, 16)                                      # 關節
        bar(x1 - 40, top + 26, x1 - 30, top + 56, width=12)                # 夾爪
    elif oid == 'workbench':
        slab = base - 76
        box(x0 + 12, x0 + 60, slab - th + 4 - 22, slab - th + 4, 8)       # 桌虎鉗
        box(x0, x1, slab, slab + 14, th)                                  # 桌面
        for x in (x0 + 6, x0 + 92): post(x, slab + 14, base)
        box(x1 - 82, x1 - 6, slab + 14, base)                             # 右邊的抽屜櫃
        for r in range(2): R(x1 - 74, slab + 24 + r * 26, x1 - 14, slab + 44 + r * 26)
    elif oid == 'tool-cart':
        bar(x0 + 8, top - th + 6, x1 - 8, top - th + 6, width=8)          # 推把
        for x in (x0 + 8, x1 - 20): post(x, top - th + 6, base - 12, 12)
        box(x0 + 4, x1 - 4, top + 20, top + 32, 18); box(x0 + 4, x1 - 4, base - 46, base - 34, 10)   # 上下兩層托盤
        for cx in (x0 + 16, x1 - 16): d.ellipse((cx - 9, base - 18, cx + 9, base), fill=FRONT, outline=LINE, width=3)   # 輪子
    elif oid == 'repair':
        box(x0 + 8, x1 - 46, top + 10, base, th)                          # 機台本體
        R(x0 + 30, top + 30, x1 - 70, base - 26)                          # 拆掉外殼露出的內部
        d.polygon([(x1 - 46, top + 20), (x1 - 6, top + 40), (x1 - 6, base - 10), (x1 - 46, base - 30)], fill=FRONT, outline=LINE)   # 打開的側蓋
    elif oid == 'repair-pallet':
        box(x0 + 36, x1 - 44, top + 4, base - 18 - th + 6, 16)            # 上面那台故障設備
        box(x0 + 4, x1 - 4, base - 18, base, th)                          # 棧板
        for x in (x0 + 40, x0 + 92, x0 + 144): d.rectangle((x, base - 12, x + 16, base), fill=INNER, outline=LINE, width=2)
        L(x1 - 44, top + 30, x1 - 26, top + 54)                           # 吊牌的繩子
        d.rectangle((x1 - 34, top + 52, x1 - 16, top + 66), fill=LID, outline=LINE, width=2)
    return x0, top - th - EXTRA_TOP.get(oid, 0), x1, base

def pack(items, width=1024, margin=24):
    """由高到矮、由左到右排進 1024 寬的表。回傳 {id: (x, base)}。"""
    out, x, y, row_h = {}, margin, margin, 0
    for oid, w, h in sorted(items, key=lambda i: -i[2]):
        if x + w > width - margin: x, y, row_h = margin, y + row_h + margin, 0
        row_h = max(row_h, h); out[oid] = (x, y + h); x += w + margin
    assert max(b for _, b in out.values()) <= width - margin, '一張表放不下'
    return out

def whitebox(folder):
    os.makedirs(folder, exist_ok=True)
    sheets = {}
    for batch in sorted({o[7] for o in OBJECTS}):
        objs = [o for o in OBJECTS if o[7] == batch]
        sizes = [(o[0], *sprite_size(o[4], o[5], o[6], o[0])) for o in objs]
        pos = pack(sizes)
        im = Image.new('RGB', (1024, 1024), MAGENTA); d = ImageDraw.Draw(im)
        boxes = {}
        for oid, _, _, _, w, dep, h, *_ in objs:
            x, base = pos[oid]
            boxes[oid] = draw_object(d, oid, x, base, w, dep, h)
        d.line([944, 944, 994, 994], fill=(255, 255, 255), width=5); d.polygon([(994, 994), (976, 990), (990, 976)], fill=(255, 255, 255))   # 光源方向，放右下角空白處
        im.save(os.path.join(folder, f'props_{batch}_whitebox.png'))
        sheets[batch] = {oid: list(map(round, b)) for oid, b in boxes.items()}
    with open(os.path.join(folder, 'props_sheets.json'), 'w', encoding='utf-8') as f:
        json.dump(sheets, f, ensure_ascii=False, indent=1)
    print('whitebox sheets', {b: list(v) for b, v in sheets.items()})

def preview(out):
    D = os.path.join(ROOT, 'public/assets/engineering/')
    ground = Image.open(D + 'ground.webp').convert('RGBA')
    for oid, _, x, y, w, dep, h, *_ in sorted(OBJECTS, key=lambda o: o[3] + o[5]):   # 由上往下畫，前面的蓋後面的
        layer = Image.new('RGBA', ground.size)                            # 每件自己一層，鏤空的地方透出後面
        draw_object(ImageDraw.Draw(layer), oid, x * T, (y + dep) * T, w, dep, h)
        ground.alpha_composite(layer)
    m = json.load(open(D + 'map.json', encoding='utf-8')); door = m['door']; ox, oy, ow, oh = door['opening']
    ground.alpha_composite(Image.open(D + 'door_left.webp').convert('RGBA'), (ox, oy)); ground.alpha_composite(Image.open(D + 'door_right.webp').convert('RGBA'), (ox + ow // 2, oy))
    ground.alpha_composite(Image.open(D + 'door_frame.webp').convert('RGBA'), (door['frame']['x'], door['frame']['y']))
    ground.crop((0, 0, ground.width, 2300)).convert('RGB').resize((768, 1150)).save(out)
    print('preview', out)

def cut(batch, raw, sheets_json):
    """生好的表 → public/assets/engineering/props/<id>.webp。照白模記下的外框切，縮放回遊戲像素；背景（透明或洋紅）去掉。"""
    import numpy as np
    sheets = json.load(open(sheets_json, encoding='utf-8'))[batch]
    im = Image.open(raw).convert('RGBA'); k = im.width / 1024
    a = np.asarray(im).astype(np.int16)
    bg = (a[..., 3] < 20) | ((a[..., 0] > 190) & (a[..., 1] < 90) & (a[..., 2] > 190))
    # 洋紅混色：明顯偏紫紅的像素一律去掉（層架空隙裡常有）；貼著背景的淡紫邊再削一圈
    magenta = (a[..., 0] > 120) & (a[..., 2] > 120) & (a[..., 1] < np.minimum(a[..., 0], a[..., 2]) - 50)
    near_bg = np.asarray(Image.fromarray(((bg | magenta) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    tinted = near_bg & ((a[..., 0] + a[..., 2]) / 2 - a[..., 1] > 28)
    rgba = np.asarray(im).copy(); rgba[bg | magenta | tinted] = 0
    src = Image.fromarray(rgba)
    out_dir = os.path.join(ROOT, 'public/assets/engineering/props'); os.makedirs(out_dir, exist_ok=True)
    for oid, (x0, y0, x1, y1) in sheets.items():
        piece = src.crop((round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k))).resize((x1 - x0, y1 - y0), Image.LANCZOS)
        piece.save(os.path.join(out_dir, f'{oid}.webp'), lossless=True)
    print('cut', batch, list(sheets))

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'cut': cut(sys.argv[2], sys.argv[3], sys.argv[4])
    else: {'whitebox': whitebox, 'preview': preview}[cmd](sys.argv[2])
