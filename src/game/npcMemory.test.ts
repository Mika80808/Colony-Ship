import assert from 'node:assert/strict';
import type { NpcMemories } from '../types';
import { MEMORY_PARAMS } from './memory';
import {
  addThoughts,
  appendLog,
  frozenThoughts,
  logTitle,
  needsDistill,
  npcLogCandidates,
  pendingThoughts,
  recallNpcLogs,
  thoughtSnapshot,
  toggleNpcLog,
} from './npcMemory';

const fill = (store: NpcMemories, count: number, npcId = 'lucian', start = 0) => {
  let next = store;
  for (let i = start; i < start + count; i += 1) {
    next = addThoughts(next, [{ npcId, text: `想法${i}` }], `2090-10-24 09:${String(i).padStart(2, '0')}`, 'A 走廊', `t${i}`);
  }
  return next;
};

// --- thought 窗口 ---
{
  const store = addThoughts({}, [{ npcId: 'lucian', text: ' 他今天話很少 ' }, { npcId: 'blaze', text: '字'.repeat(200) }], '2090-10-24 09:10', 'A 走廊', 'turn1');
  assert.deepEqual(store.lucian.thoughts, [{ id: 'turn1-0', at: '2090-10-24 09:10', place: 'A 走廊', text: '他今天話很少' }]);
  assert.equal(store.blaze.thoughts[0].text.length, MEMORY_PARAMS.thoughtCharLimit, '過長截斷');
  assert.equal(addThoughts(store, [], 'x', 'y', 'z'), store, '沒有 thought 不動');
}
{
  // 未歸檔的不會被窗口擠掉；硬上限才截
  const store = fill({}, 12);
  assert.equal(store.lucian.thoughts.length, 12, '未歸檔的全部留著');
  assert.equal(fill({}, MEMORY_PARAMS.thoughtHardCap + 5).lucian.thoughts.length, MEMORY_PARAMS.thoughtHardCap, '提煉一直失敗時有硬上限');
}

// --- 提煉觸發 ---
{
  const nine = fill({}, 9);
  assert.ok(!needsDistill(nine, 'lucian', false), '未滿 10 則不提煉');
  assert.ok(needsDistill(nine, 'lucian', true), '有進展時未滿 10 則也提煉');
  assert.ok(needsDistill(fill({}, 10), 'lucian', false), '滿 10 則提煉');
  assert.ok(!needsDistill({}, 'lucian', true), '沒有 thought（當天沒互動）不提煉');
}

// --- 追加日誌 ---
{
  let store = fill({}, 10);
  const batch = pendingThoughts(store, 'lucian').map((thought) => thought.id);
  store = appendLog(store, 'lucian', { entry: '[09:00｜A 走廊] 他幫我搬了貨。', keywords: ['搬貨'] }, batch, '2090-10-24', '2090-10-24 10:00');
  assert.deepEqual(store.lucian.logs, [{
    id: 'log-lucian-2090-10-24', date: '2090-10-24', title: '[10/24 觀察日誌]',
    content: '[09:00｜A 走廊] 他幫我搬了貨。', keywords: ['搬貨'], enabled: true, updatedAt: '2090-10-24 10:00',
  }], '當天第一次提煉開一篇');
  assert.equal(pendingThoughts(store, 'lucian').length, 0, '這批標成已歸檔');
  assert.equal(store.lucian.thoughts.length, 10, '歸檔後仍留在窗口裡拿捏語氣');

  store = fill(store, 3, 'lucian', 20);
  assert.equal(store.lucian.thoughts.length, MEMORY_PARAMS.thoughtWindow, '新的進來擠掉已歸檔的舊 thought');
  assert.equal(pendingThoughts(store, 'lucian').length, 3);

  store = appendLog(store, 'lucian', { entry: '[11:00｜溫室] 約好明天一起吃早餐。', keywords: ['早餐', '搬 貨'] }, pendingThoughts(store, 'lucian').map((t) => t.id), '2090-10-24', '2090-10-24 11:30');
  assert.equal(store.lucian.logs.length, 1, '同一天追加，不另開');
  assert.equal(store.lucian.logs[0].content, '[09:00｜A 走廊] 他幫我搬了貨。\n[11:00｜溫室] 約好明天一起吃早餐。');
  assert.deepEqual(store.lucian.logs[0].keywords, ['搬貨', '早餐'], '關鍵字併入去重，不覆蓋');

  store = appendLog(fill(store, 1, 'lucian', 40), 'lucian', { entry: '隔天的事', keywords: [] }, ['t40-0'], '2090-10-25', '2090-10-25 08:00');
  assert.deepEqual(store.lucian.logs.map((log) => log.title), ['[10/24 觀察日誌]', '[10/25 觀察日誌]'], '一天一篇');

  const empty = appendLog(fill({}, 2), 'lucian', { entry: '  ', keywords: [] }, ['t0-0'], '2090-10-24', 'x');
  assert.equal(empty.lucian.logs.length, 0, '提煉沒內容不開日誌');
  assert.equal(pendingThoughts(empty, 'lucian').length, 1, '但那批仍標成已歸檔');

  const off = toggleNpcLog(store, 'lucian', 'log-lucian-2090-10-24');
  assert.equal(off.lucian.logs[0].enabled, false);
  assert.equal(npcLogCandidates(off, ['lucian']).length, 1, '停用的不當候選');
}
assert.equal(logTitle('2090-01-05'), '[01/05 觀察日誌]');

// --- 注入 ---
{
  let store = fill({}, 2);
  store = appendLog(store, 'lucian', { entry: '舊事', keywords: ['停電'] }, ['t0-0', 't1-0'], '2090-10-23', 'x');
  store = appendLog(fill(store, 1, 'lucian', 5), 'lucian', { entry: '新事', keywords: ['早餐'] }, ['t5-0'], '2090-10-24', 'y');
  store = fill(store, 1, 'blaze', 9);
  store = appendLog(store, 'blaze', { entry: '布雷茲的事', keywords: ['停電'] }, ['t9-0'], '2090-10-24', 'z');

  assert.deepEqual(npcLogCandidates(store, ['lucian']).map((c) => c.id), ['log-lucian-2090-10-24', 'log-lucian-2090-10-23'], '候選新的在前、只含在場者');
  assert.deepEqual(thoughtSnapshot(store, ['lucian']), ['t0', 't1', 't5'].map((id) => `${id}-0`));

  const recalled = recallNpcLogs(store, ['lucian'], ['log-lucian-2090-10-24'], '那次停電');
  assert.deepEqual(recalled.scene.map((log) => log.content), ['新事'], '語意軌');
  assert.deepEqual(recalled.keyword.map((log) => log.content), ['舊事'], '精確軌只看在場者：布雷茲的停電不帶');

  const frozen = frozenThoughts(store, ['lucian', 'blaze'], ['t0-0']);
  assert.deepEqual(frozen, { lucian: ['[10-24 09:00｜A 走廊] 想法0'] }, '只帶進場時凍結的那些');
}
{
  const long = appendLog(fill({}, 1), 'lucian', { entry: `開頭${'字'.repeat(MEMORY_PARAMS.npcLogCharLimit)}結尾`, keywords: [] }, ['t0-0'], '2090-10-24', 'x');
  const [log] = recallNpcLogs(long, ['lucian'], ['log-lucian-2090-10-24'], '').scene;
  assert.ok(log.content.endsWith('結尾') && log.content.startsWith('…'), '過長時留尾端（最新的事）');
}

console.log('npcMemory.test.ts ok');
