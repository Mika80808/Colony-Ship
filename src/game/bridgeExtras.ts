import type { Point } from './corridor';
import type { ExtraStanding, SceneApi, SceneExtras } from './sceneExtras';

/**
 * 艦橋專屬的演出，掛在設施場景上（地圖、碰撞、擺設在 public/assets/bridge-v3/map.json，由 tools/art/bridge_map.py 產生）。
 *   抵達：中央平台從井口升上來，角色站在平台上，平台到頂後走下來；演出中不能操作，可以略過；系統偏好減少動態時直接站到落點。
 *   值勤人員：三位坐著的值勤人員，角色靠近（或抵達演出到某個時間）時轉頭看角色。
 *   照明：控制台的燈條緩慢呼吸（減少動態時不閃）。
 *   投射特效掛載點：canvas.dataset.projection，角色還在平台上或演出中是 hidden，離開平台後是 ready。
 * 座標：素材座標（1254 × 1090）放大 1.5 倍就是世界 px；這裡的常數都是素材座標。
 */
export const BRIDGE_SCALE = 1.5;
export const BRIDGE_SPAWN: Point = { x: 627, y: 601 };     // 平台中心（演出開始時角色在井口下面）
export const BRIDGE_LANDING: Point = { x: 627, y: 807 };   // 演出結束站的位置
export const BRIDGE_ARRIVAL_END = 6.6;
const world = (p: Point): Point => ({ x: p.x * BRIDGE_SCALE, y: p.y * BRIDGE_SCALE });

/** 抵達演出第 time 秒：平台上升（0.35～3.15 秒），再走下平台（3.8～6.6 秒）。 */
export function bridgeArrival(time: number) {
  const smooth = (v: number) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
  const rise = smooth((time - .35) / 2.8), walk = smooth((time - 3.8) / 2.8);
  return { rise, offset: 220 * (1 - rise), position: { x: 627, y: 601 + 220 * (1 - rise) + 206 * walk }, walking: time > 3.8 && time < BRIDGE_ARRIVAL_END, underground: time < 3.15, done: time >= BRIDGE_ARRIVAL_END };
}

/** 角色在不在平台上（投射特效要等角色離開平台才出現）。 */
export const onPlatform = (p: Point) => Math.hypot((p.x - 627) / 115, (p.y - 601) / 96) < 1.15;

// 圖的裁切範圍（原圖不動）
const ART = {
  ring: { file: 'elevator-ring-v2.webp', bounds: [76, 72, 1179, 1107] },
  well: { file: 'elevator_well_clean.webp', bounds: [313, 354, 942, 894] },
  platform: { file: 'elevator_platform.webp', bounds: [290, 331, 965, 856] },
} as const;
/** 三位值勤人員：行走圖每個方向一格 [x, y, 寬, 高]（下、上、左、右）、座位、平常面向、演出中第幾秒轉頭。 */
export const BRIDGE_CREW = [
  { id: 'crew-command', at: { x: 627, y: 250 }, depth: 262, base: 'down', reaction: .35, frames: [[120, 54, 334, 629], [636, 54, 332, 629], [1182, 55, 363, 628], [1716, 54, 366, 629]] },
  { id: 'crew-navigation', at: { x: 195, y: 616 }, depth: 652, base: 'right', reaction: .7, frames: [[175, 84, 304, 594], [701, 81, 303, 597], [1194, 91, 319, 588], [1700, 80, 324, 599]] },
  { id: 'crew-comms', at: { x: 1059, y: 616 }, depth: 652, base: 'left', reaction: 1.05, frames: [[125, 43, 330, 638], [668, 42, 315, 639], [1197, 42, 330, 642], [1719, 42, 339, 642]] },
] as const;
const DIRECTIONS = ['down', 'up', 'left', 'right'] as const;

/** 值勤人員面向：平常照座位方向；角色靠近（演出中則到了 reaction 秒）就轉頭看角色。 */
export function crewFacing(crew: (typeof BRIDGE_CREW)[number], player: Point, arriving: boolean, arrival: number): (typeof DIRECTIONS)[number] {
  const attentive = arriving ? arrival >= crew.reaction : Math.hypot(player.x - crew.at.x, player.y - crew.at.y) < 180;
  if (!attentive) return crew.base;
  const dx = player.x - crew.at.x, dy = player.y - crew.at.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

export interface BridgeExtras extends SceneExtras { skip(): void; arriving(): boolean }

export function createBridgeExtras(options: { reducedMotion: () => boolean; onArrivingChange?: (arriving: boolean) => void }): BridgeExtras {
  let arrival = 0, arriving = true, ambient = 0;
  const images = new Map<string, HTMLImageElement>();
  const image = (file: string) => {
    let im = images.get(file);
    if (!im) { im = new Image(); im.src = `/assets/bridge-v3/${file}`; images.set(file, im); }
    return im.complete && im.naturalWidth ? im : undefined;
  };
  const finish = (api: SceneApi) => {
    arrival = BRIDGE_ARRIVAL_END; arriving = false;
    api.place(world(BRIDGE_LANDING), 'down');
    options.onArrivingChange?.(false);
  };
  const sprite = (ctx: CanvasRenderingContext2D, art: keyof typeof ART, x: number, y: number, w: number, h: number) => {
    const im = image(ART[art].file); if (!im) return;
    const [x0, y0, x1, y1] = ART[art].bounds;
    ctx.drawImage(im, x0, y0, x1 - x0, y1 - y0, x, y, w, h);
  };
  const ellipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
  const ring = (ctx: CanvasRenderingContext2D, front: boolean) => { ctx.save(); ctx.beginPath(); ctx.rect(0, front ? 601 : 0, 1254, front ? 489 : 601); ctx.clip(); sprite(ctx, 'ring', 462, 452, 330, 300); ctx.restore(); };

  return {
    arriving: () => arriving,
    skip: () => { if (arriving) arrival = BRIDGE_ARRIVAL_END; },
    locked: () => arriving,
    update(api, dt) {
      ambient += dt;
      if (arriving) {
        if (options.reducedMotion()) arrival = BRIDGE_ARRIVAL_END;
        else arrival += dt;
        const a = bridgeArrival(arrival);
        if (a.done) finish(api);
        else api.place(world(a.position), 'down');
      }
      const asset = { x: api.player.x / BRIDGE_SCALE, y: api.player.y / BRIDGE_SCALE };
      api.canvas.dataset.phase = arriving ? 'arriving' : 'ready';
      api.canvas.dataset.arrival = arrival.toFixed(3);
      api.canvas.dataset.projection = arriving || onPlatform(asset) ? 'hidden' : 'ready';
    },
    // 演出中：底圖上的靜止平台蓋掉，重畫井口、外環後半、還在下面的平台（角色站在上面）、外環前半
    drawGround(ctx, api) {
      if (!arriving) return;
      const a = bridgeArrival(arrival), offset = a.offset;
      ctx.save(); ctx.scale(BRIDGE_SCALE, BRIDGE_SCALE); ctx.imageSmoothingEnabled = false;
      ctx.save(); ellipse(ctx, 627, 601, 127, 106); ctx.clip(); ctx.fillStyle = '#07101e'; ctx.fill(); sprite(ctx, 'well', 499, 487, 256, 226); ctx.restore();
      ring(ctx, false);
      ctx.save(); ellipse(ctx, 627, 601, 119, 101); ctx.clip(); ctx.save(); ellipse(ctx, 627, 601 + offset, 119, 98); ctx.clip();
      sprite(ctx, 'platform', 508, 503 + offset, 238, 196);
      ctx.fillStyle = `rgba(1,9,20,${.62 * (1 - a.rise)})`; ctx.fillRect(506, 500 + offset, 242, 202);
      ctx.restore();
      if (a.underground) { ctx.save(); ctx.scale(1 / BRIDGE_SCALE, 1 / BRIDGE_SCALE); api.drawPlayer(false); ctx.restore(); }
      ctx.restore();
      ring(ctx, true);
      ctx.restore();
    },
    // 還在井口下面時，角色已經在 drawGround 裡畫過（被平台的橢圓裁掉）；走下平台時播走路動畫
    drawPlayer(_ctx, api, draw) {
      if (!arriving) { draw(); return; }
      const a = bridgeArrival(arrival);
      if (!a.underground) api.drawPlayer(a.walking);
    },
    standing(api) {
      const asset = { x: api.player.x / BRIDGE_SCALE, y: api.player.y / BRIDGE_SCALE };
      return BRIDGE_CREW.map((crew): ExtraStanding => {
        const col = DIRECTIONS.indexOf(crewFacing(crew, asset, arriving, arrival)), [fx, fy, fw, fh] = crew.frames[col];
        const h = 91, w = h * fw / fh, top = crew.at.y - h * .83;
        return {
          bottom: crew.depth * BRIDGE_SCALE,
          box: { left: (crew.at.x - w / 2) * BRIDGE_SCALE, top: top * BRIDGE_SCALE, right: (crew.at.x + w / 2) * BRIDGE_SCALE, bottom: (top + h * .83) * BRIDGE_SCALE },
          draw: ctx => {
            const im = image(`${crew.id}.webp`); if (!im) return;
            ctx.save(); ctx.scale(BRIDGE_SCALE, BRIDGE_SCALE); ctx.imageSmoothingEnabled = false;
            // 坐姿：上身照原比例，小腿壓短
            ctx.drawImage(im, fx, fy, fw, fh * .72, crew.at.x - w / 2, top, w, h * .72);
            ctx.drawImage(im, fx, fy + fh * .72, fw, fh * .28, crew.at.x - w / 2, top + h * .72, w, h * .11);
            ctx.restore();
          },
        };
      });
    },
    drawTop(ctx) {
      if (options.reducedMotion()) return;
      const pulse = .06 + .035 * Math.sin(ambient * .7);
      ctx.save(); ctx.scale(BRIDGE_SCALE, BRIDGE_SCALE); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(80,198,255,${pulse})`;
      ctx.fillRect(565, 271, 124, 16); ctx.fillRect(261, 550, 29, 105); ctx.fillRect(963, 550, 27, 105);
      ctx.restore();
    },
  };
}
