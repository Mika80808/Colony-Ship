export type DrawerType = 'quests' | 'inventory' | 'profile' | null;
export type ModalType = 'map' | 'storybook' | 'diary' | 'settings' | null;
export type ThemeMode = 'dark' | 'light';

export interface ToastMessage {
  id: number;
  text: string;
}

export interface PlayerProfile {
  name: string;
  gender: string;
  age: string;
  appearance: string;
  personality: string;
  other: string;
  /** 劇情由 GM 分發，玩家不可編輯。 */
  profession: string;
  /**
   * 玩家住的房號（ROOMS 的 id），空白表示還沒分到房間。玩家不可編輯，分發邏輯之後再做。
   * NPC 的房號不可與它重複。舊存檔沒有這個欄位，視同空白。
   */
  roomId?: string;
}

export interface PlayerStats {
  stamina: number;
  maxStamina: number;
  hunger: number;
  maxHunger: number;
  credits: number;
  conditions: string[];
}

export interface Quest {
  id: string;
  category: '主要' | '次要';
  title: string;
  status: '進行中' | '待回報' | '已完成';
  description: string;
  target?: string;
  reward?: string;
  acceptedDate?: string;
  deadlineDays?: number;
}

// ------------------------------------------------------------------ 故事書
//
// 故事書分三份資料，前端讀取時合併（見 data/story.ts）：
// 1. 內建內容（BuiltinStory）：開發者編寫，存在獨立的 localStorage 鍵，所有存檔共用。
// 2. 本局條目（RunStory）：AI 在這一局生成，跟著存檔走，新開遊戲時清空。
// 3. 覆寫（StoryOverrides）：本局對條目的進度狀態（好感、所在位置、啟用……），跟著存檔走。
//
// 條目型別（*Entry）只放內容欄位；遊戲各處讀的是合併後的型別（NPCData、MapSector……）。

/**
 * 故事書條目的來源。
 * - builtin：內建內容。
 * - run：本局生成的條目。
 */
export type EntrySource = 'builtin' | 'run';

/** 本局條目 id 的前綴。內建條目不可使用，合併時用它保證兩層不撞 id。 */
export const RUN_ID_PREFIX = 'run-';

/** 啟用狀態。存在覆寫裡，不在條目本身；未覆寫時預設為啟用。 */
export interface EntryToggle {
  enabled: boolean;
}

/**
 * 設定集裡的物品「定義」。故事書物品分頁編輯的是這個。
 * 與玩家實際持有（InventoryItem）是兩回事，兩者資料分開存放。
 */
export interface ItemDefinition {
  id: string;
  name: string;
  category: '消耗品' | '裝備';
  effectText: string;
  description: string;
}

/** 玩家背包裡的一筆持有，是物品定義加上持有數量。 */
export interface InventoryItem extends ItemDefinition {
  count: number;
}

/** 故事書物品條目（內容）。 */
export interface ItemEntry extends ItemDefinition {
  source: EntrySource;
}

/** 故事書物品分頁讀的合併結果。 */
export type StoryItem = ItemEntry & EntryToggle;

/** 日程組的類型。保底必填，其餘選填；觸發條件之後再定。 */
export type ScheduleKind = 'base' | 'duty' | 'affection' | 'event';
export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  base: '保底',
  duty: '值勤',
  affection: '好感解鎖',
  event: '特殊事件',
};

/** 時段性質。 */
export type ScheduleNature = 'duty' | 'meal' | 'free' | 'sleep';
export const SCHEDULE_NATURE_LABEL: Record<ScheduleNature, string> = {
  duty: '值勤',
  meal: '用餐',
  free: '自由',
  sleep: '睡眠',
};

/**
 * 日程中的一個時段，涵蓋 [start, end) 小時，兩端皆為 0–23 的整數。
 * start > end 表示跨午夜（例如 22 → 6）；start === end 表示整天。
 */
export interface ScheduleSlot {
  start: number;
  end: number;
  /**
   * 內建地點（SectorEntry）或內建房號（RoomDef）的 id。
   * 選居住區本身表示在該區走廊，選房號表示在那個房間裡。兩種 id 不會相撞。
   */
  locationId: string;
  nature: ScheduleNature;
}

/**
 * 一組日程。
 * 保底組必須剛好涵蓋 24 小時；其他組可只涵蓋部分時段，但組內不可重疊。
 * 查詢時的優先序（特殊事件 > 好感解鎖 > 值勤 > 保底，上層沒涵蓋的時段落到下一層）
 * 留到在場名單查表時實作。
 */
export interface NpcSchedule {
  kind: ScheduleKind;
  /** 好感門檻。只有好感解鎖組使用，且必填（整數）。 */
  affectionThreshold?: number;
  slots: ScheduleSlot[];
}

/** NPC 條目（內容）。好感、關係、所在位置屬於進度，存在覆寫裡。 */
export interface NpcEntry {
  id: string;
  source: EntrySource;
  name: string;
  age: string;
  gender: string;
  position: string;
  appearance: string;
  personality: string;
  background: string;
  other: string;
  /**
   * 日常活動（自由文字）。GM 用它來決定角色此刻可能在做什麼、玩家去哪裡找得到人。
   * 結構化的日程在 schedules；這一欄保留作補充描述。
   */
  routine?: string;
  /** 結構化日程。 */
  schedules?: NpcSchedule[];
  /** 所屬部門：內建機能區地點的 id。空值表示不屬於任何部門。 */
  department?: string;
  /** 房號：內建房號清單（ROOMS）的 id。空值表示不住居住區。佔用者由這一欄反查。 */
  roomId?: string;
  /** 頭像路徑。對話框左側 140px 框與頭像框使用，也是沒有對應表情圖時的退路。 */
  portraitUrl?: string;
  /** 立繪路徑。故事書人物資料的大圖使用。 */
  fullBodyUrl?: string;
  /**
   * 故事書角色卡的圖。細節比對話框頭像多，玩家在一整排卡片裡比較好認人。
   * 只用在那一處 —— 對話框仍用 portraitUrl 與表情圖，因為那裡需要的是
   * 同一套構圖，換表情時頭才不會跳位。
   */
  cardUrl?: string;
  /**
   * 行走圖。688×688、4×4 格（欄：下／上／左／右，列：四個走路影格），
   * 腳底在每格 y=166。規格與整理工具見 tools/pack_walk_sheet.py。
   */
  walkUrl?: string;
  /**
   * 表情圖。GM 在對白上標了 expression 時，對話框頭像換成這裡對應的圖。
   * 刻意逐項列出而不是用 `資料夾/${expression}.webp` 拼路徑 —— 拼出來的
   * 路徑少一張圖就是 404，而且要等執行到那個表情才會發現。
   */
  expressionUrls?: Partial<Record<DialogueExpression, string>>;
}

/** NPC 身上屬於本局進度的欄位。 */
export interface NpcProgress {
  affection: number;
  relationship: string;
  location?: string;
}

/** 遊戲各處讀的 NPC：內容 + 進度 + 啟用狀態。 */
export type NPCData = NpcEntry & NpcProgress & EntryToggle;

export interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  summary?: string;
  enabled: boolean;
  content: string;
  author: string;
  tags?: string[];
}

export type DialogueSegmentKind = 'dialogue' | 'description';
/** thinking 沒有對應的表情圖，會退回 neutral —— 留著是因為它在敘事上有用。 */
export type DialogueExpression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'shy' | 'thinking';

export interface DialogueSegment {
  kind: DialogueSegmentKind;
  speaker?: string;
  expression?: DialogueExpression;
  text: string;
}

export interface DialogueTurn {
  playerInput: string;
  segments: DialogueSegment[];
}

/** 只有 GM 能提出事件性遊戲狀態變更，App 集中套用。 */
export type GmCommand =
  | { type: 'adjust_stats'; stamina?: number; hunger?: number; credits?: number; addCondition?: string; removeCondition?: string }
  | { type: 'consume_item'; itemId: string; count?: number }
  | { type: 'set_quest_status'; questId: string; status: Quest['status'] }
  | { type: 'adjust_affection'; npcId: string; amount: number; relationship?: string }
  | { type: 'set_summary'; text: string }
  | { type: 'add_objective'; text: string; location?: string }
  | { type: 'complete_objective'; objectiveId: string };

/** 故事書事件條目（內容）。 */
export interface ChapterEntry {
  id: string;
  source: EntrySource;
  title: string;
  summary: string;
  fullText: string;
  unlocked?: boolean;
}

export type StoryChapter = ChapterEntry & EntryToggle;

/** 故事書地點條目（內容）。 */
export interface SectorEntry {
  id: string;
  source: EntrySource;
  name: string;
  code: string;
  description: string;
  connectedTo: string[];
  /**
   * 背景圖路徑。同時作為場景層背景與地圖進入過場的畫面，只需一個欄位。
   * 查不到時場景層退回 CSS 漸層佔位。
   */
  backgroundUrl?: string;
}

/** 地點身上屬於本局進度的欄位。 */
export interface SectorProgress {
  isCurrent: boolean;
  status: '正常' | '維修中' | '管制區';
}

export type MapSector = SectorEntry & SectorProgress & EntryToggle;

/** 居住區房號。內建清單寫在程式碼裡（ROOMS），不經故事書編輯。 */
export interface RoomDef {
  /** 例如 'A-1'，同時是顯示用的房號。 */
  id: string;
  /** 所屬居住區（SectorEntry）的 id。 */
  sectorId: string;
}

/** 故事書四個分頁各自的條目清單。內建內容與本局條目共用這個形狀。 */
export interface StoryLayer {
  npcs: NpcEntry[];
  items: ItemEntry[];
  chapters: ChapterEntry[];
  sectors: SectorEntry[];
}

export type StoryKind = keyof StoryLayer;

/**
 * 覆寫：本局對條目的進度狀態，以條目 id 對應。
 * 內建與本局條目都適用（兩層 id 不會相撞）。沒寫到的欄位用預設值。
 */
export interface StoryOverrides {
  npcs: Record<string, Partial<NpcProgress & EntryToggle>>;
  items: Record<string, Partial<EntryToggle>>;
  chapters: Record<string, Partial<EntryToggle>>;
  sectors: Record<string, Partial<SectorProgress & EntryToggle>>;
}

/** 合併後的故事書，遊戲各處與故事書 UI 讀這一份。 */
export interface MergedStory {
  npcs: NPCData[];
  items: StoryItem[];
  chapters: StoryChapter[];
  sectors: MapSector[];
}

/** LeftSidebar 的當前目標。屬於遊戲進度，會進存檔。 */
export interface Objective {
  id: string;
  text: string;
  location?: string;
  /** 已完成的目標以刪除線呈現。 */
  done?: boolean;
}
