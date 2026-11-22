"""物件碰撞（map.json 的 collisionRects）照圖算：醫療室、工程區、溫室共用這一支，規則只寫在這裡。

規則（starport-scene-props SKILL「圖層與碰撞規則」二）：
  下緣  圖的底邊（物件貼地的那條線）；有手填範圍（hint）時照手填的。
  上緣  底邊往上 depth（物件在地上實際佔的深度）；但最低只能到圖的上緣往下 SHOW_DEPTH，
        角色站到物件背後最深處時頭和肩才會露在圖上面（高的櫃子、機台會被往上撐）。
        樹冠這種往兩側懸空的物件不撐：角色本來就該能走到樹冠底下。
  左右  圖在碰撞那幾列的實際寬度，再往外 SHADOW_GAP（影子比腳圈寬，貼著物件時影子才不會壓到圖）。
        有手填範圍時只會撐大，不會縮小。
  形狀  只給 depth 的物件用 outline()：切成窄直條各自算，碰撞沿著圖的輪廓（弧形沙發、樹根），不是一整塊方的。
        有手填範圍（醫療室 PLACE）的用 fit()，一件一塊。
懸空的判斷跟遊戲裡 beside 的判斷是同一個（src/game/decor.ts 的 baseOverhang／BESIDE_OVERHANG），改的話兩邊一起改。
"""
import numpy as np

ALPHA = 40        # 不透明門檻（跟 decor.ts 一致）
HEAD_PAD = 14     # 頭寬一半（36，頭寬 72）減腳圈半徑（22）：直牆內側多擋的量
SHADOW_GAP = 3    # 物件碰撞比圖寬出的 px：影子半寬 23 − 腳圈 22，再留 2 px
SHOW_DEPTH = 92   # 物件碰撞上緣最低在圖上緣往下幾 px：角色高 140 − 露出頭肩 70 ＋ 腳圈 22
BASE_BAND = .15   # 貼地那一段＝不透明範圍底部 15% 高
BESIDE_OVERHANG = 24  # 往兩側懸空超過這麼多世界 px 算樹冠


def overhang(alpha):
    """圖往左右懸空伸出多少（圖的像素）：整張不透明寬度減掉貼地那段的寬度，取較大一邊。跟 decor.ts 的 baseOverhang 同算法。"""
    solid = alpha > ALPHA
    rows = np.nonzero(solid.any(1))[0]
    if not len(rows):
        return 0
    top, bottom = rows[0], rows[-1]
    cols = np.nonzero(solid.any(0))[0]
    band = solid[max(top, bottom - int((bottom - top + 1) * BASE_BAND)):bottom + 1]
    bcols = np.nonzero(band.any(0))[0]
    return int(max(bcols[0] - cols[0], cols[-1] - bcols[-1], 0))


def overhangs(alpha, scale):
    """樹冠這類往兩側懸空的物件（世界 px 超過 BESIDE_OVERHANG）。"""
    return overhang(alpha) * scale > BESIDE_OVERHANG


def fit(alpha, scale, cx, bottom, T, depth=None, hint=None):
    """一件物件的碰撞矩形（格為單位，小數 4 位）。

    alpha   圖的 alpha（2D，圖的像素）
    scale   圖畫到地圖上的縮放
    cx, bottom  圖的水平中心與底邊（世界 px）
    depth   物件在地上佔的深度（格）；沒有 hint 時必填
    hint    手填範圍 (x, y, w, h)（格）：上下照它，左右只撐大
    """
    h, w = alpha.shape
    art_top, art_left = bottom - h * scale, cx - w * scale / 2
    if hint:
        bx, by, bw, bh = hint
    else:
        bx = bw = None
        by, bh = round(bottom / T - depth, 4), depth
    solid_rows = np.nonzero(alpha.max(1) > ALPHA)[0]
    opaque_top = art_top + solid_rows[0] * scale
    if not overhangs(alpha, scale) and (opaque_top + SHOW_DEPTH) / T < by:
        bh, by = round(by + bh - (opaque_top + SHOW_DEPTH) / T, 4), round((opaque_top + SHOW_DEPTH) / T, 4)
    rows = alpha[max(0, int((by * T - art_top) / scale)):min(h, int(((by + bh) * T - art_top) / scale))]
    cols = np.nonzero(rows.max(0) > ALPHA)[0] if rows.size else []
    if len(cols):
        left = (art_left + cols[0] * scale - SHADOW_GAP) / T
        right = (art_left + (cols[-1] + 1) * scale + SHADOW_GAP) / T
        x0 = left if bx is None else min(bx, left)
        x1 = right if bx is None else max(bx + bw, right)
        bx, bw = round(x0, 4), round(x1 - x0, 4)
    elif bx is None:
        bx, bw = round(art_left / T, 4), round(w * scale / T, 4)
    return {'x': float(bx), 'y': float(by), 'w': float(bw), 'h': float(bh)}


STRIP = 12        # 照輪廓切條的寬度（世界 px）
MERGE = 3         # 相鄰兩條上下緣差不到這麼多 px 就併成一塊


def outline(alpha, scale, cx, bottom, T, depth):
    """照圖的輪廓算碰撞（弧形沙發、樹根這種不是方的物件用）：回傳幾個矩形（格），左右相接。

    圖切成寬 STRIP 的直條：
      下緣  那條裡最低的不透明像素（弧形沙發中間內凹、圓桌兩側往上收，都照圖）。
      上緣  整件的底邊往上 depth 那條線；再照 SHOW_DEPTH 撐到「那條自己的圖上緣往下 92 px」
            （椅背是弧形，撐出來的背面也是弧形；懸空的物件不撐）。
            depth 是背面最深到哪，不跟著每條的下緣往上跑，圓的東西兩側才會變薄而不是變高。
    左右只取「碰得到地」的範圍：從左右兩邊往內，第一個下緣落在整張底邊往上 depth 以內的直條；
    這範圍裡的直條全算（下緣比上緣還高的，至少留 1 px 擋住），範圍外的（樹冠懸空的部分）不算。
    """
    h, w = alpha.shape
    art_top, art_left = bottom - h * scale, cx - w * scale / 2
    solid = alpha > ALPHA
    lowest = np.where(solid.any(0), h - 1 - np.argmax(solid[::-1], 0), -1)   # 每一行（直）最低的不透明像素
    highest = np.where(solid.any(0), np.argmax(solid, 0), h)
    ground = np.nonzero((lowest >= 0) & ((h - 1 - lowest) * scale <= depth * T))[0]
    if not len(ground):
        return [fit(alpha, scale, cx, bottom, T, depth=depth)]
    raise_top = not overhangs(alpha, scale)
    step = max(1, round(STRIP / scale))
    strips = []
    for c0 in range(ground[0], ground[-1] + 1, step):
        c1 = min(c0 + step, ground[-1] + 1)
        cols = [c for c in range(c0, c1) if lowest[c] >= 0]
        if not cols:
            continue
        t = bottom - depth * T
        if raise_top:
            t = min(t, art_top + min(highest[c] for c in cols) * scale + SHOW_DEPTH)
        b = max(art_top + (max(lowest[c] for c in cols) + 1) * scale, t + 1)
        x0, x1 = art_left + c0 * scale, art_left + c1 * scale
        if strips and abs(strips[-1][1] - t) <= MERGE and abs(strips[-1][2] - b) <= MERGE:
            s = strips[-1]
            strips[-1] = [s[0], min(s[1], t), max(s[2], b), x1]
        else:
            strips.append([x0, t, b, x1])
    strips[0][0] -= SHADOW_GAP
    strips[-1][3] += SHADOW_GAP
    return [{'x': round(x0 / T, 4), 'y': round(t / T, 4), 'w': round((x1 - x0) / T, 4), 'h': round((b - t) / T, 4)}
            for x0, t, b, x1 in strips]


def union(rects):
    """幾個矩形的外框（季節換圖的樹：四季的碰撞取聯集）。"""
    x0 = min(r['x'] for r in rects); y0 = min(r['y'] for r in rects)
    x1 = max(r['x'] + r['w'] for r in rects); y1 = max(r['y'] + r['h'] for r in rects)
    return {'x': round(x0, 4), 'y': round(y0, 4), 'w': round(x1 - x0, 4), 'h': round(y1 - y0, 4)}
