import {
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  ItemEntry,
  NpcEntry,
  DiaryEntry,
  ChapterEntry,
  SectorEntry,
  RoomDef,
  StoryLayer,
  StoryOverrides,
  Objective,
} from '../types';

/**
 * 遊戲初始資料。
 *
 * 這裡分兩種東西，改動時請先分清楚：
 *
 * 1. 「新遊戲的起點」— 玩家進度相關的項目一律為空，靠遊玩累積。
 *    測試用的假資料（艾倫·沃克、q1-q3 任務、i1-i3 物品、d1-d2 日記、
 *    ch1-ch2 章節、三條區域記憶）已於 Phase 0 清除。
 *
 * 2. 「世界觀設定」— 星圖區域與 NPC 是遊戲的實際內容，不是假資料，保留。
 *    這些是故事書內建內容的種子：第一次啟動時寫進獨立的 localStorage 鍵，
 *    之後以那一份為準（見 data/story.ts）。改了這裡不會影響已經啟動過的瀏覽器，
 *    唯一例外是圖檔欄位 —— 載入時一律以這裡為準。
 */

export const START_SECTOR_ID = 'residential_a';

/**
 * 新遊戲的起始數值，同時也是重置進度時的回歸點。
 * 兩邊共用同一份定義，避免漂移。
 */
export const INITIAL_STATS: PlayerStats = {
  stamina: 85,
  maxStamina: 100,
  hunger: 20,
  maxHunger: 100,
  credits: 450,
  conditions: [],
};

/** 個人資料由玩家自行填寫，不預設內容。 */
export const EMPTY_PROFILE: PlayerProfile = {
  name: '',
  gender: '',
  age: '',
  appearance: '',
  personality: '',
  other: '',
  profession: '',
  roomId: '',
};

/** 任務全部由 GM 發放。 */
export const INITIAL_QUESTS: Quest[] = [];

/** 內建的物品定義，目前在故事書的物品分頁建立。 */
export const INITIAL_ITEM_DEFINITIONS: ItemEntry[] = [];

/** 玩家背包，靠遊玩取得。 */
export const INITIAL_INVENTORY: InventoryItem[] = [];

/** NPC 好感與關係的起始值。新開遊戲、覆寫被清空時都回到這裡。 */
export const INITIAL_AFFECTION = 0;
export const INITIAL_RELATIONSHIP = '陌生';

/**
 * 世界觀設定：NPC。
 * 路西恩有完整素材（含表情圖）；布雷茲有立繪、半身像與行走圖，還沒有表情圖。
 * 好感、關係、所在位置是本局進度，不寫在這裡。
 */
export const INITIAL_NPCS: NpcEntry[] = [
  {
    id: 'lucian', source: 'builtin', name: '路西恩', age: '', gender: '男', position: '物流組',
    appearance: '淺藍色短髮、藍眼，穿著白色與深藍色外套，搭配橘色飾邊；佩戴藍色吊墜，背著 STARPORT 背包。',
    personality: '', background: '', other: '隨身攜帶手持終端。其餘人物設定待補。',
    roomId: 'A-1',
    // 暫定日程。
    schedules: [{
      kind: 'base',
      slots: [
        { start: 0, end: 8, locationId: 'A-1', nature: 'sleep' },
        { start: 8, end: 0, locationId: 'park', nature: 'free' },
      ],
    }],
    // 預設頭像用 neutral 而非 portrait：portrait 是 1024² 的單張大圖，和表情圖
    // 不是同一套，切換時畫風會跳，而且它一張就抵五張表情的流量。
    portraitUrl: '/assets/lucian/neutral.webp', fullBodyUrl: '/assets/lucian/profile.webp',
    cardUrl: '/assets/lucian/portrait.webp',
    walkUrl: '/assets/lucian/walk.webp',
    expressionUrls: {
      neutral: '/assets/lucian/neutral.webp',
      happy: '/assets/lucian/happy.webp',
      sad: '/assets/lucian/sad.webp',
      angry: '/assets/lucian/angry.webp',
      surprised: '/assets/lucian/surprised.webp',
      shy: '/assets/lucian/shy.webp',
    },
  },
  {
    id: 'blaze',
    source: 'builtin',
    name: '布雷茲',
    age: '32',
    gender: '男',
    position: '物資官',
    appearance: '身材高大，常穿著沾有油污的灰色工作服',
    personality: '豪爽大方、不拘小節',
    background:
      '曾在前線服役，退役後負責中央生活區與倉庫的物資調度，對艦艇各處秘聞瞭若指掌。',
    other: '喜好高度數酒精飲料',
    roomId: 'A-2',
    // 只有一張半身像：頭像與角色卡共用，沒有表情圖時對話框會一律用它。
    portraitUrl: '/assets/blaze/portrait.webp', fullBodyUrl: '/assets/blaze/profile.webp',
    cardUrl: '/assets/blaze/portrait.webp', walkUrl: '/assets/blaze/walk.webp',
    // 暫定日程。
    schedules: [{
      kind: 'base',
      slots: [
        { start: 0, end: 8, locationId: 'A-2', nature: 'sleep' },
        { start: 8, end: 17, locationId: 'bridge', nature: 'duty' },
        { start: 17, end: 0, locationId: 'park', nature: 'free' },
      ],
    }],
  },
];

/**
 * NPC 身上屬於「素材」的欄位。載入內建內容時一律以程式碼版本為準：
 * 存下來的路徑若被凍結，換了素材之後已經在玩的人永遠看不到新圖 ——
 * 而且這種壞法沒有任何徵兆，舊路徑還在、圖也載得出來，只是永遠是舊的那張。
 */
export const NPC_ART_FIELDS = ['portraitUrl', 'fullBodyUrl', 'cardUrl', 'walkUrl', 'expressionUrls'] as const;
export const SECTOR_ART_FIELDS = ['backgroundUrl'] as const;

/** 開場敘述。這是遊戲的起始旁白與操作提示，不是測試資料。 */
export const INITIAL_DIALOGUE_HISTORY = [{
  playerInput: '進入居住區 A 的走廊',
  segments: [{ kind: 'description' as const, text: '居住區 A 的走廊亮著柔和燈光，欄牆外是寂靜的星海。點擊地板或使用方向鍵、WASD 移動；點選房門或座椅會自動走近互動。路西恩在 A-1 房間等候。' }],
}];

/** 內建的故事書事件，目前在故事書內建立。 */
export const INITIAL_CHAPTERS: ChapterEntry[] = [];

/** 日記由玩家撰寫或 GM 生成。 */
export const INITIAL_DIARY_ENTRIES: DiaryEntry[] = [];

/**
 * 世界觀設定：星圖區域。
 * 中上方: 研究室 / 右方: 溫室 / 下方: 醫療區 / 左方: 工程部 / 正中間: 艦橋、中央公園
 */
export const INITIAL_SECTORS: SectorEntry[] = [
  {
    id: 'lab',
    code: 'SEC-01',
    name: '研究室',
    source: 'builtin',
    description: '物理、光譜與深空樣本分析實驗室，配備尖端量子顯微與分析儀器。',
    connectedTo: ['bridge', 'park'],
  },
  {
    id: 'bridge',
    code: 'SEC-02',
    name: '艦橋',
    source: 'builtin',
    description: '全艦中樞神經，指揮官與高級領航員執勤核心，掌控躍遷星門與航向。',
    backgroundUrl: '/assets/bridge/central-tower-bridge.png',
    connectedTo: ['lab', 'park', 'engineering', 'greenhouse'],
  },
  {
    id: 'park',
    code: 'SEC-03',
    name: '中央公園',
    source: 'builtin',
    description: '全艦核心生態休閒綠洲與生活聚落，人造陽光與步道環繞。',
    connectedTo: ['bridge', 'medical', 'engineering', 'greenhouse'],
  },
  {
    id: 'greenhouse',
    code: 'SEC-04',
    name: '溫室',
    source: 'builtin',
    description: '水耕生化植物區，提供艦艇新鮮氧氣循環與有機蔬果補給。',
    connectedTo: ['park', 'bridge'],
  },
  {
    id: 'medical',
    code: 'SEC-05',
    name: '醫療室',
    source: 'builtin',
    description: '先進生物奈米醫療中心與急診隔離艙，提供全體船員生理監測與醫療救護。',
    connectedTo: ['park'],
  },
  {
    id: 'engineering',
    code: 'SEC-06',
    name: '工程部',
    source: 'builtin',
    description: '外環的維修與研發工坊，負責修理設備、製作零件，並管理這一段的電力與管線。工程員的材料與工具都放在這裡，艦上壞掉或需要改良的設備也會送回來。',
    connectedTo: ['park', 'bridge'],
  },
  {
    id: 'residential_d',
    code: 'SEC-D',
    name: '居住區 D',
    source: 'builtin',
    description: '西北側船員生活區，配備獨立空氣循環與睡眠艙。',
    connectedTo: ['engineering', 'lab'],
  },
  {
    id: 'residential_a',
    code: 'SEC-A',
    name: '居住區 A',
    source: 'builtin',
    description: '東北側高級軍官與研究員宿舍，具備觀景窗。',
    connectedTo: ['lab', 'greenhouse'],
  },
  {
    id: 'residential_c',
    code: 'SEC-C',
    name: '居住區 C',
    source: 'builtin',
    description: '西南側基層技術人員生活區，鄰近工程部。',
    connectedTo: ['engineering', 'medical'],
  },
  {
    id: 'residential_b',
    code: 'SEC-B',
    name: '居住區 B',
    source: 'builtin',
    description: '東南側後勤與補給人員宿舍，生活機能完善。',
    connectedTo: ['greenhouse', 'medical'],
  },
];

/** 四個居住區的 id。房號清單與部門清單都依這裡區分。 */
export const RESIDENTIAL_SECTOR_IDS = ['residential_a', 'residential_b', 'residential_c', 'residential_d'] as const;

/** 每個居住區的房間數。走廊的 6 扇門依序對應 1–6 號房。 */
export const ROOMS_PER_SECTOR = 6;

/**
 * 內建房號清單：四個居住區各六間，共二十四間。
 * 佔用者不另存，由 NPC 的 roomId 反查。
 */
export const ROOMS: RoomDef[] = RESIDENTIAL_SECTOR_IDS.flatMap((sectorId) => {
  const letter = sectorId.split('_')[1].toUpperCase();
  return Array.from({ length: ROOMS_PER_SECTOR }, (_, i) => ({ id: `${letter}-${i + 1}`, sectorId }));
});

/** 內建內容的種子。第一次啟動時寫入 localStorage，之後以那一份為準。 */
export const INITIAL_BUILTIN_STORY: StoryLayer = {
  npcs: INITIAL_NPCS,
  items: INITIAL_ITEM_DEFINITIONS,
  chapters: INITIAL_CHAPTERS,
  sectors: INITIAL_SECTORS,
};

/** 空的本局條目。新遊戲與重置進度的起點。 */
export const EMPTY_RUN_STORY: StoryLayer = { npcs: [], items: [], chapters: [], sectors: [] };

/** 空的覆寫。新遊戲與重置進度的起點。 */
export const EMPTY_OVERRIDES: StoryOverrides = { npcs: {}, items: {}, chapters: {}, sectors: {} };

/** HeaderHUD 的區域記憶。由 GM 依所在區域生成（Phase 3）。 */
export const INITIAL_AREA_MEMORIES: string[] = [];

/** LeftSidebar 的當前目標。由 GM 依任務進度生成（Phase 3）。 */
export const INITIAL_OBJECTIVES: Objective[] = [];

/** LeftSidebar 的當前摘要。由 GM 生成（Phase 3）。 */
export const INITIAL_SUMMARY = '';

/**
 * DialogueSection 的快速回覆。
 * 這三則是通用的中性回應，不綁定任何劇情，先保留為靜態預設值。
 * Phase 3 會改為依當下情境由 GM 生成。
 */
export const INITIAL_QUICK_REPLIES: string[] = [
  '收到，明白！',
  '能否提供更多資訊？',
  '我需要先考慮一下...',
];

/** 遊戲內時間起點。時鐘顯示這個，不與現實時鐘綁定。 */
export const GAME_START_DATE = '2154-10-24';
export const GAME_START_TIME = '08:45';
