/**
 * The one room that is currently loaded.
 *
 * Every residential room shares one shell (walls, floor, bathroom fixtures, the
 * door). What sits on top belongs to whoever lives there, not to the room: a
 * furnishing is keyed by occupant, so it moves with them if they change rooms,
 * and a room with no furnished occupant is just the shell. `setActiveRoom`
 * layers the two together.
 *
 * The exported collections are mutated in place rather than reassigned: callers
 * hold them as plain `const` imports, and there is only ever one active room.
 */
import shellJson from '../../public/assets/rooms/shell.json';
import lucianFurnishing from '../../public/assets/rooms/furnishings/lucian.json';

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
/**
 * `access` is where the player has to be standing to get into bed. It belongs to
 * the layout, not to shared code: every room puts its bed somewhere else, so a
 * hardcoded list would quietly stop lining up as soon as a second room existed.
 */
export interface RoomBedData { id: string; actorDepth: number; restY: number; leftX: number; rightX: number; access: Point[] }

export interface RoomShell {
  width: number; height: number; base: string;
  overlays: { id: string; image: string; src?: number[]; dst: number[]; order: string }[];
  walls: Rect[];
  floor: { minX: number; maxX: number; sideClearance: number; northY: { left: number; right: number; splitX: number }; southWallLine: number; southWallOverlap: number };
  exit: { x: number; y: number; radius: number };
  showerZone: Rect;
  fixtures: RoomPiece[];
}
/** An occupant's belongings, laid over the shared shell. Every part is optional in spirit: an empty room has none. */
export interface RoomFurnishing {
  occupant: string;
  decals: RoomDecal[];
  objects: RoomPiece[];
  looseSolids: Rect[];
  seats: RoomSeatData[];
  patrol: Point[];
  /** Absent when the occupant has no bed placed yet. */
  bed?: RoomBedData;
}

/** The bare shell. What every room shows until its occupant has furnishings. */
export const EMPTY_FURNISHING: RoomFurnishing = { occupant: '', decals: [], objects: [], looseSolids: [], seats: [], patrol: [] };

/** Furnishings by occupant (NPC id). Add an entry when a character's room art exists. */
export const FURNISHINGS: Record<string, RoomFurnishing> = {
  lucian: lucianFurnishing as RoomFurnishing,
};

export const furnishingFor = (occupantId: string | undefined): RoomFurnishing =>
  (occupantId && FURNISHINGS[occupantId]) || EMPTY_FURNISHING;

/** Shared by every room on the residential deck. */
export const SHELL = shellJson as RoomShell;

/** Shell fixtures plus the active layout's furniture, in one depth-sorted list. */
export const PIECES: RoomPiece[] = [];
/** Every collision rect in the room, already flattened out of its owning piece. */
export const SOLIDS: Rect[] = [];
export const DECALS: RoomDecal[] = [];
export const SEATS: RoomSeatData[] = [];
export const PATROL: Point[] = [];
/** The active room's bed. `id` is empty when the room has none. */
export const BED: RoomBedData = { id: '', actorDepth: 0, restY: 0, leftX: 0, rightX: 0, access: [] };
const NO_BED: RoomBedData = { ...BED };

let activeId = '';
export const activeRoomId = () => activeId;

const refill = <T,>(target: T[], next: readonly T[]) => { target.length = 0; target.push(...next); };

export function setActiveRoom(roomId: string, furnishing: RoomFurnishing = EMPTY_FURNISHING) {
  activeId = roomId;
  refill(PIECES, [...SHELL.fixtures, ...furnishing.objects]);
  refill(SOLIDS, [...PIECES.flatMap(piece => piece.solid ?? []), ...furnishing.looseSolids]);
  refill(DECALS, furnishing.decals);
  refill(SEATS, furnishing.seats);
  refill(PATROL, furnishing.patrol);
  Object.assign(BED, NO_BED, furnishing.bed?.id ? furnishing.bed : {});
}

// Lucian in A-1 is the room every test file exercises, so it is the default.
setActiveRoom('A-1', FURNISHINGS.lucian);
