import { GmContext } from './types';
import type { MemoryBlocks } from '../game/memory';

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
時間為 2090 年。星際港是月球與火星航線之間的中繼港，環狀站體，全站有人工重力，
生活與地面無異。站上有居住區、艦橋、工程部、醫療室、溫室、研究室與中央公園。
玩家是站上的一名常駐人員。
- 月球城市已發展成熟；火星殖民地仍在擴建，物資多由月球供應。往來貨船在這裡停靠、
  補給、換班，再繼續航程。營運單位是月球的一間民營機構，不給名稱，不多著墨。
- 站內通行貨幣是星幣。
- 以自給自足為原則：溫室供應主要食物，水與空氣循環使用。補給船每 7 日到港一次。
  貨物多是月球送往火星的過境貨；站上只截留無法自產的東西，如精密零件、藥品、私人包裹。
  缺東西是小麻煩，不是生存危機。
- 常駐約 20 人，多數身兼數職。大多在月球出生長大，平均約 25 歲，把月球當理所當然的故鄉；
  艦長與副艦長出身地球，受訓後派駐，把月球當開拓地。兩代人的觀念因此有些落差。
- 星際港也是一場生活實驗：少數人、自給自足、身兼數職，在遠離城市的地方共同生活。
- 小社區，彼此熟識，消息傳得快。氣氛是溫和的日常，帶一點遠離城市的寂寞。
- 與月球、火星的通訊有延遲，私人聯絡多以錄製訊息往返，近似書信，不能即時通話。

# 世界的邊界（必須遵守）
- 月球城市、火星殖民地、地球只在敘事中提及（回憶、訊息、傳聞），玩家目前不能前往，
  不要安排玩家離站或搭船出發。
- 大事件以設備故障、船期延誤、訪客到站為上限。不發生戰爭、叛變、外敵入侵，
  也不要寫成攸關全站存亡的危機。
- 科技描寫點到為止，不解釋原理，不編造術語。
- 這個時代沒有紙本：不要出現書本、紙張、便條、手寫字條；資料、留言、訊息一律用
  投影、全息或螢幕呈現。

# 你的職責
依玩家的行動推進劇情，扮演在場的 NPC，描述環境與事件結果。
保持科幻寫實基調，不要浮誇。使用繁體中文。

NPC 若有「日常活動」，請對照目前時間來演：該在值班就別讓他閒著，
深夜找上門就該有被打擾的反應。玩家問起某人行蹤時，依作息回答他大概在哪，
不要憑空給一個地點。

# 記憶
局勢裡標著「記憶」「日記」的段落是過去發生過的事，讓劇情前後連貫用。
- 自然地影響角色的言行與態度，不要逐條複述，也不要說「根據日記」「我記得紀錄上寫」。
- 玩家日記是玩家角色自己寫的，代表玩家角色記得；NPC 不會知道玩家日記的內容，
  除非那件事 NPC 當時也在場。

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

## commands：對遊戲狀態的變更
只有這十種，且**只能引用下方局勢中真實存在的 id**，不可自行發明：
- npc_thought：在場 NPC 此刻的內心想法，npcId 為在場 NPC 的 id，text 40 字內，
  用那個角色的口吻寫他心裡怎麼看玩家、怎麼看這件事（例如「他今天話很少，是不是
  我昨天說錯話了」）。**場上有 NPC 時，每位在場 NPC 每次回應都要下一則**，這是他
  記得這段相處的唯一依據，漏了就補不回來。玩家看不到這些內容。
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
- add_memory：記下一件之後該記得的事。只記會影響往後劇情的變化（設備壞了、某人答應了
  什麼、某個地方最近氣氛緊張），寒暄與當下動作不記。多數回合不用下，一次最多 3 則。
  - layer：world（全站都知道的事）／region（玩家所在區域的近況）／scene（這個房間或
    這個場所裡的事）／npc（某位在場 NPC 個人的事，要加 npcId）。地點由系統自動標上。
  - text：一句話寫清楚事實，60 字內，不要寫成對白。
  - weight：critical（關鍵轉折，不能忘）／normal（一般）／flavor（氣氛點綴）。
  - keywords 選填：填了就變成「被提起才想起」的話題記憶；不填就是「到這裡就會知道」
    的背景。只填事件標記（例如「停電」「借工具」），不要填人名地名。
  - expireDays 選填：幾天後失效，適合暫時的狀況（例如維修中）。

沒有對應 id 時就不要下該指令，改用敘述帶過。
不要發放新任務或新物品 —— 目前的指令集還不支援，硬下指令只會失效。

當前目標與當前摘要是玩家隨時看得到的側欄，不是每回合都要動。
除了 npc_thought 與 advance_time，多數回合不需要其他指令。`;

const bullet = (list: readonly string[] | undefined) => (list ?? []).map((line) => `- ${line}`).join('\n');

/**
 * 第二～四層（骨架第三節「分層組裝」）：進場就定下、同一場景內不會變的局勢。
 * 世界記憶、玩家六欄、在場 NPC 的人設與記憶、所在與相鄰地點。
 * 放在 system 之後、對話紀錄之前：只在換場時改變，同一場景的多次往返共用同一段前綴，
 * 供應商有前綴快取時能省錢省時間（沒有快取也照常運作）。
 */
export function buildSceneBlock(context: GmContext): string {
  const { profile, presentNpcs, locationName } = context;
  const memory = context.memory;

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
        memory?.npcMemories[npc.id]?.length && `  記憶（這個人的事）：\n${memory.npcMemories[npc.id].map((line) => `    - ${line}`).join('\n')}`,
        memory?.npcThoughts[npc.id]?.length && `  先前的內心想法（他自己知道，玩家看不到）：\n${memory.npcThoughts[npc.id].map((line) => `    - ${line}`).join('\n')}`,
      ].filter(Boolean).join('\n')).join('\n')
    : '（此處目前沒有其他角色。不要讓不在場的角色說話。）';

  const absent = Object.entries(memory?.absentNpcMemories ?? {});
  const absentBlock = absent.length
    ? `\n\n## 不在場、但跟玩家親近的人（重要記憶，只供參考，不要讓他們出場說話）\n${absent.map(([name, items]) => `- ${name}：${items.join('；')}`).join('\n')}`
    : '';

  return `# 這個場景的背景
${memory?.world.length ? `\n## 全站都知道的事（世界記憶）\n${bullet(memory.world)}\n` : ''}
## 所在位置
${locationName}
${memory?.placeLore.length ? `\n## 所在地點與相鄰地點（設定集）\n${bullet(memory.placeLore)}\n` : ''}${memory?.place.length ? `\n## 這一帶的近況（區域與場景記憶）\n${bullet(memory.place)}\n` : ''}
## 玩家
${profileLines}

## 在場 NPC
${npcBlock}${absentBlock}`;
}

/**
 * 第五層後段：每回合都可能變的狀態（時間、數值、好感、任務、目標、摘要、進場挑出的日記）。
 * 放在對話紀錄之後：這些小欄位每回合刷新，放前面會讓後面整段對話紀錄的快取失效。
 */
export function buildStateBlock(context: GmContext): string {
  const { stats, quests, items, presentNpcs, sceneObjects, objectives, summary, gameDate, gameTime, supplies, terminals } = context;
  const memory = context.memory;

  const relationBlock = presentNpcs.length
    ? `\n## 在場 NPC 的好感與關係\n${presentNpcs.map((npc) => `- ${npc.name}：好感度 ${npc.affection}（${npc.relationship}）`).join('\n')}\n`
    : '';

  const questBlock = quests.length
    ? quests.map((q) => `- id: ${q.id}｜[${q.category}][${q.status}] ${q.title}：${q.description}`).join('\n')
    : '（目前沒有任務。）';

  const itemBlock = items.length
    ? items.map((i) => `- id: ${i.id}｜${i.name} x${i.count}${i.effectText ? `（${i.effectText}）` : ''}`).join('\n')
    : '（背包是空的。）';

  const objectiveBlock = objectives.length
    ? objectives.map((o) => `- id: ${o.id}｜[${o.done ? '已完成' : '進行中'}] ${o.text}${o.location ? `（${o.location}）` : ''}`).join('\n')
    : '（目前沒有目標。）';

  const nameOf = (npcId: string) => presentNpcs.find((npc) => npc.id === npcId)?.name ?? npcId;
  const npcLogs = memory?.npcLogs ?? [];
  const npcLogBlock = npcLogs.length
    ? `\n\n## 在場的人記得的往事（NPC 日誌，只有他本人知道）\n${npcLogs.map((log) => `### ${nameOf(log.npcId)} ${log.title}\n${log.content}`).join('\n\n')}`
    : '';

  return `# 目前局勢

## 時間
${gameDate} ${gameTime}
${sceneObjects ? `\n## 當前場景物件（僅供辨認名稱與相對位置，不要把座標直接說給玩家）\n${sceneObjects}\n` : ''}${supplies?.length ? `
## 站上物資（僅供參考：讓角色自然提起食材充足或短缺，不要報數字，也不要用指令改）
${supplies.join('\n')}
` : ''}${terminals?.length ? `
## 這裡可查詢的設施終端（角色要先走到終端前查看，才說得出下面的內容；沒查看前只能憑印象講大概，不要報日期或天數。有角色想知道時，可以讓他去查）
${terminals.map((t) => `### ${t.name}\n${t.lines.map((l) => `- ${l}`).join('\n')}`).join('\n')}
` : ''}
## 玩家狀態
體力 ${stats.stamina}/${stats.maxStamina}　飢餓 ${stats.hunger}/${stats.maxHunger}　星幣 ${stats.credits}
狀態：${stats.conditions.length ? stats.conditions.join('、') : '無'}
${relationBlock}
## 任務
${questBlock}

## 背包
${itemBlock}

## 當前目標
${objectiveBlock}

## 當前摘要
${summary || '（尚未寫過摘要。）'}${diaryBlock('玩家日記（進入這個場景時想起的往事）', memory?.diaries)}${npcLogBlock}`;
}

/** 完整局勢（場景背景＋目前狀態）。測試與除錯用；實際送出時兩段分開排位，見 index.ts。 */
export function buildContextBlock(context: GmContext): string {
  return `${buildSceneBlock(context)}\n\n${buildStateBlock(context)}`;
}

/** 一組日記攤成一段。沒有就不出現這個標題，省 token。 */
function diaryBlock(heading: string, diaries: MemoryBlocks['diaries'] | undefined): string {
  if (!diaries?.length) return '';
  return `\n\n## ${heading}\n${diaries.map((entry) => `### ${entry.date}｜${entry.title}\n${entry.content}`).join('\n\n')}`;
}

/**
 * 第五層尾端：本次輸入勾起的記憶（關鍵字追加）。
 * 每回合都會變，所以緊貼在玩家輸入前面，不插進前面幾層。
 */
export function buildRecallBlock(context: GmContext): string {
  const recalled = context.memory?.recalledMemories ?? [];
  const npcLogs = context.memory?.recalledNpcLogs ?? [];
  const nameOf = (npcId: string) => context.presentNpcs.find((npc) => npc.id === npcId)?.name ?? npcId;
  const lore = context.memory?.recalledLore ?? [];
  return [
    lore.length ? `## 玩家剛才提到的人事物（設定集，背景知識）\n${lore.map((line) => `- ${line}`).join('\n')}` : '',
    recalled.length ? `## 玩家剛才的話勾起的記憶\n${recalled.map((line) => `- ${line}`).join('\n')}` : '',
    diaryBlock('玩家剛才的話勾起的往事（玩家日記）', context.memory?.recalledDiaries).trimStart(),
    npcLogs.length
      ? `## 玩家剛才的話讓在場的人想起的事（NPC 日誌）\n${npcLogs.map((log) => `### ${nameOf(log.npcId)} ${log.title}\n${log.content}`).join('\n\n')}`
      : '',
  ].filter(Boolean).join('\n\n');
}

/**
 * 短期上下文（骨架第一節）：存檔裡的對話窗口整段附上。
 * 窗口最多 20 回、滿了一次汰除 10 回（見 game/memory.ts 的 pushTurn），
 * 這樣開頭只在汰除時改變，前綴快取每十回合才失效一次；逐回合滑動則每回合都失效。
 *
 * GM 的歷史回應必須以「與輸出要求相同的 json 格式」回填，不能攤成散文。
 * 否則模型會看到自己「過去」都用散文回答，與 JSON 輸出要求互相拉扯 ——
 * 實測 DeepSeek 在這種情況下會回傳 HTTP 200、內容卻全是空白。
 * 指令只保留 npc_thought（骨架：短期上下文唯一保留的指令），讓主 GM 看得見自己
 * 稍早寫下的心境；其餘指令不留，免得模型照著舊的好感、時間指令多發。
 */
export function buildHistoryTurns(context: GmContext) {
  return context.dialogueHistory.map((turn) => ({
    player: turn.playerInput,
    gm: JSON.stringify({
      segments: turn.segments,
      commands: (turn.thoughts ?? []).map((thought) => ({ type: 'npc_thought', npcId: thought.npcId, text: thought.text })),
    }),
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
