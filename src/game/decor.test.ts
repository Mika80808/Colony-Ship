import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { walkable, type FacilityMap } from './facility';
import { decorSprites, seasonOf, spriteFor } from './decor';

assert.equal(seasonOf('2154-10-24'), 'autumn'); assert.equal(seasonOf('2154-01-05'), 'winter'); assert.equal(seasonOf('2154-12-31'), 'winter');
assert.equal(seasonOf('2154-03-01'), 'spring'); assert.equal(seasonOf('2154-08-31'), 'summer');

const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const decor = m.decor!;
// Seasonal sprites follow the calendar; every sprite any season could ask for is on disk.
assert.equal(spriteFor({ sprite: 'tree_maple_{season}', x: 1, y: 1, scale: 1 }, '2154-10-24'), 'tree_maple_autumn');
for (const n of decorSprites(decor)) assert.ok(existsSync(`public/assets/greenhouse/props/${n}.png`), n);
// Every blocked decorative prop has a fitted footprint, independent of the coarse tile grid.
assert.ok((m.collisionRects?.length ?? 0) > decor.filter(d => d.block).length + 1, 'narrow rectangles follow the panoramic window sill');
let footprint = 0;
for (const d of decor) {
  if (d.block) {
    const rect = m.collisionRects![footprint++];
    assert.ok(rect.x < d.x && rect.x + rect.w > d.x && rect.y < d.y && rect.y + rect.h >= d.y - .01, `${d.sprite} footprint aligned`);
    assert.equal(walkable(m, { x: d.x * m.tileSize, y: (rect.y + rect.h / 2) * m.tileSize }), false, `${d.sprite} blocks`);
    if (d.sprite.startsWith('corridor_light_')) assert.ok(Math.abs(rect.h * m.tileSize - 24) < .1, `${d.sprite} blocks only its bottom 30%`);
  }
  assert.ok(d.x > 0 && d.x < m.width && d.y > 0 && d.y <= m.height, `${d.sprite} on the map`);
}
console.log('decor ok');
