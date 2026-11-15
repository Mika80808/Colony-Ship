import { Package } from 'lucide-react';

interface ParkStageProps {
  /** 接駁口有幾箱貨在等。 */
  waiting: number;
  onOpenDock: () => void;
}

/**
 * 中央公園（中央廣場）的暫時畫面：地圖還沒做（docs/scenes/plaza.md），先放幾個可以去的地方。
 * 地圖做好後，這些改成場景裡的互動點（塔底電梯旁的接駁口、餐廳進貨口……）。
 */
export default function ParkStage({ waiting, onOpenDock }: ParkStageProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="glass-panel bg-[#070e24]/80 rounded-2xl border border-white/[0.1] p-5 w-full max-w-sm space-y-3 font-sans">
        <div className="text-sm font-bold text-slate-100">中央公園</div>
        <p className="text-[12px] text-slate-400 leading-relaxed">廣場的地圖還在施工。中央塔底下是接駁口，補給船卸下的貨在那裡等人搬。</p>
        <button type="button" id="park-open-dock" onClick={onOpenDock}
          className="w-full h-10 rounded-xl bg-sky-500/20 hover:bg-sky-500/40 border border-sky-400/40 text-sky-100 text-[13px] font-bold flex items-center justify-center gap-2 transition cursor-pointer">
          <Package className="w-4 h-4" />塔底接駁口{waiting ? `（${waiting} 箱待運）` : ''}
        </button>
      </div>
    </div>
  );
}
