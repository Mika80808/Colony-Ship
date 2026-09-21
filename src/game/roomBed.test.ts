import assert from 'node:assert/strict';
import { createActor, setDestination, updatePlayer } from './roomActors';
import { approachBed, bedRestPoint, bedSideAt, BED_ACTOR_DEPTH, BED_REST_POINT, cancelBedApproach, createBedState, finishBedApproach, interactBed, leaveBed } from './roomBed';
import { FURNITURE } from './roomFurniture';
import { isWalkable, ROOM_EXIT_POINT } from './roomNavigation';

const actor = createActor({ ...ROOM_EXIT_POINT }, 'up'), bed = createBedState();
assert.equal(interactBed(actor, bed), false, 'E cannot enter bed from across the room');
assert.equal(setDestination(actor, BED_REST_POINT), false, 'Ordinary movement cannot walk through bed');
assert.ok(approachBed(actor, bed), 'Click bed finds a reachable bedside');
for (let frame = 0; frame < 3000 && bed.phase !== 'resting'; frame++) {
  updatePlayer(actor, 1 / 60, new Set());
  assert.ok(isWalkable(actor.position), 'Approach stays on legal floor');
  finishBedApproach(actor, bed);
}
assert.equal(bed.phase, 'resting');
assert.deepEqual(actor.position, BED_REST_POINT);
assert.equal(actor.direction, 'down', 'Resting actor faces camera');
assert.equal(actor.target, null);
assert.equal(actor.moving, false);
const floorPoint = { ...bed.exitPoint! };
assert.ok(FURNITURE.find(item => item.id === 'bed-base')!.depth < BED_ACTOR_DEPTH);
assert.ok(FURNITURE.find(item => item.id === 'bed-blanket')!.depth > BED_ACTOR_DEPTH);
assert.ok(interactBed(actor, bed), 'E leaves bed');
assert.deepEqual(actor.position, floorPoint);
assert.ok(isWalkable(actor.position));
assert.ok(interactBed(actor, bed), 'E beside bed rests again');
assert.ok(leaveBed(actor, bed), 'Movement can leave bed onto valid floor');
assert.ok(setDestination(actor, ROOM_EXIT_POINT), 'Door is reachable after getting up');
Object.assign(actor, createActor({ ...ROOM_EXIT_POINT }));
approachBed(actor, bed);
cancelBedApproach(bed);
updatePlayer(actor, 1 / 60, new Set(['w']));
finishBedApproach(actor, bed);
assert.equal(bed.phase, 'idle', 'Keyboard cancels queued bed interaction');
assert.equal(actor.target, null);
console.log('Bed: approach, E interaction, layering, facing, getting up and cancellation passed.');

for (const side of ['left', 'right'] as const) {
  const sleeper = createActor({ x: 800, y: 280 }), state = createBedState();
  assert.ok(approachBed(sleeper, state, side));
  assert.equal(state.side, side);
  assert.deepEqual(sleeper.position, bedRestPoint(side), 'Clicked half controls position even when approaching opposite side');
  assert.equal(bedSideAt(sleeper.position), side);
  assert.equal(sleeper.direction, 'down');
  assert.ok(leaveBed(sleeper, state));
  assert.deepEqual(sleeper.position, { x: 800, y: 280 });
}
const rightSleeper = createActor({ x: 1080, y: 280 }), rightState = createBedState();
assert.ok(interactBed(rightSleeper, rightState));
assert.equal(rightState.side, 'right', 'E from right bedside chooses right pillow');
assert.deepEqual(rightSleeper.position, bedRestPoint('right'));
