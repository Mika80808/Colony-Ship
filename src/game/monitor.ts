/**
 * 溫室植栽監測機的讀數（模擬）：溫度、濕度、養液、CO₂、光照隨人造日照週期變化，左右翼各自錯開一點。
 * 目前是介面草稿用的模擬數值，完全由遊戲時間推得、不用存檔；之後要接事件（例：故障）再改這裡。
 */
export type Wing = 'left' | 'right';
export type Status = 'good' | 'warning';

export interface Reading {
  id: string; label: string; unit: string;
  value: number; digits: number;
  /** 標準範圍，超出就是 warning。 */
  range: [number, number];
  status: Status;
}
export interface MonitorLog { time: string; text: string }

/** 人造日照：06:00 開、20:00 關。 */
export const LIGHT_ON = 6, LIGHT_OFF = 20;
const WING_OFFSET: Record<Wing, number> = { left: 0, right: .37 };

/** 一天中的時刻（0–24，含小數）→ 白天程度 0–1，開關燈前後一小時漸變。 */
function daylight(hour: number): number {
  const up = Math.min(1, Math.max(0, hour - LIGHT_ON + .5)), down = Math.min(1, Math.max(0, LIGHT_OFF + .5 - hour));
  return Math.min(up, down);
}
/** 小幅、可重現的擾動（-1–1）。 */
const wobble = (t: number, seed: number) => Math.sin(t * 2.3 + seed * 11) * .6 + Math.sin(t * 5.1 + seed * 7) * .4;

const make = (id: string, label: string, unit: string, value: number, digits: number, range: [number, number]): Reading =>
  ({ id, label, unit, value, digits, range, status: value < range[0] || value > range[1] ? 'warning' : 'good' });

/** `day` 是 growth.dayNumber 的天數（含小數）。 */
export function readings(wing: Wing, day: number): Reading[] {
  const hour = ((day % 1) + 1) % 1 * 24, light = daylight(hour), s = WING_OFFSET[wing], t = day * 24;
  return [
    make('temp', '氣溫', '°C', 19 + 5 * light + .4 * wobble(t, s), 1, [18, 27]),
    make('humidity', '相對濕度', '%', 72 - 10 * light + 2 * wobble(t, s + 1), 0, [55, 80]),
    make('ph', '養液 pH', '', 6 + .15 * wobble(t / 3, s + 2), 2, [5.5, 6.5]),
    make('ec', '養液 EC', 'mS/cm', 1.7 + .12 * wobble(t / 4, s + 3), 2, [1.2, 2.2]),
    make('co2', 'CO₂', 'ppm', 450 + 450 * light + 30 * wobble(t, s + 4), 0, [400, 1200]),
    make('ppfd', '光照強度', 'μmol/m²·s', light * (520 + 20 * wobble(t, s + 5)), 0, [0, 650]),
  ];
}

/** 過去 24 小時的某項讀數，每小時一點（最後一點是現在）。 */
export function trend(wing: Wing, day: number, id: string): { day: number; value: number }[] {
  return Array.from({ length: 25 }, (_, i) => {
    const d = day - (24 - i) / 24;
    return { day: d, value: readings(wing, d).find(r => r.id === id)!.value };
  });
}

const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round(h % 1 * 60)).padStart(2, '0')}`;

/** 今天到目前為止的系統紀錄，新的在上。 */
export function logs(wing: Wing, day: number): MonitorLog[] {
  const hour = ((day % 1) + 1) % 1 * 24, side = wing === 'left' ? '左翼' : '右翼';
  const events: [number, string][] = [
    [2 + WING_OFFSET[wing], `${side}養液槽自動補充 12 L`],
    [LIGHT_ON, '補光燈開啟（日照模式）'],
    [9.5 + WING_OFFSET[wing], 'pH 自動校正 +0.05'],
    [13, '噴霧加濕 3 分鐘'],
    [17 + WING_OFFSET[wing], `${side}養液槽自動補充 8 L`],
    [LIGHT_OFF, '補光燈關閉（夜間模式）'],
  ];
  return events.filter(([h]) => h <= hour).reverse().map(([h, text]) => ({ time: hhmm(h), text }));
}
