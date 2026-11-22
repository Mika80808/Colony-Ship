# A-1 房間

## 操作與互動

- 從居住區 A 走廊點 A-1 房門進入。地圖選居住區 A、再選 A-1 也能回到房間。
- 黑髮領航員是玩家，名稱跟隨「個人資訊」，腳下有青色標記。路西恩為獨立 NPC，自行巡遊。
- 點擊地板指定玩家目的地。點選房間後也可用 WASD，放開鍵即停止（方向鍵之後再補）。鍵盤會接手並取消滑鼠路徑；輸入對話時不會移動角色。
- 靠近路西恩會顯示 `[E] 交談`。按 E 將對話送到對話面板；NPC 在玩家附近停步。隔牆、隔家具或超過 115 場景像素不能觸發。
- 人物設定可透過故事書存取。
- 家具配置：左側為電腦娛樂桌、懶骨頭與雜物書架；右上衣櫃、床（床頭朝右）；右下淋浴間、洗手台鏡子及馬桶。
- 所有實體家具均有腳底碰撞範圍，路徑會繞開。浴室左下有入口，淋浴間由下方進出。
- 進入淋浴區切換為沐浴狀態，停止繪製服裝，以不透明霧氣核心完整遮住身體；離開區域恢復制服。霧氣不會殘留在房間其他位置。
- 開啟選單、抽屜或切到背景時暫停，失焦清除按鍵，避免持續移動。
- 玩家與 NPC 暫未作角色互擋；家具和牆面碰撞已實作。

## 程式與素材

- 玩家圖集：`public/assets/player/walk.webp`（RGBA 688×516，4 方向 × 3 幀）。
- 家具：`public/assets/rooms/furniture/`，配置表 `public/assets/rooms/furniture.json`。
- 提示詞見 `tools/asset-prompts.md`。處理腳本：`tools/prepare_player.py`、`tools/pack_walk_atlas.py`（打包圖集，原 pack_player.py）（家具當年用的 `prepare_furniture.py` 輸出路徑已不存在，隨房間改走 Photoshop 流程後移除）。
- 玩家中間橫排可使用 sprite-pipeline 的 `normalize_sprite_strip.py --input tmp/sprites/player-strip.png --out-dir tmp/sprites/player-frames --frames 12 --frame-size 160` 後再打包。
- 2026-11-20 起房間用設施場景（`FacilityScene`）跑，跟走廊、艦橋、溫室同一套碰撞、尋路、排前後與點擊走路。
- 殼與陳設的原始資料：`public/assets/rooms/shell.json`（所有房間共用：牆、地板、浴室、房門）、`public/assets/rooms/furnishings/<住戶>.json`（家具、地毯、座位、床、巡遊點）。改這兩個，再跑 `python tools/art/room_map.py`，產生 `public/assets/rooms/<住戶>/`（map.json、ground.webp、props/）與空房 `rooms/empty/`。**不要手改 map.json。** 新增住戶陳設時把住戶 id 加進 `src/game/rooms.ts` 的 `FURNISHED`。
- 碰撞：腳本照原本的判斷（地板範圍、北牆兩段、南側矮牆可走進 72 px、牆兩側多擋 36 px、家具接地範圍、腳底 28 × 14）每 3 px 算一次腳點能不能站，換成整格碰撞＋橫條矩形；跟原本逐點比對不一致的都在邊界 7 px 內（家具外角被修圓一點）。
- 排前後照原本家具的排序線（map.json decor 的 `sortY`）；坐著、躺著的排序線也照原本（互動的 `sortY`）。
- `src/components/RoomScene.tsx`：房間＝設施場景＋房間擴充；`src/game/roomExtras.ts`：房門開門與淡出、淋浴（膚色、噴水、水霧、玻璃有人在後面時半透明）、南側沙發坐著時的扶手與鞋子。
- 查看家具（冰箱、滑板、遊戲櫃）：站在旁邊按 E 或點它，說明顯示在家具旁的泡泡。同一處也能坐下時按 E 先坐下（跟原本一樣）。

## 驗證

```
npm run lint
npm run build
node --import tsx src/game/roomMap.test.ts
```
