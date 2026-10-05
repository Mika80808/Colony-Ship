import assert from 'node:assert/strict';
import { SHOPS, describeHours, isOpen, shopStatus } from './shopHours';

// 24 小時的無人店任何時間都開。
for (const time of ['00:00', '03:30', '12:00', '23:59']) {
  assert.ok(isOpen(SHOPS.clothing.hours, time), `服飾店 ${time}`);
  assert.ok(isOpen(SHOPS.supply.hours, time), `物資店 ${time}`);
}
assert.equal(describeHours(SHOPS.supply.hours), '24 小時');

// 餐廳 8–20：開店那一小時算開，打烊那一小時算關。
const r = SHOPS.restaurant.hours;
assert.ok(!isOpen(r, '07:59')); assert.ok(isOpen(r, '08:00')); assert.ok(isOpen(r, '19:59')); assert.ok(!isOpen(r, '20:00')); assert.ok(!isOpen(r, '23:00'));
assert.equal(describeHours(r), '08:00–20:00');

// 酒吧 20–02 跨午夜。
const b = SHOPS.bar.hours;
assert.ok(!isOpen(b, '19:59')); assert.ok(isOpen(b, '20:00')); assert.ok(isOpen(b, '23:30')); assert.ok(isOpen(b, '00:00')); assert.ok(isOpen(b, '01:59')); assert.ok(!isOpen(b, '02:00')); assert.ok(!isOpen(b, '12:00'));

// 餐廳與酒吧的時段剛好接上，整天任何時刻至少一家有 NPC 顧店，只有 02–08 兩家都休息。
for (let h = 0; h < 24; h++) {
  const time = `${String(h).padStart(2, '0')}:00`;
  const either = isOpen(r, time) || isOpen(b, time);
  assert.equal(either, !(h >= 2 && h < 8), time);
  assert.ok(!(isOpen(r, time) && isOpen(b, time)), `${time} 不會兩家同時開`);
}

assert.equal(shopStatus(SHOPS.bar, '21:00'), '酒吧（20:00–02:00）營業中');
assert.equal(shopStatus(SHOPS.restaurant, '21:00'), '餐廳（08:00–20:00）休息中');
console.log('shopHours.test.ts: all passed');
