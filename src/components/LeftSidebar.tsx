import React, { useState } from 'react';
import {
  ListChecks,
  Package,
  BookOpen,
  BookMarked,
  ChevronDown,
  Target,
  FileText,
} from 'lucide-react';
import { DrawerType, ModalType, Objective } from '../types';
import { sound } from '../utils/audio';

// Objective 已移至 types.ts（屬於遊戲進度，存檔需要）。此處再匯出以維持既有 import。
export type { Objective };

interface LeftSidebarProps {
  activeDrawer: DrawerType;
  activeModal: ModalType;
  onOpenDrawer: (type: DrawerType) => void;
  onOpenModal: (type: ModalType) => void;
  activeQuestsCount: number;
  itemCount: number;
  /** 當前目標。內容由外部供給，之後接 AI 或資料庫。 */
  objectives: Objective[];
  /** 當前摘要。同上。 */
  summary: string;
}

export default function LeftSidebar({
  activeDrawer,
  activeModal,
  onOpenDrawer,
  onOpenModal,
  activeQuestsCount,
  itemCount,
  objectives,
  summary,
}: LeftSidebarProps) {
  // Accordion states
  const [openTarget, setOpenTarget] = useState(true);
  const [openSummary, setOpenSummary] = useState(false);

  return (
    <aside className="w-64 lg:w-72 flex-shrink-0 flex flex-col h-full gap-3 overflow-hidden relative justify-between pb-1">
      {/* Top Section: Accordion Info Blocks */}
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[calc(50%-75px)] flex-shrink-0">
        {/* Accordion 1: 當前目標 */}
        <div className="glass-panel p-3 rounded-xl">
          <button
            id="accordion-btn-target"
            onClick={() => {
              sound.playClick();
              setOpenTarget(!openTarget);
            }}
            className="w-full flex items-center justify-between text-left text-[16px] font-semibold text-slate-200 hover:text-sky-300 transition"
          >
            <span className="flex items-center gap-2">
              <Target className="w-4 h-4 text-sky-400" />
              <span className="text-[16px] font-semibold">當前目標</span>
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openTarget ? 'rotate-180 text-sky-400' : ''
              }`}
            />
          </button>

          {openTarget && (
            <div className="mt-2.5 pt-2 border-t border-white/[0.08] text-[12px] text-slate-300 space-y-1.5">
              {objectives.length === 0 && (
                <div className="p-1.5 text-slate-500 text-[12px]">目前沒有進行中的目標</div>
              )}
              {objectives.map((objective) =>
                objective.done ? (
                  <div
                    key={objective.id}
                    className="p-1.5 rounded bg-white/[0.01] flex items-center gap-2 text-slate-500 line-through text-[12px]"
                  >
                    <span className="text-slate-600 font-bold text-[12px]">•</span>
                    <span>{objective.text}</span>
                  </div>
                ) : (
                  <div
                    key={objective.id}
                    className="p-2 rounded bg-sky-950/40 border border-sky-500/30 flex items-start gap-2"
                  >
                    <span className="text-sky-400 font-bold text-[12px] mt-0.5">•</span>
                    <div>
                      <div className="font-semibold text-slate-100 text-[12px] leading-snug">
                        {objective.text}
                      </div>
                      {objective.location && (
                        <div className="text-[12px] text-slate-400 mt-0.5 font-sans">
                          {objective.location}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Accordion 3: 當前摘要 */}
        <div className="glass-panel p-3 rounded-xl">
          <button
            id="accordion-btn-summary"
            onClick={() => {
              sound.playClick();
              setOpenSummary(!openSummary);
            }}
            className="w-full flex items-center justify-between text-left text-[16px] font-semibold text-slate-200 hover:text-sky-300 transition"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span className="text-[16px] font-semibold">當前摘要</span>
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                openSummary ? 'rotate-180 text-sky-400' : ''
              }`}
            />
          </button>

          {openSummary && (
            <div className="mt-2.5 pt-2 border-t border-white/[0.08] text-[12px] text-slate-300 leading-relaxed font-sans">
              {summary}
            </div>
          )}
        </div>
      </div>

      {/* Middle Section: Lightweight Drawer Action Buttons - Absolute Pinned to Vertical Center & Flush Left */}
      <div
        className="absolute top-[calc(50%+20px)] -translate-y-1/2 left-0 z-10 flex flex-col gap-2 pb-1 items-start w-[124px] pt-[4px] h-[120px] text-left text-[12px] leading-[22px]"
        style={{ marginLeft: '0px', marginRight: '0px', marginTop: '-40px' }}
      >
        {/* 任務 */}
        <button
          id="btn-quests-drawer"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick();
            onOpenDrawer(activeDrawer === 'quests' ? null : 'quests');
          }}
          className={`px-3.5 py-1.5 rounded-xl inline-flex items-center gap-2.5 transition relative cursor-pointer w-[120px] h-[60px] text-[16px] text-left ${
            activeDrawer === 'quests'
              ? 'bg-sky-500/20 border border-sky-400 text-sky-300 shadow-[inset_0_0_12px_rgba(56,189,248,0.25)]'
              : 'glass-card text-slate-300 hover:text-white hover:border-sky-400/40'
          }`}
          title="任務"
        >
          <ListChecks className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="font-bold tracking-wide text-[16px] leading-[16px] ml-[1px] -mr-[4px]">任務</span>
          {activeQuestsCount > 0 && (
            <span className="font-hud font-bold text-[12px] text-black bg-[#55baeb] w-[18px] h-[18px] ml-[8px] -mr-[3px] -mb-[2px] pt-[1px] rounded-full flex items-center justify-center">
              {activeQuestsCount}
            </span>
          )}
        </button>

        {/* 道具 */}
        <button
          id="btn-inventory-drawer"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick();
            onOpenDrawer(activeDrawer === 'inventory' ? null : 'inventory');
          }}
          className={`px-3.5 py-1.5 rounded-xl inline-flex items-center gap-2.5 transition relative cursor-pointer w-[120px] h-[60px] ${
            activeDrawer === 'inventory'
              ? 'bg-sky-500/20 border border-sky-400 text-sky-300 shadow-[inset_0_0_12px_rgba(56,189,248,0.25)]'
              : 'glass-card text-slate-300 hover:text-white hover:border-sky-400/40'
          }`}
          title="道具"
        >
          <Package className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="font-bold tracking-wide text-[16px] leading-[16px] pb-0 pr-0 -mr-[5px]">道具</span>
          <span className="font-hud text-[12px] text-slate-400 font-bold ml-[2px]">
            {itemCount}/20
          </span>
        </button>
      </div>

      {/* Bottom Section: Standard Buttons */}
      <div
        className="flex items-center justify-center gap-3 mt-auto mx-auto w-[92%]"
        style={{ paddingLeft: '0px', paddingTop: '2px' }}
      >
        <button
          id="btn-diary-bottom"
          onClick={() => {
            sound.playClick();
            onOpenModal('diary');
          }}
          className="w-[101px] pl-[22px] h-[34px] pr-2 gap-1.5 flex items-center justify-center text-[16px] text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
          style={{
            marginLeft: '-70px',
            borderRadius: '10px',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'transparent',
            background: 'linear-gradient(rgba(20, 22, 32, 0.9), rgba(20, 22, 32, 0.9)) padding-box, var(--neon-gradient) border-box',
            fontVariationSettings: '"wght" 600',
            paddingRight: '0px',
            paddingBottom: '4px',
            paddingTop: '-8px',
            paddingLeft: '0px',
          }}
        >
          <BookMarked 
            className="w-4 h-4 text-sky-400 shrink-0" 
            style={{
              paddingRight: '0px',
              paddingBottom: '0px',
              paddingTop: '0px',
              marginLeft: '0px',
              marginRight: '0px',
              marginTop: '3px',
            }}
          />
          <span className="font-semibold whitespace-nowrap mt-[1px]" style={{ marginLeft: '-4px' }}>日記</span>
        </button>

        <button
          id="btn-storybook-bottom"
          onClick={() => {
            sound.playClick();
            onOpenModal('storybook');
          }}
          className="w-[101px] ml-0 h-[34px] px-2 gap-1.5 flex items-center justify-center text-[16px] text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
          style={{
            borderRadius: '10px',
            borderWidth: '2px',
            borderStyle: 'solid',
            borderColor: 'transparent',
            background: 'linear-gradient(rgba(20, 22, 32, 0.9), rgba(20, 22, 32, 0.9)) padding-box, var(--neon-gradient) border-box',
            fontVariationSettings: '"wght" 600',
          }}
        >
          <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
          <span 
            className="font-semibold whitespace-nowrap mt-[1px]"
            style={{
              paddingRight: '0px',
              paddingBottom: '3px',
              marginTop: '0px',
              marginBottom: '0px',
              marginRight: '4px',
            }}
          >故事書</span>
        </button>
      </div>
    </aside>
  );
}
