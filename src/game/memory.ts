import type { DiaryEntry, LayeredMemory, MemoryLayer, MemoryWeight } from '../types';
import type { RecalledNpcLog } from './npcMemory';

/**
 * 記憶系統的前端規則（設定文件《遊戲流程骨架》第一節「記憶六通道」、第三節階段 1、第五節日記）。
 *
 * 分工判準是「規則能否寫死」：比對、排序、截斷、組裝一律在前端，不呼叫 LLM。
 * 需要語意判讀的只有「進場語意篩選」（gm/assistant.ts 的 selectSceneMemories），
 * 掛在換場節拍上，回合內不等它。
 *
 * 這支只放純函式，狀態由 App 持有。
 */

/** 可調參數（骨架第十五節）。數字都是暫定，實測後改這裡。 */
export const MEMORY_PARAMS = {
  /** ⑤ 玩家日記：進場語意篩選最多挑幾則。 */
  diarySceneLimit: 3,
  /** ⑤ 玩家日記：關鍵字追加最多幾則。 */
  diaryKeywordLimit: 2,
  /** ⑤ 玩家日記：單則注入最多幾字，超過截斷。 */
  diaryCharLimit: 600,
  /** 場景快取：回到同一場景、在場名單相同、步數差在這以內就重用進場結果。 */
  sceneCacheSteps: 30,
  /** 短期上下文：對話窗口最多幾回合；滿了一次汰除 shortTermEvict 回（批次汰除，前綴快取每十回合才失效一次）。 */
  shortTermWindow: 20,
  shortTermEvict: 10,

  /** ① 進場包四層總數超過這個數就降級，只留 critical。 */
  packTotalLimit: 20,
  /** ① 分層配額 [normal, flavor]；critical 不受配額限制。npc 層是每位在場 NPC 各自的配額。 */
  packQuota: { world: [8, 3], region: [5, 2], scene: [5, 2], npc: [5, 2] } as Record<MemoryLayer, readonly [number, number]>,
  /** ① 不在場但好感達門檻的 NPC：只帶 critical，每人上限。 */
  absentCriticalLimit: 2,
  /** 好感門檻：不在場也帶 critical 記憶；NPC 專屬記憶庫的解鎖門檻也是它（只作用於玩家看得到與否）。 */
  closeAffection: 60,
  /** ① 關鍵字追加每回合最多幾則。 */
  memoryKeywordLimit: 3,
  /** ① 儲存上限。寫入時順帶檢查，超量淘汰（critical 與玩家手寫豁免）。 */
  memoryStoreLimit: 150,
  /** ① 主 GM 一次回應最多寫幾則，防止模型把每句話都記下來。 */
  memoryAddPerTurn: 3,

  /** ② thought 滑動窗口保留幾則。 */
  thoughtWindow: 10,
  /** ② 未歸檔的 thought 累積到這個數就請助理 GM 提煉進當天日誌。 */
  thoughtBatch: 10,
  /** ② 提煉一直失敗時，未歸檔 thought 最多留幾則（再多就丟最舊的，免得存檔無限長）。 */
  thoughtHardCap: 30,
  /** ② thought 單則字數上限。 */
  thoughtCharLimit: 120,
  /** ② NPC 日誌：進場語意篩選每人上限、總額。 */
  npcLogPerNpc: 2,
  npcLogTotal: 4,
  /** ② NPC 日誌：關鍵字追加每回合上限。 */
  npcLogKeywordLimit: 2,
  /** ② NPC 日誌：單篇注入最多幾字（目標長度 500–700 字）。 */
  npcLogCharLimit: 700,
};

// ---------------------------------------------------------------- 關鍵字

/**
 * 關鍵字比對用的正規化：全半形統一、英文轉小寫、去掉空白與標點。
 * 「藍色 外套」「藍色外套」「ＡＩ」「ai」都視為相同。
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 關鍵字有任一則出現在本次輸入裡。空關鍵字不算。 */
export function keywordHit(keywords: readonly string[] | undefined, input: string): boolean {
  if (!keywords?.length) return false;
  const haystack = normalizeForMatch(input);
  if (!haystack) return false;
  return keywords.some((keyword) => {
    const needle = normalizeForMatch(keyword);
    return needle.length > 0 && haystack.includes(needle);
  });
}

/** 合併兩份關鍵字清單：去重（以正規化後比對）、保留先出現的寫法。 */
export function mergeKeywords(base: readonly string[], extra: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const keyword of [...base, ...extra]) {
    const trimmed = keyword.trim();
    const key = normalizeForMatch(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

// ---------------------------------------------------------------- 短期上下文

/**
 * 對話窗口加一回合（骨架第一節「短期上下文」）。
 * 超過 shortTermWindow 時一次汰除最早的 shortTermEvict 回，而不是逐回合擠掉一則：
 * 逐則擠出會讓脈絡開頭每回合改變，後面整段都吃不到快取。
 */
export function pushTurn<T>(history: readonly T[], turn: T): T[] {
  const next = [...history, turn];
  return next.length > MEMORY_PARAMS.shortTermWindow ? next.slice(MEMORY_PARAMS.shortTermEvict) : next;
}

// ---------------------------------------------------------------- ⑤ 玩家日記

/** 注入用的一則日記。 */
export interface RecalledDiary {
  id: string;
  date: string;
  title: string;
  content: string;
}

const toRecalled = (entry: DiaryEntry): RecalledDiary => ({
  id: entry.id,
  date: entry.date,
  title: entry.title,
  content: clip(entry.content.trim(), MEMORY_PARAMS.diaryCharLimit),
});

/**
 * 玩家日記的雙軌檢索（第五節）。
 * - 語意軌：進場時助理 GM 挑好的 id（sceneIds），凍結到離場，置於第五層。
 * - 精確軌：本次輸入命中關鍵字欄，接在第五層尾端。
 * 兩軌去重；只取啟用中的；日記清單本來就是新的在前，照原順序（最新優先）。
 */
export function recallDiaries(
  entries: readonly DiaryEntry[],
  sceneIds: readonly string[],
  input: string,
): { scene: RecalledDiary[]; keyword: RecalledDiary[] } {
  const wanted = new Set(sceneIds);
  const scene = entries
    .filter((entry) => entry.enabled && wanted.has(entry.id))
    .slice(0, MEMORY_PARAMS.diarySceneLimit);
  const taken = new Set(scene.map((entry) => entry.id));
  const keyword = entries
    .filter((entry) => entry.enabled && !taken.has(entry.id) && keywordHit(entry.tags, input))
    .slice(0, MEMORY_PARAMS.diaryKeywordLimit);
  return { scene: scene.map(toRecalled), keyword: keyword.map(toRecalled) };
}

/** 進場語意篩選的候選：啟用中的日記。只送標題、一句摘要與關鍵字，不送內文。 */
export function diaryCandidates(entries: readonly DiaryEntry[]): SceneCandidate[] {
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({ id: entry.id, date: entry.date, title: entry.title, summary: entry.summary ?? '', keywords: entry.tags ?? [] }));
}

// ---------------------------------------------------------------- ① 分層記憶

const WEIGHT_RANK: Record<MemoryWeight, number> = { critical: 0, normal: 1, flavor: 2 };
const newestFirst = (a: LayeredMemory, b: LayeredMemory) => b.createdAt.localeCompare(a.createdAt);

/** 判定 1 啟用、判定 2 期限（期限當天仍有效）。 */
export const isLive = (memory: LayeredMemory, today: string) =>
  memory.enabled && (!memory.expire || memory.expire >= today);

/** 話題型（有關鍵字）走追加區；場景型走進場包。 */
const isTopic = (memory: LayeredMemory) => !!memory.keywords?.some((keyword) => keyword.trim());

/** 進場包的作用範圍：玩家此刻在哪、誰在場、誰跟玩家夠親近。 */
export interface PackScope {
  /** 所在區域 id。 */
  region: string;
  /** 相鄰區域 id（地點條目的 connectedTo）。區域層記憶連同相鄰區域一起帶：消息傳得快。 */
  adjacentRegions: readonly string[];
  /** 場景 id（房號或區域 id）。場景層記憶只帶這裡的。 */
  scene: string;
  presentNpcIds: readonly string[];
  /** 不在場但好感達門檻的 NPC。 */
  closeNpcIds: readonly string[];
  /** 遊戲日期 YYYY-MM-DD。 */
  today: string;
}

/**
 * 判定 5 地點比對：這筆場景型記憶屬不屬於這個作用範圍。
 * 回傳 'present' 表示正常納入，'absent' 表示只是親近的不在場 NPC（之後只留 critical），null 表示不納入。
 */
function packRole(memory: LayeredMemory, scope: PackScope): 'present' | 'absent' | null {
  switch (memory.layer) {
    case 'world': return 'present';
    case 'region': return memory.location === scope.region || scope.adjacentRegions.includes(memory.location ?? '') ? 'present' : null;
    case 'scene': return memory.location === scope.scene ? 'present' : null;
    case 'npc':
      if (scope.presentNpcIds.includes(memory.npcId ?? '')) return 'present';
      return scope.closeNpcIds.includes(memory.npcId ?? '') ? 'absent' : null;
  }
}

/**
 * 算進場包（骨架第三節階段 1「通道 ① 的兩區設計」「注入預算」）。換場時算一次，凍結到離場。
 * 1. 只看場景型記憶，過判定 1 啟用、2 期限、5 地點。
 * 2. 四層總數超過 packTotalLimit 就降級：只留 critical。
 * 3. 否則依配額截斷：critical 全留，normal／flavor 各層取最新的幾則（npc 層每人各算）。
 * 不在場的親近 NPC 另計：只取 critical，每人上限 absentCriticalLimit。
 * 回傳選中的記憶 id。
 */
export function buildEntryPack(memories: readonly LayeredMemory[], scope: PackScope): string[] {
  const main: LayeredMemory[] = [];
  const absent: LayeredMemory[] = [];
  for (const memory of memories) {
    if (!isLive(memory, scope.today) || isTopic(memory)) continue;
    const role = packRole(memory, scope);
    if (role === 'present') main.push(memory);
    else if (role === 'absent' && memory.weight === 'critical') absent.push(memory);
  }

  let kept: LayeredMemory[];
  if (main.length > MEMORY_PARAMS.packTotalLimit) {
    kept = main.filter((memory) => memory.weight === 'critical');
  } else {
    const groups = new Map<string, LayeredMemory[]>();
    for (const memory of main) {
      const key = memory.layer === 'npc' ? `npc:${memory.npcId}` : memory.layer;
      groups.set(key, [...(groups.get(key) ?? []), memory]);
    }
    kept = [];
    for (const group of groups.values()) {
      const [normal, flavor] = MEMORY_PARAMS.packQuota[group[0].layer];
      const sorted = [...group].sort(newestFirst);
      kept.push(
        ...sorted.filter((memory) => memory.weight === 'critical'),
        ...sorted.filter((memory) => memory.weight === 'normal').slice(0, normal),
        ...sorted.filter((memory) => memory.weight === 'flavor').slice(0, flavor),
      );
    }
  }

  const perNpc = new Map<string, number>();
  const close = [...absent].sort(newestFirst).filter((memory) => {
    const count = perNpc.get(memory.npcId!) ?? 0;
    if (count >= MEMORY_PARAMS.absentCriticalLimit) return false;
    perNpc.set(memory.npcId!, count + 1);
    return true;
  });
  return [...kept, ...close].map((memory) => memory.id);
}

/** 追加區：話題型記憶命中本次輸入者，最新優先。進場包已帶的不重複。 */
export function recallMemories(
  memories: readonly LayeredMemory[],
  input: string,
  today: string,
  exclude: readonly string[] = [],
): LayeredMemory[] {
  return memories
    .filter((memory) => isLive(memory, today) && isTopic(memory) && !exclude.includes(memory.id) && keywordHit(memory.keywords, input))
    .sort(newestFirst)
    .slice(0, MEMORY_PARAMS.memoryKeywordLimit);
}

/** 某個地點的近況（區域層＋場景層、啟用中、未過期），給頂欄「區域記憶」與星圖「場景記憶」顯示。 */
export function memoriesAt(memories: readonly LayeredMemory[], locations: readonly string[], today: string): LayeredMemory[] {
  return memories
    .filter((memory) => (memory.layer === 'region' || memory.layer === 'scene')
      && locations.includes(memory.location ?? '') && isLive(memory, today))
    .sort((a, b) => WEIGHT_RANK[a.weight] - WEIGHT_RANK[b.weight] || newestFirst(a, b));
}

/** 標記這些記憶剛被帶進局勢（淘汰時「最久未觸發」的依據）。沒變就回傳原陣列，不觸發重繪。 */
export function touchMemories(memories: LayeredMemory[], ids: readonly string[], now: string): LayeredMemory[] {
  if (!ids.length) return memories;
  const wanted = new Set(ids);
  let changed = false;
  const next = memories.map((memory) => {
    if (!wanted.has(memory.id) || memory.usedAt === now) return memory;
    changed = true;
    return { ...memory, usedAt: now };
  });
  return changed ? next : memories;
}

/**
 * 儲存上限淘汰（骨架第十三節）：寫入時順帶檢查。
 * critical 與玩家手寫豁免；其餘 flavor 先走，同級的最久未觸發（沒觸發過就看寫入時間）先走。
 */
export function evictOverflow(memories: LayeredMemory[], limit = MEMORY_PARAMS.memoryStoreLimit): LayeredMemory[] {
  const excess = memories.length - limit;
  if (excess <= 0) return memories;
  const victims = memories
    .filter((memory) => memory.weight !== 'critical' && memory.author !== 'player')
    .sort((a, b) => WEIGHT_RANK[b.weight] - WEIGHT_RANK[a.weight]
      || (a.usedAt ?? a.createdAt).localeCompare(b.usedAt ?? b.createdAt))
    .slice(0, excess)
    .map((memory) => memory.id);
  const drop = new Set(victims);
  return memories.filter((memory) => !drop.has(memory.id));
}

/** 寫入一筆 ① 記憶時需要的現場資訊：地點標籤由前端依玩家所在處補，不讓模型自己編 id。 */
export interface MemoryWriteScope {
  region: string;
  scene: string;
  /** 遊戲時間「YYYY-MM-DD HH:MM」。 */
  now: string;
  /** 期限天數換算成日期用。 */
  addDays: (days: number) => string;
  id: string;
}

/**
 * 寫入一筆 ① 記憶（主 GM 的 add_memory 或玩家手寫）。
 * 同層、同地點／對象、內容相同（正規化後）的不重複寫；寫完順帶做儲存上限淘汰。
 */
export function addMemory(
  memories: LayeredMemory[],
  input: { layer: MemoryLayer; text: string; weight: MemoryWeight; keywords?: string[]; expireDays?: number; npcId?: string; location?: string },
  scope: MemoryWriteScope,
  author: LayeredMemory['author'] = 'gm',
): LayeredMemory[] {
  const content = input.text.trim();
  if (!content) return memories;
  const location = input.layer === 'region' ? (input.location ?? scope.region)
    : input.layer === 'scene' ? (input.location ?? scope.scene)
    : undefined;
  const npcId = input.layer === 'npc' ? input.npcId : undefined;
  if (input.layer === 'npc' && !npcId) return memories;

  const key = normalizeForMatch(content);
  const duplicate = memories.some((memory) => memory.layer === input.layer
    && memory.location === location && memory.npcId === npcId && normalizeForMatch(memory.content) === key);
  if (duplicate) return memories;

  const keywords = mergeKeywords([], input.keywords ?? []);
  const entry: LayeredMemory = {
    id: scope.id,
    layer: input.layer,
    content,
    weight: input.weight,
    enabled: true,
    author,
    createdAt: scope.now,
    ...(keywords.length ? { keywords } : {}),
    ...(location ? { location } : {}),
    ...(npcId ? { npcId } : {}),
    ...(input.expireDays ? { expire: scope.addDays(input.expireDays) } : {}),
  };
  return evictOverflow([...memories, entry]);
}

/** 進場包裡的記憶依層次拆開，交給 prompt 排位。 */
export function packBlocks(
  memories: readonly LayeredMemory[],
  packIds: readonly string[],
  scope: Pick<PackScope, 'presentNpcIds' | 'today'>,
  placeName: (id: string) => string,
  npcName: (id: string) => string,
): Pick<MemoryBlocks, 'world' | 'npcMemories' | 'absentNpcMemories' | 'place'> {
  const wanted = new Set(packIds);
  const picked = memories.filter((memory) => wanted.has(memory.id) && isLive(memory, scope.today)).sort(newestFirst);
  const line = (memory: LayeredMemory) => `${memory.weight === 'critical' ? '【重要】' : ''}${memory.content}`;
  const npcMemories: Record<string, string[]> = {};
  const absentNpcMemories: Record<string, string[]> = {};
  for (const memory of picked.filter((m) => m.layer === 'npc')) {
    if (scope.presentNpcIds.includes(memory.npcId!)) (npcMemories[memory.npcId!] ??= []).push(line(memory));
    else (absentNpcMemories[npcName(memory.npcId!)] ??= []).push(line(memory));
  }
  return {
    world: picked.filter((m) => m.layer === 'world').map(line),
    npcMemories,
    absentNpcMemories,
    place: picked.filter((m) => m.layer === 'region' || m.layer === 'scene')
      .map((memory) => `（${placeName(memory.location ?? '')}）${line(memory)}`),
  };
}

/** 追加區命中的記憶攤成一行。npc 層標出是誰的事，讓主 GM 拿捏誰知情。 */
export function describeRecalled(memory: LayeredMemory, npcName: (id: string) => string, placeName: (id: string) => string): string {
  const scope = memory.layer === 'npc' ? `關於${npcName(memory.npcId ?? '')}`
    : memory.layer === 'world' ? '全站'
    : placeName(memory.location ?? '');
  return `（${scope}）${memory.weight === 'critical' ? '【重要】' : ''}${memory.content}`;
}

// ---------------------------------------------------------------- 注入集合

/**
 * 組進 GM prompt 的記憶，依骨架第三節「分層組裝」的層次分欄；prompt.ts 照層次排位。
 * 進場就定下的放前面，每回合會變的（關鍵字追加）放最後、緊貼玩家輸入。
 */
export interface MemoryBlocks {
  /** 第二層：世界層記憶。 */
  world: string[];
  /** 第三層：在場 NPC 的 npc 層記憶，以 NPC id 對應。 */
  npcMemories: Record<string, string[]>;
  /** 第三層：在場 NPC 進場前的內心想法（② thought 窗口），以 NPC id 對應。 */
  npcThoughts: Record<string, string[]>;
  /** 第三層：不在場、好感達門檻的 NPC 的 critical 記憶，以 NPC 名字對應（不在場者的人設不在局勢裡，只能給名字）。 */
  absentNpcMemories: Record<string, string[]>;
  /** 第四層：④ 設定集的所在地點與相鄰地點說明（地點類強制注入）。 */
  placeLore: string[];
  /** 第四層：當前與相鄰地點的區域層、場景層記憶（已標好地點）。 */
  place: string[];
  /** 第五層：進場語意篩選挑出的玩家日記。 */
  diaries: RecalledDiary[];
  /** 第五層：進場語意篩選挑出的在場 NPC 日誌。 */
  npcLogs: RecalledNpcLog[];
  /** 第五層尾端：本次輸入命中關鍵字的分層記憶（已標好範圍）。 */
  recalledMemories: string[];
  /** 第五層尾端：本次輸入命中關鍵字的玩家日記。 */
  recalledDiaries: RecalledDiary[];
  /** 第五層尾端：本次輸入命中關鍵字的在場 NPC 日誌。 */
  recalledNpcLogs: RecalledNpcLog[];
  /** 第五層尾端：本次輸入提到的 ④ 設定集條目（設定、不在場的人、物品、事件、其他地點）。 */
  recalledLore: string[];
}

export const EMPTY_MEMORY: MemoryBlocks = {
  world: [], npcMemories: {}, npcThoughts: {}, absentNpcMemories: {}, placeLore: [], place: [],
  diaries: [], npcLogs: [], recalledMemories: [], recalledDiaries: [], recalledNpcLogs: [], recalledLore: [],
};

// ---------------------------------------------------------------- 進場語意篩選

/** 語意篩選的候選。只有標題、摘要、關鍵字，不送內文（第五節：檢索標的為標題）。 */
export interface SceneCandidate {
  id: string;
  date: string;
  title: string;
  summary: string;
  keywords: string[];
  /** NPC 日誌才有：這篇是誰的。 */
  npcId?: string;
}

/** 語意篩選的結果：挑出的玩家日記與 NPC 日誌 id。 */
export interface SceneSelection {
  diaryIds: string[];
  npcLogIds: string[];
}

/** NPC 日誌照「每人上限、總額」截斷（第五節「NPC 日記的注入量」）。 */
function capNpcLogs(ids: readonly string[], npcLogs: readonly SceneCandidate[]): string[] {
  const owner = new Map(npcLogs.map((log) => [log.id, log.npcId ?? '']));
  const perNpc = new Map<string, number>();
  const out: string[] = [];
  for (const id of ids) {
    const npcId = owner.get(id);
    if (npcId === undefined) continue;
    const count = perNpc.get(npcId) ?? 0;
    if (count >= MEMORY_PARAMS.npcLogPerNpc) continue;
    perNpc.set(npcId, count + 1);
    out.push(id);
    if (out.length >= MEMORY_PARAMS.npcLogTotal) break;
  }
  return out;
}

/**
 * 收斂語意篩選的輸出：只認候選裡有的 id、去重、照上限截斷。
 * 模型偶爾會編 id 或挑過頭，這裡擋掉。
 */
export function normalizeSceneSelection(
  raw: unknown,
  diaries: readonly SceneCandidate[],
  npcLogs: readonly SceneCandidate[] = [],
): SceneSelection {
  const pick = (value: unknown, pool: readonly SceneCandidate[]) => {
    const known = new Set(pool.map((entry) => entry.id));
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))]
      : [];
  };
  const output = raw as { diaryIds?: unknown; npcLogIds?: unknown } | null;
  return {
    diaryIds: pick(output?.diaryIds, diaries).slice(0, MEMORY_PARAMS.diarySceneLimit),
    npcLogIds: capNpcLogs(pick(output?.npcLogIds, npcLogs), npcLogs),
  };
}

/**
 * 候選都沒超過上限時不必請助理 GM 挑，全部帶上就好（回傳結果）；有一邊超過才需要語意篩選（回傳 null）。
 * 篩選本來就是為了不讓單場撈出過多，量少時省下一次呼叫。
 */
export function selectWithoutLlm(diaries: readonly SceneCandidate[], npcLogs: readonly SceneCandidate[] = []): SceneSelection | null {
  const allLogs = npcLogs.map((log) => log.id);
  const logsFit = capNpcLogs(allLogs, npcLogs).length === allLogs.length;
  if (diaries.length <= MEMORY_PARAMS.diarySceneLimit && logsFit) {
    return { diaryIds: diaries.map((entry) => entry.id), npcLogIds: allLogs };
  }
  return null;
}

// ---------------------------------------------------------------- 場景快取

/** 進場時算好、凍結到離場的結果。 */
export interface SceneRecall {
  /** 場景 id（房號或區域 id）。 */
  scene: string;
  /** 在場 NPC 的 id，排序後以逗號串起，用來比對名單是否相同。 */
  present: string;
  /** 進場當下的累積步數。 */
  steps: number;
  /** 語意軌挑出的玩家日記 id。 */
  diaryIds: string[];
  /** 語意軌挑出的 NPC 日誌 id。 */
  npcLogIds: string[];
  /** ① 進場包：選中的分層記憶 id。 */
  packIds: string[];
  /** ② 進場時在場 NPC 窗口裡已有的 thought id（來自先前場景，作為背景注入；本場景新生的已在對話紀錄裡）。 */
  thoughtIds: string[];
}

export const presentKey = (npcIds: readonly string[]) => [...npcIds].sort().join(',');

/**
 * 回到同一場景時能不能直接重用上次的進場結果（第三節「場景快取」）：
 * 在場名單完全相同，且步數差在 sceneCacheSteps 以內。
 */
export function canReuseScene(cached: SceneRecall | undefined, scene: string, present: string, steps: number): boolean {
  return !!cached
    && cached.scene === scene
    && cached.present === present
    && Math.abs(steps - cached.steps) <= MEMORY_PARAMS.sceneCacheSteps;
}
