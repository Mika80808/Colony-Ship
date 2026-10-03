import { loadImage as load } from '../utils/loadImage';
import { corridorDoorFrame, createCorridorDoorLeaves, drawCorridorDoor } from '../game/corridorDoor';
import { useEffect, useRef, useState } from 'react';
import { CorridorAsset, CorridorConfig, HEIGHT, WIDTH, SPAWN, Point, Interaction, findPath, move, interactions, nearby, signNotice, benchSeat, doorRoomId, spawnOutside, signFacility, FACILITY_SECTOR } from '../game/corridor';
import { FACILITIES } from '../game/facility';
import { ACTOR_HEIGHT, fitViewport } from '../game/viewport';

interface Props {
  corridor: CorridorConfig; paused: boolean; playerName: string;
  /** The room the player just walked out of; they reappear in front of its door. */
  returnRoomId?: string | null;
  /** The facility the player just walked out of; they reappear under its sign. */
  arrivedFrom?: string | null;
  /** Walk through a facility sign into that facility's scene. */
  onEnterFacility?: (sectorId: string) => void;
  onEnterRoom: (roomId: string) => void; onNotice: (text: string) => void;
  /** 每幀走了幾 px（推進遊戲時間用，見 game/clock.ts）。 */
  onWalk?: (px: number) => void;
}
const movement = new Set(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const normal = (key: string) => key.length === 1 ? key.toLowerCase() : key;
export default function CorridorScene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef(props); controls.current = props;
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState(`正在載入 ${props.corridor.letter} 區走廊…`);
  const state = useRef({ p: { ...SPAWN }, path: [] as Point[], direction: 'down', elapsed: 0, camera: 0, view: 1600, sitting: null as Interaction | null, entering: 0, enteringDoor: '', ready: false, items: [] as Interaction[], pending: null as Interaction | null });
  const act = () => {
    const s = state.current;
    if (!s.ready || controls.current.paused || s.entering) return;
    if (s.sitting) { s.p = { ...s.sitting.point }; s.sitting = null; return; }
    const item = nearby(s.p,s.items); if (!item) return;
    s.path = []; s.pending = null;
    if (item.kind === 'bench') { s.sitting = benchSeat(item, s.p.x); s.p = { x:s.sitting.point.x, y:486 }; s.direction='down'; }
    if (item.kind === 'door') { s.entering=0.001; s.enteringDoor=item.id; s.direction='up'; }
    if (item.kind === 'sign') {
      const sector = FACILITY_SECTOR[signFacility(item.id)];
      if (FACILITIES[sector] && controls.current.onEnterFacility) controls.current.onEnterFacility(sector);
      else controls.current.onNotice(signNotice(item.id, controls.current.corridor));
    }
  };
  const actRef = useRef(act); actRef.current = act;
  useEffect(() => { if (props.paused) keys.current.clear(); }, [props.paused]);
  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    let disposed=false, raf=0, last=0;
    const clear = () => keys.current.clear();
    window.addEventListener('blur',clear); document.addEventListener('visibilitychange',clear);
    const resize = new ResizeObserver(([e]) => {
      const s=state.current, view=fitViewport(e.contentRect.width,e.contentRect.height,WIDTH,HEIGHT);
      s.view=view.width;
      canvas.width=Math.round(view.width); canvas.height=Math.round(view.height);
      canvas.style.width=`${view.width*view.scale}px`; canvas.style.height=`${view.height*view.scale}px`;
    }); resize.observe(canvas.parentElement!);
    async function start() {
      const { folder }=controls.current.corridor;
      const response=await fetch(`/assets/${folder}/manifest.json`); if (!response.ok) throw new Error('manifest');
      const assets: CorridorAsset[]=await response.json();
      const images=await Promise.all(assets.map(a=>load(a.src??`/assets/${folder}/${a.id}.webp`)));
      const sprite=await load('/assets/player/walk.webp');
      if(disposed) return;
      const image = (id: string) => images[assets.findIndex(a=>a.id===id)];
      const doorLeaves = new Map(assets.filter(a => a.kind === 'door').map(a => [a.id, createCorridorDoorLeaves(image(a.id))]));
      state.current.items=interactions(assets,controls.current.corridor);
      state.current.p=spawnOutside(assets,controls.current.corridor,controls.current.returnRoomId??null,controls.current.arrivedFrom??null);
      state.current.ready=true; setStatus('');
      canvas.focus({ preventScroll: true });
      const drawAsset=(a: CorridorAsset)=>ctx.drawImage(image(a.id),a.x,a.y,a.width,a.height);
      const drawPlayer=(moving: boolean)=>{
        const s=state.current, sw=sprite.width/4, sh=sprite.height/3, h=ACTOR_HEIGHT, w=h*sw/sh;
        ctx.fillStyle='#05101b66'; ctx.beginPath(); ctx.ellipse(s.p.x,s.p.y-3,23,7,0,0,Math.PI*2); ctx.fill();
        const col=({down:0,up:1,left:2,right:3} as Record<string,number>)[s.direction];
        const row=moving?[0,1,0,2][Math.floor(s.elapsed*8)%4]:0;
        if(s.sitting) {
          // Preserve head/body scale; shorten the lower-leg section for a seated preview pose.
          ctx.drawImage(sprite,col*sw,row*sh,sw,sh*.7,s.p.x-w/2,s.p.y-h*.85+5,w,h*.7);
          ctx.drawImage(sprite,col*sw,row*sh+sh*.7,sw,sh*.3,s.p.x-w/2,s.p.y-h*.15+5,w,h*.15);
        } else ctx.drawImage(sprite,col*sw,row*sh,sw,sh,s.p.x-w/2,s.p.y-h+5,w,h);
      };
      const render=(time: number)=>{
        if(disposed)return;
        const s=state.current, dt=Math.min((time-(last||time))/1000,.05);last=time;
        const frozen=controls.current.paused||document.hidden;
        let moving=false;
        if(!frozen) {
          if(s.entering) { s.entering+=dt; if(corridorDoorFrame(s.entering).complete) { s.entering=0; controls.current.onEnterRoom(doorRoomId(controls.current.corridor,s.enteringDoor)); return; } }
          else {
            let dx=Number(keys.current.has('d')||keys.current.has('ArrowRight'))-Number(keys.current.has('a')||keys.current.has('ArrowLeft'));
            let dy=Number(keys.current.has('s')||keys.current.has('ArrowDown'))-Number(keys.current.has('w')||keys.current.has('ArrowUp'));
            if(dx||dy) {
              if(s.sitting) {s.p={...s.sitting.point};s.sitting=null;}
              s.path=[];s.pending=null;
            } else if(s.path.length&&!s.sitting) {
              dx=s.path[0].x-s.p.x;dy=s.path[0].y-s.p.y;
              if(Math.hypot(dx,dy)<3){s.p=s.path.shift()!;dx=0;dy=0;}
            }
            const distance=Math.hypot(dx,dy);
            if(distance) {
              const amount=Math.min(240*dt,s.path.length?distance:Infinity);
              const p=move(s.p,dx/distance*amount,dy/distance*amount,controls.current.corridor.collisions);const walked=Math.hypot(p.x-s.p.x,p.y-s.p.y);moving=walked>.01;s.p=p;if(moving)controls.current.onWalk?.(walked);
              s.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
              if(moving)s.elapsed+=dt;
            }
            if(!s.path.length&&s.pending) { const pending=s.pending;s.pending=null;if(nearby(s.p,[pending]))actRef.current(); }
          }
        }
        s.camera=Math.max(0,Math.min(WIDTH-s.view,s.p.x-s.view/2));
        ctx.clearRect(0,0,canvas.width,HEIGHT);ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(-s.camera,0);
        drawAsset(assets.find(a=>a.id==='space')!);drawAsset(assets.find(a=>a.id==='floor')!);
        drawAsset(assets.find(a=>a.id==='wall')!);
        assets.filter(a=>a.kind==='door').forEach(a=>{
          const open = s.entering && a.id === s.enteringDoor ? corridorDoorFrame(s.entering).open : 0;
          drawCorridorDoor(ctx, image(a.id), doorLeaves.get(a.id)!, a.x, a.y, a.width, a.height, open);
        });
        assets.filter(a=>a.kind==='sign').forEach(drawAsset);
        const layers=assets.filter(a=>a.kind==='object'||a.kind==='bench').map(a=>({depth:a.y+a.height-7,draw:()=>drawAsset(a)}));
        layers.push({depth:s.sitting?510:s.p.y,draw:()=>drawPlayer(moving&&!frozen)});layers.sort((a,b)=>a.depth-b.depth).forEach(a=>a.draw());
        drawAsset(assets.find(a=>a.id==='foreground')!);
        if(s.path.length){const p=s.path.at(-1)!;ctx.strokeStyle='#71efff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y,16,6,0,0,Math.PI*2);ctx.stroke();}
        const item=nearby(s.p,s.items);
        ctx.restore();
        if(corridorDoorFrame(s.entering).fade>0){ctx.fillStyle=`rgba(4,10,20,${corridorDoorFrame(s.entering).fade})`;ctx.fillRect(0,0,canvas.width,HEIGHT);}
        canvas.dataset.playerPosition=`${s.p.x.toFixed(1)},${s.p.y.toFixed(1)}`;canvas.dataset.camera=s.camera.toFixed(1);canvas.dataset.sitting=String(!!s.sitting);canvas.dataset.ready='true';canvas.dataset.moving=String(moving);canvas.dataset.nearby=item?.id??'';
        raf=requestAnimationFrame(render);
      };raf=requestAnimationFrame(render);
    }
    start().catch(()=>{if(!disposed)setStatus('走廊素材載入失敗，請重新整理。');});
    return()=>{disposed=true;state.current.ready=false;cancelAnimationFrame(raf);resize.disconnect();clear();window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);};
  },[]);
  return <div className="corridor-scene">
    <div className="corridor-viewport"><canvas ref={canvasRef} tabIndex={0} aria-label={`${props.corridor.letter} 區走廊。方向鍵或 WASD 移動，E 互動，也可以點擊地板、房門或椅子。`}
      onBlur={()=>keys.current.clear()}
      onKeyDown={e=>{const key=normal(e.key);if(e.ctrlKey||e.altKey||e.metaKey)return;if(movement.has(key)||key==='e'){e.preventDefault();e.stopPropagation();if(!props.paused&&!state.current.entering){if(key==='e'){if(!e.repeat)act();}else {if(!keys.current.has(key)){const dx=key==='d'||key==='ArrowRight'?4:key==='a'||key==='ArrowLeft'?-4:0;const dy=key==='s'||key==='ArrowDown'?4:key==='w'||key==='ArrowUp'?-4:0;state.current.p=move(state.current.p,dx,dy,props.corridor.collisions);}keys.current.add(key);}}}}}
      onKeyUp={e=>{const key=normal(e.key);if(movement.has(key)){e.preventDefault();e.stopPropagation();keys.current.delete(key);}}}
      onClick={e=>{
        const s=state.current;if(!s.ready||props.paused||s.entering)return;e.currentTarget.focus({preventScroll:true});
        if(s.sitting){s.p={...s.sitting.point};s.sitting=null;}
        const r=e.currentTarget.getBoundingClientRect(), p={x:(e.clientX-r.left)/r.width*s.view+s.camera,y:(e.clientY-r.top)/r.height*HEIGHT};
        const item=s.items.find(i=>Math.abs(i.point.x-p.x)<(i.kind==='bench'?103:65)&&(i.kind==='bench'?p.y>=381&&p.y<=506:i.kind==='door'?p.y>=198&&p.y<=347:p.y>=160&&p.y<=230));
        const target=item?.kind==='bench'?benchSeat(item,p.x):item;
        s.pending=target??null;s.path=findPath(s.p,target?.point??p,props.corridor.collisions);
      }}/>
      {status&&<p role="status" className="corridor-status">{status}</p>}
    </div>
  </div>;
}
