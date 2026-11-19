import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOMS } from '../data/initialGameData';
import { CORRIDORS } from './corridor';
import { arrivalDirection, edgeExit, findPath, interactions, keyboardTarget, move, nearby, segmentClear, spawn, walkable, worldSize, type FacilityMap } from './facility';

// 居住區走廊 A–D 改用設施場景格式（tools/art/corridor_map.py 產生）。原本 corridor.test.ts 檢查的行為都要還在。
const load = (folder: string): FacilityMap => JSON.parse(readFileSync(`public/assets/${folder}/map.json`, 'utf8'));
const SPAWN = { x: 500, y: 530 }, WIDTH = 3560;
const centre = (m: FacilityMap, x: number, y: number) => ({ x: (x + .5) * m.tileSize, y: (y + .5) * m.tileSize });

for (const [sectorId, c] of Object.entries(CORRIDORS)) {
  const m = load(c.folder), items = interactions(m), L = c.letter;
  assert.deepEqual(worldSize(m), { width: WIDTH, height: 996 }, `${L}: same world size as before`);
  // 能走的範圍：腳點 y 397–775，左右兩端
  assert.ok(walkable(m, SPAWN), `${L}: the spawn is floor`);
  for (const p of [{ x: 500, y: 100 }, { x: 500, y: 790 }, { x: 0, y: 550 }, { x: WIDTH, y: 550 }]) assert.equal(walkable(m, p), false, `${L}: ${p.x},${p.y} is off the floor`);
  assert.ok(walkable(m, { x: 500, y: 397 }) && walkable(m, { x: 500, y: 775 }), `${L}: the walkable band is still 397–775`);
  // 六扇門，左到右通 L-1～L-6，都是這個區的房間；從房間出來站在門正前方，不會馬上又觸發那扇門
  const doors = items.filter(i => i.kind === 'door').sort((a, b) => a.point.x - b.point.x);
  assert.equal(doors.length, 6, `${L} has six doors`);
  assert.deepEqual(m.doors!.map(d => d.to), [1, 2, 3, 4, 5, 6].map(n => `${L}-${n}`), 'doors run 1–6 left to right');
  assert.deepEqual(m.doors!.map(d => d.to), ROOMS.filter(r => r.sectorId === sectorId).map(r => r.id), 'every door is a room in this sector');
  assert.equal(doors.find(d => d.id === 'door-3')?.label, `${L}-3 房門`);
  for (const d of doors) {
    const p = spawn(m, m.doors!.find(x => x.id === d.id)!.to);
    assert.ok(walkable(m, p), `standing outside ${d.id} is walkable`);
    assert.equal(nearby(p, [d]), undefined, 'arriving does not immediately re-trigger the door');
    assert.ok(Math.abs(p.x - d.point.x) < 1, 'arrival is centred on the door');
    assert.ok(walkable(m, d.point) && nearby(d.point, [d])?.id === d.id, `${d.id}: the spot in front of it is floor and in reach`);
  }
  // 從星圖或不認識的地方來：站在原本的出生點
  assert.deepEqual(spawn(m), SPAWN, `${L}: arriving from elsewhere uses the corridor spawn`);
  assert.deepEqual(spawn(m, 'bridge'), SPAWN, 'unknown origin falls back to the spawn');
  assert.deepEqual(spawn(m, `${L === 'B' ? 'A' : 'B'}-2`), SPAWN, "another sector's room falls back to the spawn");
  // 每一格中心走得到的地方，都從出生點走得到
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (!walkable(m, centre(m, x, y))) continue;
    const path = findPath(m, SPAWN, centre(m, x, y)); assert.ok(path.length, `${L}: tile ${x},${y} reachable`);
    let previous = SPAWN; for (const p of path) { assert.ok(segmentClear(m, previous, p)); previous = p; }
  }
}

// 左右兩端：那一側的設施走得進去，就是出入口；往外走才離開，往回走不會
{
  const a = load('corridor-a'), b = load('corridor-b'), cc = load('corridor-c'), d = load('corridor-d');
  const rightEnd = move(a, { x: WIDTH - 55, y: 530 }, 30, 0), leftEnd = move(d, { x: 55, y: 530 }, -30, 0);
  assert.equal(edgeExit(a, rightEnd, 1, 0), 'greenhouse', 'Walking right at A corridor end enters the greenhouse');
  assert.equal(edgeExit(a, rightEnd, -1, 0), null, 'Walking back left does not exit');
  assert.equal(edgeExit(d, leftEnd, -1, 0), 'engineering', 'Walking left at D corridor end enters engineering');
  assert.equal(edgeExit(b, move(b, { x: 55, y: 530 }, -30, 0), -1, 0), 'greenhouse', 'Walking left at B corridor end enters the greenhouse');
  assert.equal(edgeExit(d, leftEnd, 1, 0), null, 'Walking back right does not exit');
  assert.equal(edgeExit(cc, move(cc, { x: WIDTH - 55, y: 530 }, 30, 0), 1, 0), 'engineering', 'Walking right at C corridor end enters engineering');
  assert.equal(edgeExit(a, move(a, { x: 55, y: 530 }, -30, 0), -1, 0), null, 'the research end of A is a wall, not an exit');
  assert.equal(edgeExit(d, move(d, { x: WIDTH - 55, y: 530 }, 30, 0), 1, 0), null, 'the research end of D is a wall, not an exit');
  assert.ok(findPath(a, { x: 3450, y: 530 }, { x: WIDTH - 25, y: 530 }).length, 'The right walkway reaches the greenhouse exit');
  // 從設施走回走廊：站在那個設施的招牌下面、面向走廊裡面
  const fromGreenhouseA = spawn(a, 'greenhouse'), fromGreenhouseB = spawn(b, 'greenhouse');
  assert.ok(fromGreenhouseA.x > 3000 && walkable(a, fromGreenhouseA), 'Greenhouse → A arrives at the right end');
  assert.ok(fromGreenhouseB.x < 300 && walkable(b, fromGreenhouseB), 'Greenhouse → B arrives at the left end');
  assert.equal(arrivalDirection(a, 'greenhouse'), 'left'); assert.equal(arrivalDirection(b, 'greenhouse'), 'right');
  assert.equal(edgeExit(a, fromGreenhouseA, 1, 0), null, 'arriving from the greenhouse does not walk straight back out');
}

// 招牌：走得進去的設施按 E 就進去；研究室（還沒有場景）顯示在哪一側；A 走廊的溫室招牌只是指引
for (const c of Object.values(CORRIDORS)) {
  const items = interactions(load(c.folder)), signs = items.filter(i => i.id.startsWith('sign-')).sort((a, b) => a.point.x - b.point.x);
  if (c.letter === 'A') assert.deepEqual(signs.map(s => s.id), ['sign-research'], 'A greenhouse sign is decorative, not a portal');
  else assert.deepEqual(signs.map(s => s.id), [`sign-${c.left}`, `sign-${c.right}`], 'Left/right signs match the ring order');
  for (const s of signs) {
    if (s.kind === 'exit') assert.ok(['greenhouse', 'medical', 'engineering'].includes(s.to!), `${s.id} leads into a facility`);
    else assert.match(s.text, s.id === `sign-${c.left}` ? /左側/ : /右側/);
    assert.ok(nearby(s.point, [s])?.id === s.id, `${s.id} is in reach from the floor in front of it`);
  }
}

// A 走廊的擺設：碰撞照圖算，不能穿過長椅，路徑繞過去；長椅兩人座，坐靠近的那一側
{
  const a = load('corridor-a'), items = interactions(a);
  for (const d of a.decor!) assert.equal(walkable(a, { x: d.x * a.tileSize, y: (d.y - d.depth! / 2) * a.tileSize }), false, `${d.id} blocks`);
  assert.ok(move(a, { x: 1100, y: 475 }, 500, 0).x < 1161, 'Movement cannot tunnel through a bench');
  for (const [from, to] of [[{ x: 1100, y: 475 }, { x: 1430, y: 475 }], [SPAWN, { x: 3450, y: 530 }], [{ x: 1264, y: 544 }, { x: 1264, y: 410 }]]) {
    const path = findPath(a, from, to); assert.ok(path.length);
    let previous = from; for (const p of path) { assert.ok(segmentClear(a, previous, p), 'Every path segment clears furniture'); previous = p; }
    assert.deepEqual(path.at(-1), to);
  }
  assert.deepEqual(findPath(a, SPAWN, { x: 1250, y: 475 }), [], 'the middle of a bench is not floor');
  assert.equal(nearby(SPAWN, items.filter(i => i.id === 'door-1')), undefined, 'the spawn is not in reach of door 1');
  for (const [x, side, seatX] of [[1200, 'left', 1227], [1300, 'right', 1301]] as const) {
    const seat = keyboardTarget({ x, y: 544 }, items)!;
    assert.equal(seat.id, `bench-1-${side}`, 'Sit on the cushion nearest the player');
    assert.ok(Math.abs(seat.seat!.x - seatX) < 1, `the ${side} cushion is where it always was`);
    assert.ok(walkable(a, seat.exit!), 'Standing up in front of either cushion is walkable');
  }
}
console.log('Corridor maps: bounds, edge exits, doors to rooms, arrivals, signs, benches and reachability passed.');
