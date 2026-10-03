import { BRIDGE_ART, BRIDGE_CREW, BRIDGE_PIECES } from './bridgeArt';
import { ACTOR_HEIGHT } from './viewport';
import { BRIDGE_SCALE, BridgeActor, bridgeArrival, Point } from './bridge';
export type BridgeImages=Record<string,HTMLImageElement>;
export async function loadBridgeImages():Promise<BridgeImages>{
  const entries=[...Object.entries(BRIDGE_ART).map(([id,v])=>[id,'/assets/bridge-v3/'+v.file]),...Object.entries(BRIDGE_CREW).map(([id,v])=>[id,'/assets/bridge-v3/'+v.file]),['player','/assets/player/walk.webp']];
  const images:BridgeImages={};await Promise.all(entries.map(([id,url])=>new Promise<void>((resolve,reject)=>{const im=new Image();im.onload=()=>{images[id]=im;resolve()};im.onerror=()=>reject(new Error(`艦橋素材載入失敗：${id}`));im.src=url})));return images;
}
export interface BridgeRenderState { actor:BridgeActor; arrival:number; arriving:boolean; ambient:number; frozen:boolean; reducedMotion:boolean; destination:Point|null; nearbyId?:string }
export function drawBridge(ctx:CanvasRenderingContext2D,images:BridgeImages,s:BridgeRenderState){
  const ellipse=(x:number,y:number,rx:number,ry:number)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2)};
  const sprite=(id:string,x:number,y:number,w:number,h:number)=>{const b=BRIDGE_ART[id as keyof typeof BRIDGE_ART].bounds;ctx.drawImage(images[id],b[0],b[1],b[2]-b[0],b[3]-b[1],x,y,w,h)};
  const shadow=(x:number,y:number,w:number,h:number,a=.17)=>{ctx.fillStyle=`rgba(4,12,24,${a})`;ellipse(x,y,w,h);ctx.fill()};
  const ring=(front:boolean)=>{ctx.save();ctx.beginPath();ctx.rect(0,front?601:0,1254,front?489:601);ctx.clip();sprite('elevator-ring-v2',462,452,330,300);ctx.restore()};
  const drawPlayer=()=>{
    const a=s.actor,im=images.player,sw=im.naturalWidth/4,sh=im.naturalHeight/3;
    const col={down:0,up:1,left:2,right:3}[a.direction];
    const row=a.moving&&!s.frozen?[0,1,0,2][Math.floor(a.elapsed*8)%4]:0;
    const height=ACTOR_HEIGHT/BRIDGE_SCALE,width=height*sw/sh;
    shadow(a.position.x,a.position.y-2,14,5,.24);
    ctx.drawImage(im,col*sw,row*sh,sw,sh,Math.round(a.position.x-width/2),Math.round(a.position.y-height*166/172),width,height);
  };
  const drawCrew=(id:keyof typeof BRIDGE_CREW,x:number,y:number,base:'down'|'up'|'left'|'right',reaction:number)=>{
    const attentive=s.arriving?s.arrival>=reaction:Math.hypot(s.actor.position.x-x,s.actor.position.y-y)<180;
    let direction=base;
    if(attentive){const dx=s.actor.position.x-x,dy=s.actor.position.y-y;direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')}
    const col={down:0,up:1,left:2,right:3}[direction],b=BRIDGE_CREW[id].frames[col];
    const h=91,w=h*b[2]/b[3],top=y-h*.83;
    // A single measured sprite frame, with seated lower-leg compression.
    ctx.drawImage(images[id],b[0],b[1],b[2],b[3]*.72,x-w/2,top,w,h*.72);
    ctx.drawImage(images[id],b[0],b[1]+b[3]*.72,b[2],b[3]*.28,x-w/2,top+h*.72,w,h*.11);
  };
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(images['bridge-background-clean'],0,0,1254,1254);
  // Ring and well are physical layers; projection effects remain independently attachable.
  ctx.save();ellipse(627,601,127,106);ctx.clip();ctx.fillStyle='#07101e';ctx.fill();sprite('elevator_well_clean',499,487,256,226);ctx.restore();
  ring(false);
  const arrival=bridgeArrival(s.arrival),offset=s.arriving?arrival.offset:0;
  ctx.save();ellipse(627,601,119,101);ctx.clip();ctx.save();ellipse(627,601+offset,119,98);ctx.clip();
  ctx.drawImage(images.elevator_platform,290,331,675,525,508,503+offset,238,196);
  if(s.arriving){ctx.fillStyle=`rgba(1,9,20,${.62*(1-arrival.rise)})`;ctx.fillRect(506,500+offset,242,202)}ctx.restore();
  if(s.arriving&&arrival.underground)drawPlayer();ctx.restore();ring(true);
  const draws:{depth:number;draw:()=>void}[]=BRIDGE_PIECES.map(p=>({depth:p.rect[1]+p.rect[3],draw:()=>{const[x,y,w,h]=p.rect;shadow(x+w/2,y+h-3,w*.39,5,.13);sprite(p.id,x,y,w,h)}}));
  draws.push({depth:262,draw:()=>drawCrew('crew-command',627,250,'down',.35)},
    {depth:652,draw:()=>drawCrew('crew-navigation',195,616,'right',.7)},
    {depth:652,draw:()=>drawCrew('crew-comms',1059,616,'left',1.05)});
  if(!s.arriving||!arrival.underground)draws.push({depth:s.actor.position.y,draw:drawPlayer});
  draws.sort((a,b)=>a.depth-b.depth).forEach(d=>d.draw());
  // The south parapet occludes feet close to the wall, using the same base art.
  ctx.drawImage(images['bridge-background-clean'],130,944,994,136,130,944,994,136);
  if(!s.reducedMotion){
    const pulse=.06+.035*Math.sin(s.ambient*.7);ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(80,198,255,${pulse})`;
    ctx.fillRect(565,271,124,16);ctx.fillRect(261,550,29,105);ctx.fillRect(963,550,27,105);ctx.restore();
  }
  if(s.destination&&!s.arriving){ctx.strokeStyle='#a9f1ddaa';ctx.lineWidth=1.5;ellipse(s.destination.x,s.destination.y,12,5);ctx.stroke()}
  if(s.nearbyId==='lift'&&!s.arriving){ctx.strokeStyle='#a5efdf99';ctx.lineWidth=1.5;ellipse(627,601,35,22);ctx.stroke()}
}
