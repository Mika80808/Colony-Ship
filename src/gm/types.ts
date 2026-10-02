import {
  DialogueSegment,
  DialogueTurn,
  GmCommand,
  InventoryItem,
  NPCData,
  Objective,
  PlayerProfile,
  PlayerStats,
  Quest,
} from '../types';

/** 送給 GM 的完整局勢。組 prompt 時只能用這裡面的資料。 */
export interface GmContext {
  playerInput: string;
  profile: PlayerProfile;
  stats: PlayerStats;
  quests: Quest[];
  items: InventoryItem[];
  /** 目前場景在場、可被指涉的 NPC。 */
  presentNpcs: NPCData[];
  locationName: string;
  /** 星曆日期與時刻。NPC 的日常活動要對得上時間才有意義。 */
  gameDate: string;
  gameTime: string;
  dialogueHistory: DialogueTurn[];
  /** 左欄的當前目標。GM 要能看見才不會重複開一樣的目標，也才敢引用 id 結案。 */
  objectives: Objective[];
  /** 左欄的當前摘要。改寫前要先知道現在寫了什麼。 */
  summary: string;
  /** 船上物資狀態（前端物資帳整理好的幾行文字，game/supplies.ts）。只供參考，讓角色自然提起。 */
  supplies?: string[];
  /**
   * 這個場景裡可查詢的設施終端與它目前顯示的內容（例：溫室工作站的生長報表）。
   * 角色要先到終端前查看才知道這些內容，prompt 會講明，不讓 NPC 憑空報數字。
   */
  terminals?: { name: string; lines: string[] }[];
}

/** GM 的回應。與先前 mock 的形狀相同，App 的套用邏輯不需要改。 */
export interface GmResult {
  segments: DialogueSegment[];
  commands: GmCommand[];
}

/**
 * GM 呼叫失敗的分類。
 * 分類是為了讓介面能給出「玩家能據以行動」的訊息，
 * 而不是把原始錯誤丟到畫面上。
 */
export type GmErrorKind =
  | 'no-key'
  | 'auth'
  | 'quota'
  | 'network'
  | 'format'
  | 'blocked'
  | 'unknown';

export class GmError extends Error {
  kind: GmErrorKind;
  constructor(kind: GmErrorKind, message: string) {
    super(message);
    this.name = 'GmError';
    this.kind = kind;
  }
}
