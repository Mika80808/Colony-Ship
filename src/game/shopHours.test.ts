import assert from 'node:assert/strict';
import { SHOPS, describeHours, isOpen, shopStatus } from './shopHours';

// 服飾店、雜貨店是純裝飾門面，不在清單裡。
assert.deepEqual(Object.keys(SHOPS).sort(), ['bar', 'cafe', 'restaurant', 'vending']);

// 24 小時的販賣櫃任何時間都開。
for (const time of ['00:00', '03:30', '12:00', '23:59']) {
  assert.ok(isOpen(SHOPS.vending.hours, time), `販賣櫃 ${time}`);
}
assert.equal(describeHours(SHOPS.vending.hours), '24 小時');

// 咖啡吧檯 7–17（自助，沒有店員）。
const c = SHOPS.cafe.hours;
assert.ok(!isOpen(c, '06:59')); assert.ok(isOpen(c, '07:00')); assert.ok(isOpen(c, '16:59')); assert.ok(!isOpen(c, '17:00'));
assert.ok(!SHOPS.cafe.staffed);

// 餐廳 11–20：開店那一小時算開，打烊那一小時算關。
const r = SHOPS.restaurant.hours;
assert.ok(!isOpen(r, '10:59')); assert.ok(isOpen(r, '11:00')); assert.ok(isOpen(r, '19:59')); assert.ok(!isOpen(r, '20:00')); assert.ok(!isOpen(r, '23:00'));
assert.equal(describeHours(r), '11:00–20:00');

// 酒吧 18–01 跨午夜。
const b = SHOPS.bar.hours;
assert.ok(!isOpen(b, '17:59')); assert.ok(isOpen(b, '18:00')); assert.ok(isOpen(b, '23:30')); assert.ok(isOpen(b, '00:00')); assert.ok(isOpen(b, '00:59')); assert.ok(!isOpen(b, '01:00')); assert.ok(!isOpen(b, '12:00'));

// 有店員的時段是 11–01；18–20 餐廳與酒吧同時開。早上 7–11 只有咖啡吧檯，01–07 只剩販賣櫃。
for (let h = 0; h < 24; h++) {
  const time = `${String(h).padStart(2, '0')}:00`;
  assert.equal(isOpen(r, time) || isOpen(b, time), h >= 11 || h < 1, time);
  assert.equal(isOpen(r, time) && isOpen(b, time), h >= 18 && h < 20, time);
  assert.equal(isOpen(c, time) || isOpen(r, time) || isOpen(b, time), !(h >= 1 && h < 7), time);
}

assert.equal(shopStatus(SHOPS.bar, '21:00'), '酒吧（18:00–01:00）營業中');
assert.equal(shopStatus(SHOPS.restaurant, '21:00'), '餐廳（11:00–20:00）休息中');
console.log('shopHours.test.ts: all passed');
