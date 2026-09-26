import test from 'node:test';
import assert from 'node:assert/strict';
import {BRIDGE_INTERACTIONS,BRIDGE_LANDING,BRIDGE_SPAWN,BRIDGE_OBSTACLES,bridgeArrival,bridgeWalkable,bridgeSegmentClear,bridgeMove,bridgePath,createBridgeActor,updateBridgeActor,bridgeNearby} from './bridge';

test('arrival settles on floor and releases control beyond the exit tread',()=>{
  assert.equal(bridgeArrival(0).underground,true);assert.equal(bridgeArrival(3.15).offset,0);
  assert.deepEqual(bridgeArrival(6.6).position,BRIDGE_LANDING);assert.equal(bridgeArrival(6.6).done,true);
  assert.ok(bridgeWalkable(BRIDGE_SPAWN));assert.ok(bridgeWalkable(BRIDGE_LANDING));assert.ok(bridgeSegmentClear(BRIDGE_SPAWN,BRIDGE_LANDING));
});
test('walls and all physical furniture block player footprints',()=>{
  for(const p of [{x:0,y:0},{x:627,y:1100},{x:1254,y:500},{x:627,y:110}])assert.equal(bridgeWalkable(p),false);
  for(const r of BRIDGE_OBSTACLES)assert.equal(bridgeWalkable({x:r.x+r.width/2,y:r.y+r.height/2}),false);
  assert.equal(bridgeWalkable({x:480,y:601}),false);assert.equal(bridgeWalkable({x:627,y:466}),false);assert.equal(bridgeWalkable({x:627,y:725}),true);
});
test('every interaction is reachable from landing and all route segments are clear',()=>{
  for(const i of BRIDGE_INTERACTIONS){assert.ok(bridgeWalkable(i.point),i.id+' approach');const path=bridgePath(BRIDGE_LANDING,i.point);assert.ok(path.length,i.id+' route');let prev=BRIDGE_LANDING;for(const p of path){assert.ok(bridgeSegmentClear(prev,p),i.id+' segment');prev=p}assert.equal(bridgeNearby(prev)?.id,i.id)}
});
test('long steps cannot tunnel through walls, consoles or raised ring',()=>{
  assert.ok(bridgeMove({x:360,y:600},-300,0).x>330);
  assert.ok(bridgeMove({x:627,y:400},0,-250).y>363);
  assert.ok(bridgeMove({x:430,y:601},300,0).x<456);
  assert.equal(bridgePath(BRIDGE_LANDING,{x:627,y:300}).length,0);
});
test('walking preserves speed diagonally and cancels click path on manual input',()=>{
  const a=createBridgeActor(),b=createBridgeActor();a.position={x:627,y:840};b.position={...a.position};a.path=[{x:627,y:900}];
  updateBridgeActor(a,.1,new Set(['w']));updateBridgeActor(b,.1,new Set(['w','d']));
  assert.equal(a.path.length,0);assert.ok(Math.abs(Math.hypot(a.position.x-627,a.position.y-840)-Math.hypot(b.position.x-627,b.position.y-840))<.001);
});
test('platform requires explicit map interaction and is not an auto-transfer zone',()=>{
  assert.equal(BRIDGE_INTERACTIONS.filter(i=>i.map).length,1);assert.equal(bridgeNearby(BRIDGE_SPAWN)?.map,true);
  const actor=createBridgeActor();updateBridgeActor(actor,1,new Set());assert.deepEqual(actor.position,BRIDGE_SPAWN);
});
