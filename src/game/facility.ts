import type { Point, Rect } from './corridor';
import type { RackSpec } from './racks';
import type { DecorSpec } from './decor';

/**
 * 設施場景（溫室、工程區……）共用的格子地圖：public/assets/<folder>/map.json。
 * 跟走廊的矩形碰撞不同，這裡每格 0 可走 / 1 碰撞；點地移動走 A*，再拉直成最少轉折。
 * 各設施的差異全部在 map.json：出入口（entrances）、互動點（interactions）、菜圃（plots，可省略）。
 * 新增設施 = 一個資料夾 + FACILITIES 一行。
 */
export interface TileRect { x: number; y: number; w: number; h: number }
/** A doorway in the outer wall. `to` is the sector beyond it; the player appears at `spawn` (tile units) when arriving from there. */
export interface Entrance extends TileRect { to: string; label: string; spawn: [number, number] }
/** An interaction written in map.json, in tile units: `area` is what the player clicks, `stand` is where they walk to. */
export interface InteractionSpec { id: string; kind: string; label: string; text: string; area: [number, number, number, number]; stand: [number, number]; seat?: [number, number]; exit?: [number, number] }
/**
 * 會自動開關的門（工程區的厚重隔音門）。passage 是門洞的格子，碰撞表裡永遠是可走，尋路照常穿過；
 * 門沒開完時由 doorBlocks 擋住，角色就在門前等它開。座標除了 passage 都是 px。
 */
export interface DoorSpec {
  id: string; passage: TileRect;
  /** 門扇只畫在這個框裡，往兩側滑出去就被牆遮住：[x, y, 寬, 高]。 */
  opening: [number, number, number, number];
  frame: { src: string; x: number; y: number };
  panels: { left: string; right: string };
  /** 警示燈中心，門在動的時候閃。 */
  lamp: [number, number];
  /** 腳點離門洞多近（px）就開門。 */
  trigger: number;
  openSeconds: number;
}
/** 蓋在角色上面的圖（例：走廊欄杆）。 */
export interface OverlaySpec { src: string; x: number; y: number }
export interface FacilityMap { tileSize: number; width: number; height: number; collision: number[][]; collisionRects?: TileRect[]; entrances: Entrance[]; interactions?: InteractionSpec[]; plots?: TileRect[]; racks?: RackSpec[]; decor?: DecorSpec[]; fish?: number; door?: DoorSpec; foreground?: OverlaySpec[] }
/** `kind` is 'exit' for doorways (with `to`), 'plot' for farm plots, otherwise whatever map.json names it. */
export interface FacilityInteraction { id: string; kind: string; label: string; text: string; point: Point; area: Rect; to?: string; seat?: Point; exit?: Point }

/** Every facility with its own walkable scene, keyed by sector id. */
export const FACILITIES: Record<string, { folder: string; name: string }> = {
  greenhouse: { folder: 'greenhouse', name: '溫室' },
  engineering: { folder: 'engineering', name: '工程部' },
};

/** Foot-circle radius; comfortably inside a 96px aisle. */
export const RADIUS = 22;
/** How far outside an interaction's area the player still counts as next to it. */
export const REACH = 56;

export const worldSize = (m: FacilityMap) => ({ width: m.width * m.tileSize, height: m.height * m.tileSize });
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
  for (const rect of m.collisionRects ?? []) {
    const x = rect.x * s, y = rect.y * s, right = x + rect.w * s, bottom = y + rect.h * s;
    const nx = Math.max(x, Math.min(p.x, right)), ny = Math.max(y, Math.min(p.y, bottom));
    if (Math.hypot(p.x - nx, p.y - ny) < RADIUS) return false;
  }
  return true;
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
  const g = new Map([[id(start[0], start[1]), 0]]), parent = new Map<number, number>();
  const open = [{ x: start[0], y: start[1], f: h(start[0], start[1]) }], closed = new Set<number>();
  let found = false;
  while (open.length) {
    let best = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const { x, y } = open.splice(best, 1)[0], cur = id(x, y);
    if (closed.has(cur)) continue; closed.add(cur);
    if (cur === goalId) { found = true; break; }
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
  for (let c: number | undefined = goalId; c !== undefined; c = parent.get(c)) tiles.unshift(tileCentre(m, c % W, Math.floor(c / W)));
  const points = [from, ...tiles.slice(1, -1), to], path: Point[] = [];
  for (let i = 0; i < points.length - 1;) {
    let j = points.length - 1;
    while (j > i + 1 && !segmentClear(m, points[i], points[j])) j--;
    path.push(points[j]); i = j;
  }
  return path;
}

/** Just inside the entrance the player came through (the first one when arriving by star map). */
export function spawn(m: FacilityMap, from?: string | null): Point {
  const e = m.entrances.find(e => e.to === from) ?? m.entrances[0];
  return { x: e.spawn[0] * m.tileSize, y: e.spawn[1] * m.tileSize };
}
/** Face into the facility when arriving through a side entrance. */
export function arrivalDirection(m: FacilityMap, from?: string | null): 'left' | 'right' | 'up' {
  const e = m.entrances.find(e => e.to === from) ?? m.entrances[0];
  if (e.x === 0) return 'right';
  if (e.x + e.w === m.width) return 'left';
  return 'up';
}

export function interactions(m: FacilityMap): FacilityInteraction[] {
  const at = (id: string, kind: string, label: string, text: string, area: TileRect, stand: Point): FacilityInteraction =>
    ({ id, kind, label, text, area: tileRect(m, area), point: { x: stand.x * m.tileSize, y: stand.y * m.tileSize } });
  return [
    ...m.entrances.map(e => ({ ...at(`exit-${e.to}`, 'exit', e.label, '', e, { x: e.x + e.w / 2, y: e.y + e.h / 2 }), to: e.to })),
    ...(m.interactions ?? []).map(i => ({ ...at(i.id, i.kind, i.label, i.text, { x: i.area[0], y: i.area[1], w: i.area[2], h: i.area[3] }, { x: i.stand[0], y: i.stand[1] }), ...(i.seat ? { seat: { x: i.seat[0] * m.tileSize, y: i.seat[1] * m.tileSize } } : {}), ...(i.exit ? { exit: { x: i.exit[0] * m.tileSize, y: i.exit[1] * m.tileSize } } : {}) })),
    ...(m.plots ?? []).map((p, i, all) => at(`plot-${i + 1}`, 'plot', all.length > 1 ? `種植區 ${i + 1}` : '種植區', '這塊土地還空著。（種植系統尚未開放）', p, { x: p.x + p.w / 2, y: p.y + p.h / 2 })),
  ];
}

const inReach = (p: Point, r: Rect, reach = REACH) => p.x > r.x - reach && p.x < r.x + r.width + reach && p.y > r.y - reach && p.y < r.y + r.height + reach;
/** The interaction the player is standing next to, preferring the closest. */
export const nearby = (p: Point, items: FacilityInteraction[]) => items.filter(i => inReach(p, i.area, i.kind === 'seat' ? 110 : REACH))
  .sort((a, b) => Math.hypot(p.x - a.point.x, p.y - a.point.y) - Math.hypot(p.x - b.point.x, p.y - b.point.y))[0];
/** E-key selection for a multi-seat sofa follows the cushion in front of the player, not the approach waypoint. */
export function keyboardTarget(p: Point, items: FacilityInteraction[]): FacilityInteraction | undefined {
  const closest = nearby(p, items);
  if (closest?.kind !== 'seat') return closest;
  return items.filter(i => i.kind === 'seat' && i.seat && inReach(p, i.area, 110))
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
  const r = tileRect(m, door.passage);
  const nx = Math.max(r.x, Math.min(p.x, r.x + r.width)), ny = Math.max(r.y, Math.min(p.y, r.y + r.height));
  return Math.hypot(p.x - nx, p.y - ny) < RADIUS;
}
/** 門的開啟程度往目標前進一幀：角色在 trigger 範圍內就開，離開就關。 */
export function stepDoor(m: FacilityMap, door: DoorSpec, p: Point, open: number, dt: number): number {
  const target = doorDistance(m, door, p) < door.trigger ? 1 : 0, speed = dt / door.openSeconds;
  return target > open ? Math.min(1, open + speed) : Math.max(0, open - speed);
}

/** Camera origin centred on `focus`, clamped to the map. */
export function camera(focus: Point, view: { width: number; height: number }, m: FacilityMap): Point {
  const { width, height } = worldSize(m);
  return { x: Math.max(0, Math.min(width - view.width, focus.x - view.width / 2)), y: Math.max(0, Math.min(height - view.height, focus.y - view.height / 2)) };
}
