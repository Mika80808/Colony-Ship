import assert from 'node:assert/strict';
import { canExitRoom, nearRoomDoor, ROOM_EXIT_POINT } from './roomNavigation';
import { canInteract, createActor, setDestination, updatePlayer } from './roomActors';
import { FURNITURE, isShowering } from './roomFurniture';
import { findPath, isWalkable } from './roomNavigation';

for (const item of FURNITURE) for (const rect of item.solid ?? []) {
  assert.equal(isWalkable({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }), false, `${item.id} must block movement`);
}
assert.ok(canInteract(createActor({ x: 300, y: 540 }), createActor({ x: 380, y: 540 })));
assert.equal(canInteract(createActor({ x: 300, y: 540 }), createActor({ x: 500, y: 540 })), false);
assert.equal(canInteract(createActor({ x: 640, y: 500 }), createActor({ x: 740, y: 500 })), false, 'No interaction across partition');
const player = createActor({ x: 460, y: 820 });
assert.ok(setDestination(player, { x: 1100, y: 760 }), 'Shower can be entered through bathroom doorway');
let doorway = false;
for (let i = 0; i < 1000; i++) {
  updatePlayer(player, 1 / 60, new Set());
  assert.ok(isWalkable(player.position));
  doorway ||= player.position.x >= 820 && player.position.x <= 860 && player.position.y > 950;
}
assert.ok(doorway);
assert.ok(isShowering(player.position));
assert.ok(setDestination(player, { x: 920, y: 900 }));
for (let i = 0; i < 1000; i++) updatePlayer(player, 1 / 60, new Set());
assert.equal(isShowering(player.position), false, 'Leaving the shower restores clothing');
assert.ok(findPath(player.position, { x: 800, y: 320 }).length, 'Bathroom exit and bedroom remain connected');
console.log('Furniture, interaction distance/line of sight, shower entry/exit and bedroom access passed.');
assert.equal(canExitRoom(ROOM_EXIT_POINT), true);
assert.equal(canExitRoom({ x: ROOM_EXIT_POINT.x, y: ROOM_EXIT_POINT.y - 100 }), false);
let deepest = ROOM_EXIT_POINT.y; while (isWalkable({ x: ROOM_EXIT_POINT.x, y: deepest + 1 })) deepest++;
assert.ok(deepest > 1090, 'Feet can stand past the old door range');
assert.ok(nearRoomDoor({ x: ROOM_EXIT_POINT.x, y: deepest }), 'E opens the door when pressed flush against the parapet');

