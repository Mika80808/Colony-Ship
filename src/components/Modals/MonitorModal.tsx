import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/sound';
import { Reading, Wing, logs, readings, trend } from '../../game/monitor';

interface MonitorModalProps {
  wing: Wing | null;
  onClose: () => void;
  /** 遊戲時間換算的天數（growth.dayNumber）。 */
  day: number;
  gameDate: string;
  gameTime: string;
}

const fmt = (r: { value: number }, digits: number) => r.value.toFixed(digits);
const W = 520, H = 140, PAD = { l: 36, r: 12, t: 12, b: 22 };

/** 選中讀數的 24 小時走勢：單一序列，標題即名稱，不放圖例；滑過顯示該時點數值。 */
function TrendChart({ wing, day, reading }: { wing: Wing; day: number; reading: Reading }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = trend(wing, day, reading.id);
  const values = pts.map(p => p.value);
  let lo = Math.min(...values, reading.range[0]), hi = Math.max(...values, reading.range[1]);
  const span = hi - lo || 1; lo -= span * .05; hi += span * .05;
  const x = (i: number) => PAD.l + i / (pts.length - 1) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const hp = hover === null ? null : pts[hover];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${reading.label}過去 24 小時走勢`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
          setHover(Math.max(0, Math.min(pts.length - 1, Math.round((px - PAD.l) / (W - PAD.l - PAD.r) * (pts.length - 1)))));
        }}>
        {/* 標準範圍：淡色帶，不搶線 */}
        <rect x={PAD.l} y={y(reading.range[1])} width={W - PAD.l - PAD.r} height={Math.max(0, y(reading.range[0]) - y(reading.range[1]))} fill="#34d39914" />
        {[lo + (hi - lo) * .1, (lo + hi) / 2, hi - (hi - lo) * .1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#ffffff14" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{v.toFixed(reading.digits > 1 ? 1 : 0)}</text>
          </g>
        ))}
        {[['-24 時', 0], ['-12 時', 12], ['現在', 24]].map(([label, i]) => (
          <text key={label} x={x(i as number)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 24 ? 'end' : 'middle'} fontSize="10" fill="#94a3b8">{label}</text>
        ))}
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(pts.at(-1)!.value)} r="4" fill="#38bdf8" stroke="#070e24" strokeWidth="2" />
        {hp && hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#ffffff40" />
          <circle cx={x(hover)} cy={y(hp.value)} r="4" fill="#38bdf8" stroke="#070e24" strokeWidth="2" />
        </>}
      </svg>
      {hp && hover !== null && (
        <div className="absolute top-0 pointer-events-none rounded-lg bg-[#0a1330] border border-white/[0.12] px-2 py-1 text-xs text-slate-200 shadow"
          style={{ left: `${Math.min(80, x(hover) / W * 100)}%` }}>
          {hover === 24 ? '現在' : `${24 - hover} 小時前`}：{fmt(hp, reading.digits)} {reading.unit}
        </div>
      )}
    </div>
  );
}

/**
 * 溫室植栽監測機（左翼／右翼）：六項讀數、24 小時走勢、今日系統紀錄。
 * 目前是介面草稿，數值由 game/monitor.ts 依遊戲時間模擬。
 */
export default function MonitorModal({ wing, onClose, day, gameDate, gameTime }: MonitorModalProps) {
  const [selected, setSelected] = useState('temp');
  const close = () => { sound.playClick(); onClose(); };
  const list = wing ? readings(wing, day) : [];
  const warnings = list.filter(r => r.status === 'warning');
  const current = list.find(r => r.id === selected) ?? list[0];
  return (
    <ModalShell id="modal-monitor" isOpen={wing !== null} onRequestClose={onClose} size="md" className="overflow-hidden">
      <div className="pb-3 border-b border-white/[0.08] mb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-bold text-slate-100 font-sans">植栽監測機・{wing === 'right' ? '右翼' : '左翼'}</h2>
          <span className="text-xs text-slate-400 font-sans">星曆 {gameDate} {gameTime}</span>
        </div>
        <button type="button" onClick={close} title="關閉" aria-label="關閉"
          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      {wing && current && (
        <div className="overflow-y-auto pr-0.5 font-sans space-y-3">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border ${warnings.length ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`}>
            {warnings.length ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {warnings.length ? `需注意：${warnings.map(r => r.label).join('、')}超出標準範圍` : '運作正常：所有讀數都在標準範圍內'}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {list.map((r) => (
              <button key={r.id} type="button" onClick={() => { sound.playClick(); setSelected(r.id); }} aria-pressed={r.id === current.id}
                className={`text-left rounded-xl p-2.5 border transition-colors cursor-pointer ${r.id === current.id ? 'border-sky-400/60 bg-sky-400/10' : 'border-white/[0.08] bg-[#0a1330]/80 hover:bg-white/[0.06]'}`}>
                <div className="text-xs text-slate-400">{r.label}</div>
                <div className="text-lg font-semibold text-slate-100 tabular-nums">{fmt(r, r.digits)}<span className="text-xs font-normal text-slate-400 ml-1">{r.unit}</span></div>
                <div className={`flex items-center gap-1 text-[11px] ${r.status === 'good' ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {r.status === 'good' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {r.status === 'good' ? '正常' : '偏離'}
                  <span className="text-slate-500">・標準 {r.range[0]}–{r.range[1]}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0a1330]/80 p-3">
            <div className="text-xs text-slate-300 mb-1">{current.label}・過去 24 小時{current.unit && `（${current.unit}）`}</div>
            <TrendChart wing={wing} day={day} reading={current} />
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0a1330]/80 p-3">
            <div className="text-xs text-slate-300 mb-1.5">今日系統紀錄</div>
            {logs(wing, day).length ? (
              <ul className="space-y-1 text-sm">
                {logs(wing, day).map((l) => (
                  <li key={l.time + l.text} className="flex gap-3"><span className="text-slate-500 tabular-nums">{l.time}</span><span className="text-slate-200">{l.text}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">今天還沒有紀錄。</p>}
          </div>
          <p className="text-[11px] text-slate-500">介面草稿：數值為模擬資料。</p>
        </div>
      )}
    </ModalShell>
  );
}
