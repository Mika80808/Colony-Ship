import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import type { InventoryItem, ItemDefinition, PlayerStats } from '../types';
import { ITEM_CATEGORIES } from '../types';
import { SYSTEM_ITEMS, cropItemId } from '../data/items';
import { CROP_NAMES } from './growthReport';
import {
  DEFAULT_STACK, INVENTORY_SLOTS, addItem, applyEffect, canDrop, canGift, canUse, countOf, describeEffect, effectChanges,
  effectLabel, findItemById, findItemByName, grantItem, refreshDefinitions, removeAt, removeItem, roomFor, sortItems,
  stackMaxOf, toDefinition, totalsById,
} from './inventory';

const def = (id: string, patch: Partial<ItemDefinition> = {}): ItemDefinition =>
  ({ id, name: id, category: '消耗品', effectText: '', description: '', ...patch });
const coffee = def('coffee', { name: '咖啡', stackMax: 5 });
const key = def('key', { name: '門禁卡', category: '任務物品', stackMax: 1 });

// --- 系統物品：每種作物都有一筆，圖示檔真的存在 ---
assert.equal(SYSTEM_ITEMS.filter((item) => item.id.startsWith('crop-') || item.id.startsWith('seed-')).length, Object.keys(CROP_NAMES).length * 2, 'a harvest and a seed per crop');
assert.equal(new Set(SYSTEM_ITEMS.map((item) => item.id)).size, SYSTEM_ITEMS.length, 'ids are unique');
for (const item of SYSTEM_ITEMS) {
  assert.ok(ITEM_CATEGORIES.includes(item.category), `${item.id} has a known category`);
  assert.ok(!item.icon || existsSync(`public${item.icon}`), `${item.id} icon exists (${item.icon})`);
}
// 道具欄裡作物只有兩種樣子：收成是成熟型態，種子是包裝（外框上印成熟作物）。不出現幼苗、生長中的圖。
for (const item of SYSTEM_ITEMS.filter((i) => i.id.startsWith('crop-') || i.id.startsWith('seed-'))) {
  assert.match(item.icon!, /_3\.webp$/, `${item.id} shows the ripe crop`);
  assert.equal(item.iconFrame, item.id.startsWith('seed-') ? 'seed-packet' : undefined, `${item.id} frame`);
}
const strawberry = findItemById(cropItemId('strawberry'), [])!;
assert.equal(strawberry.name, '草莓');
assert.ok(strawberry.effect!.hunger! < 0, 'fruit can be eaten raw');
assert.equal(findItemById(cropItemId('potato'), [])!.effect, undefined, 'potatoes need cooking');

// --- 放進背包：先補滿既有的疊，再開新格 ---
assert.equal(stackMaxOf(def('x')), DEFAULT_STACK);
assert.equal(stackMaxOf(def('x', { stackMax: 0 })), DEFAULT_STACK, 'a nonsense limit falls back to the default');
let bag: InventoryItem[] = [];
let result = addItem(bag, coffee, 3);
assert.deepEqual([result.added, result.overflow], [3, 0]);
assert.deepEqual(result.items.map((item) => item.count), [3]);
result = addItem(result.items, coffee, 4);
assert.deepEqual(result.items.map((item) => item.count), [5, 2], 'tops up the stack, then opens a new slot');
bag = result.items;
assert.equal(countOf(bag, 'coffee'), 7);
assert.equal(roomFor(bag, coffee, 3), 3 + 5, 'room in the open stack plus one empty slot');

// 放不下的回報 overflow，不會偷偷消失
result = addItem(bag, coffee, 20, 3);
assert.deepEqual([result.added, result.overflow], [8, 12]);
assert.deepEqual(result.items.map((item) => item.count), [5, 5, 5]);
const full = result.items;
assert.equal(addItem(full, key, 1, 3).items, full, 'nothing added returns the same array');
assert.equal(addItem(full, key, 1, 3).overflow, 1);
assert.equal(addItem(full, coffee, 0).items, full);

// 故事書條目身上的 source／enabled 不會進背包
const fromStory = addItem([], { ...coffee, source: 'builtin', enabled: true } as ItemDefinition, 1).items[0];
assert.deepEqual(Object.keys(fromStory).sort(), ['category', 'count', 'description', 'effectText', 'id', 'name', 'stackMax']);

// --- 拿走 ---
let removed = removeItem(bag, 'coffee', 3);
assert.deepEqual(removed.items.map((item) => item.count), [4], 'takes from the last slot first');
assert.equal(removed.removed, 3);
removed = removeItem(bag, 'coffee', 99);
assert.deepEqual([removed.items.length, removed.removed], [0, 7], 'takes what there is');
assert.equal(removeItem(bag, 'nope', 1).items, bag);
assert.deepEqual(removeAt(bag, 0, 2).map((item) => item.count), [3, 2]);
assert.deepEqual(removeAt(bag, 1, 2).map((item) => item.count), [5], 'an emptied slot goes away');
assert.equal(removeAt(bag, 9, 1), bag);

// --- 整理：併疊、照分類排，格數不會變多 ---
const messy: InventoryItem[] = [
  { ...key, count: 1 }, { ...coffee, count: 2 }, { ...strawberry, count: 4 }, { ...coffee, count: 4 }, { ...strawberry, count: 1 },
];
const tidy = sortItems(messy);
assert.deepEqual(tidy.map((item) => `${item.id}:${item.count}`), ['coffee:5', 'coffee:1', 'crop-strawberry:5', 'key:1']);
assert.ok(tidy.length <= messy.length);
assert.deepEqual(totalsById(messy).map((item) => `${item.id}:${item.count}`), ['key:1', 'coffee:6', 'crop-strawberry:5']);

// --- 使用效果 ---
const stats: PlayerStats = { stamina: 95, maxStamina: 100, hunger: 4, maxHunger: 100, credits: 10, conditions: ['宿醉'] };
assert.equal(describeEffect({ stamina: 10, hunger: -6 }), '體力 +10、飢餓 −6');
assert.equal(describeEffect(undefined), '');
assert.equal(effectLabel({ effectText: '手寫的說明', effect: { hunger: -6 } }), '手寫的說明');
assert.equal(effectLabel({ effectText: '', effect: { hunger: -6 } }), '飢餓 −6');
const after = applyEffect(stats, { stamina: 10, hunger: -6, removeCondition: '宿醉', addCondition: '精神好' });
assert.deepEqual([after.stamina, after.hunger, after.conditions], [100, 0, ['精神好']], 'clamped to 0…max');
assert.equal(after.credits, 10);
assert.equal(effectChanges(stats, { hunger: -6 }), true);
assert.equal(effectChanges({ ...stats, hunger: 0 }, { hunger: -6 }), false, 'eating when not hungry does nothing');
assert.equal(effectChanges({ ...stats, hunger: 0 }, { hunger: -6, removeCondition: '宿醉' }), true);

// --- 能做什麼 ---
assert.equal(canUse(def('chair', { category: '家具' })), false);
assert.equal(canUse(def('seed', { category: '種子' })), false);
assert.equal(canUse(key), true, 'quest items are used through the GM');
assert.deepEqual([canGift(key), canDrop(key)], [false, false]);
assert.deepEqual([canGift(coffee), canDrop(coffee)], [true, true]);

// --- 目錄：名稱比對正規化；故事書啟用中的條目優先，停用的不算 ---
assert.equal(findItemByName(' 草莓 ', [])!.id, cropItemId('strawberry'));
assert.equal(findItemByName('一盒草莓', []), undefined);
const authored = { ...def('items-1', { name: '草莓' }), enabled: true };
assert.equal(findItemByName('草莓', [authored])!.id, 'items-1');
assert.equal(findItemByName('草莓', [{ ...authored, enabled: false }])!.id, cropItemId('strawberry'));
assert.equal(findItemById('items-1', [authored])!.name, '草莓');

// 讀檔：背包裡的舊副本換成目錄的最新定義，查不到的保留
const stale: InventoryItem[] = [
  { id: cropItemId('strawberry'), name: '舊名字', category: '其他', effectText: '', description: '', count: 3 },
  { id: 'gone', name: '已刪除的東西', category: '其他', effectText: '', description: '', count: 1 },
];
const fresh = refreshDefinitions(stale, []);
assert.deepEqual({ ...toDefinition(strawberry), count: 3 }, fresh[0]);
assert.equal(fresh[1], stale[1]);

// --- GM 給東西 ---
let made = 0;
const makeId = () => `run-items-${++made}`;
let grant = grantItem([], { name: '草莓', count: 3 }, [], makeId);
assert.deepEqual([grant.created, grant.added, grant.items[0].id, made], [false, 3, cropItemId('strawberry'), 0], 'known items reuse the catalogue entry');
grant = grantItem([], { name: ' 舊照片 ', description: '邊角磨白了。', category: '禮物' }, [], makeId);
assert.deepEqual([grant.created, grant.definition.id, grant.definition.name, grant.definition.category, grant.items[0].count], [true, 'run-items-1', '舊照片', '禮物', 1]);
assert.equal(grantItem([], { name: '不知道是什麼' }, [], makeId).definition.category, '其他');
const packed = Array.from({ length: INVENTORY_SLOTS }, (_, i) => ({ ...def(`junk-${i}`, { stackMax: 1 }), count: 1 }));
grant = grantItem(packed, { name: '放不下的東西' }, [], makeId);
assert.deepEqual([grant.added, grant.overflow, grant.created], [0, 1, false], 'a full bag neither takes nor registers a new item');

console.log('inventory ok');
