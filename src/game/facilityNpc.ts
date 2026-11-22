import type { Point } from './corridor';
import { findPath, move, segmentClear, spawn, walkable, type Facing, type FacilityMap } from './facility';

/**
 * 設施場景裡的 NPC（房間裡的路西恩這類）：在 map.json 的 patrol 停靠點之間巡遊，
 * 玩家走到能交談的距離就停下來；碰撞、尋路跟玩家同一套（facility.ts）。
 */
export interface FacilityNpc { id: string; position: Point; direction: Facing; path: Point[]; idle: number; stop: number; moving: boolean; elapsed: number }

/** 交談距離（px，腳點到腳點），跟房間原本一樣。 */
export const TALK_DISTANCE = 115;
export const NPC_SPEED = 100;
/** 走到一個停靠點後停多久再走下一個（秒）。 */
export const NPC_PAUSE = 1.4;

/** 第 index 個 NPC 的起點：patrol 的停靠點輪流分配；沒有 patrol 就站在第一個出入口；站不下就往外找最近的空地。 */
export function npcStart(m: FacilityMap, index: number): Point {
  const stops = m.patrol ?? [];
  const wanted = stops.length ? { x: stops[index % stops.length][0] * m.tileSize, y: stops[index % stops.length][1] * m.tileSize } : spawn(m);
  if (walkable(m, wanted)) return wanted;
  for (let r = 12; r <= 6 * m.tileSize; r += 12)
    for (let a = 0; a < 360; a += 20) {
      const p = { x: wanted.x + r * Math.cos(a * Math.PI / 180), y: wanted.y + r * Math.sin(a * Math.PI / 180) };
      if (walkable(m, p)) return p;
    }
  return wanted;
}

export function createNpc(m: FacilityMap, id: string, index: number): FacilityNpc {
  const stops = m.patrol?.length ?? 0;
  return { id, position: npcStart(m, index), direction: 'down', path: [], idle: .8, stop: stops ? (index + 1) % stops : 0, moving: false, elapsed: 0 };
}

/** 玩家能跟這個 NPC 說話：夠近，而且中間沒有牆或家具隔著。 */
export const canTalk = (m: FacilityMap, player: Point, npc: FacilityNpc) =>
  Math.hypot(npc.position.x - player.x, npc.position.y - player.y) <= TALK_DISTANCE && segmentClear(m, player, npc.position);

const facing = (dx: number, dy: number): Facing => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');

/** 前進一幀：玩家在交談距離內就停下；否則照路徑走，走完停一下再去下一個停靠點。 */
export function stepNpc(m: FacilityMap, npc: FacilityNpc, dt: number, player: Point) {
  npc.moving = false;
  if (canTalk(m, player, npc)) { npc.elapsed = 0; return; }
  const stops = m.patrol ?? [];
  if (!npc.path.length && stops.length) {
    npc.idle -= dt;
    if (npc.idle <= 0) {
      const [x, y] = stops[npc.stop];
      npc.path = findPath(m, npc.position, { x: x * m.tileSize, y: y * m.tileSize });
      npc.stop = (npc.stop + 1) % stops.length; npc.idle = NPC_PAUSE;
    }
  }
  let remaining = NPC_SPEED * dt;
  while (npc.path.length && remaining > 0) {
    const next = npc.path[0], dx = next.x - npc.position.x, dy = next.y - npc.position.y, distance = Math.hypot(dx, dy);
    if (distance < .5) { npc.path.shift(); continue; }
    npc.direction = facing(dx, dy);
    const step = Math.min(distance, remaining), moved = move(m, npc.position, dx / distance * step, dy / distance * step);
    if (Math.hypot(moved.x - npc.position.x, moved.y - npc.position.y) < .01) { npc.path = []; break; }   // 被擋住：放棄這段路
    npc.position = moved; npc.moving = true; remaining -= step;
  }
  npc.elapsed = npc.moving ? npc.elapsed + dt : 0;
}
