import React, { useState } from 'react';
import { User, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerProfile } from '../../types';
import { sound } from '../../utils/audio';

interface ProfileDrawerProps {
  isOpen: boolean;
  profile: PlayerProfile;
  onSaveProfile: (profile: PlayerProfile) => void;
}

export default function ProfileDrawer({
  isOpen,
  profile,
  onSaveProfile,
}: ProfileDrawerProps) {
  const [formData, setFormData] = useState<PlayerProfile>(profile);
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playSuccess();
    onSaveProfile(formData);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="drawer-profile"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, x: 30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 30, scale: 0.95 }}
          transition={{
            type: "spring",
            damping: 18,
            stiffness: 150,
            mass: 0.8,
            restDelta: 0.001
          }}
          className="fixed top-[66px] h-[calc(100vh-80px)] right-4 sm:right-5 z-50 w-80 max-w-[calc(100vw-32px)] glass-panel bg-[#070e24]/95 p-6 flex flex-col justify-between shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl border border-white/[0.12] overflow-y-auto origin-right"
        >
      <div>
        <div className="pb-3 mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100 font-sans">個人資訊</h2>
          </div>
        </div>

        <form id="form-player-profile" onSubmit={handleSubmit} className="space-y-3 text-xs text-slate-300">
          {/* 姓名 */}
          <div>
            <label className="block text-slate-400 mb-1 text-[12px]">姓名</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full glass-input rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none"
              placeholder="請輸入姓名"
            />
          </div>

          {/* 性別 & 年齡 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-400 mb-1 text-[12px]">性別</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full glass-input rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none bg-[#0a1226]"
              >
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 text-[12px]">年齡</label>
              <input
                type="number"
                min={1}
                max={200}
                value={formData.age}
                onChange={(e) =>
                  setFormData({ ...formData, age: e.target.value })
                }
                placeholder="例如：24"
                className="w-full glass-input rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* 職業由劇情分發，玩家唯讀查看。 */}
          <div>
            <label className="block text-slate-400 mb-1 text-[12px]">職業（劇情分發）</label>
            <input
              type="text"
              value={formData.profession}
              readOnly
              className="w-full glass-input rounded-lg px-3 py-1.5 text-slate-400 text-xs focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* 外貌 */}
          <div>
            <label className="block text-slate-400 mb-1 text-[12px]">外貌</label>
            <input
              type="text"
              value={formData.appearance}
              onChange={(e) =>
                setFormData({ ...formData, appearance: e.target.value })
              }
              className="w-full glass-input rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none"
              placeholder="描述外貌特徵..."
            />
          </div>

          {/* 性格 */}
          <div>
            <label className="block text-slate-400 mb-1 text-[12px]">性格</label>
            <input
              type="text"
              value={formData.personality}
              onChange={(e) =>
                setFormData({ ...formData, personality: e.target.value })
              }
              className="w-full glass-input rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none"
              placeholder="描述性格..."
            />
          </div>

          {/* 其他 */}
          <div>
            <label className="block text-slate-400 mb-1 text-[12px]">其他</label>
            <textarea
              rows={2}
              value={formData.other}
              onChange={(e) =>
                setFormData({ ...formData, other: e.target.value })
              }
              className="w-full glass-input rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none resize-y min-h-[60px] max-h-[200px]"
              placeholder="備註與持有權限..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="btn-primary-neon w-full justify-center"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>已儲存</span>
                </>
              ) : (
                <span>儲存</span>
              )}
            </button>
          </div>
        </form>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
