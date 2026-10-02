/**
 * 遊戲時間怎麼前進（設定文件《遊戲流程骨架》「移動時間」）：
 * - 步數制：玩家走路才耗時，站著不動時間不流逝（避免掛機暴衝）。
 * - 星圖傳送：依距離分級查表，不作精算；走路要略貴於同距離傳送。
 * - 對話：主 GM 依故事內容推進（advance_time 指令），跟走路的時間直接相加。
 * 數字都是可調參數（骨架第十五節「每步耗時」「移動級距時間值」），改這裡就好。
 */

/** 走多少世界像素算 1 分鐘。一格 96 px ≈ 1 公尺；16 格（約一個溫室半寬）1 分鐘。 */
export const WALK_PX_PER_MINUTE = 96 * 16;

/** 傳送級距 → 分鐘。0 同場景、1 相鄰、2 繞環半圈內、3 跨環（外環↔中央廣場），垂直（艦橋）再 +1 級。 */
export const TRAVEL_MINUTES = [0, 3, 8, 15, 20] as const;

/** 外環八段的環狀順序（骨架：上研究室、右溫室、下醫療室、左工程區，四斜角居住區）。 */
export const RING = ['lab', 'residential_a', 'greenhouse', 'residential_b', 'medical', 'residential_c', 'engineering', 'residential_d'];
/** 中央廣場；艦橋在中央塔上方，算垂直移動。 */
const CENTRE = 'park', VERTICAL = new Set(['bridge']);

/** 兩個區域之間的傳送級距（0–4）。不認得的區域當相鄰。 */
export function travelTier(from: string, to: string): number {
  if (from === to) return 0;
  const vertical = Number(VERTICAL.has(from)) + Number(VERTICAL.has(to)) > 0 ? 1 : 0;
  const ground = (id: string) => VERTICAL.has(id) ? CENTRE : id;
  const a = ground(from), b = ground(to);
  let tier: number;
  if (a === b) tier = 0;
  else if (a === CENTRE || b === CENTRE) tier = 3;                                  // 跨環
  else {
    const i = RING.indexOf(a), j = RING.indexOf(b);
    if (i < 0 || j < 0) tier = 1;
    else { const d = Math.abs(i - j), ring = Math.min(d, RING.length - d); tier = ring <= 1 ? 1 : 2; }
  }
  return Math.min(TRAVEL_MINUTES.length - 1, tier + vertical);
}

export const travelMinutes = (from: string, to: string) => TRAVEL_MINUTES[travelTier(from, to)];

/**
 * 把走過的像素累積成整數分鐘：餘數留著下次加，不會因為每次只走一小段就永遠不滿一分鐘。
 * 回傳的函式每次給「這次走了幾 px」，回「這次要推進幾分鐘」（通常是 0）。
 */
export function walkMeter(pxPerMinute = WALK_PX_PER_MINUTE) {
  let carry = 0;
  return (px: number) => {
    if (!(px > 0)) return 0;
    carry += px;
    const minutes = Math.floor((carry + 1e-6) / pxPerMinute);                    // 1e-6：小數累加的誤差不吃掉一分鐘
    carry -= minutes * pxPerMinute;
    return minutes;
  };
}
