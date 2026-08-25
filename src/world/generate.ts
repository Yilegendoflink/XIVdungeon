import { RNG, Map as ROTMap } from 'rot-js';
import { BOSS_FLOOR_NUMBER, MAP_W, MAP_H } from '@/config';
import type { TileKind, VisibilityKind } from '@/config';
import type {
  EnemyState,
  EnemyType,
  FloorObjectiveState,
  FloorObjectiveType,
  FloorState,
  ItemState,
  ItemType,
} from '@/game/state';
import { idx } from '@/game/state';
import { ENEMY_DEFS, getEnemyFloorRule } from '@/data/enemies';
import { ITEM_TYPES } from '@/data/items';

export type MapTemplate = 'baseline' | 'findExitBranches' | 'boss';
export type RoomSize = 'small' | 'large';
export type RoomRole = 'normal' | 'branch' | 'entrance' | 'exit' | 'boss';
export type ConnectionKind = 'cycle' | 'branch' | 'chord' | 'shortcut';

export interface Room {
  id: number;
  size: RoomSize;
  role: RoomRole;
  cx: number;
  cy: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CorridorLayout {
  id: number;
  fromRoomId: number;
  toRoomId: number;
  cells: { x: number; y: number }[];
  width: 1;
}

export interface RoomConnection {
  fromRoomId: number;
  toRoomId: number;
  kind: ConnectionKind;
  corridorId: number;
}

export interface MapLayout {
  template: MapTemplate;
  tiles: TileKind[];
  rooms: Room[];
  corridors: CorridorLayout[];
  connections: RoomConnection[];
  loopRoomIds: number[];
  entranceRoomId: number;
  exitRoomId: number;
  entrance: { x: number; y: number };
  exit: { x: number; y: number };
}

interface Point {
  x: number;
  y: number;
}

interface Slot extends Point {}

const STRUCTURED_LAYOUT_SALT = 0x51f15e;
const CONTENT_SALT = 0x2e7a91;

let idCounter = 0;
const NORMAL_ENEMY_TYPES = ['bomb', 'cactuar'] as const;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(RNG.getUniform() * (max - min + 1));
}

function phaseSeed(seed: number, floorNumber: number, salt: number): number {
  return (Math.imul(seed | 0, 1664525) + Math.imul(floorNumber, 1013904223) + salt) >>> 0;
}

export function mapTemplateForObjective(type: FloorObjectiveType): MapTemplate {
  switch (type) {
    case 'findExit':
      return 'findExitBranches';
    case 'finalBoss':
      return 'boss';
    case 'defeatCount':
    case 'defeatSpecial':
      return 'baseline';
  }
}

function roomCenterFloor(tiles: TileKind[], room: Room): Point {
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
): Point | null {
  const candidates: Point[] = [];
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
): Point | null {
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

function roomContains(room: Room, point: Point): boolean {
  return (
    point.x >= room.left && point.x <= room.right &&
    point.y >= room.top && point.y <= room.bottom
  );
}

function roomAt(rooms: Room[], point: Point): Room | undefined {
  return rooms.find((room) => roomContains(room, point));
}

function roomsOverlap(a: Room, b: Room, padding = 1): boolean {
  return !(
    a.right + padding < b.left ||
    b.right + padding < a.left ||
    a.bottom + padding < b.top ||
    b.bottom + padding < a.top
  );
}

function createRoom(id: number, slot: Slot, size: RoomSize, role: RoomRole): Room {
  const width = randomInt(size === 'large' ? 8 : 4, size === 'large' ? 10 : 6);
  const height = randomInt(size === 'large' ? 6 : 4, size === 'large' ? 8 : 5);
  const left = Math.max(2, Math.min(MAP_W - 1 - width, slot.x - Math.floor(width / 2)));
  const top = Math.max(2, Math.min(MAP_H - 1 - height, slot.y - Math.floor(height / 2)));
  const right = left + width - 1;
  const bottom = top + height - 1;
  return {
    id,
    size,
    role,
    left,
    top,
    right,
    bottom,
    cx: Math.floor((left + right) / 2),
    cy: Math.floor((top + bottom) / 2),
  };
}

function loopSlots(loopCount: number): Slot[] {
  switch (loopCount) {
    case 3:
      return [{ x: 5, y: 16 }, { x: 16, y: 5 }, { x: 26, y: 16 }];
    case 4:
      return [{ x: 5, y: 16 }, { x: 16, y: 5 }, { x: 26, y: 16 }, { x: 16, y: 26 }];
    case 5:
      return [
        { x: 5, y: 16 },
        { x: 10, y: 5 },
        { x: 22, y: 5 },
        { x: 26, y: 16 },
        { x: 16, y: 26 },
      ];
    default:
      throw new Error(`Unsupported loop size: ${loopCount}`);
  }
}

function branchSlots(): Slot[] {
  return [{ x: 5, y: 26 }, { x: 26, y: 5 }, { x: 26, y: 26 }];
}

function carveRoom(tiles: TileKind[], room: Room): void {
  for (let y = room.top; y <= room.bottom; y++) {
    for (let x = room.left; x <= room.right; x++) {
      tiles[idx(x, y)] = 'floor';
    }
  }
}

function boundaryPoint(from: Room, to: Room): Point {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? from.right : from.left,
      y: Math.max(from.top, Math.min(from.bottom, to.cy)),
    };
  }
  return {
    x: Math.max(from.left, Math.min(from.right, to.cx)),
    y: dy >= 0 ? from.bottom : from.top,
  };
}

function orthogonalPath(start: Point, end: Point, horizontalFirst: boolean): Point[] {
  const path: Point[] = [{ ...start }];
  const addLine = (axis: 'x' | 'y', target: number) => {
    const current = path[path.length - 1];
    const delta = target - current[axis];
    const step = Math.sign(delta);
    for (let i = 0; i < Math.abs(delta); i++) {
      const next = { ...path[path.length - 1] };
      next[axis] += step;
      path.push(next);
    }
  };

  if (horizontalFirst) {
    addLine('x', end.x);
    addLine('y', end.y);
  } else {
    addLine('y', end.y);
    addLine('x', end.x);
  }
  return path;
}

function pathCrossesOtherRoom(path: Point[], rooms: Room[], fromRoomId: number, toRoomId: number): boolean {
  return path.some((point) => {
    const room = roomAt(rooms, point);
    return room !== undefined && room.id !== fromRoomId && room.id !== toRoomId;
  });
}

function connectRooms(
  tiles: TileKind[],
  rooms: Room[],
  corridors: CorridorLayout[],
  connections: RoomConnection[],
  fromRoom: Room,
  toRoom: Room,
  kind: ConnectionKind,
): boolean {
  const start = boundaryPoint(fromRoom, toRoom);
  const end = boundaryPoint(toRoom, fromRoom);
  const candidates = [
    orthogonalPath(start, end, true),
    orthogonalPath(start, end, false),
  ].filter((path) => !pathCrossesOtherRoom(path, rooms, fromRoom.id, toRoom.id));
  if (candidates.length === 0) return false;

  const path = candidates[Math.floor(RNG.getUniform() * candidates.length)];
  const cells: Point[] = [];
  const seen = new Set<number>();
  for (const point of path) {
    tiles[idx(point.x, point.y)] = 'floor';
    if (roomAt(rooms, point)) continue;
    const cellIndex = idx(point.x, point.y);
    if (seen.has(cellIndex)) continue;
    seen.add(cellIndex);
    cells.push(point);
  }

  const corridorId = corridors.length;
  corridors.push({
    id: corridorId,
    fromRoomId: fromRoom.id,
    toRoomId: toRoom.id,
    cells,
    width: 1,
  });
  connections.push({
    fromRoomId: fromRoom.id,
    toRoomId: toRoom.id,
    kind,
    corridorId,
  });
  return true;
}

function chooseEntranceRoom(rooms: Room[], loopRoomIds: number[]): Room {
  const smallLoopRooms = rooms.filter((room) => loopRoomIds.includes(room.id) && room.size === 'small');
  const candidates = smallLoopRooms.length > 0
    ? smallLoopRooms
    : rooms.filter((room) => loopRoomIds.includes(room.id));
  return candidates[Math.floor(RNG.getUniform() * candidates.length)];
}

function graphDistance(
  connections: RoomConnection[],
  startRoomId: number,
): Map<number, number> {
  const distances = new Map<number, number>([[startRoomId, 0]]);
  const queue = [startRoomId];
  for (let head = 0; head < queue.length; head++) {
    const roomId = queue[head];
    const distance = distances.get(roomId) ?? 0;
    for (const connection of connections) {
      const next = connection.fromRoomId === roomId
        ? connection.toRoomId
        : connection.toRoomId === roomId
          ? connection.fromRoomId
          : null;
      if (next === null || distances.has(next)) continue;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

function chooseExitRoom(
  rooms: Room[],
  connections: RoomConnection[],
  loopRoomIds: number[],
  entranceRoomId: number,
  template: MapTemplate,
): Room {
  const candidates = template === 'findExitBranches'
    ? rooms.filter((room) => room.role === 'branch')
    : rooms.filter((room) => loopRoomIds.includes(room.id) && room.id !== entranceRoomId);
  const distances = graphDistance(connections, entranceRoomId);
  const maxDistance = Math.max(...candidates.map((room) => distances.get(room.id) ?? -1));
  const farthest = candidates.filter((room) => (distances.get(room.id) ?? -1) === maxDistance);
  return farthest[Math.floor(RNG.getUniform() * farthest.length)];
}

function addOptionalChord(
  tiles: TileKind[],
  rooms: Room[],
  corridors: CorridorLayout[],
  connections: RoomConnection[],
  loopRoomIds: number[],
): void {
  if (loopRoomIds.length < 4 || RNG.getUniform() >= 0.25) return;
  const candidates: [number, number][] = [];
  for (let i = 0; i < loopRoomIds.length; i++) {
    for (let j = i + 1; j < loopRoomIds.length; j++) {
      const distance = j - i;
      const wrapDistance = loopRoomIds.length - distance;
      if (distance > 1 && wrapDistance > 1) candidates.push([loopRoomIds[i], loopRoomIds[j]]);
    }
  }
  if (candidates.length === 0) return;
  const [fromId, toId] = candidates[Math.floor(RNG.getUniform() * candidates.length)];
  const fromRoom = rooms.find((room) => room.id === fromId);
  const toRoom = rooms.find((room) => room.id === toId);
  if (fromRoom && toRoom) connectRooms(tiles, rooms, corridors, connections, fromRoom, toRoom, 'chord');
}

function validateLayout(layout: MapLayout): boolean {
  const { rooms, connections, loopRoomIds } = layout;
  if (rooms.some((room) => room.left < 2 || room.top < 2 || room.right > MAP_W - 2 || room.bottom > MAP_H - 2)) {
    return false;
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (roomsOverlap(rooms[i], rooms[j])) return false;
    }
  }
  if (loopRoomIds.length < 3 || new Set(loopRoomIds).size !== loopRoomIds.length) return false;
  if (!loopRoomIds.every((roomId) => rooms.some((room) => room.id === roomId))) return false;

  const hasConnection = (fromRoomId: number, toRoomId: number, kind: ConnectionKind) => connections.some(
    (connection) => connection.kind === kind &&
      ((connection.fromRoomId === fromRoomId && connection.toRoomId === toRoomId) ||
        (connection.fromRoomId === toRoomId && connection.toRoomId === fromRoomId)),
  );
  for (let i = 0; i < loopRoomIds.length; i++) {
    const from = loopRoomIds[i];
    const to = loopRoomIds[(i + 1) % loopRoomIds.length];
    if (!hasConnection(from, to, 'cycle')) return false;
  }

  const distances = graphDistance(connections, layout.entranceRoomId);
  if (distances.size !== rooms.length || !distances.has(layout.exitRoomId)) return false;

  const reachable = new Set<number>();
  const queue = [layout.entrance];
  while (queue.length > 0) {
    const point = queue.shift();
    if (!point || point.x < 0 || point.y < 0 || point.x >= MAP_W || point.y >= MAP_H) continue;
    const cell = idx(point.x, point.y);
    if (reachable.has(cell) || layout.tiles[cell] === 'wall') continue;
    reachable.add(cell);
    queue.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 },
    );
  }
  const floorCount = layout.tiles.filter((tile) => tile !== 'wall').length;
  if (reachable.size !== floorCount) return false;

  if (layout.template === 'findExitBranches') {
    if (rooms.length !== 6 || loopRoomIds.length !== 3) return false;
    const branchRooms = rooms.filter((room) => {
      if (loopRoomIds.includes(room.id)) return false;
      const degree = connections.filter((connection) =>
        connection.fromRoomId === room.id || connection.toRoomId === room.id,
      ).length;
      return degree === 1;
    });
    if (branchRooms.length !== 3 || branchRooms.some((room) =>
      connections.filter((connection) => connection.fromRoomId === room.id || connection.toRoomId === room.id).length !== 1,
    )) return false;
    if (branchRooms.filter((room) => room.size === 'small').length < 2) return false;
  }
  return true;
}

function buildStructuredLayout(template: 'baseline' | 'findExitBranches'): MapLayout | null {
  const isFindExit = template === 'findExitBranches';
  const roomCount = isFindExit ? 6 : randomInt(3, 5);
  const loopCount = isFindExit ? 3 : randomInt(3, roomCount);
  const rooms: Room[] = [];
  const tiles = new Array<TileKind>(MAP_W * MAP_H).fill('wall');
  const loopRoomIds = Array.from({ length: loopCount }, (_, index) => index);
  const selectedLargeId = loopRoomIds[Math.floor(RNG.getUniform() * loopRoomIds.length)];

  const slots = loopSlots(loopCount);
  for (let i = 0; i < loopCount; i++) {
    const room = createRoom(
      i,
      slots[i],
      i === selectedLargeId ? 'large' : 'small',
      'normal',
    );
    if (rooms.some((other) => roomsOverlap(room, other))) return null;
    rooms.push(room);
    carveRoom(tiles, room);
  }

  const corridors: CorridorLayout[] = [];
  const connections: RoomConnection[] = [];
  for (let i = 0; i < loopCount; i++) {
    const fromRoom = rooms[i];
    const toRoom = rooms[(i + 1) % loopCount];
    if (!connectRooms(tiles, rooms, corridors, connections, fromRoom, toRoom, 'cycle')) return null;
  }

  if (roomCount > loopCount) {
    const slotsForBranches = branchSlots();
    for (let i = loopCount; i < roomCount; i++) {
      const slot = slotsForBranches[i - loopCount];
      if (!slot) return null;
      const branchRoom = createRoom(i, slot, 'small', 'branch');
      if (rooms.some((other) => roomsOverlap(branchRoom, other))) return null;
      rooms.push(branchRoom);
      carveRoom(tiles, branchRoom);
      const closestLoopRoom = rooms
        .filter((room) => loopRoomIds.includes(room.id))
        .sort((a, b) => Math.abs(a.cx - branchRoom.cx) + Math.abs(a.cy - branchRoom.cy) -
          (Math.abs(b.cx - branchRoom.cx) + Math.abs(b.cy - branchRoom.cy)))[0];
      if (!closestLoopRoom || !connectRooms(
        tiles,
        rooms,
        corridors,
        connections,
        closestLoopRoom,
        branchRoom,
        'branch',
      )) return null;
    }
  }

  if (!isFindExit) addOptionalChord(tiles, rooms, corridors, connections, loopRoomIds);

  const entranceRoom = chooseEntranceRoom(rooms, loopRoomIds);
  rooms[entranceRoom.id].role = 'entrance';
  const exitRoom = chooseExitRoom(rooms, connections, loopRoomIds, entranceRoom.id, template);
  rooms[exitRoom.id].role = 'exit';
  const entrance = roomCenterFloor(tiles, entranceRoom);
  const exit = roomCenterFloor(tiles, exitRoom);
  const layout: MapLayout = {
    template,
    tiles,
    rooms,
    corridors,
    connections,
    loopRoomIds,
    entranceRoomId: entranceRoom.id,
    exitRoomId: exitRoom.id,
    entrance,
    exit,
  };
  return validateLayout(layout) ? layout : null;
}

function generateDiggerLayout(): MapLayout {
  const tiles = new Array<TileKind>(MAP_W * MAP_H).fill('wall');
  const digger = new ROTMap.Digger(MAP_W, MAP_H, {
    roomWidth: [4, 8],
    roomHeight: [4, 6],
  });
  digger.create((x, y, value) => {
    tiles[idx(x, y)] = value === 0 ? 'floor' : 'wall';
  });

  const rooms: Room[] = digger.getRooms().map((r, id) => {
    const left = r.getLeft();
    const top = r.getTop();
    const right = r.getRight();
    const bottom = r.getBottom();
    return {
      id,
      size: right - left + 1 >= 7 || bottom - top + 1 >= 6 ? 'large' : 'small',
      role: 'normal',
      left,
      top,
      right,
      bottom,
      cx: Math.floor((left + right) / 2),
      cy: Math.floor((top + bottom) / 2),
    };
  });

  if (rooms.length === 0) {
    const fallback: Room = {
      id: 0,
      size: 'large',
      role: 'normal',
      left: 12,
      top: 12,
      right: 19,
      bottom: 19,
      cx: 15,
      cy: 15,
    };
    rooms.push(fallback);
    carveRoom(tiles, fallback);
  }

  const entranceRoom = rooms[0];
  const entrance = roomCenterFloor(tiles, entranceRoom);
  let exitRoom = rooms[rooms.length - 1];
  let maxDistance = -1;
  for (const room of rooms.slice(1)) {
    const center = roomCenterFloor(tiles, room);
    const distance = Math.abs(center.x - entrance.x) + Math.abs(center.y - entrance.y);
    if (distance > maxDistance) {
      maxDistance = distance;
      exitRoom = room;
    }
  }
  return {
    template: 'boss',
    tiles,
    rooms,
    corridors: [],
    connections: [],
    loopRoomIds: [],
    entranceRoomId: entranceRoom.id,
    exitRoomId: exitRoom.id,
    entrance,
    exit: roomCenterFloor(tiles, exitRoom),
  };
}

export function generateMapLayout(seed: number, template: MapTemplate, floorNumber = 1): MapLayout {
  RNG.setSeed(phaseSeed(seed, floorNumber, STRUCTURED_LAYOUT_SALT + template.length));
  if (template === 'boss') return generateDiggerLayout();
  for (let attempt = 0; attempt < 20; attempt++) {
    const layout = buildStructuredLayout(template);
    if (layout) return layout;
  }
  throw new Error(`Unable to generate ${template} map layout`);
}

function createObjective(floorNumber: number, maxEnemyPower: number): FloorObjectiveState {
  if (floorNumber >= BOSS_FLOOR_NUMBER) {
    return { type: 'finalBoss', target: 1, progress: 0, label: '击败最终 Boss' };
  }

  const canUseSpecialEnemy = ENEMY_DEFS.morbol.power <= maxEnemyPower;
  const template = Math.floor(RNG.getUniform() * (canUseSpecialEnemy ? 3 : 2));
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

function randomNormalEnemyType(
  maxPower: number,
  remainingPower: number,
  enemiesLeft: number,
): EnemyType | null {
  const minPower = Math.min(...NORMAL_ENEMY_TYPES.map((type) => ENEMY_DEFS[type].power));
  const types = NORMAL_ENEMY_TYPES.filter((type) => {
    const power = ENEMY_DEFS[type].power;
    return power <= maxPower && power <= remainingPower - (enemiesLeft - 1) * minPower;
  });
  if (types.length === 0) return null;
  return types[Math.floor(RNG.getUniform() * types.length)] ?? null;
}

/** Generate a random floor with an objective, entrance, exit, enemies and items. */
export function generateFloor(seed: number, floorNumber = 1): FloorState {
  RNG.setSeed(seed);
  idCounter = 0;
  const enemyRule = getEnemyFloorRule(floorNumber);
  const objective = createObjective(floorNumber, enemyRule.maxPower);
  const layout = generateMapLayout(seed, mapTemplateForObjective(objective.type), floorNumber);
  const tiles = layout.tiles.slice();
  const visibility = new Array<VisibilityKind>(MAP_W * MAP_H).fill('unseen');

  const entranceIndex = idx(layout.entrance.x, layout.entrance.y);
  tiles[entranceIndex] = 'entrance';
  const exitIndex = idx(layout.exit.x, layout.exit.y);
  tiles[exitIndex] = 'exit';

  RNG.setSeed(phaseSeed(seed, floorNumber, CONTENT_SALT));
  const blocked = new Set<number>([entranceIndex, exitIndex]);
  const enemies: EnemyState[] = [];
  const items: ItemState[] = [];
  const entranceRoom = layout.rooms[layout.entranceRoomId];
  const exitRoom = layout.rooms[layout.exitRoomId];
  const otherRooms = layout.rooms.filter((room) => room.id !== entranceRoom.id && room.id !== exitRoom.id);
  const enemyRooms = otherRooms.length > 0 ? otherRooms : layout.rooms;

  const normalEnemyCount = objective.type === 'defeatCount'
    ? objective.target
    : objective.type === 'finalBoss'
      ? 0
      : 3 + Math.floor(RNG.getUniform() * 3);

  const isBoss = objective.type === 'finalBoss';
  const specialPower = objective.type === 'defeatSpecial' || isBoss
    ? ENEMY_DEFS.morbol.power * (isBoss ? 2 : 1)
    : 0;
  let remainingPower = enemyRule.powerBudget - specialPower;

  for (let i = 0; i < normalEnemyCount; i++) {
    const pos = randomFreeFloorInRooms(tiles, enemyRooms, enemies, items, blocked);
    if (!pos) break;
    const type = randomNormalEnemyType(enemyRule.maxPower, remainingPower, normalEnemyCount - i);
    if (!type) throw new Error('敌人强度预算不足');
    const def = ENEMY_DEFS[type];
    enemies.push({
      id: nextId('enemy'),
      type,
      power: def.power,
      x: pos.x,
      y: pos.y,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      def: def.def,
      isSpecial: false,
      isBoss: false,
    });
    remainingPower -= def.power;
  }

  if (objective.type === 'defeatSpecial' || objective.type === 'finalBoss') {
    const largeRooms = layout.rooms.filter((room) => room.size === 'large' && room.id !== entranceRoom.id);
    const specialRoomPool = largeRooms.length > 0 ? largeRooms : enemyRooms;
    const specialPos = randomFreeFloorInRooms(tiles, specialRoomPool, enemies, items, blocked);
    if (!specialPos) throw new Error('无法放置特殊敌人');
    const def = ENEMY_DEFS.morbol;
    const power = def.power * (isBoss ? 2 : 1);
    const hp = isBoss ? def.hp * 2 : def.hp;
    enemies.push({
      id: nextId('enemy'),
      type: 'morbol',
      power,
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

  const itemRooms = layout.rooms.filter((room) => room.id !== entranceRoom.id);
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
