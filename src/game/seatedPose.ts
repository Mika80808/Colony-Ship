/** Draw a seated pose from a walk frame without scaling the head or torso. */
export function drawSeatedPose(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  sourceX: number, sourceY: number, sourceWidth: number, sourceHeight: number,
  x: number, y: number, width: number, height: number,
  direction: 'down' | 'up' | 'left' | 'right',
) {
  const upper = 0.7;
  const legHeight = height * (1 - upper) * 0.8;
  ctx.drawImage(sprite, sourceX, sourceY, sourceWidth, sourceHeight * upper,
    x, y, width, height * upper);

  ctx.save();
  ctx.translate(x, y + height * upper);
  const sideways = direction === 'left' || direction === 'right';
  if (sideways) {
    // Use the stride frame below the idle frame so the shoe actually points forward.
    // A small shear keeps the hips aligned while extending the feet past the seat.
    const reach = direction === 'right' ? 42 : -42;
    ctx.transform(1, 0, reach / legHeight, 1, 0, 0);
  }
  const legSourceY = sourceY + sourceHeight * upper + (sideways ? sourceHeight : 0);
  ctx.drawImage(sprite, sourceX, legSourceY,
    sourceWidth, sourceHeight * (1 - upper), 0, 0, width, legHeight);
  ctx.restore();
}
