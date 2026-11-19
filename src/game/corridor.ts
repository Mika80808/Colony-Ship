export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

/**
 * 居住區走廊 A–D：用設施場景（FacilityScene）跑，地圖在 public/assets/<folder>/map.json，
 * 由 tools/art/corridor_map.py 從同資料夾的 manifest.json 產生（房門、長椅、招牌、兩端出入口都在裡面）。
 * 這裡只留 App 選場景要用的設定；left／right 是走廊兩端的設施（照環上的順序），改了要一起改腳本的 CORRIDORS。
 */
export type Facility = 'research' | 'greenhouse' | 'medical' | 'engineering';
export interface CorridorConfig { folder: string; letter: string; left: Facility; right: Facility }
export const CORRIDORS: Record<string, CorridorConfig> = {
  residential_a: { folder: 'corridor-a', letter: 'A', left: 'research', right: 'greenhouse' },
  residential_b: { folder: 'corridor-b', letter: 'B', left: 'greenhouse', right: 'medical' },
  residential_c: { folder: 'corridor-c', letter: 'C', left: 'medical', right: 'engineering' },
  residential_d: { folder: 'corridor-d', letter: 'D', left: 'engineering', right: 'research' },
};
