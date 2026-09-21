import React, { useEffect } from 'react';

/**
 * 四個彈窗共用的尺寸標準。各彈窗只從這裡挑一級，不再各自硬寫 max-w。
 */
export type ModalSize = 'sm' | 'md' | 'lg';

const WIDTH_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-lg',
  md: 'max-w-xl',
  lg: 'max-w-4xl',
};

interface ModalShellProps {
  isOpen: boolean;
  /**
   * 使用者要求關閉時呼叫（點遮罩或按 Esc）。
   * 由各彈窗自行決定是直接關閉，還是先跳未儲存確認對話框。
   */
  onRequestClose: () => void;
  /**
   * 鎖定期間遮罩點擊與 Esc 皆無效，例如地圖的過場載入。
   */
  locked?: boolean;
  size?: ModalSize;
  /** true 時面板撐到標準高度；false 時依內容高度，但不超過上限。 */
  fillHeight?: boolean;
  id?: string;
  /** 附加在面板（非遮罩）上的類別。 */
  className?: string;
  children: React.ReactNode;
}

/**
 * 彈窗外框：遮罩、置中、尺寸、以及關閉手勢（點遮罩 / Esc）。
 * 地圖、故事書、日記、設定四者共用，避免各自漂移。
 */
export default function ModalShell({
  isOpen,
  onRequestClose,
  locked = false,
  size = 'md',
  fillHeight = false,
  id,
  className = '',
  children,
}: ModalShellProps) {
  useEffect(() => {
    if (!isOpen || locked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onRequestClose();
    };

    // App 的全域 Esc 只處理抽屜，彈窗一律由這裡負責，兩邊不會互相蓋掉。
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, locked, onRequestClose]);

  if (!isOpen) return null;

  return (
    <div
      id={id}
      className="fixed inset-0 z-50 modal-scrim flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={() => {
        if (!locked) onRequestClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`glass-panel bg-[#070e24]/95 rounded-2xl w-full ${WIDTH_CLASS[size]} ${
          fillHeight ? 'h-[85vh] max-h-[640px]' : 'max-h-[85vh]'
        } p-4 sm:p-5 relative flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/[0.12] animate-in zoom-in-95 duration-200 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
