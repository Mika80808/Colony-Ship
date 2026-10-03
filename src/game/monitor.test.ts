import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { dayNumber } from './growth';
import { growthReport } from './growthReport';
import { healthOf, monitorRows } from './monitor';

const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const day = dayNumber('2154-10-24', '08:45');

// Each wing's monitor lists only its own plantings; together they cover the whole report.
const left = monitorRows(m.racks!, day, m.width, 'left'), right = monitorRows(m.racks!, day, m.width, 'right');
assert.ok(left.every(r => r.place.startsWith('左翼')) && right.every(r => r.place.startsWith('右翼')));
assert.equal(left.length + right.length, growthReport(m.racks!, day, m.width).length);
assert.equal(left[0].name, '萵苣');

// Health is stable within a day, mostly healthy over time, and every kind of trouble shows up eventually.
assert.equal(healthOf('lettuce', 'k', day), healthOf('lettuce', 'k', day + .5 - (day % 1) + .4));
const seen = new Map<string, number>();
for (let d = 0; d < 2000; d++) { const h = healthOf('lettuce', 'k', d); seen.set(h, (seen.get(h) ?? 0) + 1); }
assert.ok(seen.get('健康')! / 2000 > .8, 'mostly healthy');
for (const h of ['缺水', '葉片發黃', '蚜蟲']) assert.ok(seen.get(h), `${h} happens sometimes`);
console.log('monitor ok');
