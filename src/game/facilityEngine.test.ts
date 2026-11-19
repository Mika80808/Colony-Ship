import assert from 'node:assert/strict';
import { arrivalDirection, camera, doorsOf, findPath, interactions, spawn, walkable, withDoorClosed, worldSize, type DoorSpec, type FacilityMap } from './facility';
import { canTalk, createNpc, stepNpc, TALK_DISTANCE } from './facilityNpc';

// 合成地圖：一格 48，世界 500 × 250（不是格子的整數倍，碰撞格 11 × 6 蓋滿）；第 5 欄是一道牆，只在第 2 列留門洞
const T = 48, W = 11, H = 6;
const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 5 && y !== 2 ? 1 : 0)));
const door = (id: string, extra: Partial<DoorSpec> = {}): DoorSpec => ({
  id, label: id, passage: { x: 5, y: 2, w: 1, h: 1 }, opening: [240, 96, 48, 48], panels: { left: 'l.webp', right: 'r.webp' }, trigger: 120, openSeconds: .5, ...extra,
});
const base: FacilityMap = {
  tileSize: T, width: W, height: H, world: [500, 250], collision: grid,
  entrances: [{ x: 0, y: 2, w: 1, h: 1, to: 'corridor', label: '走廊', spawn: [1, 2.5] }],
};

// 世界大小：照 world，不是格子 × tileSize；超出世界的地方不能站，鏡頭也停在世界邊緣
{
  assert.deepEqual(worldSize(base), { width: 500, height: 250 });
  assert.deepEqual(worldSize({ ...base, world: undefined }), { width: W * T, height: H * T }, 'without world the grid sets the size');
  assert.equal(walkable(base, { x: 500 - 23, y: 200 }), true, 'the foot circle fits just inside the right edge');
  assert.equal(walkable(base, { x: 500 - 21, y: 200 }), false, 'past the world edge is not floor, even though the grid goes on');
  assert.deepEqual(camera({ x: 490, y: 240 }, { width: 300, height: 200 }, base), { x: 200, y: 50 }, 'the camera stops at the world edge');
}

// 進場點：從房間、平台這類不是邊界的地方來，照 arrivals；其他照出入口
{
  const m: FacilityMap = { ...base, arrivals: { 'room-a1': { at: [8.5, 4.5], facing: 'down' } } };
  assert.deepEqual(spawn(m, 'room-a1'), { x: 8.5 * T, y: 4.5 * T });
  assert.equal(arrivalDirection(m, 'room-a1'), 'down');
  assert.deepEqual(spawn(m, 'corridor'), { x: T, y: 2.5 * T }, 'edge entrances still work');
  assert.equal(arrivalDirection(m, 'corridor'), 'right');
  assert.deepEqual(spawn(m, 'somewhere-else'), spawn(m), 'an unknown source falls back to the first entrance');
}

// 多扇門：舊的 door 和 doors 一起算；每扇要按 E 的門都是互動物件，上鎖的門帶著提示文字；關哪幾扇就只擋哪幾扇
{
  const m: FacilityMap = { ...base, door: door('legacy'), doors: [door('a1', { to: 'room-a1' }), door('a2', { locked: '門禁：A-2 住戶專用。' }), door('glass', { auto: true })] };
  assert.deepEqual(doorsOf(m).map(d => d.id), ['legacy', 'a1', 'a2', 'glass']);
  const doorItems = interactions(m).filter(i => i.kind === 'door');
  assert.deepEqual(doorItems.map(i => i.id), ['legacy', 'a1', 'a2'], 'automatic doors are not interactions');
  assert.equal(doorItems.find(i => i.id === 'a2')!.text, '門禁：A-2 住戶專用。');
  const left = { x: 2 * T, y: 2.5 * T }, right = { x: 8 * T, y: 2.5 * T };
  assert.ok(findPath(m, left, right).length, 'with every door open the passage is free');
  assert.deepEqual(findPath(withDoorClosed(m, ['a1']), left, right), [], 'closing one door blocks its passage');
  assert.deepEqual(findPath(withDoorClosed(m), left, right), [], 'by default every door is closed');
  assert.ok(findPath(withDoorClosed(m, []), left, right).length, 'closing none leaves it open');
}

// NPC：在 patrol 停靠點之間走；玩家走近就停下；隔著牆不能說話
{
  const m: FacilityMap = { ...base, patrol: [[1.5, 1.5], [3.5, 4.5]] };
  const npc = createNpc(m, 'lucian', 0);
  assert.deepEqual(npc.position, { x: 1.5 * T, y: 1.5 * T }, 'the first NPC starts at the first stop');
  assert.deepEqual(createNpc(m, 'blaze', 1).position, { x: 3.5 * T, y: 4.5 * T }, 'the next one starts at the next stop');
  const far = { x: 9 * T, y: 4.5 * T };
  // 先停 0.8 秒、再走約 1.75 秒（100 px/秒）：3 秒時應該剛到第二站，還沒開始往回走
  for (let i = 0; i < 60; i++) stepNpc(m, npc, 1 / 20, far);
  assert.ok(Math.hypot(npc.position.x - 3.5 * T, npc.position.y - 4.5 * T) < 4, `it walks to the next stop (${npc.position.x.toFixed(0)}, ${npc.position.y.toFixed(0)})`);
  for (let i = 0; i < 100; i++) { stepNpc(m, npc, 1 / 20, far); assert.ok(walkable(m, npc.position), 'it never walks into the wall'); }
  assert.ok(Math.hypot(npc.position.x - 3.5 * T, npc.position.y - 4.5 * T) > 20, 'after pausing it heads for the next stop again');
  npc.position = { x: 2.5 * T, y: 3.5 * T };
  const before = { ...npc.position }, near = { x: npc.position.x, y: npc.position.y - TALK_DISTANCE + 10 };
  assert.ok(canTalk(m, near, npc), 'the player is close enough to talk');
  for (let i = 0; i < 40; i++) stepNpc(m, npc, 1 / 20, near);
  assert.deepEqual(npc.position, before, 'it stops while the player can talk to it');
  assert.equal(npc.moving, false);
  const behindWall = createNpc({ ...m, patrol: [[4.5, 0.5]] }, 'x', 0);
  assert.equal(canTalk(m, { x: 6.5 * T, y: .5 * T }, behindWall), false, 'not through the wall, even when close');
}
console.log('facility engine ok');
