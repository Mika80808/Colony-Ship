import { GmContext } from './types';

/**
 * GM 的角色設定與輸出規範。
 *
 * 兩個硬性約束值得說明：
 *
 * 1. commands 只能引用局勢裡真的存在的 id。模型很容易憑空捏造 questId
 *    或 itemId，那樣的指令套用後會靜默失效，玩家會看到「GM 說給了你東西
 *    但背包沒變」。index.ts 的 normalizeCommands 會再擋一次，這裡先講明。
 *
 * 2. 敘述與對白分開成 segments，是為了讓對話框能一段一段推進。
 *    整段塞成一則會讓玩家一次看到全部，失去節奏。
 */
export const GM_SYSTEM_PROMPT = `你是科幻角色扮演遊戲《星際港》的遊戲主持人（GM）。

# 世界觀
星際港是一艘進行跨星系探勘的巨型殖民艦，航程長達十年。艦上有居住區、
艦橋、工程部、醫療室、溫室、研究室與中央公園。玩家是艦上的一名船員。
時間為星曆 2154 年。

# 你的職責
依玩家的行動推進劇情，扮演在場的 NPC，描述環境與事件結果。
保持科幻寫實基調，不要浮誇。使用繁體中文。

# 輸出格式
你必須輸出 JSON，含 segments 與 commands 兩個欄位。

## segments：呈現給玩家的內容，依序播放
每則有 kind、text，對白另有 speaker 與 expression。
- kind 為 "description" 時是環境或事件敘述，不要填 speaker。
- kind 為 "dialogue" 時是角色說話，speaker 必須是在場 NPC 的名字，
  expression 從 neutral / happy / sad / angry / surprised / thinking 擇一。
- 一次回應以 1 到 4 則為宜。對白請加上引號。

## commands：對遊戲狀態的變更，沒有要改就給空陣列
只有這四種，且**只能引用下方局勢中真實存在的 id**，不可自行發明：
- adjust_stats：調整數值。stamina／hunger／credits 為增減量（可為負），
  addCondition／removeCondition 為狀態字串。
- consume_item：消耗玩家背包中的物品。itemId 必須是背包裡既有的 id，count 預設 1。
- set_quest_status：改任務狀態。questId 必須是既有任務的 id，
  status 為 "進行中"／"待回報"／"已完成"。
- adjust_affection：調整 NPC 好感。npcId 必須是在場 NPC 的 id，amount 為增減量。

沒有對應 id 時就不要下該指令，改用敘述帶過。
不要發放新任務或新物品 —— 目前的指令集還不支援，硬下指令只會失效。`;

/** 把局勢整理成模型看得懂的一段文字。 */
export function buildContextBlock(context: GmContext): string {
  const { profile, stats, quests, items, presentNpcs, locationName } = context;

  const profileLines = profile.name
    ? [
        `姓名：${profile.name}`,
        profile.gender && `性別：${profile.gender}`,
        profile.age && `年齡：${profile.age}`,
        profile.profession && `職務：${profile.profession}`,
        profile.appearance && `外貌：${profile.appearance}`,
        profile.personality && `性格：${profile.personality}`,
        profile.other && `其他：${profile.other}`,
      ].filter(Boolean).join('\n')
    : '（玩家尚未填寫個人資料，請以中性稱呼，並可在敘述中自然地促使玩家補上。）';

  const npcBlock = presentNpcs.length
    ? presentNpcs.map((npc) => [
        `- id: ${npc.id}｜${npc.name}`,
        npc.position && `  職務：${npc.position}`,
        npc.age && `  年齡：${npc.age}`,
        npc.appearance && `  外貌：${npc.appearance}`,
        npc.personality && `  性格：${npc.personality}`,
        npc.background && `  背景：${npc.background}`,
        npc.other && `  其他：${npc.other}`,
        `  好感度：${npc.affection}（${npc.relationship}）`,
      ].filter(Boolean).join('\n')).join('\n')
    : '（此處目前沒有其他角色。不要讓不在場的角色說話。）';

  const questBlock = quests.length
    ? quests.map((q) => `- id: ${q.id}｜[${q.category}][${q.status}] ${q.title}：${q.description}`).join('\n')
    : '（目前沒有任務。）';

  const itemBlock = items.length
    ? items.map((i) => `- id: ${i.id}｜${i.name} x${i.count}（${i.effectText}）`).join('\n')
    : '（背包是空的。）';

  return `# 目前局勢

## 所在位置
${locationName}

## 玩家
${profileLines}
體力 ${stats.stamina}/${stats.maxStamina}　飢餓 ${stats.hunger}/${stats.maxHunger}　星幣 ${stats.credits}
狀態：${stats.conditions.length ? stats.conditions.join('、') : '無'}

## 在場 NPC
${npcBlock}

## 任務
${questBlock}

## 背包
${itemBlock}`;
}

/**
 * 近期對話，給模型當上下文。
 * 只取最後 8 回：再多會讓每次呼叫的 token 成本快速膨脹，
 * 而玩家自備金鑰的架構下，成本是玩家在付的。
 */
export function buildHistoryTurns(context: GmContext) {
  return context.dialogueHistory.slice(-8).map((turn) => ({
    player: turn.playerInput,
    gm: turn.segments.map((s) => (s.speaker ? `${s.speaker}：${s.text}` : s.text)).join('\n'),
  }));
}
