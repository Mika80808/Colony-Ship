import { GmContext, GmError, GmResult } from '../types';
import { GmSettings } from '../settings';
import { GM_SYSTEM_PROMPT, buildContextBlock, buildHistoryTurns } from '../prompt';
import { GM_RESPONSE_SCHEMA, RawGmResponse } from './schema';

/**
 * 任何 OpenAI Chat Completions 相容端點（OpenRouter、DeepSeek、
 * 自架的中轉服務等）。玩家在系統設定填入 base URL 即可使用。
 *
 * 留這條路是刻意的：要不要把對話內容交給中轉服務，是玩家的隱私決定。
 * 遊戲本身不預設任何中轉商，也不強迫玩家信任誰。
 *
 * 注意：能不能從瀏覽器直接呼叫，取決於該端點有沒有開 CORS。
 * 沒開的話會以 network 錯誤呈現，這是端點的限制，不是設定填錯。
 */
export async function callOpenAiCompatible(
  context: GmContext,
  settings: GmSettings
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

  const base = settings.endpoint.replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        max_tokens: settings.maxTokens,
        // 先要求嚴格 schema；端點不支援時下面會退回一般 JSON 模式重試。
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'gm_response', strict: true, schema: GM_RESPONSE_SCHEMA },
        },
      }),
    });

    if (response.status === 400 || response.status === 422) {
      // 不少相容端點只認得 json_object，不認得 json_schema。
      response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages,
          max_tokens: settings.maxTokens,
          response_format: { type: 'json_object' },
        }),
      });
    }
  } catch {
    throw new GmError(
      'network',
      '連不上自訂端點。請確認網址正確，且該服務允許瀏覽器直接呼叫（CORS）。'
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GmError('auth', 'API 金鑰被端點拒絕，請到系統設定確認。');
    }
    if (response.status === 429) {
      throw new GmError('quota', '已達端點的用量上限，請稍後再試。');
    }
    throw new GmError('unknown', `端點回應錯誤（HTTP ${response.status}）。`);
  }

  const payload = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  } | null;

  const choice = payload?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new GmError('format', '回應長度超出上限而被截斷，請到系統設定調高輸出長度。');
  }

  const text = choice?.message?.content;
  if (!text) throw new GmError('format', '端點沒有回傳內容。');

  let raw: RawGmResponse;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new GmError('format', '端點回傳的不是合法 JSON。該模型可能不支援 JSON 輸出模式。');
  }

  return raw as unknown as GmResult;
}
