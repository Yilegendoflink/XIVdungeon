import type { PassiveId } from '@/game/state';

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  englishName: string;
  description: string;
}

export const PASSIVE_DEFINITIONS: Record<PassiveId, PassiveDefinition> = {
  bloodOfDragon: { id: 'bloodOfDragon', name: '苍天龙血', englishName: 'Blood of the Dragon', description: '使用跳跃或其升级技能获得龙眼（最多 3 层）；武神枪消耗龙眼，每层额外造成 200 威力伤害。' },
  jumpMastery: { id: 'jumpMastery', name: '跳跃精通', englishName: 'Jump Mastery', description: '使用非跳跃技能时，跳跃及其升级技能的剩余冷却缩短 2 回合。' },
  bloodbath: { id: 'bloodbath', name: '浴血', englishName: 'Bloodbath', description: '坚韧减伤按 0.8 倍计算；造成伤害时回复伤害值 1% 的 HP。' },
};
