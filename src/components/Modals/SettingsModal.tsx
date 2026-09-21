import React, { useState } from 'react';
import { 
  X, 
  Save, 
  Download, 
  Upload, 
  AlertTriangle, 
  Check, 
  ExternalLink,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Sliders,
  Settings,
  Bot,
  Database,
  LogOut,
  FolderArchive,
  Sparkles
} from 'lucide-react';
import { sound } from '../../utils/sound';
import ModalShell from './ModalShell';
import {
  GEMINI_MODELS,
  DEFAULT_GM_MODEL,
  PROVIDERS,
  GmProvider,
  isGmProvider,
  isKnownGeminiModel,
  maxTokensFor,
  providerInfo,
  resolveModel,
} from '../../gm/models';
import { GmSettingsDraft, readGmSettingsDraft, writeGmSettings } from '../../gm/settings';

interface SettingsModalProps {
  isOpen?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onNewGame?: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen = true,
  isMuted = false,
  onToggleMute,
  onNewGame,
  onClose,
}) => {
  // 注意：不要在這裡提早 return。isOpen 由 ModalShell 判斷，
  // 否則下面的 useState 會被條件性略過，React 會因 hook 數量變動而報錯。

  // Token 級距定義 (最低從 2K 起跳)
  const TOKEN_STEPS = [2048, 4096, 8192, 16384, 32768, 65536, 131072];
  const TOKEN_LABELS = ['2K', '4K', '8K', '16K', '32K', '64K', '128K'];

  const parseStoredTokens = (val: string | null): number => {
    if (!val) return 4096;
    const num = parseInt(val, 10);
    if (isNaN(num)) return 4096;
    if (num < 2048) return 2048;
    return TOKEN_STEPS.reduce((prev, curr) => 
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
  };

  // GM AI
  // 設定的讀寫都經過 gm/settings.ts，這裡不直接碰 storage key。
  // 金鑰與模型依供應商分開保存：切換供應商時不會把 A 家的金鑰送去 B 家。
  const [gm, setGm] = useState<GmSettingsDraft>(() => {
    const draft = readGmSettingsDraft();
    return { ...draft, maxTokens: parseStoredTokens(String(draft.maxTokens)) };
  });
  const gmApiKey = gm.keys[gm.provider];
  const gmModel = gm.models[gm.provider];
  const gmEndpoint = gm.endpoint;
  const gmTokens = gm.maxTokens;
  const gmProviderInfo = providerInfo(gm.provider);
  const setGmApiKey = (value: string) =>
    setGm((d) => ({ ...d, keys: { ...d.keys, [d.provider]: value } }));
  const setGmModel = (value: string) =>
    setGm((d) => ({ ...d, models: { ...d.models, [d.provider]: value } }));
  const setGmEndpoint = (value: string) => setGm((d) => ({ ...d, endpoint: value }));
  const setGmTokens = (value: number | ((prev: number) => number)) =>
    setGm((d) => ({ ...d, maxTokens: typeof value === 'function' ? value(d.maxTokens) : value }));
  const [showGmKey, setShowGmKey] = useState<boolean>(false);

  // 助理 AI
  const [sameAsGm, setSameAsGm] = useState<boolean>(() => {
    return localStorage.getItem('starport_assistant_same_as_gm') === 'true';
  });
  const [assistantApiKey, setAssistantApiKey] = useState<string>(() => {
    return localStorage.getItem('starport_assistant_api_key') || '';
  });
  const [assistantModel, setAssistantModel] = useState<string>(() => {
    const stored = localStorage.getItem('starport_assistant_model') || '';
    return isKnownGeminiModel(stored) ? stored : DEFAULT_GM_MODEL;
  });
  const [assistantTokens, setAssistantTokens] = useState<number>(() => {
    return parseStoredTokens(localStorage.getItem('starport_assistant_tokens'));
  });
  const [showAssistantKey, setShowAssistantKey] = useState<boolean>(false);
  const [allowEmptySceneInteraction, setAllowEmptySceneInteraction] = useState<boolean>(() => localStorage.getItem('starport_empty_scene_interaction') !== 'false');
  const [passiveEventChance, setPassiveEventChance] = useState<number>(() => Number(localStorage.getItem('starport_passive_event_chance') || 0));

  // 最後自動儲存時間
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>(() => {
    return localStorage.getItem('starport_last_autosave') || new Date().toLocaleString('zh-TW', { hour12: false });
  });

  // 彈窗狀態
  const [showResetWarning, setShowResetWarning] = useState<boolean>(false);
  const [showSaveSlotModal, setShowSaveSlotModal] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const triggerStatus = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 2500);
  };

  // 模型選項
  const modelOptions = GEMINI_MODELS;

  const stepsFor = (model: string) => TOKEN_STEPS.filter((step) => step <= (modelOptions.find((option) => option.id === model)?.maxTokens ?? 4096));
  // 自訂端點無從得知上限，開放全部級距，由玩家依該服務的規格自行調整。
  const stepsForGm = (provider: GmProvider, model: string) => {
    const max = maxTokensFor(provider, model);
    return max === null ? TOKEN_STEPS : TOKEN_STEPS.filter((step) => step <= max);
  };
  const gmSteps = stepsForGm(gm.provider, gmModel);
  const switchGmProvider = (provider: GmProvider) =>
    setGm((d) => ({
      ...d,
      provider,
      maxTokens: Math.min(d.maxTokens, Math.max(...stepsForGm(provider, d.models[provider]))),
    }));
  const assistantSteps = stepsFor(assistantModel);
  const gmStepIndex = Math.max(0, gmSteps.indexOf(gmTokens));
  const assistantStepIndex = Math.max(0, assistantSteps.indexOf(assistantTokens));

  // 儲存設定
  const handleSaveSettings = () => {
    sound.playSuccess();
    writeGmSettings(gm);
    localStorage.setItem('starport_assistant_same_as_gm', sameAsGm.toString());
    localStorage.setItem('starport_assistant_api_key', sameAsGm ? gmApiKey : assistantApiKey);
    localStorage.setItem('starport_assistant_model', assistantModel);
    localStorage.setItem('starport_assistant_tokens', assistantTokens.toString());
    localStorage.setItem('starport_empty_scene_interaction', allowEmptySceneInteraction.toString());
    localStorage.setItem('starport_passive_event_chance', passiveEventChance.toString());
    
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });
    localStorage.setItem('starport_last_autosave', nowStr);
    setLastAutoSaveTime(nowStr);

    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  // 匯出存檔
  const handleExportSave = () => {
    sound.playClick();
    const saveData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      gmConfig: { provider: gm.provider, model: gmModel, maxTokens: gmTokens },
      assistantConfig: { sameAsGm, model: assistantModel, maxTokens: assistantTokens },
      lastAutoSave: lastAutoSaveTime,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(saveData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `save_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 匯入存檔
  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sound.playSuccess();
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        // 先切供應商再設模型：setGm 的 updater 依序套用，模型才會存進正確的供應商。
        if (isGmProvider(parsed.gmConfig?.provider)) switchGmProvider(parsed.gmConfig.provider);
        if (parsed.gmConfig?.model) {
          const model = String(parsed.gmConfig.model);
          setGm((d) => ({ ...d, models: { ...d.models, [d.provider]: resolveModel(d.provider, model) } }));
        }
        if (parsed.gmConfig?.maxTokens) setGmTokens(parseStoredTokens(parsed.gmConfig.maxTokens.toString()));
        else if (parsed.gmConfig?.tokenRatio) setGmTokens(parseStoredTokens(parsed.gmConfig.tokenRatio.toString()));
        if (parsed.assistantConfig?.model) setAssistantModel(parsed.assistantConfig.model);
        if (parsed.assistantConfig?.maxTokens) setAssistantTokens(parseStoredTokens(parsed.assistantConfig.maxTokens.toString()));
        else if (parsed.assistantConfig?.tokenRatio) setAssistantTokens(parseStoredTokens(parsed.assistantConfig.tokenRatio.toString()));
        if (parsed.lastAutoSave) setLastAutoSaveTime(parsed.lastAutoSave);
        triggerStatus('存檔已成功匯入');
      } catch {
        triggerStatus('存檔格式錯誤');
      }
    };
    reader.readAsText(file);
  };

  // 點遮罩或按 Esc 時，若有次級對話框開著就先收次級，不要一次關掉整個設定。
  const handleRequestClose = () => {
    if (showResetWarning) {
      setShowResetWarning(false);
      return;
    }
    if (showSaveSlotModal) {
      setShowSaveSlotModal(false);
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      id="modal-settings"
      isOpen={isOpen}
      onRequestClose={handleRequestClose}
      size="sm"
      className="overflow-hidden"
    >
      <>

        {/* 標題欄 */}
        <div className="pb-3 border-b border-white/[0.08] mb-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100 font-sans">
              系統設定
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] transition-colors cursor-pointer"
            title="關閉"
            aria-label="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 設定內容 */}
        <div className="overflow-y-auto space-y-3.5 font-sans pr-0.5">
          
          {/* ================= 系統偏好 (主題與音效開關) ================= */}
          <div className="glass-card bg-[#0a1330]/80 rounded-xl p-3.5 space-y-3 border border-white/[0.08]">
            {/* 音效開關 */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200">音效開關</span>
              </div>
              <div className="flex items-center gap-1 bg-black/30 border border-white/[0.06] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    if (isMuted) onToggleMute?.();
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                    !isMuted
                      ? 'bg-sky-700/80 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  開啟
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isMuted) onToggleMute?.();
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-sans transition-all cursor-pointer ${
                    isMuted
                      ? 'bg-sky-700/80 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]'
                  }`}
                >
                  靜音
                </button>
              </div>
            </div>

            {/*
              介面主題切換已移除。theme state 是死的：切換後只有這裡的圖示會變，
              全 App 沒有任何地方讀它，Tailwind 也沒有對應的亮色樣式。
              需要亮色時再一併實作樣式與這個控制項。
            */}
          </div>

          {/* ================= GM AI 引擎 ================= */}
          <div className="glass-card bg-[#0a1330]/80 rounded-xl p-3.5 space-y-3 border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-slate-100">GM AI 引擎</span>
            </div>

            {/* 供應商 */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                供應商
              </label>
              <select
                value={gm.provider}
                onChange={(e) => {
                  sound.playBlip();
                  if (isGmProvider(e.target.value)) switchGmProvider(e.target.value);
                }}
                className="w-full rounded-xl px-3 py-2 text-xs cursor-pointer font-sans bg-[#060b1c]/90 border border-white/[0.1] text-slate-100 focus:outline-none focus:border-sky-400/50"
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id} className="bg-[#070e24] text-slate-200">
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                {gmProviderInfo.name} API Key
              </label>
              <div className="relative">
                <input
                  type={showGmKey ? 'text' : 'password'}
                  value={gmApiKey}
                  onChange={(e) => setGmApiKey(e.target.value)}
                  placeholder="輸入 API Key"
                  className="glass-input w-full rounded-xl px-3 py-2 pr-9 text-xs transition-all font-mono bg-[#060b1c]/80 border border-white/[0.1] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
                />
                <button
                  type="button"
                  onClick={() => setShowGmKey(!showGmKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showGmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* 提示字 */}
              <p className="text-[12px] text-center leading-relaxed font-sans pt-0.5 text-slate-400">
                API Key 只存在本機瀏覽器，不會上傳；各供應商的金鑰分開保存。
                {gmProviderInfo.keyUrl && (
                  <>
                    {' '}取得：{' '}
                    <a
                      href={gmProviderInfo.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-0.5 font-mono font-bold"
                    >
                      <span>{gmProviderInfo.keyUrl.replace('https://', '')}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                )}
              </p>
            </div>

            {/* 端點網址：只有選「自訂端點」時出現 */}
            {gm.provider === 'custom' && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  端點網址
                </label>
                <input
                  type="text"
                  value={gmEndpoint}
                  onChange={(e) => setGmEndpoint(e.target.value)}
                  placeholder="例如 https://openrouter.ai/api/v1"
                  className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono bg-[#060b1c]/80 border border-white/[0.1] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
                />
                <p className="text-[12px] leading-relaxed font-sans pt-0.5 text-slate-400">
                  任何 OpenAI 相容端點皆可。對話內容會經過該服務，請自行評估；
                  且該端點需允許瀏覽器直接呼叫（CORS）。
                </p>
              </div>
            )}

            {/* 模型選擇 */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                模型選擇
              </label>
              {gmProviderInfo.models ? (
                <select
                  value={gmModel}
                  onChange={(e) => {
                    sound.playBlip();
                    const nextModel = e.target.value;
                    setGmModel(nextModel);
                    setGmTokens((value) => Math.min(value, Math.max(...stepsForGm(gm.provider, nextModel))));
                  }}
                  className="w-full rounded-xl px-3 py-2 text-xs cursor-pointer font-sans bg-[#060b1c]/90 border border-white/[0.1] text-slate-100 focus:outline-none focus:border-sky-400/50"
                >
                  {gmProviderInfo.models.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#070e24] text-slate-200">
                      {opt.name}
                    </option>
                  ))}
                </select>
              ) : (
                // 自訂端點有自己的模型命名，改為自由輸入。
                <input
                  type="text"
                  value={gmModel}
                  onChange={(e) => setGmModel(e.target.value)}
                  placeholder="例如 google/gemini-2.5-flash"
                  className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono bg-[#060b1c]/80 border border-white/[0.1] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-400/50"
                />
              )}
              {gm.provider === 'deepseek' && (
                <p className="text-[12px] leading-relaxed font-sans pt-0.5 text-slate-400">
                  已關閉 DeepSeek 的思考模式：GM 回應較快，也不必為推理過程付費。
                </p>
              )}
            </div>

            {/* Token 上限 */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Token 上限</span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {gmTokens.toLocaleString()} Tokens
                </span>
              </div>

              {/* 區間拉桿 */}
              <div className="relative pt-1 pb-0.5">
                <input
                  type="range"
                  min={0}
                  max={gmSteps.length - 1}
                  step={1}
                  value={gmStepIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setGmTokens(gmSteps[idx]);
                  }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-400 shadow-inner focus:outline-none transition-all"
                  style={{
                    background: `linear-gradient(to right, #38bdf8 0%, #0284c7 ${(gmStepIndex / Math.max(1, gmSteps.length - 1)) * 100}%, rgba(255,255,255,0.1) ${(gmStepIndex / Math.max(1, gmSteps.length - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />
                <div className="flex justify-between text-[12px] font-mono mt-1 px-0.5 text-slate-400">
                  {gmSteps.map((step) => (
                    <span key={step}>{step >= 1024 ? `${step / 1024}K` : step}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ================= 助理 AI ================= */}
          <div className="glass-card bg-[#0a1330]/80 rounded-xl p-3.5 space-y-3 border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-100">助理 AI</span>
            </div>

            {/* 使用與GM AI相同的API */}
            <label className="flex items-center space-x-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={sameAsGm}
                onChange={(e) => {
                  sound.playBlip();
                  setSameAsGm(e.target.checked);
                }}
                className="w-4 h-4 rounded text-sky-500 focus:ring-0 cursor-pointer accent-sky-500"
              />
              <span className="font-medium">使用與 GM AI 相同的 API Key</span>
            </label>

            {/* API Key */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                API Key
              </label>
              <div className="relative">
                <input
                  type={sameAsGm ? (showGmKey ? 'text' : 'password') : (showAssistantKey ? 'text' : 'password')}
                  value={sameAsGm ? gmApiKey : assistantApiKey}
                  onChange={(e) => setAssistantApiKey(e.target.value)}
                  disabled={sameAsGm}
                  placeholder={sameAsGm ? '使用與 GM AI 相同的 API Key' : '輸入 API Key'}
                  className={`glass-input w-full rounded-xl px-3 py-2 pr-9 text-xs transition-all font-mono border focus:outline-none ${
                    sameAsGm
                      ? 'bg-[#060b1c]/40 text-slate-500 border-white/[0.05] cursor-not-allowed'
                      : 'bg-[#060b1c]/80 text-slate-100 border-white/[0.1] placeholder-slate-500 focus:border-sky-400/50'
                  }`}
                />
                {!sameAsGm && (
                  <button
                    type="button"
                    onClick={() => setShowAssistantKey(!showAssistantKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showAssistantKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* 模型選擇 */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                模型選擇
              </label>
              <select
                value={assistantModel}
                onChange={(e) => {
                  sound.playBlip();
                  const nextModel = e.target.value;
                  setAssistantModel(nextModel);
                  setAssistantTokens((value) => Math.min(value, Math.max(...stepsFor(nextModel))));
                }}
                className="w-full rounded-xl px-3 py-2 text-xs cursor-pointer font-sans bg-[#060b1c]/90 border border-white/[0.1] text-slate-100 focus:outline-none focus:border-sky-400/50"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.id} value={opt.id} className="bg-[#070e24] text-slate-200">
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Token 上限 */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Token 上限</span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {assistantTokens.toLocaleString()} Tokens
                </span>
              </div>

              {/* 區間拉桿 */}
              <div className="relative pt-1 pb-0.5">
                <input
                  type="range"
                  min={0}
                  max={assistantSteps.length - 1}
                  step={1}
                  value={assistantStepIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    setAssistantTokens(assistantSteps[idx]);
                  }}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-400 shadow-inner focus:outline-none transition-all"
                  style={{
                    background: `linear-gradient(to right, #38bdf8 0%, #0284c7 ${(assistantStepIndex / Math.max(1, assistantSteps.length - 1)) * 100}%, rgba(255,255,255,0.1) ${(assistantStepIndex / Math.max(1, assistantSteps.length - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                  }}
                />
                <div className="flex justify-between text-[12px] font-mono mt-1 px-0.5 text-slate-400">
                  {assistantSteps.map((step) => (
                    <span key={step}>{step >= 1024 ? `${step / 1024}K` : step}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card bg-[#0a1330]/80 rounded-xl p-3.5 space-y-3 border border-white/[0.08]">
            <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-sky-400" /><span className="text-xs font-bold text-slate-100">互動設定</span></div>
            <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer"><span>空場互動 <span className="text-slate-500">（場景沒有 NPC 時仍可輸入行動）</span></span><input type="checkbox" checked={allowEmptySceneInteraction} onChange={(e) => setAllowEmptySceneInteraction(e.target.checked)} className="accent-sky-500" /></label>
            <label className="flex items-center justify-between gap-3 text-xs text-slate-300"><span>被動事件機率</span><select value={passiveEventChance} onChange={(e) => setPassiveEventChance(Number(e.target.value))} className="bg-[#060b1c] border border-white/[0.1] rounded px-2 py-1 text-slate-100"><option value={0}>0%</option><option value={10}>10%</option><option value={20}>20%</option></select></label>
          </div>

          {/* ================= 存檔與數據管理 ================= */}
          <div className="glass-card bg-[#0a1330]/80 rounded-xl p-3.5 space-y-3 border border-white/[0.08]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-100">存檔管理</span>
              </div>
              <div className="text-[12px] font-mono text-slate-400">
                最後儲存：{lastAutoSaveTime}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setShowSaveSlotModal(true);
                  }}
                  className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
                  <span>存檔槽</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSave}
                  className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>匯出</span>
                </button>

                <label className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer">
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>匯入</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSave}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  triggerStatus('已登出。');
                }}
                className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                title="登出帳號"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>登出</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {statusNotification && (
            <div className="py-1.5 px-3 rounded-lg bg-sky-950/80 border border-sky-400/40 text-sky-200 text-xs text-center font-sans animate-in fade-in">
              {statusNotification}
            </div>
          )}

          {/* ================= 底部操作列 (包含重置進度按鈕與儲存設定) ================= */}
          <div className="pt-2 pb-1 flex items-center justify-between gap-3">
            {/* 重置進度按鈕 */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setShowResetWarning(true);
              }}
              className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>重置進度</span>
            </button>

            {/* 儲存設定按鈕 (主色調按鈕) */}
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex-1 py-2 px-5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.35)] active:scale-98 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {saveSuccessMsg ? (
                <>
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                  <span>已儲存</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>儲存</span>
                </>
              )}
            </button>
          </div>

        </div>

      {/* ⚠️ 重置進度確認彈窗 */}
      {showResetWarning && (
        <div className="absolute inset-0 z-[60] bg-slate-950/80 blur-mid flex items-center justify-center p-4 rounded-2xl animate-in fade-in duration-150">
          <div className="glass-panel bg-[#070e24]/95 rounded-2xl p-5 max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.7)] border border-white/[0.12] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-slate-100 font-sans">
                確認重置進度？
              </h3>
              <p className="text-xs mt-2 leading-relaxed text-slate-300 font-sans">
                此動作將會清除當前所有任務進度、背包道具與對話狀態。
                <br />
                <span className="text-rose-400 font-bold">此動作無法復原！</span>
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetWarning(false)}
                className="flex-1 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-300 text-xs font-medium cursor-pointer transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playSuccess();
                  setShowResetWarning(false);
                  onNewGame?.();
                  onClose();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                確定重置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 存檔槽管理彈窗 */}
      {showSaveSlotModal && (
        <div className="absolute inset-0 z-[60] bg-slate-950/80 blur-mid flex items-center justify-center p-4 rounded-2xl animate-in fade-in duration-150">
          <div className="glass-panel bg-[#070e24]/95 rounded-2xl p-5 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.7)] border border-white/[0.12] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="font-bold text-sm text-slate-100 font-sans">
                存檔槽管理
              </div>
              <button
                type="button"
                onClick={() => setShowSaveSlotModal(false)}
                className="p-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white border border-white/[0.1] cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold flex items-center gap-1.5 text-slate-100 font-sans">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>存檔槽 01 (自動存檔)</span>
                  </div>
                  <div className="text-[12px] font-mono mt-1 text-slate-400">
                    {lastAutoSaveTime}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playSuccess();
                    setShowSaveSlotModal(false);
                  }}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm"
                >
                  讀取
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between opacity-60">
                <div>
                  <div className="text-xs font-bold text-slate-400 font-sans">存檔槽 02 (空白)</div>
                  <div className="text-[12px] text-slate-500 mt-0.5">無存檔紀錄</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    handleSaveSettings();
                  }}
                  className="px-3.5 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 rounded-xl text-xs font-medium cursor-pointer border border-white/[0.08]"
                >
                  儲存
                </button>
              </div>
            </div>

            <div className="text-right pt-1">
              <button
                type="button"
                onClick={() => setShowSaveSlotModal(false)}
                className="px-4 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-medium rounded-xl cursor-pointer border border-white/[0.08] transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    </ModalShell>
  );
};

export default SettingsModal;
