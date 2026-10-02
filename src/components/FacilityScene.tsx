import { useEffect, useRef, useState } from 'react';
import type { Point } from '../game/corridor';
import { FacilityInteraction, FacilityMap, camera, clicked, findPath, interactions, move, nearby, spawn, worldSize } from '../game/facility';
import { ACTOR_HEIGHT, approach, fitViewport } from '../game/viewport';
import { CropsMeta, RacksMeta, layoutRack, rackBounds, rackKey } from '../game/racks';
import { dayNumber, stageAt } from '../game/growth';
import { decorSprites, spriteFor } from '../game/decor';

/** 畫在地面之上、要和玩家排前後的東西：依底部 y 由上到下畫，玩家插在自己腳的位置。 */
interface Standing { bottom: number; draw: (ctx: CanvasRenderingContext2D) => void }

interface Props {
  facility: { folder: string; name: string };
  /** Sector the player walked in from; they appear inside that doorway. */
  arrivedFrom?: string | null;
  paused: boolean;
  /** Walk out through a doorway into the sector beyond it. */
  onLeave: (to: string) => void;
  onNotice: (text: string) => void;
  /** 遊戲時間：自動植栽區的作物依此決定生長階段。 */
  gameDate: string;
  gameTime: string;
}
const movement = new Set(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const normal = (key: string) => key.length === 1 ? key.toLowerCase() : key;
export default function FacilityScene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef(props); controls.current = props;
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState(`正在載入${props.facility.name}…`);
  const state = useRef({ map: null as FacilityMap | null, p: { x: 0, y: 0 } as Point, path: [] as Point[], direction: 'up', elapsed: 0, camera: { x: 0, y: 0 }, settled: false, view: { width: 1600, height: 996 }, items: [] as FacilityInteraction[], pending: null as FacilityInteraction | null, grid: true, standing: [] as Standing[], paintRacks: null as ((day: number) => void) | null });
  const act = (item?: FacilityInteraction) => {
    const s = state.current;
    if (!s.map || controls.current.paused) return;
    item ??= nearby(s.p, s.items); if (!item) return;
    s.path = []; s.pending = null; keys.current.clear();
    if (item.kind === 'exit' && item.to) controls.current.onLeave(item.to); else controls.current.onNotice(item.text);
  };
  const actRef = useRef(act); actRef.current = act;
  useEffect(() => { if (props.paused) keys.current.clear(); }, [props.paused]);
  // 時間推進時作物跟著長；還沒載好的話，載好時會用當下時間畫第一次。
  useEffect(() => { state.current.paintRacks?.(dayNumber(props.gameDate, props.gameTime)); }, [props.gameDate, props.gameTime]);
  useEffect(() => {
    const canvas = canvasRef.current!, ctx = canvas.getContext('2d')!;
    let disposed = false, raf = 0, last = 0;
    const clear = () => keys.current.clear();
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    const fit = (w: number, h: number) => {
      const s = state.current; if (!s.map) return;
      const world = worldSize(s.map), view = fitViewport(w, h, world.width, world.height);
      s.view = view; s.settled = false;
      canvas.width = Math.round(view.width); canvas.height = Math.round(view.height);
      canvas.style.width = `${view.width * view.scale}px`; canvas.style.height = `${view.height * view.scale}px`;
    };
    const resize = new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height)); resize.observe(canvas.parentElement!);
    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(src)); im.src = src; });
    /**
     * 每座種植架先畫成一張素材像素大小的圖（外框 + 作物），render 時整張放大，不用每格重算。
     * 回傳的 paint 依遊戲時間重畫作物的生長階段；三個階段的圖一開始就全部載好，換階段不用等。
     */
    async function loadRacks(folder: string, map: FacilityMap) {
      if (!map.racks?.length) return { racks: [], paint: () => {} };
      const specs = map.racks;
      const json = async <T,>(src: string) => { const r = await fetch(src); if (!r.ok) throw new Error(src); return r.json() as Promise<T>; };
      const [meta, crops] = await Promise.all([json<RacksMeta>(`/assets/${folder}/racks.json`), json<CropsMeta>(`/assets/${folder}/crops/crops.json`)]);
      const frames = { shelf: await load(`/assets/${folder}/rack_shelf.png`), trellis: await load(`/assets/${folder}/rack_trellis.png`) };
      const names = [...new Set(specs.flatMap(r => r.crops))].filter(c => crops[c]).flatMap(c => [1, 2, 3].map(i => `${c}_${i}`));
      const images = new Map(await Promise.all(names.map(async n => [n, await load(`/assets/${folder}/crops/${n}.png`)] as const)));
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
      const images = new Map(await Promise.all(decorSprites(specs).map(async n => [n, await load(`/assets/${folder}/props/${n}.png`)] as const)));
      return specs.map(d => ({
        bottom: d.y * T,
        draw: (c: CanvasRenderingContext2D) => {
          const im = images.get(spriteFor(d, controls.current.gameDate))!, w = im.width * d.scale, h = im.height * d.scale;
          c.imageSmoothingEnabled = true;
          if (d.flip) { c.save(); c.translate(d.x * T, 0); c.scale(-1, 1); c.drawImage(im, -w / 2, d.y * T - h, w, h); c.restore(); }
          else c.drawImage(im, d.x * T - w / 2, d.y * T - h, w, h);
        },
      }));
    }
    async function start() {
      const { folder } = controls.current.facility;
      const response = await fetch(`/assets/${folder}/map.json`); if (!response.ok) throw new Error('map');
      const map: FacilityMap = await response.json();
      // L0 地面由 tools/art/facility_ground.py 依 map.json 的 terrain 拼成；種植架（racks）與樹、花（decor）另外疊上，其他擺設還沒上，先靠 G 鍵的碰撞格看位置。
      const [background, sprite, racks, decor] = await Promise.all([load(`/assets/${folder}/ground.webp`), load('/assets/player/walk.png'), loadRacks(folder, map), loadDecor(folder, map)]);
      if (disposed) return;
      const s = state.current, world = worldSize(map);
      // 種植架是放大 2 倍的像素圖（不平滑）；樹和花是從大圖縮小（要平滑）
      s.standing = [
        ...racks.racks.map(r => ({ bottom: r.bottom, draw: (c: CanvasRenderingContext2D) => { c.imageSmoothingEnabled = false; c.drawImage(r.image, r.x, r.y, r.width, r.height); } })),
        ...decor,
      ].sort((a, b) => a.bottom - b.bottom);
      s.paintRacks = racks.paint; racks.paint(dayNumber(controls.current.gameDate, controls.current.gameTime));
      s.map = map; s.items = interactions(map); s.p = spawn(map, controls.current.arrivedFrom);
      const box = canvas.parentElement!.getBoundingClientRect(); fit(box.width, box.height);
      setStatus(''); canvas.focus({ preventScroll: true });
      const drawPlayer = (moving: boolean) => {
        const sw = sprite.width / 4, sh = sprite.height / 3, h = ACTOR_HEIGHT, w = h * sw / sh;
        ctx.fillStyle = '#05101b66'; ctx.beginPath(); ctx.ellipse(s.p.x, s.p.y - 3, 23, 7, 0, 0, Math.PI * 2); ctx.fill();
        const col = ({ down: 0, up: 1, left: 2, right: 3 } as Record<string, number>)[s.direction];
        const row = moving ? [0, 1, 0, 2][Math.floor(s.elapsed * 8) % 4] : 0;
        ctx.drawImage(sprite, col * sw, row * sh, sw, sh, s.p.x - w / 2, s.p.y - h + 5, w, h);
      };
      const render = (time: number) => {
        if (disposed) return;
        const dt = Math.min((time - (last || time)) / 1000, .05); last = time;
        const frozen = controls.current.paused || document.hidden;
        let moving = false;
        if (!frozen) {
          let dx = Number(keys.current.has('d') || keys.current.has('ArrowRight')) - Number(keys.current.has('a') || keys.current.has('ArrowLeft'));
          let dy = Number(keys.current.has('s') || keys.current.has('ArrowDown')) - Number(keys.current.has('w') || keys.current.has('ArrowUp'));
          if (dx || dy) { s.path = []; s.pending = null; }
          else if (s.path.length) {
            dx = s.path[0].x - s.p.x; dy = s.path[0].y - s.p.y;
            if (Math.hypot(dx, dy) < 3) { s.p = s.path.shift()!; dx = 0; dy = 0; }
          }
          const distance = Math.hypot(dx, dy);
          if (distance) {
            const amount = Math.min(240 * dt, s.path.length ? distance : Infinity);
            const p = move(map, s.p, dx / distance * amount, dy / distance * amount); moving = Math.hypot(p.x - s.p.x, p.y - s.p.y) > .01; s.p = p;
            s.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
            if (moving) s.elapsed += dt;
          }
          if (!s.path.length && s.pending) { const pending = s.pending; s.pending = null; if (nearby(s.p, [pending])) actRef.current(pending); }
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
        }
        const item = frozen ? undefined : nearby(s.p, s.items);
        if (item) { ctx.strokeStyle = '#71efffaa'; ctx.lineWidth = 4; ctx.strokeRect(item.area.x + 2, item.area.y + 2, item.area.width - 4, item.area.height - 4); }
        s.standing.forEach(o => { if (o.bottom <= s.p.y) o.draw(ctx); });
        ctx.imageSmoothingEnabled = false; drawPlayer(moving && !frozen);
        s.standing.forEach(o => { if (o.bottom > s.p.y) o.draw(ctx); });
        ctx.imageSmoothingEnabled = false;
        if (s.path.length) { const p = s.path.at(-1)!; ctx.strokeStyle = '#71efff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
        if (item) { ctx.font = 'bold 22px sans-serif'; const w = ctx.measureText(item.label).width + 28; ctx.fillStyle = '#08192499'; ctx.fillRect(s.p.x - w / 2, s.p.y - 192, w, 36); ctx.fillStyle = '#baf7ff'; ctx.textAlign = 'center'; ctx.fillText(item.label, s.p.x, s.p.y - 166); ctx.textAlign = 'start'; }
        ctx.restore();
        canvas.dataset.playerPosition = `${s.p.x.toFixed(1)},${s.p.y.toFixed(1)}`; canvas.dataset.camera = `${s.camera.x.toFixed(1)},${s.camera.y.toFixed(1)}`; canvas.dataset.ready = 'true'; canvas.dataset.moving = String(moving); canvas.dataset.nearby = item?.id ?? '';
        raf = requestAnimationFrame(render);
      }; raf = requestAnimationFrame(render);
    }
    start().catch(() => { if (!disposed) setStatus(`${controls.current.facility.name}素材載入失敗，請重新整理。`); });
    return () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); clear(); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);
  return <div className="corridor-scene">
    <div className="corridor-viewport"><canvas ref={canvasRef} tabIndex={0} aria-label={`${props.facility.name}。方向鍵或 WASD 移動，E 互動，G 切換碰撞格顯示，也可以點擊地面或設施。`}
      onBlur={() => keys.current.clear()}
      onKeyDown={e => {
        const key = normal(e.key); if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (key === 'g') { state.current.grid = !state.current.grid; return; }
        if (!movement.has(key) && key !== 'e') return;
        e.preventDefault(); e.stopPropagation(); if (props.paused) return;
        if (key === 'e') { if (!e.repeat) act(); } else keys.current.add(key);
      }}
      onKeyUp={e => { const key = normal(e.key); if (movement.has(key)) { e.preventDefault(); e.stopPropagation(); keys.current.delete(key); } }}
      onClick={e => {
        const s = state.current; if (!s.map || props.paused) return; e.currentTarget.focus({ preventScroll: true });
        const r = e.currentTarget.getBoundingClientRect(), p = { x: (e.clientX - r.left) / r.width * s.view.width + s.camera.x, y: (e.clientY - r.top) / r.height * s.view.height + s.camera.y };
        const item = clicked(p, s.items);
        if (item && nearby(s.p, s.items)?.id === item.id) { act(item); return; }
        const path = findPath(s.map, s.p, item?.point ?? p);
        s.path = path; s.pending = path.length ? item ?? null : null;
        if (!path.length) controls.current.onNotice('那裡無法通行。');
      }} />
      {status && <p role="status" className="corridor-status">{status}</p>}
    </div>
  </div>;
}
