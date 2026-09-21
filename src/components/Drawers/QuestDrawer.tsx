import React from 'react';
import Markdown from 'react-markdown';
import { ListChecks, Coins, Calendar, Timer, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quest } from '../../types';

interface QuestDrawerProps {
  isOpen: boolean;
  quests: Quest[];
  onReportQuest?: (quest: Quest) => void;
  onAbandonQuest?: (quest: Quest) => void;
}

export default function QuestDrawer({ isOpen, quests, onReportQuest, onAbandonQuest }: QuestDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="drawer-quests"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, scale: 0.95 }}
          transition={{
            type: "spring",
            damping: 18,
            stiffness: 150,
            mass: 0.8,
            restDelta: 0.001
          }}
          className="fixed top-[66px] h-[calc(100vh-80px)] left-[136px] z-50 w-84 max-w-[calc(100vw-150px)] glass-panel bg-[#070e24]/95 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl border border-white/[0.12] overflow-y-auto origin-left"
        >
          <div>
            {/* Title matches button text "任務" exactly */}
            <div className="pb-3 border-b border-white/[0.08] mb-4 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-bold text-slate-100 font-sans">任務</h2>
            </div>

            {/* Quests List */}
            <div className="space-y-3">
              {quests.map((quest) => (
                <div
                  key={quest.id}
                  className="p-3.5 glass-card rounded-xl space-y-2 relative group"
                >
                  {/* Header: Title + Status */}
                  <div className="flex items-start justify-between gap-2 text-xs font-semibold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />
                      <span className="text-slate-100 font-bold font-sans truncate">
                        [{quest.category}] {quest.title}
                      </span>
                    </div>
                    <span
                      className={`font-hud font-bold px-1.5 py-0.5 rounded text-[12px] flex-shrink-0 ${
                        quest.status === '進行中'
                          ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
                          : quest.status === '已完成'
                          ? 'text-sky-400 bg-sky-950/40'
                          : 'text-slate-500 bg-white/[0.02]'
                      }`}
                    >
                      {quest.status}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="text-xs text-slate-100 leading-relaxed pl-3 font-sans markdown-body !text-slate-100">
                    <Markdown>{quest.description}</Markdown>
                  </div>

                  {/* Meta Info: 報酬 / 日期 / 期限 / 目標 */}
                  <div className="pl-3 pt-1 space-y-1.5 text-[12px] font-sans">
                    {/* 報酬 */}
                    {quest.reward && (
                      <div className="flex items-center gap-1.5 text-amber-300/90">
                        <Coins className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-slate-200">報酬：</span>
                        <span className="font-semibold text-amber-300">{quest.reward}</span>
                      </div>
                    )}

                    {/* 接取日期 & 期限倒數 */}
                    {(quest.acceptedDate || quest.deadlineDays !== undefined) && (
                      <div className="flex items-center justify-between text-slate-300 gap-2 pt-0.5">
                        {quest.acceptedDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0" />
                            <span>接取：{quest.acceptedDate}</span>
                          </div>
                        )}

                        {quest.deadlineDays !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-3 h-3 text-sky-400 flex-shrink-0" />
                            <span
                              className={
                                quest.status === '已完成'
                                  ? 'text-slate-500'
                                  : quest.deadlineDays <= 1
                                  ? 'text-rose-400 font-bold'
                                  : 'text-sky-300 font-medium'
                              }
                            >
                              {quest.status === '已完成'
                                ? '已結算'
                                : quest.deadlineDays === 0
                                ? '今日到期'
                                : `剩餘 ${quest.deadlineDays} 天`}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 目標地點 */}
                    {quest.target && (
                      <div className="text-[12px] text-sky-400/80 flex items-center gap-1.5 pt-0.5">
                        <MapPin className="w-3 h-3 text-sky-400 flex-shrink-0" />
                        <span>目標：{quest.target}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: 回報 / 放棄 */}
                  {quest.status === '待回報' && (
                    <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/[0.05]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReportQuest?.(quest);
                        }}
                        className="flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-bold font-sans tracking-wider">回報</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbandonQuest?.(quest);
                        }}
                        className="flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-bold font-sans tracking-wider">放棄</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.08] text-[12px] text-slate-500 text-center font-hud">
            PORT MISSION LOG • {quests.length} 筆任務
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
