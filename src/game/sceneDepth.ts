import type { Point } from './corridor';

/**
 * beside：角色站在 left–right 範圍外時一律畫在它上面（牆端、桌子側邊）。
 * front：角色腳下那一段的底邊（沿著圖輪廓的碰撞，見 tools/art/footprint.py 的 outline）。
 *   弧形沙發中間往內凹，角色站進凹處時腳已經在沙發前面，要用那一段的底邊比，不能用整張最低的底邊。
 */
export interface StandingDepth { bottom: number; id?: string; sprite?: string; left?: number; right?: number; beside?: boolean; front?: (x: number) => number }

/**
 * 物件在角色之前畫（角色蓋在它上面）就回傳 true。基本照腳點；beside 物件在角色站到左右兩側外時也先畫。
 * seatedOn：角色坐在哪件家具上（decor 的 id）；坐著時那件一律在角色底下（沙發、長椅）。
 */
export function drawBeforePlayer(object: StandingDepth, player: Point, seated = false, seatedOn?: string): boolean {
  // The window and the plants behind its glass always sit under the player.
  if (object.sprite === 'window_frame' || object.sprite === 'window_plants') return true;
  if (seated && (object.sprite === 'sofa' || (seatedOn !== undefined && object.id === seatedOn))) return true;
  if (object.beside && object.left !== undefined && object.right !== undefined &&
      (player.x < object.left || player.x > object.right)) return true;
  return Math.min(object.bottom, object.front?.(player.x) ?? object.bottom) <= player.y;
}

/**
 * 沿著輪廓的碰撞（map.json collisionRects 裡 of＝id 的那幾塊，格為單位）→ 角色腳下那一段的底邊（世界 px）。
 * 只有一塊（方的物件）就不需要，回傳 undefined；腳不在任何一塊上方時用整件的 bottom。
 */
export function frontOutline(rects: { x: number; y: number; w: number; h: number; of?: string }[], id: string, tileSize: number, bottom: number) {
  const pieces = rects.filter(r => r.of === id);
  if (pieces.length < 2) return undefined;
  return (x: number) => {
    const p = pieces.find(r => x >= r.x * tileSize && x <= (r.x + r.w) * tileSize);
    return p ? (p.y + p.h) * tileSize : bottom;
  };
}

/** 物件的圖在世界座標佔的範圍（用來判斷兩張圖有沒有疊到）。 */
export interface Box { left: number; top: number; right: number; bottom: number }
export interface Layered extends StandingDepth { box?: Box }

/**
 * 物件之間的前後：兩張圖疊到時，底邊低的後畫。objects 要先依 bottom 由小到大排好；
 * 回傳每個物件「要畫在它之後」的物件索引（只往後指，所以照 objects 的順序畫一定合法）。
 */
export function overlapOrder(objects: Layered[]): number[][] {
  return objects.map((o, i) => {
    const a = o.box, later: number[] = []; if (!a) return later;
    for (let j = i + 1; j < objects.length; j++) {
      const b = objects[j].box;
      if (b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) later.push(j);
    }
    return later;
  });
}

/**
 * 每個物件畫在角色底下（true）還是蓋在角色上面（false）。
 * 先照 drawBeforePlayer 分；蓋在角色上面的物件，凡是跟它疊到、又該畫在它之後的，也一定要在角色之後畫，
 * 否則物件之間的前後會反過來（例：角色在樹旁邊時樹被排到角色底下，後面的種植架反而蓋住樹冠）。
 * 衝突時捨棄 beside 例外，改回照腳點比；窗框、坐著時的沙發這類固定規則不動。
 * actor：角色圖的範圍。有給的話，只有真的疊到角色的物件才會強迫別的物件蓋在角色上面；
 * 沒疊到角色的物件畫在哪邊看起來都一樣，不該把旁邊家具的 beside 例外也一起取消。
 */
export function underPlayer(objects: Layered[], later: number[][], player: Point, seated = false, actor?: Box, seatedOn?: string): boolean[] {
  const under = objects.map(o => drawBeforePlayer(o, player, seated, seatedOn));
  const touches = (b?: Box) => !actor || !b || (b.left < actor.right && actor.left < b.right && b.top < actor.bottom && actor.top < b.bottom);
  const over = objects.map((o, i) => !under[i] && touches(o.box)), stack = over.flatMap((v, i) => v ? [i] : []);
  while (stack.length) for (const j of later[stack.pop()!]) if (!over[j]) { over[j] = true; stack.push(j); }
  const fixed = (o: Layered) => o.sprite === 'window_frame' || o.sprite === 'window_plants' || (seated && (o.sprite === 'sofa' || (seatedOn !== undefined && o.id === seatedOn)));
  return objects.map((o, i) => !over[i] || fixed(o));
}
