"""產生 A2 autotile 範本與起始檔（本專案一格 96px → 每張 192x288）。

- _template.png：標出每個區塊用途的範本（另存 _template_x3.png 放大版方便看）
- lawn.png / water.png / walkway.png：從平面材質自動做的起始 autotile，給人手修用
  草地：只有草，邊緣是一團團葉子（外角大圓弧上也有），葉團外透明、下方淡陰影
  水：外緣半透明，淡進底下的草地；岸邊一圈較深，中心保持原色
  步道：鋪在草地上的石板，外緣暗色側面加亮邊倒角、外角微圓
  （deck()：木平台外緣深色木條，目前地圖沒有木平台所以不輸出）

A2 排版（單位：格）：(0,0) 預覽｜(1,0) 內角｜(0..1, 1..2) 外角、四邊與中心。
autotile 的中心每格重複，所以材質週期必須是 1 格（96px）；這裡從 2 格週期的平面材質裁 1 格再修成無縫。

用法：autotile_starter.py <textures_dir> <out_dir>
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

T = 96
# 外角圓角半徑（px）。上限 48＝一個四分之一格；草緣再往內縮 STRIP，所以草看到的圓角是 半徑 - STRIP
CORNER_RADIUS = {'lawn': 48, 'water': 24, 'walkway': 10}
W, H = 2 * T, 3 * T

def seamless(a):
    """半位移混合，讓 1 格材質四邊無縫。"""
    h, w = a.shape[:2]
    rolled = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    weight = np.clip(np.minimum(1 - np.abs(np.linspace(-1, 1, h))[:, None], 1 - np.abs(np.linspace(-1, 1, w))[None, :]) * 3, 0, 1)[..., None]
    return a * weight + rolled * (1 - weight)

def tile_texture(tex_dir, name, organic=True, planks=None, aligned=False):
    """平面材質（代表 2x2 格）→ 週期 1 格的 96px 材質，鋪滿整張 autotile。"""
    im = Image.open(os.path.join(tex_dir, f'{name}.png')).convert('RGB').resize((2 * T, 2 * T), Image.LANCZOS)
    if planks:  # 木板：拉伸到 1 格剛好 planks 條，上下自然接續；左右做混合
        src = Image.open(os.path.join(tex_dir, f'{name}.png')).convert('RGB')
        per = src.height / 9  # 原圖 2 格共 9 條板
        im = src.crop((0, 0, src.width, round(per * planks))).resize((2 * T, T), Image.LANCZOS)
        a = np.asarray(im, np.float32)[:, :T]
        rolled = np.roll(a, T // 2, 1)
        wx = np.clip((1 - np.abs(np.linspace(-1, 1, T))) * 3, 0, 1)[None, :, None]
        a = a * wx + rolled * (1 - wx)
    else:
        # aligned：材質本身就以 1 格為週期（例如一格一塊的地磚），從原點裁才不會把接縫裁到格子中間
        o = 0 if aligned else T // 2
        a = np.asarray(im, np.float32)[o:o + T, o:o + T]
        if organic: a = seamless(a)
    return np.tile(a, (3, 2, 1))  # 288 x 192

def distance_field(radius=24):
    """每個像素到「外面」的距離：預覽格與 2x2 區塊是島（圓角外框），內角格量到四個角點。"""
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32) + .5
    d = np.zeros((H, W), np.float32)
    def island(x0, y0, x1, y1, mask):
        dx = np.minimum(xs - x0, x1 - xs); dy = np.minimum(ys - y0, y1 - ys)
        corner = (dx < radius) & (dy < radius)
        v = np.where(corner, radius - np.hypot(radius - dx, radius - dy), np.minimum(dx, dy))
        d[mask] = v[mask]
    island(0, 0, T, T, (xs < T) & (ys < T))
    island(0, T, W, H, ys >= T)
    inner = (xs >= T) & (ys < T)
    corners = [np.hypot(xs - cx, ys - cy) for cx in (T, W) for cy in (0, T)]
    d[inner] = np.minimum.reduce(corners)[inner]
    return d

def blade_reach(radius=24):
    """葉團往外伸的長度（0~1），每一團是半圓形的隆起。
    直邊沿著 autotile 圖上的 x（上下邊）或 y（左右邊）量，週期取 96 的整數分之一且在 48 的倍數歸零；
    外角圓弧沿著角度量，兩端（接上直邊處）也歸零。所以邊、角、相鄰格怎麼拼都連得起來。內角不長葉團。"""
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32) + .5
    reach = np.zeros((H, W), np.float32)
    bump = lambda u: np.sqrt(np.clip(1 - (2 * np.mod(u, 1) - 1) ** 2, 0, 1))  # 整數處為 0 的半圓
    clumps = lambda u, a, b: .6 * bump(u * a) + .4 * bump(u * b)
    for x0, y0, x1, y1 in ((0, 0, T, T), (0, T, W, H)):
        box = (xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1)
        dx, dy = np.minimum(xs - x0, x1 - xs), np.minimum(ys - y0, y1 - ys)
        corner = (dx < radius) & (dy < radius)
        t = np.where(dy <= dx, xs, ys)
        straight = clumps(t / 96, 8, 14)                     # 在 t = 0, 48, 96… 歸零
        angle = np.arctan2(radius - dy, radius - dx) / (np.pi / 2)  # 0~1，兩端接直邊
        arc = clumps(angle, 4, 6)
        reach[box] = np.where(corner, arc, straight)[box]
    return reach

def lawn(tex_dir, d, radius):
    """只有草：草緣離格邊 STRIP，葉團往外伸最多 BLADE，葉團外透明（露出底下的步道或水面），
    葉團下方淡淡的陰影。"""
    STRIP, BLADE = 9, 8
    grass = tile_texture(tex_dir, 'lawn')
    g = STRIP - BLADE * blade_reach(radius)    # 每個位置草的外緣
    inside = d - g                             # >0 是草，<0 是草外
    shadow = np.clip(1 - (-inside) / 5, 0, 1) * (inside < 0) * .28  # 草緣外 5px 的淡陰影
    rim = np.clip(1 - inside / 6, 0, 1) * (inside >= 0)             # 草緣內 6px 稍微加深
    turf = grass * (1 - .22 * rim[..., None])
    a = np.clip(inside + .5, 0, 1)             # 1px 抗鋸齒
    alpha = a + (1 - a) * shadow
    rgb = turf * (a / np.maximum(alpha, 1e-6))[..., None]  # 陰影部分是黑色
    return rgb, np.where(d < 0, 0, alpha * 255)

def water(tex_dir, d, radius):
    rgb = tile_texture(tex_dir, 'water')
    depth = (1 - np.clip((d - 6) / 22, 0, 1))[..., None] * (d >= 2)[..., None]  # 岸邊深、中心原色
    rgb = rgb * (1 - .28 * depth) + np.array([10, 50, 55]) * .28 * depth
    return rgb, np.clip((d - 2) / 16, 0, 1) * 255

def walkway(tex_dir, d, radius):
    """鋪在草地上的石板：外緣 2px 暗色側面＋一道 2px 亮邊倒角，外角微圓，圓角外透明露出底下的草或水。"""
    rgb = tile_texture(tex_dir, 'walkway', organic=False, aligned=True)
    side = (d < 2.5)[..., None]
    bevel = ((d >= 2.5) & (d < 4.5))[..., None]
    rgb = np.where(side, rgb * .68, np.where(bevel, np.minimum(rgb * 1.08, 255), rgb))
    return rgb, np.clip(d + .5, 0, 1) * 255

def deck(tex_dir, d):
    rgb = tile_texture(tex_dir, 'deck', planks=4)
    rgb = np.where((d < 8)[..., None], rgb * .62, rgb)
    return rgb, np.where(d < 0, 0, 255)

def template(out):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(im)
    fills = {(0, 0): (120, 160, 255), (1, 0): (255, 170, 90)}
    for (cx, cy), c in fills.items(): dr.rectangle((cx * T, cy * T, cx * T + T - 1, cy * T + T - 1), fill=c + (160,))
    for qx in range(4):
        for qy in range(2, 6):
            border = qx in (0, 3) or qy in (2, 5)
            corner = qx in (0, 3) and qy in (2, 5)
            c = (230, 90, 90) if corner else (240, 210, 80) if border else (110, 200, 120)
            dr.rectangle((qx * 48, qy * 48, qx * 48 + 47, qy * 48 + 47), fill=c + (160,))
    for i in range(0, W + 1, 48): dr.line((i, 0, i, H), fill=(255, 255, 255, 120))
    for i in range(0, H + 1, 48): dr.line((0, i, W, i), fill=(255, 255, 255, 120))
    for i in range(0, W + 1, 96): dr.line((i, 0, i, H), fill=(20, 20, 20, 255), width=2)
    for i in range(0, H + 1, 96): dr.line((0, i, W, i), fill=(20, 20, 20, 255), width=2)
    im.save(os.path.join(out, '_template.png'))
    big = im.resize((W * 3, H * 3), Image.NEAREST); d = ImageDraw.Draw(big)
    try: font = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 26)
    except OSError: font = ImageFont.load_default()
    labels = [((0, 0), '預覽（單獨一格）'), ((1, 0), '內角（四個角各一）'), ((0, 2), '外角'), ((3, 2), '外角'), ((0, 5), '外角'), ((3, 5), '外角'),
              ((1, 2), '上邊'), ((0, 3), '左邊'), ((3, 3), '右邊'), ((1, 5), '下邊'), ((1, 3), '中心')]
    for (qx, qy), text in labels:
        x, y = (qx * 48 + 4) * 3 if qy >= 2 else (qx * 96 + 6) * 3, (qy * 48 + 6) * 3 if qy >= 2 else (qy * 96 + 6) * 3
        d.text((x, y), text, fill=(0, 0, 0, 255), font=font, stroke_width=3, stroke_fill=(255, 255, 255, 255))
    big.save(os.path.join(out, '_template_x3.png'))

def main(tex_dir, out):
    os.makedirs(out, exist_ok=True)
    template(out)
    for name, fn in (('lawn', lawn), ('water', water), ('walkway', walkway)):  # 木平台已改成水道（上面另外放橋），deck() 留著備用
        radius = CORNER_RADIUS[name]
        rgb, alpha = fn(tex_dir, distance_field(radius), radius)
        a = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha, 0, 255)]).astype(np.uint8)
        Image.fromarray(a, 'RGBA').save(os.path.join(out, f'{name}.png')); print('starter', name)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
