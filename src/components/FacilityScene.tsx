import { loadImage as load } from '../utils/loadImage';
import { useSceneKeys } from './useSceneKeys';
import { useEffect, useRef, useState } from 'react';
import type { Point } from '../game/corridor';
import { FacilityInteraction, FacilityMap, arrivalDirection, camera, clicked, doorBlocks, doorDistance, doorStand, findPath, interactions, keyboardTarget, move, nearby, spawn, stepDoor, withDoorClosed, worldSize } from '../game/facility';
import { ACTOR_HEIGHT, approach, fitViewport } from '../game/viewport';
import { CropsMeta, RacksMeta, layoutRack, rackBounds, rackKey } from '../game/racks';
import { dayNumber, stageAt } from '../game/growth';
import { decorSprites, spriteFor } from '../game/decor';
import { Fish, WaterMask, drawFish, rng, spawnFish, stepFish } from '../game/fish';
import { drawBeforePlayer } from '../game/sceneDepth';

/** 畫在地面之上、要和玩家排前後的東西：依底部 y 由上到下畫，玩家插在自己腳的位置。 */
interface Standing { bottom: number; sprite?: string; left?: number; right?: number; draw: (ctx: CanvasRenderingContext2D) => void }

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
}
export default function FacilityScene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef(props); controls.current = props;
  const [status, setStatus] = useState(`正在載入${props.facility.name}…`);
  const state = useRef({ map: null as FacilityMap | null, p: { x: 0, y: 0 } as Point, path: [] as Point[], direction: 'up', elapsed: 0, camera: { x: 0, y: 0 }, settled: false, view: { width: 1600, height: 996 }, items: [] as FacilityInteraction[], pending: null as FacilityInteraction | null, seated: null as { id: string; exit: Point } | null, notice: null as { item: FacilityInteraction; text: string; until: number } | null, grid: false, standing: [] as Standing[], fish: [] as Fish[], water: null as WaterMask | null, paintRacks: null as ((day: number) => void) | null, door: null as { frame: HTMLImageElement; left: HTMLImageElement; right: HTMLImageElement } | null, doorOpen: 0, doorWanted: false, closedMap: null as FacilityMap | null, overlays: [] as { image: HTMLImageElement; x: number; y: number }[] });
  const act = (item?: FacilityInteraction) => {
    const s = state.current;
    if (!s.map || controls.current.paused) return;
    if (s.seated) { s.p = s.seated.exit; s.seated = null; if (!item) return; }
    item ??= keyboardTarget(s.p, s.items); if (!item) return;
    s.path = []; s.pending = null; keys.current.clear();
    if (item.kind === 'exit' && item.to) controls.current.onLeave(item.to);
    else if (item.kind === 'door') {
      // 按 E 開門；開著時再按一次關上（站在門洞裡不能關）
      const inPassage = s.map.door && doorDistance(s.map, s.map.door, s.p) === 0;
      if (!(s.doorWanted && inPassage)) s.doorWanted = !s.doorWanted;
    }
    else if (item.kind === 'seat' && item.seat) { s.seated = { id: item.id, exit: item.exit ?? item.point }; s.p = item.seat; s.direction = 'down'; s.notice = null; }
    else {
      // An empty text means the object has no tip: show no bubble at all.
      const response = controls.current.onAction?.(item), text = response === true ? '' : response || item.text;
      if (text) s.notice = { item, text, until: performance.now() + 4500 };
    }
  };
  const actRef = useRef(act); actRef.current = act;
  const { keys, axis, onKeyDown, onKeyUp, onBlur } = useSceneKeys({ paused: props.paused, onInteract: () => actRef.current() });
  // 時間推進時作物跟著長；還沒載好的話，載好時會用當下時間畫第一次。
  useEffect(() => { state.current.paintRacks?.(dayNumber(props.gameDate, props.gameTime)); }, [props.gameDate, props.gameTime]);
  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    let disposed = false, raf = 0, last = 0;
    const fit = (w: number, h: number) => {
      const s = state.current; if (!s.map) return;
      const world = worldSize(s.map), view = fitViewport(w, h, world.width, world.height);
      s.view = view; s.settled = false;
      canvas.width = Math.round(view.width); canvas.height = Math.round(view.height);
      canvas.style.width = `${view.width * view.scale}px`; canvas.style.height = `${view.height * view.scale}px`;
    };
    const resize = new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height)); resize.observe(canvas.parentElement!);
    /**
     * 每座種植架先畫成一張素材像素大小的圖（外框 + 作物），render 時整張放大，不用每格重算。
     * 回傳的 paint 依遊戲時間重畫作物的生長階段；三個階段的圖一開始就全部載好，換階段不用等。
     */
    async function loadRacks(folder: string, map: FacilityMap) {
      if (!map.racks?.length) return { racks: [], paint: () => {} };
      const specs = map.racks;
      const json = async <T,>(src: string) => { const r = await fetch(src); if (!r.ok) throw new Error(src); return r.json() as Promise<T>; };
      const [meta, crops] = await Promise.all([json<RacksMeta>(`/assets/${folder}/racks.json`), json<CropsMeta>(`/assets/${folder}/crops/crops.json`)]);
      const frames = { shelf: await load(`/assets/${folder}/rack_shelf.webp`), trellis: await load(`/assets/${folder}/rack_trellis.webp`) };
      const names = [...new Set(specs.flatMap(r => r.crops))].filter(c => crops[c]).flatMap(c => [1, 2, 3].map(i => `${c}_${i}`));
      const images = new Map(await Promise.all(names.map(async n => [n, await load(`/assets/${folder}/crops/${n}.webp`)] as const)));
      const racks = specs.map(r => { const image = document.createElement('canvas'); image.width = meta.width; image.height = meta.height; return { image, ...rackBounds(r, meta, map.tileSize) }; });
      const paint = (day: number) => specs.forEach((r, i) => {
        const g = racks[i].image.getContext('2d')!;
        g.clearRect(0, 0, meta.width, meta.height); g.drawImage(frames[r.kind], 0, 0);
        for (const p of layoutRack(r, meta, crops, crop => stageAt(crop, rackKey(r), day))) { const im = images.get(`${p.crop}_${p.stage}`)!; g.drawImage(im, p.x, p.bottom - im.height); }
      });
      return { racks, paint };
    }
    /** 樹、花：每張圖以底部中心對齊 map.json 的位置；有 {season} 的依當下遊戲日期挑圖。 */
    async function loadDecor(folder: string, map: FacilityMap): Promise<Standing[]> {
      const specs = map.decor ?? [], T = map.tileSize;
      const images = new Map(await Promise.all(decorSprites(specs).map(async n => [n, await load(`/assets/${folder}/props/${n}.webp`)] as const)));
      return specs.map(d => ({
        bottom: d.y * T,
        sprite: d.sprite,
        left: d.x * T - images.get(spriteFor(d, controls.current.gameDate))!.width * d.scale / 2,
        right: d.x * T + images.get(spriteFor(d, controls.current.gameDate))!.width * d.scale / 2,
        draw: (c: CanvasRenderingContext2D) => {
          const im = images.get(spriteFor(d, controls.current.gameDate))!, w = im.width * d.scale, h = im.height * d.scale;
          c.imageSmoothingEnabled = true;
          if (d.flip) { c.save(); c.translate(d.x * T, 0); c.scale(-1, 1); c.drawImage(im, -w / 2, d.y * T - h, w, h); c.restore(); }
          else c.drawImage(im, d.x * T - w / 2, d.y * T - h, w, h);
        },
      }));
    }
    /** 水面遮罩（facility_ground.py 產生的 water.webp，1 px = 8 px 世界座標）；沒有就不放魚。 */
    async function loadWater(folder: string, map: FacilityMap): Promise<WaterMask | null> {
      if (!map.fish) return null;
      const im = await load(`/assets/${folder}/water.webp`).catch(() => null);
      if (!im) return null;
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d')!; g.drawImage(im, 0, 0);
      const px = g.getImageData(0, 0, im.width, im.height).data, water = new Uint8Array(im.width * im.height);
      for (let i = 0; i < water.length; i++) water[i] = px[i * 4] > 127 ? 1 : 0;
      return { width: im.width, height: im.height, scale: map.width * map.tileSize / im.width, water };
    }
    /** 自動門的門框與兩片門扇。 */
    async function loadDoor(folder: string, map: FacilityMap) {
      if (!map.door) return null;
      const [frame, left, right] = await Promise.all([map.door.frame.src, map.door.panels.left, map.door.panels.right].map(src => load(`/assets/${folder}/${src}`)));
      return { frame, left, right };
    }
    async function start() {
      const { folder } = controls.current.facility;
      const response = await fetch(`/assets/${folder}/map.json`); if (!response.ok) throw new Error('map');
      const map: FacilityMap = await response.json();
      // L0 地面由 tools/art/facility_ground.py 依 map.json 的 terrain 拼成；種植架與擺設依腳點排序。
      const [background, sprite, racks, decor, water, door, overlays] = await Promise.all([load(`/assets/${folder}/ground.webp`), load('/assets/player/walk.webp'), loadRacks(folder, map), loadDecor(folder, map), loadWater(folder, map), loadDoor(folder, map),
        Promise.all((map.foreground ?? []).map(async o => ({ image: await load(`/assets/${folder}/${o.src}`), x: o.x, y: o.y })))]);
      if (disposed) return;
      const s = state.current, world = worldSize(map);
      // 種植架是放大 2 倍的像素圖（不平滑）；樹和花是從大圖縮小（要平滑）
      s.standing = [
        ...racks.racks.map(r => ({ bottom: r.bottom, draw: (c: CanvasRenderingContext2D) => { c.imageSmoothingEnabled = false; c.drawImage(r.image, r.x, r.y, r.width, r.height); } })),
        ...decor,
      ].sort((a, b) => a.bottom - b.bottom);
      s.paintRacks = racks.paint;
      s.water = water; s.fish = water ? spawnFish(water, map.fish ?? 0, 7) : [];
      s.door = door; s.overlays = overlays; s.closedMap = withDoorClosed(map);
      const fishRandom = rng(Date.now()); racks.paint(dayNumber(controls.current.gameDate, controls.current.gameTime));
      s.map = map; s.items = interactions(map); s.p = spawn(map, controls.current.arrivedFrom);
      s.direction = arrivalDirection(map, controls.current.arrivedFrom);
      controls.current.onPosition?.(s.p);
      const box = canvas.parentElement!.getBoundingClientRect(); fit(box.width, box.height);
      setStatus(''); canvas.focus({ preventScroll: true });
      /** 門扇只畫在門洞框裡，往兩側滑開；門框蓋在上面，遮住滑進牆裡的部分。 */
      const drawDoor = (frameOnly = false) => {
        const spec = map.door, art = s.door; if (!spec || !art) return;
        const [x, y, w, h] = spec.opening, slide = s.doorOpen * w / 2;
        if (!frameOnly) {
          ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
          ctx.drawImage(art.left, x - slide, y); ctx.drawImage(art.right, x + w / 2 + slide, y);
          ctx.restore();
        }
        ctx.drawImage(art.frame, spec.frame.x, spec.frame.y);
      };
      /** 角色走在門洞裡（已經穿過牆面）時，門框要蓋在角色上面。 */
      const inDoorway = () => {
        const spec = map.door; if (!spec) return false;
        const [x, y, w, h] = spec.opening;
        return s.p.x > x && s.p.x < x + w && s.p.y > spec.frame.y && s.p.y < y + h;
      };
      const drawPlayer = (moving: boolean) => {
        const sw = sprite.width / 4, sh = sprite.height / 3, h = ACTOR_HEIGHT, w = h * sw / sh;
        if (!s.seated) { ctx.fillStyle = '#05101b66'; ctx.beginPath(); ctx.ellipse(s.p.x, s.p.y - 3, 23, 7, 0, 0, Math.PI * 2); ctx.fill(); }
        const col = ({ down: 0, up: 1, left: 2, right: 3 } as Record<string, number>)[s.direction];
        const row = moving ? [0, 1, 0, 2][Math.floor(s.elapsed * 8) % 4] : 0;
        const x = s.p.x - w / 2, y = s.p.y - h + 5;
        if (s.seated) {
          // Keep the head and torso in place; shorten the lower legs so the feet rest on the sofa.
          ctx.drawImage(sprite, col * sw, row * sh, sw, sh * .7, x, y, w, h * .7);
          ctx.drawImage(sprite, col * sw, row * sh + sh * .7, sw, sh * .3, x, y + h * .7, w, h * .15);
        } else ctx.drawImage(sprite, col * sw, row * sh, sw, sh, x, y, w, h);
      };
      const render = (time: number) => {
        if (disposed) return;
        const dt = Math.min((time - (last || time)) / 1000, .05); last = time;
        const frozen = controls.current.paused || document.hidden;
        let moving = false;
        if (!frozen) {
          let { dx, dy } = axis();
          if (dx || dy) { if (s.seated) { s.p = s.seated.exit; s.seated = null; } s.path = []; s.pending = null; s.notice = null; }
          else if (s.path.length) {
            dx = s.path[0].x - s.p.x; dy = s.path[0].y - s.p.y;
            if (Math.hypot(dx, dy) < 3) { s.p = s.path.shift()!; dx = 0; dy = 0; }
          }
          const distance = Math.hypot(dx, dy);
          if (distance) {
            const amount = Math.min(240 * dt, s.path.length ? distance : Infinity);
            let p = move(map, s.p, dx / distance * amount, dy / distance * amount);
            // 厚重門還沒開夠：停在門前等，路徑保留，門開了就繼續走
            if (map.door && doorBlocks(map, map.door, p, s.doorOpen) && !doorBlocks(map, map.door, s.p, s.doorOpen)) p = s.p;
            const walked = Math.hypot(p.x - s.p.x, p.y - s.p.y); moving = walked > .01; s.p = p;
            if (moving) controls.current.onWalk?.(walked);
            s.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            if (moving) s.elapsed += dt;
          }
          if (!s.path.length && s.pending) { const pending = s.pending; s.pending = null; if (nearby(s.p, [pending])) actRef.current(pending); }
          if (map.door) {
            if (s.doorWanted && doorDistance(map, map.door, s.p) > map.door.trigger) s.doorWanted = false;   // 走遠了自己關
            s.doorOpen = stepDoor(map.door, s.doorOpen, s.doorWanted, dt);
          }
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
        const item = frozen ? undefined : s.seated ? s.items.find(i => i.id === s.seated?.id) : nearby(s.p, s.items);
        drawDoor();
        if (map.door && s.doorOpen > 0 && s.doorOpen < 1) {   // 門在動：警示燈閃
          const [lx, ly] = map.door.lamp, glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46);
          glow.addColorStop(0, `rgba(255,170,60,${.55 + .35 * Math.sin(time / 90)})`); glow.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly, 46, 0, Math.PI * 2); ctx.fill();
        }
        s.standing.forEach(o => { if (drawBeforePlayer(o, s.p, !!s.seated)) o.draw(ctx); });
        ctx.imageSmoothingEnabled = false; drawPlayer(moving && !frozen);
        s.standing.forEach(o => { if (!drawBeforePlayer(o, s.p, !!s.seated)) o.draw(ctx); });
        if (inDoorway()) drawDoor(true);
        for (const o of s.overlays) ctx.drawImage(o.image, o.x, o.y);
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
        controls.current.onPosition?.(s.p);
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
        const s = state.current; if (!s.map || props.paused) return; e.currentTarget.focus({ preventScroll: true });
        if (s.seated) { s.p = s.seated.exit; s.seated = null; }
        const r = e.currentTarget.getBoundingClientRect(), p = { x: (e.clientX - r.left) / r.width * s.view.width + s.camera.x, y: (e.clientY - r.top) / r.height * s.view.height + s.camera.y };
        const item = clicked(p, s.items);
        if (item && nearby(s.p, s.items)?.id === item.id) { act(item); return; }
        // 門關著時不穿門找路；點門本身就走到門前（角色那一側），到了再開
        const nav = s.doorWanted || s.doorOpen > 0 || !s.closedMap ? s.map : s.closedMap;
        const path = findPath(nav, s.p, item?.kind === 'door' && s.map.door ? doorStand(s.map, s.map.door, s.p) : item?.point ?? p);
        s.path = path; s.pending = path.length ? item ?? null : null;
        if (!path.length) controls.current.onNotice('那裡無法通行。');
      }} />
      {status && <p role="status" className="corridor-status">{status}</p>}
    </div>
  </div>;
}
