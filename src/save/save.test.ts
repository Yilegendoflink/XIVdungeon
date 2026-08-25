import { beforeEach, describe, expect, it } from 'vitest';
import { createNewGame } from '@/game/actions';
import { deleteSave, loadGame, saveGame } from '@/save/save';
import { SAVE_KEY } from '@/config';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  });
});

describe('save/load', () => {
  it('round-trips a valid game state', () => {
    const state = createNewGame(99);
    saveGame(state);
    const loaded = loadGame();
    expect(loaded?.seed).toBe(99);
    expect(loaded?.hero.hp).toBe(20);
    expect(loaded?.floor.tiles).toHaveLength(32 * 32);
  });

  it('discards corrupted saves', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, savedAt: 1, state: { nope: true } }));
    expect(loadGame()).toBeNull();
    deleteSave();
  });

  it('discards structurally incomplete saves', () => {
    const state = createNewGame(12);
    const malformed = {
      ...state,
      floor: { ...state.floor, enemies: undefined },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, savedAt: 1, state: malformed }));
    expect(loadGame()).toBeNull();
  });
});
