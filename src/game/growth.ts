/**
 * 自動植栽區的生長：完全由遊戲時間推得，不用存檔。
 * 每種作物一個週期（遊戲天數），依比例分成幼苗 → 生長中 → 可採收；週期結束時機器自動採收並補種，從幼苗重來。
 * 每一段種植（架子 + 作物）用自己的相位錯開，整間溫室隨時都看得到三種階段。
 */
export type Stage = 1 | 2 | 3;

/** 一個完整週期的遊戲天數（水耕加人工光照，比地球上快）。數字可直接調。 */
export const CYCLE_DAYS: Record<string, number> = {
  lettuce: 30, potato: 70, kale: 45, radish: 24, bell_pepper: 60, pea: 50,
  strawberry: 50, cherry_tomato: 55, blueberry: 80, pineapple: 120, dwarf_lemon: 120, grape: 100, passion_fruit: 90,
  basil: 35, mint: 30, rosemary: 60, perilla: 35, chives: 30, thyme: 45,
};
const DEFAULT_DAYS = 40;
/** 週期進度到哪裡換下一階段：前 35% 幼苗、35%–75% 生長中、之後可採收。 */
export const STAGE_AT = [.35, .75] as const;

const EPOCH = Date.UTC(2154, 0, 1);
/** 遊戲時間（'2154-10-24'、'08:45'）→ 從星曆 2154 年初起算的天數，含小數。 */
export function dayNumber(date: string, time: string): number {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  return (Date.UTC(y, mo - 1, d, h, mi) - EPOCH) / 86_400_000;
}

/** 字串 → [0,1) 的穩定亂數，當作每段種植的起始相位。 */
function phase(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
}

/** 某段種植在某個時間點的週期進度 [0,1)。`key` 分辨同一種作物的不同架子。 */
export function progress(crop: string, key: string, day: number): number {
  const days = CYCLE_DAYS[crop] ?? DEFAULT_DAYS, t = day / days + phase(`${key}:${crop}`);
  return t - Math.floor(t);
}

export function stageAt(crop: string, key: string, day: number): Stage {
  const p = progress(crop, key, day);
  return p < STAGE_AT[0] ? 1 : p < STAGE_AT[1] ? 2 : 3;
}
