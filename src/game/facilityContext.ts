import type { Point } from './corridor';
import type { FacilityMap } from './facility';

/** 工程區機台（sprite 名稱就是 engineering_objects.py 的 id）。 */
const ENGINEERING_NAMES: Record<string, string> = {
  valves: '管線閥門組', 'rnd-bench': '研發桌', 'robot-arm': '組裝機械手臂', 'fab-console': '設計終端', drums: '耗材油桶',
  fabricator: '大型製造機', materials: '材料架', 'section-monitor': '製造機操作台', 'power-panel': '配電盤', 'tool-wall': '工具牆',
  repair: '維修中機台', workbench: '檢修工作台', 'tool-cart': '工具推車', 'parts-shelves': '零件貨架', lockers: '休息角置物櫃',
  'repair-queue': '待修品架', crates: '貨箱', 'repair-pallet': '剛送來的待修品', chair: '辦公椅', stool: '圓凳',
};

const propName = (sprite: string): string => {
  if (ENGINEERING_NAMES[sprite]) return ENGINEERING_NAMES[sprite];
  if (sprite === 'sofa') return '三人沙發';
  if (sprite === 'fire_table') return '圓形火盆桌';
  if (sprite === 'window_frame') return '挑高觀景窗';
  if (sprite === 'window_plants') return '觀景窗植物';
  if (sprite === 'desk_console') return '工作台';
  if (sprite.startsWith('monitor_plant_')) return '植物監測器';
  if (sprite.startsWith('corridor_light_')) return '走廊燈';
  if (sprite.startsWith('placed_01') || sprite.startsWith('placed_02')) return '垂柳';
  if (sprite.startsWith('placed_')) return '蘋果樹';
  if (sprite.startsWith('tree_maple_')) return '楓樹';
  if (sprite.startsWith('flower_')) return '花叢';
  if (sprite.startsWith('rock_')) return '景觀石';
  if (sprite.startsWith('stone_lamp_')) return '石燈';
  if (sprite === 'shrub') return '灌木';
  if (sprite === 'garden_tools') return '園藝工具';
  if (sprite === 'basket') return '出貨籃';
  return sprite;
};

/** Compact object inventory for the GM. Coordinates are tile units; nothing here is drawn on screen. */
export function describeFacilityObjects(map: FacilityMap, player?: Point | null): string {
  const tile = map.tileSize;
  const at = (x: number, y: number) => `(${x.toFixed(1)},${y.toFixed(1)})`;
  const objects = new Map<string, string[]>();
  const add = (name: string, x: number, y: number) => objects.set(name, [...objects.get(name) ?? [], at(x, y)]);

  for (const entrance of map.entrances) add(entrance.label, entrance.x + entrance.w / 2, entrance.y + entrance.h / 2);
  for (const interaction of map.interactions ?? []) {
    const name = interaction.kind === 'seat' ? `三人沙發${({ 'sofa-left': '左', 'sofa-middle': '中', 'sofa-right': '右' } as Record<string, string>)[interaction.id] ?? ''}座` : interaction.label;
    const [x, y, w, h] = interaction.area;
    add(name, x + w / 2, y + h / 2);
  }
  // Major landmarks stay available; nearby detail is enough for ordinary dialogue.
  for (const decor of map.decor ?? []) if (['sofa', 'fire_table', 'window_frame', 'desk_console'].includes(decor.sprite))
    add(propName(decor.sprite), decor.x, decor.y);
  if (player) {
    const px = player.x / tile, py = player.y / tile;
    const byDistance = <T extends { x: number; y: number }>(a: T, b: T) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py);
    for (const rack of [...map.racks ?? []].sort((a, b) => byDistance({ x: a.x + a.w / 2, y: a.y + a.h / 2 }, { x: b.x + b.w / 2, y: b.y + b.h / 2 })).slice(0, 2))
      add(`種植架（${rack.crops.join('、')}）`, rack.x + rack.w / 2, rack.y + rack.h / 2);
    const listed = new Set((map.interactions ?? []).map(i => i.id));   // 已經以互動名稱列出的物件不重複
    for (const decor of [...map.decor ?? []].filter(d => !['sofa', 'fire_table', 'window_frame', 'desk_console'].includes(d.sprite) && !(d.id && listed.has(d.id))).sort(byDistance).slice(0, 8))
      add(propName(decor.sprite), decor.x, decor.y);
  }

  const position = player ? at(player.x / tile, player.y / tile) : '尚未取得';
  return `地圖 ${map.width}×${map.height} 格；左上角為 (0,0)，x 向右增加，y 向下增加。玩家目前在 ${position}。\n${[...objects].map(([name, locations]) => `- ${name}：${locations.join('、')}`).join('\n')}`;
}
