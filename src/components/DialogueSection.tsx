import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { History, Map as MapIcon, SendHorizontal, User, Zap } from 'lucide-react';
import { DialogueTurn, DialogueExpression, ModalType, ToastMessage, NPCData } from '../types';
import { sound } from '../utils/audio';

/**
 * 對話框頭像要用哪張圖。
 *
 * 退路是有意的：表情列舉裡有些值不一定備了圖（thinking 目前就沒有），
 * 而 GM 想標什麼表情不該被素材進度綁住。找不到就退回預設頭像，
 * 絕不回傳拼出來的路徑 —— 那會變成畫面上一個破圖。
 */
export function resolvePortrait(npc: NPCData | undefined, expression?: DialogueExpression) {
  if (!npc) return undefined;
  return (expression && npc.expressionUrls?.[expression]) || npc.portraitUrl;
}

interface DialogueSectionProps {
  onOpenModal: (type: ModalType) => void;
  onSendMessage: (text: string) => void;
  dialogueHistory: DialogueTurn[];
  quickReplies: string[];
  toast?: ToastMessage | null;
  stage?: React.ReactNode;
  npcs: NPCData[];
  /** GM 回應中。期間停用輸入，避免疊出多筆平行請求。 */
  gmPending?: boolean;
  /** GM 呼叫失敗的訊息。顯示到下一次送出為止，不進對話歷史。 */
  gmError?: string | null;
  /** 助理 AI 正在產生快速回覆。 */
  quickRepliesPending?: boolean;
  /** 快速回覆產生失敗的原因。此時 quickReplies 為通用備用回覆。 */
  quickRepliesError?: string | null;
  /** 打開快速回覆選單時呼叫，由外層決定要不要請助理 AI 產生新的建議。 */
  onRequestQuickReplies?: () => void;
}

export default function DialogueSection({ onOpenModal, onSendMessage, dialogueHistory, quickReplies, toast, stage, npcs, gmPending = false, gmError = null, quickRepliesPending = false, quickRepliesError = null, onRequestQuickReplies }: DialogueSectionProps) {
  const [inputText, setInputText] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestTurn = dialogueHistory.at(-1);
  const segments = latestTurn?.segments ?? [];
  const segment = segments[segmentIndex];
  // 目前這格若是敘述，說話者與表情都沿用前一句對白 —— 頭像不該因為插了一段
  // 環境描寫就跳回預設，那會讓角色看起來在對話中途突然收起表情。
  const speaking = useMemo(() => {
    for (let index = segmentIndex; index >= 0; index--) if (segments[index]?.speaker) return segments[index];
    return undefined;
  }, [segmentIndex, segments]);

  const lastSpeaker = speaking?.speaker ?? '系統';
  const speakerNpc = npcs.find(npc => npc.name === lastSpeaker);
  const portrait = resolvePortrait(speakerNpc, speaking?.expression);
  useEffect(() => setSegmentIndex(0), [latestTurn]);
  useEffect(() => { const el = textareaRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(Math.max(el.scrollHeight, 28), 120)}px`; } }, [inputText]);
  const send = (text = inputText) => { if (!text.trim() || gmPending) return; sound.playClick(); onSendMessage(text.trim()); setInputText(''); setShowQuickReplies(false); };
  const advance = () => { if (segmentIndex < segments.length - 1) { sound.playClick(); setSegmentIndex((value) => value + 1); } };

  return <div className="flex-1 flex flex-row gap-3.5 h-full min-w-0 overflow-hidden">
    <section className="relative flex-1 flex flex-col justify-end h-full min-w-0 pb-1 gap-4">
      <div id="npc-stage" className="flex-1 min-h-0 relative">{stage}</div>
      <div className="dialogue-panel w-full max-w-[900px] mx-[10px] p-3 flex gap-4 z-30 items-stretch">
        {/* 頭像框固定 1:1，對應 1024×1024 的頭像素材；不跟右側對話區一起拉高，否則 object-cover 會裁掉左右。 */}<div className="w-[140px] flex-shrink-0 relative self-center">
          {toast && <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-3 py-1.5 rounded-sm text-[13px] font-bold shadow whitespace-nowrap z-50">{toast.text}</div>}
          <div className="w-full aspect-square rounded-xl bg-[#081024]/80 border border-sky-500/30 flex flex-col justify-end p-2 relative overflow-hidden text-center">{/* 半透明只套在「沒有頭像」的佔位圖示上；套在外層會連真頭像一起變淡、透出底色而發灰。 */}<div className="absolute inset-0 flex items-center justify-center pb-5">{portrait ? <><img src={portrait} alt={speakerNpc?.name ?? lastSpeaker} className="absolute inset-0 w-full h-full object-cover" />{/* 頭像恢復全亮後，底部名字需要一層漸層襯底才讀得清楚。 */}<div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#081024]/90 to-transparent" /></> : <User className="w-11 h-11 text-sky-400 opacity-60" />}</div><span className="relative text-xs font-hud font-bold text-sky-100 tracking-[0.1em] truncate">{lastSpeaker}</span></div>
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0 h-[160px] relative">
          {showHistory && <div className="mb-1 p-3 bg-[#060a16]/95 border border-sky-500/30 rounded-xl max-h-40 overflow-y-auto text-xs space-y-3 absolute bottom-[100%] left-0 w-full z-40 shadow-xl"><div className="text-[12px] font-hud text-sky-400 font-bold border-b border-sky-500/30 pb-1">系統日誌</div>{dialogueHistory.map((turn, idx) => <div key={idx}><div className="text-sky-300">[你] {turn.playerInput}</div>{turn.segments.map((item, i) => <div key={i} className="text-slate-300 pl-2">[{item.speaker ?? '描述'}] {item.text}</div>)}</div>)}</div>}
          <div className="flex-1 rounded-xl bg-[#050914]/70 border border-white/[0.08] p-4 relative min-h-[70px] flex flex-col justify-center overflow-hidden"><button id="btn-dialogue-history" onClick={() => setShowHistory(!showHistory)} className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-sky-300"><History className="w-4 h-4" /></button>{gmError ? <div className="text-left text-[14px] text-rose-300 leading-relaxed pl-2 pr-8">{gmError}</div> : gmPending ? <div className="text-left text-[14px] text-sky-300/80 leading-relaxed pl-2 pr-8 animate-pulse">GM 思考中…</div> : <button onClick={advance} className="text-left !text-[14px] !text-white leading-relaxed pl-2 pr-8 markdown-body" title={segmentIndex < segments.length - 1 ? '點擊繼續' : undefined}><Markdown>{segment?.text ?? '輸入訊息以開始互動。'}</Markdown>{segmentIndex < segments.length - 1 && <span className="text-sky-400 text-xs">　▸</span>}</button>}</div>
          <div className="w-full relative">{showQuickReplies && <div className="absolute bottom-full mb-2 left-0 z-30 w-72 glass-panel border border-sky-500/30 flex flex-col p-1.5 gap-1 rounded-xl bg-[#060a16]">{quickRepliesPending ? <div className="px-3.5 py-2 text-[13px] text-sky-300/80 animate-pulse">助理 AI 產生建議中…</div> : <>{quickRepliesError && <div className="px-3.5 pt-1.5 pb-1 text-[12px] leading-relaxed text-rose-300/90">{quickRepliesError}<span className="block text-slate-500">以下為通用回覆：</span></div>}{quickReplies.map((reply) => <button key={reply} disabled={gmPending} onClick={() => send(reply)} className="text-left px-3.5 py-2 text-[13px] text-slate-200 hover:bg-sky-500/20 rounded-lg disabled:text-slate-600 disabled:hover:bg-transparent">{reply}</button>)}</>}</div>}<div className="w-full flex items-end glass-input rounded-xl px-2.5 py-1.5 border-white/[0.12]"><button onClick={() => { const next = !showQuickReplies; setShowQuickReplies(next); if (next) onRequestQuickReplies?.(); }} className="p-1.5 text-amber-400 mr-1" title="快速回覆（由助理 AI 依對話產生）"><Zap className="w-4 h-4" /></button><textarea id="dialogue-input-field" ref={textareaRef} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} disabled={gmPending} placeholder={gmPending ? '[GM 回應中，請稍候...]' : '[輸入指令或回覆訊息... (Shift + Enter 發送)]'} rows={1} className="bg-transparent text-[14px] text-sky-50 placeholder-sky-200/30 focus:outline-none flex-1 px-2 resize-none py-1 min-h-[28px] max-h-[120px]" /><button id="btn-send-message" disabled={gmPending} onClick={() => send()} className="p-1.5 text-sky-400 hover:text-sky-200 disabled:text-slate-600 disabled:hover:text-slate-600"><SendHorizontal className="w-4 h-4" /></button></div></div>
        </div>
      </div>
    </section>
    <aside className="w-24 flex-shrink-0 flex flex-col items-end h-full"><button id="btn-map-right" onClick={() => { sound.playClick(); onOpenModal('map'); }} className="sidebar-icon-btn w-12 h-12 rounded-xl" title="地圖"><MapIcon className="w-6 h-6" /></button></aside>
  </div>;
}
