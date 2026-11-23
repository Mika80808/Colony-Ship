import assert from 'node:assert/strict';
import { SAVE_VERSION, sanitizeSave } from './persistence';

const good = {
  version: SAVE_VERSION,
  savedAt: '2090-10-24T00:00:00Z',
  profile: { name: '測試', gender: '', age: '', appearance: '', personality: '', other: '', profession: '', roomId: '' },
  stats: { stamina: 80, maxStamina: 100, hunger: 70, maxHunger: 100, credits: 450, conditions: ['疲倦'] },
  quests: [{ id: 'q1', category: '次要', title: '送藥', status: '進行中', description: '送藥到醫療室', acceptedDate: '2090-10-24', deadlineDays: 2 }],
  items: [{ id: 'apple', name: '蘋果', category: '食物', effectText: '', stackMax: 10, count: 2 }],
  runStory: { npcs: [], items: [], chapters: [], sectors: [], lore: [] },
  storyOverrides: { npcs: { lucien: { enabled: false } }, items: {}, chapters: {}, sectors: {}, lore: {} },
  dialogueHistory: [{ playerInput: '你好', segments: [{ kind: 'description', text: '安靜的走廊。' }] }],
  diaryEntries: [{ id: 'd1', date: '2090-10-24', title: '第一天', content: '到港。', enabled: true, author: '測試' }],
  currentSectorId: 'bridge',
  currentRoomId: null,
  memories: [],
  npcMemories: {},
  objectives: [{ id: 'o1', text: '熟悉環境' }],
  summary: '剛到港。',
  gameDate: '2090-10-24',
  gameTime: '08:45',
};

// 正常的存檔原樣讀回來。
assert.deepEqual(sanitizeSave(structuredClone(good)), good);

// 不是物件、版本不符：整份捨棄。
assert.equal(sanitizeSave(null), null);
assert.equal(sanitizeSave([]), null);
assert.equal(sanitizeSave({ ...good, version: SAVE_VERSION - 1 }), null);

// 整欄型別錯誤（重現：items 變成物件，App 的 .map 讓畫面白掉）：拿掉那一欄，其他欄位保留。
const badItems = sanitizeSave({ ...structuredClone(good), items: { apple: 2 } })!;
assert.ok(badItems, 'a single broken field does not discard the whole save');
assert.equal('items' in badItems, false, 'broken items field is dropped so the app falls back to its default');
assert.deepEqual(badItems.stats, good.stats);
assert.deepEqual(badItems.diaryEntries, good.diaryEntries);

// 清單裡壞掉的單筆濾掉，好的留著。
const mixed = sanitizeSave({ ...structuredClone(good), quests: [good.quests[0], null, { id: 'q2' }, 'x'] })!;
assert.deepEqual(mixed.quests, good.quests);
const mixedItems = sanitizeSave({ ...structuredClone(good), items: [good.items[0], { id: 'x', name: 'y', count: '3' }] })!;
assert.deepEqual(mixedItems.items, good.items);

// stats 少了數字或 conditions 不是陣列：整欄退回初始值。
assert.equal('stats' in sanitizeSave({ ...structuredClone(good), stats: { ...good.stats, credits: '450' } })!, false);
assert.equal('stats' in sanitizeSave({ ...structuredClone(good), stats: { ...good.stats, conditions: '疲倦' } })!, false);

// 故事書層的單一種類壞掉：只把那一類補成空的。
const story = sanitizeSave({ ...structuredClone(good), runStory: { npcs: 'oops', items: [] } })!;
assert.deepEqual(story.runStory, { npcs: [], items: [], chapters: [], sectors: [], lore: [] });

// 日期或時間格式壞掉：兩欄一起退回開局時間，不留半套。
const clock = sanitizeSave({ ...structuredClone(good), gameTime: 845 })!;
assert.equal('gameDate' in clock, false);
assert.equal('gameTime' in clock, false);

// 對話紀錄裡沒有文字的片段濾掉。
const dialogue = sanitizeSave({ ...structuredClone(good), dialogueHistory: [{ playerInput: 'hi', segments: [{ kind: 'description' }, { kind: 'description', text: 'ok' }] }, { segments: 'x' }] })!;
assert.deepEqual(dialogue.dialogueHistory, [{ playerInput: 'hi', segments: [{ kind: 'description', text: 'ok' }] }]);

// 選填的大型狀態結構不對就拿掉，讓 App 從開局狀態起算。
assert.equal('freight' in sanitizeSave({ ...structuredClone(good), freight: { day: 1 } })!, false);
assert.equal('garden' in sanitizeSave({ ...structuredClone(good), garden: { day: 1, cells: {} } })!, false);

// 存檔時間不是字串：拿掉，設定面板顯示「沒有存檔時間」而不是 Invalid Date。
assert.equal('savedAt' in sanitizeSave({ ...structuredClone(good), savedAt: 12345 })!, false);

console.log('persistence tests passed');
