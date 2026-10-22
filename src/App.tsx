import React, { useState, useEffect, useRef, useMemo } from 'react';
import SceneLayer from './components/SceneLayer';
import RoomScene from './components/RoomScene';
import CorridorScene from './components/CorridorScene';
import { CORRIDORS } from './game/corridor';
import { furnishingFor } from './game/roomRuntime';
import { addMinutes, crossesCheckpoint, hourOf, planRelocation, sceneOf } from './data/npcSchedule';
import BridgeScene from './components/BridgeScene';
import FacilityScene from './components/FacilityScene';
import { FACILITIES } from './game/facility';
import { describeFacilityObjects } from './game/facilityContext';
import { STEPS_PER_MINUTE, WALK_PX_PER_STEP, travelMinutes, walkMeter } from './game/clock';
import {
  MEMORY_PARAMS, MemoryBlocks, MemoryDraft, MemoryWriteScope, SceneRecall,
  addMemory, addPlayerMemory, buildEntryPack, editMemory, removeMemory, toggleMemory, canReuseScene, describeRecalled, diaryCandidates, memoriesAt, packBlocks,
  presentKey, pushTurn, recallDiaries, recallMemories, touchMemories,
} from './game/memory';
import { placeLore, scanLore } from './game/lore';
import { SuppliesState, deliver, gmSupplyLines, initialSupplies, pickUp, tick } from './game/supplies';
import { dayNumber } from './game/growth';
import { describeRow, growthReport } from './game/growthReport';
import type { FacilityInteraction, FacilityMap } from './game/facility';
import greenhouseMap from '../public/assets/greenhouse/map.json';
import engineeringMap from '../public/assets/engineering/map.json';

/** 溫室的種植架（物資帳算收成用）。地圖 JSON 直接打包進來，不必等場景載入。 */
const GREENHOUSE_RACKS = (greenhouseMap as unknown as FacilityMap).racks ?? [];
const GREENHOUSE_MAP = greenhouseMap as unknown as FacilityMap;
const ENGINEERING_MAP = engineeringMap as unknown as FacilityMap;
const GREENHOUSE_WIDTH = GREENHOUSE_MAP.width;
import HeaderHUD from './components/HeaderHUD';
import LeftSidebar, { Objective } from './components/LeftSidebar';
import DialogueSection from './components/DialogueSection';
import QuestDrawer from './components/Drawers/QuestDrawer';
import InventoryDrawer from './components/Drawers/InventoryDrawer';
import ProfileDrawer from './components/Drawers/ProfileDrawer';
import MapModal from './components/Modals/MapModal';
import StoryModal from './components/Modals/StoryModal';
import DiaryModal from './components/Modals/DiaryModal';
import MemoryModal from './components/Modals/MemoryModal';
import SettingsModal from './components/Modals/SettingsModal';
import GrowthModal from './components/Modals/GrowthModal';
import MonitorModal from './components/Modals/MonitorModal';
import { Wing, monitorRows } from './game/monitor';
import {
  DrawerType,
  ModalType,
  PlayerProfile,
  PlayerStats,
  Quest,
  InventoryItem,
  DiaryEntry,
  MapSector,
  ToastMessage,
  DialogueTurn,
  GmCommand,
  LayeredMemory,
  NpcMemories,
  MergedStory,
  StoryKind,
  StoryLayer,
  StoryOverrides,
} from './types';
import {
  START_SECTOR_ID,
  INITIAL_STATS,
  EMPTY_PROFILE,

  INITIAL_QUESTS,
  INITIAL_INVENTORY,
  INITIAL_AFFECTION,
  INITIAL_DIALOGUE_HISTORY,
  INITIAL_DIARY_ENTRIES,
  EMPTY_RUN_STORY,
  EMPTY_OVERRIDES,
  ROOMS,
  INITIAL_OBJECTIVES,
  INITIAL_SUMMARY,
  INITIAL_QUICK_REPLIES,
  GAME_START_DATE,
  GAME_START_TIME,
} from './data/initialGameData';
import { loadGameSave, writeGameSave, clearGameSave } from './data/persistence';
import { loadBuiltinStory, writeBuiltinStory, mergeStory, splitEntries, fillMissingBuiltin, findRoomOccupant } from './data/story';
import { sound } from './utils/audio';
import { runGm, GmError } from './gm';
import { suggestQuickReplies, generateDiaryDraft, condenseDiaryDraft, selectSceneMemories, distillNpcThoughts } from './gm/assistant';
import { condenseEntries, splitCondensed } from './game/diary';
import {
  addThoughts, appendLog, frozenThoughts, needsDistill, npcLogCandidates, npcMemoryOf, pendingThoughts,
  recallNpcLogs, thoughtSnapshot, toggleNpcLog,
} from './game/npcMemory';

export default function App() {
  const facilityPositionRef = useRef<{ x: number; y: number } | null>(null);
  // 掛載時讀一次存檔。沒有存檔／格式不符時為 null，各項 state 退回新遊戲的初始值。
  const [saved] = useState(loadGameSave);

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
  const [profile, setProfile] = useState<PlayerProfile>(saved?.profile ?? EMPTY_PROFILE);

  // Player Stats State
  const [stats, setStats] = useState<PlayerStats>(saved?.stats ?? INITIAL_STATS);

  // Quests Data
  const [quests, setQuests] = useState<Quest[]>(saved?.quests ?? INITIAL_QUESTS);

  // Handle Quests actions
  const handleReportQuest = (quest: Quest) => sendToGm(`我回報任務【${quest.title}】`);

  const handleAbandonQuest = (quest: Quest) => {
    sound.playClick();
    triggerToast(`已放棄任務：${quest.title}`);
    setQuests((prev) => prev.filter((q) => q.id !== quest.id));
  };

  // 玩家背包。與故事書的物品定義是兩份資料。
  const [items, setItems] = useState<InventoryItem[]>(saved?.items ?? INITIAL_INVENTORY);

  /*
   * 故事書三層資料（見 data/story.ts）：
   * - 內建內容：開發者編寫，存在獨立的 localStorage 鍵，所有存檔共用，新開遊戲不清空。
   * - 本局條目：AI 在這一局生成的條目，跟著存檔走。目前還沒有寫入來源。
   * - 覆寫：本局對條目的進度狀態（好感、關係、所在位置、啟用），跟著存檔走。
   * 故事書 UI 與遊戲其他部分都只讀合併後的 story。
   */
  const [builtinStory, setBuiltinStory] = useState<StoryLayer>(loadBuiltinStory);
  // 舊存檔沒有後來加的條目種類（設定），用空的補齊。
  const [runStory, setRunStory] = useState<StoryLayer>(() => ({ ...EMPTY_RUN_STORY, ...saved?.runStory }));
  const [storyOverrides, setStoryOverrides] = useState<StoryOverrides>(() => ({ ...EMPTY_OVERRIDES, ...saved?.storyOverrides }));
  const story = useMemo(
    () => mergeStory(builtinStory, runStory, storyOverrides),
    [builtinStory, runStory, storyOverrides]
  );
  const { npcs, sectors } = story;

  /** 故事書 UI 交回整份清單，依每筆的來源拆回內建與本局兩層。 */
  const changeStory = <K extends StoryKind>(kind: K) => (next: MergedStory[K]) => {
    const { builtin, run } = splitEntries(kind, next);
    setBuiltinStory((prev) => ({ ...prev, [kind]: builtin }));
    setRunStory((prev) => ({ ...prev, [kind]: run }));
  };

  /** 切換條目的啟用狀態。存在覆寫裡，跟著存檔走。 */
  const toggleStoryEntry = (kind: StoryKind, id: string) =>
    setStoryOverrides((prev) => {
      const current = prev[kind]?.[id] ?? {};
      return { ...prev, [kind]: { ...prev[kind], [id]: { ...current, enabled: !(current.enabled ?? true) } } };
    });

  // 內建內容一變就寫回自己的鍵。第一次啟動時也由這裡把種子寫進去。
  const builtinSaveFailedRef = useRef<boolean>(false);
  useEffect(() => {
    if (writeBuiltinStory(builtinStory)) {
      builtinSaveFailedRef.current = false;
    } else if (!builtinSaveFailedRef.current) {
      builtinSaveFailedRef.current = true;
      triggerToast('故事書內建內容寫入失敗：瀏覽器儲存空間不足或無法寫入');
    }
  }, [builtinStory]);

  // Dialogue History
  const [dialogueHistory, setDialogueHistory] = useState<DialogueTurn[]>(saved?.dialogueHistory ?? INITIAL_DIALOGUE_HISTORY);

  // Diary Entries (Personal Logs)
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>(saved?.diaryEntries ?? INITIAL_DIARY_ENTRIES);

  const [currentSectorId, setCurrentSectorId] = useState<string>(saved?.currentSectorId ?? START_SECTOR_ID);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(saved?.currentRoomId ?? null);
  const [bridgeEntry, setBridgeEntry] = useState(0);
  // 剛走出來的房間。回到走廊時站在那扇門前，而不是一律回到 A-1 門口。
  const [returnRoomId, setReturnRoomId] = useState<string | null>(null);
  // 走路進來的上一個區域（溫室左門 ↔ A 走廊、右門 ↔ B 走廊）。場景用它決定玩家出現在哪個門口；搭星圖則為 null。
  const [arrivedFrom, setArrivedFrom] = useState<string | null>(null);

  // 通道 ① 分層記憶：主 GM 用 add_memory 寫入，進場時依地點與在場者挑出來帶給 GM（game/memory.ts）。
  const [memories, setMemories] = useState<LayeredMemory[]>(saved?.memories ?? []);
  // 通道 ② NPC 日記：thought 窗口與一天一篇的日誌（game/npcMemory.ts）。
  const [npcMemories, setNpcMemories] = useState<NpcMemories>(saved?.npcMemories ?? {});
  const npcMemoriesRef = useRef(npcMemories);
  useEffect(() => { npcMemoriesRef.current = npcMemories; }, [npcMemories]);
  const [objectives, setObjectives] = useState<Objective[]>(saved?.objectives ?? INITIAL_OBJECTIVES);
  const [summary, setSummary] = useState<string>(saved?.summary ?? INITIAL_SUMMARY);
  // 快速回覆由助理 AI 依對話產生，見下方 requestQuickReplies。

  // 遊戲時間。不抓現實系統時間，也不每秒 setState 重繪整個 header。
  // 只能經由下方的 advanceGameTime 推進，檢查點判定集中在那裡。
  const [gameDate, setGameDate] = useState<string>(saved?.gameDate ?? GAME_START_DATE);
  const [gameTime, setGameTime] = useState<string>(saved?.gameTime ?? GAME_START_TIME);
  // 船上物資帳：時間推進時收成與消耗，玩家在溫室裝推車、到中央公園卸貨。
  const [supplies, setSupplies] = useState<SuppliesState>(() => saved?.supplies ?? initialSupplies(dayNumber(saved?.gameDate ?? GAME_START_DATE, saved?.gameTime ?? GAME_START_TIME)));
  // 重置進度時 +1：場景可能沒變（本來就在起點），但 NPC 位置被清空了，仍要重算。
  const [sceneEpoch, setSceneEpoch] = useState(0);

  /**
   * 自動存檔。
   *
   * 任何一項遊戲狀態變動後延遲 500ms 才寫入，避免連續操作（例如一次 GM 回應
   * 同時改動數值、背包與任務）反覆序列化整份存檔。
   *
   * 寫入失敗多半是 localStorage 容量不足或無痕視窗，這種情況會提示玩家一次，
   * 不靜默失敗 —— 玩家以為有存檔卻沒有，比直接告知更糟。
   */
  const saveFailedRef = useRef<boolean>(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      const ok = writeGameSave({
        profile, stats, quests, items, runStory, storyOverrides, dialogueHistory,
        diaryEntries, currentSectorId, currentRoomId,
        memories, npcMemories, objectives, summary, gameDate, gameTime, supplies,
      });
      if (ok) {
        saveFailedRef.current = false;
      } else if (!saveFailedRef.current) {
        saveFailedRef.current = true;
        triggerToast('自動存檔失敗：瀏覽器儲存空間不足或無法寫入');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [
    profile, stats, quests, items, runStory, storyOverrides, dialogueHistory,
    diaryEntries, currentSectorId, currentRoomId,
    memories, npcMemories, objectives, summary, gameDate, gameTime, supplies,
  ]);

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

  const applyCommands = (commands: GmCommand[]) => commands.forEach((command, index) => {
    if (command.type === 'adjust_stats') setStats((prev) => ({
      ...prev, stamina: Math.min(prev.maxStamina, Math.max(0, prev.stamina + (command.stamina ?? 0))),
      hunger: Math.min(prev.maxHunger, Math.max(0, prev.hunger + (command.hunger ?? 0))), credits: Math.max(0, prev.credits + (command.credits ?? 0)),
      conditions: command.addCondition && !prev.conditions.includes(command.addCondition) ? [...prev.conditions, command.addCondition] : command.removeCondition ? prev.conditions.filter((item) => item !== command.removeCondition) : prev.conditions,
    }));
    if (command.type === 'consume_item') setItems((prev) => prev.map((item) => item.id === command.itemId ? { ...item, count: item.count - (command.count ?? 1) } : item).filter((item) => item.count > 0));
    if (command.type === 'set_quest_status') setQuests((prev) => prev.map((quest) => quest.id === command.questId ? { ...quest, status: command.status } : quest));
    // 好感與關係是本局進度，寫進覆寫，不動故事書條目本身。
    if (command.type === 'adjust_affection') setStoryOverrides((prev) => {
      const current = prev.npcs[command.npcId] ?? {};
      const next = { ...current, affection: (current.affection ?? INITIAL_AFFECTION) + command.amount };
      if (command.relationship) next.relationship = command.relationship;
      return { ...prev, npcs: { ...prev.npcs, [command.npcId]: next } };
    });
    if (command.type === 'set_summary') setSummary(command.text);
    // id 由這裡發，不讓 GM 自己取：模型會重複用同一個字串，兩則目標撞 id
    // 之後 React 的 key 就會亂掉，結案也會一次關掉兩則。
    if (command.type === 'add_objective') setObjectives((prev) => [...prev, { id: `obj-${Date.now()}-${prev.length}`, text: command.text, location: command.location }]);
    if (command.type === 'advance_time') advanceGameTime(command.minutes);
    if (command.type === 'complete_objective') setObjectives((prev) => prev.map((objective) => objective.id === command.objectiveId ? { ...objective, done: true } : objective));
    if (command.type === 'add_memory') setMemories((prev) => addMemory(prev, command, memoryWriteScope(index)));
  });

  /** 寫入 ① 記憶的現場：地點標籤用玩家此刻所在的區域與場景，時間讀時鐘 ref（同一回合可能先推進過時間）。 */
  const memoryNow = () => `${clockRef.current.date} ${clockRef.current.time}`;
  const memoryWriteScope = (index: number): MemoryWriteScope => ({
    region: currentSectorId,
    scene: playerScene,
    now: memoryNow(),
    addDays: (days) => addMinutes(clockRef.current.date, '00:00', days * 24 * 60).date,
    id: `mem-${Date.now()}-${index}`,
  });
  /** 地點 id → 顯示名稱。場景 id 可能是房號。 */
  const placeName = (id: string) => sectors.find((sector) => sector.id === id)?.name ?? (ROOMS.some((room) => room.id === id) ? `${id} 房間` : id);
  const npcName = (id: string) => npcs.find((npc) => npc.id === id)?.name ?? id;

  const currentSector = sectors.find((s) => s.id === currentSectorId) ?? null;

  /**
   * 目前所在的房間。房號必須屬於目前的居住區，否則視為在走廊。
   * 房間只是共用空殼；陳設依住戶（由 NPC 的房號反查）疊上去，沒有陳設就是空房。
   */
  const currentRoom = ROOMS.find((room) => room.id === currentRoomId && room.sectorId === currentSectorId) ?? null;
  const roomOccupant = currentRoom ? findRoomOccupant(npcs, currentRoom.id) : undefined;

  const currentSectorName =
    (currentSector?.name || '1. 艦橋') + (currentRoomId ? ` (${currentRoomId})` : '');

  /** 玩家眼前的場景：房號，或所在區域（居住區沒進房間就是走廊）。 */
  const playerScene = sceneOf(currentSectorId, currentRoom?.id ?? null);

  /**
   * 在場 NPC：所在地點等於玩家眼前場景的角色。GM 只能讓這些角色說話與調整好感。
   * NPC 的位置存在覆寫的 location，由下面兩個時機依日程重算。
   */
  const presentNpcs = npcs.filter((npc) => npc.location === playerScene);

  /** 把重算結果寫進覆寫的 location。 */
  const relocateNpcs = (hour: number, deferScene: string | null) => {
    const { apply } = planRelocation(npcs, hour, deferScene);
    if (!Object.keys(apply).length) return;
    setStoryOverrides((prev) => ({
      ...prev,
      npcs: {
        ...prev.npcs,
        ...Object.fromEntries(Object.entries(apply).map(([id, location]) => [id, { ...prev.npcs[id], location }])),
      },
    }));
  };

  // 時機一：切換場景（含開局、讀檔、重置）時，全體依當下時間重算並全部套用。
  // 之前檢查點壓著沒套用的變動，也在這裡一併生效。
  useEffect(() => {
    relocateNpcs(hourOf(gameTime), null);
  }, [playerScene, sceneEpoch]);

  /**
   * 推進遊戲時間。遊戲時間只能經由這裡改變，來源有三個（規則見 game/clock.ts）：
   * 走路（場景回報走了幾 px）、星圖傳送（依距離級距）、主 GM 的 advance_time 指令。
   * 時機二：推進前後的區間跨過檢查點（01:00／09:00／18:00／21:00）時重算一次；
   * 會讓 NPC 進出玩家眼前的變動先不套用，等玩家切換場景。
   * 用 ref 記當下時間：走路可能一幀內連續推進，state 還沒更新就再推會吃掉分鐘。
   */
  const clockRef = useRef({ date: gameDate, time: gameTime });
  useEffect(() => { clockRef.current = { date: gameDate, time: gameTime }; }, [gameDate, gameTime]);
  const advanceGameTime = (minutes: number) => {
    if (minutes <= 0) return;
    const before = clockRef.current;
    const after = addMinutes(before.date, before.time, minutes);
    clockRef.current = after;
    setGameDate(after.date);
    setGameTime(after.time);
    setSupplies((prev) => tick(prev, GREENHOUSE_RACKS, dayNumber(after.date, after.time)));
    if (crossesCheckpoint(before, after)) relocateNpcs(hourOf(after.time), playerScene);
  };
  /** 場景每幀回報走了幾 px；累積滿一分鐘才推進，站著不動不耗時。 */
  const walkRef = useRef(walkMeter());
  /** 累積步數（一步 96 px；傳送照耗時換算）。場景快取比對「步數差」用，不進存檔。 */
  const stepsRef = useRef(0);
  const handleWalk = (px: number) => {
    if (px > 0) stepsRef.current += px / WALK_PX_PER_STEP;
    advanceGameTime(walkRef.current(px));
  };

  /**
   * 進場結果（骨架第三節階段 8「場景重新矯正」）：換場時算一次，凍結到離場。
   * 包含 ① 進場包、② 在場者先前的 thought、玩家日記與 NPC 日誌的語意篩選；離場時連同當下步數存進快取，
   * 回到同一場景、在場名單相同、步數差 30 步內就直接重用，不再呼叫助理 GM。
   */
  const [sceneRecall, setSceneRecall] = useState<SceneRecall | null>(null);
  const sceneRecallRef = useRef<SceneRecall | null>(null);
  const sceneCacheRef = useRef(new Map<string, SceneRecall>());
  const currentPresentKey = presentKey(presentNpcs.map((npc) => npc.id));
  useEffect(() => {
    const leaving = sceneRecallRef.current;
    if (leaving && leaving.scene !== playerScene) {
      sceneCacheRef.current.set(leaving.scene, { ...leaving, steps: stepsRef.current });
    }
    const commit = (next: SceneRecall) => { sceneRecallRef.current = next; setSceneRecall(next); };
    const cached = sceneCacheRef.current.get(playerScene);
    if (canReuseScene(cached, playerScene, currentPresentKey, stepsRef.current)) { commit(cached!); return; }

    // ① 進場包：前端算，不呼叫 LLM。
    const packIds = buildEntryPack(memories, {
      region: currentSectorId,
      adjacentRegions: currentSector?.connectedTo ?? [],
      scene: playerScene,
      presentNpcIds: presentNpcs.map((npc) => npc.id),
      closeNpcIds: npcs.filter((npc) => npc.location !== playerScene && npc.affection >= MEMORY_PARAMS.closeAffection).map((npc) => npc.id),
      today: gameDate,
    });
    const presentIds = presentNpcs.map((npc) => npc.id);
    const base: SceneRecall = {
      scene: playerScene, present: currentPresentKey, steps: stepsRef.current,
      diaryIds: [], npcLogIds: [], packIds,
      // ② 在場者窗口裡現有的 thought 都來自先前場景，作為背景帶進來；本場景新生的已在對話紀錄裡。
      thoughtIds: thoughtSnapshot(npcMemories, presentIds),
    };
    commit(base);
    // 換場當下 NPC 會依日程重排一次，在場名單可能緊接著再變；等一下再問，避免連打兩次。
    let cancelled = false;
    const timer = setTimeout(() => {
      selectSceneMemories({
        locationName: currentSectorName, presentNpcs, summary, gameDate, gameTime,
        diaries: diaryCandidates(diaryEntries),
        npcLogs: npcLogCandidates(npcMemories, presentIds),
      })
        .then((selection) => { if (!cancelled) commit({ ...base, ...selection }); })
        // 篩選失敗（沒設助理、網路斷）不擋遊戲：這一場只剩關鍵字追加那一軌。
        .catch(() => undefined);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [playerScene, currentPresentKey, sceneEpoch]);
  /** 設施場景裡 map.json 沒寫死文字的互動。回傳 true 表示處理掉了。 */
  const [monitorWing, setMonitorWing] = useState<Wing>('left');
  const handleFacilityAction = (item: FacilityInteraction) => {
    if (item.kind === 'console' && currentSectorId === 'greenhouse') { setActiveModal('growth'); return true; }
    if (item.kind === 'monitor' && currentSectorId === 'greenhouse') { setMonitorWing(item.id.endsWith('right') ? 'right' : 'left'); setActiveModal('monitor'); return true; }
    if (item.kind !== 'shipping') return false;
    const { state, kg } = pickUp(supplies);
    if (kg) { setSupplies(state); return `裝上推車：約 ${kg} 公斤蔬果。送到中央公園的餐廳就能卸貨。`; }
    return state.carrying && Object.values(state.carrying).some((v) => v > 0) ? '推車已經滿了，先送一趟吧。' : '出貨籃是空的，作物還在長。';
  };

  /**
   * 通道 ② 回寫（骨架階段 6）：本回合的 thought 進窗口；未歸檔的滿 10 則，或本回合有進展
   * （任務狀態變動、關係描述改寫），就在背景請助理 GM 提煉進該 NPC 當天的日誌。
   * 玩家已經看到回應了，不等提煉；失敗的話 thought 仍未歸檔，下次再試。
   */
  const distillingRef = useRef(new Set<string>());
  const recordThoughts = (thoughts: { npcId: string; text: string }[], commands: GmCommand[]) => {
    const progress = commands.some((command) => command.type === 'set_quest_status'
      || (command.type === 'adjust_affection' && !!command.relationship));
    const now = memoryNow();
    const store = addThoughts(npcMemoriesRef.current, thoughts, now, placeName(playerScene), `th-${Date.now()}`);
    npcMemoriesRef.current = store;
    setNpcMemories(store);
    for (const npc of presentNpcs) {
      if (distillingRef.current.has(npc.id) || !needsDistill(store, npc.id, progress)) continue;
      const batch = pendingThoughts(store, npc.id);
      const date = clockRef.current.date;
      distillingRef.current.add(npc.id);
      distillNpcThoughts({
        npc,
        playerName: profile.name,
        thoughts: batch,
        todayLog: npcMemoryOf(store, npc.id).logs.find((log) => log.date === date)?.content ?? '',
      })
        .then((result) => setNpcMemories((prev) => {
          const next = appendLog(prev, npc.id, result, batch.map((thought) => thought.id), date, memoryNow());
          npcMemoriesRef.current = next;
          return next;
        }))
        .catch(() => undefined)
        .finally(() => distillingRef.current.delete(npc.id));
    }
  };

  // GM 呼叫狀態。錯誤不寫進對話歷史 —— 那是遊戲紀錄，不是錯誤日誌。
  const [gmPending, setGmPending] = useState<boolean>(false);
  const [gmError, setGmError] = useState<string | null>(null);

  /** 對話窗口 20 回合；滿額後批次捨棄最早 10 回（game/memory.ts 的 pushTurn）。 */
  const sendToGm = async (text: string) => {
    const playerInput = text.trim();
    // 等待回應期間擋掉重複送出，否則玩家連按會疊出多筆平行請求，
    // 回來的順序不保證，對話歷史會亂掉，而且每一筆都在花玩家的額度。
    if (!playerInput || gmPending) return;

    setGmPending(true);
    setGmError(null);

    // 記憶注入集合（骨架階段 1）：進場時凍結的部分照用，關鍵字追加每回合掃本次輸入。
    const packIds = sceneRecall?.packIds ?? [];
    const presentNpcIds = presentNpcs.map((npc) => npc.id);
    const recalled = recallMemories(memories, playerInput, gameDate, packIds);
    const diaries = recallDiaries(diaryEntries, sceneRecall?.diaryIds ?? [], playerInput);
    const npcLogs = recallNpcLogs(npcMemories, presentNpcIds, sceneRecall?.npcLogIds ?? [], playerInput);
    const memory: MemoryBlocks = {
      ...packBlocks(memories, packIds, { presentNpcIds, today: gameDate }, placeName, npcName),
      npcThoughts: frozenThoughts(npcMemories, presentNpcIds, sceneRecall?.thoughtIds ?? []),
      diaries: diaries.scene,
      npcLogs: npcLogs.scene,
      recalledMemories: recalled.map((item) => describeRecalled(item, npcName, placeName)),
      recalledDiaries: diaries.keyword,
      recalledNpcLogs: npcLogs.keyword,
      placeLore: placeLore(story, currentSectorId),
      recalledLore: scanLore(story, playerInput, presentNpcIds, [currentSectorId, ...(currentSector?.connectedTo ?? [])]),
    };
    setMemories((prev) => touchMemories(prev, [...packIds, ...recalled.map((item) => item.id)], memoryNow()));

    try {
      const result = await runGm({
        playerInput,
        profile,
        stats,
        quests,
        items,
        presentNpcs,
        locationName: currentSectorName,
        sceneObjects: currentSectorId === 'greenhouse' ? describeFacilityObjects(GREENHOUSE_MAP, facilityPositionRef.current)
          : currentSectorId === 'engineering' ? describeFacilityObjects(ENGINEERING_MAP, facilityPositionRef.current) : undefined,
        gameDate,
        gameTime,
        dialogueHistory,
        objectives,
        summary,
        supplies: gmSupplyLines(supplies),
        terminals: currentSectorId === 'greenhouse' ? [{ name: '溫室窗前工作站（農業監控終端）', lines: growthReport(GREENHOUSE_RACKS, dayNumber(gameDate, gameTime), GREENHOUSE_WIDTH).map(describeRow) }] : undefined,
        memory,
      });
      applyCommands(result.commands);
      const thoughts = result.commands.flatMap((command) => command.type === 'npc_thought' ? [{ npcId: command.npcId, text: command.text }] : []);
      recordThoughts(thoughts, result.commands);
      setDialogueHistory((prev) => pushTurn(prev, { playerInput, segments: result.segments, ...(thoughts.length ? { thoughts } : {}) }));
    } catch (error) {
      setGmError(
        error instanceof GmError ? error.message : 'GM 呼叫失敗，請稍後再試。'
      );
    } finally {
      setGmPending(false);
    }
  };

  /**
   * 快速回覆：玩家打開選單時才請助理 AI 產生，並以「最新一回合」為快取鍵。
   * 同一回合內反覆開關選單不會重複計費；GM 回應後才會產生新的建議。
   * 助理沒設定或失敗時退回通用回覆，選單仍然可用。
   */
  const latestTurn = dialogueHistory.at(-1);
  const [quickReplies, setQuickReplies] = useState<string[]>(INITIAL_QUICK_REPLIES);
  const [quickRepliesFor, setQuickRepliesFor] = useState<DialogueTurn | undefined>(undefined);
  const [quickRepliesPending, setQuickRepliesPending] = useState<boolean>(false);
  const [quickRepliesError, setQuickRepliesError] = useState<string | null>(null);

  const requestQuickReplies = async () => {
    if (quickRepliesPending || !latestTurn || quickRepliesFor === latestTurn) return;
    setQuickRepliesPending(true);
    setQuickRepliesError(null);
    try {
      setQuickReplies(await suggestQuickReplies({ profile, presentNpcs, locationName: currentSectorName, dialogueHistory }));
    } catch (error) {
      setQuickReplies(INITIAL_QUICK_REPLIES);
      setQuickRepliesError(error instanceof Error ? error.message : '助理 AI 呼叫失敗。');
    } finally {
      // 失敗也記下這一回合，避免每次開選單都重打一次注定失敗的請求；
      // 玩家修好設定後，下一回合自然會重新產生。
      setQuickRepliesFor(latestTurn);
      setQuickRepliesPending(false);
    }
  };

  const requestDiaryDraft = () =>
    generateDiaryDraft({
      profile,
      locationName: currentSectorName,
      gameDate,
      dialogueHistory,
      existingTitles: diaryEntries.map((entry) => entry.title),
    });

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
    const minutes = travelMinutes(currentSectorId, sec.id);
    stepsRef.current += minutes * STEPS_PER_MINUTE;           // 傳送的耗時也算步數（骨架：傳送同樣耗步）
    advanceGameTime(minutes);   // 傳送依距離級距耗時；同區域內換房間不耗時
    commitSector(sec.id, roomId ?? null, null);
  };

  // 切換所在區域。星圖與走路穿過門口都走這裡；from 是走路時離開的區域。
  const commitSector = (sectorId: string, roomId: string | null, from: string | null) => {
    const sec = sectors.find((s) => s.id === sectorId);
    if (!sec) return;
    setCurrentSectorId(sec.id);
    setReturnRoomId(null);
    setArrivedFrom(from);
    setCurrentRoomId(roomId);
    if (sec.id === 'bridge') setBridgeEntry(value => value + 1);
    if (sec.id === 'park') {                                           // 餐廳在中央公園：推車上的蔬果自動卸貨
      const { state, kg } = deliver(supplies, 'restaurant');
      if (kg) { setSupplies(state); triggerToast(`把約 ${kg} 公斤蔬果送進了餐廳廚房。`); }
    }
    if (sec.id === 'bridge') setDialogueHistory(history => pushTurn(history, {
      playerInput: '前往艦橋',
      segments: [{ kind: 'description' as const, text: '中央平台緩緩升起，三位值勤人員朝你望來。觀景窗外，行星的弧面泛著淡藍色光；艦橋的低鳴聲在腳下逐漸安定。' }],
    }));
    // 「目前所在」是本局進度，寫進覆寫。
    setStoryOverrides((prev) => ({
      ...prev,
      sectors: Object.fromEntries(
        sectors.map((s) => [s.id, { ...prev.sectors[s.id], isCurrent: s.id === sec.id }])
      ),
    }));
  };

  // Handle reset game progress
  // 清空運行資料（數值、任務、道具、日記、對話、位置、個人資料、目標、摘要），
  // 以及故事書的本局條目與全部覆寫 —— 好感、關係、所在位置、啟用狀態都回到預設。
  // 保留故事書內建內容與系統設定。
  const handleResetProgress = () => {
    setStats(INITIAL_STATS);
    setProfile(EMPTY_PROFILE);
    setQuests([]);
    setItems([]);
    setDiaryEntries([]);
    setMemories([]);
    setNpcMemories({});
    npcMemoriesRef.current = {};
    setDialogueHistory([]);
    setObjectives(INITIAL_OBJECTIVES);
    setSummary(INITIAL_SUMMARY);

    setRunStory(EMPTY_RUN_STORY);
    setStoryOverrides(EMPTY_OVERRIDES);
    setGameDate(GAME_START_DATE);
    setGameTime(GAME_START_TIME);
    setSupplies(initialSupplies(dayNumber(GAME_START_DATE, GAME_START_TIME)));
    // 進場快取是上一局的記憶，跟著清掉。
    sceneCacheRef.current.clear();
    sceneRecallRef.current = null;
    stepsRef.current = 0;
    setSceneEpoch((value) => value + 1);

    setCurrentSectorId(START_SECTOR_ID);
    setCurrentRoomId(null);

    setActiveDrawer(null);
    setActiveModal(null);
    setStorybookTargetNpcId(null);

    // 先清掉存檔再讓自動存檔寫入重置後的狀態。
    // 少了這行，玩家若在 500ms 內關掉分頁，重開會讀回重置前的進度。
    clearGameSave();

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
  // 記憶管理視窗（通道 ① 的玩家手動新增、修改、停用、刪除）。
  const handleAddMemory = (draft: MemoryDraft) => {
    const next = addPlayerMemory(memories, draft, `mem-p-${Date.now()}`, memoryNow());
    if (next === memories) return false;
    setMemories(next);
    return true;
  };
  const memoryRegions = sectors.map((sector) => ({ id: sector.id, name: sector.name }));
  const memoryScenes = [
    ...sectors.map((sector) => ({ id: sector.id, name: ROOMS.some((room) => room.sectorId === sector.id) ? `${sector.name}走廊` : sector.name })),
    ...ROOMS.map((room) => ({ id: room.id, name: `${room.id} 房間` })),
  ];

  const handleDeleteDiaryEntry = (id: string) => {
    setDiaryEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  return (
    <div className="h-screen w-screen flex flex-col justify-between relative overflow-hidden select-none bg-[#050814] text-slate-100">
      {/* 場景層：所有介面之下的底圖 */}
      <SceneLayer sector={currentSector?.id === 'bridge' ? { ...currentSector, backgroundUrl: '/assets/bridge-v3/bridge-background-clean.webp' } : currentSector} />

      {/* Top HUD Header */}
      <HeaderHUD
        stats={stats}
        currentLocation={currentSectorName}
        memories={memoriesAt(memories, [currentSectorId, playerScene], gameDate).map((memory) => memory.content)}
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
          quickRepliesPending={quickRepliesPending}
          quickRepliesError={quickRepliesError}
          onRequestQuickReplies={requestQuickReplies}
          gmPending={gmPending}
          gmError={gmError}
          toast={toast}
          npcs={npcs}
          stage={currentSectorId === 'bridge' ? (
            <BridgeScene key={bridgeEntry} paused={activeModal !== null || activeDrawer !== null} onOpenMap={() => setActiveModal('map')} />
          ) : FACILITIES[currentSectorId] ? (
            <FacilityScene key={currentSectorId} facility={FACILITIES[currentSectorId]} arrivedFrom={arrivedFrom} paused={activeModal !== null || activeDrawer !== null} onLeave={(to) => commitSector(to, null, currentSectorId)} onNotice={triggerToast} onAction={handleFacilityAction} onWalk={handleWalk} onPosition={point => { facilityPositionRef.current = point; }} gameDate={gameDate} gameTime={gameTime} />
          ) : currentRoom ? (
            <RoomScene key={currentRoom.id} roomId={currentRoom.id} furnishing={furnishingFor(roomOccupant?.id)} npcs={presentNpcs} onInteract={(npc) => sendToGm(`我走近${npc.name}打招呼`)} onExit={() => { setReturnRoomId(currentRoom.id); setCurrentRoomId(null); }} onWalk={handleWalk} paused={activeModal !== null || activeDrawer !== null} />
          ) : CORRIDORS[currentSectorId] ? (
            <CorridorScene key={currentSectorId} corridor={CORRIDORS[currentSectorId]} playerName={profile.name} returnRoomId={returnRoomId} arrivedFrom={arrivedFrom} onEnterFacility={(to) => commitSector(to, null, currentSectorId)} paused={activeModal !== null || activeDrawer !== null} onEnterRoom={setCurrentRoomId} onNotice={triggerToast} onWalk={handleWalk} />
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
        rooms={ROOMS}
        isOpen={activeModal === 'map'}
        onClose={() => setActiveModal(null)}
        sectors={sectors}
        currentSectorId={currentSectorId}
        onEnterSector={handleEnterSector}
        memoriesFor={(sectorId) => memoriesAt(memories, [sectorId, ...ROOMS.filter((room) => room.sectorId === sectorId).map((room) => room.id)], gameDate)
          .map((memory) => memory.layer === 'scene' && memory.location !== sectorId ? `（${memory.location}）${memory.content}` : memory.content)}
      />

      {/* 2. 故事書 */}
      <StoryModal
        isOpen={activeModal === 'storybook'}
        onClose={() => {
          setActiveModal(null);
          setStorybookTargetNpcId(null);
        }}
        story={story}
        builtinSectors={builtinStory.sectors}
        rooms={ROOMS}
        playerRoomId={profile.roomId}
        onChangeChapters={changeStory('chapters')}
        onChangeNpcs={changeStory('npcs')}
        onChangeItems={changeStory('items')}
        onChangeSectors={changeStory('sectors')}
        onChangeLore={changeStory('lore')}
        onToggleEnabled={toggleStoryEntry}
        initialTab="character"
        initialCharacterId={storybookTargetNpcId}
        npcMemories={npcMemories}
        onToggleNpcLog={(npcId, logId) => setNpcMemories((prev) => toggleNpcLog(prev, npcId, logId))}
      />

      {/* 記憶管理（通道 ①） */}
      <MemoryModal
        isOpen={activeModal === 'memory'}
        onClose={() => setActiveModal(null)}
        memories={memories}
        gameDate={gameDate}
        regions={memoryRegions}
        scenes={memoryScenes}
        npcs={npcs.map((npc) => ({ id: npc.id, name: npc.name }))}
        currentRegion={currentSectorId}
        currentScene={playerScene}
        onAdd={handleAddMemory}
        onUpdate={(id, draft) => setMemories((prev) => editMemory(prev, id, draft))}
        onToggle={(id) => setMemories((prev) => toggleMemory(prev, id))}
        onDelete={(id) => setMemories((prev) => removeMemory(prev, id))}
      />

      {/* 3. 日記 */}
      <DiaryModal
        isOpen={activeModal === 'diary'}
        onClose={() => setActiveModal(null)}
        entries={diaryEntries}
        onAddEntry={handleAddDiaryEntry}
        onUpdateEntry={handleUpdateDiaryEntry}
        onDeleteEntry={handleDeleteDiaryEntry}
        playerName={profile.name}
        gameDate={gameDate}
        onGenerateDraft={requestDiaryDraft}
        onCondenseDraft={(ids) => condenseDiaryDraft({ profile, entries: diaryEntries.filter((entry) => ids.includes(entry.id)) })}
        onSaveCondensed={(ids, entry) => setDiaryEntries((prev) => condenseEntries(prev, ids, entry, `d_${Date.now()}`))}
        onSplitEntry={(id) => setDiaryEntries((prev) => splitCondensed(prev, id))}
      />

      {/* 溫室植栽監測機：這一翼作物的收成倒數與健康（健康為模擬） */}
      <MonitorModal
        wing={activeModal === 'monitor' ? monitorWing : null}
        rows={activeModal === 'monitor' ? monitorRows(GREENHOUSE_RACKS, dayNumber(gameDate, gameTime), GREENHOUSE_WIDTH, monitorWing) : []}
        onClose={() => setActiveModal(null)}
      />
      {/* 溫室工作站的生長報表 */}
      <GrowthModal
        isOpen={activeModal === 'growth'}
        onClose={() => setActiveModal(null)}
        rows={activeModal === 'growth' ? growthReport(GREENHOUSE_RACKS, dayNumber(gameDate, gameTime), GREENHOUSE_WIDTH) : []}
        gameDate={gameDate}
        gameTime={gameTime}
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
        builtinStory={builtinStory}
        onFillMissingBuiltin={() => {
          const { next, added } = fillMissingBuiltin(builtinStory);
          if (added) setBuiltinStory(next);
          return added;
        }}
      />
    </div>
  );
}
