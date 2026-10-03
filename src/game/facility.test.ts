import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITIES, FacilityMap, blocked, camera, clicked, findPath, interactions, keyboardTarget, move, nearby, segmentClear, spawn, walkable, worldSize } from './facility';
import { ACTOR_HEIGHT } from './viewport';
const load = (folder: string): FacilityMap => JSON.parse(readFileSync(`public/assets/${folder}/map.json`, 'utf8'));

// Every registered facility: a well-formed grid, open doorways, and interactions you can walk up to.
for (const [sector, { folder }] of Object.entries(FACILITIES)) {
  const f = load(folder);
  assert.equal(f.collision.length, f.height, sector); for (const row of f.collision) assert.equal(row.length, f.width, sector);
  assert.ok(f.entrances.length, `${sector} has a way in`);
  const items = interactions(f);
  for (const e of f.entrances) {
    const p = spawn(f, e.to); assert.ok(walkable(f, p), `${sector} spawn from ${e.to}`);
    assert.equal(blocked(f, e.x, e.y), false, `${sector} doorway to ${e.to} is open`);
    assert.equal(nearby(p, items), undefined, `${sector}: arriving from ${e.to} is not standing on an exit`);
  }
  for (const i of items) { assert.ok(walkable(f, i.point), `${sector} ${i.id}`); assert.ok(findPath(f, spawn(f), i.point).length, `${sector} ${i.id} reachable`); assert.equal(nearby(i.point, items)?.id, i.id, `${sector} ${i.id}`); }
}

// Greenhouse specifics.
const m = load('greenhouse');
const s = m.tileSize, centre = (x: number, y: number) => ({ x: (x + .5) * s, y: (y + .5) * s });
assert.equal(s, 96); assert.deepEqual(worldSize(m), { width: 3840, height: 2688 });
assert.equal(m.collision.length, m.height); for (const row of m.collision) assert.equal(row.length, m.width);

// Every blocked tile is impassable. Furniture footprints may also close the centre of an open tile.
// All walkable tile centres are reachable from the entrance —
// except the two top aisles behind the plant monitors at (13,2) and (26,1), which only machines use.
const start = spawn(m); assert.ok(walkable(m, start));
const sealed = (x: number, y: number) => (y === 0 && x >= 1 && x <= 13) || (x === 13 && y === 1) || (y === 0 && x >= 26 && x <= 38);
for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
  if (blocked(m, x, y)) assert.equal(walkable(m, centre(x, y)), false, `tile ${x},${y}`);
  if (!walkable(m, centre(x, y))) continue;
  if (sealed(x, y)) { assert.deepEqual(findPath(m, start, centre(x, y)), [], `tile ${x},${y} is behind a monitor`); continue; }
  const path = findPath(m, start, centre(x, y)); assert.ok(path.length, `tile ${x},${y} reachable`);
  let previous = start; for (const p of path) { assert.ok(segmentClear(m, previous, p), `segment to ${x},${y}`); previous = p; }
  assert.deepEqual(path.at(-1), centre(x, y));
  assert.ok(centre(x, y).y - ACTOR_HEIGHT >= 0, `a player on ${x},${y} keeps their head on the map`);
}
assert.deepEqual(findPath(m, start, centre(20, 1)), [], 'The observation window is not floor');
const sofa = m.decor!.find(d => d.sprite === 'sofa')!;
assert.equal(walkable(m, { x: sofa.x * s, y: (sofa.y - .5) * s }), false, 'the sofa seat blocks movement');
// Crops add no collision: every plot tile is walkable ground.
for (const p of m.plots) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) assert.equal(blocked(m, x, y), false);

// Movement slides along walls and never tunnels through a rack.
const aisle = centre(5, 3), pushed = move(m, aisle, 0, -500);
assert.ok(pushed.y > 2 * s + 22 - 1 && pushed.y < 4 * s, 'Cannot walk north through the planting rack');
assert.equal(move(m, aisle, 300, 0).y, aisle.y);

// Interactions: every stand point is floor, reachable, and next to its own area.
const items = interactions(m);
assert.deepEqual(items.map(i => i.id), ['exit-residential_a', 'exit-residential_b', 'window', 'console', 'monitor-left', 'monitor-right', 'shipping', 'sofa-left', 'sofa-middle', 'sofa-right', 'plot-1']);
assert.equal(items.find(i => i.id === 'plot-1')?.label, '種植區', 'A single plot is not numbered');
for (const i of items) { assert.ok(walkable(m, i.point), i.id); assert.ok(findPath(m, start, i.point).length, i.id); assert.equal(nearby(i.point, items)?.id, i.id); }
for (const seat of items.filter(i => i.kind === 'seat')) {
  assert.ok(seat.seat, `${seat.id} has a sitting position`);
  assert.ok(seat.exit, `${seat.id} has a nearby exit`);
  assert.equal(walkable(m, seat.seat!), false, `${seat.id} sits on the sofa rather than a walkable floor`);
  assert.equal(walkable(m, seat.exit!), true, `${seat.id} exits onto the floor`);
  assert.ok(Math.hypot(seat.exit!.x - seat.seat!.x, seat.exit!.y - seat.seat!.y) < 45, `${seat.id} gets up directly in front`);
  assert.ok(findPath(m, seat.exit!, start).length, `${seat.id} can walk away after getting up`);
  assert.equal(clicked(seat.seat!, items)?.id, seat.id, `${seat.id} is individually clickable`);
}
const sofaLeft = sofa.x * s - 409 / 2;
for (const [x, id] of [[21.25, 'sofa-left'], [21.45, 'sofa-left'], [22.55, 'sofa-middle'], [23.8, 'sofa-right']] as const)
  assert.equal(keyboardTarget({ x: x * s, y: 17.65 * s }, items)?.id, id, `E in front of sofa at x=${x}`);
for (const [first, last, id] of [[8, 159, 'sofa-left'], [161, 259, 'sofa-middle'], [261, 400, 'sofa-right']] as const) {
  for (let pixel = first; pixel <= last; pixel += 8)
    assert.equal(clicked({ x: sofaLeft + pixel, y: (sofa.y - .8) * s }, items)?.id, id, `sofa cushion pixel ${pixel}`);
}
for (let x = 15; x < 25; x++) assert.equal(walkable(m, centre(x, 3)), false, `panoramic window ${x} is solid`);
// Feet stop flush with the curved lower frame: just below the sill is open, just above is solid.
for (const rect of m.collisionRects!.filter(r => r.flush)) {
  const x = (rect.x + rect.w / 2) * s, bottom = (rect.y + rect.h) * s;
  if (x < 14.3 * s || x > 25.7 * s || (x > 16.6 * s && x < 23.4 * s)) continue; // wall corners and the desk
  assert.equal(walkable(m, { x, y: bottom - 1 }), false, `feet cannot cross the window sill at ${x}`);
  assert.equal(walkable(m, { x, y: bottom + 1 }), true, `feet can reach the window sill at ${x}`);
}
assert.equal(walkable(m, { x: 20 * s, y: 6 * s }), true, 'the player can stand below the desk console');
assert.equal(walkable(m, { x: 14.5 * s, y: 2.5 * s }), false, 'window glass remains solid');
for (const light of m.decor!.filter(d => d.sprite.startsWith('corridor_light_'))) {
  assert.equal(walkable(m, { x: light.x * s, y: (light.y - .3) * s }), false, `${light.sprite} blocks movement`);
}
for (const e of m.entrances) {
  const p = spawn(m, e.to); assert.ok(walkable(m, p), e.to);
  assert.equal(nearby(p, items), undefined, `Arriving from ${e.to} is not standing on its exit`);
  assert.equal(blocked(m, e.x, e.y), false, `${e.to} doorway is open`);
}
assert.deepEqual(spawn(m, null), spawn(m, 'residential_a'), 'The star map drops the player at the first entrance');
// The old bottom doorway is sealed now that the greenhouse opens onto corridors A and B.
for (let x = 18; x < 22; x++) assert.equal(blocked(m, x, 27), true);
assert.equal(clicked(centre(20, 2), items)?.id, 'window'); assert.equal(clicked(centre(20, 4), items)?.id, 'console', 'The desk sits inside the window area but wins the click'); assert.equal(clicked(centre(30, 19), items)?.id, 'plot-1'); assert.equal(clicked(centre(38, 20), items)?.id, 'plot-1');

// Camera never leaves the map; the monitors keep everyone low enough that heads stay on screen.
const view = { width: 1600, height: 996 };
assert.deepEqual(camera({ x: 0, y: 0 }, view, m), { x: 0, y: 0 });
assert.deepEqual(camera({ x: 99999, y: 99999 }, view, m), { x: 3840 - 1600, y: 2688 - 996 });
console.log('greenhouse ok');
