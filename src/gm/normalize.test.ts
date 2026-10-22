import assert from 'node:assert/strict';
import { normalizeSegments, normalizeCommands } from './index';
import { buildRecallBlock } from './prompt';
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
  gameDate: '2090-10-24',
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
assert.ok(block.includes('2090-10-24 08:45'), '局勢要帶上目前時間');
assert.ok(block.includes('日常活動'), '在場 NPC 的日常活動要送進局勢');
assert.ok(block.includes('08:00 工程部值班'), '作息的每一行都要保留');
assert.ok(block.includes('20:00 回房間'), '多行作息不能只送第一行');
assert.ok(
  !buildContextBlock({ ...context, presentNpcs: [{ ...context.presentNpcs[0], routine: '無' }] }).includes('日常活動'),
  '沒填作息時（表單存成「無」）不應佔用 prompt 篇幅'
);

// 設施終端：內容要送出，並註明角色得先去查；沒有終端的場景不佔篇幅
const withTerminal = buildContextBlock({ ...context, terminals: [{ name: '溫室窗前工作站', lines: ['萵苣（左翼第 1 排）：生長中，約 3 天後可採收'] }] });
assert.ok(withTerminal.includes('### 溫室窗前工作站') && withTerminal.includes('- 萵苣（左翼第 1 排）'), '終端內容送進局勢');
assert.ok(withTerminal.includes('先走到終端前查看'), '註明要先查看才知道');
assert.ok(!block.includes('設施終端'), '沒有終端時不出現這段');

// 歷史回合必須是與輸出要求相同的 JSON，不能攤成散文
const turns = buildHistoryTurns({
  ...context,
  dialogueHistory: [{ playerInput: '你好', segments: [{ kind: 'dialogue', speaker: '真角色', text: '「嗨。」' }] }],
});
assert.deepEqual(JSON.parse(turns[0].gm), {
  segments: [{ kind: 'dialogue', speaker: '真角色', text: '「嗨。」' }],
  commands: [],
}, 'GM 歷史回應以 JSON 回填');

// advance_time：分鐘數取整、夾在 1–720；0、負數、非數字直接丟掉（缺了就缺，不代為補寫）。
assert.deepEqual(
  normalizeCommands([
    { type: 'advance_time', minutes: 15.4 }, { type: 'advance_time', minutes: 99999 },
    { type: 'advance_time', minutes: -30 }, { type: 'advance_time', minutes: 0 }, { type: 'advance_time', minutes: '很久' },
  ], context),
  [{ type: 'advance_time', minutes: 15 }, { type: 'advance_time', minutes: 720 }, { type: 'advance_time', minutes: 1 }],
  'advance_time 收斂',
);

// --- add_memory（通道 ① 寫入）---

assert.deepEqual(
  normalizeCommands([{ type: 'add_memory', layer: 'region', text: ' 溫室北側灑水器故障 ', weight: 'normal', expireDays: 3, keywords: ['灑水器', '真角色', '測試區', ''] }], context),
  [{ type: 'add_memory', layer: 'region', text: '溫室北側灑水器故障', weight: 'normal', keywords: ['灑水器'], expireDays: 3 }],
  'add_memory：去空白、剔掉人名地名關鍵字、期限保留',
);
assert.equal(
  normalizeCommands([{ type: 'add_memory', layer: 'npc_diary', text: '想寫進 NPC 日記', weight: 'normal' }], context).length,
  0,
  '指向通道 ① 四層以外的一律丟棄',
);
assert.equal(
  normalizeCommands([{ type: 'add_memory', layer: 'npc', npcId: 'npc_fake', text: '捏造的角色', weight: 'normal' }], context).length,
  0,
  'npc 層的對象必須是在場 NPC',
);
assert.deepEqual(
  normalizeCommands([{ type: 'add_memory', layer: 'npc', npcId: 'npc_real', text: '答應幫忙修工具', weight: 'bogus' }], context),
  [{ type: 'add_memory', layer: 'npc', text: '答應幫忙修工具', weight: 'normal', npcId: 'npc_real' }],
  '權重不認得就當 normal',
);
assert.equal(
  normalizeCommands(Array.from({ length: 5 }, (_, i) => ({ type: 'add_memory', layer: 'world', text: `第${i}件事`, weight: 'flavor' })), context).length,
  3,
  '一次回應最多寫 3 則',
);
assert.equal(normalizeCommands([{ type: 'add_memory', layer: 'world', text: '  ', weight: 'normal' }], context).length, 0, '沒有內容不寫');

// --- npc_thought（通道 ② thought）---

assert.deepEqual(
  normalizeCommands([
    { type: 'npc_thought', npcId: 'npc_real', text: '第一版' },
    { type: 'npc_thought', npcId: 'npc_fake', text: '不在場的人' },
    { type: 'npc_thought', npcId: 'npc_real', text: ' 他好像有心事 ' },
    { type: 'npc_thought', npcId: 'npc_real', text: '' },
  ], context),
  [{ type: 'npc_thought', npcId: 'npc_real', text: '他好像有心事' }],
  'npc_thought：只認在場 NPC、同一人只留最後一則、空的丟掉',
);

// --- 短期上下文只保留 npc_thought ---
{
  const [turn] = buildHistoryTurns({
    ...context,
    dialogueHistory: [{
      playerInput: '你好',
      segments: [{ kind: 'dialogue', speaker: '真角色', text: '「嗨。」' }],
      thoughts: [{ npcId: 'npc_real', text: '新面孔' }],
    }],
  });
  assert.deepEqual(JSON.parse(turn.gm).commands, [{ type: 'npc_thought', npcId: 'npc_real', text: '新面孔' }], '歷史回填 thought');
}

// --- 記憶排位 ---
{
  const memory = {
    world: ['補給船延誤兩天'], npcMemories: { npc_real: ['答應幫忙修工具'] }, npcThoughts: { npc_real: ['[10-24 09:00｜A 走廊] 新面孔'] },
    absentNpcMemories: { 路西恩: ['【重要】跟玩家吵過架'] }, place: ['（A 走廊）燈壞了'],
    placeLore: ['居住區 A（所在地）：東北側宿舍'], recalledLore: ['【設定】補給船：每 7 日到港'],
    diaries: [{ id: 'd1', date: '2090-10-24', title: '登艦', content: '今天登艦。' }],
    npcLogs: [{ npcId: 'npc_real', title: '[10/23 觀察日誌]', content: '[10:00｜溫室] 一起搬貨。' }],
    recalledMemories: ['（全站）【重要】停電過一次'], recalledDiaries: [], recalledNpcLogs: [],
  };
  const block = buildContextBlock({ ...context, memory });
  for (const text of ['補給船延誤兩天', '答應幫忙修工具', '新面孔', '路西恩：【重要】跟玩家吵過架', '（A 走廊）燈壞了', '今天登艦。', '一起搬貨。', '東北側宿舍']) {
    assert.ok(block.includes(text), `局勢要帶到：${text}`);
  }
  assert.ok(block.indexOf('補給船延誤兩天') < block.indexOf('## 時間'), '世界記憶在最前面');
  assert.ok(!block.includes('停電過一次'), '關鍵字追加不放在局勢裡');
  assert.ok(buildRecallBlock({ ...context, memory }).includes('停電過一次'), '關鍵字追加緊貼玩家輸入');
  assert.ok(buildRecallBlock({ ...context, memory }).includes('每 7 日到港'), '設定集命中也放在尾端');
  assert.ok(!block.includes('每 7 日到港'));
  assert.equal(buildRecallBlock(context), '', '沒有記憶時不出現任何標題');
  assert.ok(!buildContextBlock(context).includes('記憶'), '沒有記憶時局勢不出現記憶段落');
}

console.log('gm/prompt: 全部通過');
