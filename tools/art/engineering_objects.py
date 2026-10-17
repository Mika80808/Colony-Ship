"""工程區機台清單（v6）：位置與大小量自擺設參考圖，地圖、切圖都從這裡產生。流程見 .claude/skills/starport-scene-props/。

座標都是遊戲 px：cx＝圖的水平中心，bottom＝圖的底邊（物件接地的前緣），width＝圖寬（高度依原圖比例）。
量法：擺設參考圖是底圖裁切縮到 1024 寬，參考圖 1 px＝1.5 遊戲 px；下半部參考圖從遊戲 y 768 開始。
depth＝碰撞從底邊往上算幾格（0＝不擋路，例：椅子）。stand 欄位已不用：互動站位由 engineering_build.py 自動挑（走得到、在互動範圍內、最靠近正前方）。
sheet／order：在哪張生圖、第幾件（由左到右、由上到下）。text 空字串＝不能互動。
"""

T = 96

# (id, 名稱, cx, bottom, width, depth, sheet, order, text, stand)
# 2026-10-17：物件全部重做（舊的 2070 工業風物件表、備用素材已刪，要查舊清單看 git 歷史）。新物件照 starport-scene-props 流程重新排。
OBJECTS = []
# 共用同一張圖的物件：{物件 id: 用哪件的圖}
SHARED_SPRITE = {}
# 椅子、凳子：不擋路、不能互動，同一張圖可以擺很多次（id, 圖, cx, bottom）
SEATS = []
# 椅子、凳子的原圖在哪張、第幾件、遊戲裡多寬：{圖名: (sheet, order, 遊戲寬)}
SEAT_SPRITES = {}
# 生出來的比例跟參考圖差很多的，改照高度縮放（遊戲 px）：{物件 id: 遊戲高}
HEIGHT_FIT = {}


def sheets():
    """{sheet: [(order, sprite 名稱, 目標寬, 目標高或 None)]}，切圖用。"""
    out = {}
    for oid, _, _, _, width, _, sheet, order, *_ in OBJECTS:
        if oid not in SHARED_SPRITE: out.setdefault(sheet, []).append((order, oid, width, HEIGHT_FIT.get(oid)))
    for name, (sheet, order, width) in SEAT_SPRITES.items(): out.setdefault(sheet, []).append((order, name, width, None))
    return {k: sorted(v) for k, v in out.items()}

# 格子排得比較擠的表：併塊距離調小，免得把上下相鄰的兩件併成一件（tools/art/cut.py 用）：{sheet: px}
JOIN = {}


def door():
    """厚重隔音門的切圖規格（tools/art/cut.py door engineering）。幾何以 engineering_build.py 為準。
    原圖是照白模生的，比例固定：主體拉伸對齊門框外緣，門洞照遊戲裡的門洞位置切。"""
    from engineering_build import DOOR_ZONE, OPEN_X, OPEN_W, OPEN_TOP, WALL_BASE, O, write_cap
    fw, fh = DOOR_ZONE[1] - DOOR_ZONE[0], WALL_BASE - O + 6
    return {
        'source': 'batch1_door.png',
        'frame': (fw, fh),
        'outer': (8, OPEN_TOP - O - 46, fw - 8, fh),                 # 門框外緣（不含頂上的警示燈座）
        'open': (OPEN_X - DOOR_ZONE[0], OPEN_TOP - O, OPEN_X - DOOR_ZONE[0] + OPEN_W, WALL_BASE - O),
        'keep': (10, 6, 10, 16),     # 門洞內緣的深色框、上緣燈條、底部門檻留在門框上，不跟著門扇滑走
        'after': write_cap,          # 牆簷前景含門框頂端，門框換了要一起更新
    }
