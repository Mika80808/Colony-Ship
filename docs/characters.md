# 角色素材

T1 執行狀態：程式接線、整理腳本與規格文件已完成；目前工具環境無法啟動系統 Python，以下整理輸出仍待執行腳本與驗證，尚未交件。

## 素材清單

| 角色 | 位置 | 內容與處理來源 |
|---|---|---|
| Aiden（艾登） | `public/assets/aiden/` | 角色卡、全身立繪、六表情、行走圖；整理既有素材，未生圖 |
| Ethan（伊森） | `public/assets/ethan/` | 角色卡、全身立繪、六表情、行走圖；整理既有素材，未生圖 |
| Luca（路卡） | `public/assets/luca/` | 角色卡、全身立繪、六表情、行走圖；整理既有素材，未生圖 |
| Lucian（路西恩） | `public/assets/lucian/` | 角色卡、全身立繪、六表情、行走圖；已齊全，T1 不修改 |
| Blaze（布雷茲） | `public/assets/blaze/` | 角色卡、全身立繪、六表情、行走圖；六表情切自上一輪已生成的表情表，T1 未重生 |
| 玩家 | `public/assets/player/` | 造型自訂，只有行走圖；T1 不產生玩家頭像／立繪／表情，也不修改玩家素材 |

五位 NPC 已在 `src/data/initialGameData.ts` 的 `INITIAL_NPCS` 設定完整素材路徑。艾登、伊森、路卡只填中文音譯名與看圖所得的外觀，其餘人物設定待補，不指定房號、日程或部門；未指定位置時不出現在場景的在場名單。

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

## T1 重建流程

在專案根目錄執行（使用系統 Python，需 Pillow、numpy；不使用 `tools/.venv`）：

```powershell
python tools/art/characters_build.py
```

腳本只整理艾登、伊森、路卡與布雷茲；路西恩與玩家素材保持不變。驗收總覽圖為 `tools/art/characters/review_sheet.png`，每位 NPC 一列，依序為角色卡、立繪、六表情、行走圖第一列四格。

1. 初次整理以 `git mv` 兩段式將 `Aiden`、`Ethan`、`Luca` 目錄改成小寫；這會暫存目錄改名，不會 commit 或同步 GitHub。再次執行不重做目錄改名。
2. 既有來源備份在 `tools/art/characters/raw/<id>/originals/`；重建皆讀取這些原檔，避免反覆縮放。它們是既有素材備份，不是新生成圖。
3. 三位角色的表情改名對應為 `normal.webp` → `neutral.webp`、`troubled.webp` → `sad.webp`；其餘四種表情同名。已符合尺寸且為無損的角色卡、立繪與表情直接複製，保留像素與 metadata。
4. 三張原始 `Walk.webp`（1254×1254、已透明）交給 `tools/pack_walk_sheet.py` 整理成 `walk.webp`（688×688）；遊戲目錄移除舊大檔，備份保留在 originals，供重建使用。
5. 布雷茲表情來源固定為 `tools/art/characters/raw/blaze/expressions_sheet.png`（1024×1536）。目視確認由左至右、由上至下依序為 neutral、happy、sad、angry、surprised、shy；等距切成六張 512×512，再整張放大到 514×514，不單獨裁頭像，以保留角色位置。
6. 布雷茲原本的角色卡是有損 WebP，改以解碼後像素另存無損 WebP；這不會還原原檔已失去的細節。立繪本來已符合規格，直接保留；行走圖不修改。

布雷茲的 sad 與 angry 原圖差異較細微；本次依指定表情表保留，不重生、不手動修改表情。T1 沒有新的生圖或新提示詞。

## 路西恩行走圖的歷史處理

先前內建 imagegen 去背曾輸出實際格紋，經使用者同意改用本地程式清除背景，再用 sprite-pipeline 的 `normalize_sprite_strip.py` 統一比例與腳底位置。歷史的 `tools/prepare_lucian.py` 與 `tools/pack_walk_atlas.py` 是 12 影格（4×3）的處理工具，不能直接覆蓋目前已驗收的 NPC 4×4 行走圖；T1 不重建路西恩。

歷史 imagegen 提示詞如下，僅供追溯：

> Fix this game sprite asset: remove the gray checkerboard, which was mistakenly painted into the image. Output real RGBA transparent PNG, alpha=0 outside the 12 figures, not a visible checkerboard. Keep figures unchanged. Make a perfectly uniform 4-column by 3-row sprite atlas. Each figure must fit entirely inside its own 384x341 cell, with 12px padding at top/bottom, same size and baseline for every frame. Columns front, back, left, right. Rows idle, step A, step B. Preserve all hair, dark outlines, shoes, backpack and costume details. Actual transparent background mandatory, NO painted checkerboard.
