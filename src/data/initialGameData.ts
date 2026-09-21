import {
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  ItemDefinition,
  NPCData,
  DiaryEntry,
  StoryChapter,
  MapSector,
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
 *    這些之後可由玩家在故事書內編輯，編輯結果存在存檔裡（見 persistence.ts）。
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
};

/** 任務全部由 GM 發放。 */
export const INITIAL_QUESTS: Quest[] = [];

/** 設定集的物品定義，由玩家在故事書的物品分頁建立。 */
export const INITIAL_ITEM_DEFINITIONS: ItemDefinition[] = [];

/** 玩家背包，靠遊玩取得。 */
export const INITIAL_INVENTORY: InventoryItem[] = [];

/**
 * 世界觀設定：NPC。
 * 路西恩有實際立繪素材；布雷茲目前只有文字設定。
 */
export const INITIAL_NPCS: NPCData[] = [
  {
    id: 'lucian', name: '路西恩', age: '', gender: '男', position: '',
    appearance: '淺藍色短髮、藍眼，穿著白色與深藍色外套，搭配橘色飾邊；佩戴藍色吊墜，背著 STARPORT 背包。',
    personality: '', background: '', other: '隨身攜帶手持終端。其餘人物設定待補。',
    location: '居住區 A (A-1)', affection: 0, relationship: '尚未建立',
    portraitUrl: '/assets/lucian/portrait.png', fullBodyUrl: '/assets/lucian/profile.png',
  },
  {
    id: 'blaze',
    name: '布雷茲',
    age: '32',
    gender: '男',
    position: '物資官',
    appearance: '身材高大，常穿著沾有油污的灰色工作服',
    personality: '豪爽大方、不拘小節',
    background:
      '曾在前線服役，退役後負責中央生活區與倉庫的物資調度，對艦艇各處秘聞瞭若指掌。',
    other: '喜好高度數酒精飲料',
    location: '2. 中央公園',
    affection: 0,
    relationship: '尚未建立',
  },
];

/** 開場敘述。這是遊戲的起始旁白與操作提示，不是測試資料。 */
export const INITIAL_DIALOGUE_HISTORY = [{
  playerInput: '進入居住區 A 的走廊',
  segments: [{ kind: 'description' as const, text: '居住區 A 的走廊亮著柔和燈光，欄牆外是寂靜的星海。點擊地板或使用方向鍵、WASD 移動；點選房門或座椅會自動走近互動。路西恩在 A-1 房間等候。' }],
}];

/** 故事書章節，由玩家在故事書內建立。 */
export const INITIAL_CHAPTERS: StoryChapter[] = [];

/** 日記由玩家撰寫或 GM 生成。 */
export const INITIAL_DIARY_ENTRIES: DiaryEntry[] = [];

/**
 * 世界觀設定：星圖區域。
 * 中上方: 研究室 / 右方: 溫室 / 下方: 醫療區 / 左方: 工程部 / 正中間: 艦橋、中央公園
 */
export const INITIAL_SECTORS: MapSector[] = [
  {
    id: 'lab',
    code: 'SEC-01',
    name: '研究室',
    isCurrent: false,
    status: '正常',
    description: '物理、光譜與深空樣本分析實驗室，配備尖端量子顯微與分析儀器。',
    connectedTo: ['bridge', 'park'],
  },
  {
    id: 'bridge',
    code: 'SEC-02',
    name: '艦橋',
    isCurrent: false,
    status: '正常',
    description: '全艦中樞神經，指揮官與高級領航員執勤核心，掌控躍遷星門與航向。',
    connectedTo: ['lab', 'park', 'engineering', 'greenhouse'],
  },
  {
    id: 'park',
    code: 'SEC-03',
    name: '中央公園',
    isCurrent: false,
    status: '正常',
    description: '全艦核心生態休閒綠洲與生活聚落，人造陽光與步道環繞。',
    connectedTo: ['bridge', 'medical', 'engineering', 'greenhouse'],
  },
  {
    id: 'greenhouse',
    code: 'SEC-04',
    name: '溫室',
    isCurrent: false,
    status: '正常',
    description: '水耕生化植物區，提供艦艇新鮮氧氣循環與有機蔬果補給。',
    connectedTo: ['park', 'bridge'],
  },
  {
    id: 'medical',
    code: 'SEC-05',
    name: '醫療室',
    isCurrent: false,
    status: '正常',
    description: '先進生物奈米醫療中心與急診隔離艙，提供全體船員生理監測與醫療救護。',
    connectedTo: ['park'],
  },
  {
    id: 'engineering',
    code: 'SEC-06',
    name: '工程部',
    isCurrent: false,
    status: '正常',
    description: '反物質引擎、能源管道與重力維持系統的主要工程檢修中樞。',
    connectedTo: ['park', 'bridge'],
  },
  {
    id: 'residential_d',
    code: 'SEC-D',
    name: '居住區 D',
    isCurrent: false,
    status: '正常',
    description: '西北側船員生活區，配備獨立空氣循環與睡眠艙。',
    connectedTo: ['engineering', 'lab'],
  },
  {
    id: 'residential_a',
    code: 'SEC-A',
    name: '居住區 A',
    isCurrent: true,
    status: '正常',
    description: '東北側高級軍官與研究員宿舍，具備觀景窗。',
    connectedTo: ['lab', 'greenhouse'],
  },
  {
    id: 'residential_c',
    code: 'SEC-C',
    name: '居住區 C',
    isCurrent: false,
    status: '正常',
    description: '西南側基層技術人員生活區，鄰近工程部。',
    connectedTo: ['engineering', 'medical'],
  },
  {
    id: 'residential_b',
    code: 'SEC-B',
    name: '居住區 B',
    isCurrent: false,
    status: '正常',
    description: '東南側後勤與補給人員宿舍，生活機能完善。',
    connectedTo: ['greenhouse', 'medical'],
  },
];

/** HeaderHUD 的區域記憶。由 GM 依所在區域生成（Phase 3）。 */
export const INITIAL_AREA_MEMORIES: string[] = [];

/** LeftSidebar 的當前目標。由 GM 依任務進度生成（Phase 3）。 */
export const INITIAL_OBJECTIVES: {
  id: string;
  text: string;
  location?: string;
  done?: boolean;
}[] = [];

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
