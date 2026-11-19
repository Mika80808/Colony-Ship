import type { Point } from './corridor';
import type { FacilityMap } from './facility';
import type { ExtraStanding, SceneApi, SceneExtras } from './sceneExtras';
import { drawShowerSpray, drawShowerSteam } from './showerSteam';

/**
 * 居住區房間專屬的演出，掛在設施場景上（地圖在 public/assets/rooms/<住戶>/map.json，由 tools/art/room_map.py 產生）。
 *   房門：點門或在門前按 E，走到門口後兩片門往兩側收進門框，畫面淡出，回到走廊。
 *   淋浴：站進蓮蓬頭下方就在洗澡：身體換成膚色（不畫制服）、噴水、水霧；淋浴間的玻璃在角色前面，有人在玻璃後面時變半透明。
 *   側邊沙發：坐在南側沙發時，靠近鏡頭的扶手蓋在角色前面，伸出扶手外的鞋子再畫回來。
 */

/** map.json 裡的淋浴間：圖的範圍（px）、原本的排序線、站進去就在洗澡的範圍。 */
export interface ShowerSpec { piece: [number, number, number, number]; depth: number; zone: [number, number, number, number] }
type RoomMap = FacilityMap & { shower?: ShowerSpec };

const SHOWER_PANEL = { x: 15, y: 75, width: 114, height: 119 };   // 淋浴間圖（144 × 210）裡玻璃的範圍
const FOOT_HALF_WIDTH = 28;
export const DOOR_OPEN_SECONDS = .7, DOOR_FADE_FROM = .85, DOOR_FADE_SECONDS = .4, DOOR_EXIT_AT = 1.25;
/** 房門（182 × 184）裡兩片門的範圍：去掉上面兩個斜角的六邊形。 */
const DOOR_OPENING: [number, number][] = [[57, 27], [124, 27], [152, 55], [152, 178], [29, 178], [29, 55]];

export const inZone = (p: Point, [x, y, w, h]: readonly number[]) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
/** 腳點在淋浴間玻璃後面（玻璃要變半透明）：在後半與玻璃的排序線之間、左右在玻璃範圍內。 */
export function behindShowerGlass(p: Point, shower: ShowerSpec) {
  const [x, y, w, h] = shower.piece, back = y + SHOWER_PANEL.y / 210 * h;
  return p.y > back && p.y < shower.depth + 1
    && p.x + FOOT_HALF_WIDTH > x + SHOWER_PANEL.x / 144 * w && p.x - FOOT_HALF_WIDTH < x + (SHOWER_PANEL.x + SHOWER_PANEL.width) / 144 * w;
}
/** 房門動畫第 t 秒：門開到哪（0～1）、畫面暗到哪、是否該離開了。 */
export function doorFrame(t: number) {
  const k = Math.min(1, t / DOOR_OPEN_SECONDS);
  return { open: k * k * (3 - 2 * k), fade: Math.max(0, Math.min(1, (t - DOOR_FADE_FROM) / DOOR_FADE_SECONDS)), done: t >= DOOR_EXIT_AT };
}

export interface RoomExtras extends SceneExtras { leave(): void }

export function createRoomExtras(options: { folder: string; onExit: () => void }): RoomExtras {
  let doorTime = 0, exited = false, seconds = 0;
  const images = new Map<string, HTMLImageElement>();
  const image = (src: string) => {
    let im = images.get(src);
    if (!im) { im = new Image(); im.src = src; images.set(src, im); }
    return im.complete && im.naturalWidth ? im : undefined;
  };
  const showerOf = (api: SceneApi) => (api.map as RoomMap).shower;
  const bathing = (api: SceneApi) => { const s = showerOf(api); return !!s && inZone(api.player, s.zone); };
  const piece = (api: SceneApi, id: string) => api.map.decor?.find(d => d.id === id);
  const rectOf = (api: SceneApi, id: string) => {
    const d = piece(api, id); if (!d?.size) return undefined;
    const T = api.map.tileSize, [w, h] = d.size;
    return { x: d.x * T - w / 2, y: d.y * T - h, width: w, height: h, sortY: (d.sortY ?? d.y) * T };
  };
  const box = (r: { x: number; y: number; width: number; height: number }) => ({ left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height });

  return {
    leave: () => { if (!doorTime) doorTime = .001; },
    locked: () => doorTime > 0,
    update(api, dt) {
      seconds += dt;
      if (doorTime > 0) {
        if (doorTime === .001) api.place(api.player, 'down');
        doorTime += dt;
        if (doorFrame(doorTime).done && !exited) { exited = true; options.onExit(); }
      }
      api.canvas.dataset.showering = String(bathing(api));
      api.canvas.dataset.doorProgress = doorTime.toFixed(3);
    },
    // 洗澡時身體換成膚色（臉和頭髮不動），不畫走路動畫
    drawPlayer(_ctx, api, draw) {
      if (!bathing(api)) { draw(); return; }
      api.drawPlayer(false, (frame, w, h) => {
        frame.globalCompositeOperation = 'source-atop';
        frame.fillStyle = 'rgba(246, 211, 180, 0.86)';
        const bodyTop = h * .49 - 2;
        frame.fillRect(0, bodyTop, w, h - bodyTop);
        frame.globalCompositeOperation = 'source-over';
      });
    },
    standing(api) {
      const out: ExtraStanding[] = [], shower = showerOf(api);
      if (shower) {
        const [x, y, w, h] = shower.piece, rect = { x, y, width: w, height: h }, back = y + SHOWER_PANEL.y / 210 * h, glassDepth = shower.depth + 1;
        if (bathing(api)) {
          out.push({ bottom: back + .01, box: box(rect), draw: ctx => drawShowerSpray(ctx, rect, seconds) });
          out.push({ bottom: glassDepth - .25, box: box(rect), draw: ctx => drawShowerSteam(ctx, rect, api.player, seconds) });
        }
        const glass = image('/assets/rooms/shell/cut/shower-glass.webp');
        if (glass) out.push({ bottom: glassDepth, box: box(rect), draw: ctx => {
          ctx.save(); ctx.globalAlpha = behindShowerGlass(api.player, shower) ? .3 : 1; ctx.drawImage(glass, x, y, w, h); ctx.restore();
        } });
      }
      // 房門打開：門框不動，兩片門往兩側收進去，後面是暗的
      const door = rectOf(api, 'room-door'), doorArt = image('/assets/rooms/shell/room-door.webp');
      if (door && doorArt && doorTime > 0) {
        const offset = 65 * doorFrame(doorTime).open;
        out.push({ bottom: door.sortY + .01, box: box(door), draw: ctx => {
          ctx.save(); ctx.translate(door.x, door.y); ctx.scale(door.width / 182, door.height / 184);
          ctx.beginPath(); DOOR_OPENING.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.clip();
          ctx.fillStyle = '#07121e'; ctx.fillRect(27, 26, 128, 154);
          const sx = doorArt.naturalWidth / 182, sy = doorArt.naturalHeight / 184;
          ctx.drawImage(doorArt, 27 * sx, 26 * sy, 64 * sx, 154 * sy, 27 - offset, 26, 64, 154);
          ctx.drawImage(doorArt, 91 * sx, 26 * sy, 64 * sx, 154 * sy, 91 + offset, 26, 64, 154);
          ctx.restore();
        } });
      }
      // 坐在南側沙發：近側扶手蓋在角色前面，伸出扶手外的鞋子再畫回來
      const sofa = api.seatedOn === 'seat-sofa-south' ? rectOf(api, 'sofa-south') : undefined, sofaArt = image(`/assets/${options.folder}/props/sofa-south.webp`);
      if (sofa && sofaArt) out.push({ bottom: sofa.sortY + .6, box: box(sofa), draw: ctx => {
        ctx.save(); ctx.beginPath(); ctx.rect(sofa.x + sofa.width * .08, sofa.y + sofa.height * .51, sofa.width * .76, sofa.height * .49); ctx.clip();
        ctx.drawImage(sofaArt, sofa.x, sofa.y, sofa.width, sofa.height); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(sofa.x - 30, sofa.y + sofa.height * .51, sofa.width * .38 + 30, sofa.height * .49); ctx.clip();
        api.drawPlayer(); ctx.restore();
      } });
      return out;
    },
    // 出門：門開了之後畫面淡出
    drawTop(ctx, api) {
      const fade = doorTime > 0 ? doorFrame(doorTime).fade : 0;
      if (fade > 0) { ctx.fillStyle = `rgba(3, 8, 16, ${fade})`; ctx.fillRect(api.camera.x, api.camera.y, api.view.width, api.view.height); }
    },
  };
}
