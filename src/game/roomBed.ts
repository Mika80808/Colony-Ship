import { createActor, RoomActor, setDestination } from './roomActors';
import { canTraverse, findPath, isWalkable, Point } from './roomNavigation';
import { inRect } from './roomFurniture';
import { BED as BED_DATA, PIECES } from './roomRuntime';

/**
 * The active room's bed art, looked up on every call: rooms swap at runtime and
 * an empty room has no bed at all, so a value captured at import would go stale.
 */
export const bedPiece = () => (BED_DATA.id ? PIECES.find(item => item.id === BED_DATA.id) : undefined);
export type BedSide = 'left' | 'right';
export const bedSideAt = (point: Point): BedSide => {
  const bed = bedPiece();
  return !bed || point.x < bed.x + bed.width / 2 ? 'left' : 'right';
};
// Lying position is pinned by two edges: the bed base art starts 3px below the
// piece's y and the sprite's head is 136px above its feet, so the feet cannot
// sit too high without the head poking out over the headboard; the blanket is
// opaque from its own top edge and the face is 73-90px above the feet, so too
// low and the blanket swallows the face. restY is the value that satisfies
// both, and it has to be re-derived whenever the bed art moves.
export const bedRestPoint = (side: BedSide): Point => ({ x: side === 'left' ? BED_DATA.leftX : BED_DATA.rightX, y: BED_DATA.restY });
/** Where a resting actor sorts: between the bed base and the blanket. */
export const bedActorDepth = () => BED_DATA.actorDepth;
export interface BedState { phase: 'idle' | 'approaching' | 'resting'; exitPoint: Point | null; side: BedSide | null }
export const createBedState = (): BedState => ({ phase: 'idle', exitPoint: null, side: null });
export const clickedBed = (point: Point) => {
  const bed = bedPiece();
  return !!bed && inRect(point, bed);
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function canUseBed(actor: RoomActor): boolean {
  return BED_DATA.access.some(point => distance(actor.position, point) <= 65 && canTraverse(actor.position, point));
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
  const routes = BED_DATA.access.map(point => ({ point, path: findPath(actor.position, point) }))
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
