import type { Point, Rect } from './corridor';
import type { RackSpec } from './racks';
import type { DecorSpec } from './decor';

/**
 * 設施場景（溫室、工程區……）共用的格子地圖：public/assets/<folder>/map.json。
 * 跟走廊的矩形碰撞不同，這裡每格 0 可走 / 1 碰撞；點地移動走 A*，再拉直成最少轉折。
 * 各設施的差異全部在 map.json：出入口（entrances）、互動點（interactions）、菜圃（plots，可省略）。
 * 新增設施 = 一個資料夾 + FACILITIES 一行。
 */
/** of：collisionRects 裡由物件產生的那筆，是哪件 decor（id）的；牆、窗台這類沒有。 */
export interface TileRect { x: number; y: number; w: number; h: number; of?: string }
/** A doorway in the outer wall. `to` is the sector beyond it; the player appears at `spawn` (tile units) when arriving from there. */
export interface Entrance extends TileRect { to: string; label: string; spawn: [number, number] }
/**
 * An interaction written in map.json: `area` and `stand` use tile units; a relative `seat` uses 0–1 image coordinates.
 * area 是點擊範圍；near 是 E 鍵感應範圍（腳點要在裡面），省略時用 area 往外 REACH。兩個分開定義（問題修正紀錄「互動」）：
 * 走廊招牌在牆上，點擊範圍是招牌本身，但要站在地板上它的前方才能按 E。
 * to：kind 是 exit 時，按 E 或點它就離開到這裡（走廊的設施招牌）。
 */
export interface InteractionSpec { id: string; kind: string; label: string; text: string; area: [number, number, number, number]; stand: [number, number]; near?: [number, number, number, number]; to?: string; seat?: [number, number] | { decor: string; position: [number, number] }; exit?: [number, number]; facing?: Facing; sortY?: number }
/**
 * 要按 E（或點門）才會開的門（工程區的厚重隔音門），走遠了自己關上。passage 是門洞的格子：
 * 碰撞表裡是可走，門關著時尋路改用 withDoorClosed 的地圖，移動由 doorBlocks 擋住。座標除了 passage 都是 px。
 */
export interface DoorSpec {
  id: string; label: string; passage: TileRect;
  /** 門關著時，從這個 y（px）以下才擋人；上面那段跟兩旁的牆一樣可以走進牆簷底下。省略＝整個門洞都擋。 */
  closedFrom?: number;
  /** 門扇只畫在這個框裡，往兩側滑出去就被牆遮住：[x, y, 寬, 高]。 */
  opening: [number, number, number, number];
  /** 門框（蓋在門扇上；角色走在門洞裡時再蓋一次）。走廊房門的門框是牆的一部分，可以省略。 */
  frame?: { src: string; x: number; y: number };
  panels: { left: string; right: string };
  /** 警示燈中心，門在動的時候閃。沒有燈的門省略。 */
  lamp?: [number, number];
  /** 門開到底就離開這個場景，進入 to（走廊的房門 → 房間 id）。 */
  to?: string;
  /** 上鎖：按 E 或點門只顯示這段文字，不開門（走廊別人的房門）。 */
  locked?: string;
  /** 用這扇門時站的位置（px）；省略＝門洞前後、角色那一側。走廊房門在牆上，要站在門前的地板上。 */
  stand?: [number, number];
  /** E 鍵感應範圍（px，[x, y, 寬, 高]，腳點要在裡面）；省略＝門洞往外 REACH。 */
  near?: [number, number, number, number];
  /** 腳點離門洞超過這個距離（px），開著的門就自己關上。 */
  trigger: number;
  openSeconds: number;
  /** 自動門（醫療室玻璃門）：腳點離門洞不到 trigger 就自己開，不用按 E，也不是互動物件。 */
  auto?: boolean;
}
/** 蓋在角色上面的圖（例：走廊欄杆）。 */
export interface OverlaySpec { src: string; x: number; y: number }
/**
 * 橫牆牆頂那一條（從 ground.webp 切 rects，px）：角色腳點在 bottom 以上（走到牆後面）時畫在角色上面。
 * 有 left／right 的話，角色站在這段牆的左右兩側之外就不被蓋住（從牆端旁邊走過）。
 */
export interface WallSpec { rects: [number, number, number, number][]; bottom: number; left?: number; right?: number }
/** 從某個地方來（房門、艦橋平台……不是地圖邊界的出入口）時站的位置（格）和面向。 */
export interface ArrivalSpec { at: [number, number]; facing: Facing }
export type Facing = 'up' | 'down' | 'left' | 'right';
/**
 * world：世界的像素大小（[寬, 高]），給尺寸不是格子整數倍的場景（走廊 3560 × 996）。省略＝width × tileSize。
 *   碰撞格要蓋滿整個世界（width ＝ 寬 ÷ tileSize 無條件進位），超出世界的部分不能走。
 * doors：多扇門（走廊的房門）；舊的單扇 door 照樣能用，兩個都有的話一起算。
 * arrivals：從房間、艦橋平台這類不是邊界出入口的地方進場時，站哪、面向哪（鍵是來源 id）。
 * patrol：NPC 巡遊的停靠點（格）。
 * speed：角色走路速度（px／秒），省略＝240（艦橋、房間原本是 160）。
 */
export interface FacilityMap { tileSize: number; width: number; height: number; world?: [number, number]; speed?: number; collision: number[][]; collisionRects?: TileRect[]; entrances: Entrance[]; arrivals?: Record<string, ArrivalSpec>; interactions?: InteractionSpec[]; plots?: TileRect[]; racks?: RackSpec[]; decor?: DecorSpec[]; fish?: number; door?: DoorSpec; doors?: DoorSpec[]; foreground?: OverlaySpec[]; walls?: WallSpec[]; patrol?: [number, number][] }
/**
 * `kind` is 'exit' for doorways (with `to`), 'plot' for farm plots, otherwise whatever map.json names it.
 * 'bed' works like a seat but the player lies down: `sortY` is the bed's bottom, so the player sorts after the bed
 * and before its blanket layer (whose bottom is 1 px lower) and ends up under the covers.
 */
/**
 * facing：坐下時面向哪裡（省略＝向下）。sortY：坐或躺著時角色排前後用的線（px）；
 * 床省略時用床的底邊（角色排在床跟被單中間），座位省略時用坐的位置。
 */
export interface FacilityInteraction { id: string; kind: string; label: string; text: string; point: Point; area: Rect; near?: Rect; to?: string; seat?: Point; seatDecor?: string; exit?: Point; sortY?: number; facing?: Facing }

/** Every facility with its own walkable scene, keyed by sector id. */
export const FACILITIES: Record<string, { folder: string; name: string }> = {
  greenhouse: { folder: 'greenhouse', name: '溫室' },
  engineering: { folder: 'engineering', name: '工程部' },
  medical: { folder: 'medical', name: '醫療室' },
};

/** Foot-circle radius; comfortably inside a 96px aisle. */
export const RADIUS = 22;
/** How far outside an interaction's area the player still counts as next to it. */
export const REACH = 56;

export const worldSize = (m: FacilityMap) => m.world ? { width: m.world[0], height: m.world[1] } : { width: m.width * m.tileSize, height: m.height * m.tileSize };
const tileCentre = (m: FacilityMap, x: number, y: number): Point => ({ x: (x + .5) * m.tileSize, y: (y + .5) * m.tileSize });
const tileRect = (m: FacilityMap, t: TileRect): Rect => ({ x: t.x * m.tileSize, y: t.y * m.tileSize, width: t.w * m.tileSize, height: t.h * m.tileSize });

export const blocked = (m: FacilityMap, tx: number, ty: number) => tx < 0 || ty < 0 || tx >= m.width || ty >= m.height || m.collision[ty][tx] === 1;

/** The foot circle overlaps no collision tile and stays inside the map. */
export function walkable(m: FacilityMap, p: Point): boolean {
  const { width, height } = worldSize(m), s = m.tileSize;
  if (p.x < RADIUS || p.y < RADIUS || p.x > width - RADIUS || p.y > height - RADIUS) return false;
  for (let ty = Math.floor((p.y - RADIUS) / s); ty <= Math.floor((p.y + RADIUS) / s); ty++)
    for (let tx = Math.floor((p.x - RADIUS) / s); tx <= Math.floor((p.x + RADIUS) / s); tx++) {
      if (!blocked(m, tx, ty)) continue;
      const nx = Math.max(tx * s, Math.min(p.x, (tx + 1) * s)), ny = Math.max(ty * s, Math.min(p.y, (ty + 1) * s));
      if (Math.hypot(p.x - nx, p.y - ny) < RADIUS) return false;
    }
  for (const rect of rectsNear(m, p)) {
    const x = rect.x * s, y = rect.y * s, right = x + rect.w * s, bottom = y + rect.h * s;
    const nx = Math.max(x, Math.min(p.x, right)), ny = Math.max(y, Math.min(p.y, bottom));
    if (Math.hypot(p.x - nx, p.y - ny) < RADIUS) return false;
  }
  return true;
}

/**
 * 精細碰撞依格子分桶：每塊矩形（往外撐腳圈半徑）登記在它碰到的格子，查的時候只看腳點那一格。
 * 艦橋這種照輪廓切出幾百塊的場景，尋路才不會每一步都把全部矩形掃一遍。依地圖物件快取。
 */
const buckets = new WeakMap<FacilityMap, TileRect[][]>();
function rectsNear(m: FacilityMap, p: Point): TileRect[] {
  const rects = m.collisionRects ?? [];
  if (rects.length < 64) return rects;
  let grid = buckets.get(m);
  if (!grid) {
    grid = Array.from({ length: m.width * m.height }, () => []);
    const pad = RADIUS / m.tileSize;
    for (const r of rects)
      for (let ty = Math.max(0, Math.floor(r.y - pad)); ty <= Math.min(m.height - 1, Math.floor(r.y + r.h + pad)); ty++)
        for (let tx = Math.max(0, Math.floor(r.x - pad)); tx <= Math.min(m.width - 1, Math.floor(r.x + r.w + pad)); tx++) grid[ty * m.width + tx].push(r);
    buckets.set(m, grid);
  }
  const tx = Math.floor(p.x / m.tileSize), ty = Math.floor(p.y / m.tileSize);
  return tx < 0 || ty < 0 || tx >= m.width || ty >= m.height ? rects : grid[ty * m.width + tx];
}

/** Axis-separated so the player slides along walls instead of sticking. */
export function move(m: FacilityMap, p: Point, dx: number, dy: number): Point {
  const result = { ...p }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < steps; i++) {
    if (walkable(m, { x: result.x + dx / steps, y: result.y })) result.x += dx / steps;
    if (walkable(m, { x: result.x, y: result.y + dy / steps })) result.y += dy / steps;
  }
  return result;
}

export function segmentClear(m: FacilityMap, a: Point, b: Point): boolean {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 8);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (!walkable(m, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}

/**
 * A* over tiles (8 directions, no corner cutting), then string-pulled so the
 * player walks straight lines between the few corners that matter.
 * Returns the waypoints after `from`, ending exactly at `to`; [] if unreachable.
 */
export function findPath(m: FacilityMap, from: Point, to: Point, escaping = true): Point[] {
  if (!walkable(m, to)) return [];
  if (segmentClear(m, from, to)) return [to];
  const s = m.tileSize, W = m.width;
  const start = [Math.floor(from.x / s), Math.floor(from.y / s)], goal = [Math.floor(to.x / s), Math.floor(to.y / s)];
  // A seat can leave the player in a narrow aisle with no walkable tile centre.
  // Step sideways along the aisle, then around the adjacent furniture before A*.
  if (escaping && !walkable(m, tileCentre(m, start[0], start[1]))) {
    for (const side of [-1, 1]) for (const distance of [1, 1.3, 1.6, 2]) {
      const across = { x: from.x + side * distance * s, y: from.y };
      if (!segmentClear(m, from, across)) continue;
      for (const down of [.4, .6, .8, 1]) {
        const out = { x: across.x, y: from.y + down * s };
        if (!segmentClear(m, across, out)) continue;
        const rest = findPath(m, out, to, false);
        if (rest.length) return [across, out, ...rest];
      }
    }
  }
  const id = (x: number, y: number) => y * W + x, goalId = id(goal[0], goal[1]);
  const h = (x: number, y: number) => Math.hypot(x - goal[0], y - goal[1]);
  const g = new Map<number, number>(), parent = new Map<number, number>();
  const open: { x: number; y: number; f: number }[] = [], closed = new Set<number>();
  // 起點：附近（兩格內）中心走得到、從角色直線走得過去的格子都可以當起點。
  // 角色站在比一格還窄的走道（床跟衣櫃中間）時，自己那格的中心常常在家具裡，只從那格出發會找不到路。
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = start[0] + dx, y = start[1] + dy;
    if (x < 0 || y < 0 || x >= W || y >= m.height) continue;
    const c = tileCentre(m, x, y);
    if (!walkable(m, c) || !segmentClear(m, from, c)) continue;
    const cost = Math.hypot(c.x - from.x, c.y - from.y) / s;
    g.set(id(x, y), cost); open.push({ x, y, f: cost + h(x, y) });
  }
  if (!open.length) { g.set(id(start[0], start[1]), 0); open.push({ x: start[0], y: start[1], f: h(start[0], start[1]) }); }
  // 終點那格的中心可能被精細碰撞（collisionRects）蓋住：任何一格中心能直線走到終點，就算到了
  let found = false, last = goalId;
  while (open.length) {
    let best = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const { x, y } = open.splice(best, 1)[0], cur = id(x, y);
    if (closed.has(cur)) continue; closed.add(cur);
    if (cur === goalId || segmentClear(m, tileCentre(m, x, y), to)) { found = true; last = cur; break; }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(m, tileCentre(m, nx, ny)) || !segmentClear(m, tileCentre(m, x, y), tileCentre(m, nx, ny)) || (dx && dy && (!walkable(m, tileCentre(m, x + dx, y)) || !walkable(m, tileCentre(m, x, y + dy))))) continue;
      const next = id(nx, ny), cost = g.get(cur)! + Math.hypot(dx, dy);
      if (cost >= (g.get(next) ?? Infinity)) continue;
      g.set(next, cost); parent.set(next, cur); open.push({ x: nx, y: ny, f: cost + h(nx, ny) });
    }
  }
  if (!found) return [];
  const tiles: Point[] = [];
  for (let c: number | undefined = last; c !== undefined; c = parent.get(c)) tiles.unshift(tileCentre(m, c % W, Math.floor(c / W)));
  // 起點那格的中心也留著（走得到的話）：角色不在格子中心時，直接走向下一格可能會擦過家具；拉直時用不到它自然會跳過
  const keepStart = walkable(m, tiles[0]) ? 0 : 1;
  const points = [from, ...tiles.slice(keepStart, last === goalId ? -1 : undefined), to], path: Point[] = [];
  for (let i = 0; i < points.length - 1;) {
    let j = points.length - 1;
    while (j > i + 1 && !segmentClear(m, points[i], points[j])) j--;
    path.push(points[j]); i = j;
  }
  return path;
}

/**
 * Just inside the entrance the player came through (the first one when arriving by star map).
 * 從房間、艦橋平台這類不是邊界出入口的地方來，照 arrivals 站；哪裡都對不上（星圖傳送）時有 arrivals.default 就站那裡。
 */
export function spawn(m: FacilityMap, from?: string | null): Point {
  const a = arrivalOf(m, from);
  if (a) return { x: a.at[0] * m.tileSize, y: a.at[1] * m.tileSize };
  const e = m.entrances.find(e => e.to === from) ?? m.entrances[0];
  return { x: e.spawn[0] * m.tileSize, y: e.spawn[1] * m.tileSize };
}
const arrivalOf = (m: FacilityMap, from?: string | null) =>
  (from ? m.arrivals?.[from] : undefined) ?? (m.entrances.some(e => e.to === from) ? undefined : m.arrivals?.default);
/** Face into the facility when arriving through a side entrance; arrivals say their own facing. */
export function arrivalDirection(m: FacilityMap, from?: string | null): Facing {
  const a = arrivalOf(m, from);
  if (a) return a.facing;
  const e = m.entrances.find(e => e.to === from) ?? m.entrances[0];
  if (e.x === 0) return 'right';
  if (e.x + e.w === m.width) return 'left';
  return 'up';
}

/**
 * 走到地圖邊界的出入口就離開（問題修正紀錄「互動」：場景之間由角色走到邊界進入）：
 * 腳點在出入口範圍裡、而且正往地圖外面走（左邊的出入口往左、右邊的往右……），回傳要去的地方。
 */
export function edgeExit(m: FacilityMap, p: Point, dx: number, dy: number): string | null {
  const s = m.tileSize;
  for (const e of m.entrances) {
    if (p.x < e.x * s || p.x > (e.x + e.w) * s || p.y < e.y * s || p.y > (e.y + e.h) * s) continue;
    const outward = (e.x === 0 && dx < 0) || (Math.abs(e.x + e.w - m.width) < 1e-6 && dx > 0) || (e.y === 0 && dy < 0) || (Math.abs(e.y + e.h - m.height) < 1e-6 && dy > 0);
    if (outward) return e.to;
  }
  return null;
}

export function interactions(m: FacilityMap): FacilityInteraction[] {
  const at = (id: string, kind: string, label: string, text: string, area: TileRect, stand: Point): FacilityInteraction =>
    ({ id, kind, label, text, area: tileRect(m, area), point: { x: stand.x * m.tileSize, y: stand.y * m.tileSize } });
  const bedLine = (i: InteractionSpec) => {
    if (i.sortY !== undefined) return { sortY: i.sortY * m.tileSize };
    if (i.kind !== 'bed' || !i.seat || Array.isArray(i.seat)) return {};
    const ref = i.seat.decor, decor = m.decor?.find(d => (d.id ?? d.sprite) === ref);
    return decor ? { sortY: (decor.sortY ?? decor.y) * m.tileSize } : {};
  };
  const seatPoint = (seat: NonNullable<InteractionSpec['seat']>): Point => {
    if (Array.isArray(seat)) return { x: seat[0] * m.tileSize, y: seat[1] * m.tileSize };
    const decor = m.decor?.find(d => (d.id ?? d.sprite) === seat.decor);
    if (!decor?.size) throw new Error(`座位參照的物件缺少尺寸：${seat.decor}`);
    const [width, height] = decor.size, [u, v] = seat.position;
    return { x: decor.x * m.tileSize + (u - .5) * width * decor.scale, y: decor.y * m.tileSize + (v - 1) * height * decor.scale };
  };
  return [
    ...m.entrances.map(e => ({ ...at(`exit-${e.to}`, 'exit', e.label, '', e, { x: e.x + e.w / 2, y: e.y + e.h / 2 }), to: e.to })),
    ...(m.interactions ?? []).map(i => ({ ...at(i.id, i.kind, i.label, i.text, { x: i.area[0], y: i.area[1], w: i.area[2], h: i.area[3] }, { x: i.stand[0], y: i.stand[1] }),
      ...(i.near ? { near: tileRect(m, { x: i.near[0], y: i.near[1], w: i.near[2], h: i.near[3] }) } : {}), ...(i.to ? { to: i.to } : {}),
      ...(i.seat ? { seat: seatPoint(i.seat), ...(Array.isArray(i.seat) ? {} : { seatDecor: i.seat.decor }) } : {}), ...(i.exit ? { exit: { x: i.exit[0] * m.tileSize, y: i.exit[1] * m.tileSize } } : {}),
      ...(i.facing ? { facing: i.facing } : {}), ...bedLine(i) })),
    ...doorsOf(m).filter(d => !d.auto).map(d => ({
      ...((stand: Point) => at(d.id, 'door', d.label, d.locked ?? '', d.passage, { x: stand.x / m.tileSize, y: stand.y / m.tileSize }))(doorStand(m, d, { x: 0, y: Infinity })),
      ...(d.near ? { near: { x: d.near[0], y: d.near[1], width: d.near[2], height: d.near[3] } } : {}),
    })),
    ...(m.plots ?? []).map((p, i, all) => at(`plot-${i + 1}`, 'plot', all.length > 1 ? `種植區 ${i + 1}` : '種植區', '這塊地還空著。', p, { x: p.x + p.w / 2, y: p.y + p.h / 2 })),
  ];
}

const inReach = (p: Point, r: Rect, reach = REACH) => p.x > r.x - reach && p.x < r.x + r.width + reach && p.y > r.y - reach && p.y < r.y + r.height + reach;
/** E 鍵感應：有 near 就要站在 near 裡面；沒有就是點擊範圍往外 REACH（座位、床寬一點）。 */
const canReach = (p: Point, i: FacilityInteraction) => i.near ? inReach(p, i.near, 0) : inReach(p, i.area, i.kind === 'seat' || i.kind === 'bed' ? 110 : REACH);
/** The interaction the player is standing next to, preferring the closest. */
export const nearby = (p: Point, items: FacilityInteraction[]) => items.filter(i => canReach(p, i))
  .sort((a, b) => Math.hypot(p.x - a.point.x, p.y - a.point.y) - Math.hypot(p.x - b.point.x, p.y - b.point.y))[0];
/** E-key selection for a multi-seat sofa follows the cushion in front of the player, not the approach waypoint. */
export function keyboardTarget(p: Point, items: FacilityInteraction[]): FacilityInteraction | undefined {
  const closest = nearby(p, items);
  if (closest?.kind !== 'seat') return closest;
  return items.filter(i => i.kind === 'seat' && i.seat && canReach(p, i))
    .sort((a, b) => Math.abs(p.x - a.seat!.x) - Math.abs(p.x - b.seat!.x))[0] ?? closest;
}
/** The interaction whose area contains a clicked world point; where areas overlap (a workstation inside the window's area) the smallest wins. */
export const clicked = (p: Point, items: FacilityInteraction[]) => items
  .filter(i => p.x >= i.area.x && p.x < i.area.x + i.area.width && p.y >= i.area.y && p.y < i.area.y + i.area.height)
  .sort((a, b) => a.area.width * a.area.height - b.area.width * b.area.height)[0];

/** 腳點到門洞的距離（px），在門洞裡是 0。 */
export function doorDistance(m: FacilityMap, door: DoorSpec, p: Point): number {
  const r = tileRect(m, door.passage);
  return Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.width), Math.max(r.y - p.y, 0, p.y - r.y - r.height));
}
/** 門開到這個程度以上才放人過。 */
export const DOOR_PASSABLE = .9;
/** 門還沒開夠時，腳圈碰到門洞就不能走。 */
export function doorBlocks(m: FacilityMap, door: DoorSpec, p: Point, open: number): boolean {
  if (open >= DOOR_PASSABLE) return false;
  const r = tileRect(m, door.passage), top = Math.max(r.y, door.closedFrom ?? r.y);
  const nx = Math.max(r.x, Math.min(p.x, r.x + r.width)), ny = Math.max(top, Math.min(p.y, r.y + r.height));
  return Math.hypot(p.x - nx, p.y - ny) < RADIUS;
}
/** 門的開啟程度往目標（開 1／關 0）前進一幀。 */
export function stepDoor(door: DoorSpec, open: number, wanted: boolean, dt: number): number {
  const speed = dt / door.openSeconds;
  return wanted ? Math.min(1, open + speed) : Math.max(0, open - speed);
}
/** 場景裡所有的門：舊的單扇 door 加上 doors。 */
export const doorsOf = (m: FacilityMap): DoorSpec[] => [...(m.door ? [m.door] : []), ...(m.doors ?? [])];
/**
 * 門關著時給尋路用的地圖：門洞的格子當成牆。ids 是要當成關著的門（預設：全部）。
 */
export function withDoorClosed(m: FacilityMap, ids = doorsOf(m).map(d => d.id)): FacilityMap {
  const closed = doorsOf(m).filter(d => ids.includes(d.id));
  if (!closed.length) return m;
  const shut = (tx: number, ty: number) => closed.some(({ passage: { x, y, w, h } }) => tx >= x && tx < x + w && ty >= y && ty < y + h);
  return { ...m, collision: m.collision.map((row, ty) => row.map((v, tx) => (shut(tx, ty) ? 1 : v))) };
}
/** 門前站的位置：角色在門的哪一側就站在那一側。 */
export function doorStand(m: FacilityMap, door: DoorSpec, p: Point): Point {
  if (door.stand) return { x: door.stand[0], y: door.stand[1] };
  const r = tileRect(m, door.passage), above = p.y < r.y + r.height / 2;
  return { x: r.x + r.width / 2, y: above ? r.y - RADIUS - 6 : r.y + r.height + RADIUS + 6 };
}

/** Camera origin centred on `focus`, clamped to the map. */
export function camera(focus: Point, view: { width: number; height: number }, m: FacilityMap): Point {
  const { width, height } = worldSize(m);
  return { x: Math.max(0, Math.min(width - view.width, focus.x - view.width / 2)), y: Math.max(0, Math.min(height - view.height, focus.y - view.height / 2)) };
}
