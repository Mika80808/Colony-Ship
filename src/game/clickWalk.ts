import type { Point } from './corridor';

/**
 * 滑鼠點擊走路：點到走不到的地方（家具、牆、水面，或走得到但被隔開的角落），改走到離點擊處最近、而且走得到的點。
 * 從點擊處往外一圈一圈找（每圈間距 step），同一圈裡先試離角色近的；每個候選點都要真的找得到路才算。
 * 所有場景共用：各場景把自己的「這點能不能站」和「從角色走到這點的路」傳進來。
 *
 * route(to)    從角色現在的位置走到 to 的路徑，走不到回傳 []。
 * walkable(p)  p 能不能站（腳圈不碰到碰撞）。
 * from         角色現在的位置（同一圈裡的候選點照離角色的距離排）。
 * 回傳路徑；方圓 max 以內都走不到就回傳 []。
 */
export function pathToNearest(target: Point, from: Point, route: (to: Point) => Point[], walkable: (p: Point) => boolean,
  { step = 8, max = 480, tries = 30 } = {}): Point[] {
  const direct = walkable(target) ? route(target) : [];
  if (direct.length) return direct;
  // 找不到路的候選點附近通常也走不到（同一塊被隔開的地），不用每個都試
  const failed: Point[] = [], skip = step * 4;
  let attempts = 0;
  for (let r = step; r <= max; r += step) {
    const n = Math.max(8, Math.round(2 * Math.PI * r / step));
    const ring = Array.from({ length: n }, (_, i) => ({ x: target.x + r * Math.cos(2 * Math.PI * i / n), y: target.y + r * Math.sin(2 * Math.PI * i / n) }))
      .filter(walkable)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y));
    for (const c of ring) {
      if (failed.some(f => Math.hypot(f.x - c.x, f.y - c.y) < skip)) continue;
      const path = route(c);
      if (path.length) return path;
      failed.push(c);
      if (++attempts >= tries) return [];
    }
  }
  return [];
}
