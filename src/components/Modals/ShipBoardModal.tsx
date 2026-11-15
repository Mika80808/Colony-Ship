import { Package, Ship, Users, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/audio';
import { CARGO, Manifest, SHIP, ShipStatus, arrival, departure, headline, scheduledDay, voyageCode } from '../../game/supplyShip';

interface ShipBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ShipStatus;
  /** 這一班的貨單；還沒公布時是 null。 */
  cargo: Manifest | null;
  /** 日序 → 「10/27 09:00」。 */
  formatTime: (day: number) => string;
}

/** 補給船告示板（艦橋通訊台）：船期、延誤、這一班的貨單。運輸要到第二階段才能做，這裡只能看。 */
export default function ShipBoardModal({ isOpen, onClose, status, cargo, formatTime }: ShipBoardModalProps) {
  const close = () => { sound.playClick(); onClose(); };
  const n = status.voyage;
  return (
    <ModalShell id="modal-ship-board" isOpen={isOpen} onRequestClose={onClose} size="md" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Ship className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">補給船告示板</h2>
        </div>
        <button type="button" onClick={close} title="關閉" aria-label="關閉"
          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="font-sans space-y-3.5 overflow-y-auto min-h-0 text-sm">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-100">{voyageCode(n)}</span>
            <span className={status.phase === 'docked' ? 'text-emerald-300' : status.delay ? 'text-amber-300' : 'text-sky-300'}>{headline(status)}</span>
          </div>
          <div className="text-[12px] text-slate-400">
            到港 {formatTime(arrival(n))}　離港 {formatTime(departure(n))}
            {status.delay > 0 && <span className="text-amber-300">　（原定晚 {status.delay} 天）</span>}
          </div>
          <div className="text-[12px] text-slate-500">之後每 7 日一班。下一班 {voyageCode(n + 1)}：照表 {formatTime(scheduledDay(n + 1) + SHIP.arriveHour / 24)}</div>
        </div>

        {cargo ? (
          <>
            <section>
              <h3 className="text-[12px] text-slate-400 mb-1.5 flex items-center gap-1"><Package className="w-3.5 h-3.5" />站上截留的貨</h3>
              <table className="w-full text-[13px]">
                <tbody>
                  {cargo.cargo.map((c) => (
                    <tr key={c.kind} className="border-t border-white/[0.06]">
                      <td className="py-1 text-slate-100">{CARGO[c.kind].name}</td>
                      <td className="py-1 text-slate-300">{c.crates} 箱</td>
                      <td className="py-1 text-right text-slate-400">送到{CARGO[c.kind].place}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="text-[12px] text-slate-400 mb-1.5">私人包裹（{cargo.parcels.length} 件）</h3>
              {cargo.parcels.length ? (
                <ul className="text-[13px] space-y-0.5">
                  {cargo.parcels.map((p) => <li key={p.id} className="text-slate-200">收件人 {p.recipientName}<span className="text-slate-500">・{p.sender}寄</span></li>)}
                </ul>
              ) : <p className="text-[12px] text-slate-500">這班沒有私人包裹。</p>}
            </section>

            <section>
              <h3 className="text-[12px] text-slate-400 mb-1.5">過境貨（在接駁口換船，不留在站上）</h3>
              <ul className="text-[13px] space-y-0.5 text-slate-300">
                {cargo.transit.map((t) => <li key={t.what}>{t.what}・{t.crates} 箱</li>)}
              </ul>
            </section>

            {cargo.visitors && <p className="text-[12px] text-sky-200 flex items-center gap-1"><Users className="w-3.5 h-3.5" />這班有幾位乘客或換班船員會下船走走。</p>}
            <p className="text-[12px] text-slate-500">貨卸在中央公園的塔底接駁口，可以去幫忙搬貨、領包裹送給收件人。</p>
          </>
        ) : (
          <p className="text-[12px] text-slate-500">貨單在照表到港日的前 {SHIP.previewDays} 天公布（{formatTime(scheduledDay(n) - SHIP.previewDays)}）。</p>
        )}
      </div>
    </ModalShell>
  );
}
