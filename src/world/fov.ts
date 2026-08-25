import { FOV } from 'rot-js';
import { VIEW_RADIUS } from '@/config';
import type { FloorState } from '@/game/state';
import { idx, inBounds } from '@/game/state';

/** Update floor visibility from observer position (mutates floor.visibility). */
export function computeFOV(floor: FloorState, ox: number, oy: number): void {
  for (let i = 0; i < floor.visibility.length; i++) {
    if (floor.visibility[i] === 'visible') {
      floor.visibility[i] = 'explored';
    }
  }

  const fov = new FOV.RecursiveShadowcasting((x, y) => {
    if (!inBounds(x, y, floor.width, floor.height)) return false;
    return floor.tiles[idx(x, y, floor.width)] !== 'wall';
  });

  fov.compute(ox, oy, VIEW_RADIUS, (x, y) => {
    if (inBounds(x, y, floor.width, floor.height)) {
      floor.visibility[idx(x, y, floor.width)] = 'visible';
    }
  });
}

/** Whether an observer at (ox,oy) can see (tx,ty) within VIEW_RADIUS. */
export function canSee(
  floor: FloorState,
  ox: number,
  oy: number,
  tx: number,
  ty: number,
): boolean {
  let seen = false;
  const fov = new FOV.RecursiveShadowcasting((x, y) => {
    if (!inBounds(x, y, floor.width, floor.height)) return false;
    return floor.tiles[idx(x, y, floor.width)] !== 'wall';
  });

  fov.compute(ox, oy, VIEW_RADIUS, (x, y) => {
    if (x === tx && y === ty) seen = true;
  });
  return seen;
}
