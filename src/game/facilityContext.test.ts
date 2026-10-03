import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FacilityMap } from './facility';
import { describeFacilityObjects } from './facilityContext';

const map: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const nearSofa = describeFacilityObjects(map, { x: 22 * map.tileSize, y: 18 * map.tileSize });
assert.match(nearSofa, /玩家目前在 \(22\.0,18\.0\)/);
assert.match(nearSofa, /三人沙發/);
assert.match(nearSofa, /挑高觀景窗/);
assert.match(nearSofa, /圓形火盆桌/);
assert.ok(nearSofa.length < 1800, 'GM receives a compact local inventory, not every flower on the map');
const nearEntrance = describeFacilityObjects(map, { x: 2.5 * map.tileSize, y: 22.5 * map.tileSize });
assert.notEqual(nearSofa, nearEntrance, 'nearby objects change with the player position');
console.log('facility context ok');
