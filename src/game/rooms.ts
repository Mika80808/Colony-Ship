/**
 * 居住區房間共用一個殼，陳設跟著住戶走：public/assets/rooms/<住戶>/ 是那位住戶的房間地圖，
 * 由 tools/art/room_map.py 從 public/assets/rooms/furnishings/<住戶>.json 產生；沒有陳設的房間用 rooms/empty。
 * 新增住戶陳設：加 furnishings/<住戶>.json、重跑腳本、把住戶 id 加進 FURNISHED（測試會檢查兩邊對得上）。
 */
export const FURNISHED = ['lucian'];

/** 房間地圖的資料夾名稱：有陳設的住戶用自己的，其他（含沒人住）用空房。 */
export const roomFolder = (occupant: string | undefined) => (occupant && FURNISHED.includes(occupant) ? occupant : 'empty');
