import type { EnemyType } from '@/game/state';

export interface EnemyDef {
  type: EnemyType;
  hp: number;
  atk: number;
  def: number;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  bomb: { type: 'bomb', hp: 8, atk: 3, def: 0 },
  cactuar: { type: 'cactuar', hp: 6, atk: 2, def: 0 },
  morbol: { type: 'morbol', hp: 30, atk: 6, def: 2 },
};
