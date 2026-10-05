"""工程區機台清單（v6）：位置與大小量自擺設參考圖，地圖、切圖都從這裡產生。流程見 .claude/skills/starport-scene-props/。

座標都是遊戲 px：cx＝圖的水平中心，bottom＝圖的底邊（物件接地的前緣），width＝圖寬（高度依原圖比例）。
量法：擺設參考圖是底圖裁切縮到 1024 寬，參考圖 1 px＝1.5 遊戲 px；下半部參考圖從遊戲 y 768 開始。
depth＝碰撞從底邊往上算幾格（0＝不擋路，例：椅子）。stand 欄位已不用：互動站位由 engineering_build.py 自動挑（走得到、在互動範圍內、最靠近正前方）。
sheet／order：在哪張生圖、第幾件（由左到右、由上到下）。text 空字串＝不能互動。
"""

T = 96

# (id, 名稱, cx, bottom, width, depth, sheet, order, text, stand)
# 風格：2070 年的星艦科技，乾淨、少磨損、不生鏽（使用者 2026-10-04 修過原圖，去掉鏽斑油污）
OBJECTS = [
    # 左上：研發角
    ('valves',          '管線閥門組',     184, 495, 177, .7, 'batch7_wall_units', 0, '幾個手輪閥門和壓力錶，其中一支指針微微抖動。', None),
    ('robot-arm',       '組裝機械手臂',   597, 453, 120, 1, 'batch10_machines', 1, '機械手臂把小零件一個個裝進外殼，動作很穩。', None),
    # 右上：製造區
    ('drums',           '耗材油桶',       820, 399, 155, .9, 'batch11_small', 0, '', None),
    ('fabricator',      '大型製造機',    1162, 537, 525, 2.2, 'batch6_fabricator', 0, '加工艙裡正在成形一批管件接頭，噴頭來回移動，光一明一滅。', (1162, 600)),
    ('materials',       '材料架',        1328, 1083, 225, .8, 'batch8_shelving', 0, '板材、管材和一捲捲線材，按尺寸分格堆放。', (1180, 1060)),
    # 西牆
    ('power-panel',     '配電盤',         183, 1118, 180, .8, 'batch7_wall_units', 1, '一整排斷路器，每個開關旁都貼著手寫標籤。', (330, 1100)),
    ('tool-wall',       '工具牆',         209, 1450, 197, .8, 'batch7_wall_units', 2, '扳手、焊槍和量具照輪廓掛好，只有一格是空的。', (360, 1430)),
    ('lockers',         '休息角',         239, 1770, 257, .8, 'batch7_wall_units', 3, '置物櫃上貼著班表，咖啡機旁擺著一個沾了油漬的馬克杯。', (420, 1740)),
    # 中央：維修區
    ('repair',          '維修中機台',     788, 1173, 285, 1.2, 'batch10_machines', 0, '外殼被打開了，裡面有一片燒黑的電路板。', (788, 1230)),
    ('tool-cart',       '工具推車',      1065, 1161, 165, .8, 'batch11_small', 2, '', None),
    # 東牆
    ('parts-shelves',   '零件貨架',      1324, 1461, 203, .8, 'batch8_shelving', 1, '一格格標好編號的零件盒。', (1180, 1440)),
    ('repair-queue',    '待修品架',      1311, 1770, 213, .8, 'batch8_shelving', 2, '從艦上各處送回來的故障設備，每件都綁著寫了地點的吊牌。', (1170, 1740)),
    # 大門內側：收件區
    ('crates',          '貨箱',          1024, 1476, 248, 1, 'batch11_small', 1, '', None),
    ('repair-pallet',   '待修品',        1056, 1758, 192, .9, 'batch11_small', 3, '剛送來的一台故障設備，吊牌上寫著「居住區 C」。', (930, 1760)),
    # v7（2026-10-04）：全息設計桌、個人流水線、兩張純維修組裝工作桌、雜物；量自全室參考圖 batch12（參考圖 1 px＝1.7819 遊戲 px）
    ('assembly-line',   '個人流水線',     623, 529, 508, 1.2, 'batch13_line', 0, '料斗把零件一個個送上輸送帶，機械手臂組好後經過掃描門，落進成品箱。', None),
    ('holo-table',      '全息設計桌',     552, 870, 321, 1.2, 'batch14_tables', 0, '桌面上投影著一個零件的立體線框，正一點一點旋轉調整。', None),
    ('workbench-a',     '組裝工作台',     543, 1336, 296, 1, 'batch14_tables', 1, '組裝到一半的零件旁邊，工具照順序排好。', None),
    ('workbench-b',     '組裝工作台',     550, 1572, 297, 1, 'batch14_tables', 1, '工作台上攤著拆下來的軸承和一盤螺絲。', None),
    ('drone-dock',      '維修無人機',    1078, 852, 221, 1, 'batch15_clutter', 0, '維修無人機停在充電座上，指示燈慢慢地閃。', None),
    ('cable-spools',    '電纜捲',         463, 994, 143, .7, 'batch15_clutter', 1, '', None),
    ('panel-stack',     '備用艙板',      1325, 770, 184, .6, 'batch15_clutter', 2, '', None),
    ('part-bins',       '零件盒',        1045, 1280, 148, .7, 'batch15_clutter', 3, '', None),
    ('toolbox',         '工具箱',         646, 1128, 89, 0, 'batch15_clutter', 4, '', None),
]
# 共用同一張圖的物件：{物件 id: 用哪件的圖}（兩張工作台長一樣）
SHARED_SPRITE = {'workbench-b': 'workbench-a'}

# 椅子、凳子：不擋路、不能互動，同一張圖可以擺很多次（id, 圖, cx, bottom）
# 2026-10-04 使用者刪掉四張電腦桌（太舊工業風），配桌子的椅凳也先不擺；圖保留，要用時加回來，例：('chair-console', 'chair', 997, 730)
SEATS = []
# 椅子、凳子的原圖在哪張、第幾件、遊戲裡多寬
SEAT_SPRITES = {'chair': ('batch11_small', 4, 78), 'stool': ('batch11_small', 5, 57)}

# 生出來的比例跟參考圖差很多的，改照高度縮放（遊戲 px）：機械手臂的手臂往旁邊伸，照寬度縮會太小
HEIGHT_FIT = {'robot-arm': 258, 'solder-station': 157, 'cobot': 126}

# 備用素材：已生好、切好，還沒擺進地圖（等使用者決定工廠流程）。{sheet: [(order, 圖名, 遊戲寬 px, 名稱)]}
# 寬度依佔地格數估（一格 96 px），參考既有的椅子 78、工具推車 165。
SPARES = {
    'batch16_conveyors': [(0, 'conveyor-h', 384, '輸送帶（橫）'), (1, 'conveyor-v', 106, '輸送帶（直）')],
    # 精密工作站（2050 sci-fi 設計，2026-10-04 重畫）：寬度量自擺設參考圖 batch20b（參考圖 128 px＝1 格＝96 遊戲 px）
    'batch21_workbench_large': [
        (0, 'esd-bench', 164, '防靜電精密工作台'), (1, 'scan-arch', 157, '品檢掃描門'),
        (2, 'printer-3d', 105, '3D 列印機'), (3, 'parts-drawers', 87, '零件抽屜櫃')],
    'batch22_workbench_small': [
        (0, 'diag-cart', 90, '診斷測試推車'), (1, 'solder-station', 102, '焊接排煙站'), (2, 'cobot', 80, '移動式協作手臂'),
        (3, 'stack-cart', 68, '模組工具箱推車'), (4, 'eng-stool', 54, '工程師高腳椅')],
    # 大型機台（2050 sci-fi，2026-10-04）：寬度量自擺設參考圖 batch27（不限尺寸，由模型決定大小）
    'batch28_machines_a': [(0, 'mega-fabricator', 306, '大型製造機'), (1, 'diag-repair', 206, '自動診修艙')],
    'batch29_machines_b': [(0, 'holo-desk', 233, '全息設計桌'), (1, 'recycler', 191, '材料回收機')],
    'batch18_logistics': [
        (0, 'lift-tower', 130, '自動倉儲塔'), (1, 'amr', 110, '自走搬運機器人'), (2, 'shop-crane', 170, '移動吊臂'),
        (3, 'case-dolly', 140, '工具箱台車'), (4, 'gas-rack', 120, '氣瓶架'), (5, 'scrap-bins', 180, '回收分類桶'),
        (6, 'charge-locker', 125, '電池充電櫃'), (7, 'material-cart', 170, '板材管材推車'), (8, 'spare-pallet', 150, '備品棧板')],
    'batch19_crew_corner': [
        (0, 'coffee-counter', 160, '咖啡吧台'), (1, 'plan-board', 170, '移動白板'), (2, 'sofa', 192, '雙人沙發'),
        (3, 'side-table', 66, '小邊桌'), (4, 'eyewash', 115, '洗眼沖淋站'), (5, 'extinguisher', 46, '滅火器'),
        (6, 'mini-fridge', 70, '小冰箱'), (7, 'step-ladder', 110, '移動登高梯'), (8, 'ppe-rack', 120, '防護裝備架')],
}

def sheets():
    """{sheet: [(order, sprite 名稱, 目標寬, 目標高或 None)]}，切圖用。"""
    out = {}
    for oid, _, _, _, width, _, sheet, order, *_ in OBJECTS:
        if oid not in SHARED_SPRITE: out.setdefault(sheet, []).append((order, oid, width, HEIGHT_FIT.get(oid)))
    for name, (sheet, order, width) in SEAT_SPRITES.items(): out.setdefault(sheet, []).append((order, name, width, None))
    for sheet, items in SPARES.items():
        for order, name, width, _ in items: out.setdefault(sheet, []).append((order, name, width, HEIGHT_FIT.get(name)))
    return {k: sorted(v) for k, v in out.items()}
