import { Bug, Droplets, Heart, Leaf, Sprout, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/audio';
import { STAGE_NAMES, daysText } from '../../game/growthReport';
import { Health, MonitorRow, WING_NAMES, Wing } from '../../game/monitor';
import { STAGE_AT } from '../../game/growth';

interface MonitorModalProps {
  wing: Wing | null;
  rows: MonitorRow[];
  onClose: () => void;
}

const HEALTH_ICON: Record<Health, typeof Heart> = { 健康: Heart, 缺水: Droplets, 葉片發黃: Leaf, 蚜蟲: Bug };
const STAGE_CLASS = { 1: 'text-slate-300 bg-white/[0.06]', 2: 'text-sky-200 bg-sky-400/15', 3: 'text-emerald-200 bg-emerald-400/15' } as const;

/** 溫室植栽監測機：這一翼每段作物的樣子、還要多久收成、健不健康。 */
export default function MonitorModal({ wing, rows, onClose }: MonitorModalProps) {
  const close = () => { sound.playClick(); onClose(); };
  const ripe = rows.filter(r => r.stage === 3).length, sick = rows.filter(r => r.health !== '健康').length;
  return (
    <ModalShell id="modal-monitor" isOpen={wing !== null} onRequestClose={onClose} size="md" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">植栽監測機・{wing ? WING_NAMES[wing] : ''}</h2>
        </div>
        <button type="button" onClick={close} title="關閉" aria-label="關閉"
          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-sm text-slate-300 font-sans mb-3">
        {ripe ? `${ripe} 段可以採收了` : '還沒有可以採收的作物'}，{sick ? <span className="text-amber-300">{sick} 段需要照顧</span> : '大家都很健康'}。
      </p>
      <ul className="overflow-y-auto pr-0.5 font-sans space-y-2">
        {rows.map((r) => {
          const Icon = HEALTH_ICON[r.health], ok = r.health === '健康';
          return (
            <li key={`${r.place}-${r.crop}`} className={`flex items-center gap-3 rounded-xl p-2.5 border ${ok ? 'border-white/[0.08] bg-[#0a1330]/80' : 'border-amber-400/40 bg-amber-400/[0.07]'}`}>
              <div className="w-14 h-14 shrink-0 rounded-lg bg-black/30 flex items-end justify-center overflow-hidden">
                <img src={`/assets/greenhouse/crops/${r.crop}_${r.stage}.webp`} alt="" className="max-h-14 w-auto" style={{ imageRendering: 'pixelated', transform: 'scale(2)', transformOrigin: 'bottom' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-100 font-semibold">{r.name}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${STAGE_CLASS[r.stage]}`}>{STAGE_NAMES[r.stage]}</span>
                  <span className="text-[11px] text-slate-500">{r.place}</span>
                </div>
                {/* 一輪週期：可採收那段（75% 之後）畫成淡綠色，填滿的是目前進度 */}
                <div className="relative h-2 mt-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="absolute inset-y-0 right-0 bg-emerald-400/15" style={{ left: `${STAGE_AT[1] * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full ${r.stage === 3 ? 'bg-emerald-400' : 'bg-sky-400'}`} style={{ width: `${r.progress * 100}%` }} />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {r.stage === 3 ? `可採收・${daysText(r.daysToHarvest)}後自動收成` : `${daysText(r.daysToRipe)}後可採收`}
                </div>
              </div>
              <div className={`flex flex-col items-center gap-0.5 w-14 shrink-0 text-[11px] ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                <Icon className="w-5 h-5" />
                {r.health}
              </div>
            </li>
          );
        })}
      </ul>
    </ModalShell>
  );
}
