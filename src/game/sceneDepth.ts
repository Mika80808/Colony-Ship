import type { Point } from './corridor';

/** beside：角色站在 left–right 範圍外時一律畫在它上面（牆端、桌子側邊）。 */
export interface StandingDepth { bottom: number; sprite?: string; left?: number; right?: number; beside?: boolean }

/** Side-by-side actors stand in front of the fire table even when their feet are above its base. */
export function drawBeforePlayer(object: StandingDepth, player: Point, seated = false): boolean {
  // The window and the plants behind its glass always sit under the player.
  if (object.sprite === 'window_frame' || object.sprite === 'window_plants') return true;
  if (seated && object.sprite === 'sofa') return true;
  if ((object.sprite === 'fire_table' || object.beside) && object.left !== undefined && object.right !== undefined &&
      (player.x < object.left || player.x > object.right)) return true;
  return object.bottom <= player.y;
}
