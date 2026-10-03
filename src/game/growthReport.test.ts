import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { dayNumber, stageAt } from './growth';
import { CROP_NAMES, daysText, describeRow, growthReport } from './growthReport';
import { rackKey } from './racks';

const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const racks = m.racks!, start = dayNumber('2154-10-24', '08:45');
const report = growthReport(racks, start, m.width);

// One row per planting, every crop has a Chinese name, and the stage matches what the scene draws.
assert.equal(report.length, racks.reduce((n, r) => n + r.crops.length, 0));
for (const r of report) assert.ok(CROP_NAMES[r.crop], `${r.crop} has a name`);
for (const r of racks) for (const c of r.crops) {
  const row = report.find(x => x.crop === c)!;
  assert.equal(row.stage, stageAt(c, rackKey(r), start), `${c} stage matches the scene`);
}

// Rows read 左翼 1–6 then 右翼 1–6, top to bottom.
assert.equal(report[0].name, '萵苣'); assert.equal(report[0].place, '左翼第 1 排');
assert.equal(report.find(r => r.crop === 'strawberry')!.place, '右翼第 1 排');
assert.equal(report.find(r => r.crop === 'basil')!.place, '右翼第 6 排');

// Countdowns are consistent: ripe rows have 0 days to ripe, and walking forward by daysToRipe makes the row ripe.
for (const r of report) {
  assert.ok(r.daysToHarvest > 0 && r.daysToRipe <= r.daysToHarvest, `${r.crop} countdowns`);
  if (r.stage === 3) assert.equal(r.daysToRipe, 0);
  else {
    const rack = racks.find(x => x.crops.includes(r.crop))!;
    assert.equal(stageAt(r.crop, rackKey(rack), start + r.daysToRipe + .1), 3, `${r.crop} ripe after ${r.daysToRipe} days`);
  }
}
assert.match(describeRow(report[0]), /^萵苣（左翼第 1 排）：.+(約 \d+ 天|不到 1 天)後/);
assert.equal(daysText(.3), '不到 1 天'); assert.equal(daysText(18.1), '約 18 天');
console.log('growthReport ok');
