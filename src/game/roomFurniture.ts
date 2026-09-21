import { PIECES, Rect, SHELL, SOLIDS } from './roomRuntime';

export type { Rect } from './roomRuntime';
/** Art in the active room, shell fixtures first. Positions come from its layout JSON. */
export const FURNITURE = PIECES;
export const INSPECTABLES = PIECES;

// A pair of feet is wider than it is deep. Includes a small visual clearance.
export const FOOTPRINT = { halfWidth: 28, halfDepth: 14 };
export const touchesFootprint = (point: { x: number; y: number }, rect: Rect, sideMargin = FOOTPRINT.halfWidth) =>
  point.x + sideMargin >= rect.x && point.x - sideMargin <= rect.x + rect.width
  && point.y + FOOTPRINT.halfDepth >= rect.y && point.y - FOOTPRINT.halfDepth <= rect.y + rect.height;

export const SHOWER_ZONE: Rect = SHELL.showerZone;
export const inRect = (point: { x: number; y: number }, rect: Rect, padding = 0) =>
  point.x >= rect.x - padding && point.x <= rect.x + rect.width + padding
  && point.y >= rect.y - padding && point.y <= rect.y + rect.height + padding;
export const isShowering = (point: { x: number; y: number }) => inRect(point, SHOWER_ZONE);
export const hitsFurniture = (point: { x: number; y: number }) =>
  SOLIDS.some(rect => touchesFootprint(point, rect));
