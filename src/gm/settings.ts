/**
 * GM 的 AI 設定。
 *
 * 這些值由 SettingsModal 寫進 localStorage，這裡只負責讀取，
 * 讓設定面板與 GM 呼叫端不直接耦合在字串 key 上。
 *
 * 金鑰是玩家自己的，只存在玩家的瀏覽器裡，不會送到任何我們的伺服器
 * —— 這也是這款遊戲不需要後端的原因。
 */

export interface GmSettings {
  apiKey: string;
  model: string;
  maxTokens: number;
  /**
   * 自訂 OpenAI 相容端點（例如 OpenRouter 的 https://openrouter.ai/api/v1）。
   * 留空時直接呼叫 Google Gemini。
   *
   * 留這個欄位是為了不把玩家綁死在單一供應商：要不要把對話內容交給
   * 中轉服務，是玩家自己的決定，不是遊戲替他們決定。
   */
  endpoint: string;
}

const KEY_API = 'starport_gm_api_key';
const KEY_MODEL = 'starport_gm_model';
const KEY_TOKENS = 'starport_gm_tokens';
const KEY_ENDPOINT = 'starport_gm_endpoint';

export const DEFAULT_GM_MODEL = 'gemini-2.5-flash';

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    // 無痕視窗或站台資料被封鎖。當作沒設定，呼叫端會提示玩家去設定面板填。
    return '';
  }
}

export function readGmSettings(): GmSettings {
  const tokens = Number(read(KEY_TOKENS));
  return {
    apiKey: read(KEY_API).trim(),
    model: read(KEY_MODEL).trim() || DEFAULT_GM_MODEL,
    maxTokens: Number.isFinite(tokens) && tokens > 0 ? tokens : 8192,
    endpoint: read(KEY_ENDPOINT).trim(),
  };
}
