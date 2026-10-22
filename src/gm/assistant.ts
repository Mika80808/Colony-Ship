import { DialogueTurn, DiaryEntry, NPCData, NpcThought, PlayerProfile } from '../types';
import { MEMORY_PARAMS, SceneCandidate, SceneSelection, mergeKeywords, normalizeSceneSelection, selectWithoutLlm } from '../game/memory';
import { requestJson } from './client';

/**
 * 助理 AI 的工作：快速回覆建議、日記草稿與整理、進場語意篩選、NPC 日誌提煉。
 *
 * 助理不是 GM：它不推進劇情、不改遊戲狀態，只替玩家「代筆」。
 * 所以對話紀錄以整段逐字稿交給它閱讀，而不是當成它自己說過的話。
 */

/** 把對話歷史整理成逐字稿。 */
export function buildTranscript(history: DialogueTurn[], playerName: string): string {
  const me = playerName || '玩家';
  return history
    .map((turn) => [
      `[${me}] ${turn.playerInput}`,
      ...turn.segments.map((s) => (s.speaker ? `[${s.speaker}] ${s.text}` : `[敘述] ${s.text}`)),
    ].join('\n'))
    .join('\n\n');
}

function describePlayer(profile: PlayerProfile): string {
  if (!profile.name) return '玩家尚未填寫個人資料。';
  return [
    `姓名：${profile.name}`,
    profile.gender && `性別：${profile.gender}`,
    profile.age && `年齡：${profile.age}`,
    profile.profession && `職務：${profile.profession}`,
    profile.personality && `性格：${profile.personality}`,
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- 快速回覆

export interface QuickReplyContext {
  profile: PlayerProfile;
  presentNpcs: NPCData[];
  locationName: string;
  dialogueHistory: DialogueTurn[];
}

const QUICK_REPLY_SYSTEM = `你是科幻角色扮演遊戲《星際港》的玩家助理。
依據目前的對話，替玩家想出 3 個接下來可以說的話或採取的行動，讓玩家一鍵送出。

要求：
- 以玩家角色的第一人稱口吻，使用繁體中文，每則 20 字以內。
- 3 則要有明顯差異，例如：順著話題追問、表達自己的想法或感受、採取一個行動。
- 必須貼合最後一段對話的情境，不要泛泛而談。
- 行動類請以「我」開頭描述，例如「我看向艙窗外的星圖」。

只輸出 json，格式如下，不要有其他文字：
{"replies":["他剛才說的導航組是做什麼的？","老實說，我有點緊張。","我看向艙窗外的星圖"]}`;

const QUICK_REPLY_SCHEMA = {
  type: 'object',
  properties: { replies: { type: 'array', items: { type: 'string' } } },
  required: ['replies'],
};

/** 收斂模型輸出：只留非空字串、去重、最多 3 則、過長截斷。 */
export function normalizeQuickReplies(raw: unknown): string[] {
  const list = (raw as { replies?: unknown })?.replies;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const text = item.trim().slice(0, 40);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length === 3) break;
  }
  return out;
}

export async function suggestQuickReplies(context: QuickReplyContext): Promise<string[]> {
  // 只看最近幾回：建議只需要貼合當下，多送只是多花玩家的錢。
  const transcript = buildTranscript(context.dialogueHistory.slice(-4), context.profile.name);
  const npcs = context.presentNpcs.map((npc) => npc.name).join('、') || '（無）';
  const raw = await requestJson('assistant', {
    system: QUICK_REPLY_SYSTEM,
    messages: [{
      role: 'user',
      content: `# 玩家\n${describePlayer(context.profile)}\n\n# 所在位置\n${context.locationName}\n在場角色：${npcs}\n\n# 最近的對話\n${transcript || '（尚無對話）'}`,
    }],
    schema: QUICK_REPLY_SCHEMA,
    schemaName: 'quick_replies',
  });
  const replies = normalizeQuickReplies(raw);
  if (!replies.length) throw new Error('助理 AI 沒有產出可用的建議，請再試一次。');
  return replies;
}

// ---------------------------------------------------------------- 日記草稿

export interface DiaryDraft {
  title: string;
  summary: string;
  content: string;
  tags: string[];
}

export interface DiaryDraftContext {
  profile: PlayerProfile;
  locationName: string;
  gameDate: string;
  dialogueHistory: DialogueTurn[];
  /** 既有日記標題，避免寫出重複的內容。 */
  existingTitles: string[];
}

const DIARY_SYSTEM = `你是科幻角色扮演遊戲《星際港》的玩家助理，負責替玩家角色撰寫日記草稿。

要求：
- 以玩家角色的第一人稱書寫，繁體中文，語氣像私人日記，自然而內斂。
- **只能記錄對話紀錄中實際發生過的事**，不可編造沒發生的事件、人物或對話。
  可以寫下角色對這些事的感受與想法。
- content 約 150 到 300 字；title 10 字以內；summary 20 字以內；tags 2 到 4 個，每個 6 字以內。
- tags 是之後被提起時勾出這篇日記的關鍵字：填事件標記（例如「登艦」「停電」「借工具」），
  不要填人名或地名 —— 人名一出現就會把所有提到那人的日記都撈出來。
- 若玩家已有同名或內容重複的日記，換個角度或聚焦不同的事。

只輸出 json，格式如下，不要有其他文字：
{"title":"登艦第一天","summary":"在 A-1 認識了路西恩","content":"今天……","tags":["登艦","迎新"]}`;

const DIARY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    content: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'content', 'tags'],
};

export function normalizeDiaryDraft(raw: unknown): DiaryDraft | null {
  const entry = raw as Record<string, unknown> | null;
  if (!entry || typeof entry !== 'object') return null;
  const str = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
  const content = str(entry.content, 2000);
  if (!content) return null;
  const tags = Array.isArray(entry.tags)
    ? [...new Set(entry.tags.map((tag) => str(tag, 12).replace(/^#/, '')).filter(Boolean))].slice(0, 4)
    : [];
  return {
    title: str(entry.title, 30) || '未命名日記',
    summary: str(entry.summary, 60),
    content,
    tags,
  };
}

export async function generateDiaryDraft(context: DiaryDraftContext): Promise<DiaryDraft> {
  if (!context.dialogueHistory.length) {
    throw new Error('目前還沒有對話紀錄可以寫成日記。');
  }
  const transcript = buildTranscript(context.dialogueHistory, context.profile.name);
  const raw = await requestJson('assistant', {
    system: DIARY_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        `# 玩家角色\n${describePlayer(context.profile)}`,
        `# 日期與地點\n${context.gameDate}，${context.locationName}`,
        `# 已有的日記標題\n${context.existingTitles.join('、') || '（無）'}`,
        `# 對話紀錄\n${transcript}`,
      ].join('\n\n'),
    }],
    schema: DIARY_SCHEMA,
    schemaName: 'diary_draft',
  });
  const draft = normalizeDiaryDraft(raw);
  if (!draft) throw new Error('助理 AI 沒有產出可用的日記內容，請再試一次。');
  return draft;
}

// ---------------------------------------------------------------- 日記整理

export interface CondenseContext {
  profile: PlayerProfile;
  /** 玩家選的日記，照清單順序（新的在前）。 */
  entries: Pick<DiaryEntry, 'date' | 'title' | 'content' | 'tags'>[];
}

const CONDENSE_SYSTEM = `你是科幻角色扮演遊戲《星際港》的玩家助理，負責把玩家角色的幾篇日記整理成一篇。

要求：
- 以玩家角色的第一人稱書寫，繁體中文，語氣像私人日記，與原篇一致。
- **只能用原篇裡寫過的事**，不可添加沒發生的事件、人物或對話。
- 刪掉重複的內容，保留之後還用得上的事實（發生了什麼、答應了什麼、對誰的看法變了）
  與當時的感受。事情照時間先後寫。
- content 約 200 到 400 字；title 10 字以內；summary 20 字以內；
  tags 2 到 4 個，每個 6 字以內，填事件標記，不要填人名或地名。

只輸出 json，格式如下，不要有其他文字：
{"title":"登艦這一週","summary":"從陌生到慢慢熟悉","content":"這一週……","tags":["登艦","搬貨"]}`;

/**
 * 日記「整理」（骨架第五節）：玩家複選數篇，濃縮成一篇草稿。
 * 跟「自動」一樣先填進編輯表單，玩家看過、改過才存；存檔時原篇收進濃縮篇底下（game/diary.ts）。
 */
export async function condenseDiaryDraft(context: CondenseContext): Promise<DiaryDraft> {
  if (context.entries.length < 2) throw new Error('至少選兩篇日記才能整理。');
  // 舊的在前，讓模型照時間順序讀。
  const ordered = [...context.entries].sort((a, b) => a.date.localeCompare(b.date));
  const raw = await requestJson('assistant', {
    system: CONDENSE_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        `# 玩家角色\n${describePlayer(context.profile)}`,
        `# 要整理的日記\n${ordered.map((entry) => `## ${entry.date}｜${entry.title}${entry.tags?.length ? `（${entry.tags.join('、')}）` : ''}\n${entry.content}`).join('\n\n')}`,
      ].join('\n\n'),
    }],
    schema: DIARY_SCHEMA,
    schemaName: 'diary_condense',
  });
  const draft = normalizeDiaryDraft(raw);
  if (!draft) throw new Error('助理 AI 沒有產出可用的整理內容，請再試一次。');
  return draft;
}

// ---------------------------------------------------------------- 進場語意篩選

export interface SceneSelectionContext {
  locationName: string;
  presentNpcs: NPCData[];
  summary: string;
  gameDate: string;
  gameTime: string;
  diaries: SceneCandidate[];
  /** 在場 NPC 的日誌候選（npcId 標明是誰的）。 */
  npcLogs: SceneCandidate[];
}

const SCENE_SELECTION_SYSTEM = `你是科幻角色扮演遊戲《星際港》的助理，負責在玩家進入一個場景時，
從日記清單裡挑出「這個場景可能用得上的往事」，交給主持人參考。清單有兩種：
- 玩家日記：玩家角色自己寫的。最多 ${MEMORY_PARAMS.diarySceneLimit} 則。
- NPC 日誌：在場角色各自記得的事。每人最多 ${MEMORY_PARAMS.npcLogPerNpc} 則，合計最多 ${MEMORY_PARAMS.npcLogTotal} 則。

判讀依據：目前地點、在場角色、當前摘要。標題是主要依據，摘要與關鍵字輔助。
- 跟在場角色有關、跟這個地點有關、跟當前處境有關的優先；同樣相關時挑比較新的。
- 想不到用途的不要挑。寧缺勿濫，一則都不挑也可以。

只輸出 json，格式如下，不要有其他文字：
{"diaryIds":["d_123"],"npcLogIds":["log-lucian-2090-10-24"]}`;

const SCENE_SELECTION_SCHEMA = {
  type: 'object',
  properties: {
    diaryIds: { type: 'array', items: { type: 'string' } },
    npcLogIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['diaryIds', 'npcLogIds'],
};

/**
 * 進場語意篩選（骨架第五節「語意軌」）：換場時呼叫一次，結果凍結到離場。
 * 是唯一掛在換場節拍上的 LLM 呼叫，玩家在場景裡對話時不等它。
 * 玩家日記與 NPC 日誌一起挑，一次呼叫；候選都沒超過上限時不呼叫，直接全帶。
 */
export async function selectSceneMemories(context: SceneSelectionContext): Promise<SceneSelection> {
  const direct = selectWithoutLlm(context.diaries, context.npcLogs);
  if (direct) return direct;
  const list = (items: SceneCandidate[]) => items
    .map((item) => `- id: ${item.id}｜${item.date}｜${item.title}${item.summary ? `：${item.summary}` : ''}${item.keywords.length ? `（${item.keywords.join('、')}）` : ''}`)
    .join('\n') || '（無）';
  const npcSections = context.presentNpcs
    .map((npc) => ({ npc, logs: context.npcLogs.filter((log) => log.npcId === npc.id) }))
    .filter(({ logs }) => logs.length)
    .map(({ npc, logs }) => `## ${npc.name}\n${list(logs)}`)
    .join('\n');
  const raw = await requestJson('assistant', {
    system: SCENE_SELECTION_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        `# 時間與地點\n${context.gameDate} ${context.gameTime}，${context.locationName}`,
        `# 在場角色\n${context.presentNpcs.map((npc) => npc.name).join('、') || '（無）'}`,
        `# 當前摘要\n${context.summary || '（無）'}`,
        `# 玩家日記\n${list(context.diaries)}`,
        `# NPC 日誌\n${npcSections || '（無）'}`,
      ].join('\n\n'),
    }],
    schema: SCENE_SELECTION_SCHEMA,
    schemaName: 'scene_selection',
  });
  return normalizeSceneSelection(raw, context.diaries, context.npcLogs);
}

// ---------------------------------------------------------------- NPC 日誌提煉

export interface DistillContext {
  npc: Pick<NPCData, 'name' | 'position' | 'personality'>;
  playerName: string;
  /** 這一批要提煉的 thought，舊的在前。 */
  thoughts: Pick<NpcThought, 'at' | 'place' | 'text'>[];
  /** 當天日誌已經寫了什麼（沒有就是空字串）：避免重複記同一件事。 */
  todayLog: string;
}

export interface DistillResult {
  entry: string;
  keywords: string[];
}

const DISTILL_SYSTEM = `你是科幻角色扮演遊戲《星際港》的助理，負責整理 NPC 的記憶。
下面是某位 NPC 最近的內心想法（遊戲主持人替他寫的），請提煉成他日誌裡的一段。

要求：
- 去掉感官描寫與重複的情緒，只留下之後還用得上的事實：發生了什麼、答應了什麼、
  對玩家的看法有什麼變化、他在意什麼。
- 以這位 NPC 的第一人稱書寫，繁體中文。每件事一行，開頭標「[HH:MM｜地點]」。
- 這一段 80 到 200 字。當天日誌已經寫過的事不要再寫。
- keywords 2 到 4 個，每個 6 字以內，是之後被提起時用來勾出這段的事件標記
  （例如「借工具」「停電」），不要填人名或地名。

只輸出 json，格式如下，不要有其他文字：
{"entry":"[09:10｜溫室] 新來的人主動幫我搬了貨……","keywords":["搬貨"]}`;

const DISTILL_SCHEMA = {
  type: 'object',
  properties: {
    entry: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
  },
  required: ['entry', 'keywords'],
};

/** 收斂提煉輸出：內文去空白、截長；關鍵字去空、去 #、去重、最多 4 個。 */
export function normalizeDistill(raw: unknown): DistillResult | null {
  const output = raw as { entry?: unknown; keywords?: unknown } | null;
  const entry = typeof output?.entry === 'string' ? output.entry.trim().slice(0, 600) : '';
  if (!entry) return null;
  const keywords = Array.isArray(output?.keywords)
    ? mergeKeywords([], output.keywords
      .filter((keyword): keyword is string => typeof keyword === 'string')
      .map((keyword) => keyword.trim().replace(/^#/, '').slice(0, 12))).slice(0, 4)
    : [];
  return { entry, keywords };
}

/**
 * 把一批 thought 提煉成 NPC 日誌的一段（骨架第三節階段 6）。
 * 在背景跑：玩家已經看到 GM 的回應了，不等它。失敗就下次再提煉，thought 還留著。
 */
export async function distillNpcThoughts(context: DistillContext): Promise<DistillResult> {
  const raw = await requestJson('assistant', {
    system: DISTILL_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        `# NPC\n${context.npc.name}${context.npc.position ? `（${context.npc.position}）` : ''}${context.npc.personality ? `\n性格：${context.npc.personality}` : ''}`,
        `# 玩家角色\n${context.playerName || '（未填姓名）'}`,
        `# 當天日誌已寫的內容\n${context.todayLog || '（還沒有）'}`,
        `# 最近的內心想法\n${context.thoughts.map((thought) => `[${thought.at.slice(11)}｜${thought.place}] ${thought.text}`).join('\n')}`,
      ].join('\n\n'),
    }],
    schema: DISTILL_SCHEMA,
    schemaName: 'npc_log_distill',
  });
  const result = normalizeDistill(raw);
  if (!result) throw new Error('助理 AI 沒有產出可用的日誌內容。');
  return result;
}
