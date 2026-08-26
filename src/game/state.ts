import { MAP_W, MAP_H, MAX_LEVEL } from '@/config';
import { LEVEL_UP_REWARDS, rewardPoolForJob } from '@/data/level-rewards';
import type { TileKind, VisibilityKind } from '@/config';

export type GamePhase = 'title' | 'playing' | 'inventory' | 'levelUp' | 'dead' | 'victory';
export type EnemyType = 'bomb' | 'cactuar' | 'morbol';
export type EnemyAiType = 'standard' | 'neutral' | 'stationary' | 'patrol' | 'boss';
export type EnemyAiState = 'free' | 'aggro';
export type ItemType = 'hiPotion' | 'scrollOfMight' | 'gridanianRation';
export type FloorObjectiveType = 'findExit' | 'defeatCount' | 'defeatSpecial' | 'finalBoss';
export type BaseAttribute = 'strength' | 'dexterity' | 'intelligence';
export type SkillId = 'jump' | 'lifeSurge' | 'geirskogul' | 'elusiveJump' | 'dragonSight';
export type PassiveId = 'bloodOfDragon' | 'jumpMastery' | 'bloodbath';
export type LevelUpRewardId =
  | 'maxHp' | 'primaryAttribute' | 'maxMp' | 'gil'
  | 'survival' | 'offense' | 'healing' | 'critical'
  | 'lifeSurge' | 'geirskogul' | 'elusiveJump' | 'dragonSight'
  | 'bloodOfDragon' | 'jumpMastery' | 'bloodbath';

export const LEVEL_UP_REWARD_IDS: LevelUpRewardId[] = [
  'maxHp', 'primaryAttribute', 'maxMp', 'gil', 'survival', 'offense', 'healing', 'critical',
  'lifeSurge', 'geirskogul', 'elusiveJump', 'dragonSight', 'bloodOfDragon', 'jumpMastery', 'bloodbath',
];

export function defaultRewardWeights(): Record<LevelUpRewardId, number> {
  return Object.fromEntries(LEVEL_UP_REWARD_IDS.map((reward) => [reward, LEVEL_UP_REWARDS[reward].weight])) as Record<LevelUpRewardId, number>;
}

export interface StaticAttributes {
  strength: number;
  dexterity: number;
  intelligence: number;
  mind: number;
  tenacity: number;
  piety: number;
  determination: number;
  directHit: number;
  criticalHit: number;
}

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

export type BuffState =
  | { type: 'might'; value: number; turnsLeft: number }
  | { type: 'lifeSurge'; turnsLeft: number }
  | { type: 'dragonSight'; turnsLeft: number }
  | { type: 'dragonEye'; stacks: number; turnsLeft?: never };

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
  level: number;
  experience: number;
  attributes: StaticAttributes;
  skillCooldowns: Record<SkillId, number>;
  unlockedSkills: SkillId[];
  passives: PassiveId[];
  claimedLevelRewards: LevelUpRewardId[];
  rewardWeights: Record<LevelUpRewardId, number>;
  lastDirection?: { dx: number; dy: number };
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
  levelUpRewards: LevelUpRewardId[];
  pendingLevelRewards: number;
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

export function heroAtk(hero: HeroState, primaryAttribute: BaseAttribute): number {
  const bonus = hero.buffs.reduce((sum, b) => sum + (b.type === 'might' ? b.value : 0), 0);
  return Math.floor(hero.attributes[primaryAttribute] / 2) + bonus;
}

export function experienceRequiredForLevel(level: number): number {
  return level >= MAX_LEVEL ? 0 : 10 * level * level;
}

export function gainExperience(hero: HeroState, amount: number): { hero: HeroState; levelsGained: number } {
  let level = hero.level;
  let experience = hero.experience + amount;
  let maxHp = hero.maxHp;
  let levelsGained = 0;
  while (level < MAX_LEVEL && experience >= experienceRequiredForLevel(level)) {
    experience -= experienceRequiredForLevel(level);
    level += 1;
    maxHp = Math.ceil(maxHp * 1.1);
    levelsGained += 1;
  }
  return {
    hero: {
      ...hero,
      level,
      experience: level === MAX_LEVEL ? 0 : experience,
      maxHp,
      mp: levelsGained > 0 ? hero.maxMp : hero.mp,
    },
    levelsGained,
  };
}

export function rollLevelUpRewards(
  hero?: Pick<HeroState, 'claimedLevelRewards' | 'rewardWeights'>,
  jobId = 'dragoon',
): LevelUpRewardId[] {
  const claimed = new Set(hero?.claimedLevelRewards ?? []);
  const candidates = rewardPoolForJob(jobId).filter((reward) => {
    const definition = LEVEL_UP_REWARDS[reward];
    return (definition.repeatable || !claimed.has(reward)) &&
      (definition.requires ?? []).every((required) => claimed.has(required));
  });
  const weights = hero?.rewardWeights ?? defaultRewardWeights();
  const picked: LevelUpRewardId[] = [];

  while (picked.length < 3 && candidates.length > 0) {
    const weightFor = (reward: LevelUpRewardId): number => Math.max(0, weights[reward] ?? LEVEL_UP_REWARDS[reward].weight);
    const total = candidates.reduce((sum, reward) => sum + weightFor(reward), 0);
    if (total <= 0) {
      picked.push(candidates.shift()!);
      continue;
    }
    let roll = Math.random() * total;
    const index = candidates.findIndex((reward) => {
      roll -= weightFor(reward);
      return roll < 0;
    });
    picked.push(candidates.splice(index < 0 ? candidates.length - 1 : index, 1)[0]!);
  }
  return picked;
}

export function maxHpForAttributes(attributes: StaticAttributes): number {
  return 20 + Math.floor(attributes.tenacity / 10);
}

export function mpRegenPerTurn(attributes: StaticAttributes): number {
  return 1 + Math.floor(attributes.piety / 100);
}

export function mpCostAfterPiety(cost: number, attributes: StaticAttributes): number {
  return Math.max(1, Math.ceil(cost * (1 - Math.min(0.5, attributes.piety / 1000))));
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
