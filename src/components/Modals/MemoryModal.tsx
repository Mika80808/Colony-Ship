import React, { useEffect, useState } from 'react';
import { Brain, Check, Pencil, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import type { LayeredMemory, MemoryLayer, MemoryWeight } from '../../types';
import { MemoryDraft, isLive, validateMemoryDraft } from '../../game/memory';
import { sound } from '../../utils/audio';
import ModalShell from './ModalShell';

const LAYER_LABEL: Record<MemoryLayer, string> = { world: '全站', region: '區域', scene: '場景', npc: '人物' };
const LAYER_HINT: Record<MemoryLayer, string> = {
  world: '全站都知道的事，到哪裡都會帶給 GM。',
  region: '某個區域的近況，在那一區和相鄰區域時帶給 GM。',
  scene: '某個房間或場所裡的事，只在那裡帶給 GM。',
  npc: '某個人的事，那個人在場時帶給 GM（好感 ≥ 60 時不在場也帶重要的）。',
};
const WEIGHT_LABEL: Record<MemoryWeight, string> = { critical: '重要', normal: '一般', flavor: '點綴' };
const WEIGHT_CLASS: Record<MemoryWeight, string> = {
  critical: 'text-amber-300 bg-amber-500/10 border-amber-400/30',
  normal: 'text-sky-300 bg-sky-950/40 border-sky-500/30',
  flavor: 'text-slate-300 bg-white/[0.05] border-white/[0.1]',
};
const FILTERS: (MemoryLayer | 'all')[] = ['all', 'world', 'region', 'scene', 'npc'];

interface Option {
  id: string;
  name: string;
}

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memories: LayeredMemory[];
  gameDate: string;
  /** 區域層可選的地點（區域 id）。 */
  regions: Option[];
  /** 場景層可選的地點（區域 id 代表走廊或場所本身，另含房號）。 */
  scenes: Option[];
  npcs: Option[];
  /** 新增時預設帶入玩家所在處。 */
  currentRegion: string;
  currentScene: string;
  /** 回傳 false 表示沒寫進去（已有相同的記憶）。 */
  onAdd: (draft: MemoryDraft) => boolean;
  onUpdate: (id: string, draft: MemoryDraft) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

/** 分層記憶（通道 ①）的管理介面：看 GM 記下了什麼、手寫補充、停用或刪掉不想讓 GM 記得的事。 */
export default function MemoryModal({
  isOpen, onClose, memories, gameDate, regions, scenes, npcs, currentRegion, currentScene,
  onAdd, onUpdate, onToggle, onDelete,
}: MemoryModalProps) {
  const [filter, setFilter] = useState<MemoryLayer | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<MemoryDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keywordText, setKeywordText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) return;
    setDraft(null);
    setEditingId(null);
    setError(null);
    setDeleteId(null);
  }, [isOpen]);

  const nameOf = (list: Option[], id?: string) => list.find((item) => item.id === id)?.name ?? id ?? '';
  const scopeOf = (memory: LayeredMemory) =>
    memory.layer === 'npc' ? nameOf(npcs, memory.npcId)
      : memory.layer === 'region' ? nameOf(regions, memory.location)
      : memory.layer === 'scene' ? nameOf(scenes, memory.location)
      : '';

  const shown = [...memories]
    .filter((memory) => filter === 'all' || memory.layer === filter)
    .filter((memory) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [memory.content, scopeOf(memory), ...(memory.keywords ?? [])].some((text) => text.toLowerCase().includes(q));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const openForm = (next: MemoryDraft, id: string | null) => {
    sound.playClick();
    setDraft(next);
    setEditingId(id);
    setKeywordText(next.keywords.join('、'));
    setError(null);
  };

  const startAdd = () => openForm({
    layer: filter === 'all' ? 'region' : filter,
    text: '', weight: 'normal', keywords: [], location: currentRegion, npcId: '', expire: '',
  }, null);

  const startEdit = (memory: LayeredMemory) => openForm({
    layer: memory.layer,
    text: memory.content,
    weight: memory.weight,
    keywords: memory.keywords ?? [],
    location: memory.location ?? '',
    npcId: memory.npcId ?? '',
    expire: memory.expire ?? '',
  }, memory.id);

  const changeLayer = (layer: MemoryLayer) => setDraft((prev) => prev && {
    ...prev,
    layer,
    // 換層時地點預設成玩家所在處，免得留著上一層的 id。
    location: layer === 'region' ? currentRegion : layer === 'scene' ? currentScene : '',
    npcId: layer === 'npc' ? prev.npcId || npcs[0]?.id || '' : '',
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const next = { ...draft, keywords: keywordText.split(/[、,，;；\s]+/).filter(Boolean) };
    const problem = validateMemoryDraft(next);
    if (problem) { setError(problem); return; }
    if (editingId) onUpdate(editingId, next);
    else if (!onAdd(next)) { setError('已經有一筆一樣的記憶了。'); return; }
    sound.playSuccess();
    setDraft(null);
    setEditingId(null);
  };

  const requestClose = () => {
    if (deleteId) { setDeleteId(null); return; }
    if (draft) { setDraft(null); setEditingId(null); return; }
    onClose();
  };

  const select = 'h-8 glass-input rounded-lg px-2 text-xs text-slate-100 focus:outline-none';

  return (
    <ModalShell id="modal-memory" isOpen={isOpen} onRequestClose={requestClose} size="md" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Brain className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">記憶</h2>
        </div>
        <div className="flex items-center gap-1.5 flex-1 justify-end">
          {!draft && (
            <div className="relative flex items-center flex-1 max-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋記憶..."
                className="w-full h-7 pl-8 pr-2 text-xs bg-white/[0.04] border border-white/[0.08] focus:border-sky-400/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          )}
          {!draft && (
            <button type="button" onClick={startAdd} title="手寫一筆記憶" aria-label="新增"
              className="w-7 h-7 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 hover:text-white border border-sky-400/40 flex items-center justify-center transition flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button type="button" onClick={() => { sound.playClick(); onClose(); }} title="關閉" aria-label="關閉"
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-slate-100 flex items-center justify-center border border-white/[0.06] flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {draft ? (
        <form onSubmit={save} className="p-3.5 glass-card rounded-xl space-y-2.5 text-xs font-sans overflow-y-auto">
          <div className="flex items-center gap-1.5 font-semibold text-sky-300">
            {editingId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{editingId ? '修改記憶' : '手寫記憶'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">層次</span>
              <select className={`${select} w-full`} value={draft.layer} onChange={(e) => changeLayer(e.target.value as MemoryLayer)}>
                {(Object.keys(LAYER_LABEL) as MemoryLayer[]).map((layer) => <option key={layer} value={layer}>{LAYER_LABEL[layer]}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">重要度</span>
              <select className={`${select} w-full`} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value as MemoryWeight })}>
                {(Object.keys(WEIGHT_LABEL) as MemoryWeight[]).map((weight) => <option key={weight} value={weight}>{WEIGHT_LABEL[weight]}</option>)}
              </select>
            </label>
            {(draft.layer === 'region' || draft.layer === 'scene') && (
              <label className="space-y-1 col-span-2">
                <span className="text-slate-400">地點</span>
                <select className={`${select} w-full`} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}>
                  <option value="">（請選擇）</option>
                  {(draft.layer === 'region' ? regions : scenes).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
                </select>
              </label>
            )}
            {draft.layer === 'npc' && (
              <label className="space-y-1 col-span-2">
                <span className="text-slate-400">對象</span>
                <select className={`${select} w-full`} value={draft.npcId} onChange={(e) => setDraft({ ...draft, npcId: e.target.value })}>
                  <option value="">（請選擇）</option>
                  {npcs.map((npc) => <option key={npc.id} value={npc.id}>{npc.name}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="text-[12px] text-slate-500">{LAYER_HINT[draft.layer]}</div>
          <textarea
            value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={3} autoFocus
            placeholder="用一句話寫清楚事實，例如：A 區走廊的照明這兩天忽明忽暗。"
            className="w-full glass-input rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none resize-y"
          />
          <label className="block space-y-1">
            <span className="text-slate-400 flex items-center gap-1"><Tag className="w-3 h-3 text-sky-400" />關鍵字（選填，以頓號分隔）</span>
            <input
              type="text" value={keywordText} onChange={(e) => setKeywordText(e.target.value)} placeholder="停電、借工具"
              className="w-full h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none"
            />
            <span className="text-[12px] text-slate-500">填了就變成「被提起才想起」的記憶。填事件標記，不要填人名地名。</span>
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">有效期限（選填，當天仍有效；今天是 {gameDate}）</span>
            <input
              type="text" value={draft.expire} onChange={(e) => setDraft({ ...draft, expire: e.target.value.trim() })} placeholder="YYYY-MM-DD"
              className="w-40 h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none font-hud"
            />
          </label>
          {error && <div className="text-rose-300">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { sound.playClick(); setDraft(null); setEditingId(null); }} className="btn-standard text-xs py-1 px-3">取消</button>
            <button type="submit" className="btn-primary-neon text-xs py-1 px-3.5 flex items-center gap-1.5"><Check className="w-3.5 h-3.5" />儲存</button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap shrink-0">
            {FILTERS.map((item) => (
              <button
                key={item} type="button" onClick={() => { sound.playClick(); setFilter(item); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-sans transition ${filter === item ? 'bg-sky-700/80 text-white font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'}`}
              >
                {item === 'all' ? '全部' : LAYER_LABEL[item]}
                <span className="ml-1 text-[12px] opacity-70">{item === 'all' ? memories.length : memories.filter((m) => m.layer === item).length}</span>
              </button>
            ))}
          </div>
          <div className="text-[12px] text-slate-500 mb-2 font-sans shrink-0">GM 在劇情裡記下的事與你手寫的事。停用的不會帶給 GM。</div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 space-y-2 font-sans">
            {shown.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs gap-2">
                <Brain className="w-7 h-7 text-slate-600" />
                <span>{query || filter !== 'all' ? '查無符合條件的記憶' : '還沒有任何記憶'}</span>
              </div>
            )}
            {shown.map((memory) => {
              const expired = !!memory.expire && memory.expire < gameDate;
              const scope = scopeOf(memory);
              return (
                <div key={memory.id} className={`p-3 glass-card rounded-xl flex items-start gap-2.5 text-xs ${isLive(memory, gameDate) ? '' : 'opacity-50'}`}>
                  <button
                    type="button" onClick={() => { sound.playClick(); onToggle(memory.id); }}
                    className={`checkbox-neon mt-0.5 ${memory.enabled ? 'active' : ''}`}
                    title={memory.enabled ? '已啟用（點擊停用）' : '已停用（點擊啟用）'} aria-pressed={memory.enabled} aria-label="啟用"
                  >
                    <Check className={`w-3.5 h-3.5 stroke-[3] transition-transform ${memory.enabled ? 'scale-100' : 'scale-0'}`} />
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 rounded border text-sky-200 bg-sky-900/40 border-sky-400/30">{LAYER_LABEL[memory.layer]}{scope ? `｜${scope}` : ''}</span>
                      <span className={`px-1.5 rounded border ${WEIGHT_CLASS[memory.weight]}`}>{WEIGHT_LABEL[memory.weight]}</span>
                      <span className="text-slate-500">{memory.author === 'player' ? '手寫' : 'GM'}・{memory.createdAt}</span>
                      {memory.expire && <span className={expired ? 'text-rose-300' : 'text-slate-500'}>{expired ? '已過期' : `到 ${memory.expire}`}</span>}
                    </div>
                    <div className="text-slate-100 leading-relaxed">{memory.content}</div>
                    {!!memory.keywords?.length && (
                      <div className="flex flex-wrap gap-1">
                        {memory.keywords.map((keyword) => <span key={keyword} className="text-[12px] text-slate-400 bg-white/[0.05] rounded px-1.5">#{keyword}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {deleteId === memory.id ? (
                      <>
                        <button type="button" onClick={() => { sound.playClick(); onDelete(memory.id); setDeleteId(null); }} className="btn-danger text-[12px] py-0.5 px-2">刪除</button>
                        <button type="button" onClick={() => { sound.playClick(); setDeleteId(null); }} className="btn-standard text-[12px] py-0.5 px-2">取消</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(memory)} title="修改"
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-sky-300 hover:bg-white/[0.08]">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => { sound.playClick(); setDeleteId(memory.id); }} title="刪除"
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/[0.08]">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </ModalShell>
  );
}
