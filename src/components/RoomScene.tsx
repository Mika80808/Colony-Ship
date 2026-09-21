import { approachSeat, cancelSeatApproach, clickedSeat, createSeatState, finishSeatApproach, interactSeat, leaveSeat } from '../game/roomSeats';
import { approachBed, bedSideAt, BED_ACTOR_DEPTH, cancelBedApproach, clickedBed, createBedState, finishBedApproach, interactBed, leaveBed } from '../game/roomBed';
import { useEffect, useRef, useState } from 'react';
import { NPCData } from '../types';
import { canExitRoom, ROOM_EXIT_POINT, ROOM_HEIGHT, ROOM_WIDTH } from '../game/roomNavigation';
import { canInteract, createActor, RoomActor, setDestination, updateNpc, updatePlayer } from '../game/roomActors';

import { ACTOR_HEIGHT, approach, cameraTarget, fitViewport } from '../game/viewport';
import { nearbyInspection } from '../game/roomInspection';
import { isShowering } from '../game/roomFurniture';
import { DECALS, PIECES, SHELL } from '../game/roomRuntime';

interface Props { npc?: NPCData; paused: boolean; onInteract: (npc: NPCData) => void; onExit: () => void }
const MOVEMENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
const normalizeKey = (key: string) => key.length === 1 ? key.toLowerCase() : key;

export default function RoomScene({ npc, paused, onInteract, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [inspection, setInspection] = useState<{ text: string } | null>(null);
  useEffect(() => {
    if (!inspection) return;
    const timer = window.setTimeout(() => setInspection(null), 4500);
    return () => window.clearTimeout(timer);
  }, [inspection]);
  const actors = useRef({ npc: createActor({ x: 600, y: 700 }), player: createActor({ ...ROOM_EXIT_POINT }, 'up') });
  const view = useRef(fitViewport(ROOM_WIDTH, ROOM_HEIGHT, ROOM_WIDTH, ROOM_HEIGHT));
  const camera = useRef({ x: 0, y: 0, settled: false });
  const exiting = useRef(false);
  const doorElapsed = useRef(0);
  const bed = useRef(createBedState());
  const seating = useRef(createSeatState());
  const keys = useRef(new Set<string>());
  const controls = useRef({ paused, npc, onInteract, onExit });
  controls.current = { paused, npc, onInteract, onExit };
  useEffect(() => { if (paused) keys.current.clear(); }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = new ResizeObserver(([entry]) => {
      const fitted = fitViewport(entry.contentRect.width, entry.contentRect.height, ROOM_WIDTH, ROOM_HEIGHT);
      view.current = fitted;
      canvas.width = Math.round(fitted.width);
      canvas.height = Math.round(fitted.height);
      canvas.style.width = `${fitted.width * fitted.scale}px`;
      canvas.style.height = `${fitted.height * fitted.scale}px`;
      // A narrower frame can leave the camera outside the room; re-centre on the next frame.
      camera.current.settled = false;
    });
    resize.observe(canvas.parentElement!);
    const clearKeys = () => keys.current.clear();
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);
    const ASSETS = '/assets/rooms/';
    const room = new Image(), npcSprite = new Image(), playerSprite = new Image();
    const objects = PIECES;
    const furnitureImages = objects.map(() => new Image());
    const decalImages = DECALS.map(() => new Image());
    // One element per overlay entry; several may share a file but not a crop.
    const overlayImages = SHELL.overlays.map(() => new Image());
    let disposed = false, raf = 0, last = 0;
    const load = (img: HTMLImageElement, src: string) => new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = src; });
    // Showering re-colours the sprite instead of swapping in a second set of
    // artwork: painting skin over the frame with source-atop keeps the pose and
    // silhouette but washes the uniform out, and stays in sync if walk.png changes.
    const skin = document.createElement('canvas');
    const skinCtx = skin.getContext('2d')!;
    const skinToned = (sprite: HTMLImageElement, sx: number, sy: number, sw: number, sh: number) => {
      if (skin.width !== sw || skin.height !== sh) { skin.width = sw; skin.height = sh; }
      skinCtx.clearRect(0, 0, sw, sh);
      skinCtx.drawImage(sprite, sx, sy, sw, sh, 0, 0, sw, sh);
      skinCtx.globalCompositeOperation = 'source-atop';
      skinCtx.fillStyle = 'rgba(246, 211, 180, 0.85)';
      skinCtx.fillRect(0, 0, sw, sh);
      skinCtx.globalCompositeOperation = 'source-over';
      return skin;
    };
    const drawActor = (actor: RoomActor, sprite: HTMLImageElement, player: boolean, frozen: boolean) => {
      const { x, y } = actor.position;
      const resting = player && bed.current.phase === 'resting';
      const sitting = player && seating.current.phase === 'sitting';
      if (!resting && !sitting) {
        ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(x, y - 3, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
      }
      const column = { down: 0, up: 1, left: 2, right: 3 }[actor.direction];
      const rows = player ? 3 : 4;
      const frames = player ? [0, 1, 0, 2] : [0, 1, 2, 3];
      const row = actor.moving && !frozen ? frames[Math.floor(actor.elapsed * 8) % frames.length] : 0;
      const sw = sprite.naturalWidth / 4, sh = sprite.naturalHeight / rows;
      const height = ACTOR_HEIGHT, width = height * sw / sh;
      if (sitting) {
        // Match the corridor's seated pose: keep head/body scale and shorten legs.
        const top = y - height * 0.85;
        ctx.drawImage(sprite, column * sw, 0, sw, sh * 0.7, x - width / 2, top, width, height * 0.7);
        ctx.drawImage(sprite, column * sw, sh * 0.7, sw, sh * 0.3, x - width / 2, top + height * 0.7, width, height * 0.15);
      } else if (player && isShowering(actor.position)) {
        ctx.drawImage(skinToned(sprite, column * sw, row * sh, sw, sh), x - width / 2, y - height * (166 / 172), width, height);
      } else {
        ctx.drawImage(sprite, column * sw, row * sh, sw, sh, x - width / 2, y - height * (166 / 172), width, height);
      }
    };
    /** Structural art that sorts as a block around actors rather than by floor contact. */
    const drawOverlays = (order: string) => SHELL.overlays.forEach((overlay, index) => {
      if (overlay.order !== order) return;
      const [dx, dy, dw, dh] = overlay.dst;
      if (overlay.src) {
        const [sx, sy, sw, sh] = overlay.src;
        ctx.drawImage(overlayImages[index], sx, sy, sw, sh, dx, dy, dw, dh);
      } else ctx.drawImage(overlayImages[index], dx, dy, dw, dh);
    });
    const render = (time: number) => {
      if (disposed) return;
      const dt = Math.min((time - (last || time)) / 1000, 0.05); last = time;
      const { npc: npcActor, player } = actors.current;
      const frozen = controls.current.paused || document.hidden;
      if (!frozen) {
        if (controls.current.npc && !canInteract(player, npcActor)) updateNpc(npcActor, dt);
        else npcActor.moving = false;
        if (!doorElapsed.current && bed.current.phase !== 'resting' && seating.current.phase !== 'sitting') {
          updatePlayer(player, dt, keys.current);
          finishBedApproach(player, bed.current);
          finishSeatApproach(player, seating.current);
        }
        if (exiting.current && !player.target && canExitRoom(player.position) && !doorElapsed.current) {
          doorElapsed.current = 0.001;
          keys.current.clear(); player.direction = 'down'; player.moving = false;
        }
        if (doorElapsed.current > 0) {
          doorElapsed.current += dt;
          if (doorElapsed.current >= 1.25) {
            controls.current.onExit();
            return;
          }
        }
      }
      const frame = view.current;
      const target = { x: cameraTarget(player.position.x, frame.width, ROOM_WIDTH), y: cameraTarget(player.position.y, frame.height, ROOM_HEIGHT) };
      if (camera.current.settled && !frozen) {
        camera.current.x = approach(camera.current.x, target.x, dt);
        camera.current.y = approach(camera.current.y, target.y, dt);
      } else {
        camera.current = { ...target, settled: true };
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(-camera.current.x, -camera.current.y);
      ctx.drawImage(room, 0, 0, ROOM_WIDTH, ROOM_HEIGHT);
      // Rugs lie flat on the floor, so they never sort against actors.
      DECALS.forEach((decal, index) => ctx.drawImage(decalImages[index], decal.x, decal.y, decal.width, decal.height));
      drawOverlays('behind');
      if (player.target) {
        ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(player.target.x, player.target.y, 18, 8, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const visibleActors = [{ actor: player, sprite: playerSprite, player: true }];
      if (controls.current.npc) visibleActors.push({ actor: npcActor, sprite: npcSprite, player: false });
      const layers = objects.map((item, index) => ({ depth: item.depth, draw: () => {
        const picture = furnitureImages[index];
        ctx.drawImage(picture, item.x, item.y, item.width, item.height);
        if (item.id === 'door-a1-out' && doorElapsed.current > 0) {
          // Keep the outer frame stationary while both door leaves retract.
          const t = Math.min(1, doorElapsed.current / 0.7);
          const offset = 65 * t * t * (3 - 2 * t);
          ctx.save(); ctx.translate(item.x, item.y);
          ctx.beginPath(); ctx.moveTo(57, 27); ctx.lineTo(124, 27);
          ctx.lineTo(152, 55); ctx.lineTo(152, 178); ctx.lineTo(29, 178); ctx.lineTo(29, 55); ctx.closePath(); ctx.clip();
          ctx.fillStyle = '#07121e'; ctx.fillRect(27, 26, 128, 154);
          ctx.drawImage(picture, 27, 26, 64, 154, 27 - offset, 26, 64, 154);
          ctx.drawImage(picture, 91, 26, 64, 154, 91 + offset, 26, 64, 154);
          ctx.restore();
        }
      }}));
      visibleActors.forEach(entry => layers.push({ depth: entry.player && bed.current.phase === 'resting' ? BED_ACTOR_DEPTH : entry.player && seating.current.phase === 'sitting' ? seating.current.seat!.furniture.depth + 0.5 : entry.player && isShowering(entry.actor.position) ? 813 : entry.actor.position.y, draw: () => drawActor(entry.actor, entry.sprite, entry.player, frozen) }));
      layers.sort((a, b) => a.depth - b.depth).forEach(layer => layer.draw());
      const bathing = isShowering(player.position);
      if (bathing) {
        const steamTime = frozen ? player.elapsed : time / 1000;
        const { x, y } = player.position;
        // The sprite's opaque box runs from 136px above the feet down to them, so
        // a still veil covers that whole span and the drifting puffs only animate.
        ctx.fillStyle = '#e8f1f44a';
        ctx.beginPath(); ctx.ellipse(x, y - 66, 56, 82, 0, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? '#eef7f932' : '#dce7ed3c';
          ctx.beginPath();
          ctx.ellipse(x + Math.sin(steamTime + i * 1.6) * 14, y + 2 - i * 20, 40 + (i % 3) * 6, 24, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const nearby = !!controls.current.npc && canInteract(player, npcActor);
      drawOverlays('front');
      ctx.restore();
      if (doorElapsed.current > 0.85) {
        ctx.fillStyle = `rgba(3, 8, 16, ${Math.min(1, (doorElapsed.current - 0.85) / 0.4)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      canvas.dataset.camera = `${camera.current.x.toFixed(1)},${camera.current.y.toFixed(1)}`;
      canvas.dataset.doorProgress = String(doorElapsed.current);
      canvas.dataset.bedSide = bed.current.side ?? '';
      canvas.dataset.canInteract = String(nearby);
      canvas.dataset.playerOutfit = bathing ? 'visible-in-steam' : 'uniform';
      canvas.dataset.showering = String(bathing);
      canvas.dataset.bedState = bed.current.phase;
      canvas.dataset.seatState = seating.current.phase;
      canvas.dataset.seatId = seating.current.seat?.id ?? '';
      canvas.dataset.playerPosition = `${player.position.x.toFixed(1)},${player.position.y.toFixed(1)}`;
      canvas.dataset.npcPosition = `${npcActor.position.x.toFixed(1)},${npcActor.position.y.toFixed(1)}`;
      canvas.dataset.playerDirection = player.direction;
      canvas.dataset.playerMoving = String(player.moving && !frozen);
      raf = requestAnimationFrame(render);
    };
    Promise.all([
      load(room, ASSETS + SHELL.base),
      load(npcSprite, '/assets/lucian/walk.png'),
      load(playerSprite, '/assets/player/walk.png'),
      ...SHELL.overlays.map((overlay, index) => load(overlayImages[index], ASSETS + overlay.image)),
      ...DECALS.map((decal, index) => load(decalImages[index], ASSETS + decal.image)),
      ...objects.map((item, index) => load(furnitureImages[index], ASSETS + item.image + (item.id.startsWith('bed-') ? '?v=bed-layers-2' : ''))),
    ])
      .then(() => {
        if (!disposed) {
          setReady(true);
          canvas.focus({ preventScroll: true });
          raf = requestAnimationFrame(render);
        }
      })
      .catch(() => { if (!disposed) setError(true); });
    return () => {
      disposed = true; cancelAnimationFrame(raf); resize.disconnect(); clearKeys();
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
    };
  }, []);

  return <div className="room-scene">
    <div className="room-viewport">
      <canvas ref={canvasRef} tabIndex={0}
        className="focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-400/50"
        aria-label="房間。點擊地板或聚焦後使用方向鍵、WASD 控制玩家；靠近路西恩按 E 交談。"
        onBlur={() => keys.current.clear()}
        onKeyDown={(e) => {
          const key = normalizeKey(e.key);
          if (doorElapsed.current > 0) { e.preventDefault(); return; }
          if (key === 'e' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault(); e.stopPropagation();
            if (ready && !paused && !e.repeat) {
              if (interactSeat(actors.current.player, seating.current)) {
                cancelBedApproach(bed.current);
                keys.current.clear(); exiting.current = false; setInspection(null);
                return;
              }
              if (interactBed(actors.current.player, bed.current)) {
                cancelSeatApproach(seating.current);
                keys.current.clear(); exiting.current = false; setInspection(null);
                return;
              }
              const item = nearbyInspection(actors.current.player.position, actors.current.player.direction);
              if (item) {
                actors.current.player.path = []; actors.current.player.target = null;
                exiting.current = false;
                setInspection({ text: `${item.label}：${item.inspectText}` });
              } else if (canExitRoom(actors.current.player.position)) {
                actors.current.player.path = []; actors.current.player.target = null;
                keys.current.clear();
                exiting.current = setDestination(actors.current.player, ROOM_EXIT_POINT);
              } else if (npc && canInteract(actors.current.player, actors.current.npc)) {
                actors.current.player.path = []; actors.current.player.target = null;
                controls.current.onInteract(npc);
              }
            }
            return;
          }
          if (!MOVEMENT_KEYS.has(key) || e.ctrlKey || e.altKey || e.metaKey) return;
          e.preventDefault(); e.stopPropagation();
          if (ready && !paused) {
            exiting.current = false;
            cancelSeatApproach(seating.current);
            leaveSeat(actors.current.player, seating.current);
            cancelBedApproach(bed.current);
            leaveBed(actors.current.player, bed.current);
            if (!keys.current.has(key)) updatePlayer(actors.current.player, 1 / 60, new Set([key]));
            keys.current.add(key);
          }
        }}
        onKeyUp={(e) => {
          const key = normalizeKey(e.key);
          if (MOVEMENT_KEYS.has(key)) { e.preventDefault(); e.stopPropagation(); keys.current.delete(key); }
        }}
        onClick={(e) => {
          if (!ready || paused || doorElapsed.current > 0) return;
          e.currentTarget.focus({ preventScroll: true });
          const rect = e.currentTarget.getBoundingClientRect();
          const frame = view.current;
          const point = {
            x: (e.clientX - rect.left) / rect.width * frame.width + camera.current.x,
            y: (e.clientY - rect.top) / rect.height * frame.height + camera.current.y,
          };
          keys.current.clear();
          const seat = clickedSeat(point);
          if (seat) {
            cancelBedApproach(bed.current); leaveBed(actors.current.player, bed.current);
            exiting.current = false; setInspection(null);
            approachSeat(actors.current.player, seating.current, seat);
            return;
          }
          cancelSeatApproach(seating.current);
          leaveSeat(actors.current.player, seating.current);
          if (clickedBed(point)) {
            exiting.current = false; setInspection(null);
            approachBed(actors.current.player, bed.current, bedSideAt(point));
            return;
          }
          cancelBedApproach(bed.current);
          leaveBed(actors.current.player, bed.current);
          const clickedExit = point.x >= 220 && point.x <= 402 && point.y >= 980;
          exiting.current = clickedExit;
          setDestination(actors.current.player, clickedExit ? ROOM_EXIT_POINT : point);
        }} />
      {inspection && <p role="status" className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded px-4 py-2 text-sm text-sky-100 bg-slate-950/65">{inspection.text}</p>}
      {!ready && <p role="status" className="absolute inset-0 flex items-center justify-center text-sky-200">{error ? '房間素材載入失敗，請重新整理。' : '正在載入房間…'}</p>}
    </div>
  </div>;
}
