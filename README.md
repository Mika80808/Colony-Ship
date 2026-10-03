<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

遊戲問題的分類修正筆記：[問題修正紀錄](問題修正紀錄.md)。

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9d27003a-959e-45ef-b509-0346ad7926f0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## A-1 房間互動測試

- 執行 `npm run dev`，預設進入居住區 A 的 A-1 房間。
- 黑髮領航員是玩家，名稱跟隨「個人資訊」，腳下有青色標記。路西恩為獨立 NPC，自行巡遊。
- 點擊地板指定玩家目的地。點選房間後也可用方向鍵／WASD，放開鍵即停止。鍵盤會接手並取消滑鼠路徑；輸入對話時不會移動角色。
- 靠近路西恩會顯示 `[E] 交談`。按 E 將對話送到現有對話面板；NPC 在玩家附近停步。隔牆、隔家具或超過 115 場景像素不能觸發。
- 目前 GM 是本地 mock，對話為測試台詞，不會呼叫外部 AI。
- 上方場景工具列已移除，人物設定仍可透過故事書存取。地圖居住區 A 選 A-1 可返回房間。
- 家具配置：左側為電腦娛樂桌、懶骨頭與雜物書架；右上衣櫃、床（床頭朝右）；右下淋浴間、洗手台鏡子及馬桶。
- 所有實體家具均有腳底碰撞範圍，路徑會繞開。浴室左下有新入口，淋浴間由下方進出。
- 進入淋浴區切换為脫衣沐浴狀態，停止繪制服裝，以不透明霧氣核心完整遮住身體；離開區域恢復制服。霧氣不會殘留在房間其他位置。
- 開啟選單、抽屜或切到背景時暫停，失焦清除按鍵，避免持續移動。
- 玩家與 NPC 暫未作角色互擋；家具和牆面碰撞已實作。

### 程式與素材

- 玩家圖集：`public/assets/player/walk.png`（RGBA 688×516，4 方向 × 3 幀）。
- 家具：`public/assets/furniture/`（8 個透明 PNG）。
- 圖片由內建 imagegen 生成，再依使用者已授權的本地程式去背、切圖；提示詞見 `tools/asset-prompts.md`。
- 處理腳本：`tools/prepare_player.py`、`tools/pack_player.py`、`tools/prepare_furniture.py`。
- 玩家中間橫排可使用 sprite-pipeline 的 `normalize_sprite_strip.py --input tmp/sprites/player-strip.png --out-dir tmp/sprites/player-frames --frames 12 --frame-size 160` 後再打包。
- 家具位置與碰撞：`src/game/roomFurniture.ts`；行走：`src/game/roomNavigation.ts`；控制與距離判定：`src/game/roomActors.ts`。

### 驗證

```
npm run lint
npm run build
node --import tsx src/game/roomNavigation.test.ts
node --import tsx src/game/roomActors.test.ts
node --import tsx src/game/roomInteraction.test.ts
```

### 角色動畫素材處理

最終圖集：`public/assets/lucian/walk.png`，RGBA 688×516，4 欄（正／背／左／右）× 3 列（站立／步態一／步態二），每格 172×172。

使用內建 imagegen 工具嘗試去背後，因輸出帶有實際格紋，經使用者同意改用本地程式清除背景；以 sprite-pipeline 的 normalize_sprite_strip.py 統一比例和腳底位置。原始人物設定圖片未修改。

重製流程（需要 Pillow、numpy）：

1. `python tools/prepare_lucian.py`：從 `tmp/sprites/lucian-extraction-source.png` 去背並輸出透明橫排。
2. 執行 sprite-pipeline 的 `normalize_sprite_strip.py --input tmp/sprites/lucian-strip.png --out-dir tmp/sprites/frames --frames 12 --frame-size 160`。
3. `python tools/pack_lucian.py`：輸出遊戲圖集及 `tmp/sprites/preview.png` 預覽。

最後使用的 imagegen 提示詞：

> Fix this game sprite asset: remove the gray checkerboard, which was mistakenly painted into the image. Output real RGBA transparent PNG, alpha=0 outside the 12 figures, not a visible checkerboard. Keep figures unchanged. Make a perfectly uniform 4-column by 3-row sprite atlas. Each figure must fit entirely inside its own 384x341 cell, with 12px padding at top/bottom, same size and baseline for every frame. Columns front, back, left, right. Rows idle, step A, step B. Preserve all hair, dark outlines, shoes, backpack and costume details. Actual transparent background mandatory, NO painted checkerboard.
