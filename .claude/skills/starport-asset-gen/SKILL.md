---
name: starport-asset-gen
description: 星際港（環狀太空站生活模擬遊戲）的 2D 場景素材生成規範。用於產出家具、物件、場景道具的 AI 生圖 prompt，鎖定視角、tile 尺寸、光源方向、材質配色與檔名規則。當使用者提到星際港的素材、家具、物件、道具、貼圖、sprite、tileset、生圖 prompt、視角不對、尺寸不一致、素材風格不統一、要用 GPT Image / Nano Banana / Midjourney 生成遊戲物件時，一律使用本技能。即使使用者只說「幫我生一張餐廳的桌子」或「這張椅子角度怪怪的」也要使用。
---

# 星際港 2D 素材生成規範

本技能負責把「我要一張某某家具」翻譯成一段可直接送進生圖模型的 prompt，並確保全艦三十幾個場景的素材視角、比例、光源、配色一致。

核心原則：AI 生圖不擅長幾何精確性。所有幾何約束用參考圖傳達，不用文字描述；文字只負責描述材質、造型與用途。

---

## 一、固定規格（不可更動）

| 項目 | 值 |
| --- | --- |
| 投影 | 斜俯視 three-quarter top-down，正交無透視 |
| Tile | 64 × 64 px，1 格 = 1 公尺 |
| 地板格 | 正方形，不壓縮 |
| 頂面 | 每格深度只給 16 px（薄薄一條）。**場景物件（機台、家具、擺設）不適用**：照這條會畫成正面圖，改走 `.claude/skills/starport-scene-props/` 的擺設參考圖流程 |
| 角色立高 | 96 px（1.5 格） |
| 一般牆高 | 128 px（2 格） |
| 環狀區雙層挑高 | 192 px（3 格） |
| 光源 | 左上 45 度固定 |
| 陰影 | 底面外框往右下偏 12 / 8 px，黑 35%，獨立圖層 |
| 錨點 | 底部中央，對齊所在格下緣中點 |
| 畫布 | 1024 × 1024，物件置中 |
| 背景 | 純洋紅 #FF00FF（去背用） |

不用等角（isometric）。環狀艦體有大量弧牆，等角網格畫弧會扭曲；斜俯視角色只需四方向行走圖，等角要八方向。

尺寸永遠不交給 AI 決定。生成一律 1024 方形，生成後按 tile 單位在 Aseprite 或腳本裡縮放。要控制的是「佔幾格」，那件事由參考圖的格線傳達。

---

## 二、標準工作流程

1. 確認物件的佔格數與高度（例：四人餐桌 3 × 2 格，高 1 格）。
2. 帶入視角校準板當 image1。校準板是一張 1024 × 1024 的圖，含 16 × 16 格線、三個白色量體（1×1×1、2×1×1、1×1×2）、光源箭頭。若專案裡還沒有，先產出一張。
3. 套用下方 prompt 模板。
4. 一次生一張 sprite sheet，不要一件一件生。
5. 去背、切割、按 tile 縮放、命名入庫。

### 一次生一批，不要一件一件生

要求 3 × 3 九件家具放在同一張圖裡，共用同一片地板格線與同一個光源方向。模型在單張圖內部會自我對齊，同批物件的視角與陰影一致性遠高於分九次呼叫。切割是零成本的後製。

同一個場景的家具務必同批生成。跨批次時，把上一批的成品也當參考圖帶入（gpt-image-2 最多 16 張），維持風格延續。

---

## 三、Prompt 模板

固定前綴，每次照抄：

```
Follow the projection angle, grid proportion and light direction of image1.
Orthographic top-down three-quarter view. No perspective convergence.
All vertical edges strictly parallel. Thin top face only.
Light from upper-left 45 degrees, contact shadow to lower-right.
Background: solid magenta #FF00FF, no gradient, no texture.
Single object centered on canvas, no floor, no scene, no props around it.
```

接著才是物件描述，格式：

```
Object: <造型與用途描述>
Footprint: <N> x <M> tiles, height <K> tiles
Material: <材質>
```

範例：

```
Object: a four-person mess hall dining table, rounded corners, single
central pedestal leg with a circular base plate, recessed cable channel
along the underside
Footprint: 3 x 2 tiles, height 1 tile
Material: matte white composite panel top, brushed dark grey metal leg
```

### 用詞禁令

不要寫 isometric。模型會給你帶透視收縮的假等角。

不要寫 game asset、RPG sprite、pixel art（除非真的要點陣）。這些詞會觸發模型去模仿低解析度素材，細節直接糊掉。要的是高解析度插畫再縮放。

不要寫 top-down 單獨使用。會得到正上方俯視，看不到物件正面。

要寫的是 orthographic、no perspective convergence、parallel edges。這三組詞命中率最高。

---

## 四、材質基準（依區域）

全艦共通底：霧面白金屬與淺灰複合板，接縫與螺栓為深灰，發光元件統一青藍 #4DD0E1。

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

艙房採通用底圖加個人陳設物件。生成陳設小物時，以佔用者的職業決定：研究員堆資料、工程師散零件、醫護放藥盒。每人三到五件即可，格局共用。

---

## 五、常見失敗與修法

| 症狀 | 原因 | 修法 |
| --- | --- | --- |
| 物件有透視收縮，遠端變窄 | 只用文字描述視角 | 校準板沒帶進去，或被壓在第二張以後。移到 image1 |
| 同批物件角度不一 | 分次呼叫 | 改成同一張 sprite sheet 一次生 |
| 尺寸忽大忽小 | 想靠 prompt 控制像素 | 尺寸只在後製處理，prompt 只講佔幾格 |
| 底部畫出地板或陰影融進地面 | 沒禁止場景 | 前綴補 no floor, no scene, isolated object |
| 洋紅滲進物件配色 | 模型把背景色當調色盤 | 背景改中性灰 #808080，改用 rembg 去背 |
| 頂面畫太厚，變成正上方俯視 | 頂面比例沒傳達 | 校準板的三個量體要清楚畫出 16 px 頂面 |
| 物件太寫實，跟角色立繪不搭 | 沒限定風格 | 加 clean flat illustration, soft cel shading, minimal texture noise |

gpt-image-2 不支援透明背景輸出。要透明 PNG 得改用 gpt-image-1.5，或走純色背景加後製去背，後者邊緣通常更乾淨。

---

## 六、檔名與入庫

```
<區域>_<物件>_<佔格>_<變體>.png
例：mess_table_3x2_a.png
    quarters_desk_2x1_engineer.png
```

依《場景渲染架構》分層歸位：

- 不會動的家具、地板、牆面 → Layer 1 Background
- 有固定動畫的（螢幕、門、風扇、火焰）→ Layer 2，另出逐幀序列
- 發光、水波、霧氣 → 不出圖，走 Layer 3 Shader
- 煙、蒸氣、火花 → 不出圖，走 Layer 4 Particle
- 角色前方的遮擋物（柱子、管線、屋簷）→ Layer 6 Foreground，另存一份

生成前先確認物件該進哪一層。會發光的儀表板不要把光暈畫進 Layer 1 的圖，那是 Shader 的工作，畫進去會導致夜間色調切換時光暈方向與強度對不上。

---

## 七、產出校準板

專案裡若還沒有校準板，用 Python（Pillow 或 svgwrite）或直接寫 SVG 產出，規格：

- 1024 × 1024，16 × 16 格線，每格 64 px，線寬 1 px 中灰
- 量體 A：1×1×1 → 正面 64w × 64h，頂面 64w × 16h
- 量體 B：2×1×1 → 正面 128w × 64h，頂面 128w × 16h
- 量體 C：1×1×2 → 正面 64w × 128h，頂面 64w × 16h
- 三者底邊對齊同一基線，方便讀出高度差
- 左上 45 度光源箭頭，每個量體帶右下偏移的接地陰影
- 量體塗白，頂面最亮、正面次之，邊線深灰

若使用者對美觀有要求，改用 Blender 拉三個白模、正交相機（Orthographic，不是 Perspective）算圖輸出，品質遠勝程式畫線。

---

## 八、進階：幾何交給建模

硬邊物件（控制台、管線組、階梯、艦橋儀表）若上述方法仍不穩，改走：Blender 拉低模白模 → 正交相機算圖 → 當參考圖 → 生圖模型只負責上材質與風格化。

幾何 100% 正確，AI 只做它擅長的事。星際港的科幻家具多為方盒子，白模建模成本很低，值得為反覆出現的物件做一次。

---

## 九、例外：作物與食物圖示（像素 RPG 畫風）

溫室作物、食物、道具圖示不走上面的斜俯視插畫流程，改用像素 RPG 畫風。第三節「不要寫 pixel art、RPG sprite」的禁令不適用於這一類。

- 作物：提示詞、三階段規則、排位配置都在 `tools/art/greenhouse_crop_prompts.md`，照檔案流程生成。
- 栽種架是左端／中段／右端三段（各 48 × 144 px），中段每 48 px 重複一次。作物排進架子由 `tools/art/` 的腳本處理，不靠生圖對位。
- 層架每層開口約 22 px 高，作物以 24 × 24 px 可讀為準；挑高藤架開口約 104 × 75 px，藤蔓作物以 24 × 72 px 為準。
- 原始圖放 `tools/art/crops/raw/`，檔名用作物英文名（例：`lettuce.png`）。
