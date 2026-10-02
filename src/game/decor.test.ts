import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { decorSprites, seasonOf, spriteFor } from './decor';

assert.equal(seasonOf('2154-10-24'), 'autumn'); assert.equal(seasonOf('2154-01-05'), 'winter'); assert.equal(seasonOf('2154-12-31'), 'winter');
assert.equal(seasonOf('2154-03-01'), 'spring'); assert.equal(seasonOf('2154-08-31'), 'summer');

const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const decor = m.decor!;
// Seasonal sprites follow the calendar; every sprite any season could ask for is on disk.
assert.equal(spriteFor({ sprite: 'tree_maple_{season}', x: 1, y: 1, scale: 1 }, '2154-10-24'), 'tree_maple_autumn');
for (const n of decorSprites(decor)) assert.ok(existsSync(`public/assets/greenhouse/props/${n}.png`), n);
// Trees block their trunk tile; flowers never add collision, so they stay where you can walk (or against the wall).
for (const d of decor) {
  const tx = Math.floor(d.x), ty = Math.min(m.height - 1, Math.floor(d.y));
  if (d.block && /^(tree_|placed_)/.test(d.sprite)) assert.equal(m.collision[ty][tx], 1, `${d.sprite} trunk blocks`);
  assert.ok(d.x > 0 && d.x < m.width && d.y > 0 && d.y <= m.height, `${d.sprite} on the map`);
}
console.log('decor ok');
