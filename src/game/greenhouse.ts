import type { Point, Rect } from './corridor';

/**
 * 溫室：格子碰撞地圖（public/assets/greenhouse/map.json，設計稿在 星艦設計圖/greenhouse_collision.json）。
 * 跟走廊的矩形碰撞不同，這裡每格 0 可走 / 1 碰撞；點地移動走 A*，再拉直成最少轉折。
 * 作物不加碰撞，菜圃可以踩。
 */
export interface TileRect { x: number; y: number; w: number; h: number }
export interface GreenhouseMap { tileSize: number; width: number; height: number; collision: number[][]; plots: TileRect[]; entrance: TileRect }
export interface GreenhouseInteraction { id: string; kind: 'exit' | 'plot' | 'window' | 'console' | 'monitor'; label: string; text: string; point: Point; area: Rect }

/** Foot-circle radius; comfortably inside a 96px aisle. */
export const RADIUS = 22;
/** How far outside an interaction's area the player still counts as next to it. */
export const REACH = 56;

export const worldSize = (m: GreenhouseMap) => ({ width: m.width * m.tileSize, height: m.height * m.tileSize });
const tileCentre = (m: GreenhouseMap, x: number, y: number): Point => ({ x: (x + .5) * m.tileSize, y: (y + .5) * m.tileSize });
const tileRect = (m: GreenhouseMap, t: TileRect): Rect => ({ x: t.x * m.tileSize, y: t.y * m.tileSize, width: t.w * m.tileSize, height: t.h * m.tileSize });

export const blocked = (m: GreenhouseMap, tx: number, ty: number) => tx < 0 || ty < 0 || tx >= m.width || ty >= m.height || m.collision[ty][tx] === 1;

/** The foot circle overlaps no collision tile and stays inside the map. */
export function walkable(m: GreenhouseMap, p: Point): boolean {
  const { width, height } = worldSize(m), s = m.tileSize;
  if (p.x < RADIUS || p.y < RADIUS || p.x > width - RADIUS || p.y > height - RADIUS) return false;
  for (let ty = Math.floor((p.y - RADIUS) / s); ty <= Math.floor((p.y + RADIUS) / s); ty++)
    for (let tx = Math.floor((p.x - RADIUS) / s); tx <= Math.floor((p.x + RADIUS) / s); tx++) {
      if (!blocked(m, tx, ty)) continue;
      const nx = Math.max(tx * s, Math.min(p.x, (tx + 1) * s)), ny = Math.max(ty * s, Math.min(p.y, (ty + 1) * s));
      if (Math.hypot(p.x - nx, p.y - ny) < RADIUS) return false;
    }
  return true;
}

/** Axis-separated so the player slides along walls instead of sticking. */
export function move(m: GreenhouseMap, p: Point, dx: number, dy: number): Point {
  const result = { ...p }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < steps; i++) {
    if (walkable(m, { x: result.x + dx / steps, y: result.y })) result.x += dx / steps;
    if (walkable(m, { x: result.x, y: result.y + dy / steps })) result.y += dy / steps;
  }
  return result;
}

export function segmentClear(m: GreenhouseMap, a: Point, b: Point): boolean {
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
export function findPath(m: GreenhouseMap, from: Point, to: Point): Point[] {
  if (!walkable(m, to)) return [];
  if (segmentClear(m, from, to)) return [to];
  const s = m.tileSize, W = m.width;
  const start = [Math.floor(from.x / s), Math.floor(from.y / s)], goal = [Math.floor(to.x / s), Math.floor(to.y / s)];
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
      if (blocked(m, nx, ny) || (dx && dy && (blocked(m, x + dx, y) || blocked(m, x, y + dy)))) continue;
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

/** Just inside the entrance, facing into the greenhouse. */
export const spawn = (m: GreenhouseMap): Point => ({ x: (m.entrance.x + m.entrance.w / 2) * m.tileSize, y: (m.entrance.y - 1.5) * m.tileSize });

export function interactions(m: GreenhouseMap): GreenhouseInteraction[] {
  const at = (id: string, kind: GreenhouseInteraction['kind'], label: string, text: string, area: TileRect, stand: Point): GreenhouseInteraction =>
    ({ id, kind, label, text, area: tileRect(m, area), point: { x: stand.x * m.tileSize, y: stand.y * m.tileSize } });
  const e = m.entrance;
  return [
    at('exit', 'exit', '離開溫室', '', e, { x: e.x + e.w / 2, y: e.y + .5 }),
    at('window', 'window', '挑高觀景窗', '整面觀景窗外是緩慢流過的星海，人造日光從上方灑落。', { x: 15, y: 0, w: 10, h: 4 }, { x: 20, y: 4.5 }),
    at('console', 'console', '窗前工作站', '農業監控終端：自動種植區運作正常。（工作站功能尚未開放）', { x: 24, y: 7, w: 2, h: 1 }, { x: 25, y: 8.5 }),
    // 兩台監測機擋住通往最上排走道的路，那兩條走道只給自動設備用。
    at('monitor-left', 'monitor', '植栽監測機', '左翼植栽監測機：溫度、濕度、養液濃度皆在標準範圍。', { x: 13, y: 2, w: 1, h: 1 }, { x: 13.5, y: 3.5 }),
    at('monitor-right', 'monitor', '植栽監測機', '右翼植栽監測機：溫度、濕度、養液濃度皆在標準範圍。', { x: 26, y: 1, w: 1, h: 1 }, { x: 26.5, y: 2.5 }),
    ...m.plots.map((p, i) => at(`plot-${i + 1}`, 'plot', `種植區 ${i + 1}`, '這塊土地還空著。（種植系統尚未開放）', p, { x: p.x + p.w / 2, y: p.y + p.h / 2 })),
  ];
}

const inReach = (p: Point, r: Rect) => p.x > r.x - REACH && p.x < r.x + r.width + REACH && p.y > r.y - REACH && p.y < r.y + r.height + REACH;
/** The interaction the player is standing next to, preferring the closest. */
export const nearby = (p: Point, items: GreenhouseInteraction[]) => items.filter(i => inReach(p, i.area))
  .sort((a, b) => Math.hypot(p.x - a.point.x, p.y - a.point.y) - Math.hypot(p.x - b.point.x, p.y - b.point.y))[0];
/** The interaction whose area contains a clicked world point. */
export const clicked = (p: Point, items: GreenhouseInteraction[]) => items.find(i => p.x >= i.area.x && p.x <= i.area.x + i.area.width && p.y >= i.area.y && p.y <= i.area.y + i.area.height);

/** Camera origin centred on `focus`, clamped to the map. */
export function camera(focus: Point, view: { width: number; height: number }, m: GreenhouseMap): Point {
  const { width, height } = worldSize(m);
  return { x: Math.max(0, Math.min(width - view.width, focus.x - view.width / 2)), y: Math.max(0, Math.min(height - view.height, focus.y - view.height / 2)) };
}
