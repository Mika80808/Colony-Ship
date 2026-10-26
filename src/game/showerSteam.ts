import type { Rect } from './roomRuntime';

/** Light spray from the overhead shower, drawn across the actor before the mist. */
export function drawShowerSpray(ctx: CanvasRenderingContext2D, shower: Rect, seconds: number) {
  const headX = shower.x + shower.width * 0.5;
  const headY = shower.y + shower.height * (35 / 210);
  const reach = shower.height * 0.7;
  ctx.save();
  ctx.beginPath();
  ctx.rect(shower.x + 18, shower.y + 45, shower.width - 36, shower.height - 60);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    const bottomX = headX + i * 13;
    const spray = ctx.createLinearGradient(headX, headY, bottomX, headY + reach);
    spray.addColorStop(0, 'rgba(196, 239, 251, 0.4)');
    spray.addColorStop(1, 'rgba(196, 239, 251, 0)');
    ctx.strokeStyle = spray;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(headX + i * 2, headY);
    ctx.quadraticCurveTo(headX + i * 7, headY + reach * 0.5, bottomX, headY + reach);
    ctx.stroke();
  }
  for (let i = 0; i < 13; i++) {
    const fall = (seconds * (72 + i % 3 * 11) + i * 17) % reach;
    const x = headX + (i % 7 - 3) * 4 + (i % 7 - 3) * fall / reach * 7;
    const y = headY + fall;
    ctx.strokeStyle = `rgba(209, 246, 255, ${0.28 + i % 3 * 0.055})`;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.7, y + 5 + i % 4);
    ctx.stroke();
  }
  ctx.restore();
}

/** Soft, slowly rising vapor inside the shower; the player stays visible. */
export function drawShowerSteam(
  ctx: CanvasRenderingContext2D,
  shower: Rect,
  player: { x: number; y: number },
  seconds: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(shower.x + 15, shower.y + 12, shower.width - 30, shower.height - 30);
  ctx.clip();

  const cloud = (x: number, y: number, rx: number, ry: number, opacity: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx, ry);
    const haze = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 1);
    haze.addColorStop(0, `rgba(226, 244, 249, ${opacity})`);
    haze.addColorStop(0.48, `rgba(226, 244, 249, ${opacity * 0.48})`);
    haze.addColorStop(1, 'rgba(226, 244, 249, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };

  // A faint veil joins the wisps without turning the character into a white shape.
  cloud(player.x, player.y - 62, 49, 71, 0.12);
  for (let i = 0; i < 9; i++) {
    const rise = (seconds * 0.17 + i / 9) % 1;
    const drift = Math.sin(seconds * (0.55 + i * 0.035) + i * 2.4) * 8;
    const x = player.x + (i % 3 - 1) * 20 + drift;
    const y = player.y + 17 - rise * 166;
    const spread = 1 + rise * 0.36;
    cloud(x, y, (23 + i % 3 * 4) * spread, (23 + i % 2 * 6) * spread,
      0.24 * (1 - rise * 0.48));
  }
  // Two curling streams make the vapor read at game scale without veiling the face.
  for (const side of [-1, 1]) {
    const drift = Math.sin(seconds * 0.8 + side) * 8;
    const x = player.x + side * 35 + drift;
    const bottom = player.y + 12;
    const top = player.y - 125;
    const fade = ctx.createLinearGradient(x, bottom, x, top);
    fade.addColorStop(0, 'rgba(232, 249, 253, 0)');
    fade.addColorStop(0.3, 'rgba(232, 249, 253, 0.16)');
    fade.addColorStop(0.7, 'rgba(232, 249, 253, 0.2)');
    fade.addColorStop(1, 'rgba(232, 249, 253, 0)');
    ctx.save();
    ctx.strokeStyle = fade;
    ctx.lineWidth = 7;
    ctx.shadowColor = 'rgba(232, 249, 253, 0.22)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.bezierCurveTo(x - side * 18, player.y - 30, x + side * 14,
      player.y - 82, x, top);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
