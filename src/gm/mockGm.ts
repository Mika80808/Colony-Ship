import { DialogueSegment, GmCommand, NPCData } from '../types';

export interface MockGmResponse {
  segments: DialogueSegment[];
  commands: GmCommand[];
}

/** 開發用 GM 邊界；替換真實 AI 時保留此輸入/輸出介面即可。 */
export function runMockGm(playerInput: string, presentNpc?: NPCData): MockGmResponse {
  const item = playerInput.match(/使用【(.+?)】/)?.[1];
  const gift = playerInput.match(/把【(.+?)】送出/)?.[1];
  const report = playerInput.match(/回報任務【(.+?)】/)?.[1];
  const description: DialogueSegment = { kind: 'description', text: '艦內的低鳴聲在對話間短暫浮現。' };

  if (item) return {
    segments: [description, { kind: 'dialogue', speaker: '系統', expression: 'neutral', text: `你使用了【${item}】；GM 已記錄其結果。` }],
    commands: [{ type: 'consume_item', itemId: item === '熱咖啡' ? 'i1' : item, count: 1 }, ...(item === '熱咖啡' ? [{ type: 'adjust_stats', stamina: 15, hunger: -5 } as GmCommand] : [])],
  };
  if (gift) return {
    segments: [description, { kind: 'dialogue', speaker: presentNpc?.name ?? '布雷茲', expression: 'happy', text: `「謝謝你的【${gift}】。我會好好收下。」` }],
    commands: [{ type: 'consume_item', itemId: gift === '熱咖啡' ? 'i1' : gift, count: 1 }, { type: 'adjust_affection', npcId: presentNpc?.id ?? 'blaze', amount: 5, relationship: '友善' }],
  };
  if (report) {
    const questId = report === '熟悉星際港環境' ? 'q1' : report === '檢查工程電路' ? 'q2' : 'q3';
    return { segments: [description, { kind: 'dialogue', speaker: '系統', expression: 'neutral', text: `任務【${report}】的回報已送交審核。` }], commands: [{ type: 'set_quest_status', questId, status: '已完成' }] };
  }
  if (presentNpc?.id === 'lucian') return {
    segments: [{ kind: 'dialogue', speaker: presentNpc.name, expression: 'neutral', text: `「你好，我是${presentNpc.name}。需要聊聊嗎？」他朝你看過來。` }],
    commands: [],
  };
  return {
    segments: [description, { kind: 'dialogue', speaker: '布雷茲', expression: 'thinking', text: `「關於你提到的『${playerInput}』，我會把它記在物資調度備忘錄裡。」` }],
    commands: [],
  };
}
