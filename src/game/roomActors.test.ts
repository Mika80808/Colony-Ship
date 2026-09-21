import assert from 'node:assert/strict';
import { createActor, setDestination, updateNpc, updatePlayer } from './roomActors';
import { isWalkable } from './roomNavigation';

const player = createActor({ x: 460, y: 820 });
const npc = createActor({ x: 300, y: 640 });
const idleNpc = structuredClone(npc);
assert.ok(setDestination(player, { x: 800, y: 320 }));
assert.deepEqual(npc, idleNpc, 'Player input never assigns an NPC destination');
let visitedBottom = false;
for (let i = 0; i < 2000; i++) {
  updatePlayer(player, 1 / 60, new Set());
  updateNpc(npc, 1 / 60);
  assert.ok(isWalkable(player.position) && isWalkable(npc.position));
  visitedBottom ||= player.position.y >= 860;
}
assert.ok(visitedBottom, 'Player walks around the partition');
assert.deepEqual(player.position, { x: 800, y: 320 });
assert.equal(player.target, null);
assert.equal(player.moving, false);
assert.notDeepEqual(npc.position, idleNpc.position, 'NPC patrol remains autonomous');
assert.equal(setDestination(player, { x: 690, y: 500 }), false);

const keyboard = createActor({ x: 640, y: 760 });
updatePlayer(keyboard, 0.05, new Set(['ArrowRight']));
assert.deepEqual(keyboard.position, { x: 640, y: 760 }, 'Keyboard cannot cross the central wall');
assert.equal(keyboard.moving, false);
updatePlayer(keyboard, 0.05, new Set(['ArrowLeft', 'ArrowUp']));
assert.ok(Math.abs(Math.hypot(keyboard.position.x - 640, keyboard.position.y - 760) - 8) < 0.001, 'Diagonal speed stays normalized');
setDestination(keyboard, { x: 300, y: 380 });
updatePlayer(keyboard, 0.05, new Set(['s']));
assert.equal(keyboard.target, null, 'Keyboard takes over from click movement');
const stopped = { ...keyboard.position };
updatePlayer(keyboard, 0.05, new Set());
assert.deepEqual(keyboard.position, stopped, 'Releasing keys stops the player');
console.log('Actor controls: separate player/NPC, patrol, navigation, keyboard walls, diagonal speed and release passed.');
