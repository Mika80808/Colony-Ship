import { GmError } from '../types';
import { AiSettings } from '../settings';
import { extractJsonObject } from '../prompt';
import { JsonRequest } from './request';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * 直接從瀏覽器呼叫 Google Gemini，取回 JSON。
 *
 * 金鑰走 x-goog-api-key 標頭而不是網址的 ?key= 參數：兩者 Gemini 都接受，
 * 但放在網址會讓金鑰出現在瀏覽器歷史、referrer 與任何中間層的存取紀錄裡。
 *
 * Gemini 支援 CORS，所以純前端可以直接呼叫，不需要後端代理。
 */
export async function callGemini(settings: AiSettings, request: JsonRequest): Promise<unknown> {
  const contents = request.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));

  let response: Response;
  try {
    response = await fetch(`${BASE}/${encodeURIComponent(settings.model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': settings.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: request.schema,
          maxOutputTokens: settings.maxTokens,
        },
      }),
    });
  } catch {
    throw new GmError('network', '連不上 Gemini。請檢查網路連線。');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 400 && detail.includes('API_KEY_INVALID')) {
      throw new GmError('auth', 'API 金鑰無效，請到系統設定重新填寫。');
    }
    if (response.status === 401 || response.status === 403) {
      throw new GmError('auth', 'API 金鑰被拒絕，請確認金鑰有效且已啟用 Gemini API。');
    }
    if (response.status === 429) {
      throw new GmError('quota', '已達 API 用量上限，請稍後再試。');
    }
    if (response.status === 404) {
      throw new GmError('unknown', `找不到模型「${settings.model}」，請到系統設定換一個。`);
    }
    throw new GmError('unknown', `Gemini 回應錯誤（HTTP ${response.status}）。`);
  }

  const payload = await response.json().catch(() => null) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  } | null;

  if (payload?.promptFeedback?.blockReason) {
    throw new GmError('blocked', 'Gemini 以安全政策擋下了這次請求，請換個說法再試。');
  }

  const candidate = payload?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new GmError('format', '回應長度超出上限而被截斷，請到系統設定調高輸出長度。');
  }
  if (candidate?.finishReason === 'SAFETY') {
    throw new GmError('blocked', '回應被安全政策攔下，請換個說法再試。');
  }

  let raw: unknown;
  try {
    raw = extractJsonObject(candidate?.content?.parts?.[0]?.text);
  } catch {
    throw new GmError('format', 'Gemini 回傳的不是合法 JSON。');
  }
  if (!raw) throw new GmError('format', 'Gemini 這次沒有回傳內容，請再送一次。');

  // 形狀驗證交給呼叫端，這裡只負責把原始資料帶回去。
  return raw;
}
