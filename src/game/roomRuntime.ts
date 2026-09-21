/**
 * The one room that is currently loaded.
 *
 * Every residential room shares one shell (walls, floor, bathroom fixtures) and
 * differs only in how its furniture is arranged, so the shell is a compile-time
 * constant while the layout is swapped at runtime by `setActiveRoom`.
 *
 * The exported collections are mutated in place rather than reassigned: callers
 * hold them as plain `const` imports, and there is only ever one active room.
 */
import shellJson from '../../public/assets/rooms/shell.json';
import defaultLayout from '../../public/assets/rooms/a-1.json';

export interface Rect { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }
export type Direction = 'down' | 'up' | 'left' | 'right';

/** A piece of art that sorts against actors by its floor contact line. */
export interface RoomPiece extends Rect {
  id: string;
  image: string;
  depth: number;
  label?: string;
  inspectText?: string;
  solid?: Rect[];
}
/** Flat floor art: no collision, never sorts above an actor. */
export interface RoomDecal extends Rect { id: string; image: string }
export interface RoomSeatData { id: string; position: Point; direction: Direction; access: Point }
export interface RoomBedData { id: string; actorDepth: number; restY: number; leftX: number; rightX: number }

export interface RoomShell {
  width: number; height: number; base: string;
  overlays: { id: string; image: string; src?: number[]; dst: number[]; order: string }[];
  walls: Rect[];
  floor: { minX: number; maxX: number; sideClearance: number; northY: { left: number; right: number; splitX: number }; southWallLine: number; southWallOverlap: number };
  exit: { x: number; y: number; radius: number };
  showerZone: Rect;
  fixtures: RoomPiece[];
}
export interface RoomLayout {
  id: string; name: string;
  decals: RoomDecal[];
  objects: RoomPiece[];
  looseSolids: Rect[];
  seats: RoomSeatData[];
  patrol: Point[];
  bed: RoomBedData;
}

/** Shared by every room on the residential deck. */
export const SHELL = shellJson as RoomShell;

/** Shell fixtures plus the active layout's furniture, in one depth-sorted list. */
export const PIECES: RoomPiece[] = [];
/** Every collision rect in the room, already flattened out of its owning piece. */
export const SOLIDS: Rect[] = [];
export const DECALS: RoomDecal[] = [];
export const SEATS: RoomSeatData[] = [];
export const PATROL: Point[] = [];
export const BED: RoomBedData = { id: '', actorDepth: 0, restY: 0, leftX: 0, rightX: 0 };

let activeId = '';
export const activeRoomId = () => activeId;

const refill = <T,>(target: T[], next: readonly T[]) => { target.length = 0; target.push(...next); };

export function setActiveRoom(layout: RoomLayout) {
  activeId = layout.id;
  refill(PIECES, [...SHELL.fixtures, ...layout.objects]);
  refill(SOLIDS, [...PIECES.flatMap(piece => piece.solid ?? []), ...layout.looseSolids]);
  refill(DECALS, layout.decals);
  refill(SEATS, layout.seats);
  refill(PATROL, layout.patrol);
  Object.assign(BED, layout.bed);
}

setActiveRoom(defaultLayout as RoomLayout);
