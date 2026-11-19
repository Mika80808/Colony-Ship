import { useMemo, useRef } from 'react';
import FacilityScene from './FacilityScene';
import { createRoomExtras } from '../game/roomExtras';
import { roomFolder } from '../game/rooms';
import type { NPCData } from '../types';

/**
 * 居住區房間：設施場景（public/assets/rooms/<住戶>/map.json，由 tools/art/room_map.py 產生；沒有陳設的是 rooms/empty）。
 * 房門、淋浴、側邊沙發扶手在 game/roomExtras.ts；在場的 NPC 照 map.json 的 patrol 巡遊，走近按 E 交談。
 */
interface Props {
  /** Which room this is. Mount a new RoomScene (key by room id) to change rooms. */
  roomId: string;
  /** 住戶 id（決定陳設）；空字串＝空房。 */
  occupant: string;
  /** Everyone whose schedule puts them in this room right now. Each walks with their own walkUrl. */
  npcs: NPCData[];
  paused: boolean; onInteract: (npc: NPCData) => void; onExit: () => void;
  /** 每幀走了幾 px（推進遊戲時間用，見 game/clock.ts）。 */
  onWalk?: (px: number) => void;
  onNotice: (text: string) => void;
  gameDate: string; gameTime: string;
}

export default function RoomScene({ roomId, occupant, npcs, paused, onInteract, onExit, onWalk, onNotice, gameDate, gameTime }: Props) {
  const folder = `rooms/${roomFolder(occupant)}`;
  // App 每次重繪都給新的 onExit：用 ref 接，演出狀態才不會每幀重來
  const exitRef = useRef(onExit); exitRef.current = onExit;
  const extras = useMemo(() => createRoomExtras({ folder, onExit: () => exitRef.current() }), [folder]);
  // 房門：走到門口後播開門動畫再離開；淋浴：站進去就好，沒有文字
  const onAction = (item: { id: string }) => {
    if (item.id === 'room-door') { extras.leave(); return true; }
    if (item.id === 'shower') return true;
    return false;
  };
  return <FacilityScene facility={{ folder, name: `${roomId} 房間` }} paused={paused} extras={extras} npcs={npcs}
    onTalk={id => { const npc = npcs.find(n => n.id === id); if (npc) onInteract(npc); }}
    onLeave={() => {}} onNotice={onNotice} onAction={onAction} onWalk={onWalk} gameDate={gameDate} gameTime={gameTime} />;
}
