import assert from 'node:assert/strict';
import { BED, DECALS, EMPTY_FURNISHING, FURNISHINGS, PATROL, PIECES, RoomFurnishing, SEATS, SHELL, SOLIDS, activeRoomId, furnishingFor, setActiveRoom } from './roomRuntime';
import { FURNITURE, hitsFurniture } from './roomFurniture';
import { canExitRoom, findPath, isWalkable, nearRoomDoor, ROOM_EXIT_POINT } from './roomNavigation';
import { roomSeats, clickedSeat, createSeatState, interactSeat } from './roomSeats';
import { bedPiece, clickedBed, createBedState, interactBed } from './roomBed';
import { createActor, npcSpawnPoint, updateNpc } from './roomActors';
import swap from './fixtures/swap-furnishing.json';

// A-1 with Lucian's furnishing is the room every other test file exercises; confirm it loads by default.
assert.equal(activeRoomId(), 'A-1');
assert.equal(PIECES.length, 28, 'four shell fixtures plus twenty-four furnishing pieces');
assert.ok(SHELL.fixtures.every(f => PIECES.includes(f)), 'shell fixtures are part of the room');
assert.equal(DECALS.length, 3);

// Furnishings belong to occupants, not rooms.
assert.equal(furnishingFor('lucian'), FURNISHINGS.lucian);
assert.equal(furnishingFor('blaze'), EMPTY_FURNISHING, 'an occupant without room art gets the bare shell');
assert.equal(furnishingFor(undefined), EMPTY_FURNISHING, 'an unoccupied room is the bare shell');

// Every image the shell or a furnishing names must be on disk. Moving art between
// shell/, furniture/<owner>/ and decals/<owner>/ is exactly how a path goes stale.
{
  const { existsSync } = await import('node:fs');
  const images = [
    ...SHELL.overlays.map(o => o.image), ...SHELL.fixtures.map(f => f.image), SHELL.base,
    ...Object.values(FURNISHINGS).flatMap(f => [...f.objects, ...f.decals].map(p => p.image)),
  ];
  for (const image of images) assert.ok(existsSync(`public/assets/rooms/${image}`), `missing room art: ${image}`);
  // Shared structure lives in shell/, shared fixtures in furniture/common/.
  for (const o of SHELL.overlays) assert.match(o.image, /^shell\//, `${o.id} is shell art`);
  for (const f of SHELL.fixtures) assert.match(f.image, /^(shell|furniture\/common)\//, `${f.id} is shared by every room`);
  // An occupant's own pieces sit under their name, or reuse a common piece.
  for (const [owner, f] of Object.entries(FURNISHINGS)) for (const p of [...f.objects, ...f.decals]) {
    assert.match(p.image, new RegExp(`^(furniture|decals)/(${owner}|common)/`), `${p.id} belongs to ${owner} or common`);
  }
}

// Exported collections are aliases, so consumers holding them see a room swap.
assert.equal(FURNITURE, PIECES, 'roomFurniture re-exports the live list');
const solidsBefore = SOLIDS.length;

// ---- An empty room: shell only, same walkable area, collision, door and exit as A-1.
setActiveRoom('B-4');
assert.equal(activeRoomId(), 'B-4');
assert.deepEqual(PIECES, SHELL.fixtures, 'only the shared shell fixtures');
assert.equal(DECALS.length, 0);
assert.equal(PATROL.length, 0);
assert.equal(SEATS.length, 0);
assert.equal(BED.id, '', 'no bed');
assert.equal(bedPiece(), undefined);
assert.equal(roomSeats().length, 0);
assert.ok(isWalkable(ROOM_EXIT_POINT) && canExitRoom(ROOM_EXIT_POINT) && nearRoomDoor({ x: 310, y: 1000 }), 'the shared exit works');
assert.equal(isWalkable({ x: 440, y: 463 }), true, "A-1's sofa spot is open floor");
assert.equal(isWalkable({ x: 697, y: 300 }), false, 'the shell walls still block');
assert.ok(findPath(ROOM_EXIT_POINT, { x: 200, y: 300 }).length, 'the whole living area is reachable');
assert.ok(findPath(ROOM_EXIT_POINT, { x: 1100, y: 760 }).length, 'the bathroom is reachable');
for (const piece of SHELL.fixtures) for (const rect of piece.solid ?? []) {
  assert.equal(isWalkable({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }), false, `${piece.id} still blocks`);
}
{
  // Nothing to sit on or lie in, and an NPC here has no patrol route to walk.
  const actor = createActor({ x: 300, y: 500 });
  assert.equal(clickedBed({ x: 940, y: 250 }), false);
  assert.equal(interactBed(actor, createBedState()), false);
  assert.equal(clickedSeat({ x: 440, y: 463 }), undefined);
  assert.equal(interactSeat(actor, createSeatState()), false);
  const npc = createActor({ x: 400, y: 600 });
  updateNpc(npc, 5);
  assert.deepEqual(npc.position, { x: 400, y: 600 }, 'an NPC without a patrol stands still');
}
// Several visitors get separate, walkable spots in an empty room.
{
  const spots = [0, 1, 2, 3, 4].map(npcSpawnPoint);
  for (const p of spots) assert.ok(isWalkable(p), `empty-room spawn ${JSON.stringify(p)} is floor`);
  assert.equal(new Set(spots.map(p => `${p.x},${p.y}`)).size, spots.length, 'nobody spawns on top of anyone');
}

// ---- Swap to a different occupant's furnishing.
setActiveRoom('A-2', swap as RoomFurnishing);
assert.equal(activeRoomId(), 'A-2');
assert.equal(PIECES.length, SHELL.fixtures.length + swap.objects.length, 'furnishing swapped, shell kept');
assert.equal(DECALS.length, 1, 'the fixture only lays one rug');
assert.equal(PATROL.length, 4);
assert.notEqual(SOLIDS.length, solidsBefore, 'collision rebuilt from the new furnishing');
assert.equal(FURNITURE, PIECES, 'the alias still points at the live list after a swap');

// Collision must follow the art rather than stay behind at A-1's coordinates.
assert.ok(hitsFurniture({ x: 371, y: 682 }), "the fixture's sofa blocks its position");
assert.equal(isWalkable({ x: 440, y: 463 }), true, "A-1's old sofa spot is clear");
for (const piece of PIECES) for (const rect of piece.solid ?? []) {
  assert.equal(isWalkable({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }), false, `${piece.id} must block movement`);
}
assert.ok(isWalkable(SHELL.exit), 'the shared exit stays reachable');
assert.ok(findPath({ x: 300, y: 900 }, { x: 1100, y: 760 }).length, 'route into the shared bathroom survives the swap');

// Declared seats and bed must resolve against the furnishing that declared them, not A-1's.
assert.equal(SEATS.length, 1);
assert.equal(roomSeats().length, 1);
assert.equal(roomSeats()[0].furniture.x, 300, "the seat resolves to this furnishing's sofa");
assert.equal(bedPiece()?.x, 840, "the bed resolves to this furnishing's bed");
assert.ok(clickedBed({ x: 940, y: 250 }), 'clicking the new bed hits it');
for (const point of PATROL) assert.ok(isWalkable(point), `patrol point ${JSON.stringify(point)} stands on floor`);

// ---- Back to Lucian's A-1: identical to the default load.
setActiveRoom('A-1', furnishingFor('lucian'));
assert.deepEqual(npcSpawnPoint(0), { x: 600, y: 700 }, "the first visitor stands where Lucian always has");
for (const i of [0, 1, 2, 3, 4]) assert.ok(isWalkable(npcSpawnPoint(i)), `A-1 spawn ${i} avoids the furniture`);
assert.equal(PIECES.length, 28);
assert.equal(SOLIDS.length, solidsBefore);
assert.equal(BED.id, 'bed-base');

console.log('Room runtime: A-1 is Lucian\'s furnishing over the shell, empty rooms are the bare shell, furnishings swap per occupant.');
