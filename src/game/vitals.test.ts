import assert from 'node:assert/strict';
import type { PlayerStats } from '../types';
import { VITALS, afterCollapse, applyWear, capAffection, emptyCarry, isHungry, wear, wearMode } from './vitals';

const stats: PlayerStats = { stamina: 85, maxStamina: 100, hunger: 20, maxHunger: 100, credits: 450, conditions: [] };

// 站著一小時：餓一點、累一點
let r = wear(emptyCarry(), 60, 0, 'active', false);
assert.deepEqual([r.stamina, r.hunger], [-VITALS.staminaPerHour, VITALS.hungerPerHour]);

// 零頭會累積：一分鐘一分鐘加，跟一次加一小時一樣
let carry = emptyCarry(), stamina = 0, hunger = 0;
for (let i = 0; i < 60; i++) { r = wear(carry, 1, 0, 'active', false); carry = r.carry; stamina += r.stamina; hunger += r.hunger; }
assert.deepEqual([stamina, hunger], [-VITALS.staminaPerHour, VITALS.hungerPerHour]);

// 走路另外耗體力；很餓時加倍
const walking = wear(emptyCarry(), 60, 960, 'active', false).stamina;
assert.ok(walking < -VITALS.staminaPerHour, 'walking costs more than standing');
assert.equal(wear(emptyCarry(), 60, 0, 'active', true).stamina, -VITALS.staminaPerHour * VITALS.hungryFactor);
assert.equal(wear(emptyCarry(), 0, 0, 'active', false).stamina, 0, 'no time, no steps, no change');

// 睡八小時回滿體力，餓得比醒著慢
assert.equal(wearMode(480), 'rest'); assert.equal(wearMode(30), 'active');
r = wear(emptyCarry(), 480, 0, 'rest', false);
assert.equal(r.stamina, 96);
assert.equal(r.hunger, 16);

// 套用時夾在 0 到上限
assert.equal(applyWear(stats, { stamina: 50, hunger: -50 }).stamina, 100);
assert.equal(applyWear(stats, { stamina: -500, hunger: 500 }).stamina, 0);
assert.equal(applyWear(stats, { stamina: -500, hunger: 500 }).hunger, 100);
assert.equal(applyWear(stats, { stamina: 0, hunger: 0 }), stats);
assert.equal(isHungry({ ...stats, hunger: 80 }), true);

// 昏倒：扣固定醫療費，錢不夠扣到 0
const woke = afterCollapse({ ...stats, stamina: 0 });
assert.deepEqual([woke.fee, woke.stats.credits, woke.stats.stamina], [VITALS.medicalFee, 400, VITALS.wakeStamina]);
assert.ok(woke.stats.hunger > stats.hunger);
assert.deepEqual([afterCollapse({ ...stats, credits: 20 }).fee, afterCollapse({ ...stats, credits: 20 }).stats.credits], [20, 0]);

// 好感：每人每天淨值夾在 ±10，超出丟棄；各人各算；換日歸零
let a = capAffection(undefined, '2090-10-24', 'lucian', 6);
assert.equal(a.amount, 6);
a = capAffection(a.tally, '2090-10-24', 'lucian', 6);
assert.equal(a.amount, 4, 'only the room left under the cap');
assert.equal(capAffection(a.tally, '2090-10-24', 'lucian', 3).amount, 0);
assert.equal(capAffection(a.tally, '2090-10-24', 'blaze', 10).amount, 10, 'each NPC has their own allowance');
assert.equal(capAffection(a.tally, '2090-10-24', 'lucian', -25).amount, -20, 'down to −10 net');
assert.equal(capAffection(a.tally, '2090-10-25', 'lucian', 8).amount, 8, 'a new day resets');

console.log('vitals ok');
