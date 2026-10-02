/**
 * 窗前工作站的生長報表：自動植栽區每段種植目前長到哪、幾天後可採收或自動收成。
 * 只有到工作站查看才看得到（玩家按 E 開報表；GM 也被告知角色要先去查才說得出數字）。
 * 數字跟畫面上的生長一致：都由 growth.ts 的 progress 推得。
 */
import type { RackSpec } from './racks';
import { CYCLE_DAYS, STAGE_AT, Stage, progress } from './growth';
import { rackKey } from './racks';

export const CROP_NAMES: Record<string, string> = {
  lettuce: '萵苣', potato: '馬鈴薯', kale: '羽衣甘藍', radish: '櫻桃蘿蔔', bell_pepper: '甜椒', pea: '豌豆',
  strawberry: '草莓', blueberry: '藍莓', cherry_tomato: '小番茄', pineapple: '鳳梨', dwarf_lemon: '矮種檸檬',
  grape: '葡萄', passion_fruit: '百香果', basil: '羅勒', mint: '薄荷', rosemary: '迷迭香', perilla: '紫蘇',
  chives: '細香蔥', thyme: '百里香',
};
export const STAGE_NAMES: Record<Stage, string> = { 1: '幼苗', 2: '生長中', 3: '可採收' };
const DEFAULT_DAYS = 40;

export interface GrowthRow {
  crop: string; name: string;
  /** 「左翼第 1 排」這類位置。地圖中線左邊算左翼，排數由上往下數。 */
  place: string;
  stage: Stage;
  /** 這一輪週期走到哪（0–1），畫進度條用。 */
  progress: number;
  /** 種植架的 key（racks.rackKey），健康狀態等以此分辨同一種作物的不同架子。 */
  key: string;
  /** 還要幾天進入可採收；已可採收則為 0。 */
  daysToRipe: number;
  /** 還要幾天機器自動收成、補種（週期結束）。 */
  daysToHarvest: number;
}

const round = (d: number) => Math.round(d * 10) / 10;

/** 每段種植（同一排的不同作物各一列）在 `day` 的狀態，依左翼、右翼與由上往下排序。 */
export function growthReport(racks: RackSpec[], day: number, mapWidth: number): GrowthRow[] {
  const sides = { 左翼: [] as RackSpec[], 右翼: [] as RackSpec[] };
  for (const r of racks) (r.x + r.w / 2 < mapWidth / 2 ? sides.左翼 : sides.右翼).push(r);
  const rows: GrowthRow[] = [];
  for (const [side, list] of Object.entries(sides)) {
    [...list].sort((a, b) => a.y - b.y).forEach((r, i) => {
      for (const crop of r.crops) {
        const days = CYCLE_DAYS[crop] ?? DEFAULT_DAYS, p = progress(crop, rackKey(r), day);
        const stage: Stage = p < STAGE_AT[0] ? 1 : p < STAGE_AT[1] ? 2 : 3;
        rows.push({
          crop, name: CROP_NAMES[crop] ?? crop, place: `${side}第 ${i + 1} 排`, stage, progress: p, key: rackKey(r),
          daysToRipe: stage === 3 ? 0 : round((STAGE_AT[1] - p) * days),
          daysToHarvest: round((1 - p) * days),
        });
      }
    });
  }
  return rows;
}

/** 倒數天數的顯示：整數天，不到一天另外講。 */
export const daysText = (d: number) => d < 1 ? '不到 1 天' : `約 ${Math.round(d)} 天`;

/** 一列的白話說明，報表與 GM 共用。 */
export function describeRow(r: GrowthRow): string {
  return r.stage === 3
    ? `${r.name}（${r.place}）：可採收，${daysText(r.daysToHarvest)}後自動收成`
    : `${r.name}（${r.place}）：${STAGE_NAMES[r.stage]}，${daysText(r.daysToRipe)}後可採收`;
}
