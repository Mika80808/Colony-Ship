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

NPC 若有「日常活動」，請對照目前時間來演：該在值班就別讓他閒著，
深夜找上門就該有被打擾的反應。玩家問起某人行蹤時，依作息回答他大概在哪，
不要憑空給一個地點。

# 輸出格式
你必須輸出 json 物件，含 segments 與 commands 兩個欄位，不要輸出任何 json 以外的文字。
範例：
{"segments":[{"kind":"description","text":"走廊的燈光閃了一下。"},{"kind":"dialogue","speaker":"路西恩","expression":"thinking","text":"「剛才那是什麼？」"}],"commands":[{"type":"adjust_stats","stamina":-5}]}

## segments：呈現給玩家的內容，依序播放
每則有 kind、text，對白另有 speaker 與 expression。
- kind 為 "description" 時是環境或事件敘述，不要填 speaker。
- kind 為 "dialogue" 時是角色說話，speaker 必須是在場 NPC 的名字，
  expression 從 neutral / happy / sad / angry / surprised / shy / thinking 擇一。
- 一次回應以 1 到 4 則為宜。對白請加上引號。

## commands：對遊戲狀態的變更，沒有要改就給空陣列
只有這八種，且**只能引用下方局勢中真實存在的 id**，不可自行發明：
- adjust_stats：調整數值。stamina／hunger／credits 為增減量（可為負），
  addCondition／removeCondition 為狀態字串。
- consume_item：消耗玩家背包中的物品。itemId 必須是背包裡既有的 id，count 預設 1。
- set_quest_status：改任務狀態。questId 必須是既有任務的 id，
  status 為 "進行中"／"待回報"／"已完成"。
- adjust_affection：調整 NPC 好感。npcId 必須是在場 NPC 的 id，amount 為增減量。
- set_summary：改寫左欄的當前摘要。text 為 40 到 80 字的一段話，寫「玩家現在
  的處境」，不是流水帳。劇情有實質推進才下，每次都改會洗掉玩家剛讀過的內容。
- add_objective：新增一則當前目標。text 為 20 字內的祈使句（例如「找布雷茲問
  補給的事」），location 選填。只在玩家有了明確的下一步時才下。
- complete_objective：結束一則目標。objectiveId 必須是上方「當前目標」裡既有的 id。
- advance_time：這段故事經過了多久，minutes 為分鐘數。**每次回應都要下一次**，依
  故事時距估：幾句寒暄 1–3、一段深談 10–20、吃一頓飯 30–60、睡一覺 360–480。
  玩家走路的時間系統會另外算，這裡只算故事裡發生的事。

沒有對應 id 時就不要下該指令，改用敘述帶過。
不要發放新任務或新物品 —— 目前的指令集還不支援，硬下指令只會失效。

當前目標與當前摘要是玩家隨時看得到的側欄，不是每回合都要動。
多數回合的 commands 應該是空的或只有一則。`;

/** 把局勢整理成模型看得懂的一段文字。 */
export function buildContextBlock(context: GmContext): string {
  const { profile, stats, quests, items, presentNpcs, locationName, objectives, summary, gameDate, gameTime, supplies } = context;

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
        npc.routine && npc.routine !== '無' && `  日常活動：\n${npc.routine.split('\n').map((line) => `    ${line.trim()}`).join('\n')}`,
        npc.other && `  其他：${npc.other}`,
        `  好感度：${npc.affection}（${npc.relationship}）`,
      ].filter(Boolean).join('\n')).join('\n')
    : '（此處目前沒有其他角色。不要讓不在場的角色說話。）';

  const questBlock = quests.length
    ? quests.map((q) => `- id: ${q.id}｜[${q.category}][${q.status}] ${q.title}：${q.description}`).join('\n')
    : '（目前沒有任務。）';

  const itemBlock = items.length
    ? items.map((i) => `- id: ${i.id}｜${i.name} x${i.count}${i.effectText ? `（${i.effectText}）` : ''}`).join('\n')
    : '（背包是空的。）';

  const objectiveBlock = objectives.length
    ? objectives.map((o) => `- id: ${o.id}｜[${o.done ? '已完成' : '進行中'}] ${o.text}${o.location ? `（${o.location}）` : ''}`).join('\n')
    : '（目前沒有目標。）';

  return `# 目前局勢

## 時間
星曆 ${gameDate} ${gameTime}

## 所在位置
${locationName}
${supplies?.length ? `
## 船上物資（僅供參考：讓角色自然提起食材充足或短缺，不要報數字，也不要用指令改）
${supplies.join('\n')}
` : ''}
## 玩家
${profileLines}
體力 ${stats.stamina}/${stats.maxStamina}　飢餓 ${stats.hunger}/${stats.maxHunger}　星幣 ${stats.credits}
狀態：${stats.conditions.length ? stats.conditions.join('、') : '無'}

## 在場 NPC
${npcBlock}

## 任務
${questBlock}

## 背包
${itemBlock}

## 當前目標
${objectiveBlock}

## 當前摘要
${summary || '（尚未寫過摘要。）'}`;
}

/**
 * 近期對話，給模型當上下文。
 * 只取最後 8 回：再多會讓每次呼叫的 token 成本快速膨脹，
 * 而玩家自備金鑰的架構下，成本是玩家在付的。
 *
 * GM 的歷史回應必須以「與輸出要求相同的 json 格式」回填，不能攤成散文。
 * 否則模型會看到自己「過去」都用散文回答，與 JSON 輸出要求互相拉扯 ——
 * 實測 DeepSeek 在這種情況下會回傳 HTTP 200、內容卻全是空白。
 * 歷史裡沒有保存當時的指令，所以 commands 一律填空陣列。
 */
export function buildHistoryTurns(context: GmContext) {
  return context.dialogueHistory.slice(-8).map((turn) => ({
    player: turn.playerInput,
    gm: JSON.stringify({ segments: turn.segments, commands: [] }),
  }));
}

/**
 * 從模型輸出取出 JSON 物件。
 *
 * - 全是空白視為沒有內容，回傳 null（DeepSeek 文件明載 JSON 模式偶爾會如此）。
 * - 容忍 ```json 圍欄與前後多餘文字：取第一個 { 到最後一個 } 之間。
 * 解析失敗丟出 SyntaxError，由呼叫端轉成對玩家的錯誤訊息。
 */
export function extractJsonObject(text: string | undefined | null): unknown | null {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  const body = start !== -1 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  return JSON.parse(body);
}
