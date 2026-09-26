import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GreenhouseMap, blocked, camera, clicked, findPath, interactions, move, nearby, segmentClear, spawn, walkable, worldSize } from './greenhouse';
import { ACTOR_HEIGHT } from './viewport';
const m: GreenhouseMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const s = m.tileSize, centre = (x: number, y: number) => ({ x: (x + .5) * s, y: (y + .5) * s });
assert.equal(s, 96); assert.deepEqual(worldSize(m), { width: 3840, height: 2688 });
assert.equal(m.collision.length, m.height); for (const row of m.collision) assert.equal(row.length, m.width);

// Every open tile is walkable at its centre, every blocked one is not, and all are reachable from the entrance —
// except the two top aisles behind the plant monitors at (13,2) and (26,1), which only machines use.
const start = spawn(m); assert.ok(walkable(m, start));
const sealed = (x: number, y: number) => (y === 0 && x >= 1 && x <= 13) || (x === 13 && y === 1) || (y === 0 && x >= 26 && x <= 38);
for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
  assert.equal(walkable(m, centre(x, y)), !blocked(m, x, y), `tile ${x},${y}`);
  if (blocked(m, x, y)) continue;
  if (sealed(x, y)) { assert.deepEqual(findPath(m, start, centre(x, y)), [], `tile ${x},${y} is behind a monitor`); continue; }
  const path = findPath(m, start, centre(x, y)); assert.ok(path.length, `tile ${x},${y} reachable`);
  let previous = start; for (const p of path) { assert.ok(segmentClear(m, previous, p), `segment to ${x},${y}`); previous = p; }
  assert.deepEqual(path.at(-1), centre(x, y));
  assert.ok(centre(x, y).y - ACTOR_HEIGHT >= 0, `a player on ${x},${y} keeps their head on the map`);
}
assert.deepEqual(findPath(m, start, centre(20, 1)), [], 'The observation window is not floor');
// Crops add no collision: the enclosed bottom-right plot is walkable ground.
for (const p of m.plots) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) assert.equal(blocked(m, x, y), false);

// Movement slides along walls and never tunnels through a rack.
const aisle = centre(5, 3), pushed = move(m, aisle, 0, -500);
assert.ok(pushed.y > 2 * s + 22 - 1 && pushed.y < 4 * s, 'Cannot walk north through the planting rack');
assert.equal(move(m, aisle, 300, 0).y, aisle.y);

// Interactions: every stand point is floor, reachable, and next to its own area.
const items = interactions(m);
assert.deepEqual(items.map(i => i.id), ['exit', 'window', 'console', 'monitor-left', 'monitor-right', 'plot-1', 'plot-2', 'plot-3', 'plot-4']);
for (const i of items) { assert.ok(walkable(m, i.point), i.id); assert.ok(findPath(m, start, i.point).length, i.id); assert.equal(nearby(i.point, items)?.id, i.id); }
assert.equal(nearby(start, items), undefined, 'Spawning is not standing on the exit');
assert.equal(clicked(centre(20, 2), items)?.id, 'window'); assert.equal(clicked(centre(36, 25), items)?.id, 'plot-4');

// Camera never leaves the map; the monitors keep everyone low enough that heads stay on screen.
const view = { width: 1600, height: 996 };
assert.deepEqual(camera({ x: 0, y: 0 }, view, m), { x: 0, y: 0 });
assert.deepEqual(camera({ x: 99999, y: 99999 }, view, m), { x: 3840 - 1600, y: 2688 - 996 });
console.log('greenhouse ok');
