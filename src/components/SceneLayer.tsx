import { MapSector } from '../types';

interface SceneLayerProps {
  /** 目前所在區域。背景圖直接讀 sector.backgroundUrl。 */
  sector?: MapSector | null;
}

/**
 * 場景層：鋪滿整個視窗，位於所有介面之下。
 * 頂部 HUD、左側欄與對話面板的玻璃效果都透出這一層。
 *
 * 介面從一開始就照「吃一張圖」的形式設計，之後補圖只是 MapSector 多一個值，
 * 元件不必重寫。查不到圖時退回 CSS 多層 radial-gradient，靜態不動、零執行成本。
 *
 * 背景圖被左側欄與頂部 HUD 遮擋的問題，由之後製圖時的構圖規則解決
 * （重點置於畫面中央偏右），不在此處處理。
 */
export default function SceneLayer({ sector }: SceneLayerProps) {
  const backgroundUrl = sector?.backgroundUrl;

  return (
    <div
      id="scene-layer"
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {backgroundUrl ? (
        <img
          src={backgroundUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="absolute inset-0 scene-fallback" />
      )}

      {/* 壓暗層：確保介面文字在任何底圖上都維持可讀對比。 */}
      <div className="absolute inset-0 bg-[#050814]/55" />
    </div>
  );
}
