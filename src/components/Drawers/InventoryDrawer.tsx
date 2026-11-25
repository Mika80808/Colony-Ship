import React, { useState, useEffect } from 'react';
import {
  Package, FlaskConical, Carrot, Sprout, Gift, Armchair, Wrench, KeyRound, Shapes, Trash2, Zap, ArrowDownAZ, Coins,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ITEM_CATEGORIES, InventoryItem, ItemCategory, ItemDefinition } from '../../types';
import { canDrop, canGift, canUse, countOf, effectLabel } from '../../game/inventory';
import { sound } from '../../utils/audio';

interface InventoryDrawerProps {
  isOpen: boolean;
  /** 背包的每一格，順序就是格子順序。同一種物品可能佔好幾格。 */
  items: InventoryItem[];
  /** 背包總格數。 */
  slots: number;
  /** 在場、可以送禮的對象。 */
  giftTargets: { id: string; name: string }[];
  /** GM 正在回應：要經過 GM 的操作（送禮、沒有固定效果的使用）先不能按，免得按了沒反應。 */
  busy?: boolean;
  onUse: (index: number) => void;
  onGift: (index: number, npcId: string) => void;
  onDrop: (index: number, all: boolean) => void;
  onSort: () => void;
  /** 特殊物品（包裹）的額外操作；hideUse 表示不顯示「使用」。 */
  special?: (item: InventoryItem, index: number) => { hideUse?: boolean; actions: SpecialAction[] } | null;
}

export interface SpecialAction { id: string; label: string; disabled?: boolean; title?: string; onClick: () => void }

/** 物品沒有圖示（或圖載不出來）時，依分類顯示的預設圖示。 */
const CATEGORY_ICON: Record<ItemCategory, typeof Package> = {
  消耗品: FlaskConical, 食材: Carrot, 種子: Sprout, 禮物: Gift, 家具: Armchair, 裝備: Wrench, 任務物品: KeyRound, 其他: Shapes,
};

const COLUMNS = 5;
type Filter = '全部' | ItemCategory;

function ItemIcon({ item, className }: { item: ItemDefinition; className: string }) {
  // 路徑打錯或圖還沒做好時退回分類圖示，不顯示破圖。
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.icon]);
  const Fallback = CATEGORY_ICON[item.category] ?? Package;
  if (item.iconFrame === 'seed-packet' && item.icon && !broken) {
    // 種子包裝（暫代，正式圖見 docs/tasks/2026-11-23-seed-packets.md）：牛皮紙種子袋、上緣折口，中間印成熟作物
    return (
      <span className={`${className} relative flex items-center justify-center`} aria-hidden="true">
        <span className="absolute inset-x-[12%] inset-y-[4%] rounded-[3px] bg-[#c9a56a] border border-[#7a5a2e] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)]" />
        <span className="absolute inset-x-[12%] top-[4%] h-[16%] rounded-t-[3px] bg-[#a8834a] border border-[#7a5a2e] border-b-[#6b4d24]" />
        <span className="absolute inset-x-[22%] top-[28%] bottom-[14%] rounded-[2px] bg-[#f3e6c4]" />
        <img
          src={item.icon}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="relative w-[52%] h-[52%] mt-[14%] object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </span>
    );
  }
  return item.icon && !broken ? (
    <img
      src={item.icon}
      alt=""
      draggable={false}
      onError={() => setBroken(true)}
      className={`${className} object-contain`}
      style={{ imageRendering: 'pixelated' }}
    />
  ) : (
    <Fallback className={`${className} p-1 text-sky-300`} />
  );
}

export default function InventoryDrawer({
  isOpen, items, slots, giftTargets, busy = false, onUse, onGift, onDrop, onSort, special,
}: InventoryDrawerProps) {
  // 記格子位置和物品 id：用掉最後一個之後，同一個位置會換成下一格的東西，不該跟著選到它。
  const [selected, setSelected] = useState<{ index: number; id: string } | null>(null);
  const [filter, setFilter] = useState<Filter>('全部');
  const [choosingTarget, setChoosingTarget] = useState(false);

  useEffect(() => {
    if (!isOpen) { setSelected(null); setChoosingTarget(false); }
  }, [isOpen]);

  const selectedItem = selected && items[selected.index]?.id === selected.id ? items[selected.index] : null;
  useEffect(() => { setChoosingTarget(false); }, [selected?.index, selected?.id]);

  // 分頁只列背包裡有的分類；剩一種時不必分頁。
  const present = ITEM_CATEGORIES.filter((category) => items.some((item) => item.category === category));
  const activeFilter: Filter = filter !== '全部' && present.includes(filter) ? filter : '全部';
  const visible = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => activeFilter === '全部' || item.category === activeFilter);
  // 「全部」畫出整個背包（含空格）；分類檢視只補到整列。
  const emptyCells = activeFilter === '全部'
    ? Math.max(0, slots - items.length)
    : (COLUMNS - (visible.length % COLUMNS)) % COLUMNS || (visible.length ? 0 : COLUMNS);

  const select = (index: number, id: string) => {
    sound.playClick();
    setSelected((prev) => (prev?.index === index && prev.id === id ? null : { index, id }));
  };

  const extra = selectedItem && selected ? special?.(selectedItem, selected.index) ?? null : null;
  const usable = selectedItem ? canUse(selectedItem) && !extra?.hideUse && !(busy && !selectedItem.effect) : false;
  const giftable = selectedItem ? canGift(selectedItem) && giftTargets.length > 0 && !busy : false;
  const droppable = selectedItem ? canDrop(selectedItem) : false;
  const label = selectedItem ? effectLabel(selectedItem) : '';

  const actionButton = 'flex-1 py-1.5 px-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="drawer-inventory"
          onClick={() => setSelected(null)}
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 18, stiffness: 150, mass: 0.8, restDelta: 0.001 }}
          className="side-drawer fixed top-[66px] h-[calc(100vh-80px)] left-[136px] z-50 w-80 max-w-[calc(100vw-150px)] glass-panel bg-[#070e24]/95 p-6 flex flex-col justify-between gap-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl border border-white/[0.12] overflow-y-auto origin-left"
        >
          <div>
            {/* 標題列：格數與整理 */}
            <div className="pb-3 border-b border-white/[0.08] mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold text-slate-100 font-sans">道具</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={items.length < 2}
                  onClick={(e) => { e.stopPropagation(); sound.playClick(); setSelected(null); onSort(); }}
                  className="h-6 px-2 rounded bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] text-[12px] text-slate-200 flex items-center gap-1 transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                  title="同一種併在一起，照分類排好"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span>整理</span>
                </button>
                <span className="font-hud text-xs text-sky-300 font-bold px-2 py-0.5 rounded bg-sky-950/50 border border-sky-500/30">
                  {items.length}/{slots}
                </span>
              </div>
            </div>

            {/* 分類分頁 */}
            {present.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-3" onClick={(e) => e.stopPropagation()}>
                {(['全部', ...present] as Filter[]).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => { sound.playClick(); setFilter(category); setSelected(null); }}
                    className={`h-6 px-2 rounded-full text-[12px] font-semibold border transition cursor-pointer ${
                      activeFilter === category
                        ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {/* 格子 */}
            <div className="grid grid-cols-5 gap-2">
              {visible.map(({ item, index }) => {
                const isSelected = selectedItem !== null && selected?.index === index;
                return (
                  <button
                    key={`${index}-${item.id}`}
                    type="button"
                    id={`inventory-slot-${index}`}
                    onClick={(e) => { e.stopPropagation(); select(index, item.id); }}
                    title={item.name}
                    aria-label={`${item.name}，${item.count} 個`}
                    aria-pressed={isSelected}
                    className={`aspect-square rounded-lg border flex items-center justify-center relative cursor-pointer group transition-all duration-150 ${
                      isSelected
                        ? 'border-sky-400 bg-sky-500/20 shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                        : 'border-white/[0.1] bg-white/[0.04] hover:border-sky-400/50 hover:bg-white/[0.08]'
                    }`}
                  >
                    <ItemIcon item={item} className="w-8 h-8 transition-transform group-hover:scale-110" />
                    {item.count > 1 && (
                      <span className="absolute bottom-0 right-0.5 font-hud text-[12px] leading-4 font-bold text-slate-100 [text-shadow:0_0_3px_#000,0_0_3px_#000]">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
              {Array.from({ length: emptyCells }).map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square rounded-lg border border-dashed border-white/[0.06] bg-white/[0.01]" />
              ))}
            </div>
          </div>

          {/* 選取物品的說明與操作 */}
          <div onClick={(e) => e.stopPropagation()}>
            {selectedItem ? (
              <motion.div
                key={`${selected!.index}-${selectedItem.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-black/30 border border-white/[0.08] flex items-center justify-center">
                    <ItemIcon item={selectedItem} className="w-9 h-9" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-100 truncate">{selectedItem.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px]">
                      <span className="text-sky-300">{selectedItem.category}</span>
                      <span className="text-slate-400 font-hud">持有 {countOf(items, selectedItem.id)}</span>
                    </div>
                  </div>
                </div>

                {label && <div className="text-[12px] text-emerald-400 font-semibold">{label}</div>}
                {selectedItem.description && (
                  <p className="text-[12px] text-slate-300 leading-relaxed">{selectedItem.description}</p>
                )}
                {selectedItem.price !== undefined && (
                  <div className="flex items-center gap-1 text-[12px] text-slate-400">
                    <Coins className="w-3 h-3 text-amber-300" />
                    <span>參考價 {selectedItem.price} 星幣</span>
                  </div>
                )}

                <div className="flex gap-1.5 pt-0.5">
                  <button
                    type="button"
                    disabled={!usable}
                    onClick={() => { sound.playSuccess(); onUse(selected!.index); }}
                    className={`${actionButton} bg-sky-500/25 hover:bg-sky-500 text-sky-200 hover:text-white disabled:hover:bg-sky-500/25 disabled:hover:text-sky-200`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>使用</span>
                  </button>
                  <button
                    type="button"
                    disabled={!giftable}
                    title={!canGift(selectedItem) ? '任務物品不能送人' : giftTargets.length ? undefined : '這裡沒有可以送的人'}
                    onClick={() => {
                      if (giftTargets.length === 1) { sound.playSuccess(); onGift(selected!.index, giftTargets[0].id); }
                      else { sound.playClick(); setChoosingTarget((prev) => !prev); }
                    }}
                    className={`${actionButton} bg-amber-500/25 hover:bg-amber-500 text-amber-200 hover:text-white disabled:hover:bg-amber-500/25 disabled:hover:text-amber-200`}
                  >
                    <Gift className="w-3 h-3" />
                    <span>贈送</span>
                  </button>
                  <button
                    type="button"
                    disabled={!droppable}
                    title={droppable ? undefined : '任務物品不能丟'}
                    onClick={() => { sound.playClick(); onDrop(selected!.index, false); }}
                    className={`${actionButton} bg-rose-500/25 hover:bg-rose-500 text-rose-200 hover:text-white disabled:hover:bg-rose-500/25 disabled:hover:text-rose-200`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>丟棄</span>
                  </button>
                </div>

                {extra && extra.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {extra.actions.map((action) => (
                      <button key={action.id} type="button" id={`inventory-action-${action.id}`} disabled={action.disabled} title={action.title}
                        onClick={() => { sound.playSuccess(); action.onClick(); }}
                        className={`${actionButton} flex-none bg-emerald-500/20 hover:bg-emerald-500/45 text-emerald-100 disabled:hover:bg-emerald-500/20`}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* 在場不只一人時先選對象 */}
                {choosingTarget && giftable && (
                  <div className="flex flex-wrap gap-1.5">
                    {giftTargets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => { sound.playSuccess(); setChoosingTarget(false); onGift(selected!.index, target.id); }}
                        className="h-6 px-2 rounded-full text-[12px] font-semibold bg-amber-500/15 hover:bg-amber-500/40 border border-amber-400/40 text-amber-100 transition cursor-pointer"
                      >
                        送給{target.name}
                      </button>
                    ))}
                  </div>
                )}

                {droppable && selectedItem.count > 1 && (
                  <button
                    type="button"
                    onClick={() => { sound.playClick(); onDrop(selected!.index, true); }}
                    className="text-[12px] text-rose-300/80 hover:text-rose-200 underline underline-offset-2 cursor-pointer"
                  >
                    整格丟棄（{selectedItem.count} 個）
                  </button>
                )}
              </motion.div>
            ) : (
              <p className="text-[12px] text-slate-500 text-center py-2">
                {items.length ? '點一格查看物品。' : '背包是空的。'}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
