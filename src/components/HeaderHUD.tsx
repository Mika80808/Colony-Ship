import React, { useState, useEffect, useRef } from 'react';
import { User, Settings, Zap, Coffee, Coins, Brain, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerStats, DrawerType, ModalType } from '../types';
import { sound } from '../utils/audio';

type FloatingDelta = {
  id: number;
  type: 'stamina' | 'hunger' | 'credits';
  value: number;
};

// 單一則浮動數字：動畫播完後呼叫 onDone 把自己從清單移除。
function FloatingDeltaText({
  delta,
  positiveClass,
  onDone,
}: {
  delta: FloatingDelta;
  positiveClass: string;
  onDone: (id: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.8 }}
      animate={{ opacity: 1, y: -20, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: 'easeOut' }}
      onAnimationComplete={() => onDone(delta.id)}
      className={`absolute left-8 -top-2 text-sm font-black text-shadow-sm font-hud ${
        delta.value > 0 ? positiveClass : 'text-rose-400'
      }`}
    >
      {delta.value > 0 ? `+${delta.value}` : delta.value}
    </motion.div>
  );
}

interface HeaderHUDProps {
  stats: PlayerStats;
  currentLocation: string;
  onOpenDrawer: (type: DrawerType) => void;
  onOpenModal: (type: ModalType) => void;
  /** 區域記憶。內容由外部供給，之後接 AI 或資料庫。 */
  memories: string[];
  /** 遊戲內日期與時間。不與現實時鐘綁定，也不每秒重繪整個 header。 */
  gameDate: string;
  gameTime: string;
}

export default function HeaderHUD({
  stats,
  currentLocation,
  onOpenDrawer,
  onOpenModal,
  memories,
  gameDate,
  gameTime,
}: HeaderHUDProps) {
  const [currentMemoryIndex, setCurrentMemoryIndex] = useState<number>(0);
  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(false);
  const memoryContainerRef = useRef<HTMLDivElement>(null);

  // Auto-rotate regional memories every 4.5 seconds (pause when accordion is expanded)
  useEffect(() => {
    if (!memories.length || isAccordionOpen) return;
    const carouselInterval = setInterval(() => {
      setCurrentMemoryIndex((prev) => (prev + 1) % memories.length);
    }, 4500);
    return () => clearInterval(carouselInterval);
  }, [memories.length, isAccordionOpen]);

  // Floating numbers state
  // 每一則浮動數字在自己的動畫播完後自行移除，不做集中計時清理。
  const prevStats = useRef(stats);
  const floatIdRef = useRef(0);
  const [floatingTexts, setFloatingTexts] = useState<FloatingDelta[]>([]);

  useEffect(() => {
    const floaters: FloatingDelta[] = [];

    if (stats.stamina !== prevStats.current.stamina) {
      floaters.push({ id: ++floatIdRef.current, type: 'stamina', value: stats.stamina - prevStats.current.stamina });
    }
    if (stats.hunger !== prevStats.current.hunger) {
      floaters.push({ id: ++floatIdRef.current, type: 'hunger', value: stats.hunger - prevStats.current.hunger });
    }
    if (stats.credits !== prevStats.current.credits) {
      floaters.push({ id: ++floatIdRef.current, type: 'credits', value: stats.credits - prevStats.current.credits });
    }

    if (floaters.length > 0) {
      setFloatingTexts((prev) => [...prev, ...floaters]);
    }

    prevStats.current = stats;
  }, [stats]);

  const removeFloatingText = (id: number) => {
    setFloatingTexts((prev) => prev.filter((f) => f.id !== id));
  };

  // Click outside listener for memory accordion dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isAccordionOpen &&
        memoryContainerRef.current &&
        !memoryContainerRef.current.contains(e.target as Node)
      ) {
        setIsAccordionOpen(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isAccordionOpen]);

  return (
    <header className="relative z-20 w-full h-[51.8px] bg-[#030610]/80 blur-strong rounded-none border-b border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.8),inset_0_-1px_0_rgba(56,189,248,0.2)] px-5 flex items-center justify-between gap-4">
      {/* Left: Port Title & Sector */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Breathing Beacon */}
          <div className="w-8 h-8 rounded-lg bg-sky-950/90 border border-sky-400/50 flex items-center justify-center relative">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 breathing-light" />
          </div>
          <span className="font-hud font-bold text-[20px] tracking-wider text-slate-100">
            星際港
          </span>
        </div>

        {/* 1px Low-contrast divider */}
        <div className="h-4 w-[1px] bg-white/[0.15]" />

        {/* 遊戲時間 */}
        <div className="flex items-center gap-2 font-hud text-sky-400 text-sm font-semibold tracking-wider">
          <span className="font-mono-code text-xs text-slate-400">{gameDate}</span>
          <span className="font-mono-code text-xs text-sky-300">{gameTime}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-md bg-[#0a1532] border border-sky-500/30 text-xs shadow-sm">
          <span className="text-slate-400 text-[12px]">當前位置</span>
          <span className="text-sky-200 font-medium text-[12px]">{currentLocation}</span>
        </div>
      </div>

      {/* Center: 區域記憶 系統輪播 (Regional Memory Rotating Broadcast with Accordion) */}
      <div
        ref={memoryContainerRef}
        className="hidden lg:flex flex-1 max-w-xl mx-2 items-center min-w-0 relative"
      >
        <div
          id="header-regional-memory"
          onClick={() => {
            sound.playClick();
            setIsAccordionOpen(!isAccordionOpen);
          }}
          className={`w-full bg-[#070e24] border rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-md cursor-pointer group transition-all blur-strong ${
            isAccordionOpen
              ? 'border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] bg-[#0c183d]'
              : 'border-white/[0.2] hover:border-sky-400/60 hover:bg-[#0a1330]'
          }`}
          title="點擊展開 / 收合區域記憶手風琴清單"
        >
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-5 h-5 rounded-md bg-sky-500/25 border border-sky-400/50 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-sky-300 animate-pulse" />
            </div>
            <span className="font-bold text-sky-300 text-[12px] tracking-wider font-sans">
              區域記憶
            </span>
          </div>

          <div className="h-3 w-[1px] bg-white/[0.2] flex-shrink-0" />

          <div className="flex-1 overflow-hidden relative h-5 flex items-center min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMemoryIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="text-[12px] text-slate-100 font-medium truncate w-full flex items-center gap-1.5 font-sans"
              >
                <span className="text-sky-400 font-bold text-[12px]">•</span>
                <span className="truncate drop-shadow-sm">{memories[currentMemoryIndex]}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
            {memories.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentMemoryIndex
                    ? 'bg-sky-400 w-3 shadow-[0_0_6px_#38bdf8]'
                    : 'bg-white/30 w-1.5'
                }`}
              />
            ))}
          </div>

          {/* Chevron Accordion Toggle Icon */}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              isAccordionOpen ? 'rotate-180 text-sky-400' : 'group-hover:text-slate-200'
            }`}
          />
        </div>

        {/* Accordion Expandable Dropdown Drawer */}
        <AnimatePresence>
          {isAccordionOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-[#060e24] p-3 rounded-xl border border-sky-400/40 shadow-[0_16px_48px_rgba(0,0,0,0.9)] blur-strong space-y-2"
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.12] text-[12px] font-sans">
                <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[12px]">區域記憶清單 ({memories.length})</span>
                </span>
                <span className="text-slate-400 text-[12px]">點擊任一則條目切換焦點</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {memories.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playClick();
                      setCurrentMemoryIndex(idx);
                    }}
                    className={`p-2 rounded-lg text-[12px] transition cursor-pointer flex items-start gap-2 ${
                      idx === currentMemoryIndex
                        ? 'bg-sky-500/25 border border-sky-400/50 text-white font-medium shadow-[inset_0_0_10px_rgba(56,189,248,0.2)]'
                        : 'bg-white/[0.04] border border-white/[0.08] text-slate-200 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        idx === currentMemoryIndex
                          ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span className="leading-relaxed font-sans">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Player Status & Control Buttons */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Status Indicators */}
        <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-white/[0.03] text-xs font-hud">
          {/* Stamina */}
          <div className="flex items-center gap-1.5 relative" title="體力">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[#34d399] -mt-[2px] text-xs font-sans">體力</span>
            <motion.span
              key={stats.stamina}
              initial={{ scale: 1.2, textShadow: '0 0 10px rgba(52,211,153,0.8)', color: '#a7f3d0' }}
              animate={{ scale: 1, textShadow: '0 0 0px rgba(52,211,153,0)', color: '#34d399' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="font-bold text-sm inline-block"
            >
              {stats.stamina}/{stats.maxStamina}
            </motion.span>
            
            <AnimatePresence>
              {floatingTexts
                .filter((f) => f.type === 'stamina')
                .map((f) => (
                  <FloatingDeltaText
                    key={f.id}
                    delta={f}
                    positiveClass="text-emerald-400"
                    onDone={removeFloatingText}
                  />
                ))}
            </AnimatePresence>
          </div>

          <div className="h-3 w-[1px] bg-white/[0.08]" />

          {/* Hunger */}
          <div className="flex items-center gap-1.5 relative" title="飢餓">
            <Coffee className="w-3.5 h-3.5 text-[#fff5da]" />
            <span className="text-[#fff5da] -mt-[2px] text-xs font-sans">飢餓</span>
            <span className="text-[#fff5da] font-bold text-sm">
              {stats.hunger}/{stats.maxHunger}
            </span>
            <AnimatePresence>
              {floatingTexts
                .filter((f) => f.type === 'hunger')
                .map((f) => (
                  <FloatingDeltaText
                    key={f.id}
                    delta={f}
                    positiveClass="text-[#fde08b]"
                    onDone={removeFloatingText}
                  />
                ))}
            </AnimatePresence>
          </div>

          <div className="h-3 w-[1px] bg-white/[0.08]" />

          {/* Credits */}
          <div className="flex items-center gap-1.5 relative" title="星幣">
            <Coins className="w-3.5 h-3.5 text-[#fcc645]" />
            <span className="text-[#fcc645] font-bold font-sans -mt-[2px] text-xs">星幣</span>
            <motion.span
              key={stats.credits}
              initial={{ scale: 1.2, textShadow: '0 0 10px rgba(252,198,69,0.8)', color: '#fde08b' }}
              animate={{ scale: 1, textShadow: '0 0 0px rgba(252,198,69,0)', color: '#fcc645' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="font-bold text-sm inline-block text-[#fcc645]"
            >
              ${stats.credits}
            </motion.span>
            <AnimatePresence>
              {floatingTexts
                .filter((f) => f.type === 'credits')
                .map((f) => (
                  <FloatingDeltaText
                    key={f.id}
                    delta={f}
                    positiveClass="text-[#fcc645]"
                    onDone={removeFloatingText}
                  />
                ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* 個人資訊 */}
          <button
            id="header-profile-btn"
            onClick={(e) => {
              e.stopPropagation();
              sound.playClick();
              onOpenDrawer('profile');
            }}
            className="btn-icon !w-[34px] !h-[34px]"
            title="個人資訊"
          >
            <User className="w-4 h-4" />
          </button>

          {/* 系統設定 */}
          <button
            id="header-settings-btn"
            onClick={() => {
              sound.playClick();
              onOpenModal('settings');
            }}
            className="btn-icon !w-[34px] !h-[34px]"
            title="系統設定"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
