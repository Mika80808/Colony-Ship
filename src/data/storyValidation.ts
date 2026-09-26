import { NPCData, NpcSchedule, RoomDef, SCHEDULE_KIND_LABEL, ScheduleSlot } from '../types';

/**
 * 故事書人物表單的儲存前校驗。
 *
 * 回傳以欄位為鍵的錯誤訊息，表單據此在對應位置標示；空物件表示通過。
 * 鍵：schedules（整體）、schedule-<組索引>（單一組）、roomId、department。
 */
export type NpcFormErrors = Record<string, string>;

/** 時段實際涵蓋的小時。start === end 表示整天。 */
export function slotHours(slot: ScheduleSlot): number[] {
  const hours: number[] = [];
  let h = slot.start;
  do {
    hours.push(h);
    h = (h + 1) % 24;
  } while (h !== slot.end);
  return hours;
}

const isHour = (value: number) => Number.isInteger(value) && value >= 0 && value <= 23;

/** 把一串小時壓成「3–5 時、8 時」這種好讀的文字。 */
function formatHours(hours: number[]): string {
  const sorted = [...hours].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    ranges.push(i === j ? `${sorted[i]} 時` : `${sorted[i]}–${sorted[j] + 1} 時`);
    i = j + 1;
  }
  return ranges.join('、');
}

/**
 * 單一組日程的問題；沒問題回傳 null。
 * 所有組：時段不重疊、地點存在。保底組另外要剛好涵蓋 24 小時；
 * 其他組可只涵蓋部分時段（沒涵蓋的時段查詢時落到下一層）。
 * 好感解鎖組的好感門檻必填且為整數。
 */
export function validateScheduleGroup(group: NpcSchedule, locationIds: Set<string>): string | null {
  const problems: string[] = [];
  if (group.kind === 'affection' && !Number.isInteger(group.affectionThreshold)) {
    problems.push('好感門檻必須填寫整數');
  }
  if (!group.slots.length) return [...problems, '至少要有一個時段'].join('；');
  const counts = new Array<number>(24).fill(0);
  group.slots.forEach((slot, index) => {
    if (!isHour(slot.start) || !isHour(slot.end)) {
      problems.push(`第 ${index + 1} 段的時間必須是 0–23 的整數`);
      return;
    }
    if (!locationIds.has(slot.locationId)) {
      problems.push(`第 ${index + 1} 段的地點不在內建地點清單中`);
    }
    for (const h of slotHours(slot)) counts[h]++;
  });
  if (problems.length) return problems.join('；');

  const gaps = counts.flatMap((count, h) => (count === 0 ? [h] : []));
  const overlaps = counts.flatMap((count, h) => (count > 1 ? [h] : []));
  if (group.kind === 'base' && gaps.length) problems.push(`${formatHours(gaps)}沒有安排`);
  if (overlaps.length) problems.push(`${formatHours(overlaps)}重疊`);
  return problems.length ? problems.join('；') : null;
}

export function validateSchedules(schedules: NpcSchedule[], locationIds: Set<string>): NpcFormErrors {
  const errors: NpcFormErrors = {};
  const baseCount = schedules.filter((group) => group.kind === 'base').length;
  // 保底是查不到其他組時的最後退路，兩組以上就無從決定該用哪一組，所以限定一組。
  // 其他類型允許多組。
  if (baseCount === 0) errors.schedules = `必須有一組「${SCHEDULE_KIND_LABEL.base}」日程`;
  else if (baseCount > 1) errors.schedules = `「${SCHEDULE_KIND_LABEL.base}」日程只能有一組`;
  schedules.forEach((group, index) => {
    const problem = validateScheduleGroup(group, locationIds);
    if (problem) errors[`schedule-${index}`] = problem;
  });
  return errors;
}

/** 房號不可與其他 NPC 或玩家重複，且必須在內建房號清單中。空值表示不住居住區。 */
export function validateRoom(
  roomId: string,
  npcId: string | null,
  npcs: NPCData[],
  rooms: RoomDef[],
  playerRoomId?: string
): NpcFormErrors {
  if (!roomId) return {};
  if (!rooms.some((room) => room.id === roomId)) return { roomId: `房號 ${roomId} 不在房號清單中` };
  if (roomId === playerRoomId) return { roomId: `房號 ${roomId} 是玩家的房間` };
  const occupant = npcs.find((npc) => npc.roomId === roomId && npc.id !== npcId);
  return occupant ? { roomId: `房號 ${roomId} 已由「${occupant.name}」使用` } : {};
}
