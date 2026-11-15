import assert from 'node:assert/strict';
import { dayNumber } from './growth';
import { arrival, departure, manifest } from './supplyShip';
import { PLAYER_ID, claimReward, dueRewards, sendLetter } from './freight';
import { DAYS_PER_CRATE, FREIGHT, FreightState, completeParcel, parcelItemId, parcelOfItem, pickParcel, deliverAt, gmFreightLines, initialFreight, kindsFor, load, medicalFeeFactor, stockLevel, tickFreight, totalCrates, unloadBack } from './freight';

const residents = [{ id: 'lucian', name: '路西恩' }];
const cargo = (n: number) => manifest(n, residents);
const start = dayNumber('2090-10-24', '08:45');

let s = initialFreight(start);
assert.equal(s.nextVoyage, 0);
assert.equal(s.stock.medicine, FREIGHT.startDays);

// 船還沒來：只消耗
s = tickFreight(s, arrival(0) - 0.01, cargo);
assert.equal(s.dock.length, 0);
assert.ok(Math.abs(s.stock.medicine - (FREIGHT.startDays - (arrival(0) - 0.01 - start))) < 1e-9);
assert.equal(tickFreight(s, start, cargo), s, 'time never runs backwards');

// 到港：貨卸進接駁口
const at = arrival(0) + 0.1;
s = tickFreight(s, at, cargo);
const shipped = cargo(0).cargo.reduce((n, c) => n + c.crates, 0);
assert.equal(totalCrates(s.dock), shipped);
assert.equal(s.nextVoyage, 1);

// 裝車：一次最多 3 箱
let r = load(s, 'medicine', 99);
assert.equal(r.loaded, Math.min(3, cargo(0).cargo.find((c) => c.kind === 'medicine')!.crates));
r = load(r.state, 'parts', 99);
assert.equal(totalCrates(r.state.cart), 3, 'the cart holds three crates');
assert.equal(load(r.state, 'research').loaded, 0, 'a full cart takes no more');
assert.equal(totalCrates(r.state.dock) + totalCrates(r.state.cart), shipped, 'nothing lost while loading');
const back = unloadBack(r.state, 'parts');
assert.equal(totalCrates(back.cart, 'parts'), 0);
assert.equal(totalCrates(back.dock), totalCrates(r.state.dock) + totalCrates(r.state.cart, 'parts'));

// 卸貨：只卸送到這一區的，工資每箱 15，庫存回升
assert.deepEqual(kindsFor('medical'), ['medicine']);
const meds = totalCrates(r.state.cart, 'medicine');
const before = r.state.stock.medicine;
const d = deliverAt(r.state, 'medical', at);
assert.equal(d.crates, meds); assert.equal(d.wage, meds * FREIGHT.wagePerCrate);
assert.ok(Math.abs(d.state.stock.medicine - (before + meds * DAYS_PER_CRATE.medicine)) < 1e-9);
assert.equal(totalCrates(d.state.cart, 'parts'), totalCrates(r.state.cart, 'parts'), 'parts stay on the cart');
assert.equal(deliverAt(d.state, 'greenhouse', at).crates, 0);
assert.equal(d.bonus, 0, 'the voyage still has goods left');

// 全部送完（離港前）→ 獎金一次
let all = s;
let bonus = 0, wage = 0;
for (const c of cargo(0).cargo) {
  while (totalCrates(all.dock, c.kind)) {
    all = load(all, c.kind, 3).state;
    const sector = ['medical', 'engineering', 'lab', 'park'].find((id) => kindsFor(id).includes(c.kind))!;
    const done = deliverAt(all, sector, at);
    all = done.state; bonus += done.bonus; wage += done.wage;
  }
}
assert.equal(totalCrates(all.dock), 0);
assert.equal(wage, shipped * FREIGHT.wagePerCrate);
assert.equal(bonus, FREIGHT.voyageBonus);
assert.deepEqual(all.clearedVoyages, [0]);

// 離港後才送完沒有獎金
let lateRun = tickFreight(s, departure(0) + 0.1, cargo);
for (const kind of ['medicine', 'parts', 'research', 'pantry'] as const) {
  while (totalCrates(lateRun.dock, kind)) {
    lateRun = load(lateRun, kind, 3).state;
    lateRun = deliverAt(lateRun, ['medical', 'engineering', 'lab', 'park'].find((id) => kindsFor(id).includes(kind))!, departure(0) + 0.1).state;
  }
}
assert.deepEqual(lateRun.clearedVoyages, []);

// 沒人送：放滿兩天後路西恩每天送兩箱，庫存不會一路掉到底
let idle = tickFreight(s, arrival(0) + 1.9, cargo);
assert.equal(totalCrates(idle.dock), shipped, 'the helper waits two days');
idle = tickFreight(idle, arrival(0) + 3.1, cargo);
assert.ok(totalCrates(idle.dock) < shipped, 'then the helper starts');
let stepped = s;
for (let t = Math.ceil(s.day); t < s.day + 60; t++) stepped = tickFreight(stepped, t, cargo);
const jumped = tickFreight(s, Math.ceil(s.day) + 59, cargo);
assert.equal(jumped.nextVoyage, stepped.nextVoyage);
for (const k of ['medicine', 'parts', 'research', 'pantry'] as const) {
  assert.ok(Math.abs(jumped.stock[k] - stepped.stock[k]) < 1e-6, `${k}: one big jump equals many small steps`);
}
assert.ok(totalCrates(jumped.dock) <= 12, 'the dock does not pile up forever');

// 等級、醫療費、GM
assert.equal(stockLevel(5), '充足'); assert.equal(stockLevel(1), '偏低'); assert.equal(stockLevel(0), '匱乏');
assert.equal(medicalFeeFactor({ ...s, stock: { ...s.stock, medicine: 0 } }), 2);
assert.equal(medicalFeeFactor(s), 1);
const lines = gmFreightLines(r.state).join('\n');
assert.match(lines, /醫療室的藥品：充足/); assert.match(lines, /接駁口還有貨/); assert.match(lines, /推車上載著/);
assert.ok(!/\d+(\.\d+)? 天/.test(lines), 'the GM gets levels, not day counts');

// --- 私人包裹 ---
{
  const people = [{ id: 'lucian', name: '路西恩' }, { id: 'aiden', name: '艾登' }];
  const withParcels = (n: number) => manifest(n, people);
  let p = tickFreight(initialFreight(start), arrival(0) + 0.1, withParcels);
  const count = withParcels(0).parcels.length;
  assert.equal(p.parcels!.length, count);
  assert.ok(p.parcels!.every((x) => x.voyage === 0 && people.some((who) => who.id === x.recipientId)));
  const first = p.parcels![0];
  const picked = pickParcel(p, first.id);
  assert.equal(picked.parcel!.id, first.id);
  assert.equal(picked.state.parcels!.length, count - 1);
  assert.equal(picked.state.carried!.length, 1);
  assert.equal(pickParcel(picked.state, first.id).parcel, null, 'a parcel can only be picked once');
  assert.equal(parcelOfItem(picked.state, parcelItemId(first.id))!.id, first.id);
  assert.equal(parcelOfItem(picked.state, 'crop-lettuce'), null);
  const done = completeParcel(picked.state, first.id);
  assert.equal(done.state.carried!.length, 0); assert.equal(done.state.parcelsDelivered, 1);
  assert.equal(completeParcel(done.state, first.id).parcel, null);
  assert.match(gmFreightLines(picked.state).join(' '), new RegExp(`寄給${first.recipientName}的包裹`));
  // 沒人領：放滿兩天後的那個午夜，運送車自己送掉；玩家身上的不受影響
  const later = tickFreight(picked.state, arrival(0) + 3.1, withParcels);
  assert.equal(later.parcels!.length, 0);
  assert.equal(later.carried!.length, 1);
  // 舊存檔沒有包裹欄位也能用
  const old = { ...initialFreight(start) } as FreightState; delete old.parcels; delete old.carried;
  assert.equal(pickParcel(old, 'x').parcel, null);
  assert.equal(tickFreight(old, arrival(0) + 0.1, withParcels).parcels!.length, count);
}

// --- 寄件與回信 ---
{
  const people = [{ id: 'lucian', name: '路西恩' }];
  const ship = (n: number) => manifest(n, people);
  let f = tickFreight(initialFreight(start), arrival(0) + 0.1, ship);
  assert.equal(sendLetter(f, { id: 'a', voyage: 0, destination: '月球', note: '我很好', sentDay: arrival(0) + 0.1 }, false), f, 'no ship, no post');
  assert.equal(sendLetter(f, { id: 'a', voyage: 0, destination: '月球', note: '   ', sentDay: 0 }, true), f, 'an empty message is not sent');
  f = sendLetter(f, { id: 'moon', voyage: 0, destination: '月球', note: '我很好', itemName: '草莓', sentDay: arrival(0) + 0.1 }, true);
  f = sendLetter(f, { id: 'mars', voyage: 0, destination: '火星', note: '你那邊冷嗎', sentDay: arrival(0) + 0.1 }, true);
  assert.deepEqual(f.outbox!.map((l) => l.replyVoyage), [1, 2], 'the moon answers by the next ship, Mars by the one after');
  assert.match(gmFreightLines(f).join(' '), /寄了一段訊息給月球（附上草莓）/);
  f = tickFreight(f, arrival(1) + 0.1, ship);
  const moon = f.parcels!.find((p) => p.recipientId === PLAYER_ID)!;
  assert.equal(moon.id, 'reply-moon'); assert.equal(moon.sender, '月球的回信'); assert.equal(moon.letter!.note, '我很好');
  assert.equal(f.outbox!.length, 1);
  // 回信不會被運送車送掉
  f = tickFreight(f, arrival(1) + 5, ship);
  assert.ok(f.parcels!.some((p) => p.id === 'reply-moon'));
  f = tickFreight(f, arrival(2) + 0.1, ship);
  assert.ok(f.parcels!.some((p) => p.id === 'reply-mars')); assert.equal(f.outbox!.length, 0);
}

// --- 長期獎勵 ---
{
  let f = initialFreight(start);
  assert.deepEqual(dueRewards(f), []);
  f = { ...f, clearedVoyages: [0, 1, 2] };
  assert.deepEqual(dueRewards(f), ['equip-scooter']);
  f = claimReward(f, 'equip-scooter');
  assert.deepEqual(dueRewards(f), []); assert.equal(claimReward(f, 'equip-scooter'), f);
  f = { ...f, clearedVoyages: [0, 1, 2, 3, 4, 5, 6, 7] };
  assert.deepEqual(dueRewards(f), ['equip-rail-pass']);
}

console.log('freight ok');
