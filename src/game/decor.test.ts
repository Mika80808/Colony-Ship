import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { walkable, type FacilityMap } from './facility';
import { baseOverhang, besideByShape, decorSprites, seasonOf, spriteFor, trackX, type TrackAnim } from './decor';

assert.equal(seasonOf('2090-10-24'), 'autumn'); assert.equal(seasonOf('2090-01-05'), 'winter'); assert.equal(seasonOf('2090-12-31'), 'winter');
assert.equal(seasonOf('2090-03-01'), 'spring'); assert.equal(seasonOf('2090-08-31'), 'summer');

const m: FacilityMap = JSON.parse(readFileSync('public/assets/greenhouse/map.json', 'utf8'));
const decor = m.decor!;
// Seasonal sprites follow the calendar; every sprite any season could ask for is on disk.
assert.equal(spriteFor({ sprite: 'tree_maple_{season}', x: 1, y: 1, scale: 1 }, '2090-10-24'), 'tree_maple_autumn');
for (const n of decorSprites(decor)) assert.ok(existsSync(`public/assets/greenhouse/props/${n}.webp`), n);
// Every blocked decorative prop has a fitted footprint, independent of the coarse tile grid.
// 碰撞矩形用 of 對到物件 id（tools/art/greenhouse_collision.py 產生），不靠排列順序。
assert.ok((m.collisionRects?.filter(r => !r.of).length ?? 0) > 1, 'narrow rectangles follow the panoramic window sill');
const ids = decor.filter(d => d.block).map(d => d.id);
assert.equal(new Set(ids).size, ids.length, 'every blocking prop has its own id');
const rackIds = (m.racks ?? []).map(r => `rack-${r.x},${r.y}`);
assert.ok(m.collisionRects!.every(r => !r.of || ids.includes(r.of) || rackIds.includes(r.of)), 'no collision is left behind by a removed prop');
// 種植架也照外框圖算碰撞（不再整格擋），從前面能走到中段的底邊、從後面頭肩露出
for (const r of m.racks ?? []) {
  const pieces = m.collisionRects!.filter(c => c.of === `rack-${r.x},${r.y}`);
  assert.ok(pieces.length, `rack ${r.x},${r.y} has a collision`);
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) assert.equal(m.collision[y][x], 0, `rack ${r.x},${r.y} no longer uses whole tiles`);
  const mid = (r.x + r.w / 2) * m.tileSize, artTop = (r.y + r.h) * m.tileSize - 288;
  assert.equal(walkable(m, { x: mid, y: (r.y + r.h / 2) * m.tileSize }), false, `rack ${r.x},${r.y} blocks`);
  const back = Math.min(...pieces.map(p => p.y)) * m.tileSize;
  assert.ok(back - artTop <= 92 + .01, `rack ${r.x},${r.y}: an actor behind it keeps head and shoulders above the frame`);
}
for (const d of decor) {
  if (d.block) {
    assert.ok(d.id && d.depth, `${d.sprite} has an id and a depth for the collision script`);
    // 碰撞沿著圖的輪廓切成幾塊直條，左右相接、底邊貼著物件底邊
    const pieces = m.collisionRects!.filter(r => r.of === d.id).sort((a, b) => a.x - b.x);
    assert.ok(pieces.length, `${d.id} has a collision`);
    pieces.slice(1).forEach((p, i) => assert.ok(Math.abs(pieces[i].x + pieces[i].w - p.x) < .001, `${d.id} pieces touch side by side`));
    const left = pieces[0].x, right = pieces.at(-1)!.x + pieces.at(-1)!.w, top = Math.min(...pieces.map(p => p.y)), bottom = Math.max(...pieces.map(p => p.y + p.h));
    assert.ok(left < d.x && right > d.x && top < d.y && bottom <= d.y + .001 && bottom >= d.y - .05, `${d.sprite} footprint aligned`);
    const centre = pieces.find(p => p.x <= d.x && p.x + p.w >= d.x)!;
    assert.equal(walkable(m, { x: d.x * m.tileSize, y: (centre.y + centre.h / 2) * m.tileSize }), false, `${d.sprite} blocks`);
    if (d.sprite.startsWith('corridor_light_')) assert.ok(Math.abs((bottom - top) * m.tileSize - 24) < .1, `${d.sprite} blocks only its bottom 30%`);
  }
  assert.ok(d.x > 0 && d.x < m.width && d.y > 0 && d.y <= m.height, `${d.sprite} on the map`);
}
console.log('decor ok');

// beside 自動判斷：底部跟整張圖一樣寬（桌子）算並排；上面比底部寬很多（樹冠）不算
{
  const image = (w: number, h: number, solid: (x: number, y: number) => boolean) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y)) px[(y * w + x) * 4 + 3] = 255;
    return px;
  };
  const table = image(100, 60, (x, y) => x >= 5 && x < 95 && y >= 10);
  assert.equal(baseOverhang(table, 100, 60), 0, 'a table stands on its full width');
  const tree = image(100, 100, (x, y) => (y < 70 && x >= 0 && x < 100) || (y >= 70 && x >= 40 && x < 60));
  assert.equal(baseOverhang(tree, 100, 100), 40, 'a canopy hangs 40 px past the trunk');
  const leaning = image(100, 100, (x, y) => (y < 70 && x >= 10 && x < 100) || (y >= 70 && x >= 10 && x < 30));
  assert.equal(baseOverhang(leaning, 100, 100), 70, 'the wider side counts');
  assert.equal(besideByShape(0), true); assert.equal(besideByShape(40 * .6367 * 2), false);
  assert.equal(baseOverhang(new Uint8ClampedArray(16), 2, 2), 0, 'an empty picture has no overhang');
  console.log('beside shape ok');
}

// Track animation (pharmacy picker): stays between the stops while visible, slides out to the right, then hides.
{
  const anim: TrackAnim = { stops: [100, 200, 300], top: 0, clip: [50, 0, 300, 50] };
  const xs = Array.from({ length: 4000 }, (_, i) => trackX(anim, i * .02, 20));
  assert.ok(xs.every(x => x >= 100 && x <= 370), 'never left of the first stop or beyond the hidden spot');
  assert.ok(xs.some(x => x === 370), 'spends time hidden past the right edge');
  assert.ok(xs.some(x => [100, 200, 300].includes(x)), 'pauses at stops');
  for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1]) <= 110 * .02 + 1e-6, 'moves smoothly');
  console.log('track ok');
}
