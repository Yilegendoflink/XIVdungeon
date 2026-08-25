import type { EnemyAiType, EnemyType } from '@/game/state';

export interface RewardRange {
  min: number;
  max: number;
}

export interface EnemyDef {
  type: EnemyType;
  aiType: EnemyAiType;
  aggroRange: number;
  power: number;
  experience: RewardRange;
  gil: RewardRange;
  hp: number;
  atk: number;
  def: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  bomb: {
    type: 'bomb',
    aiType: 'standard',
    aggroRange: 5,
    power: 1,
    experience: { min: 2, max: 4 },
    gil: { min: 1, max: 3 },
    hp: 8,
    atk: 3,
    def: 0,
  },
  cactuar: {
    type: 'cactuar',
    aiType: 'neutral',
    aggroRange: 4,
    power: 2,
    experience: { min: 3, max: 6 },
    gil: { min: 2, max: 5 },
    hp: 6,
    atk: 2,
    def: 0,
  },
  morbol: {
    type: 'morbol',
    aiType: 'patrol',
    aggroRange: 7,
    power: 4,
    experience: { min: 12, max: 18 },
    gil: { min: 8, max: 14 },
    hp: 24,
    atk: 5,
    def: 2,
  },
};

export interface EnemyFloorRule {
  maxPower: number;
  powerBudget: number;
}

export const ENEMY_FLOOR_RULES: EnemyFloorRule[] = [
  { maxPower: 1, powerBudget: 10 },
  { maxPower: 1, powerBudget: 10 },
  { maxPower: 2, powerBudget: 14 },
  { maxPower: 2, powerBudget: 16 },
  { maxPower: 4, powerBudget: 18 },
  { maxPower: 8, powerBudget: 24 },
];

export function getEnemyFloorRule(floorNumber: number): EnemyFloorRule {
  return ENEMY_FLOOR_RULES[Math.min(Math.max(floorNumber, 1), ENEMY_FLOOR_RULES.length) - 1]!;
}
