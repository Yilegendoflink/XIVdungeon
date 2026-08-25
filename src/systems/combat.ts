import type { DamageEventKind, EnemyState, FloorState, GameState, HeroState } from '@/game/state';
import { enemyName, heroAtk } from '@/game/state';
import { findTerrainPath } from '@/world/pathfinding';

export const BASIC_ATTACK_RANGE = 2;

export function attackDistance(floor: FloorState, hero: HeroState, enemy: EnemyState): number | null {
  const path = findTerrainPath(floor, hero.x, hero.y, enemy.x, enemy.y);
  return path.length > 0 ? path.length : null;
}

export function canBasicAttack(floor: FloorState, hero: HeroState, enemy: EnemyState): boolean {
  const distance = attackDistance(floor, hero, enemy);
  return distance !== null && distance <= BASIC_ATTACK_RANGE;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function addDamageEvent(
  state: GameState,
  kind: DamageEventKind,
  x: number,
  y: number,
  amount: number,
): GameState {
  const sequence = state.damageEventSequence + 1;
  return {
    ...state,
    damageEventSequence: sequence,
    damageEvents: [
      ...state.damageEvents,
      { id: `damage-${sequence}`, x, y, amount, kind },
    ].slice(-32),
  };
}

function updateObjectiveAfterKill(state: GameState, enemy: EnemyState): GameState {
  const objective = state.floor.objective;
  const countsKill =
    (objective.type === 'defeatCount' && !enemy.isSpecial && !enemy.isBoss) ||
    (objective.type === 'defeatSpecial' && enemy.isSpecial) ||
    (objective.type === 'finalBoss' && enemy.isBoss);
  if (!countsKill) return state;

  const nextObjective = {
    ...objective,
    progress: Math.min(objective.target, objective.progress + 1),
  };
  const completed = nextObjective.progress >= nextObjective.target;
  let next: GameState = {
    ...state,
    floor: {
      ...state.floor,
      objective: nextObjective,
      exitUnlocked: completed,
    },
  };

  if (completed) {
    if (objective.type === 'finalBoss') {
      next = {
        ...next,
        phase: 'victory',
        log: [...next.log, { turn: next.turn, text: '最终 Boss 被击败了！你完成了本轮冒险。' }],
      };
    } else {
      next = {
        ...next,
        log: [...next.log, { turn: next.turn, text: '楼层目标已完成，出口已解锁！' }],
      };
    }
  }
  return next;
}

export function calcDamage(atk: number, def: number): number {
  return Math.max(1, atk - Math.floor(def / 2) + randInt(-1, 1));
}

export function attackEnemy(state: GameState, enemy: EnemyState): GameState {
  if (!canBasicAttack(state.floor, state.hero, enemy)) return state;

  const dmg = state.modifiers.oneHitKill
    ? enemy.hp
    : calcDamage(heroAtk(state.hero), enemy.def);
  const enemies = state.floor.enemies
    .map((e) => (e.id === enemy.id ? { ...e, hp: e.hp - dmg } : e))
    .filter((e) => e.hp > 0);

  let s: GameState = {
    ...state,
    floor: { ...state.floor, enemies },
    log: [...state.log, { turn: state.turn, text: `你攻击了${enemyName(enemy.type)}，造成 ${dmg} 点伤害。` }],
  };
  s = addDamageEvent(s, 'dealt', enemy.x, enemy.y, dmg);

  if (!enemies.some((e) => e.id === enemy.id)) {
    s = {
      ...s,
      stats: { kills: s.stats.kills + 1 },
      log: [...s.log, { turn: s.turn, text: `${enemyName(enemy.type)} 被击败了！` }],
    };
    s = updateObjectiveAfterKill(s, enemy);
  }
  return s;
}

export function attackHero(state: GameState, enemy: EnemyState, ranged = false): GameState {
  const dmg = calcDamage(enemy.atk, state.hero.def);
  const hero: HeroState = {
    ...state.hero,
    hp: state.modifiers.infiniteHp ? state.hero.maxHp : state.hero.hp - dmg,
  };
  const verb = ranged ? '射击' : '攻击';
  return addDamageEvent({
    ...state,
    hero,
    log: [
      ...state.log,
      {
        turn: state.turn,
        text: state.modifiers.infiniteHp
          ? `${enemyName(enemy.type)}${verb}你，但无限血量生效。`
          : `${enemyName(enemy.type)}${verb}你，造成 ${dmg} 点伤害。`,
      },
    ],
  }, 'received', state.hero.x, state.hero.y, dmg);
}
