import type { Point } from './corridor';
import type { Facing, FacilityMap } from './facility';

/**
 * 場景專屬的演出（房間淋浴的霧氣與換裝、艦橋平台的抵達演出、投射特效……）掛在設施場景上的介面。
 * 引擎（FacilityScene）照固定順序呼叫；每一項都可以省略。座標都是世界 px。
 *
 * 一幀的順序：
 *   locked → update（沒暫停時）→ 畫地面 → drawGround → 物件與角色（drawPlayer 包住角色）→ 前景層 → drawTop → 提示泡泡
 */
export interface SceneApi {
  map: FacilityMap;
  /** 角色腳點（唯讀；要移動角色用 place）。 */
  player: Readonly<Point>;
  direction: Facing;
  seated: boolean;
  moving: boolean;
  /** 遊戲開始後的毫秒數（requestAnimationFrame 的時間）。 */
  time: number;
  camera: Readonly<Point>;
  view: { width: number; height: number };
  /** 把角色放到某處（抵達演出、淋浴站位）；清掉進行中的路徑。 */
  place(p: Point, facing?: Facing): void;
  /**
   * 照常畫角色（行走圖、影子）；walking 為 true 時播走路動畫（演出中角色被帶著走）。
   * recolor：畫上去之前改這一格的顏色（淋浴時身體換成膚色）；frame 是只有這一格的暫存畫布。
   */
  drawPlayer(walking?: boolean, recolor?: (frame: CanvasRenderingContext2D, width: number, height: number) => void): void;
  /** 角色現在坐在或躺在哪個互動上（id），站著是 undefined。 */
  seatedOn?: string;
  /** 場景的 canvas（寫 dataset 給瀏覽器測試讀）。 */
  canvas: HTMLCanvasElement;
}

/** 擴充加進來、要跟物件和角色一起排前後的東西（例：會轉頭的值勤人員）。bottom 是腳點 y，box 是圖的範圍。 */
export interface ExtraStanding { bottom: number; box?: { left: number; top: number; right: number; bottom: number }; draw(ctx: CanvasRenderingContext2D): void }

export interface SceneExtras {
  /** 每幀加進排序的東西（會動或會換圖的，例：值勤人員）。 */
  standing?(api: SceneApi): ExtraStanding[];
  /** 回傳 true 時角色不能動、點擊和按鍵都不理（例：抵達演出中）。畫面照常更新。 */
  locked?(api: SceneApi): boolean;
  /** 每幀（沒暫停時）先呼叫，dt 是秒。 */
  update?(api: SceneApi, dt: number): void;
  /** 畫在地面上、所有物件和角色底下（地面特效、平台井口）。 */
  drawGround?(ctx: CanvasRenderingContext2D, api: SceneApi): void;
  /** 包住角色的繪製：要照常畫角色就呼叫 draw()；不呼叫就不畫（例：抵達前還在平台底下）。可以在前後疊東西（淋浴霧氣）。 */
  drawPlayer?(ctx: CanvasRenderingContext2D, api: SceneApi, draw: () => void): void;
  /** 畫在所有東西（含前景層）上面、提示泡泡底下（照明、蒸氣、投射特效）。 */
  drawTop?(ctx: CanvasRenderingContext2D, api: SceneApi): void;
}
