import React, { useState } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { sound } from '../../utils/sound';
import { GmProvider, PROVIDERS, isGmProvider, providerInfo } from '../../gm/models';
import { AiSettingsDraft } from '../../gm/settings';

/**
 * AI 供應商、金鑰、端點與模型的欄位組。GM 與助理共用。
 *
 * 兩邊原本各寫一份，結果 GM 支援多家供應商時，助理的模型清單還停在
 * Gemini —— 勾了「與 GM 相同」後，助理會拿 DeepSeek 的金鑰去配 Gemini 的模型。
 * 共用元件就是為了讓這種漂移不再發生。
 */
interface AiProviderFieldsProps {
  value: AiSettingsDraft;
  /** 以 updater 形式更新，確保連續更新依序套用。 */
  onChange: (update: (draft: AiSettingsDraft) => AiSettingsDraft) => void;
  /** 選定模型後，由外層收斂輸出上限。 */
  onModelChange?: (provider: GmProvider, model: string) => void;
  /** 供應商切換後，由外層收斂輸出上限。 */
  onProviderChange?: (provider: GmProvider) => void;
  /**
   * 鎖定為沿用另一組設定（助理勾選「與 GM 相同」）。
   * 供應商、金鑰與端點唯讀顯示這裡的值；模型仍從該供應商清單中自選。
   */
  locked?: { provider: GmProvider; apiKey: string };
}

const inputClass =
  'glass-input w-full rounded-xl px-3 py-2 text-xs font-mono bg-[#060b1c]/80 border border-white/[0.1] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400/50';
const lockedClass =
  'glass-input w-full rounded-xl px-3 py-2 text-xs font-mono bg-[#060b1c]/40 text-slate-500 border border-white/[0.05] cursor-not-allowed';
const selectClass =
  'w-full rounded-xl px-3 py-2 text-xs font-sans bg-[#060b1c]/90 border border-white/[0.1] text-slate-100 focus:outline-none focus:border-sky-400/50';

export default function AiProviderFields({
  value,
  onChange,
  onModelChange,
  onProviderChange,
  locked,
}: AiProviderFieldsProps) {
  const [showKey, setShowKey] = useState(false);
  const provider = locked?.provider ?? value.provider;
  const info = providerInfo(provider);
  const apiKey = locked ? locked.apiKey : value.keys[provider];
  const model = value.models[provider];

  const setModel = (next: string) => {
    onChange((d) => ({ ...d, models: { ...d.models, [provider]: next } }));
    onModelChange?.(provider, next);
  };

  return (
    <>
      {/* 供應商 */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-300">供應商</label>
        <select
          value={provider}
          disabled={!!locked}
          onChange={(e) => {
            const next = e.target.value;
            if (!isGmProvider(next)) return;
            sound.playBlip();
            onChange((d) => ({ ...d, provider: next }));
            onProviderChange?.(next);
          }}
          className={`${selectClass} ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {PROVIDERS.map((option) => (
            <option key={option.id} value={option.id} className="bg-[#070e24] text-slate-200">
              {option.name}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-300">{info.name} API Key</label>
        <div className="relative">
          <input
            type={showKey && !locked ? 'text' : 'password'}
            value={apiKey}
            disabled={!!locked}
            onChange={(e) => {
              const next = e.target.value;
              onChange((d) => ({ ...d, keys: { ...d.keys, [provider]: next } }));
            }}
            placeholder={locked ? '沿用 GM AI 的 API Key' : '輸入 API Key'}
            className={`${locked ? lockedClass : inputClass} pr-9`}
          />
          {!locked && (
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {!locked && (
          <p className="text-[12px] text-center leading-relaxed font-sans pt-0.5 text-slate-400">
            API Key 只存在本機瀏覽器，不會上傳；各供應商的金鑰分開保存。
            {info.keyUrl && (
              <>
                {' '}取得：{' '}
                <a
                  href={info.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-0.5 font-mono font-bold"
                >
                  <span>{info.keyUrl.replace('https://', '')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>
        )}
      </div>

      {/* 端點網址：只有自己選「自訂端點」時出現；沿用 GM 時用 GM 的端點 */}
      {provider === 'custom' && !locked && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-300">端點網址</label>
          <input
            type="text"
            value={value.endpoint}
            onChange={(e) => {
              const next = e.target.value;
              onChange((d) => ({ ...d, endpoint: next }));
            }}
            placeholder="例如 https://openrouter.ai/api/v1"
            className={inputClass}
          />
          <p className="text-[12px] leading-relaxed font-sans pt-0.5 text-slate-400">
            任何 OpenAI 相容端點皆可。對話內容會經過該服務，請自行評估；
            且該端點需允許瀏覽器直接呼叫（CORS）。
          </p>
        </div>
      )}

      {/* 模型選擇 */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-300">模型選擇</label>
        {info.models ? (
          <select
            value={model}
            onChange={(e) => {
              sound.playBlip();
              setModel(e.target.value);
            }}
            className={`${selectClass} cursor-pointer`}
          >
            {info.models.map((option) => (
              <option key={option.id} value={option.id} className="bg-[#070e24] text-slate-200">
                {option.name}
              </option>
            ))}
          </select>
        ) : (
          // 自訂端點有自己的模型命名，改為自由輸入。
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="例如 google/gemini-2.5-flash"
            className={inputClass}
          />
        )}
        {provider === 'deepseek' && (
          <p className="text-[12px] leading-relaxed font-sans pt-0.5 text-slate-400">
            已關閉 DeepSeek 的思考模式：回應較快，也不必為推理過程付費。
          </p>
        )}
      </div>
    </>
  );
}
