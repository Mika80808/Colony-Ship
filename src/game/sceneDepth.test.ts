import assert from 'node:assert/strict';
import { drawBeforePlayer, frontOutline, overlapOrder, underPlayer } from './sceneDepth';

const table = { sprite: 'fire_table', beside: true, left: 100, right: 260, bottom: 220 };
assert.equal(drawBeforePlayer({ sprite: 'window_frame', bottom: 420 }, { x: 180, y: 450 }), true, 'player stays drawn above the window frame');
assert.equal(drawBeforePlayer({ sprite: 'window_frame', bottom: 420 }, { x: 180, y: 380 }), true, 'player overlapping the window glass is still drawn above the frame');
assert.equal(drawBeforePlayer({ sprite: 'window_plants', bottom: 390 }, { x: 180, y: 300 }), true, 'plants behind the glass stay under the player');
assert.equal(drawBeforePlayer(table, { x: 70, y: 190 }), true, 'actor left of table is drawn in front');
assert.equal(drawBeforePlayer(table, { x: 290, y: 190 }), true, 'actor right of table is drawn in front');
assert.equal(drawBeforePlayer(table, { x: 180, y: 190 }), false, 'table can cover an actor behind it');
assert.equal(drawBeforePlayer(table, { x: 180, y: 250 }), true, 'actor below table is drawn in front');
assert.equal(drawBeforePlayer({ sprite: 'sofa', bottom: 200 }, { x: 180, y: 180 }, true), true, 'seated actor stays above sofa cushion');
assert.equal(drawBeforePlayer({ id: 'bench-1', sprite: 'bench-1', bottom: 506 }, { x: 1227, y: 447 }, true, 'bench-1'), true, 'seated on a bench, the bench is under the actor');
assert.equal(drawBeforePlayer({ id: 'bench-2', sprite: 'bench-2', bottom: 506 }, { x: 1227, y: 447 }, true, 'bench-1'), false, 'only the furniture you sit on');
const wall = { beside: true, left: 48, right: 528, bottom: 816 };
assert.equal(drawBeforePlayer(wall, { x: 300, y: 680 }), false, 'the wall top covers an actor standing behind it');
assert.equal(drawBeforePlayer(wall, { x: 300, y: 840 }), true, 'an actor south of the wall stands in front of it');
assert.equal(drawBeforePlayer(wall, { x: 560, y: 680 }), true, 'an actor beside the end of the wall is not covered');
assert.equal(drawBeforePlayer({ left: 48, right: 528, bottom: 816 }, { x: 560, y: 680 }), false, 'decor without beside keeps plain depth order');

// 物件之間的前後不能因為角色站的位置而反過來
{
  const rack = { bottom: 1728, box: { left: 96, top: 1500, right: 1260, bottom: 1728 } };
  const tree = { bottom: 1904, beside: true, left: 1150, right: 1420, box: { left: 1150, top: 1560, right: 1420, bottom: 1904 } };
  const rock = { bottom: 1921, beside: true, left: 1200, right: 1265, box: { left: 1200, top: 1880, right: 1265, bottom: 1921 } };
  const objects = [rack, tree, rock], later = overlapOrder(objects);
  assert.deepEqual(later, [[1], [2], []], 'only overlapping pictures are ordered');
  // 角色在種植架後面、樹的左邊：種植架蓋住角色，所以樹也要畫在角色之後，才不會被種植架蓋住
  assert.deepEqual(underPlayer(objects, later, { x: 1100, y: 1520 }), [false, false, false], 'tree beside the player still stays above the rack in front of it');
  // 角色在樹後面、石頭左右範圍外：樹蓋住角色，石頭也要畫在樹之後
  assert.deepEqual(underPlayer(objects, later, { x: 1300, y: 1800 }), [true, false, false], 'rock stays in front of the tree trunk');
  // 角色站在石頭旁邊、比樹還前面：beside 例外照常生效
  assert.deepEqual(underPlayer(objects, later, { x: 1180, y: 1910 }), [true, true, true], 'beside still applies when it breaks no object order');
  // 樹不標 beside：角色站在樹後、樹幹左右範圍外，樹冠照樣蓋住角色
  const plainTree = { bottom: 1904, left: 1150, right: 1420, box: tree.box };
  assert.deepEqual(underPlayer([plainTree], [[]], { x: 1430, y: 1800 }), [false], 'a tree without beside covers the actor behind it');
  // 沒疊到角色的石燈不能連帶把沙發拉到角色上面：角色站在沙發右側外，沙發照 beside 畫在底下
  const lamp = { bottom: 1639, left: 1890, right: 2013, box: { left: 1890, top: 1559, right: 2013, bottom: 1639 } };
  const sofa = { bottom: 1665, beside: true, left: 2000, right: 2400, box: { left: 2000, top: 1472, right: 2400, bottom: 1665 } };
  const nearSofa = { x: 2440, y: 1613 }, actor = { left: 2400, top: 1465, right: 2480, bottom: 1618 }, pair = [lamp, sofa];
  assert.deepEqual(overlapOrder(pair), [[1], []]);
  assert.deepEqual(underPlayer(pair, [[1], []], nearSofa, false, actor), [true, true], 'an object away from the actor does not cancel beside');
  assert.deepEqual(underPlayer(pair, [[1], []], nearSofa), [false, false], 'without the actor box every object counts');
  // 弧形沙發中間內凹：角色站進凹處（腳比整張底邊高、但比那一段的底邊低）時畫在沙發前面
  const curved = { bottom: 1665, front: (x: number) => (x > 2100 && x < 2230 ? 1640 : 1665) };
  assert.equal(drawBeforePlayer(curved, { x: 2160, y: 1662 }), true, 'an actor standing in the recess is in front of the sofa');
  assert.equal(drawBeforePlayer(curved, { x: 2000, y: 1662 }), false, 'beside the recess the sofa base still covers the actor');
  // 從碰撞塊讀出腳下那一段的底邊
  const outline = frontOutline([{ x: 1, y: 1, w: 1, h: .5 }, { x: 2, y: 1, w: 1, h: .25, of: 'a' }, { x: 3, y: 1, w: 1, h: .5, of: 'a' }], 'a', 96, 150)!;
  assert.equal(outline(2.5 * 96), 1.25 * 96); assert.equal(outline(3.5 * 96), 1.5 * 96); assert.equal(outline(9 * 96), 150, 'outside the pieces the whole bottom counts');
  assert.equal(frontOutline([{ x: 1, y: 1, w: 1, h: 1, of: 'b' }], 'b', 96, 150), undefined, 'a single block needs no outline');
  // 窗框固定畫在角色底下
  assert.deepEqual(underPlayer([{ bottom: 300 }, { sprite: 'window_frame', bottom: 420, box: { left: 0, top: 200, right: 100, bottom: 420 } }], [[1], []], { x: 50, y: 250 }), [false, true], 'fixed rules are kept');
}
console.log('scene depth ok');
