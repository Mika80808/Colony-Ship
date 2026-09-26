import assert from 'node:assert/strict';
import { normalizeSegments, normalizeCommands } from './index';
import { GmContext } from './types';

/**
 * 指令收斂層的測試。
 *
 * 這一層是 GM 接線裡最容易出事的地方：模型會憑空捏造 id，
 * 而捏造出來的指令套用後是靜默失效的 —— 玩家看到 GM 說扣了道具，
 * 背包卻沒動，且完全查不出原因。所以這裡逐條驗證「不存在的 id 一律丟棄」。
 */

const context: GmContext = {
  playerInput: '測試',
  profile: { name: '測試員', gender: '', age: '', appearance: '', personality: '', other: '', profession: '' },
  stats: { stamina: 50, maxStamina: 100, hunger: 30, maxHunger: 100, credits: 100, conditions: [] },
  quests: [{ id: 'q_real', category: '主要', title: '真任務', status: '進行中', description: '' }],
  items: [{ id: 'i_real', name: '真道具', category: '消耗品', effectText: '', description: '', count: 2 }],
  presentNpcs: [{
    id: 'npc_real', source: 'builtin', enabled: true, name: '真角色', age: '', gender: '', position: '', appearance: '',
    personality: '', background: '', other: '', affection: 0, relationship: '尚未建立',
    routine: '08:00 工程部值班\n20:00 回房間',
  }],
  locationName: '測試區',
  gameDate: '2154-10-24',
  gameTime: '08:45',
  dialogueHistory: [],
  objectives: [
    { id: 'obj_open', text: '還沒完成的目標' },
    { id: 'obj_done', text: '已經完成的目標', done: true },
  ],
  summary: '目前的摘要。',
};

// --- segments ---

assert.deepEqual(
  normalizeSegments([{ kind: 'description', text: '  牆上的燈閃了一下。  ' }]),
  [{ kind: 'description', text: '牆上的燈閃了一下。' }],
  'description 應保留並去除前後空白'
);

assert.deepEqual(
  normalizeSegments([{ kind: 'dialogue', speaker: '真角色', expression: 'happy', text: '「你好。」' }]),
  [{ kind: 'dialogue', text: '「你好。」', speaker: '真角色', expression: 'happy' }],
  'dialogue 應保留 speaker 與 expression'
);

assert.equal(
  normalizeSegments([{ kind: 'dialogue', text: '無效表情', expression: 'smug' }])[0].expression,
  undefined,
  '不在列舉中的 expression 應被丟棄'
);

assert.equal(normalizeSegments([{ kind: 'description', text: '   ' }]).length, 0, '空白內容應丟棄');
assert.equal(normalizeSegments('不是陣列').length, 0, '非陣列應回傳空陣列');
assert.equal(normalizeSegments(null).length, 0, 'null 應回傳空陣列');

// --- commands：捏造的 id 一律丟棄 ---

assert.equal(
  normalizeCommands([{ type: 'consume_item', itemId: 'i_fake', count: 1 }], context).length,
  0,
  '不存在的 itemId 應被丟棄'
);
assert.equal(
  normalizeCommands([{ type: 'set_quest_status', questId: 'q_fake', status: '已完成' }], context).length,
  0,
  '不存在的 questId 應被丟棄'
);
assert.equal(
  normalizeCommands([{ type: 'adjust_affection', npcId: 'npc_fake', amount: 5 }], context).length,
  0,
  '不在場的 npcId 應被丟棄'
);
assert.equal(
  normalizeCommands([{ type: 'grant_item', itemId: 'whatever' }], context).length,
  0,
  '不支援的指令型別應被丟棄'
);

// --- commands：合法指令應通過 ---

assert.deepEqual(
  normalizeCommands([{ type: 'consume_item', itemId: 'i_real' }], context),
  [{ type: 'consume_item', itemId: 'i_real', count: 1 }],
  'count 未給時應預設為 1'
);
assert.deepEqual(
  normalizeCommands([{ type: 'set_quest_status', questId: 'q_real', status: '已完成' }], context),
  [{ type: 'set_quest_status', questId: 'q_real', status: '已完成' }],
  '合法任務指令應通過'
);
assert.equal(
  normalizeCommands([{ type: 'set_quest_status', questId: 'q_real', status: '不存在的狀態' }], context).length,
  0,
  '非列舉內的任務狀態應被丟棄'
);

// --- commands：數值夾限，擋住模型給出的離譜數字 ---

assert.deepEqual(
  normalizeCommands([{ type: 'adjust_stats', credits: 999999 }], context),
  [{ type: 'adjust_stats', credits: 10000 }],
  '過大的星幣變動應被夾限'
);
assert.deepEqual(
  normalizeCommands([{ type: 'adjust_stats', stamina: -500 }], context),
  [{ type: 'adjust_stats', stamina: -100 }],
  '過小的體力變動應被夾限'
);
assert.deepEqual(
  normalizeCommands([{ type: 'adjust_affection', npcId: 'npc_real', amount: 9999 }], context),
  [{ type: 'adjust_affection', npcId: 'npc_real', amount: 50 }],
  '過大的好感變動應被夾限'
);
assert.equal(
  normalizeCommands([{ type: 'adjust_stats' }], context).length,
  0,
  '沒有任何有效欄位的 adjust_stats 應被丟棄'
);
assert.deepEqual(
  normalizeCommands([{ type: 'adjust_stats', addCondition: '  疲勞  ' }], context),
  [{ type: 'adjust_stats', addCondition: '疲勞' }],
  '狀態字串應去除前後空白'
);

// --- commands：側欄的摘要與目標 ---

assert.deepEqual(
  normalizeCommands([{ type: 'set_summary', text: '  剛抵達 A-1。  ' }], context),
  [{ type: 'set_summary', text: '剛抵達 A-1。' }],
  '摘要應去除前後空白'
);
assert.equal(
  normalizeCommands([{ type: 'set_summary', text: '   ' }], context).length,
  0,
  '空白摘要應被丟棄'
);
assert.equal(
  (normalizeCommands([{ type: 'set_summary', text: '字'.repeat(500) }], context)[0] as { text: string }).text.length,
  200,
  '過長的摘要應被截斷，側欄版面是固定的'
);
assert.deepEqual(
  normalizeCommands([{ type: 'add_objective', text: '找布雷茲', location: '物資站' }], context),
  [{ type: 'add_objective', text: '找布雷茲', location: '物資站' }],
  '合法的新目標應通過'
);
assert.deepEqual(
  normalizeCommands([{ type: 'add_objective', text: '沒有地點' }], context),
  [{ type: 'add_objective', text: '沒有地點' }],
  'location 選填，未給時不應出現在指令裡'
);
assert.deepEqual(
  normalizeCommands([{ type: 'complete_objective', objectiveId: 'obj_open' }], context),
  [{ type: 'complete_objective', objectiveId: 'obj_open' }],
  '結束進行中的目標應通過'
);
assert.equal(
  normalizeCommands([{ type: 'complete_objective', objectiveId: 'obj_fake' }], context).length,
  0,
  '不存在的 objectiveId 應被丟棄'
);
assert.equal(
  normalizeCommands([{ type: 'complete_objective', objectiveId: 'obj_done' }], context).length,
  0,
  '已完成的目標不應被重複結案'
);

console.log('gm/normalize: 全部通過');

// --- extractJsonObject：實測 DeepSeek 會回 HTTP 200 但內容全是空白 ---
const { extractJsonObject, buildHistoryTurns } = await import('./prompt');
assert.equal(extractJsonObject(' '.repeat(170)), null, '全空白視為沒有內容，而非「不是合法 JSON」');
assert.equal(extractJsonObject(''), null);
assert.equal(extractJsonObject(undefined), null);
assert.deepEqual(extractJsonObject('```json\n{"segments":[],"commands":[]}\n```'), { segments: [], commands: [] }, '容忍 json 圍欄');
assert.deepEqual(extractJsonObject('好的，以下是回應：{"a":1}'), { a: 1 }, '容忍前綴文字');
assert.throws(() => extractJsonObject('這不是 json'), SyntaxError);

// 局勢區塊：日常活動與時間要一起送出，只給其中一個 GM 沒辦法用
const { buildContextBlock } = await import('./prompt');
const block = buildContextBlock(context);
assert.ok(block.includes('2154-10-24 08:45'), '局勢要帶上目前時間');
assert.ok(block.includes('日常活動'), '在場 NPC 的日常活動要送進局勢');
assert.ok(block.includes('08:00 工程部值班'), '作息的每一行都要保留');
assert.ok(block.includes('20:00 回房間'), '多行作息不能只送第一行');
assert.ok(
  !buildContextBlock({ ...context, presentNpcs: [{ ...context.presentNpcs[0], routine: '無' }] }).includes('日常活動'),
  '沒填作息時（表單存成「無」）不應佔用 prompt 篇幅'
);

// 歷史回合必須是與輸出要求相同的 JSON，不能攤成散文
const turns = buildHistoryTurns({
  ...context,
  dialogueHistory: [{ playerInput: '你好', segments: [{ kind: 'dialogue', speaker: '真角色', text: '「嗨。」' }] }],
});
assert.deepEqual(JSON.parse(turns[0].gm), {
  segments: [{ kind: 'dialogue', speaker: '真角色', text: '「嗨。」' }],
  commands: [],
}, 'GM 歷史回應以 JSON 回填');

console.log('gm/prompt: 全部通過');
