import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRIDGE_ARRIVAL_END, BRIDGE_CREW, BRIDGE_LANDING, BRIDGE_SCALE, BRIDGE_SPAWN, bridgeArrival, crewFacing, onPlatform } from './bridgeExtras';
import { edgeExit, findPath, interactions, move, nearby, segmentClear, spawn, walkable, worldSize, type FacilityMap } from './facility';

// 艦橋改用設施場景格式（tools/art/bridge_map.py 產生）。原本 bridge.test.ts 檢查的行為都要還在；座標寫素材座標，乘 1.5 是世界 px。
const m: FacilityMap = JSON.parse(readFileSync('public/assets/bridge-v3/map.json', 'utf8'));
const w = (x: number, y: number) => ({ x: x * BRIDGE_SCALE, y: y * BRIDGE_SCALE });
const spawnPoint = w(BRIDGE_SPAWN.x, BRIDGE_SPAWN.y), landing = w(BRIDGE_LANDING.x, BRIDGE_LANDING.y);

assert.deepEqual(worldSize(m), { width: 1881, height: 1635 }, 'the 1254 × 1090 scene at 1.5×');
assert.equal(m.speed, 160, 'walking speed is unchanged');

// 抵達：平台升到頂、走下來站在落點；落點和平台中心都是地板，中間走得通；從星圖來就站在落點
assert.equal(bridgeArrival(0).underground, true); assert.equal(bridgeArrival(3.15).offset, 0);
assert.deepEqual(bridgeArrival(BRIDGE_ARRIVAL_END).position, BRIDGE_LANDING); assert.equal(bridgeArrival(BRIDGE_ARRIVAL_END).done, true);
assert.ok(walkable(m, spawnPoint) && walkable(m, landing) && segmentClear(m, spawnPoint, landing), 'the platform walks straight down to the landing');
assert.ok(Math.hypot(spawn(m).x - landing.x, spawn(m).y - landing.y) < .01, 'arriving by star map stands on the landing');

// 牆和所有家具都擋住腳；凸起的平台外環也是
for (const [x, y] of [[0, 0], [627, 1088], [1254, 500], [627, 110]]) assert.equal(walkable(m, w(x, y)), false, `${x},${y} is not floor`);
for (const [x, y, rw, rh] of [[458, 253, 338, 103], [242, 512, 77, 193], [935, 512, 77, 193], [148, 557, 84, 91], [1022, 557, 84, 91], [590, 192, 74, 70]])
  assert.equal(walkable(m, w(x + rw / 2, y + rh / 2)), false, `furniture at ${x},${y} blocks`);
assert.equal(walkable(m, w(480, 601)), false, 'the raised ring blocks'); assert.equal(walkable(m, w(627, 466)), false, 'the back of the ring blocks');
assert.equal(walkable(m, w(627, 725)), true, 'the front tread off the platform is floor');

// 每個設備都從落點走得到，路上每一段都不穿過東西，走到了就在那個設備旁邊
const items = interactions(m);
assert.deepEqual(items.map(i => i.id).sort(), ['command', 'comms', 'lift', 'navigation', 'window']);
for (const i of items) {
  assert.ok(walkable(m, i.point), `${i.id} approach`);
  const path = findPath(m, landing, i.point); assert.ok(path.length, `${i.id} route`);
  let prev = landing; for (const p of path) { assert.ok(segmentClear(m, prev, p), `${i.id} segment`); prev = p; }
  assert.equal(nearby(prev, items)?.id, i.id, `${i.id} is in reach at the end of the walk`);
}

// 大步移動不能穿過牆、控制台、平台外環
assert.ok(move(m, w(360, 600), -300 * BRIDGE_SCALE, 0).x > 325 * BRIDGE_SCALE, 'not through the navigation console');
assert.ok(move(m, w(627, 400), 0, -250 * BRIDGE_SCALE).y > 358 * BRIDGE_SCALE, 'not through the command console');
assert.ok(move(m, w(430, 601), 300 * BRIDGE_SCALE, 0).x < 460 * BRIDGE_SCALE, 'not onto the raised ring');
assert.deepEqual(findPath(m, landing, w(627, 300)), [], 'behind the command console is not floor');

// 升降平台要按 E 開星圖，不是踩上去就傳送；艦橋沒有走出去的出入口
assert.equal(items.filter(i => i.kind === 'map').length, 1);
assert.equal(nearby(spawnPoint, items)?.id, 'lift', 'standing on the platform, E opens the star map');
assert.equal(m.entrances.length, 0); assert.equal(edgeExit(m, spawnPoint, 0, 1), null);

// 投射特效掛載點：角色還在平台上時不出現
assert.equal(onPlatform(BRIDGE_SPAWN), true); assert.equal(onPlatform(BRIDGE_LANDING), false);
// 值勤人員：角色靠近才轉頭；演出中到了各自的秒數才轉頭
const nav = BRIDGE_CREW.find(c => c.id === 'crew-navigation')!;
assert.equal(crewFacing(nav, BRIDGE_LANDING, false, BRIDGE_ARRIVAL_END), 'right', 'far away, the navigator keeps facing the console');
assert.equal(crewFacing(nav, { x: 300, y: 616 }, false, BRIDGE_ARRIVAL_END), 'right', 'close on the right, looks right');
assert.equal(crewFacing(nav, { x: 195, y: 760 }, false, BRIDGE_ARRIVAL_END), 'down', 'close below, looks down');
assert.equal(crewFacing(nav, BRIDGE_SPAWN, true, .5), 'right', 'not yet during the arrival');
assert.equal(crewFacing(nav, BRIDGE_SPAWN, true, .8), 'right', 'turns toward the platform once it is time');
console.log('Bridge map: arrival, walls and furniture, reachable stations, anti-tunneling, platform and crew passed.');
