import type { BaseAttribute, SkillId, StaticAttributes } from '@/game/state';

export interface JobResourceDefinition {
  id: string;
  name: string;
  initial: number;
  max?: number;
}

export interface JobDefinition {
  id: string;
  name: string;
  description: string;
  primaryAttribute: BaseAttribute;
  attributes: StaticAttributes;
  skills: SkillId[];
  resources: JobResourceDefinition[];
}

// 当前只开放一个职业，数据结构为后续增加职业和多种职业资源预留空间。
export const JOB_DEFINITIONS: JobDefinition[] = [
  {
    id: 'dragoon',
    name: '龙骑士',
    description: '以近战攻击为主的高机动职业。',
    primaryAttribute: 'strength',
    attributes: {
      strength: 12,
      dexterity: 6,
      intelligence: 6,
      mind: 6,
      tenacity: 50,
      piety: 100,
      determination: 50,
      directHit: 100,
      criticalHit: 100,
    },
    skills: ['jump'],
    resources: [
      { id: 'dragon-gauge', name: '龙血', initial: 0, max: 3 },
    ],
  },
];

export type JobId = (typeof JOB_DEFINITIONS)[number]['id'];

export function getJobDefinition(jobId: string): JobDefinition | undefined {
  return JOB_DEFINITIONS.find((job) => job.id === jobId);
}
