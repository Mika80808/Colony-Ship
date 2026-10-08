import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { CART_KG, CROP_CATEGORY, DAILY_USE, deliver, gmSupplyLines, harvestBetween, initialSupplies, levelOf, pickUp, tick, totalKg } from './supplies';
import { dayNumber, stageAt } from './growth';
import { rackKey } from './racks';

const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const racks = m.racks!;
for (const r of racks) for (const c of r.crops) assert.ok(CROP_CATEGORY[c], `${c} belongs to a supply category`);
const start = dayNumber('2090-10-24', '08:45');

// A planting is harvested exactly when its picture goes from ripe back to seedling.
const lettuce = racks.find(r => r.crops.includes('lettuce'))!;
let wraps = 0;
for (let d = start; d < start + 200; d += .25) if (stageAt('lettuce', rackKey(lettuce), d) === 3 && stageAt('lettuce', rackKey(lettuce), d + .25) === 1) wraps++;
const harvested = harvestBetween([{ ...lettuce, crops: ['lettuce'] }], start, start + 200).veg;
assert.ok(Math.abs(harvested / 60 - wraps) <= 1, `harvests match the growth cycle (${harvested / 60} vs ${wraps})`);
assert.equal(totalKg(harvestBetween(racks, start, start)), 0, 'no time, no harvest');

// Over a month the greenhouse grows food; nobody delivering means the restaurant runs dry and the basket fills up and spoils.
const s0 = initialSupplies(start);
assert.equal(levelOf(s0.store.restaurant.veg, DAILY_USE.veg), '充足');
const month = tick(s0, racks, start + 30);
assert.equal(month.store.restaurant.veg, 0);
assert.equal(levelOf(month.store.restaurant.veg, DAILY_USE.veg), '匱乏');
assert.ok(month.store.greenhouse.veg > 0 && month.store.greenhouse.veg <= DAILY_USE.veg * 14, 'basket is capped');
assert.equal(tick(month, racks, start + 10), month, 'time never runs backwards');
// Splitting the month into steps gives the same restaurant stock.
let stepped = s0;
for (let d = 1; d <= 30; d++) stepped = tick(stepped, racks, start + d);
assert.ok(Math.abs(stepped.store.restaurant.veg - month.store.restaurant.veg) < 1e-6);

// Pick up fills the cart up to its limit; delivering empties it into the restaurant.
const picked = pickUp(month);
assert.ok(picked.kg > 0 && totalKg(picked.state.carrying) <= CART_KG + 1e-6);
assert.ok(Math.abs(totalKg(picked.state.store.greenhouse) + totalKg(picked.state.carrying) - totalKg(month.store.greenhouse)) < 1e-6, 'nothing lost while loading');
const done = deliver(picked.state, 'restaurant');
assert.equal(done.kg, picked.kg); assert.equal(totalKg(done.state.carrying), 0);
assert.ok(totalKg(done.state.store.restaurant) > totalKg(month.store.restaurant));
assert.equal(deliver(done.state, 'restaurant').kg, 0, 'empty cart delivers nothing');

// The GM sees levels, a waiting basket and the cart — never raw kilograms per category.
const lines = gmSupplyLines(picked.state).join('\n');
assert.match(lines, /餐廳蔬菜：匱乏/); assert.match(lines, /玩家正推著/);
console.log('supplies ok');
