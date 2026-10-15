---
name: starport-asset-gen
description: 星際港（環狀太空站生活模擬遊戲）的 2D 素材生成規範：畫風（HD 像素風）、視角、格子尺寸、光源、材質配色、背景與檔名。寫任何生圖 prompt 前都要先看。當使用者提到星際港的素材、家具、物件、道具、貼圖、sprite、tileset、生圖 prompt、視角不對、尺寸不一致、素材風格不統一時，一律使用本技能。即使使用者只說「幫我生一張餐廳的桌子」或「這張椅子角度怪怪的」也要使用。場景物件的繪製流程看 starport-scene-props，整張地圖看 generate2dmap。
---

# 星際港 2D 素材生成規範

本技能定所有生圖素材共用的畫風與規格。流程不在這裡：

- 機台、家具、擺設：`.claude/skills/starport-scene-props/`（先在底圖上生擺設參考圖，再生最終物件）。
- 地板、牆、底圖、門、碰撞：`.claude/skills/generate2dmap/`。
- 角色：`docs/characters.md`。

核心原則：生圖模型抓不準幾何。視角與比例靠參考圖（底圖、擺設參考圖）傳達，文字只描述畫風、材質、造型與用途；尺寸一律後製縮放。

---

## 一、畫風：HD 像素風

全遊戲統一用 HD pixel art（高解析度像素風），一格 48 × 48 px（2026-10-15 使用者定）。

- 看得到方形像素塊，輪廓邊呈階梯狀，外框是深色 1–2 px。
- 色盤收斂：每種材質 2–3 階明暗，只挑少數像素做高光。
- 整張圖同一個像素尺度；要真的是像素畫，不是平滑插畫套像素濾鏡。
- 不要反鋸齒、模糊漸層、噴槍陰影、照片寫實、3D 算圖。
- 整體是明亮、友善的 sci-fi pixel RPG。

共同風格段，每個 prompt 都接上，後面再寫區域材質（第四節）：

```
Style: high-resolution pixel art for a top-down 2D RPG, designed at the detail density of a 48 x 48 pixel tile. Crisp visible square pixel clusters, stepped silhouette edges, dark one-to-two-pixel outlines, a tightly controlled palette with two or three shade levels per material and selective pixel highlights. One consistent pixel scale across the whole image. Real pixel art, not a smooth painting with a pixel filter. No antialiasing, no blurry gradients, no airbrushed shadows, no photorealism, no 3D rendering. Clean, friendly sci-fi. Light from the upper left.
```

溫室作物、食物、道具圖示另有一套提示詞，見第七節。

---

## 二、固定規格

| 項目 | 值 |
| --- | --- |
| 投影 | 斜俯視 three-quarter top-down，正交無透視，跟 RPG Maker、星露谷一樣 |
| 格子 | 美術圖塊一格 48 × 48 px ≈ 1 公尺；地板格是正方形，不壓縮 |
| 牆 | 高度、牆頂厚度、前景遮擋照 `問題修正紀錄.md`「牆與遮擋」 |
| 光源 | 左上 |
| 陰影 | 物件圖不畫地面陰影 |
| 錨點 | 底部中央，對齊佔地的下緣 |
| 背景 | 純洋紅 #FF00FF；物件本身帶紫紅時改中性灰 #808080 |

不用等角（isometric）。環狀艦體有大量弧牆，等角網格畫弧會扭曲；斜俯視的角色也只需要四方向行走圖。

尺寸不交給模型決定：prompt 只講佔幾格，生成後依佔格縮放。模型回傳的圖不一定是 1024（常給 1254），切圖座標一律依圖寬等比例換算。

---

## 三、用詞

- 要寫：orthographic、no perspective convergence、parallel edges，以及 three-quarter top-down RPG view。
- 不要寫 isometric：模型會給帶透視收縮的假等角。
- 不要只寫 top-down：會得到正上方俯視，看不到物件正面。
- 寫 pixel art 時一定要帶上 high-resolution 和 48 × 48 tile 的細節密度（第一節的風格段），不然模型容易畫成低解析度的粗像素小圖。

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

年代是 2090 年（`docs/world.md`），設計語言與禁止項見 `starport-scene-props`「視角規範」；不要紙本、文字、標誌。

艙房採通用底圖加個人陳設物件。生成陳設小物時，以佔用者的職業決定：研究員堆資料、工程師散零件、醫護放藥盒。每人三到五件即可，格局共用。

---

## 五、常見失敗與修法

| 症狀 | 原因 | 修法 |
| --- | --- | --- |
| 物件有透視收縮，遠端變窄 | 只用文字描述視角 | 底圖或擺設參考圖當 image1，prompt 加 no perspective convergence |
| 物件畫成正面圖，不像 RPG | 單獨生物件，沒有在底圖上擺過 | 走 `starport-scene-props` 的擺設參考圖流程 |
| 同批物件角度不一 | 分次呼叫 | 同類物件同一張圖一起生（分類規則見 `generate2dmap` 第 6 步） |
| 尺寸忽大忽小 | 想靠 prompt 控制像素 | 尺寸只在後製處理，prompt 只講佔幾格 |
| 底部畫出地板或陰影融進地面 | 沒禁止場景 | 加 no floor, no shadow, isolated object |
| 洋紅滲進物件配色 | 模型把背景色當調色盤 | 背景改中性灰 #808080；去背用共用切圖工具 `tools/art/cut.py` |
| 畫成平滑插畫，像素感不見 | 沒帶風格段，或帶了舊的 hand-painted 風格段 | 換成第一節的風格段；拿舊的手繪素材當參考圖時，寫明只照它的造型與視角，畫風改成像素風 |
| 像素粗細不一、像套濾鏡 | 沒限定像素尺度 | 風格段的 one consistent pixel scale、not a pixel filter 不能省 |

---

## 六、檔名與分層

- 原始生成圖：`tools/art/<場景>/raw/`，PNG，旁邊存同名 `.prompt.txt`（實際送出的完整 prompt）。
- 遊戲素材：`public/assets/<場景>/`，轉無損 WebP（`tools/to_webp.py`）。物件放 `props/`，檔名用英文小寫加連字號，例：`parts-shelves.webp`、`mini-fridge.webp`。
- 分層照 `generate2dmap`：底圖（地板、外牆立面）、decor（室內牆、家具、機台，依底邊跟角色排前後）、門、前景（牆簷、欄杆）。生成前先確認物件屬於哪一層。
- 發光元件不要把光暈畫進圖：光暈畫死在圖上，之後場景燈光改變時會對不上。

---

## 七、作物與食物圖示

溫室作物、食物、道具圖示用另一套 cute pixel RPG 提示詞，不套第一節的風格段。

- 作物：提示詞、三階段規則、排位配置都在 `tools/art/greenhouse_crop_prompts.md`，照檔案流程生成。
- 溫室已完成（2026-10-16），排架、切圖的腳本已刪；遊戲素材在 `public/assets/greenhouse/`。
- 栽種架是左端／中段／右端三段（各 48 × 144 px），中段每 48 px 重複一次。
- 層架每層開口約 22 px 高，作物以 24 × 24 px 可讀為準；挑高藤架開口約 104 × 75 px，藤蔓作物以 24 × 72 px 為準。
- 原始圖放 `tools/art/crops/raw/`，檔名用作物英文名（例：`lettuce.png`）。
