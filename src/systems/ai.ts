import type { EnemyState, GameState } from '@/game/state';
import { isPassable } from '@/game/state';
import { canSee } from '@/world/fov';
import { stepAway, stepToward } from '@/world/pathfinding';
import { attackHero } from '@/systems/combat';

const ROOM_MOVE_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

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

function roomAt(state: GameState, x: number, y: number) {
  return state.floor.rooms.find((room) =>
    x >= room.left && x <= room.right && y >= room.top && y <= room.bottom,
  );
}

function getEnemy(state: GameState, id: string): EnemyState | undefined {
  return state.floor.enemies.find((enemy) => enemy.id === id);
}

function updateEnemy(state: GameState, enemy: EnemyState, changes: Partial<EnemyState>): GameState {
  return {
    ...state,
    floor: {
      ...state.floor,
      enemies: state.floor.enemies.map((candidate) =>
        candidate.id === enemy.id ? { ...candidate, ...changes } : candidate,
      ),
    },
  };
}

function moveEnemy(state: GameState, enemy: EnemyState, nx: number, ny: number): GameState {
  return updateEnemy(state, enemy, { x: nx, y: ny });
}

function setAggro(state: GameState, enemy: EnemyState): GameState {
  if (enemy.aiState === 'aggro') return state;
  return updateEnemy(state, enemy, { aiState: 'aggro' });
}

function canAcquireAggro(state: GameState, enemy: EnemyState): boolean {
  return (
    enemy.aiType !== 'neutral' &&
    manhattan(enemy, state.hero) <= enemy.aggroRange &&
    canSee(state.floor, enemy.x, enemy.y, state.hero.x, state.hero.y)
  );
}

function randomRoomMove(state: GameState, enemy: EnemyState): GameState {
  const room = roomAt(state, enemy.x, enemy.y);
  if (!room) return state;

  const blocked = blockedSet(state, enemy.id);
  const candidates = ROOM_MOVE_DIRECTIONS
    .map((direction) => ({ x: enemy.x + direction.x, y: enemy.y + direction.y }))
    .filter((point) =>
      point.x >= room.left &&
      point.x <= room.right &&
      point.y >= room.top &&
      point.y <= room.bottom &&
      isPassable(state.floor, point.x, point.y) &&
      !blocked.has(`${point.x},${point.y}`),
    );
  if (candidates.length === 0) return state;
  const candidate = candidates[Math.floor(Math.random() * candidates.length)];
  return candidate ? moveEnemy(state, enemy, candidate.x, candidate.y) : state;
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
  return bombAct(state, enemy);
}

function stationaryAct(state: GameState, enemy: EnemyState): GameState {
  if (manhattan(enemy, state.hero) === 1) return attackHero(state, enemy, false);
  return state;
}

function patrolAct(state: GameState, enemy: EnemyState): GameState {
  const currentRoom = roomAt(state, enemy.x, enemy.y);
  const existingTarget = enemy.patrolTargetRoomId === undefined
    ? undefined
    : state.floor.rooms.find((room) => room.id === enemy.patrolTargetRoomId);
  const target = existingTarget && (!currentRoom || existingTarget.id !== currentRoom.id)
    ? existingTarget
    : state.floor.rooms
      .filter((room) => !currentRoom || room.id !== currentRoom.id)
      .sort(() => Math.random() - 0.5)[0];
  if (!target) return state;

  const next = enemy.patrolTargetRoomId === target.id
    ? state
    : updateEnemy(state, enemy, { patrolTargetRoomId: target.id });
  const current = getEnemy(next, enemy.id);
  if (!current) return next;

  const step = stepToward(
    next.floor,
    current.x,
    current.y,
    target.cx,
    target.cy,
    blockedSet(next, current.id),
  );
  if (!step || (step.x === next.hero.x && step.y === next.hero.y)) return next;
  return moveEnemy(next, current, step.x, step.y);
}

function freeAct(state: GameState, enemy: EnemyState): GameState {
  switch (enemy.aiType) {
    case 'standard':
    case 'neutral':
      return randomRoomMove(state, enemy);
    case 'stationary':
      return state;
    case 'patrol':
      return patrolAct(state, enemy);
    case 'boss':
      return state;
  }
}

function aggroAct(state: GameState, enemy: EnemyState): GameState {
  switch (enemy.aiType) {
    case 'standard':
    case 'neutral':
      return enemy.type === 'cactuar' ? cactuarAct(state, enemy) : bombAct(state, enemy);
    case 'stationary':
      return stationaryAct(state, enemy);
    case 'patrol':
      return morbolAct(state, enemy);
    case 'boss':
      return bossAct(state, enemy);
  }
}

/** 独立的 Boss AI 入口；后续 Boss 脚本只需替换此函数。 */
function bossAct(state: GameState, enemy: EnemyState): GameState {
  if (enemy.aiState === 'free') {
    if (!canAcquireAggro(state, enemy)) return state;
    const aggroState = setAggro(state, enemy);
    const aggroEnemy = getEnemy(aggroState, enemy.id);
    return aggroEnemy ? bombAct(aggroState, aggroEnemy) : aggroState;
  }
  return bombAct(state, enemy);
}

/** 每个存活敌人每回合行动一次；自由态和仇恨态使用不同逻辑。 */
export function processEnemyTurns(state: GameState): GameState {
  let currentState = state;
  const ids = currentState.floor.enemies.map((enemy) => enemy.id);

  for (const id of ids) {
    const enemy = getEnemy(currentState, id);
    if (!enemy) continue;

    if (enemy.aiType === 'boss') {
      currentState = bossAct(currentState, enemy);
      continue;
    }

    if (enemy.aiState === 'free' && canAcquireAggro(currentState, enemy)) {
      currentState = setAggro(currentState, enemy);
    }

    const currentEnemy = getEnemy(currentState, id);
    if (!currentEnemy) continue;
    currentState = currentEnemy.aiState === 'aggro'
      ? aggroAct(currentState, currentEnemy)
      : freeAct(currentState, currentEnemy);
  }
  return currentState;
}
