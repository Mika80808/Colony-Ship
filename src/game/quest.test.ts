import assert from 'node:assert/strict';
import type { Quest } from '../types';
import { deadlineText, isOverdue, questDaysLeft } from './quest';

const quest: Quest = {
  id: 'q1', category: '次要', title: '送藥', status: '進行中', description: '',
  acceptedDate: '2090-10-24', deadlineDays: 2,
};

// 重現：10/24 接、期限 2 天，到 10/28 不能還顯示「剩餘 2 天」。
assert.equal(questDaysLeft(quest, '2090-10-24'), 2);
assert.equal(questDaysLeft(quest, '2090-10-25'), 1);
assert.equal(questDaysLeft(quest, '2090-10-26'), 0);
assert.equal(questDaysLeft(quest, '2090-10-28'), -2);
assert.equal(deadlineText(quest, '2090-10-24'), '剩餘 2 天');
assert.equal(deadlineText(quest, '2090-10-26'), '今日到期');
assert.equal(deadlineText(quest, '2090-10-28'), '已逾期 2 天');
assert.equal(isOverdue(quest, '2090-10-26'), false);
assert.equal(isOverdue(quest, '2090-10-28'), true);

// 跨月、跨年照日曆算。
assert.equal(questDaysLeft({ acceptedDate: '2090-12-30', deadlineDays: 3 }, '2091-01-02'), 0);

// 待回報的不標逾期：狀態標籤要留著提醒玩家回報。
assert.equal(isOverdue({ ...quest, status: '待回報' }, '2090-10-28'), false);
assert.equal(deadlineText({ ...quest, status: '待回報' }, '2090-10-28'), '已逾期 2 天');

// 已完成的不算逾期，顯示已結算。
assert.equal(isOverdue({ ...quest, status: '已完成' }, '2090-10-28'), false);
assert.equal(deadlineText({ ...quest, status: '已完成' }, '2090-10-28'), '已結算');

// 沒有期限或沒有接取日：沒有倒數。
assert.equal(questDaysLeft({ acceptedDate: '2090-10-24' }, '2090-10-28'), undefined);
assert.equal(questDaysLeft({ deadlineDays: 2 }, '2090-10-28'), undefined);
assert.equal(deadlineText({ ...quest, deadlineDays: undefined }, '2090-10-28'), undefined);
assert.equal(isOverdue({ ...quest, deadlineDays: undefined }, '2090-10-28'), false);

console.log('quest tests passed');
