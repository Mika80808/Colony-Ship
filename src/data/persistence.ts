import type { SuppliesState } from '../game/supplies';
import type { AffectionTally } from '../game/vitals';
import type { GardenState } from '../game/garden';
import type { FreightState } from '../game/freight';
import {
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  DiaryEntry,
  DialogueTurn,
  LayeredMemory,
  NpcMemories,
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
  /**
   * 通道 ① 分層記憶（game/memory.ts）。頂欄「區域記憶」與星圖「場景記憶」都從這裡依地點挑。
   * 取代舊的 areaMemories（純文字清單，從來沒有寫入來源）；舊存檔沒有這欄，讀檔時從空的開始。
   */
  memories?: LayeredMemory[];
  /** 通道 ② NPC 日記：各 NPC 的 thought 窗口與日誌（game/npcMemory.ts）。舊存檔沒有，從空的開始。 */
  npcMemories?: NpcMemories;
  objectives: Objective[];
  summary: string;
  gameDate: string;
  gameTime: string;
  /** 船上物資帳（game/supplies.ts）。舊存檔沒有，讀檔時從開局狀態起算。 */
  supplies?: SuppliesState;
  /** 好感單日上限的帳（game/vitals.ts）。舊存檔沒有，當天從零起算。 */
  affectionTally?: AffectionTally;
  /** 玩家在溫室的菜圃（game/garden.ts）。舊存檔沒有，從空地開始。 */
  garden?: GardenState;
  /** 補給船的貨：接駁口、推車、各區存量（game/freight.ts）。舊存檔沒有，從開局狀態起算。 */
  freight?: FreightState;
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
    return sanitizeSave(JSON.parse(raw));
  } catch {
    // 內容被改壞或被其他程式覆寫，捨棄。
    return null;
  }
}

// ------------------------------------------------------------------ 讀檔驗證
//
// 版本號對、JSON 也解得開，不代表每一欄都是對的型別：手動改過、別的分頁寫到一半、
// 或舊開發版留下的欄位，都可能讓 items 變成物件、stats 少了數字。
// 原樣交給 App 的話，第一個 .map 就讓整個畫面白掉。
// 這裡逐欄檢查：整欄型別不對就拿掉（App 退回新遊戲的初始值），清單裡壞掉的單筆就濾掉，
// 其他好的欄位照常讀回來，不因為一欄壞掉就丟掉整份進度。

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const isStr = (value: unknown): value is string => typeof value === 'string';
const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const hasStrings = (value: unknown, keys: string[]): value is Obj => isObj(value) && keys.every((key) => isStr(value[key]));
/** 陣列裡只留通過檢查的元素；不是陣列就回傳 undefined（整欄拿掉）。 */
const listOf = <T>(value: unknown, ok: (entry: unknown) => boolean): T[] | undefined =>
  Array.isArray(value) ? (value.filter(ok) as T[]) : undefined;

const STORY_KINDS = ['npcs', 'items', 'chapters', 'sectors', 'lore'] as const;

/**
 * 檢查並修整解析後的存檔。不是物件或版本不符回傳 null；其餘欄位逐一檢查，
 * 型別不對的欄位刪掉，讓呼叫端用 `??` 退回初始值。
 */
export function sanitizeSave(parsed: unknown): GameSave | null {
  if (!isObj(parsed) || parsed.version !== SAVE_VERSION) return null;
  const save: Obj = { ...parsed };
  const set = (key: string, value: unknown) => {
    if (value === undefined) delete save[key];
    else save[key] = value;
  };

  set('savedAt', isStr(save.savedAt) ? save.savedAt : undefined);
  set('profile', isObj(save.profile) && Object.values(save.profile).every((v) => v === undefined || isStr(v)) ? save.profile : undefined);
  const stats = save.stats;
  set('stats', isObj(stats) && ['stamina', 'maxStamina', 'hunger', 'maxHunger', 'credits'].every((key) => isNum(stats[key]))
    && Array.isArray(stats.conditions) ? { ...stats, conditions: stats.conditions.filter(isStr) } : undefined);
  set('quests', listOf(save.quests, (q) => hasStrings(q, ['id', 'title', 'status', 'description'])
    && (q.deadlineDays === undefined || isNum(q.deadlineDays))));
  set('items', listOf(save.items, (item) => hasStrings(item, ['id', 'name']) && isNum(item.count) && item.count > 0));
  set('runStory', isObj(save.runStory)
    ? Object.fromEntries(STORY_KINDS.map((kind) => [kind, listOf((save.runStory as Obj)[kind], (entry) => hasStrings(entry, ['id'])) ?? []]))
    : undefined);
  set('storyOverrides', isObj(save.storyOverrides)
    ? Object.fromEntries(STORY_KINDS.map((kind) => {
      const layer = (save.storyOverrides as Obj)[kind];
      return [kind, isObj(layer) ? Object.fromEntries(Object.entries(layer).filter(([, v]) => isObj(v))) : {}];
    }))
    : undefined);
  set('dialogueHistory', listOf<Obj>(save.dialogueHistory, (turn) => hasStrings(turn, ['playerInput']) && Array.isArray(turn.segments))
    ?.map((turn) => ({ ...turn, segments: (turn.segments as unknown[]).filter((seg) => hasStrings(seg, ['text'])) })));
  set('diaryEntries', listOf(save.diaryEntries, (entry) => hasStrings(entry, ['id', 'date', 'title', 'content'])));
  set('currentSectorId', isStr(save.currentSectorId) ? save.currentSectorId : undefined);
  set('currentRoomId', isStr(save.currentRoomId) ? save.currentRoomId : null);
  set('memories', listOf(save.memories, (memory) => hasStrings(memory, ['id', 'layer', 'content'])));
  set('npcMemories', isObj(save.npcMemories)
    ? Object.fromEntries(Object.entries(save.npcMemories).filter(([, v]) => isObj(v) && Array.isArray(v.thoughts) && Array.isArray(v.logs)))
    : undefined);
  set('objectives', listOf(save.objectives, (objective) => hasStrings(objective, ['id', 'text'])));
  set('summary', isStr(save.summary) ? save.summary : undefined);
  // 日期與時間另有固定格式：時鐘、物資、菜圃都從這兩欄推算日序，格式壞了只能從開局時間重來。
  const dateOk = isStr(save.gameDate) && /^\d{4}-\d{2}-\d{2}$/.test(save.gameDate);
  const timeOk = isStr(save.gameTime) && /^\d{2}:\d{2}$/.test(save.gameTime);
  if (!dateOk || !timeOk) { delete save.gameDate; delete save.gameTime; }
  const supplies = save.supplies;
  set('supplies', isObj(supplies) && isNum(supplies.day) && isObj(supplies.store) && isObj(supplies.carrying) ? supplies : undefined);
  const tally = save.affectionTally;
  set('affectionTally', isObj(tally) && isStr(tally.date) && isObj(tally.byNpc) ? tally : undefined);
  const garden = save.garden;
  set('garden', isObj(garden) && isNum(garden.day) && Array.isArray(garden.cells) ? garden : undefined);
  const freight = save.freight;
  set('freight', isObj(freight) && isNum(freight.day) && isNum(freight.nextVoyage) && Array.isArray(freight.dock)
    && Array.isArray(freight.cart) && isObj(freight.stock) && Array.isArray(freight.clearedVoyages)
    && ['parcels', 'carried', 'outbox', 'rewards', 'inbox'].every((key) => freight[key] === undefined || Array.isArray(freight[key]))
    ? freight : undefined);
  return save as unknown as GameSave;
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
