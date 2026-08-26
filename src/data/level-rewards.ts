import type { LevelUpRewardId, StaticAttributes } from '@/game/state';

export type LevelUpRewardKind = 'attribute' | 'skill' | 'passive';

export interface LevelUpRewardDefinition {
  id: LevelUpRewardId;
  name: string;
  englishName?: string;
  description: string;
  weight: number;
  repeatable: boolean;
  kind: LevelUpRewardKind;
  attribute?: keyof StaticAttributes;
  attributes?: Partial<Record<keyof StaticAttributes, number>>;
  amount?: number;
  requires?: LevelUpRewardId[];
}

/** 0.1 通用奖励池：所有职业都会从这里取三选一。 */
export const COMMON_LEVEL_UP_REWARD_IDS: LevelUpRewardId[] = [
  'maxHp', 'primaryAttribute', 'maxMp', 'gil',
  'survival', 'offense', 'healing', 'critical',
];

/** 0.1 职业池：按 jobId 分开注册，后续职业只需新增一项。 */
export const JOB_LEVEL_UP_REWARD_IDS: Record<string, LevelUpRewardId[]> = {
  dragoon: ['lifeSurge', 'geirskogul', 'elusiveJump', 'dragonSight', 'bloodOfDragon', 'jumpMastery', 'bloodbath'],
};

export const LEVEL_UP_REWARDS: Record<LevelUpRewardId, LevelUpRewardDefinition> = {
  maxHp: { id: 'maxHp', name: 'HP 上限强化', description: 'HP 上限 +40，并恢复 40 HP。', weight: 1, repeatable: true, kind: 'attribute', amount: 40 },
  primaryAttribute: { id: 'primaryAttribute', name: '主属性强化', description: '职业对应的主属性变为原来的 1.1 倍。', weight: 1, repeatable: true, kind: 'attribute' },
  maxMp: { id: 'maxMp', name: 'MP 上限强化', description: 'MP 上限 +30，并恢复 30 MP。', weight: 1, repeatable: true, kind: 'attribute', amount: 30 },
  gil: { id: 'gil', name: '一袋金币', description: '获得 300 Gil。', weight: 1, repeatable: true, kind: 'attribute', amount: 300 },
  survival: { id: 'survival', name: '生存强化', description: '坚韧小幅提升（+10）。', weight: 1, repeatable: true, kind: 'attribute', attribute: 'tenacity', amount: 10 },
  offense: { id: 'offense', name: '进攻强化', description: '信念、直击小幅提升（各 +10）。', weight: 1, repeatable: true, kind: 'attribute', attributes: { determination: 10, directHit: 10 } },
  healing: { id: 'healing', name: '治愈强化', description: '精神、信仰小幅提升（各 +10）。', weight: 1, repeatable: true, kind: 'attribute', attributes: { mind: 10, piety: 10 } },
  critical: { id: 'critical', name: '暴击强化', description: '暴击小幅提升（+10）。', weight: 1, repeatable: true, kind: 'attribute', attribute: 'criticalHit', amount: 10 },
  lifeSurge: { id: 'lifeSurge', name: '龙剑', englishName: 'Life Surge', description: '获得技能 Life Surge：本技能不消耗回合，CD 20，MP 0；赋予龙剑 Buff，下一次造成伤害必定暴击，并恢复该伤害 10% 的 HP，持续 3 回合。', weight: 1, repeatable: false, kind: 'skill' },
  geirskogul: { id: 'geirskogul', name: '武神枪', englishName: 'Geirskogul', description: '获得技能 Geirskogul：CD 15，MP 80；选择上下左右一个方向，对该方向 8 格内所有敌人造成 600 威力伤害。', weight: 1, repeatable: false, kind: 'skill' },
  elusiveJump: { id: 'elusiveJump', name: '回避跳跃', englishName: 'Elusive Jump', description: '获得技能 Elusive Jump：本技能不消耗回合，CD 10，MP 20；向上一次移动或攻击方向的反方向位移 10 格，遇障碍停止，并消除所有非 Boss 敌人的仇恨。', weight: 1, repeatable: false, kind: 'skill' },
  dragonSight: { id: 'dragonSight', name: '巨龙视线', englishName: 'Dragon Sight', description: '获得技能 Dragon Sight：CD 20，MP 50；赋予巨龙视线 Buff，使全伤害提高 100%，持续 10 回合。', weight: 1, repeatable: false, kind: 'skill' },
  bloodOfDragon: { id: 'bloodOfDragon', name: '苍天龙血', englishName: 'Blood of the Dragon', description: '每次使用跳跃或其升级技能获得 1 层龙眼（上限 3 层）；使用武神枪会消耗全部龙眼，每层龙眼使武神枪额外造成 200 威力伤害。', weight: 1, repeatable: false, kind: 'passive', requires: ['geirskogul'] },
  jumpMastery: { id: 'jumpMastery', name: '跳跃精通', englishName: 'Jump Mastery', description: '使用任何非跳跃或其升级技能时，使跳跃或其升级技能的剩余冷却缩短 2 回合。', weight: 1, repeatable: false, kind: 'passive' },
  bloodbath: { id: 'bloodbath', name: '浴血', englishName: 'Bloodbath', description: '减伤计算取当前坚韧的 0.8 倍；造成任何伤害时，回复等同于伤害值 1% 的 HP。', weight: 1, repeatable: false, kind: 'passive' },
};

export function rewardPoolForJob(jobId: string): LevelUpRewardId[] {
  return [...COMMON_LEVEL_UP_REWARD_IDS, ...(JOB_LEVEL_UP_REWARD_IDS[jobId] ?? [])];
}
