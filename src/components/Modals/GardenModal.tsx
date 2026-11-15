import { useEffect, useState } from 'react';
import { Bug, Droplets, Hand, Shovel, Sprout, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/audio';
import type { InventoryItem } from '../../types';
import { GARDEN, GardenState, cellStatus, isRipe, needsWater, seedsLeft, stageOf } from '../../game/garden';
import { CROP_NAMES } from '../../game/growthReport';
import { cropOfSeed } from '../../data/items';

interface GardenModalProps {
  isOpen: boolean;
  onClose: () => void;
  garden: GardenState;
  /** 菜圃幾欄（map.json 那塊地的寬，格）。 */
  columns: number;
  /** 現在的遊戲日序（含小數）。 */
  day: number;
  /** 玩家背包，播種時從裡面挑種子。 */
  items: InventoryItem[];
  onPlant: (index: number, seedItemId: string) => void;
  onWater: (index?: number) => void;
  onTreat: (index: number) => void;
  onHarvest: (index: number) => void;
  onClear: (index: number) => void;
  onTakeSeed: (crop: string) => void;
}

const button = 'h-7 px-2.5 rounded-lg text-[12px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed border';

/** 溫室的玩家菜圃：一格一株，播種、澆水、除蟲、採收。 */
export default function GardenModal({ isOpen, onClose, garden, columns, day, items, onPlant, onWater, onTreat, onHarvest, onClear, onTakeSeed }: GardenModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [seedCrop, setSeedCrop] = useState('lettuce');
  useEffect(() => { if (!isOpen) setSelected(null); }, [isOpen]);

  const cell = selected === null ? null : garden.cells[selected];
  // 背包裡的種子，同一種只列一次
  const seeds = [...new Map(items.filter((item) => cropOfSeed(item.id)).map((item) => [item.id, item])).values()];
  const thirsty = garden.cells.filter((c) => needsWater(c, day)).length;
  const left = seedsLeft(garden, day);
  const click = (run: () => void) => () => { sound.playClick(); run(); };

  return (
    <ModalShell id="modal-garden" isOpen={isOpen} onRequestClose={onClose} size="md" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">菜圃</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!thirsty} onClick={click(() => onWater())}
            className={`${button} bg-sky-500/20 hover:bg-sky-500/45 border-sky-400/40 text-sky-100`}
            title={`花 ${GARDEN.waterAllMinutes} 分鐘`}>
            <Droplets className="w-3.5 h-3.5" /><span>全部澆水{thirsty ? `（${thirsty}）` : ''}</span>
          </button>
          <button type="button" onClick={click(onClose)} title="關閉" aria-label="關閉"
            className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="font-sans space-y-3.5 overflow-y-auto min-h-0">
        {/* 田地 */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {garden.cells.map((c, index) => {
            const dry = needsWater(c, day);
            return (
              <button key={index} type="button" id={`garden-cell-${index}`} aria-pressed={selected === index}
                aria-label={c ? `${CROP_NAMES[c.crop] ?? c.crop}：${cellStatus(c, day)}` : '空地'}
                onClick={click(() => setSelected(selected === index ? null : index))}
                className={`aspect-square rounded-md border relative flex items-end justify-center overflow-hidden cursor-pointer transition ${
                  selected === index ? 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]' : 'border-white/[0.1] hover:border-sky-400/50'
                } ${!c ? 'bg-[#3a2a1c]/40' : dry || c.dead ? 'bg-[#5a432c]/60' : 'bg-[#33261a]/90'}`}>
                {c && (
                  <img src={`/assets/greenhouse/crops/${c.crop}_${stageOf(c)}.webp`} alt="" draggable={false}
                    className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated', filter: c.dead ? 'grayscale(1) brightness(.55)' : undefined }} />
                )}
                {c && !c.dead && isRipe(c) && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400" />}
                {c && c.pest && <Bug className="absolute top-0.5 left-0.5 w-3 h-3 text-rose-300" />}
                {c && dry && <Droplets className="absolute bottom-0.5 right-0.5 w-3 h-3 text-sky-300" />}
              </button>
            );
          })}
        </div>

        {/* 選取的那一格 */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] min-h-[76px]">
          {selected === null ? (
            <p className="text-[12px] text-slate-500">點一格查看。空地可以播種；作物每天都要澆水，連續 {GARDEN.dryLimit} 天沒澆會枯。</p>
          ) : cell ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-100 font-bold">{CROP_NAMES[cell.crop] ?? cell.crop}
                <span className="ml-2 text-[12px] font-normal text-slate-300">{cellStatus(cell, day)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {isRipe(cell) && <button type="button" onClick={click(() => onHarvest(selected))} className={`${button} bg-emerald-500/25 hover:bg-emerald-500/50 border-emerald-400/40 text-emerald-100`}><Hand className="w-3.5 h-3.5" />採收</button>}
                {needsWater(cell, day) && <button type="button" onClick={click(() => onWater(selected))} className={`${button} bg-sky-500/20 hover:bg-sky-500/45 border-sky-400/40 text-sky-100`}><Droplets className="w-3.5 h-3.5" />澆水</button>}
                {cell.pest && !cell.dead && <button type="button" onClick={click(() => onTreat(selected))} className={`${button} bg-amber-500/20 hover:bg-amber-500/45 border-amber-400/40 text-amber-100`}><Bug className="w-3.5 h-3.5" />除蟲</button>}
                <button type="button" onClick={click(() => onClear(selected))} className={`${button} bg-rose-500/15 hover:bg-rose-500/40 border-rose-400/30 text-rose-100`}><Shovel className="w-3.5 h-3.5" />剷掉</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[12px] text-slate-300">空地。{seeds.length ? '選一種種子播下去：' : '背包裡沒有種子，先到下面的種子箱領。'}</div>
              <div className="flex flex-wrap gap-1.5">
                {seeds.map((seed) => (
                  <button key={seed.id} type="button" onClick={click(() => onPlant(selected, seed.id))}
                    className={`${button} bg-emerald-500/15 hover:bg-emerald-500/40 border-emerald-400/30 text-emerald-100`}>
                    <Sprout className="w-3.5 h-3.5" />{seed.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 種子箱 */}
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          <span className="shrink-0">種子箱（今天還能領 {Math.max(0, left)} 包）</span>
          <select value={seedCrop} onChange={(e) => setSeedCrop(e.target.value)} aria-label="要領的種子"
            className="h-7 flex-1 min-w-0 glass-input rounded-lg px-2 text-xs text-slate-100 bg-[#0a1226] focus:outline-none">
            {Object.entries(CROP_NAMES).map(([crop, name]) => <option key={crop} value={crop}>{name}</option>)}
          </select>
          <button type="button" disabled={left <= 0} onClick={click(() => onTakeSeed(seedCrop))}
            className={`${button} bg-white/[0.06] hover:bg-white/[0.14] border-white/[0.12] text-slate-100`}>領一包</button>
        </div>
      </div>
    </ModalShell>
  );
}
