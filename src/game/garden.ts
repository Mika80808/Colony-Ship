/**
 * 玩家的菜圃（溫室 map.json 的 plots）：一格種一株，要自己播種、每天澆水、除蟲、採收。
 * 跟自動植栽區不同，這裡的狀態要存檔（自動植栽區純粹由時間推得）。
 *
 * 規則以「遊戲日」為單位結算：一天結束時，當天澆過水、沒有蟲的才長一天；
 * 連續三天沒澆水就枯掉。數字都是暫定，待實測。
 */
import { CYCLE_DAYS, Stage, STAGE_AT } from './growth';

export const GARDEN = {
  /** 連續幾天沒澆水會枯。 */
  dryLimit: 3,
  /** 每株每天長蟲的機率。 */
  pestChance: 0.08,
  /** 採收一株得幾個。 */
  yield: 3,
  /** 種子箱每天可以領幾包。 */
  seedsPerDay: 3,
  /** 「全部澆水」花幾分鐘。 */
  waterAllMinutes: 5,
} as const;

/** 菜圃作物的成熟天數：自動植栽區週期的十分之一，夾在 3 到 10 天。 */
export const growDays = (crop: string) => Math.min(10, Math.max(3, Math.round((CYCLE_DAYS[crop] ?? 40) / 10)));

export interface GardenCell {
  crop: string;
  /** 已經長了幾天（只算有澆水、沒蟲的日子）。 */
  growth: number;
  /** 最後一次澆水是哪一個遊戲日（整數日序）；沒澆過是 -1。 */
  watered: number;
  /** 連續幾天沒澆水。 */
  dry: number;
  pest: boolean;
  dead: boolean;
}
export interface GardenState {
  /** 已經結算到哪一個遊戲日（整數日序）。 */
  day: number;
  cells: (GardenCell | null)[];
  /** 種子箱：哪一天領的、那天領了幾包。 */
  seedDay: number;
  seedsTaken: number;
}

export const initialGarden = (day: number, cells: number): GardenState =>
  ({ day: Math.floor(day), cells: Array.from({ length: cells }, () => null), seedDay: -1, seedsTaken: 0 });

function roll(index: number, day: number): number {
  let h = 2166136261;
  for (const ch of `${index}:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

export const isRipe = (cell: GardenCell) => !cell.dead && cell.growth >= growDays(cell.crop);
export function stageOf(cell: GardenCell): Stage {
  const p = cell.growth / growDays(cell.crop);
  return p < STAGE_AT[0] ? 1 : p < STAGE_AT[1] ? 2 : 3;
}

/** 把菜圃結算到 `day`（含小數的日序）：每跨過一天結一次帳。時間不會倒退。 */
export function tickGarden(state: GardenState, day: number): GardenState {
  const today = Math.floor(day);
  if (today <= state.day) return state;
  let cells = state.cells;
  for (let d = state.day; d < today; d++) {
    cells = cells.map((cell, index) => {
      if (!cell || cell.dead) return cell;
      const wet = cell.watered === d, ripe = isRipe(cell);
      const growth = wet && !cell.pest && !ripe ? cell.growth + 1 : cell.growth;
      // 成熟的不會渴死，等人來採
      const dry = wet || ripe ? 0 : cell.dry + 1;
      if (dry >= GARDEN.dryLimit) return { ...cell, dry, dead: true, pest: false };
      const pest = cell.pest || (growth > 0 && growth < growDays(cell.crop) && roll(index, d + 1) < GARDEN.pestChance);
      return { ...cell, growth, dry, pest };
    });
  }
  return { ...state, day: today, cells };
}

const setCell = (state: GardenState, index: number, cell: GardenCell | null): GardenState =>
  ({ ...state, cells: state.cells.map((c, i) => (i === index ? cell : c)) });

/** 在空格播種。不是空格就不動。 */
export function plant(state: GardenState, index: number, crop: string): GardenState {
  if (index < 0 || index >= state.cells.length || state.cells[index]) return state;
  return setCell(state, index, { crop, growth: 0, watered: -1, dry: 0, pest: false, dead: false });
}

export const needsWater = (cell: GardenCell | null, day: number) => !!cell && !cell.dead && !isRipe(cell) && cell.watered !== Math.floor(day);

/** 澆一格，或不給 index 就全部澆。回傳澆了幾格。 */
export function water(state: GardenState, day: number, index?: number): { state: GardenState; count: number } {
  let count = 0;
  const cells = state.cells.map((cell, i) => {
    if ((index !== undefined && i !== index) || !needsWater(cell, day)) return cell;
    count++;
    return { ...cell!, watered: Math.floor(day) };
  });
  return { state: count ? { ...state, cells } : state, count };
}

/** 除蟲。 */
export function treat(state: GardenState, index: number): GardenState {
  const cell = state.cells[index];
  return cell?.pest ? setCell(state, index, { ...cell, pest: false }) : state;
}

/** 採收成熟的一株：回傳作物與數量，那一格清空。沒熟回 null。 */
export function harvest(state: GardenState, index: number): { state: GardenState; crop: string; count: number } | null {
  const cell = state.cells[index];
  return cell && isRipe(cell) ? { state: setCell(state, index, null), crop: cell.crop, count: GARDEN.yield } : null;
}

/** 剷掉一格（枯掉的，或不想種了）。 */
export const clearCell = (state: GardenState, index: number): GardenState => (state.cells[index] ? setCell(state, index, null) : state);

/** 今天種子箱還能領幾包。 */
export const seedsLeft = (state: GardenState, day: number) =>
  GARDEN.seedsPerDay - (state.seedDay === Math.floor(day) ? state.seedsTaken : 0);
export function takeSeed(state: GardenState, day: number): GardenState {
  if (seedsLeft(state, day) <= 0) return state;
  const today = Math.floor(day);
  return { ...state, seedDay: today, seedsTaken: (state.seedDay === today ? state.seedsTaken : 0) + 1 };
}

/** 一格的狀態說明，給菜圃視窗用。 */
export function cellStatus(cell: GardenCell | null, day: number): string {
  if (!cell) return '空地';
  if (cell.dead) return '枯掉了';
  if (isRipe(cell)) return '可以採收';
  const left = growDays(cell.crop) - cell.growth;
  const care = cell.pest ? '長了蚜蟲，除蟲前不會長' : needsWater(cell, day) ? '今天還沒澆水' : '今天澆過水了';
  return `約 ${left} 天後成熟・${care}`;
}
