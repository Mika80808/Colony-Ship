# 星際港 Colony Ship：專案總則

環狀太空站生活模擬遊戲（React + Vite + TypeScript，場景用 canvas 繪製）。
這份檔案給所有 AI 工具讀：Codex 會自動讀 `AGENTS.md`，Claude Code 透過 `CLAUDE.md` 匯入本檔與 `問題修正紀錄.md`。

**開工必讀 `問題修正紀錄.md`**（設計原則）：寫程式、做場景、生圖或寫任何檔案之前都要先讀，照裡面的原則做。Claude Code 會自動載入；Codex 和其他工具要自己開這個檔案讀。

## 分工

- Claude Code：寫程式、接場景、去背切圖、拼接素材、維護文件。擺物件、拆圖層、畫碰撞前，先讀 `.claude/skills/starport-scene-props/SKILL.md` 的「圖層與碰撞規則」，擺完照它的檢查表走一次。
- **寫任何生圖 prompt 前必讀** `.claude/skills/starport-asset-gen/SKILL.md`（Claude Code 寫 prompt、Codex 生圖都一樣），照第二節的 prompt 範本填（規則只有三條：正面俯視無透視、燈光硬邊不准光暈、不帶地面；物件風格靠第四節的場景主題與關鍵字；不寫畫風、不指定材質顏色、不附任何參考圖或白膜）。這是唯一正本；其他文件、任務單、舊 prompt 的長版規則段以它為準。
- Codex：生圖。開工先看 `docs/tasks/` 有沒有指派給你的任務單（狀態「待執行」），照任務單交件；Claude Code 負責驗收。生圖前先讀 `.claude/skills/starport-asset-gen/SKILL.md`（素材規範）與對應場景的提示詞檔。做整張場景地圖（規劃、地板與牆的素材套件、底圖、碰撞）時，再讀 `.claude/skills/generate2dmap/SKILL.md`。畫場景裡的機台、家具、擺設時，照 `.claude/skills/starport-scene-props/SKILL.md` 的流程（單件物件、洋紅底、正面俯視）。
- 一律用繁體中文溝通與寫文件。

## 每次開工與收工

1. 開工：`git pull`，再讀 `docs/PROGRESS.md` 看目前做到哪裡，讀 `問題修正紀錄.md` 的設計原則。
2. 階段任務完成：更新 `docs/PROGRESS.md`。有修正問題的話，照 `問題修正紀錄.md` 開頭「怎麼更新這份」的步驟處理：能寫成檢查的寫檢查，場景數值寫進 `docs/scenes/`，只有通用原則才寫進該檔。
3. 收工：確認當天任務完結後才 commit 並 push 到 GitHub。手機或雲端開的 session 只看得到 GitHub 上的內容。
4. 專案放在隨身硬碟，換電腦時磁碟代號會變。文件與程式裡只寫相對路徑，不寫 `G:\` 這類絕對路徑。

## 文件地圖

| 檔案 | 內容 |
|---|---|
| `docs/world.md` | 世界觀：2090 年月球—火星航線的中繼港、物資、人員、GM 邊界 |
| `docs/PROGRESS.md` | 各場景進度、下一步、已定案的決定 |
| `問題修正紀錄.md` | 通用設計原則、已由程式把關與待寫成檢查的項目、待搬移的場景數值。開工必讀；修完問題照檔案開頭的步驟更新 |
| `.claude/skills/starport-asset-gen/SKILL.md` | 素材規範：視角、尺寸、光源、畫風、檔名；第二節是每個生圖 prompt 的範本（唯一正本），第四節是各場景主題關鍵字 |
| `.claude/skills/starport-scene-props/SKILL.md` | 場景物件流程：分區規劃 → 單件物件（正面俯視）→ 切圖給使用者在 PSD 排 → 匯入擺放；圖層與碰撞規則 |
| `.claude/skills/generate2dmap/` | 場景地圖流程（改編自 agent-sprite-forge，MIT）：格局規劃 → 素材套件 → 拼接底圖 → 牆／門／前景分層 → 碰撞與 map.json → 驗證 |
| `tools/art/editor/README.md` | 地圖編輯器（專案根目錄 `工具/地圖編輯器_v3.html`）的標註怎麼接進 map.json：互動物件、互動狀態圖、碰撞 |
| `tools/art/greenhouse_crop_prompts.md` | 溫室 19 種作物三階段提示詞與排位配置 |
| `docs/memory.md` | 記憶系統（記憶六通道）的實作：各通道怎麼寫入、怎麼帶給 GM、可調參數、還沒做的部分 |
| `docs/scenes/` | 各場景說明：A-1 房間、居住區 A 走廊、艦橋、工程區、中央廣場（規劃中）、醫療室（規劃中） |
| `docs/characters.md` | 角色素材與行走圖處理流程 |
| `docs/tasks/` | 指派給 Codex 的任務單：要生什麼、規格、交件與驗收方式 |
| `README.md` | 執行方式、目錄結構 |

## 程式結構

- `src/components/*Scene.tsx`：各場景的互動與生命週期（房間、走廊、艦橋、設施）。
- `src/game/`：碰撞、尋路、移動、互動等邏輯，每支都有對應的 `*.test.ts`。
- `public/assets/<場景>/`：遊戲用素材。`tools/`、`tools/art/`：素材處理與產生腳本。

## 驗證

改完程式至少跑：

- `npm run lint`
- `npm run build`
- 改到的邏輯對應的測試，例如 `node --import tsx src/game/facility.test.ts`

## 素材處理慣例

- 生圖輸出 PNG，背景用純洋紅 `#FF00FF`；作物或物件本身帶紫紅色時改用中性灰 `#808080`。
- 原始生成圖放 `tools/art/<主題>/raw/`，處理後的遊戲素材放 `public/assets/<場景>/`。
- **遊戲資料夾只放遊戲會用到的東西**：`raw/` 只留腳本會讀的原圖；試畫、選樣、被退回的版本、還沒擺進 map.json 的候選切圖、獨立小工具（HTML 生成器、畫風測試）都放到遊戲資料夾外的 `../場景/<區>/`（例如 `../場景/醫療區/試畫原圖/`），工具放 `../工具/`。整個專案的資料夾地圖見 `../專案目錄.md`。
- 去背、切割、縮放用 `tools/` 裡的腳本完成，不手動改像素；腳本要能重跑產生同樣結果。
