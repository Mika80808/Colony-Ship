---
name: starport-scene-props
description: 星際港場景物件（機台、家具、擺設）的繪製流程：先規劃分區與物件清單，在地面底圖上生成「擺設參考圖」取得正確的 RPG 斜俯視，再依參考圖生成最終物件、切圖、擺進地圖（碰撞、互動、遮擋）。當要幫設施或房間畫家具、機台、擺設，或物件「看起來是正面圖、不像 RPG」、「全部長得像櫃子」、「角度跟地板不合」時使用。單件小物的生圖規範仍看 starport-asset-gen。
---

# 星際港場景物件繪製流程

一句話：**物件的視角要從「畫在這張地圖上」得來，不要用程式定視角。** 先讓生圖模型在我們的地面底圖上把物件畫進去（擺設參考圖），模型自然會用跟地板一致的 RPG 視角；最後的物件再拿底圖＋參考圖當依據另外生成。

流程依據 `.claude/skills/generate2dmap/`（scene_mode、layered raster、y-sorted props）。工程區（2026-10-04）是第一個照這個流程做的場景，程式都可以照抄：`tools/art/engineering_objects.py`、`engineering_props.py`、`engineering_build.py`。

## 視角規範（RPG 斜俯視）

- 跟 RPG Maker、星露谷一樣：地板格是正方形；**矮的東西（桌子、控制台、推車）主要看到頂面**，高的東西（櫃子、貨架、機台）看到正面加頂面。
- 不要等角（isometric）斜轉，不要透視收縮。
- 光源左上。風格：clean hand-painted HD 2D game art、soft cel shading、crisp dark outlines、low texture noise，不是像素畫。
- 舊規範「頂面每格 16 px／96 格 24 px」**不適用於場景物件**：照那個畫白模，模型會畫成正面圖。

## 流程

### 1. 底圖（只有地面）
- 地板、牆、門等不動的結構做成底圖（例：`public/assets/<場景>/ground.webp`）。底圖**不能**有家具、機台、可互動或要排前後的東西。
- 門、會動的東西、蓋在角色上的前景（牆簷、欄杆）另外分層。牆的遮擋規則見 `問題修正紀錄.md`「牆與遮擋」。

### 2. 規劃分區與物件清單
- **依這個地方的功能和動線分區，不要照搬別的場景的格局**（工程區曾經不自覺抄了溫室的「中間主角＋左右對稱」）。先問：東西從哪進來、在哪處理、人在哪休息。
- 物件清單寫成一個 Python 檔（例 `tools/art/engineering_objects.py`）：id、名稱、佔地（x, y, 寬, 深，格）、高度、站位、互動文字。地圖、預覽都從這份產生。
- 檢查：佔地不重疊、所有空地從入口走得到、每個站位走得到；**站位放在格子中心（.5）**，放在格線上會被隔壁的碰撞擋住。
- 用白色方塊把清單擺到底圖上做預覽，先給使用者看配置（只看位置，不拿去生圖）。

### 3. 擺設參考圖（dressed reference）
- 把底圖裁成要畫的那一區（每張參考圖**最多 9 種不同物件**，物件多就分區分張），縮到 1024 寬並保持比例。
- 用 Codex 生圖，底圖當 Image1。prompt 範本：

```
Generate ONE image with your image generation tool and save it as ./raw/<批次>.png. Use image generation, not code. Do not edit any other files.

Use Image1 as the exact base map reference: it is <哪一區> of a <場景> in a top-down 2D RPG, seen from the game camera (three-quarter top-down RPG view: the back wall is seen from the front, the floor is seen from above).
Create a dressed-reference version of the same map by adding props only.
Preserve exactly: camera, framing, image size and aspect ratio (<寬 x 高>), <地板、牆的特徵>. Do not crop, zoom, rotate, repaint or redesign the room.

Draw every prop in the same camera as the room, like objects in a top-down RPG such as RPG Maker or Stardew Valley: low objects (desks, consoles, worktables) clearly show their top surfaces as seen from above, tall objects (cabinets, racks, machines) show their front face plus their top. All props stand on the floor; their front bottom edge sits at the stated bottom position. No isometric diagonal rotation, no perspective convergence.

Add these props naturally on top of the existing map (positions are percent of image width x and height y):
1. <物件>: x <左-右>%, bottom edge at y <%>, <高矮>. <造型描述>
...

Style: clean hand-painted HD 2D game art matching the floor, soft cel shading, crisp dark outlines, low texture noise, not pixel art. <區域材質，見 starport-asset-gen 第四節>. Light from the upper left.
No characters, no UI, no text, no labels, no numbers, no watermark, no glow halos.
```

- 位置換算：x% = 格 x ÷ 圖寬格數；y% = 佔地下緣的格 y ÷ 圖高格數。
- 參考圖**只是規劃用**：模型常會重畫一點地板，不能拿來當底圖，也不要從參考圖直接切物件。
- 給使用者看參考圖；模型自己加的小東西（椅子、檯燈）問使用者要不要留。

### 4. 最終物件
- 生圖時把**底圖＋參考圖都當參考圖**交給模型，prompt 寫明「照參考圖裡那件物件的樣子與視角，單獨畫出來」。
- 依物件分類決定一次生幾件（generate2dmap 的規則）：
  - 大型、高的、要對齊碰撞的（主要機台、櫃子、門）：一件一張。
  - 同類的高物件（例：幾種貨架）：可以同一張並排，格子留大。
  - 小型雜物（箱子、桶子、推車）：可以 3 × 3 一張表。
- 背景純洋紅 #FF00FF（物件本身帶紫紅時改中性灰）、不畫地板與陰影、不寫字、物件不碰圖邊。
- **尺寸**：以參考圖裡那件物件的像素大小換算成遊戲像素（參考圖 1 px = 底圖原寬 ÷ 1024 個遊戲 px），切圖時縮放到這個大小。

### 5. 切圖與擺放
- 去背：透明或洋紅都去掉；偏紫紅的像素一律去掉、貼著背景的淡紫邊再削一圈（見 `engineering_props.py` 的 cut），切完檢查洋紅殘留要是 0。
- 擺進地圖（見 `engineering_build.py`）：decor 以**底部中心**對齊佔地下緣、依底部排前後；佔地當碰撞；有互動文字的加 interaction（點擊範圍＝整張圖的範圍，站位在格子中心）。沒有互動文字的物件不加互動。
- GM 物件清單：在 `src/game/facilityContext.ts` 補中文名稱。
- 測試：跑場景測試（每格走得到、站位、碰撞）、lint、build；瀏覽器實際走一圈，看前後遮擋與點擊互動。

### 6. 收尾
- 原圖放 `tools/art/<場景>/raw/`，prompt 存在生圖資料夾（`場景/<場景>/`）跟原圖同名的 `.prompt.txt`。
- 更新 `docs/scenes/<場景>.md`、`docs/PROGRESS.md`；有修正問題就更新 `問題修正紀錄.md`；commit 並 push。

## Codex 生圖

- 生圖前**先把 prompt 給使用者看**，使用者說可以才送（每次 2–5 分鐘，使用者在意成本）。
- 指令（在生圖資料夾執行，參考圖先複製進該資料夾）：

```
"/c/Users/Mika/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe" exec --skip-git-repo-check -s workspace-write -C "<生圖資料夾>" -i <image1> -i <image2> -o <批次>_last.txt - < <批次>.prompt.txt > <批次>_log.txt 2>&1
```

- 回傳的圖不一定是 1024（常給 1254）；切圖座標一律依圖寬等比例換算。

## 踩過的坑

| 症狀 | 原因 | 做法 |
|---|---|---|
| 物件全是正面圖，不像 RPG | 用程式白模定視角，頂面畫太薄，模型照描 | 改用擺設參考圖，讓模型在底圖上畫 |
| 每件都長得像櫃子 | 白模全是實心方塊 | 不用白模定形；描述造型，讓參考圖決定樣子 |
| 生出來的物件位置跟表對不上 | 改了配置後 prompt 裡「第幾格放什麼」沒跟著改 | prompt 的順序由程式從同一份清單產生，或改完逐項核對 |
| 牆邊長條物件下半部露出地板（隱形牆） | 圖的高度蓋不滿佔地 | 依參考圖的實際大小定佔地，不要為了填滿佔地拉長物件 |
| 切圖邊緣一圈紫紅 | 洋紅混色 | 去背加強（見步驟 5），檢查殘留為 0 |
| 互動站位走不到 | 站位落在格線上 | 站位放格子中心 .5 |
| 照搬別的場景格局 | 沒先想這裡的功能 | 步驟 2 先寫動線與分區 |

## 瀏覽器測試小技巧

側邊瀏覽器面板隱藏時 `requestAnimationFrame` 不會跑，畫面不更新。測試時先在頁面執行
`window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`，
再截一次圖讓迴圈接上。
