# 派工單 T1：補齊 public/assets 裡角色的素材並接進遊戲

指派：Codex　｜　驗收：Claude Code　｜　開單：2026-10-05（第三版：拿掉 player）

開工前先讀 `AGENTS.md`、`docs/characters.md`、`src/types.ts` 的 `NpcEntry`、`src/data/initialGameData.ts`。一律用繁體中文寫文件與回報。

## 範圍（第二版）

**只處理 `public/assets/` 裡已經有的 NPC**：Aiden、Ethan、Luca、lucian、blaze。
**player 不做**：玩家造型由玩家自訂，只保留行走圖，`public/assets/player/` 一律不動，也不要生玩家的頭像、立繪、表情（上一輪生成的玩家立繪作廢）。
專案外的 `../character 設定稿/` 一律不讀、不寫；Sevi、Mitchell、Noah 和「未定案」的角色都不做。上一輪生成的 Noah、Sevi 表情表作廢，不要使用。

## 每位角色的標準檔案

放在 `public/assets/<id>/`，id 一律小寫：`aiden`、`ethan`、`luca`、`lucian`、`blaze`。
`public/assets/Aiden`、`Ethan`、`Luca`（大寫）改成小寫目錄（Windows 不分大小寫，用 `git mv` 兩段式改名）。程式裡目前沒有引用這三個大寫目錄。

| 檔名 | 規格 | 用途 |
|---|---|---|
| `portrait.webp` | 512×512 | 角色卡（cardUrl） |
| `profile.webp` | 540×960，全身立繪 | 故事書大圖（fullBodyUrl） |
| `neutral.webp` `happy.webp` `sad.webp` `angry.webp` `surprised.webp` `shy.webp` | 514×514，六張同一構圖 | 對話框頭像與表情（portraitUrl 用 neutral） |
| `walk.webp` | NPC：688×688 透明，4×4 格，每格 172，腳底 y=166 | 行走圖（walkUrl），規格見 `tools/pack_walk_sheet.py` |

全部無損 WebP。

## 各角色要做的

- **lucian**：已齊全，不動。
- **aiden、ethan、luca**：素材都在，只要整理。
  - `normal.webp` → `neutral.webp`，`troubled.webp` → `sad.webp`，其餘表情同名。
  - `Walk.webp`（1254×1254，已透明）用 `tools/pack_walk_sheet.py` 整理成 688×688 的 `walk.webp`，舊的大檔刪掉。
- **blaze**：缺六張表情。上一輪已生成一張 2×3 表情表，Claude Code 看過、可用，已存在 `tools/art/characters/raw/blaze/expressions_sheet.png`（1024×1536，由左至右、由上而下推測為 neutral、happy、sad、angry、surprised、shy，請自己看圖確認對應）。**直接用這張切**，不要重生；切出來若有問題寫在回報裡。

## 生圖規則（原則上這次不需要生圖；若 blaze 表情表確實不能用才重生）

- 用內建 imagegen，**一定要把參考圖給模型**，臉、髮型、服裝、配色要一致。
- 畫風對齊現有角色：參考 `public/assets/lucian/*.webp`、`public/assets/Aiden/*.webp`。
- 表情圖：胸口以上、白底、六張的角色位置與大小完全相同（換表情時頭不能跳位），可加小漫畫符號（怒筋、亮點、驚嘆號、臉紅斜線）。建議一次生成 2×3 的六格表情表再用腳本切。
- 生成的原圖存 `tools/art/characters/raw/<id>/`，提示詞記在 `tools/art/characters/prompts.md`。

## 處理規則

- 改名、轉檔、縮放、切表情表、整理行走圖，全部寫成可重跑的腳本 `tools/art/characters_build.py`（可以呼叫 `tools/pack_walk_sheet.py`）。重跑要得到同樣結果，不手動改像素。
- Python 用系統的 `python`（有 Pillow、numpy）；`tools/.venv` 在這台電腦是壞的，不要用。

## 接進遊戲

- `src/data/initialGameData.ts` 的 `INITIAL_NPCS`：
  - blaze 補上 `expressionUrls`，`portraitUrl` 改用 neutral。lucian 不動。
  - 新增 aiden、ethan、luca 三筆 NPC，`source: 'builtin'`。中文名先用音譯（艾登、伊森、盧卡），`appearance` 看圖寫一句外觀描述；`age`、`position`、`personality`、`background` 留空字串，`other` 寫「人物設定待補。」**不要編造**房號、日程、部門。
  - 每位 NPC 都要有完整的 `portraitUrl`（= neutral）、`fullBodyUrl`、`cardUrl`、`walkUrl`、`expressionUrls`（六個鍵）。
  - 更新上方註解（現在寫著只有路西恩、布雷茲）。
- 確認沒有房號與日程的 NPC 不會讓任何地方壞掉（日程查詢、房間演員、故事書）。
- `src/components/portrait.test.ts` 加一段：每位內建 NPC 的 `expressionUrls` 每個路徑，以及 `portraitUrl`、`fullBodyUrl`、`cardUrl`、`walkUrl`，都要對應到 `public/` 底下實際存在的檔案。

## 文件

- 更新 `docs/characters.md`：五位 NPC 與玩家的素材表（玩家註明：造型自訂，只有行走圖）、檔案規格、`characters_build.py` 的用法、表情改名對應（normal→neutral、troubled→sad）、哪些是生圖。NPC 行走圖格式寫 4×4、688×688（現在文件寫的 4×3 只適用玩家）。

## 驗證（交件前自己跑，結果寫進回報）

- `npm run lint`
- `npm run build`
- `node --import tsx src/components/portrait.test.ts`
- `node --import tsx src/data/story.test.ts`、`node --import tsx src/game/roomActors.test.ts`、`node --import tsx src/game/roomRuntime.test.ts`
- 輸出一張總覽圖 `tools/art/characters/review_sheet.png`：每位角色一列，依序 portrait、profile、六表情、walk 第一列四格，方便驗收。

## 不要做

- 不要 commit、不要 push，也不要 `git pull`（這個專案是本機單機作業，不跟 GitHub 同步）。驗收過後由 Claude Code commit。
- 不要動和本單無關的檔案。工作目錄裡有其他未 commit 的修改（工程區、中央廣場、skill 文件），一律不碰。
- 不要讀寫 `../character 設定稿/`。

## 回報

最後一則訊息用條列寫：每位角色交了哪些檔、哪些是生圖、哪些是轉檔、遇到的問題與取捨、驗證指令的結果。
