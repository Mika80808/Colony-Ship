import assert from 'node:assert/strict';
import { findPath, isWalkable, PATROL_POINTS, STEP } from './roomNavigation';

// Every leg must traverse connected floor and never cut diagonally through walls.
for (let i = 0; i < PATROL_POINTS.length; i++) {
  const path = findPath(PATROL_POINTS[i], PATROL_POINTS[(i + 1) % PATROL_POINTS.length]);
  assert.ok(path.length, `Patrol leg ${i} must be reachable`);
  for (let j = 0; j < path.length; j++) {
    assert.ok(isWalkable(path[j]));
    if (j) assert.equal(Math.abs(path[j].x - path[j - 1].x) + Math.abs(path[j].y - path[j - 1].y), STEP);
  }
}
const detour = findPath({ x: 580, y: 380 }, { x: 800, y: 320 });
assert.ok(detour.some(p => p.y >= 860), 'Cross-room path must go around the central wall');
for (const point of [{ x: 690, y: 500 }, { x: 940, y: 300 }, { x: -1, y: 400 }, { x: 400, y: 100 }]) {
  assert.equal(isWalkable(point), false);
  assert.deepEqual(findPath(PATROL_POINTS[0], point), []);
}
assert.ok(findPath({ x: 301.5, y: 921.2 }, PATROL_POINTS[0]).length, 'Mid-walk retargeting remains reachable');
console.log('Room navigation: patrol, wall detour, blocked clicks and retargeting passed.');
