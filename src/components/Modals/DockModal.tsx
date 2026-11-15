import { useEffect, useState } from 'react';
import { ArrowDownToLine, Gift, Mail, Package, Truck, Undo2, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/audio';
import { CARGO, CargoKind } from '../../game/supplyShip';
import { Destination, FREIGHT, FreightState, PLAYER_ID, kindsFor, stockLevel, totalCrates } from '../../game/freight';

interface DockModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: FreightState;
  /** 玩家所在區域。在中央公園時可以直接把乾貨卸進餐廳進貨口。 */
  sectorId: string;
  onLoad: (kind: CargoKind) => void;
  onUnloadBack: (kind: CargoKind) => void;
  onDeliverHere: () => void;
  onPickParcel: (id: string) => void;
  /** 日序 → 「10/27 09:00」。 */
  formatTime: (day: number) => string;
  /** 補給船停靠中才收寄件；departs 是離港時間的說明。 */
  mail: { docked: boolean; departs: string; items: { id: string; name: string }[] };
  onSend: (destination: Destination, note: string, itemId: string) => void;
}

const KINDS = Object.keys(CARGO) as CargoKind[];
const LEVEL_CLASS = { 充足: 'text-emerald-300', 偏低: 'text-amber-300', 匱乏: 'text-rose-300' } as const;
const button = 'h-7 px-2.5 rounded-lg text-[12px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed border';

/** 塔底接駁口：補給船卸下的貨在這裡等人搬。裝上推車，走到目的區就自動卸貨。 */
export default function DockModal({ isOpen, onClose, freight, sectorId, onLoad, onUnloadBack, onDeliverHere, onPickParcel, formatTime, mail, onSend }: DockModalProps) {
  const [destination, setDestination] = useState<Destination>('月球');
  const [note, setNote] = useState('');
  const [attach, setAttach] = useState('');
  useEffect(() => { if (!isOpen) { setNote(''); setAttach(''); } }, [isOpen]);
  useEffect(() => { if (attach && !mail.items.some((item) => item.id === attach)) setAttach(''); }, [attach, mail.items]);
  const close = () => { sound.playClick(); onClose(); };
  const click = (run: () => void) => () => { sound.playClick(); run(); };
  const onCart = totalCrates(freight.cart), full = onCart >= FREIGHT.cartCrates;
  const here = kindsFor(sectorId).filter((k) => totalCrates(freight.cart, k));
  const oldest = (kind: CargoKind) => Math.min(...freight.dock.filter((lot) => lot.kind === kind).map((lot) => lot.arrived));

  return (
    <ModalShell id="modal-dock" isOpen={isOpen} onRequestClose={onClose} size="md" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">塔底接駁口</h2>
        </div>
        <button type="button" onClick={close} title="關閉" aria-label="關閉"
          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="font-sans space-y-3.5 overflow-y-auto min-h-0 text-[13px]">
        <section>
          <h3 className="text-[12px] text-slate-400 mb-1.5">等人搬的貨</h3>
          {freight.dock.length ? (
            <table className="w-full">
              <tbody>
                {KINDS.filter((k) => totalCrates(freight.dock, k)).map((k) => (
                  <tr key={k} className="border-t border-white/[0.06]">
                    <td className="py-1.5 text-slate-100">{CARGO[k].name}</td>
                    <td className="py-1.5 text-slate-300">{totalCrates(freight.dock, k)} 箱</td>
                    <td className="py-1.5 text-slate-400">送到{CARGO[k].place}</td>
                    <td className="py-1.5 text-slate-500 text-[12px]">{formatTime(oldest(k))} 到</td>
                    <td className="py-1.5 text-right">
                      <button type="button" disabled={full} onClick={click(() => onLoad(k))} id={`dock-load-${k}`}
                        className={`${button} ml-auto bg-sky-500/20 hover:bg-sky-500/45 border-sky-400/40 text-sky-100`}>
                        <Truck className="w-3.5 h-3.5" />裝一箱
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-[12px] text-slate-500">接駁口是空的。補給船到港後貨會卸在這裡。</p>}
        </section>

        <section>
          <h3 className="text-[12px] text-slate-400 mb-1.5 flex items-center gap-1"><Gift className="w-3.5 h-3.5" />私人包裹</h3>
          {freight.parcels?.length ? (
            <ul className="space-y-1">
              {freight.parcels.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-100 min-w-0 truncate">{p.recipientId === PLAYER_ID ? <span className="text-amber-200">給你的{p.sender}</span> : <>給{p.recipientName}</>}<span className="text-slate-500">・{p.recipientId === PLAYER_ID ? '' : `${p.sender}寄・`}{formatTime(p.arrived)} 到</span></span>
                  <button type="button" onClick={click(() => onPickParcel(p.id))} id={`dock-parcel-${p.id}`}
                    className={`${button} shrink-0 bg-amber-500/20 hover:bg-amber-500/45 border-amber-400/40 text-amber-100`}>領取</button>
                </li>
              ))}
            </ul>
          ) : <p className="text-[12px] text-slate-500">沒有等人領的包裹。</p>}
          <p className="mt-1.5 text-[12px] text-slate-500">領了會放進背包並成立任務。當面交給本人，或放進他房門口的收件格（到他住的居住區就能放），每件 {FREIGHT.parcelWage} 星幣。放了 {FREIGHT.parcelWaitDays} 天沒人領，自走運送車會自己送。</p>
        </section>

        <section className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-slate-400 flex items-center gap-1"><Truck className="w-3.5 h-3.5" />推車</span>
            <span className="font-hud text-xs text-sky-300">{onCart}/{FREIGHT.cartCrates} 箱</span>
          </div>
          {onCart ? (
            <ul className="space-y-1">
              {KINDS.filter((k) => totalCrates(freight.cart, k)).map((k) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-slate-100">{CARGO[k].name} {totalCrates(freight.cart, k)} 箱<span className="text-slate-500">・送到{CARGO[k].place}</span></span>
                  <button type="button" onClick={click(() => onUnloadBack(k))} className={`${button} bg-white/[0.05] hover:bg-white/[0.12] border-white/[0.1] text-slate-300`}>
                    <Undo2 className="w-3.5 h-3.5" />放回
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-[12px] text-slate-500">推車是空的。</p>}
          {here.length > 0 && (
            <button type="button" onClick={click(onDeliverHere)} id="dock-deliver-here"
              className={`${button} bg-emerald-500/25 hover:bg-emerald-500/50 border-emerald-400/40 text-emerald-100`}>
              <ArrowDownToLine className="w-3.5 h-3.5" />卸到{CARGO[here[0]].place}進貨口
            </button>
          )}
          <p className="text-[12px] text-slate-500">推著貨走到目的區就會自動卸貨，每箱工資 {FREIGHT.wagePerCrate} 星幣；整班船在離港前全部送完另有獎金。</p>
        </section>

        <section className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
          <h3 className="text-[12px] text-slate-400 flex items-center gap-1"><Mail className="w-3.5 h-3.5" />寄件箱</h3>
          {mail.docked ? (
            <>
              <div className="flex gap-1.5">
                <select value={destination} onChange={(e) => setDestination(e.target.value as Destination)} aria-label="寄到哪裡"
                  className="h-7 glass-input rounded-lg px-2 text-xs text-slate-100 bg-[#0a1226] focus:outline-none">
                  <option value="月球">寄回月球</option>
                  <option value="火星">寄去火星</option>
                </select>
                <select value={attach} onChange={(e) => setAttach(e.target.value)} aria-label="附上的東西"
                  className="h-7 flex-1 min-w-0 glass-input rounded-lg px-2 text-xs text-slate-100 bg-[#0a1226] focus:outline-none">
                  <option value="">不附東西</option>
                  {mail.items.map((item) => <option key={item.id} value={item.id}>附上 {item.name}</option>)}
                </select>
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 60))} placeholder="錄一段話給遠方的人（60 字內）" id="dock-mail-note"
                className="w-full h-8 glass-input rounded-lg px-2.5 text-xs text-slate-100 focus:outline-none" />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-slate-500">這班船{mail.departs}離港。月球的回信搭下一班，火星的要等兩班。</span>
                <button type="button" disabled={!note.trim()} id="dock-mail-send"
                  onClick={click(() => { onSend(destination, note, attach); setNote(''); setAttach(''); })}
                  className={`${button} shrink-0 bg-sky-500/20 hover:bg-sky-500/45 border-sky-400/40 text-sky-100`}>寄出</button>
              </div>
            </>
          ) : <p className="text-[12px] text-slate-500">補給船停靠時才收寄件。</p>}
          {(freight.outbox ?? []).length > 0 && (
            <ul className="text-[12px] text-slate-400 space-y-0.5">
              {freight.outbox!.map((l) => <li key={l.id}>寄給{l.destination}・「{l.note}」{l.itemName ? `・附上${l.itemName}` : ''}・等回信</li>)}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-[12px] text-slate-400 mb-1.5">各區存量</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map((k) => {
              const level = stockLevel(freight.stock[k]);
              return (
                <div key={k} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-300">{CARGO[k].place}・{CARGO[k].name}</span>
                  <span className={LEVEL_CLASS[level]}>{level}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </ModalShell>
  );
}
