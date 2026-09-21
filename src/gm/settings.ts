import {
  DEFAULT_GM_PROVIDER,
  GmProvider,
  PROVIDERS,
  isGmProvider,
  resolveModel,
} from './models';

export type { GmProvider } from './models';

/**
 * AI 設定，以及它在 localStorage 裡的存放方式。
 *
 * 遊戲有兩個 AI 角色：GM 與助理。兩者的設定結構相同，只是 storage key
 * 的前綴不同。設定面板與呼叫端都經過這裡存取，storage key 只出現在這個檔案。
 *
 * 金鑰是玩家自己的，只存在玩家的瀏覽器裡，不會送到任何我們的伺服器
 * —— 這也是這款遊戲不需要後端的原因。
 *
 * **金鑰與模型依供應商分開存放。** 共用單一欄位的話，玩家從 Gemini 切到
 * DeepSeek 卻忘了換金鑰時，Google 的金鑰就會被送到 DeepSeek 的伺服器。
 * 分開存也讓來回切換不必重填。
 */

export type AiRole = 'gm' | 'assistant';

export interface AiSettings {
  provider: GmProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  /** 只有 provider 為 custom 時使用，例如 https://openrouter.ai/api/v1。 */
  endpoint: string;
}

/** GM 呼叫端沿用的名稱。 */
export type GmSettings = AiSettings;

/** 設定面板編輯的完整內容：每個供應商各自的金鑰與模型都在裡面。 */
export interface AiSettingsDraft {
  provider: GmProvider;
  keys: Record<GmProvider, string>;
  models: Record<GmProvider, string>;
  endpoint: string;
  maxTokens: number;
}

export type GmSettingsDraft = AiSettingsDraft;

const prefix = (role: AiRole) => `starport_${role}_`;
const K = {
  provider: (role: AiRole) => `${prefix(role)}provider`,
  tokens: (role: AiRole) => `${prefix(role)}tokens`,
  endpoint: (role: AiRole) => `${prefix(role)}endpoint`,
  key: (role: AiRole, provider: GmProvider) => `${prefix(role)}api_key_${provider}`,
  model: (role: AiRole, provider: GmProvider) => `${prefix(role)}model_${provider}`,
  /** 舊版（共用一格金鑰與模型）的 key，讀取時用來遷移。 */
  legacyKey: (role: AiRole) => `${prefix(role)}api_key`,
  legacyModel: (role: AiRole) => `${prefix(role)}model`,
};
const KEY_SAME_AS_GM = 'starport_assistant_same_as_gm';

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
 * （助理從來沒有端點欄位，所以一律推定為 Gemini。）
 * 舊的金鑰與模型只歸給這個推定出來的供應商，絕不分給其他家。
 */
function legacyProvider(role: AiRole): GmProvider {
  return read(K.endpoint(role)).trim() ? 'custom' : 'gemini';
}

/**
 * 舊版助理在勾選「與 GM 相同」時，會把 GM 的金鑰複製一份存進助理欄位。
 * 那份是 GM 的金鑰、當時屬於哪家無從確定，所以這種情況下不遷移。
 */
function legacyKeyUsable(role: AiRole): boolean {
  return role === 'gm' || !readAssistantSameAsGm();
}

function readProvider(role: AiRole): GmProvider {
  const stored = read(K.provider(role));
  if (isGmProvider(stored)) return stored;
  return read(K.legacyKey(role)) || read(K.legacyModel(role))
    ? legacyProvider(role)
    : DEFAULT_GM_PROVIDER;
}

function readKey(role: AiRole, provider: GmProvider): string {
  const own = read(K.key(role, provider)).trim();
  if (own) return own;
  return provider === legacyProvider(role) && legacyKeyUsable(role)
    ? read(K.legacyKey(role)).trim()
    : '';
}

function readModel(role: AiRole, provider: GmProvider): string {
  const own = read(K.model(role, provider));
  const stored = own || (provider === legacyProvider(role) ? read(K.legacyModel(role)) : '');
  return resolveModel(provider, stored);
}

function readTokens(role: AiRole): number {
  const tokens = Number(read(K.tokens(role)));
  return Number.isFinite(tokens) && tokens > 0 ? tokens : 8192;
}

/** 助理是否沿用 GM 的供應商、金鑰與端點（模型仍各自選）。 */
export function readAssistantSameAsGm(): boolean {
  return read(KEY_SAME_AS_GM) === 'true';
}

/** 設定面板開啟時載入的完整草稿。 */
export function readAiSettingsDraft(role: AiRole): AiSettingsDraft {
  const keys = {} as Record<GmProvider, string>;
  const models = {} as Record<GmProvider, string>;
  for (const { id } of PROVIDERS) {
    keys[id] = readKey(role, id);
    models[id] = readModel(role, id);
  }
  return {
    provider: readProvider(role),
    keys,
    models,
    endpoint: read(K.endpoint(role)).trim(),
    maxTokens: readTokens(role),
  };
}

/**
 * 呼叫時使用的、目前生效的設定。
 *
 * 助理勾選「與 GM 相同」時，供應商、金鑰與端點取自 GM；
 * 模型與輸出上限仍用助理自己的（例如 GM 用 Pro、助理用 Lite 省錢）。
 */
export function readAiSettings(role: AiRole): AiSettings {
  const source: AiRole = role === 'assistant' && readAssistantSameAsGm() ? 'gm' : role;
  const provider = readProvider(source);
  return {
    provider,
    apiKey: readKey(source, provider),
    model: readModel(role, provider),
    maxTokens: readTokens(role),
    endpoint: provider === 'custom' ? read(K.endpoint(source)).trim() : '',
  };
}

/**
 * 寫入設定。回傳是否成功（無痕視窗下可能寫不進去）。
 * 寫入後移除舊版 key：否則玩家刻意清空某家金鑰時，遷移邏輯會把舊值讀回來。
 */
export function writeAiSettings(role: AiRole, draft: AiSettingsDraft): boolean {
  try {
    localStorage.setItem(K.provider(role), draft.provider);
    for (const { id } of PROVIDERS) {
      localStorage.setItem(K.key(role, id), draft.keys[id].trim());
      localStorage.setItem(K.model(role, id), draft.models[id].trim());
    }
    localStorage.setItem(K.endpoint(role), draft.endpoint.trim());
    localStorage.setItem(K.tokens(role), String(draft.maxTokens));
    localStorage.removeItem(K.legacyKey(role));
    localStorage.removeItem(K.legacyModel(role));
    return true;
  } catch {
    return false;
  }
}

export function writeAssistantSameAsGm(value: boolean): boolean {
  try {
    localStorage.setItem(KEY_SAME_AS_GM, String(value));
    return true;
  } catch {
    return false;
  }
}

// GM 呼叫端與既有測試沿用的名稱。
export const readGmProvider = () => readProvider('gm');
export const readGmSettings = () => readAiSettings('gm');
export const readGmSettingsDraft = () => readAiSettingsDraft('gm');
export const writeGmSettings = (draft: AiSettingsDraft) => writeAiSettings('gm', draft);
