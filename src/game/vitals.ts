/**
 * 玩家數值的自然變化（骨架第十一節）：規則寫得死，由前端算，GM 只管事件性的增減。
 * - 飢餓隨時間上升；體力隨時間與步數下降，很餓的時候掉得更快。
 * - 一次推進很長的時間（睡覺、長休息）不掉體力，反而回復。
 * - 體力歸零：前端送醫療室、扣醫療費、過八小時；敘事交給 GM。
 * - 好感：對同一人一天最多加減 10，超出丟棄，日界線是遊戲時間 00:00。
 * 數字都是暫定，待實測。
 */
import type { PlayerStats } from '../types';

export const VITALS = {
  /** 每小時飢餓上升多少（約一天多從 0 到 100，一天吃三餐剛好）。 */
  hungerPerHour: 4,
  /** 醒著每小時掉多少體力。 */
  staminaPerHour: 2,
  /** 每走一步（一格）另外掉多少體力；連續走一小時約 960 步。 */
  staminaPerStep: 0.006,
  /** 飢餓到這個值以上，體力消耗加倍。 */
  hungryAt: 80,
  hungryFactor: 2,
  /** 一次推進這麼多分鐘以上算睡覺／長休息。 */
  restFromMinutes: 240,
  /** 休息時每小時回多少體力（八小時回滿）。 */
  restStaminaPerHour: 12,
  /** 休息時飢餓上升的倍率。 */
  restHungerFactor: 0.5,
  /** 昏倒：醫療費（固定）、昏迷幾小時、醒來時的體力。 */
  medicalFee: 50,
  collapseHours: 8,
  wakeStamina: 60,
  /** 對同一位 NPC 單日好感增減上限。 */
  affectionDailyCap: 10,
} as const;

export type WearMode = 'active' | 'rest';
/** 還沒湊滿整數的零頭。數值是整數，零頭留著下次加。 */
export interface VitalsCarry { stamina: number; hunger: number }
export const emptyCarry = (): VitalsCarry => ({ stamina: 0, hunger: 0 });

/** 取出整數部分，零頭留下。 */
function settle(value: number): [whole: number, rest: number] {
  const whole = Math.trunc(value + (value >= 0 ? 1e-9 : -1e-9));
  return [whole, value - whole];
}

/**
 * 經過一段時間／走了幾步之後，體力與飢餓該變多少（整數），以及剩下的零頭。
 * `hungry` 是玩家此刻是否已經很餓。
 */
export function wear(carry: VitalsCarry, minutes: number, steps: number, mode: WearMode, hungry: boolean) {
  const hours = Math.max(0, minutes) / 60;
  const staminaChange = mode === 'rest'
    ? hours * VITALS.restStaminaPerHour
    : -(hours * VITALS.staminaPerHour + Math.max(0, steps) * VITALS.staminaPerStep) * (hungry ? VITALS.hungryFactor : 1);
  const hungerChange = hours * VITALS.hungerPerHour * (mode === 'rest' ? VITALS.restHungerFactor : 1);
  const [stamina, staminaRest] = settle(carry.stamina + staminaChange);
  const [hunger, hungerRest] = settle(carry.hunger + hungerChange);
  return { stamina, hunger, carry: { stamina: staminaRest, hunger: hungerRest } };
}

export const isHungry = (stats: PlayerStats) => stats.hunger >= VITALS.hungryAt;
export const wearMode = (minutes: number): WearMode => (minutes >= VITALS.restFromMinutes ? 'rest' : 'active');

/** 把增減套到數值上，夾在 0 到上限之間。 */
export function applyWear(stats: PlayerStats, change: { stamina: number; hunger: number }): PlayerStats {
  if (!change.stamina && !change.hunger) return stats;
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  return { ...stats, stamina: clamp(stats.stamina + change.stamina, stats.maxStamina), hunger: clamp(stats.hunger + change.hunger, stats.maxHunger) };
}

/** 昏倒後醒來的數值：扣醫療費（不夠就扣到 0）、體力回到一半多、餓了八小時（休息倍率）。 */
/** `feeFactor`：醫療室藥品短缺時醫療費加倍（game/freight.ts 的 medicalFeeFactor）。 */
export function afterCollapse(stats: PlayerStats, feeFactor = 1): { stats: PlayerStats; fee: number } {
  const fee = Math.min(stats.credits, Math.round(VITALS.medicalFee * feeFactor));
  const hunger = Math.round(VITALS.collapseHours * VITALS.hungerPerHour * VITALS.restHungerFactor);
  return {
    fee,
    stats: { ...stats, stamina: Math.min(stats.maxStamina, VITALS.wakeStamina), hunger: Math.min(stats.maxHunger, stats.hunger + hunger), credits: stats.credits - fee },
  };
}

// ------------------------------------------------------------------ 好感單日上限

/** 當天對每位 NPC 已經累計增減了多少。換日就整份作廢。 */
export interface AffectionTally { date: string; byNpc: Record<string, number> }
export const emptyTally = (date: string): AffectionTally => ({ date, byNpc: {} });

/**
 * 把這次的好感增減夾進當日額度（累計淨值在 −10 到 +10 之間），超出的丟棄。
 * 回傳實際生效的量與更新後的帳。
 */
export function capAffection(tally: AffectionTally | undefined, date: string, npcId: string, amount: number) {
  const today = tally && tally.date === date ? tally : emptyTally(date);
  const used = today.byNpc[npcId] ?? 0, cap = VITALS.affectionDailyCap;
  const total = Math.min(cap, Math.max(-cap, used + amount));
  return { amount: total - used, tally: { date, byNpc: { ...today.byNpc, [npcId]: total } } };
}
