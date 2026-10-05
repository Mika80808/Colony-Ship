# 角色素材

| 角色 | 位置 | 內容 |
|---|---|---|
| 玩家 | `public/assets/player/` | 行走圖 |
| 艾登 Aiden、伊森 Ethan、路卡 Luca | `public/assets/<名字>/` | 行走圖、頭像、各種表情；行走圖原圖在 `tools/art/<小寫名字>/raw/walk-sheet.webp` |
| Lucian（路西恩） | `public/assets/lucian/` | 行走圖、頭像、各種表情 |
| 布雷茲 Blaze | `public/assets/blaze/` | 行走圖、頭像（尚無表情圖，已指派 Codex，見 `docs/tasks/codex-角色素材.md`）；原始設定圖在 `tools/art/blaze/raw/` |

## 檔案規格

- 表情圖：`neutral`、`happy`、`sad`、`angry`、`surprised`、`shy`，514×514，同一套構圖。對話框預設頭像用 `neutral`。原圖用 `tools/prepare_expressions.py` 轉檔。
- `portrait.webp`：512×512，故事書角色卡。`profile.webp`：540×960 透明背景立繪。
- NPC 行走圖：RGBA 688×688，4 欄（下／上／左／右）× 4 列走路影格，每格 172，腳底在 y=166。原圖用 `tools/pack_walk_sheet.py` 正規化。
- 玩家行走圖：RGBA 688×516，4 欄 × 3 列（站立／步態一／步態二）。玩家外觀自填，不做頭像與立繪。
- 盤點與驗收：`python tools/check_character_assets.py`（列出每個角色缺什麼）；Codex 交來的表情原圖用 `--raw <資料夾>` 驗收。

## 路西恩行走圖的處理流程

內建 imagegen 去背時輸出帶有實際格紋，經使用者同意改用本地程式清除背景；以 sprite-pipeline 的 `normalize_sprite_strip.py` 統一比例和腳底位置。原始人物設定圖片未修改。

重製流程（需要 Pillow、numpy）：

1. `python tools/prepare_lucian.py`：從 `tmp/sprites/lucian-extraction-source.png` 去背並輸出透明橫排。
2. 執行 sprite-pipeline 的 `normalize_sprite_strip.py --input tmp/sprites/lucian-strip.png --out-dir tmp/sprites/frames --frames 12 --frame-size 160`。
3. `python tools/pack_walk_atlas.py tmp/sprites/frames public/assets/lucian/walk.webp`：輸出遊戲圖集及 `tmp/sprites/preview.png` 預覽（原 pack_lucian.py）。

最後使用的 imagegen 提示詞：

> Fix this game sprite asset: remove the gray checkerboard, which was mistakenly painted into the image. Output real RGBA transparent PNG, alpha=0 outside the 12 figures, not a visible checkerboard. Keep figures unchanged. Make a perfectly uniform 4-column by 3-row sprite atlas. Each figure must fit entirely inside its own 384x341 cell, with 12px padding at top/bottom, same size and baseline for every frame. Columns front, back, left, right. Rows idle, step A, step B. Preserve all hair, dark outlines, shoes, backpack and costume details. Actual transparent background mandatory, NO painted checkerboard.
