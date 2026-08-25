import { INVENTORY_SIZE } from '@/config';
import type { GameState, ItemState } from '@/game/state';
import { itemName } from '@/game/state';

export function tryPickup(state: GameState): GameState {
  const itemIdx = state.floor.items.findIndex(
    (it) => it.x === state.hero.x && it.y === state.hero.y,
  );
  if (itemIdx < 0) return state;

  if (state.hero.inventory.length >= INVENTORY_SIZE) {
    return {
      ...state,
      log: [...state.log, { turn: state.turn, text: '背包已满！' }],
    };
  }

  const item = state.floor.items[itemIdx];
  const picked: ItemState = { id: item.id, type: item.type };
  const items = state.floor.items.filter((_, i) => i !== itemIdx);

  return {
    ...state,
    hero: { ...state.hero, inventory: [...state.hero.inventory, picked] },
    floor: { ...state.floor, items },
    log: [...state.log, { turn: state.turn, text: `拾取了${itemName(item.type)}。` }],
  };
}

export function useItem(state: GameState, index: number): GameState {
  const item = state.hero.inventory[index];
  if (!item) return state;

  const inventory = state.hero.inventory.filter((_, i) => i !== index);
  let s: GameState = {
    ...state,
    hero: { ...state.hero, inventory },
    phase: 'playing',
  };

  switch (item.type) {
    case 'hiPotion': {
      const healed = Math.min(10, s.hero.maxHp - s.hero.hp);
      s = {
        ...s,
        hero: { ...s.hero, hp: Math.min(s.hero.maxHp, s.hero.hp + 10) },
        log: [
          ...s.log,
          {
            turn: s.turn,
            text: healed > 0 ? `高级恢复药恢复了 ${healed} 点生命值。` : '当前生命值已满。',
          },
        ],
      };
      break;
    }
    case 'scrollOfMight': {
      const buffs = [
        ...s.hero.buffs.filter((b) => b.type !== 'might'),
        { type: 'might' as const, value: 3, turnsLeft: 5 },
      ];
      s = {
        ...s,
        hero: { ...s.hero, buffs },
        log: [...s.log, { turn: s.turn, text: '力量提升！攻击 +3，持续 5 回合。' }],
      };
      break;
    }
    case 'gridanianRation': {
      // Hunger system deferred — item is consumable with no combat effect yet.
      s = {
        ...s,
        log: [...s.log, { turn: s.turn, text: '你吃下了格里达尼亚干粮。' }],
      };
      break;
    }
  }

  return s;
}

/** Tick buff durations after a player action. */
export function tickBuffs(state: GameState): GameState {
  const buffs = state.hero.buffs
    .map((b) => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter((b) => b.turnsLeft > 0);

  const expired = state.hero.buffs.length > buffs.length;
  let s: GameState = { ...state, hero: { ...state.hero, buffs } };
  if (expired) {
    s = {
      ...s,
      log: [...s.log, { turn: s.turn, text: '力量效果消失了。' }],
    };
  }
  return s;
}
