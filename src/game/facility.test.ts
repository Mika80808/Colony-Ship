import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITIES, FacilityMap, arrivalDirection, blocked, camera, clicked, doorBlocks, doorDistance, DOOR_PASSABLE, findPath, interactions, RADIUS, keyboardTarget, move, nearby, segmentClear, spawn, stepDoor, walkable, worldSize } from './facility';
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
assert.equal(arrivalDirection(m,'residential_a'),'right','A corridor enters from the left and faces right');
assert.equal(arrivalDirection(m,'residential_b'),'left','B corridor enters from the right and faces left');
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
const sofaSeats = m.interactions!.filter(i => i.kind === 'seat');
assert.ok(sofaSeats.find(i => i.id === 'sofa-middle')!.seat![1] <= sofaSeats.find(i => i.id === 'sofa-left')!.seat![1] - .1, 'Curved sofa middle seat sits farther back');
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
  assert.ok(Math.hypot(seat.exit!.x - seat.seat!.x, seat.exit!.y - seat.seat!.y) < 52, `${seat.id} gets up directly in front`);
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
// The foot circle stops one radius below the curved lower frame, so the shadow stays off it.
for (const rect of m.collisionRects!.filter(r => r.y === 0 && r.x >= 14 && r.x < 26)) {
  const x = (rect.x + rect.w / 2) * s, bottom = (rect.y + rect.h) * s;
  if (x < 14.3 * s || x > 25.7 * s || (x > 17.3 * s && x < 22.6 * s)) continue; // wall corners and the desk
  assert.equal(walkable(m, { x, y: bottom + RADIUS - 1 }), false, `the shadow cannot touch the window sill at ${x}`);
  // On the steep ends a neighbouring, lower strip can also touch the circle; allow for the slope.
  assert.ok([...Array(24).keys()].some(d => walkable(m, { x, y: bottom + RADIUS + 1 + d })), `the player can stand at the window sill at ${x}`);
}
const desk = m.decor!.find(d => d.sprite === 'desk_console')!;
assert.equal(walkable(m, { x: desk.x * s, y: desk.y * s + RADIUS + 1 }), true, 'the player can stand right below the desk console');
assert.equal(walkable(m, { x: desk.x * s, y: desk.y * s + RADIUS - 1 }), false, 'the desk console blocks its front edge');
assert.equal(walkable(m, { x: desk.x * s - 229 - RADIUS, y: desk.y * s - 40 }), true, 'the player can stand beside the desk console');
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
// Engineering: a room over a strip of residential corridor; the corridor runs C ↔ D and a heavy door leads up into the room.
{
  const e = load('engineering'), T = e.tileSize, door = e.door!;
  const centre = (x: number, y: number) => ({ x: (x + .5) * T, y: (y + .5) * T });
  assert.equal(arrivalDirection(e, 'residential_c'), 'right'); assert.equal(arrivalDirection(e, 'residential_d'), 'left');
  const fromC = spawn(e, 'residential_c'), fromD = spawn(e, 'residential_d');
  assert.ok(findPath(e, fromC, fromD).length, 'the corridor strip runs straight through from C to D');
  // Every walkable tile is reachable from the corridor; the only way into the room is the door passage.
  for (let y = 0; y < e.height; y++) for (let x = 0; x < e.width; x++) {
    if (blocked(e, x, y)) { assert.equal(walkable(e, centre(x, y)), false, `tile ${x},${y}`); continue; }
    assert.ok(findPath(e, fromC, centre(x, y)).length, `engineering tile ${x},${y} reachable`);
  }
  const { passage } = door, wallTop = passage.y, wallBottom = passage.y + passage.h;
  for (let y = wallTop; y < wallBottom; y++) for (let x = 0; x < e.width; x++)
    assert.equal(blocked(e, x, y), x < passage.x || x >= passage.x + passage.w, `corridor wall ${x},${y} is solid except the door`);
  const inside = centre(8, 10), path = findPath(e, fromC, inside);
  assert.ok(path.length, 'pathfinding goes through the door even while it is shut');
  // Shut door: walking up into the passage stops at the threshold; open door lets you through.
  const below = { x: (passage.x + passage.w / 2) * T, y: wallBottom * T + RADIUS + 4 };
  assert.ok(walkable(e, below));
  assert.ok(doorBlocks(e, door, { x: below.x, y: below.y - 10 }, 0), 'a closed door blocks the passage');
  assert.equal(doorBlocks(e, door, { x: below.x, y: below.y - 10 }, DOOR_PASSABLE), false, 'an open door does not');
  assert.equal(doorBlocks(e, door, fromC, 0), false, 'the corridor is never blocked by the door');
  // It opens when you come close, stays shut while you walk past along the corridor, and opening takes openSeconds.
  assert.ok(doorDistance(e, door, below) < door.trigger);
  assert.ok(doorDistance(e, door, { x: below.x, y: (e.entrances[0].y + e.entrances[0].h - .5) * T }) > door.trigger, 'walking along the far side of the corridor leaves it shut');
  let open = 0, seconds = 0; while (open < 1 && seconds < 5) { open = stepDoor(e, door, below, open, .05); seconds += .05; }
  assert.ok(Math.abs(seconds - door.openSeconds) < .1, `opens in ${door.openSeconds}s`);
  assert.equal(stepDoor(e, door, fromD, 1, 10), 0, 'closes again once you leave');
  console.log('engineering ok');
}

