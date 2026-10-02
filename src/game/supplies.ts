/**
 * 船上物資帳（使用者 2026-10-03 定案）：前端記錄全艦物資，整理成「充足／偏低／匱乏」交給主 GM 參考；
 * 規則寫得死，所以放前端，不經助手 AI。玩家只負責送貨。
 *
 * 流向：溫室自動收成 → 溫室出貨籃（待運，放太久會壞）→ 玩家拿起 → 送到中央公園的餐廳 → 船員每天吃掉。
 * 收成量依 growth.ts 的生長週期推得：每段種植每走完一個週期收成一次。其他設施（醫療用品、零件……）之後照同樣接法加類別。
 * 數字都是可調參數（暫定，待實測）。
 */
import type { RackSpec } from './racks';
import { CYCLE_DAYS, progress } from './growth';
import { rackKey } from './racks';

export type Category = 'veg' | 'staple' | 'fruit' | 'herb';
export const CATEGORY_NAMES: Record<Category, string> = { veg: '蔬菜', staple: '馬鈴薯', fruit: '水果', herb: '香草' };
const CATEGORIES = Object.keys(CATEGORY_NAMES) as Category[];
export type Stock = Record<Category, number>;
export type Place = 'greenhouse' | 'restaurant';
export const PLACE_NAMES: Record<Place, string> = { greenhouse: '溫室出貨籃', restaurant: '餐廳' };

export const CROP_CATEGORY: Record<string, Category> = {
  lettuce: 'veg', kale: 'veg', radish: 'veg', bell_pepper: 'veg', pea: 'veg', cherry_tomato: 'veg',
  potato: 'staple',
  strawberry: 'fruit', blueberry: 'fruit', pineapple: 'fruit', dwarf_lemon: 'fruit', grape: 'fruit', passion_fruit: 'fruit',
  basil: 'herb', mint: 'herb', rosemary: 'herb', perilla: 'herb', chives: 'herb', thyme: 'herb',
};
/** 一整排架子種同一種作物時，一次收成幾公斤；共用一排就依比例分。 */
const ROW_YIELD_KG: Record<Category, number> = { veg: 60, staple: 140, fruit: 50, herb: 8 };
/** 餐廳一天用掉多少新鮮蔬果：溫室平均日產量（蔬菜 9.1、馬鈴薯 2.0、水果 2.2、香草 0.22 公斤）的八成多，
 *  照常送貨就充足、一陣子沒人送就見底。穀物、蛋白質等主食來自物資區，不在這本帳裡。 */
export const DAILY_USE: Stock = { veg: 7.8, staple: 1.7, fruit: 1.8, herb: .19 };
/** 出貨籃每類最多放幾天份，多出來的壞掉（要比單次收成大：一排蔬菜一次收 60 公斤≈8 天份）。 */
const BASKET_CAP_DAYS = 14;
/** 玩家一趟推車最多載多少公斤。 */
export const CART_KG = 120;
/** 餐廳庫存可撐幾天算充足／偏低。 */
const PLENTY_DAYS = 3, LOW_DAYS = 1;

export interface SuppliesState { day: number; store: Record<Place, Stock>; carrying: Stock }

const zero = (): Stock => ({ veg: 0, staple: 0, fruit: 0, herb: 0 });
const scale = (s: Stock, f: number): Stock => Object.fromEntries(CATEGORIES.map(c => [c, s[c] * f])) as Stock;
export const totalKg = (s: Stock) => CATEGORIES.reduce((sum, c) => sum + s[c], 0);

/** 開局：餐廳有一週份（收成是一批一批來的，太少會在第一批收成前就見底），出貨籃空的。 */
export const initialSupplies = (day: number): SuppliesState => ({ day, store: { greenhouse: zero(), restaurant: scale(DAILY_USE, 7) }, carrying: zero() });

/** (dayA, dayB] 之間溫室各類收成幾公斤：每段種植走完幾次週期（相位與畫面上的生長一致）。 */
export function harvestBetween(racks: RackSpec[], dayA: number, dayB: number): Stock {
  const out = zero();
  if (!(dayB > dayA)) return out;
  for (const r of racks) for (const crop of r.crops) {
    const cat = CROP_CATEGORY[crop]; if (!cat) continue;
    const days = CYCLE_DAYS[crop] ?? 40, key = rackKey(r);
    const at = (d: number) => d / days + progress(crop, key, 0);                   // 與 growth.progress 同一條時間軸
    const cycles = Math.floor(at(dayB)) - Math.floor(at(dayA));
    out[cat] += cycles * ROW_YIELD_KG[cat] / r.crops.length;
  }
  return out;
}

/** 把帳推進到 day：收成進出貨籃（超過上限的壞掉）、餐廳依天數消耗。 */
export function tick(s: SuppliesState, racks: RackSpec[], day: number): SuppliesState {
  if (!(day > s.day)) return s;
  const got = harvestBetween(racks, s.day, day), days = day - s.day;
  const basket = zero(), restaurant = zero();
  for (const c of CATEGORIES) {
    basket[c] = Math.min(s.store.greenhouse[c] + got[c], DAILY_USE[c] * BASKET_CAP_DAYS);
    restaurant[c] = Math.max(0, s.store.restaurant[c] - DAILY_USE[c] * days);
  }
  return { day, store: { greenhouse: basket, restaurant }, carrying: s.carrying };
}

/** 從出貨籃裝推車，各類按比例裝到推車滿為止。回傳新狀態與這次裝了幾公斤。 */
export function pickUp(s: SuppliesState): { state: SuppliesState; kg: number } {
  const room = CART_KG - totalKg(s.carrying), available = totalKg(s.store.greenhouse);
  if (room <= 0 || available <= 0) return { state: s, kg: 0 };
  const f = Math.min(1, room / available), carrying = { ...s.carrying }, basket = { ...s.store.greenhouse };
  for (const c of CATEGORIES) { const take = basket[c] * f; carrying[c] += take; basket[c] -= take; }
  return { state: { ...s, store: { ...s.store, greenhouse: basket }, carrying }, kg: Math.round(available * f) };
}

/** 推車上的東西全部卸到某處。 */
export function deliver(s: SuppliesState, place: Place): { state: SuppliesState; kg: number } {
  const kg = Math.round(totalKg(s.carrying));
  if (!kg) return { state: s, kg: 0 };
  const into = { ...s.store[place] };
  for (const c of CATEGORIES) into[c] += s.carrying[c];
  return { state: { ...s, store: { ...s.store, [place]: into }, carrying: zero() }, kg };
}

export type Level = '充足' | '偏低' | '匱乏';
export function levelOf(stockKg: number, dailyKg: number): Level {
  const days = stockKg / dailyKg;
  return days >= PLENTY_DAYS ? '充足' : days >= LOW_DAYS ? '偏低' : '匱乏';
}

/** 給主 GM 的物資狀態（幾行文字）。只寫等級與可撐天數，不給精確公斤數，免得模型在對話裡報帳。 */
export function gmSupplyLines(s: SuppliesState): string[] {
  const r = s.store.restaurant;
  const lines = CATEGORIES.map(c => `- 餐廳${CATEGORY_NAMES[c]}：${levelOf(r[c], DAILY_USE[c])}（約可撐 ${Math.floor(r[c] / DAILY_USE[c] * 10) / 10} 天）`);
  const waiting = totalKg(s.store.greenhouse);
  if (waiting >= 20) lines.push(`- 溫室出貨籃堆了約 ${Math.round(waiting)} 公斤收成，等人送去餐廳`);
  if (totalKg(s.carrying) > 0) lines.push(`- 玩家正推著約 ${Math.round(totalKg(s.carrying))} 公斤蔬果，要送去中央公園的餐廳`);
  return lines;
}
