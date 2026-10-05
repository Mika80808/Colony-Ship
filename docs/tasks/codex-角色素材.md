# Codex 任務單：角色素材

指派：Claude Code　執行：Codex（生圖）　驗收：Claude Code

## 盤點結果（2026-10-05）

執行 `python tools/check_character_assets.py` 的結果：

| 角色 | 頭像／表情 | 立繪 | 行走圖 | 要生的圖 |
|---|---|---|---|---|
| 路西恩 lucian | 齊全 | 有 | 有 | 無 |
| 艾登 Aiden | 齊全 | 有 | 有（已正規化） | 無 |
| 伊森 Ethan | 齊全 | 有 | 有（已正規化） | 無 |
| 路卡 Luca | 齊全 | 有 | 有（已正規化） | 無 |
| 布雷茲 blaze | 只有一張半身像 | 有 | 有 | 六張表情圖（任務 1） |
| 玩家 player | 不做 | 不做 | 有 | 無（外觀由玩家自填） |

## 任務 1：布雷茲六張表情圖

狀態：完成（2026-10-05 由 T1 一併處理，見 `docs/tasks/T1-characters.md`；布雷茲表情表在 `tools/art/characters/raw/blaze/expressions_sheet.png`）

### 參考圖

- 主要參考（構圖、臉、服裝都照它）：`public/assets/blaze/portrait.webp`
- 補充參考（服裝細節）：`public/assets/blaze/profile.webp`、`tools/art/blaze/raw/bust.webp`
- 表情組範例（看一套表情怎麼維持同構圖）：`public/assets/lucian/neutral.webp`、`happy.webp`、`sad.webp`

### 角色外觀（每張都要一致）

銀灰色蓬鬆中短髮、瀏海略遮右眼，藍灰色眼睛，膚色偏小麥色，32 歲成年男性、身材高大。黑色軍裝風長外套，金色肩章與金色飾繩，胸前有星形徽章與勳表，領口敞開露出黑色襯衫，脖子戴銀色狗牌項鍊。

### 交件規格

- 六張：`neutral`、`happy`、`sad`、`angry`、`surprised`、`shy`。
- 存到 `tools/art/blaze/raw/expressions/<表情>.png`，例如 `tools/art/blaze/raw/expressions/happy.png`。
- 1024×1024 正方形，純白背景 `#FFFFFF`（跟 portrait.webp 一樣），不要格紋、不要洋紅、不要場景。
- 六張構圖完全一樣：跟 `portrait.webp` 同樣的半身取景、頭的位置與大小、肩線位置，只換表情（眉、眼、嘴、臉頰、頭部微傾）。切換表情時頭不能跳位。
- 畫風照 `portrait.webp`：動漫半身像、乾淨線稿、柔和上色。

### 提示詞

每張都附上 `public/assets/blaze/portrait.webp` 當參考圖，共用前段＋各自的表情句：

共用前段：

> Edit this character portrait. Keep the exact same character, outfit, art style, camera framing, head position, head size and shoulder line as the reference image. Pure white #FFFFFF background, no checkerboard, no scenery, no text. Square 1024x1024. Only change the facial expression:

各表情：

| 檔名 | 表情句 |
|---|---|
| neutral | calm neutral expression, relaxed mouth closed, steady confident gaze at the viewer |
| happy | big hearty grin showing teeth, eyes slightly narrowed with joy, carefree and generous |
| sad | brows tilted up in the middle, eyes lowered, mouth a small tight frown, quietly sad |
| angry | brows sharply furrowed, glaring eyes, jaw clenched, mouth bared in a scowl |
| surprised | eyebrows raised high, eyes wide open, mouth open in an O shape |
| shy | awkward embarrassed smile, light blush on cheeks, eyes glancing to the side |

### 交件前自檢

    python tools/check_character_assets.py --raw tools/art/blaze/raw/expressions

印出「原圖驗收通過」才交件。

### 交件方式

- 只新增 `tools/art/blaze/raw/expressions/` 底下的圖，不要改 `public/assets/`、`src/`。
- commit 訊息：`布雷茲表情圖原圖（Codex）`，push 到 GitHub。
- 在本檔「任務 1」的狀態改成「待驗收」。

## 驗收（Claude Code 負責）

1. 跑上面的自檢指令。
2. 目視：六張是同一個人、同一套衣服、頭不跳位、表情看得出差別。不過的那張退回重生，在本檔寫明原因。
3. 通過後：`python tools/prepare_expressions.py tools/art/blaze/raw/expressions public/assets/blaze` 轉成 514×514 遊戲素材；`initialGameData.ts` 的布雷茲接上 `expressionUrls`，`portraitUrl` 改用 `neutral.webp`、`cardUrl` 維持 `portrait.webp`；跑 lint、build、`src/components/portrait.test.ts`。
4. 更新 `docs/PROGRESS.md`、`docs/characters.md`，任務狀態改「完成」。
