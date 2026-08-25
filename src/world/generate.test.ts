import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W } from '@/config';
import { generateFloor } from '@/world/generate';

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

  it('generates enough enemies for each regular objective template', () => {
    const templates = new Set<string>();
    for (let seedIndex = 0; seedIndex < 200; seedIndex++) {
      const seed = seedIndex * 1000 + 17;
      const floor = generateFloor(seed);
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
    expect(templates).toEqual(new Set(['findExit', 'defeatCount', 'defeatSpecial']));
  });

  it('creates a final boss floor', () => {
    const floor = generateFloor(42, 6);
    expect(floor.isBossFloor).toBe(true);
    expect(floor.objective.type).toBe('finalBoss');
    expect(floor.enemies.filter((enemy) => enemy.isBoss)).toHaveLength(1);
    expect(floor.enemies.filter((enemy) => enemy.isSpecial)).toHaveLength(1);
  });
});
