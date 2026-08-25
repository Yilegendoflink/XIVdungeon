import { describe, expect, it } from 'vitest';
import { createNewGame } from '@/game/actions';
import { tickBuffs, tryPickup, useItem } from '@/systems/inventory';
import type { GameState, ItemState } from '@/game/state';

function withItem(state: GameState, item: ItemState): GameState {
  return {
    ...state,
    hero: { ...state.hero, x: item.x!, y: item.y! },
    floor: { ...state.floor, items: [item] },
  };
}

describe('inventory', () => {
  it('picks up items into the bag', () => {
    const base = createNewGame(7);
    const state = withItem(base, { id: 'i1', type: 'hiPotion', x: base.hero.x, y: base.hero.y });
    const next = tryPickup(state);
    expect(next.hero.inventory).toHaveLength(1);
    expect(next.floor.items).toHaveLength(0);
  });

  it('refuses pickup when inventory is full', () => {
    const base = createNewGame(7);
    const full = Array.from({ length: 10 }, (_, i) => ({
      id: `f${i}`,
      type: 'hiPotion' as const,
    }));
    const state = withItem(
      { ...base, hero: { ...base.hero, inventory: full } },
      { id: 'extra', type: 'hiPotion', x: base.hero.x, y: base.hero.y },
    );
    const next = tryPickup(state);
    expect(next.hero.inventory).toHaveLength(10);
    expect(next.floor.items).toHaveLength(1);
  });

  it('hi-potion does not exceed maxHp', () => {
    const state = createNewGame(7);
    state.hero.hp = 18;
    state.hero.inventory = [{ id: 'p', type: 'hiPotion' }];
    const next = useItem(state, 0);
    expect(next.hero.hp).toBe(20);
  });

  it('might buff lasts 5 turns then expires', () => {
    let state = createNewGame(7);
    state.hero.inventory = [{ id: 's', type: 'scrollOfMight' }];
    state = useItem(state, 0);
    expect(state.hero.buffs[0]?.turnsLeft).toBe(5);
    for (let i = 0; i < 5; i++) state = tickBuffs(state);
    expect(state.hero.buffs).toHaveLength(0);
  });
});
