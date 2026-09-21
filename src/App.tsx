import React, { useState, useEffect } from 'react';
import SceneLayer from './components/SceneLayer';
import RoomScene from './components/RoomScene';
import CorridorScene from './components/CorridorScene';
import HeaderHUD from './components/HeaderHUD';
import LeftSidebar, { Objective } from './components/LeftSidebar';
import DialogueSection from './components/DialogueSection';
import QuestDrawer from './components/Drawers/QuestDrawer';
import InventoryDrawer from './components/Drawers/InventoryDrawer';
import ProfileDrawer from './components/Drawers/ProfileDrawer';
import MapModal from './components/Modals/MapModal';
import StoryModal from './components/Modals/StoryModal';
import DiaryModal from './components/Modals/DiaryModal';
import SettingsModal from './components/Modals/SettingsModal';
import {
  DrawerType,
  ModalType,
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  ItemDefinition,
  NPCData,
  DiaryEntry,
  StoryChapter,
  MapSector,
  ToastMessage,
  DialogueTurn,
  GmCommand,
} from './types';
import {
  START_SECTOR_ID,
  INITIAL_STATS,
  EMPTY_PROFILE,
  INITIAL_PROFILE,
  INITIAL_QUESTS,
  INITIAL_ITEM_DEFINITIONS,
  INITIAL_INVENTORY,
  INITIAL_NPCS,
  INITIAL_DIALOGUE_HISTORY,
  INITIAL_CHAPTERS,
  INITIAL_DIARY_ENTRIES,
  INITIAL_SECTORS,
  INITIAL_AREA_MEMORIES,
  INITIAL_OBJECTIVES,
  INITIAL_SUMMARY,
  INITIAL_QUICK_REPLIES,
  GAME_START_DATE,
  GAME_START_TIME,
} from './data/initialGameData';
import { sound } from './utils/audio';
import { runMockGm } from './gm/mockGm';

export default function App() {
  // Audio State
  // theme state 已移除：全 App 沒有任何地方讀它，Tailwind 也沒有對應的亮色樣式。
  // 需要亮色時再一併實作樣式與設定面板的控制項。
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Toast State
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const triggerToast = (text: string) => {
    setToast({ id: Date.now(), text });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Navigation & Container State
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [storybookTargetNpcId, setStorybookTargetNpcId] = useState<string | null>(null);

  // Player Profile State
  const [profile, setProfile] = useState<PlayerProfile>(INITIAL_PROFILE);

  // Player Stats State
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);

  // Quests Data
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);

  // Handle Quests actions
  const handleReportQuest = (quest: Quest) => sendToGm(`我回報任務【${quest.title}】`);

  const handleAbandonQuest = (quest: Quest) => {
    sound.playClick();
    triggerToast(`已放棄任務：${quest.title}`);
    setQuests((prev) => prev.filter((q) => q.id !== quest.id));
  };

  // 玩家背包。與下面故事書用的設定集物品定義是兩份資料。
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY);

  // 設定集的物品定義。故事書物品分頁編輯這一份，不動玩家背包。
  const [itemDefinitions, setItemDefinitions] = useState<ItemDefinition[]>(
    INITIAL_ITEM_DEFINITIONS
  );

  // NPCs Data
  const [npcs, setNpcs] = useState<NPCData[]>(INITIAL_NPCS);

  // Dialogue History
  const [dialogueHistory, setDialogueHistory] = useState<DialogueTurn[]>(INITIAL_DIALOGUE_HISTORY);

  // Story Chapters Data
  const [chapters, setChapters] = useState<StoryChapter[]>(INITIAL_CHAPTERS);

  // Diary Entries (Personal Logs)
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(INITIAL_DIARY_ENTRIES);

  // Map Sectors (中上方: 研究室 / 右方: 溫室 / 下方: 醫療區 / 左方: 工程部 / 正中間: 1. 艦橋, 2. 中央公園)
  const [sectors, setSectors] = useState<MapSector[]>(INITIAL_SECTORS);

  const [currentSectorId, setCurrentSectorId] = useState<string>(START_SECTOR_ID);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  // 以下四項原本寫死在各元件內部，現在改由這裡供給。
  // 內容之後由 AI 或資料庫接手，屆時只換這幾個 state 的來源。
  const [areaMemories] = useState<string[]>(INITIAL_AREA_MEMORIES);
  const [objectives] = useState<Objective[]>(INITIAL_OBJECTIVES);
  const [summary] = useState<string>(INITIAL_SUMMARY);
  const [quickReplies] = useState<string[]>(INITIAL_QUICK_REPLIES);

  // 遊戲時間。不抓現實系統時間，也不每秒 setState 重繪整個 header。
  const [gameDate] = useState<string>(GAME_START_DATE);
  const [gameTime] = useState<string>(GAME_START_TIME);

  // Handle Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering hotkeys when typing in input or textarea
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName.toLowerCase() === 'input' ||
          activeElement.tagName.toLowerCase() === 'textarea' ||
          activeElement.tagName.toLowerCase() === 'select');

      if (e.key === 'Escape') {
        // 彈窗的 Esc 由各自的 ModalShell 負責，那裡才看得到未儲存防呆與過場鎖定。
        // 這裡只關抽屜，避免全域處理器繞過那些判斷。
        setActiveDrawer(null);
        return;
      }

      if (isTyping) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'd':
          setActiveModal((prev) => (prev === 'diary' ? null : 'diary'));
          sound.playOpen();
          break;
        case 's':
          setActiveModal((prev) => (prev === 'storybook' ? null : 'storybook'));
          sound.playOpen();
          break;
        case 'm':
          setActiveModal((prev) => (prev === 'map' ? null : 'map'));
          sound.playOpen();
          break;
        case 't':
          setActiveDrawer((prev) => (prev === 'quests' ? null : 'quests'));
          sound.playOpen();
          break;
        case 'i':
          setActiveDrawer((prev) => (prev === 'inventory' ? null : 'inventory'));
          sound.playOpen();
          break;
        case 'p':
          setActiveDrawer((prev) => (prev === 'profile' ? null : 'profile'));
          sound.playOpen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle outside click to close drawers (點抽屜以外任何地方即關閉，包含點在大視窗上。不設關閉鍵。關閉抽屜不影響大視窗)
  useEffect(() => {
    const handleWindowClick = (e: MouseEvent) => {
      if (activeDrawer) {
        const target = e.target as HTMLElement;
        const insideDrawer = target.closest(
          '#drawer-quests, #drawer-inventory, #drawer-profile'
        );
        const insideTrigger = target.closest(
          '#btn-quests-drawer, #btn-inventory-drawer, #header-profile-btn'
        );
        if (!insideDrawer && !insideTrigger) {
          setActiveDrawer(null);
        }
      }
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [activeDrawer]);

  const applyCommands = (commands: GmCommand[]) => commands.forEach((command) => {
    if (command.type === 'adjust_stats') setStats((prev) => ({
      ...prev, stamina: Math.min(prev.maxStamina, Math.max(0, prev.stamina + (command.stamina ?? 0))),
      hunger: Math.min(prev.maxHunger, Math.max(0, prev.hunger + (command.hunger ?? 0))), credits: Math.max(0, prev.credits + (command.credits ?? 0)),
      conditions: command.addCondition && !prev.conditions.includes(command.addCondition) ? [...prev.conditions, command.addCondition] : command.removeCondition ? prev.conditions.filter((item) => item !== command.removeCondition) : prev.conditions,
    }));
    if (command.type === 'consume_item') setItems((prev) => prev.map((item) => item.id === command.itemId ? { ...item, count: item.count - (command.count ?? 1) } : item).filter((item) => item.count > 0));
    if (command.type === 'set_quest_status') setQuests((prev) => prev.map((quest) => quest.id === command.questId ? { ...quest, status: command.status } : quest));
    if (command.type === 'adjust_affection') setNpcs((prev) => prev.map((npc) => npc.id === command.npcId ? { ...npc, affection: npc.affection + command.amount, relationship: command.relationship ?? npc.relationship } : npc));
  });

  /** 20 回合窗口；滿額後批次捨棄最早 10 回。 */
  const sendToGm = (text: string) => {
    const playerInput = text.trim();
    if (!playerInput) return;
    const result = runMockGm(playerInput, currentSectorId === 'residential_a' && currentRoomId === 'A-1' ? npcs.find(npc => npc.id === 'lucian') : undefined);
    applyCommands(result.commands);
    setDialogueHistory((prev) => {
      const next = [...prev, { playerInput, segments: result.segments }];
      return next.length > 20 ? next.slice(10) : next;
    });
    triggerToast('GM 已處理此行動');
  };

  const handleUseItem = (item: InventoryItem) => sendToGm(`我使用【${item.name}】`);
  const handleGiftItem = (item: InventoryItem) => sendToGm(`我把【${item.name}】送出`);

  // Handle dropping item
  const handleDropItem = (item: InventoryItem) => {
    triggerToast(`已丟棄 ${item.name}`);
    setItems((prev) =>
      prev
        .map((i) => (i.id === item.id ? { ...i, count: i.count - 1 } : i))
        .filter((i) => i.count > 0)
    );
  };

  const handleSendMessage = (text: string) => sendToGm(text);

  // 進入區域。
  // 之後這裡會接 AI 世界模擬與場景初始化；本輪先以一段延遲佔位，
  // 但介面的載入 / 失敗 / 超時流程已照真實非同步行為設計，接上時只換這個函式的內容。
  // 位置切換只在模擬完成後提交，彈窗才會關閉（規格 1.6）。
  const handleEnterSector = async (sec: MapSector, roomId?: string) => {
    await new Promise((resolve) => setTimeout(resolve, 600));

    setCurrentSectorId(sec.id);
    setCurrentRoomId(roomId ?? null);
    setSectors((prev) =>
      prev.map((s) => ({
        ...s,
        isCurrent: s.id === sec.id,
      }))
    );
  };

  // Handle reset game progress
  // 清空運行資料（數值、任務、道具、日記、對話、位置、個人資料），
  // 保留故事書內容（章節、NPC 基本設定、地點設定）與系統設定。
  const handleResetProgress = () => {
    setStats(INITIAL_STATS);
    setProfile(EMPTY_PROFILE);
    setQuests([]);
    setItems([]);
    setDiaryEntries([]);
    setDialogueHistory([]);

    setCurrentSectorId(START_SECTOR_ID);
    setCurrentRoomId(null);
    setSectors((prev) =>
      prev.map((s) => ({ ...s, isCurrent: s.id === START_SECTOR_ID }))
    );

    setActiveDrawer(null);
    setActiveModal(null);
    setStorybookTargetNpcId(null);

    triggerToast('已重置進度');
  };

  // Handle adding diary entry
  const handleAddDiaryEntry = (entry: Omit<DiaryEntry, 'id'>) => {
    const newEntry: DiaryEntry = {
      ...entry,
      id: `d_${Date.now()}`,
    };
    setDiaryEntries([newEntry, ...diaryEntries]);
  };

  // Handle updating diary entry
  const handleUpdateDiaryEntry = (updatedEntry: DiaryEntry) => {
    setDiaryEntries((prev) =>
      prev.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry))
    );
  };

  // Handle deleting diary entry
  const handleDeleteDiaryEntry = (id: string) => {
    setDiaryEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const currentSector = sectors.find((s) => s.id === currentSectorId) ?? null;

  const currentSectorName =
    (currentSector?.name || '1. 艦橋') + (currentRoomId ? ` (${currentRoomId})` : '');

  return (
    <div className="h-screen w-screen flex flex-col justify-between relative overflow-hidden select-none bg-[#050814] text-slate-100">
      {/* 場景層：所有介面之下的底圖 */}
      <SceneLayer sector={currentSector} />

      {/* Top HUD Header */}
      <HeaderHUD
        stats={stats}
        currentLocation={currentSectorName}
        memories={areaMemories}
        gameDate={gameDate}
        gameTime={gameTime}
        onOpenDrawer={(type) => {
          sound.playOpen();
          setActiveDrawer(type);
        }}
        onOpenModal={(type) => {
          sound.playOpen();
          setActiveModal(type);
        }}
      />

      {/* Main Layout Area */}
      <main className="relative z-10 flex-1 flex flex-row gap-3.5 p-3.5 pt-2.5 overflow-hidden h-[calc(100vh-64px)]">
        {/* Left Sidebar Toolbar and Accordions */}
        <LeftSidebar
          activeDrawer={activeDrawer}
          activeModal={activeModal}
          onOpenDrawer={(type) => {
            sound.playOpen();
            setActiveDrawer(type);
          }}
          onOpenModal={(type) => {
            sound.playOpen();
            setActiveModal(type);
          }}
          activeQuestsCount={quests.filter((q) => q.status === '進行中').length}
          itemCount={items.length}
          objectives={objectives}
          summary={summary}
        />

        {/* Center & Right Column: Dialogue and Scene Stage */}
        <DialogueSection
          onOpenModal={(type) => {
            sound.playOpen();
            if (type !== 'storybook') {
              setStorybookTargetNpcId(null);
            }
            setActiveModal(type);
          }}
          onSendMessage={handleSendMessage}
          dialogueHistory={dialogueHistory}
          quickReplies={quickReplies}
          toast={toast}
          npcs={npcs}
          stage={currentSectorId === 'residential_a' && currentRoomId === 'A-1' ? (
            <RoomScene npc={npcs.find(npc => npc.id === 'lucian')} onInteract={(npc) => sendToGm(`我走近${npc.name}打招呼`)} onExit={() => setCurrentRoomId(null)} paused={activeModal !== null || activeDrawer !== null} />
          ) : currentSectorId === 'residential_a' && currentRoomId === null ? (
            <CorridorScene playerName={profile.name} paused={activeModal !== null || activeDrawer !== null} onEnterRoom={() => setCurrentRoomId('A-1')} onNotice={triggerToast} />
          ) : undefined}
        />
      </main>

      {/* ======================= DRAWERS (輕量類) ======================= */}
      {/* 1. 任務 */}
      <QuestDrawer
        isOpen={activeDrawer === 'quests'}
        quests={quests}
        onReportQuest={handleReportQuest}
        onAbandonQuest={handleAbandonQuest}
      />

      {/* 2. 道具 */}
      <InventoryDrawer
        isOpen={activeDrawer === 'inventory'}
        items={items}
        onUseItem={handleUseItem}
        onGiftItem={handleGiftItem}
        onDropItem={handleDropItem}
      />

      {/* 3. 個人資訊 */}
      <ProfileDrawer
        isOpen={activeDrawer === 'profile'}
        profile={profile}
        onSaveProfile={(updated) => setProfile(updated)}
      />

      {/* ======================= MODALS (重量類大視窗) ======================= */}
      {/* 1. 地圖 */}
      <MapModal
        npcs={npcs}
        isOpen={activeModal === 'map'}
        onClose={() => setActiveModal(null)}
        sectors={sectors}
        currentSectorId={currentSectorId}
        onEnterSector={handleEnterSector}
      />

      {/* 2. 故事書 */}
      <StoryModal
        isOpen={activeModal === 'storybook'}
        onClose={() => {
          setActiveModal(null);
          setStorybookTargetNpcId(null);
        }}
        chapters={chapters}
        npcs={npcs}
        itemDefinitions={itemDefinitions}
        sectors={sectors}
        onChangeChapters={setChapters}
        onChangeNpcs={setNpcs}
        onChangeItemDefinitions={setItemDefinitions}
        onChangeSectors={setSectors}
        initialTab="character"
        initialCharacterId={storybookTargetNpcId}
      />

      {/* 3. 日記 */}
      <DiaryModal
        isOpen={activeModal === 'diary'}
        onClose={() => setActiveModal(null)}
        entries={diaryEntries}
        onAddEntry={handleAddDiaryEntry}
        onUpdateEntry={handleUpdateDiaryEntry}
        onDeleteEntry={handleDeleteDiaryEntry}
      />

      {/* 5. 系統設定 */}
      <SettingsModal
        isOpen={activeModal === 'settings'}
        onClose={() => setActiveModal(null)}
        isMuted={isMuted}
        onToggleMute={() => {
          setIsMuted((prev) => {
            const next = !prev;
            sound.setSoundEnabled(!next);
            return next;
          });
        }}
        onNewGame={handleResetProgress}
      />
    </div>
  );
}
