import { useEffect, useMemo, useRef, useState } from 'react';
import FacilityScene from './FacilityScene';
import { createBridgeExtras } from '../game/bridgeExtras';
import './BridgeScene.css';

/**
 * 艦橋：設施場景（public/assets/bridge-v3/map.json）＋艦橋的外框（標題、全景／放大跟隨切換、底部的互動按鈕與略過演出）。
 * 抵達演出、值勤人員、照明在 game/bridgeExtras.ts。升降平台開星圖，通訊台開補給船告示板，其他設備顯示說明。
 */
interface Props { paused: boolean; onOpenMap: () => void; onOpenBoard?: () => void; onNotice: (text: string) => void; onWalk?: (px: number) => void; gameDate: string; gameTime: string }

export default function BridgeStage({ paused, onOpenMap, onOpenBoard, onNotice, onWalk, gameDate, gameTime }: Props) {
  const [zoomed, setZoomed] = useState(false), [arriving, setArriving] = useState(true), [nearby, setNearby] = useState<{ id: string; label: string } | null>(null);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);
  const extras = useMemo(() => createBridgeExtras({ reducedMotion: () => reduced.matches, onArrivingChange: setArriving }), [reduced]);
  const control = useRef<{ interact(): void } | null>(null);
  // 設備說明顯示在畫面上方的面板：全景時整個艦橋縮得很小，畫在設備旁的泡泡字會看不清楚
  const [notice, setNotice] = useState('');
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 5500); return () => window.clearTimeout(id); }, [notice]);
  const onAction = (item: { id: string; text: string }) => {
    if (item.id === 'lift') { onOpenMap(); return true; }
    if (item.id === 'comms' && onOpenBoard) { onOpenBoard(); return true; }
    setNotice(item.text); return true;
  };
  return <section className="bridge-scene" aria-label="艦橋場景">
    <header className="bridge-heading"><span>艦橋 <small>BRIDGE</small></span><span className="bridge-controls">方向鍵 / WASD · 點地板移動 · E 互動</span>
      <button className="bridge-zoom" aria-pressed={zoomed} onClick={() => setZoomed(z => !z)}>{zoomed ? '檢視全景' : '放大跟隨'}</button></header>
    <div className="bridge-viewport">
      <FacilityScene facility={{ folder: 'bridge-v3', name: '艦橋' }} paused={paused} overview={!zoomed} extras={extras} controlRef={control}
        onLeave={() => {}} onNotice={onNotice} onAction={onAction} onWalk={onWalk} onNearby={setNearby} gameDate={gameDate} gameTime={gameTime} />
      {notice && <div className="bridge-notice" role="status"><span>{notice}</span><button aria-label="關閉場景提示" onClick={() => setNotice('')}>×</button></div>}
    </div>
    <footer className="bridge-footer"><span aria-live="polite">{arriving ? '中央平台上升中' : nearby?.label ?? '艦橋值勤中 · 可自由走動'}</span>
      {arriving
        ? <button disabled={paused} onClick={() => extras.skip()}>略過抵達演出</button>
        : <button disabled={!nearby || paused} onClick={() => control.current?.interact()}>{nearby ? `${nearby.label} · E` : '靠近設備互動'}</button>}
    </footer>
  </section>;
}
