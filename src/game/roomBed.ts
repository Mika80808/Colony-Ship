import { createActor, RoomActor, setDestination } from './roomActors';
import { canTraverse, findPath, isWalkable, Point } from './roomNavigation';
import { inRect } from './roomFurniture';
import { BED as BED_DATA, PIECES } from './roomRuntime';

export const BED = PIECES.find(item => item.id === BED_DATA.id)!;
export type BedSide = 'left' | 'right';
export const bedSideAt = (point: Point): BedSide => point.x < BED.x + BED.width / 2 ? 'left' : 'right';
// Lying position is pinned by two edges: bed-base.png starts at y=123 and the
// sprite's head is 136px above its feet, so the feet cannot sit above 259
// without the head poking out over the headboard; bed-blanket.png is opaque
// from y=184 and the face is 73-90px above the feet, so below 257 the blanket
// swallows the face. That leaves the head on the pillow band at y=164-190.
export const BED_PILLOW_REST_Y = BED_DATA.restY;
export const bedRestPoint = (side: BedSide): Point => ({ x: side === 'left' ? BED_DATA.leftX : BED_DATA.rightX, y: BED_PILLOW_REST_Y });
export const BED_REST_POINT: Point = bedRestPoint('left');
export const BED_ACTOR_DEPTH = BED_DATA.actorDepth;
const ACCESS_POINTS: Point[] = [{ x: 800, y: 280 }, { x: 1080, y: 280 }, { x: 940, y: 380 }];
export interface BedState { phase: 'idle' | 'approaching' | 'resting'; exitPoint: Point | null; side: BedSide | null }
export const createBedState = (): BedState => ({ phase: 'idle', exitPoint: null, side: null });
export const clickedBed = (point: Point) => inRect(point, BED);
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function canUseBed(actor: RoomActor): boolean {
  return ACCESS_POINTS.some(point => distance(actor.position, point) <= 65 && canTraverse(actor.position, point));
}
function enterBed(actor: RoomActor, bed: BedState) {
  bed.side ??= bedSideAt(actor.position);
  bed.exitPoint = { ...actor.position };
  bed.phase = 'resting';
  Object.assign(actor, createActor(bedRestPoint(bed.side), 'down'));
}
export function leaveBed(actor: RoomActor, bed: BedState): boolean {
  if (bed.phase !== 'resting' || !bed.exitPoint || !isWalkable(bed.exitPoint)) return false;
  Object.assign(actor, createActor({ ...bed.exitPoint }, 'down'));
  bed.phase = 'idle'; bed.exitPoint = null; bed.side = null;
  return true;
}
export function interactBed(actor: RoomActor, bed: BedState): boolean {
  if (bed.phase === 'resting') return leaveBed(actor, bed);
  if (!canUseBed(actor)) return false;
  bed.side = bedSideAt(actor.position);
  enterBed(actor, bed);
  return true;
}
export function cancelBedApproach(bed: BedState) {
  if (bed.phase === 'approaching') { bed.phase = 'idle'; bed.side = null; }
}
export function approachBed(actor: RoomActor, bed: BedState, selectedSide?: BedSide): boolean {
  if (bed.phase === 'resting') {
    if (selectedSide) { bed.side = selectedSide; actor.position = bedRestPoint(selectedSide); }
    return true;
  }
  bed.side = selectedSide ?? bedSideAt(actor.position);
  if (canUseBed(actor)) { enterBed(actor, bed); return true; }
  const routes = ACCESS_POINTS.map(point => ({ point, path: findPath(actor.position, point) }))
    .filter(route => route.path.length).sort((a, b) => a.path.length - b.path.length);
  if (!routes.length || !setDestination(actor, routes[0].point)) return false;
  bed.phase = 'approaching';
  return true;
}
export function finishBedApproach(actor: RoomActor, bed: BedState) {
  if (bed.phase !== 'approaching' || actor.target) return;
  if (canUseBed(actor)) enterBed(actor, bed);
  else bed.phase = 'idle';
}
