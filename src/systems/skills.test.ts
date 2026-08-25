import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/game/actions';
import { processTurn } from '@/game/turn';
import { idx, isPassable } from '@/game/state';
import { canTargetJump, useSkill } from '@/systems/skills';

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
});
