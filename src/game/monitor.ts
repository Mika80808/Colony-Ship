/**
 * 溫室植栽監測機：看自己這一翼的作物還要多久收成、健不健康。
 * 健康狀態目前是模擬的：每段種植每天擲一次，大多健康，偶爾缺水、葉片發黃或長蚜蟲；還沒有照顧的玩法，只是顯示。
 */
import type { RackSpec } from './racks';
import { GrowthRow, growthReport } from './growthReport';

export type Wing = 'left' | 'right';
export const WING_NAMES: Record<Wing, string> = { left: '左翼', right: '右翼' };
export type Health = '健康' | '缺水' | '葉片發黃' | '蚜蟲';
/** 出狀況的機率（每段種植每遊戲日）。 */
const TROUBLE_CHANCE = .12;
const TROUBLES: Health[] = ['缺水', '葉片發黃', '蚜蟲'];

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
}

/** 某段種植在某個遊戲日的健康狀態；同一天看幾次都一樣。 */
export function healthOf(crop: string, key: string, day: number): Health {
  const roll = hash(`${key}:${crop}:${Math.floor(day)}`);
  return roll < TROUBLE_CHANCE ? TROUBLES[Math.floor(roll / TROUBLE_CHANCE * TROUBLES.length)] : '健康';
}

export interface MonitorRow extends GrowthRow { health: Health }

/** 這一翼的每段種植：生長（與工作站同一份資料）加上健康。 */
export function monitorRows(racks: RackSpec[], day: number, mapWidth: number, wing: Wing): MonitorRow[] {
  return growthReport(racks, day, mapWidth)
    .filter(r => r.place.startsWith(WING_NAMES[wing]))
    .map(r => ({ ...r, health: healthOf(r.crop, r.key, day) }));
}
