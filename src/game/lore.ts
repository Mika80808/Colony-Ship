import type { MergedStory } from '../types';
import { keywordHit } from './memory';

/**
 * 通道 ④ 設定集（骨架第一節：關鍵字掃描＋類別規則；地點類例外，當前與相鄰地點強制注入）。
 *
 * 設定集是故事書的條目：地點、NPC、物品、事件、設定。跟 ① 分層記憶不同，
 * 這裡是「背景知識」，所以用名稱本身當關鍵字 —— 玩家提到某人、某樣東西才帶。
 * 類別規則：
 * - 地點：所在地點與相鄰地點每回合都帶（第四層，進場就固定）；其他地點被提到名稱才帶。
 * - NPC：不在場的人被提到名字才帶簡介（在場的人設已經完整在局勢裡）。
 * - 物品：被提到名稱才帶描述。
 * - 事件：已解鎖的、被提到標題才帶。
 * - 設定：命中標題或關鍵字才帶。
 * 只看啟用中的條目。命中的放在第五層尾端，緊貼玩家輸入。
 */

export const LORE_PARAMS = {
  /** 每回合關鍵字命中最多帶幾則。 */
  hitLimit: 4,
  /** 單則最多幾字。 */
  charLimit: 300,
};

const clip = (text: string, max = LORE_PARAMS.charLimit) => {
  const trimmed = text.trim().replace(/\s*\n\s*/g, ' ');
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

/** 第四層：所在地點與相鄰地點的說明（地點類強制注入）。 */
export function placeLore(story: Pick<MergedStory, 'sectors'>, currentSectorId: string): string[] {
  const current = story.sectors.find((sector) => sector.id === currentSectorId);
  if (!current) return [];
  const nearby = current.connectedTo
    .map((id) => story.sectors.find((sector) => sector.id === id))
    .filter((sector): sector is NonNullable<typeof sector> => !!sector && sector.enabled);
  return [
    ...(current.enabled && current.description ? [`${current.name}（所在地）：${clip(current.description)}`] : []),
    ...nearby.filter((sector) => sector.description).map((sector) => `${sector.name}（相鄰）：${clip(sector.description)}`),
  ];
}

/**
 * 第五層尾端：本次輸入提到的設定集條目。
 * presentNpcIds、placeIds 是已經在局勢裡的（在場者、所在與相鄰地點），不重複帶。
 */
export function scanLore(
  story: MergedStory,
  input: string,
  presentNpcIds: readonly string[],
  placeIds: readonly string[],
): string[] {
  const hits: string[] = [];
  for (const entry of story.lore) {
    if (entry.enabled && keywordHit([entry.title, ...entry.keywords], input)) hits.push(`【設定】${entry.title}：${clip(entry.content)}`);
  }
  for (const npc of story.npcs) {
    if (!npc.enabled || presentNpcIds.includes(npc.id) || !keywordHit([npc.name], input)) continue;
    const brief = [npc.position, npc.appearance && `外貌：${npc.appearance}`, npc.personality && `性格：${npc.personality}`].filter(Boolean).join('；');
    hits.push(`【人物・不在場】${npc.name}${brief ? `：${clip(brief, 160)}` : ''}`);
  }
  for (const item of story.items) {
    if (item.enabled && item.description && keywordHit([item.name], input)) hits.push(`【物品】${item.name}：${clip(item.description)}`);
  }
  for (const chapter of story.chapters) {
    if (!chapter.enabled || chapter.unlocked === false || !keywordHit([chapter.title], input)) continue;
    hits.push(`【事件】${chapter.title}：${clip(chapter.summary || chapter.fullText)}`);
  }
  for (const sector of story.sectors) {
    if (!sector.enabled || placeIds.includes(sector.id) || !sector.description || !keywordHit([sector.name], input)) continue;
    hits.push(`【地點】${sector.name}：${clip(sector.description)}`);
  }
  return hits.slice(0, LORE_PARAMS.hitLimit);
}
