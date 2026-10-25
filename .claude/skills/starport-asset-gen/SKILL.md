---
name: starport-asset-gen
description: 星際港（環狀太空站生活模擬遊戲）的 2D 素材生成規範：畫風（HD 像素風）、視角、格子尺寸、光源、材質配色、背景與檔名。寫任何生圖 prompt 前都要先看。當使用者提到星際港的素材、家具、物件、道具、貼圖、sprite、tileset、生圖 prompt、視角不對、尺寸不一致、素材風格不統一時，一律使用本技能。即使使用者只說「幫我生一張餐廳的桌子」或「這張椅子角度怪怪的」也要使用。場景物件的繪製流程看 starport-scene-props，整張地圖看 generate2dmap。
---

# 星際港 2D 素材生成規範

本技能定所有生圖素材共用的畫風與規格。流程不在這裡：

- 機台、家具、擺設：`.claude/skills/starport-scene-props/`（單件物件、洋紅底、正面俯視，再由使用者在 PSD 排位置）。
- 地板、牆、底圖、門、碰撞：`.claude/skills/generate2dmap/`。
- 角色：`docs/characters.md`。
- 溫室作物、食物、道具圖示：第七節（另一套提示詞）。

核心原則：生圖模型抓不準幾何。視角與比例靠參考圖（底圖、設計稿、風格參考圖）與第三節的鏡頭規則傳達，文字只描述畫風、材質、造型與用途；尺寸一律後製縮放。

**寫 prompt 的順序**：① 第一節「共用規則段」原文照貼 → ② 物件描述與設計語言（第四節材質、`starport-scene-props` 的設計語言） → ③ 鏡頭（第三節） → ④ 背景與禁止項（第二節）。

---

## 一、畫風：HD 像素風

全遊戲統一 HD pixel art：**生圖時照一格 96 × 96 px 的細節密度畫，進遊戲縮小一半成一格 48 × 48 px**（切圖時縮，或物件切 2 倍、map.json 設 `scale: 0.5`）。整體是明亮、友善、保養良好的 2090 年 sci-fi RPG，不要鏽斑油污。

### 規則（中文說明；英文原文在下面的共用規則段）

| 規則 | 內容 | 為什麼 |
|---|---|---|
| 像素塊 | 方形像素塊、階梯狀輪廓、每種材質 2–3 階硬像素明暗、少數像素高光 | 只寫「平塗、不要漸層」會變成扁平向量風，像素感消失 |
| 4×4 像素格 | 寫明「畫布是放大 4 倍的像素畫，每個像素是 4×4 方塊，沒有比一格更細的細節」 | GPT 不會真的對齊格子，但用色髒亂、描邊粗細不一明顯改善；原圖顏色數仍有十幾萬（邊緣過渡＋輸出雜訊），轉 webp 後無所謂，不必追求 |
| 描邊 | 粗細一致、連續不斷；顏色用該部位本色最深一階（紅→深酒紅、藍布→深藏青、米白→深暖灰、木頭→深咖啡），不准純黑 | 使用者定（參考像素愛心） |
| 圓角 | 一律畫成像素階梯（每階 1–2 格內縮），不要平滑曲線，也不要 45° 斜切角（除非設計要倒角）。區域表裡的「圓角」都照這個畫法 | 同上 |
| 乾淨 | 不要髒污、雜點、水彩斑紋，大面積不要雜紋；白色外殼統一米白，不要冷白、灰紫 | 醫療室第一版又髒又灰 |
| 燈光 | 不准光暈、泛光、霧氣，連 1–2 格柔邊都不准；燈條、螢幕、招牌是硬邊亮色像素塊；燈不照亮別的東西（地面、牆、吧台上不准有色光反射或亮斑） | 光暈畫死在圖上，場景燈光改變時對不上；要發光在遊戲裡另外加 |
| 玻璃 | 均勻淡藍灰＋幾條直線反光，不起霧，裡面的東西畫清楚 | |
| 不帶地面 | 建築與物件不帶地磚、地坪、底座、地面陰影，底部切成水平直線 | 地板由地圖畫；GPT 畫地磚很容易帶透視（梯形、格線往遠處收） |

遊戲裡的成品：縮小一半後像素塊和階梯邊融成平滑的線，變成「粗細一致的同色系描邊＋2–3 階色塊＋小塊高光」，看不到像素格。這是預期的結果，A-1 房間就是基準；不要因為成品看起來平滑就判定畫風不對。縮小用平滑縮放（LANCZOS），不要用最近鄰：GPT 的像素沒有對齊固定格子，最近鄰會變得一塊塊很碎。

### 共用規則段（每個 prompt 原文照貼在最前面）

以這段為準；改規則時先改這段，再同步上面的表。醫療室 `prompts.md` 裡 10-24 的「乾淨畫法規則」是舊版。

```
STYLE — HD PIXEL ART (most important): high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 96 x 96 pixel tile. Clearly visible square pixel clusters, stepped pixel edges on curves and diagonals, shading done with two or three crisp pixel shade steps per material (hard pixel clusters), selective single-pixel highlights. One consistent pixel scale across the whole image. Real pixel art, not a smooth vector illustration, not a painting, not a smooth painting with a pixel filter. No antialiasing, no blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Clean, friendly sci-fi of the year 2090, well maintained, no rust, no grime. Light from the upper left.
- PIXEL GRID: the whole canvas is a pixel-art picture shown at 4x zoom (a 1536 x 1024 canvas is 384 x 256 art pixels). Every art pixel is exactly one 4 x 4 block aligned to one shared grid. No detail, line, star or highlight smaller than one art pixel (4 x 4). No antialiasing between blocks.
- OUTLINES: one uniform outline of the same thickness around every object and every major part, continuous and unbroken, never blurry, never thicker in some places. Outline colour is the darkest shade of the part's own colour, never pure black: warm white shell -> dark warm grey, blue fabric -> dark navy, mint -> dark teal, wood -> dark brown.
- CORNERS: rounded corners are pixel staircases (steps of 1-2 pixels stepping inward), never smooth curves or antialiased arcs; rounded, not chamfered or 45-degree cut corners (unless the design asks for chamfers).
- CLEAN: no smudges, no noise, no grain, no dirt, no watercolour texture, no stains; no texture noise on large surfaces, use a few hard pixel shade areas instead. Clean colours: warm off-white (cream-white) shells with light warm-grey shading, graphite trim, accents in mint green, cyan and soft blue. No muddy, greyish-purple or dirty tints.
- LIGHTS: NO glow, NO bloom, NO haze, NO light halo around anything, not even a 1-2 pixel soft rim. Light strips, screens, signs and holograms are solid bright pixel shapes with a hard crisp edge, plus at most one lighter inner line; the colour never bleeds outside the shape. Lights never light up anything else: no coloured light spill, reflection or bright patch on floors, walls, counters or furniture.
- GLASS: evenly tinted pale blue-grey with two or three thin straight pixel reflection lines; things behind glass are drawn clearly, no fog.
- SPRITES: NO ground, floor tiles, pavement, plinth or ground shadow around a building or object (the floor comes from the game map); it ends at its base with a flat, perfectly horizontal bottom edge. Strictly orthographic: no perspective, no converging lines, no trapezoid shapes, vertical edges perfectly vertical. Each object faces the viewer head-on: front face parallel to the image with its top visible above it; no side faces, no rotation, no isometric placement.
```

### 後處理

- 去背、切圖：`tools/art/cut.py`。透明底會跑 `clean_edges()`：GPT 透明底的「不透明」常只有 alpha 253、輪廓線半透明、外圍有半透明陰影霧，這步把實心補滿、柔邊換成物件本色、外圍陰影霧刪掉。物件本身要半透明（玻璃）的批次在 `<場景>_objects.py` 的 `KEEP_ALPHA` 列出來就不跑。
- 對格＋減色（選用）：`tools/art/pixel_snap.py`，找出 GPT 隱含的像素格、每格收成一色、減到固定色數。只在 GPT 的格子整齊時有效（自動只抓整數格，抓不準用 `--grid` 指定）；格子不固定的圖會錯位，不要硬用。

---

## 二、固定規格

| 項目 | 值 |
| --- | --- |
| 投影 | 斜俯視 three-quarter top-down（看得到正面＋頂面），正交無透視，跟 RPG Maker、星露谷一樣；物件本身不旋轉（第三節） |
| 格子 | 遊戲裡一格 48 × 48 px ≈ 1 公尺（生圖時照一格 96 px 的密度畫，再縮小一半）；地板格是正方形，不壓縮 |
| 牆 | 高度、牆頂厚度、前景遮擋照 `問題修正紀錄.md`「牆與遮擋」 |
| 光源 | 左上 |
| 陰影 | 物件圖不畫地面陰影 |
| 錨點 | 底部中央，對齊佔地的下緣 |
| 背景 | 純洋紅 #FF00FF，或透明（GPT 常直接給透明，`cut.py` 兩種都能去背）；物件本身帶紫紅時改中性灰 #808080 |

不用等角（isometric）。環狀艦體有大量弧牆，等角網格畫弧會扭曲；斜俯視的角色也只需要四方向行走圖。

尺寸不交給模型決定：prompt 只講佔幾格，生成後依佔格縮放。模型回傳的圖不一定是 1024（常給 1254），切圖座標一律依圖寬等比例換算。

---

## 三、鏡頭與用詞

- 要寫：orthographic、no perspective convergence、parallel edges，以及 three-quarter top-down RPG view。
- 不要寫 isometric：模型會給帶透視收縮的假等角。
- 不要只寫 top-down：會得到正上方俯視，看不到物件正面。
- 不要寫 soft shading、soft cel shading、glow。
- **正面俯視，不准看到側面（使用者定）**：物件正面跟畫面平行、上方露出頂面，左右側面都不能出現，不可以斜放、旋轉、等角或轉三分之四；垂直的邊在畫面上要正垂直。斜的物件放不進地圖，直接作廢。沿畫面上下方向的長物件（例：直向櫃台）要寫明「長軸指向畫面正上方、畫成直立一長條、只露出下端的正面」。只叫模型參考科幻範例圖時特別容易畫斜，鏡頭段要寫在設計段前面、標 most important。
- 一定要帶 high-resolution 和 96 × 96 tile 的細節密度（共用規則段第一句），不然模型容易畫成低解析度的粗像素小圖。

---

## 四、材質基準（依區域）

全艦共通底：霧面白金屬與淺灰複合板，接縫為深灰。

| 區域 | 追加特徵 |
| --- | --- |
| 艦橋 | 深灰金屬、大量嵌入式螢幕、青藍背光 |
| 物資區接口 | 裸露結構、貨櫃黃黑警示條、粗管線 |
| 餐廳 | 白色與淺木紋、圓角、溫暖照明 |
| 商業娛樂區 | 彩色霓虹點綴、軟包座椅、亮面材質 |
| 研究室 | 純白無塵、玻璃、實驗檯不鏽鋼 |
| 農業區 | 濕潤感、綠色植栽、鍍鋅金屬、水管 |
| 醫療室 | 白綠配色、圓角無銳邊、消毒感 |
| 工程區 | sci-fi workshop concept：霧面石墨與白色複合外殼、圓角倒角、隱藏式螺絲、模組化收納（可堆疊工具箱、洞洞板）、嵌入式青藍燈條；警示黃／琥珀只當小點綴 |
| 居住區 | 暖木紋飾板、布質、柔和照明 |
| 內側道路 | 灰色地板、扶手、導引燈條 |

「溫暖照明」「霓虹」「背光」一律照第一節的燈光規則畫成硬邊亮色塊，不畫光暈。

年代是 2090 年（`docs/world.md`），設計語言與禁止項見 `starport-scene-props`「視角規範」；不要紙本、文字、標誌。

艙房採通用底圖加個人陳設物件。生成陳設小物時，以佔用者的職業決定：研究員堆資料、工程師散零件、醫護放藥盒。每人三到五件即可，格局共用。

---

## 五、常見失敗與修法

| 症狀 | 原因 | 修法 |
| --- | --- | --- |
| 物件有透視收縮，遠端變窄 | 只用文字描述視角 | 底圖或擺設參考圖當 image1，prompt 加 no perspective convergence |
| 物件扁扁的、只有一條薄頂面 | 用白模定視角，或沒寫要露出頂面 | 第三節正面俯視（正面＋頂面），不用白模 |
| 物件斜放、看得到側面 | 鏡頭規則沒放前面，或只叫它參考範例圖 | 第三節「正面俯視」那段寫在設計段前面 |
| 同批物件角度不一 | 分次呼叫 | 同類物件同一張圖一起生（分類規則見 `generate2dmap` 第 6 步） |
| 尺寸忽大忽小 | 想靠 prompt 控制像素 | 尺寸只在後製處理，prompt 只講佔幾格 |
| 底部畫出地板、地磚帶透視、陰影融進地面 | 沒禁止場景 | 共用規則段的 SPRITES 條不能省 |
| 光暈、燈光照到地面 | 沒禁止光線外溢 | 共用規則段的 LIGHTS 條不能省；描述氣氛時也不要寫 glowing、warm light |
| 洋紅滲進物件配色 | 模型把背景色當調色盤 | 背景改中性灰 #808080 或透明 |
| 透明底邊緣有灰黑霧、輪廓透色 | GPT 的透明度不乾淨 | `cut.py` 會自動跑 `clean_edges()` |
| 畫成平滑插畫或扁平向量風，像素感不見 | 沒帶共用規則段、帶了舊的 hand-painted 風格段，或只寫「平塗」 | 換成共用規則段；拿舊的手繪素材當參考圖時，寫明只照它的造型與視角，畫風改成像素風 |
| 用色髒、描邊粗細不一、像套濾鏡 | 沒限定像素尺度 | 共用規則段的 PIXEL GRID 條與 one consistent pixel scale 不能省 |
| 圓角變成 45° 斜切角 | 只寫 rounded corners | 共用規則段的 CORNERS 條（not chamfered） |

---

## 六、檔名與分層

- 原始生成圖：`tools/art/<場景>/raw/`，只留有採用的版本。prompt 寫在同場景的 `tools/art/<場景>/prompts.md`（一張圖一節，實際送出的完整 prompt）；風格參考圖放 `tools/art/<場景>/style_ref/`。試錯過程的檔案（試畫、切給模型的輸入圖、比對圖、一次性腳本）放暫存區，不進專案（使用者定）。
- 遊戲素材：`public/assets/<場景>/`，轉無損 WebP（`tools/to_webp.py`）。物件放 `props/`，檔名用英文小寫加連字號，例：`parts-shelves.webp`、`mini-fridge.webp`。
- 分層照 `generate2dmap`：底圖（地板、外牆立面）、decor（室內牆、家具、機台，依底邊跟角色排前後）、門、前景（牆簷、欄杆）。生成前先確認物件屬於哪一層。

---

## 七、作物與食物圖示

溫室作物、食物、道具圖示用另一套 cute pixel RPG 提示詞，不套第一節的共用規則段。

- 作物：提示詞、三階段規則、排位配置都在 `tools/art/greenhouse_crop_prompts.md`，照檔案流程生成。
- 溫室已完成（2026-10-16），排架、切圖的腳本已刪；遊戲素材在 `public/assets/greenhouse/`。
- 栽種架是左端／中段／右端三段（各 48 × 144 px），中段每 48 px 重複一次。
- 層架每層開口約 22 px 高，作物以 24 × 24 px 可讀為準；挑高藤架開口約 104 × 75 px，藤蔓作物以 24 × 72 px 為準。
- 原始圖放 `tools/art/crops/raw/`，檔名用作物英文名（例：`lettuce.png`）。
