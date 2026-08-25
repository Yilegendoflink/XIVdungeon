import { RNG, Map as ROTMap } from 'rot-js';
import { BOSS_FLOOR_NUMBER, MAP_W, MAP_H } from '@/config';
import type { TileKind, VisibilityKind } from '@/config';
import type {
  EnemyState,
  FloorObjectiveState,
  FloorState,
  ItemState,
  ItemType,
} from '@/game/state';
import { idx } from '@/game/state';
import { ENEMY_DEFS } from '@/data/enemies';
import { ITEM_TYPES } from '@/data/items';

interface Room {
  cx: number;
  cy: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function roomCenterFloor(tiles: TileKind[], room: Room): { x: number; y: number } {
  // Prefer room center; fall back to first floor tile inside room.
  if (tiles[idx(room.cx, room.cy)] !== 'wall') {
    return { x: room.cx, y: room.cy };
  }
  for (let y = room.top; y <= room.bottom; y++) {
    for (let x = room.left; x <= room.right; x++) {
      if (tiles[idx(x, y)] !== 'wall') return { x, y };
    }
  }
  return { x: room.cx, y: room.cy };
}

function randomFreeFloorInRooms(
  tiles: TileKind[],
  rooms: Room[],
  enemies: EnemyState[],
  items: ItemState[],
  blocked: Set<number>,
): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = [];
  for (const room of rooms) {
    for (let y = room.top; y <= room.bottom; y++) {
      for (let x = room.left; x <= room.right; x++) {
        if (tiles[idx(x, y)] !== 'wall' && !occupied(x, y, enemies, items, blocked)) {
          candidates.push({ x, y });
        }
      }
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(RNG.getUniform() * candidates.length)];
}

function randomFreeFloorInRoom(
  tiles: TileKind[],
  room: Room,
  enemies: EnemyState[],
  items: ItemState[],
  blocked: Set<number>,
): { x: number; y: number } | null {
  return randomFreeFloorInRooms(tiles, [room], enemies, items, blocked);
}

function occupied(
  x: number,
  y: number,
  enemies: EnemyState[],
  items: ItemState[],
  blocked: Set<number>,
): boolean {
  const i = idx(x, y);
  if (blocked.has(i)) return true;
  if (enemies.some((e) => e.x === x && e.y === y)) return true;
  if (items.some((it) => it.x === x && it.y === y)) return true;
  return false;
}

function createObjective(floorNumber: number): FloorObjectiveState {
  if (floorNumber >= BOSS_FLOOR_NUMBER) {
    return { type: 'finalBoss', target: 1, progress: 0, label: '击败最终 Boss' };
  }

  const template = Math.floor(RNG.getUniform() * 3);
  switch (template) {
    case 0:
      return { type: 'findExit', target: 0, progress: 0, label: '找到出口' };
    case 1: {
      const target = 5 + Math.floor(RNG.getUniform() * 6);
      return { type: 'defeatCount', target, progress: 0, label: `击败 ${target} 个敌人` };
    }
    default:
      return { type: 'defeatSpecial', target: 1, progress: 0, label: '击败特殊敌人' };
  }
}

/** Generate a random floor with an objective, entrance, exit, enemies and items. */
export function generateFloor(seed: number, floorNumber = 1): FloorState {
  RNG.setSeed(seed);
  idCounter = 0;
  const objective = createObjective(floorNumber);

  const tiles = new Array<TileKind>(MAP_W * MAP_H).fill('wall');
  const visibility = new Array<VisibilityKind>(MAP_W * MAP_H).fill('unseen');

  const digger = new ROTMap.Digger(MAP_W, MAP_H, {
    roomWidth: [4, 8],
    roomHeight: [4, 6],
  });

  // rot.js: 0 = floor (dug), 1 = wall
  digger.create((x, y, value) => {
    tiles[idx(x, y)] = value === 0 ? 'floor' : 'wall';
  });

  const rooms: Room[] = digger.getRooms().map((r) => ({
    left: r.getLeft(),
    top: r.getTop(),
    right: r.getRight(),
    bottom: r.getBottom(),
    cx: Math.floor((r.getLeft() + r.getRight()) / 2),
    cy: Math.floor((r.getTop() + r.getBottom()) / 2),
  }));

  if (rooms.length === 0) {
    // Degenerate fallback — open a small room
    for (let y = 12; y < 20; y++) {
      for (let x = 12; x < 20; x++) tiles[idx(x, y)] = 'floor';
    }
    rooms.push({ left: 12, top: 12, right: 19, bottom: 19, cx: 15, cy: 15 });
  }

  const entranceRoom = rooms[0];
  const entrance = roomCenterFloor(tiles, entranceRoom);
  const entranceIndex = idx(entrance.x, entrance.y);
  tiles[entranceIndex] = 'entrance';

  const exitRooms = rooms.filter((r) => r !== entranceRoom);
  let exitRoom = exitRooms[exitRooms.length - 1] ?? entranceRoom;
  let exit: { x: number; y: number };

  if (exitRooms.length === 0) {
    let candidate: { x: number; y: number } | null = null;
    let maxDist = -1;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tileIndex = idx(x, y);
        if (tileIndex === entranceIndex || tiles[tileIndex] === 'wall') continue;
        const dist = Math.abs(x - entrance.x) + Math.abs(y - entrance.y);
        if (dist > maxDist) {
          maxDist = dist;
          candidate = { x, y };
        }
      }
    }
    if (!candidate) throw new Error('Unable to place a distinct exit');
    exit = candidate;
  } else {
    let maxDist = -1;
    for (const r of exitRooms) {
      const c = roomCenterFloor(tiles, r);
      const dist = Math.abs(c.x - entrance.x) + Math.abs(c.y - entrance.y);
      if (dist > maxDist) {
        maxDist = dist;
        exitRoom = r;
      }
    }
    exit = roomCenterFloor(tiles, exitRoom);
  }

  const exitIndex = idx(exit.x, exit.y);
  tiles[exitIndex] = 'exit';

  const blocked = new Set<number>([entranceIndex, exitIndex]);
  const enemies: EnemyState[] = [];
  const items: ItemState[] = [];

  const otherRooms = rooms.filter((r) => r !== entranceRoom && r !== exitRoom);
  // Shuffle
  for (let i = otherRooms.length - 1; i > 0; i--) {
    const j = Math.floor(RNG.getUniform() * (i + 1));
    [otherRooms[i], otherRooms[j]] = [otherRooms[j], otherRooms[i]];
  }

  const normalEnemyCount = objective.type === 'defeatCount'
    ? objective.target
    : objective.type === 'finalBoss'
      ? 0
      : 3 + Math.floor(RNG.getUniform() * 3);

  const enemyRooms = otherRooms.length > 0 ? otherRooms : rooms;
  for (let i = 0; i < normalEnemyCount; i++) {
    const pos = randomFreeFloorInRooms(tiles, enemyRooms, enemies, items, blocked);
    if (!pos) break;
    const type = RNG.getUniform() < 0.5 ? 'bomb' : 'cactuar';
    const def = ENEMY_DEFS[type];
    enemies.push({
      id: nextId('enemy'),
      type,
      x: pos.x,
      y: pos.y,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      def: def.def,
      isSpecial: false,
      isBoss: false,
    });
  }

  if (objective.type === 'defeatSpecial' || objective.type === 'finalBoss') {
    const specialPos = randomFreeFloorInRooms(tiles, enemyRooms, enemies, items, blocked);
    if (!specialPos) throw new Error('无法放置特殊敌人');
    const def = ENEMY_DEFS.morbol;
    const isBoss = objective.type === 'finalBoss';
    const hp = isBoss ? def.hp * 2 : def.hp;
    enemies.push({
      id: nextId('enemy'),
      type: 'morbol',
      x: specialPos.x,
      y: specialPos.y,
      hp,
      maxHp: hp,
      atk: isBoss ? def.atk + 2 : def.atk,
      def: isBoss ? def.def + 1 : def.def,
      isSpecial: true,
      isBoss,
    });
  }

  const itemRooms = rooms.filter((r) => r !== entranceRoom);
  const itemRoomPool = itemRooms.length > 0 ? itemRooms : [entranceRoom];
  const numItems = Math.min(itemRoomPool.length, 2 + Math.floor(RNG.getUniform() * 2));
  for (let i = 0; i < numItems; i++) {
    const room = itemRoomPool[Math.floor(RNG.getUniform() * itemRoomPool.length)];
    const pos = randomFreeFloorInRoom(tiles, room, enemies, items, blocked);
    if (!pos) continue;
    const type: ItemType = ITEM_TYPES[Math.floor(RNG.getUniform() * ITEM_TYPES.length)];
    items.push({ id: nextId('item'), type, x: pos.x, y: pos.y });
  }

  return {
    width: MAP_W,
    height: MAP_H,
    tiles,
    visibility,
    entranceIndex,
    exitIndex,
    number: floorNumber,
    isBossFloor: floorNumber >= BOSS_FLOOR_NUMBER,
    exitUnlocked: objective.type === 'findExit',
    objective,
    enemies,
    items,
  };
}
