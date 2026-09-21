import assert from 'node:assert/strict';
import { BED, DECALS, PATROL, PIECES, RoomLayout, SEATS, SHELL, SOLIDS, activeRoomId, setActiveRoom } from './roomRuntime';
import { FURNITURE, hitsFurniture } from './roomFurniture';
import { findPath, isWalkable } from './roomNavigation';
import { ROOM_SEATS } from './roomSeats';
import a2 from '../../public/assets/rooms/a-2.json';

// A-1 is the room every other test file exercises; confirm it loads by default.
assert.equal(activeRoomId(), 'A-1');
assert.equal(PIECES.length, 28, 'four shell fixtures plus twenty-four layout pieces');
assert.ok(SHELL.fixtures.every(f => PIECES.includes(f)), 'shell fixtures are part of the room');
assert.equal(DECALS.length, 3);

// Exported collections are aliases, so consumers holding them see a room swap.
assert.equal(FURNITURE, PIECES, 'roomFurniture re-exports the live list');
const solidsBefore = SOLIDS.length;

setActiveRoom(a2 as RoomLayout);

assert.equal(activeRoomId(), 'A-2');
assert.equal(PIECES.length, SHELL.fixtures.length + a2.objects.length, 'layout swapped, shell kept');
assert.equal(DECALS.length, 1, 'A-2 only lays one rug');
assert.equal(PATROL.length, 4);
assert.notEqual(SOLIDS.length, solidsBefore, 'collision rebuilt from the new layout');
assert.equal(FURNITURE, PIECES, 'the alias still points at the live list after a swap');

// Collision must follow the art rather than stay behind at A-1's coordinates.
assert.ok(hitsFurniture({ x: 371, y: 682 }), "A-2's sofa blocks its new position");
assert.equal(isWalkable({ x: 440, y: 463 }), true, "A-1's old sofa spot is clear in A-2");
for (const piece of PIECES) for (const rect of piece.solid ?? []) {
  assert.equal(isWalkable({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }), false, `${piece.id} must block movement`);
}

// Shell geometry is shared, so the exit and bathroom still work in the new room.
assert.ok(isWalkable(SHELL.exit), 'the shared exit stays reachable');
assert.ok(findPath({ x: 300, y: 900 }, { x: 1100, y: 760 }).length, 'route into the shared bathroom survives the swap');

// Declared seats and bed must resolve against the layout that declared them.
assert.equal(SEATS.length, 1);
assert.ok(ROOM_SEATS.every(seat => seat.furniture), 'every seat resolves to real furniture');
assert.ok(PIECES.some(piece => piece.id === BED.id), 'the bed points at art the layout provides');
for (const point of PATROL) assert.ok(isWalkable(point), `patrol point ${JSON.stringify(point)} stands on floor`);

console.log('Room runtime: A-1 loads by default, A-2 swaps layout while keeping the shared shell.');
