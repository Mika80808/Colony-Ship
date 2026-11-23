import React from 'react';
import { clearGameSave } from '../data/persistence';

interface State { error: Error | null; confirming: boolean }

/**
 * 最後一道防線：畫面在 render 時丟例外的話，React 會把整棵樹卸掉變成白屏。
 * 存檔讀入時已經逐欄檢查（data/persistence.ts 的 sanitizeSave），這裡接住沒料到的情況，
 * 告訴玩家發生了什麼，並讓他自己決定要重新整理還是清除存檔重來。
 */
export default class CrashScreen extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, confirming: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('畫面錯誤', error, info.componentStack);
  }

  render() {
    const { error, confirming } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#050814] text-slate-100 p-4">
        <div role="alert" className="max-w-md w-full rounded-2xl border border-white/[0.12] bg-[#070e24] p-5 space-y-3">
          <h1 className="text-base font-bold">畫面載入失敗</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            遊戲遇到無法處理的資料，多半是存檔內容損毀。可以先重新整理再試一次；仍然打不開時再清除存檔。
          </p>
          <p className="text-xs text-slate-500 break-all">{error.message}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => window.location.reload()}
              className="px-3 py-2 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-500/30 text-sm">重新整理</button>
            {confirming ? (
              <button type="button" onClick={() => { clearGameSave(); window.location.reload(); }}
                className="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 text-sm">確定清除（無法復原）</button>
            ) : (
              <button type="button" onClick={() => this.setState({ confirming: true })}
                className="px-3 py-2 rounded-lg bg-white/[0.04] text-slate-300 border border-white/[0.12] text-sm">清除存檔重來</button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
