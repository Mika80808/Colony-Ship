import type { Point } from './corridor';

export interface StandingDepth { bottom: number; sprite?: string; left?: number; right?: number }

/** Side-by-side actors stand in front of the fire table even when their feet are above its base. */
export function drawBeforePlayer(object: StandingDepth, player: Point, seated = false): boolean {
  if (object.sprite === 'window_frame') return true;
  if (seated && object.sprite === 'sofa') return true;
  if (object.sprite === 'fire_table' && object.left !== undefined && object.right !== undefined &&
      (player.x < object.left || player.x > object.right)) return true;
  return object.bottom <= player.y;
}
