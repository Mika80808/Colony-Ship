import assert from 'node:assert/strict';
import { RING, TRAVEL_MINUTES, WALK_PX_PER_MINUTE, travelMinutes, travelTier, walkMeter } from './clock';
import { INITIAL_SECTORS } from '../data/initialGameData';

// Every sector on the star map has a place in the travel table.
for (const s of INITIAL_SECTORS) assert.ok(RING.includes(s.id) || s.id === 'park' || s.id === 'bridge', `${s.id} has a travel tier`);

// Tiers follow the ring: neighbours are close, the far side is a half-ring away, the plaza crosses rings, the bridge adds a level.
assert.equal(travelTier('greenhouse', 'greenhouse'), 0);
assert.equal(travelTier('greenhouse', 'residential_a'), 1);
assert.equal(travelTier('greenhouse', 'residential_b'), 1);
assert.equal(travelTier('lab', 'residential_d'), 1, 'the ring wraps around');
assert.equal(travelTier('greenhouse', 'medical'), 2);
assert.equal(travelTier('greenhouse', 'engineering'), 2, 'straight across still goes round the ring');
assert.equal(travelTier('greenhouse', 'park'), 3);
assert.equal(travelTier('park', 'bridge'), 1, 'up the tower from the plaza');
assert.equal(travelTier('greenhouse', 'bridge'), 4);
assert.equal(travelTier('bridge', 'greenhouse'), travelTier('greenhouse', 'bridge'), 'symmetric');
for (let i = 1; i < TRAVEL_MINUTES.length; i++) assert.ok(TRAVEL_MINUTES[i] > TRAVEL_MINUTES[i - 1]);
assert.equal(travelMinutes('greenhouse', 'greenhouse'), 0);

// Walking: whole minutes only, remainders carry over, standing still costs nothing.
const meter = walkMeter();
assert.equal(meter(0), 0); assert.equal(meter(-50), 0);
let total = 0;
for (let i = 0; i < 1000; i++) total += meter(WALK_PX_PER_MINUTE / 100);            // many tiny steps
assert.equal(total, 10);
assert.equal(meter(WALK_PX_PER_MINUTE * 2.5), 2); assert.equal(meter(WALK_PX_PER_MINUTE * .5), 1, 'the half minute carried over');

// Walking to a neighbouring sector costs a bit more than teleporting there (design rule): a corridor is ~30 tiles plus the facility.
assert.ok(Math.round(96 * 40 / WALK_PX_PER_MINUTE) >= TRAVEL_MINUTES[1] - 1);
console.log('clock ok');
