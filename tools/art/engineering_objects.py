"""工程區機台清單（v6）：位置與大小量自擺設參考圖，地圖、切圖都從這裡產生。流程見 .claude/skills/starport-scene-props/。

座標都是遊戲 px：cx＝圖的水平中心，bottom＝圖的底邊（物件接地的前緣），width＝圖寬（高度依原圖比例）。
量法：擺設參考圖是底圖裁切縮到 1024 寬，參考圖 1 px＝1.5 遊戲 px；下半部參考圖從遊戲 y 768 開始。
depth＝碰撞從底邊往上算幾格（0＝不擋路，例：椅子）。stand 欄位已不用：互動站位由 engineering_build.py 自動挑（走得到、在互動範圍內、最靠近正前方）。
sheet／order：在哪張生圖、第幾件（由左到右、由上到下）。text 空字串＝不能互動。
"""

T = 96

# (id, 名稱, cx, bottom, width, depth, sheet, order, text, stand)
OBJECTS = [
    # 左上：研發角
    ('valves',          '管線閥門組',     184, 495, 177, .7, 'batch7_wall_units', 0, '幾個手輪閥門和壓力錶，其中一支指針微微抖動。', None),
    ('rnd-bench',       '研發桌',         394, 472, 218, 1, 'batch9_desks', 0, '拆開的原型機攤在桌上，旁邊的示波器跳著波形。', (300, 520)),
    ('robot-arm',       '組裝機械手臂',   597, 453, 120, 1, 'batch10_machines', 1, '機械手臂把小零件一個個裝進外殼，動作很穩。', None),
    ('fab-console',     '設計終端',       398, 892, 201, 1, 'batch9_desks', 1, '螢幕上開著一張改良到一半的零件設計圖。', (300, 940)),
    # 右上：製造區
    ('drums',           '耗材油桶',       820, 399, 155, .9, 'batch11_small', 0, '', None),
    ('fabricator',      '大型製造機',    1162, 537, 525, 2.2, 'batch6_fabricator', 0, '加工艙裡正在成形一批管件接頭，噴頭來回移動，光一明一滅。', (1162, 600)),
    ('section-monitor', '製造機操作台',  1004, 705, 207, 1, 'batch9_desks', 2, '排程上列著幾筆零件訂單，最上面那筆標著「急件」。', (1110, 760)),
    ('materials',       '材料架',        1328, 1083, 225, .8, 'batch8_shelving', 0, '板材、管材和一捲捲線材，按尺寸分格堆放。', (1180, 1060)),
    # 西牆
    ('power-panel',     '配電盤',         183, 1118, 180, .8, 'batch7_wall_units', 1, '一整排斷路器，每個開關旁都貼著手寫標籤。', (330, 1100)),
    ('tool-wall',       '工具牆',         209, 1450, 197, .8, 'batch7_wall_units', 2, '扳手、焊槍和量具照輪廓掛好，只有一格是空的。', (360, 1430)),
    ('lockers',         '休息角',         239, 1770, 257, .8, 'batch7_wall_units', 3, '置物櫃上貼著班表，咖啡機旁擺著一個沾了油漬的馬克杯。', (420, 1740)),
    # 中央：維修區
    ('workbench',       '檢修工作台',     501, 1170, 228, 1, 'batch9_desks', 3, '桌面上有拆到一半的設備，螺絲按順序排在磁盤裡。', (380, 1220)),
    ('repair',          '維修中機台',     788, 1173, 285, 1.2, 'batch10_machines', 0, '外殼被打開了，裡面有一片燒黑的電路板。', (788, 1230)),
    ('tool-cart',       '工具推車',      1065, 1161, 165, .8, 'batch11_small', 2, '', None),
    # 東牆
    ('parts-shelves',   '零件貨架',      1324, 1461, 203, .8, 'batch8_shelving', 1, '一格格標好編號的零件盒。', (1180, 1440)),
    ('repair-queue',    '待修品架',      1311, 1770, 213, .8, 'batch8_shelving', 2, '從艦上各處送回來的故障設備，每件都綁著寫了地點的吊牌。', (1170, 1740)),
    # 大門內側：收件區
    ('crates',          '貨箱',          1024, 1476, 248, 1, 'batch11_small', 1, '', None),
    ('repair-pallet',   '待修品',        1056, 1758, 192, .9, 'batch11_small', 3, '剛送來的一台故障設備，吊牌上寫著「居住區 C」。', (930, 1760)),
]

# 椅子、凳子：不擋路、不能互動，同一張圖可以擺很多次（id, 圖, cx, bottom）
SEATS = [
    ('stool-rnd',       'stool', 403, 502),
    ('stool-terminal',  'stool', 398, 927),
    ('chair-console',   'chair', 997, 730),
    ('chair-workbench', 'chair', 497, 1200),
]
# 椅子、凳子的原圖在哪張、第幾件、遊戲裡多寬
SEAT_SPRITES = {'chair': ('batch11_small', 4, 78), 'stool': ('batch11_small', 5, 57)}

# 生出來的比例跟參考圖差很多的，改照高度縮放（遊戲 px）：機械手臂的手臂往旁邊伸，照寬度縮會太小
HEIGHT_FIT = {'robot-arm': 258}

def sheets():
    """{sheet: [(order, sprite 名稱, 目標寬, 目標高或 None)]}，切圖用。"""
    out = {}
    for oid, _, _, _, width, _, sheet, order, *_ in OBJECTS: out.setdefault(sheet, []).append((order, oid, width, HEIGHT_FIT.get(oid)))
    for name, (sheet, order, width) in SEAT_SPRITES.items(): out.setdefault(sheet, []).append((order, name, width, None))
    return {k: sorted(v) for k, v in out.items()}
