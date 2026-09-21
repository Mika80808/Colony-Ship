import { GmError } from './types';
import { AiRole, readAiSettings } from './settings';
import { providerInfo } from './models';
import { callGemini } from './adapters/gemini';
import { callOpenAiCompatible } from './adapters/openaiCompat';
import { JsonRequest } from './adapters/request';

export type { JsonRequest } from './adapters/request';

const ROLE_NAME: Record<AiRole, string> = { gm: 'GM AI', assistant: '助理 AI' };

/**
 * 依角色（GM／助理）讀取設定、選擇供應商、送出請求，取回未驗證的 JSON。
 * 回傳值的形狀一律由呼叫端檢查。
 */
export async function requestJson(role: AiRole, request: JsonRequest): Promise<unknown> {
  const settings = readAiSettings(role);
  const who = ROLE_NAME[role];

  if (!settings.apiKey) {
    throw new GmError(
      'no-key',
      `${who}尚未設定 ${providerInfo(settings.provider).name} 的 API 金鑰。請開啟系統設定填入你的金鑰。`
    );
  }

  switch (settings.provider) {
    case 'gemini':
      return callGemini(settings, request);
    case 'deepseek':
      return callOpenAiCompatible(settings, request, {
        baseUrl: 'https://api.deepseek.com',
        label: 'DeepSeek',
        // DeepSeek 不支援 json_schema，直接用 json_object，省掉每次一個註定失敗的請求。
        jsonMode: 'json_object',
        // 思考模式預設開啟。遊戲內的呼叫對延遲敏感，推理過程又按輸出計費，
        // 玩家每送一句都要多等、多付錢，所以關掉。
        extraBody: { thinking: { type: 'disabled' } },
      });
    case 'custom':
      if (!settings.endpoint) {
        throw new GmError('no-key', `${who}選擇了自訂端點，但尚未填寫端點網址。請到系統設定填寫。`);
      }
      if (!settings.model) {
        throw new GmError('no-key', `${who}選擇了自訂端點，但尚未填寫模型名稱。請到系統設定填寫。`);
      }
      return callOpenAiCompatible(settings, request, {
        baseUrl: settings.endpoint,
        label: '自訂端點',
        jsonMode: 'schema_then_object',
      });
  }
}
