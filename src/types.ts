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

export interface NPCData {
  id: string;
  name: string;
  age: string;
  gender: string;
  position: string;
  appearance: string;
  personality: string;
  background: string;
  other: string;
  location?: string;
  affection: number;
  relationship: string;
  /** 頭像路徑。對話框左側 140px 框與頭像框使用。本輪留空。 */
  portraitUrl?: string;
  /** 立繪路徑。故事書人物資料的大圖使用。本輪留空。 */
  fullBodyUrl?: string;
}

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
export type DialogueExpression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking';

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
  | { type: 'adjust_affection'; npcId: string; amount: number; relationship?: string };

export interface StoryChapter {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  unlocked?: boolean;
}

export interface MapSector {
  id: string;
  name: string;
  code: string;
  isCurrent: boolean;
  status: '正常' | '維修中' | '管制區';
  description: string;
  connectedTo: string[];
  /**
   * 背景圖路徑。同時作為場景層背景與地圖進入過場的畫面，只需一個欄位。
   * 本輪留空，查不到時場景層退回 CSS 漸層佔位。
   */
  backgroundUrl?: string;
}
