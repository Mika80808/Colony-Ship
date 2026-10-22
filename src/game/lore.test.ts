import assert from 'node:assert/strict';
import type { MergedStory, NPCData } from '../types';
import { LORE_PARAMS, placeLore, scanLore } from './lore';

const sector = (id: string, name: string, description: string, connectedTo: string[] = [], enabled = true) => ({
  id, name, description, connectedTo, enabled, source: 'builtin' as const, code: '', isCurrent: false, status: '正常' as const,
});
const npc = (id: string, name: string, extra: Partial<NPCData> = {}): NPCData => ({
  id, name, source: 'builtin', enabled: true, age: '', gender: '', position: '', appearance: '', personality: '',
  background: '', other: '', affection: 0, relationship: '陌生', ...extra,
});

const story: MergedStory = {
  sectors: [
    sector('residential_a', '居住區 A', '東北側宿舍。', ['lab', 'greenhouse', 'medical']),
    sector('lab', '研究室', '研究與檢驗室。'),
    sector('greenhouse', '溫室', '外環的農業區。'),
    sector('medical', '醫療室', '看診與藥品。', [], false),
    sector('bridge', '艦橋', '指揮中樞。'),
  ],
  npcs: [
    npc('lucian', '路西恩', { position: '物流組', appearance: '銀髮' }),
    npc('blaze', '布雷茲', { position: '艦橋值勤' }),
    npc('ghost', '停用者', { enabled: false }),
  ],
  items: [
    { id: 'coffee', source: 'builtin', enabled: true, name: '濃縮咖啡', category: '消耗品', effectText: '', description: '提神用。' },
    { id: 'blank', source: 'builtin', enabled: true, name: '空白物', category: '消耗品', effectText: '', description: '' },
  ],
  chapters: [
    { id: 'ev1', source: 'builtin', enabled: true, title: '大停電', summary: '上個月全站停電一小時。', fullText: '' },
    { id: 'ev2', source: 'builtin', enabled: true, unlocked: false, title: '祕密計畫', summary: '還沒解鎖。', fullText: '' },
  ],
  lore: [
    { id: 'lore-ship', source: 'builtin', enabled: true, title: '補給船', content: '每 7 日到港一次。', keywords: ['船期', '包裹'] },
    { id: 'lore-off', source: 'builtin', enabled: false, title: '月球城市', content: '故鄉。', keywords: ['月球'] },
  ],
};

// --- 地點類強制注入：所在＋相鄰（停用的不帶）---
assert.deepEqual(placeLore(story, 'residential_a'), [
  '居住區 A（所在地）：東北側宿舍。',
  '研究室（相鄰）：研究與檢驗室。',
  '溫室（相鄰）：外環的農業區。',
]);
assert.deepEqual(placeLore(story, 'nowhere'), [], '不認得的地點');

// --- 關鍵字掃描與類別規則 ---
const scan = (input: string) => scanLore(story, input, ['blaze'], ['residential_a', 'lab', 'greenhouse']);
assert.deepEqual(scan('我的包裹什麼時候到？'), ['【設定】補給船：每 7 日到港一次。'], '設定：命中關鍵字');
assert.deepEqual(scan('補給船來了嗎'), ['【設定】補給船：每 7 日到港一次。'], '設定：標題也算關鍵字');
assert.deepEqual(scan('想念月球'), [], '停用的設定不帶');
assert.deepEqual(scan('路西恩今天在哪'), ['【人物・不在場】路西恩：物流組；外貌：銀髮'], '不在場的人被提到才帶簡介');
assert.deepEqual(scan('布雷茲你好'), [], '在場的人設已在局勢裡，不重複');
assert.deepEqual(scan('停用者呢'), [], '停用的人物不帶');
assert.deepEqual(scan('來杯濃縮咖啡'), ['【物品】濃縮咖啡：提神用。'], '物品被提到才帶');
assert.deepEqual(scan('空白物'), [], '沒有描述的物品不帶');
assert.deepEqual(scan('上次大停電好可怕'), ['【事件】大停電：上個月全站停電一小時。'], '已解鎖的事件');
assert.deepEqual(scan('祕密計畫是什麼'), [], '未解鎖的事件不帶');
assert.deepEqual(scan('去艦橋看看'), ['【地點】艦橋：指揮中樞。'], '其他地點被提到才帶');
assert.deepEqual(scan('溫室的番茄'), [], '已在第四層的地點不重複');
assert.deepEqual(scan('醫療室'), [], '停用的地點不帶');
assert.deepEqual(scan('今天天氣不錯'), [], '沒提到就不帶');
assert.equal(
  scan('路西恩、濃縮咖啡、大停電、艦橋、補給船').length,
  LORE_PARAMS.hitLimit,
  '每回合有上限',
);

console.log('lore.test.ts ok');
