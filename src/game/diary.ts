import type { DiaryEntry } from '../types';

/**
 * 玩家日記的「整理」（骨架第五節）：玩家複選數篇，濃縮成一篇。
 * 原篇不刪，收在濃縮篇的 sources 底下、退出索引（記憶系統只看最上層的日記）。
 * 濃縮篇可以再被整理，逐層疊上去；疊得越多層，AI 檢索到的細節越粗，這是玩家自己的選擇。
 */

/** 整理至少要選幾篇。 */
export const CONDENSE_MIN = 2;

/**
 * 把選中的日記換成一篇濃縮篇。濃縮篇放在最前面（日記清單新的在前），原篇照清單順序收進 sources。
 * 只認最上層的 id；選不到兩篇就不動。
 */
export function condenseEntries(
  entries: readonly DiaryEntry[],
  ids: readonly string[],
  condensed: Omit<DiaryEntry, 'id' | 'sources'>,
  id: string,
): DiaryEntry[] {
  const wanted = new Set(ids);
  const sources = entries.filter((entry) => wanted.has(entry.id));
  if (sources.length < CONDENSE_MIN) return [...entries];
  return [{ ...condensed, id, sources }, ...entries.filter((entry) => !wanted.has(entry.id))];
}

/** 拆開濃縮篇：原篇放回它原本的位置，濃縮篇本身拿掉。 */
export function splitCondensed(entries: readonly DiaryEntry[], id: string): DiaryEntry[] {
  return entries.flatMap((entry) => (entry.id === id && entry.sources?.length ? entry.sources : [entry]));
}

/** 濃縮篇涵蓋的日期範圍（含更深層的原篇），例如「2090-10-24～2090-10-27」。 */
export function sourceDateRange(entry: DiaryEntry): string {
  const dates: string[] = [];
  const walk = (item: DiaryEntry) => {
    if (item.sources?.length) item.sources.forEach(walk);
    else dates.push(item.date);
  };
  walk(entry);
  dates.sort();
  const first = dates[0] ?? entry.date;
  const last = dates[dates.length - 1] ?? entry.date;
  return first === last ? first : `${first}～${last}`;
}
