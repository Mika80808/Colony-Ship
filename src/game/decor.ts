/**
 * 設施裡的裝飾擺設（map.json 的 decor）：樹、花叢……圖在 public/assets/<folder>/props/，由 tools/art/greenhouse_props.py 切出。
 * 位置是「底部中心」的格子座標（可有小數），畫的時候依底部和玩家、種植架一起排前後。
 * sprite 名稱裡的 {season} 依遊戲日期換成 spring／summer／autumn／winter（例：楓樹四季）。
 * 會擋路的（樹幹）直接寫在 map.json 的 collision，這裡的 block 只是標記給測試核對。
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** flip：左右翻轉（Photoshop 裡翻過的樹，見 tools/art/greenhouse_tree_layer.py）。 */
export interface DecorSpec { sprite: string; x: number; y: number; scale: number; block?: boolean; flip?: boolean }

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** 北半球的月份分季：3–5 春、6–8 夏、9–11 秋、12–2 冬（艦上人工氣候照地球曆走）。 */
export function seasonOf(date: string): Season {
  const month = Number(date.slice(5, 7));
  return (['winter', 'spring', 'summer', 'autumn'] as const)[Math.floor((month % 12) / 3)];
}

export const spriteFor = (d: DecorSpec, date: string) => d.sprite.replace('{season}', seasonOf(date));

/** 所有可能用到的圖檔名（季節圖四張都列），載入一次，換季不用再等。 */
export const decorSprites = (specs: DecorSpec[]) =>
  [...new Set(specs.flatMap(d => d.sprite.includes('{season}') ? SEASONS.map(s => d.sprite.replace('{season}', s)) : [d.sprite]))];
