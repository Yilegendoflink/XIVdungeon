import { Path } from 'rot-js';
import type { FloorState } from '@/game/state';
import { isPassable } from '@/game/state';

const GRID_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

function canWalkGridStep(floor: FloorState, x: number, y: number, nx: number, ny: number): boolean {
  if (!isPassable(floor, nx, ny)) return false;
  const dx = nx - x;
  const dy = ny - y;
  if (dx === 0 || dy === 0) return true;
  // Prevent diagonal movement through the corner of two blocking tiles.
  return isPassable(floor, x + dx, y) && isPassable(floor, x, y + dy);
}

/** Shortest 8-direction terrain path. The target tile is allowed to contain an enemy. */
export function findTerrainPath(
  floor: FloorState,
  x: number,
  y: number,
  tx: number,
  ty: number,
): { x: number; y: number }[] {
  if (x === tx && y === ty) return [];
  if (!isPassable(floor, x, y) || !isPassable(floor, tx, ty)) return [];

  const startKey = `${x},${y}`;
  const targetKey = `${tx},${ty}`;
  const queue: { x: number; y: number }[] = [{ x, y }];
  const parents = new Map<string, { x: number; y: number } | null>([[startKey, null]]);

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (!current) break;
    if (`${current.x},${current.y}` === targetKey) break;

    for (const direction of GRID_DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = `${next.x},${next.y}`;
      if (parents.has(key)) continue;
      if (!canWalkGridStep(floor, current.x, current.y, next.x, next.y)) continue;
      parents.set(key, current);
      queue.push(next);
    }
  }

  if (!parents.has(targetKey)) return [];
  const path: { x: number; y: number }[] = [];
  let current: { x: number; y: number } | null = { x: tx, y: ty };
  while (current) {
    path.push(current);
    const parent = parents.get(`${current.x},${current.y}`);
    current = parent ?? null;
  }
  path.reverse();
  return path.slice(1);
}

export function findPath(
  floor: FloorState,
  x: number,
  y: number,
  tx: number,
  ty: number,
  blocked: Set<string> = new Set(),
): { x: number; y: number }[] {
  if (x === tx && y === ty) return [];

  const passable = (px: number, py: number) => {
    if (!isPassable(floor, px, py)) return false;
    if (px === tx && py === ty) return true;
    return !blocked.has(`${px},${py}`);
  };

  const astar = new Path.AStar(tx, ty, passable, { topology: 4 });
  const path: { x: number; y: number }[] = [];
  astar.compute(x, y, (px, py) => path.push({ x: px, y: py }));
  if (path.length < 2 || path[path.length - 1]?.x !== tx || path[path.length - 1]?.y !== ty) {
    return [];
  }
  return path.slice(1);
}

/** One step toward (tx,ty). Returns null if no path / already there. */
export function stepToward(
  floor: FloorState,
  x: number,
  y: number,
  tx: number,
  ty: number,
  blocked: Set<string>,
): { x: number; y: number } | null {
  if (x === tx && y === ty) return null;

  const passable = (px: number, py: number) => {
    if (!isPassable(floor, px, py)) return false;
    if (px === tx && py === ty) return true; // allow destination
    return !blocked.has(`${px},${py}`);
  };

  const astar = new Path.AStar(tx, ty, passable, { topology: 4 });
  const path: { x: number; y: number }[] = [];
  astar.compute(x, y, (px, py) => {
    path.push({ x: px, y: py });
  });

  // path[0] is current, path[1] is next step
  if (path.length < 2) return null;
  return path[1];
}

/** One step away from (fx,fy). Prefers increasing Chebyshev/manhattan distance. */
export function stepAway(
  floor: FloorState,
  x: number,
  y: number,
  fx: number,
  fy: number,
  blocked: Set<string>,
): { x: number; y: number } | null {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  const curDist = Math.abs(x - fx) + Math.abs(y - fy);
  let best: { x: number; y: number } | null = null;
  let bestDist = curDist;

  for (const d of dirs) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (!isPassable(floor, nx, ny)) continue;
    if (blocked.has(`${nx},${ny}`)) continue;
    const dist = Math.abs(nx - fx) + Math.abs(ny - fy);
    if (dist > bestDist) {
      bestDist = dist;
      best = { x: nx, y: ny };
    }
  }
  return best;
}
