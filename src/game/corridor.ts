export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface CorridorAsset extends Rect { id: string; kind: string }
export const WIDTH = 3560, HEIGHT = 996, RADIUS = 17;
export const SPAWN = { x: 500, y: 530 };
export const COLLISIONS: Rect[] = [
  { x: 278, y: 347, width: 136, height: 38 },
  { x: 1879, y: 346, width: 54, height: 29 },
  { x: 3394, y: 338, width: 190, height: 43 },
  { x: 55, y: 693, width: 135, height: 108 },
  { x: 1174, y: 452, width: 180, height: 47 },
  { x: 2742, y: 452, width: 180, height: 47 },
];
export function walkable(p: Point): boolean {
  if (p.x < 25 || p.x > WIDTH - 25 || p.y < 397 || p.y > 775) return false;
  return !COLLISIONS.some(r => p.x > r.x - RADIUS && p.x < r.x + r.width + RADIUS && p.y > r.y - RADIUS && p.y < r.y + r.height + RADIUS);
}
export function move(p: Point, dx: number, dy: number): Point {
  const result = { ...p }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < steps; i++) {
    if (walkable({ x: result.x + dx / steps, y: result.y })) result.x += dx / steps;
    if (walkable({ x: result.x, y: result.y + dy / steps })) result.y += dy / steps;
  }
  return result;
}
export function segmentClear(a: Point, b: Point): boolean {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 8);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (!walkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}
export function findPath(from: Point, to: Point): Point[] {
  if (!walkable(to)) return [];
  if (segmentClear(from, to)) return [to];
  const nodes: Point[] = [];
  for (let y = 400; y <= 760; y += 20) for (let x = 40; x <= 3520; x += 20) if (walkable({ x, y })) nodes.push({ x, y });
  const nearest = (p: Point) => nodes.reduce((best, n) => Math.hypot(n.x-p.x,n.y-p.y) < Math.hypot(best.x-p.x,best.y-p.y) && segmentClear(p,n) ? n : best, nodes.find(n => segmentClear(p,n)) ?? p);
  const start = nearest(from), goal = nearest(to), key = (p: Point) => `${p.x},${p.y}`;
  const available = new Map(nodes.map(n => [key(n), n]));
  const queue = [start], parents = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (key(current) === key(goal)) {
      const path: Point[] = [to]; let p: Point | null = current;
      while (p) { path.unshift(p); p = parents.get(key(p)) ?? null; }
      return path;
    }
    for (const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20]]) {
      const next = available.get(key({ x: current.x+dx, y: current.y+dy }));
      if (next && !parents.has(key(next)) && segmentClear(current,next)) { parents.set(key(next), current); queue.push(next); }
    }
  }
  return [];
}
export interface Interaction { id: string; label: string; point: Point; kind: 'door' | 'bench' | 'sign' }
export function interactions(assets: CorridorAsset[]): Interaction[] {
  return assets.filter(a => ['door','bench','sign'].includes(a.kind)).map(a => ({
    id: a.id, kind: a.kind as Interaction['kind'],
    label: a.kind === 'door' ? `A-${a.id.split('-')[1]} 房門` : a.kind === 'bench' ? '坐下休息' : a.id === 'sign-research' ? '研究室方向' : '農業區方向',
    point: { x: a.x+a.width/2, y: a.kind === 'bench' ? 544 : 415 },
  }));
}
export const nearby = (p: Point, items: Interaction[]) => items.filter(i => Math.hypot(p.x-i.point.x,p.y-i.point.y)<100).sort((a,b) => Math.hypot(p.x-a.point.x,p.y-a.point.y)-Math.hypot(p.x-b.point.x,p.y-b.point.y))[0];
