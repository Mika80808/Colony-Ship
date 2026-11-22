---
name: starport-asset-gen
description: 星際港（環狀太空站生活模擬遊戲）的 2D 素材生成規範：生圖 prompt 範本（規則少、給場景關鍵字）、視角、格子尺寸、各場景主題關鍵字、背景與檔名。寫任何生圖 prompt 前都要先看。當使用者提到星際港的素材、家具、物件、道具、貼圖、sprite、tileset、生圖 prompt、視角不對、尺寸不一致、素材風格不統一時，一律使用本技能。即使使用者只說「幫我生一張餐廳的桌子」或「這張椅子角度怪怪的」也要使用。場景物件的繪製流程看 starport-scene-props，整張地圖看 generate2dmap。
---

# 星際港 2D 素材生成規範

本技能定所有生圖素材共用的 prompt 寫法與規格。流程不在這裡：

- 機台、家具、擺設：`.claude/skills/starport-scene-props/`（單件物件、正面俯視，再由使用者在 PSD 排位置）。
- 地板、牆、底圖、門、碰撞：`.claude/skills/generate2dmap/`。
- 角色：`docs/characters.md`。
- 溫室作物、食物、道具圖示：第六節（另一套提示詞）。

## 一、核心原則：規則少、給場景關鍵字（2026-11-23 使用者定）

L 型吧檯試了七版得出的結論（過程與每版 prompt 在 `tools/art/bar/prompts.md`）：

1. **共用規則只留三條**：鏡頭（正面俯視、無透視）、燈光（硬邊、不准光暈）、地面（不帶地板與影子）。禁止項列越多，模型越不敢畫，成品越空（v1、v5 只剩一塊板子）。
2. **畫風不用寫**：「top-down 2D RPG 的 game sprite」本身就會帶出這個遊戲要的像素風（v6、v7）。寫死像素規則（4×4 格、階梯圓角、直線構圖）反而砍掉細節（v2、v4）；寫死材質畫法或改成插畫會變寫實（v3）。斜的效果用像素階梯錯位畫出來是正常的。
3. **要求精緻要用正面寫法**：明寫 richly detailed、layered、finely crafted、plenty of interesting design detail。
4. **物件風格靠場景關鍵字**：每個場景給一個主題＋3–5 個關鍵字（第四節），再加一句「一看就是什麼東西」。材質、顏色、細節讓模型自由設計。
5. **不附任何參考圖**：風格參考圖會讓每件長得一樣；白膜（實心灰色剪影、程式白模、形狀參考圖）會被照描，畫得又平又空。形狀、尺寸、鏡頭一律用文字寫。唯一例外：排多件物件位置用的細框線尺寸框，或重畫同一件時的舊圖（寫明只看是什麼東西）。

## 二、prompt 範本（照這個填）

`<...>` 換成實際內容，其他原文照貼。這是唯一正本；其他 skill、任務單、AGENTS.md 只引用。`tools/art/*/prompts.md` 與 `docs/tasks/` 裡 2026-11-23 以前的長版規則段是歷史紀錄，不要照抄。

```
Generate ONE image with your image generation tool and save it as ./tools/art/<scene>/raw/<file>.png. Use image generation, not code. No input images are attached on purpose. Do not edit or create any other files. After saving, look at the image and check the CAMERA, LIGHTS and GROUND rules below; if one fails, generate again (at most 3 tries).

Draw ONE object only: <object, e.g. an L-shaped bar counter> for <place, e.g. a cyberpunk neon lounge bar> on a space station in the year 2090, as a game sprite for a top-down 2D RPG. Make it richly detailed, layered and finely crafted: a premium, high-quality stylised 2D game asset (not photorealistic, not a 3D render), with plenty of interesting design detail. Theme: <THEME>. Keywords: <3-5 keywords>. It must clearly read as <what it is and how people use it>. Materials, colours and details are your free design choice.

CAMERA (game requirement, MOST IMPORTANT): strict orthographic straight front view as in a classic top-down RPG. <shape: the front face is parallel to the image, with its top shown as a horizontal band above it; size in metres; any part that runs away from the viewer is drawn as a vertical strip seen from above>. No perspective, no vanishing point, no trapezoid, no visible side faces, no rotation, no isometric view. Canvas 1536 x 1024, one metre = 128 pixels, object centred.

LIGHTS: neon, screens and holograms are crisp bright shapes with hard edges; no glow, bloom or halo around them and no light cast onto anything.

GROUND: no floor, no ground shadow; the object ends at a flat horizontal bottom edge. Background: flat <pure magenta #FF00FF | neutral grey #808080>. No text, no people.
```

- 背景預設洋紅；主題會用到粉紅、洋紅、紫（例：酒吧霓虹）時改中性灰 #808080。
- 一張畫多件同類物件時，`Draw ONE object only` 改成逐件列出，物件之間留空隙。
- 範例：`tools/art/bar/prompts.md` 的 v7（L 型吧檯）。

**驗收時看**（不寫進 prompt，有問題才在下一次 prompt 補一句）：

- 正面俯視：看不到側面、沒有梯形、垂直的邊是正垂直；斜的物件放不進地圖，作廢。
- 桌子、檯面是完整長方形，四角不缺角、不斜切（使用者定，2026-11-22）。
- 沒有光暈、燈不照亮別的東西；沒有地板、地面陰影。
- 一看就知道是什麼東西；精緻、不空。

## 三、固定規格

| 項目 | 值 |
| --- | --- |
| 投影 | 斜俯視（看得到正面＋頂面），正交無透視，跟 RPG Maker、星露谷一樣；物件本身不旋轉 |
| 格子 | 遊戲裡一格 48 × 48 px ≈ 1 公尺。生圖時 prompt 只寫「一公尺 = 128 px」，不提倍率 |
| 2 倍再縮一半 | **全是後製，不寫進 prompt**（GPT 畫圖時做不到）：`cut.py` 把原圖縮成一格 96 px 的 2 倍圖，map.json 設 `scale: 0.5` 在遊戲裡縮一半，物件看起來更精緻 |
| 牆 | 高度、牆頂厚度、前景遮擋照 `問題修正紀錄.md`「牆與遮擋」 |
| 陰影 | 物件圖不畫地面陰影 |
| 錨點 | 底部中央，對齊佔地的下緣 |
| 背景 | 洋紅 #FF00FF 或中性灰 #808080，或透明（`cut.py` 都能去背） |

- 不用等角（isometric）：環狀艦體有大量弧牆，等角網格畫弧會扭曲；斜俯視的角色也只需要四方向行走圖。
- 尺寸不交給模型：prompt 只講幾公尺，生成後依佔格縮放。模型回傳的圖不一定是 1536（常給 1254 等），切圖座標一律依圖寬等比例換算。
- 鏡頭用詞：寫 orthographic straight front view、top-down RPG；不要寫 isometric（會給帶透視的假等角），不要只寫 top-down（會變正上方俯視，看不到正面）。沿畫面上下方向的長物件（直向櫃台、L 型的短邊）要寫明「往畫面上方延伸、從上面看是一條直立長條、看不到側面」。
- 縮小用平滑縮放（LANCZOS），不要用最近鄰。縮一半後像素塊融成平滑的線、看不到像素格，是預期的結果。

### 後處理

- 去背、切圖：`tools/art/cut.py`。透明底會跑 `clean_edges()`：GPT 透明底的「不透明」常只有 alpha 253、輪廓線半透明、外圍有半透明陰影霧，這步把實心補滿、柔邊換成物件本色、外圍陰影霧刪掉。物件本身要半透明（玻璃）的批次在 `<場景>_objects.py` 的 `KEEP_ALPHA` 列出來就不跑。
- 發光效果不畫在圖上，在遊戲裡另外加（`場景渲染架構.md` Layer 3、7）。

---

## 四、場景主題與關鍵字

prompt 的 `Theme` 與 `Keywords` 從這裡挑。**這是方向提示，不是色票**：不寫死顏色與材質，讓模型自由設計。新場景先跟使用者定好主題與關鍵字，再填進這張表。

發光元件的冷暖（2026-11-10 使用者定）：機能區（艦橋、物資區接口、研究室、農業區、醫療室、工程區、內側道路）偏青色；生活區（中央廣場與各店、居住區、玩家宿舍）偏琥珀。各店自有的霓虹不受此限。可以當關鍵字寫進去（cyan lights／amber lights）。

| 場景 | Theme | Keywords |
| --- | --- | --- |
| 酒吧 | CYBERPUNK NEON | American retro bar, classic cocktail bar counter, beer taps, drink rail, foot rail（吧檯用；其他物件換成該物件的關鍵字）（2026-11-23 定稿） |
| 艦橋 | COMMAND BRIDGE | flight consoles, embedded screens, cyan backlight, dark metal |
| 物資區接口 | CARGO DOCK | exposed structure, cargo containers, heavy conduits, warning markings |
| 中央廣場 | INDOOR STATION STREET | street furniture, glass elevator tower, digital signboards, exposed ceiling pipes, amber lights |
| 餐廳 | JAPANESE TEISHOKU DINER | light wood, cream and indigo, warm ceiling lamps |
| 咖啡自助吧檯 | COZY SELF-SERVICE CAFÉ | milk-tea tones, caramel, self-service coffee machines |
| 無人販賣櫃 | MINIMAL URBAN VENDING | clean pale blue, soft yellow light, automated lockers |
| 服飾店／雜貨店（裝飾門面） | BOUTIQUE SHOPFRONT | dusty pink (clothing), sage green (general store) |
| 研究室 | CLEAN-ROOM LAB | pure white, glass, stainless lab benches |
| 農業區 | HYDROPONIC FARM | lush green plants, galvanised metal, water pipes, humid |
| 醫療室 | FRIENDLY MEDICAL BAY | white and mint, soft rounded shapes, sterile, mint and cyan lights |
| 工程區 | SCI-FI WORKSHOP | modular tool storage, stackable toolboxes, pegboards, cyan light strips |
| 居住區 | COZY CREW QUARTERS | warm wood panels, fabric, soft lighting, amber lights |
| 內側道路 | STATION CORRIDOR | handrails, guide light strips |

- 年代是 2090 年（`docs/world.md`）：不要紙本、文字、標誌（範本已寫 No text）。
- 艙房採通用底圖加個人陳設物件。陳設小物以佔用者的職業決定：研究員堆資料、工程師散零件、醫護放藥盒。每人三到五件即可，格局共用。

---

## 五、常見失敗與修法

| 症狀 | 原因 | 修法 |
| --- | --- | --- |
| 成品很空，只有一塊板子加幾條線（吧檯 v1、v5） | 禁止項太多，模型選擇什麼都不畫 | 用第二節範本，禁止項只留三條；加正面要求 richly detailed |
| 細節很多但不像該物件（吧檯 v6） | 只給主題，沒給物件關鍵字 | Keywords 補上這個物件特有的部件與用途（吧檯：beer taps, foot rail） |
| 太寫實、像 3D 渲染（吧檯 v3） | 寫死材質畫法，或要求插畫風 | 不寫畫風、不寫材質畫法，用範本的 stylised 2D game asset |
| 精緻度差、像向量小圖示（吧檯 v2、v4） | 寫死像素規則（4×4 格、直線構圖、平塗分階） | 不寫像素規則，game sprite 本身會帶出像素風 |
| 又平又空，形狀照描（吧檯 v1） | 附了白膜（灰色剪影） | 不附圖，形狀用文字寫 |
| 一批物件全長得一樣 | 附了風格參考圖 | 不附風格參考圖 |
| 物件斜放、看得到側面、遠端變窄 | 鏡頭段沒標 most important 或寫得不清楚 | 範本的 CAMERA 段寫清楚每個部分的朝向 |
| 光暈、燈光照到地面 | 沒寫 LIGHTS | 範本的 LIGHTS 段不能省；描述氣氛時不要寫 glowing、warm light |
| 底部畫出地板、陰影融進地面 | 沒寫 GROUND | 範本的 GROUND 段不能省 |
| 桌面缺角、斜切（藥局桌子） | 模型自由發揮 | 下一次 prompt 補一句：the worktop is a full rectangle, no cut-off corners |
| 洋紅滲進物件配色 | 模型把背景色當調色盤 | 背景改中性灰 #808080 |
| 尺寸忽大忽小 | 想靠 prompt 控制像素 | 尺寸只在後製處理，prompt 只講幾公尺 |
| 同批物件角度不一 | 分次呼叫 | 同類物件同一張圖一起生（分類規則見 `generate2dmap` 第 6 步） |
| 透明底邊緣有灰黑霧、輪廓透色 | GPT 的透明度不乾淨 | `cut.py` 會自動跑 `clean_edges()` |

---

## 六、作物與食物圖示

溫室作物、食物、道具圖示用另一套 cute pixel RPG 提示詞，不套第二節的範本。

- 作物：提示詞、三階段規則、排位配置都在 `tools/art/greenhouse_crop_prompts.md`，照檔案流程生成。
- 溫室已完成（2026-10-16），排架、切圖的腳本已刪；遊戲素材在 `public/assets/greenhouse/`。
- 栽種架是左端／中段／右端三段（各 48 × 144 px），中段每 48 px 重複一次。
- 層架每層開口約 22 px 高，作物以 24 × 24 px 可讀為準；挑高藤架開口約 104 × 75 px，藤蔓作物以 24 × 72 px 為準。
- 原始圖放 `tools/art/crops/raw/`，檔名用作物英文名（例：`lettuce.png`）。

---

## 七、檔名與分層

- 原始生成圖：`tools/art/<場景>/raw/`，只留有採用的版本。prompt 寫在同場景的 `tools/art/<場景>/prompts.md`（一張圖一節，實際送出的完整 prompt）；使用者給的風格參考圖放 `tools/art/<場景>/style_ref/`，只給人看、討論方向用，不交給生圖模型。試錯過程的檔案（試畫、比對圖、一次性腳本）放暫存區，不進專案（使用者定）。
- 遊戲素材：`public/assets/<場景>/`，轉無損 WebP（`tools/to_webp.py`）。物件放 `props/`，檔名用英文小寫加連字號，例：`parts-shelves.webp`、`mini-fridge.webp`。
- 分層照 `generate2dmap`：底圖（地板、外牆立面）、decor（室內牆、家具、機台，依底邊跟角色排前後）、門、前景（牆簷、欄杆）。生成前先確認物件屬於哪一層。
