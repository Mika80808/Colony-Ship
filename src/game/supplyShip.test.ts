import assert from 'node:assert/strict';
import { dayNumber } from './growth';
import { SHIP, arrival, delayDays, departure, gmShipLines, headline, manifest, scheduledDay, shipStatus, untilText, voyageCode } from './supplyShip';

const start = dayNumber('2090-10-24', '08:45');

// 開局：第一班約 3 天後到港
let s = shipStatus(start);
assert.equal(s.voyage, 0); assert.equal(s.phase, 'incoming');
assert.ok(Math.abs(s.days - (3 + delayDays(0) + (9 - 8.75) / 24)) < 1e-9);
assert.equal(scheduledDay(0), Math.floor(start) + 3);

// 走過一百班：到港在照表日 + 0–2 天、離港在到港後、下一班到港前已經離港
for (let n = 0; n < 100; n++) {
  assert.ok([0, 1, 2].includes(delayDays(n)));
  assert.ok(departure(n) > arrival(n));
  assert.ok(departure(n) < arrival(n + 1), `voyage ${n} leaves before the next one arrives`);
}
const delayed = Array.from({ length: 200 }, (_, n) => delayDays(n)).filter(Boolean).length;
assert.ok(delayed > 10 && delayed < 60, `about 15% of voyages are late (${delayed}/200)`);

// 狀態隨時間：預告前、預告後、停靠中、離港後換下一班
const n = 5;
assert.equal(shipStatus(arrival(n) - 0.01).phase, 'incoming');
assert.equal(shipStatus(arrival(n) - 0.01).voyage, n);
assert.equal(shipStatus(arrival(n)).phase, 'docked');
assert.equal(shipStatus(departure(n) - 0.01).voyage, n);
assert.equal(shipStatus(departure(n)).voyage, n + 1);
assert.equal(shipStatus(departure(n)).phase, 'incoming');
assert.equal(shipStatus(scheduledDay(n) - SHIP.previewDays - .01).announced, false);
assert.equal(shipStatus(scheduledDay(n) - SHIP.previewDays - .01).delay, 0, 'delays are not known before the preview');
assert.equal(shipStatus(scheduledDay(n) - SHIP.previewDays).announced, true);
const late = Array.from({ length: 100 }, (_, i) => i).find((i) => delayDays(i) > 0)!;
assert.equal(shipStatus(scheduledDay(late) - 1).delay, delayDays(late));

// 貨單：同一班固定、數量在範圍內、收件人來自名單
const residents = [{ id: 'lucian', name: '路西恩' }, { id: 'blaze', name: '布雷茲' }, { id: 'aiden', name: '艾登' }];
const m = manifest(3, residents);
assert.deepEqual(manifest(3, residents), m, 'the same voyage always carries the same goods');
assert.equal(m.code, voyageCode(3)); assert.equal(m.code, 'LM-004');
assert.equal(m.cargo.length, 4);
for (const c of m.cargo) assert.ok(c.crates >= 1 && c.crates <= 3);
assert.ok(m.parcels.length >= 3 && m.parcels.length <= 6);
for (const p of m.parcels) assert.ok(residents.some((r) => r.id === p.recipientId && r.name === p.recipientName));
assert.equal(new Set(m.parcels.map((p) => p.id)).size, m.parcels.length);
assert.equal(manifest(3, []).parcels.length, 0);
assert.ok(m.transit.length >= 1 && m.transit.length <= 2);
// 收件人與寄件人要分散：二十班裡大部分班次的包裹不會全寄給同一個人
const mixed = Array.from({ length: 20 }, (_, v) => manifest(v, residents)).filter((x) => new Set(x.parcels.map((p) => p.recipientId)).size > 1).length;
assert.ok(mixed >= 15, `parcels go to different people (${mixed}/20)`);
const senders = new Set(Array.from({ length: 20 }, (_, v) => manifest(v, residents).parcels.map((p) => p.sender)).flat());
assert.ok(senders.size >= 4, 'senders vary');

// 文字
assert.equal(untilText(2.6), '約 3 天'); assert.equal(untilText(0.2), '約 5 小時'); assert.equal(untilText(0.001), '約 1 小時');
assert.match(headline({ voyage: 0, phase: 'incoming', days: 3, delay: 1, announced: true }), /約 3 天後到港（延誤 1 天）/);
assert.match(headline({ voyage: 0, phase: 'docked', days: 0.5, delay: 0, announced: true }), /停靠中・約 12 小時後離港/);
const status = { voyage: 3, phase: 'docked' as const, days: 1, delay: 0, announced: true };
const lines = gmShipLines(status, m, [m.parcels[0].recipientId]).join('\n');
assert.match(lines, /LM-004/); assert.match(lines, /藥品/); assert.match(lines, /過境貨/);
assert.ok(lines.includes(`在場的${m.parcels[0].recipientName}有一件`));
assert.equal(gmShipLines({ ...status, announced: false }, m, []).length, 1, 'no manifest before it is announced');

console.log('supplyShip ok');
