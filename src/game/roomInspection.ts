import { FOOTPRINT } from './roomFurniture';
import { canTraverse, Direction, Point } from './roomNavigation';
import { PIECES, RoomPiece } from './roomRuntime';

/** Furniture carrying a description, paired with the box the player reaches for. */
const targets = () => PIECES.filter(piece => piece.inspectText)
  .flatMap(piece => (piece.solid ?? []).map(rect => ({ piece, rect })));

export function nearbyInspection(position: Point, direction: Direction): RoomPiece | undefined {
  const facing = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[direction];
  return targets().map(({ piece, rect: r }) => {
    const nearest = { x: Math.max(r.x, Math.min(position.x, r.x + r.width)), y: Math.max(r.y, Math.min(position.y, r.y + r.height)) };
    const dx = nearest.x - position.x, dy = nearest.y - position.y;
    const distance = Math.hypot(dx, dy);
    const clearance = Math.min(
      dx ? FOOTPRINT.halfWidth * distance / Math.abs(dx) : Infinity,
      dy ? FOOTPRINT.halfDepth * distance / Math.abs(dy) : Infinity,
    );
    const reach = Math.max(0, distance - clearance - 1);
    const approach = { x: position.x + dx / (distance || 1) * reach, y: position.y + dy / (distance || 1) * reach };
    return { item: piece, distance, visible: dx * facing.x + dy * facing.y > 0 && canTraverse(position, approach) };
  }).filter(entry => entry.distance <= 55 && entry.visible).sort((a, b) => a.distance - b.distance)[0]?.item;
}
