import { createActor, RoomActor, setDestination } from './roomActors';
import { canTraverse, Direction, findPath, isWalkable, Point } from './roomNavigation';
import { inRect } from './roomFurniture';
import { PIECES, RoomPiece, SEATS } from './roomRuntime';

export interface RoomSeat { id: string; position: Point; direction: Direction; access: Point; furniture: RoomPiece }
/** Seats of the active room, resolved against the furniture they belong to. */
export const ROOM_SEATS: RoomSeat[] = SEATS.map(seat => ({ ...seat, furniture: PIECES.find(item => item.id === seat.id)! }));
export interface SeatState { phase: 'idle' | 'approaching' | 'sitting'; seat: RoomSeat | null; exitPoint: Point | null }
export const createSeatState = (): SeatState => ({ phase: 'idle', seat: null, exitPoint: null });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const clickedSeat = (point: Point) => ROOM_SEATS.find(seat => inRect(point, seat.furniture));
export const canUseSeat = (actor: RoomActor, seat: RoomSeat) => distance(actor.position, seat.access) <= 55 && canTraverse(actor.position, seat.access);
function sit(actor: RoomActor, state: SeatState, seat: RoomSeat) {
  state.exitPoint = { ...actor.position }; state.seat = seat; state.phase = 'sitting';
  Object.assign(actor, createActor({ ...seat.position }, seat.direction));
}
export function leaveSeat(actor: RoomActor, state: SeatState): boolean {
  if (state.phase !== 'sitting' || !state.exitPoint || !isWalkable(state.exitPoint)) return false;
  Object.assign(actor, createActor({ ...state.exitPoint }, state.seat!.direction));
  Object.assign(state, createSeatState());
  return true;
}
export function interactSeat(actor: RoomActor, state: SeatState): boolean {
  if (state.phase === 'sitting') return leaveSeat(actor, state);
  const seat = ROOM_SEATS.filter(seat => canUseSeat(actor, seat)).sort((a, b) => distance(actor.position, a.access) - distance(actor.position, b.access))[0];
  if (!seat) return false;
  sit(actor, state, seat); return true;
}
export function cancelSeatApproach(state: SeatState) {
  if (state.phase === 'approaching') Object.assign(state, createSeatState());
}
export function approachSeat(actor: RoomActor, state: SeatState, seat: RoomSeat): boolean {
  if (state.phase === 'sitting' && state.seat === seat) return true;
  leaveSeat(actor, state);
  cancelSeatApproach(state);
  if (canUseSeat(actor, seat)) { sit(actor, state, seat); return true; }
  if (!findPath(actor.position, seat.access).length || !setDestination(actor, seat.access)) return false;
  state.phase = 'approaching'; state.seat = seat;
  return true;
}
export function finishSeatApproach(actor: RoomActor, state: SeatState) {
  if (state.phase !== 'approaching' || actor.target) return;
  if (state.seat && canUseSeat(actor, state.seat)) sit(actor, state, state.seat);
  else cancelSeatApproach(state);
}
