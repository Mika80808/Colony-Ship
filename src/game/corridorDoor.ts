// Corridor door artwork is 121 × 149. Coordinates below describe the inner opening,
// excluding the fixed frame and its two bevelled upper corners.
export const CORRIDOR_DOOR_ANIMATION = {
  openSeconds: 0.5,
  fadeStartSeconds: 0.55,
  fadeSeconds: 0.3,
  openingColor: '#101d28',
  opening: [[32, 7], [89, 7], [105, 24], [105, 148], [16, 148], [16, 24]],
} as const;

export function corridorDoorFrame(elapsed: number) {
  const config = CORRIDOR_DOOR_ANIMATION;
  const t = Math.max(0, Math.min(1, elapsed / config.openSeconds));
  return {
    open: t * t * (3 - 2 * t),
    fade: Math.max(0, Math.min(1, (elapsed - config.fadeStartSeconds) / config.fadeSeconds)),
    complete: elapsed >= config.fadeStartSeconds + config.fadeSeconds,
  };
}
function openingPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  CORRIDOR_DOOR_ANIMATION.opening.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}
export function createCorridorDoorLeaves(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.save(); ctx.scale(canvas.width / 121, canvas.height / 149);
  openingPath(ctx); ctx.clip();
  ctx.drawImage(image, 0, 0, 121, 149); ctx.restore();
  return canvas;
}
export function drawCorridorDoor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, leaves: HTMLCanvasElement, x: number, y: number, width: number, height: number, open: number) {
  // The full closed asset supplies the stationary frame. Only masked leaves move.
  ctx.drawImage(image, x, y, width, height);
  if (open <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(width / 121, height / 149);
  openingPath(ctx); ctx.clip();
  ctx.fillStyle = CORRIDOR_DOOR_ANIMATION.openingColor; ctx.fill();
  const half = leaves.width / 2, offset = 60.5 * open;
  ctx.drawImage(leaves, 0, 0, half, leaves.height, -offset, 0, 60.5, 149);
  ctx.drawImage(leaves, half, 0, half, leaves.height, 60.5 + offset, 0, 60.5, 149);
  ctx.restore();
}
