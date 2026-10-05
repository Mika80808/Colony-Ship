import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  NpcSchedule,
  SCHEDULE_KIND_LABEL,
  SCHEDULE_NATURE_LABEL,
  ScheduleKind,
  ScheduleNature,
  ScheduleSlot,
  SectorEntry,
  RoomDef,
} from '../../types';
import { NpcFormErrors } from '../../data/storyValidation';

interface ScheduleEditorProps {
  schedules: NpcSchedule[];
  onChange: (next: NpcSchedule[]) => void;
  /** 可選的地點：只限內建地點與內建房號，不可自由輸入。選居住區本身表示在走廊。 */
  locations: SectorEntry[];
  rooms: RoomDef[];
  errors: NpcFormErrors;
  /** 既有角色還沒有日程，可先補人物資料。 */
  allowUnscheduled?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const KINDS = Object.keys(SCHEDULE_KIND_LABEL) as ScheduleKind[];
const NATURES = Object.keys(SCHEDULE_NATURE_LABEL) as ScheduleNature[];

const selectClass =
  'h-7 glass-input rounded-md px-1.5 text-xs text-slate-100 focus:outline-none bg-[#0a1226]';

/**
 * 人物日程編輯器。
 * 每組日程有類型（保底／值勤／好感解鎖／特殊事件）與多個時段；
 * 時段可跨午夜（起點大於終點），起訖相同表示整天。
 * 涵蓋與重疊在儲存時才檢查（storyValidation.ts），編輯途中允許不完整。
 */
export default function ScheduleEditor({ schedules, onChange, locations, rooms, errors, allowUnscheduled = false }: ScheduleEditorProps) {
  const defaultLocation = locations[0]?.id ?? '';
  const knownLocation = (id: string) => locations.some((loc) => loc.id === id) || rooms.some((room) => room.id === id);

  const updateGroup = (index: number, patch: Partial<NpcSchedule>) =>
    onChange(schedules.map((group, i) => (i === index ? { ...group, ...patch } : group)));

  const updateSlot = (groupIndex: number, slotIndex: number, patch: Partial<ScheduleSlot>) =>
    updateGroup(groupIndex, {
      slots: schedules[groupIndex].slots.map((slot, i) => (i === slotIndex ? { ...slot, ...patch } : slot)),
    });

  const addGroup = () => {
    const kind: ScheduleKind = schedules.some((group) => group.kind === 'base') ? 'duty' : 'base';
    onChange([...schedules, { kind, slots: [{ start: 0, end: 0, locationId: defaultLocation, nature: 'free' }] }]);
  };

  // 新時段接在上一段結尾，省得每次都從 0 點選起。
  const addSlot = (groupIndex: number) => {
    const slots = schedules[groupIndex].slots;
    const start = slots.length ? slots[slots.length - 1].end : 0;
    updateGroup(groupIndex, {
      slots: [...slots, { start, end: (start + 1) % 24, locationId: defaultLocation, nature: 'free' }],
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[12px] text-slate-400">日程</label>
        <button
          type="button"
          onClick={addGroup}
          className="text-[12px] text-sky-300 hover:text-sky-200 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          新增日程組
        </button>
      </div>

      {errors.schedules && <div className="text-[12px] text-rose-300">{errors.schedules}</div>}

      {schedules.length === 0 && (
        <div className="text-[12px] text-slate-500">
          {allowUnscheduled ? '尚未安排日程，可先補人物資料。開始安排時，至少需要一組「保底」。' : '尚未設定日程。至少需要一組「保底」。'}
        </div>
      )}

      {schedules.map((group, groupIndex) => {
        const error = errors[`schedule-${groupIndex}`];
        return (
          <div
            key={groupIndex}
            className={`p-2 rounded-lg border space-y-1.5 ${
              error ? 'border-rose-500/60 bg-rose-950/20' : 'border-white/[0.08] bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-2">
              <select
                value={group.kind}
                onChange={(e) => updateGroup(groupIndex, { kind: e.target.value as ScheduleKind })}
                className={selectClass}
                aria-label="日程類型"
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SCHEDULE_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              {group.kind === 'affection' && (
                <label className="flex items-center gap-1 text-[12px] text-slate-400">
                  好感 ≥
                  <input
                    type="number"
                    step={1}
                    value={group.affectionThreshold ?? ''}
                    onChange={(e) =>
                      updateGroup(groupIndex, {
                        affectionThreshold: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="w-16 h-7 glass-input rounded-md px-1.5 text-xs text-slate-100 focus:outline-none"
                    aria-label="好感門檻"
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => addSlot(groupIndex)}
                className="text-[12px] text-sky-300 hover:text-sky-200 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                時段
              </button>
              <button
                type="button"
                onClick={() => onChange(schedules.filter((_, i) => i !== groupIndex))}
                className="ml-auto w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/[0.08]"
                title="刪除此組"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {group.slots.map((slot, slotIndex) => (
              <div key={slotIndex} className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={slot.start}
                  onChange={(e) => updateSlot(groupIndex, slotIndex, { start: Number(e.target.value) })}
                  className={selectClass}
                  aria-label="起始小時"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <span className="text-slate-500 text-xs">→</span>
                <select
                  value={slot.end}
                  onChange={(e) => updateSlot(groupIndex, slotIndex, { end: Number(e.target.value) })}
                  className={selectClass}
                  aria-label="結束小時"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
                <select
                  value={slot.locationId}
                  onChange={(e) => updateSlot(groupIndex, slotIndex, { locationId: e.target.value })}
                  className={`${selectClass} flex-1 min-w-[90px]`}
                  aria-label="地點"
                >
                  {/* 地點被刪掉的舊值仍列出來，校驗時才看得出是哪一段出問題。 */}
                  {!knownLocation(slot.locationId) && (
                    <option value={slot.locationId}>（不存在的地點）</option>
                  )}
                  <optgroup label="地點">
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {rooms.some((room) => room.sectorId === loc.id) ? '（走廊）' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="房間">
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.id} 房
                      </option>
                    ))}
                  </optgroup>
                </select>
                <select
                  value={slot.nature}
                  onChange={(e) => updateSlot(groupIndex, slotIndex, { nature: e.target.value as ScheduleNature })}
                  className={selectClass}
                  aria-label="性質"
                >
                  {NATURES.map((nature) => (
                    <option key={nature} value={nature}>
                      {SCHEDULE_NATURE_LABEL[nature]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    updateGroup(groupIndex, { slots: group.slots.filter((_, i) => i !== slotIndex) })
                  }
                  className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/[0.08]"
                  title="刪除時段"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {error && <div className="text-[12px] text-rose-300">{error}</div>}
          </div>
        );
      })}
    </div>
  );
}
