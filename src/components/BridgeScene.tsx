import { useEffect, useRef, useState } from 'react';
import { approach, cameraTarget, fitViewport } from '../game/viewport';
import { BRIDGE_ARRIVAL_END, BRIDGE_HEIGHT, BRIDGE_LANDING, BRIDGE_SCALE, BRIDGE_WIDTH, BridgeInteraction, bridgeArrival, bridgeClicked, bridgeNearby, bridgePath, createBridgeActor, updateBridgeActor } from '../game/bridge';
import { drawBridge, loadBridgeImages } from '../game/bridgeRender';
import './BridgeScene.css';

interface Props { paused:boolean; onOpenMap:()=>void }
const MOVEMENT=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d']);
const normalize=(key:string)=>key.length===1?key.toLowerCase():key;
export default function BridgeScene({paused,onOpenMap}:Props){
  const canvasRef=useRef<HTMLCanvasElement>(null),controls=useRef({paused,onOpenMap});controls.current={paused,onOpenMap};
  const engine=useRef({actor:createBridgeActor(),arrival:0,arriving:true,ambient:0,pending:null as BridgeInteraction|null,keys:new Set<string>(),view:fitViewport(1,1,BRIDGE_WIDTH,BRIDGE_HEIGHT),camera:{x:0,y:0,settled:false}});
  const action=useRef<()=>void>(()=>{}),skip=useRef<()=>void>(()=>{}),resizeView=useRef<()=>void>(()=>{}),zoomRef=useRef(false);
  const [zoomed,setZoomed]=useState(false);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[arriving,setArriving]=useState(true),[nearby,setNearby]=useState<BridgeInteraction|null>(null),[notice,setNotice]=useState('');
  useEffect(()=>{if(paused)engine.current.keys.clear()},[paused]);
  useEffect(()=>{if(!notice)return;const id=window.setTimeout(()=>setNotice(''),5500);return()=>window.clearTimeout(id)},[notice]);
  useEffect(()=>{
    const canvas=canvasRef.current!,ctx=canvas.getContext('2d')!,e=engine.current;
    let disposed=false,raf=0,last=0,images:Awaited<ReturnType<typeof loadBridgeImages>>|null=null,lastNearby='';
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const clear=()=>e.keys.clear();window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
    const release=(ev:KeyboardEvent)=>e.keys.delete(normalize(ev.key));window.addEventListener('keyup',release);
    const resizeFrame=()=>{
      const box=canvas.parentElement!.getBoundingClientRect();
      const v=zoomRef.current?fitViewport(box.width,box.height,BRIDGE_WIDTH,BRIDGE_HEIGHT):{width:BRIDGE_WIDTH,height:BRIDGE_HEIGHT,scale:Math.min(box.width/BRIDGE_WIDTH,box.height/BRIDGE_HEIGHT)};e.view=v;
      canvas.width=Math.round(v.width);canvas.height=Math.round(v.height);canvas.style.width=`${v.width*v.scale}px`;canvas.style.height=`${v.height*v.scale}px`;e.camera.settled=false;
    };resizeView.current=resizeFrame;
    const resize=new ResizeObserver(resizeFrame);resize.observe(canvas.parentElement!);
    const interact=(item:BridgeInteraction)=>{
      if(controls.current.paused||e.arriving)return;e.actor.path=[];e.pending=null;e.keys.clear();
      if(item.map)controls.current.onOpenMap();else setNotice(item.text);
    };
    action.current=()=>{const item=bridgeNearby(e.actor.position);if(item)interact(item)};
    skip.current=()=>{if(controls.current.paused)return;e.arrival=BRIDGE_ARRIVAL_END;e.arriving=false;e.actor.position={...BRIDGE_LANDING};e.actor.moving=false;e.actor.path=[];setArriving(false)};
    const keydown=(ev:KeyboardEvent)=>{
      const k=normalize(ev.key);if(ev.ctrlKey||ev.altKey||ev.metaKey||(!MOVEMENT.has(k)&&k!=='e'))return;ev.preventDefault();ev.stopPropagation();if(controls.current.paused||e.arriving)return;
      if(k==='e'){if(!ev.repeat)action.current()}else{e.keys.add(k);e.pending=null}
    };canvas.addEventListener('keydown',keydown);canvas.addEventListener('blur',clear);
    const pointer=(ev:PointerEvent)=>{
      if(!images||controls.current.paused||e.arriving||ev.button>0)return;canvas.focus({preventScroll:true});
      const rect=canvas.getBoundingClientRect(),point={x:((ev.clientX-rect.left)*canvas.width/rect.width+e.camera.x)/BRIDGE_SCALE,y:((ev.clientY-rect.top)*canvas.height/rect.height+e.camera.y)/BRIDGE_SCALE};
      const item=bridgeClicked(point);if(item&&bridgeNearby(e.actor.position)?.id===item.id){interact(item);return}
      const path=bridgePath(e.actor.position,item?.point??point);
      if(path.length){e.actor.path=path;e.pending=item??null;setNotice('')}else setNotice('那裡無法通行，請選擇地板或工作台。');
    };canvas.addEventListener('pointerdown',pointer);
    const render=(now:number)=>{
      if(disposed||!images)return;const dt=Math.min((now-(last||now))/1000,.05);last=now;
      const frozen=controls.current.paused||document.hidden;
      if(!frozen&&e.arriving&&reduced.matches)skip.current();
      if(!frozen){e.ambient+=dt;if(e.arriving){e.arrival+=dt;const a=bridgeArrival(e.arrival);e.actor.position=a.position;e.actor.direction='down';e.actor.moving=a.walking;e.actor.elapsed+=dt;
        if(a.done){e.arriving=false;e.actor.position={...BRIDGE_LANDING};e.actor.moving=false;setArriving(false)}
      }else{updateBridgeActor(e.actor,dt,e.keys);if(e.pending&&!e.actor.path.length){const item=e.pending;e.pending=null;if(bridgeNearby(e.actor.position)?.id===item.id)interact(item)}}}
      const near=e.arriving?undefined:bridgeNearby(e.actor.position);if((near?.id??'')!==lastNearby){lastNearby=near?.id??'';setNearby(near??null)}
      const v=e.view,target={x:cameraTarget(e.actor.position.x*BRIDGE_SCALE,v.width,BRIDGE_WIDTH),y:cameraTarget((e.arriving?660:e.actor.position.y)*BRIDGE_SCALE,v.height,BRIDGE_HEIGHT)};
      if(e.camera.settled){if(!frozen){e.camera.x=approach(e.camera.x,target.x,dt);e.camera.y=approach(e.camera.y,target.y,dt)}}else e.camera={...target,settled:true};
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(-e.camera.x,-e.camera.y);ctx.scale(BRIDGE_SCALE,BRIDGE_SCALE);
      drawBridge(ctx,images,{actor:e.actor,arrival:e.arrival,arriving:e.arriving,ambient:e.ambient,frozen,reducedMotion:reduced.matches,destination:e.actor.path.at(-1)??null,nearbyId:near?.id});ctx.restore();
      // Read-only state is useful to verify real input and map transitions in browser tests.
      canvas.dataset.phase=e.arriving?'arriving':'ready';canvas.dataset.playerX=e.actor.position.x.toFixed(2);canvas.dataset.playerY=e.actor.position.y.toFixed(2);canvas.dataset.cameraX=e.camera.x.toFixed(2);canvas.dataset.cameraY=e.camera.y.toFixed(2);canvas.dataset.arrival=e.arrival.toFixed(3);
      canvas.dataset.projection=e.arriving||Math.hypot((e.actor.position.x-627)/115,(e.actor.position.y-601)/96)<1.15?'hidden':'ready';
      raf=requestAnimationFrame(render);
    };
    setReady(false);setError('');
    loadBridgeImages().then(loaded=>{if(disposed)return;images=loaded;setReady(true);if(reduced.matches)skip.current();raf=requestAnimationFrame(render)}).catch(err=>{if(!disposed)setError(err instanceof Error?err.message:'艦橋素材載入失敗')});
    return()=>{disposed=true;cancelAnimationFrame(raf);resize.disconnect();e.keys.clear();window.removeEventListener('blur',clear);window.removeEventListener('keyup',release);document.removeEventListener('visibilitychange',clear);canvas.removeEventListener('keydown',keydown);canvas.removeEventListener('blur',clear);canvas.removeEventListener('pointerdown',pointer)};
  },[attempt]);
  return <section className="bridge-scene" aria-label="艦橋場景">
    <header className="bridge-heading"><span>艦橋 <small>BRIDGE</small></span><span className="bridge-controls">方向鍵 / WASD · 點地板移動 · E 互動</span><button className="bridge-zoom" aria-pressed={zoomed} onClick={()=>{zoomRef.current=!zoomRef.current;setZoomed(zoomRef.current);resizeView.current()}}>{zoomed?'檢視全景':'放大跟隨'}</button></header>
    <div className="bridge-viewport">
      <canvas ref={canvasRef} tabIndex={0} aria-label="艦橋可行走場景，點地板移動，靠近設備按 E 互動" />
      {!ready&&<div className="bridge-loading" role={error?'alert':'status'}>{error?<><span>{error}</span><button onClick={()=>setAttempt(v=>v+1)}>重新載入</button></>:<span>正在進入艦橋…</span>}</div>}
      {notice&&<div className="bridge-notice" role="status"><span>{notice}</span><button aria-label="關閉場景提示" onClick={()=>setNotice('')}>×</button></div>}
    </div>
    <footer className="bridge-footer"><span aria-live="polite">{arriving?'中央平台上升中':nearby?.label??'艦橋值勤中 · 可自由走動'}</span>
      {arriving?<button disabled={!ready||paused} onClick={()=>{skip.current();canvasRef.current?.focus({preventScroll:true})}}>略過抵達演出</button>:<button disabled={!nearby||paused} onClick={()=>action.current()}>{nearby?`${nearby.label} · E`:'靠近設備互動'}</button>}
    </footer>
  </section>;
}
