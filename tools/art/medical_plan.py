"""醫療室規劃圖：產出 tools/art/medical/medical_plan.png 與 medical_plan.json，並做連通 / 窄道 / 死路檢查。

用法：uv run --with pillow python tools/art/medical_plan.py [輸出資料夾]
改配置就改 LAYOUT 的字母格與 THIN 的薄牆，重跑即可。說明見 docs/scenes/medical.md。
"""
import json, os, sys
from collections import deque
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'medical')
os.makedirs(OUT, exist_ok=True)
CELL = 64

# 本體 25×34（第 0–33 列，南牆＝走廊牆 30–33 列，跟實際地圖一樣 4 列），第 34–37 列是下方走廊（沿用居住區走廊素材）。
# 一般內牆跟走廊牆一樣高（約 346 px）：橫牆的牆頂在格線上、牆面往下垂，在圖上佔 4 列（W）；直牆只看得到牆頂，一格寬。
# 後排（列 1–6）：醫療研究（欄 1–7）｜居家休息區（欄 9–15）｜藥物研究（欄 17–23），門開在休息區。內牆 A（列 7–10）。
# 中排（列 11–15）：診間（欄 1–8）｜主走道（欄 10–13）｜病房三間（欄 15–23，之間是薄牆）。內牆 B（列 16–19），第 3 欄不砌牆直通手術室。
# 前排（列 20–29）：手術室（欄 1–5）｜候診（欄 7–9）｜主走道｜病房前走道（列 20–21）＋藥局（北牆列 22–25、店面列 26–29）。
LAYOUT = [
    "#########################",  # 0
    "#Y.....AWk.....LWV.....N#",  # 1
    "#Y.cc..AWk......WV..cc.N#",  # 2
    "#.GGGG..W.FFFF..W..GGGGZ#",  # 3
    "#.GGGG..W.uttu..W..GGGGZ#",  # 4
    "#..cc.....uuuu......cc..#",  # 5
    "#.......................#",  # 6
    "#WWWWWWWWWaaaaWWWWWWWWWW#",  # 7
    "#WWWWWWWWWaaaaWWWWWWWWWW#",  # 8
    "#WWWWWWWWWaaaaWWWWWWWWWW#",  # 9
    "#WWWWWWWWWaaaaWWWWWWWWWW#",  # 10
    "#PP..c.EEWaaaaWBBnBBnBBn#",  # 11
    "#pp.QQQEEWaaaaWBB.BB.BB.#",  # 12
    "#PP..c.EEWaaaaWBBcBBcBBc#",  # 13
    "#K........aaaaW.........#",  # 14
    "#K......S.aaaaW.........#",  # 15
    "#WW.WWWWWWaaaaWW.WW.WW.W#",  # 16
    "#WW.WWWWWWaaaaWW.WW.WW.W#",  # 17
    "#WW.WWWWWWaaaaWW.WW.WW.W#",  # 18
    "#WW.WWWWWWaaaaWW.WW.WW.W#",  # 19
    "#KK.S..H..aaaa..........#",  # 20
    "#.........aaaa..........#",  # 21
    "#.....W...aaaaWWWWWWWWWW#",  # 22
    "#m.OOiWbb.aaaaWWWWWWWWWW#",  # 23
    "#m.OO.W...aaaaWWWWWWWWWW#",  # 24
    "#.....Wbb.aaaaWWWWWWWWWW#",  # 25
    "#BB...W...aaaa.TMMMMMMMf#",  # 26
    "#BB...Wbb.aaaa.TzJJJzzzf#",  # 27
    "#BB...W...aaaa.TTTTTTTgT#",  # 28
    "#L....W..Laaaa.........L#",  # 29
    "##########DDDD###########",  # 30
    "##########DDDD###########",  # 31
    "##########DDDD###########",  # 32
    "#########qDDDD#X#########",  # 33
    "rrrrrrrrrrrrrrrrrrrrrrrrr",  # 34
    "rrrrrrrrrrrrrrrrrrrrrrrrr",  # 35
    "rrrrrrrrrrrrrrrrrrrrrrrrr",  # 36
    "RRRRRRRRRRRRRRRRRRRRRRRRR",  # 37
]

# key: (名稱, 顏色, 玩家可走)
LEGEND = {
    '#': ('外牆', '#56626b', False),
    'W': ('內牆（跟走廊牆一樣高：橫牆約 4 列、直牆一格寬）', '#7d8a94', False),
    '.': ('白色防滑地板', '#e9eeee', True),
    'a': ('走道（地面導引燈條）', '#bfe3df', True),
    'c': ('椅子（座位，可走）', '#e0b080', True),
    'L': ('盆栽', '#5e9c5a', False),
    # 醫療研究
    'Y': ('生物樣本冷凍櫃', '#9fd3e6', False),
    'A': ('樣本分析儀', '#4f8f86', False),
    'G': ('研究長桌', '#8aa0ad', False),
    # 居家休息區
    'k': ('小廚房（咖啡機、小冰箱）', '#c49a6c', False),
    'F': ('沙發', '#d9886a', False),
    't': ('茶几', '#a8744f', False),
    'u': ('地毯（可走）', '#efd9c3', True),
    # 藥物研究
    'V': ('通風櫃', '#7a8794', False),
    'N': ('自動合成儀', '#2e8b99', False),
    'Z': ('藥品樣本櫃', '#8d6e9e', False),
    # 診間
    'E': ('診療床', '#7fb7a8', False),
    'v': ('生命徵象監測儀', '#4f8f86', False),
    'Q': ('醫師診桌', '#b08a5a', False),
    'P': ('診斷治療艙（可密封當隔離艙）', '#2e8b99', False),
    'p': ('艙內掃描環（發光）', '#4dd0e1', False),
    'K': ('器械／耗材櫃', '#8aa0ad', False),
    'S': ('洗手台', '#6fa8c9', False),
    # 手術室
    'O': ('手術台', '#4f9fb0', False),
    'm': ('麻醉監測機', '#5b7fc4', False),
    'i': ('器械推車', '#a0b4c0', False),
    # 病房
    'B': ('病床', '#a7c4e8', False),
    'n': ('床頭櫃', '#7c8fb0', False),
    # 候診
    'H': ('飲水機', '#5b7fc4', False),
    'b': ('候診椅', '#d39b6a', False),
    # 藥局
    'M': ('藥櫃（靠牆）', '#8d6e9e', False),
    'f': ('藥品冷藏櫃', '#9fd3e6', False),
    'J': ('調劑台', '#b5523b', False),
    'z': ('藥局員工區（玩家不進）', '#d8cfe6', False),
    'T': ('藥局櫃台', '#c27a8a', False),
    'g': ('櫃台活動板（員工進出）', '#e6a6b4', False),
    'X': ('24 小時自助藥櫃（門外，嵌在走廊牆上）', '#d06f9c', False),
    'q': ('緊急警鈴（門外）', '#ff1744', False),
    'D': ('自動滑門', '#e5735a', True),
    'r': ('走廊地板', '#b9c4cc', True),
    'R': ('走廊外側欄杆', '#3d474e', False),
}

# 牆（規劃圖座標，列號未加北牆的 +2）。全部照「牆頂畫在線上、牆面往下垂」：
#   一般內牆跟走廊牆一樣高（NORMAL_H = 346 px），病房隔牆是薄牆（THIN_H = 110 px）。
#   h：牆頂在第 y 列上緣，x0–x1（不含 x1）；牆面垂到 y + 高度。
#   v：牆頂是一條直線（x 可帶 .5，在格子中間），從 y0 畫到 y1；face=True 表示下端沒接牆，露出往下垂的牆面。
NORMAL_H, THIN_H = 346, 110
_A = 7 + NORMAL_H / 96            # 內牆 A 的牆腳（牆面下緣）
WALLS = [
    # 內牆 A：後排（研究室、休息區）與中排之間；主走道（欄 10–13）穿過去
    {"dir": "h", "y": 7, "x0": 1, "x1": 10, "kind": "normal"},
    {"dir": "h", "y": 7, "x0": 14, "x1": 24, "kind": "normal"},
    # 研究室｜休息區：從北牆垂下來的一段，下面（第 4.6–7 列）是門
    {"dir": "v", "x": 8.5, "y0": 1, "y1": 1, "face": True, "kind": "normal"},
    {"dir": "v", "x": 16.5, "y0": 1, "y1": 1, "face": True, "kind": "normal"},
    # 診間｜主走道：牆面垂到第 14 列，第 14–16 列是診間的門
    {"dir": "v", "x": 9.5, "y0": 7, "y1": 14 - NORMAL_H / 96, "face": True, "kind": "normal"},
    # 主走道｜病房 1
    {"dir": "v", "x": 14.5, "y0": 7, "y1": 16, "face": False, "kind": "normal"},
    # 病房之間：薄牆
    {"dir": "v", "x": 18, "y0": _A, "y1": 16 - THIN_H / 96, "face": True, "kind": "thin"},
    {"dir": "v", "x": 21, "y0": _A, "y1": 16 - THIN_H / 96, "face": True, "kind": "thin"},
    # 內牆 B：第 3 欄不砌牆（診間直通手術室），病房門在 16、19、22 欄
    {"dir": "h", "y": 16, "x0": 1, "x1": 3, "kind": "normal"},
    {"dir": "h", "y": 16, "x0": 4, "x1": 10, "kind": "normal"},
    {"dir": "h", "y": 16, "x0": 14, "x1": 16, "kind": "normal"},
    {"dir": "h", "y": 16, "x0": 17, "x1": 19, "kind": "normal"},
    {"dir": "h", "y": 16, "x0": 20, "x1": 22, "kind": "normal"},
    {"dir": "h", "y": 16, "x0": 23, "x1": 24, "kind": "normal"},
    # 手術室｜候診：門在上面（第 19.6–22 列）
    {"dir": "v", "x": 6.5, "y0": 22, "y1": 30, "face": False, "kind": "normal"},
    # 藥局北牆
    {"dir": "h", "y": 22, "x0": 14, "x1": 24, "kind": "normal"},
]

# 薄牆畫在格線上，不佔格子。('h', y, x0, x1, 門洞欄) = 第 y 列上緣、欄 x0–x1；('v', x, y0, y1, 門洞列) = 第 x 欄左緣、列 y0–y1。
THIN = [
    ('v', 18, 11, 15, ()),         # 病房 1｜2
    ('v', 21, 11, 15, ()),         # 病房 2｜3
]
H_E, V_E, GAPS = set(), set(), []
for kind, k, a, b, gaps in THIN:
    for i in range(a, b + 1):
        if i in gaps:
            GAPS.append((kind, k, i)); continue
        (H_E.add((i, k)) if kind == 'h' else V_E.add((k, i)))

# 牆面上的東西（畫在第 0 列外牆上，不佔碰撞）
WALL_FEATURES = [
    {"id": "window", "label": "舷窗", "x": 10, "w": 4},
]

LABELS = [  # (文字, 中心 x, 中心 y)，tile 單位
    ('醫療研究', 4, 6.5), ('長桌', 4, 4), ('冷凍櫃', 1.5, 2.6), ('分析儀', 7.5, 2.6),
    ('居家休息區', 12.5, 6.5), ('廚房', 9.5, 1.5), ('沙發', 12, 3.5),
    ('藥物研究', 20.5, 6.5), ('長桌', 21, 4), ('通風櫃', 17.5, 2.6), ('合成儀', 23.5, 2.6), ('樣本櫃', 23.5, 4.5),
    ('內牆（走廊牆高）', 5, 9), ('內牆（走廊牆高）', 19, 9),
    ('治療艙', 2, 12.5), ('診桌', 5.5, 12.5), ('診療床', 8, 12.5), ('診間', 4.5, 15),
    ('病房 1', 16.5, 14.6), ('病房 2', 19.5, 14.6), ('病房 3', 22.5, 14.6),
    ('診間→手術室', 3.5, 18), ('病房門', 19.5, 18),
    ('病房前走道', 19, 21), ('藥局北牆', 19, 24), ('手術台', 4, 24), ('麻醉機', 1.5, 24.5), ('術後觀察床', 3, 27.5),
    ('手術室', 3.5, 29.4), ('候診', 8.5, 21.5), ('藥局', 19, 26.5), ('櫃台', 18.5, 28.5),
    ('南牆＝走廊牆（4 列）', 19.5, 31.5), ('自動滑門', 12, 32), ('警鈴', 9.5, 33.6), ('自助藥櫃', 15.5, 33.6),
    ('走廊', 12.5, 36.5), ('← 居住區 B', 2.4, 36.5), ('居住區 C →', 22.6, 36.5),
]

# 頭頂物件：不佔碰撞，之後做成前景層蓋在角色上面（tile 單位）
OVERHEAD = [
    {"id": "surgical-lamp", "label": "頭頂無影燈", "x": 2, "y": 22, "w": 4, "h": 3},
]

# NPC 站位（tile 單位）：上班時間出現在這裡
# 沒人看診時在研究長桌（research），有人來看診、買藥時到崗位（post）
STAFF = [
    {"id": "doctor", "label": "醫師", "x": 5.5, "y": 11.5, "note": "看診：坐在診桌後", "research": [3.5, 2.5]},
    {"id": "pharmacist", "label": "藥劑師", "x": 20.5, "y": 27.5, "note": "賣藥：站在櫃台後", "research": [20.5, 2.5]},
]

INTERACTIONS = [
    # 醫療研究
    {"id": "med-table", "kind": "research", "label": "醫療研究長桌", "text": "長桌上方浮著一顆緩緩旋轉的細胞全息模型，北牆投影著一排排檢驗數據。", "area": [2, 3, 4, 2], "stand": [3.5, 5.5]},
    {"id": "bio-freezer", "kind": "storage", "label": "生物樣本冷凍櫃", "text": "霜白的門板上亮著溫度燈，每一格樣本都有自己的編碼光點。", "area": [1, 1, 1, 2], "stand": [2.5, 2.5]},
    {"id": "analyzer", "kind": "machine", "label": "樣本分析儀", "text": "樣本盤慢慢轉動，分析結果直接投到牆上。", "area": [7, 1, 1, 2], "stand": [6.5, 2.5]},
    # 居家休息區
    {"id": "kitchenette", "kind": "kitchen", "label": "小廚房", "text": "咖啡機旁擺著幾個不同花色的馬克杯，小冰箱的門上閃著一則留言投影。", "area": [9, 1, 1, 2], "stand": [10.5, 2.5]},
    {"id": "sofa", "kind": "seat", "label": "沙發", "text": "", "area": [10, 3, 4, 1], "stand": [11.5, 5.5]},
    {"id": "window", "kind": "window", "label": "舷窗", "text": "窗外的星星隨著站體旋轉，慢慢劃過去。", "area": [10, 1, 4, 1], "stand": [12.5, 1.5]},
    # 藥物研究
    {"id": "drug-table", "kind": "research", "label": "藥物研究長桌", "text": "桌面投影著一串分子結構，旁邊並排著幾支配好的試劑。", "area": [19, 3, 4, 2], "stand": [20.5, 5.5]},
    {"id": "fume-hood", "kind": "machine", "label": "通風櫃", "text": "透明擋板後的氣流燈穩定亮著，裡面放著正在反應的試管架。", "area": [17, 1, 1, 2], "stand": [18.5, 2.5]},
    {"id": "synthesizer", "kind": "machine", "label": "自動合成儀", "text": "機械臂在密封艙裡一滴一滴加入試劑。", "area": [23, 1, 1, 2], "stand": [22.5, 1.5]},
    {"id": "sample-cabinet", "kind": "storage", "label": "藥品樣本櫃", "text": "每支樣本瓶上都有一圈發光的編碼環。", "area": [23, 3, 1, 2], "stand": [22.5, 5.5]},
    # 診間（治療艙靠西牆、診療床靠走道那側）
    {"id": "med-pod", "kind": "pod", "label": "診斷治療艙", "text": "艙蓋半開，掃描環緩緩轉著淡藍色的光。必要時艙蓋能完全密封，當隔離艙用。", "area": [1, 11, 2, 3], "stand": [3.5, 12.5]},
    {"id": "clinic-desk", "kind": "clinic", "label": "醫師診桌", "text": "桌面上浮著一具半透明的人體全息模型，終端開著病歷頁面。", "area": [4, 12, 3, 1], "stand": [5.5, 13.5], "seat": [5.5, 13.5]},
    {"id": "exam-bed", "kind": "exam-bed", "label": "診療床", "text": "鋪著拋棄式床單的診療床，旁邊的監測儀亮著待機的綠燈。", "area": [7, 11, 2, 3], "stand": [6.5, 13.5]},
    {"id": "instrument-cabinet", "kind": "storage", "label": "器械櫃", "text": "玻璃門後排著消毒過的器械，每一格都有發光標示。", "area": [1, 14, 1, 2], "stand": [2.5, 14.5]},
    {"id": "sink", "kind": "sink", "label": "洗手台", "text": "感應式水龍頭，鏡面上投影著洗手步驟。", "area": [8, 15, 1, 1], "stand": [7.5, 15.5]},
    # 病房（病房 1 是昏倒醒來的床）
    {"id": "bed-1", "kind": "bed", "label": "病床 1", "text": "最靠走道的單人病房，床單剛換過。", "area": [15, 11, 2, 3], "stand": [15.5, 14.5]},
    {"id": "bed-2", "kind": "bed", "label": "病床 2", "text": "床頭的呼叫鈕亮著小燈。", "area": [18, 11, 2, 3], "stand": [18.5, 14.5]},
    {"id": "bed-3", "kind": "bed", "label": "病床 3", "text": "最裡面的一間，床尾放著一條摺好的毯子。", "area": [21, 11, 2, 3], "stand": [21.5, 14.5]},
    # 手術室（北邊第 3 欄直通診間）
    {"id": "surgery-cabinet", "kind": "storage", "label": "手術耗材櫃", "text": "一格格密封的耗材盒，條碼閃著綠燈。", "area": [1, 20, 2, 1], "stand": [1.5, 21.5]},
    {"id": "scrub-sink", "kind": "sink", "label": "刷手台", "text": "感應式刷手台，水流開關在腳邊。", "area": [4, 20, 1, 1], "stand": [4.5, 21.5]},
    {"id": "op-table", "kind": "surgery", "label": "手術台", "text": "手術台擦得發亮，頭頂的無影燈收在待機位置。", "area": [3, 23, 2, 2], "stand": [3.5, 25.5]},
    {"id": "anesthesia", "kind": "machine", "label": "麻醉監測機", "text": "螢幕暗著，管線整齊地收在機身側邊。", "area": [1, 23, 1, 2], "stand": [2.5, 23.5]},
    {"id": "instrument-cart", "kind": "storage", "label": "器械推車", "text": "消毒過的器械排在密封托盤裡。", "area": [5, 23, 1, 1], "stand": [5.5, 24.5]},
    {"id": "postop-bed", "kind": "bed", "label": "術後觀察床", "text": "床邊的監測儀收在牆上，床單摺得整整齊齊。", "area": [1, 26, 2, 3], "stand": [3.5, 27.5]},
    # 候診
    {"id": "water", "kind": "water", "label": "飲水機", "text": "杯子用完丟進旁邊的回收口。", "area": [7, 20, 1, 1], "stand": [7.5, 21.5]},
    {"id": "bench-1", "kind": "seat", "label": "候診椅", "text": "", "area": [7, 23, 2, 1], "stand": [7.5, 24.5]},
    {"id": "bench-2", "kind": "seat", "label": "候診椅", "text": "", "area": [7, 25, 2, 1], "stand": [7.5, 26.5]},
    {"id": "bench-3", "kind": "seat", "label": "候診椅", "text": "", "area": [7, 27, 2, 1], "stand": [7.5, 28.5]},
    # 藥局
    {"id": "pharmacy", "kind": "shop", "label": "藥局櫃台", "text": "櫃台後的藥櫃排得整整齊齊。櫃台上有呼叫鈴，藥劑師在後面做研究時按了就會出來。", "area": [15, 28, 7, 1], "stand": [18.5, 29.5]},
    # 門外（走廊側）：下班關門後也用得到
    {"id": "vending", "kind": "shop", "label": "24 小時自助藥櫃", "text": "嵌在牆上的自助藥櫃，常備藥與補給品，刷卡就能取。", "area": [15, 33, 1, 1], "stand": [15.5, 34.5]},
    {"id": "alarm", "kind": "alarm", "label": "緊急警鈴", "text": "紅色的緊急警鈴，下班關門後有人出意外時按。", "area": [9, 33, 1, 1], "stand": [9.5, 34.5]},
]

EFFECTS = [  # 之後的動畫 / 特效位置草案
    {"target": "med-table", "effects": ["北牆數據投影捲動", "全息細胞模型旋轉"]},
    {"target": "drug-table", "effects": ["北牆分子結構投影", "桌面投影旋轉"]},
    {"target": "synthesizer", "effects": ["機械臂加試劑"]},
    {"target": "window", "effects": ["星空緩慢移動"]},
    {"target": "kitchenette", "effects": ["咖啡機冒熱氣"]},
    {"target": "med-pod", "effects": ["掃描環旋轉發光", "艙蓋開闔"]},
    {"target": "clinic-desk", "effects": ["全息人體模型旋轉"]},
    {"target": "exam-bed", "effects": ["監測儀心跳波形"]},
    {"target": "anesthesia", "effects": ["手術中螢幕亮起"]},
    {"target": "vending", "effects": ["取物口燈條"]},
    {"target": "alarm", "effects": ["按下後紅燈旋轉"]},
    {"target": "door", "effects": ["靠近自動滑開", "門楣綠十字燈"]},
]

H, W = len(LAYOUT), len(LAYOUT[0])
assert all(len(r) == W for r in LAYOUT), [i for i, r in enumerate(LAYOUT) if len(r) != W]
walk = [[LEGEND[c][2] for c in row] for row in LAYOUT]
CORRIDOR_Y = next(y for y, row in enumerate(LAYOUT) if row[0] == 'r')

def can(x, y, dx, dy):
    """從 (x, y) 走一格到 (x+dx, y+dy)：目標可走、中間沒有薄牆。"""
    nx, ny = x + dx, y + dy
    if not (0 <= nx < W and 0 <= ny < H and walk[ny][nx]): return False
    if dy == 1 and (x, ny) in H_E: return False
    if dy == -1 and (x, y) in H_E: return False
    if dx == 1 and (nx, y) in V_E: return False
    if dx == -1 and (x, y) in V_E: return False
    return True

# ---- 檢查 ----
DIRS = ((1, 0), (-1, 0), (0, 1), (0, -1))
start = (0, CORRIDOR_Y + 1)
seen, q = {start}, deque([start])
while q:
    x, y = q.popleft()
    for dx, dy in DIRS:
        if can(x, y, dx, dy) and (x + dx, y + dy) not in seen:
            seen.add((x + dx, y + dy)); q.append((x + dx, y + dy))
cells = [(x, y) for y in range(H) for x in range(W) if walk[y][x]]
unreached = [c for c in cells if c not in seen]
dead = [(x, y) for x, y in cells if sum(can(x, y, dx, dy) for dx, dy in DIRS) <= 1 and not (x in (0, W - 1) and y >= CORRIDOR_Y)]
narrow = [(x, y) for x, y in cells if y < CORRIDOR_Y and LAYOUT[y][x] != 'D'
          and ((not can(x, y, -1, 0) and not can(x, y, 1, 0)) or (not can(x, y, 0, -1) and not can(x, y, 0, 1)))]
for it in INTERACTIONS:
    sx, sy = it['stand']
    assert (int(sx), int(sy)) in seen, (it['id'], 'stand 不可達')
inner = sum(1 for y in range(CORRIDOR_Y - 2) for x in range(W) if LAYOUT[y][x] != '#')
body_walk = sum(1 for x, y in cells if y < CORRIDOR_Y - 2)
report = {'可走格（本體）': body_walk, '本體室內格': inner, '可走比例': round(body_walk / inner, 2),
          '走不到': unreached, '死路': dead, '一格窄道': narrow}
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))

# ---- JSON ----
T = 0.16  # 薄牆厚度（tile）
rects = []
for kind, k, a, b, gaps in THIN:
    run = [i for i in range(a, b + 1) if i not in gaps]
    while run:
        s = e = run.pop(0)
        while run and run[0] == e + 1: e = run.pop(0)
        rects.append({"x": s, "y": k - T / 2, "w": e - s + 1, "h": T} if kind == 'h' else {"x": k - T / 2, "y": s, "w": T, "h": e - s + 1})
entrances = [
    {"x": 0, "y": CORRIDOR_Y, "w": 1, "h": 3, "to": "residential_b", "label": "往居住區 B", "spawn": [1.5, CORRIDOR_Y + 1.5]},
    {"x": W - 1, "y": CORRIDOR_Y, "w": 1, "h": 3, "to": "residential_c", "label": "往居住區 C", "spawn": [W - 1.5, CORRIDOR_Y + 1.5]},
]
door_x = LAYOUT[CORRIDOR_Y - 1].index('D')
DOOR_Y = next(y for y, row in enumerate(LAYOUT) if 'D' in row)   # 南牆（走廊牆）從這列開始
data = {
    "tileSize": 96, "width": W, "height": H,
    "legend": {"0": "可行走", "1": "碰撞"},
    "note": f"醫療室本體 {W}×{CORRIDOR_Y}（第 0–{CORRIDOR_Y - 1} 列，含南牆與自動滑門），第 {CORRIDOR_Y}–{H - 1} 列是下方走廊：左通居住區 B、右通 C。薄牆是 collisionRects（厚 {T} 格，沿格線）。藥局員工區 z 與櫃台活動板 g 玩家不能進，藥劑師直接生在櫃台後。overhead 是頭頂物件、wallFeatures 畫在北牆上，都不佔碰撞。",
    "collision": [[0 if w else 1 for w in row] for row in walk],
    "collisionRects": rects,
    "layout": LAYOUT,
    "layoutLegend": {k: v[0] for k, v in LEGEND.items()},
    "entrances": entrances,
    "door": {"id": "auto-door", "label": "自動滑門", "x": door_x, "y": DOOR_Y, "w": LAYOUT[CORRIDOR_Y - 1].count('D'), "h": CORRIDOR_Y - DOOR_Y},
    "wakeBed": "bed-1",
    "staff": STAFF,
    "walls": WALLS,
    "wallHeights": {"normal": NORMAL_H, "thin": THIN_H},
    "thinWalls": [{"dir": k, "line": l, "from": a, "to": b, "gaps": list(g)} for k, l, a, b, g in THIN],
    "wallFeatures": WALL_FEATURES,
    "overhead": OVERHEAD,
    "interactions": INTERACTIONS,
    "effects": EFFECTS,
}
with open(f'{OUT}/medical_plan.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)

# ---- PNG ----
img = Image.new('RGB', (W * CELL, H * CELL))
d = ImageDraw.Draw(img)
small = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 13)
big = ImageFont.truetype('C:/Windows/Fonts/msjhbd.ttc', 22)
lum = lambda h: (int(h[1:3], 16) * 299 + int(h[3:5], 16) * 587 + int(h[5:7], 16) * 114) / 1000
for y, row in enumerate(LAYOUT):
    for x, c in enumerate(row):
        col = LEGEND[c][1]
        d.rectangle([x * CELL, y * CELL, (x + 1) * CELL - 1, (y + 1) * CELL - 1], fill=col, outline='#2b3238')
        d.text((x * CELL + 3, y * CELL + 2), f'{x},{y}', font=small, fill='#1b1f23' if lum(col) > 140 else '#e8ecef')
for f_ in WALL_FEATURES:  # 北牆上的投影、舷窗
    d.rectangle([f_['x'] * CELL + 4, 14, (f_['x'] + f_['w']) * CELL - 5, CELL - 6], fill='#7fe0f0' if f_['id'] != 'window' else '#1c2b4a', outline='#e8ecef', width=2)
    d.text(((f_['x'] + f_['w'] / 2) * CELL, CELL * .55), f_['label'], font=small, anchor='mm', fill='#1b1f23' if f_['id'] != 'window' else '#e8ecef')
for x, y in H_E:  # 薄牆
    d.line([x * CELL - 2, y * CELL, (x + 1) * CELL + 2, y * CELL], fill='#263238', width=8)
for x, y in V_E:
    d.line([x * CELL, y * CELL - 2, x * CELL, (y + 1) * CELL + 2], fill='#263238', width=8)
for kind, k, i in GAPS:  # 門洞
    if kind == 'h':
        d.line([i * CELL + 6, k * CELL, (i + 1) * CELL - 6, k * CELL], fill='#43a047', width=4)
    else:
        d.line([k * CELL, i * CELL + 6, k * CELL, (i + 1) * CELL - 6], fill='#43a047', width=4)
for o in OVERHEAD:  # 頭頂物件畫虛線框
    x0, y0, x1, y1 = o['x'] * CELL + 3, o['y'] * CELL + 3, (o['x'] + o['w']) * CELL - 4, (o['y'] + o['h']) * CELL - 4
    for a, b in (((x0, y0), (x1, y0)), ((x0, y1), (x1, y1)), ((x0, y0), (x0, y1)), ((x1, y0), (x1, y1))):
        n = max(1, int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) // 14))
        for i in range(0, n, 2):
            t0, t1 = i / n, min(1, (i + 1) / n)
            d.line([(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0), (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1)], fill='#ff3b6b', width=4)
    d.text((x1 - 4, y1 - 22), o['label'], font=small, anchor='ra', fill='#ff3b6b', stroke_width=3, stroke_fill='white')
for s in STAFF:  # NPC 站位畫圓點
    cx, cy, r = s['x'] * CELL, s['y'] * CELL, 18
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='#ffd54f', outline='#1b1f23', width=3)
    d.text((cx, cy), s['label'][0], font=small, anchor='mm', fill='#1b1f23')
for s in STAFF:  # 研究時的位置畫空心圓
    cx, cy, r = s['research'][0] * CELL, s['research'][1] * CELL, 18
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline='#ffd54f', width=4)
    d.text((cx, cy), s['label'][0], font=small, anchor='mm', fill='#1b1f23', stroke_width=2, stroke_fill='white')
for it in INTERACTIONS:  # 互動站位畫小叉
    cx, cy = it['stand'][0] * CELL, it['stand'][1] * CELL
    d.line([cx - 7, cy - 7, cx + 7, cy + 7], fill='#c62828', width=3)
    d.line([cx - 7, cy + 7, cx + 7, cy - 7], fill='#c62828', width=3)
for text, cx, cy in LABELS:
    d.text((cx * CELL, cy * CELL), text, font=big, anchor='mm', fill='white', stroke_width=4, stroke_fill='#1b1f23')
img.save(f'{OUT}/medical_plan.png')
print('saved', img.size)
