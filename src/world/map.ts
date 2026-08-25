import type { FloorState } from '@/game/state';
import { idx } from '@/game/state';

export function tileAt(floor: FloorState, x: number, y: number) {
  return floor.tiles[idx(x, y, floor.width)];
}

export function setVisibility(
  floor: FloorState,
  x: number,
  y: number,
  value: FloorState['visibility'][number],
): void {
  floor.visibility[idx(x, y, floor.width)] = value;
}
