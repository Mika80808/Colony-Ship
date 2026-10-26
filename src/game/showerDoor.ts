import type { Point, Rect, RoomPiece } from './roomRuntime';
import { FOOTPRINT } from './roomFurniture';

// Glass bounds in the original 144 x 210 artwork.
const PANEL = { x: 15, y: 75, width: 114, height: 119 };

/** Draw the enclosure without its baked-in glass door, leaving room for the actor. */
export function drawShowerCabin(ctx: CanvasRenderingContext2D, picture: HTMLImageElement, shower: Rect) {
  const sx = shower.width / picture.naturalWidth;
  const sy = shower.height / picture.naturalHeight;
  const panelX = shower.x + PANEL.x * sx;
  const panelY = shower.y + PANEL.y * sy;
  const panelW = PANEL.width * sx;
  const panelH = PANEL.height * sy;
  const interior = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
  interior.addColorStop(0, '#526771');
  interior.addColorStop(0.72, '#6b8792');
  interior.addColorStop(1, '#839ba2');
  ctx.fillStyle = interior;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  // Keep the original metal frame, shower head, and lower sill intact.
  const part = (x: number, y: number, w: number, h: number) => {
    ctx.drawImage(picture, x, y, w, h, shower.x + x * sx, shower.y + y * sy, w * sx, h * sy);
  };
  part(0, 0, picture.naturalWidth, PANEL.y);
  part(0, PANEL.y, PANEL.x, PANEL.height);
  part(PANEL.x + PANEL.width, PANEL.y,
    picture.naturalWidth - PANEL.x - PANEL.width, PANEL.height);
  part(0, PANEL.y + PANEL.height, picture.naturalWidth,
    picture.naturalHeight - PANEL.y - PANEL.height);
}

/** Split the existing artwork once at load time, before any actors are drawn. */
export function createShowerLayers(picture: HTMLImageElement) {
  const back = document.createElement('canvas');
  const glass = document.createElement('canvas');
  back.width = glass.width = picture.naturalWidth;
  back.height = glass.height = picture.naturalHeight;
  drawShowerCabin(back.getContext('2d')!, picture,
    { x: 0, y: 0, width: back.width, height: back.height });
  glass.getContext('2d')!.drawImage(picture, PANEL.x, PANEL.y, PANEL.width, PANEL.height,
    PANEL.x, PANEL.y, PANEL.width, PANEL.height);
  return { back, glass };
}

export function showerLayerDepths(shower: RoomPiece) {
  return { back: shower.y + PANEL.y / 210 * shower.height, glass: shower.depth + 1 };
}

/** Doorway overlap is independent of whether the player is currently showering. */
export function isBehindShowerGlass(point: Point, shower: RoomPiece) {
  const depth = showerLayerDepths(shower);
  return point.y > depth.back && point.y < depth.glass
    && point.x + FOOTPRINT.halfWidth > shower.x + PANEL.x / 144 * shower.width
    && point.x - FOOTPRINT.halfWidth < shower.x + (PANEL.x + PANEL.width) / 144 * shower.width;
}

/** The glass keeps its dimensions and stays translucent while someone is behind it. */
export function drawShowerDoor(
  ctx: CanvasRenderingContext2D, glass: HTMLCanvasElement, shower: Rect, actorBehind: boolean,
) {
  ctx.save();
  ctx.globalAlpha = actorBehind ? 0.3 : 1;
  ctx.drawImage(glass, shower.x, shower.y, shower.width, shower.height);
  ctx.restore();
}
