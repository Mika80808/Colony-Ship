/**
 * Gemini 直連可選的模型。設定面板與 GM 呼叫端共用這一份。
 *
 * ID 與輸出上限於 2026-09-21 對照 ai.google.dev/gemini-api/docs/models 確認。
 * 注意預覽版的 ID 帶 -preview 後綴，不能照顯示名稱推測。
 *
 * 預覽版模型需要啟用帳單，免費額度的金鑰呼叫會失敗 ——
 * 玩家自備金鑰的架構下，這是玩家最可能踩到的坑，所以名稱上直接標註。
 */
export interface GmModelOption {
  id: string;
  name: string;
  /** 單次回應的輸出 token 上限。設定面板的滑桿以此為頂。 */
  maxTokens: number;
}

export const GEMINI_MODELS: GmModelOption[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', maxTokens: 65536 },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', maxTokens: 65536 },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro（預覽，需帳單）', maxTokens: 65536 },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash（預覽，需帳單）', maxTokens: 65536 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', maxTokens: 65536 },
];

export const DEFAULT_GM_MODEL = 'gemini-3.8-flash';

export function isKnownGeminiModel(id: string): boolean {
  return GEMINI_MODELS.some((model) => model.id === id);
}
