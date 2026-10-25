---
name: starport-scene-props
description: 星際港場景物件（機台、家具、擺設）的繪製流程：先規劃分區與物件清單，在地面底圖上生成「擺設參考圖」取得正確的 RPG 斜俯視，再依參考圖生成最終物件、切圖、擺進地圖（碰撞、互動、遮擋）。當要幫設施或房間畫家具、機台、擺設，或物件「看起來是正面圖、不像 RPG」、「全部長得像櫃子」、「角度跟地板不合」時使用。畫風、尺寸、材質配色看 starport-asset-gen。
---

# 星際港場景物件繪製流程

一句話：**物件的視角要從「畫在這張地圖上」得來，不要用程式定視角。** 先讓生圖模型在我們的地面底圖上把物件畫進去（擺設參考圖），模型自然會用跟地板一致的 RPG 視角；最後的物件再拿底圖＋參考圖當依據另外生成。

整張場景（底圖、牆、門、碰撞）的流程見 `.claude/skills/generate2dmap/`，這份接在它的第 6 步。工程區（2026-10-04）是第一個照這個流程做的場景，程式都可以照抄：`tools/art/engineering_objects.py`（清單）、`engineering_build.py`（地圖）。切圖一律用共用工具 `tools/art/cut.py`，新場景只要寫 `tools/art/<場景>_objects.py` 的資料（`sheets()`、`JOIN`、`door()`）。

## 視角規範（RPG 斜俯視）

- 跟 RPG Maker、星露谷一樣：地板格是正方形；**矮的東西（桌子、控制台、推車）主要看到頂面**，高的東西（櫃子、貨架、機台）看到正面加頂面。
- 不要等角（isometric）斜轉，不要透視收縮。
- 光源左上。畫風是 HD 像素風（一格 48 × 48 px），prompt 最前面貼 `starport-asset-gen` 第一節的「共用規則段」。
- **年代感：2090 年的高科技太空站（世界觀見 `docs/world.md`），物件是 sci-fi concept 設計**。光寫「乾淨、沒鏽」不夠：模型會畫出乾淨但造型老派的東西（外露螺栓、粗保險桿腳、波紋軟管、方盒舊螢幕、物件身上的黃黑條紋），工程區 batch20 就因此整批作廢。prompt 要寫出設計語言並列出禁止項（見下方範本的 Design language 一段）；區域特色（例：工程區的警示黃）只當小點綴。
- 設計語言可以附使用者給的風格參考圖（放 `tools/art/<場景>/style_ref/`），prompt 寫明只參考設計語言，不照它的鏡頭、寫實渲染、商標文字。
- 不要用程式白模定家具、機台的視角：白模只有薄薄一條頂面，模型照描就變成正面圖。

## 流程

### 1. 底圖（只有地面）
- 地板、牆、門等不動的結構做成底圖（例：`public/assets/<場景>/ground.webp`）。底圖**不能**有家具、機台、可互動或要排前後的東西。
- 門、會動的東西、蓋在角色上的前景（牆簷、欄杆）另外分層。牆的遮擋規則見 `問題修正紀錄.md`「牆與遮擋」。

### 2. 規劃分區與物件清單
- **依這個地方的功能和動線分區，不要照搬別的場景的格局**（工程區曾經不自覺抄了溫室的「中間主角＋左右對稱」）。先問：東西從哪進來、在哪處理、人在哪休息。
- 物件清單寫成一個 Python 檔（例 `tools/art/engineering_objects.py`）：id、名稱、佔地（x, y, 寬, 深，格）、高度、站位、互動文字。地圖、預覽都從這份產生。
- 檢查：佔地不重疊、所有空地從入口走得到。互動站位不用在這裡定，擺進地圖時由程式挑（步驟 5）。
- 用白色方塊把清單擺到底圖上做預覽，先給使用者看配置（只看位置，不拿去生圖）。

### 3. 擺設參考圖（dressed reference）
- 把底圖裁成要畫的那一區（每張參考圖**最多 9 種不同物件**，物件多就分區分張），縮到 1024 寬並保持比例。
- 用 Codex 生圖，底圖當 Image1。prompt 範本：

```
Generate ONE image with your image generation tool and save it as ./raw/<批次>.png. Use image generation, not code. Do not edit any other files.

Use Image1 as the exact base map reference: it is <哪一區> of a <場景> in a top-down 2D RPG, seen from the game camera (three-quarter top-down RPG view: the back wall is seen from the front, the floor is seen from above).
Create a dressed-reference version of the same map by adding props only.
Preserve exactly: camera, framing, image size and aspect ratio (<寬 x 高>), <地板、牆的特徵>. Do not crop, zoom, rotate, repaint or redesign the room.

Design language for every prop: clean modular sci-fi equipment of a high-tech space station in the year 2090, smooth matte graphite and white composite panels, rounded and chamfered corners, flush hidden fasteners, slim integrated light strips, flush flat screens, cables hidden inside the bodies. Not retro, not vintage, not old industrial: no exposed bolts or rivets, no chunky bumper feet, no ribbed hoses, no exposed wiring, no boxy old monitors, no yellow-black stripes on the props.

Draw every prop in the same camera as the room, like objects in a top-down RPG such as RPG Maker or Stardew Valley: low objects (desks, consoles, worktables) clearly show their top surfaces as seen from above, tall objects (cabinets, racks, machines) show their front face plus their top. All props stand on the floor; their front bottom edge sits at the stated bottom position. No isometric diagonal rotation, no perspective convergence.

Add these props naturally on top of the existing map (positions are percent of image width x and height y):
1. <物件>: x <左-右>%, bottom edge at y <%>, <高矮>. <造型描述>
...

<共用規則段，見 starport-asset-gen 第一節> Match the pixel scale of the floor. <區域材質，見 starport-asset-gen 第四節>.
No characters, no UI, no text, no labels, no numbers, no watermark, no glow halos.
```

- 位置換算：x% = 格 x ÷ 圖寬格數；y% = 佔地下緣的格 y ÷ 圖高格數。
- **大型機台不限尺寸**：只寫放在哪一區（左上、右上…），加一句 make them large and imposing, as big as fits in their area, larger than a person，不寫寬幾 %、幾格高。限制尺寸時模型會畫得太小、沒氣勢（工程區 batch27，使用者要求）。遊戲尺寸一樣事後從參考圖量。
- 參考圖**只是規劃用**：模型常會重畫一點地板，不能拿來當底圖，也不要從參考圖直接切物件。
- 給使用者看參考圖；模型自己加的小東西（椅子、檯燈）問使用者要不要留。

### 4. 最終物件
- 生圖時把**底圖＋參考圖都當參考圖**交給模型，prompt 寫明「照參考圖裡那件物件的樣子與視角，單獨畫出來」。
- 依物件分類決定一次生幾件（generate2dmap 的規則）：
  - 大型、高的、要對齊碰撞的（主要機台、櫃子、門）：一件一張。
  - 同類的高物件（例：幾種貨架）：可以同一張並排，格子留大。
  - 小型雜物（箱子、桶子、推車）：可以 3 × 3 一張表。
- 背景純洋紅 #FF00FF（物件本身帶紫紅時改中性灰）、不畫地板與陰影、不寫字、物件不碰圖邊。
- 每批 prompt 寫明：照參考圖裡那件的設計、細節、視角畫出來，每件獨立完整、洋紅底、物件之間和圖邊留大空隙、不畫地板和陰影；椅子這類參考圖裡貼著桌子的東西寫「Without its chair」，另外生。
- **尺寸與位置**：在參考圖上疊座標格線（每 32 px 一條）用眼睛讀每件的左右、上緣、底邊，換算成遊戲 px（參考圖 1 px = 底圖原寬 ÷ 1024；下半部參考圖要加上裁切的 y 起點）。不要用「參考圖減底圖」自動找，模型會重畫地板，差異會黏成一片。切圖時縮放到量出的寬度；生出來的比例跟參考圖差很多的（例：手臂往旁邊伸）改照高度縮放。

### 5. 切圖與擺放
- 切圖：`python tools/art/cut.py props <場景> <批次|all>`；門用 `python tools/art/cut.py door <場景>`。
- 去背：透明或洋紅都去掉、貼著背景的淡紫邊再削一圈（物件本身偏紫的地方不動），切完檢查洋紅殘留要是 0。
- 找物件：相距 40 px 內的塊先併成一件（並排的油桶），剩下的碎塊（散落零件）併給 80 px 內最近的大塊，再依閱讀順序對到清單；數量對不上就報錯（見 `cut.py`）。
- 擺進地圖：decor 以**底部中心**對齊；圖層與碰撞一律照下方「圖層與碰撞規則」，擺完照最後的檢查表走一次。有互動文字的加 interaction（點擊範圍＝整張圖）。
- **互動站位用程式挑，不要手填**：從入口在細格上走一遍，挑走得到、離圖 ≤ 48 px（互動範圍 56 px 以內）、最靠近正前方、不在椅子上的點。手填常常太遠按 E 沒反應，或卡在走不到的縫裡。
- GM 物件清單：在 `src/game/facilityContext.ts` 補中文名稱。
- 測試：跑場景測試（每格走得到、站位、碰撞）、lint、build；瀏覽器實際走一圈，看前後遮擋與點擊互動。

### 6. 收尾
- 原圖放 `tools/art/<場景>/raw/`，prompt 寫進 `tools/art/<場景>/prompts.md`；試錯檔放暫存區（規則見 `starport-asset-gen` 第六節）。
- 更新 `docs/scenes/<場景>.md`、`docs/PROGRESS.md`；有修正問題就更新 `問題修正紀錄.md`；commit 並 push。

## 圖層與碰撞規則

物件「蓋住角色」「角色穿進物件」「影子壓到物件」都是這裡的規則沒照做。數字以設施場景的角色為準（`ACTOR_HEIGHT` 148）；換角色尺寸或在房間場景（腳圈半徑 14）用，照公式重算。

**角色尺寸**：腳點是畫面座標的基準。腳圈半徑 22（碰撞）；影子是腳點上方 3 px、半寬 23、半高 7 的橢圓；頭寬 72（半寬 36，全身最寬的地方）；頭頂在腳點上方約 140 px。

### 一、圖層（誰畫在誰上面）

遊戲每一幀照「腳點的高低」重排（Y 排序）：物件的腳點是**圖的底邊**，角色腳點比物件底邊低（畫面更下方）就畫在物件前面。

1. **一張圖只能有一個底邊。** 有一部分是角色能站在它「旁邊」、腳點卻比整張圖底邊高的（L 型、U 型櫃台、圍一圈的沙發、前後兩段不一樣深的機台），拆成幾張圖，每段各有自己的底邊。拆法寫在 `<場景>_objects.py` 的 `LAYERS`（crop／clear／keep，見醫療室），不要在 PSD 外手切。
2. **同一件物件的疊層**（櫃體→動畫零件→玻璃、床→被單）：同畫布、同中心，用底邊差 0～1 px 決定順序（同底邊時照 PLACE 的先後）。
3. **躺、坐**：角色改用家具的排序線（interaction 的 `sortY`），要蓋在角色身上的那層（被單、近側扶手）底邊比家具多 1 px。
4. **左右兩側**：角色腳點在圖的左右範圍外，一律畫在物件前面（`beside`，設施場景所有 decor 都套）。只補矮桌側邊這種情況，**不能拿來代替第 1 條的拆圖**。
5. **永遠在上**（門楣、牆簷、吊燈、天花板管線）：前景層（overlays／walls），不參與排序。**永遠在下**（地毯、地貼、地上的線）：畫進底圖，不當物件。
6. 牆的遮擋（橫牆牆頂蓋 66 px、腳點最深走進 58 px）見 `問題修正紀錄.md`「牆與遮擋」。

### 二、碰撞（腳能走到哪）

碰撞一律用精細矩形（collisionRects，格為單位），不用整格；規劃圖的佔位格在物件擺好後改由圖給（醫療室的 `PLAN_FROM_ART`）。

1. **左右：圖在碰撞那幾列的實際寬度外 3 px**（影子半寬 23 − 腳圈 22 ＋ 留白 2）。程式自動撐寬（`SHADOW_GAP`），手填的只要大概對。
2. **下緣：圖的底邊**（物件貼地的那條線）。角色從前面靠近時影子上緣離底邊 12 px，不會壓到。
3. **上緣：物件在地上實際佔的深度，但最低只能到圖上緣往下 92 px**（角色高 140 − 露出頭肩 70 ＋ 腳圈 22）。角色站到物件背後最深處時，頭和肩一定露在物件上面，不會整個人不見。矮物件自然符合；高物件（櫃子、機台）程式會把碰撞往上撐（`SHOW_DEPTH`）。撐完背後剩下的走道不到 72 px 的，靠牆擺或碰撞直接接到牆，不留縫。
4. **直牆內側多擋 14 px**（頭半寬 36 − 腳圈 22），貼牆時頭才不會凸進牆裡。門洞兩側不加，門不會變窄。程式自動加（`HEAD_PAD`）。
5. **走道寬**：兩件物件之間要讓人走過，淨寬至少 1.5 格（72 px，＝頭寬）；只要能鑽過去的縫（腳圈 44 px 以上、頭寬以下）會讓頭跟兩邊物件重疊，寧可堵死。
6. **站位**（互動、NPC、躺坐後起身的點）：程式挑或測試檢查「走得到」，不要只靠眼睛看；起身點要在碰撞外。

### 三、擺完的檢查表

- [ ] 每件物件都試站四個位置：正前方貼著站、左右兩側貼著站、能走到的話站在後面。前面看得到全身與影子、旁邊不被蓋臉、後面只蓋下半身。
- [ ] 影子在任何位置都不壓到物件；頭不凸進直牆。
- [ ] 有 L 型、U 型、前後兩段的物件都拆了圖。
- [ ] 站到高物件背後最深處還看得到頭肩；背後走道淨寬 ≥ 72 px，不然堵死。
- [ ] 場景測試補上：物件擋住、站位走得到、可躺坐的物件「家具在下、被單在上」。
- [ ] 用離線合成（照遊戲的順序：before 的物件 → 角色 → 其他物件，一次只放一個角色）或瀏覽器實際走一圈截圖給使用者看。

## Codex 生圖

- 生圖前**先把 prompt 給使用者看**，使用者說可以才送（每次 2–5 分鐘，使用者在意成本）。
- 指令（在專案根目錄執行，prompt 從 stdin 送；開頭先寫給 Codex 的指示：照附圖生成、存到 `tools/art/<場景>/raw/<檔名>.png`、生完用看圖工具自我檢查、不合格重生最多 3 次）：

```
codex exec -s workspace-write -i <image1> -i <image2> - < <暫存區的 prompt 檔>
```

- 命令列版 `codex` 跟 Codex 桌面版是分開安裝的；桌面版更新了、命令列版沒更新時，新模型會被拒（「not supported when using Codex with a ChatGPT account」），先跑 `codex update`，或用 `-m` 指定舊版認得的模型。
- Codex 偶爾生完存不進專案（檔案工具故障），原圖會留在 `~/.codex/generated_images/<session>/`，從那裡複製。

- 回傳的圖不一定是 1024（常給 1254）；切圖座標一律依圖寬等比例換算。

## 踩過的坑

| 症狀 | 原因 | 做法 |
|---|---|---|
| 物件全是正面圖，不像 RPG | 用程式白模定視角，頂面畫太薄，模型照描 | 改用擺設參考圖，讓模型在底圖上畫 |
| 每件都長得像櫃子 | 白模全是實心方塊 | 不用白模定形；描述造型，讓參考圖決定樣子 |
| 生出來的物件位置跟表對不上 | 改了配置後 prompt 裡「第幾格放什麼」沒跟著改 | prompt 的順序由程式從同一份清單產生，或改完逐項核對 |
| 牆邊長條物件下半部露出地板（隱形牆） | 圖的高度蓋不滿佔地 | 依參考圖的實際大小定佔地，不要為了填滿佔地拉長物件 |
| 切圖邊緣一圈紫紅 | 洋紅混色 | 去背加強（見步驟 5），檢查殘留為 0 |
| 角色臉被 L 型櫃台的短邊蓋住 | 整張 L 只有長邊一個底邊 | 拆圖（圖層與碰撞規則一-1） |
| 影子壓到桌腳、頭凸進牆 | 碰撞只算腳圈，沒算影子和頭寬 | 規則二-1、二-4（程式自動） |
| 走到櫃子後面只剩頭髮 | 碰撞上緣照佔地深度給，背後走道太深 | 規則二-3（程式自動） |
| 互動站位走不到、按 E 沒反應 | 手填站位：落在格線上、離物件超過 56 px、或在縫裡 | 站位用程式挑（步驟 5） |
| 終點格中心被精細碰撞蓋住就找不到路 | 尋路只走格子中心 | facility.ts 的 findPath 已改成：任一格中心能直線走到終點就算到 |
| 一件物件被切成兩件、順序全亂 | 並排的東西（兩個油桶）中間有空隙 | 切圖先把 40 px 內的塊併成一件 |
| 物件乾淨但看起來很中古（工程區 batch20） | prompt 只寫 clean / no rust，Image2 又拿舊設計表叫模型照抄 | 寫出 2090 sci-fi 設計語言＋禁止項；不要拿舊風格的物件表當設計來源，改用文字描述＋使用者的風格參考圖 |
| 照搬別的場景格局 | 沒先想這裡的功能 | 步驟 2 先寫動線與分區 |
| 「備用物件」又變回正面圖（冰箱、櫃子、沙發只剩一條薄頂面） | 跳過步驟 3，直接生 3 × 3 物件表，參考圖只拿來「抓鏡頭」——模型單獨畫物件時一律退回正面 | **沒有例外**：還沒定位置的物件也要先上擺設參考圖（底圖用空房間 `場景/工程區/base_showroom.png`，3 × 3 擺開），最終物件再拿底圖＋參考圖生 |

## 瀏覽器測試小技巧

側邊瀏覽器面板隱藏時 `requestAnimationFrame` 不會跑，畫面不更新。測試時先在頁面執行
`window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`，
再截一次圖讓迴圈接上。
