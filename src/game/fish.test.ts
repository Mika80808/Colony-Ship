import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { WaterMask, inWater, rng, spawnFish, stepFish } from './fish';

// A round pond with a narrow channel: fish never leave the water, keep moving, and spread out.
const width = 80, height = 60, scale = 8, water = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const pond = Math.hypot(x - 25, y - 30) < 18, channel = x >= 40 && x < 75 && y >= 28 && y < 33;
  water[y * width + x] = pond || channel ? 1 : 0;
}
const m: WaterMask = { width, height, scale, water };
const fish = spawnFish(m, 12, 3), r = rng(9);
assert.equal(fish.length, 12);
const start = fish.map(f => ({ x: f.x, y: f.y }));
for (let i = 0; i < 20000; i++) for (const f of fish) {
  const heading = f.heading, speed = f.speed;
  stepFish(f, 1 / 30, m, r);
  assert.ok(inWater(m, f.x, f.y), `fish left the water at step ${i}`);
  assert.ok(Math.abs(f.heading - heading) < .16, `fish snapped its direction at step ${i}`);
  assert.ok(Math.abs(f.speed - speed) < 5, `fish snapped its speed at step ${i}`);
}
const moved = fish.filter((f, i) => Math.hypot(f.x - start[i].x, f.y - start[i].y) > 40).length;
assert.ok(moved >= 8, `most fish swim somewhere (${moved}/12)`);
assert.deepEqual(spawnFish(m, 3, 5).map(f => [f.x, f.y]), spawnFish(m, 3, 5).map(f => [f.x, f.y]), 'same seed, same school');
assert.equal(spawnFish({ width: 2, height: 2, scale, water: new Uint8Array(4) }, 5).length, 0, 'no water, no fish');

// The greenhouse asks for fish and ships the water mask they swim in.
const map = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
assert.ok(map.fish > 0); assert.ok(existsSync('public/assets/greenhouse/water.png'));
console.log('fish ok');
