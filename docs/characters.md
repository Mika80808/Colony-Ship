# 角色素材

## 素材清單

| 角色 | 位置 | 內容與處理來源 |
|---|---|---|
| Aiden（艾登） | `public/assets/aiden/` | 角色卡、全身立繪、六表情、行走圖；整理既有素材，未生圖 |
| Ethan（伊森） | `public/assets/ethan/` | 角色卡、全身立繪、六表情、行走圖；整理既有素材，未生圖 |
| Luca（路卡） | `public/assets/luca/` | 角色卡、全身立繪、六表情、行走圖；整理既有素材，未生圖 |
| Lucian（路西恩） | `public/assets/lucian/` | 角色卡、全身立繪、六表情、行走圖；已齊全 |
| Blaze（布雷茲） | `public/assets/blaze/` | 角色卡、全身立繪、六表情、行走圖；六表情切自已生成的表情表 |
| 玩家 | `public/assets/player/` | 造型自訂，只有行走圖；不做頭像、立繪、表情 |

五位 NPC 已在 `src/data/initialGameData.ts` 的 `INITIAL_NPCS` 設定完整素材路徑。艾登、伊森、路卡只填中文音譯名與看圖所得的外觀，其餘人物設定與部門待補。2026-10-27 起房號暫排 A-3（艾登）、A-4（伊森）、A-5（路卡），日程暫定整天在自己房間；房間沒有個人陳設，是空的共用殼層。定好部門後依「居住區對映鄰近工作區」改房號與日程（故事書可直接改）。

既有瀏覽器的內建內容仍以已儲存的故事書為準，新增三位 NPC 可由設定面板的「從程式碼補上缺少的內建條目」加入；新瀏覽器直接使用五位 NPC 的種子。素材欄位載入時會以程式碼版本更新，因此既有布雷茲也會套用新表情。

## NPC 標準檔案

五個目錄皆使用小寫 id，所有遊戲素材皆為無損 WebP。

| 檔名 | 尺寸／格式 | 用途 |
|---|---|---|
| `portrait.webp` | 512×512 | 故事書角色卡（`cardUrl`） |
| `profile.webp` | 540×960 | 全身立繪（`fullBodyUrl`） |
| `neutral.webp`、`happy.webp`、`sad.webp`、`angry.webp`、`surprised.webp`、`shy.webp` | 每張 514×514，白底，同一套構圖 | 對話表情；`portraitUrl` 一律指向 `neutral.webp` |
| `walk.webp` | RGBA 688×688，4 欄×4 列，每格 172×172 | 欄為下／上／左／右，列為四個行走影格；每格人物水平中心 x=86、腳底 y=166 |

`thinking` 沒有獨立表情圖，對話框依既有規則退回預設 neutral 頭像。

玩家行走圖為 RGBA 688×516、4 欄×3 列，每格 172×172；欄為下／上／左／右，列為站立／步態一／步態二。這個 4×3 格式只適用玩家，NPC 使用上表的 4×4 格式。

## 路西恩行走圖的歷史處理

先前內建 imagegen 去背曾輸出實際格紋，經使用者同意改用本地程式清除背景，再用 sprite-pipeline 的 `normalize_sprite_strip.py` 統一比例與腳底位置。歷史的 `tools/prepare_lucian.py` 與 `tools/pack_walk_atlas.py` 是 12 影格（4×3）的處理工具，不能直接覆蓋目前已驗收的 NPC 4×4 行走圖。

歷史 imagegen 提示詞如下，僅供追溯：

> Fix this game sprite asset: remove the gray checkerboard, which was mistakenly painted into the image. Output real RGBA transparent PNG, alpha=0 outside the 12 figures, not a visible checkerboard. Keep figures unchanged. Make a perfectly uniform 4-column by 3-row sprite atlas. Each figure must fit entirely inside its own 384x341 cell, with 12px padding at top/bottom, same size and baseline for every frame. Columns front, back, left, right. Rows idle, step A, step B. Preserve all hair, dark outlines, shoes, backpack and costume details. Actual transparent background mandatory, NO painted checkerboard.
