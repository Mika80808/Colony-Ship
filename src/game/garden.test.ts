import assert from 'node:assert/strict';
import { GARDEN, cellStatus, clearCell, growDays, harvest, initialGarden, isRipe, needsWater, plant, seedsLeft, stageOf, takeSeed, tickGarden, treat, water } from './garden';
import { SYSTEM_ITEMS, cropItemId, cropOfSeed, seedItemId } from '../data/items';
import { CROP_NAMES } from './growthReport';

assert.equal(growDays('lettuce'), 3); assert.equal(growDays('potato'), 7); assert.equal(growDays('pineapple'), 10);

// 每種作物都有種子和收成兩種物品
for (const crop of Object.keys(CROP_NAMES)) {
  assert.ok(SYSTEM_ITEMS.some(i => i.id === seedItemId(crop) && i.category === '種子'), `${crop} seed`);
  assert.ok(SYSTEM_ITEMS.some(i => i.id === cropItemId(crop)));
  assert.equal(cropOfSeed(seedItemId(crop)), crop);
}
assert.equal(cropOfSeed('crop-lettuce'), undefined);

const day0 = 300.4;
let g = initialGarden(day0, 24);
assert.equal(g.cells.length, 24);
g = plant(g, 0, 'lettuce');
assert.equal(plant(g, 0, 'potato'), g, 'an occupied cell stays as it is');
assert.equal(plant(g, 99, 'potato'), g);
assert.ok(needsWater(g.cells[0], day0));

// 每天澆水：三天後成熟
for (let d = 0; d < 3; d++) {
  const w = water(g, day0 + d, 0); assert.equal(w.count, 1); g = w.state;
  assert.equal(water(g, day0 + d, 0).count, 0, 'once a day is enough');
  g = { ...tickGarden(g, day0 + d + 1), cells: tickGarden(g, day0 + d + 1).cells.map(c => c && { ...c, pest: false }) };
}
assert.ok(isRipe(g.cells[0]!)); assert.equal(stageOf(g.cells[0]!), 3);
assert.equal(cellStatus(g.cells[0], day0 + 3), '可以採收');
// 成熟後放著不會枯
assert.ok(isRipe(tickGarden(g, day0 + 20).cells[0]!));
const got = harvest(g, 0)!;
assert.deepEqual([got.crop, got.count, got.state.cells[0]], ['lettuce', GARDEN.yield, null]);
assert.equal(harvest(got.state, 0), null);

// 沒澆水不會長；連續三天沒澆就枯，枯了要剷掉
let dry = plant(initialGarden(day0, 4), 1, 'potato');
dry = tickGarden(dry, day0 + 2);
assert.deepEqual([dry.cells[1]!.growth, dry.cells[1]!.dry, dry.cells[1]!.dead], [0, 2, false]);
dry = tickGarden(dry, day0 + 3);
assert.ok(dry.cells[1]!.dead); assert.equal(cellStatus(dry.cells[1], day0 + 3), '枯掉了');
assert.equal(water(dry, day0 + 3).count, 0);
assert.equal(clearCell(dry, 1).cells[1], null);
assert.equal(tickGarden(dry, day0), dry, 'time never runs backwards');

// 一次跳好幾天跟一天一天算結果一樣
let a = plant(initialGarden(day0, 4), 0, 'kale'), b = a;
a = water(a, day0).state; b = water(b, day0).state;
a = tickGarden(a, day0 + 5);
for (let d = 1; d <= 5; d++) b = tickGarden(b, day0 + d);
assert.deepEqual(a, b);

// 長蟲的那天不長，除蟲後恢復
let bug = plant(initialGarden(day0, 1), 0, 'potato');
bug = { ...bug, cells: [{ ...bug.cells[0]!, growth: 2, pest: true }] };
bug = tickGarden(water(bug, day0).state, day0 + 1);
assert.equal(bug.cells[0]!.growth, 2);
assert.match(cellStatus(bug.cells[0], day0 + 1), /蚜蟲/);
bug = treat(bug, 0); assert.equal(bug.cells[0]!.pest, false);

// 全部澆水
let many = initialGarden(day0, 6);
for (const i of [0, 2, 5]) many = plant(many, i, 'mint');
assert.equal(water(many, day0).count, 3);

// 種子箱：一天三包，隔天重算
let box = initialGarden(day0, 1);
assert.equal(seedsLeft(box, day0), 3);
for (let i = 0; i < 3; i++) box = takeSeed(box, day0);
assert.equal(seedsLeft(box, day0), 0); assert.equal(takeSeed(box, day0), box);
assert.equal(seedsLeft(box, day0 + 1), 3);

console.log('garden ok');
