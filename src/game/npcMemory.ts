import type { NpcLog, NpcMemories, NpcMemory, NpcThought } from '../types';
import { MEMORY_PARAMS, SceneCandidate, keywordHit, mergeKeywords } from './memory';

/**
 * 通道 ② NPC 日記（骨架第三節階段 6「記憶回寫與通道 ② 生命週期」）。
 *
 * - thought：主 GM 每回合替在場 NPC 寫一則內心想法，進滑動窗口（保留近 10 則），
 *   給主 GM 拿捏語氣與心境。
 * - 日誌：未歸檔的 thought 累積滿 10 則，或本回合有進展（任務狀態、關係描述改寫），
 *   就請助理 GM 提煉一次，追加到該 NPC「當天那一篇」的尾端。一角色一天一篇。
 * 主 GM 不能直接寫日誌，日誌是 thought 衍生出來的資料。
 *
 * 這支只放純函式；提煉的 LLM 呼叫在 gm/assistant.ts，狀態由 App 持有。
 */

const EMPTY: NpcMemory = { thoughts: [], logs: [] };
export const npcMemoryOf = (store: NpcMemories, npcId: string): NpcMemory => store[npcId] ?? EMPTY;

/**
 * 把本回合的 thought 寫進各 NPC 的窗口。
 * 窗口只擠掉「已歸檔」的舊 thought：還沒提煉的不能丟，丟了那一格就永遠補不回來。
 * 提煉一直失敗時才用 thoughtHardCap 硬截，免得存檔無限長。
 */
export function addThoughts(
  store: NpcMemories,
  thoughts: readonly { npcId: string; text: string }[],
  at: string,
  place: string,
  idPrefix: string,
): NpcMemories {
  if (!thoughts.length) return store;
  const next = { ...store };
  thoughts.forEach(({ npcId, text }, index) => {
    const memory = npcMemoryOf(next, npcId);
    const added: NpcThought = { id: `${idPrefix}-${index}`, at, place, text: text.trim().slice(0, MEMORY_PARAMS.thoughtCharLimit) };
    next[npcId] = { ...memory, thoughts: trimWindow([...memory.thoughts, added]) };
  });
  return next;
}

function trimWindow(thoughts: NpcThought[]): NpcThought[] {
  let list = thoughts;
  while (list.length > MEMORY_PARAMS.thoughtWindow) {
    const oldestArchived = list.findIndex((thought) => thought.archived);
    if (oldestArchived < 0) break;
    list = [...list.slice(0, oldestArchived), ...list.slice(oldestArchived + 1)];
  }
  return list.length > MEMORY_PARAMS.thoughtHardCap ? list.slice(-MEMORY_PARAMS.thoughtHardCap) : list;
}

/** 還沒提煉進日誌的 thought。 */
export const pendingThoughts = (store: NpcMemories, npcId: string) =>
  npcMemoryOf(store, npcId).thoughts.filter((thought) => !thought.archived);

/**
 * 該不該提煉了：未歸檔滿 thoughtBatch 則（門檻觸發），或本回合有進展且有未歸檔的（事件觸發）。
 * 當天沒互動就沒有 thought，自然不會觸發。
 */
export function needsDistill(store: NpcMemories, npcId: string, progress: boolean): boolean {
  const pending = pendingThoughts(store, npcId).length;
  return pending >= MEMORY_PARAMS.thoughtBatch || (progress && pending > 0);
}

/** 日誌標題：[10/24 觀察日誌]。 */
export function logTitle(date: string): string {
  const [, month, day] = date.split('-');
  return `[${month}/${day} 觀察日誌]`;
}

/**
 * 把一次提煉的結果追加進當天日誌（沒有就開一篇），並把這批 thought 標成已歸檔。
 * 關鍵字併入既有清單去重，不覆蓋。
 */
export function appendLog(
  store: NpcMemories,
  npcId: string,
  result: { entry: string; keywords: readonly string[] },
  distilled: readonly string[],
  date: string,
  now: string,
): NpcMemories {
  const memory = npcMemoryOf(store, npcId);
  const done = new Set(distilled);
  const thoughts = memory.thoughts.map((thought) => (done.has(thought.id) ? { ...thought, archived: true } : thought));
  const entry = result.entry.trim();
  if (!entry) return { ...store, [npcId]: { ...memory, thoughts: trimWindow(thoughts) } };

  const today = memory.logs.find((log) => log.date === date);
  const log: NpcLog = today
    ? { ...today, content: `${today.content}\n${entry}`, keywords: mergeKeywords(today.keywords, result.keywords), updatedAt: now }
    : { id: `log-${npcId}-${date}`, date, title: logTitle(date), content: entry, keywords: mergeKeywords([], result.keywords), enabled: true, updatedAt: now };
  const logs = today ? memory.logs.map((item) => (item.id === log.id ? log : item)) : [...memory.logs, log];
  return { ...store, [npcId]: { thoughts: trimWindow(thoughts), logs } };
}

/** 玩家切換某篇日誌的啟用狀態。 */
export function toggleNpcLog(store: NpcMemories, npcId: string, logId: string): NpcMemories {
  const memory = npcMemoryOf(store, npcId);
  return {
    ...store,
    [npcId]: { ...memory, logs: memory.logs.map((log) => (log.id === logId ? { ...log, enabled: !log.enabled } : log)) },
  };
}

// ---------------------------------------------------------------- 注入

const newestLogFirst = (a: NpcLog, b: NpcLog) => b.date.localeCompare(a.date);

/** 進場語意篩選的候選：在場 NPC 啟用中的日誌（標題＋關鍵字，不送內文）。 */
export function npcLogCandidates(store: NpcMemories, presentNpcIds: readonly string[]): SceneCandidate[] {
  return presentNpcIds.flatMap((npcId) => [...npcMemoryOf(store, npcId).logs]
    .filter((log) => log.enabled)
    .sort(newestLogFirst)
    .map((log) => ({ id: log.id, date: log.date, title: log.title, summary: '', keywords: log.keywords, npcId })));
}

/** 進場時在場 NPC 窗口裡已有的 thought（來自先前的場景）。 */
export function thoughtSnapshot(store: NpcMemories, presentNpcIds: readonly string[]): string[] {
  return presentNpcIds.flatMap((npcId) => npcMemoryOf(store, npcId).thoughts.map((thought) => thought.id));
}

export interface RecalledNpcLog {
  npcId: string;
  title: string;
  content: string;
}

const clip = (text: string, max: number) => (text.length > max ? `…${text.slice(-max)}` : text);
const toRecalled = (npcId: string, log: NpcLog): RecalledNpcLog => ({
  npcId,
  title: log.title,
  // 一天一篇只會越追加越長；超過上限時留尾端（最新的事）。
  content: clip(log.content, MEMORY_PARAMS.npcLogCharLimit),
});

/**
 * NPC 日誌的雙軌檢索：語意軌取進場凍結的 id，精確軌掃本次輸入命中關鍵字的。
 * 只看在場 NPC 的日誌 —— 日誌是那個人自己記得的事，不在場的人的心事不該影響場上的演出。
 */
export function recallNpcLogs(
  store: NpcMemories,
  presentNpcIds: readonly string[],
  sceneLogIds: readonly string[],
  input: string,
): { scene: RecalledNpcLog[]; keyword: RecalledNpcLog[] } {
  const wanted = new Set(sceneLogIds);
  const scene: RecalledNpcLog[] = [];
  const keyword: RecalledNpcLog[] = [];
  for (const npcId of presentNpcIds) {
    for (const log of [...npcMemoryOf(store, npcId).logs].sort(newestLogFirst)) {
      if (!log.enabled) continue;
      if (wanted.has(log.id)) scene.push(toRecalled(npcId, log));
      else if (keywordHit(log.keywords, input)) keyword.push(toRecalled(npcId, log));
    }
  }
  return { scene, keyword: keyword.slice(0, MEMORY_PARAMS.npcLogKeywordLimit) };
}

/** 進場時凍結的 thought（仍在窗口裡的），以 NPC id 對應，攤成「[時間｜地點] 內容」。 */
export function frozenThoughts(store: NpcMemories, presentNpcIds: readonly string[], thoughtIds: readonly string[]): Record<string, string[]> {
  const wanted = new Set(thoughtIds);
  const out: Record<string, string[]> = {};
  for (const npcId of presentNpcIds) {
    const lines = npcMemoryOf(store, npcId).thoughts
      .filter((thought) => wanted.has(thought.id))
      .map((thought) => `[${thought.at.slice(5)}｜${thought.place}] ${thought.text}`);
    if (lines.length) out[npcId] = lines;
  }
  return out;
}
