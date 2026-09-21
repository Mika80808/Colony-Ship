import { DialogueSegment, DialogueExpression, GmCommand, Quest } from '../types';
import { GmContext, GmError, GmResult } from './types';
import { readGmSettings } from './settings';
import { providerInfo } from './models';
import { callGemini } from './adapters/gemini';
import { callOpenAiCompatible } from './adapters/openaiCompat';

export { GmError } from './types';
export type { GmContext, GmResult } from './types';

const EXPRESSIONS: DialogueExpression[] = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking',
];
const QUEST_STATUSES: Quest['status'][] = ['進行中', '待回報', '已完成'];

/** 把數值夾在合理範圍內。模型偶爾會給出 999999 這種值。 */
function clamp(value: unknown, min: number, max: number): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return undefined;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function normalizeSegments(raw: unknown): DialogueSegment[] {
  if (!Array.isArray(raw)) return [];
  const segments: DialogueSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!text) continue;
    const kind = entry.kind === 'dialogue' ? 'dialogue' : 'description';
    const speaker = typeof entry.speaker === 'string' && entry.speaker.trim()
      ? entry.speaker.trim()
      : undefined;
    const expression = EXPRESSIONS.includes(entry.expression as DialogueExpression)
      ? (entry.expression as DialogueExpression)
      : undefined;
    segments.push(
      kind === 'dialogue'
        ? { kind, text, speaker, expression }
        : { kind, text }
    );
  }
  return segments;
}

/**
 * 收斂 GM 指令。
 *
 * 這一層是必要的，不是保險。模型很容易憑空捏造 questId、itemId 或 npcId
 * —— 那樣的指令套用時會靜默失效，玩家只會看到「GM 說扣了你一杯咖啡，
 * 但背包沒動」，而且完全查不出原因。這裡直接丟掉引用不存在 id 的指令，
 * 讓敘述與實際狀態的落差止於文字，不會污染存檔。
 */
export function normalizeCommands(raw: unknown, context: GmContext): GmCommand[] {
  if (!Array.isArray(raw)) return [];

  const itemIds = new Set(context.items.map((item) => item.id));
  const questIds = new Set(context.quests.map((quest) => quest.id));
  const npcIds = new Set(context.presentNpcs.map((npc) => npc.id));

  const commands: GmCommand[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;

    switch (entry.type) {
      case 'adjust_stats': {
        const command: GmCommand = { type: 'adjust_stats' };
        const stamina = clamp(entry.stamina, -100, 100);
        const hunger = clamp(entry.hunger, -100, 100);
        const credits = clamp(entry.credits, -10000, 10000);
        if (stamina !== undefined) command.stamina = stamina;
        if (hunger !== undefined) command.hunger = hunger;
        if (credits !== undefined) command.credits = credits;
        if (typeof entry.addCondition === 'string' && entry.addCondition.trim()) {
          command.addCondition = entry.addCondition.trim();
        }
        if (typeof entry.removeCondition === 'string' && entry.removeCondition.trim()) {
          command.removeCondition = entry.removeCondition.trim();
        }
        // 四個欄位都沒給就是一則沒有作用的指令，丟掉。
        if (Object.keys(command).length > 1) commands.push(command);
        break;
      }
      case 'consume_item': {
        const itemId = typeof entry.itemId === 'string' ? entry.itemId : '';
        if (!itemIds.has(itemId)) break;
        commands.push({ type: 'consume_item', itemId, count: clamp(entry.count, 1, 99) ?? 1 });
        break;
      }
      case 'set_quest_status': {
        const questId = typeof entry.questId === 'string' ? entry.questId : '';
        const status = entry.status as Quest['status'];
        if (!questIds.has(questId) || !QUEST_STATUSES.includes(status)) break;
        commands.push({ type: 'set_quest_status', questId, status });
        break;
      }
      case 'adjust_affection': {
        const npcId = typeof entry.npcId === 'string' ? entry.npcId : '';
        const amount = clamp(entry.amount, -50, 50);
        if (!npcIds.has(npcId) || amount === undefined) break;
        const command: GmCommand = { type: 'adjust_affection', npcId, amount };
        if (typeof entry.relationship === 'string' && entry.relationship.trim()) {
          command.relationship = entry.relationship.trim();
        }
        commands.push(command);
        break;
      }
      default:
        break;
    }
  }
  return commands;
}

/**
 * 呼叫 GM。
 *
 * 沒有金鑰時直接丟 no-key，不退回假資料 —— 拿測試台詞冒充 GM 回應，
 * 玩家會以為 AI 接好了，等到發現時已經玩了一段劇情。
 */
export async function runGm(context: GmContext): Promise<GmResult> {
  const settings = readGmSettings();
  const provider = providerInfo(settings.provider);

  if (!settings.apiKey) {
    throw new GmError('no-key', `尚未設定 ${provider.name} 的 API 金鑰。請開啟系統設定填入你的金鑰。`);
  }

  let raw: GmResult;
  switch (settings.provider) {
    case 'gemini':
      raw = await callGemini(context, settings);
      break;
    case 'deepseek':
      raw = await callOpenAiCompatible(context, settings, {
        baseUrl: 'https://api.deepseek.com',
        label: 'DeepSeek',
        // DeepSeek 不支援 json_schema，直接用 json_object，省掉每次一個註定失敗的請求。
        jsonMode: 'json_object',
        // 思考模式預設開啟。GM 對延遲敏感，推理過程又按輸出計費，
        // 玩家每送一句都要多等、多付錢，所以關掉。
        extraBody: { thinking: { type: 'disabled' } },
      });
      break;
    case 'custom':
      if (!settings.endpoint) {
        throw new GmError('no-key', '已選擇自訂端點，但尚未填寫端點網址。請到系統設定填寫。');
      }
      if (!settings.model) {
        throw new GmError('no-key', '已選擇自訂端點，但尚未填寫模型名稱。請到系統設定填寫。');
      }
      raw = await callOpenAiCompatible(context, settings, {
        baseUrl: settings.endpoint,
        label: '自訂端點',
        jsonMode: 'schema_then_object',
      });
      break;
  }

  const segments = normalizeSegments(raw.segments);
  if (!segments.length) {
    throw new GmError('format', 'GM 沒有產出可呈現的內容，請再試一次。');
  }

  return { segments, commands: normalizeCommands(raw.commands, context) };
}
