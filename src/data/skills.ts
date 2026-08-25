import type { SkillId } from '@/game/state';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  range: number;
  mpCost: number;
  cooldownTurns: number;
  potency: number;
}

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  jump: {
    id: 'jump',
    name: '跳跃',
    range: 8,
    mpCost: 50,
    cooldownTurns: 8,
    potency: 400,
  },
};
