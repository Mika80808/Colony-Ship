import React, { useState, useEffect } from 'react';
import { Package, Coffee, KeyRound, Wrench, Shield, Sparkles, Gift, Trash2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../../types';
import { sound } from '../../utils/audio';

interface InventoryDrawerProps {
  isOpen: boolean;
  items: InventoryItem[];
  onUseItem: (item: InventoryItem) => void;
  onGiftItem?: (item: InventoryItem) => void;
  onDropItem?: (item: InventoryItem) => void;
}

export default function InventoryDrawer({
  isOpen,
  items,
  onUseItem,
  onGiftItem,
  onDropItem,
}: InventoryDrawerProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Reset selected item when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedItemId(null);
    }
  }, [isOpen]);

  const getItemIcon = (name: string) => {
    if (name.includes('咖啡') || name.includes('飲')) return Coffee;
    if (name.includes('卡') || name.includes('憑證')) return KeyRound;
    if (name.includes('工具') || name.includes('套件')) return Wrench;
    if (name.includes('防護') || name.includes('盾')) return Shield;
    return Sparkles;
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="drawer-inventory"
          onClick={() => setSelectedItemId(null)}
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -30, scale: 0.95 }}
          transition={{
            type: "spring",
            damping: 18,
            stiffness: 150,
            mass: 0.8,
            restDelta: 0.001
          }}
          className="fixed top-[66px] h-[calc(100vh-80px)] left-[136px] z-50 w-80 max-w-[calc(100vw-150px)] glass-panel bg-[#070e24]/95 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl border border-white/[0.12] overflow-y-auto origin-left"
        >
          <div>
            {/* Title */}
            <div className="pb-3 border-b border-white/[0.08] mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-sky-400" />
                <h2 className="text-base font-bold text-slate-100 font-sans">道具</h2>
              </div>
              <span className="font-hud text-xs text-sky-300 font-bold px-2 py-0.5 rounded bg-sky-950/50 border border-sky-500/30">
                {items.length}/20
              </span>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((item) => {
                const Icon = getItemIcon(item.name);
                const isSelected = selectedItemId === item.id;

                return (
                  <div
                    key={item.id}
                    id={`inventory-item-${item.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playClick();
                      setSelectedItemId((prev) => (prev === item.id ? null : item.id));
                    }}
                    className={`aspect-square glass-card rounded-xl p-2 flex flex-col items-center justify-center cursor-pointer group text-center relative transition-all duration-200 ${
                      isSelected
                        ? 'border-sky-400 bg-sky-500/15 shadow-[0_0_16px_rgba(56,189,248,0.35)] scale-[1.03]'
                        : 'hover:border-sky-400/50 hover:bg-white/[0.04]'
                    }`}
                    title={item.name}
                  >
                    <Icon className={`w-6 h-6 mb-1 transition-transform ${isSelected ? 'text-sky-300 scale-110' : 'text-sky-300 group-hover:scale-110'}`} />
                    <span className="text-[12px] font-semibold text-slate-200 truncate w-full">
                      {item.name}
                    </span>
                    <span className="text-[12px] text-emerald-400 font-hud font-bold">
                      {item.effectText}
                    </span>
                    {item.count > 1 && (
                      <span className="absolute top-1.5 right-1.5 font-hud text-[12px] text-slate-300 font-bold bg-white/[0.1] px-1 rounded">
                        x{item.count}
                      </span>
                    )}

                    {/* Pop-up Action Buttons: [使用、贈送、丟棄] */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.16, ease: 'easeOut' }}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute inset-0 z-20 bg-[#071129]/95 blur-mid rounded-xl p-1.5 flex flex-col justify-center gap-1 shadow-2xl border border-sky-400/60"
                        >
                          {/* 使用 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.playSuccess();
                              onUseItem(item);
                              setSelectedItemId(null);
                            }}
                            className="w-full py-0.5 px-1 rounded bg-sky-500/25 hover:bg-sky-500 text-sky-200 hover:text-white text-[12px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                            title="使用此道具"
                          >
                            <Zap className="w-2.5 h-2.5 text-sky-300" />
                            <span>使用</span>
                          </button>

                          {/* 贈送 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.playSuccess();
                              if (onGiftItem) {
                                onGiftItem(item);
                              } else {
                                onUseItem(item);
                              }
                              setSelectedItemId(null);
                            }}
                            className="w-full py-0.5 px-1 rounded bg-amber-500/25 hover:bg-amber-500 text-amber-200 hover:text-white text-[12px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                            title="贈送給當前NPC"
                          >
                            <Gift className="w-2.5 h-2.5 text-amber-300" />
                            <span>贈送</span>
                          </button>

                          {/* 丟棄 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.playClick();
                              if (onDropItem) {
                                onDropItem(item);
                              }
                              setSelectedItemId(null);
                            }}
                            className="w-full py-0.5 px-1 rounded bg-rose-500/25 hover:bg-rose-500 text-rose-200 hover:text-white text-[12px] font-bold flex items-center justify-center gap-1 transition shadow-sm cursor-pointer"
                            title="丟棄此道具"
                          >
                            <Trash2 className="w-2.5 h-2.5 text-rose-300" />
                            <span>丟棄</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Empty Inventory Slots */}
              {Array.from({ length: Math.max(0, 9 - items.length) }).map((_, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedItemId(null)}
                  className="aspect-square rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01]"
                />
              ))}
            </div>
          </div>

          {/* Selected Item Information Preview */}
          {selectedItem && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-100">{selectedItem.name}</span>
                <span className="text-[12px] text-sky-400 font-mono">{selectedItem.category}</span>
              </div>
              <p className="text-[12px] text-slate-300 leading-relaxed">
                {selectedItem.description}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
