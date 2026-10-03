# A-1 房間

## 操作與互動

- 從居住區 A 走廊點 A-1 房門進入。地圖選居住區 A、再選 A-1 也能回到房間。
- 黑髮領航員是玩家，名稱跟隨「個人資訊」，腳下有青色標記。路西恩為獨立 NPC，自行巡遊。
- 點擊地板指定玩家目的地。點選房間後也可用方向鍵／WASD，放開鍵即停止。鍵盤會接手並取消滑鼠路徑；輸入對話時不會移動角色。
- 靠近路西恩會顯示 `[E] 交談`。按 E 將對話送到對話面板；NPC 在玩家附近停步。隔牆、隔家具或超過 115 場景像素不能觸發。
- 人物設定可透過故事書存取。
- 家具配置：左側為電腦娛樂桌、懶骨頭與雜物書架；右上衣櫃、床（床頭朝右）；右下淋浴間、洗手台鏡子及馬桶。
- 所有實體家具均有腳底碰撞範圍，路徑會繞開。浴室左下有入口，淋浴間由下方進出。
- 進入淋浴區切換為沐浴狀態，停止繪製服裝，以不透明霧氣核心完整遮住身體；離開區域恢復制服。霧氣不會殘留在房間其他位置。
- 開啟選單、抽屜或切到背景時暫停，失焦清除按鍵，避免持續移動。
- 玩家與 NPC 暫未作角色互擋；家具和牆面碰撞已實作。

## 程式與素材

- 玩家圖集：`public/assets/player/walk.png`（RGBA 688×516，4 方向 × 3 幀）。
- 家具：`public/assets/rooms/furniture/`，配置表 `public/assets/rooms/furniture.json`。
- 提示詞見 `tools/asset-prompts.md`。處理腳本：`tools/prepare_player.py`、`tools/pack_player.py`、`tools/prepare_furniture.py`。
- 玩家中間橫排可使用 sprite-pipeline 的 `normalize_sprite_strip.py --input tmp/sprites/player-strip.png --out-dir tmp/sprites/player-frames --frames 12 --frame-size 160` 後再打包。
- 家具位置與碰撞：`src/game/roomFurniture.ts`；行走：`src/game/roomNavigation.ts`；控制與距離判定：`src/game/roomActors.ts`。

## 驗證

```
npm run lint
npm run build
node --import tsx src/game/roomNavigation.test.ts
node --import tsx src/game/roomActors.test.ts
node --import tsx src/game/roomInteraction.test.ts
```
