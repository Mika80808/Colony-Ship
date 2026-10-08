import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { BookMarked, X, Plus, Check, Pencil, Trash2, Search, Tag, Sparkles } from 'lucide-react';
import { DiaryEntry } from '../../types';
import { sound } from '../../utils/audio';
import ModalShell from './ModalShell';

interface DiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: DiaryEntry[];
  onAddEntry: (entry: Omit<DiaryEntry, 'id'>) => void;
  onUpdateEntry?: (entry: DiaryEntry) => void;
  onDeleteEntry?: (id: string) => void;
  /** 日記作者，即玩家角色的名字。 */
  playerName: string;
  /** 遊戲內日期。日記記的是遊戲日期，不是現實時間。 */
  gameDate: string;
  /** 請助理 AI 依對話紀錄寫一份草稿。回傳的草稿會填進編輯表單，由玩家確認後才儲存。 */
  onGenerateDraft?: () => Promise<{ title: string; summary: string; content: string; tags: string[] }>;
}

export default function DiaryModal({
  isOpen,
  onClose,
  entries,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  playerName,
  gameDate,
  onGenerateDraft,
}: DiaryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  // 表單有未儲存內容時，遮罩點擊與 Esc 先跳這個確認，不直接關閉。
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  /**
   * 自動生成日記：請助理 AI 寫草稿，填進編輯表單。
   * 不直接存檔 —— AI 可能寫錯細節，讓玩家看過、改過再存。
   */
  const handleAutoGenerate = async () => {
    if (!onGenerateDraft || isGenerating) return;
    sound.playClick();
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const draft = await onGenerateDraft();
      setEditingId(null);
      setTitle(draft.title);
      setSummary(draft.summary);
      setContent(draft.content);
      setTags(draft.tags);
      setTagInput('');
      setEnabled(true);
      setIsWriting(true);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : '日記生成失敗，請稍後再試。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleCheck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredEntries = entries.filter((e) => {
    // Tag filter
    if (selectedTag && (!e.tags || !e.tags.includes(selectedTag))) {
      return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = e.title.toLowerCase().includes(q);
    const matchesContent = e.content.toLowerCase().includes(q);
    const matchesDate = e.date.includes(q);
    const matchesTags = e.tags?.some((t) => t.toLowerCase().includes(q));

    return matchesTitle || matchesContent || matchesDate || matchesTags;
  });

  const handleStartAdd = () => {
    sound.playClick();
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setTags([]);
    setTagInput('');
    setEnabled(true);
    setIsWriting(true);
  };

  const handleStartEdit = (entry: DiaryEntry) => {
    sound.playClick();
    setEditingId(entry.id);
    setTitle(entry.title);
    setSummary(entry.summary || '');
    setContent(entry.content);
    setTags(entry.tags ? [...entry.tags] : []);
    setTagInput('');
    setEnabled(entry.enabled);
    setIsWriting(true);
  };

  const handleCancelWriting = () => {
    sound.playClick();
    setIsWriting(false);
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setTags([]);
    setTagInput('');
    setEnabled(true);
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() && !content.trim()) return;

    sound.playSuccess();

    // Auto merge leftover tagInput if present
    let finalTags = [...tags];
    const leftoverTag = tagInput.trim().replace(/^#/, '');
    if (leftoverTag && !finalTags.includes(leftoverTag)) {
      finalTags.push(leftoverTag);
    }

    if (editingId && onUpdateEntry) {
      const existing = entries.find((item) => item.id === editingId);
      onUpdateEntry({
        id: editingId,
        title: title.trim() || '未命名筆記',
        summary: summary.trim() || undefined,
        content: content.trim() || '（無內容）',
        date: existing?.date || gameDate,
        enabled,
        author: existing?.author || playerName || '未具名',
        tags: finalTags.length > 0 ? finalTags : undefined,
      });
    } else {
      onAddEntry({
        title: title.trim() || '未命名筆記',
        summary: summary.trim() || undefined,
        content: content.trim() || '（無內容）',
        date: gameDate,
        enabled,
        author: playerName || '未具名',
        tags: finalTags.length > 0 ? finalTags : undefined,
      });
    }

    setIsWriting(false);
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setTags([]);
    setTagInput('');
    setEnabled(true);
  };

  const handleDeleteClick = (id: string) => {
    sound.playClick();
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId && onDeleteEntry) {
      sound.playClick();
      onDeleteEntry(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => {
    sound.playClick();
    setDeleteConfirmId(null);
  };

  const resetForm = () => {
    setIsWriting(false);
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setTags([]);
    setTagInput('');
  };

  const handleCloseModal = () => {
    sound.playClick();
    resetForm();
    setDeleteConfirmId(null);
    setShowDiscardConfirm(false);
    onClose();
  };

  // 編輯中且真的打了東西才算「有未儲存內容」，空表單直接關掉不必攔。
  const hasUnsavedContent =
    isWriting &&
    (title.trim() !== '' ||
      summary.trim() !== '' ||
      content.trim() !== '' ||
      tags.length > 0 ||
      tagInput.trim() !== '');

  // 點遮罩或按 Esc 的入口：先處理次級對話框，再處理未儲存防呆。
  const handleRequestClose = () => {
    if (showDiscardConfirm) {
      setShowDiscardConfirm(false);
      return;
    }
    if (deleteConfirmId) {
      setDeleteConfirmId(null);
      return;
    }
    if (hasUnsavedContent) {
      setShowDiscardConfirm(true);
      return;
    }
    handleCloseModal();
  };

  return (
    <ModalShell
      id="modal-diary"
      isOpen={isOpen}
      onRequestClose={handleRequestClose}
      size="md"
      className="justify-between overflow-y-auto"
    >
      <>
        <div>
          {/* Header - Search Bar & Action Buttons */}
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-shrink-0">
              <BookMarked className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-bold text-slate-100 font-sans">日誌</h2>
            </div>

            {/* Search Input & Actions */}
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              {!isWriting && (
                <div className="relative flex items-center flex-1 max-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    id="diary-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋日誌或關鍵字..."
                    className="w-full h-7 pl-8 pr-7 text-xs bg-white/[0.04] border border-white/[0.08] focus:border-sky-400/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {!isWriting && (
                <>
                  <button
                    id="btn-diary-auto-generate"
                    onClick={handleAutoGenerate}
                    disabled={isGenerating}
                    className={`w-7 h-7 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 active:scale-95 text-indigo-300 hover:text-white border border-indigo-400/40 flex items-center justify-center transition cursor-pointer shadow-sm flex-shrink-0 disabled:cursor-wait ${isGenerating ? 'animate-pulse' : ''}`}
                    title={isGenerating ? '助理 AI 撰寫中…' : '自動生成日記（由助理 AI 依對話紀錄撰寫草稿）'}
                    aria-label="自動生成日記"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    id="btn-diary-add-entry"
                    onClick={handleStartAdd}
                    className="w-7 h-7 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 active:scale-95 text-sky-300 hover:text-white border border-sky-400/40 flex items-center justify-center transition cursor-pointer shadow-sm flex-shrink-0"
                    title="新增"
                    aria-label="新增"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </>
              )}

              <button
                id="btn-diary-close-x"
                onClick={handleCloseModal}
                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 text-slate-400 hover:text-slate-100 flex items-center justify-center transition border border-white/[0.06] flex-shrink-0"
                title="關閉"
                aria-label="關閉"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 自動生成失敗的原因。下次按下生成時清除。 */}
          {generateError && !isWriting && (
            <div className="mb-2.5 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/30 text-[12px] leading-relaxed text-rose-300">
              {generateError}
            </div>
          )}

          {/* Active Tag Filter Indicator */}
          {selectedTag && !isWriting && (
            <div className="mb-2 flex items-center gap-1.5">
              <span className="text-[12px] text-slate-400 font-sans">關鍵字篩選：</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-sans font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                <Tag className="w-3 h-3 text-sky-400" />
                <span>#{selectedTag}</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-sky-300 hover:text-white ml-0.5"
                  title="清除篩選"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}

          {/* Body Content */}
          <div className="space-y-2.5">
            {isWriting ? (
              <form
                onSubmit={handleSave}
                className="p-3.5 glass-card rounded-xl space-y-2.5 shadow-lg"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                  <span className="flex items-center gap-1.5">
                    {editingId ? <Pencil className="w-3.5 h-3.5 text-sky-400" /> : <Plus className="w-3.5 h-3.5 text-sky-400" />}
                    <span>{editingId ? '修改日誌' : '新增日誌'}</span>
                  </span>
                  <span className="font-hud text-[12px] text-slate-400">
                    {/* 顯示的是遊戲日期，不是現實時間；修改時顯示該篇原本的日期。 */}
                    {(editingId && entries.find((entry) => entry.id === editingId)?.date) || gameDate}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <input
                    id="diary-input-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="日誌標題..."
                    className="w-full h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Summary */}
                <div>
                  <input
                    id="diary-input-summary"
                    type="text"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="摘要 (選填)..."
                    className="w-full h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>

                {/* Content Textarea with manual resize */}
                <div>
                  <textarea
                    id="diary-input-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="日誌內容..."
                    rows={5}
                    className="w-full glass-input rounded-lg px-2.5 py-2 text-xs text-slate-100 focus:outline-none resize-y min-h-[90px] max-h-[400px]"
                  />
                </div>

                <label className="flex items-center gap-2 text-[12px] text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-sky-500" />
                  啟用此則日誌（供 GM 記憶與事件參考）
                </label>

                {/* Keywords (關鍵字) Input & Tag Chips */}
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-sky-400" />
                    <span>關鍵字標籤</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      placeholder="輸入關鍵字按 Enter 新增..."
                      className="flex-1 h-7 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="w-7 h-7 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 hover:text-white border border-sky-400/40 flex items-center justify-center cursor-pointer transition flex-shrink-0"
                      title="新增標籤"
                      aria-label="新增標籤"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Current Tags Chips List */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] bg-sky-950/60 text-sky-200 border border-sky-400/30 font-sans"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="text-slate-400 hover:text-rose-300 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelWriting}
                    className="btn-standard text-xs py-1 px-3"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-neon text-xs py-1 px-3.5 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>儲存</span>
                  </button>
                </div>
              </form>
            ) : filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-36 text-slate-400 text-xs gap-2">
                <BookMarked className="w-8 h-8 text-slate-600" />
                <span>{searchQuery || selectedTag ? '查無符合條件的日誌' : '目前尚無任何日誌記錄'}</span>
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isChecked = checkedIds.has(entry.id);
                return (
                <div
                  key={entry.id}
                  id={`diary-card-${entry.id}`}
                  className={`p-3.5 glass-card rounded-xl relative group transition-all duration-200 cursor-pointer flex items-start gap-3 ${
                    isChecked
                      ? 'bg-sky-900/20 border-sky-400/30 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                      : 'hover:bg-[#101e40]'
                  }`}
                  onClick={(e) => handleToggleCheck(entry.id, e)}
                >
                  <div className="pt-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleToggleCheck(entry.id, e)}
                      className={`checkbox-neon ${isChecked ? 'active' : ''}`}
                      style={{
                        marginTop: '-4px',
                        marginLeft: '0px',
                        marginBottom: '0px',
                      }}
                      title={isChecked ? '取消選取' : '選取'}
                    >
                      <Check
                        className={`w-3.5 h-3.5 stroke-[3] transition-transform ${
                          isChecked ? 'scale-100' : 'scale-0'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-100 flex items-center gap-1.5 font-sans min-w-0 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                            isChecked ? 'bg-sky-300 shadow-[0_0_6px_#38bdf8]' : 'bg-sky-400'
                          }`}
                        />
                        <span className={`font-bold text-[16px] truncate ${isChecked ? 'text-sky-200' : 'text-slate-100'}`}>
                          {entry.title}
                        </span>
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2 pr-[5px]">
                        <span className="font-hud font-bold px-1.5 py-0.5 rounded text-[14px] text-sky-400 bg-sky-950/40 border border-sky-500/30">
                          {entry.date}
                        </span>
                        <div className="flex items-center">
                          <button
                            id={`btn-edit-diary-${entry.id}`}
                            onClick={(e) => { e.stopPropagation(); handleStartEdit(entry); }}
                            className="w-5 h-5 mr-1 rounded hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 flex items-center justify-center transition"
                            title="修改"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {onDeleteEntry && (
                            <button
                              id={`btn-delete-diary-${entry.id}`}
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(entry.id); }}
                              className="w-5 h-5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition"
                              title="刪除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {entry.summary && (
                      <div className="text-[14px] text-sky-300/90 font-semibold mb-1.5 ml-3">
                        {entry.summary}
                      </div>
                    )}
                    <div className="text-[14px] text-slate-400 leading-relaxed line-clamp-2 ml-3 pr-1 mb-1.5 markdown-body !text-[14px]">
                      <Markdown>{entry.content}</Markdown>
                    </div>
                    {/* Keyword Tags List on Card */}
                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 ml-[9px]">
                        {entry.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.playClick();
                              setSelectedTag(selectedTag === tag ? null : tag);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-sans font-medium transition cursor-pointer ${
                              selectedTag === tag
                                ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                                : 'bg-sky-950/40 hover:bg-sky-900/60 text-sky-300 border border-sky-400/20'
                            }`}
                            title={`點擊篩選 #${tag}`}
                          >
                            <Tag className="w-2.5 h-2.5" />
                            <span>#{tag}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="absolute inset-0 z-[60] bg-slate-950/60 blur-weak flex items-center justify-center p-4 rounded-2xl">
          <div className="glass-panel bg-[#070e24]/95 p-5 max-w-sm w-full rounded-2xl border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)] text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400 mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">確認刪除日誌？</h3>
            <p className="text-xs text-slate-400">此操作無法復原，是否確定要刪除這筆航行記錄？</p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={cancelDelete}
                className="btn-standard text-xs py-1.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="btn-danger text-xs py-1.5 px-4"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 未儲存內容防呆：沿用上面刪除確認的樣式 */}
      {showDiscardConfirm && (
        <div className="absolute inset-0 z-[60] bg-slate-950/60 blur-weak flex items-center justify-center p-4 rounded-2xl">
          <div className="glass-panel bg-[#070e24]/95 p-5 max-w-sm w-full rounded-2xl border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] text-center space-y-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 mb-2">
              <Pencil className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">放棄未儲存的內容？</h3>
            <p className="text-xs text-slate-400">
              這篇日誌尚未儲存，關閉後編輯中的內容將會遺失。
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  sound.playClick();
                  setShowDiscardConfirm(false);
                }}
                className="btn-standard text-xs py-1.5 px-4 bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
              >
                繼續編輯
              </button>
              <button onClick={handleCloseModal} className="btn-danger text-xs py-1.5 px-4">
                放棄並關閉
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    </ModalShell>
  );
}
