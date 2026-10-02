import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { CropsMeta, RacksMeta, layoutRack, rackBounds } from './racks';
const read = <T,>(path: string): T => JSON.parse(readFileSync(`public/assets/greenhouse/${path}`, 'utf8'));
const m = read<FacilityMap>('map.json'), meta = read<RacksMeta>('racks.json'), crops = read<CropsMeta>('crops/crops.json');
const s = m.tileSize;

// Every rack sits on its collision footprint, and its 2× art is exactly as wide as the footprint.
assert.equal(m.racks?.length, 12);
for (const r of m.racks!) {
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) assert.equal(m.collision[y][x], 1, `rack tile ${x},${y}`);
  const b = rackBounds(r, meta, s);
  assert.equal(b.width, r.w * s); assert.equal(b.bottom, (r.y + r.h) * s); assert.ok(b.y >= 0, 'rack art stays on the map');
}

// Shelf plants stay between the posts on every tier; shared rows split the shelf in order.
const shelf = (c: string[]) => layoutRack({ x: 1, y: 1, w: 12, h: 2, kind: 'shelf', crops: c }, meta, crops);
for (const p of shelf(['lettuce'])) {
  const w = crops.lettuce.stages[2].w;
  assert.ok(p.x >= meta.shelf.x0 - 2 && p.x + w <= meta.shelf.x1 + 3, `lettuce at ${p.x}`);
  assert.ok(meta.shelf.baselines.includes(p.bottom));
}
const mixed = shelf(['strawberry', 'blueberry']);
const lastStrawberry = Math.max(...mixed.filter(p => p.crop === 'strawberry').map(p => p.x));
assert.ok(lastStrawberry < Math.min(...mixed.filter(p => p.crop === 'blueberry').map(p => p.x)));

// Growth only swaps the sprite: a seedling stands on the same tiers as the ripe plant.
const seedling = layoutRack({ x: 1, y: 1, w: 12, h: 2, kind: 'shelf', crops: ['lettuce'], stage: 1 }, meta, crops);
assert.equal(seedling.length, shelf(['lettuce']).length);

// Trellis crops hang one per stake, centred on it; a crop without art yet leaves the stakes bare.
const fake: CropsMeta = { ...crops, vine: { kind: 'trellis', stages: [1, 2, 3].map(i => ({ w: 10 * i + 1, h: 20 * i, anchor: 5 * i })) } };
const vines = layoutRack({ x: 27, y: 4, w: 12, h: 2, kind: 'trellis', crops: ['vine'] }, meta, fake);
assert.deepEqual(vines.map(p => p.x + 15), meta.trellis.stakes);
assert.equal(layoutRack({ x: 27, y: 4, w: 12, h: 2, kind: 'trellis', crops: ['not_drawn_yet'] }, meta, crops).length, 0);
console.log('racks ok');
