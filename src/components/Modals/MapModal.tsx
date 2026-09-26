import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import {
  House,
  Compass,
  Navigation,
  Trees,
  FlaskConical,
  Sprout,
  HeartPulse,
  Wrench,
  X,
  ArrowRight,
  AlertTriangle,
  Brain,
  RotateCcw,
} from 'lucide-react';
import { MapSector, NPCData, RoomDef } from '../../types';
import { sound } from '../../utils/audio';
import ModalShell from './ModalShell';
import spaceStationBg from '../../assets/images/space_station_map.webp';

/** 最短過場顯示時間，避免資料回得太快導致過場只閃一下。 */
const MIN_TRANSITION_MS = 800;
/** 超時門檻。AI 生成本來就可能跑十餘秒，門檻太短會誤判。暫定值，之後實測調整。 */
const LOAD_TIMEOUT_MS = 30_000;
/** 連續失敗幾次後直接切塞車畫面。 */
const MAX_CONSECUTIVE_FAILURES = 3;

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectors: MapSector[];
  npcs: NPCData[];
  /** 內建房號清單。居住區的房號按鈕依這裡列出，住戶由 NPC 的 roomId 反查。 */
  rooms: RoomDef[];
  currentSectorId: string;
  /**
   * 執行 AI 世界模擬與場景初始化。
   * resolve 表示可以進場，reject 表示失敗（reject 的訊息會顯示給玩家）。
   */
  onEnterSector: (sector: MapSector, roomId?: string) => Promise<void>;
}

interface SectorConfig {
  posStyle: React.CSSProperties;
  innerStyle?: React.CSSProperties;
  chineseTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  pinSide: 'left' | 'right';
}

const sectorConfigs: Record<string, SectorConfig> = {
  // 中上方: 研究室
  lab: {
    posStyle: { top: '12%', left: '50%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '141px', marginTop: '-33px' },
    chineseTitle: '研究室',
    icon: FlaskConical,
    pinSide: 'left',
  },
  // 右方: 溫室
  greenhouse: {
    posStyle: { top: '39%', left: '81%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '80px', marginTop: '-10px' },
    chineseTitle: '溫室',
    icon: Sprout,
    pinSide: 'left',
  },
  // 下方: 醫療室
  medical: {
    posStyle: { top: '77%', left: '50%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '-125px', marginTop: '20px' },
    chineseTitle: '醫療室',
    icon: HeartPulse,
    pinSide: 'right',
  },
  // 左方: 工程部
  engineering: {
    posStyle: { top: '39%', left: '19%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '-61px', marginRight: '0px', marginTop: '-8px' },
    chineseTitle: '工程部',
    icon: Wrench,
    pinSide: 'right',
  },
  // 正中間偏上: 艦橋
  bridge: {
    posStyle: { top: '35%', left: '50%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '-130px', marginTop: '-10px' },
    chineseTitle: '艦橋',
    icon: Compass,
    pinSide: 'right',
  },
  // 正中間偏下: 中央公園
  park: {
    posStyle: { top: '57%', left: '50%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '140px', marginTop: '-50px' },
    chineseTitle: '中央公園',
    icon: Trees,
    pinSide: 'left',
  },
  // 左上: 居住區 D
  residential_d: {
    posStyle: { top: '22%', left: '30%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '-60px', marginTop: '-15px' },
    chineseTitle: '居住區 D',
    icon: House,
    pinSide: 'right',
  },
  // 右上: 居住區 A
  residential_a: {
    posStyle: { top: '22%', left: '70%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '60px', marginTop: '-15px' },
    chineseTitle: '居住區 A',
    icon: House,
    pinSide: 'left',
  },
  // 左下: 居住區 C
  residential_c: {
    posStyle: { top: '65%', left: '30%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '-60px', marginTop: '10px' },
    chineseTitle: '居住區 C',
    icon: House,
    pinSide: 'right',
  },
  // 右下: 居住區 B
  residential_b: {
    posStyle: { top: '65%', left: '70%', transform: 'translateX(-50%)' },
    innerStyle: { marginLeft: '60px', marginTop: '10px' },
    chineseTitle: '居住區 B',
    icon: House,
    pinSide: 'left',
  },
};

/**
 * 進入過場。左欄原地切換成這一層，同時在背景跑世界模擬與場景初始化。
 *
 * 動態全部交給 index.css 的 scene-transition-*（純 CSS、無限循環、只走
 * transform / opacity / filter）。載入時間不可預測，所以不能用一次性動畫。
 */
function SceneTransition({ sector }: { sector: MapSector }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050814]">
      {/* 底圖：有圖吃圖，沒圖沿用場景層的同一組漸層佔位。 */}
      <div className="absolute inset-0 scene-transition-zoom">
        {sector.backgroundUrl ? (
          <img
            src={sector.backgroundUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 scene-fallback" />
        )}
      </div>

      {/* 位移視差的光暈層 */}
      <div className="absolute inset-0 scene-transition-parallax pointer-events-none">
        <div className="absolute inset-0 scene-transition-glow" />
      </div>

      {/* 掃描線 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
        <div className="absolute inset-x-0 top-0 scene-transition-scan" />
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#050814]/85 via-transparent to-[#050814]/50 pointer-events-none" />

      {/* 前景文字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="flex items-center gap-2 text-sky-300">
          <Brain className="w-4 h-4 animate-pulse" />
          <span className="font-hud font-bold tracking-[0.2em] text-sm uppercase">
            場景初始化中
          </span>
        </div>
        <div className="text-slate-100 font-sans font-bold text-lg drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
          正在前往 {sector.name}
        </div>
        <div className="text-[12px] text-slate-400 font-sans">
          世界模擬運行中，請稍候
        </div>
      </div>
    </div>
  );
}

export default function MapModal({
  isOpen,
  onClose,
  sectors,
  npcs,
  rooms,
  currentSectorId,
  onEnterSector,
}: MapModalProps) {
  // browsing = 可操作地圖；loading = 過場中；stuck = 塞車畫面
  const [phase, setPhase] = useState<'browsing' | 'loading' | 'stuck'>('browsing');
  // null 代表「未選擇任何區域」，右欄改列可進入的區域清單。
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const failureCountRef = useRef(0);

  // 每次開啟都回到「未選擇」，不再預設選中目前所在區域。
  useEffect(() => {
    if (!isOpen) return;
    setPhase('browsing');
    setSelectedSectorId(null);
    setSelectedRoomId(null);
    setErrorMessage(null);
    failureCountRef.current = 0;
  }, [isOpen]);

  const isLoading = phase === 'loading';
  const selectedSector = selectedSectorId
    ? sectors.find((s) => s.id === selectedSectorId) ?? null
    : null;

  const handleSectorClick = (sec: MapSector) => {
    if (isLoading) return;
    sound.playClick();
    setSelectedSectorId(sec.id);
    setSelectedRoomId(null);
    setErrorMessage(null);
    setBurstKey((prev) => prev + 1);
  };

  const handleRoomClick = (roomNumber: string) => {
    if (isLoading) return;
    sound.playClick();
    setSelectedRoomId(roomNumber);
  };

  const handleEnter = useCallback(async () => {
    if (!selectedSector || isLoading) return;
    sound.playClick();
    setErrorMessage(null);
    setPhase('loading');

    const startedAt = Date.now();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        onEnterSector(selectedSector, selectedRoomId ?? undefined),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('__TIMEOUT__')), LOAD_TIMEOUT_MS);
        }),
      ]);

      // 撐滿最短顯示時間再收掉，避免過場一閃而過。
      const remaining = MIN_TRANSITION_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      failureCountRef.current = 0;
      onClose();
    } catch (err) {
      failureCountRef.current += 1;
      const timedOut = err instanceof Error && err.message === '__TIMEOUT__';

      if (timedOut || failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
        // 超時或連續失敗：切塞車畫面，提示玩家重整網頁。
        setPhase('stuck');
      } else {
        // 一般失敗：退回地圖，保留原本選擇的區域，玩家可重按進入。
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : '場景初始化失敗，請再試一次。'
        );
        setPhase('browsing');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [selectedSector, selectedRoomId, isLoading, onEnterSector, onClose]);

  const currentSectorName =
    sectors.find((s) => s.id === currentSectorId)?.name ?? '未知';

  return (
    <ModalShell
      id="modal-map"
      isOpen={isOpen}
      onRequestClose={onClose}
      // 過場載入期間不可關閉。
      locked={isLoading}
      size="lg"
      fillHeight
    >
      {phase === 'stuck' ? (
        /* 塞車畫面。CG 素材本輪留空，先用純文字錯誤畫面佔位，不預先開圖片欄位。 */
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 px-8">
          <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 font-sans">星港航道壅塞</h2>
          <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-sm">
            場景初始化持續無回應，可能是世界模擬排隊過久或連線中斷。
            <br />
            請重新整理網頁後再試一次。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-standard text-xs !py-1.5 !px-4 mt-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重新整理</span>
          </button>
        </div>
      ) : (
        <>
          {/* 標題列 */}
          <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-slate-100 font-sans">星圖導航</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              disabled={isLoading}
              className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 text-slate-400 hover:text-slate-100 flex items-center justify-center transition border border-white/[0.06] flex-shrink-0 disabled:opacity-30 disabled:pointer-events-none"
              title="關閉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 左右分欄：左欄地圖作為視覺導航，右欄文字資訊。 */}
          <div className="flex-1 min-h-0 flex flex-row gap-3.5">
            {/* ============ 左欄：地圖 / 過場 ============ */}
            <div className="flex-1 min-w-0 relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#030612]/75 blur-mid shadow-inner">
              {isLoading && selectedSector ? (
                <SceneTransition sector={selectedSector} />
              ) : (
                <div className="absolute inset-0">
                  {/* Map Background Image */}
                  <img
                    src={spaceStationBg}
                    alt="Space Station Map"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
                    referrerPolicy="no-referrer"
                  />

                  {/* Grid & Orbital Geometry Overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none mix-blend-overlay" />

                  {/* Dynamic Subtle Transit Axes */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-sky-500/20 stroke-[1.2] stroke-dasharray-[3_4]">
                    <line x1="50%" y1="12%" x2="50%" y2="88%" />
                    <line x1="12%" y1="50%" x2="88%" y2="50%" />
                  </svg>

                  {/* Orbit Rings */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full border border-sky-500/20 border-dashed pointer-events-none animate-[spin_120s_linear_infinite]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full border border-indigo-500/25 pointer-events-none" />

                  {/* Staggered Compact HUD Callout Location Nodes */}
                  <div className="absolute inset-0 z-20 pointer-events-auto">
                    {sectors.map((sec) => {
                      const isSelected = sec.id === selectedSectorId;
                      const isHere = sec.id === currentSectorId;
                      const config = sectorConfigs[sec.id] || {
                        posStyle: { top: '50%', left: '50%' },
                        chineseTitle: sec.name,
                        icon: Compass,
                        pinSide: 'left' as const,
                      };

                      const IconComponent = config.icon;
                      const pinOnLeft = config.pinSide === 'left';

                      return (
                        <div
                          key={sec.id}
                          id={`map-sector-node-${sec.id}`}
                          style={config.posStyle}
                          onClick={() => handleSectorClick(sec)}
                          className={`absolute group cursor-pointer z-20 ${
                            isSelected ? 'z-30' : ''
                          }`}
                        >
                          <div
                            style={config.innerStyle}
                            className={`relative flex items-center ${
                              pinOnLeft ? 'flex-row' : 'flex-row-reverse'
                            }`}
                          >
                            {/* Phase 1: 圓圈發光 */}
                            <div className="relative w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {isSelected && (
                                <div
                                  key={`burst-${burstKey}`}
                                  className="absolute -inset-1.5 rounded-full border-2 border-orange-400 radar-shockwave-active pointer-events-none"
                                />
                              )}

                              <div
                                className={`absolute inset-0 rounded-full border border-dashed transition-all duration-300 ${
                                  isSelected
                                    ? 'border-orange-400 animate-[spin_8s_linear_infinite]'
                                    : 'border-sky-400/50 group-hover:border-orange-400 group-hover:animate-[spin_4s_linear_infinite]'
                                }`}
                              />
                              <div
                                className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 flex items-center justify-center ${
                                  isSelected
                                    ? 'border-orange-400 bg-orange-950/70 shadow-[0_0_14px_rgba(251,146,60,0.85)]'
                                    : 'border-sky-400/70 group-hover:border-orange-400 group-hover:bg-orange-950/60 group-hover:hover-radar-breathe bg-slate-950/70'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                    isSelected
                                      ? 'bg-orange-400 breathing-light-orange shadow-[0_0_10px_#fb923c]'
                                      : 'bg-sky-400/80 group-hover:bg-orange-400 group-hover:shadow-[0_0_8px_#fb923c]'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Phase 2: 線條傳輸 */}
                            <svg
                              className={`w-5 h-4 flex-shrink-0 pointer-events-none transition-all duration-300 ${
                                pinOnLeft ? '' : '-scale-x-100'
                              }`}
                              viewBox="0 0 20 16"
                              fill="none"
                            >
                              <path
                                d="M20 13 H14 L8 8 H0"
                                className={`stroke-[1.5] transition-all duration-300 ${
                                  isSelected
                                    ? 'stroke-orange-400/40'
                                    : 'stroke-sky-400/30 group-hover:stroke-orange-400/50'
                                }`}
                              />
                              <path
                                d="M20 13 H14 L8 8 H0"
                                className={`stroke-[1.5] transition-all duration-300 ${
                                  isSelected
                                    ? 'stroke-orange-400 circuit-flow-active drop-shadow-[0_0_5px_#fb923c]'
                                    : 'stroke-sky-400/80 group-hover:stroke-orange-400 group-hover:circuit-flow-active'
                                }`}
                              />
                              <circle
                                cx="19"
                                cy="13"
                                r="1.5"
                                className={`transition-all duration-300 ${
                                  isSelected
                                    ? 'fill-orange-400 drop-shadow-[0_0_6px_#fb923c]'
                                    : 'fill-sky-400/70 group-hover:fill-orange-400'
                                }`}
                              />
                            </svg>

                            {/* Phase 3: 方形按鈕 HUD Callout Card */}
                            <div
                              className={`relative min-w-[96px] sm:min-w-[108px] px-2.5 py-1.5 transition-transform duration-200 blur-mid flex items-center gap-2 select-none active:scale-[0.93] ${
                                isSelected
                                  ? 'bg-orange-500/30 button-micro-press'
                                  : 'bg-sky-500/20'
                              }`}
                              style={{
                                clipPath:
                                  'polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)',
                              }}
                            >
                              <div
                                className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                                  isSelected
                                    ? 'opacity-100 hud-conic-border-active'
                                    : 'opacity-0 group-hover:opacity-100 hud-conic-border'
                                }`}
                                style={{
                                  background:
                                    'conic-gradient(from var(--hud-angle), transparent 0deg, transparent 60deg, rgba(251, 146, 60, 0.2) 110deg, rgba(251, 146, 60, 0.95) 165deg, #ffffff 180deg, rgba(251, 146, 60, 0.95) 195deg, rgba(251, 146, 60, 0.2) 250deg, transparent 300deg, transparent 360deg)',
                                }}
                              />

                              <div
                                className={`absolute inset-[1.5px] pointer-events-none transition-colors duration-300 ${
                                  isSelected ? 'bg-[#100702]' : 'bg-[#050f26]'
                                }`}
                                style={{
                                  clipPath:
                                    'polygon(5px 0%, calc(100% - 5px) 0%, 100% 5px, 100% calc(100% - 5px), calc(100% - 5px) 100%, 5px 100%, 0% calc(100% - 6px), 0% 5px)',
                                }}
                              />

                              {isSelected && (
                                <div
                                  key={`shockwave-${burstKey}`}
                                  className="burst-overlay-shockwave"
                                />
                              )}

                              {/* SVG Chamfered Border & Tech Corner Accents */}
                              <svg
                                className="absolute inset-0 w-full h-full pointer-events-none z-10"
                                preserveAspectRatio="none"
                                viewBox="0 0 110 34"
                              >
                                <polygon
                                  points="6,1 104,1 109,6 109,28 104,33 6,33 1,28 1,6"
                                  className={`fill-none stroke-[1.2] transition-all duration-300 ${
                                    isSelected
                                      ? 'stroke-orange-400/80'
                                      : 'stroke-sky-400/40 group-hover:stroke-transparent'
                                  }`}
                                />
                                <path
                                  d="M 1 12 L 1 6 L 6 1 L 12 1"
                                  className={`fill-none stroke-[1.5] transition-all duration-300 ${
                                    isSelected
                                      ? 'stroke-orange-300'
                                      : 'stroke-sky-400 group-hover:stroke-orange-400'
                                  }`}
                                />
                                <path
                                  d="M 98 1 L 104 1 L 109 6 L 109 12"
                                  className={`fill-none stroke-[1.5] transition-all duration-300 ${
                                    isSelected
                                      ? 'stroke-orange-300'
                                      : 'stroke-sky-400 group-hover:stroke-orange-400'
                                  }`}
                                />
                                <path
                                  d="M 109 22 L 109 28 L 104 33 L 98 33"
                                  className={`fill-none stroke-[1.5] transition-all duration-300 ${
                                    isSelected
                                      ? 'stroke-orange-300'
                                      : 'stroke-sky-400 group-hover:stroke-orange-400'
                                  }`}
                                />
                                <path
                                  d="M 12 33 L 6 33 L 1 28 L 1 22"
                                  className={`fill-none stroke-[1.5] transition-all duration-300 ${
                                    isSelected
                                      ? 'stroke-orange-300'
                                      : 'stroke-sky-400 group-hover:stroke-orange-400'
                                  }`}
                                />
                              </svg>

                              <div className="relative z-10 flex-shrink-0">
                                <IconComponent
                                  className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-all duration-300 ${
                                    isSelected
                                      ? 'text-orange-400'
                                      : 'text-sky-400 group-hover:text-orange-400'
                                  }`}
                                />
                              </div>

                              <span
                                className={`relative z-10 font-sans font-bold text-xs sm:text-[13px] tracking-wide leading-none transition-all duration-300 whitespace-nowrap ${
                                  isSelected
                                    ? 'text-orange-200 drop-shadow-[0_0_8px_rgba(251,146,60,0.9)]'
                                    : 'text-slate-100 group-hover:text-orange-200 group-hover:drop-shadow-[0_0_6px_rgba(251,146,60,0.8)]'
                                }`}
                              >
                                {config.chineseTitle}
                              </span>

                              {/* 目前所在區域的呼吸點 */}
                              {isHere && (
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 breathing-light-orange ml-auto flex-shrink-0 relative z-10" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Ambient lighting effect */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06)_0%,transparent_70%)] pointer-events-none" />
                </div>
              )}
            </div>

            {/* ============ 右欄：文字資訊 ============ */}
            <div className="w-[264px] flex-shrink-0 flex flex-col rounded-xl border border-white/[0.08] bg-slate-950/40 blur-mid p-3 overflow-hidden">
              {isLoading ? (
                /* 狀態三：載入中 */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-sky-400 breathing-light-orange"
                        style={{ animationDelay: `${i * 0.25}s` }}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-slate-300 font-sans leading-relaxed px-2">
                    正在建構
                    <span className="text-sky-300 font-bold">{selectedSector?.name}</span>
                    的場景
                  </div>
                  <div className="text-[12px] text-slate-500 font-sans">
                    完成後將自動進入
                  </div>
                </div>
              ) : !selectedSector ? (
                /* 狀態一：未選擇任何區域，列出可進入的區域 */
                <>
                  <div className="flex items-center gap-1.5 text-[12px] font-hud font-bold tracking-wider text-sky-400 pb-2 mb-2 border-b border-white/[0.08] flex-shrink-0">
                    <Navigation className="w-3.5 h-3.5" />
                    <span>可進入的區域</span>
                  </div>

                  {errorMessage && (
                    <div className="mb-2 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[12px] text-rose-300 font-sans leading-relaxed flex items-start gap-1.5 flex-shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                    {sectors
                      .filter((sec) => sec.id !== currentSectorId)
                      .map((sec) => {
                        const Icon = sectorConfigs[sec.id]?.icon ?? Compass;
                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => handleSectorClick(sec)}
                            className="w-full text-left p-2 rounded-lg bg-white/[0.03] border border-white/[0.08] hover:bg-sky-500/15 hover:border-sky-400/50 transition flex items-center gap-2 cursor-pointer group"
                          >
                            <Icon className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                            <span className="text-xs font-bold text-slate-100 font-sans truncate">
                              {sec.name}
                            </span>
                            <span className="ml-auto font-hud text-[12px] text-slate-500 flex-shrink-0 group-hover:text-sky-400">
                              {sec.code}
                            </span>
                          </button>
                        );
                      })}
                  </div>

                  <div className="pt-2 mt-2 border-t border-white/[0.08] text-[12px] text-slate-500 font-sans flex-shrink-0">
                    目前位於{' '}
                    <span className="text-orange-400 font-bold">{currentSectorName}</span>
                  </div>
                </>
              ) : (
                /* 狀態二：已選擇區域 */
                <>
                  <div className="flex items-start gap-2 pb-2 mb-2 border-b border-white/[0.08] flex-shrink-0">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-400/25 flex items-center justify-center flex-shrink-0">
                      <Navigation className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-slate-100 font-bold font-sans text-sm truncate">
                        {selectedSector.name}
                      </div>
                      <div className="font-hud text-[12px] text-slate-500">
                        {selectedSector.code}
                        {selectedSector.id === currentSectorId && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            目前位置
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-0.5 space-y-3">
                    {/*
                      場景記憶：本輪先接 MapSector.description 這個現有欄位當假資料。
                      真正的場景記憶對應骨架文件通道 ① 的場景層記憶，資料結構之後再定，
                      本輪只把版面立起來。
                    */}
                    <div>
                      <div className="flex items-center gap-1.5 text-[12px] font-bold text-sky-400 mb-1">
                        <Brain className="w-3.5 h-3.5" />
                        <span>場景記憶</span>
                      </div>
                      <div className="text-[12px] text-[#9aeeff] leading-relaxed font-sans markdown-body !text-[12px] !text-[#9aeeff]">
                        <Markdown>{selectedSector.description}</Markdown>
                      </div>
                    </div>

                    {/* 居住區另外選房號 */}
                    {selectedSector.id.startsWith('residential_') && (
                      <div>
                        <div className="text-[12px] font-bold text-slate-300 mb-1.5">
                          選擇房號
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {rooms.filter((room) => room.sectorId === selectedSector.id).map((room) => {
                            const roomNumber = room.id;
                            const isRoomSelected = selectedRoomId === roomNumber;
                            // 住戶由 NPC 的房號欄位反查；沒有頭像的住戶不在按鈕上顯示。
                            const resident = npcs.find(npc => npc.portraitUrl && npc.roomId === roomNumber);
                            return (
                              <button
                                key={roomNumber}
                                type="button"
                                onClick={() => handleRoomClick(roomNumber)}
                                aria-label={resident ? `${roomNumber} · ${resident.name}` : roomNumber}
                                aria-pressed={isRoomSelected}
                                title={resident ? `${roomNumber} · ${resident.name}` : roomNumber}
                                className={`aspect-square w-full min-w-0 overflow-hidden flex flex-col items-center justify-center rounded-lg border text-[12px] font-hud font-bold transition ${
                                  isRoomSelected
                                    ? 'border-orange-400 bg-orange-500/20 text-orange-300 shadow-[0_0_10px_rgba(251,146,60,0.35)]'
                                    : 'border-white/[0.12] bg-white/[0.03] text-slate-400 hover:border-sky-400/60 hover:text-sky-300'
                                }`}
                              >
                                {resident ? <>
                                  <img src={resident.portraitUrl} alt="" className="w-full flex-1 min-h-0 object-cover object-top" />
                                  <span className="w-full shrink-0 py-0.5 text-[10px] leading-4 text-center">{roomNumber}</span>
                                </> : roomNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {errorMessage && (
                      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[12px] text-rose-300 font-sans leading-relaxed flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* 下方「進入」按鈕 */}
                  <div className="pt-2.5 mt-2 border-t border-white/[0.08] flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setSelectedSectorId(null);
                        setSelectedRoomId(null);
                      }}
                      className="btn-standard text-xs !py-1.5 !px-3"
                    >
                      返回
                    </button>
                    <button
                      type="button"
                      onClick={handleEnter}
                      className="btn-primary-neon flex-1 text-xs !py-1.5 !px-3"
                    >
                      <span>{errorMessage ? '重試進入' : '進入'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </ModalShell>
  );
}
