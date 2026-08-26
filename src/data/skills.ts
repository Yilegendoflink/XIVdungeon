import { getJobDefinition } from '@/data/jobs';
import type { HeroState, SkillId } from '@/game/state';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  englishName: string;
  range: number;
  mpCost: number;
  cooldownTurns: number;
  potency?: number;
  targeting: 'ground' | 'self' | 'direction';
  spendsTurn: boolean;
  /** Marks Jump and later Jump upgrades for Dragoon passive interactions. */
  jumpFamily?: boolean;
}

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  jump: { id: 'jump', name: '跳跃', englishName: 'Jump', range: 8, mpCost: 50, cooldownTurns: 8, potency: 400, targeting: 'ground', spendsTurn: true, jumpFamily: true },
  lifeSurge: { id: 'lifeSurge', name: '龙剑', englishName: 'Life Surge', range: 0, mpCost: 0, cooldownTurns: 20, targeting: 'self', spendsTurn: false },
  geirskogul: { id: 'geirskogul', name: '武神枪', englishName: 'Geirskogul', range: 8, mpCost: 80, cooldownTurns: 15, potency: 600, targeting: 'direction', spendsTurn: true },
  elusiveJump: { id: 'elusiveJump', name: '回避跳跃', englishName: 'Elusive Jump', range: 10, mpCost: 20, cooldownTurns: 10, targeting: 'self', spendsTurn: false, jumpFamily: true },
  dragonSight: { id: 'dragonSight', name: '巨龙视线', englishName: 'Dragon Sight', range: 0, mpCost: 50, cooldownTurns: 20, targeting: 'self', spendsTurn: true },
};

export function activeSkillIds(hero: HeroState): SkillId[] {
  const jobSkills = getJobDefinition(hero.jobId)?.skills ?? [];
  return [...new Set([...jobSkills, ...hero.unlockedSkills])];
}
