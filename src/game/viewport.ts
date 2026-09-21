/**
 * Shared camera framing for every walkable scene.
 *
 * Scenes used to size themselves independently: the corridor fitted its 996-unit
 * height to the viewport while the room fitted its whole 1254-unit square, which
 * left the player 35% smaller indoors. Both now frame the same vertical slice of
 * world through `fitViewport`, so a world unit is the same number of screen
 * pixels everywhere and the player sprite keeps one size across scenes.
 */

/** Vertical slice of the world every scene shows, in world units. */
export const VIEW_HEIGHT = 996;
/** Narrowest horizontal slice we allow; below this the scene zooms out instead. */
export const MIN_VIEW_WIDTH = 1000;
/** Height of a standing character in world units, shared by every scene. */
export const ACTOR_HEIGHT = 148;
/** How quickly a following camera closes the gap to its target, per second. */
export const CAMERA_FOLLOW = 9;

export interface Viewport {
  /** Canvas backing width in world units. */
  width: number;
  /** Canvas backing height in world units. */
  height: number;
  /** Screen pixels per world unit. */
  scale: number;
}

/** Frames `world` inside a container so every scene renders at the same zoom. */
export function fitViewport(containerWidth: number, containerHeight: number, worldWidth: number, worldHeight: number): Viewport {
  const height = Math.min(VIEW_HEIGHT, worldHeight);
  const width = Math.min(worldWidth, Math.max(MIN_VIEW_WIDTH, height * containerWidth / Math.max(1, containerHeight)));
  return { width, height, scale: Math.min(containerWidth / width, containerHeight / height) };
}

/** Camera origin that centres `focus` without panning past the world edge. */
export function cameraTarget(focus: number, view: number, world: number): number {
  return Math.max(0, Math.min(world - view, focus - view / 2));
}

/** Frame-rate independent ease towards `target`. */
export function approach(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-CAMERA_FOLLOW * dt));
}
