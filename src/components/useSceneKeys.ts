import { useEffect, useRef } from 'react';

/** 場景共用的鍵盤輸入。目前只支援 WASD 移動＋E 互動（方向鍵之後再補）。
 *
 * 統一處理：大小寫正規化、Ctrl/Alt/Meta 放行、preventDefault、
 * 暫停與失焦（視窗 blur、分頁切走、canvas blur）時清空按鍵。
 * 場景專屬行為用 callback 接：onInteract（按 E）、onMovementDown（每次移動鍵
 * keydown，含長按重複）、onMovementPress（第一次按下，dx/dy 為 -1/0/1）。 */
export const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd']);
export const normalizeKey = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

interface Options {
  paused: boolean;
  /** 場景額外的停用條件（例如走廊的進門動畫）；回傳 true 時忽略按鍵。 */
  disabled?: () => boolean;
  onInteract?: () => void;
  onMovementDown?: (key: string) => void;
  onMovementPress?: (key: string, dx: number, dy: number) => void;
}

export function useSceneKeys(opts: Options) {
  const keys = useRef(new Set<string>());
  const latest = useRef(opts);
  latest.current = opts;
  useEffect(() => { if (opts.paused) keys.current.clear(); }, [opts.paused]);
  useEffect(() => {
    const clear = () => keys.current.clear();
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => { window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);
  /** 目前按住的方向（-1/0/1），給每幀的移動計算用。 */
  const axis = () => ({
    dx: Number(keys.current.has('d')) - Number(keys.current.has('a')),
    dy: Number(keys.current.has('s')) - Number(keys.current.has('w')),
  });
  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = normalizeKey(e.key);
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!MOVEMENT_KEYS.has(key) && key !== 'e') return;
    e.preventDefault(); e.stopPropagation();
    const o = latest.current;
    if (o.paused || o.disabled?.()) return;
    if (key === 'e') { if (!e.repeat) o.onInteract?.(); return; }
    o.onMovementDown?.(key);
    if (!keys.current.has(key)) o.onMovementPress?.(key, key === 'd' ? 1 : key === 'a' ? -1 : 0, key === 's' ? 1 : key === 'w' ? -1 : 0);
    keys.current.add(key);
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    const key = normalizeKey(e.key);
    if (!MOVEMENT_KEYS.has(key)) return;
    e.preventDefault(); e.stopPropagation();
    keys.current.delete(key);
  };
  const onBlur = () => keys.current.clear();
  return { keys, axis, onKeyDown, onKeyUp, onBlur };
}
