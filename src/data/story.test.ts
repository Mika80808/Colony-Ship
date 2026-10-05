import assert from 'node:assert/strict';
import { NPCData, NpcSchedule, StoryLayer } from '../types';
import { EMPTY_OVERRIDES, EMPTY_RUN_STORY, INITIAL_NPCS, INITIAL_SECTORS, ROOMS } from './initialGameData';
import { fillMissingBuiltin, loadBuiltinStory, mergeStory, scheduleLocationIds, splitEntries, writeBuiltinStory } from './story';
import { slotHours, validateRoom, validateSchedules } from './storyValidation';

/**
 * 故事書拆層與人物表單校驗的測試。
 * 執行：npx tsx src/data/story.test.ts
 */

const builtin: StoryLayer = {
  npcs: [{ id: 'lucian', source: 'builtin', name: '路西恩', age: '', gender: '男', position: '', appearance: '', personality: '', background: '', other: '', roomId: 'A-1' }],
  items: [],
  chapters: [],
  sectors: [
    { id: 'residential_a', source: 'builtin', name: '居住區 A', code: 'SEC-A', description: '', connectedTo: [] },
    { id: 'lab', source: 'builtin', name: '研究室', code: 'SEC-01', description: '', connectedTo: [] },
  ],
};

// ---- 合併：預設值
{
  const merged = mergeStory(builtin, EMPTY_RUN_STORY, EMPTY_OVERRIDES);
  assert.equal(merged.npcs[0].affection, 0);
  assert.equal(merged.npcs[0].relationship, '陌生');
  assert.equal(merged.npcs[0].enabled, true);
  assert.equal(merged.sectors.find((s) => s.id === 'residential_a')?.isCurrent, true, '起始區域預設為目前所在');
  assert.equal(merged.sectors.find((s) => s.id === 'lab')?.isCurrent, false);
}

// ---- 合併：覆寫蓋過預設，本局條目接在內建之後
{
  const run: StoryLayer = {
    ...EMPTY_RUN_STORY,
    npcs: [
      { ...builtin.npcs[0], id: 'run-npcs-1', source: 'run', name: '新角色', roomId: undefined },
      { ...builtin.npcs[0], id: 'no-prefix', source: 'run', name: '沒有前綴' },
      { ...builtin.npcs[0], id: 'lucian', source: 'run', name: '撞 id' },
    ],
  };
  const merged = mergeStory(builtin, run, {
    ...EMPTY_OVERRIDES,
    npcs: { lucian: { affection: 12, enabled: false } },
  });
  assert.deepEqual(merged.npcs.map((n) => n.id), ['lucian', 'run-npcs-1'], '沒有前綴或撞內建 id 的本局條目要丟掉');
  assert.equal(merged.npcs[0].affection, 12);
  assert.equal(merged.npcs[0].relationship, '陌生', '沒覆寫的欄位用預設值');
  assert.equal(merged.npcs[0].enabled, false);
}

// ---- 拆回：依 source 分層，進度欄位不寫回內容
{
  const merged = mergeStory(builtin, EMPTY_RUN_STORY, { ...EMPTY_OVERRIDES, npcs: { lucian: { affection: 30 } } });
  const next: NPCData[] = [
    { ...merged.npcs[0], name: '路西恩（改）' },
    { ...merged.npcs[0], id: 'run-npcs-2', source: 'run' },
  ];
  const { builtin: b, run: r } = splitEntries('npcs', next);
  assert.equal(b.length, 1);
  assert.equal(r.length, 1);
  assert.equal(b[0].name, '路西恩（改）');
  for (const field of ['affection', 'relationship', 'location', 'enabled']) {
    assert.ok(!(field in b[0]), `${field} 不應寫回內建內容`);
  }
}

// ---- 日程校驗
const locations = new Set(['lab', 'residential_a']);
const base = (slots: NpcSchedule['slots']): NpcSchedule => ({ kind: 'base', slots });

assert.equal(slotHours({ start: 22, end: 6, locationId: 'lab', nature: 'sleep' }).length, 8, '跨午夜');
assert.equal(slotHours({ start: 5, end: 5, locationId: 'lab', nature: 'free' }).length, 24, '起訖相同為整天');

assert.deepEqual(
  validateSchedules([base([
    { start: 22, end: 8, locationId: 'residential_a', nature: 'sleep' },
    { start: 8, end: 22, locationId: 'lab', nature: 'duty' },
  ])], locations),
  {},
  '跨午夜剛好涵蓋 24 小時要通過'
);

assert.ok(validateSchedules([], locations).schedules, '沒有保底組');
assert.ok(validateSchedules([base([{ start: 0, end: 0, locationId: 'lab', nature: 'free' }]), base([{ start: 0, end: 0, locationId: 'lab', nature: 'free' }])], locations).schedules, '兩組保底');

{
  const errors = validateSchedules([base([
    { start: 0, end: 8, locationId: 'lab', nature: 'sleep' },
    { start: 10, end: 0, locationId: 'lab', nature: 'free' },
  ])], locations);
  assert.match(errors['schedule-0'], /8–10 時沒有安排/);
}
{
  const errors = validateSchedules([base([
    { start: 0, end: 12, locationId: 'lab', nature: 'sleep' },
    { start: 10, end: 0, locationId: 'lab', nature: 'free' },
  ])], locations);
  assert.match(errors['schedule-0'], /10–12 時重疊/);
}
{
  const errors = validateSchedules([base([{ start: 0, end: 0, locationId: 'somewhere', nature: 'free' }])], locations);
  assert.match(errors['schedule-0'], /地點不在內建地點清單/);
}
const fullDay = base([{ start: 0, end: 0, locationId: 'lab', nature: 'free' }]);
assert.deepEqual(
  validateSchedules([
    fullDay,
    { kind: 'duty', slots: [{ start: 8, end: 17, locationId: 'lab', nature: 'duty' }] },
    { kind: 'duty', slots: [{ start: 20, end: 2, locationId: 'lab', nature: 'duty' }] },
    { kind: 'event', slots: [{ start: 12, end: 13, locationId: 'lab', nature: 'meal' }] },
  ], locations),
  {},
  '非保底組可只涵蓋部分時段，同類型允許多組'
);
assert.match(
  validateSchedules([fullDay, { kind: 'duty', slots: [
    { start: 8, end: 12, locationId: 'lab', nature: 'duty' },
    { start: 11, end: 14, locationId: 'lab', nature: 'duty' },
  ] }], locations)['schedule-1'],
  /11 時重疊/,
  '非保底組組內仍不可重疊'
);
assert.match(
  validateSchedules([fullDay, { kind: 'duty', slots: [{ start: 8, end: 9, locationId: 'nowhere', nature: 'duty' }] }], locations)['schedule-1'],
  /地點不在內建地點清單/
);
{
  const affection = (threshold?: number): NpcSchedule => ({
    kind: 'affection', affectionThreshold: threshold, slots: [{ start: 20, end: 22, locationId: 'lab', nature: 'free' }],
  });
  assert.match(validateSchedules([fullDay, affection()], locations)['schedule-1'], /好感門檻/, '好感門檻必填');
  assert.match(validateSchedules([fullDay, affection(2.5)], locations)['schedule-1'], /好感門檻/, '好感門檻須為整數');
  assert.deepEqual(validateSchedules([fullDay, affection(30)], locations), {});
}

// ---- 暫定種子日程本身必須通過校驗（房號可當地點）
{
  const ids = scheduleLocationIds(INITIAL_SECTORS, ROOMS);
  for (const npc of INITIAL_NPCS) {
    assert.deepEqual(validateSchedules(npc.schedules ?? [], ids), {}, `${npc.name} 的種子日程應通過校驗`);
  }
}

// ---- 內建內容：種子遷移只補空欄位、補上缺少的條目
{
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  const lucian = INITIAL_NPCS.find((n) => n.id === 'lucian')!;
  const blaze = INITIAL_NPCS.find((n) => n.id === 'blaze')!;
  // v1（沒有 seedVersion）：路西恩沒有日程與職位；布雷茲已在 UI 改過日程；刪掉了一個地點。
  const customSchedule: NpcSchedule[] = [base([{ start: 0, end: 0, locationId: 'park', nature: 'free' }])];
  memory.set('starport_builtin_story', JSON.stringify({
    npcs: [
      { ...lucian, position: '', schedules: undefined },
      { ...blaze, schedules: customSchedule },
    ],
    items: [], chapters: [],
    sectors: INITIAL_SECTORS.filter((sector) => sector.id !== 'lab'),
  }));
  const loaded = loadBuiltinStory();
  const l = loaded.npcs.find((n) => n.id === 'lucian')!;
  const b = loaded.npcs.find((n) => n.id === 'blaze')!;
  assert.deepEqual(l.schedules, lucian.schedules, '遷移補上空的日程');
  assert.equal(l.position, '物流組', '遷移補上空的職位');
  assert.deepEqual(b.schedules, customSchedule, '遷移不覆蓋已經改過的日程');

  writeBuiltinStory(loaded);
  assert.equal(JSON.parse(memory.get('starport_builtin_story')!).seedVersion, 6);
  assert.deepEqual(loaded.npcs.map((n) => n.id), ['lucian', 'blaze', 'aiden', 'ethan', 'luca'], 'v6 遷移補上艾登、伊森、路卡');
  assert.equal(b.roomId, 'A-2', 'v3 遷移讓布雷茲住進 A-2');
  assert.deepEqual(loadBuiltinStory().npcs.find((n) => n.id === 'blaze')!.schedules, customSchedule, '已是最新版本時不再遷移');

  const { next, added } = fillMissingBuiltin(loaded);
  assert.equal(added, 1, '只補上缺少的研究室');
  assert.ok(next.sectors.some((sector) => sector.id === 'lab'));
  assert.deepEqual(next.npcs, loaded.npcs, '既有條目不動');
  assert.equal(fillMissingBuiltin(next).added, 0);
}

// ---- 房號校驗
{
  const npcs = mergeStory(builtin, EMPTY_RUN_STORY, EMPTY_OVERRIDES).npcs;
  assert.deepEqual(validateRoom('', null, npcs, ROOMS), {});
  assert.deepEqual(validateRoom('A-1', 'lucian', npcs, ROOMS), {}, '自己原本的房號不算重複');
  assert.match(validateRoom('A-1', null, npcs, ROOMS).roomId, /已由「路西恩」使用/);
  assert.match(validateRoom('Z-9', null, npcs, ROOMS).roomId, /不在房號清單/);
  assert.equal(ROOMS.length, 24, '四個居住區各六間');
  assert.deepEqual(ROOMS.filter((r) => r.sectorId === 'residential_c').map((r) => r.id), ['C-1', 'C-2', 'C-3', 'C-4', 'C-5', 'C-6']);
}

// ---- 種子 v2 → v3：布雷茲住進 A-2，睡眠地點跟著換；改過的內容不動
{
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  const lucian = INITIAL_NPCS.find((n) => n.id === 'lucian')!;
  const blaze = INITIAL_NPCS.find((n) => n.id === 'blaze')!;
  const v2Schedule: NpcSchedule[] = [base([
    { start: 0, end: 8, locationId: 'residential_a', nature: 'sleep' },
    { start: 8, end: 17, locationId: 'bridge', nature: 'duty' },
    { start: 17, end: 0, locationId: 'park', nature: 'free' },
  ])];
  const store = (npcs: unknown[]) => memory.set('starport_builtin_story', JSON.stringify({ seedVersion: 2, npcs, items: [], chapters: [], sectors: INITIAL_SECTORS }));

  store([lucian, { ...blaze, roomId: undefined, schedules: v2Schedule }]);
  let b = loadBuiltinStory().npcs.find((n) => n.id === 'blaze')!;
  assert.equal(b.roomId, 'A-2');
  assert.deepEqual(b.schedules, blaze.schedules, 'v2 原樣的日程換成睡在 A-2');
  assert.equal(b.schedules![0].slots[0].locationId, 'A-2');

  const custom: NpcSchedule[] = [base([{ start: 0, end: 0, locationId: 'park', nature: 'free' }])];
  store([{ ...lucian, roomId: 'A-2' }, { ...blaze, roomId: undefined, schedules: custom }]);
  b = loadBuiltinStory().npcs.find((n) => n.id === 'blaze')!;
  assert.equal(b.roomId, undefined, 'A-2 已有人住就不補房號');
  assert.deepEqual(b.schedules, custom, '改過的日程不動');
}

// ---- 種子 v3 → v4：清掉以前代填的佔位字，手寫內容不動
{
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  const lucian = INITIAL_NPCS.find((n) => n.id === 'lucian')!;
  memory.set('starport_builtin_story', JSON.stringify({
    seedVersion: 3,
    npcs: [{ ...lucian, age: '未知', personality: '無', other: '無所畏懼' }],
    items: [{ id: 'item-1', source: 'builtin', name: '咖啡', category: '消耗品', effectText: '+0', description: '尚無描述。' }],
    chapters: [{ id: 'ev-1', source: 'builtin', title: '登艦', summary: '尚無摘要。', fullText: '第一天。' }],
    sectors: INITIAL_SECTORS,
  }));
  const loaded = loadBuiltinStory();
  const l = loaded.npcs[0];
  assert.equal(l.age, '');
  assert.equal(l.personality, '');
  assert.equal(l.other, '無所畏懼', '手寫內容只是剛好以「無」開頭，不動');
  assert.deepEqual([loaded.items[0].effectText, loaded.items[0].description], ['', '']);
  assert.deepEqual([loaded.chapters[0].summary, loaded.chapters[0].fullText], ['', '第一天。']);
}

// ---- 種子 v4 → v5：工程部的舊描述換成維修與研發工坊，改過的描述不動
{
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  const oldText = '反物質引擎、能源管道與重力維持系統的主要工程檢修中樞。';
  const store = (description: string) => memory.set('starport_builtin_story', JSON.stringify({
    seedVersion: 4, npcs: [], items: [], chapters: [],
    sectors: INITIAL_SECTORS.map((sector) => (sector.id === 'engineering' ? { ...sector, description } : sector)),
  }));
  const engineering = () => loadBuiltinStory().sectors.find((sector) => sector.id === 'engineering')!.description;
  store(oldText);
  assert.equal(engineering(), INITIAL_SECTORS.find((sector) => sector.id === 'engineering')!.description);
  assert.doesNotMatch(engineering(), /引擎|重力/);
  store('我自己寫的工程部。');
  assert.equal(engineering(), '我自己寫的工程部。', '改過的描述不動');
}

// ---- 種子 v5 → v6：補上艾登、伊森、路卡；已有的不重複，房號被佔走就不給房號
{
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
  const lucian = INITIAL_NPCS.find((n) => n.id === 'lucian')!;
  const ethan = INITIAL_NPCS.find((n) => n.id === 'ethan')!;
  memory.set('starport_builtin_story', JSON.stringify({
    seedVersion: 5, items: [], chapters: [], sectors: INITIAL_SECTORS,
    npcs: [{ ...lucian, roomId: 'A-3' }, { ...ethan, name: '我改過的伊森' }],
  }));
  const npcs = loadBuiltinStory().npcs;
  assert.deepEqual(npcs.map((n) => n.id), ['lucian', 'ethan', 'aiden', 'luca']);
  assert.equal(npcs.find((n) => n.id === 'ethan')!.name, '我改過的伊森', '已有的條目不動');
  const aiden = npcs.find((n) => n.id === 'aiden')!;
  assert.equal(aiden.roomId, undefined, 'A-3 已有人住就不給房號');
  assert.equal(aiden.schedules![0].slots[0].locationId, 'residential_a', '睡眠時段改到 A 區走廊');
  assert.equal(npcs.find((n) => n.id === 'luca')!.roomId, 'A-5');
}

// ---- 房號校驗把玩家算進去
{
  const npcs = mergeStory(builtin, EMPTY_RUN_STORY, EMPTY_OVERRIDES).npcs;
  assert.match(validateRoom('B-3', null, npcs, ROOMS, 'B-3').roomId, /玩家的房間/);
  assert.deepEqual(validateRoom('B-3', null, npcs, ROOMS, ''), {}, '玩家還沒分到房間');
  assert.deepEqual(validateRoom('B-3', null, npcs, ROOMS), {}, '舊存檔沒有玩家房號');
}

console.log('story.test.ts: all passed');
