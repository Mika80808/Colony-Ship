# 角色素材

| 角色 | 位置 | 內容 |
|---|---|---|
| 玩家 | `public/assets/player/` | 行走圖 |
| Aiden、Ethan、Luca | `public/assets/<名字>/` | 行走圖、頭像、各種表情 |
| Lucian（路西恩） | `public/assets/lucian/` | 行走圖、頭像、各種表情 |
| Blaze | `public/assets/blaze/` | 行走圖、頭像（尚無表情圖）；原始設定圖在 `tools/art/blaze/raw/` |

## 行走圖集規格

RGBA 688×516，4 欄（正／背／左／右）× 3 列（站立／步態一／步態二），每格 172×172。

## 路西恩行走圖的處理流程

內建 imagegen 去背時輸出帶有實際格紋，經使用者同意改用本地程式清除背景；以 sprite-pipeline 的 `normalize_sprite_strip.py` 統一比例和腳底位置。原始人物設定圖片未修改。

重製流程（需要 Pillow、numpy）：

1. `python tools/prepare_lucian.py`：從 `tmp/sprites/lucian-extraction-source.png` 去背並輸出透明橫排。
2. 執行 sprite-pipeline 的 `normalize_sprite_strip.py --input tmp/sprites/lucian-strip.png --out-dir tmp/sprites/frames --frames 12 --frame-size 160`。
3. `python tools/pack_lucian.py`：輸出遊戲圖集及 `tmp/sprites/preview.png` 預覽。

最後使用的 imagegen 提示詞：

> Fix this game sprite asset: remove the gray checkerboard, which was mistakenly painted into the image. Output real RGBA transparent PNG, alpha=0 outside the 12 figures, not a visible checkerboard. Keep figures unchanged. Make a perfectly uniform 4-column by 3-row sprite atlas. Each figure must fit entirely inside its own 384x341 cell, with 12px padding at top/bottom, same size and baseline for every frame. Columns front, back, left, right. Rows idle, step A, step B. Preserve all hair, dark outlines, shoes, backpack and costume details. Actual transparent background mandatory, NO painted checkerboard.
