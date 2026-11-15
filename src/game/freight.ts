/**
 * 補給船第二階段：大宗貨的搬運與各區物資帳（企劃 docs/supply-ship.md 第四、六節）。
 *
 * 流向：補給船到港 → 貨卸在塔底接駁口 → 玩家裝推車 → 送到目的區（醫療室、工程部、研究室、餐廳）→
 * 那一區的庫存（以「可撐幾天」計）回升，每天消耗一天份。
 * 玩家沒送的貨在接駁口放滿兩天後，路西恩每天幫忙送兩箱（不必玩這個系統，站上也不會一直缺）。
 * 數字都是暫定，待實測。
 */
import { CARGO, CargoKind, Manifest, Parcel, arrival, departure } from './supplyShip';

const KINDS = Object.keys(CARGO) as CargoKind[];

export const FREIGHT = {
  /** 推車一次載幾箱。 */
  cartCrates: 3,
  /** 玩家每送一箱的工資（星幣）。 */
  wagePerCrate: 15,
  /** 一班船的貨在離港前全部由玩家送完的獎金。 */
  voyageBonus: 50,
  /** 貨在接駁口放幾天後，路西恩開始幫忙送。 */
  helperWaitDays: 2,
  /** 路西恩每天送幾箱。 */
  helperPerDay: 2,
  /** 開局各區有幾天份。 */
  startDays: 10,
  /** 私人包裹在接駁口放幾天後，自走運送車自己送掉（沒有報酬）。 */
  parcelWaitDays: 2,
  /** 送一件包裹的報酬（當面交或放收件格都一樣）。 */
  parcelWage: 10,
  /** 裝一箱、卸一趟各花幾分鐘。 */
  loadMinutes: 2,
  unloadMinutes: 3,
} as const;

/**
 * 一箱可撐幾天：一班船的平均箱數合起來約 10 天份，比船期 7 天多一點，照常送就不會缺。
 * （藥品、零件每班 2–3 箱，研究耗材 1–2 箱，乾貨 2 箱。）
 */
export const DAYS_PER_CRATE: Record<CargoKind, number> = { medicine: 4, parts: 4, research: 6.5, pantry: 5 };

/** 接駁口上（或推車上）的一批貨：哪一班船、什麼貨、幾箱、什麼時候到的。 */
export interface Lot { voyage: number; kind: CargoKind; crates: number; arrived: number }

export interface FreightState {
  /** 結算到哪個時間點（日序，含小數）。 */
  day: number;
  /** 下一班還沒卸進接駁口的船（班次序號）。 */
  nextVoyage: number;
  dock: Lot[];
  cart: Lot[];
  /** 各區可撐幾天。 */
  stock: Record<CargoKind, number>;
  /** 玩家在離港前全部送完的班次（領過獎金；之後的長期獎勵也看這裡）。 */
  clearedVoyages: number[];
  /** 接駁口上等人領的私人包裹。 */
  parcels?: DockParcel[];
  /** 玩家領走、還沒送到的包裹（背包裡對應一件任務物品）。 */
  carried?: DockParcel[];
  /** 玩家累計送到幾件包裹。 */
  parcelsDelivered?: number;
  /** 玩家託船寄出、還在等回信的訊息。 */
  outbox?: Letter[];
  /** 已經發過的長期獎勵（REWARDS 的 id）。 */
  rewards?: string[];
  /** 玩家領到的回信（背包裡對應一件「〇〇的回信」）。 */
  inbox?: DockParcel[];
}

/** 寄給玩家的包裹（回信）用這個收件人 id。 */
export const PLAYER_ID = 'player';
export type Destination = '月球' | '火星';
/** 玩家託船寄出的錄製訊息（可以附一件東西）。月球的回信搭下一班，火星遠，搭下下班。 */
export interface Letter { id: string; voyage: number; destination: Destination; note: string; itemName?: string; sentDay: number; replyVoyage: number }

/** 長期獎勵：玩家在離港前送完幾班船之後，物資官交給玩家的東西（物品 id 在 data/items.ts）。 */
export const REWARDS = [
  { id: 'equip-scooter', after: 3 },
  { id: 'equip-rail-pass', after: 8 },
] as const;

/** 接駁口上的一件私人包裹：貨單上的包裹加上哪一班、什麼時候到。 */
export interface DockParcel extends Parcel { voyage: number; arrived: number; /** 寄給玩家的回信：對應的那封寄件。 */ letter?: Letter }

/** 開局：已經離港的班次不算（第一班在開局後才到），各區有 startDays 天份。 */
export function initialFreight(day: number): FreightState {
  let nextVoyage = 0;
  while (arrival(nextVoyage) <= day) nextVoyage++;
  return { day, nextVoyage, dock: [], cart: [], stock: Object.fromEntries(KINDS.map((k) => [k, FREIGHT.startDays])) as Record<CargoKind, number>, clearedVoyages: [] };
}

export const totalCrates = (lots: readonly Lot[], kind?: CargoKind) =>
  lots.reduce((sum, lot) => (kind && lot.kind !== kind ? sum : sum + lot.crates), 0);

/** 合併同一班、同一種的貨，去掉 0 箱的。 */
function tidy(lots: Lot[]): Lot[] {
  const out: Lot[] = [];
  for (const lot of lots) {
    if (lot.crates <= 0) continue;
    const same = out.find((o) => o.voyage === lot.voyage && o.kind === lot.kind);
    if (same) same.crates += lot.crates; else out.push({ ...lot });
  }
  return out;
}

/** 從一堆貨裡拿走某種貨幾箱（舊的先拿）。回傳拿到的與剩下的。 */
function take(lots: readonly Lot[], count: number, pick: (lot: Lot) => boolean) {
  let left = count;
  const taken: Lot[] = [], rest: Lot[] = [];
  for (const lot of [...lots].sort((a, b) => a.arrived - b.arrived)) {
    const n = pick(lot) ? Math.min(left, lot.crates) : 0;
    if (n) { taken.push({ ...lot, crates: n }); left -= n; }
    if (lot.crates - n) rest.push({ ...lot, crates: lot.crates - n });
  }
  return { taken: tidy(taken), rest: tidy(rest) };
}

const addStock = (stock: Record<CargoKind, number>, lots: readonly Lot[]) => {
  const next = { ...stock };
  for (const lot of lots) next[lot.kind] += lot.crates * DAYS_PER_CRATE[lot.kind];
  return next;
};
const consume = (stock: Record<CargoKind, number>, days: number) =>
  Object.fromEntries(KINDS.map((k) => [k, Math.max(0, stock[k] - days)])) as Record<CargoKind, number>;

/**
 * 把帳推到 `day`：各區消耗、到港的船把貨卸進接駁口、路西恩每天（00:00）送掉放太久的貨。
 * 依時間順序一段一段結算，所以一次跳很多天也不會漏。`manifestOf` 給第 n 班的貨單。
 */
export function tickFreight(state: FreightState, day: number, manifestOf: (voyage: number) => Manifest): FreightState {
  if (!(day > state.day)) return state;
  let s: FreightState = { ...state, dock: [...state.dock] };
  let now = state.day;
  while (now < day) {
    const nextShip = arrival(s.nextVoyage), midnight = Math.floor(now) + 1;
    const until = Math.min(day, nextShip, midnight);
    s = { ...s, stock: consume(s.stock, until - now) };
    now = until;
    if (now === nextShip) {
      const cargo = manifestOf(s.nextVoyage).cargo.map((c) => ({ voyage: s.nextVoyage, kind: c.kind, crates: c.crates, arrived: now }));
      const ship = manifestOf(s.nextVoyage);
      const parcels = ship.parcels.map((p) => ({ ...p, voyage: s.nextVoyage, arrived: now }));
      // 這班船帶來玩家寄件的回信
      const replies = (s.outbox ?? []).filter((l) => l.replyVoyage === s.nextVoyage)
        .map((letter) => ({ id: `reply-${letter.id}`, recipientId: PLAYER_ID, recipientName: '你', sender: `${letter.destination}的回信`, voyage: s.nextVoyage, arrived: now, letter }));
      s = {
        ...s, dock: tidy([...s.dock, ...cargo]), parcels: [...(s.parcels ?? []), ...parcels, ...replies],
        outbox: (s.outbox ?? []).filter((l) => l.replyVoyage !== s.nextVoyage), nextVoyage: s.nextVoyage + 1,
      };
    }
    if (now === midnight) {
      const { taken, rest } = take(s.dock, FREIGHT.helperPerDay, (lot) => now - lot.arrived >= FREIGHT.helperWaitDays);
      if (taken.length) s = { ...s, dock: rest, stock: addStock(s.stock, taken) };
      // 自走運送車：放太久沒人領的包裹自己送掉
      // 寄給玩家的回信不送：玩家沒有收件格，留在接駁口等玩家來領
      const stale = (s.parcels ?? []).filter((p) => p.recipientId !== PLAYER_ID && now - p.arrived >= FREIGHT.parcelWaitDays);
      if (stale.length) s = { ...s, parcels: (s.parcels ?? []).filter((p) => !stale.includes(p)) };
    }
  }
  return { ...s, day };
}

/** 從接駁口裝一箱某種貨上推車。推車滿了或沒貨就不動。 */
export function load(state: FreightState, kind: CargoKind, count = 1): { state: FreightState; loaded: number } {
  const room = FREIGHT.cartCrates - totalCrates(state.cart);
  const want = Math.min(room, count);
  if (want <= 0) return { state, loaded: 0 };
  const { taken, rest } = take(state.dock, want, (lot) => lot.kind === kind);
  const loaded = totalCrates(taken);
  return loaded ? { state: { ...state, dock: rest, cart: tidy([...state.cart, ...taken]) }, loaded } : { state, loaded: 0 };
}

/** 從接駁口領一件包裹（之後由呼叫端放進背包、開任務）。 */
export function pickParcel(state: FreightState, id: string): { state: FreightState; parcel: DockParcel | null } {
  const parcel = (state.parcels ?? []).find((p) => p.id === id) ?? null;
  if (!parcel) return { state, parcel: null };
  return { state: { ...state, parcels: (state.parcels ?? []).filter((p) => p.id !== id), carried: [...(state.carried ?? []), parcel] }, parcel };
}

/** 包裹送到了（當面交或放收件格）。 */
export function completeParcel(state: FreightState, id: string): { state: FreightState; parcel: DockParcel | null } {
  const parcel = (state.carried ?? []).find((p) => p.id === id) ?? null;
  if (!parcel) return { state, parcel: null };
  return { state: { ...state, carried: (state.carried ?? []).filter((p) => p.id !== id), parcelsDelivered: (state.parcelsDelivered ?? 0) + 1 }, parcel };
}

/** 託停靠中的那班船寄一封訊息。船不在港（`docked` 為 false）時寄不了。 */
export function sendLetter(state: FreightState, letter: Omit<Letter, 'replyVoyage'>, docked: boolean): FreightState {
  if (!docked || !letter.note.trim()) return state;
  const replyVoyage = letter.voyage + (letter.destination === '月球' ? 1 : 2);
  return { ...state, outbox: [...(state.outbox ?? []), { ...letter, note: letter.note.trim(), replyVoyage }] };
}

/** 該發、還沒發的長期獎勵。 */
export const dueRewards = (state: FreightState) =>
  REWARDS.filter((r) => state.clearedVoyages.length >= r.after && !(state.rewards ?? []).includes(r.id)).map((r) => r.id);
export const claimReward = (state: FreightState, id: string): FreightState =>
  (state.rewards ?? []).includes(id) ? state : { ...state, rewards: [...(state.rewards ?? []), id] };

/** 寄給玩家的回信領走：從接駁口移到收件匣（不算送件，沒有報酬）。 */
export function pickReply(state: FreightState, id: string): { state: FreightState; parcel: DockParcel | null } {
  const parcel = (state.parcels ?? []).find((p) => p.id === id && p.recipientId === PLAYER_ID) ?? null;
  if (!parcel) return { state, parcel: null };
  return { state: { ...state, parcels: (state.parcels ?? []).filter((p) => p.id !== id), inbox: [...(state.inbox ?? []), parcel] }, parcel };
}
export const letterItemId = (id: string) => `letter-${id}`;
export const letterOfItem = (state: FreightState, itemId: string) =>
  itemId.startsWith('letter-') ? (state.inbox ?? []).find((p) => letterItemId(p.id) === itemId) ?? null : null;

/** 包裹在背包裡的物品 id。 */
export const parcelItemId = (id: string) => `parcel-${id}`;
export const parcelOfItem = (state: FreightState, itemId: string) =>
  itemId.startsWith('parcel-') ? (state.carried ?? []).find((p) => parcelItemId(p.id) === itemId) ?? null : null;

/** 推車上的貨放回接駁口（裝錯了）。 */
export function unloadBack(state: FreightState, kind: CargoKind): FreightState {
  const { taken, rest } = take(state.cart, Infinity, (lot) => lot.kind === kind);
  return taken.length ? { ...state, cart: rest, dock: tidy([...state.dock, ...taken]) } : state;
}

/** 這一區收哪些貨。 */
export const kindsFor = (sectorId: string) => KINDS.filter((k) => CARGO[k].to === sectorId);

/**
 * 到了某一區：推車上要送來這裡的貨全部卸下、入庫。
 * 回傳工資、獎金（這一卸讓某班船在離港前全部送完）與卸了幾箱。
 */
export function deliverAt(state: FreightState, sectorId: string, day: number) {
  const kinds = kindsFor(sectorId);
  const { taken, rest } = take(state.cart, Infinity, (lot) => kinds.includes(lot.kind));
  const crates = totalCrates(taken);
  if (!crates) return { state, crates: 0, wage: 0, bonus: 0, cleared: [] as number[] };
  let next: FreightState = { ...state, cart: rest, stock: addStock(state.stock, taken) };
  const cleared: number[] = [];
  for (const voyage of new Set(taken.map((lot) => lot.voyage))) {
    const left = [...next.dock, ...next.cart].some((lot) => lot.voyage === voyage);
    if (!left && day < departure(voyage) && !next.clearedVoyages.includes(voyage)) cleared.push(voyage);
  }
  if (cleared.length) next = { ...next, clearedVoyages: [...next.clearedVoyages, ...cleared] };
  return { state: next, crates, wage: crates * FREIGHT.wagePerCrate, bonus: cleared.length * FREIGHT.voyageBonus, cleared };
}

// ------------------------------------------------------------------ 等級與文字

export type StockLevel = '充足' | '偏低' | '匱乏';
export const stockLevel = (days: number): StockLevel => (days >= 2 ? '充足' : days > 0 ? '偏低' : '匱乏');

/** 醫療費的倍率：藥品偏低 1.5 倍、匱乏 2 倍（企劃第三節）。 */
export const medicalFeeFactor = (state: FreightState) => ({ 充足: 1, 偏低: 1.5, 匱乏: 2 })[stockLevel(state.stock.medicine)];

const lotsText = (lots: readonly Lot[]) =>
  KINDS.filter((k) => totalCrates(lots, k)).map((k) => `${CARGO[k].name} ${totalCrates(lots, k)} 箱`).join('、');

/** 給主 GM 的幾行：各區等級（不給天數）、接駁口還在等的貨、玩家推車上的貨。 */
export function gmFreightLines(state: FreightState): string[] {
  const lines = KINDS.map((k) => `- ${CARGO[k].place}的${CARGO[k].name}：${stockLevel(state.stock[k])}`);
  if (state.dock.length) lines.push(`- 塔底接駁口還有貨等人搬：${lotsText(state.dock)}`);
  if (state.cart.length) lines.push(`- 玩家的推車上載著：${lotsText(state.cart)}`);
  if (state.parcels?.length) lines.push(`- 接駁口還有 ${state.parcels.length} 件私人包裹等人領（收件人：${[...new Set(state.parcels.map((p) => p.recipientName))].join('、')}）`);
  for (const p of state.carried ?? []) lines.push(`- 玩家身上帶著${p.sender}寄給${p.recipientName}的包裹，還沒送到`);
  for (const l of state.outbox ?? []) lines.push(`- 玩家託補給船寄了一段訊息給${l.destination}${l.itemName ? `（附上${l.itemName}）` : ''}，還在等回信`);
  return lines;
}

export const describeLots = lotsText;
