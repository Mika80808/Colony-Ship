export type Direction = 'down' | 'up' | 'left' | 'right';
export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export const BRIDGE_SCALE = 1.5;
export const BRIDGE_WIDTH = 1254 * BRIDGE_SCALE, BRIDGE_HEIGHT = 1090 * BRIDGE_SCALE;
export const BRIDGE_SPAWN: Point = { x: 627, y: 601 };
export const BRIDGE_LANDING: Point = { x: 627, y: 807 };
export const BRIDGE_SPEED = 160 / BRIDGE_SCALE;
export const BRIDGE_FOOT = { x: 12, y: 7 };
export const BRIDGE_FLOOR: Point[] = [
  {x:139,y:307},{x:169,y:228},{x:315,y:191},{x:939,y:191},{x:1086,y:228},
  {x:1115,y:307},{x:1115,y:816},{x:1060,y:886},{x:998,y:934},{x:256,y:934},{x:198,y:888},{x:139,y:816},
];
export const BRIDGE_OBSTACLES: Rect[] = [
  {x:458,y:253,width:338,height:103},
  {x:458,y:211,width:74,height:67},{x:722,y:211,width:74,height:67},
  {x:590,y:192,width:74,height:70},
  {x:242,y:512,width:77,height:193},{x:208,y:459,width:79,height:68},{x:208,y:693,width:79,height:65},
  {x:935,y:512,width:77,height:193},{x:967,y:459,width:79,height:68},{x:967,y:693,width:79,height:65},
  {x:148,y:557,width:84,height:91},{x:1022,y:557,width:84,height:91},
  {x:164,y:221,width:57,height:45},{x:1034,y:221,width:57,height:45},
];
export interface BridgeInteraction { id: string; label: string; point: Point; bounds: Rect; text: string; map?: boolean }
export const BRIDGE_INTERACTIONS: BridgeInteraction[] = [
  {id:'lift',label:'開啟星圖',point:{x:627,y:615},bounds:{x:502,y:498,width:250,height:204},text:'中央廣場與艦橋之間的升降平台。目的地由星圖選擇。',map:true},
  {id:'command',label:'查看指揮台',point:{x:627,y:398},bounds:{x:458,y:210,width:338,height:148},text:'指揮台正顯示全艦航行狀態。值勤人員抬頭向你示意，隨後讓出螢幕前的視線。'},
  {id:'navigation',label:'查看導航台',point:{x:365,y:608},bounds:{x:207,y:458,width:112,height:302},text:'導航台上標示著目前航線與周邊星域。幾道藍色訊號安靜地沿著座標移動。'},
  {id:'comms',label:'查看通訊台',point:{x:889,y:608},bounds:{x:935,y:458,width:112,height:302},text:'通訊台維持著各艙區的聯絡。值勤人員稍稍側身，讓你看見正在更新的訊息。'},
  {id:'window',label:'眺望星空',point:{x:850,y:223},bounds:{x:325,y:0,width:606,height:99},text:'觀景窗外，行星的弧面泛著淡藍色光。艦橋的低鳴聲讓這片星空顯得更加安靜。'},
];
export function insideFloor(p: Point) {
  let inside=false;
  for(let i=0,j=BRIDGE_FLOOR.length-1;i<BRIDGE_FLOOR.length;j=i++){
    const a=BRIDGE_FLOOR[i],b=BRIDGE_FLOOR[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
function onRaisedRim(p: Point) {
  if(Math.abs(p.x-627)<39&&p.y>=601)return false;
  const outer=((p.x-627)/163)**2+((p.y-601)/145)**2;
  const inner=((p.x-627)/113)**2+((p.y-601)/95)**2;
  return outer<1&&inner>1;
}
export function bridgeWalkable(p: Point): boolean {
  const probes=[p,{x:p.x-BRIDGE_FOOT.x,y:p.y},{x:p.x+BRIDGE_FOOT.x,y:p.y},{x:p.x,y:p.y-BRIDGE_FOOT.y},{x:p.x,y:p.y+BRIDGE_FOOT.y}];
  return probes.every(q=>insideFloor(q)&&!onRaisedRim(q))&&!BRIDGE_OBSTACLES.some(r=>p.x+BRIDGE_FOOT.x>r.x&&p.x-BRIDGE_FOOT.x<r.x+r.width&&p.y+BRIDGE_FOOT.y>r.y&&p.y-BRIDGE_FOOT.y<r.y+r.height);
}
export function bridgeSegmentClear(a: Point,b: Point) {
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
  for(let i=0;i<=steps;i++)if(!bridgeWalkable({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;
  return true;
}
export function bridgeMove(p: Point,dx: number,dy: number): Point {
  let next={...p};const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  for(let i=0;i<steps;i++){
    const x={x:next.x+dx/steps,y:next.y};if(bridgeSegmentClear(next,x))next=x;
    const y={x:next.x,y:next.y+dy/steps};if(bridgeSegmentClear(next,y))next=y;
  }return next;
}
export function bridgePath(from: Point,to: Point): Point[] {
  if(!bridgeWalkable(from)||!bridgeWalkable(to))return [];
  if(bridgeSegmentClear(from,to))return [{...to}];
  const step=16,key=(p:Point)=>`${p.x},${p.y}`;
  const connect=(p:Point)=>{
    const c={x:Math.round(p.x/step)*step,y:Math.round(p.y/step)*step};
    return [c,...[[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,step],[step,-step],[-step,-step]].map(([x,y])=>({x:c.x+x,y:c.y+y}))]
      .filter(q=>bridgeSegmentClear(p,q)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  };
  const start=connect(from),goal=connect(to);if(!start||!goal)return [];
  const queue=[start],parents=new Map<string,Point|null>([[key(start),null]]);
  for(let i=0;i<queue.length;i++){
    const p=queue[i];
    if(key(p)===key(goal)){
      const path:Point[]=[to];let cursor:Point|null=p;
      while(cursor){path.unshift(cursor);cursor=parents.get(key(cursor))??null}
      // Simplify without skipping a blocked edge or cutting a furniture corner.
      const result:Point[]=[];let anchor=from,index=0;
      while(index<path.length){let far=index;while(far+1<path.length&&bridgeSegmentClear(anchor,path[far+1]))far++;result.push(path[far]);anchor=path[far];index=far+1}return result;
    }
    for(const[dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]){
      const next={x:p.x+dx,y:p.y+dy};if(!parents.has(key(next))&&bridgeSegmentClear(p,next)){parents.set(key(next),p);queue.push(next)}
    }
  }return [];
}
export interface BridgeActor { position:Point; direction:Direction; path:Point[]; moving:boolean; elapsed:number }
export function createBridgeActor():BridgeActor{return{position:{...BRIDGE_SPAWN},direction:'down',path:[],moving:false,elapsed:0}}
export function updateBridgeActor(actor:BridgeActor,dt:number,keys:ReadonlySet<string>){
  let dx=Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a'));
  let dy=Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'));
  actor.moving=false;
  const face=()=>{actor.direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')};
  if(dx||dy){actor.path=[];face();const d=BRIDGE_SPEED*dt/Math.hypot(dx,dy),before=actor.position;actor.position=bridgeMove(before,dx*d,dy*d);actor.moving=Math.hypot(before.x-actor.position.x,before.y-actor.position.y)>.001}
  else{
    let remaining=BRIDGE_SPEED*dt;
    while(actor.path.length&&remaining>0){const p=actor.path[0];dx=p.x-actor.position.x;dy=p.y-actor.position.y;const d=Math.hypot(dx,dy);if(d<.01){actor.path.shift();continue}face();const step=Math.min(d,remaining),next={x:actor.position.x+dx/d*step,y:actor.position.y+dy/d*step};if(!bridgeSegmentClear(actor.position,next)){actor.path=[];break}actor.position=next;actor.moving=true;remaining-=step;if(step===d)actor.path.shift()}
  }
  actor.elapsed=actor.moving?actor.elapsed+dt:0;
}
export const bridgeNearby=(p:Point)=>BRIDGE_INTERACTIONS.filter(i=>Math.hypot(p.x-i.point.x,p.y-i.point.y)<=62).sort((a,b)=>Math.hypot(p.x-a.point.x,p.y-a.point.y)-Math.hypot(p.x-b.point.x,p.y-b.point.y))[0];
export const bridgeClicked=(p:Point)=>BRIDGE_INTERACTIONS.find(i=>p.x>=i.bounds.x&&p.x<=i.bounds.x+i.bounds.width&&p.y>=i.bounds.y&&p.y<=i.bounds.y+i.bounds.height);
export const BRIDGE_ARRIVAL_END=6.6;
export function bridgeArrival(time:number){
  const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)};
  const rise=smooth((time-.35)/2.8),walk=smooth((time-3.8)/2.8);
  return{rise,offset:220*(1-rise),position:{x:627,y:601+220*(1-rise)+206*walk},walking:time>3.8&&time<6.6,underground:time<3.15,done:time>=6.6};
}
