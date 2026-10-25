/**
 * 設施裡的裝飾擺設（map.json 的 decor）：樹、花叢……圖在 public/assets/<folder>/props/。
 * 位置是「底部中心」的格子座標（可有小數），畫的時候依底部和玩家、種植架一起排前後。
 * sprite 名稱裡的 {season} 依遊戲日期換成 spring／summer／autumn／winter（例：楓樹四季）。
 * 會擋路的物件以 block 標記，碰撞範圍由 map.json 的 collisionRects 定義。
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/**
 * 沿軌道左右移動的零件（醫療室配藥櫃的取藥爪）：在 stops 之間停停走走，最後往右滑出 clip 範圍消失（右邊是取藥口），
 * 藏一段時間再從右邊回來。座標都是世界 px：stops 是停靠點的水平中心，top 是圖的上緣，clip 是看得到的範圍 [x, y, 寬, 高]。
 */
export interface TrackAnim { stops: number[]; top: number; clip: [number, number, number, number]; speed?: number }
/** flip：左右翻轉；id／size：相對座位錨點參照的物件識別與原圖像素尺寸；anim：沿軌道移動（x 只拿來排前後）。 */
export interface DecorSpec { sprite: string; x: number; y: number; scale: number; block?: boolean; flip?: boolean; id?: string; size?: [number, number]; anim?: TrackAnim }

/** 一輪：從右邊進來 → 停三個格子（每格停 1.2 秒）→ 往右出去 → 藏 4 秒。回傳這一刻的水平中心（世界 px）。 */
export function trackX(anim: TrackAnim, seconds: number, width: number): number {
  const speed = anim.speed ?? 110, out = anim.clip[0] + anim.clip[2] + width;
  const route = (cycle: number) => {
    let h = (cycle * 7919 + 13) % 2147483647;
    const pick = () => { h = (h * 48271) % 2147483647; return anim.stops[h % anim.stops.length]; };
    return [pick(), pick(), pick()];
  };
  const keys = (stops: number[]) => {
    const seq = [{ x: out, t: 0 }];
    let x = out, t = 0;
    for (const s of [...stops, out]) {
      t += Math.abs(s - x) / speed; seq.push({ x: s, t });
      if (s !== out) { t += 1.2; seq.push({ x: s, t }); }
      x = s;
    }
    seq.push({ x: out, t: t + 4 });
    return seq;
  };
  let cycle = 0, rest = seconds;
  for (;;) {
    const seq = keys(route(cycle)), length = seq[seq.length - 1].t;
    if (rest < length) {
      const i = seq.findIndex(k => k.t > rest), a = seq[i - 1], b = seq[i];
      return a.x + (b.x - a.x) * (rest - a.t) / (b.t - a.t);
    }
    rest -= length; cycle++;
  }
}

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
