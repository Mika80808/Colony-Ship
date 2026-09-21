import assert from 'node:assert/strict';
import { canTraverse, findPath, isWalkable, ROOM_EXIT_POINT, SOUTH_WALL_LINE, SOUTH_WALL_OVERLAP } from './roomNavigation';
import { FOOTPRINT } from './roomFurniture';
import { createActor, updatePlayer, setDestination } from './roomActors';
import { nearbyInspection } from './roomInspection';

assert.ok(findPath({ x: 320, y: 980 }, ROOM_EXIT_POINT).length, 'Room exit remains reachable');
assert.equal(isWalkable({ x: 490, y: 200 }), false, 'Window wall blocks the north of the living room');
// Both routes must go below the bathroom's west wall, including on the way out.
for (const [from, to] of [
  [{ x: 760, y: 800 }, { x: 920, y: 820 }],
  [{ x: 920, y: 820 }, { x: 760, y: 800 }],
  [{ x: 900, y: 500 }, { x: 1100, y: 760 }],
]) {
  const path = findPath(from, to);
  assert.ok(path.length, 'Bathroom remains reachable');
  assert.ok(path.some(p => p.x >= 820 && p.x <= 880 && p.y > 950), 'Only bottom doorway connects bathroom');
  for (let j = 1; j < path.length; j++) assert.ok(canTraverse(path[j - 1], path[j]));
}
assert.equal(canTraverse({ x: 790, y: 800 }, { x: 900, y: 800 }), false, 'West wall blocks direct crossing');
assert.equal(canTraverse({ x: 960, y: 520 }, { x: 960, y: 640 }), false, 'North wall blocks direct crossing');
for (const point of [
  { x: 690, y: 600 }, { x: 845, y: 800 }, { x: 1000, y: 580 },
  { x: 440, y: 640 }, { x: 107, y: 780 }, { x: 110, y: 660 },
  { x: 1140, y: 280 }, { x: 966, y: 996 }, { x: 101, y: 995 },
  { x: 130, y: 460 }, { x: 430, y: 250 },
]) assert.equal(isWalkable(point), false, `Solid object at ${JSON.stringify(point)}`);

const keyboard = createActor({ x: 790, y: 800 });
for (let i = 0; i < 120; i++) updatePlayer(keyboard, 1 / 60, new Set(['d']));
assert.ok(keyboard.position.x < 818, 'Held keyboard input stops before bathroom wall');
updatePlayer(keyboard, 2, new Set(['d']));
assert.ok(keyboard.position.x < 818, 'Large frame delta cannot tunnel through wall');
const blocked = createActor({ x: 320, y: 980 });
assert.equal(setDestination(blocked, { x: 440, y: 640 }), false, 'Click on coffee table is rejected');

assert.equal(nearbyInspection({ x: 200, y: 420 }, 'left')?.inspectText, '幾乎都是飲料');
assert.equal(nearbyInspection({ x: 150, y: 1000 }, 'left')?.inspectText, '四周磨損嚴重');
assert.equal(nearbyInspection({ x: 430, y: 300 }, 'up')?.inspectText, '許多復古遊戲');
assert.equal(nearbyInspection({ x: 200, y: 420 }, 'right'), undefined, 'Facing away does not inspect');
assert.equal(nearbyInspection({ x: 300, y: 460 }, 'left'), undefined, 'Distant objects cannot be inspected');
console.log('A1 regression: walls, bottom-only bathroom routes, solid furniture, input tunnelling and PSD text passed.');

// Sprite feet must clear the visible wall, not just its center.
for (const point of [{ x: 110, y: 560 }, { x: 1160, y: 450 }, { x: 655, y: 760 }, { x: 810, y: 800 }]) {
  assert.equal(isWalkable(point), false, 'Whole foot clearance at ' + JSON.stringify(point));
}
// The south parapet is drawn over actors, so walking behind it is what hides their legs.
const southLimit = SOUTH_WALL_LINE + SOUTH_WALL_OVERLAP - FOOTPRINT.halfDepth;
for (const x of [300, 600]) {
  assert.equal(isWalkable({ x, y: SOUTH_WALL_LINE - 8 }), true, 'Feet reach the parapet base at x=' + x);
  assert.equal(isWalkable({ x, y: southLimit }), true, 'Feet stand behind the parapet at x=' + x);
  assert.equal(isWalkable({ x, y: southLimit + 1 }), false, 'Feet cannot pass through the parapet at x=' + x);
}
assert.equal(isWalkable({ x: 820, y: 320 }), false, 'Feet cannot clip the side of the bed');
assert.equal(isWalkable({ x: 800, y: 320 }), true, 'Bedroom aisle beside bed stays usable');
assert.equal(isWalkable({ x: 350, y: 640 }), false, 'Foot width blocks coffee-table side overlap');
assert.equal(isWalkable({ x: 330, y: 640 }), true, 'Floor beside coffee table stays usable');
assert.ok(findPath({ x: 301.5, y: 921.2 }, { x: 920, y: 900 }).length, 'Off-grid retargeting can reach narrow bathroom aisle');
