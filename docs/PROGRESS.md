# 開發進度

每次收工更新這份。格式：已完成、進行中、下一步、已定案。

## 溫室

已完成
- 地面圖 `public/assets/greenhouse/ground.webp`、地圖與碰撞 `map.json`（40 × 28 格，每格 96 px）。
- 栽種架兩種架型，都拆成左端／中段／右端三段（各 48 × 144 px），中段可無限重複接成長排：
  - 三層層架：`farm_rack_bokchoy_*.png`（目前放青江菜當示範，之後換成正式作物）。
  - 挑高藤架（空架）：`farm_rack_trellis_*.png`。
  - 產生腳本：`tools/art/greenhouse_rack_bokchoy.py`、`tools/art/greenhouse_rack_trellis.py`。
- 19 種作物的三階段提示詞與兩翼排位：`tools/art/greenhouse_crop_prompts.md`。

進行中
- 用 Codex 生作物圖。先生萵苣確認畫風，確認後其餘每張都把萵苣成品當參考圖。輸出到 `tools/art/crops/raw/`。

下一步
1. 作物圖去背、切成三階段、縮到層架尺寸（層架每層開口約 22 px 高，藤架開口約 104 × 75 px）。
2. 每種作物各出三階段的中段，再做一張共用的「採收後空層板」。
3. 栽種架接進溫室場景：`map.json` 的 `props` 裡 kind 為 `R` 的格子就是栽種架位置，目前場景還沒畫出來。

已定案
- 作物畫風：Classic cute pixel RPG crop art，24 × 24 px 可讀（藤架作物 24 × 72 px）。
- 青江菜從正式清單移除，改成馬鈴薯；哈密瓜改成鳳梨；新增葡萄、百香果。
- 番茄、豌豆、檸檬、葡萄、百香果放挑高藤架，其餘放三層層架。
- 右翼兩種作物共用一排、各佔半排：草莓＋藍莓、葡萄＋百香果。

## 其他場景

- A-1 房間：可遊玩，說明見 `README.md`。
- 居住區 A 走廊：可遊玩，說明見 `CORRIDOR-A.md`；走廊 B–D 已有素材。
- 艦橋：可遊玩，說明見 `BRIDGE.md`。
