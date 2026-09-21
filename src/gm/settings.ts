import {
  DEFAULT_GM_PROVIDER,
  GmProvider,
  PROVIDERS,
  isGmProvider,
  resolveModel,
} from './models';

export type { GmProvider } from './models';

/**
 * GM 的 AI 設定，以及它在 localStorage 裡的存放方式。
 *
 * 設定面板與 GM 呼叫端都經過這裡存取，storage key 只出現在這個檔案。
 *
 * 金鑰是玩家自己的，只存在玩家的瀏覽器裡，不會送到任何我們的伺服器
 * —— 這也是這款遊戲不需要後端的原因。
 *
 * **金鑰與模型依供應商分開存放。** 共用單一欄位的話，玩家從 Gemini 切到
 * DeepSeek 卻忘了換金鑰時，Google 的金鑰就會被送到 DeepSeek 的伺服器。
 * 分開存也讓來回切換不必重填。
 */

export interface GmSettings {
  provider: GmProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  /** 只有 provider 為 custom 時使用，例如 https://openrouter.ai/api/v1。 */
  endpoint: string;
}

/** 設定面板編輯的完整內容：每個供應商各自的金鑰與模型都在裡面。 */
export interface GmSettingsDraft {
  provider: GmProvider;
  keys: Record<GmProvider, string>;
  models: Record<GmProvider, string>;
  endpoint: string;
  maxTokens: number;
}

const KEY_PROVIDER = 'starport_gm_provider';
const KEY_TOKENS = 'starport_gm_tokens';
const KEY_ENDPOINT = 'starport_gm_endpoint';
const keyFor = (provider: GmProvider) => `starport_gm_api_key_${provider}`;
const modelFor = (provider: GmProvider) => `starport_gm_model_${provider}`;

/** 舊版（只有 Gemini 與自訂端點、共用一格金鑰）的 key，讀取時用來遷移。 */
const LEGACY_KEY_API = 'starport_gm_api_key';
const LEGACY_KEY_MODEL = 'starport_gm_model';

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    // 無痕視窗或站台資料被封鎖。當作沒設定，呼叫端會提示玩家去設定面板填。
    return '';
  }
}

/**
 * 舊版存檔沒有 provider：有填端點就是自訂端點，否則是 Gemini。
 * 舊的金鑰與模型只歸給這個推定出來的供應商，絕不分給其他家。
 */
function legacyProvider(): GmProvider {
  return read(KEY_ENDPOINT).trim() ? 'custom' : 'gemini';
}

export function readGmProvider(): GmProvider {
  const stored = read(KEY_PROVIDER);
  if (isGmProvider(stored)) return stored;
  return read(LEGACY_KEY_API) || read(LEGACY_KEY_MODEL) ? legacyProvider() : DEFAULT_GM_PROVIDER;
}

function readKey(provider: GmProvider): string {
  const own = read(keyFor(provider)).trim();
  if (own) return own;
  return provider === legacyProvider() ? read(LEGACY_KEY_API).trim() : '';
}

function readModel(provider: GmProvider): string {
  const own = read(modelFor(provider));
  const stored = own || (provider === legacyProvider() ? read(LEGACY_KEY_MODEL) : '');
  return resolveModel(provider, stored);
}

function readTokens(): number {
  const tokens = Number(read(KEY_TOKENS));
  return Number.isFinite(tokens) && tokens > 0 ? tokens : 8192;
}

/** 設定面板開啟時載入的完整草稿。 */
export function readGmSettingsDraft(): GmSettingsDraft {
  const keys = {} as Record<GmProvider, string>;
  const models = {} as Record<GmProvider, string>;
  for (const { id } of PROVIDERS) {
    keys[id] = readKey(id);
    models[id] = readModel(id);
  }
  return {
    provider: readGmProvider(),
    keys,
    models,
    endpoint: read(KEY_ENDPOINT).trim(),
    maxTokens: readTokens(),
  };
}

/** GM 呼叫時使用的、目前生效的設定。 */
export function readGmSettings(): GmSettings {
  const provider = readGmProvider();
  return {
    provider,
    apiKey: readKey(provider),
    model: readModel(provider),
    maxTokens: readTokens(),
    endpoint: provider === 'custom' ? read(KEY_ENDPOINT).trim() : '',
  };
}

/**
 * 寫入設定。回傳是否成功（無痕視窗下可能寫不進去）。
 * 寫入後移除舊版 key：否則玩家刻意清空某家金鑰時，遷移邏輯會把舊值讀回來。
 */
export function writeGmSettings(draft: GmSettingsDraft): boolean {
  try {
    localStorage.setItem(KEY_PROVIDER, draft.provider);
    for (const { id } of PROVIDERS) {
      localStorage.setItem(keyFor(id), draft.keys[id].trim());
      localStorage.setItem(modelFor(id), draft.models[id].trim());
    }
    localStorage.setItem(KEY_ENDPOINT, draft.endpoint.trim());
    localStorage.setItem(KEY_TOKENS, String(draft.maxTokens));
    localStorage.removeItem(LEGACY_KEY_API);
    localStorage.removeItem(LEGACY_KEY_MODEL);
    return true;
  } catch {
    return false;
  }
}
