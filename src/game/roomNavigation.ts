import { FOOTPRINT, touchesFootprint, hitsFurniture } from './roomFurniture';
import { PATROL, Rect, SHELL } from './roomRuntime';
export type { Point, Direction } from './roomRuntime';
import type { Point } from './roomRuntime';
export const ROOM_WIDTH = SHELL.width;
export const ROOM_HEIGHT = SHELL.height;
export const ROOM_EXIT_POINT: Point = { x: SHELL.exit.x, y: SHELL.exit.y };
export function canExitRoom({ x, y }: Point): boolean {
  return Math.hypot(x - ROOM_EXIT_POINT.x, y - ROOM_EXIT_POINT.y) <= SHELL.exit.radius;
}
// The door art starts below the player's feet. Let E work from the floor in front of it,
// all the way down to the parapet (the floor bound already stops feet there).
export const nearRoomDoor = ({ x, y }: Point) => x >= 190 && x <= 432 && y >= 930;
export const STEP = 10;
export const WALL_SIDE_CLEARANCE = SHELL.floor.sideClearance;
// Where the south parapet in foreground.png starts covering the floor.
export const SOUTH_WALL_LINE = SHELL.floor.southWallLine;
// The parapet is painted over actors, so feet may stand behind its base line.
// This is how deep they may go, and therefore how much body the wall hides.
export const SOUTH_WALL_OVERLAP = SHELL.floor.southWallOverlap;
// Physical walls are independent of the foreground artwork that hides actors.
export const WALLS: Rect[] = SHELL.walls;
export function isWalkable({ x, y }: Point): boolean {
  const { minX, maxX, northY } = SHELL.floor;
  const floor = x >= minX + WALL_SIDE_CLEARANCE && x <= maxX - WALL_SIDE_CLEARANCE
    && y >= (x < northY.splitX ? northY.left : northY.right) + FOOTPRINT.halfDepth
    && y <= SOUTH_WALL_LINE + SOUTH_WALL_OVERLAP - FOOTPRINT.halfDepth;
  return floor && !WALLS.some(wall => touchesFootprint({ x, y }, wall, WALL_SIDE_CLEARANCE)) && !hitsFurniture({ x, y });
}
// Check the whole movement segment: neither grid edges nor fast steps may tunnel.
export function canTraverse(from: Point, to: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 4));
  for (let i = 0; i <= steps; i++) {
    if (!isWalkable({ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps })) return false;
  }
  return true;
}
const key = (p: Point) => `${p.x},${p.y}`;
export const snap = (p: Point): Point => ({ x: Math.round(p.x / STEP) * STEP, y: Math.round(p.y / STEP) * STEP });
export function findPath(from: Point, to: Point): Point[] {
  if (!isWalkable(to)) return [];
  const connect = (p: Point) => {
    const center = snap(p);
    return [center, ...[[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP], [STEP, STEP], [-STEP, STEP], [STEP, -STEP], [-STEP, -STEP]].map(([x, y]) => ({ x: center.x + x, y: center.y + y }))]
      .filter(candidate => canTraverse(p, candidate))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  };
  const start = connect(from), goal = connect(to);
  if (!start || !goal) return [];
  const queue = [start];
  const parents = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(goal)) {
      const path: Point[] = [];
      let cursor: Point | null = p;
      while (cursor) { path.unshift(cursor); cursor = parents.get(key(cursor)) ?? null; }
      return path;
    }
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next = { x: p.x + dx, y: p.y + dy };
      if (!parents.has(key(next)) && canTraverse(p, next)) { parents.set(key(next), p); queue.push(next); }
    }
  }
  return [];
}
export const PATROL_POINTS: Point[] = PATROL;
