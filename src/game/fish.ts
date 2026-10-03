/**
 * 水底下的魚影：灰色半透明剪影，在水面遮罩（public/assets/<folder>/water.webp，由 tools/art/facility_ground.py 產生）
 * 裡慢慢游、轉彎、偶爾停下來。遮罩白色＝魚中心可以到的地方，已扣掉岸邊與玻璃走廊底下。
 * 只有畫面效果，不存檔、不影響碰撞；同一個種子每次的初始位置都一樣。
 */
export interface WaterMask { width: number; height: number; scale: number; water: Uint8Array }
export interface Fish { x: number; y: number; heading: number; turn: number; turnVelocity: number; speed: number; cruise: number; length: number; phase: number; rest: number; seed: number }

/** 魚影長度（px）的範圍；遊戲一格 96 px、角色高 148 px。 */
const LENGTH = [34, 58] as const;
const CRUISE = [18, 34] as const;     // 游速 px/s
const LOOK = .9;                      // 往前看幾個魚身長，前面不是水就轉彎

export const inWater = (m: WaterMask, x: number, y: number) => {
  const cx = Math.floor(x / m.scale), cy = Math.floor(y / m.scale);
  return cx >= 0 && cy >= 0 && cx < m.width && cy < m.height && m.water[cy * m.width + cx] > 0;
};

/** mulberry32：小而穩定的亂數，給魚的初始位置與個性用。 */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32; };
}

/** 在遮罩裡隨機放 count 條魚。 */
export function spawnFish(m: WaterMask, count: number, seed = 1): Fish[] {
  const r = rng(seed), cells: number[] = [];
  m.water.forEach((v, i) => { if (v) cells.push(i); });
  if (!cells.length) return [];
  return Array.from({ length: count }, (_, i) => {
    const c = cells[Math.floor(r() * cells.length)];
    const cruise = CRUISE[0] + r() * (CRUISE[1] - CRUISE[0]);
    return { x: (c % m.width + .5) * m.scale, y: (Math.floor(c / m.width) + .5) * m.scale, heading: r() * Math.PI * 2, turn: 0, turnVelocity: 0,
      speed: cruise, cruise, length: LENGTH[0] + r() * (LENGTH[1] - LENGTH[0]), phase: r() * 10, rest: 0, seed: seed * 97 + i };
  });
}

/** 往前一步：慢慢改變方向；前方不是水就轉向有水的那邊；偶爾停下來漂一會兒。 */
export function stepFish(f: Fish, dt: number, m: WaterMask, r: () => number) {
  f.rest = Math.max(0, f.rest - dt);
  if (!f.rest && r() < dt * .055) f.rest = .8 + r() * 1.8;
  if (r() < dt * .35) f.turn = (r() - .5) * .75;
  const ahead = (h: number) => inWater(m, f.x + Math.cos(h) * f.length * LOOK, f.y + Math.sin(h) * f.length * LOOK);
  let steering = f.turn;
  if (!ahead(f.heading)) {                                                         // 快撞岸了：找最近的一個有水的方向轉過去
    for (let k = 1; k <= 12; k++) {
      const d = k * Math.PI / 12, side = f.turn >= 0 ? 1 : -1;
      if (ahead(f.heading + side * d)) { steering = side * 2.1; break; }
      if (ahead(f.heading - side * d)) { steering = -side * 2.1; break; }
    }
  }
  f.turnVelocity += (steering - f.turnVelocity) * Math.min(1, dt * 3.5);
  f.heading += f.turnVelocity * dt;
  const targetSpeed = f.cruise * (f.rest ? .35 : 1) * (ahead(f.heading) ? 1 : .58) * (1 + .1 * Math.sin(f.phase * .5 + f.seed));
  f.speed += (targetSpeed - f.speed) * Math.min(1, dt * 2.4);
  const nx = f.x + Math.cos(f.heading) * f.speed * dt, ny = f.y + Math.sin(f.heading) * f.speed * dt;
  if (inWater(m, nx, ny)) { f.x = nx; f.y = ny; }
  else { f.turnVelocity = (f.turnVelocity >= 0 ? 1 : -1) * 2.1; f.heading += f.turnVelocity * dt; f.speed *= .92; }
  f.phase += dt * (2.4 + f.speed / 9);
}

/** 魚影：身體一個橢圓、尾鰭一個扇形、兩片小胸鰭，身體與尾巴隨 phase 左右擺。
 *  全部加進同一條路徑、只 fill 一次，半透明疊在一起的地方才不會變深。 */
export function drawFish(ctx: CanvasRenderingContext2D, f: Fish) {
  const L = f.length, W = L * .3, swing = Math.sin(f.phase) * (.13 + f.speed / 260);
  const ellipse = (cx: number, cy: number, rx: number, ry: number, rot: number) => {
    ctx.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot));                  // 新的子路徑，不跟前一段連線
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  };
  ctx.save();
  ctx.translate(f.x, f.y); ctx.rotate(f.heading);
  ctx.beginPath();
  ellipse(0, 0, L * .42, W / 2, swing * .25);                                           // 身體
  for (const s of [-1, 1]) ellipse(L * .1, s * W * .5, L * .1, W * .16, s * .7 + swing * .3);   // 胸鰭
  ctx.translate(-L * .36, 0); ctx.rotate(swing);                                         // 尾鰭（路徑點在加入時就換算好座標）
  ctx.moveTo(0, 0); ctx.lineTo(-L * .3, -W * .55); ctx.quadraticCurveTo(-L * .22, 0, -L * .3, W * .55); ctx.closePath();
  ctx.fillStyle = 'rgba(28, 40, 48, .32)';
  ctx.fill();
  ctx.restore();
}
