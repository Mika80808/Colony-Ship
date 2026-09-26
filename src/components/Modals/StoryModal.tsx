import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  MapPin,
  User,
  Package,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import {
  StoryChapter,
  NPCData,
  StoryItem,
  MapSector,
  MergedStory,
  NpcSchedule,
  RoomDef,
  SectorEntry,
  StoryKind,
  ItemDefinition,
  SCHEDULE_KIND_LABEL,
  SCHEDULE_NATURE_LABEL,
} from '../../types';
import { sound } from '../../utils/audio';
import ModalShell from './ModalShell';
import StoryForm, { FieldDef, FormValues } from './StoryForm';
import ScheduleEditor from './ScheduleEditor';
import { INITIAL_AFFECTION, INITIAL_RELATIONSHIP } from '../../data/initialGameData';
import { departmentOptions, makeBuiltinId, scheduleLocationIds, scheduleLocationName } from '../../data/story';
import { NpcFormErrors, validateRoom, validateSchedules } from '../../data/storyValidation';

type StoryTabType = 'character' | 'item' | 'event' | 'location';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /*
   * 資料與更新函式都由外部傳入。元件本身不持有這些清單，
   * 避免故事書內的新增或編輯傳不回 App、App 的變動故事書也收不到。
   * story 是內建內容 + 本局條目 + 覆寫的合併結果；交回的清單由 App 依來源拆回各層。
   */
  story: MergedStory;
  /** 內建地點。日程的地點與部門只能從這裡選。 */
  builtinSectors: SectorEntry[];
  /** 內建房號清單。 */
  rooms: RoomDef[];
  /** 玩家的房號。NPC 不能選這間。 */
  playerRoomId?: string;
  onChangeChapters: (next: StoryChapter[]) => void;
  onChangeNpcs: (next: NPCData[]) => void;
  onChangeItems: (next: StoryItem[]) => void;
  onChangeSectors: (next: MapSector[]) => void;
  /** 切換條目的啟用狀態（存在存檔的覆寫裡）。 */
  onToggleEnabled: (kind: StoryKind, id: string) => void;
  initialTab?: StoryTabType;
  initialCharacterId?: string | null;
}

const TAB_LIST: { id: StoryTabType; label: string }[] = [
  { id: 'character', label: '角色' },
  { id: 'item', label: '物品' },
  { id: 'event', label: '事件' },
  { id: 'location', label: '地點' },
];

const TAB_LABEL: Record<StoryTabType, string> = {
  character: '角色',
  item: '物品',
  event: '事件',
  location: '地點',
};

/** 分頁對應的資料種類。 */
const TAB_KIND: Record<StoryTabType, StoryKind> = {
  character: 'npcs',
  item: 'items',
  event: 'chapters',
  location: 'sectors',
};

/**
 * 四個分頁的表單欄位定義，共用同一套表單元件渲染。
 * 角色的部門與房號選項來自內建清單，由 fieldsFor 在執行時補上。
 */
const FORM_SCHEMA: Record<StoryTabType, FieldDef[]> = {
  character: [
    { key: 'name', label: '姓名', kind: 'text', placeholder: '角色名稱', span: 'half', autoFocus: true },
    { key: 'gender', label: '性別', kind: 'select', options: ['男', '女', '其他', '無'], span: 'half' },
    { key: 'age', label: '年齡', kind: 'text', placeholder: '年齡', span: 'half' },
    { key: 'position', label: '職位', kind: 'text', placeholder: '角色職位', span: 'half' },
    { key: 'department', label: '所屬部門', kind: 'select', span: 'half' },
    { key: 'roomId', label: '房號', kind: 'select', span: 'half' },
    { key: 'appearance', label: '外貌', kind: 'text', placeholder: '外貌特徵', span: 'full' },
    { key: 'personality', label: '性格', kind: 'text', placeholder: '性格描述', span: 'full' },
    { key: 'background', label: '背景', kind: 'textarea', placeholder: '角色背景故事', span: 'full', rows: 2 },
    // 提示刻意寫成「時間 地點 活動」的條列：GM 這樣讀最準。結構化的日程在下方另外編輯。
    { key: 'routine', label: '日常活動', kind: 'textarea', placeholder: '08:00 工程部值班\n13:00 中央公園吃午餐\n20:00 多半待在 A-1 房裡打電動', span: 'full', rows: 3 },
    { key: 'other', label: '其他', kind: 'textarea', placeholder: '備註或其他情報', span: 'full', rows: 2 },
  ],
  // 設定集的物品定義沒有「數量」：持有幾個屬於玩家背包，不屬於設定集。
  item: [
    { key: 'name', label: '物品名稱', kind: 'text', placeholder: '物品名稱...', span: 'half', autoFocus: true },
    { key: 'category', label: '類別', kind: 'select', options: ['消耗品', '裝備'], span: 'half' },
    { key: 'effectText', label: '效果提示（例如：+15 體力 / LV 1 權限）', kind: 'text', placeholder: '效果描述...', span: 'full' },
    { key: 'description', label: '詳細描述', kind: 'textarea', placeholder: '物品功能與背景描述...', span: 'full', rows: 3 },
  ],
  event: [
    { key: 'title', label: '事件標題', kind: 'text', placeholder: '航行事件名稱...', span: 'full', autoFocus: true },
    { key: 'summary', label: '摘要', kind: 'text', placeholder: '事件簡要...', span: 'full' },
    { key: 'fullText', label: '內容', kind: 'textarea', placeholder: '事件紀錄...', span: 'full', rows: 5 },
  ],
  location: [
    { key: 'code', label: '區域代碼', kind: 'text', placeholder: '例如：SEC-01...', span: 'half', autoFocus: true },
    { key: 'name', label: '地點名稱', kind: 'text', placeholder: '例如：艦橋指揮中心...', span: 'half' },
    { key: 'description', label: '區域機能與環境描述', kind: 'textarea', placeholder: '說明該區域...', span: 'full', rows: 3 },
  ],
};

/** 新增時的預設值。沒列到的欄位一律空字串。 */
function blankForm(tab: StoryTabType, locationCount: number): FormValues {
  const values: FormValues = {};
  for (const field of FORM_SCHEMA[tab]) {
    values[field.key] = '';
  }
  if (tab === 'character') values.gender = '男';
  if (tab === 'item') {
    values.category = '消耗品';
    values.effectText = '+10 體力';
  }
  if (tab === 'location') values.code = `SEC-0${locationCount + 1}`;
  return values;
}

const matches = (query: string, ...fields: (string | undefined)[]) => {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
};

/** 一組日程的簡述，例如「00–08 A-1 房（睡眠）」。 */
function describeSchedule(group: NpcSchedule, locationName: (id: string) => string): string {
  const hh = (h: number) => String(h).padStart(2, '0');
  return group.slots
    .map((slot) => `${hh(slot.start)}–${hh(slot.end)} ${locationName(slot.locationId)}（${SCHEDULE_NATURE_LABEL[slot.nature]}）`)
    .join('、');
}

export default function StoryModal({
  isOpen,
  onClose,
  story,
  builtinSectors,
  rooms,
  playerRoomId,
  onChangeChapters,
  onChangeNpcs,
  onChangeItems,
  onChangeSectors,
  onToggleEnabled,
  initialTab = 'character',
  initialCharacterId = null,
}: StoryModalProps) {
  const { npcs, items: itemDefinitions, chapters, sectors } = story;

  const [activeTab, setActiveTab] = useState<StoryTabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // CRUD State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 四張表單共用同一個表單物件，欄位由 FORM_SCHEMA 決定。
  const [form, setForm] = useState<FormValues>({});
  // 表單開啟時的原始值，用來判斷玩家是否真的改過東西。
  const pristineFormRef = useRef<FormValues>({});
  // 日程是巢狀資料，不塞進字串表單，另外保存。
  const [schedules, setSchedules] = useState<NpcSchedule[]>([]);
  const pristineSchedulesRef = useRef<string>('[]');
  // 儲存校驗失敗時的錯誤，依欄位標示在表單上。
  const [formErrors, setFormErrors] = useState<NpcFormErrors>({});

  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: StoryTabType;
    id: string;
    name: string;
  } | null>(null);
  // 表單有未儲存內容時，遮罩點擊與 Esc 先跳這個確認，不直接關閉。
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (initialCharacterId) {
        setActiveTab('character');
        setSelectedCharacterId(initialCharacterId);
      }
    } else {
      setSelectedCharacterId(null);
      setIsEditing(false);
      setEditingId(null);
      setShowDiscardConfirm(false);
    }
  }, [isOpen, initialTab, initialCharacterId]);

  const selectedCharacter = selectedCharacterId
    ? npcs.find((c) => c.id === selectedCharacterId) ?? null
    : null;

  const departments = departmentOptions(builtinSectors);
  const sectorName = (id: string) => builtinSectors.find((s) => s.id === id)?.name ?? `（不存在的地點：${id}）`;
  const locationName = (id: string) => scheduleLocationName(id, builtinSectors, rooms);

  /** 角色表單的部門與房號選項。房號旁標出目前住戶，選之前就看得到有沒有人住。 */
  const fieldsFor = (tab: StoryTabType): FieldDef[] => {
    if (tab !== 'character') return FORM_SCHEMA[tab];
    return FORM_SCHEMA.character.map((field) => {
      if (field.key === 'department') {
        return { ...field, options: [{ value: '', label: '（無）' }, ...departments.map((d) => ({ value: d.id, label: d.name }))] };
      }
      if (field.key === 'roomId') {
        return {
          ...field,
          options: [
            { value: '', label: '（不住居住區）' },
            ...rooms.map((room) => {
              const occupant = room.id === playerRoomId ? '玩家' : npcs.find((npc) => npc.roomId === room.id && npc.id !== editingId)?.name;
              return { value: room.id, label: occupant ? `${room.id}・${occupant}` : room.id };
            }),
          ],
        };
      }
      return field;
    });
  };

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isDirty =
    isEditing &&
    (FORM_SCHEMA[activeTab].some(
      (f) => (form[f.key] ?? '') !== (pristineFormRef.current[f.key] ?? '')
    ) ||
      (activeTab === 'character' && JSON.stringify(schedules) !== pristineSchedulesRef.current));

  const openForm = (values: FormValues, id: string | null, initialSchedules: NpcSchedule[] = []) => {
    setForm(values);
    pristineFormRef.current = values;
    setSchedules(initialSchedules);
    pristineSchedulesRef.current = JSON.stringify(initialSchedules);
    setFormErrors({});
    setEditingId(id);
    setIsEditing(true);
  };

  const handleToggleEnabled = (tab: StoryTabType, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sound.playClick();
    onToggleEnabled(TAB_KIND[tab], id);
  };

  const handleStartAdd = () => {
    sound.playClick();
    openForm(blankForm(activeTab, sectors.length), null);
  };

  const handleStartEdit = (
    type: StoryTabType,
    entity: NPCData | StoryItem | StoryChapter | MapSector
  ) => {
    sound.playClick();
    setActiveTab(type);
    const values: FormValues = {};
    for (const field of FORM_SCHEMA[type]) {
      const raw = (entity as unknown as Record<string, unknown>)[field.key];
      values[field.key] = raw == null ? '' : String(raw);
    }
    const entitySchedules = type === 'character' ? (entity as NPCData).schedules ?? [] : [];
    openForm(values, entity.id, entitySchedules);
    setSelectedCharacterId(type === 'character' ? entity.id : null);
  };

  const handleRequestDelete = (type: StoryTabType, id: string, name: string) => {
    sound.playClick();
    setDeleteConfirmTarget({ type, id, name });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmTarget) return;
    const { type, id } = deleteConfirmTarget;
    sound.playClick();

    if (type === 'character') {
      onChangeNpcs(npcs.filter((c) => c.id !== id));
      if (selectedCharacterId === id) { setSelectedCharacterId(null); closeForm(); }
    } else if (type === 'item') {
      onChangeItems(itemDefinitions.filter((i) => i.id !== id));
    } else if (type === 'event') {
      onChangeChapters(chapters.filter((e) => e.id !== id));
    } else if (type === 'location') {
      onChangeSectors(sectors.filter((l) => l.id !== id));
    }
    setDeleteConfirmTarget(null);
  };

  const handleCancelDelete = () => {
    sound.playClick();
    setDeleteConfirmTarget(null);
  };

  const closeForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setShowDiscardConfirm(false);
    setFormErrors({});
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const value = (key: string) => (form[key] ?? '').trim();

    if (activeTab === 'character') {
      // 校驗失敗不儲存，錯誤標在對應欄位上。
      const errors: NpcFormErrors = {
        ...(value('name') ? {} : { name: '姓名必填' }),
        ...validateSchedules(schedules, scheduleLocationIds(builtinSectors, rooms)),
        ...validateRoom(value('roomId'), editingId, npcs, rooms, playerRoomId),
      };
      if (Object.keys(errors).length) {
        setFormErrors(errors);
        return;
      }
      // 空白就存空白，不再代填「未知」「無」：代填的字會被 GM 當成設定讀進去。
      const patch = {
        name: value('name'),
        age: value('age'),
        gender: form.gender || '男',
        position: value('position'),
        department: value('department') || undefined,
        roomId: value('roomId') || undefined,
        appearance: value('appearance'),
        personality: value('personality'),
        background: value('background'),
        routine: value('routine'),
        // 好感門檻只屬於好感解鎖組；組的類型改過之後殘留的門檻不存。
        schedules: schedules.map(({ affectionThreshold, ...group }) =>
          group.kind === 'affection' ? { ...group, affectionThreshold } : group
        ),
        other: value('other'),
      };
      // 好感、關係、啟用狀態屬於本局進度，不在 patch 裡；新角色帶的預設值
      // 只是為了符合型別，App 拆回內建內容時會剝掉。
      onChangeNpcs(
        editingId
          ? npcs.map((c) => (c.id === editingId ? { ...c, ...patch } : c))
          : [
              {
                id: makeBuiltinId('npcs'),
                source: 'builtin',
                ...patch,
                affection: INITIAL_AFFECTION,
                relationship: INITIAL_RELATIONSHIP,
                enabled: true,
              },
              ...npcs,
            ]
      );
    } else if (activeTab === 'item') {
      if (!value('name')) return;
      const patch = {
        name: value('name'),
        category: (form.category === '裝備' ? '裝備' : '消耗品') as ItemDefinition['category'],
        effectText: value('effectText'),
        description: value('description'),
      };
      onChangeItems(
        editingId
          ? itemDefinitions.map((i) => (i.id === editingId ? { ...i, ...patch } : i))
          : [{ id: makeBuiltinId('items'), source: 'builtin', enabled: true, ...patch }, ...itemDefinitions]
      );
    } else if (activeTab === 'event') {
      if (!value('title')) return;
      const patch = {
        title: value('title'),
        summary: value('summary'),
        fullText: value('fullText'),
      };
      onChangeChapters(
        editingId
          ? chapters.map((ev) => (ev.id === editingId ? { ...ev, ...patch } : ev))
          : [{ id: makeBuiltinId('chapters'), source: 'builtin', enabled: true, unlocked: true, ...patch }, ...chapters]
      );
    } else if (activeTab === 'location') {
      if (!value('name')) return;
      const patch = {
        code: value('code'),
        name: value('name'),
        description: value('description'),
      };
      onChangeSectors(
        editingId
          ? sectors.map((l) => (l.id === editingId ? { ...l, ...patch } : l))
          : [
              {
                id: makeBuiltinId('sectors'),
                source: 'builtin',
                isCurrent: false,
                status: '正常' as MapSector['status'],
                enabled: true,
                connectedTo: [],
                ...patch,
              },
              ...sectors,
            ]
      );
    }

    sound.playSuccess();
    closeForm();
  };

  const handleCancel = () => {
    sound.playClick();
    closeForm();
  };

  const handleCloseModal = () => {
    closeForm();
    setDeleteConfirmTarget(null);
    onClose();
  };

  // 點遮罩或按 Esc 的入口：先收次級對話框，再處理未儲存防呆。
  const handleRequestClose = () => {
    if (showDiscardConfirm) {
      setShowDiscardConfirm(false);
      return;
    }
    if (deleteConfirmTarget) {
      setDeleteConfirmTarget(null);
      return;
    }
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    if (selectedCharacter) {
      closeForm();
      setSelectedCharacterId(null);
      return;
    }
    handleCloseModal();
  };

  // Filtered datasets
  const filteredCharacters = npcs.filter((c) =>
    matches(
      searchQuery,
      c.name, c.position, c.appearance, c.personality, c.background, c.roomId,
      c.department ? sectorName(c.department) : undefined
    )
  );
  const filteredItems = itemDefinitions.filter((i) =>
    matches(searchQuery, i.name, i.category, i.description, i.effectText)
  );
  const filteredEvents = chapters.filter((ev) =>
    matches(searchQuery, ev.title, ev.summary, ev.fullText)
  );
  const filteredLocations = sectors.filter((loc) =>
    matches(searchQuery, loc.name, loc.code, loc.description)
  );

  /** 物品 / 事件 / 地點三個分頁共用的列樣式。停用的條目淡化顯示。 */
  const rowClass = (enabled: boolean) =>
    `p-3.5 glass-card rounded-xl relative transition-all group flex items-start gap-3 hover:border-white/[0.2] hover:bg-white/[0.04] ${
      enabled ? '' : 'opacity-50'
    }`;

  /** 啟用勾選框。預設啟用；停用後 AI 之後不會讀到這則條目。 */
  const renderEnabledToggle = (tab: StoryTabType, id: string, enabled: boolean, extraClass = '') => (
    <button
      type="button"
      onClick={(e) => handleToggleEnabled(tab, id, e)}
      className={`checkbox-neon ${enabled ? 'active' : ''} ${extraClass}`}
      title={enabled ? '已啟用（點擊停用）' : '已停用（點擊啟用）'}
      aria-pressed={enabled}
      aria-label="啟用"
    >
      <Check
        className={`w-3.5 h-3.5 stroke-[3] transition-transform ${enabled ? 'scale-100' : 'scale-0'}`}
      />
    </button>
  );

  const renderRowActions = (
    type: StoryTabType,
    entity: NPCData | StoryItem | StoryChapter | MapSector,
    name: string
  ) => (
    <div className="flex items-center gap-[7px] pl-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleStartEdit(type, entity);
        }}
        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-sky-300 hover:bg-white/[0.08] transition"
        title="修改"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleRequestDelete(type, entity.id, name);
        }}
        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/[0.08] transition"
        title="刪除"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const renderRowTitle = (title: string, suffix?: React.ReactNode) => (
    <span className="text-slate-100 flex items-center gap-1.5 font-sans min-w-0 truncate">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-sky-400" />
      <span className="font-bold text-sm truncate text-slate-100">
        {title}
      </span>
      {suffix}
    </span>
  );

  const emptyState = (Icon: typeof Package, label: string) => (
    <div className="flex flex-col items-center justify-center h-36 text-slate-400 text-xs gap-2">
      <Icon className="w-8 h-8 text-slate-600" />
      <span>查無符合條件的{label}</span>
    </div>
  );

  const editForm = (
            <form
              onSubmit={handleSave}
              className="p-3 glass-card rounded-xl space-y-2 shadow-lg animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                <span className="flex items-center gap-1.5 font-bold">
                  {editingId ? (
                    <Pencil className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span>
                    {editingId ? '編輯' : '新增'}
                    {TAB_LABEL[activeTab]}
                  </span>
                </span>
              </div>

              <StoryForm
                compact={!!selectedCharacter}
                fields={fieldsFor(activeTab)}
                values={form}
                onChange={setField}
                errors={formErrors}
              />

              {activeTab === 'character' && (
                <ScheduleEditor
                  schedules={schedules}
                  onChange={setSchedules}
                  locations={builtinSectors}
                  rooms={rooms}
                  errors={formErrors}
                />
              )}

              {Object.keys(formErrors).length > 0 && (
                <div className="text-[12px] text-rose-300">有欄位未通過檢查，尚未儲存。</div>
              )}

              <div className="flex justify-end items-center gap-2 pt-1">
                <button type="button" onClick={handleCancel} className="btn-standard text-xs py-1 px-3">
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
  );

  return (
    <ModalShell
      id="modal-storybook"
      isOpen={isOpen}
      onRequestClose={handleRequestClose}
      size="lg"
      fillHeight
    >
      <>
        {/* Top Header Bar: Horizontal Tabs on Left, Add + Search + Close on Right */}
        <div className="flex items-center justify-between gap-3 mb-3.5 flex-shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/30 border border-white/[0.06]">
            {TAB_LIST.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    sound.playClick();
                    setActiveTab(tab.id);
                    setSearchQuery('');
                    closeForm();
                    setSelectedCharacterId(null);
                  }}
                  className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-700/80 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`搜尋${TAB_LABEL[activeTab]}...`}
                  className="w-32 sm:w-40 h-7 pl-8 pr-7 text-xs bg-white/[0.04] border border-white/[0.08] focus:border-sky-400/50 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none transition"
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

            {!isEditing && (
              <button
                onClick={handleStartAdd}
                className="w-7 h-7 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 active:scale-95 text-sky-300 hover:text-white border border-sky-400/40 flex items-center justify-center transition cursor-pointer shadow-sm flex-shrink-0"
                title={`新增${TAB_LABEL[activeTab]}`}
                aria-label="新增"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                sound.playClick();
                handleRequestClose();
              }}
              className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 text-slate-400 hover:text-slate-100 flex items-center justify-center transition border border-white/[0.06] flex-shrink-0"
              title="關閉"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body Area */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {isEditing && !selectedCharacter ? (
            /* ================= EDIT / CREATE FORM ================= */
            editForm
          ) : (
            <>
              {/* ================= 1. 角色 Tab: Grid Layout ================= */}
              {activeTab === 'character' && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,260px))] gap-4 sm:gap-5">
                  {filteredCharacters.map((npc) => (
                    <div
                      key={npc.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedCharacterId(npc.id);
                      }}
                      className={`bg-white p-[10px] pb-0 rounded-sm border border-white/40 hover:border-white transition-all duration-200 cursor-pointer group shadow-[0_8px_20px_rgba(0,0,0,0.6)] hover:shadow-[0_14px_28px_rgba(0,229,255,0.25)] flex flex-col relative text-center hover:-translate-y-1 transform-gpu ${
                        npc.enabled ? '' : 'opacity-50'
                      }`}
                      /* 高度 = 上緣留白 10 + 照片 200 + 名字 28，三者要一起改 */
                      style={{ height: '238px', width: '220px' }}
                      title={`點擊查看 ${npc.name}`}
                    >
                      {/* Photo Area */}
                      {/* 頭像素材是 1:1，這一格也必須是 1:1 —— 之前是 200×158，
                          object-cover 會把頭頂和下巴裁掉。 */}
                      <div className="bg-black relative overflow-hidden flex-shrink-0 w-[200px] h-[200px]">
                        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/30 via-transparent to-slate-950/90 pointer-events-none" />

                        {/* 優先用專為卡片準備的細節圖 —— 一整排卡片裡要能一眼認人。
                            沒有就退回對話框頭像，再沒有才用立繪。 */}
                        {(npc.cardUrl || npc.portraitUrl || npc.fullBodyUrl) ? (
                          <img
                            src={npc.cardUrl || npc.portraitUrl || npc.fullBodyUrl}
                            alt={npc.name}
                            className="absolute inset-0 w-full h-full object-cover object-top"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 group-hover:opacity-90 transition-opacity">
                            <User className="w-12 h-12 sm:w-14 sm:h-14 text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
                          </div>
                        )}

                        {/* 啟用勾選框：常駐顯示，停用的卡片看得出來 */}
                        <div className="absolute top-2 left-2 z-20">
                          {renderEnabledToggle('character', npc.id, npc.enabled)}
                        </div>

                        {/* Top Action Buttons (Edit / Delete) */}
                        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition z-20">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit('character', npc);
                            }}
                            className="w-6 h-6 rounded bg-black/75 hover:bg-sky-500 text-slate-300 hover:text-slate-950 flex items-center justify-center transition shadow blur-weak"
                            title="修改"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestDelete('character', npc.id, npc.name);
                            }}
                            className="w-6 h-6 rounded bg-black/75 hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center transition shadow blur-weak"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* NAME at the bottom white part of the Polaroid */}
                      <div className="relative z-10 truncate w-full h-[28px] flex items-center justify-center">
                        <span className="text-sm sm:text-[15px] font-bold text-slate-800 group-hover:text-slate-950 transition-colors font-sans drop-shadow-sm tracking-wider">
                          {npc.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ================= 2. 物品 Tab ================= */}
              {activeTab === 'item' && (
                <div className="space-y-2.5">
                  {filteredItems.length === 0
                    ? emptyState(Package, '物品')
                    : filteredItems.map((item) => {
                        return (
                          <div key={item.id} className={rowClass(item.enabled)}>
                            <div className="pt-0.5 flex-shrink-0">
                              {renderEnabledToggle('item', item.id, item.enabled)}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold gap-2">
                                {renderRowTitle(
                                  item.name,
                                  <span className="text-[12px] font-normal text-slate-400 flex-shrink-0">
                                    ({item.category})
                                  </span>
                                )}

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {item.effectText && (
                                    <span className="font-hud font-bold px-2 py-0.5 rounded text-[12px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30">
                                      {item.effectText}
                                    </span>
                                  )}
                                  {renderRowActions('item', item, item.name)}
                                </div>
                              </div>

                              <div className="text-xs text-slate-300 leading-relaxed font-sans pl-3 markdown-body">
                                <Markdown>{item.description}</Markdown>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                </div>
              )}

              {/* ================= 3. 事件 Tab ================= */}
              {activeTab === 'event' && (
                <div className="space-y-2.5">
                  {filteredEvents.length === 0
                    ? emptyState(Calendar, '事件')
                    : filteredEvents.map((ev) => {
                        return (
                          <div key={ev.id} className={rowClass(ev.enabled)}>
                            <div className="pt-0.5 flex-shrink-0">
                              {renderEnabledToggle('event', ev.id, ev.enabled)}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold gap-2">
                                {renderRowTitle(ev.title)}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {renderRowActions('event', ev, ev.title)}
                                </div>
                              </div>

                              <div className="pl-3 space-y-1 text-xs text-slate-300 leading-relaxed font-sans">
                                {ev.summary && (
                                  <div className="text-slate-400 italic markdown-body">
                                    <Markdown>{ev.summary}</Markdown>
                                  </div>
                                )}
                                <div className="pt-1 text-slate-200 markdown-body">
                                  <Markdown>{ev.fullText}</Markdown>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                </div>
              )}

              {/* ================= 4. 地點 Tab ================= */}
              {activeTab === 'location' && (
                <div className="space-y-2.5">
                  {filteredLocations.length === 0
                    ? emptyState(MapPin, '地點')
                    : filteredLocations.map((loc) => {
                        return (
                          <div key={loc.id} className={rowClass(loc.enabled)}>
                            <div className="pt-0.5 flex-shrink-0">
                              {renderEnabledToggle('location', loc.id, loc.enabled)}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-semibold gap-2">
                                {renderRowTitle(loc.name)}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {loc.code && (
                                    <span className="font-hud font-bold px-2 py-0.5 rounded text-[12px] text-sky-400 bg-sky-950/40 border border-sky-500/30">
                                      {loc.code}
                                    </span>
                                  )}
                                  {renderRowActions('location', loc, loc.name)}
                                </div>
                              </div>

                              <div className="text-xs text-slate-300 leading-relaxed font-sans pl-3 markdown-body">
                                <Markdown>{loc.description}</Markdown>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Selected Character Detail Dialog Overlay */}
        <AnimatePresence>
          {selectedCharacter && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-20 flex justify-end overflow-hidden rounded-2xl"
            >
              <div
                className="absolute inset-0 bg-slate-950/60 blur-weak"
                onClick={handleRequestClose}
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                className="relative z-10 w-full max-w-4xl h-full bg-[#0a1226]/95 border-l border-white/[0.12] shadow-2xl p-5 flex flex-col sm:flex-row gap-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Left Column: 立繪 (9:16) */}
                <div className="w-1/2 mx-auto sm:w-auto sm:h-full flex-shrink-0 flex items-center justify-center">
                  <div className="w-full sm:w-auto sm:h-full aspect-[9/16] bg-slate-900/50 rounded-xl border border-white/[0.08] flex items-center justify-center overflow-hidden relative shadow-inner">
                    {selectedCharacter.fullBodyUrl ? (
                      <img
                        src={selectedCharacter.fullBodyUrl}
                        alt={selectedCharacter.name}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-slate-500 font-mono text-sm tracking-wider">
                        [name_normal]
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Column: Info */}
                <div className="flex-1 flex flex-col min-w-0 h-full">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                    <h3 className="text-lg font-bold text-slate-100 font-sans truncate pr-2">
                      {selectedCharacter.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => { if (!isEditing) handleStartEdit('character', selectedCharacter); }}
                        aria-pressed={isEditing}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-sky-500 text-slate-300 hover:text-slate-950 flex items-center justify-center transition"
                        title="修改"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleRequestDelete(
                            'character',
                            selectedCharacter.id,
                            selectedCharacter.name
                          )
                        }
                        className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center transition"
                        title="刪除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleRequestClose}
                        className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-slate-100 flex items-center justify-center transition"
                        title="關閉詳情"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 text-xs text-slate-200 leading-relaxed font-sans pb-4">
                    {isEditing ? editForm : <>
                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/[0.05]">
                      <div>
                        <span className="text-slate-400">性別：</span>
                        {selectedCharacter.gender}
                      </div>
                      <div>
                        <span className="text-slate-400">年齡：</span>
                        {selectedCharacter.age}
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">職位：</span>
                        {selectedCharacter.position}
                      </div>
                      <div>
                        <span className="text-slate-400">部門：</span>
                        {selectedCharacter.department ? sectorName(selectedCharacter.department) : '無'}
                      </div>
                      <div>
                        <span className="text-slate-400">房號：</span>
                        {selectedCharacter.roomId ?? '不住居住區'}
                      </div>
                    </div>

                    {!!selectedCharacter.schedules?.length && (
                      <div>
                        <div className="text-slate-400 mb-0.5 text-[12px]">日程</div>
                        <div className="space-y-0.5">
                          {selectedCharacter.schedules.map((group, index) => (
                            <div key={index}>
                              <span className="text-sky-300">
                                {SCHEDULE_KIND_LABEL[group.kind]}
                                {group.kind === 'affection' ? `（好感 ≥ ${group.affectionThreshold}）` : ''}：
                              </span>
                              {describeSchedule(group, locationName)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedCharacter.appearance && (
                      <div>
                        <div className="text-slate-400 mb-0.5 text-[12px]">外貌</div>
                        <div>{selectedCharacter.appearance}</div>
                      </div>
                    )}

                    {selectedCharacter.personality && (
                      <div>
                        <div className="text-slate-400 mb-0.5 text-[12px]">性格</div>
                        <div>{selectedCharacter.personality}</div>
                      </div>
                    )}

                    {selectedCharacter.background && (
                      <div>
                        <div className="text-slate-400 mb-0.5 text-[12px]">背景</div>
                        <div className="markdown-body">
                          <Markdown>{selectedCharacter.background}</Markdown>
                        </div>
                      </div>
                    )}

                    {selectedCharacter.other && (
                      <div>
                        <div className="text-slate-400 mb-0.5 text-[12px]">其他</div>
                        <div>{selectedCharacter.other}</div>
                      </div>
                    )}
                    </>}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Secondary Delete Confirmation Modal Overlay */}
        <AnimatePresence>
          {deleteConfirmTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 z-50 bg-slate-950/80 blur-mid flex items-center justify-center p-4 rounded-2xl"
              onClick={handleCancelDelete}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-[#091124] border border-rose-500/35 rounded-2xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(244,63,94,0.18)] flex flex-col items-center text-center space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                  <AlertTriangle className="w-6 h-6 text-rose-400" />
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-slate-100 font-sans">
                    確認刪除此項目？
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans px-2">
                    確定要刪除「
                    <span className="text-rose-300 font-semibold">
                      {deleteConfirmTarget.name}
                    </span>
                    」嗎？此操作將無法復原。
                  </p>
                </div>

                <div className="flex items-center gap-2.5 w-full pt-1">
                  <button
                    type="button"
                    onClick={handleCancelDelete}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white border border-white/[0.1] transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>確認刪除</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 未儲存內容防呆：沿用上面刪除確認的樣式 */}
        {showDiscardConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 blur-mid flex items-center justify-center p-4 rounded-2xl animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-[#091124] border border-amber-500/35 rounded-2xl p-5 shadow-[0_16px_40px_rgba(0,0,0,0.85),0_0_30px_rgba(245,158,11,0.18)] flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                <Pencil className="w-6 h-6 text-amber-400" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-slate-100 font-sans">
                  放棄未儲存的內容？
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans px-2">
                  編輯中的{TAB_LABEL[activeTab]}尚未儲存，關閉後這些變更將會遺失。
                </p>
              </div>

              <div className="flex items-center gap-2.5 w-full pt-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setShowDiscardConfirm(false);
                  }}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-slate-300 bg-white/[0.06] hover:bg-white/[0.12] hover:text-white border border-white/[0.1] transition cursor-pointer"
                >
                  繼續編輯
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)] transition cursor-pointer"
                >
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
