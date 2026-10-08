import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { CYCLE_DAYS, dayNumber, progress, stageAt } from './growth';
import { rackKey } from './racks';

assert.equal(dayNumber('2090-01-01', '00:00'), 0);
assert.equal(dayNumber('2090-01-02', '12:00'), 1.5);
assert.ok(dayNumber('2090-10-24', '08:45') > dayNumber('2090-10-24', '08:44'));

// One full cycle goes seedling → growing → ready → replanted seedling, in that order, and then repeats exactly.
const days = CYCLE_DAYS.lettuce, start = dayNumber('2090-10-24', '08:45');
const seen: number[] = [];
for (let d = 0; d <= days * 2; d += .25) { const s = stageAt('lettuce', 'k', start + d); if (seen.at(-1) !== s) seen.push(s); }
for (let i = 1; i < seen.length; i++) assert.equal(seen[i], seen[i - 1] === 3 ? 1 : seen[i - 1] + 1, `stage order ${seen}`);
assert.ok(seen.length >= 6, 'two cycles show every stage twice');
assert.equal(stageAt('lettuce', 'k', start), stageAt('lettuce', 'k', start + days));

// Every crop on the racks has its own cycle; each planting starts at its own phase, so the room shows a mix.
const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const plantings = m.racks!.flatMap(r => r.crops.map(c => ({ c, key: rackKey(r) })));
for (const { c } of plantings) assert.ok(CYCLE_DAYS[c], `${c} has a cycle`);
const phases = new Set(plantings.map(({ c, key }) => progress(c, key, start).toFixed(3)));
assert.equal(phases.size, plantings.length, 'plantings are out of step');
const stages = new Set(plantings.map(({ c, key }) => stageAt(c, key, start)));
assert.equal(stages.size, 3, 'the opening day already shows seedlings, growing and ripe plants');
console.log('growth ok');
