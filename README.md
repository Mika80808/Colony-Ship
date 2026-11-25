# 星際港 Colony Ship

環狀太空站生活模擬遊戲。React + Vite + TypeScript，場景用 canvas 繪製；GM（故事主持）對話可接 Gemini 或 OpenAI 相容的 AI 服務，在遊戲內的設定裡填。

## 執行

需要 Node.js。

```
npm install
npm run dev      # http://localhost:3000
```

啟動後位於居住區 A 走廊，WASD、方向鍵或點地移動，E 互動。

## 目錄結構與文件

都在 `AGENTS.md` 的「文件地圖」與「目錄結構」（唯一正本）。開發進度看 `docs/PROGRESS.md`。

## 驗證

```
npm run lint
npm run build
node --import tsx src/game/<改到的邏輯>.test.ts
```
