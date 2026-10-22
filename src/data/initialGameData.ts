import {
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  ItemEntry,
  NpcEntry,
  DiaryEntry,
  ChapterEntry,
  LoreEntry,
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
 * 路西恩、布雷茲、艾登、伊森、路卡皆有角色卡、立繪、六種表情與行走圖。
 * 艾登、伊森、路卡的人物設定待補，暫不指定房號、日程或部門。
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
    portraitUrl: '/assets/blaze/neutral.webp', fullBodyUrl: '/assets/blaze/profile.webp',
    cardUrl: '/assets/blaze/portrait.webp', walkUrl: '/assets/blaze/walk.webp',
    expressionUrls: {
      neutral: '/assets/blaze/neutral.webp',
      happy: '/assets/blaze/happy.webp',
      sad: '/assets/blaze/sad.webp',
      angry: '/assets/blaze/angry.webp',
      surprised: '/assets/blaze/surprised.webp',
      shy: '/assets/blaze/shy.webp',
    },
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
  {
    id: 'aiden', source: 'builtin', name: '艾登', age: '', gender: '男', position: '',
    appearance: '黑色短髮、褐色眼睛，額上戴護目鏡，穿著黑灰色外套與橘色背帶，佩戴金屬吊牌。',
    personality: '', background: '', other: '人物設定待補。',
    portraitUrl: '/assets/aiden/neutral.webp', fullBodyUrl: '/assets/aiden/profile.webp',
    cardUrl: '/assets/aiden/portrait.webp', walkUrl: '/assets/aiden/walk.webp',
    expressionUrls: {
      neutral: '/assets/aiden/neutral.webp',
      happy: '/assets/aiden/happy.webp',
      sad: '/assets/aiden/sad.webp',
      angry: '/assets/aiden/angry.webp',
      surprised: '/assets/aiden/surprised.webp',
      shy: '/assets/aiden/shy.webp',
    },
  },
  {
    id: 'ethan', source: 'builtin', name: '伊森', age: '', gender: '男', position: '',
    appearance: '深紫色長髮束成低馬尾，戴細框眼鏡與耳環，穿著白襯衫、黑色背心與深紫色領帶。',
    personality: '', background: '', other: '人物設定待補。',
    portraitUrl: '/assets/ethan/neutral.webp', fullBodyUrl: '/assets/ethan/profile.webp',
    cardUrl: '/assets/ethan/portrait.webp', walkUrl: '/assets/ethan/walk.webp',
    expressionUrls: {
      neutral: '/assets/ethan/neutral.webp',
      happy: '/assets/ethan/happy.webp',
      sad: '/assets/ethan/sad.webp',
      angry: '/assets/ethan/angry.webp',
      surprised: '/assets/ethan/surprised.webp',
      shy: '/assets/ethan/shy.webp',
    },
  },
  {
    id: 'luca', source: 'builtin', name: '路卡', age: '', gender: '男', position: '',
    appearance: '銀白色短髮、淺色眼睛，戴多枚耳飾，穿著白色外套與黑色高領內搭，頸前掛護目鏡。',
    personality: '', background: '', other: '人物設定待補。',
    portraitUrl: '/assets/luca/neutral.webp', fullBodyUrl: '/assets/luca/profile.webp',
    cardUrl: '/assets/luca/portrait.webp', walkUrl: '/assets/luca/walk.webp',
    expressionUrls: {
      neutral: '/assets/luca/neutral.webp',
      happy: '/assets/luca/happy.webp',
      sad: '/assets/luca/sad.webp',
      angry: '/assets/luca/angry.webp',
      surprised: '/assets/luca/surprised.webp',
      shy: '/assets/luca/shy.webp',
    },
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
  segments: [{ kind: 'description' as const, text: '居住區 A 的走廊亮著柔和燈光，欄牆外是寂靜的星海。點擊地板或使用 WASD 移動；點選房門或座椅會自動走近互動。路西恩在 A-1 房間等候。' }],
}];

/** 內建的故事書事件，目前在故事書內建立。 */
export const INITIAL_CHAPTERS: ChapterEntry[] = [];

/**
 * 內建的設定條目（docs/world.md 第八節「設定集條目（關鍵字觸發）」）。
 * 玩家這一句提到關鍵字時才帶給 GM，平常不佔 prompt。
 */
export const INITIAL_LORE: LoreEntry[] = [
  {
    id: 'lore-moon',
    source: 'builtin',
    title: '月球城市',
    content: '多數常駐人員在月球出生長大，把月球城市當理所當然的故鄉。月球城市已發展成熟，是火星殖民地物資的主要供應地。站外地點只在回憶、訊息、傳聞中提及，玩家目前不能前往。',
    keywords: ['月球', '故鄉'],
  },
  {
    id: 'lore-mars',
    source: 'builtin',
    title: '火星殖民地',
    content: '航線的終點，仍在擴建的開拓地。所需物資多由月球供應，途經星際港的貨物大多是送往火星的過境貨。',
    keywords: ['火星', '殖民地'],
  },
  {
    id: 'lore-earth',
    source: 'builtin',
    title: '地球',
    content: '站上只有艦長與副艦長出身地球，受訓後派駐。其他人多半沒去過地球，對它的印象來自教材與長輩的故事。',
    keywords: ['地球'],
  },
  {
    id: 'lore-generations',
    source: 'builtin',
    title: '出身差異',
    content: '年輕一輩（平均約 25 歲、生於 2065 年前後）把月球當故鄉；艦長、副艦長出身地球，把月球當開拓地。兩代人對「家」與「開拓」的看法因此有些落差，偶爾在閒聊裡冒出來。',
    keywords: ['世代', '代溝', '老一輩', '年輕人'],
  },
  {
    id: 'lore-experiment',
    source: 'builtin',
    title: '生活實驗',
    content: '星際港同時是一場生活實驗：少數人、自給自足、身兼數職，在遠離城市的地方共同生活。研究主任負責記錄大家的生活狀況，作為之後設站的參考。',
    keywords: ['實驗', '記錄', '研究主任', '自給自足'],
  },
  {
    id: 'lore-supply-ship',
    source: 'builtin',
    title: '補給船',
    content: '補給船每 7 日到港一次，停靠、補給、換班後繼續航程。貨物多是月球送往火星的過境貨；站上只截留無法自產的東西，如精密零件、藥品、私人包裹。船期延誤是常見的小麻煩，不是生存危機。',
    keywords: ['補給船', '船期', '貨船', '包裹', '到港', '過境貨'],
  },
];

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
    description: '研究與檢驗室，負責站上水、空氣與作物樣本的分析；研究主任也在這裡整理生活實驗的紀錄。',
    connectedTo: ['bridge', 'park'],
  },
  {
    id: 'bridge',
    code: 'SEC-02',
    name: '艦橋',
    source: 'builtin',
    description: '星際港的指揮中樞，在中央塔上方。值勤人員在這裡管理貨船進出港、對外通訊與全站運作。',
    backgroundUrl: '/assets/bridge-v3/bridge-background-clean.webp',
    connectedTo: ['lab', 'park', 'engineering', 'greenhouse'],
  },
  {
    id: 'park',
    code: 'SEC-03',
    name: '中央公園',
    source: 'builtin',
    description: '站體中央的公共廣場，有餐廳與步道，是大家吃飯、休息、碰面的地方。',
    connectedTo: ['bridge', 'medical', 'engineering', 'greenhouse'],
  },
  {
    id: 'greenhouse',
    code: 'SEC-04',
    name: '溫室',
    source: 'builtin',
    description: '外環的農業區，自動種植架供應站上主要的蔬果，也是空氣循環的一環；北側有觀景窗與休憩區。',
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
  lore: INITIAL_LORE,
  sectors: INITIAL_SECTORS,
};

/** 空的本局條目。新遊戲與重置進度的起點。 */
export const EMPTY_RUN_STORY: StoryLayer = { npcs: [], items: [], chapters: [], sectors: [], lore: [] };

/** 空的覆寫。新遊戲與重置進度的起點。 */
export const EMPTY_OVERRIDES: StoryOverrides = { npcs: {}, items: {}, chapters: {}, sectors: {}, lore: {} };

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
export const GAME_START_DATE = '2090-10-24';
export const GAME_START_TIME = '08:45';
