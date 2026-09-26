import { useEffect, useRef, useState } from 'react';
import type { Point } from '../game/corridor';
import { GreenhouseInteraction, GreenhouseMap, camera, clicked, findPath, interactions, move, nearby, spawn, worldSize } from '../game/greenhouse';
import { ACTOR_HEIGHT, approach, fitViewport } from '../game/viewport';

interface Props { paused: boolean; onOpenMap: () => void; onNotice: (text: string) => void }
const movement = new Set(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const normal = (key: string) => key.length === 1 ? key.toLowerCase() : key;
export default function GreenhouseScene(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef(props); controls.current = props;
  const keys = useRef(new Set<string>());
  const [status, setStatus] = useState('正在載入溫室…');
  const state = useRef({ map: null as GreenhouseMap | null, p: { x: 0, y: 0 } as Point, path: [] as Point[], direction: 'up', elapsed: 0, camera: { x: 0, y: 0 }, settled: false, view: { width: 1600, height: 996 }, items: [] as GreenhouseInteraction[], pending: null as GreenhouseInteraction | null, grid: true });
  const act = (item?: GreenhouseInteraction) => {
    const s = state.current;
    if (!s.map || controls.current.paused) return;
    item ??= nearby(s.p, s.items); if (!item) return;
    s.path = []; s.pending = null; keys.current.clear();
    if (item.kind === 'exit') controls.current.onOpenMap(); else controls.current.onNotice(item.text);
  };
  const actRef = useRef(act); actRef.current = act;
  useEffect(() => { if (props.paused) keys.current.clear(); }, [props.paused]);
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
    async function start() {
      const response = await fetch('/assets/greenhouse/map.json'); if (!response.ok) throw new Error('map');
      const map: GreenhouseMap = await response.json();
      // L0 地面由 tools/art/greenhouse_ground.py 依 map.json 的 terrain 拼成；結構與擺設還沒上，先靠 G 鍵的碰撞格看位置。
      const [background, sprite] = await Promise.all([load('/assets/greenhouse/ground.webp'), load('/assets/player/walk.png')]);
      if (disposed) return;
      const s = state.current, world = worldSize(map);
      s.map = map; s.items = interactions(map); s.p = spawn(map);
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
        ctx.imageSmoothingEnabled = false; drawPlayer(moving && !frozen);
        if (s.path.length) { const p = s.path.at(-1)!; ctx.strokeStyle = '#71efff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
        if (item) { ctx.font = 'bold 22px sans-serif'; const w = ctx.measureText(item.label).width + 28; ctx.fillStyle = '#08192499'; ctx.fillRect(s.p.x - w / 2, s.p.y - 192, w, 36); ctx.fillStyle = '#baf7ff'; ctx.textAlign = 'center'; ctx.fillText(item.label, s.p.x, s.p.y - 166); ctx.textAlign = 'start'; }
        ctx.restore();
        canvas.dataset.playerPosition = `${s.p.x.toFixed(1)},${s.p.y.toFixed(1)}`; canvas.dataset.camera = `${s.camera.x.toFixed(1)},${s.camera.y.toFixed(1)}`; canvas.dataset.ready = 'true'; canvas.dataset.moving = String(moving); canvas.dataset.nearby = item?.id ?? '';
        raf = requestAnimationFrame(render);
      }; raf = requestAnimationFrame(render);
    }
    start().catch(() => { if (!disposed) setStatus('溫室素材載入失敗，請重新整理。'); });
    return () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); clear(); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);
  return <div className="corridor-scene">
    <div className="corridor-viewport"><canvas ref={canvasRef} tabIndex={0} aria-label="溫室。方向鍵或 WASD 移動，E 互動，G 切換碰撞格顯示，也可以點擊地面或設施。"
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
