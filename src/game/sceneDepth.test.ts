import assert from 'node:assert/strict';
import { drawBeforePlayer } from './sceneDepth';

const table = { sprite: 'fire_table', left: 100, right: 260, bottom: 220 };
assert.equal(drawBeforePlayer({ sprite: 'window_frame', bottom: 420 }, { x: 180, y: 450 }), true, 'player stays drawn above the window frame');
assert.equal(drawBeforePlayer({ sprite: 'window_frame', bottom: 420 }, { x: 180, y: 380 }), true, 'player overlapping the window glass is still drawn above the frame');
assert.equal(drawBeforePlayer({ sprite: 'window_plants', bottom: 390 }, { x: 180, y: 300 }), true, 'plants behind the glass stay under the player');
assert.equal(drawBeforePlayer(table, { x: 70, y: 190 }), true, 'actor left of table is drawn in front');
assert.equal(drawBeforePlayer(table, { x: 290, y: 190 }), true, 'actor right of table is drawn in front');
assert.equal(drawBeforePlayer(table, { x: 180, y: 190 }), false, 'table can cover an actor behind it');
assert.equal(drawBeforePlayer(table, { x: 180, y: 250 }), true, 'actor below table is drawn in front');
assert.equal(drawBeforePlayer({ sprite: 'sofa', bottom: 200 }, { x: 180, y: 180 }, true), true, 'seated actor stays above sofa cushion');
const wall = { beside: true, left: 48, right: 528, bottom: 816 };
assert.equal(drawBeforePlayer(wall, { x: 300, y: 680 }), false, 'the wall top covers an actor standing behind it');
assert.equal(drawBeforePlayer(wall, { x: 300, y: 840 }), true, 'an actor south of the wall stands in front of it');
assert.equal(drawBeforePlayer(wall, { x: 560, y: 680 }), true, 'an actor beside the end of the wall is not covered');
assert.equal(drawBeforePlayer({ left: 48, right: 528, bottom: 816 }, { x: 560, y: 680 }), false, 'decor without beside keeps plain depth order');
console.log('scene depth ok');
