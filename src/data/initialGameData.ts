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
 * 這裡只是「目前的讀取來源」，之後接資料庫時換掉的是這個檔案的內容，
 * App 不需要跟著改。本輪純粹把寫死在 useState 初始值裡的資料搬過來，
 * 結構一律維持原樣。
 */

export const START_SECTOR_ID = 'residential_a';

/** 重置進度時要回到的起點。與初始 state 共用同一份定義，避免兩邊漂移。 */
export const INITIAL_STATS: PlayerStats = {
  stamina: 85,
  maxStamina: 100,
  hunger: 20,
  maxHunger: 100,
  credits: 450,
  conditions: [],
};

/** 重置後個人資料清空，由玩家自行重填。 */
export const EMPTY_PROFILE: PlayerProfile = {
  name: '',
  gender: '',
  age: '',
  appearance: '',
  personality: '',
  other: '',
  profession: '',
};

export const INITIAL_PROFILE: PlayerProfile = {
  name: '艾倫·沃克',
  gender: '男',
  age: '24',
  appearance: '黑髮藍眼，身穿實習領航員制服',
  personality: '冷靜沉著、富好奇心',
  other: '出身於地球聯邦星空學院；喜好黑咖啡；持有 LV1 通行憑證。',
  profession: '實習領航員',
};

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'q1',
    category: '主要',
    title: '熟悉星際港環境',
    status: '進行中',
    description: '前往中央公園，與物資官布雷茲交流以獲取配給情報。',
    target: '2. 中央公園',
    reward: '150 星幣、熱咖啡 x1',
    acceptedDate: '2154-10-24',
    deadlineDays: 3,
  },
  {
    id: 'q2',
    category: '次要',
    title: '檢查工程電路',
    status: '待回報',
    description: '協助工程部檢查次級維生動力源的輔助電源線路。',
    target: '工程部',
    reward: '80 星幣',
    acceptedDate: '2154-10-24',
    deadlineDays: 5,
  },
  {
    id: 'q3',
    category: '次要',
    title: '領取巡航航圖',
    status: '已完成',
    description: '已於艦橋領航台取得獵戶座第四星區最新航道圖冊。',
    reward: '50 星幣、獵戶座星圖',
    acceptedDate: '2154-10-22',
    deadlineDays: 0,
  },
];

/**
 * 設定集的物品定義。故事書物品分頁編輯這一份，與下面的玩家背包分開。
 */
export const INITIAL_ITEM_DEFINITIONS: ItemDefinition[] = [
  {
    id: 'i1',
    name: '熱咖啡',
    category: '消耗品',
    effectText: '+15 體力、-5 飢餓',
    description: '剛從配給機煮出的濃縮黑咖啡，提神效果極佳。',
  },
  {
    id: 'i2',
    name: '通行憑證',
    category: '裝備',
    effectText: 'LV 1',
    description: '星際港基礎通行權限卡，可開啟中央生活區各艙門。',
  },
  {
    id: 'i3',
    name: '應急維修套件',
    category: '裝備',
    effectText: '耐久 +30',
    description: '內含標準通用螺絲、絕緣膠帶與簡易電路檢測筆。',
  },
];

/** 玩家背包：實際持有的物品與數量。 */
export const INITIAL_INVENTORY: InventoryItem[] = [
  { ...INITIAL_ITEM_DEFINITIONS[0], count: 2 },
  { ...INITIAL_ITEM_DEFINITIONS[1], count: 1 },
  { ...INITIAL_ITEM_DEFINITIONS[2], count: 1 },
];

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
    affection: 10,
    relationship: '初識的物資官',
  },
];

export const INITIAL_DIALOGUE_HISTORY = [{
  playerInput: '進入居住區 A 的走廊',
  segments: [{ kind: 'description' as const, text: '居住區 A 的走廊亮著柔和燈光，欄牆外是寂靜的星海。點擊地板或使用方向鍵、WASD 移動；點選房門或座椅會自動走近互動。路西恩在 A-1 房間等候。' }],
}];

export const INITIAL_CHAPTERS: StoryChapter[] = [
  {
    id: 'ch1',
    title: '啟航：獵戶座邊緣',
    summary: '星際港脫離母星軌道，航向未知星域的第一天紀錄。',
    fullText:
      '星曆 2154 年秋，巨大的星際港推進器點火，深藍色的離子光芒劃破永夜般的深空。\n\n全體駐艦人員在主生活區集合完畢，廣播中傳來指揮官平穩的聲音。這是一場為期十年的跨星系探勘旅程，每位領航員與技術官都懷抱著對未知星塵的敬畏與熱情。',
    unlocked: true,
  },
  {
    id: 'ch2',
    title: '迷霧星雲的微光',
    summary: '穿透第七電磁風暴區時所遭遇的神秘電波回傳。',
    fullText:
      '在巡航至第七星區邊界時，艦載雷達接收到了規律的脈衝信號。\n\n那並非天然脈衝星的雜訊，而是帶有邏輯編碼的十六進位指令流。布雷茲與工程團隊正在物資區加固電磁屏蔽層，以防儀器受到副波干擾。',
    unlocked: true,
  },
];

export const INITIAL_DIARY_ENTRIES: DiaryEntry[] = [
  {
    id: 'd1',
    date: '2154-10-24',
    title: '登艦日誌',
    summary: '初抵星際港，確認通行證',
    enabled: true,
    content:
      '登艦的第一天，這座星際港比想像中還要宏偉。順利在中央公園遇到了布雷茲物資官，手頭的通行憑證已完成認證。',
    author: '艾倫·沃克',
    tags: ['登艦', '星際港', '物資官'],
  },
  {
    id: 'd2',
    date: '2154-10-23',
    title: '準備啟航記事',
    summary: '行前準備，整理隨身物品',
    enabled: true,
    content:
      '整理了隨身攜帶的個人物品與通行憑證，準備前往中央公園確認今日配給清單。',
    author: '艾倫·沃克',
    tags: ['啟航', '通行憑證', '配給'],
  },
];

/**
 * 星圖區域。
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

/**
 * HeaderHUD 的區域記憶。原本寫在元件 props 預設值裡、App 根本沒傳。
 * 之後由 AI 或資料庫供給。
 */
export const INITIAL_AREA_MEMORIES: string[] = [
  '艦橋指揮台掌握最新躍遷星圖，準備啟動躍遷星門。',
  '中央公園人造陽光排程運作正常，提供船員休閒交流空間。',
  '研究室量子光譜分析儀校準中，請各部門暫勿進入干擾。',
];

/** LeftSidebar 的當前目標。原本整段寫死在 JSX 裡。 */
export const INITIAL_OBJECTIVES: {
  id: string;
  text: string;
  location?: string;
  done?: boolean;
}[] = [
  {
    id: 'o1',
    text: '與布雷茲交流，掌握物資分配現況',
    location: '2. 中央公園',
  },
  { id: 'o2', text: '前往中央公園', done: true },
];

/** LeftSidebar 的當前摘要。原本寫死在 JSX 裡。 */
export const INITIAL_SUMMARY =
  '初次抵達星際港，需透過物資官布雷茲取得初級通行許可，並熟悉星港的日常物資調度。';

/**
 * DialogueSection 的快速回覆。
 * 這三則正好對應 handleSendMessage 裡的三個 if 分支，接 AI 時一併換掉。
 */
export const INITIAL_QUICK_REPLIES: string[] = [
  '收到，明白！',
  '能否提供更多資訊？',
  '我需要先考慮一下...',
];

/** 遊戲內時間起點。時鐘顯示這個，不與現實時鐘綁定。 */
export const GAME_START_DATE = '2154-10-24';
export const GAME_START_TIME = '08:45';
