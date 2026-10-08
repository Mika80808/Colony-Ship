import { Sprout, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/audio';
import { GrowthRow, STAGE_NAMES, daysText } from '../../game/growthReport';

interface GrowthModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: GrowthRow[];
  gameDate: string;
  gameTime: string;
}

const STAGE_CLASS = { 1: 'text-slate-300', 2: 'text-sky-300', 3: 'text-emerald-300' } as const;

/** 溫室窗前工作站的農業監控終端：自動植栽區各排的生長階段與倒數。 */
export default function GrowthModal({ isOpen, onClose, rows, gameDate, gameTime }: GrowthModalProps) {
  const close = () => { sound.playClick(); onClose(); };
  return (
    <ModalShell id="modal-growth" isOpen={isOpen} onRequestClose={onClose} size="md" maxHeight="max-h-[42vh]" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">農業監控終端</h2>
          <span className="text-xs text-slate-400 font-sans">{gameDate} {gameTime}</span>
        </div>
        <button type="button" onClick={close} title="關閉" aria-label="關閉"
          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 font-sans">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 text-left sticky top-0 bg-[#070e24]">
              <th className="py-1.5 font-normal">位置</th>
              <th className="py-1.5 font-normal">作物</th>
              <th className="py-1.5 font-normal">階段</th>
              <th className="py-1.5 font-normal text-right">預計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.place}-${r.crop}`} className="border-t border-white/[0.06]">
                <td className="py-1.5 text-slate-400">{r.place}</td>
                <td className="py-1.5 text-slate-100">{r.name}</td>
                <td className={`py-1.5 ${STAGE_CLASS[r.stage]}`}>{STAGE_NAMES[r.stage]}</td>
                <td className="py-1.5 text-right text-slate-300">
                  {r.stage === 3 ? `${daysText(r.daysToHarvest)}後自動收成` : `${daysText(r.daysToRipe)}後可採收`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}
