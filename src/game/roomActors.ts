import { Direction, findPath, isWalkable, canTraverse, PATROL_POINTS, Point } from './roomNavigation';

export interface RoomActor {
  position: Point; direction: Direction; path: Point[]; target: Point | null;
  elapsed: number; moving: boolean; idle: number; patrol: number;
}
export function createActor(position: Point, direction: Direction = 'down'): RoomActor {
  return { position, direction, path: [], target: null, elapsed: 0, moving: false, idle: 0.8, patrol: 0 };
}
export function setDestination(actor: RoomActor, point: Point): boolean {
  const path = findPath(actor.position, point);
  if (!path.length) return false;
  actor.path = path; actor.target = path.at(-1)!;
  return true;
}
function face(actor: RoomActor, dx: number, dy: number) {
  actor.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}
export function canInteract(player: RoomActor, npc: RoomActor): boolean {
  const dx = npc.position.x - player.position.x, dy = npc.position.y - player.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance > 115) return false;
  // Proximity alone must not allow talking through partitions or furniture.
  const steps = Math.max(1, Math.ceil(distance / 5));
  for (let i = 0; i <= steps; i++) {
    if (!isWalkable({ x: player.position.x + dx * i / steps, y: player.position.y + dy * i / steps })) return false;
  }
  return true;
}
export function advancePath(actor: RoomActor, dt: number, speed: number) {
  actor.moving = false;
  let remaining = speed * dt;
  while (actor.path.length && remaining > 0) {
    const next = actor.path[0];
    const dx = next.x - actor.position.x, dy = next.y - actor.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.001) { actor.position = { ...next }; actor.path.shift(); continue; }
    face(actor, dx, dy);
    const step = Math.min(distance, remaining);
    const candidate = { x: actor.position.x + dx / distance * step, y: actor.position.y + dy / distance * step };
    if (!canTraverse(actor.position, candidate)) { actor.path = []; break; }
    actor.position = candidate; actor.moving = true; remaining -= step;
    if (step === distance) { actor.position = { ...next }; actor.path.shift(); }
  }
  if (!actor.path.length) actor.target = null;
  actor.elapsed = actor.moving ? actor.elapsed + dt : 0;
}
export function updateNpc(actor: RoomActor, dt: number) {
  if (!actor.path.length) {
    actor.idle -= dt;
    if (actor.idle <= 0) {
      setDestination(actor, PATROL_POINTS[actor.patrol]);
      actor.patrol = (actor.patrol + 1) % PATROL_POINTS.length; actor.idle = 1.4;
    }
  }
  advancePath(actor, dt, 100);
}
export function updatePlayer(actor: RoomActor, dt: number, keys: ReadonlySet<string>) {
  const dx = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
  const dy = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
  if (!dx && !dy) { advancePath(actor, dt, 160); return; }
  actor.path = []; actor.target = null; face(actor, dx, dy);
  const distance = 160 * dt / Math.hypot(dx, dy);
  const before = actor.position;
  // Separate axes let the player slide along walls without stepping through them.
  const xStep = { x: before.x + dx * distance, y: before.y };
  if (canTraverse(actor.position, xStep)) actor.position = xStep;
  const yStep = { x: actor.position.x, y: actor.position.y + dy * distance };
  if (canTraverse(actor.position, yStep)) actor.position = yStep;
  actor.moving = Math.hypot(actor.position.x - before.x, actor.position.y - before.y) > 0.001;
  actor.elapsed = actor.moving ? actor.elapsed + dt : 0;
}
