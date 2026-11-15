/**
 * GM 回應的 JSON 結構。
 *
 * commands 這裡刻意攤平成一個「所有欄位都是選填」的物件，而不是
 * 照 GmCommand 的 union 分成四種：Gemini 的 responseSchema 是 OpenAPI 的
 * 子集，對 oneOf／discriminated union 的支援很差，硬套會得到不穩定的輸出。
 *
 * 代價是模型可能給出欄位組合不合法的指令（例如 type 是 consume_item
 * 卻沒有 itemId），所以 index.ts 的 normalizeCommands 一定要做收斂檢查，
 * 不能直接相信這裡的輸出。
 */
export const GM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['dialogue', 'description'] },
          speaker: { type: 'string' },
          expression: {
            type: 'string',
            enum: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'shy', 'thinking'],
          },
          text: { type: 'string' },
        },
        required: ['kind', 'text'],
      },
    },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'adjust_stats', 'consume_item', 'set_quest_status', 'adjust_affection',
              'set_summary', 'add_objective', 'complete_objective', 'advance_time',
              'add_memory', 'npc_thought', 'add_item', 'add_quest',
            ],
          },
          // add_item／add_quest 的欄位。分類各用自己的欄位名：攤平的 schema 裡同名欄位只能有一組列舉。
          name: { type: 'string' },
          description: { type: 'string' },
          itemCategory: { type: 'string', enum: ['消耗品', '食材', '種子', '禮物', '家具', '裝備', '任務物品', '其他'] },
          title: { type: 'string' },
          questCategory: { type: 'string', enum: ['主要', '次要'] },
          target: { type: 'string' },
          reward: { type: 'string' },
          deadlineDays: { type: 'number' },
          layer: { type: 'string', enum: ['world', 'region', 'scene', 'npc'] },
          weight: { type: 'string', enum: ['critical', 'normal', 'flavor'] },
          keywords: { type: 'array', items: { type: 'string' } },
          expireDays: { type: 'number' },
          stamina: { type: 'number' },
          hunger: { type: 'number' },
          credits: { type: 'number' },
          addCondition: { type: 'string' },
          removeCondition: { type: 'string' },
          itemId: { type: 'string' },
          count: { type: 'number' },
          questId: { type: 'string' },
          status: { type: 'string', enum: ['進行中', '待回報', '已完成'] },
          npcId: { type: 'string' },
          amount: { type: 'number' },
          relationship: { type: 'string' },
          text: { type: 'string' },
          location: { type: 'string' },
          objectiveId: { type: 'string' },
          minutes: { type: 'number' },
        },
        required: ['type'],
      },
    },
  },
  required: ['segments', 'commands'],
} as const;
