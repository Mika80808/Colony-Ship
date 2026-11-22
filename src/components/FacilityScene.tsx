import { loadImage as load } from '../utils/loadImage';
import { useSceneKeys } from './useSceneKeys';
import { useEffect, useRef, useState } from 'react';
import type { Point } from '../game/corridor';
import { DoorSpec, Facing, FacilityInteraction, FacilityMap, arrivalDirection, camera, clicked, doorBlocks, doorDistance, doorStand, doorsOf, edgeExit, findPath, interactions, keyboardTarget, move, nearby, spawn, stepDoor, walkable, withDoorClosed, worldSize } from '../game/facility';
import { pathToNearest } from '../game/clickWalk';
import { FacilityNpc, canTalk, createNpc, stepNpc } from '../game/facilityNpc';
import type { SceneApi, SceneExtras } from '../game/sceneExtras';
import { ACTOR_HEIGHT, approach, fitViewport } from '../game/viewport';
import { drawSeatedPose } from '../game/seatedPose';
import { CropsMeta, RacksMeta, layoutRack, rackBounds, rackKey } from '../game/racks';
import { dayNumber, stageAt } from '../game/growth';
import { baseOverhang, besideByShape, decorSprites, spriteFor, trackX } from '../game/decor';
import { Fish, WaterMask, drawFish, rng, spawnFish, stepFish } from '../game/fish';
import { Box, frontOutline, overlapOrder, underPlayer } from '../game/sceneDepth';
import { GardenState, needsWater, stageOf } from '../game/garden';

/** 穿過通往別處的門（房門）時，門開到底後畫面淡出的秒數。 */
const LEAVE_FADE = .3;
/** 一扇門：map.json 的設定、門框與門扇的圖、開啟程度（0 關～1 開）、是否要開。 */
interface SceneDoor { spec: DoorSpec; art: { left: HTMLImageElement; right: HTMLImageElement; frame?: HTMLImageElement }; open: number; wanted: boolean }

/** 畫在地面之上、要和玩家排前後的東西：依底部 y 由上到下畫，玩家插在自己腳的位置。box 是圖的範圍，疊到的物件照底邊排前後。 */
interface Standing { bottom: number; id?: string; sprite?: string; left?: number; right?: number; beside?: boolean; box?: Box; front?: (x: number) => number; draw: (ctx: CanvasRenderingContext2D) => void }

interface Props {
  facility: { folder: string; name: string };
  /** Sector the player walked in from; they appear inside that doorway. */
  arrivedFrom?: string | null;
  paused: boolean;
  /** Walk out through a doorway into the sector beyond it. */
  onLeave: (to: string) => void;
  onNotice: (text: string) => void;
  /** 每幀走了幾 px（推進遊戲時間用，見 game/clock.ts）。 */
  onWalk?: (px: number) => void;
  /** Supply the GM with the player's current map coordinates without re-rendering the scene. */
  onPosition?: (point: Point) => void;
  /** 有遊戲邏輯的互動（例：出貨籃）交給 App；回傳文字會顯示在物件旁。 */
  /** 回傳文字＝顯示在物件旁；true＝已處理（例如開了視窗），不顯示；false＝顯示 map.json 的文字。 */
  onAction?: (item: FacilityInteraction) => string | boolean;
  /** 遊戲時間：自動植栽區的作物依此決定生長階段。 */
  gameDate: string;
  gameTime: string;
  /** 玩家菜圃的狀態：畫在 map.json 第一塊 plots 上，一格一株。 */
  garden?: GardenState;
  /** 在這個場景裡的 NPC（行走圖 4 方向 × 4 幀）；在 map.json 的 patrol 停靠點之間巡遊。 */
  npcs?: { id: string; name: string; walkUrl?: string }[];
  /** 走到 NPC 旁邊按 E。 */
  onTalk?: (id: string) => void;
  /** 場景專屬的演出（淋浴、艦橋抵達……），見 game/sceneExtras.ts。 */
  extras?: SceneExtras;
  /** 全景：整個場景縮放到放得進畫面，鏡頭不跟（艦橋預設）。省略＝放大跟隨角色。 */
  overview?: boolean;
  /** 角色身邊可以按 E 的東西變了（外框顯示「查看指揮台 · E」這類按鈕用）。 */
  onNearby?: (item: { id: string; label: string } | null) => void;
  /** 外框的按鈕要觸發 E 鍵互動時用。 */
  controlRef?: React.MutableRefObject<{ interact(): void } | null>;
}
export default function FacilityScene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef(props); controls.current = props;
  const [status, setStatus] = useState(`正在載入${props.facility.name}…`);
  const state = useRef({ map: null as FacilityMap | null, p: { x: 0, y: 0 } as Point, path: [] as Point[], direction: 'up', elapsed: 0, camera: { x: 0, y: 0 }, settled: false, view: { width: 1600, height: 996 }, items: [] as FacilityInteraction[], pending: null as FacilityInteraction | null, seated: null as { id: string; exit: Point; sortY?: number; on?: string; lying?: boolean } | null, fade: 0, gone: false, notice: null as { item: FacilityInteraction; text: string; until: number } | null, grid: false, standing: [] as Standing[], later: [] as number[][], fish: [] as Fish[], water: null as WaterMask | null, paintRacks: null as ((day: number) => void) | null, doors: [] as SceneDoor[], leaving: null as SceneDoor | null, npcs: new Map<string, FacilityNpc>(), npcSprites: new Map<string, HTMLImageElement>(), overlays: [] as { image: HTMLImageElement; x: number; y: number }[] });
  const act = (item?: FacilityInteraction) => {
    const s = state.current;
    if (!s.map || controls.current.paused || isLocked()) return;
    if (s.seated) { s.p = s.seated.exit; s.seated = null; if (!item) return; }
    if (!item) {
      // 按 E：旁邊有能說話的 NPC，而且比最近的互動物件還近，就跟 NPC 說話
      const talk = presentNpcs().filter(n => canTalk(s.map!, s.p, n))
        .sort((a, b) => Math.hypot(a.position.x - s.p.x, a.position.y - s.p.y) - Math.hypot(b.position.x - s.p.x, b.position.y - s.p.y))[0];
      const thing = keyboardTarget(s.p, s.items);
      if (talk && (!thing || Math.hypot(talk.position.x - s.p.x, talk.position.y - s.p.y) <= Math.hypot(thing.point.x - s.p.x, thing.point.y - s.p.y))) {
        s.path = []; s.pending = null; keys.current.clear(); controls.current.onTalk?.(talk.id); return;
      }
    }
    item ??= keyboardTarget(s.p, s.items); if (!item) return;
    s.path = []; s.pending = null; keys.current.clear();
    if (item.kind === 'exit' && item.to) controls.current.onLeave(item.to);
    else if (item.kind === 'door') {
      const door = s.doors.find(d => d.spec.id === item!.id); if (!door) return;
      // 上鎖的門（別人的房門）：只顯示文字
      if (door.spec.locked) { s.notice = { item, text: door.spec.locked, until: performance.now() + 4500 }; return; }
      // 按 E 開門；開著時再按一次關上（站在門洞裡不能關）
      const inPassage = doorDistance(s.map, door.spec, s.p) === 0;
      if (!(door.wanted && inPassage)) door.wanted = !door.wanted;
      // 通往別處的門（走廊的房門）：開到底就離開
      s.leaving = door.spec.to && door.wanted ? door : null;
    }
    else if ((item.kind === 'seat' || item.kind === 'bed') && item.seat) { s.seated = { id: item.id, exit: item.exit ?? item.point, sortY: item.sortY, on: item.seatDecor, lying: item.kind === 'bed' }; s.p = item.seat; s.direction = item.facing ?? 'down'; s.notice = null; }
    else {
      // An empty text means the object has no tip: show no bubble at all.
      const response = controls.current.onAction?.(item), text = response === true ? '' : response || item.text;
      if (text) s.notice = { item, text, until: performance.now() + 4500 };
    }
  };
  /** 目前在場的 NPC（App 給的名單）：第一次出現時照 patrol 分配起點。 */
  const presentNpcs = () => {
    const s = state.current; if (!s.map) return [];
    return (controls.current.npcs ?? []).map((npc, index) => {
      let actor = s.npcs.get(npc.id);
      if (!actor) { actor = createNpc(s.map!, npc.id, index); s.npcs.set(npc.id, actor); }
      return actor;
    });
  };
  /** 現在不能動：正在穿過房門離開、已經離開，或場景擴充說不行（例：抵達演出中）。 */
  const isLocked = () => {
    const s = state.current, extras = controls.current.extras;
    if (s.gone || (s.leaving && s.leaving.open > 0)) return true;
    if (!s.map || !extras?.locked || !apiRef.current) return false;
    return extras.locked(apiRef.current(performance.now(), false));
  };
  /** 產生給場景擴充的狀態（場景載好之後才有）。 */
  const apiRef = useRef<((time: number, moving: boolean) => SceneApi) | null>(null);
  const actRef = useRef(act); actRef.current = act;
  if (props.controlRef) props.controlRef.current = { interact: () => actRef.current() };
  // 切換全景／放大跟隨時重新算畫面大小
  const refit = useRef<() => void>(() => {});
  useEffect(() => { refit.current(); }, [props.overview]);
  const { keys, axis, onKeyDown, onKeyUp, onBlur } = useSceneKeys({ paused: props.paused, onInteract: () => actRef.current() });
  // 時間推進時作物跟著長；還沒載好的話，載好時會用當下時間畫第一次。
  useEffect(() => { state.current.paintRacks?.(dayNumber(props.gameDate, props.gameTime)); }, [props.gameDate, props.gameTime]);
  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    let disposed = false, raf = 0, last = 0;
    const fit = (w: number, h: number) => {
      const s = state.current; if (!s.map) return;
      const world = worldSize(s.map);
      // 全景：整個世界放進畫面；否則照共用的視窗規格放大跟隨
      const view = controls.current.overview ? { width: world.width, height: world.height, scale: Math.min(w / world.width, h / world.height) } : fitViewport(w, h, world.width, world.height);
      s.view = view; s.settled = false;
      canvas.width = Math.round(view.width); canvas.height = Math.round(view.height);
      canvas.style.width = `${view.width * view.scale}px`; canvas.style.height = `${view.height * view.scale}px`;
    };
    const resize = new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height)); resize.observe(canvas.parentElement!);
    refit.current = () => { const box = canvas.parentElement!.getBoundingClientRect(); fit(box.width, box.height); };
    /**
     * 每座種植架先畫成一張素材像素大小的圖（外框 + 作物），render 時整張放大，不用每格重算。
     * 回傳的 paint 依遊戲時間重畫作物的生長階段；三個階段的圖一開始就全部載好，換階段不用等。
     */
    async function loadRacks(folder: string, map: FacilityMap) {
      if (!map.racks?.length) return { racks: [], paint: () => {}, images: new Map<string, HTMLImageElement>() };
      const specs = map.racks;
      const json = async <T,>(src: string) => { const r = await fetch(src); if (!r.ok) throw new Error(src); return r.json() as Promise<T>; };
      const [meta, crops] = await Promise.all([json<RacksMeta>(`/assets/${folder}/racks.json`), json<CropsMeta>(`/assets/${folder}/crops/crops.json`)]);
      const frames = { shelf: await load(`/assets/${folder}/rack_shelf.webp`), trellis: await load(`/assets/${folder}/rack_trellis.webp`) };
      const names = [...new Set(specs.flatMap(r => r.crops))].filter(c => crops[c]).flatMap(c => [1, 2, 3].map(i => `${c}_${i}`));
      const images = new Map(await Promise.all(names.map(async n => [n, await load(`/assets/${folder}/crops/${n}.webp`)] as const)));
      const racks = specs.map(r => { const image = document.createElement('canvas'); image.width = meta.width; image.height = meta.height; return { image, id: `rack-${rackKey(r)}`, ...rackBounds(r, meta, map.tileSize) }; });
      const paint = (day: number) => specs.forEach((r, i) => {
        const g = racks[i].image.getContext('2d')!;
        g.clearRect(0, 0, meta.width, meta.height); g.drawImage(frames[r.kind], 0, 0);
        for (const p of layoutRack(r, meta, crops, crop => stageAt(crop, rackKey(r), day))) { const im = images.get(`${p.crop}_${p.stage}`)!; g.drawImage(im, p.x, p.bottom - im.height); }
      });
      return { racks, paint, images };
    }
    /** 樹、花：每張圖以底部中心對齊 map.json 的位置；有 {season} 的依當下遊戲日期挑圖。 */
    async function loadDecor(folder: string, map: FacilityMap): Promise<Standing[]> {
      const specs = map.decor ?? [], T = map.tileSize;
      const images = new Map(await Promise.all(decorSprites(specs).map(async n => [n, await load(`/assets/${folder}/props/${n}.webp`)] as const)));
      // 每張圖往兩側懸空伸出多少（圖的像素），決定角色站在旁邊時畫在前面還是被蓋住
      const overhang = new Map([...images].map(([n, im]) => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(im, 0, 0);
        return [n, baseOverhang(g.getImageData(0, 0, im.width, im.height).data, im.width, im.height)] as const;
      }));
      return specs.map(d => {
        const im = images.get(spriteFor(d, controls.current.gameDate))!, w = im.width * d.scale, h = im.height * d.scale;
        const left = d.x * T - w / 2, right = d.x * T + w / 2;
        const box = d.anim ? { left: d.anim.clip[0], top: d.anim.clip[1], right: d.anim.clip[0] + d.anim.clip[2], bottom: d.anim.clip[1] + d.anim.clip[3] }
          : { left, top: d.y * T - h, right, bottom: d.y * T };
        // 沿著輪廓的碰撞：排前後用角色腳下那一段的底邊，跟碰撞同一條線
        const front = d.id ? frontOutline(map.collisionRects ?? [], d.id, T, d.y * T) : undefined;
        return {
        bottom: (d.sortY ?? d.y) * T,
        id: d.id ?? d.sprite,
        sprite: d.sprite,
        // 沒有往兩側懸空的物件（桌、櫃台、床）：角色站在左右兩側之外時畫在前面，才不會被桌面蓋住臉；
        // 樹冠這種懸空的照腳點排。map.json 有寫 beside 就照寫的
        beside: d.beside ?? besideByShape(overhang.get(spriteFor(d, controls.current.gameDate))! * d.scale),
        left, right, box, front,
        draw: (c: CanvasRenderingContext2D) => {
          const im = images.get(spriteFor(d, controls.current.gameDate))!, w = im.width * d.scale, h = im.height * d.scale;
          c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; // 2 倍圖縮成一半時才不會鋸齒、細線斷掉
          if (d.anim) {   // 沿軌道移動的零件：只畫在 clip 範圍裡，滑出去就看不見
            const [cx, cy, cw, ch] = d.anim.clip, x = trackX(d.anim, performance.now() / 1000, w);
            c.save(); c.beginPath(); c.rect(cx, cy, cw, ch); c.clip(); c.drawImage(im, x - w / 2, d.anim.top, w, h); c.restore();
          }
          else if (d.flip) { c.save(); c.translate(d.x * T, 0); c.scale(-1, 1); c.drawImage(im, -w / 2, d.y * T - h, w, h); c.restore(); }
          else c.drawImage(im, d.x * T - w / 2, d.y * T - h, w, h);
        },
      }; });
    }
    /** 水面遮罩（water.webp，1 px = 8 px 世界座標）；沒有就不放魚。 */
    async function loadWater(folder: string, map: FacilityMap): Promise<WaterMask | null> {
      if (!map.fish) return null;
      const im = await load(`/assets/${folder}/water.webp`).catch(() => null);
      if (!im) return null;
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d')!; g.drawImage(im, 0, 0);
      const px = g.getImageData(0, 0, im.width, im.height).data, water = new Uint8Array(im.width * im.height);
      for (let i = 0; i < water.length; i++) water[i] = px[i * 4] > 127 ? 1 : 0;
      return { width: im.width, height: im.height, scale: worldSize(map).width / im.width, water };
    }
    /** 每扇門的門框（可省略）與兩片門扇。 */
    async function loadDoors(folder: string, map: FacilityMap): Promise<SceneDoor[]> {
      return Promise.all(doorsOf(map).map(async spec => {
        const [left, right, frame] = await Promise.all([spec.panels.left, spec.panels.right, ...(spec.frame ? [spec.frame.src] : [])].map(src => load(`/assets/${folder}/${src}`)));
        return { spec, art: { left, right, frame }, open: 0, wanted: false };
      }));
    }
    async function start() {
      const { folder } = controls.current.facility;
      const response = await fetch(`/assets/${folder}/map.json`); if (!response.ok) throw new Error('map');
      const map: FacilityMap = await response.json();
      // L0 地面是整張 ground.webp；種植架與擺設依腳點排序。
      const [background, sprite, racks, decor, water, doors, overlays] = await Promise.all([load(`/assets/${folder}/ground.webp`), load('/assets/player/walk.webp'), loadRacks(folder, map), loadDecor(folder, map), loadWater(folder, map), loadDoors(folder, map),
        Promise.all((map.foreground ?? []).map(async o => ({ image: await load(`/assets/${folder}/${o.src}`), x: o.x, y: o.y })))]);
      if (disposed) return;
      const s = state.current, world = worldSize(map);
      // 菜圃作物圖的最大尺寸（排前後用的範圍）
      const cropSize = [...racks.images.values()].reduce((m, im) => ({ width: Math.max(m.width, im.width), height: Math.max(m.height, im.height) }), { width: 0, height: 0 });
      // 種植架是放大 2 倍的像素圖（不平滑）；樹和花是從大圖縮小（要平滑）
      s.standing = [
        ...racks.racks.map(r => ({ bottom: r.bottom, box: { left: r.x, top: r.y, right: r.x + r.width, bottom: r.y + r.height }, front: frontOutline(map.collisionRects ?? [], r.id, map.tileSize, r.bottom), draw: (c: CanvasRenderingContext2D) => { c.imageSmoothingEnabled = false; c.drawImage(r.image, r.x, r.y, r.width, r.height); } })),
        ...decor,
        // 玩家菜圃：每格一株，跟角色排前後；圖放大 2 倍（跟種植架同比例），底部對齊那一格的下緣
        ...(map.plots?.[0] ? Array.from({ length: map.plots[0].w * map.plots[0].h }, (_, index) => {
          const plot = map.plots![0], T = map.tileSize, cx = (plot.x + index % plot.w + .5) * T, bottom = (plot.y + Math.floor(index / plot.w) + 1) * T - 14;
          return { bottom, box: { left: cx - cropSize.width, top: bottom - cropSize.height * 2, right: cx + cropSize.width, bottom }, draw: (c: CanvasRenderingContext2D) => {
            const cell = controls.current.garden?.cells[index]; if (!cell) return;
            const day = dayNumber(controls.current.gameDate, controls.current.gameTime);
            // 澆過水的土顏色深一點
            if (!cell.dead && !needsWater(cell, day)) { c.fillStyle = '#2b1d1255'; c.beginPath(); c.ellipse(cx, bottom - 4, 34, 12, 0, 0, Math.PI * 2); c.fill(); }
            const im = racks.images.get(`${cell.crop}_${stageOf(cell)}`); if (!im) return;
            c.imageSmoothingEnabled = false;
            if (cell.dead) c.filter = 'grayscale(1) brightness(.55)';
            c.drawImage(im, cx - im.width, bottom - im.height * 2, im.width * 2, im.height * 2);
            c.filter = 'none';
          } };
        }) : []),
        // 橫牆牆頂：從底圖切同一塊蓋回去，角色走到牆後面時就被蓋住下半身
        ...(map.walls ?? []).map(w => ({ bottom: w.bottom, left: w.left, right: w.right, beside: w.left !== undefined, box: w.rects.length ? {
          left: Math.min(...w.rects.map(r => r[0])), top: Math.min(...w.rects.map(r => r[1])),
          right: Math.max(...w.rects.map(r => r[0] + r[2])), bottom: Math.max(...w.rects.map(r => r[1] + r[3])) } : undefined, draw: (c: CanvasRenderingContext2D) => {
          const k = background.width / world.width;
          for (const [x, y, rw, rh] of w.rects) c.drawImage(background, x * k, y * k, rw * k, rh * k, x, y, rw, rh);
        } })),
      ].sort((a, b) => a.bottom - b.bottom);
      s.later = overlapOrder(s.standing);
      s.paintRacks = racks.paint;
      s.water = water; s.fish = water ? spawnFish(water, map.fish ?? 0, 7) : [];
      s.doors = doors; s.leaving = null; s.overlays = overlays;
      const fishRandom = rng(Date.now()); racks.paint(dayNumber(controls.current.gameDate, controls.current.gameTime));
      s.map = map; s.items = interactions(map); s.p = spawn(map, controls.current.arrivedFrom);
      s.direction = arrivalDirection(map, controls.current.arrivedFrom);
      controls.current.onPosition?.(s.p);
      const box = canvas.parentElement!.getBoundingClientRect(); fit(box.width, box.height);
      setStatus(''); canvas.focus({ preventScroll: true });
      /** 門扇只畫在門洞框裡，往兩側滑開；門框蓋在上面，遮住滑進牆裡的部分。 */
      const drawDoor = ({ spec, art, open }: SceneDoor, frameOnly = false) => {
        const [x, y, w, h] = spec.opening, slide = open * w / 2;
        if (!frameOnly) {
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
          ctx.drawImage(art.left, x - slide, y); ctx.drawImage(art.right, x + w / 2 + slide, y);
          ctx.restore();
        }
        if (spec.frame && art.frame) ctx.drawImage(art.frame, spec.frame.x, spec.frame.y);
      };
      /** 角色走在門洞裡、或站在門框正後方（已經走進牆頂後面）時，門框要蓋在角色上面。 */
      const inDoorway = ({ spec, art }: SceneDoor) => {
        if (!spec.frame || !art.frame) return false;
        const [, y, , h] = spec.opening;
        return s.p.x > spec.frame.x && s.p.x < spec.frame.x + art.frame.width && s.p.y > spec.frame.y && s.p.y < y + h;
      };
      // 要換色時先把這一格畫到暫存畫布，給擴充改（淋浴的膚色遮罩），再畫上去
      const frame = document.createElement('canvas'), frameCtx = frame.getContext('2d')!;
      const drawPlayer = (moving: boolean, elapsed = s.elapsed, recolor?: (frame: CanvasRenderingContext2D, width: number, height: number) => void) => {
        const sw = sprite.width / 4, sh = sprite.height / 3, h = ACTOR_HEIGHT, w = h * sw / sh;
        if (!s.seated) { ctx.fillStyle = '#05101b66'; ctx.beginPath(); ctx.ellipse(s.p.x, s.p.y - 3, 23, 7, 0, 0, Math.PI * 2); ctx.fill(); }
        const col = ({ down: 0, up: 1, left: 2, right: 3 } as Record<string, number>)[s.direction];
        const row = moving ? [0, 1, 0, 2][Math.floor(elapsed * 8) % 4] : 0;
        const x = s.p.x - w / 2, y = s.p.y - h + 5;
        let source: CanvasImageSource = sprite, sx = col * sw, sy = row * sh;
        if (recolor) {
          if (frame.width !== sw || frame.height !== sh) { frame.width = sw; frame.height = sh; }
          frameCtx.clearRect(0, 0, sw, sh); frameCtx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);
          recolor(frameCtx, sw, sh); source = frame; sx = 0; sy = 0;
        }
        if (s.seated?.lying) ctx.drawImage(sprite, 0, 0, sw, sh, x, y, w, h);   // 躺在床上：正面站姿，身體蓋在被單層下面
        else if (s.seated) {
          drawSeatedPose(ctx, sprite, col * sw, 0, sw, sh, x, s.p.y - h * .55, w, h, s.direction as 'down' | 'up' | 'left' | 'right');
        } else ctx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
      };
      /** NPC 行走圖：4 方向 × 4 幀，腳點對齊圖高的 166/172（跟房間一樣）；圖還沒載好就先不畫。 */
      const npcStanding = (npc: FacilityNpc, frozen: boolean): Standing => {
        const spec = controls.current.npcs?.find(n => n.id === npc.id);
        let image = s.npcSprites.get(npc.id);
        if (!image && spec?.walkUrl) { image = new Image(); image.src = spec.walkUrl; s.npcSprites.set(npc.id, image); }
        const ready = image && image.complete && image.naturalWidth ? image : undefined;
        const sw = ready ? ready.naturalWidth / 4 : 1, sh = ready ? ready.naturalHeight / 4 : 1, h = ACTOR_HEIGHT, w = h * sw / sh, { x, y } = npc.position;
        return { bottom: y, sprite: 'npc', box: { left: x - w / 2, top: y - h, right: x + w / 2, bottom: y + 5 }, draw: c => {
          if (!ready) return;
          c.fillStyle = '#05101b66'; c.beginPath(); c.ellipse(x, y - 3, 22, 7, 0, 0, Math.PI * 2); c.fill();
          const col = { down: 0, up: 1, left: 2, right: 3 }[npc.direction], row = npc.moving && !frozen ? Math.floor(npc.elapsed * 8) % 4 : 0;
          c.imageSmoothingEnabled = false; c.drawImage(ready, col * sw, row * sh, sw, sh, x - w / 2, y - h * (166 / 172), w, h);
        } };
      };
      /** 給場景擴充（sceneExtras.ts）的這一刻狀態；place 會清掉進行中的路徑。 */
      const sceneApi = (time: number, moving: boolean): SceneApi => ({
        map, player: s.p, direction: s.direction as Facing, seated: !!s.seated, seatedOn: s.seated?.id, moving, time, camera: s.camera, view: s.view, canvas,
        place: (p, facing) => { s.p = { ...p }; s.path = []; s.pending = null; if (facing) s.direction = facing; },
        drawPlayer: (walking, recolor) => { ctx.imageSmoothingEnabled = false; drawPlayer(walking ?? moving, walking ? time / 1000 : s.elapsed, recolor); },
      });
      apiRef.current = sceneApi;
      let lastNearby = '';
      const render = (time: number) => {
        if (disposed) return;
        const dt = Math.min((time - (last || time)) / 1000, .05); last = time;
        const frozen = controls.current.paused || document.hidden;
        let moving = false;
        const extras = controls.current.extras, locked = isLocked();
        if (!frozen) extras?.update?.(sceneApi(time, false), dt);
        if (!frozen && locked) keys.current.clear();
        if (!frozen && !locked) {
          let { dx, dy } = axis();
          if (dx || dy) { if (s.seated) { s.p = s.seated.exit; s.seated = null; } s.path = []; s.pending = null; s.notice = null; }
          else if (s.path.length) {
            dx = s.path[0].x - s.p.x; dy = s.path[0].y - s.p.y;
            if (Math.hypot(dx, dy) < 3) { s.p = s.path.shift()!; dx = 0; dy = 0; }
          }
          const distance = Math.hypot(dx, dy);
          if (distance) {
            const amount = Math.min((map.speed ?? 240) * dt, s.path.length ? distance : Infinity);
            let p = move(map, s.p, dx / distance * amount, dy / distance * amount);
            // 厚重門還沒開夠：停在門前等，路徑保留，門開了就繼續走
            if (s.doors.some(d => doorBlocks(map, d.spec, p, d.open) && !doorBlocks(map, d.spec, s.p, d.open))) p = s.p;
            const walked = Math.hypot(p.x - s.p.x, p.y - s.p.y); moving = walked > .01; s.p = p;
            if (moving) controls.current.onWalk?.(walked);
            s.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            if (moving) s.elapsed += dt;
            // 走進地圖邊界的出入口、往外走：離開到隔壁場景
            const to = edgeExit(map, s.p, dx, dy);
            if (to) { s.gone = true; keys.current.clear(); controls.current.onLeave(to); }
          }
          if (!s.path.length && s.pending) { const pending = s.pending; s.pending = null; if (nearby(s.p, [pending])) actRef.current(pending); }
        }
        if (!frozen) {
          for (const d of s.doors) {
            if (d.spec.auto) d.wanted = doorDistance(map, d.spec, s.p) < d.spec.trigger;
            else if (d.wanted && doorDistance(map, d.spec, s.p) > d.spec.trigger) d.wanted = false;   // 走遠了自己關
            d.open = stepDoor(d.spec, d.open, d.wanted, dt);
          }
          for (const npc of presentNpcs()) stepNpc(map, npc, dt, s.p);
          // 房門開到底：畫面淡出，再離開走廊、進入門後的地方
          if (s.leaving && s.leaving.open >= 1) {
            s.fade = Math.min(1, s.fade + dt / LEAVE_FADE);
            if (s.fade >= 1 && !s.gone) { s.gone = true; controls.current.onLeave(s.leaving.spec.to!); }
          }
          else if (s.leaving && !s.leaving.wanted) { s.leaving = null; s.fade = 0; }
        }
        const target = camera({ x: s.p.x, y: s.p.y - ACTOR_HEIGHT / 2 }, s.view, map);
        if (s.settled && !frozen) s.camera = { x: approach(s.camera.x, target.x, dt), y: approach(s.camera.y, target.y, dt) };
        else if (!s.settled) { s.camera = target; s.settled = true; }
        ctx.fillStyle = '#060d16'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save(); ctx.translate(-Math.round(s.camera.x), -Math.round(s.camera.y));
        ctx.imageSmoothingEnabled = true; ctx.drawImage(background, 0, 0, world.width, world.height);
        if (s.grid) {
          ctx.fillStyle = '#ff305033';
          map.collision.forEach((row, y) => row.forEach((v, x) => { if (v) ctx.fillRect(x * map.tileSize, y * map.tileSize, map.tileSize, map.tileSize); }));
          for (const r of map.collisionRects ?? []) ctx.fillRect(r.x * map.tileSize, r.y * map.tileSize, r.w * map.tileSize, r.h * map.tileSize);
        }
        // 水底下的魚影：畫在地面上、所有擺設和玩家底下
        if (s.water) for (const f of s.fish) { if (!frozen) stepFish(f, dt, s.water, fishRandom); drawFish(ctx, f); }
        const api = sceneApi(time, moving);
        extras?.drawGround?.(ctx, api);
        const item = frozen ? undefined : s.seated ? s.items.find(i => i.id === s.seated?.id) : nearby(s.p, s.items);
        for (const d of s.doors) {
          drawDoor(d);
          if (d.spec.lamp && d.open > 0 && d.open < 1) {   // 門在動：警示燈閃
            const [lx, ly] = d.spec.lamp, glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46);
            glow.addColorStop(0, `rgba(255,170,60,${.55 + .35 * Math.sin(time / 90)})`); glow.addColorStop(1, 'rgba(255,140,40,0)');
            ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly, 46, 0, Math.PI * 2); ctx.fill();
          }
        }
        // 躺在床上時用床的底邊排：床在角色下面、被單（底邊多 1 px）蓋在角色上面
        const depth = s.seated?.sortY !== undefined ? { x: s.p.x, y: s.seated.sortY } : s.p;
        const half = ACTOR_HEIGHT * (sprite.width / 4) / (sprite.height / 3) / 2;   // 角色圖半寬（跟 drawPlayer 同算法）
        // NPC 會走動：有 NPC 時每幀跟物件一起重排（物件只有幾百件，重排很便宜）
        const walkers: Standing[] = [...presentNpcs().map(n => npcStanding(n, frozen)), ...(extras?.standing?.(api) ?? [])];
        const standing = walkers.length ? [...s.standing, ...walkers].sort((a, b) => a.bottom - b.bottom) : s.standing;
        const later = walkers.length ? overlapOrder(standing) : s.later;
        const under = underPlayer(standing, later, depth, !!s.seated, { left: s.p.x - half, top: s.p.y - ACTOR_HEIGHT, right: s.p.x + half, bottom: s.p.y + 5 }, s.seated?.on);
        standing.forEach((o, i) => { if (under[i]) o.draw(ctx); });
        ctx.imageSmoothingEnabled = false;
        if (extras?.drawPlayer) extras.drawPlayer(ctx, api, () => { ctx.imageSmoothingEnabled = false; drawPlayer(moving && !frozen); });
        else drawPlayer(moving && !frozen);
        standing.forEach((o, i) => { if (!under[i]) o.draw(ctx); });
        for (const d of s.doors) if (inDoorway(d)) drawDoor(d, true);
        for (const o of s.overlays) ctx.drawImage(o.image, o.x, o.y);
        extras?.drawTop?.(ctx, api);
        ctx.imageSmoothingEnabled = false;
        if (s.path.length) { const p = s.path.at(-1)!; ctx.strokeStyle = '#71efff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
        const tip = s.notice && time < s.notice.until ? s.notice : null;
        if (s.notice && !tip) s.notice = null;
        if (tip) {
          const target = tip.item, message = tip.text;
          ctx.font = '20px sans-serif';
          const lines: string[] = [''];
          for (const character of message) {
            if (character === '\n' || ctx.measureText(lines.at(-1)! + character).width > 390) lines.push('');
            if (character !== '\n') lines[lines.length - 1] += character;
          }
          const width = Math.max(78, Math.min(420, Math.max(...lines.map(line => ctx.measureText(line).width)) + 28));
          const height = lines.length * 29 + 16;
          const x = Math.max(s.camera.x + width / 2 + 12, Math.min(s.camera.x + s.view.width - width / 2 - 12, target.area.x + target.area.width / 2));
          const above = target.area.y - height - 12;
          const y = above < s.camera.y + 12 ? target.area.y + target.area.height + 12 : above;
          ctx.fillStyle = '#081924cc'; ctx.strokeStyle = '#71efffaa'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(x - width / 2, y, width, height, 9); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#d9faff'; ctx.textAlign = 'center';
          lines.forEach((line, index) => ctx.fillText(line, x, y + 29 + index * 29));
          ctx.textAlign = 'start';
        }
        ctx.restore();
        if (s.fade > 0) { ctx.fillStyle = `rgba(4,10,20,${s.fade})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        controls.current.onPosition?.(s.p);
        const near = locked ? undefined : item;
        if ((near?.id ?? '') !== lastNearby) { lastNearby = near?.id ?? ''; controls.current.onNearby?.(near ? { id: near.id, label: near.label } : null); }
        canvas.dataset.playerPosition = `${s.p.x.toFixed(1)},${s.p.y.toFixed(1)}`; canvas.dataset.camera = `${s.camera.x.toFixed(1)},${s.camera.y.toFixed(1)}`; canvas.dataset.ready = 'true'; canvas.dataset.moving = String(moving); canvas.dataset.nearby = item?.id ?? '';
        raf = requestAnimationFrame(render);
      }; raf = requestAnimationFrame(render);
    }
    start().catch(() => { if (!disposed) setStatus(`${controls.current.facility.name}素材載入失敗，請重新整理。`); });
    return () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); keys.current.clear(); };
  }, []);
  return <div className="corridor-scene">
    <div className="corridor-viewport"><canvas ref={canvasRef} tabIndex={0} aria-label={`${props.facility.name}。WASD 移動，E 互動，G 切換碰撞格顯示，也可以點擊地面或設施。`}
      onBlur={onBlur}
      onKeyDown={e => {
        if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.altKey && !e.metaKey) { state.current.grid = !state.current.grid; return; }
        onKeyDown(e);
      }}
      onKeyUp={onKeyUp}
      onClick={e => {
        const s = state.current; if (!s.map || props.paused || isLocked()) return; e.currentTarget.focus({ preventScroll: true });
        if (s.seated) { s.p = s.seated.exit; s.seated = null; }
        const r = e.currentTarget.getBoundingClientRect(), p = { x: (e.clientX - r.left) / r.width * s.view.width + s.camera.x, y: (e.clientY - r.top) / r.height * s.view.height + s.camera.y };
        const item = clicked(p, s.items);
        if (item && nearby(s.p, s.items)?.id === item.id) { act(item); return; }
        // 門關著時不穿門找路（自動門照走，走近就開）；點門本身就走到門前（角色那一側），到了再開
        const nav = withDoorClosed(s.map, s.doors.filter(d => !d.spec.auto && !d.wanted && d.open === 0).map(d => d.spec.id));
        const door = item?.kind === 'door' ? s.doors.find(d => d.spec.id === item.id) : undefined;
        // 點到走不到的地方：走到離點擊處最近、走得到的點
        const path = pathToNearest(door ? doorStand(s.map, door.spec, s.p) : item?.point ?? p, s.p,
          to => findPath(nav, s.p, to), q => walkable(nav, q));
        s.path = path; s.pending = path.length ? item ?? null : null;
        if (!path.length) controls.current.onNotice('那裡無法通行。');
      }} />
      {status && <p role="status" className="corridor-status">{status}</p>}
    </div>
  </div>;
}
