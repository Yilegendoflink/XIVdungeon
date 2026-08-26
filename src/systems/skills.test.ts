import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/game/actions';
import { processTurn } from '@/game/turn';
import { idx, isPassable } from '@/game/state';
import { canTargetJump, cooldownTurnsFor, useSkill } from '@/systems/skills';

function jumpReadyState() {
  const state = createNewGame(7);
  const visibility = state.floor.tiles.map(() => 'visible' as const);
  const target = Array.from({ length: state.floor.tiles.length }, (_, index) => ({
    x: index % state.floor.width,
    y: Math.floor(index / state.floor.width),
  })).find((cell) =>
    Math.max(Math.abs(cell.x - state.hero.x), Math.abs(cell.y - state.hero.y)) > 0 &&
    Math.max(Math.abs(cell.x - state.hero.x), Math.abs(cell.y - state.hero.y)) <= 8 &&
    isPassable(state.floor, cell.x, cell.y),
  );
  if (!target) throw new Error('test map has no jump target');
  return { ...state, floor: { ...state.floor, visibility, enemies: [], items: [] }, target };
}

describe('跳跃', () => {
  it('可跳至范围内空地，消耗 50 MP 并进入 8 回合冷却', () => {
    const { target, ...state } = jumpReadyState();
    expect(canTargetJump(state, target)).toBe(true);

    expect(useSkill(state, 'jump', target)).toMatchObject({
      hero: { x: target.x, y: target.y, mp: 50, skillCooldowns: { jump: 8 } },
    });
  });

  it('击杀目标敌人时直接落在目标格', () => {
    const { target, ...state } = jumpReadyState();
    const source = createNewGame(8).floor.enemies[0]!;
    const enemy = { ...source, x: target.x, y: target.y, hp: 1, maxHp: 1 };
    const next = useSkill({ ...state, floor: { ...state.floor, enemies: [enemy] } }, 'jump', target);

    expect(next.floor.enemies).toHaveLength(0);
    expect(next.hero).toMatchObject({ x: target.x, y: target.y });
  });

  it('目标敌人存活时落在邻近空位，且 MP 不足时不施放', () => {
    const { target, ...state } = jumpReadyState();
    const source = createNewGame(8).floor.enemies[0]!;
    const enemy = { ...source, x: target.x, y: target.y, hp: 999, maxHp: 999 };
    const next = useSkill({ ...state, floor: { ...state.floor, enemies: [enemy] } }, 'jump', target);

    expect(next.hero.x === target.x && next.hero.y === target.y).toBe(false);
    expect(Math.max(Math.abs(next.hero.x - target.x), Math.abs(next.hero.y - target.y))).toBe(1);

    const noMp = { ...state, hero: { ...state.hero, mp: 49 } };
    expect(useSkill(noMp, 'jump', target)).toBe(noMp);
  });

  it('冷却在之后的玩家回合递减', () => {
    const { target, ...state } = jumpReadyState();
    const cast = useSkill(state, 'jump', target);
    const next = processTurn(cast, { type: 'wait' });

    expect(next.hero.skillCooldowns.jump).toBe(7);
    expect(next.turn).toBe(cast.turn + 1);
    expect(next.floor.visibility[idx(target.x, target.y, next.floor.width)]).toBe('visible');
  });

  it('获得龙剑后可施放无回合技能', () => {
    const { target, ...state } = jumpReadyState();
    const hero = { ...state.hero, unlockedSkills: ['lifeSurge' as const], passives: ['jumpMastery' as const] };
    const empowered = useSkill({ ...state, hero }, 'lifeSurge', { x: hero.x, y: hero.y });

    expect(empowered.hero).toMatchObject({ mp: 100, skillCooldowns: { lifeSurge: 20 } });
    expect(empowered.hero.buffs).toContainEqual({ type: 'lifeSurge', turnsLeft: 3 });
    expect(cooldownTurnsFor(hero, 'jump')).toBe(8);
    expect(useSkill({ ...state, hero }, 'jump', target).hero.skillCooldowns.jump).toBe(8);
  });

  it('苍天龙血让跳跃获得最多三层龙眼，武神枪消耗龙眼', () => {
    const { target, ...state } = jumpReadyState();
    const hero = {
      ...state.hero,
      unlockedSkills: ['geirskogul' as const],
      passives: ['bloodOfDragon' as const],
    };
    const jumped = useSkill({ ...state, hero }, 'jump', target);
    expect(jumped.hero.buffs).toContainEqual({ type: 'dragonEye', stacks: 1 });

    const directionTarget = [
      { x: jumped.hero.x + 1, y: jumped.hero.y },
      { x: jumped.hero.x - 1, y: jumped.hero.y },
      { x: jumped.hero.x, y: jumped.hero.y + 1 },
      { x: jumped.hero.x, y: jumped.hero.y - 1 },
    ].find((cell) => isPassable(jumped.floor, cell.x, cell.y));
    if (!directionTarget) throw new Error('test map has no Geirskogul direction');
    const enemy = { ...createNewGame(9).floor.enemies[0]!, x: directionTarget.x, y: directionTarget.y, hp: 999, maxHp: 999 };
    const lineState = {
      ...jumped,
      hero: { ...jumped.hero, mp: 100, unlockedSkills: ['geirskogul' as const] },
      floor: { ...jumped.floor, enemies: [enemy] },
    };
    const fired = useSkill(lineState, 'geirskogul', directionTarget);
    expect(fired.hero.buffs.some((buff) => buff.type === 'dragonEye')).toBe(false);
    expect(fired.floor.enemies[0]!.hp).toBeLessThan(enemy.hp);
  });

  it('跳跃精通使非跳跃技能缩短跳跃系技能冷却 2 回合', () => {
    const state = createNewGame(10);
    const hero = {
      ...state.hero,
      unlockedSkills: ['lifeSurge' as const],
      passives: ['jumpMastery' as const],
      skillCooldowns: { ...state.hero.skillCooldowns, jump: 5, elusiveJump: 8 },
    };
    const next = useSkill({ ...state, hero }, 'lifeSurge', { x: hero.x, y: hero.y });
    expect(next.hero.skillCooldowns).toMatchObject({ jump: 3, elusiveJump: 6 });
  });
});
