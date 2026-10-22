import assert from 'node:assert/strict';
import type { DiaryEntry, LayeredMemory } from '../types';
import {
  MEMORY_PARAMS,
  MemoryWriteScope,
  addMemory,
  buildEntryPack,
  canReuseScene,
  describeRecalled,
  evictOverflow,
  memoriesAt,
  packBlocks,
  recallMemories,
  touchMemories,
  diaryCandidates,
  keywordHit,
  mergeKeywords,
  normalizeForMatch,
  normalizeSceneSelection,
  presentKey,
  pushTurn,
  recallDiaries,
  selectWithoutLlm,
} from './memory';

// --- 關鍵字 ---
assert.equal(normalizeForMatch(' 藍色 外套！ '), '藍色外套', '去空白與標點');
assert.equal(normalizeForMatch('ＡＩ'), 'ai', '全形轉半形、轉小寫');
assert.ok(keywordHit(['停電'], '昨天餐廳停電了嗎？'), '子字串命中');
assert.ok(keywordHit(['藍色 外套'], '你那件藍色外套呢'), '關鍵字裡的空白不影響');
assert.ok(!keywordHit(['停電'], '今天天氣不錯'), '沒出現不算');
assert.ok(!keywordHit(['', '  ', '！'], '任何輸入'), '空關鍵字與純標點不算命中');
assert.ok(!keywordHit(undefined, '輸入'), '沒有關鍵字欄');
assert.deepEqual(mergeKeywords(['停電', 'AI'], ['ai', '停 電', '借工具', '']), ['停電', 'AI', '借工具'], '正規化後去重、保留先出現的寫法');

// --- 短期上下文：批次汰除 ---
{
  let history: number[] = [];
  for (let i = 1; i <= MEMORY_PARAMS.shortTermWindow; i += 1) history = pushTurn(history, i);
  assert.equal(history.length, MEMORY_PARAMS.shortTermWindow, '滿額前不汰除');
  history = pushTurn(history, 21);
  assert.deepEqual(history, Array.from({ length: 11 }, (_, i) => i + 11), '超過上限一次汰除最早的 10 回');
  const before = history[0];
  for (let i = 22; i <= 30; i += 1) history = pushTurn(history, i);
  assert.equal(history[0], before, '之後九回合開頭都不變（前綴快取不失效）');
}

// --- ⑤ 玩家日記雙軌 ---
const diary = (id: string, extra: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id, date: '2090-10-24', title: `日記${id}`, content: `內容${id}`, author: '玩家', enabled: true, ...extra,
});
const entries = [
  diary('d5', { tags: ['停電'] }),
  diary('d4', { enabled: false, tags: ['停電'] }),
  diary('d3'),
  diary('d2', { tags: ['借工具'] }),
  diary('d1'),
];
{
  const { scene, keyword } = recallDiaries(entries, ['d3', 'd1', 'd4'], '餐廳停電那天');
  assert.deepEqual(scene.map((d) => d.id), ['d3', 'd1'], '語意軌只取啟用中的，照日記順序（新的在前）');
  assert.deepEqual(keyword.map((d) => d.id), ['d5'], '精確軌：停用的 d4 不算');
}
{
  const { scene, keyword } = recallDiaries(entries, ['d5'], '停電了');
  assert.deepEqual(scene.map((d) => d.id), ['d5']);
  assert.deepEqual(keyword, [], '兩軌去重：語意軌已有的不再追加');
}
{
  const many = Array.from({ length: 6 }, (_, i) => diary(`k${i}`, { tags: ['停電'] }));
  assert.equal(recallDiaries(many, [], '停電').keyword.length, MEMORY_PARAMS.diaryKeywordLimit, '關鍵字追加有上限');
  assert.equal(recallDiaries(many, many.map((d) => d.id), '').scene.length, MEMORY_PARAMS.diarySceneLimit, '語意軌有上限');
}
{
  const long = diary('long', { content: '字'.repeat(MEMORY_PARAMS.diaryCharLimit + 50) });
  const [picked] = recallDiaries([long], ['long'], '').scene;
  assert.equal(picked.content.length, MEMORY_PARAMS.diaryCharLimit + 1, '過長的內文截斷並加刪節號');
}
assert.deepEqual(diaryCandidates(entries).map((c) => c.id), ['d5', 'd3', 'd2', 'd1'], '候選不含停用的');

// --- 進場語意篩選的收斂 ---
{
  const candidates = diaryCandidates(entries);
  assert.deepEqual(
    normalizeSceneSelection({ diaryIds: ['d3', 'd3', 'ghost', 42, 'd1', 'd2', 'd5'] }, candidates).diaryIds,
    ['d3', 'd1', 'd2'],
    '只認候選裡的 id、去重、截在上限',
  );
  assert.deepEqual(normalizeSceneSelection(null, candidates).diaryIds, [], '壞輸出回傳空');
  assert.deepEqual(selectWithoutLlm(candidates.slice(0, 2))?.diaryIds, ['d5', 'd3'], '沒超過上限就全帶、不呼叫');
  assert.equal(selectWithoutLlm(candidates), null, '超過上限才需要語意篩選');

  // NPC 日誌：每人上限 2、總額 4
  const log = (id: string, npcId: string) => ({ id, npcId, date: '2090-10-24', title: id, summary: '', keywords: [] });
  const logs = [log('a1', 'a'), log('a2', 'a'), log('a3', 'a'), log('b1', 'b'), log('c1', 'c'), log('c2', 'c')];
  assert.deepEqual(
    normalizeSceneSelection({ diaryIds: [], npcLogIds: ['a1', 'a2', 'a3', 'b1', 'c1', 'c2', 'ghost'] }, [], logs).npcLogIds,
    ['a1', 'a2', 'b1', 'c1'],
    'NPC 日誌每人最多 2 則、合計最多 4 則',
  );
  assert.deepEqual(selectWithoutLlm([], logs.slice(0, 2)), { diaryIds: [], npcLogIds: ['a1', 'a2'] }, '日誌沒超過上限也不呼叫');
  assert.equal(selectWithoutLlm([], logs.slice(0, 3)), null, '同一人超過 2 則就要篩');
}

// --- 場景快取 ---
{
  const cached = { scene: 'A-1', present: presentKey(['lucian', 'blaze']), steps: 100, diaryIds: ['d1'], npcLogIds: [], packIds: [], thoughtIds: [] };
  assert.equal(presentKey(['lucian', 'blaze']), presentKey(['blaze', 'lucian']), '名單比對不看順序');
  assert.ok(canReuseScene(cached, 'A-1', presentKey(['blaze', 'lucian']), 130), '同場景、同名單、30 步內重用');
  assert.ok(!canReuseScene(cached, 'A-1', presentKey(['blaze', 'lucian']), 131), '超過 30 步重算');
  assert.ok(!canReuseScene(cached, 'A-1', presentKey(['lucian']), 101), '名單不同重算');
  assert.ok(!canReuseScene(cached, 'A-2', cached.present, 101), '不同場景');
  assert.ok(!canReuseScene(undefined, 'A-1', cached.present, 100), '沒有快取');
}

// --- ① 分層記憶 ---
let seq = 0;
const mem = (extra: Partial<LayeredMemory>): LayeredMemory => ({
  id: `m${++seq}`, layer: 'world', content: `記憶${seq}`, weight: 'normal', enabled: true, author: 'gm',
  createdAt: `2090-10-24 ${String(seq).padStart(2, '0')}:00`, ...extra,
});
const scope = {
  region: 'residential_a', adjacentRegions: ['greenhouse'], scene: 'A-1',
  presentNpcIds: ['lucian'], closeNpcIds: ['blaze'], today: '2090-10-25',
};
{
  const world = mem({});
  const off = mem({ enabled: false });
  const expired = mem({ expire: '2090-10-24' });
  const lastDay = mem({ expire: '2090-10-25' });
  const topic = mem({ keywords: ['停電'] });
  const region = mem({ layer: 'region', location: 'residential_a' });
  const adjacent = mem({ layer: 'region', location: 'greenhouse' });
  const far = mem({ layer: 'region', location: 'medical' });
  const room = mem({ layer: 'scene', location: 'A-1' });
  const otherRoom = mem({ layer: 'scene', location: 'A-2' });
  const corridor = mem({ layer: 'scene', location: 'residential_a' });
  const present = mem({ layer: 'npc', npcId: 'lucian' });
  const closeNormal = mem({ layer: 'npc', npcId: 'blaze' });
  const closeCritical = mem({ layer: 'npc', npcId: 'blaze', weight: 'critical' });
  const stranger = mem({ layer: 'npc', npcId: 'aiden', weight: 'critical' });
  const all = [world, off, expired, lastDay, topic, region, adjacent, far, room, otherRoom, corridor, present, closeNormal, closeCritical, stranger];
  const pack = new Set(buildEntryPack(all, scope));
  assert.deepEqual(
    [...pack].sort(),
    [world, lastDay, region, adjacent, room, present, closeCritical].map((m) => m.id).sort(),
    '判定 1 啟用、2 期限（當天仍有效）、5 地點；有關鍵字的不進進場包；不在場的親近 NPC 只帶 critical',
  );

  const blocks = packBlocks(all, [...pack], scope, (id) => `地點${id}`, (id) => `名字${id}`);
  assert.deepEqual(blocks.world.length, 2);
  assert.deepEqual(Object.keys(blocks.npcMemories), ['lucian']);
  assert.deepEqual(blocks.absentNpcMemories, { 名字blaze: [`【重要】${closeCritical.content}`] }, '不在場的以名字對應、critical 標【重要】');
  assert.ok(blocks.place.every((line) => line.startsWith('（地點')), '區域與場景記憶標上地點');

  assert.deepEqual(recallMemories(all, '餐廳又停電了', scope.today).map((m) => m.id), [topic.id], '追加區：話題型命中才帶');
  assert.deepEqual(recallMemories(all, '停電', scope.today, [topic.id]), [], '已帶的不重複');
  assert.equal(describeRecalled(present, () => '路西恩', String), `（關於路西恩）${present.content}`);

  assert.deepEqual(
    memoriesAt(all, ['residential_a', 'A-1'], scope.today).map((m) => m.id),
    [room.id, corridor.id, region.id].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
    '頂欄區域記憶：這裡的區域與場景記憶，新的在前',
  );
}
{
  // 配額：world normal 8、flavor 3；critical 全留
  const many = [
    ...Array.from({ length: 10 }, () => mem({ weight: 'normal' })),
    ...Array.from({ length: 4 }, () => mem({ weight: 'flavor' })),
    ...Array.from({ length: 2 }, () => mem({ weight: 'critical' })),
  ];
  const pack = buildEntryPack(many, scope);
  assert.equal(pack.length, 8 + 3 + 2, '依配額截斷');
  const newestNormal = many.filter((m) => m.weight === 'normal').slice(-8).map((m) => m.id);
  assert.ok(newestNormal.every((id) => pack.includes(id)), 'normal 取最新的');

  const flood = [...many, ...Array.from({ length: 10 }, () => mem({ layer: 'region', location: 'residential_a' }))];
  assert.deepEqual(
    buildEntryPack(flood, scope).sort(),
    many.filter((m) => m.weight === 'critical').map((m) => m.id).sort(),
    '四層總數超過 20 降級為只留 critical',
  );
}
{
  // 不在場的親近 NPC：critical 每人最多 2 則
  const crit = Array.from({ length: 3 }, () => mem({ layer: 'npc', npcId: 'blaze', weight: 'critical' }));
  assert.equal(buildEntryPack(crit, scope).length, MEMORY_PARAMS.absentCriticalLimit);
}
{
  // 寫入：地點由前端補、去重、期限換算、超量淘汰
  const write: MemoryWriteScope = { region: 'greenhouse', scene: 'greenhouse', now: '2090-10-25 09:00', addDays: (d) => `+${d}`, id: 'new1' };
  let list: LayeredMemory[] = [];
  list = addMemory(list, { layer: 'region', text: ' 北側灑水器故障 ', weight: 'normal', expireDays: 3 }, write);
  assert.deepEqual(list[0], {
    id: 'new1', layer: 'region', content: '北側灑水器故障', weight: 'normal', enabled: true, author: 'gm',
    createdAt: '2090-10-25 09:00', location: 'greenhouse', expire: '+3',
  });
  assert.equal(addMemory(list, { layer: 'region', text: '北側灑水器故障！', weight: 'flavor' }, { ...write, id: 'dup' }), list, '同層同地點內容相同不重寫');
  assert.equal(addMemory(list, { layer: 'npc', text: '沒有對象', weight: 'normal' }, write), list, 'npc 層缺對象不寫');
  const kw = addMemory([], { layer: 'world', text: '補給船延誤', weight: 'critical', keywords: ['延誤', '延 誤', ''] }, write);
  assert.deepEqual(kw[0].keywords, ['延誤'], '關鍵字去重去空');
  assert.equal(kw[0].location, undefined, 'world 層不帶地點');

  const store = [
    mem({ weight: 'critical' }),
    mem({ weight: 'normal', author: 'player' }),
    mem({ weight: 'normal', usedAt: '2090-10-30 00:00' }),
    mem({ weight: 'normal' }),
    mem({ weight: 'flavor', usedAt: '2090-10-30 00:00' }),
  ];
  const kept = evictOverflow(store, 3).map((m) => m.id);
  assert.deepEqual(kept, [store[0].id, store[1].id, store[2].id], 'critical、玩家手寫豁免；flavor 先走，再走最久未觸發的');

  const touched = touchMemories(store, [store[3].id], '2090-10-31 08:00');
  assert.equal(touched[3].usedAt, '2090-10-31 08:00');
  assert.equal(touchMemories(store, [], 'x'), store, '沒有要標記的回傳原陣列');
}

console.log('memory.test.ts ok');
