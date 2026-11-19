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
/**
 * flip：左右翻轉；id／size：相對座位錨點參照的物件識別與原圖像素尺寸；anim：沿軌道移動（x 只拿來排前後）。
 * beside：角色腳點在圖的左右範圍外時畫在前面。不填就照圖自動判斷（besideByShape）；只有自動判錯時才在 map.json 寫 true／false。
 * depth：物件在地上佔的深度（格），給產生碰撞的腳本用（tools/art/footprint.py），遊戲不讀。
 * sortY：排前後用的那條線（格）；省略＝圖的底邊 y。房間家具的排序線是畫的時候另外定的，跟圖的底邊不一樣。
 */
export interface DecorSpec { sprite: string; x: number; y: number; scale: number; block?: boolean; flip?: boolean; id?: string; size?: [number, number]; anim?: TrackAnim; beside?: boolean; depth?: number; sortY?: number }

/**
 * 圖往左右「懸空」伸出多少 px（圖的像素）：整張圖的不透明寬度，減掉貼地那一段（底部 15% 高）的寬度，取左右較大的一邊。
 * 樹冠、傘這種上面比底部寬很多的會很大；桌、櫃台、床、櫃子、石頭這種底部就是整個寬度的接近 0。
 * alpha 是 RGBA 像素（getImageData 的 data）。
 */
export function baseOverhang(rgba: ArrayLike<number>, width: number, height: number): number {
  const solid = (x: number, y: number) => rgba[(y * width + x) * 4 + 3] > 40;
  let top = height, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (solid(x, y)) { top = Math.min(top, y); bottom = y; break; }
  if (bottom < 0) return 0;
  const span = (y0: number, y1: number) => {
    let l = width, r = -1;
    for (let y = y0; y <= y1; y++) for (let x = 0; x < width; x++) if (solid(x, y)) { l = Math.min(l, x); r = Math.max(r, x); }
    return [l, r];
  };
  const [l, r] = span(top, bottom), [bl, br] = span(Math.max(top, bottom - Math.floor((bottom - top + 1) * .15)), bottom);
  return Math.max(bl - l, r - br, 0);
}

/** 懸空伸出不超過這麼多世界 px（約角色半寬的一半）的物件，角色站在它左右兩側時畫在前面。 */
export const BESIDE_OVERHANG = 24;
/**
 * 自動判斷 beside：圖沒有往兩側懸空伸出（桌、櫃台、床、沙發、櫃子、石頭），角色站在旁邊就是「並排」，畫在前面；
 * 有懸空的部分（樹冠）時，角色站在樹冠底下就該被蓋住，照腳點排。overhang 用世界 px（已乘上 scale）。
 */
export const besideByShape = (overhang: number) => overhang <= BESIDE_OVERHANG;

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
