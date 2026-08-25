import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '@/config';
import { createNewGame } from '@/game/actions';
import { applyLevelUpReward } from '@/game/actions';
import { processTurn } from '@/game/turn';
import type { LevelUpRewardId } from '@/game/state';
import {
  experienceRequiredForLevel,
  gainExperience,
  heroAtk,
  maxHpForAttributes,
  mpCostAfterPiety,
  mpRegenPerTurn,
  rollLevelUpRewards,
} from '@/game/state';

describe('角色成长', () => {
  it('使用新的龙骑士战斗资源基线', () => {
    const hero = createNewGame(1).hero;
    expect(hero).toMatchObject({ hp: 25, maxHp: 25, mp: 100, maxMp: 100, def: 2 });
    expect(heroAtk(hero, 'strength')).toBe(6);
  });

  it('升级需求非线性递增，并可连续升级', () => {
    const hero = createNewGame(1).hero;
    expect(experienceRequiredForLevel(3)).toBeGreaterThan(experienceRequiredForLevel(2));
    const result = gainExperience(hero, 50);
    expect(result.hero.level).toBe(3);
    expect(result.hero.experience).toBe(0);
  });

  it('30 级封顶且不再保留升级经验', () => {
    const hero = { ...createNewGame(1).hero, level: MAX_LEVEL, experience: 0 };
    expect(gainExperience(hero, 9999).hero).toMatchObject({ level: MAX_LEVEL, experience: 0 });
  });

  it('升级时将生命上限提高 10%，并回满 MP', () => {
    const hero = { ...createNewGame(1).hero, hp: 10, mp: 1 };
    expect(gainExperience(hero, 10).hero).toMatchObject({ level: 2, hp: 10, maxHp: 28, mp: 100 });
  });

  it('坚韧、信仰分别影响生命上限与 MP 修正', () => {
    const attributes = { ...createNewGame(1).hero.attributes, tenacity: 50, piety: 500 };
    expect(maxHpForAttributes(attributes)).toBe(25);
    expect(mpRegenPerTurn(attributes)).toBe(6);
    expect(mpCostAfterPiety(10, attributes)).toBe(5);
  });

  it('升级奖励随机展示三项，并按选择永久强化对应属性', () => {
    expect(new Set(rollLevelUpRewards())).toEqual(new Set(['attack', 'survival', 'critical']));
    const levelUpRewards: LevelUpRewardId[] = ['attack', 'survival', 'critical'];
    const state = {
      ...createNewGame(1),
      phase: 'levelUp' as const,
      pendingLevelRewards: 1,
      levelUpRewards,
    };
    expect(applyLevelUpReward(state, 'attack').hero.attributes.strength).toBe(16);
    expect(applyLevelUpReward(state, 'survival').hero.attributes.tenacity).toBe(65);
    expect(applyLevelUpReward(state, 'critical').hero.attributes.criticalHit).toBe(130);
  });

  it('选择升级奖励不消耗回合，并恢复游戏', () => {
    const state = {
      ...createNewGame(1),
      phase: 'levelUp' as const,
      pendingLevelRewards: 1,
      levelUpRewards: ['attack', 'survival', 'critical'] as LevelUpRewardId[],
    };
    const next = processTurn(state, { type: 'chooseLevelReward', reward: 'attack' });
    expect(next).toMatchObject({ phase: 'playing', turn: state.turn, pendingLevelRewards: 0 });
  });
});
