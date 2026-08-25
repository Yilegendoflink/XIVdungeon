import { MAP_W, MAP_H } from '@/config';
import type { TileKind, VisibilityKind } from '@/config';

export type GamePhase = 'title' | 'playing' | 'inventory' | 'dead' | 'victory';
export type EnemyType = 'bomb' | 'cactuar' | 'morbol';
export type EnemyAiType = 'standard' | 'neutral' | 'stationary' | 'patrol' | 'boss';
export type EnemyAiState = 'free' | 'aggro';
export type ItemType = 'hiPotion' | 'scrollOfMight' | 'gridanianRation';
export type FloorObjectiveType = 'findExit' | 'defeatCount' | 'defeatSpecial' | 'finalBoss';

export interface GameModifiers {
  infiniteHp: boolean;
  autoCompleteObjectives: boolean;
  oneHitKill: boolean;
}

export const DEFAULT_GAME_MODIFIERS: GameModifiers = {
  infiniteHp: false,
  autoCompleteObjectives: false,
  oneHitKill: false,
};

export interface FloorObjectiveState {
  type: FloorObjectiveType;
  target: number;
  progress: number;
  label: string;
}

export interface BuffState {
  type: 'might';
  value: number;
  turnsLeft: number;
}

export interface JobResourceState {
  id: string;
  name: string;
  current: number;
  max?: number;
}

export type DamageEventKind = 'dealt' | 'received';

export interface DamageEvent {
  id: string;
  x: number;
  y: number;
  amount: number;
  kind: DamageEventKind;
}

export interface ItemState {
  id: string;
  type: ItemType;
  x?: number;
  y?: number;
}

export interface EnemyState {
  id: string;
  type: EnemyType;
  aiType: EnemyAiType;
  aiState: EnemyAiState;
  aggroRange: number;
  patrolTargetRoomId?: number;
  power: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  isSpecial: boolean;
  isBoss: boolean;
}

export interface FloorRoomState {
  id: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
}

export interface FloorCorridorState {
  id: number;
  fromRoomId: number;
  toRoomId: number;
  cells: { x: number; y: number }[];
}

export interface HeroState {
  x: number;
  y: number;
  jobId: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  jobResources: JobResourceState[];
  gil: number;
  atk: number;
  def: number;
  inventory: ItemState[];
  buffs: BuffState[];
}

export interface FloorState {
  number: number;
  isBossFloor: boolean;
  width: number;
  height: number;
  tiles: TileKind[];
  visibility: VisibilityKind[];
  entranceIndex: number;
  exitIndex: number;
  exitUnlocked: boolean;
  rooms: FloorRoomState[];
  corridors: FloorCorridorState[];
  objective: FloorObjectiveState;
  enemies: EnemyState[];
  items: ItemState[];
}

export interface LogEntry {
  turn: number;
  text: string;
}

export interface RunStats {
  kills: number;
  experience: number;
}

export interface GameState {
  version: number;
  seed: number;
  turn: number;
  phase: GamePhase;
  modifiers: GameModifiers;
  hero: HeroState;
  floor: FloorState;
  damageEventSequence: number;
  damageEvents: DamageEvent[];
  log: LogEntry[];
  stats: RunStats;
}

export function idx(x: number, y: number, width = MAP_W): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, w = MAP_W, h = MAP_H): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function isPassable(floor: FloorState, x: number, y: number): boolean {
  if (!inBounds(x, y, floor.width, floor.height)) return false;
  return floor.tiles[idx(x, y, floor.width)] !== 'wall';
}

export function heroAtk(hero: HeroState): number {
  const bonus = hero.buffs.reduce((sum, b) => sum + (b.type === 'might' ? b.value : 0), 0);
  return hero.atk + bonus;
}

export function enemyName(type: EnemyType): string {
  switch (type) {
    case 'bomb': return '炸弹怪';
    case 'cactuar': return '仙人掌怪';
    case 'morbol': return '魔界花';
  }
}

export function itemName(type: ItemType): string {
  switch (type) {
    case 'hiPotion': return '高级恢复药';
    case 'scrollOfMight': return '力量卷轴';
    case 'gridanianRation': return '格里达尼亚干粮';
  }
}
