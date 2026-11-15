/**
 * 玩家背包：一格一疊，同一種物品疊到上限就開新的一格。
 *
 * 這裡只有規則，不碰畫面與存檔：加、減、整理、使用效果的結算、目錄查詢。
 * 「規則寫得死」的部分都在這裡由前端算（骨架第十六節第 76 條的分工判準）；
 * GM 只負責說故事，以及用 add_item／consume_item 讓東西進出背包。
 */
import { ITEM_CATEGORIES, InventoryItem, ItemCategory, ItemDefinition, ItemEffect, PlayerStats } from '../types';
import { SYSTEM_ITEMS } from '../data/items';
import { normalizeForMatch } from './memory';

/** 背包格數。道具欄畫 5 × 4 格，改這裡兩邊一起變。 */
export const INVENTORY_SLOTS = 20;
/** 物品沒寫 stackMax 時，一格最多疊幾個。 */
export const DEFAULT_STACK = 99;

export const stackMaxOf = (def: Pick<ItemDefinition, 'stackMax'>): number => {
  const max = Math.floor(def.stackMax ?? DEFAULT_STACK);
  return max >= 1 ? max : DEFAULT_STACK;
};

/** 只留定義欄位。故事書條目身上還有 source、enabled 這類不該進背包的欄位。 */
export function toDefinition(def: ItemDefinition): ItemDefinition {
  const { id, name, category, effectText, description, icon, stackMax, price, effect } = def;
  return {
    id, name, category, effectText, description,
    ...(icon ? { icon } : {}),
    ...(stackMax ? { stackMax } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(effect ? { effect } : {}),
  };
}

// ------------------------------------------------------------------ 加、減、整理

/** 某種物品一共有幾個（跨格加總）。 */
export const countOf = (items: readonly InventoryItem[], id: string): number =>
  items.reduce((sum, item) => (item.id === id ? sum + item.count : sum), 0);

/** 這種物品還放得下幾個：既有那幾疊的空位，加上空格能開的新疊。 */
export function roomFor(items: readonly InventoryItem[], def: ItemDefinition, slots = INVENTORY_SLOTS): number {
  const max = stackMaxOf(def);
  const inStacks = items.reduce((sum, item) => (item.id === def.id ? sum + Math.max(0, max - item.count) : sum), 0);
  return inStacks + Math.max(0, slots - items.length) * max;
}

/**
 * 放進背包：先補滿既有的疊，再開新格。放不下的數量回報在 overflow，不會偷偷消失 ——
 * 呼叫端要告訴玩家「背包滿了」。什麼都沒放進去時回傳原本那個陣列。
 */
export function addItem(items: InventoryItem[], def: ItemDefinition, count = 1, slots = INVENTORY_SLOTS) {
  const wanted = Math.max(0, Math.floor(count)), max = stackMaxOf(def);
  let left = wanted;
  const next = items.map((item) => {
    if (item.id !== def.id || left <= 0 || item.count >= max) return item;
    const take = Math.min(left, max - item.count);
    left -= take;
    return { ...item, count: item.count + take };
  });
  while (left > 0 && next.length < slots) {
    const take = Math.min(left, max);
    next.push({ ...toDefinition(def), count: take });
    left -= take;
  }
  const added = wanted - left;
  return { items: added ? next : items, added, overflow: left };
}

/** 依物品 id 拿走幾個，從後面的格子拿起（前面的格子位置不動）。不夠就有多少拿多少。 */
export function removeItem(items: InventoryItem[], id: string, count = 1) {
  const wanted = Math.max(0, Math.floor(count));
  let left = wanted;
  const next = [...items];
  for (let index = next.length - 1; index >= 0 && left > 0; index--) {
    const item = next[index];
    if (item.id !== id) continue;
    const take = Math.min(left, item.count);
    left -= take;
    if (take === item.count) next.splice(index, 1);
    else next[index] = { ...item, count: item.count - take };
  }
  const removed = wanted - left;
  return { items: removed ? next : items, removed };
}

/** 從指定那一格拿走幾個（道具欄的使用、丟棄）。格子空了就移除。 */
export function removeAt(items: InventoryItem[], index: number, count = 1): InventoryItem[] {
  const item = items[index];
  if (!item || !(count > 0)) return items;
  return count >= item.count
    ? items.filter((_, i) => i !== index)
    : items.map((entry, i) => (i === index ? { ...entry, count: entry.count - count } : entry));
}

const categoryOrder = (category: ItemCategory) => {
  const index = ITEM_CATEGORIES.indexOf(category);
  return index < 0 ? ITEM_CATEGORIES.length : index;
};

/** 整理：同一種併在一起、重新分疊，再照分類與名稱排。格數只會變少不會變多。 */
export function sortItems(items: readonly InventoryItem[]): InventoryItem[] {
  const merged = new Map<string, InventoryItem>();
  for (const item of items) {
    const known = merged.get(item.id);
    merged.set(item.id, known ? { ...known, count: known.count + item.count } : item);
  }
  return [...merged.values()]
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category) || a.name.localeCompare(b.name, 'zh-Hant') || a.id.localeCompare(b.id))
    .flatMap((item) => {
      const max = stackMaxOf(item), stacks: InventoryItem[] = [];
      for (let left = item.count; left > 0; left -= max) stacks.push({ ...item, count: Math.min(left, max) });
      return stacks;
    });
}

/** 同一種合成一筆（依第一次出現的順序）。給 GM 看的背包用：GM 不需要知道分成幾格。 */
export function totalsById(items: readonly InventoryItem[]): InventoryItem[] {
  const merged = new Map<string, InventoryItem>();
  for (const item of items) {
    const known = merged.get(item.id);
    merged.set(item.id, known ? { ...known, count: known.count + item.count } : item);
  }
  return [...merged.values()];
}

// ------------------------------------------------------------------ 使用效果

const signed = (value: number) => `${value > 0 ? '+' : '−'}${Math.abs(value)}`;

/** 效果的白話說明，例如「體力 +10、飢餓 −6」。沒有效果回空字串。 */
export function describeEffect(effect: ItemEffect | undefined): string {
  if (!effect) return '';
  return [
    effect.stamina ? `體力 ${signed(effect.stamina)}` : '',
    effect.hunger ? `飢餓 ${signed(effect.hunger)}` : '',
    effect.addCondition ? `獲得狀態「${effect.addCondition}」` : '',
    effect.removeCondition ? `解除狀態「${effect.removeCondition}」` : '',
  ].filter(Boolean).join('、');
}

/** 顯示用的效果文字：有手寫的用手寫的，沒有就從 effect 產生。 */
export const effectLabel = (item: Pick<ItemDefinition, 'effectText' | 'effect'>): string =>
  item.effectText || describeEffect(item.effect);

/** 把效果套到玩家數值上，體力與飢餓夾在 0 到上限之間。 */
export function applyEffect(stats: PlayerStats, effect: ItemEffect): PlayerStats {
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
  let conditions = stats.conditions;
  if (effect.removeCondition) conditions = conditions.filter((condition) => condition !== effect.removeCondition);
  if (effect.addCondition && !conditions.includes(effect.addCondition)) conditions = [...conditions, effect.addCondition];
  return {
    ...stats,
    stamina: clamp(stats.stamina + (effect.stamina ?? 0), stats.maxStamina),
    hunger: clamp(stats.hunger + (effect.hunger ?? 0), stats.maxHunger),
    conditions,
  };
}

/** 現在用了會不會有任何變化。不餓的時候吃東西只是浪費，道具欄會擋下來。 */
export function effectChanges(stats: PlayerStats, effect: ItemEffect): boolean {
  const next = applyEffect(stats, effect);
  return next.stamina !== stats.stamina || next.hunger !== stats.hunger
    || next.conditions.join('\n') !== stats.conditions.join('\n');
}

// ------------------------------------------------------------------ 能做什麼

/** 家具與種子不走「使用」：之後由房間佈置、種植各自處理。 */
export const canUse = (item: ItemDefinition) => !!item.effect || (item.category !== '家具' && item.category !== '種子');
/** 任務物品不能當禮物送，也不能丟 —— 弄丟了任務就卡住。交件是劇情的事，由 GM 用 consume_item 收走。 */
export const canGift = (item: ItemDefinition) => item.category !== '任務物品';
export const canDrop = (item: ItemDefinition) => item.category !== '任務物品';

// ------------------------------------------------------------------ 目錄

type CatalogEntry = ItemDefinition & { enabled?: boolean };

/** 依 id 找定義：系統物品（data/items.ts）加上故事書的物品條目。 */
export function findItemById(id: string, storyItems: readonly CatalogEntry[]): ItemDefinition | undefined {
  return SYSTEM_ITEMS.find((item) => item.id === id) ?? storyItems.find((item) => item.id === id);
}

/**
 * 依名稱找定義，GM 的 add_item 用。比對前正規化（全半形、大小寫、空白與標點）。
 * 故事書裡啟用中的條目優先：那是作者自己寫的版本；停用的條目當作不存在。
 */
export function findItemByName(name: string, storyItems: readonly CatalogEntry[]): ItemDefinition | undefined {
  const key = normalizeForMatch(name);
  if (!key) return undefined;
  const same = (item: ItemDefinition) => normalizeForMatch(item.name) === key;
  return storyItems.find((item) => item.enabled !== false && same(item)) ?? SYSTEM_ITEMS.find(same);
}

/** 背包裡每一格換上目錄的最新定義（圖示、效果、說明改了，舊存檔不必處理）。目錄裡查不到的保留原樣。 */
export function refreshDefinitions(items: readonly InventoryItem[], storyItems: readonly CatalogEntry[]): InventoryItem[] {
  return items.map((item) => {
    const def = findItemById(item.id, storyItems);
    return def ? { ...toDefinition(def), count: item.count } : item;
  });
}

/** GM 給東西時的寫法（add_item 指令的內容）。 */
export interface ItemGrant { name: string; count?: number; description?: string; category?: ItemCategory }

/**
 * 把 GM 給的東西放進背包。目錄裡有同名的就用那一筆；沒有的當場做一筆最簡定義，
 * `created` 回報給呼叫端登記成故事書的本局條目（骨架：未登記的 ITEM 補一筆最簡條目）。
 * `makeId` 只在要新建時呼叫，新 id 必須帶本局前綴。
 */
export function grantItem(
  items: InventoryItem[], grant: ItemGrant, storyItems: readonly CatalogEntry[], makeId: () => string, slots = INVENTORY_SLOTS,
) {
  const known = findItemByName(grant.name, storyItems);
  const definition: ItemDefinition = known ? toDefinition(known) : {
    id: makeId(), name: grant.name.trim(), category: grant.category ?? '其他', effectText: '', description: grant.description?.trim() ?? '',
  };
  const result = addItem(items, definition, grant.count ?? 1, slots);
  // 一個都放不下的新物品不登記：背包裡沒有它，設定集多一筆沒人拿過的東西只是雜訊。
  return { ...result, definition, created: !known && result.added > 0 };
}
