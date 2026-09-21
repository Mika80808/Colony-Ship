import assert from 'node:assert/strict';
import { COLLISIONS, SPAWN, walkable, move, findPath, segmentClear, nearby } from './corridor';
assert.ok(walkable(SPAWN));
for(const r of COLLISIONS) assert.equal(walkable({x:r.x+r.width/2,y:r.y+r.height/2}),false);
for(const p of [{x:500,y:100},{x:500,y:790},{x:0,y:550},{x:3560,y:550}]) assert.equal(walkable(p),false);
assert.ok(move({x:1100,y:475},500,0).x<1174,'Movement cannot tunnel through a bench');
for(const [a,b] of [[{x:1100,y:475},{x:1430,y:475}],[SPAWN,{x:3450,y:530}],[{x:1264,y:544},{x:1264,y:410}]]) {
 const path=findPath(a,b);assert.ok(path.length);let previous=a;
 for(const p of path){assert.ok(segmentClear(previous,p),'Every path segment clears furniture');previous=p;}
 assert.deepEqual(path.at(-1),b);
}
assert.deepEqual(findPath(SPAWN,{x:1250,y:475}),[]);
assert.equal(nearby(SPAWN,[{id:'door-1',label:'A-1',kind:'door',point:{x:500,y:415}}]),undefined);
console.log('Corridor: bounds, object collisions, anti-tunneling, paths around benches, and interaction distance passed.');
