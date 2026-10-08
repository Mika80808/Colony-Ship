import assert from 'node:assert/strict';
import { NPCData, NpcSchedule } from '../types';
import { addMinutes, crossesCheckpoint, locateNpc, planRelocation, sceneOf, slotCovers } from './npcSchedule';

/**
 * 日程查表、檢查點與位置重算的測試。
 * 執行：npx tsx src/data/npcSchedule.test.ts
 */

const base: NpcSchedule = { kind: 'base', slots: [
  { start: 0, end: 8, locationId: 'A-1', nature: 'sleep' },
  { start: 8, end: 0, locationId: 'park', nature: 'free' },
] };

// ---- 時段
assert.ok(slotCovers({ start: 22, end: 6, locationId: 'x', nature: 'sleep' }, 23), '跨午夜：晚上');
assert.ok(slotCovers({ start: 22, end: 6, locationId: 'x', nature: 'sleep' }, 3), '跨午夜：凌晨');
assert.ok(!slotCovers({ start: 22, end: 6, locationId: 'x', nature: 'sleep' }, 6), '結束時刻不含');
assert.ok(slotCovers({ start: 5, end: 5, locationId: 'x', nature: 'free' }, 17), '起訖相同為整天');

// ---- 查表：保底
assert.equal(locateNpc([base], 3, 0), 'A-1');
assert.equal(locateNpc([base], 8, 0), 'park');
assert.equal(locateNpc(undefined, 8, 0), null, '沒有日程');
assert.equal(locateNpc([], 8, 0), null);

// ---- 查表：值勤蓋過保底，沒涵蓋的時段落回保底
const duty: NpcSchedule = { kind: 'duty', slots: [{ start: 9, end: 17, locationId: 'bridge', nature: 'duty' }] };
assert.equal(locateNpc([base, duty], 10, 0), 'bridge');
assert.equal(locateNpc([base, duty], 18, 0), 'park', '值勤沒安排就落到保底');

// ---- 查表：好感解鎖
const aff = (threshold: number, locationId: string): NpcSchedule => ({
  kind: 'affection', affectionThreshold: threshold, slots: [{ start: 20, end: 22, locationId, nature: 'free' }],
});
assert.equal(locateNpc([base, aff(30, 'A-1')], 20, 10), 'park', '好感不足不生效');
assert.equal(locateNpc([base, aff(30, 'A-1')], 20, 30), 'A-1', '達到門檻生效');
assert.equal(locateNpc([base, duty, aff(30, 'A-1'), aff(60, 'lab')], 20, 80), 'lab', '多組生效取門檻最高');
assert.equal(locateNpc([base, aff(60, 'lab'), { ...aff(30, 'A-1'), slots: [{ start: 22, end: 23, locationId: 'A-1', nature: 'free' }] }], 22, 80), 'A-1',
  '最高那組這小時沒安排，看下一組');
assert.equal(locateNpc([base, { kind: 'duty', slots: [{ start: 20, end: 22, locationId: 'bridge', nature: 'duty' }] }, aff(30, 'A-1')], 21, 50), 'A-1',
  '好感解鎖優先於值勤');

// ---- 查表：特殊事件一律不生效
assert.equal(locateNpc([base, { kind: 'event', slots: [{ start: 0, end: 0, locationId: 'medical', nature: 'free' }] }], 10, 999), 'park');

// ---- 時鐘
assert.deepEqual(addMinutes('2090-10-24', '23:50', 20), { date: '2090-10-25', time: '00:10' }, '跨日');
assert.deepEqual(addMinutes('2090-12-31', '23:00', 90), { date: '2091-01-01', time: '00:30' }, '跨年');

// ---- 檢查點：區間判定，不是等值
const at = (time: string, date = '2090-10-24') => ({ date, time });
assert.ok(crossesCheckpoint(at('08:50'), at('09:10')), '跨過 09:00');
assert.ok(crossesCheckpoint(at('08:50'), at('09:00')), '剛好推進到 09:00 算跨過');
assert.ok(!crossesCheckpoint(at('09:00'), at('09:30')), '從 09:00 出發不算再跨一次');
assert.ok(!crossesCheckpoint(at('09:10'), at('17:59')), '兩個檢查點之間');
assert.ok(crossesCheckpoint(at('17:00'), at('22:00')), '一次跨過多個');
assert.ok(crossesCheckpoint(at('23:30'), at('01:30', '2090-10-25')), '跨午夜跨過 01:00');
assert.ok(!crossesCheckpoint(at('21:30'), at('00:30', '2090-10-25')), '跨午夜但沒到 01:00');
assert.ok(crossesCheckpoint(at('10:00'), at('10:00', '2090-10-26')), '推進一整天以上一定跨過');
assert.ok(!crossesCheckpoint(at('10:00'), at('10:00')), '沒推進');

// ---- 重算
const npc = (id: string, location: string | undefined, schedules: NpcSchedule[], affection = 0) =>
  ({ id, name: id, location, schedules, affection, relationship: '', enabled: true, source: 'builtin' } as unknown as NPCData);
{
  const npcs = [
    npc('stay', 'park', [base]),                       // 08 點仍在 park，不動
    npc('leaving', 'A-1', [base]),                      // A-1 → park
    npc('arriving', 'bridge', [{ kind: 'base', slots: [{ start: 0, end: 0, locationId: 'A-1', nature: 'free' }] }]), // bridge → A-1
    npc('elsewhere', 'lab', [{ kind: 'base', slots: [{ start: 0, end: 0, locationId: 'medical', nature: 'free' }] }]), // lab → medical
    npc('unscheduled', 'lab', []),
  ];
  const all = planRelocation(npcs, 8, null);
  assert.deepEqual(all.apply, { leaving: 'park', arriving: 'A-1', elsewhere: 'medical' }, '場景切換時全部套用');
  assert.deepEqual(all.deferred, []);

  const checkpoint = planRelocation(npcs, 8, 'A-1');
  assert.deepEqual(checkpoint.apply, { elsewhere: 'medical' }, '與玩家場景無關的直接套用');
  assert.deepEqual(checkpoint.deferred.sort(), ['arriving', 'leaving'], '離開或進入玩家場景的先壓著');
}

assert.equal(sceneOf('residential_a', null), 'residential_a', '居住區沒進房間是走廊');
assert.equal(sceneOf('residential_a', 'A-3'), 'A-3');
assert.equal(sceneOf('park', null), 'park');

console.log('npcSchedule.test.ts: all passed');
