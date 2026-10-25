"""醫療室的切圖資料（tools/art/cut.py 用）。

物件表：python tools/art/cut.py props medical <批次|all> → public/assets/medical/props/<名稱>.webp
寬度是 2 倍尺寸（遊戲一格 48，物件切成 2 倍、map.json 用 scale 0.5 顯示，2026-10-24 定）。藥局照 raw/props_pharmacy_area_v3.png（使用者認可的整區設計）重畫成單件，
寬度對齊規劃格數（配藥牆 12 格、下段櫃台 13 格），其他照 v3 裡的比例。順序＝表上由上到下、由左到右。
藥局最後的圖與位置：使用者在 PSD 排好，python tools/art/cut.py psd medical <PSD> 匯出圖與 medical/layout_<PSD 檔名>.json，PLACE 從那裡讀位置。
"""
import json
from pathlib import Path


def sheets():
    return {
        'props_pharmacy_long': [
            (0, 'pharmacy-dispensing-wall', 1152, None),   # 後牆整面配藥牆（含取藥爪、接收端）
            (1, 'pharmacy-counter-south', 1248, None),     # 下段櫃台：左端 L 角、取藥窗口＋叫號燈帶、諮詢隔板
        ],
        # 配藥牆拆層做取藥動畫（2026-10-25）：櫃體（格子空的、不畫玻璃）→ 取藥爪（沿內部軌道移動）→ 玻璃（程式做，見 medical_base_v9.py）
        'props_pharmacy_layers': [
            (0, 'pharmacy-dispensing-body-gen', 1152, None),  # 櫃體原圖（遊戲用使用者 PSD 匯出的 pharmacy-dispensing-body）
            (1, 'pharmacy-picker-gen', 78, None),         # 取藥爪原圖（遊戲用使用者 PSD 匯出的 pharmacy-picker）
            (2, 'pharmacy-counter-west-gen', 124, None),  # 有送藥管的舊設計，取藥口改到右端後不用（遊戲用 PSD 匯出的 pharmacy-counter-west）
        ],
        # 病床（第一版病房表裡的那張；被單另外拆一層，躺上去時蓋在角色身上，見 medical_base_v9.py）
        'props_ward': [
            (0, 'ward-bed', 288, None),                    # 病床：3 格寬
            (1, 'ward-cart', 100, None),                   # 床邊藥車（還沒擺）
        ],
        'props_pharmacy_small': [
            (0, 'pharmacy-counter-west-v1', 124, None),    # 舊版左段櫃台（遊戲用 PSD 匯出的 pharmacy-counter-west）
            (1, 'pharmacy-workstation', 384, None),       # 藥劑師工作台＋椅子＋全息螢幕＋掃描器
            (2, 'pharmacy-compounding-hood', 144, None),   # 無菌調配台
            (3, 'pharmacy-cold-cabinet', 112, None),       # 冷藏藥櫃
            (4, 'pharmacy-secure-locker', 144, None),     # 管制藥保險櫃（這版畫得比較寬，1.5 格）
            (5, 'pharmacy-supply-crates', 128, None),      # 補給船藥品箱（兩箱疊放）
            (6, 'pharmacy-bar-stool', 88, None),          # 諮詢位高腳凳（擺兩張）
        ],
    }


def door():
    """南側大門：玻璃自動門（使用者給的原圖，背景透明，玻璃半透明）。
    醫療室不用運大型貨物，門照人與推床的需要定：門框外寬 6 格（288），等比例縮放，底部貼走廊牆腳（345）再多 4 px 門檻。
    外框從原圖量，換圖不用改數字；門洞照原圖裡兩片門扇的位置換算。"""
    return {
        'source': 'medical_entrance_door_v2.png',
        'frame': (288, 349),
        'src_open': (296, 330, 962, 1184),   # 原圖裡兩片門扇合起來的範圍
        'src_light_y': 300,                  # 原圖裡門楣燈條的高度（門在動的時候閃）
    }


# 格子排得擠的表：併塊距離調小（cut.py 用）。layers 那張送藥管頂端離櫃體很近
JOIN = {'props_pharmacy_layers': 8}

# PSD 匯入（cut.py psd）：玻璃墊到櫃體的畫布，兩層同底邊才會排在一起
CANVAS = {'pharmacy-dispensing-glass': 'pharmacy-dispensing-body'}

# 擺進地圖（medical_base_v9.py 讀這裡寫 map.json 的 decor 與碰撞）。圖是 2 倍尺寸，地圖裡 scale 0.5。
# (id, 圖名, 水平中心 px, 底邊 px, 碰撞 (x, y, 寬, 高) 格 或 None[, 其他 decor 欄位])
# 藥局的位置與大小照使用者在 場景/藥局物件/pharmacy-dispensing-body.psd 排的（2026-10-26），從 cut.py psd 匯出的 layout 讀；
#   改 PSD 後重新匯入、再跑 medical_base_v9.py 就好。左段櫃台、保險櫃、第二張高腳凳拿掉了；
#   規劃的 C 格（櫃台）、B 格（病床）改由這裡照圖給的碰撞取代（PLAN_FROM_ART）。
# 配藥櫃三層：櫃體與玻璃同畫布、同位置；取藥爪沿格子內部軌道停三格後往右滑出（消失在右端取藥口後面），藏 4 秒。
SCALE = 0.5
PHARMACY = json.loads((Path(__file__).parent / 'medical' / 'layout_pharmacy-dispensing-body.json').read_text(encoding='utf-8'))
at = lambda name: (PHARMACY[name]['x'], PHARMACY[name]['bottom'])   # PSD 裡那件的水平中心、底邊
PLAN_FROM_ART = ('C', 'B')

# 一張圖拆成幾層（medical_base_v9.py 擺物件前先拆）：{新圖名: (原圖名, 原圖裡的範圍 (x0, y0, x1, y1), 做法)}
#   crop：只留範圍、裁成那麼大（底邊跟著範圍下緣）；clear：原圖挖掉範圍、畫布不變；keep：只留範圍、畫布不變（同底邊疊在原圖上）
# L 型櫃台：短邊、長邊各自一張，各有自己的底邊，角色站在短邊旁、長邊後面時排序才對（不然整張 L 用長邊的底邊排，短邊會蓋住角色的臉）。
# 病床：被單另外一層，跟床同畫布、底邊多 1 px，角色躺上去時排在床跟被單中間（身體蓋在被單下、臉露在枕頭上）。
LAYERS = {
    'pharmacy-counter-arm': ('pharmacy-counter-south', (0, 0, 94, 226), 'crop'),
    'pharmacy-counter-long': ('pharmacy-counter-south', (0, 0, 94, 226), 'clear'),
    'ward-bed-blanket': ('ward-bed', (42, 156, 250, 394), 'keep'),
}
COUNTER = (*at('pharmacy-counter-south'), PHARMACY['pharmacy-counter-south']['size'][0])   # 下段櫃台原圖的水平中心、底邊、圖寬（2 倍）
BED_X = [792, 1080, 1368]                               # 三張床的水平中心：規劃第 15、21、27 欄起各 3 格
BED_BOTTOM = 448                                        # 床頭貼北牆牆腳（地板從 192 開始），圖高 260.5
BED_REST = 0.6                                          # 躺下時腳點在床圖高的位置：臉露在被單上緣，頭髮只壓到一點床頭板
BAY_CENTERS = [1105, 1214, 1324, 1434, 1543]           # 五個格子的水平中心（玻璃範圍 1050–1598 五等分）
PICKER = {'stops': BAY_CENTERS, 'top': round(PHARMACY['pharmacy-picker']['top']), 'clip': [1050, 737, 548, 92]}   # clip＝玻璃格子的範圍
PICKUP_STAND = (1594, 895)                             # NPC 取藥時站的位置（右端取藥口前，調配櫃後面）
PLACE = [
    ('pharmacy-dispensing-body', 'pharmacy-dispensing-body', *at('pharmacy-dispensing-body'), (21.1, 17, 12.9, 1.03)),
    ('pharmacy-picker', 'pharmacy-picker', *at('pharmacy-dispensing-body'), None, {'anim': PICKER}),   # 跟櫃體同底邊，x 由動畫給
    ('pharmacy-dispensing-glass', 'pharmacy-dispensing-glass', *at('pharmacy-dispensing-glass'), None),
    ('pharmacy-workstation', 'pharmacy-workstation', *at('pharmacy-workstation'), (24.0, 20.3, 3.3, 1.08)),
    ('pharmacy-supply-crates', 'pharmacy-supply-crates', *at('pharmacy-supply-crates'), (27.1, 20.77, 1.7, 0.62)),
    ('pharmacy-cold-cabinet', 'pharmacy-cold-cabinet', *at('pharmacy-cold-cabinet'), (30.85, 20.9, 1.45, 0.75)),
    ('pharmacy-compounding-hood', 'pharmacy-compounding-hood', *at('pharmacy-compounding-hood'), (32.3, 20.9, 1.7, 0.75)),
    ('pharmacy-counter-long', 'pharmacy-counter-long', COUNTER[0], COUNTER[1], (21.03, 23.2, 13, 1.65)),   # 長邊
    ('pharmacy-counter-arm', 'pharmacy-counter-arm', COUNTER[0] - COUNTER[2] / 4 + 94 / 4, COUNTER[1] - 462 / 2 + 226 / 2,
     (21.03, 20.4, 0.95, 2.8)),                                                                            # L 角短邊
    ('pharmacy-stool', 'pharmacy-bar-stool', *at('pharmacy-bar-stool'), None),               # 櫃台外
]
for i, x in enumerate(BED_X, 1):
    PLACE += [(f'ward-bed-{i}', 'ward-bed', x, BED_BOTTOM, (x / 48 - 1.5, 4, 3, 5.25)),
              (f'ward-bed-{i}-blanket', 'ward-bed-blanket', x, BED_BOTTOM + 1, None)]

# 互動（map.json 的 interactions）：病床按 E 或點床躺下，移動就起來，回到床尾
INTERACTIONS = [{'id': f'ward-bed-{i}', 'kind': 'bed', 'label': '病床', 'text': '',
                 'area': [x / 48 - 1.5, 4, 3, round(BED_BOTTOM / 48 - 4, 4)], 'stand': [x / 48, 9.9],
                 'seat': {'decor': f'ward-bed-{i}', 'position': [.5, BED_REST]}, 'exit': [x / 48, 10]}
                for i, x in enumerate(BED_X, 1)]
