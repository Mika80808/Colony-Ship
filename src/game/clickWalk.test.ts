import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToNearest } from './clickWalk';
import { findPath, spawn, walkable, type FacilityMap } from './facility';
import type { Point } from './corridor';

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// 合成場地：0–1000 見方，中間一塊 200×200 的桌子；右上角一個圍起來的小隔間（走得到的地，但進不去）
{
  const table = (p: Point) => p.x > 400 && p.x < 600 && p.y > 400 && p.y < 600;
  const closetWall = (p: Point) => p.x > 840 && p.y < 160 && !(p.x > 860 && p.y < 140);
  const inCloset = (p: Point) => p.x > 860 && p.y < 140;
  const walk = (p: Point) => p.x > 0 && p.x < 1000 && p.y > 0 && p.y < 1000 && !table(p) && !closetWall(p);
  // 路徑：直線走得到就給終點；隔間只有裡面的人走得到
  const route = (from: Point) => (to: Point) => walk(to) && inCloset(to) === inCloset(from) ? [to] : [];
  const player = { x: 100, y: 500 };

  const floor = pathToNearest({ x: 200, y: 200 }, player, route(player), walk);
  assert.deepEqual(floor, [{ x: 200, y: 200 }], 'a click on open floor walks straight there');

  const onTable = pathToNearest({ x: 450, y: 500 }, player, route(player), walk).at(-1)!;
  assert.ok(!table(onTable) && walk(onTable), 'a click on the table ends on the floor');
  assert.ok(Math.abs(onTable.x - 400) <= 8 && Math.abs(onTable.y - 500) <= 8, `it stops at the nearest edge of the table (${onTable.x}, ${onTable.y})`);

  const centre = pathToNearest({ x: 500, y: 500 }, player, route(player), walk).at(-1)!;
  assert.ok(dist(centre, { x: 500, y: 500 }) <= 108, 'from the middle of the table it still stops right beside it');
  assert.ok(centre.x < 500, 'when every edge is equally near, it picks the side facing the player');

  const closet = pathToNearest({ x: 900, y: 100 }, player, route(player), walk).at(-1)!;
  assert.ok(!inCloset(closet) && walk(closet), 'a click inside a closed-off pocket stops outside it');
  assert.ok(dist(closet, { x: 900, y: 100 }) < 120, 'just outside the pocket wall');

  const nowhere = pathToNearest({ x: 500, y: 500 }, player, () => [], walk);
  assert.deepEqual(nowhere, [], 'no reachable point means no path');
}

// 溫室實際地圖：點沙發、點觀景窗玻璃、點水池，角色都會走到旁邊走得到的地板
{
  const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8')), T = m.tileSize, start = spawn(m);
  const click = (x: number, y: number) => pathToNearest({ x: x * T, y: y * T }, start, to => findPath(m, start, to), p => walkable(m, p));
  // 觀景窗下面整排是控制台，最近的地板在控制台前面，離窗上半部差不多 4 格
  for (const [name, x, y, near] of [['sofa', 22.5, 16.6, 1.5], ['window glass', 20, 1.5, 4], ['planting rack', 6, 8, 1.5], ['maple trunk', 21.1, 14, 1.5]] as const) {
    const path = click(x, y);
    assert.ok(path.length, `clicking the ${name} still walks somewhere`);
    const end = path.at(-1)!;
    assert.ok(walkable(m, end), `${name}: the walk ends on floor`);
    assert.ok(dist(end, { x: x * T, y: y * T }) < near * T, `${name}: the walk ends near the click (${(dist(end, { x: x * T, y: y * T }) / T).toFixed(2)} tiles)`);
  }
}
console.log('click walk ok');
