import assert from 'node:assert/strict';
import { dayNumber } from './growth';
import { logs, readings, trend } from './monitor';

const noon = dayNumber('2154-10-24', '12:00'), night = dayNumber('2154-10-24', '02:00');

// Six readings, all inside their normal range in the default (no-fault) simulation, day or night.
for (const wing of ['left', 'right'] as const) for (const d of [noon, night, dayNumber('2154-10-24', '06:15'), dayNumber('2154-10-24', '20:20')]) {
  const r = readings(wing, d);
  assert.equal(r.length, 6);
  for (const x of r) assert.equal(x.status, 'good', `${wing} ${x.id}=${x.value} at ${d}`);
}

// The grow lights drive the day cycle: lit at noon, dark at 2am; warmer and more CO₂ by day.
const at = (d: number, id: string) => readings('left', d).find(r => r.id === id)!.value;
assert.ok(at(noon, 'ppfd') > 400 && at(night, 'ppfd') === 0);
assert.ok(at(noon, 'temp') > at(night, 'temp') + 3);
assert.ok(at(noon, 'co2') > at(night, 'co2') + 300);

// Wings are out of step, and the same moment always reads the same.
assert.notEqual(at(noon, 'temp'), readings('right', noon).find(r => r.id === 'temp')!.value);
assert.deepEqual(readings('left', noon), readings('left', noon));

// 24-hour trend: 25 hourly points ending now.
const t = trend('left', noon, 'temp');
assert.equal(t.length, 25); assert.equal(t.at(-1)!.value, at(noon, 'temp'));

// Logs only show what has already happened today, newest first.
assert.deepEqual(logs('left', night).map(l => l.time), []);
const noonLogs = logs('left', noon);
assert.equal(noonLogs[0].time, '09:30'); assert.ok(noonLogs.every(l => l.time <= '12:00'));
assert.ok(logs('right', noon)[0].time > '09:30', 'right wing runs its routine a little later');
console.log('monitor ok');
