# 星際港 Colony Ship

環狀太空站生活模擬遊戲。React + Vite + TypeScript，場景用 canvas 繪製；GM（故事主持）對話可接 Gemini 或 OpenAI 相容的 AI 服務，在遊戲內的設定裡填。

## 執行

需要 Node.js。

```
npm install
npm run dev      # http://localhost:3000
```

啟動後位於居住區 A 走廊，WASD、方向鍵或點地移動，E 互動。

## 目錄結構

```
Colony-Ship/
├─ AGENTS.md            AI 工具共用的專案總則（CLAUDE.md 匯入本檔）
├─ README.md            本檔
├─ docs/
│  ├─ PROGRESS.md       開發進度、下一步、已定案的決定
│  ├─ characters.md     角色素材與行走圖處理流程
│  └─ scenes/           各場景說明：room-a1、corridor-a、bridge
├─ src/
│  ├─ App.tsx           主畫面與場景切換
│  ├─ components/       各場景（*Scene.tsx）、側欄、抽屜、彈窗
│  ├─ game/             碰撞、尋路、移動、互動、作物生長等邏輯，各有 *.test.ts
│  ├─ gm/               GM 對話：提示詞、AI 服務串接
│  ├─ data/             初始遊戲資料、NPC 行程、存檔、故事
│  └─ utils/            音效
├─ public/assets/       遊戲用素材，依場景與角色分資料夾
├─ tools/               素材處理腳本、生圖提示詞
│  └─ art/              場景美術產生腳本；原始生成圖放 art/<主題>/raw/
└─ .claude/skills/      素材規範 skill（starport-asset-gen）
```

## 文件

| 檔案 | 內容 |
|---|---|
| `docs/PROGRESS.md` | 各場景進度，開工先看這份 |
| `docs/scenes/room-a1.md` | A-1 房間 |
| `docs/scenes/corridor-a.md` | 居住區 A 走廊 |
| `docs/scenes/bridge.md` | 艦橋 |
| `docs/characters.md` | 角色素材 |
| `.claude/skills/starport-asset-gen/SKILL.md` | 素材規範：視角、尺寸、光源、畫風、檔名 |
| `tools/asset-prompts.md` | 角色與房間家具的生圖提示詞 |
| `tools/art/greenhouse_crop_prompts.md` | 溫室作物提示詞與排位 |

## 驗證

```
npm run lint
npm run build
node --import tsx src/game/<改到的邏輯>.test.ts
```
