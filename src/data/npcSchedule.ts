import { NPCData, NpcSchedule, ScheduleSlot } from '../types';

/**
 * NPC 日程查表、遊戲時鐘與位置重算。
 *
 * NPC 的位置不是每幀算的，存在覆寫的 location 欄位，只在兩個時機重算：
 * 1. 玩家切換場景時，全體依當下時間重算。
 * 2. 遊戲時間推進跨過檢查點時，重算一次；但會讓 NPC 進出玩家眼前的變動先壓著，
 *    等玩家切換場景時再套用 —— 否則人會在玩家面前憑空出現或消失。
 */

// ---------------------------------------------------------------- 查表

/** 時段是否涵蓋某個小時。start > end 為跨午夜；start === end 為整天。 */
export function slotCovers(slot: ScheduleSlot, hour: number): boolean {
  if (slot.start === slot.end) return true;
  return slot.start < slot.end ? hour >= slot.start && hour < slot.end : hour >= slot.start || hour < slot.end;
}

const locationIn = (group: NpcSchedule, hour: number) => group.slots.find((slot) => slotCovers(slot, hour))?.locationId;

/**
 * NPC 此刻所在的地點（區域 id 或房號）。沒有任何日程時回傳 null。
 *
 * 優先序：特殊事件 > 好感解鎖 > 值勤 > 保底；上層在這個小時沒有時段，就落到下一層。
 * - 特殊事件：還沒有觸發條件，一律不生效。
 * - 好感解鎖：好感 ≥ 門檻才生效；多組生效時由門檻高的先查，最高那組這小時沒安排才看下一組。
 * - 值勤：依日程裡的順序，第一組有安排的為準。
 * - 保底：涵蓋 24 小時，最後的退路。
 */
export function locateNpc(schedules: NpcSchedule[] | undefined, hour: number, affection: number): string | null {
  if (!schedules?.length) return null;
  const layers: NpcSchedule[] = [
    ...schedules
      .filter((group) => group.kind === 'affection' && Number.isInteger(group.affectionThreshold) && affection >= group.affectionThreshold!)
      .sort((a, b) => b.affectionThreshold! - a.affectionThreshold!),
    ...schedules.filter((group) => group.kind === 'duty'),
    ...schedules.filter((group) => group.kind === 'base'),
  ];
  for (const group of layers) {
    const location = locationIn(group, hour);
    if (location) return location;
  }
  return null;
}

// ---------------------------------------------------------------- 時鐘

/** 'HH:MM' 的小時。 */
export const hourOf = (time: string) => Number(time.slice(0, 2));

/** 檢查點：跨過這些時刻時，全體 NPC 重算位置。 */
export const CHECKPOINTS = ['01:00', '09:00', '18:00', '21:00'];
const CHECKPOINT_MINUTES = CHECKPOINTS.map((time) => hourOf(time) * 60 + Number(time.slice(3, 5)));

/** 遊戲日期與時刻換成分鐘數，方便跨日比較。 */
function toMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 60000 + hourOf(time) * 60 + Number(time.slice(3, 5));
}

function fromMinutes(total: number): { date: string; time: string } {
  const at = new Date(total * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`,
    time: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`,
  };
}

/** 推進若干分鐘後的日期與時刻。 */
export function addMinutes(date: string, time: string, minutes: number) {
  return fromMinutes(toMinutes(date, time) + minutes);
}

/**
 * 從「推進前」到「推進後」之間是否跨過檢查點：前者不含、後者含。
 * 看的是區間，不是等值 —— 從 08:50 推進到 09:10 也算跨過 09:00。
 */
export function crossesCheckpoint(from: { date: string; time: string }, to: { date: string; time: string }): boolean {
  const start = toMinutes(from.date, from.time), end = toMinutes(to.date, to.time);
  if (end <= start) return false;
  if (end - start >= 24 * 60) return true;
  const dayStart = Math.floor(start / 1440) * 1440;
  // 區間不到一天，最多跨兩個日曆日，兩天的檢查點都看一遍。
  return [dayStart, dayStart + 1440].some((day) =>
    CHECKPOINT_MINUTES.some((offset) => day + offset > start && day + offset <= end)
  );
}

// ---------------------------------------------------------------- 重算

/**
 * 依時間算出每位 NPC 的新位置。
 *
 * playerScene 有值時（檢查點重算）：會讓 NPC 離開或進入這個場景的變動先不套用，
 * 列在 deferred；玩家切換場景時會整體重算，自然就套用了。
 * playerScene 為 null 時（場景切換）：全部套用。
 * 沒有日程的 NPC 維持原位。
 */
export function planRelocation(npcs: NPCData[], hour: number, playerScene: string | null) {
  const apply: Record<string, string> = {};
  const deferred: string[] = [];
  for (const npc of npcs) {
    const next = locateNpc(npc.schedules, hour, npc.affection);
    if (!next || next === npc.location) continue;
    if (playerScene && (npc.location === playerScene || next === playerScene)) {
      deferred.push(npc.id);
      continue;
    }
    apply[npc.id] = next;
  }
  return { apply, deferred };
}

/** 玩家眼前的場景：進了房間是房號，否則是所在區域（居住區就是走廊）。 */
export const sceneOf = (sectorId: string, roomId: string | null) => roomId ?? sectorId;
