import { describe, expect, it, vi } from 'vitest';
import { ENEMY_DEFS } from '@/data/enemies';
import { createNewGame } from '@/game/actions';
import {
  attackDistance,
  attackEnemy,
  attackHero,
  canBasicAttack,
  calcDamage,
  mitigateHeroDamage,
  resolvePlayerDamage,
} from '@/systems/combat';

describe('calcDamage', () => {
  it('never returns less than 1', () => {
    for (let i = 0; i < 50; i++) {
      expect(calcDamage(1, 100)).toBeGreaterThanOrEqual(1);
    }
  });

  it('先扣除一半防御力，再加入 -1 到 1 的随机浮动', () => {
    for (let i = 0; i < 100; i++) {
      const damage = calcDamage(10, 4);
      expect(damage).toBeGreaterThanOrEqual(7);
      expect(damage).toBeLessThanOrEqual(9);
    }
  });
});

describe('属性伤害结算', () => {
  it('按信念、直击、暴击的顺序结算，并允许同时触发', () => {
    const state = createNewGame(7);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);
    const hero = {
      ...state.hero,
      attributes: {
        ...state.hero.attributes,
        strength: 20,
        determination: 100,
        directHit: 1000,
        criticalHit: 1000,
      },
    };

    expect(resolvePlayerDamage(hero, 0)).toEqual({ amount: 30, directHit: true, critical: true });
    vi.restoreAllMocks();
  });

  it('坚韧减伤最高为 50%，并保留最低 1 点伤害', () => {
    const state = createNewGame(7);
    const hero = {
      ...state.hero,
      attributes: { ...state.hero.attributes, tenacity: 2000 },
    };

    expect(mitigateHeroDamage(100, hero)).toBe(50);
    expect(mitigateHeroDamage(1, hero)).toBe(1);
  });
});

describe('普通攻击范围', () => {
  it('支持 2 格内的斜向目标', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      x: state.hero.x + 2,
      y: state.hero.y + 2,
    };

    expect(canBasicAttack(state.floor, state.hero, target)).toBe(true);
    expect(attackDistance(state.floor, state.hero, target)).toBe(2);
  });

  it('地形阻挡时不能把坐标近的目标当作可攻击', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const x = state.hero.x + 1;
    const y = state.hero.y + 1;
    const tiles = [...state.floor.tiles];
    tiles[state.hero.y * state.floor.width + x] = 'wall';
    tiles[y * state.floor.width + state.hero.x] = 'wall';
    const target = { ...enemy, x, y };
    const targetState = { ...state, floor: { ...state.floor, tiles } };

    expect(attackDistance(targetState.floor, targetState.hero, target)).toBeGreaterThan(2);
    expect(canBasicAttack(targetState.floor, targetState.hero, target)).toBe(false);
  });

  it('超出范围的攻击不改变状态', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      x: state.hero.x + 3,
      y: state.hero.y,
    };
    const targetState = {
      ...state,
      floor: { ...state.floor, enemies: [target] },
    };

    expect(attackEnemy(targetState, target)).toBe(targetState);
  });

  it('玩家主动攻击会让中立敌人进入仇恨态', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      type: 'cactuar' as const,
      x: state.hero.x + 1,
      y: state.hero.y,
      aiType: 'neutral' as const,
      aiState: 'free' as const,
      hp: 99,
      maxHp: 99,
    };
    const targetState = { ...state, floor: { ...state.floor, enemies: [target] } };

    expect(attackEnemy(targetState, target).floor.enemies[0]?.aiState).toBe('aggro');
  });

  it('完成击杀目标后解锁出口', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      x: state.hero.x + 1,
      y: state.hero.y,
      hp: 1,
      maxHp: 1,
      isSpecial: false,
      isBoss: false,
    };
    const targetState = {
      ...state,
      floor: {
        ...state.floor,
        objective: { type: 'defeatCount' as const, target: 1, progress: 0, label: '击败 1 个敌人' },
        exitUnlocked: false,
        enemies: [target],
      },
    };

    const next = attackEnemy(targetState, target);
    expect(next.floor.objective.progress).toBe(1);
    expect(next.floor.exitUnlocked).toBe(true);
  });

  it('击败最终 Boss 后结束本轮冒险', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      x: state.hero.x + 1,
      y: state.hero.y,
      hp: 1,
      maxHp: 1,
      isSpecial: true,
      isBoss: true,
    };
    const targetState = {
      ...state,
      floor: {
        ...state.floor,
        isBossFloor: true,
        objective: { type: 'finalBoss' as const, target: 1, progress: 0, label: '击败最终 Boss' },
        enemies: [target],
      },
    };

    expect(attackEnemy(targetState, target).phase).toBe('victory');
  });

  it('一击必杀只强化玩家攻击', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = { ...enemy, x: state.hero.x + 1, y: state.hero.y, hp: 99, maxHp: 99 };
    const targetState = {
      ...state,
      modifiers: { ...state.modifiers, oneHitKill: true },
      floor: { ...state.floor, enemies: [target] },
    };

    expect(attackEnemy(targetState, target).floor.enemies).toHaveLength(0);
  });

  it('无限血量不受敌人伤害影响', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const targetState = { ...state, modifiers: { ...state.modifiers, infiniteHp: true } };

    expect(attackHero(targetState, enemy).hero.hp).toBe(targetState.hero.maxHp);
  });

  it('记录玩家造成和受到的伤害事件', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = { ...enemy, x: state.hero.x + 1, y: state.hero.y, hp: 1, maxHp: 1 };
    const targetState = { ...state, floor: { ...state.floor, enemies: [target] } };

    const afterPlayerAttack = attackEnemy(targetState, target);
    expect(afterPlayerAttack.damageEvents[afterPlayerAttack.damageEvents.length - 1]).toMatchObject({
      x: target.x,
      y: target.y,
      kind: 'dealt',
    });

    const afterEnemyAttack = attackHero(targetState, target);
    expect(afterEnemyAttack.damageEvents[afterEnemyAttack.damageEvents.length - 1]).toMatchObject({
      x: targetState.hero.x,
      y: targetState.hero.y,
      kind: 'received',
    });
  });

  it('击败敌人后随机获得区间内的经验和金币', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = { ...enemy, x: state.hero.x + 1, y: state.hero.y, hp: 1, maxHp: 1 };
    const targetState = { ...state, floor: { ...state.floor, enemies: [target] } };
    const next = attackEnemy(targetState, target);
    const reward = ENEMY_DEFS[target.type];

    expect(next.stats.experience).toBeGreaterThanOrEqual(reward.experience.min);
    expect(next.stats.experience).toBeLessThanOrEqual(reward.experience.max);
    expect(next.hero.gil).toBeGreaterThanOrEqual(reward.gil.min);
    expect(next.hero.gil).toBeLessThanOrEqual(reward.gil.max);
    expect(next.log[next.log.length - 1]?.text).toContain('获得');
  });

  it('升级时暂停战斗并提供三选一奖励', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      type: 'morbol' as const,
      x: state.hero.x + 1,
      y: state.hero.y,
      hp: 1,
      maxHp: 1,
      isSpecial: false,
      isBoss: false,
    };
    const next = attackEnemy({ ...state, floor: { ...state.floor, enemies: [target] } }, target);

    expect(next).toMatchObject({ phase: 'levelUp', pendingLevelRewards: 1 });
    expect(new Set(next.levelUpRewards)).toEqual(new Set(['attack', 'survival', 'critical']));
  });

  it('Boss 击败奖励使用双倍区间', () => {
    const state = createNewGame(7);
    const enemy = state.floor.enemies[0]!;
    const target = {
      ...enemy,
      type: 'morbol' as const,
      x: state.hero.x + 1,
      y: state.hero.y,
      hp: 1,
      maxHp: 1,
      isSpecial: true,
      isBoss: true,
    };
    const targetState = { ...state, floor: { ...state.floor, enemies: [target] } };
    const next = attackEnemy(targetState, target);
    const reward = ENEMY_DEFS.morbol;

    expect(next.stats.experience).toBeGreaterThanOrEqual(reward.experience.min * 2);
    expect(next.stats.experience).toBeLessThanOrEqual(reward.experience.max * 2);
    expect(next.hero.gil).toBeGreaterThanOrEqual(reward.gil.min * 2);
    expect(next.hero.gil).toBeLessThanOrEqual(reward.gil.max * 2);
  });
});
