/**
 * 種植架（map.json 的 racks）：架子外框 + 依生長階段替換的作物圖。
 * 素材在 public/assets/<folder>/：rack_shelf.webp／rack_trellis.webp／racks.json（tools/art/greenhouse_racks.py），
 * crops/<作物>_<1|2|3>.webp 與 crops/crops.json（tools/art/greenhouse_crops.py）。
 * 位置單位都是素材像素，畫的時候整排放大 racks.json 的 scale 倍（2 → 一排 12×3 格）。
 */
export type RackKind = 'shelf' | 'trellis';
/** 在地圖上佔 w×h 格（碰撞），圖從佔地底邊往上畫，會蓋到後面那排走道。`crops` 依序平分整排。`stage`（1–3）只給測試或固定展示用，平常由生長系統依時間決定。 */
export interface RackSpec { x: number; y: number; w: number; h: number; kind: RackKind; crops: string[]; stage?: number }
export interface RacksMeta {
  scale: number; width: number; height: number;
  shelf: { x0: number; x1: number; baselines: number[] };
  trellis: { x0: number; x1: number; baseline: number; stakes: number[] };
}
export interface CropStage { w: number; h: number; anchor: number }
export type CropsMeta = Record<string, { kind: RackKind; stages: CropStage[] }>;
/** One crop sprite: `x` is its left edge and `bottom` the baseline it stands on, in rack art pixels. */
export interface Planting { crop: string; stage: number; x: number; bottom: number }

/** 層架作物的間距：可採收那階段寬度的九成，葉子稍微互相疊到才不顯得稀疏。 */
const SHELF_PACK = .9;

/** `stageOf` 給每種作物目前的生長階段（見 growth.ts）；沒給就用 rack.stage，再沒有就是可採收。 */
export function layoutRack(rack: RackSpec, meta: RacksMeta, crops: CropsMeta, stageOf?: (crop: string) => number): Planting[] {
  const out: Planting[] = [], stageFor = (crop: string) => rack.stage ?? stageOf?.(crop) ?? 3;
  const known = (c: string) => crops[c]?.stages.length === 3;
  if (rack.kind === 'trellis') {
    const { stakes, baseline } = meta.trellis, per = stakes.length / rack.crops.length;
    stakes.forEach((sx, i) => {
      const crop = rack.crops[Math.min(rack.crops.length - 1, Math.floor(i / per))];
      if (!known(crop)) return;
      const stage = stageFor(crop), s = crops[crop].stages[stage - 1];
      out.push({ crop, stage, x: sx - s.anchor, bottom: baseline });
    });
    return out;
  }
  const { x0, x1, baselines } = meta.shelf, span = (x1 - x0) / rack.crops.length;
  rack.crops.forEach((crop, ci) => {
    if (!known(crop)) return;
    const stage = stageFor(crop), ready = crops[crop].stages[2], s = crops[crop].stages[stage - 1];
    const n = Math.max(1, Math.floor(span / (ready.w * SHELF_PACK))), step = span / n;
    for (const bottom of baselines)
      for (let i = 0; i < n; i++)
        out.push({ crop, stage, x: Math.round(x0 + ci * span + step * (i + .5) - s.w / 2), bottom });
  });
  return out;
}

/** 整排圖在世界座標的位置：底邊對齊佔地底邊，左邊對齊佔地左邊。 */
export function rackBounds(rack: RackSpec, meta: RacksMeta, tileSize: number) {
  const width = meta.width * meta.scale, height = meta.height * meta.scale, bottom = (rack.y + rack.h) * tileSize;
  return { x: rack.x * tileSize, y: bottom - height, width, height, bottom };
}

/** 分辨同一種作物在不同架子上的種植（生長相位各自錯開）。 */
export const rackKey = (rack: RackSpec) => `${rack.x},${rack.y}`;
