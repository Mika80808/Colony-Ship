export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface CorridorAsset extends Rect { id: string; kind: string; src?: string }
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
export type Facility = 'research' | 'greenhouse' | 'medical' | 'engineering';
export const FACILITY_NAMES: Record<Facility, string> = { research: '研究室', greenhouse: '溫室', medical: '醫療室', engineering: '工程部' };
/**
 * One residential corridor. B–D reuse A's wall/floor/doors; only signs and furniture differ.
 * Every door opens: door-n leads to room <letter>-n. Door-plate unlocking comes later.
 */
export interface CorridorConfig { folder: string; letter: string; left: Facility; right: Facility; collisions: Rect[] }
export const CORRIDORS: Record<string, CorridorConfig> = {
  residential_a: { folder: 'corridor-a', letter: 'A', left: 'research', right: 'greenhouse', collisions: COLLISIONS },
  residential_b: { folder: 'corridor-b', letter: 'B', left: 'greenhouse', right: 'medical', collisions: [] },
  residential_c: { folder: 'corridor-c', letter: 'C', left: 'medical', right: 'engineering', collisions: [] },
  residential_d: { folder: 'corridor-d', letter: 'D', left: 'engineering', right: 'research', collisions: [] },
};
/** The room a corridor door leads to: door-3 in corridor B is B-3. */
export const doorRoomId = (corridor: CorridorConfig, doorId: string) => `${corridor.letter}-${doorId.split('-')[1]}`;
/**
 * Where the player stands after walking out of `roomId`: on the floor in front
 * of that room's door. Door-1's centre rounds to SPAWN, so leaving A-1 lands
 * exactly where it always has. Falls back to SPAWN for anything else.
 */
export function spawnOutside(assets: CorridorAsset[], corridor: CorridorConfig, roomId: string | null): Point {
  const door = roomId ? assets.find(a => a.kind === 'door' && doorRoomId(corridor, a.id) === roomId) : undefined;
  return door ? { x: Math.round(door.x + door.width / 2), y: SPAWN.y } : { ...SPAWN };
}
export function walkable(p: Point, collisions = COLLISIONS): boolean {
  if (p.x < 25 || p.x > WIDTH - 25 || p.y < 397 || p.y > 775) return false;
  return !collisions.some(r => p.x > r.x - RADIUS && p.x < r.x + r.width + RADIUS && p.y > r.y - RADIUS && p.y < r.y + r.height + RADIUS);
}
export function move(p: Point, dx: number, dy: number, collisions = COLLISIONS): Point {
  const result = { ...p }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < steps; i++) {
    if (walkable({ x: result.x + dx / steps, y: result.y }, collisions)) result.x += dx / steps;
    if (walkable({ x: result.x, y: result.y + dy / steps }, collisions)) result.y += dy / steps;
  }
  return result;
}
export function segmentClear(a: Point, b: Point, collisions = COLLISIONS): boolean {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 8);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    if (!walkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, collisions)) return false;
  }
  return true;
}
export function findPath(from: Point, to: Point, collisions = COLLISIONS): Point[] {
  const walkable_ = (p: Point) => walkable(p, collisions), segmentClear_ = (a: Point, b: Point) => segmentClear(a, b, collisions);
  if (!walkable_(to)) return [];
  if (segmentClear_(from, to)) return [to];
  const nodes: Point[] = [];
  for (let y = 400; y <= 760; y += 20) for (let x = 40; x <= 3520; x += 20) if (walkable_({ x, y })) nodes.push({ x, y });
  const nearest = (p: Point) => nodes.reduce((best, n) => Math.hypot(n.x-p.x,n.y-p.y) < Math.hypot(best.x-p.x,best.y-p.y) && segmentClear_(p,n) ? n : best, nodes.find(n => segmentClear_(p,n)) ?? p);
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
      if (next && !parents.has(key(next)) && segmentClear_(current,next)) { parents.set(key(next), current); queue.push(next); }
    }
  }
  return [];
}
export interface Interaction { id: string; label: string; point: Point; kind: 'door' | 'bench' | 'sign' }
const signFacility = (id: string) => id.replace('sign-', '') as Facility;
export function interactions(assets: CorridorAsset[], corridor = CORRIDORS.residential_a): Interaction[] {
  return assets.filter(a => ['door','bench','sign'].includes(a.kind)).map(a => ({
    id: a.id, kind: a.kind as Interaction['kind'],
    label: a.kind === 'door' ? `${corridor.letter}-${a.id.split('-')[1]} 房門` : a.kind === 'bench' ? '坐下休息' : `${FACILITY_NAMES[signFacility(a.id)]}方向`,
    point: { x: a.x+a.width/2, y: a.kind === 'bench' ? 544 : 415 },
  }));
}
export const nearby = (p: Point, items: Interaction[]) => items.filter(i => Math.hypot(p.x-i.point.x,p.y-i.point.y)<100).sort((a,b) => Math.hypot(p.x-a.point.x,p.y-a.point.y)-Math.hypot(p.x-b.point.x,p.y-b.point.y))[0];
export function signNotice(id: string, corridor: CorridorConfig): string {
  const facility = signFacility(id);
  return `${FACILITY_NAMES[facility]}位於走廊${corridor.left === facility ? '左' : '右'}側方向，目前尚未開放。`;
}
// Benches are two-seaters: cushion centres sit 37px either side of the artwork's middle.
export const BENCH_SEAT_OFFSET = 37;
/** The bench seat nearest to `x`, as the floor point in front of that cushion. */
export function benchSeat(bench: Interaction, x: number): Interaction {
  return { ...bench, point: { x: bench.point.x + (x < bench.point.x ? -BENCH_SEAT_OFFSET : BENCH_SEAT_OFFSET), y: bench.point.y } };
}

