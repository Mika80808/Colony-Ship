import type { ItemDefinition } from '../types';
import { CROP_NAMES } from '../game/growthReport';
import { CROP_CATEGORY, Category } from '../game/supplies';

/**
 * 系統自帶的物品：由遊戲系統產生、程式要認得 id 的東西（溫室收成，之後的種子、家具、商店貨品）。
 * 劇情用的物品（禮物、任務物品）在故事書的物品分頁建立，不寫在這裡。
 *
 * 這裡的定義永遠以程式碼為準：玩家背包裡留著的舊副本，讀取時會換成這裡的最新版
 * （game/inventory.ts 的 refreshDefinitions），改了圖示或效果不必處理舊存檔。
 *
 * 數字（價格、效果）都是暫定，待實測。
 */

/** 溫室收成物的 id：`crop-<作物>`，作物名與 growth.ts、crops.json 同一套。 */
export const cropItemId = (crop: string) => `crop-${crop}`;

/** 不必煮就能吃的作物。其餘（馬鈴薯、香草）當食材，本身沒有使用效果。 */
const EDIBLE_RAW = new Set([
  'lettuce', 'kale', 'radish', 'bell_pepper', 'pea', 'cherry_tomato',
  'strawberry', 'blueberry', 'pineapple', 'dwarf_lemon', 'grape', 'passion_fruit',
]);

const CROP_TEXT: Record<Category, { description: string; price: number; hunger: number }> = {
  veg: { description: '溫室採收的新鮮蔬菜，洗一洗就能吃。', price: 6, hunger: -4 },
  staple: { description: '溫室採收的馬鈴薯，要煮過才好吃。', price: 5, hunger: 0 },
  fruit: { description: '溫室採收的水果，站上少有的甜味。', price: 10, hunger: -6 },
  herb: { description: '溫室種的香草，料理提味用。', price: 4, hunger: 0 },
};

const CROP_ITEMS: ItemDefinition[] = Object.entries(CROP_NAMES).map(([crop, name]) => {
  const text = CROP_TEXT[CROP_CATEGORY[crop] ?? 'veg'];
  return {
    id: cropItemId(crop),
    name,
    category: '食材',
    effectText: '',
    description: text.description,
    // 還沒有專用的物品圖示，先用作物第三階段（可採收）的圖。
    icon: `/assets/greenhouse/crops/${crop}_3.webp`,
    price: text.price,
    ...(EDIBLE_RAW.has(crop) && text.hunger ? { effect: { hunger: text.hunger } } : {}),
  };
});

/** 種子的 id：`seed-<作物>`。玩家在溫室菜圃播種用（game/garden.ts）。 */
export const seedItemId = (crop: string) => `seed-${crop}`;
/** 種子 id → 作物；不是種子回 undefined。 */
export const cropOfSeed = (itemId: string): string | undefined => {
  const crop = itemId.startsWith('seed-') ? itemId.slice(5) : '';
  return crop in CROP_NAMES ? crop : undefined;
};

const SEED_ITEMS: ItemDefinition[] = Object.entries(CROP_NAMES).map(([crop, name]) => ({
  id: seedItemId(crop),
  name: `${name}種子`,
  category: '種子',
  effectText: '',
  description: `一包${name}的種子。到溫室的菜圃播種。`,
  // 道具欄裡作物只有兩種樣子：種子包裝、成熟型態（不出現幼苗、生長中）。
  // 還沒有專用的包裝圖，先把成熟作物印在程式畫的包裝上（InventoryDrawer 的種子包裝外框）。
  // 正式圖示的生圖任務：docs/tasks/2026-11-23-seed-packets.md。
  icon: `/assets/greenhouse/crops/${crop}_3.webp`,
  iconFrame: 'seed-packet',
  price: 3,
}));

/** 補給船的長期獎勵（game/freight.ts 的 REWARDS）。帶在身上就生效（game/clock.ts 的 TravelPerks）。 */
export const SCOOTER_ID = 'equip-scooter';
export const RAIL_PASS_ID = 'equip-rail-pass';
const REWARD_ITEMS: ItemDefinition[] = [
  { id: SCOOTER_ID, name: '滑板車', category: '裝備', effectText: '外環移動快一級', stackMax: 1,
    description: '物資官給的折疊滑板車，謝你幫忙搬補給。帶在身上，沿外環走半圈只要相鄰區域的時間。' },
  { id: RAIL_PASS_ID, name: '貨運輕軌通行證', category: '裝備', effectText: '跨環移動快兩級', stackMax: 1,
    description: '十字輻條貨運輕軌的搭乘權限。帶在身上，外環與中央公園之間只要相鄰區域的時間。' },
];

export const SYSTEM_ITEMS: ItemDefinition[] = [...CROP_ITEMS, ...SEED_ITEMS, ...REWARD_ITEMS];
