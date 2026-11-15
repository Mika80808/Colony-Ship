/**
 * 補給船的船期與貨單（企劃 docs/supply-ship.md 第一階段）。
 *
 * 全部由遊戲時間推得，不用存檔：第 n 班的到港日、延誤、貨單都是用班次序號算出來的穩定亂數，
 * 同一班看幾次都一樣。之後的運輸只要另外記「哪些貨送了」。數字都是暫定。
 */
import { GAME_START_DATE } from '../data/initialGameData';
import { dayNumber } from './growth';

export const SHIP = {
  /** 第一班在開局後第幾天到港。 */
  firstArrivalDay: 3,
  /** 每幾天一班。 */
  intervalDays: 7,
  /** 到港時刻（小時）。 */
  arriveHour: 9,
  /** 停靠到第幾天的幾點離港（到港日算第 0 天）。 */
  departDay: 1,
  departHour: 18,
  /** 到港前幾天公布貨單與延誤。 */
  previewDays: 2,
  /** 每班延誤的機率，延誤 1 或 2 天。 */
  delayChance: 0.15,
  /** 有訪客下船走走的機率。 */
  visitorChance: 0.2,
} as const;

/** 第 0 班「照表」到港那一天的 00:00（日序）。 */
const BASE_DAY = Math.floor(dayNumber(GAME_START_DATE, '00:00')) + SHIP.firstArrivalDay;

function hash(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  // 再攪一次：只差最後一個字的鍵（to-0、to-1）單靠 FNV 高位幾乎一樣，挑出來的收件人會全部相同。
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}
/** 第 n 班的第 k 個亂數，[0,1)。 */
const rand = (voyage: number, k: string) => hash(`ship:${voyage}:${k}`);
const between = (voyage: number, k: string, min: number, max: number) => min + Math.floor(rand(voyage, k) * (max - min + 1));

export const scheduledDay = (voyage: number) => BASE_DAY + voyage * SHIP.intervalDays;
export function delayDays(voyage: number): number {
  return rand(voyage, 'delay') < SHIP.delayChance ? (rand(voyage, 'delay-length') < .6 ? 1 : 2) : 0;
}
/** 實際到港、離港的時間（日序，含小數）。 */
export const arrival = (voyage: number) => scheduledDay(voyage) + delayDays(voyage) + SHIP.arriveHour / 24;
export const departure = (voyage: number) => scheduledDay(voyage) + delayDays(voyage) + SHIP.departDay + SHIP.departHour / 24;
/** 貨單與延誤從這時起公開（照表到港日往前推）。 */
export const announced = (voyage: number) => scheduledDay(voyage) - SHIP.previewDays;

/** 船號：照班次序號編，跟船期一樣是固定的。 */
export const voyageCode = (voyage: number) => `LM-${String(voyage + 1).padStart(3, '0')}`;

export type ShipPhase = 'incoming' | 'docked';
export interface ShipStatus {
  voyage: number;
  phase: ShipPhase;
  /** incoming：還有幾天到港；docked：還有幾天離港。 */
  days: number;
  /** 這一班延誤了幾天（還沒公布時是 0）。 */
  delay: number;
  /** 貨單是否已經公布。 */
  announced: boolean;
}

/** 某個時間點的船況：正在停靠的那一班，或下一班。 */
export function shipStatus(day: number): ShipStatus {
  let voyage = Math.max(0, Math.floor((day - BASE_DAY) / SHIP.intervalDays) - 1);
  while (departure(voyage) <= day) voyage++;
  const docked = arrival(voyage) <= day;
  const open = docked || day >= announced(voyage);
  return {
    voyage,
    phase: docked ? 'docked' : 'incoming',
    days: (docked ? departure(voyage) : arrival(voyage)) - day,
    delay: open ? delayDays(voyage) : 0,
    announced: open,
  };
}

// ------------------------------------------------------------------ 貨單

/** 站上要截留、玩家之後要送的貨（第二階段才能送）。 */
export type CargoKind = 'medicine' | 'parts' | 'research' | 'pantry';
export const CARGO: Record<CargoKind, { name: string; to: string; place: string; min: number; max: number }> = {
  medicine: { name: '藥品', to: 'medical', place: '醫療室', min: 2, max: 3 },
  parts: { name: '精密零件', to: 'engineering', place: '工程部', min: 2, max: 3 },
  research: { name: '研究耗材', to: 'lab', place: '研究室', min: 1, max: 2 },
  pantry: { name: '乾貨與調味', to: 'park', place: '餐廳', min: 2, max: 2 },
};
const CARGO_KINDS = Object.keys(CARGO) as CargoKind[];

/** 從月球寄來的私人包裹。寄件人是站外的人，只在敘事裡出現。 */
const SENDERS = ['月球的家人', '月球的老朋友', '月球城市的舊同事', '火星殖民地的朋友', '月球的網購店家'];
const TRANSIT = [
  '火星新聚落的建材', '火星溫室的種苗與培養液', '火星醫療站的設備', '火星礦區的替換零件', '火星殖民地的生活物資', '火星研究站的儀器',
];

export interface Parcel { id: string; recipientId: string; recipientName: string; sender: string }
export interface Manifest {
  voyage: number;
  code: string;
  cargo: { kind: CargoKind; crates: number }[];
  parcels: Parcel[];
  /** 過境貨：只在接駁口換船，不用送。 */
  transit: { what: string; crates: number }[];
  visitors: boolean;
}

/**
 * 第 n 班的貨單。收件人從常駐 NPC 裡挑（傳進來的清單；同一班、同一份名單結果固定），
 * 名單是空的就沒有包裹。
 */
export function manifest(voyage: number, residents: readonly { id: string; name: string }[]): Manifest {
  const parcelCount = residents.length ? between(voyage, 'parcels', 3, 6) : 0;
  const parcels: Parcel[] = Array.from({ length: parcelCount }, (_, i) => {
    const who = residents[Math.floor(rand(voyage, `to-${i}`) * residents.length)];
    return { id: `${voyageCode(voyage)}-p${i + 1}`, recipientId: who.id, recipientName: who.name, sender: SENDERS[Math.floor(rand(voyage, `from-${i}`) * SENDERS.length)] };
  });
  const transitKinds = between(voyage, 'transit-kinds', 1, 2);
  const start = Math.floor(rand(voyage, 'transit') * TRANSIT.length);
  return {
    voyage,
    code: voyageCode(voyage),
    cargo: CARGO_KINDS.map((kind) => ({ kind, crates: between(voyage, kind, CARGO[kind].min, CARGO[kind].max) })),
    parcels,
    transit: Array.from({ length: transitKinds }, (_, i) => ({ what: TRANSIT[(start + i) % TRANSIT.length], crates: between(voyage, `transit-${i}`, 8, 30) })),
    visitors: rand(voyage, 'visitors') < SHIP.visitorChance,
  };
}

// ------------------------------------------------------------------ 給人看的文字

/** 天數的說法：整數「約 N 天」，不到一天換成小時。 */
export function untilText(days: number): string {
  if (days >= 1) return `約 ${Math.round(days)} 天`;
  const hours = Math.max(1, Math.round(days * 24));
  return `約 ${hours} 小時`;
}

/** 頂欄那一小段：「補給船 約 3 天後到港」。 */
export function headline(status: ShipStatus): string {
  if (status.phase === 'docked') return `補給船停靠中・${untilText(status.days)}後離港`;
  return `補給船${untilText(status.days)}後到港${status.delay ? `（延誤 ${status.delay} 天）` : ''}`;
}

/** 給主 GM 的船期與貨物（幾行）。貨單公布前只給船期；包裹只點名在場的收件人。 */
export function gmShipLines(status: ShipStatus, cargo: Manifest | null, presentIds: readonly string[]): string[] {
  const lines = [`- ${headline(status)}（船號 ${voyageCode(status.voyage)}，每 7 日一班）`];
  if (!cargo || !status.announced) return lines;
  lines.push(`- 這班截留的貨：${cargo.cargo.map((c) => `${CARGO[c.kind].name} ${c.crates} 箱（給${CARGO[c.kind].place}）`).join('、')}`);
  if (cargo.parcels.length) lines.push(`- 這班有 ${cargo.parcels.length} 件私人包裹`);
  const mine = cargo.parcels.filter((p) => presentIds.includes(p.recipientId));
  for (const p of mine) lines.push(`- 在場的${p.recipientName}有一件${p.sender}寄來的包裹在這班船上`);
  lines.push(`- 過境貨：${cargo.transit.map((t) => `${t.what} ${t.crates} 箱`).join('、')}（只在接駁口換船，不留在站上）`);
  if (cargo.visitors) lines.push('- 這班船有幾位乘客或換班船員會下船在站上走走');
  return lines;
}
