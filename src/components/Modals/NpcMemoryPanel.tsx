import { Brain, BookOpen, Lock } from 'lucide-react';
import type { NPCData, NpcMemory } from '../../types';
import { MEMORY_PARAMS } from '../../game/memory';

/** 內心想法顯示幾則（新的在前）。 */
const THOUGHTS_SHOWN = 5;

interface NpcMemoryPanelProps {
  npc: NPCData;
  memory?: NpcMemory;
  /** 切換某篇日誌是否帶進 GM 局勢。 */
  onToggleLog?: (logId: string) => void;
}

/**
 * 人物頁的運行資料與記憶（骨架第十一節「運行資料的呈現」）。
 * - 頂端：好感度、關係描述、上次見面的地點與日期。
 * - 記憶・內心想法：通道 ② 的 thought 窗口，沒有門檻。
 * - 記憶・專屬記憶庫：NPC 日誌，好感達門檻才解鎖；門檻只管玩家看不看得到，GM 那邊照常注入。
 */
export default function NpcMemoryPanel({ npc, memory, onToggleLog }: NpcMemoryPanelProps) {
  const thoughts = [...(memory?.thoughts ?? [])].reverse().slice(0, THOUGHTS_SHOWN);
  const logs = [...(memory?.logs ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const lastMet = memory?.thoughts.at(-1);
  const unlocked = npc.affection >= MEMORY_PARAMS.closeAffection;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/[0.05]">
        <div>
          <span className="text-slate-400">好感：</span>
          {npc.affection}
        </div>
        <div>
          <span className="text-slate-400">關係：</span>
          {npc.relationship}
        </div>
        <div className="col-span-2">
          <span className="text-slate-400">上次見面：</span>
          {lastMet ? `${lastMet.at}，${lastMet.place}` : '還沒見過面'}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[12px]">
          <Brain className="w-3.5 h-3.5 text-sky-400" />
          <span>記憶・內心想法</span>
        </div>
        {thoughts.length ? (
          <ul className="space-y-1">
            {thoughts.map((thought) => (
              <li key={thought.id} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1">
                <span className="text-slate-500 mr-1.5">{thought.at.slice(5)}｜{thought.place}</span>
                {thought.text}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-slate-500">還沒有。跟他說說話吧。</div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-slate-400 mb-1 text-[12px]">
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>記憶・專屬記憶庫</span>
        </div>
        {!unlocked ? (
          <div className="flex items-center gap-1.5 text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>需好感度 ≥ {MEMORY_PARAMS.closeAffection} 解鎖窺探（目前 {npc.affection}）</span>
          </div>
        ) : logs.length ? (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className={`bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5 ${log.enabled ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-sky-300 font-semibold">{log.title}</span>
                  {onToggleLog && (
                    <label className="flex items-center gap-1 text-[12px] text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={log.enabled} onChange={() => onToggleLog(log.id)} className="accent-sky-500" />
                      供 GM 參考
                    </label>
                  )}
                </div>
                <div className="whitespace-pre-line">{log.content}</div>
                {log.keywords.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {log.keywords.map((keyword) => (
                      <span key={keyword} className="text-[12px] text-slate-400 bg-white/[0.05] rounded px-1.5">#{keyword}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-500">他還沒有寫下關於你的事。</div>
        )}
      </div>
    </div>
  );
}
