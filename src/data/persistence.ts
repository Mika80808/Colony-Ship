import type { SuppliesState } from '../game/supplies';
import {
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  DiaryEntry,
  DialogueTurn,
  Objective,
  StoryLayer,
  StoryOverrides,
} from '../types';

/**
 * 遊戲存檔。
 *
 * 目前寫在 localStorage，因為這款遊戲是玩家自備 AI 金鑰的純前端架構，
 * 沒有後端可放進度。存檔只存在玩家自己的瀏覽器裡。
 *
 * 注意 localStorage 的兩個實際限制：
 * 1. 容量約 5MB。對話歷史已由 App 限制在 20 回合，但日記與故事書本局條目
 *    沒有上限，寫入失敗時會走 onQuotaExceeded 流程而非靜默失敗。
 * 2. 無痕視窗或封鎖網站資料時，讀寫都可能直接丟例外，
 *    所以每一個存取都包在 try/catch 裡，失敗時遊戲仍要能正常開始。
 */

const SAVE_KEY = 'starport_save';

/**
 * 存檔格式版本。
 * 結構有不相容變動時 +1；載入到舊版存檔會直接捨棄並從新遊戲開始，
 * 不嘗試遷移（遊戲還在開發期，資料不值得寫遷移邏輯）。
 *
 * v2：故事書拆層。內建內容移出存檔（見 data/story.ts），
 * 存檔只留本局條目（runStory）與覆寫（storyOverrides）。
 */
export const SAVE_VERSION = 2;

export interface GameSave {
  version: number;
  savedAt: string;
  profile: PlayerProfile;
  stats: PlayerStats;
  quests: Quest[];
  items: InventoryItem[];
  /** 故事書的本局條目：AI 在這一局生成的條目。內建內容不在存檔裡。 */
  runStory: StoryLayer;
  /** 本局對故事書條目的進度狀態（好感、關係、所在位置、啟用……），以條目 id 對應。 */
  storyOverrides: StoryOverrides;
  dialogueHistory: DialogueTurn[];
  diaryEntries: DiaryEntry[];
  currentSectorId: string;
  currentRoomId: string | null;
  areaMemories: string[];
  objectives: Objective[];
  summary: string;
  gameDate: string;
  gameTime: string;
  /** 船上物資帳（game/supplies.ts）。舊存檔沒有，讀檔時從開局狀態起算。 */
  supplies?: SuppliesState;
}

/** 存檔內容的欄位，不含 version / savedAt 這兩個由寫入端補上的中繼欄位。 */
export type GameSavePayload = Omit<GameSave, 'version' | 'savedAt'>;

/**
 * 讀取存檔。
 * 沒有存檔、格式損毀、版本不符或 localStorage 不可用時一律回傳 null，
 * 呼叫端據此走「新遊戲」流程。
 */
export function loadGameSave(): GameSave | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // 無痕視窗或站台資料被封鎖，視為沒有存檔。
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GameSave;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== SAVE_VERSION) return null;
    return parsed;
  } catch {
    // 內容被改壞或被其他程式覆寫，捨棄。
    return null;
  }
}

/**
 * 寫入存檔。回傳是否成功，讓呼叫端能對容量不足之類的失敗做出反應，
 * 而不是以為存檔成功了。
 */
export function writeGameSave(payload: GameSavePayload): boolean {
  const save: GameSave = {
    ...payload,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/** 清除存檔。重置進度時呼叫，否則重新整理又會把舊進度讀回來。 */
export function clearGameSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 清不掉也無妨，呼叫端已經把記憶體中的狀態重置了。
  }
}

/** 存檔時間，給設定面板顯示「最後存檔」用。沒有存檔時回傳 null。 */
export function readSavedAt(): string | null {
  return loadGameSave()?.savedAt ?? null;
}
