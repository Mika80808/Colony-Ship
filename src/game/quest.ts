import type { Quest } from '../types';

/** 'YYYY-MM-DD' → 日序（整數）。只比日期，不看時刻：期限是以「天」為單位。 */
const dayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/**
 * 任務還剩幾天：接取日 + 期限天數 − 今天。0 是今天到期，負數是已逾期幾天。
 * 沒有期限或沒有接取日的任務回傳 undefined。
 * 存檔只記接取日與期限長度，剩餘天數每次照遊戲日期現算，時間推進時才會跟著倒數。
 */
export function questDaysLeft(quest: Pick<Quest, 'acceptedDate' | 'deadlineDays'>, today: string): number | undefined {
  if (quest.deadlineDays === undefined || !quest.acceptedDate) return undefined;
  return dayOf(quest.acceptedDate) + quest.deadlineDays - dayOf(today);
}

/**
 * 還在進行中、有期限、已經過了到期日。
 * 待回報的不算：事情已經辦完，只差回報，狀態標籤要繼續提醒玩家去回報。
 */
export const isOverdue = (quest: Quest, today: string) =>
  quest.status === '進行中' && (questDaysLeft(quest, today) ?? 0) < 0;

/** 期限的顯示文字（玩家看的與 GM 看的共用）。 */
export function deadlineText(quest: Quest, today: string): string | undefined {
  const left = questDaysLeft(quest, today);
  if (left === undefined) return undefined;
  if (quest.status === '已完成') return '已結算';
  if (left < 0) return `已逾期 ${-left} 天`;
  if (left === 0) return '今日到期';
  return `剩餘 ${left} 天`;
}
