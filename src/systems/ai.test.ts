import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/game/actions';
import { isPassable } from '@/game/state';
import { processEnemyTurns } from '@/systems/ai';

function roomContains(room: { left: number; top: number; right: number; bottom: number }, x: number, y: number) {
  return x >= room.left && x <= room.right && y >= room.top && y <= room.bottom;
}

function adjacentPassable(state: ReturnType<typeof createNewGame>) {
  const points = [
    { x: state.hero.x + 1, y: state.hero.y },
    { x: state.hero.x - 1, y: state.hero.y },
    { x: state.hero.x, y: state.hero.y + 1 },
    { x: state.hero.x, y: state.hero.y - 1 },
  ];
  return points.find((point) => isPassable(state.floor, point.x, point.y));
}

describe('敌人 AI', () => {
  it('标准敌人的自由态只在当前房间内移动', () => {
    const state = createNewGame(42);
    const entranceRoom = state.floor.rooms.find((room) =>
      roomContains(
        room,
        state.floor.entranceIndex % state.floor.width,
        Math.floor(state.floor.entranceIndex / state.floor.width),
      ),
    );
    const room = state.floor.rooms.find((candidate) => candidate.id !== entranceRoom?.id);
    const enemy = state.floor.enemies.find((candidate) => candidate.type === 'bomb');
    expect(room).toBeDefined();
    expect(enemy).toBeDefined();
    if (!room || !enemy) return;

    const target = {
      ...enemy,
      x: room.cx,
      y: room.cy,
      aiType: 'standard' as const,
      aiState: 'free' as const,
      aggroRange: 1,
    };
    const next = processEnemyTurns({ ...state, floor: { ...state.floor, enemies: [target] } });
    const moved = next.floor.enemies[0];
    expect(moved?.aiState).toBe('free');
    expect(moved && roomContains(room, moved.x, moved.y)).toBe(true);
  });

  it('中立敌人即使被玩家感知也不会自动进入仇恨态', () => {
    const state = createNewGame(42);
    const position = adjacentPassable(state);
    const enemy = state.floor.enemies[0];
    expect(position).toBeDefined();
    expect(enemy).toBeDefined();
    if (!position || !enemy) return;

    const target = {
      ...enemy,
      type: 'cactuar' as const,
      x: position.x,
      y: position.y,
      aiType: 'neutral' as const,
      aiState: 'free' as const,
    };
    const next = processEnemyTurns({ ...state, floor: { ...state.floor, enemies: [target] } });
    expect(next.floor.enemies[0]?.aiState).toBe('free');
  });

  it('驻足敌人在自由态和仇恨态都不会移动', () => {
    const state = createNewGame(42);
    const enemy = state.floor.enemies[0];
    expect(enemy).toBeDefined();
    if (!enemy) return;
    const target = { ...enemy, aiType: 'stationary' as const, aiState: 'free' as const, aggroRange: 1 };
    const next = processEnemyTurns({ ...state, floor: { ...state.floor, enemies: [target] } });
    expect(next.floor.enemies[0]).toMatchObject({ x: target.x, y: target.y, aiState: 'free' });
  });

  it('巡逻敌人的自由态会选择其他房间作为目标', () => {
    const state = createNewGame(42);
    const enemy = state.floor.enemies[0];
    const room = state.floor.rooms[1];
    expect(enemy).toBeDefined();
    expect(room).toBeDefined();
    if (!enemy || !room) return;

    const target = {
      ...enemy,
      x: room.cx,
      y: room.cy,
      aiType: 'patrol' as const,
      aiState: 'free' as const,
      aggroRange: 1,
    };
    const next = processEnemyTurns({ ...state, floor: { ...state.floor, enemies: [target] } });
    const moved = next.floor.enemies[0];
    expect(moved?.patrolTargetRoomId).toBeDefined();
    expect(moved?.patrolTargetRoomId).not.toBe(room.id);
  });

  it('仇恨态会持续追踪攻击，不会自行回到自由态', () => {
    const state = createNewGame(42);
    const position = adjacentPassable(state);
    const enemy = state.floor.enemies[0];
    expect(position).toBeDefined();
    expect(enemy).toBeDefined();
    if (!position || !enemy) return;

    const target = { ...enemy, x: position.x, y: position.y, aiState: 'aggro' as const };
    const next = processEnemyTurns({ ...state, floor: { ...state.floor, enemies: [target] } });
    expect(next.floor.enemies[0]?.aiState).toBe('aggro');
    expect(next.hero.hp).toBeLessThan(state.hero.hp);
  });
});
