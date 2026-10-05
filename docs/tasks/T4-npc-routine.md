# 派工單 T4：NPC 一日作息模板（含機率）

指派：Codex　｜　驗收：Claude Code　｜　開單：2026-10-05

開工前先讀 `AGENTS.md`、`docs/SYSTEM_GAPS.md` 第 12、13 節、`src/data/npcSchedule.ts`（含測試）、`src/types.ts` 的 `NpcEntry`／`NpcSchedule`／`ScheduleSlot`、`src/App.tsx` 的 `relocateNpcs`、`docs/scenes/plaza.md`。一律用繁體中文。

## 背景

使用者定了全體 NPC 的一般作息（2026-10-05）。實際替每位 NPC 排部門、遊蕩清單要等所有 NPC 建好後才做，**這張單只做系統功能，不替任何 NPC 填資料**。

## 作息規則（使用者定案）

| 時段 | 在哪裡 |
|---|---|
| 02:00–09:00 | 自己的房間（`roomId`） |
| 09:00–12:00 | 上班：所屬部門（`department`） |
| 12:00–14:00 | 午休：70% 餐廳，30% 從「自己的遊蕩清單」挑一個地方 |
| 14:00–17:00 | 上班：所屬部門 |
| 17:00–20:00 | 70% 餐廳，30% 從自己的遊蕩清單挑一個地方 |
| 20:00–02:00 | 30% 去酒吧（全員同一機率）；沒去的回自己房間 |

- 70%、30%（酒吧）寫成具名常數，放在同一處，之後要調只改那裡。午休時段也寫成常數。
- 餐廳營業 08:00–20:00、酒吧 20:00–02:00，都在中央廣場（現行地點 id `park`）。

## 要做的

1. **資料模型**：`NpcEntry` 新增遊蕩清單欄位（例如 `haunts?: string[]`，內建地點或房號 id）。沿用既有的 `department`、`roomId`。
2. **作息模板查表**：在 `src/data/npcSchedule.ts` 實作模板，回傳 NPC 在某日某小時的位置。
   - **機率要可重現**：同一位 NPC、同一天、同一個時段區塊，只擲一次，結果固定（用 NPC id＋遊戲日期＋時段區塊當種子的確定性雜湊，不用 `Math.random`）。重新整理頁面、存讀檔、同一時段內多次查詢，位置都不能跳。
   - **缺資料的退路**：沒有 `department` 時，上班時段改用遊蕩清單；遊蕩清單是空的，就留在中央廣場；沒有 `roomId` 時，該在房間的時段回傳 null（不在任何場景），不要編房號。
3. **餐廳與酒吧要分得出來**：兩家店都在 `park`，但 GM 和之後的廣場場景需要知道 NPC 在哪一家。先查現有程式與 `docs/scenes/plaza.md` 有沒有子地點的設計；沒有的話，位置仍回 `park`，另外帶一個場所標記（例如 `venue: 'restaurant' | 'bar'`），並讓 GM 拿到的在場 NPC 資訊看得到「在餐廳／在酒吧」。做法在回報裡說明。
4. **和既有日程分層的關係**：既有的 特殊事件 > 好感解鎖 > 值勤 > 保底 不變；**模板放在最底層**，只有手寫的分層在那個小時都沒涵蓋時才用模板。沒有任何手寫日程的 NPC 就完全照模板走。`validateSchedules` 和故事書編輯要允許「完全沒有手寫日程、由模板決定」的角色存檔（T1 已允許既有角色空日程，確認一致）。路西恩、布雷茲現有的暫定日程不要動。
5. **重算時間點**：`CHECKPOINTS` 改成跟作息切換點一致：02:00、09:00、12:00、14:00、17:00、20:00。確認 `crossesCheckpoint`、`planRelocation` 與 App 的重算流程照常運作（NPC 進出玩家眼前的變動仍要延後到換場景才套用）。
6. **故事書人物頁**：加上遊蕩清單的編輯（從內建地點與房號多選），顯示在日程編輯附近；並用一行字說明「沒有手寫日程時依一般作息」。

## 測試

在 `src/data/npcSchedule.test.ts`（或新測試檔）至少涵蓋：

- 每個時段的位置正確（02、09、12、14、17、20 的邊界前後）。
- 同 NPC 同日同時段多次查詢結果相同；換日期會重新擲。
- 大量 NPC×日期抽樣時，餐廳比例約 70%、酒吧約 30%（給合理容差）。
- 缺 `department`、空遊蕩清單、缺 `roomId` 的退路。
- 手寫分層優先於模板。
- 新的 `CHECKPOINTS` 跨越判斷。

## 不要做

- 不要替任何 NPC 填 `department`、`haunts`、`roomId` 或日程。
- 不要動 `tools/art/candidates/`（另一張單在做）、`public/assets/`、工程區與中央廣場的美術檔。
- 工作目錄裡有使用者未 commit 的修改（工程區、中央廣場、skill 文件、`docs/PROGRESS.md` 的工程區段落、`AGENTS.md`、`src/game/facilityContext.ts`），一律不碰；需要記進度時只在 `docs/PROGRESS.md` 的「全遊戲系統」段落追加。
- 不要 commit、不要 push、不要 `git pull`。
- Python 不需要；如果用到，沙箱可能無法執行系統 Python，改用 Node。

## 驗證

- `npm run lint`、`npm run build`
- `node --import tsx src/data/npcSchedule.test.ts`、`src/data/story.test.ts`、`src/game/roomActors.test.ts`、`src/game/roomRuntime.test.ts`、`src/components/portrait.test.ts`，以及你新增或改到的測試。

## 回報

最後一則訊息條列：改了哪些檔、模板與分層怎麼接、餐廳／酒吧的區分做法、可重現擲骰的種子組成、測試結果、需要使用者決定的事。
