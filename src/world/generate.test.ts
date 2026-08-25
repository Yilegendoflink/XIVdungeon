import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W } from '@/config';
import { getEnemyFloorRule } from '@/data/enemies';
import { generateFloor, generateMapLayout, mapTemplateForObjective } from '@/world/generate';

describe('generateFloor', () => {
  it('creates a 32x32 floor with entrance and exit on walkable tiles', () => {
    const floor = generateFloor(42);
    expect(floor.width).toBe(MAP_W);
    expect(floor.height).toBe(MAP_H);
    expect(floor.tiles).toHaveLength(MAP_W * MAP_H);
    expect(floor.visibility).toHaveLength(MAP_W * MAP_H);
    expect(floor.tiles[floor.entranceIndex]).toBe('entrance');
    expect(floor.tiles[floor.exitIndex]).toBe('exit');
    expect(floor.objective.label.length).toBeGreaterThan(0);
    expect(floor.number).toBe(1);
  });

  it('produces different layouts for different seeds', () => {
    const a = generateFloor(1);
    const b = generateFloor(2);
    expect(a.tiles.join()).not.toBe(b.tiles.join());
  });

  it('maps objectives to their dedicated map templates', () => {
    expect(mapTemplateForObjective('findExit')).toBe('findExitBranches');
    expect(mapTemplateForObjective('defeatCount')).toBe('baseline');
    expect(mapTemplateForObjective('defeatSpecial')).toBe('baseline');
    expect(mapTemplateForObjective('finalBoss')).toBe('boss');
  });

  it('generates baseline layouts with a variable room loop and loop entrance', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const layout = generateMapLayout(seed, 'baseline');
      expect(layout.rooms.length).toBeGreaterThanOrEqual(3);
      expect(layout.rooms.length).toBeLessThanOrEqual(5);
      expect(layout.loopRoomIds.length).toBeGreaterThanOrEqual(3);
      expect(layout.loopRoomIds.length).toBeLessThanOrEqual(layout.rooms.length);
      expect(layout.loopRoomIds).toContain(layout.entranceRoomId);
      expect(layout.rooms.filter((room) => room.size === 'large').length).toBeGreaterThanOrEqual(1);
      expect(layout.rooms.filter((room) => room.size === 'small').length).toBeGreaterThanOrEqual(2);
      expect(layout.connections.filter((connection) => connection.kind === 'cycle')).toHaveLength(
        layout.loopRoomIds.length,
      );
    }
  });

  it('generates find-exit layouts with three terminal branches', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const layout = generateMapLayout(seed, 'findExitBranches');
      const loopIds = new Set(layout.loopRoomIds);
      const branchRooms = layout.rooms.filter((room) => !loopIds.has(room.id));
      expect(layout.rooms).toHaveLength(6);
      expect(layout.loopRoomIds).toHaveLength(3);
      expect(layout.loopRoomIds).toContain(layout.entranceRoomId);
      expect(branchRooms).toHaveLength(3);
      expect(branchRooms.filter((room) => room.size === 'small').length).toBeGreaterThanOrEqual(2);
      expect(branchRooms.map((room) => room.id)).toContain(layout.exitRoomId);
      expect(layout.connections.filter((connection) => connection.kind === 'cycle')).toHaveLength(3);
      expect(layout.connections.filter((connection) => connection.kind === 'branch')).toHaveLength(3);
      for (const branchRoom of branchRooms) {
        const degree = layout.connections.filter((connection) =>
          connection.fromRoomId === branchRoom.id || connection.toRoomId === branchRoom.id,
        ).length;
        expect(degree).toBe(1);
      }
    }
  });

  it('assigns enemy power within each floor limit and budget', () => {
    for (let floorNumber = 1; floorNumber <= 6; floorNumber++) {
      const rule = getEnemyFloorRule(floorNumber);
      for (let seedIndex = 0; seedIndex < 40; seedIndex++) {
        const floor = generateFloor(seedIndex * 1000 + 17, floorNumber);
        expect(floor.enemies.every((enemy) => enemy.power <= rule.maxPower)).toBe(true);
        expect(floor.enemies.reduce((total, enemy) => total + enemy.power, 0))
          .toBeLessThanOrEqual(rule.powerBudget);
      }
    }
  });

  it('generates enough enemies for each regular objective template', () => {
    const templates = new Set<string>();
    for (const floorNumber of [1, 3, 5]) {
      for (let seedIndex = 0; seedIndex < 200; seedIndex++) {
        const seed = seedIndex * 1000 + 17;
        const floor = generateFloor(seed, floorNumber);
        expect(floor.entranceIndex, `seed ${seed}`).not.toBe(floor.exitIndex);
        templates.add(floor.objective.type);
        if (floor.objective.type === 'findExit') {
          expect(floor.exitUnlocked).toBe(true);
        }
        if (floor.objective.type === 'defeatCount') {
          expect(floor.objective.target).toBeGreaterThanOrEqual(5);
          expect(floor.objective.target).toBeLessThanOrEqual(10);
          expect(floor.enemies.filter((enemy) => !enemy.isSpecial && !enemy.isBoss).length)
            .toBeGreaterThanOrEqual(floor.objective.target);
        }
        if (floor.objective.type === 'defeatSpecial') {
          expect(floor.enemies.filter((enemy) => enemy.isSpecial)).toHaveLength(1);
        }
      }
    }
    expect(templates).toEqual(new Set(['findExit', 'defeatCount', 'defeatSpecial']));
  });

  it('creates a final boss floor', () => {
    const floor = generateFloor(42, 6);
    expect(floor.isBossFloor).toBe(true);
    expect(floor.objective.type).toBe('finalBoss');
    expect(floor.enemies.filter((enemy) => enemy.isBoss)).toHaveLength(1);
    expect(floor.enemies.filter((enemy) => enemy.isSpecial)).toHaveLength(1);
    expect(floor.enemies.find((enemy) => enemy.isBoss)).toMatchObject({ hp: 36, maxHp: 36, atk: 7, def: 3 });
  });
});
