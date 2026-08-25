import type { EnemyType } from '@/game/state';

export interface EnemyDef {
  type: EnemyType;
  power: number;
  hp: number;
  atk: number;
  def: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  bomb: { type: 'bomb', power: 1, hp: 8, atk: 3, def: 0 },
  cactuar: { type: 'cactuar', power: 2, hp: 6, atk: 2, def: 0 },
  morbol: { type: 'morbol', power: 4, hp: 30, atk: 6, def: 2 },
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
