import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { findPath, interactions, keyboardTarget, move, nearby, segmentClear, spawn, walkable, type FacilityMap } from './facility';
import { canTalk, createNpc, stepNpc } from './facilityNpc';
import { FURNISHED, roomFolder } from './rooms';
import { behindShowerGlass, doorFrame, inZone, type ShowerSpec } from './roomExtras';

// 居住區房間改用設施場景格式（tools/art/room_map.py 產生）。原本房間的測試檢查的行為都要還在。
type RoomMap = FacilityMap & { shower: ShowerSpec };
const load = (folder: string): RoomMap => JSON.parse(readFileSync(`public/assets/rooms/${folder}/map.json`, 'utf8'));
const room = load('lucian'), empty = load('empty');
const EXIT = { x: 310, y: 1020 };
const pathOk = (m: FacilityMap, a: { x: number; y: number }, b: { x: number; y: number }) => {
  const path = findPath(m, a, b); if (!path.length) return false;
  let prev = a; for (const p of path) { if (!segmentClear(m, prev, p)) return false; prev = p; }
  return true;
};

// 每位有陳設的住戶都有自己的房間地圖；其他人（含沒人住）用空房
assert.deepEqual(readdirSync('public/assets/rooms/furnishings').map(f => f.replace('.json', '')).sort(), [...FURNISHED].sort(), 'FURNISHED matches the furnishing files');
for (const id of FURNISHED) assert.ok(existsSync(`public/assets/rooms/${id}/map.json`), `${id} has a generated room`);
assert.equal(roomFolder('lucian'), 'lucian'); assert.equal(roomFolder('blaze'), 'empty'); assert.equal(roomFolder(''), 'empty');

for (const [name, m] of [['lucian', room], ['empty', empty]] as const) {
  assert.equal(m.speed, 160, `${name}: walking speed is unchanged`);
  assert.ok(Math.hypot(spawn(m).x - EXIT.x, spawn(m).y - EXIT.y) < .01, `${name}: you walk in at the door`);
  // 牆：窗下、中央隔牆、浴室的牆都擋；浴室只從下方門口進出
  assert.equal(walkable(m, { x: 490, y: 200 }), false, 'Window wall blocks the north of the living room');
  assert.ok(pathOk(m, { x: 320, y: 980 }, EXIT), 'Room exit remains reachable');
  for (const [a, b] of [[{ x: 760, y: 800 }, { x: 920, y: 820 }], [{ x: 920, y: 820 }, { x: 760, y: 800 }], [{ x: 900, y: 500 }, { x: 1121, y: 793 }]])
    assert.ok(pathOk(m, a, b), `${name}: bathroom reachable ${a.x},${a.y} → ${b.x},${b.y}`);
  assert.equal(segmentClear(m, { x: 790, y: 800 }, { x: 900, y: 800 }), false, 'West wall blocks direct crossing');
  assert.equal(segmentClear(m, { x: 960, y: 520 }, { x: 960, y: 640 }), false, 'North wall blocks direct crossing');
  assert.ok(move(m, { x: 790, y: 800 }, 300, 0).x < 830, 'Large steps cannot tunnel through the bathroom wall');
  assert.ok(pathOk(m, { x: 300, y: 540 }, { x: 800, y: 320 }), 'Cross-room path goes around the central wall');
  // 淋浴間：從下方門口走得進去，站進去就在洗澡；後面、兩側的牆擋住；從前面走得出來
  assert.ok(walkable(m, { x: 1121, y: 793 }) && inZone({ x: 1121, y: 793 }, m.shower.zone), 'Shower can be entered through bathroom doorway');
  for (const [x, y, why] of [[1120, 755, 'Back wall blocks the old forehead-level shower position'], [1095, 790, 'Left panel blocks sideways movement'], [1147, 790, 'Right panel blocks sideways movement']] as const)
    assert.equal(walkable(m, { x, y }), false, why);
  assert.ok(move(m, { x: 1121, y: 793 }, 0, 120).y > 830, 'Keyboard can leave through the front of the cabin');
  // 南側矮牆：腳可以走進牆後面一點（被前景蓋住下半身），但穿不過去；貼著矮牆也能按 E 出門
  let deepest = EXIT.y; while (walkable(m, { x: EXIT.x, y: deepest + 1 })) deepest++;
  assert.ok(Math.abs(deepest - (1043 + 72 - 14)) <= 4, `Feet stand behind the parapet base, as before (${deepest})`);
  const items = interactions(m);
  assert.equal(nearby({ x: EXIT.x, y: deepest }, items)?.id, 'room-door', 'E opens the door when pressed flush against the parapet');
  assert.equal(nearby({ x: EXIT.x, y: EXIT.y - 100 }, items)?.id === 'room-door', false, 'not from the middle of the room');
}

// 陳設：家具都擋住，旁邊的走道還能走；咖啡桌點不進去；床的側邊、咖啡桌側邊擋住腳寬
{
  for (const p of [{ x: 690, y: 600 }, { x: 845, y: 800 }, { x: 1000, y: 580 }, { x: 440, y: 640 }, { x: 107, y: 780 }, { x: 110, y: 660 }, { x: 1140, y: 280 }, { x: 966, y: 996 }, { x: 101, y: 995 }, { x: 130, y: 460 }, { x: 430, y: 250 }])
    assert.equal(walkable(room, p), false, `Solid object at ${JSON.stringify(p)}`);
  assert.deepEqual(findPath(room, { x: 320, y: 980 }, { x: 440, y: 640 }), [], 'Click on coffee table does not path into it');
  assert.equal(walkable(room, { x: 820, y: 320 }), false, 'Feet cannot clip the side of the bed');
  assert.equal(walkable(room, { x: 800, y: 320 }), true, 'Bedroom aisle beside bed stays usable');
  assert.equal(walkable(room, { x: 350, y: 640 }), false, 'Foot width blocks coffee-table side overlap');
  assert.equal(walkable(room, { x: 330, y: 640 }), true, 'Floor beside coffee table stays usable');
  assert.ok(pathOk(room, { x: 301.5, y: 921.2 }, { x: 920, y: 900 }), 'Off-grid retargeting can reach narrow bathroom aisle');
  assert.equal(walkable(empty, { x: 440, y: 640 }), true, 'an empty room has no coffee table');
}

// 互動：查看、座位、床、淋浴、房門都在，站位都走得到、在感應範圍裡
{
  const items = interactions(room);
  assert.deepEqual(items.map(i => i.id).sort(), ['bed-left', 'bed-right', 'inspect-fridge', 'inspect-game-cabinet', 'inspect-skateboard', 'room-door', 'seat-desk-chair', 'seat-sofa-south', 'seat-sofa-west', 'shower']);
  for (const i of items) {
    assert.ok(walkable(room, i.point), `${i.id}: stand point is floor`);
    assert.ok(pathOk(room, EXIT, i.point), `${i.id}: reachable from the door`);
    assert.equal(nearby(i.point, items.filter(o => o.id === i.id))?.id, i.id, `${i.id}: in reach at its stand point`);
    if (i.exit) assert.ok(walkable(room, i.exit), `${i.id}: getting up lands on floor`);
  }
  // 查看：站在家具旁才看得到，離太遠不行（同一處也能坐下時，原本按 E 也是先坐下）
  const info = items.filter(i => i.kind === 'info');
  assert.equal(nearby({ x: 200, y: 420 }, info)?.id, 'inspect-fridge');
  assert.equal(keyboardTarget({ x: 200, y: 420 }, items)?.id, 'seat-desk-chair', 'by the desk chair, E sits down first, as before');
  assert.match(items.find(i => i.id === 'inspect-fridge')!.text, /幾乎都是飲料/);
  assert.equal(keyboardTarget({ x: 150, y: 1000 }, items)?.id, 'inspect-skateboard');
  assert.equal(nearby({ x: 430, y: 300 }, info)?.id, 'inspect-game-cabinet');
  assert.equal(nearby({ x: 300, y: 460 }, items.filter(i => i.kind === 'info')), undefined, 'Distant objects cannot be inspected');
  // 座位：面向照原本，坐著時椅子在角色底下；從房間另一頭坐不下去
  const seat = (id: string) => items.find(i => i.id === id)!;
  assert.equal(seat('seat-desk-chair').facing, 'up'); assert.equal(seat('seat-sofa-south').facing, 'left'); assert.equal(seat('seat-sofa-west').facing, 'down');
  assert.equal(nearby({ x: 900, y: 900 }, [seat('seat-sofa-west')]), undefined, 'Cannot sit from across the room');
  assert.equal(walkable(room, { x: 239, y: 322 }), false, 'Chair remains solid during ordinary movement');
  // 床：左右兩邊各自一個；躺著的排序線在床和被單之間；從房間另一頭上不了床
  const left = seat('bed-left'), right = seat('bed-right'), bed = room.decor!.find(d => d.id === 'bed-base')!, blanket = room.decor!.find(d => d.id === 'bed-blanket')!;
  assert.ok(left.seat!.x < right.seat!.x, 'the left pillow is left of the right one');
  assert.ok(bed.sortY! * room.tileSize < left.sortY! && left.sortY! < blanket.sortY! * room.tileSize, 'lying sorts between the bed and its blanket');
  assert.equal(nearby({ x: 300, y: 900 }, [left, right]), undefined, 'E cannot enter bed from across the room');
  assert.equal(keyboardTarget({ x: 1080, y: 304 }, items)?.id, 'bed-right', 'E from right bedside chooses right pillow');
  assert.equal(keyboardTarget({ x: 808, y: 304 }, items)?.id, 'bed-left');
  assert.ok(pathOk(room, right.exit!, EXIT), 'Door is reachable after getting up');
}

// 淋浴玻璃：門口一帶在玻璃後面（玻璃半透明），淋浴間外面、旁邊不算
{
  const s = room.shower;
  for (const y of [787, 790, 799, 800, 801, 805, 810, 812]) assert.equal(behindShowerGlass({ x: 1120, y }, s), true, `Glass stays translucent throughout doorway overlap at y=${y}`);
  assert.equal(inZone({ x: 1120, y: 805 }, s.zone), false, 'Doorway overlap extends beyond the bathing trigger');
  for (const y of [813, 814, 820, 840]) assert.equal(behindShowerGlass({ x: 1120, y }, s), false, 'Outside actors draw in front of the glass');
  assert.equal(behindShowerGlass({ x: 980, y: 805 }, s), false, 'Actors beside the cabin do not affect its glass');
  assert.equal(inZone({ x: 1121, y: 830 }, s.zone), false, 'Leaving the shower restores clothing');
}

// 房門動畫：門先開，再淡出，1.25 秒後離開
assert.equal(doorFrame(0).open, 0); assert.equal(doorFrame(.7).open, 1); assert.equal(doorFrame(.85).fade, 0);
assert.equal(doorFrame(1.25).fade, 1); assert.equal(doorFrame(1.2).done, false); assert.equal(doorFrame(1.25).done, true);

// NPC：照巡遊點走、不穿牆；玩家走近就停下；隔著中央隔牆不能說話
{
  const npc = createNpc(room, 'lucian', 0), far = { x: 1000, y: 1000 };
  for (let i = 0; i < 400; i++) { stepNpc(room, npc, 1 / 20, far); assert.ok(walkable(room, npc.position), 'NPC patrol never leaves the floor'); }
  assert.ok(canTalk(room, { x: 300, y: 540 }, { ...npc, position: { x: 380, y: 540 } }));
  assert.equal(canTalk(room, { x: 300, y: 540 }, { ...npc, position: { x: 500, y: 540 } }), false, 'too far');
  assert.equal(canTalk(room, { x: 640, y: 500 }, { ...npc, position: { x: 740, y: 500 } }), false, 'No interaction across partition');
}
console.log('Room maps: walls, furniture, shower, bed, seats, inspection, door, NPC passed.');
