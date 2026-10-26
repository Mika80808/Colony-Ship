import assert from 'node:assert/strict';
import { isBehindShowerGlass, showerLayerDepths } from './showerDoor';
import { SHELL } from './roomRuntime';
import { isShowering } from './roomFurniture';
const shower = SHELL.fixtures.find(item => item.id === 'shower')!;
const depths = showerLayerDepths(shower);
for (const y of [787, 790, 799, 800, 801, 805, 810, 812]) {
  const point = { x: 1120, y };
  assert.ok(depths.back < y && y < depths.glass, 'The actor stays between the cabin and glass at y=' + y);
  assert.ok(isBehindShowerGlass(point, shower), 'Glass stays translucent throughout doorway overlap at y=' + y);
}
assert.equal(isShowering({ x: 1120, y: 805 }), false, 'Doorway overlap extends beyond the bathing trigger');
for (const y of [813, 814, 820, 840]) {
  assert.ok(y >= depths.glass, 'Outside actors draw in front of the glass');
  assert.equal(isBehindShowerGlass({ x: 1120, y }, shower), false);
}
assert.equal(isBehindShowerGlass({ x: 980, y: 805 }, shower), false, 'Actors beside the cabin do not affect its glass');
console.log('Shower layers: continuous entry/exit ordering and glass visibility passed.');
