import assert from 'node:assert/strict';
import { COLLISIONS, CORRIDORS, SPAWN, walkable, move, findPath, segmentClear, nearby, interactions, signNotice, benchSeat, doorRoomId, spawnOutside } from './corridor';
import { ROOMS } from '../data/initialGameData';
import { readFileSync } from 'node:fs';
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
for (const key of ['residential_b','residential_c','residential_d']) {
 const c=CORRIDORS[key];
 assert.equal(walkable({x:1264,y:475},c.collisions),true,'B–D have no furniture yet');
 assert.deepEqual(findPath(SPAWN,{x:1264,y:475},c.collisions),[{x:1264,y:475}]);
 const assets=JSON.parse(readFileSync(`public/assets/${c.folder}/manifest.json`,'utf8'));
 const signs=interactions(assets,c).filter(i=>i.kind==='sign').sort((a,b)=>a.point.x-b.point.x);
 assert.deepEqual(signs.map(s=>s.id),[`sign-${c.left}`,`sign-${c.right}`],'Left/right signs match the ring order');
 assert.match(signNotice(signs[0].id,c),/左側/);assert.match(signNotice(signs[1].id,c),/右側/);
 assert.equal(interactions(assets,c).find(i=>i.id==='door-3')?.label,`${c.letter}-3 房門`);
}
// Every corridor has six doors, each leading to its own room in that sector, and
// walking back out of a room puts the player on the floor in front of its door.
for (const [sectorId, c] of Object.entries(CORRIDORS)) {
 const assets=JSON.parse(readFileSync(`public/assets/${c.folder}/manifest.json`,'utf8'));
 const doors=interactions(assets,c).filter(i=>i.kind==='door').sort((a,b)=>a.point.x-b.point.x);
 assert.equal(doors.length,6,`${c.letter} has six doors`);
 const rooms=doors.map(d=>doorRoomId(c,d.id));
 assert.deepEqual(rooms,[1,2,3,4,5,6].map(n=>`${c.letter}-${n}`),'doors run 1–6 left to right');
 assert.deepEqual(rooms,ROOMS.filter(r=>r.sectorId===sectorId).map(r=>r.id),'every door is a room in this sector');
 for(const d of doors){
  const p=spawnOutside(assets,c,doorRoomId(c,d.id));
  assert.ok(walkable(p,c.collisions),`standing outside ${d.id} is walkable`);
  assert.equal(nearby(p,[d])?.id,undefined,'arriving does not immediately re-trigger the door');
  assert.ok(Math.abs(p.x-d.point.x)<1,'arrival is centred on the door');
 }
}
{
 const assets=JSON.parse(readFileSync('public/assets/corridor-a/manifest.json','utf8'));
 assert.deepEqual(spawnOutside(assets,CORRIDORS.residential_a,'A-1'),SPAWN,'leaving A-1 lands exactly where it always has');
 assert.deepEqual(spawnOutside(assets,CORRIDORS.residential_a,null),SPAWN,'arriving from elsewhere uses the corridor spawn');
 assert.deepEqual(spawnOutside(assets,CORRIDORS.residential_a,'B-2'),SPAWN,"another sector's room falls back to the spawn");
}
const bench={id:'bench-1',label:'坐下休息',kind:'bench' as const,point:{x:1264,y:544}};
for(const [from,seat] of [[1200,1227],[1300,1301]]){
 const b=benchSeat(bench,from);assert.equal(b.point.x,seat,'Sit on the cushion nearest the player');
 assert.ok(walkable(b.point),'Standing up in front of either cushion is walkable');
}
console.log('Corridor: bounds, object collisions, anti-tunneling, paths around benches, and interaction distance passed.');
// Walking out of a facility lands under that facility's sign: the greenhouse sits right of A and left of B.
{
 const a=JSON.parse(readFileSync('public/assets/corridor-a/manifest.json','utf8')), b=JSON.parse(readFileSync('public/assets/corridor-b/manifest.json','utf8'));
 const fromGreenhouseA=spawnOutside(a,CORRIDORS.residential_a,null,'greenhouse'), fromGreenhouseB=spawnOutside(b,CORRIDORS.residential_b,null,'greenhouse');
 assert.ok(fromGreenhouseA.x>3000&&walkable(fromGreenhouseA),'Greenhouse → A arrives at the right end');
 assert.ok(fromGreenhouseB.x<300&&walkable(fromGreenhouseB,CORRIDORS.residential_b.collisions),'Greenhouse → B arrives at the left end');
 assert.deepEqual(spawnOutside(a,CORRIDORS.residential_a,'A-3','greenhouse').x,spawnOutside(a,CORRIDORS.residential_a,'A-3').x,'Leaving a room still wins');
 assert.deepEqual(spawnOutside(a,CORRIDORS.residential_a,null,'bridge'),SPAWN,'Unknown origin falls back to SPAWN');
}
