/**
 * GM 可選的 AI 供應商與模型。設定面板與 GM 呼叫端共用這一份。
 *
 * 模型 ID 一律照官方文件填，不從顯示名稱推測（預覽版常帶 -preview 後綴，
 * 舊名稱也會下架）。確認日期與來源寫在各清單上方，改動時請一併更新。
 */

export type GmProvider = 'gemini' | 'deepseek' | 'custom';

export interface GmModelOption {
  id: string;
  name: string;
  /** 單次回應的輸出 token 上限。設定面板的滑桿以此為頂。 */
  maxTokens: number;
}

/**
 * 2026-09-21 對照 ai.google.dev/gemini-api/docs/models 確認。
 * 預覽版需要啟用帳單，免費額度的金鑰呼叫會失敗 —— 玩家自備金鑰的架構下，
 * 這是最可能踩到的坑，所以名稱上直接標註。
 */
export const GEMINI_MODELS: GmModelOption[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', maxTokens: 65536 },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', maxTokens: 65536 },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro（預覽，需帳單）', maxTokens: 65536 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash（預覽，需帳單）', maxTokens: 65536 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', maxTokens: 65536 },
];

/**
 * 2026-09-21 對照 api-docs.deepseek.com/quick_start/pricing 確認。
 * 舊的 deepseek-chat／deepseek-reasoner 已不在官方清單上。
 * 輸出上限 384K。
 */
export const DEEPSEEK_MODELS: GmModelOption[] = [
  { id: 'deepseek-flash', name: 'DeepSeek Flash（V4.1）', maxTokens: 393216 },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', maxTokens: 393216 },
];

export interface ProviderInfo {
  id: GmProvider;
  name: string;
  /** 自訂端點沒有固定清單，模型改為自由輸入。 */
  models: GmModelOption[] | null;
  defaultModel: string;
  /** 金鑰申請頁。 */
  keyUrl?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    models: GEMINI_MODELS,
    defaultModel: 'gemini-3.8-flash',
    keyUrl: 'https://aistudio.google.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: DEEPSEEK_MODELS,
    defaultModel: 'deepseek-flash',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'custom',
    name: '自訂端點（OpenAI 相容）',
    models: null,
    defaultModel: '',
  },
];

export const DEFAULT_GM_PROVIDER: GmProvider = 'gemini';
export const DEFAULT_GM_MODEL = 'gemini-3.8-flash';

export function isGmProvider(value: unknown): value is GmProvider {
  return PROVIDERS.some((provider) => provider.id === value);
}

export function providerInfo(provider: GmProvider): ProviderInfo {
  return PROVIDERS.find((info) => info.id === provider) ?? PROVIDERS[0];
}

/**
 * 把存下來的模型 ID 收斂成該供應商可用的值。
 * 清單外的舊 ID（例如已下架的型號）會讓每次呼叫都 404，退回預設比讓
 * 玩家卡在錯誤訊息好。自訂端點的命名由該服務決定，原樣保留。
 */
export function resolveModel(provider: GmProvider, stored: string): string {
  const info = providerInfo(provider);
  const value = stored.trim();
  if (!info.models) return value;
  return info.models.some((model) => model.id === value) ? value : info.defaultModel;
}

/** 輸出上限。自訂端點無從得知，回傳 null 由呼叫端決定。 */
export function maxTokensFor(provider: GmProvider, model: string): number | null {
  return providerInfo(provider).models?.find((option) => option.id === model)?.maxTokens ?? null;
}

export function isKnownGeminiModel(id: string): boolean {
  return GEMINI_MODELS.some((model) => model.id === id);
}
