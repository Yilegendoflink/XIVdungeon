import { BOSS_FLOOR_NUMBER } from '@/config';
import type { GameState } from '@/game/state';
import { isPassable } from '@/game/state';
import type { PlayerAction } from '@/game/actions';
import { applyFloorModifiers, heroOnExit } from '@/game/actions';
import { computeFOV } from '@/world/fov';
import { attackEnemy, BASIC_ATTACK_RANGE } from '@/systems/combat';
import { processEnemyTurns } from '@/systems/ai';
import { tickBuffs, tryPickup, useItem } from '@/systems/inventory';
import { generateFloor } from '@/world/generate';

function enemyInDirection(state: GameState, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return undefined;

  for (let distance = 1; distance <= BASIC_ATTACK_RANGE; distance++) {
    const x = state.hero.x + dx * distance;
    const y = state.hero.y + dy * distance;
    if (!isPassable(state.floor, x, y)) return undefined;
    const enemy = state.floor.enemies.find((candidate) => candidate.x === x && candidate.y === y);
    if (enemy) return enemy;
  }
  return undefined;
}

function applyPlayerAction(state: GameState, action: PlayerAction): GameState {
  if (action.type === 'toggleInventory') {
    return {
      ...state,
      phase: state.phase === 'inventory' ? 'playing' : 'inventory',
    };
  }

  if (action.type === 'closeOverlay') {
    if (state.phase === 'inventory') return { ...state, phase: 'playing' };
    return state;
  }

  if (state.phase === 'inventory') {
    if (action.type === 'useItem') return useItem(state, action.index);
    return state;
  }

  if (state.phase !== 'playing') return state;

  if (action.type === 'useItem') {
    return useItem(state, action.index);
  }

  if (action.type === 'attack') {
    const enemy = state.floor.enemies.find((candidate) => candidate.id === action.enemyId);
    return enemy ? attackEnemy(state, enemy) : state;
  }

  if (action.type === 'wait') {
    return { ...state, log: [...state.log, { turn: state.turn, text: '你等待了一回合。' }] };
  }

  if (action.type === 'move') {
    const directionalEnemy = enemyInDirection(state, action.dx, action.dy);
    if (directionalEnemy) return attackEnemy(state, directionalEnemy);

    const nx = state.hero.x + action.dx;
    const ny = state.hero.y + action.dy;
    const enemy = state.floor.enemies.find((e) => e.x === nx && e.y === ny);
    if (enemy) return attackEnemy(state, enemy);

    if (!isPassable(state.floor, nx, ny)) return state;

    let s: GameState = {
      ...state,
      hero: { ...state.hero, x: nx, y: ny },
    };
    s = tryPickup(s);

    if (heroOnExit(s)) {
      if (s.floor.exitUnlocked) {
        const nextFloorNumber = s.floor.number + 1;
        if (nextFloorNumber > BOSS_FLOOR_NUMBER) return s;
        const nextFloor = applyFloorModifiers(
          generateFloor(s.seed + nextFloorNumber * 100003, nextFloorNumber),
          s.modifiers,
        );
        const entranceY = Math.floor(nextFloor.entranceIndex / nextFloor.width);
        const entranceX = nextFloor.entranceIndex % nextFloor.width;
        return {
          ...s,
          hero: { ...s.hero, x: entranceX, y: entranceY },
          floor: nextFloor,
          log: [
            ...s.log,
            {
              turn: s.turn,
              text: nextFloor.isBossFloor
                ? '你进入了最终 Boss 层。'
                : `你进入了第 ${nextFloor.number} 层：${nextFloor.objective.label}`,
            },
          ],
        };
      }
      return {
        ...s,
        log: [...s.log, { turn: s.turn, text: '出口被封锁了。击败魔界花后才能通过。' }],
      };
    }
    return s;
  }

  return state;
}

/**
 * processPlayerAction → buff tick → enemies act → turn+1 → death/victory → render (caller)
 */
export function processTurn(state: GameState, action: PlayerAction): GameState {
  // UI-only actions don't advance the turn
  if (
    action.type === 'toggleInventory' ||
    action.type === 'closeOverlay' ||
    (state.phase === 'inventory' && action.type !== 'useItem')
  ) {
    return applyPlayerAction(state, action);
  }

  if (state.phase !== 'playing' && !(state.phase === 'inventory' && action.type === 'useItem')) {
    return state;
  }

  const s0 = applyPlayerAction(state, action);
  // Wall bump / empty item slot return the same reference — no turn spent
  if (s0 === state) return state;

  let s = s0;
  if (s.phase === 'victory') return s;
  const floorChanged = s.floor.number !== state.floor.number;

  // Using an item from inventory still spends a turn
  s = tickBuffs(s);
  computeFOV(s.floor, s.hero.x, s.hero.y);
  if (floorChanged) return { ...s, turn: s.turn + 1 };
  s = processEnemyTurns(s);
  s = { ...s, turn: s.turn + 1 };

  if (s.hero.hp <= 0) {
    s = {
      ...s,
      hero: { ...s.hero, hp: 0 },
      phase: 'dead',
      log: [...s.log, { turn: s.turn, text: '你倒下了……' }],
    };
  }

  return s;
}
