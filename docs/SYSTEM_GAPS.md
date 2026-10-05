# 全遊戲系統缺口盤點（T2）

盤點日期：2026-10-05。範圍：目前工作目錄中的設計文件、程式與既有未提交變更。此次只新增本文件，不執行 git pull、commit 或 push，不修改程式與其他文件。

## 依據與判定方式

完整閱讀 `../星際港-設定資料/星際港_遊戲流程骨架.md` 零至十七章，並比對同目錄的 `COMMANDS 區塊指令`、`場景渲染架構.md`、`地點.md`，以及 `docs/PROGRESS.md`、`../專案目錄.md`、`問題修正紀錄.md`、`docs/scenes/*.md`、`AGENTS.md` 與 `src/` 全部文字來源（含測試、樣式與房間測試配置）。

「已完成」限表列的功能範圍；有欄位、按鈕、提示詞或工具函式，仍須有運行流程接線才算完成。「未做」表示未找到對應遊戲流程，不表示連可重用的 UI 或素材也沒有。S 是局部接線／確定性規則，M 涉及資料模型及多個流程，L 是跨資料、AI、介面或外部服務的系統；不是工時承諾。已完成項目列 S 供小幅維護參考。

順序是實作依賴排序，不是直接開工授權。表內「局部」代表可先實作已定義的核心，該問題僅阻塞相關分支；「是」須先釐清該系統的主要規則。所有「新增測試」與新增模組均是後續派工建議，此次沒有建立它們。通用驗收為 lint、build 及改動邏輯的測試，以下另外列各系統必驗案例。

## 總表

| 系統 | 骨架章節 | 現況（已完成／部分／未做） | 規模（S／M／L） | 需要使用者先決定？ | 建議順序 |
|---|---|---|---|---|---|
| GM 輸出與 COMMANDS 驗證、拒收、失效處理 | 零、二、三階段 3–5、十四 | 部分 | L | 局部：舊版相容範圍 | 1 |
| 記憶六通道與注入組裝（含 Phase 3 區域記憶） | 一、三階段 1、十三 | 部分 | L | 局部：預算與期限參數 | 2 |
| 好感度與關係數值 | 三關係描述、十一 | 部分 | S | 否 | 3 |
| 本機存檔、JSON 備份與新開遊戲 | 十二、十三 | 部分 | M | 局部：舊存檔處理政策 | 4 |
| 計數器節拍與記憶淘汰 | 三階段 7、十五 | 未做 | M | 是：黏著、冷卻、容量值 | 5 |
| 記憶回寫與通道 ② 生命週期 | 三階段 6、五 | 未做 | L | 否 | 6 |
| 通道 ⑥ 摘要雙軌與 Phase 3 摘要 | 四、十三 | 部分 | M | 是：主 GM／助理的生成權責 | 7 |
| 當前目標與任務生命週期（含 Phase 3） | 四、六 | 部分 | M | 是：目標生成權責 | 8 |
| 場景重新矯正、進場同步與快取 | 三階段 8、七、八 | 部分 | L | 局部：語意篩選上限 | 9 |
| 玩家日記、NPC 日記與遞迴整理 | 五、十三 | 部分 | L | 局部：整理與注入數量 | 10 |
| 12 步被動事件 | 三被動事件、七、十五 | 未做 | M | 是：一步定義、傳送換算 | 11 |
| NPC 日程與按需查詢 | 七、十 | 部分 | M | 是：特殊事件條件、落點 | 12 |
| 日程 NPC 的跨場景顯示與互動 | 七、九；渲染 Layer 5 | 部分 | M | 局部：各場景活動點 | 13 |
| 方向鍵與艦橋鍵盤、步行接線 | 八；PROGRESS 專案整理 | 部分 | S | 否 | 14 |
| 對話分段、頭像框、立繪表情與版面 | 三分段與行內標記、九 | 部分 | M | 是：六／七表情、立繪組合方式 | 15 |
| 故事書分頁、匯入、開關與權限 | 十、十三 | 部分 | M | 局部：正式版權限範圍 | 16 |
| 玩家個人資料、職業與房間分配 | 十、COMMANDS OCCUPATION | 部分 | M | 是：職業與部門、房號映射 | 17 |
| 系統設定與模型、Token 預算 | 十二、十五 | 部分 | M | 是：固定模型／自訂供應商政策 | 18 |
| 體力、飢餓、狀態時效與倒地 | 十一、十三、十五 | 部分 | M | 是：消耗、恢復與醫療費參數 | 19 |
| 地圖、傳送點、步行出口與移動時間 | 八、十五、十七 | 部分 | M | 是：場景切分、交通工具效果 | 20 |
| 居住區門牌、門鎖與艙房配置 | 八、十、十六 | 部分 | M | 是：24／32 房及玩家住宿規則 | 21 |
| 共用房間底圖、個人擺設切換底層 | 八艙房配置 | 已完成 | S | 否 | —（保留） |
| 自動植栽生長與工作站報表 | PROGRESS 溫室／全遊戲系統 | 已完成 | S | 否（數值可待實測） | —（保留） |
| 植栽健康與照顧玩法 | PROGRESS 全遊戲系統 | 部分 | M | 是：照顧動作與健康效果 | 22 |
| 玩家菜圃 | 派工指定；地點／PROGRESS 溫室 | 未做 | M | 是：種植、成本、收成規則 | 23 |
| 物資帳與中央公園餐廳送貨 | PROGRESS 全遊戲系統 | 部分 | M | 是：進貨口互動與送貨規則 | 24 |
| 中央廣場、餐廳、酒吧與商店 | 八；PROGRESS／plaza 場景文件 | 未做 | L | 是：v2 配置與六項待決事項 | 25 |
| 研究室與醫療室場景、玩法 | 八、十一；地點／PROGRESS | 未做 | L | 是：功能、互動與場景配置 | 26 |
| 場景分層、特效與工程區新風格接入 | 九；場景渲染架構／PROGRESS | 部分 | M | 是：特效範圍、機台替換配置 | 27 |
| Google 登入、主選單與雲端存檔 | 十二 | 未做 | L | 是：雲端服務與同步策略 | 28 |

## 01. GM 輸出與 COMMANDS 驗證、拒收、失效處理

1. **要求**：骨架零、二、三階段 3–5、十四及 `COMMANDS 區塊指令` 要求敘述與指令分離、21 類 COMMANDS、版本／AST、正式名稱參照、欄位白名單、不合理數值拒收；格式救援不得改內容或數值，TIME／在場 NPC_THOUGHT 漏出只記錄。失敗保留玩家輸入，玩家手動重送成功後原位替換。
2. **現況**：`src/gm/index.ts` 的 `runGm`、`normalizeSegments`、`normalizeCommands` 接收 JSON `segments/commands`，只支援八種指令；有類型及部分參照過濾，沒有 COMMANDS 區塊解析、版本、AST、拒收紀錄與必出檢查。`src/App.tsx::applyCommands/sendToGm` 直接套用結果；`src/gm/client.ts::requestJson` 與 adapters 收完 JSON 才返回。失敗只設 `gmError`，`DialogueSection` 送出即清輸入，沒有可重試的失敗回合、空回應佔位與原位替換；API 錯誤只粗略分類，未完整呈現實際原因。供應商 schema→object fallback 已有，但不是 COMMANDS 格式救援。
3. **檔案／測試**：需改 `src/types.ts`、`src/gm/{types,prompt,index,client,assistant}.ts`、`src/gm/adapters/*`、`src/App.tsx`、`src/components/DialogueSection.tsx`；建議獨立解析／驗證／執行模組。擴充 `src/gm/normalize.test.ts`，新增 pipe／legacy colon、全形、漏 END、版本、單行拒收、錯參照、負時間、NaN、重試不重複套數值及救援不得變更內容測試。ITEM_NEW 未登錄品的助理補文字流程也須驗證。
4. **美術**：不卡。
5. **待決定**：需要相容哪些舊版 COMMANDS 格式？可先完成現行文件所列新版與既述正規化，不必等全部舊版政策。
6. **衝突**：程式 JSON 八種與文件 21 類區塊協定不同；`normalizeCommands` 把超額數值夾到合法範圍，負 `advance_time` 也會變成 1 分鐘，`normalize.test.ts` 明確斷言此行為，與拒收要求相反。主 prompt 限制不得新增任務／物品，也與 QUEST_NEW／ITEM_NEW 不合。未裁定沿用哪套協定。

## 02. 記憶六通道與注入組裝（含 Phase 3 區域記憶）

1. **要求**：骨架一、三階段 1、十三要求 ① 分 world／region／scene／npc、normal／flavor／critical、期限與開關；② 近期 thought＋NPC 日誌，③ 併②，④ 故事書，⑤ 玩家日記，⑥ 當前摘要。進場包凍結、每回合關鍵字追加，五層注入及分層預算；不在場 NPC 僅符合 pin／好感門檻的少量 critical。近期歷史以 20 則為上限，滿額批次移除最舊 10 則，保留 thought、剝離其他指令。
2. **現況**：`src/App.tsx` 的 `areaMemories` 是只有讀取、沒有 setter 的字串陣列；`HeaderHUD` 只輪播。`sendToGm` 傳玩家、數值、任務、背包、在場 NPC、場景物件、時間、物資、歷史、目標、摘要。`src/gm/prompt.ts::buildContextBlock/buildHistoryTurns` 沒讀日記、故事書非人物條目或分層記憶；歷史只送最後八回。②／⑤ 開關、關鍵字、期限、① 配額均未運行。Phase 3 目標／摘要另見 07／08。
3. **檔案／測試**：需改 `src/types.ts`、`src/gm/{types,prompt}.ts`、`src/data/persistence.ts`、`src/App.tsx`；建議新增純資料選取／注入模組及測試，覆蓋六通道不互換、disabled、過期、各層配額、critical 降階、不在場 NPC、去重及 20→移除10 的逐則歷史。
4. **美術**：不卡。
5. **待決定**：各層 Token 預算、期限與關鍵字觸發參數是多少？先建結構及可配置的篩選器，數值待實測。
6. **衝突**：App 一般對話超過 20「回」才 `slice(10)`，艦橋本地敘述則 `slice(-20)`；兩者皆不同於骨架的 20「則」統一規則。動態 context 放在歷史後但沒有完整前四層；GM 根本看不到啟用的日記／多數故事書，不是僅配額不足。

## 03. 好感度與關係數值

1. **要求**：骨架三關係描述、十一要求每 NPC 好感下限 −100、無上限，每天正／負各累積最多 10，午夜歸零、超額丟棄；關係文字可獨立更新，不與好感數字耦合。
2. **現況**：`src/App.tsx::applyCommands` 的 `adjust_affection` 直接加 `amount`；`src/gm/index.ts::normalizeCommands` 限單次 ±50，沒有每日帳、下限或午夜重置。關係文字附在同一指令上，amount=0 會被丟掉。`src/data/story.ts::mergeStory` 已有好感 0／關係「陌生」預設。
3. **檔案／測試**：需改 `src/types.ts`、`src/App.tsx`、`src/data/persistence.ts` 及 GM 指令層；建議新增好感 reducer／測試，驗正負獨立額度、跨午夜、−100 邊界、無上限、只改關係、重送不雙算。
4. **美術**：不卡。
5. **待決定**：無；規則已明確。
6. **衝突**：目前 ±50 單次夾值不能替代每日正負各 10，關係更新必須帶非零好感也違反獨立欄位要求。

## 04. 本機存檔、JSON 備份與新開遊戲

1. **要求**：骨架十二、十三要求完整遊戲 JSON 備份、不含金鑰；新局留設定／故事書，清運行資料，另開槽不毀舊局。未來雲端權威另列 30。
2. **現況**：`src/data/persistence.ts::loadGameSave/writeGameSave/clearGameSave/readSavedAt` 已保存 v2 單一 localStorage 進度；App 有 500ms debounce 及失敗提示。`src/data/story.ts::writeBuiltinStory` 分開存內建內容。`SettingsModal::handleExportSave/handleImportSave` 實際只匯出／匯入 AI 設定，靜態存檔槽不讀遊戲。`App::handleResetProgress` 清單槽、runStory 和覆寫，沒有新槽；步行餘數沒有重置／存檔，areaMemories 未清。
3. **檔案／測試**：需改 `src/data/persistence.ts`、`src/types.ts`、`src/App.tsx`、`src/components/Modals/SettingsModal.tsx`、`src/data/story.ts`；新增 persistence 測試：完整往返、排除各 provider 金鑰、壞 payload、容量失敗、獨立槽、新局保留內容而清進度、步數／每日帳／快取生命週期。最後存檔時間應讀實際 savedAt。
4. **美術**：不卡。
5. **待決定**：版本不同的舊存檔要遷移、拒讀提示，或明確允許重開？先可補同版本 schema 驗證及完整備份。
6. **衝突**：`loadGameSave` 只驗 object／version，異版直接捨棄；設定匯出 version「1.0」與遊戲 v2 是兩種格式。重置清本局故事書與「新局保留全部故事書」不同；畫面上的備份／槽名稱超過實際能力。金鑰目前另存本機、設定匯出排除金鑰，這部分已做。

## 05. 計數器節拍與記憶淘汰

1. **要求**：骨架三階段 7、十五規定本輪觸發的黏著先重置→全體黏著減一→冷卻減一→剛歸零且未再觸發者進冷卻；下次進場生效。記憶容量滿時有保護手寫／critical 及淘汰 flavor 的順序。
2. **現況**：`src/types.ts` 沒有這些記憶欄位；`src/App.tsx::sendToGm/applyCommands` 結束沒有節拍步驟，`src/gm/prompt.ts::buildContextBlock` 也沒有候選狀態。日期推進與日程檢查點是另一件事，不能算本功能。
3. **檔案／測試**：需擴 types／persistence，新增純記憶節拍與淘汰模組，接 App 回合完成及換場；測試歸零當回合再觸發、冷卻順序、手寫／critical 豁免、flavor 最久未觸發先淘汰、讀檔續計。
4. **美術**：不卡。
5. **待決定**：黏著長度、冷卻長度、各容器容量及抽選參數的初始值？
6. **衝突**：目前只丟歷史前十回，沒有指定的記憶淘汰制度；沒有找到另一份可替代上述順序的現行實作。

## 06. 記憶回寫與通道 ② 生命週期

1. **要求**：骨架三階段 6、五要求 NPC_THOUGHT 含時間／地點，近期近十則；溢出或任務／關係進展觸發一次助理提煉，處理舊 thought、留最新；一人一天一篇日誌追加並去重關鍵字，無互動不呼叫。MEMORY_ADD 只寫①，不能借用其他通道。
2. **現況**：`src/types.ts::NpcProgress/DialogueTurn/GmCommand` 無 thought 容器、日誌與觸發批次。`App::applyCommands` 無 thought／MEMORY_ADD；`src/gm/assistant.ts::suggestQuickReplies/generateDiaryDraft` 只做選項／玩家日記草稿，沒有 thought 提煉。不存在可歸檔的②生命週期。
3. **檔案／測試**：需改 types、persistence、GM 解析／assistant、App、故事書人物呈現；新增記憶回寫測試：十則溢出、同回合多觸發僅一次、留最新、跨日分篇、同日 append、助理失敗不丟原文、零互動零呼叫。
4. **美術**：不卡。
5. **待決定**：無必要先決事項；提煉文字長度可參數化。
6. **衝突**：現有 `DiaryEntry.author` 欄位不等於每日 NPC 日誌流程；目前關係直接覆寫，沒有同步觸發提煉與摘要的事件匯流。

## 07. 通道 ⑥ 摘要雙軌與 Phase 3 摘要

1. **要求**：骨架四、十三將當前摘要注入⑥，只有 QUEST／關係進展觸發助理一次刷新；舊摘要存歷史、不注入，供當日日記使用。PROGRESS 對應 Phase 3 待辦須與這套權責核對。
2. **現況**：`App::applyCommands` 有 `set_summary`，`src/gm/prompt.ts::buildContextBlock` 會注入 summary，`LeftSidebar` 會顯示；但初始為空，沒有歷史摘要、進展判定、每日素材或助理摘要函式。`src/gm/prompt.ts::GM_SYSTEM_PROMPT` 允許主 GM 直接寫摘要。
3. **檔案／測試**：需改 types、persistence、App、GM prompt／assistant；新增摘要測試：只有指定進展才更新、同回合單次、舊摘要不進 prompt、舊摘要進當日日記、失敗保留當前摘要。
4. **美術**：不卡。
5. **待決定**：Phase 3「由 GM 生成」是主 GM，還是骨架定義的助理 GM？這會改變呼叫位置與費用，不先自行統一。
6. **衝突**：現行主 GM `set_summary` 與骨架「助理依進展更新」不同。當前 PROGRESS 沒有獨立 Phase 3 勾選段落，派工仍明列該需求；不能據 UI 有摘要就把 Phase 3 判完成。

## 08. 當前目標與任務生命週期（含 Phase 3）

1. **要求**：骨架四、六要求進展刷新建議目標；任務有新增、個別目標達成、待回報、回報完成、獎勵文字。建議目標不是任務獎勵，獎勵顯示不能自行發數值。
2. **現況**：`App::applyCommands` 有 `add_objective/complete_objective/set_quest_status`；`LeftSidebar` 顯示目標，`QuestDrawer` 顯示狀態與文字獎勵，`App::handleReportQuest` 發文字給 GM。初始任務／目標空；沒有 QUEST_NEW、個別 goal reducer、完整回報與進展刷新鏈。骨架要求新增物品／任務的指令也未實現。
3. **檔案／測試**：需改 types、GM prompt／指令、App、QuestDrawer、LeftSidebar、persistence；新增 quest/objective 測試：多目標未全達成、全達成待回報、完成不可重複領數值、新增參照、放棄、刷新去重。
4. **美術**：不卡。
5. **待決定**：目標是主 GM 直接下指令，或由進展助理整批刷新？同 07 權責衝突。
6. **衝突**：現行整張任務可直接改狀態，沒有文件的逐目標過渡；目前獎勵只呈文字符合設計，勿額外做 UI 自動發獎。Phase 3 仍是「已有指令入口、生成與生命週期未完成」。

## 09. 場景重新矯正、進場同步與快取

1. **要求**：骨架三階段 8、七、八要求每次門／步行出口／傳送換場先同步準備日程、① 與②⑤語意篩選，再進下一輪；同場名單相同且離開步差≤30 可重用①與日記集合，每次進場仍重置表情。場內走動不觸發。
2. **現況**：`App::handleEnterSector/commitSector` 有過場、換地點與場景 epoch；`relocateNpcs` 在 effect 重算。600ms 等待沒有語意篩選；沒有場景包、名單／步差快取、表情重置與 ready 門閂。`sendToGm` 只有 gmPending 防重複呼叫，沒有場景／新局版本驗證，等待期間換場後舊結果仍可能套全局。
3. **檔案／測試**：需改 App、GM assistant／prompt、types、各場景出口接線；建議場景準備模組，測試名單相同／變動、30／31 步、場內不重建、重入仍清表情、準備失敗及舊場／舊局 AI 回應不覆新狀態。
4. **美術**：不卡核心；新場景具體落點見 12／20／27／28。
5. **待決定**：語意篩選最多取幾篇／多少字？可先保留可調上限。
6. **衝突**：目前過場只是視覺等待，與骨架同步矯正不同；靠 React effect 更新日程不能保證第一個 GM request 一定取得矯正後上下文。

## 10. 玩家日記、NPC 日記與遞迴整理

1. **要求**：骨架五、十三要求新增、主 GM 自動寫、主 GM 整理三入口；自動僅取當日且自上次後未寫內容、不得背景自跑。整理可遞迴、保留原篇、只最上層入索引；逐則開關影響注入。NPC 一人一天追加，AI 無好感門檻，玩家日誌閱讀≥60，thought 不鎖。
2. **現況**：`DiaryModal` 可 CRUD、日期／標籤檢索、toggle，`App::requestDiaryDraft` 走 `src/gm/assistant.ts::generateDiaryDraft`。草稿吃現有全部窗口歷史，沒有回合時間戳／上次寫入水位、摘要歷史素材、歸檔樹或可編輯寫作 prompt；多選 `checkedIds` 沒有實際整理流程。NPC 日記入口與閱讀鎖未做，enabled 未接 AI。
3. **檔案／測試**：需改 types、DiaryModal、StoryModal、App、GM、persistence；新增日記篩選／整理測試：跨日排除、重寫僅新增內容、空素材、兩層歸檔原文保留、頂層索引、disabled、NPC 同日追加、好感 59／60 UI 與 AI 可讀區別。
4. **美術**：不卡。
5. **待決定**：整理每批篇數、索引／NPC 日誌注入上限？可配置待實測。
6. **衝突**：自動草稿由「助理」寫，骨架指定「主 GM」寫；按作者欄位分類不能替代 NPC ② 的存放與好感限制。未擅自改權責。

## 11. 12 步被動事件

1. **要求**：骨架三被動事件、七、十五要求累積每 12 步 roll 一次，0／10／20%（預設10%），傳送耗時折步；候選限在場或可能路過的人，由 GM 自由演，不靠實時 background timer。
2. **現況**：`src/game/clock.ts::walkMeter` 只累積像素餘數換整分鐘；`App::handleWalk/advanceGameTime` 沒有步數／roll／被動 request。`SettingsModal` 存機率、預設0，但 App 不讀。日程重定位不是被動敘事。
3. **檔案／測試**：需改 clock、App、settings、types／persistence、GM context；新增 deterministic 隨機注入的事件測試：11／12／24 步、0%不呼叫、傳送折步、保存餘步、pending 合併、候選邊界、站立不累積。
4. **美術**：不卡演算；NPC 圖像缺口另見 13／15。
5. **待決定**：一「步」對應幾像素／格？傳送分鐘如何折步？一次跨多個12步是否逐次 roll？不可直接把「16格／分鐘」當成已定義的一步。
6. **衝突**：設定初始0與骨架預設10不同，且目前設定沒有玩法效果。

## 12. NPC 日程與按需查詢

1. **要求**：骨架七、十要求特殊事件＞好感＞值勤＞保底；保底全天、跨午夜、已知地點校驗；進場按需查詢，跨09／18／21／01檢查點採區間判定，眼前出入延後離場、不在眼前直接定位，無有效日程回預設地點。
2. **現況**：`src/data/npcSchedule.ts::locateNpc/slotCovers/crossesCheckpoint/planRelocation/addMinutes` 已做跨午夜、好感／值勤／保底、區間檢查點及眼前延後。`App::relocateNpcs/advanceGameTime` 已接。`ScheduleEditor` 可編四種，`src/data/storyValidation.ts::validateSchedules` 有全天／重疊／參照校驗；但 event 一律忽略、缺日程返回 null 保留位置，未返回行為性質給角色姿勢，也沒有特殊事件條件欄位。
3. **檔案／測試**：需改 npcSchedule、storyValidation、types、ScheduleEditor、App；擴充 `src/data/npcSchedule.test.ts/story.test.ts`，驗特殊條件優先、失效fallback、跨多檢查點採最後狀態、停用 NPC、不經表單的匯入校驗。
4. **美術**：查表不卡；各場景睡眠／工作姿勢及活動點可能需素材。
5. **待決定**：特殊日程用任務、日期還是事件旗標啟用？場內落點由日程指定或場景配置？保底失效的預設地點採 home 還是另設欄位？
6. **衝突**：`npcSchedule.test.ts` 明確測「特殊事件一律不生效」；現在只完成三層，不可把可編輯的 event 當最高優先已做。後續需改規格測試而非只多一按鈕。

## 13. 日程 NPC 的跨場景顯示與互動

1. **要求**：骨架七、九及渲染 Layer 5 要求位置名單與看見的角色一致、行走動畫獨立；進場展示日程人物，互動取得該 NPC。
2. **現況**：`App` 的 `presentNpcs` 依 location 過濾但沒檢查 enabled；`RoomScene` 接 npcs，使用 `src/game/roomActors.ts::createActor/npcSpawnPoint/updateNpc` 生成、巡走。`CorridorScene/BridgeScene/FacilityScene` 未接日程 NPC，因此 GM 可收到「在場」卻沒有對應日程角色；艦橋另有固定 crew 畫面，其座位與反應不由日程名單驅動。研究室／公園等更無實體場景。
3. **檔案／測試**：需改 App、四個 Scene、共用 actor／render 配置；新增場景名單整合測試：日程換場、停用不出場／不注入、多人不同落點、點人物對應正式 ID、對話與渲染名單一致。
4. **美術**：路西恩／布雷茲有行走圖，基本接線不卡；其他正式 NPC 需資料與圖，活動姿勢可能需追加。
5. **待決定**：各場景 NPC 合法出生點、值勤／休息點、巡走區？
6. **衝突**：當前「在場」是資料位置判定，未等同可見或能點擊。其他角色目錄有素材也不代表已經登錄故事書／日程。

## 14. 方向鍵與艦橋鍵盤、步行接線

1. **要求**：PROGRESS 專案整理列共用鍵盤暫支援 WASD＋E、方向鍵待補、艦橋接線未合併；骨架八要求所有实际步行耗時，站立不耗。
2. **現況**：`src/components/useSceneKeys.ts::useSceneKeys/normalizeKey` 的 MOVEMENT_KEYS／axis 只認 WASD；房間、走廊、設施已用。`BridgeScene` 自己的 MOVEMENT／keydown 已支援方向鍵＋WASD＋E，`src/game/bridge.ts::updateBridgeActor` 有鍵盤運動，但 BridgeScene props 沒有 onWalk，App 也沒傳，故艦橋走路不推時間。房間／走廊首次 onMovementPress 的立即位移未經同一 onWalk 計量。
3. **檔案／測試**：需改 useSceneKeys、BridgeScene、RoomScene、CorridorScene、App；擴 `src/game/bridge.test.ts/clock.test.ts/roomActors.test.ts`，新增 hook／整合驗方向鍵、斜向速度、輸入框不攔截、blur／paused 清鍵、首步與艦橋實際位移計時。
4. **美術**：不卡。
5. **待決定**：無。
6. **衝突**：艦橋「鍵盤未做」並不符合當前程式；缺的是共用接線與時間回報。roomActors 單元測試認 Arrow，不代表 UI hook 有放行方向鍵。

## 15. 對話分段、頭像框、立繪表情與版面

1. **要求**：骨架三分段／行內標記、九要求敘述串流、///分段與漏分隔 fallback、單說話者框、描述沿用前人、頭像點擊放大、未標表情維持前值、進場回平常。對話浮在地圖下方，展開半屏、移動淡出且適用手機。
2. **現況**：`src/components/DialogueSection.tsx::DialogueSection/resolvePortrait` 已有 JSON 段落播放、單人物頭像及 URL fallback；同回合往前找 speaker，但新回合純描述沒有跨回合維持，沒 expression 時回 neutral；頭像未接放大立繪、無圖片載入失敗 fallback。`src/gm/index.ts::normalizeSegments` 使用七個英文表情。App 把對話與場景排成上下區塊，無移動淡出；`src/index.css` 已有≤760px響應式，尚未驗半屏展開與實機版面。
3. **檔案／測試**：需改 DialogueSection、App、types、GM 分段層及 index.css；擴 `src/components/portrait.test.ts`，新增描述跨回合 speaker、表情未標維持／換場清、404圖片、頭像放大、串流命令隔離、漏///測試；再做桌機／手機視覺驗收。
4. **美術**：基本框與狀態管理不卡；Blaze 缺表情，其他角色完整表情已備。若採「共用立繪＋頭部疊圖」，還需核對頭部位置與對應素材。
5. **待決定**：六表情中文規格和現行七表情如何對應？採完整表情立繪／預裁頭像雙檔，還是共用身體加頭部圖？
6. **衝突**：骨架三演出分工寫頭部疊圖，九又寫完整立繪與預裁頭像雙檔；現行雙 URL＋表情 map 未完全符合任何一套生命週期。JSON 回應後逐段播放不是網路串流。

## 16. 故事書分頁、匯入、開關與權限

1. **要求**：骨架十、十三要求人物／地點／物品／歷史／其他五頁，NPC 指定欄位、雙檔匯入、部門／房號校驗、運行資料置頂；測試期間可自由編輯，初始好感0陌生且不允許匯入進度值，條目開關要影響注入。
2. **現況**：`src/components/Modals/StoryModal.tsx` 的 `FORM_SCHEMA/handleStartAdd/handleStartEdit/handleToggleEnabled` 及 `StoryForm` 已有表單 CRUD／開關；只有人物／物品／事件／地點四頁，缺其他與明確歷史索引。人物有部門／房號／日程選項，`storyValidation::validateRoom/validateSchedules` 已校驗房號佔用／日程。`story.ts::mergeStory/splitEntries` 已拆內建、本局、覆寫，預設進度不混入內容；但沒有 NPC JSON／圖像雙檔匯入、正式名稱唯一性，人物詳情缺好感／關係／最後見面／thought／鎖日誌。
3. **檔案／測試**：需改 types、StoryModal、StoryForm、story、storyValidation、GM prompt；擴 `src/data/story.test.ts` 並新增匯入／UI測試：五頁、禁匯入好感、重名、部門／房號、disabled 退出 AI、關聯刪除提示、運行資料顯示與好感鎖。
4. **美術**：表單／權限不卡；人物雙檔需要合規圖，可先用已有角色驗證。
5. **待決定**：正式版哪些欄位可手改？測試階段不必先加權限封鎖。
6. **衝突**：文件要求五頁，現在事件頁尚不能直接等同歷史＋其他兩頁。開關雖已存覆寫，`App::presentNpcs`／GM 非人物注入未遵守；內建自訂圖像 reload 又受 `story.ts::applyCodeArt` 的程式圖像覆蓋政策影響。測試可編輯符合骨架，不把「尚未分級禁止編輯」誤列成當前阻塞。

## 17. 玩家個人資料、職業與房間分配

1. **要求**：骨架十及 OCCUPATION 要求玩家六個選填欄位、空名實值「新人」、不強制建角／不代替玩家行動；職業與房間自動分配、UI 唯讀，不給玩家修改運行欄位。
2. **現況**：`src/data/initialGameData.ts::EMPTY_PROFILE` 名稱空、職業／房號空。`src/components/Drawers/ProfileDrawer.tsx::ProfileDrawer` 可以自由填個人資料，職業／房號畫成唯讀；但本地 form 僅初始讀 profile，缺外部更新同步，整份 onSave 可能回寫舊職業／房號。`App::applyCommands` 沒 OCCUPATION，GM prompt 空名鼓勵先補資料，沒有完整不得代替玩家決定的規則。
3. **檔案／測試**：需改 initialGameData、types、ProfileDrawer、App、GM 指令／prompt、storyValidation；新增職業分配測試：已佔房不覆寫、換職業／無空房、關抽屜期間更新後再存不回滾、空欄注入、名字預設、唯讀欄位 reducer 保護。
4. **美術**：分配邏輯不卡；玩家個人房內裝另需家具。
5. **待決定**：職業→部門→居住區的映射？開局是否預設獨立宿舍，何時才分配正式空房？
6. **衝突**：骨架八玩家宿舍獨立與十選職業後分空房有差異；目前沒有任一分配流程。空名字被顯示 fallback 不等於存入「新人」。

## 18. 系統設定與模型、Token 預算

1. **要求**：骨架十二、十五要求主／助理模型、助理預設沿用主 key、兩個 Token 拉桿（主4096／助理1024）、按模型上限與內部通道預算；顯示空場景對話開關、被動機率、玩家可改日記 prompt。key 僅本機。
2. **現況**：`src/gm/settings.ts::readAiSettings/writeAiSettings` 已做 provider 分開儲存；`AiProviderFields` 和 SettingsModal 可選模型／自訂 endpoint，adapters 依兩角色設定呼叫。`src/gm/models.ts` 有模型上限，UI 有拉桿；但主助理預設均8192、助理沿主 key 預設false、助理拉桿最低2048。空場開關／機率只存設定未被 App 讀，日記 prompt 寫死在 assistant，mute 僅記憶體。
3. **檔案／測試**：需改 settings、models、SettingsModal、AiProviderFields、App、GM prompt／assistant；擴 `src/gm/settings.test.ts`，測缺省、上下限、切模型、載入越界值、沿主 key、存設定失敗回饋及兩開關真的改變行為。
4. **美術**：不卡。
5. **待決定**：骨架固定模型政策是否仍適用，或保留現在的自訂供應商？其他預算可配置待測。
6. **衝突**：預設與拉桿下限不符骨架；設定面板用 `starport_last_autosave`（儲存設定時更新）顯示最後存檔，而非遊戲 `savedAt`。設定存成功提示未處理 writeAiSettings 的false回傳。

## 19. 體力、飢餓、狀態時效與倒地

1. **要求**：骨架十一、十三、十五規定步行／時間前端自然消耗體力、時間累積飢餓；金錢與事件變化由 GM 指令，狀態可清除／到期。體力歸零前端送醫療床、固定費用、加8小時，GM 只演醒後。
2. **現況**：`HeaderHUD` 可顯示數值；`App::applyCommands` 的 adjust_stats 有邊界及 status 增減。`advanceGameTime/handleWalk` 只推時間、物資、日程，沒有體力／飢餓／狀態期限 reducer。`src/game/roomBed.ts::interactBed/leaveBed` 是姿勢切換，沒有睡眠恢復；體力0沒有送醫流程。
3. **檔案／測試**：需改 types、App、clock、persistence、GM 指令；新增狀態 reducer／測試：跨日大量時間、步行與 GM 時間不重複扣、期限清除、僅一次倒地、+8h、扣費、送醫時取消路徑、醒後敘事不再扣費。
4. **美術**：數值／倒地 reducer 不卡；實體醫療床與醫療室場景卡美術，見28。
5. **待決定**：每步／時間消耗、飢餓級距、醫療費、體力恢復量、是否允許金錢不足時負債？日常睡眠／進食效果如何定義？
6. **衝突**：目前任何數值變動都靠 GM，與自然消耗／倒地由前端處理不同；有床可躺不能算睡眠回復玩法完成。

## 20. 地圖、傳送點、步行出口與移動時間

1. **要求**：骨架八、十五、十七要求環狀連通、內側道路獨立、輻條塔只入口、機能切場景；固定傳送點、距離級距＋垂直、交通工具降低級距，走路比同距離傳送略慢。AI 敘事地點不可自動變實體場景入口。
2. **現況**：`MapModal` 顯示星圖，`App::handleEnterSector/commitSector` 推傳送時間；`src/game/clock.ts::travelTier/travelMinutes/walkMeter` 有0／3／8／15／20分鐘及餘數累積。`src/game/corridor.ts::leftEdgeExit/rightEdgeExit/spawnOutside` 已有 A/B↔溫室、C/D↔工程步行；facilities 的 entrances 可返回。缺內側道路／部分設施／交通效果與實體入口限制。`travelTier` 遇未知 ID 當相鄰；故事書新增地點會流進同一 sectors 星圖。
3. **檔案／測試**：需改 types、initialGameData、MapModal、App、clock、corridor／facility 入口；擴 `src/game/clock.test.ts/corridor.test.ts/facility.test.ts`，驗步行出口不再扣傳送、垂直級距、非法／敘事入口、交通工具、往返落點及門／招牌權責。
4. **美術**：計時／入口限制不卡；內側道路、完整設施與中央廣場底圖卡美術。
5. **待決定**：機能各自切場景還是廣場合併？交通工具降幾級、最低級距？廣場十字出口直接進設施還是開星圖？
6. **衝突**：骨架按機能切餐廳等，plaza v2 把店面與座位放單張廣場。A 溫室招牌已是裝飾，其他走廊 `CorridorScene` 的 sign 分支仍可對已登錄 FACILITIES 轉場，與招牌／出口分離原則尚未全面一致。當前時間數值明列暫定，不擅自改成別的值。

## 21. 居住區門牌、門鎖與艙房配置

1. **要求**：骨架八、十、十六要求房號固定、未認識住户不顯姓名且不能開門；LOCATION_DISCOVER 解鎖、無保底好感門檻；房間與 NPC 配房校驗。
2. **現況**：`initialGameData::ROOMS/ROOMS_PER_SECTOR` 是4×6共24。`corridor.ts::doorRoomId/interactions/spawnOutside` 已對應每區六門、進出同門。`App` 進門沒有 discovery／lock 檢查；故事書 `validateRoom` 已避開 NPC／玩家重房，但無自動分房，所有房可進。
3. **檔案／測試**：需改 initialGameData、types、storyValidation、App、CorridorScene、corridor 與 manifest；擴 `src/data/story.test.ts/corridor.test.ts`，驗未知住户隱名鎖門、DISCOVER 只解指定房、無好感保底、每門一房、資料／圖／日程一致。
4. **美術**：門鎖規則不卡；若改每區八門，走廊圖、門牌與碰撞／落點需一起重排。
5. **待決定**：採四區各六（24）還是各八（32）？玩家獨立宿舍／保留空房及 NPC 總數如何配？先統一文件再改數量。
6. **衝突**：骨架八同時寫「每區八間」及「共24間」；十／十六又有32與四區各八定案。程式與測試目前固定24，不自行判哪份勝出。

## 22. 共用房間底圖、個人擺設切換底層

1. **要求**：骨架八要求共用固定艙房 shell、每人自己的 furniture／decals／碰撞與活動點，隨配房套用，沒擺設時可用空房。
2. **現況**：`src/game/roomRuntime.ts::furnishingFor/setActiveRoom` 已保留 SHELL，重建 PIECES／SOLIDS／SEATS／BED／PATROL；App 呼叫 `src/data/story.ts::findRoomOccupant`，RoomScene 按房客套家具。路西恩一套完成，布雷茲／空房回 EMPTY_FURNISHING。`roomRuntime.test.ts` 已驗另一擺設替換、空房、即時碰撞／座位／床／巡走及圖檔存在。此「底層」完成，不含全部人物裝潢。
3. **檔案／測試**：底層無必修；日後新增 `public/assets/rooms/furniture/<人物>/` 與配置時維護 roomRuntime／roomRuntime.test，驗門口可達、座位床可起身、家具原位不殘留。
4. **美術**：其他人物家具仍缺，但不阻塞底層驗收，另外列美術待辦。
5. **待決定**：底層無；各人物裝潢需另外定配置。
6. **衝突**：沒有發現此切換底層與骨架衝突；不能從此完成推導所有艙房個人素材完成。

## 23. 自動植栽生長與工作站報表

1. **要求**：PROGRESS 溫室要求19作物、12排、依遊戲時間三階段、週期自動採收補種、不需逐株存檔；工作站列生長階段與倒數，查詢不放全局儀表板。
2. **現況**：`src/game/growth.ts::dayNumber/progress/stageAt` 已依週期與排位相位計算。`racks.ts::layoutRack` 畫三階段，`growthReport.ts::growthReport/describeRow` 列報表，`App::handleFacilityAction` console 開 GrowthModal。GM 收報表並受 prompt「先到工作站查詢」規則限制。依當前範圍完成。
3. **檔案／測試**：無必修；調參維護 growth／growthReport／supplies 及 `growth.test.ts/growthReport.test.ts/racks.test.ts/supplies.test.ts`，驗週期wrap與收成同步，不另存重複生長進度。
4. **美術**：不卡，19種三階段及架子已有；僅歷史文件部分副檔名仍寫PNG，程式／測試實際用WebP。
5. **待決定**：無阻塞；CYCLE_DAYS／產量可實測後調。
6. **衝突**：未發現計算流程衝突；健康照顧與玩家菜圃是獨立未完成項，見24／25，不混算已完成。

## 24. 植栽健康與照顧玩法

1. **要求**：PROGRESS 已明列健康目前模擬，下一步要有可玩的照顧；左右監測機需反映該翼作物與健康。
2. **現況**：`src/game/monitor.ts::healthOf/monitorRows` 依作物／排／日的雜湊，生成同日穩定的健康／缺水／黃葉／蚜蟲；`MonitorModal` 展示，`App::handleFacilityAction` 可開左右翼。沒有持久健康、照顧指令、成本／耗時或對成長／收成的影響。
3. **檔案／測試**：需改 monitor、growth、supplies、types／persistence、App、MonitorModal／FacilityScene；新增照顧 reducer／測試，同日處理不隔次刷新復發、跨日演變、消耗工具、進度與產量效果、存讀一致。
4. **美術**：基本按鈕／既有監測機不卡；若指定病害作物外觀、灑水／除蟲動作需新圖。
5. **待決定**：每種健康問題對應哪些動作、工具與耗時？健康會否拖慢生長／減產，能否放任？作用粒度按株或排？
6. **衝突**：目前健康是每日模擬，不會因玩家做事而改善；PROGRESS 明確稱尚無玩法，未與已完成生長規則混同。

## 25. 玩家菜圃

1. **要求**：派工指定盤點玩家菜圃；地點／溫室資料有玩家種植區，但沒有完整經濟／種植規則。
2. **現況**：`public/assets/greenhouse/map.json` 有一片 plots。`src/game/facility.ts::interactions` 建立 plot-1，FacilityScene 可點擊／走近；`App::handleFacilityAction` 不處理 plot，沒有種子／播種／澆水／採收狀態，作物渲染亦無玩家種植存檔。
3. **檔案／測試**：需改 types、persistence、App、FacilityScene、facility／growth，必要時加專用菜圃模組；新增播種空格／佔格、成本不足、跨日生長、重複採收、存讀與背包收成測試。
4. **美術**：現有作物與菜圃用具可重用；空土／各階段地栽配置、動作或工具圖需依規則確認。
5. **待決定**：可種什麼、幾格、種子來源／價格、照顧需求、枯萎與收成歸玩家還是物資帳？
6. **衝突**：`../專案目錄.md` 的菜田小物安排與 PROGRESS「菜田小物與庭園燈不擺」不同；場上已有 garden_tools 不代表恢復舊小物全套或玩法已做。不自行把自動架子的週期照搬玩家菜圃。

## 26. 物資帳與中央公園餐廳送貨

1. **要求**：PROGRESS 要求溫室自動收成入籃、玩家裝推車送餐廳、餐廳每日消耗、庫存級距給 GM，物資存檔；plaza v2 有餐廳進貨口。
2. **現況**：`src/game/supplies.ts::harvestBetween/tick/pickUp/deliver/gmSupplyLines` 已做產出／消耗／籃容量／推車守恆／級距，App 已接時間及存檔。map 有 shipping 出貨籃，`App::handleFacilityAction` 可裝車；`commitSector` 一進 park 自動 `deliver(...,'restaurant')`，沒有進貨口、卸貨動作、餐廳實體接線。
3. **檔案／測試**：需改 App、FacilityScene／餐廳場景、map interactions、supplies；擴 `supplies.test.ts/facility.test.ts`，驗入廣場不誤送、到進貨口才交付、重複交付、載量、跨日守恆、庫存等級與GM一致。
4. **美術**：物資帳／交付判定不卡；餐廳底圖與進貨口尚缺，推車可見化可能另需圖。
5. **待決定**：到進貨口按 E 交付還是靠近即卸？營業外可送嗎？送貨耗時、報酬／任務與推車移速要不要有？
6. **衝突**：目前能完成數字送貨，但到 park 即轉帳與「餐廳進貨口」配置有差距；PROGRESS「玩家送到餐廳」不可據此算完整場景玩法。產量／消耗暫定不是算帳缺失。

## 27. 中央廣場、餐廳、酒吧與商店

1. **要求**：PROGRESS／`docs/scenes/plaza.md` v2 要求圓廣場十字出口、中央塔遮擋透明、電梯、東北餐廳進貨口、西北酒吧、物資／服飾小店及座位；餐廳08–20、酒吧20–02、小店24h。
2. **現況**：`initialGameData::INITIAL_SECTORS` 有 park；`App::commitSector` 支援傳送與送貨數字。`SceneLayer` 可 fallback，但沒有 PlazaScene／plaza map、店面營業／購買／換裝流程，規劃圖不是遊戲底圖。
3. **檔案／測試**：後續新增場景、地圖與專用互動資料，接 App、facility／clock、物資與背包；新增營業跨午夜、買賣／資源不足、進貨口、塔透明深度、電梯只主動開星圖、十字往返碰撞可達測試。
4. **美術**：卡，v2 配置確認後才做底圖與店面／座位／塔圖層；依現行素材流程處理。
5. **待決定**：文件六題：店內是否切場景、出口直連或星圖、中央公園／廣場名稱、服飾店用途、店員固定命名、碼頭是否做場景？v2 配置是否定稿？
6. **衝突**：`地點.md` 仍有電子投影，而 PROGRESS／plaza v2 已刪除；骨架八按機能切場景與廣場合併配置不同。此處只記錄並存要求，不恢復已刪除投影。

## 28. 研究室與醫療室場景、玩法

1. **要求**：骨架八、十一、地點文件及派工要求研究／醫療場景，醫療承接體力歸零送床、睡8小時醒後演出。場景互動需依各自功能設計。
2. **現況**：`initialGameData::INITIAL_SECTORS` 有 lab／medical，clock.RING 有路線；`src/game/facility.ts::FACILITIES` 只註冊溫室／工程，App 兩區走 SceneLayer fallback。沒有地圖、碰撞、研究互動／醫療床或倒地落點。
3. **檔案／測試**：新增對應 map／場景互動，接 App、facility、clock、日程及狀態 reducer；擴 `facility.test.ts/clock.test.ts`，新增研究流程與醫療落點／扣費／8h／恢復驗證。
4. **美術**：卡，兩場景底圖、機台／醫療床與前景，需先分區配置。
5. **待決定**：研究能做哪些動作、產出／進度／成本？醫療室布局、服务與費用？是否採通用 FacilityScene？場景落點如何與倒地一致？
6. **衝突**：星圖能傳到節點不等於可遊玩的室內已做；地點背景描述不能替代完整研究玩法規格，未擅自新增科技樹。

## 29. 場景分層、特效與工程區新風格接入

1. **要求**：`場景渲染架構.md` 的靜態背景、動畫物件、Shader、粒子、角色、前景、可選燈光需分責；碰撞／點擊／E範圍分離，不加常識提示，實際回應靠物件。PROGRESS 要把工程機台換2050高科技風，地面沿用。
2. **現況**：`FacilityScene/RoomScene/BridgeScene` 已用Canvas2D與前景深度，`src/game/sceneDepth.ts::drawBeforePlayer` 處理遮擋；facility 的門 `stepDoor`、魚 `spawnFish/stepFish`、季節 `spriteFor` 及艦橋 `src/game/bridgeRender.ts::drawBridge` 有局部動畫。沒有通用 GPU Shader／粒子生命週期／光源層；CSS 掃描線和 Canvas 動態不等同這些系統。工程 map 已擺14舊風機台，13件新風精密／大型圖作備品尚未接入，物流最终圖已決定不做。
3. **檔案／測試**：需按選定範圍改 Scene／render 模組、工程 map／props metadata、碰撞重建與素材腳本；擴 `sceneDepth.test.ts/facility.test.ts/decor.test.ts`，新增動效暫停、物件生命週期釋放、人物遮擋與機台新尺寸可達測試；實際瀏覽器驗幀率與層次。
4. **美術**：工程新風13件已有，替换需配置與碰撞；額外特效／動畫貼圖按採用項目而定。物流不做最終圖、休息安全角不重畫，不能當成缺圖待補。
5. **待決定**：哪些場景真的要 Shader／粒子，接受何種Canvas／GPU實作？工程13備品替換哪14舊機台及擺位？2050是世界年代還是美術風格基準？
6. **衝突**：GM prompt／遊戲時鐘是2154，PROGRESS 新風描述是2050，需釐清是否年代衝突；舊工程可遊玩與「需換新風」可同時成立。`../專案目錄.md` 的工程未完成說法落後現況。`場景渲染架構.md`要求回應靠物件，部分房間／艦橋通知仍是 viewport 面板，需視覺核對。Lighting 本來可選，不列成必修阻塞。

## 30. Google 登入、主選單與雲端存檔

1. **要求**：骨架十二要求開站同頁Google登入與key→主選單→新／讀／設定；雲端唯一權威、本機備份、無離線模式、不限存檔槽，key不上雲。
2. **現況**：`src/main.tsx` 直接render App；`App` 本機載入並自動保存，`persistence::writeGameSave` 只寫localStorage。沒有OAuth、主選單、雲端API／同步状态，SettingsModal登出僅提示，沒有真實session。
3. **檔案／測試**：需新增認證／雲端儲存層與登入／選單介面，改main、App、persistence、SettingsModal；新增認證失敗、帳戶隔離、槽CRUD、同步衝突／斷線、雲端失敗不顯示成功及key不出網路payload測試。
4. **美術**：不卡。
5. **待決定**：採哪個Google認證／雲端服務、帳戶與資料權限、同步衝突策略、既有本機進度如何匯入？這些屬於外部服務決策。
6. **衝突**：骨架雲端權威／不離線與目前純前端本機進度不同；persistence註解也明說沒有後端。此次使用者「不與GitHub同步」指專案工作流程，不能推導成已取消玩家雲端存檔規格。

## 美術阻塞另表

| 相關系統 | 已有可用素材 | 尚缺／需確認 | 可先做的程式 |
|---|---|---|---|
| 13／15 NPC 顯示與表情 | 兩個已登錄NPC行走圖；Aiden、Ethan、Luca、Lucian表情 | Blaze表情；其他NPC資料與活動姿勢；立繪組合規格 | 共用名單、落點、表情狀態與fallback |
| 17／21／22 艙房 | 共用shell、路西恩家具、各區六門 | 玩家／其他住戶裝潢；若32房則八門走廊重排 | discovery、門鎖、分房校驗與家具配置介面 |
| 20 地圖擴充 | 既有走廊、溫室、工程、艦橋 | 內側道路、其他實體設施入口與前景 | 入口資格、計時、敘事地點與實體地點分離 |
| 24／25 健康／菜圃 | 19作物三階段、監測機、土區、用具 | 規則確定後才評估病害外觀／地栽／動作圖 | 健康與菜圃資料、存檔、純規則測試 |
| 26／27 餐廳送貨／廣場 | v2規劃圖、物資帳 | 廣場底圖、塔、店面、進貨口；推車外觀視需求 | 交付 reducer、營業時間、購買／庫存規則 |
| 28 研究／醫療 | 星圖節點 | 底圖、研究機台、醫療床、互動配置 | 狀態倒地與8h結算、場景配置格式 |
| 29 工程新風／效果 | 新風13件備品與現行工程地圖 | 替換配置確認；特效依選用項目 | metadata、碰撞／互動與位置接線 |

## 必須保留給使用者的文件衝突

- **房數與玩家住宿**：骨架八「每區八間、共24」／十與十六32；程式4×6；獨立宿舍與選職業分空房並存。影響地圖素材、故事書、日程及分配，不先改。
- **GM 權責／協定**：骨架主GM COMMANDS、助理提煉／進展摘要／目標、主GM玩家日記；程式JSON八指令、主GM摘要／目標、助理玩家日記。派工Phase3「GM生成」需明確是哪個角色。
- **場景切分與廣場**：骨架機能分場景；v2單張廣場多店。地點投影描述與v2刪除也不一致。
- **表情與素材**：六中文表情／現行七英文、共用身體頭部圖／完整立繪雙檔，需統一對應。
- **設定／儲存**：固定模型與自訂provider、4096／1024與8192／8192、本機單槽與Google雲端多槽、新局保留故事書與清runStory，皆需區分已定規格和目前開發版行為。
- **年代與工程進度**：2154時鐘／2050風格表述可能只屬美術年代，不自行更改世界年；專案目錄舊進度不代表現行工程未完成。

## 驗證紀錄與交件範圍

- `npm run lint`：通過（目前腳本是 `tsc --noEmit`）。
- 嘗試對 `src/` 全部26個 `*.test.ts` 執行 `node --import tsx <測試檔>`：26個都在 tsx／esbuild 初始化時因 `spawn EPERM` 結束，未到測試斷言。這是此次環境執行限制，不能聲稱測試通過，也不能據此判定26個業務邏輯失敗。
- 未執行 build，避免額外生成檔案；未呼叫真實AI／登入／雲端，也未做瀏覽器視覺驗證。UI相關結論依讀碼，需後續實作單補視覺驗收。
- 既有測試覆蓋的是已做底層（路徑、碰撞、家具、日程、物資等），不等於未接入的記憶／雲端／被動玩法已符合骨架。盤點中的測試建議皆未實作。
- 此次交件僅 `docs/SYSTEM_GAPS.md`；既有未提交變更保持原狀，不更新PROGRESS／修正紀錄、不commit／push／pull。

## 最該先做的三件事

1. **GM 輸出與 COMMANDS 驗證／拒收**：數值、任務、發現地點與記憶寫入都依賴它；先有可測的指令邊界與拒收紀錄，避免錯誤輸出直接污染進度。新版核心不卡美術，舊版相容可另定。
2. **六通道資料結構與注入組裝**：目前GM看不到大部分故事書／日記，areaMemories無寫入；先做前端確定性選取與可測prompt，才有基礎接②回寫、場景快取、摘要與日記。
3. **好感度與關係數值**：−100下限、每日正負各10與午夜重置已經明確，改動範圍小且不卡美術；同時为日程解鎖、NPC日誌閱讀與不在場記憶注入提供可靠條件。
