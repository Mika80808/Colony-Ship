import { DialogueSegment, DialogueExpression, GmCommand, MemoryLayer, MemoryWeight, Quest } from '../types';
import { MEMORY_PARAMS, normalizeForMatch } from '../game/memory';
import { GmContext, GmError, GmResult } from './types';
import { requestJson } from './client';
import { GM_SYSTEM_PROMPT, buildHistoryTurns, buildRecallBlock, buildSceneBlock, buildStateBlock } from './prompt';
import { GM_RESPONSE_SCHEMA } from './adapters/schema';

export { GmError } from './types';
export type { GmContext, GmResult } from './types';

const EXPRESSIONS: DialogueExpression[] = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'shy', 'thinking',
];
const QUEST_STATUSES: Quest['status'][] = ['進行中', '待回報', '已完成'];
const MEMORY_LAYERS: MemoryLayer[] = ['world', 'region', 'scene', 'npc'];
const MEMORY_WEIGHTS: MemoryWeight[] = ['critical', 'normal', 'flavor'];

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
  const openObjectiveIds = new Set(
    context.objectives.filter((objective) => !objective.done).map((objective) => objective.id)
  );

  /** 取一段非空字串，超長就截掉 —— 側欄的版面是固定的。 */
  const text = (value: unknown, max: number): string | undefined => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed ? trimmed.slice(0, max) : undefined;
  };

  const properNouns = new Set(
    [...context.presentNpcs.map((npc) => npc.name), context.locationName].map(normalizeForMatch).filter(Boolean)
  );
  let memoryAdds = 0;

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
      case 'set_summary': {
        const body = text(entry.text, 200);
        if (body) commands.push({ type: 'set_summary', text: body });
        break;
      }
      case 'add_objective': {
        const body = text(entry.text, 40);
        if (!body) break;
        const command: GmCommand = { type: 'add_objective', text: body };
        const location = text(entry.location, 20);
        if (location) command.location = location;
        commands.push(command);
        break;
      }
      case 'advance_time': {
        // 一回合最多推進 12 小時：睡一整晚約 8 小時，再長多半是模型誤把天數寫成分鐘。
        const minutes = clamp(entry.minutes, 1, 720);
        if (minutes) commands.push({ type: 'advance_time', minutes });
        break;
      }
      case 'complete_objective': {
        // 只認還沒結案的目標：重複結案是模型常見的慣性動作，放過去會讓
        // 側欄每回合重畫一次同一則刪除線。
        const objectiveId = typeof entry.objectiveId === 'string' ? entry.objectiveId : '';
        if (!openObjectiveIds.has(objectiveId)) break;
        commands.push({ type: 'complete_objective', objectiveId });
        break;
      }
      case 'npc_thought': {
        // 必出欄位：撐著通道 ② 的記憶管線。只認在場 NPC，同一人一回合只留最後一則。
        const npcId = typeof entry.npcId === 'string' ? entry.npcId : '';
        const body = text(entry.text, MEMORY_PARAMS.thoughtCharLimit);
        if (!npcIds.has(npcId) || !body) break;
        const previous = commands.findIndex((command) => command.type === 'npc_thought' && command.npcId === npcId);
        if (previous >= 0) commands.splice(previous, 1);
        commands.push({ type: 'npc_thought', npcId, text: body });
        break;
      }
      case 'add_memory': {
        // 只能寫通道 ① 的四層；指向其他地方（例如 NPC 日記）的一律丟棄（骨架階段 4 驗證）。
        if (memoryAdds >= MEMORY_PARAMS.memoryAddPerTurn) break;
        const layer = entry.layer as MemoryLayer;
        if (!MEMORY_LAYERS.includes(layer)) break;
        const body = text(entry.text, 200);
        if (!body) break;
        const npcId = typeof entry.npcId === 'string' ? entry.npcId : '';
        if (layer === 'npc' && !npcIds.has(npcId)) break;
        const weight = MEMORY_WEIGHTS.includes(entry.weight as MemoryWeight) ? (entry.weight as MemoryWeight) : 'normal';
        // 關鍵字填事件標記：人名、地名主 GM 本來就認得，寫進去只會讓隨口一提就撈出一堆，這裡直接剔掉。
        const keywords = Array.isArray(entry.keywords)
          ? entry.keywords
            .map((keyword) => text(keyword, 12))
            .filter((keyword): keyword is string => !!keyword && !properNouns.has(normalizeForMatch(keyword)))
            .slice(0, 4)
          : [];
        const command: GmCommand = { type: 'add_memory', layer, text: body, weight };
        if (keywords.length) command.keywords = keywords;
        if (layer === 'npc') command.npcId = npcId;
        const expireDays = clamp(entry.expireDays, 1, 365);
        if (expireDays) command.expireDays = expireDays;
        commands.push(command);
        memoryAdds += 1;
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
  const history = buildHistoryTurns(context);
  // 排位照骨架「分層組裝」：指令集說明 → 場景背景（換場才變）→ 對話紀錄（只增不減）
  // → 目前狀態（每回合變）→ 關鍵字追加 → 玩家輸入。越穩定的越前面。
  const raw = (await requestJson('gm', {
    system: `${GM_SYSTEM_PROMPT}\n\n${buildSceneBlock(context)}`,
    messages: [
      ...history.flatMap((turn) => [
        { role: 'user' as const, content: turn.player },
        { role: 'assistant' as const, content: turn.gm },
      ]),
      {
        role: 'user',
        content: [
          buildStateBlock(context),
          buildRecallBlock(context),
          `# 玩家的行動\n${context.playerInput}`,
        ].filter(Boolean).join('\n\n'),
      },
    ],
    schema: GM_RESPONSE_SCHEMA,
    schemaName: 'gm_response',
  })) as { segments?: unknown; commands?: unknown };

  const segments = normalizeSegments(raw.segments);
  if (!segments.length) {
    throw new GmError('format', 'GM 沒有產出可呈現的內容，請再試一次。');
  }

  return { segments, commands: normalizeCommands(raw.commands, context) };
}
