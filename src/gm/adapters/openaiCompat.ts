import { GmContext, GmError, GmResult } from '../types';
import { GmSettings } from '../settings';
import { GM_SYSTEM_PROMPT, buildContextBlock, buildHistoryTurns, extractJsonObject } from '../prompt';
import { GM_RESPONSE_SCHEMA, RawGmResponse } from './schema';

/**
 * OpenAI Chat Completions 相容端點的共用轉接器。
 * DeepSeek 與「自訂端點」都走這裡，差異由 options 帶入。
 */
export interface OpenAiCompatOptions {
  /** 例如 https://api.deepseek.com，不含 /chat/completions。 */
  baseUrl: string;
  /** 錯誤訊息中對玩家顯示的名稱。 */
  label: string;
  /**
   * JSON 輸出模式。
   * - json_object：只要求合法 JSON，形狀靠 prompt 引導（DeepSeek 只支援這個）。
   * - schema_then_object：先要求嚴格 schema，端點回 400/422 再退回 json_object。
   *   用在不知道對方支援什麼的自訂端點；已知供應商不要用，每次都會多浪費一次請求。
   */
  jsonMode: 'json_object' | 'schema_then_object';
  /** 併入請求本文的供應商專屬參數。 */
  extraBody?: Record<string, unknown>;
}

export async function callOpenAiCompatible(
  context: GmContext,
  settings: GmSettings,
  options: OpenAiCompatOptions
): Promise<GmResult> {
  const history = buildHistoryTurns(context);
  const messages = [
    { role: 'system', content: GM_SYSTEM_PROMPT },
    ...history.flatMap((turn) => [
      { role: 'user', content: turn.player },
      { role: 'assistant', content: turn.gm },
    ]),
    {
      role: 'user',
      content: `${buildContextBlock(context)}\n\n# 玩家的行動\n${context.playerInput}`,
    },
  ];

  const url = `${options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const post = (responseFormat: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        ...options.extraBody,
        model: settings.model,
        messages,
        max_tokens: settings.maxTokens,
        response_format: responseFormat,
      }),
    });

  let response: Response;
  try {
    if (options.jsonMode === 'schema_then_object') {
      response = await post({
        type: 'json_schema',
        json_schema: { name: 'gm_response', strict: true, schema: GM_RESPONSE_SCHEMA },
      });
      // 不少相容端點只認得 json_object，不認得 json_schema。
      if (response.status === 400 || response.status === 422) {
        response = await post({ type: 'json_object' });
      }
    } else {
      response = await post({ type: 'json_object' });
    }
  } catch {
    throw new GmError(
      'network',
      `連不上${options.label}。請確認網路連線${
        options.jsonMode === 'schema_then_object' ? '、網址正確，且該服務允許瀏覽器直接呼叫（CORS）' : ''
      }。`
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GmError('auth', `API 金鑰被${options.label}拒絕，請到系統設定確認。`);
    }
    if (response.status === 402) {
      throw new GmError('quota', `${options.label}帳戶餘額不足，請先儲值。`);
    }
    if (response.status === 429) {
      throw new GmError('quota', `已達${options.label}的用量上限，請稍後再試。`);
    }
    throw new GmError('unknown', `${options.label}回應錯誤（HTTP ${response.status}）。`);
  }

  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  } | null;

  const choice = payload?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new GmError('format', '回應長度超出上限而被截斷，請到系統設定調高輸出長度。');
  }

  let raw: RawGmResponse | null;
  try {
    raw = extractJsonObject(choice?.message?.content) as RawGmResponse | null;
  } catch {
    throw new GmError('format', `${options.label}回傳的不是合法 JSON。該模型可能不支援 JSON 輸出模式。`);
  }
  // DeepSeek 文件明載 JSON 模式偶爾會回傳空內容（實測會是一整串空白），重送通常就好。
  if (!raw) throw new GmError('format', `${options.label}這次沒有回傳內容，請再送一次。`);

  return raw as unknown as GmResult;
}
