import { DialogueTurn, NPCData, PlayerProfile } from '../types';
import { requestJson } from './client';

/**
 * 助理 AI 的工作：快速回覆建議、日記草稿。
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
- 若玩家已有同名或內容重複的日記，換個角度或聚焦不同的事。

只輸出 json，格式如下，不要有其他文字：
{"title":"登艦第一天","summary":"在 A-1 認識了路西恩","content":"今天……","tags":["登艦","路西恩"]}`;

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
        `# 日期與地點\n星曆 ${context.gameDate}，${context.locationName}`,
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
