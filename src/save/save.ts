import { BOSS_FLOOR_NUMBER, MAP_H, MAP_W, SAVE_KEY, SAVE_VERSION } from '@/config';
import { ENEMY_DEFS } from '@/data/enemies';
import { getJobDefinition } from '@/data/jobs';
import type { TileKind, VisibilityKind } from '@/config';
import { generateMapLayout, mapTemplateForObjective } from '@/world/generate';
import type { EnemyAiState, EnemyAiType, EnemyType, FloorObjectiveType, GamePhase, GameState, ItemType } from '@/game/state';

interface SaveBlob {
  version: number;
  savedAt: number;
  state: GameState;
}

const PHASES: GamePhase[] = ['title', 'playing', 'inventory', 'dead', 'victory'];
const ENEMY_TYPES: EnemyType[] = ['bomb', 'cactuar', 'morbol'];
const ENEMY_AI_TYPES: EnemyAiType[] = ['standard', 'neutral', 'stationary', 'patrol', 'boss'];
const ENEMY_AI_STATES: EnemyAiState[] = ['free', 'aggro'];
const ITEM_TYPES: ItemType[] = ['hiPotion', 'scrollOfMight', 'gridanianRation'];
const OBJECTIVE_TYPES: FloorObjectiveType[] = ['findExit', 'defeatCount', 'defeatSpecial', 'finalBoss'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

function isMapPosition(value: unknown): value is number {
  return isNonNegativeInteger(value) && value < MAP_W * MAP_H;
}

function isCoordinate(value: unknown, limit: number): value is number {
  return isNonNegativeInteger(value) && value < limit;
}

function isTileKind(value: unknown): value is TileKind {
  return value === 'wall' || value === 'floor' || value === 'entrance' || value === 'exit';
}

function isVisibilityKind(value: unknown): value is VisibilityKind {
  return value === 'unseen' || value === 'explored' || value === 'visible';
}

function isPhase(value: unknown): value is GamePhase {
  return typeof value === 'string' && PHASES.includes(value as GamePhase);
}

function isEnemyType(value: unknown): value is EnemyType {
  return typeof value === 'string' && ENEMY_TYPES.includes(value as EnemyType);
}

function isEnemyAiType(value: unknown): value is EnemyAiType {
  return typeof value === 'string' && ENEMY_AI_TYPES.includes(value as EnemyAiType);
}

function isEnemyAiState(value: unknown): value is EnemyAiState {
  return typeof value === 'string' && ENEMY_AI_STATES.includes(value as EnemyAiState);
}

function isItemType(value: unknown): value is ItemType {
  return typeof value === 'string' && ITEM_TYPES.includes(value as ItemType);
}

function isObjectiveType(value: unknown): value is FloorObjectiveType {
  return typeof value === 'string' && OBJECTIVE_TYPES.includes(value as FloorObjectiveType);
}

function isValidItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasX = value.x !== undefined;
  const hasY = value.y !== undefined;
  return (
    typeof value.id === 'string' &&
    isItemType(value.type) &&
    hasX === hasY &&
    (!hasX || (isCoordinate(value.x, MAP_W) && isCoordinate(value.y, MAP_H)))
  );
}

function isValidEnemy(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    isEnemyType(value.type) &&
    isEnemyAiType(value.aiType) &&
    isEnemyAiState(value.aiState) &&
    isPositiveInteger(value.aggroRange) &&
    (value.patrolTargetRoomId === undefined || isNonNegativeInteger(value.patrolTargetRoomId)) &&
    isPositiveInteger(value.power) &&
    isCoordinate(value.x, MAP_W) &&
    isCoordinate(value.y, MAP_H) &&
    isFiniteNumber(value.hp) &&
    value.hp >= 0 &&
    isFiniteNumber(value.maxHp) &&
    value.maxHp > 0 &&
    value.hp <= value.maxHp &&
    isFiniteNumber(value.atk) &&
    isFiniteNumber(value.def) &&
    typeof value.isSpecial === 'boolean' &&
    typeof value.isBoss === 'boolean'
  );
}

function isValidRoom(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.id) &&
    isCoordinate(value.left, MAP_W) &&
    isCoordinate(value.top, MAP_H) &&
    isCoordinate(value.right, MAP_W) &&
    isCoordinate(value.bottom, MAP_H) &&
    value.left <= value.right &&
    value.top <= value.bottom &&
    isCoordinate(value.cx, MAP_W) &&
    isCoordinate(value.cy, MAP_H)
  );
}

function isValidCorridor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.id) &&
    isNonNegativeInteger(value.fromRoomId) &&
    isNonNegativeInteger(value.toRoomId) &&
    Array.isArray(value.cells) &&
    value.cells.every((cell) =>
      isRecord(cell) && isCoordinate(cell.x, MAP_W) && isCoordinate(cell.y, MAP_H),
    )
  );
}

function isValidObjective(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isObjectiveType(value.type) &&
    isNonNegativeInteger(value.target) &&
    isNonNegativeInteger(value.progress) &&
    value.progress <= value.target &&
    typeof value.label === 'string'
  );
}

function isValidModifiers(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.infiniteHp === 'boolean' &&
    typeof value.autoCompleteObjectives === 'boolean' &&
    typeof value.oneHitKill === 'boolean'
  );
}

function isValidDamageEvent(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    isCoordinate(value.x, MAP_W) &&
    isCoordinate(value.y, MAP_H) &&
    isPositiveInteger(value.amount) &&
    (value.kind === 'dealt' || value.kind === 'received')
  );
}

function isValidBuff(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    value.type === 'might' &&
    isFiniteNumber(value.value) &&
    isPositiveInteger(value.turnsLeft)
  );
}

function isValidJobResource(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isNonNegativeInteger(value.current) &&
    (value.max === undefined || (isPositiveInteger(value.max) && value.current <= value.max))
  );
}

function isValidLogEntry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.text === 'string' && isNonNegativeInteger(value.turn);
}

function isValidState(state: unknown): state is GameState {
  if (!isRecord(state)) return false;
  if (state.version !== SAVE_VERSION || !isFiniteNumber(state.seed)) return false;
  if (!isNonNegativeInteger(state.turn) || !isPhase(state.phase)) return false;
  if (!isValidModifiers(state.modifiers)) return false;
  if (
    !isNonNegativeInteger(state.damageEventSequence) ||
    !Array.isArray(state.damageEvents) ||
    !state.damageEvents.every(isValidDamageEvent)
  ) return false;

  const floor = state.floor;
  if (
    !isRecord(floor) ||
    !isPositiveInteger(floor.number) ||
    floor.number > BOSS_FLOOR_NUMBER ||
    typeof floor.isBossFloor !== 'boolean' ||
    floor.isBossFloor !== (floor.number >= BOSS_FLOOR_NUMBER) ||
    !isValidObjective(floor.objective) ||
    floor.width !== MAP_W ||
    floor.height !== MAP_H
  ) return false;
  if (!Array.isArray(floor.tiles) || floor.tiles.length !== MAP_W * MAP_H || !floor.tiles.every(isTileKind)) {
    return false;
  }
  if (
    !Array.isArray(floor.visibility) ||
    floor.visibility.length !== MAP_W * MAP_H ||
    !floor.visibility.every(isVisibilityKind)
  ) {
    return false;
  }
  if (
    !isMapPosition(floor.entranceIndex) ||
    !isMapPosition(floor.exitIndex) ||
    typeof floor.exitUnlocked !== 'boolean' ||
    !Array.isArray(floor.rooms) ||
    !floor.rooms.every(isValidRoom) ||
    !Array.isArray(floor.corridors) ||
    !floor.corridors.every(isValidCorridor) ||
    !Array.isArray(floor.enemies) ||
    !floor.enemies.every(isValidEnemy) ||
    !Array.isArray(floor.items) ||
    !floor.items.every(isValidItem)
  ) {
    return false;
  }

  const hero = state.hero;
  if (!isRecord(hero)) return false;
  if (
    !isCoordinate(hero.x, MAP_W) ||
    !isCoordinate(hero.y, MAP_H) ||
    typeof hero.jobId !== 'string' ||
    !getJobDefinition(hero.jobId) ||
    !isFiniteNumber(hero.hp) ||
    hero.hp < 0 ||
    !isFiniteNumber(hero.maxHp) ||
    hero.maxHp <= 0 ||
    hero.hp > hero.maxHp ||
    !isFiniteNumber(hero.mp) ||
    hero.mp < 0 ||
    !isFiniteNumber(hero.maxMp) ||
    hero.maxMp <= 0 ||
    hero.mp > hero.maxMp ||
    !Array.isArray(hero.jobResources) ||
    !hero.jobResources.every(isValidJobResource) ||
    !isNonNegativeInteger(hero.gil) ||
    !isFiniteNumber(hero.atk) ||
    !isFiniteNumber(hero.def) ||
    !Array.isArray(hero.inventory) ||
    !hero.inventory.every(isValidItem) ||
    !Array.isArray(hero.buffs) ||
    !hero.buffs.every(isValidBuff)
  ) {
    return false;
  }

  const stats = state.stats;
  return (
    Array.isArray(state.log) &&
    state.log.every(isValidLogEntry) &&
    isRecord(stats) &&
    isNonNegativeInteger(stats.kills) &&
    isNonNegativeInteger(stats.experience)
  );
}

function migrateSave(value: unknown): unknown {
  if (
    !isRecord(value) ||
    ![SAVE_VERSION - 2, SAVE_VERSION - 1].includes(value.version as number) ||
    !isRecord(value.state) ||
    !isRecord(value.state.hero) ||
    !isRecord(value.state.floor)
  ) {
    return value;
  }
  const job = typeof value.state.hero.jobId === 'string' ? getJobDefinition(value.state.hero.jobId) : undefined;
  if (!job) return value;
  const oldState = value.state;
  const oldHero = oldState.hero as Record<string, unknown>;
  const oldFloor = oldState.floor as Record<string, unknown>;
  const floorNumber = typeof oldFloor.number === 'number' ? oldFloor.number : 1;
  const seed = typeof oldState.seed === 'number' ? oldState.seed : 0;
  const objectiveType = isRecord(oldFloor.objective) && isObjectiveType(oldFloor.objective.type)
    ? oldFloor.objective.type
    : 'findExit';
  const layoutSeed = floorNumber === 1 ? seed : seed + floorNumber * 100003;
  const layout = generateMapLayout(layoutSeed, mapTemplateForObjective(objectiveType), floorNumber);
  const rooms = layout.rooms.map((room) => ({
    id: room.id,
    left: room.left,
    top: room.top,
    right: room.right,
    bottom: room.bottom,
    cx: room.cx,
    cy: room.cy,
  }));
  const corridors = layout.corridors.map((corridor) => ({
    id: corridor.id,
    fromRoomId: corridor.fromRoomId,
    toRoomId: corridor.toRoomId,
    cells: corridor.cells.map((cell) => ({ ...cell })),
  }));
  const enemies = Array.isArray(oldFloor.enemies)
    ? (oldFloor.enemies as unknown[]).map((enemy: unknown) => {
      if (!isRecord(enemy) || !isEnemyType(enemy.type)) return enemy;
      const def = ENEMY_DEFS[enemy.type];
      return {
        ...enemy,
        aiType: enemy.isBoss ? 'boss' : def.aiType,
        aiState: 'free',
        aggroRange: enemy.isBoss ? 6 : def.aggroRange,
      };
    })
    : oldFloor.enemies;
  return {
    ...value,
    version: SAVE_VERSION,
    state: {
      ...oldState,
      version: SAVE_VERSION,
      hero: {
        ...oldHero,
        ...(value.version === SAVE_VERSION - 2
          ? { level: 1, experience: 0, attributes: { ...job.attributes } }
          : {}),
      },
      floor: { ...oldFloor, rooms, corridors, enemies },
    },
  };
}

function isValidSaveBlob(value: unknown): value is SaveBlob {
  if (!isRecord(value)) return false;
  return value.version === SAVE_VERSION && isFiniteNumber(value.savedAt) && isValidState(value.state);
}

export function saveGame(state: GameState): void {
  const blob: SaveBlob = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: { ...state, damageEvents: [] },
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
  } catch (e) {
    console.warn('保存失败：', e);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const blob = migrateSave(JSON.parse(raw) as unknown);
    if (!isValidSaveBlob(blob)) {
      console.warn('存档无效，已丢弃');
      deleteSave();
      return null;
    }
    // Inventory overlay shouldn't stick across reload
    if (blob.state.phase === 'inventory') {
      return { ...blob.state, phase: 'playing' };
    }
    return blob.state;
  } catch (e) {
    console.warn('读取存档失败：', e);
    deleteSave();
    return null;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.warn('删除存档失败：', e);
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}
