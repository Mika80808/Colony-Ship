import assert from 'node:assert/strict';
import type { DiaryEntry } from '../types';
import { condenseEntries, sourceDateRange, splitCondensed } from './diary';
import { diaryCandidates, recallDiaries } from './memory';

const diary = (id: string, date = '2090-10-24', extra: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id, date, title: `日記${id}`, content: `內容${id}`, author: '玩家', enabled: true, ...extra,
});
const condensedBody = { date: '2090-10-28', title: '這一週', content: '濃縮後的內容', author: '玩家', enabled: true, tags: ['搬貨'] };

const entries = [diary('d4', '2090-10-27'), diary('d3', '2090-10-26', { tags: ['停電'] }), diary('d2', '2090-10-25'), diary('d1', '2090-10-24')];

// --- 整理 ---
const merged = condenseEntries(entries, ['d1', 'd3'], condensedBody, 'c1');
assert.deepEqual(merged.map((entry) => entry.id), ['c1', 'd4', 'd2'], '濃縮篇放最前面，原篇退出最上層');
assert.deepEqual(merged[0].sources?.map((entry) => entry.id), ['d3', 'd1'], '原篇照清單順序收進去');
assert.deepEqual(condenseEntries(entries, ['d1'], condensedBody, 'c1').map((e) => e.id), ['d4', 'd3', 'd2', 'd1'], '不到兩篇不動');
assert.deepEqual(condenseEntries(entries, ['d1', 'ghost'], condensedBody, 'c1').map((e) => e.id), ['d4', 'd3', 'd2', 'd1'], '不存在的 id 不算');

// 索引只認最上層：原篇不再被檢索
assert.deepEqual(diaryCandidates(merged).map((c) => c.id), ['c1', 'd4', 'd2']);
assert.deepEqual(recallDiaries(merged, [], '停電那天').keyword, [], '收進去的 d3 不再被關鍵字勾出');
assert.deepEqual(recallDiaries(merged, [], '搬貨').keyword.map((d) => d.id), ['c1'], '濃縮篇用自己的關鍵字');

// 濃縮篇可以再被整理
const twice = condenseEntries(merged, ['c1', 'd4'], { ...condensedBody, title: '十月' }, 'c2');
assert.deepEqual(twice.map((entry) => entry.id), ['c2', 'd2']);
assert.deepEqual(twice[0].sources?.map((entry) => entry.id), ['c1', 'd4']);
assert.equal(sourceDateRange(twice[0]), '2090-10-24～2090-10-27', '日期範圍看到最深層的原篇');
assert.equal(sourceDateRange(diary('x', '2090-10-30')), '2090-10-30', '一般日記就是自己的日期');

// --- 拆開 ---
assert.deepEqual(splitCondensed(twice, 'c2').map((entry) => entry.id), ['c1', 'd4', 'd2'], '原篇放回原位');
assert.deepEqual(splitCondensed(splitCondensed(twice, 'c2'), 'c1').map((entry) => entry.id), ['d3', 'd1', 'd4', 'd2']);
assert.deepEqual(splitCondensed(entries, 'd1').map((entry) => entry.id), ['d4', 'd3', 'd2', 'd1'], '一般日記不能拆');

console.log('diary.test.ts ok');
