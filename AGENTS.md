# 星際港 Colony Ship：專案總則

環狀太空站生活模擬遊戲（React + Vite + TypeScript，場景用 canvas 繪製）。
這份檔案給所有 AI 工具讀：Codex 會自動讀 `AGENTS.md`，Claude Code 透過 `CLAUDE.md` 匯入本檔。

## 分工

- Claude Code：寫程式、接場景、去背切圖、拼接素材、維護文件。
- Codex：生圖。生圖前先讀 `.claude/skills/starport-asset-gen/SKILL.md`（素材規範）與對應場景的提示詞檔。做整張地圖或場景（底圖、道具包、碰撞與區域）時，再讀 `.claude/skills/generate2dmap/SKILL.md`。
- 一律用繁體中文溝通與寫文件。

## 每次開工與收工

1. 開工：`git pull`，再讀 `docs/PROGRESS.md` 看目前做到哪裡。
2. 收工：更新 `docs/PROGRESS.md`，commit 並 push 到 GitHub。手機或雲端開的 session 只看得到 GitHub 上的內容。
3. 專案放在隨身硬碟，換電腦時磁碟代號會變。文件與程式裡只寫相對路徑，不寫 `G:\` 這類絕對路徑。

## 文件地圖

| 檔案 | 內容 |
|---|---|
| `docs/PROGRESS.md` | 各場景進度、下一步、已定案的決定 |
| `.claude/skills/starport-asset-gen/SKILL.md` | 素材規範：視角、尺寸、光源、畫風、檔名 |
| `.claude/skills/generate2dmap/` | 2D 地圖生成流程（取自 agent-sprite-forge，MIT）：分層底圖、道具包切圖、碰撞與區域、預覽；腳本需要 Pillow、numpy |
| `tools/asset-prompts.md` | 角色與房間家具的生圖提示詞 |
| `tools/art/greenhouse_crop_prompts.md` | 溫室 19 種作物三階段提示詞與排位配置 |
| `docs/scenes/` | 各場景說明：A-1 房間、居住區 A 走廊、艦橋 |
| `docs/characters.md` | 角色素材與行走圖處理流程 |
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
- 去背、切割、縮放用 `tools/` 裡的腳本完成，不手動改像素；腳本要能重跑產生同樣結果。
