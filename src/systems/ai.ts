import type { EnemyState, GameState } from '@/game/state';
import { canSee } from '@/world/fov';
import { stepAway, stepToward } from '@/world/pathfinding';
import { attackHero } from '@/systems/combat';

function blockedSet(state: GameState, selfId: string): Set<string> {
  const set = new Set<string>();
  set.add(`${state.hero.x},${state.hero.y}`);
  for (const e of state.floor.enemies) {
    if (e.id !== selfId) set.add(`${e.x},${e.y}`);
  }
  return set;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function moveEnemy(state: GameState, enemy: EnemyState, nx: number, ny: number): GameState {
  return {
    ...state,
    floor: {
      ...state.floor,
      enemies: state.floor.enemies.map((e) =>
        e.id === enemy.id ? { ...e, x: nx, y: ny } : e,
      ),
    },
  };
}

function bombAct(state: GameState, enemy: EnemyState): GameState {
  const dist = manhattan(enemy, state.hero);
  if (dist === 1) return attackHero(state, enemy, false);

  const step = stepToward(
    state.floor,
    enemy.x,
    enemy.y,
    state.hero.x,
    state.hero.y,
    blockedSet(state, enemy.id),
  );
  if (!step) return state;
  // Don't step onto hero (attack handled above)
  if (step.x === state.hero.x && step.y === state.hero.y) return state;
  return moveEnemy(state, enemy, step.x, step.y);
}

function cactuarAct(state: GameState, enemy: EnemyState): GameState {
  const dist = manhattan(enemy, state.hero);
  if (dist > 2) return attackHero(state, enemy, true);

  const step = stepAway(
    state.floor,
    enemy.x,
    enemy.y,
    state.hero.x,
    state.hero.y,
    blockedSet(state, enemy.id),
  );
  if (!step) return state;
  return moveEnemy(state, enemy, step.x, step.y);
}

function morbolAct(state: GameState, enemy: EnemyState): GameState {
  // Elite melee — same as Bomb
  return bombAct(state, enemy);
}

/** Each living enemy that can see the hero acts once. */
export function processEnemyTurns(state: GameState): GameState {
  let s = state;
  // Snapshot ids so removals during the loop are fine
  const ids = s.floor.enemies.map((e) => e.id);

  for (const id of ids) {
    const enemy = s.floor.enemies.find((e) => e.id === id);
    if (!enemy) continue;
    if (!canSee(s.floor, enemy.x, enemy.y, s.hero.x, s.hero.y)) continue;

    switch (enemy.type) {
      case 'bomb':
        s = bombAct(s, enemy);
        break;
      case 'cactuar':
        s = cactuarAct(s, enemy);
        break;
      case 'morbol':
        s = morbolAct(s, enemy);
        break;
    }
  }
  return s;
}
