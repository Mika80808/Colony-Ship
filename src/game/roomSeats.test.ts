import assert from 'node:assert/strict';
import { createActor, setDestination, updatePlayer } from './roomActors';
import { approachSeat, cancelSeatApproach, createSeatState, finishSeatApproach, interactSeat, leaveSeat, roomSeats } from './roomSeats';
import { isWalkable, ROOM_EXIT_POINT } from './roomNavigation';

for (const seat of roomSeats()) {
  const actor = createActor({ ...ROOM_EXIT_POINT }), state = createSeatState();
  assert.equal(interactSeat(actor, state), false, 'Cannot sit from across the room');
  assert.equal(setDestination(actor, seat.position), false, 'Chair remains solid during ordinary movement');
  assert.ok(approachSeat(actor, state, seat), seat.id + ' reachable by click');
  for (let i = 0; i < 3000 && state.phase !== 'sitting'; i++) {
    updatePlayer(actor, 1 / 60, new Set());
    assert.ok(isWalkable(actor.position));
    finishSeatApproach(actor, state);
  }
  assert.equal(state.phase, 'sitting');
  assert.deepEqual(actor.position, seat.position);
  assert.equal(actor.direction, seat.id === 'desk-chair' ? 'up' : seat.direction);
  assert.equal(actor.moving, false);
  assert.equal(actor.target, null);
  const exit = { ...state.exitPoint! };
  assert.ok(interactSeat(actor, state), 'E gets up');
  assert.deepEqual(actor.position, exit);
  assert.ok(isWalkable(actor.position));
  assert.ok(interactSeat(actor, state), 'E at chair sits again');
  assert.ok(leaveSeat(actor, state), 'Movement can get up');
  assert.ok(setDestination(actor, ROOM_EXIT_POINT), 'Can leave after getting up');
  Object.assign(actor, createActor({ ...ROOM_EXIT_POINT }));
  approachSeat(actor, state, seat); cancelSeatApproach(state);
  updatePlayer(actor, 1 / 60, new Set(['w'])); finishSeatApproach(actor, state);
  assert.equal(state.phase, 'idle', 'Keyboard cancels pending sit');
}
console.log('Room seats: all 3 reachable, correct facing, E toggle, getting up and cancellation passed.');
