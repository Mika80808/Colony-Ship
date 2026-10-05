import {
  EntrySource,
  MergedStory,
  NPCData,
  NpcEntry,
  RoomDef,
  RUN_ID_PREFIX,
  SectorEntry,
  StoryKind,
  StoryLayer,
  StoryOverrides,
} from '../types';
import {
  INITIAL_AFFECTION,
  INITIAL_BUILTIN_STORY,
  INITIAL_NPCS,
  INITIAL_RELATIONSHIP,
  INITIAL_SECTORS,
  NPC_ART_FIELDS,
  RESIDENTIAL_SECTOR_IDS,
  SECTOR_ART_FIELDS,
  START_SECTOR_ID,
} from './initialGameData';

/**
 * 故事書的三層資料：內建內容 + 本局條目 + 覆寫。
 *
 * 內建內容存在獨立的 localStorage 鍵，不進存檔 —— 它是所有存檔共用的設定集，
 * 新開遊戲不清空。本局條目與覆寫則跟著存檔走（見 persistence.ts）。
 */

const BUILTIN_KEY = 'starport_builtin_story';

// ---------------------------------------------------------------- 合併

/** 每種條目在合併時要從覆寫補上的進度欄位與預設值。 */
function npcDefaults() {
  return { affection: INITIAL_AFFECTION, relationship: INITIAL_RELATIONSHIP, enabled: true };
}
function sectorDefaults(id: string) {
  // 沒有任何覆寫時，起始區域就是「目前所在」。移動時 App 會把每個區域都寫進覆寫。
  return { isCurrent: id === START_SECTOR_ID, status: '正常' as const, enabled: true };
}

/**
 * 合併一種條目：內建在前、本局在後，再疊上覆寫。
 * 本局條目的 id 必須帶 RUN_ID_PREFIX 且不與內建相撞，否則丟棄 ——
 * 撞 id 時覆寫會同時套到兩筆上，好感度之類的進度就分不清是誰的。
 */
function mergeKind<E extends { id: string }, P>(
  builtin: E[],
  run: E[],
  overrides: Record<string, Partial<P>>,
  defaults: (id: string) => P
): (E & P)[] {
  const builtinIds = new Set(builtin.map((entry) => entry.id));
  const validRun = run.filter((entry) => entry.id.startsWith(RUN_ID_PREFIX) && !builtinIds.has(entry.id));
  return [...builtin, ...validRun].map((entry) => ({
    ...entry,
    ...defaults(entry.id),
    // 值為 undefined 的覆寫不算數，否則會把預設值蓋成 undefined。
    ...Object.fromEntries(Object.entries(overrides[entry.id] ?? {}).filter(([, value]) => value !== undefined)),
  }));
}

export function mergeStory(builtin: StoryLayer, run: StoryLayer, overrides: StoryOverrides): MergedStory {
  return {
    npcs: mergeKind(builtin.npcs, run.npcs, overrides.npcs, npcDefaults),
    items: mergeKind(builtin.items, run.items, overrides.items, () => ({ enabled: true })),
    chapters: mergeKind(builtin.chapters, run.chapters, overrides.chapters, () => ({ enabled: true })),
    sectors: mergeKind(builtin.sectors, run.sectors, overrides.sectors, sectorDefaults),
  };
}

// ---------------------------------------------------------------- 拆回各層

/** 合併時補上的欄位。寫回內建內容或本局條目前要剝掉，否則進度會跟著內容一起存。 */
const PROGRESS_FIELDS: Record<StoryKind, readonly string[]> = {
  npcs: ['affection', 'relationship', 'location', 'enabled'],
  items: ['enabled'],
  chapters: ['enabled'],
  sectors: ['isCurrent', 'status', 'enabled'],
};

export function stripProgress<K extends StoryKind>(kind: K, entry: MergedStory[K][number]): StoryLayer[K][number] {
  const content: Record<string, unknown> = { ...entry };
  for (const field of PROGRESS_FIELDS[kind]) delete content[field];
  return content as unknown as StoryLayer[K][number];
}

/**
 * 把故事書 UI 交回的整份清單拆回內建與本局兩層。
 * 依每筆條目的 source 決定去處；進度欄位剝掉，不寫進內容。
 */
export function splitEntries<K extends StoryKind>(
  kind: K,
  next: MergedStory[K]
): { builtin: StoryLayer[K]; run: StoryLayer[K] } {
  const pick = (source: EntrySource) =>
    (next as MergedStory[K][number][])
      .filter((entry) => entry.source === source)
      .map((entry) => stripProgress(kind, entry)) as StoryLayer[K];
  return { builtin: pick('builtin'), run: pick('run') };
}

// ---------------------------------------------------------------- id

/** 本局條目的 id。帶前綴，保證不會和內建 id 相撞。 */
export function makeRunId(kind: StoryKind): string {
  return `${RUN_ID_PREFIX}${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** 故事書 UI 新增的內建條目 id。建立後固定，編輯不會改變。 */
export function makeBuiltinId(kind: StoryKind): string {
  return `${kind}-${Date.now()}`;
}

// ---------------------------------------------------------------- 內建內容的讀寫

/** 圖檔欄位以程式碼為準；程式碼裡沒有的條目（UI 新增的）保留自己的值。 */
function applyCodeArt<E extends { id: string }>(
  entries: E[],
  codeEntries: readonly E[],
  fields: readonly string[]
): E[] {
  return entries.map((entry) => {
    const code = codeEntries.find((c) => c.id === entry.id);
    if (!code) return entry;
    const art = Object.fromEntries(fields.map((field) => [field, (code as Record<string, unknown>)[field]]));
    return { ...entry, ...art };
  });
}

/** 讀進來的條目一律標為內建，並擋掉誤用本局前綴的 id。 */
function asBuiltin<E extends { id: string; source: EntrySource }>(list: unknown): E[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry): entry is E => !!entry && typeof entry === 'object' && typeof (entry as E).id === 'string')
    .filter((entry) => !entry.id.startsWith(RUN_ID_PREFIX))
    .map((entry) => ({ ...entry, source: 'builtin' as const }));
}

/**
 * 種子版本。initialGameData 的既有條目內容有更新、要同步給已經啟動過的瀏覽器時 +1，
 * 並在 SEED_MIGRATIONS 補一段遷移。遷移只能「補空欄位」，不可覆蓋開發者在 UI 改過的內容。
 */
const SEED_VERSION = 6;

/** 用程式碼裡的值補上存下來條目的空欄位。 */
function fillEmptyFromCode(stored: NpcEntry[], fields: (keyof NpcEntry)[]): NpcEntry[] {
  return stored.map((entry) => {
    const code = INITIAL_NPCS.find((c) => c.id === entry.id);
    if (!code) return entry;
    const patch: Record<string, unknown> = {};
    for (const field of fields) {
      const current = entry[field];
      const empty = current === undefined || current === '' || (Array.isArray(current) && current.length === 0);
      if (empty && code[field] !== undefined) patch[field] = code[field];
    }
    return { ...entry, ...patch };
  });
}

/** 把 NPC 的某個欄位從舊種子值換成新值；已經被改成別的值就不動。 */
function replaceSeedValue(stored: NpcEntry[], id: string, field: keyof NpcEntry, oldValue: unknown, newValue: unknown): NpcEntry[] {
  return stored.map((entry) =>
    entry.id === id && JSON.stringify(entry[field]) === JSON.stringify(oldValue) ? { ...entry, [field]: newValue } : entry
  );
}

/** SEED_MIGRATIONS[n] 把版本 n 的內建內容升到 n+1。 */
const SEED_MIGRATIONS: Record<number, (story: StoryLayer) => StoryLayer> = {
  // v1 → v2：路西恩、布雷茲的暫定保底日程，以及路西恩的職位。
  1: (story) => ({ ...story, npcs: fillEmptyFromCode(story.npcs, ['schedules', 'position']) }),
  // v2 → v3：布雷茲住進 A-2，睡眠時段從 A 區走廊改到 A-2。
  // 房號只在他沒房號、且 A-2 沒人住時補上；日程只在仍是 v2 的原樣時才換。
  2: (story) => {
    const code = INITIAL_NPCS.find((npc) => npc.id === 'blaze')!;
    const a2Taken = story.npcs.some((npc) => npc.roomId === 'A-2' && npc.id !== 'blaze');
    const npcs = a2Taken
      ? story.npcs
      : story.npcs.map((npc) => (npc.id === 'blaze' ? fillEmptyFromCode([npc], ['roomId'])[0] : npc));
    const v2Schedule = [{
      kind: 'base',
      slots: [
        { start: 0, end: 8, locationId: 'residential_a', nature: 'sleep' },
        { start: 8, end: 17, locationId: 'bridge', nature: 'duty' },
        { start: 17, end: 0, locationId: 'park', nature: 'free' },
      ],
    }];
    return { ...story, npcs: replaceSeedValue(npcs, 'blaze', 'schedules', v2Schedule, code.schedules) };
  },
  // v3 → v4：故事書儲存時不再代填，把以前代填進去的佔位字清掉。
  // 只清「欄位值剛好等於當時代填的那個字串」的情況，手寫的內容不會剛好一樣。
  3: (story) => ({
    npcs: clearPlaceholders(story.npcs, { age: '未知', position: '未知', appearance: '無', personality: '無', background: '無', routine: '無', other: '無' }),
    items: clearPlaceholders(story.items, { effectText: '+0', description: '尚無描述。' }),
    chapters: clearPlaceholders(story.chapters, { summary: '尚無摘要。', fullText: '尚無紀錄內容。' }),
    sectors: clearPlaceholders(story.sectors, { code: 'SEC-00', description: '尚無區域描述。' }),
  }),
  // v4 → v5：工程部改定位成外環的維修與研發工坊，拿掉引擎與重力的描述。只換仍是舊種子文字的情況。
  4: (story) => ({
    ...story,
    sectors: story.sectors.map((sector) =>
      sector.id === 'engineering' && sector.description === '反物質引擎、能源管道與重力維持系統的主要工程檢修中樞。'
        ? { ...sector, description: INITIAL_SECTORS.find((s) => s.id === 'engineering')!.description }
        : sector
    ),
  }),
  // v5 → v6：新增艾登、伊森、路卡。只補 id 還不存在的；房號已被別人住走就不給房號。
  5: (story) => {
    const ids = ['aiden', 'ethan', 'luca'];
    const known = new Set(story.npcs.map((npc) => npc.id));
    const added = INITIAL_NPCS.filter((npc) => ids.includes(npc.id) && !known.has(npc.id)).map((npc) =>
      story.npcs.some((other) => other.roomId === npc.roomId)
        ? { ...npc, roomId: undefined, schedules: npc.schedules?.map((g) => ({ ...g, slots: g.slots.map((slot) => (slot.locationId === npc.roomId ? { ...slot, locationId: 'residential_a' } : slot)) })) }
        : npc
    );
    return { ...story, npcs: [...story.npcs, ...added] };
  },
};

/** 欄位值等於佔位字時清成空白。 */
function clearPlaceholders<E>(entries: E[], placeholders: Record<string, string>): E[] {
  return entries.map((entry) => {
    const patch: Record<string, string> = {};
    for (const [field, placeholder] of Object.entries(placeholders)) {
      if ((entry as Record<string, unknown>)[field] === placeholder) patch[field] = '';
    }
    return Object.keys(patch).length ? { ...entry, ...patch } : entry;
  });
}

/**
 * 讀取內建內容。
 * 第一次啟動（沒有這個鍵）、格式損毀或 localStorage 不可用時，用 initialGameData 的種子。
 * 之後以存下來的這份為準 —— 程式碼裡的種子後來新增的條目不會自動補進來，
 * 要補請用設定面板的「從程式碼補上缺少的內建條目」（fillMissingBuiltin）。
 */
export function loadBuiltinStory(): StoryLayer {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(BUILTIN_KEY);
  } catch {
    raw = null;
  }
  let stored: StoryLayer = INITIAL_BUILTIN_STORY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoryLayer> & { seedVersion?: number };
      stored = {
        npcs: asBuiltin<NpcEntry>(parsed.npcs),
        items: asBuiltin(parsed.items),
        chapters: asBuiltin(parsed.chapters),
        sectors: asBuiltin<SectorEntry>(parsed.sectors),
      };
      // 沒有 seedVersion 的是 v1（加入版本號之前寫下的）。
      for (let version = parsed.seedVersion ?? 1; version < SEED_VERSION; version++) {
        stored = SEED_MIGRATIONS[version]?.(stored) ?? stored;
      }
    } catch {
      stored = INITIAL_BUILTIN_STORY;
    }
  }
  return {
    ...stored,
    npcs: applyCodeArt(stored.npcs, INITIAL_NPCS, NPC_ART_FIELDS),
    sectors: applyCodeArt(stored.sectors, INITIAL_SECTORS, SECTOR_ART_FIELDS),
  };
}

/** 寫入內建內容。回傳是否成功，讓呼叫端能提示容量不足。 */
export function writeBuiltinStory(story: StoryLayer): boolean {
  try {
    localStorage.setItem(BUILTIN_KEY, JSON.stringify({ seedVersion: SEED_VERSION, ...story }));
    return true;
  } catch {
    return false;
  }
}

/**
 * 從程式碼補上內建內容裡缺少的條目。
 * 只新增 id 不存在的條目，既有條目一律不動。在 UI 刪掉的程式碼條目也會因此被補回。
 */
export function fillMissingBuiltin(story: StoryLayer): { next: StoryLayer; added: number } {
  let added = 0;
  const fill = <E extends { id: string }>(current: E[], code: E[]): E[] => {
    const known = new Set(current.map((entry) => entry.id));
    const missing = code.filter((entry) => !known.has(entry.id));
    added += missing.length;
    return [...current, ...missing];
  };
  const next: StoryLayer = {
    npcs: fill(story.npcs, INITIAL_BUILTIN_STORY.npcs),
    items: fill(story.items, INITIAL_BUILTIN_STORY.items),
    chapters: fill(story.chapters, INITIAL_BUILTIN_STORY.chapters),
    sectors: fill(story.sectors, INITIAL_BUILTIN_STORY.sectors),
  };
  return { next, added };
}

/** 內建內容的 JSON 匯出，供之後寫回 initialGameData。 */
export function builtinStoryToJson(story: StoryLayer): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...story }, null, 2);
}

// ---------------------------------------------------------------- 部門與房號

/** 部門清單：內建的機能區地點（居住區以外）。 */
export function departmentOptions(builtinSectors: SectorEntry[]): SectorEntry[] {
  const residential = new Set<string>(RESIDENTIAL_SECTOR_IDS);
  return builtinSectors.filter((sector) => !residential.has(sector.id));
}

/** 日程可選的地點：內建地點（選居住區表示在走廊）與內建房號。 */
export function scheduleLocationIds(builtinSectors: SectorEntry[], rooms: RoomDef[]): Set<string> {
  return new Set([...builtinSectors.map((sector) => sector.id), ...rooms.map((room) => room.id)]);
}

/** 日程地點的顯示名稱。房號顯示成「A-1 房」。 */
export function scheduleLocationName(id: string, builtinSectors: SectorEntry[], rooms: RoomDef[]): string {
  if (rooms.some((room) => room.id === id)) return `${id} 房`;
  const sector = builtinSectors.find((entry) => entry.id === id);
  if (!sector) return `（不存在的地點：${id}）`;
  return rooms.some((room) => room.sectorId === id) ? `${sector.name}走廊` : sector.name;
}

/** 房號反查住戶。 */
export function findRoomOccupant(npcs: NPCData[], roomId: string): NPCData | undefined {
  return npcs.find((npc) => npc.roomId === roomId);
}
