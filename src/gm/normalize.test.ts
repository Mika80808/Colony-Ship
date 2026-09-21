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
    id: 'npc_real', name: '真角色', age: '', gender: '', position: '', appearance: '',
    personality: '', background: '', other: '', affection: 0, relationship: '尚未建立',
  }],
  locationName: '測試區',
  dialogueHistory: [],
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

console.log('gm/normalize: 全部通過');
