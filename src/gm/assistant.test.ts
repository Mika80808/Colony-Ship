import assert from 'node:assert/strict';
import { buildTranscript, normalizeDiaryDraft, normalizeQuickReplies } from './assistant';

// --- 快速回覆 ---
assert.deepEqual(
  normalizeQuickReplies({ replies: ['  你好  ', '你好', '', 42, '我看向窗外', '第四則', '第五則'] }),
  ['你好', '我看向窗外', '第四則'],
  '去空白、去重、丟掉非字串與空字串、最多 3 則'
);
assert.equal(normalizeQuickReplies({ replies: ['字'.repeat(100)] })[0].length, 40, '過長截斷在 40 字');
assert.deepEqual(normalizeQuickReplies({ replies: 'not array' }), [], '非陣列回傳空');
assert.deepEqual(normalizeQuickReplies(null), [], 'null 回傳空');

// --- 日記草稿 ---
assert.deepEqual(
  normalizeDiaryDraft({ title: ' 登艦第一天 ', summary: '認識路西恩', content: ' 今天…… ', tags: ['#登艦', '登艦', '路西恩', '', 3, 'a', 'b', 'c'] }),
  { title: '登艦第一天', summary: '認識路西恩', content: '今天……', tags: ['登艦', '路西恩', 'a', 'b'] },
  '去空白、去 # 前綴、去重、最多 4 個標籤'
);
assert.equal(normalizeDiaryDraft({ title: '空的', content: '   ' }), null, '沒有內文視為無效');
assert.equal(normalizeDiaryDraft({ content: '內文' })?.title, '未命名日記', '缺標題給預設');
assert.deepEqual(normalizeDiaryDraft({ content: '內文' })?.tags, [], '缺標籤給空陣列');
assert.equal(normalizeDiaryDraft('字串'), null);

// --- 逐字稿 ---
assert.equal(
  buildTranscript([{ playerInput: '你好', segments: [
    { kind: 'description', text: '燈閃了一下。' },
    { kind: 'dialogue', speaker: '路西恩', text: '「嗨。」' },
  ] }], '陸星辰'),
  '[陸星辰] 你好\n[敘述] 燈閃了一下。\n[路西恩] 「嗨。」'
);
assert.ok(buildTranscript([{ playerInput: 'x', segments: [] }], '').startsWith('[玩家]'), '沒有名字時稱「玩家」');

console.log('gm/assistant: 全部通過');
