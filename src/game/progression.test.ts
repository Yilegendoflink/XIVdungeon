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
    expect(mpRegenPerTurn(attributes)).toBe(6);
    expect(mpCostAfterPiety(10, attributes)).toBe(5);
  });

  it('升级奖励按权重无放回展示三项，并按选择永久强化对应属性', () => {
    const offered = rollLevelUpRewards();
    expect(offered).toHaveLength(3);
    expect(new Set(offered).size).toBe(3);
    const levelUpRewards: LevelUpRewardId[] = ['maxHp', 'primaryAttribute', 'maxMp'];
    const state = {
      ...createNewGame(1),
      phase: 'levelUp' as const,
      pendingLevelRewards: 1,
      levelUpRewards,
    };
    expect(applyLevelUpReward(state, 'maxHp').hero.maxHp).toBe(65);
    expect(applyLevelUpReward(state, 'primaryAttribute').hero.attributes.strength).toBe(14);
    expect(applyLevelUpReward(state, 'maxMp').hero.maxMp).toBe(130);
  });

  it('权重决定候选出现概率，一次性奖励领取后不再出现，可重复属性可继续领取', () => {
    const hero = createNewGame(1).hero;
    const weightedHero = {
      ...hero,
      rewardWeights: {
        ...hero.rewardWeights,
        ...Object.fromEntries(Object.keys(hero.rewardWeights).map((reward) => [reward, 0])),
        maxHp: 1,
        primaryAttribute: 1,
        maxMp: 1,
      },
    };
    expect(new Set(rollLevelUpRewards(weightedHero))).toEqual(new Set(['maxHp', 'primaryAttribute', 'maxMp']));

    const oneTimeState = {
      ...createNewGame(1),
      phase: 'levelUp' as const,
      pendingLevelRewards: 2,
      levelUpRewards: ['lifeSurge', 'maxHp', 'maxMp'] as LevelUpRewardId[],
    };
    const learned = applyLevelUpReward(oneTimeState, 'lifeSurge');
    expect(learned.hero.unlockedSkills).toContain('lifeSurge');
    expect(learned.hero.claimedLevelRewards).toContain('lifeSurge');
    expect(rollLevelUpRewards(learned.hero)).not.toContain('lifeSurge');

    const repeatState = {
      ...createNewGame(1),
      phase: 'levelUp' as const,
      pendingLevelRewards: 1,
      levelUpRewards: ['maxHp', 'primaryAttribute', 'maxMp'] as LevelUpRewardId[],
    };
    const repeated = applyLevelUpReward(repeatState, 'maxHp');
    expect(repeated.hero.maxHp).toBe(65);
    expect(repeated.hero.claimedLevelRewards).not.toContain('maxHp');
  });

  it('龙骑士被动按表格前置解锁，苍天龙血需要先获得武神枪', () => {
    const initial = rollLevelUpRewards(createNewGame(1).hero);
    expect(initial).not.toContain('bloodOfDragon');

    const afterGeirskogul = {
      ...createNewGame(1).hero,
      claimedLevelRewards: ['geirskogul'] as LevelUpRewardId[],
      rewardWeights: {
        ...createNewGame(1).hero.rewardWeights,
        ...Object.fromEntries(Object.keys(createNewGame(1).hero.rewardWeights).map((reward) => [reward, 0])),
        bloodOfDragon: 1,
      },
    };
    expect(rollLevelUpRewards(afterGeirskogul)).toContain('bloodOfDragon');
  });

  it('选择升级奖励不消耗回合，并恢复游戏', () => {
    const state = {
      ...createNewGame(1),
      phase: 'levelUp' as const,
      pendingLevelRewards: 1,
      levelUpRewards: ['maxHp', 'primaryAttribute', 'maxMp'] as LevelUpRewardId[],
    };
    const next = processTurn(state, { type: 'chooseLevelReward', reward: 'maxHp' });
    expect(next).toMatchObject({ phase: 'playing', turn: state.turn, pendingLevelRewards: 0 });
  });
});
