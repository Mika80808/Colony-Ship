import assert from 'node:assert/strict';

/**
 * GM 設定的儲存測試。
 *
 * 重點是金鑰隔離：任何一條讀取路徑都不能把 A 家的金鑰交給 B 家，
 * 否則玩家的 Google 金鑰可能被送到 DeepSeek 的伺服器。
 */

// Node 沒有 localStorage，用 Map 模擬一份。
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { readGmSettings, readGmSettingsDraft, writeGmSettings } = await import('./settings');

// --- 全新玩家 ---
store.clear();
{
  const s = readGmSettings();
  assert.equal(s.provider, 'gemini', '沒有任何設定時預設 Gemini');
  assert.equal(s.model, 'gemini-3.8-flash', '預設模型');
  assert.equal(s.apiKey, '', '沒有金鑰');
}

// --- 舊版遷移：只有 Gemini 的單一金鑰 ---
store.clear();
store.set('starport_gm_api_key', 'GOOGLE-KEY');
store.set('starport_gm_model', 'gemini-2.5-pro');
{
  const s = readGmSettings();
  assert.equal(s.provider, 'gemini', '舊版無端點 → 推定為 Gemini');
  assert.equal(s.apiKey, 'GOOGLE-KEY', '舊金鑰歸給 Gemini');
  assert.equal(s.model, 'gemini-2.5-pro', '舊模型仍在清單內，保留');
  const d = readGmSettingsDraft();
  assert.equal(d.keys.deepseek, '', '舊的 Google 金鑰絕不能分給 DeepSeek');
  assert.equal(d.keys.custom, '', '舊的 Google 金鑰絕不能分給自訂端點');
}

// --- 舊版遷移：已下架的模型 ID 退回預設 ---
store.clear();
store.set('starport_gm_api_key', 'GOOGLE-KEY');
store.set('starport_gm_model', 'gemini-3.7-flash');
assert.equal(readGmSettings().model, 'gemini-3.8-flash', '清單外的舊 ID 退回預設');

// --- 舊版遷移：有填端點 → 自訂端點 ---
store.clear();
store.set('starport_gm_api_key', 'ROUTER-KEY');
store.set('starport_gm_model', 'google/gemini-2.5-flash');
store.set('starport_gm_endpoint', 'https://openrouter.ai/api/v1');
{
  const s = readGmSettings();
  assert.equal(s.provider, 'custom', '舊版有端點 → 推定為自訂端點');
  assert.equal(s.apiKey, 'ROUTER-KEY');
  assert.equal(s.model, 'google/gemini-2.5-flash', '自訂端點的模型名稱原樣保留');
  assert.equal(readGmSettingsDraft().keys.gemini, '', '中轉服務的金鑰不能分給 Gemini');
}

// --- 寫入後各家獨立，且切換供應商用的是該家自己的金鑰 ---
store.clear();
{
  const draft = readGmSettingsDraft();
  draft.keys.gemini = 'GOOGLE-KEY';
  draft.keys.deepseek = 'DEEPSEEK-KEY';
  draft.models.deepseek = 'deepseek-v4-pro';
  draft.provider = 'deepseek';
  assert.equal(writeGmSettings(draft), true);

  let s = readGmSettings();
  assert.equal(s.provider, 'deepseek');
  assert.equal(s.apiKey, 'DEEPSEEK-KEY', '切到 DeepSeek 用 DeepSeek 自己的金鑰');
  assert.equal(s.model, 'deepseek-v4-pro');
  assert.equal(s.endpoint, '', '非自訂端點不帶端點網址');

  draft.provider = 'gemini';
  writeGmSettings(draft);
  s = readGmSettings();
  assert.equal(s.apiKey, 'GOOGLE-KEY', '切回 Gemini 用 Gemini 自己的金鑰');
  assert.equal(s.model, 'gemini-3.8-flash');
}

// --- 刻意清空某家金鑰後，舊版 key 不能把它讀回來 ---
store.clear();
store.set('starport_gm_api_key', 'OLD-GOOGLE-KEY');
{
  const draft = readGmSettingsDraft();
  assert.equal(draft.keys.gemini, 'OLD-GOOGLE-KEY');
  draft.keys.gemini = '';
  writeGmSettings(draft);
  assert.equal(readGmSettings().apiKey, '', '清空後不能被舊版 key 復活');
  assert.equal(store.has('starport_gm_api_key'), false, '寫入後移除舊版 key');
}

// --- DeepSeek 的模型不在清單內也退回預設 ---
store.clear();
store.set('starport_gm_provider', 'deepseek');
store.set('starport_gm_model_deepseek', 'deepseek-chat');
assert.equal(readGmSettings().model, 'deepseek-flash', '已下架的 deepseek-chat 退回預設');

console.log('gm/settings: 全部通過');
