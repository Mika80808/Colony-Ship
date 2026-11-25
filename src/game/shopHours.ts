import { hourOf } from '../data/npcSchedule';

/**
 * 中央廣場的商店與營業時間（v3，docs/scenes/plaza.md）。時間用 'HH:MM'；close <= open 表示跨午夜（酒吧 18:00–01:00），
 * open 00:00、close 24:00 是 24 小時。判斷只看小時，跟 NPC 日程（npcSchedule.slotCovers）同一個精度。
 */
export interface ShopHours { open: string; close: string }
export interface Shop { id: string; name: string; staffed: boolean; hours: ShopHours; menu?: string[] }

export const ALL_DAY: ShopHours = { open: '00:00', close: '24:00' };

export const SHOPS: Record<string, Shop> = {
  vending: { id: 'vending', name: '販賣櫃', staffed: false, hours: ALL_DAY },
  cafe: { id: 'cafe', name: '咖啡吧檯', staffed: false, hours: { open: '07:00', close: '17:00' }, menu: ['咖啡', '輕食'] },
  restaurant: { id: 'restaurant', name: '餐廳', staffed: true, hours: { open: '11:00', close: '20:00' }, menu: ['主餐', '副餐', '湯品'] },
  bar: { id: 'bar', name: '酒吧', staffed: true, hours: { open: '18:00', close: '01:00' }, menu: ['酒精', '飲料', '甜點'] },
};

export const isAllDay = (h: ShopHours) => hourOf(h.open) === 0 && hourOf(h.close) >= 24;

/** 某個遊戲時間（'HH:MM'）店開著嗎。 */
export function isOpen(h: ShopHours, time: string): boolean {
  if (isAllDay(h)) return true;
  const hour = hourOf(time), open = hourOf(h.open), close = hourOf(h.close) % 24;
  return open < close ? hour >= open && hour < close : hour >= open || hour < close;
}

/** 給介面與 GM 看的營業時間字串。 */
export const describeHours = (h: ShopHours) => isAllDay(h) ? '24 小時' : `${h.open}–${h.close}`;

/** 店名加上現在開沒開，給互動提示與 GM 的場景摘要。 */
export function shopStatus(shop: Shop, time: string): string {
  const open = isOpen(shop.hours, time);
  return `${shop.name}（${describeHours(shop.hours)}）${open ? '營業中' : '休息中'}`;
}
