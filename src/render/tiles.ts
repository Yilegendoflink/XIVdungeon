import { Graphics } from 'pixi.js';
import { TILE_SIZE } from '@/config';
import type { TileKind, VisibilityKind } from '@/config';

const TILE_COLOR: Record<TileKind, number> = {
  wall: 0x2c2c3e,
  floor: 0x8b7355,
  entrance: 0x4caf50,
  exit: 0x42a5f5,
};

export function drawTile(
  g: Graphics,
  kind: TileKind,
  visibility: VisibilityKind,
  lockedExit: boolean,
): void {
  if (visibility === 'unseen') return;

  let color = TILE_COLOR[kind];
  if (kind === 'exit' && lockedExit) color = 0x555577;

  g.rect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fill(color);

  if (visibility === 'explored') {
    g.rect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fill({ color: 0x000000, alpha: 0.45 });
  }
}
