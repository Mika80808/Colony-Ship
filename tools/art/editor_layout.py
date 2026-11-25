"""地圖編輯器（專案根目錄 工具/地圖編輯器_v3.html）的標註 → map.json 的互動、碰撞、擺設互動狀態圖。

流程：
  1. 在編輯器開場景的 PSD，標互動物件、碰撞、出口，「匯出 JSON」→ 存到 tools/art/editor/（檔名 interactions_<PSD>.json）。
     編輯器工具列的「場景」要填 public/assets 底下的資料夾名（medical、engineering、rooms/lucian…）。
  2. 互動狀態圖：在 PSD 裡另放一層「<物件名>@互動」（可以藏起來），跑 python tools/art/cut.py psd <場景> <PSD> 會一起匯出成
     <物件名>-active.webp，也會在 layout_<PSD>.json 記下底圖位置，這裡用它把編輯器的 PSD 座標換成世界座標。
  3. 跑 python tools/art/editor_layout.py <場景資料夾>：直接改寫 public/assets/<場景>/map.json。
     編輯器工具列勾「自動擺放」（預設）時，PSD 每個圖層自動擺進場景、自動算碰撞，矮的併進地面（psd_place.py）。
     各場景產生 map.json 的腳本（medical_base_v9、engineering_build、room_map、bridge_map、corridor_map、greenhouse_collision）
     寫檔前也會呼叫 apply()，重跑場景腳本不會弄丟編輯器的標註。

寫進 map.json 的東西都帶 from＝PSD 檔名；再套一次會先清掉同一份 PSD 上次寫的，所以可以一直重跑。
- interactions：id、kind、label、text、area、stand、facing、to、notes、decor（綁定的擺設 id）
- collisionRects：掛在圖層下的 of＝那個圖層（擺設 id），label＝編輯器裡的碰撞名稱
- decor：自動擺放的物件（帶 from）；綁定互動的那件加 active（互動狀態圖檔名）、activeOffset（兩張圖底部中央的差，世界 px）、
  activeFrom（場景腳本擺的物件用這個記是哪份 PSD 接的，重跑時只拿掉互動狀態圖）
編輯器常常只畫個大概：缺的東西不擋，能進遊戲的先進去，沒做完的列成「還沒完成」清單；
只有站位在碰撞裡的互動先不放（遊戲裡走不到，遊戲測試也會擋）。
"""
import importlib
import json
import re
import sys
from pathlib import Path

import psd_place

STATE = re.compile(r'\s*[@＠](互動|on)$', re.I)   # 跟 cut.py、地圖編輯器同一套

ART = Path(__file__).resolve().parent
ROOT = ART.parent.parent
EDITOR = ART / 'editor'
ASSETS = ROOT / 'public' / 'assets'


def exports_for(folder):
    if not EDITOR.exists():
        return []
    out = []
    for p in sorted(EDITOR.glob('*.json')):
        data = json.loads(p.read_text(encoding='utf-8'))
        if data.get('scene') == folder:
            out.append((p, data))
    return out


def find_layout(psd):
    """cut.py psd 存的 layout_<PSD 檔名>.json（tools/art/<場景>/ 底下）；有 _base.bbox 才能換座標。"""
    for p in ART.glob(f'*/layout_{Path(psd).stem}.json'):
        layout = json.loads(p.read_text(encoding='utf-8'))
        if 'bbox' in layout.get('_base', {}):
            return layout
    return None


def converter(data, layout):
    """PSD px → 世界 px。有 layout 用 cut.py 比對出來的位置（準）；沒有就用編輯器工具列填的倍率與原點。"""
    if layout:
        b = layout['_base']
        k, (ox, oy), (bx, by) = b['scale'], b['origin'], b['bbox']
        return lambda x, y: ((x - bx) / k + ox, (y - by) / k + oy), k
    k, (ox, oy) = data.get('psdScale', 1), data.get('origin', [0, 0])
    return lambda x, y: (x / k + ox, y / k + oy), k


def cut_name(layer):
    """cut.py psd 存圖用的檔名：「名稱@互動」→ 名稱-active，其他照名稱。"""
    return STATE.sub('', layer) + '-active' if STATE.search(layer) else layer


def r4(v):
    return round(v, 4)


def apply(m, folder, quiet=False):
    """把 tools/art/editor/ 裡 scene＝folder 的標註併進 map.json 的資料 m（直接改 m，也回傳 m）。"""
    say = (lambda *a: None) if quiet else print
    for path, data in exports_for(folder):
        psd, raw = data['psd'], data.get('_raw')
        if not raw:
            say(f'⚠ {path.name} 不是地圖編輯器 v3 匯出的（沒有 _raw），跳過')
            continue
        layout = find_layout(psd)
        world, k = converter(data, layout)
        if not layout:
            say(f'⚠ {psd}：找不到 cut.py psd 的 layout（有 _base.bbox 的），座標用編輯器工具列的倍率與原點')
        T = m['tileSize']

        def tiles(r):
            x0, y0 = world(r['x'], r['y'])
            x1, y1 = world(r['x'] + r['w'], r['y'] + r['h'])
            return [r4(x0 / T), r4(y0 / T), r4((x1 - x0) / T), r4((y1 - y0) / T)]

        # 先清掉同一份 PSD 上次寫的：自動擺的物件（from）整件拿掉，場景腳本擺的只拿掉接上的互動狀態圖（activeFrom）
        m['interactions'] = [i for i in m.get('interactions', []) if i.get('from') != psd]
        m['collisionRects'] = [r for r in m.get('collisionRects', []) if r.get('from') != psd]
        m['decor'] = [d for d in m.get('decor', []) if d.get('from') != psd]
        for d in m['decor']:
            if d.get('activeFrom') == psd:
                for key in ('active', 'activeOffset', 'activeFrom'):
                    d.pop(key, None)

        # 編輯器常常只畫個大概：缺的東西不擋，能進遊戲的先進去，沒做完的最後列成一張清單
        todo = {}
        note = lambda who, what: todo.setdefault(who, []).append(what)
        baked = set()
        if (raw.get('settings') or {}).get('autoPlace'):   # 用 PSD 拼場景：每個圖層自動擺、自動算碰撞（psd_place.py）
            if layout:
                baked = psd_place.place(m, folder, psd, raw, layout, ASSETS, note, say, split_sources(folder))
            else:
                note(psd, f'自動擺放要先跑 python tools/art/cut.py psd {folder} <PSD>（切圖並記下位置）')
        decor = {d.get('id', d['sprite']): d for d in m.get('decor', [])}
        inters = [i for i in raw.get('inters', []) if i.get('area')]
        specs = []
        for i in inters:
            a = i['area']
            st = i.get('stand') or {'x': a['x'] + a['w'] / 2, 'y': a['y'] + a['h']}
            sx, sy = world(st['x'], st['y'])
            kind = (i.get('kindCustom') or 'custom') if i.get('kind', 'info') == 'custom' else i.get('kind') or 'info'
            label = i.get('label') or i.get('layer') or i['id']   # 沒取名就先用圖層名，遊戲裡的提示才不會是空的
            spec = {'id': i['id'], 'kind': kind, 'label': label, 'text': i.get('text', ''),
                    'area': tiles(a), 'stand': [r4(sx / T), r4(sy / T)], 'from': psd}
            for key in ('facing', 'to', 'notes'):
                if i.get(key):
                    spec[key] = i[key]
            if kind == 'door':
                note(i['id'], '門：要在場景腳本的 doors 定義門框、門扇、開關動畫（現在按了沒反應）')
            elif kind in ('seat', 'bed'):
                note(i['id'], '坐下／躺下：要在場景腳本補座位點和離開點（現在只會顯示文字）')
            elif kind == 'exit' and not i.get('to'):
                note(i['id'], '出口沒填要去哪裡')
            elif not i.get('text'):
                note(i['id'], '還沒寫互動文字（按了不會冒文字）')
            layer = i.get('layer')
            if layer:
                d = decor.get(layer) or next((x for x in m.get('decor', []) if x['sprite'] == layer), None)
                if not d:
                    note(i['id'], f'圖層「{layer}」還沒擺進場景，互動先寫了，互動狀態圖等擺好才接得上')
                else:
                    spec['decor'] = d.get('id', d['sprite'])
            specs.append((spec, i, d if layer else None))
        cols = [c for c in raw.get('cols', []) if c.get('w') and c.get('h')]
        hand = []
        for c in cols:   # 掛在圖層下的碰撞 of＝那件擺設（排前後靠它）；那件還沒擺進場景就先不掛，免得指到不存在的擺設
            x, y, w, h = tiles(c)
            name = c.get('name') or '碰撞'
            rect = {'x': x, 'y': y, 'w': w, 'h': h, 'label': name, 'from': psd}
            if c.get('layer') in decor:
                rect['of'] = c['layer']
            elif c.get('layer'):
                rect['layer'] = c['layer']
                if c['layer'] not in baked:   # 併進地面的那件本來就不在 decor 裡，不用提醒
                    note(c['layer'], f'碰撞「{name}」先照畫的位置擋路；這件擺進場景後重跑，才會跟它排前後')
            m['collisionRects'].append(rect)
            hand.append(rect)
        for rect in hand:   # 手畫的也照規則：背後剩不到 72 px 就接到牆，不留只夠鑽的縫
            psd_place.seal(m, [rect])
        # 站位在碰撞裡的互動，遊戲裡走不到也點不到：先不放進去（遊戲測試也會擋），站位改好再重跑就會進去
        added = 0
        for spec, i, d in specs:
            if blocked(m, *spec['stand']):
                note(spec['id'], f'站位 {spec["stand"]} 在碰撞裡，角色走不到，這個互動先沒放進遊戲；用「站位」工具點到地板上')
                continue
            if spec.get('decor'):
                link_state(d, i, layout, k, folder, psd, lambda what, who=spec['id']: note(who, what))
            m['interactions'].append(spec)
            added += 1
        say(f'{path.name} → {folder}：{added}/{len(inters)} 個互動、{len(cols)} 塊碰撞')
        if todo:
            say(f'  還沒完成（不影響其他東西進遊戲）：')
            for who, items in todo.items():
                for what in items:
                    say(f'  - {who}：{what}')
    return m


RADIUS = 22   # 角色腳圈半徑（世界 px），跟 src/game/facility.ts 的 RADIUS 一樣


def blocked(m, x, y):
    """站位（格）角色站不上去：腳圈碰到整格碰撞或碰撞矩形。規則照 src/game/facility.ts 的 walkable（門、地圖邊不算）。"""
    s, px, py = m['tileSize'], x * m['tileSize'], y * m['tileSize']
    near = lambda l, t, r, b: ((px - max(l, min(px, r))) ** 2 + (py - max(t, min(py, b))) ** 2) ** .5 < RADIUS
    grid = m.get('collision') or []
    for ty in range(int((py - RADIUS) // s), int((py + RADIUS) // s) + 1):
        for tx in range(int((px - RADIUS) // s), int((px + RADIUS) // s) + 1):
            if 0 <= ty < len(grid) and 0 <= tx < len(grid[0]) and grid[ty][tx] and near(tx * s, ty * s, (tx + 1) * s, (ty + 1) * s):
                return True
    return any(near(r['x'] * s, r['y'] * s, (r['x'] + r['w']) * s, (r['y'] + r['h']) * s) for r in m.get('collisionRects', []))


def link_state(d, i, layout, k, folder, psd, note):
    """擺設加上互動狀態圖：active＝圖檔名，activeOffset＝互動圖底部中央減一般圖底部中央（世界 px）＋編輯器的微調。
    接不上的（上傳的圖、還沒切圖）交給 note 記進待完成清單，擺設維持一般圖。"""
    a = i.get('active')
    if not a or not a.get('name'):
        return
    if a.get('type') != 'layer':
        note(f'互動狀態圖是上傳的「{a["name"]}」，遊戲讀不到；在 PSD 放一層「{i["layer"]}@互動」再跑 cut.py psd')
        return
    sprite = cut_name(a['name'])
    if not (ASSETS / folder / 'props' / f'{sprite}.webp').exists():
        note(f'互動狀態圖 props/{sprite}.webp 還沒切，先跑 python tools/art/cut.py psd <場景> {psd}')
        return
    dx, dy = a.get('dx', 0) / k, a.get('dy', 0) / k
    if layout and i['layer'] in layout and sprite in layout:   # 兩張圖在 PSD 裡的位置差
        n, s = layout[i['layer']], layout[sprite]
        dx, dy = dx + s['x'] - n['x'], dy + s['bottom'] - n['bottom']
    d['active'] = sprite
    if abs(dx) > .05 or abs(dy) > .05:
        d['activeOffset'] = [round(dx, 1), round(dy, 1)]
    d['activeFrom'] = psd


def split_sources(folder):
    """場景腳本拆層用掉的原圖（<場景>_objects.py 的 LAYERS，例：L 型櫃台拆成長邊、短邊）：自動擺放不要再擺一次原圖。"""
    try:
        objects = importlib.import_module(f'{folder}_objects')
    except ImportError:
        return set()
    return {src for src, *_ in getattr(objects, 'LAYERS', {}).values()}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('用法：python tools/art/editor_layout.py <場景資料夾，例 medical、rooms/lucian>')
    folder = sys.argv[1]
    target = ASSETS / folder / 'map.json'
    # 場景名填錯（或沒改編輯器預設值）的標註不會被任何場景套用，在這裡提醒
    for p in sorted(EDITOR.glob('*.json')) if EDITOR.exists() else []:
        scene = json.loads(p.read_text(encoding='utf-8')).get('scene', '')
        if not (ASSETS / scene / 'map.json').exists():
            print(f'⚠ {p.name} 的場景是「{scene}」，public/assets 底下沒有這個場景，不會套用；在編輯器工具列改「場景」再匯出')
    m = apply(json.loads(target.read_text(encoding='utf-8')), folder)
    target.write_text(json.dumps(m, ensure_ascii=False), encoding='utf-8')
    print(f'已寫入 {target.relative_to(ROOT)}')
