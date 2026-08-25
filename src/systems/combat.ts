import type { DamageEventKind, EnemyState, FloorState, GameState, HeroState } from '@/game/state';
import { enemyName, gainExperience, heroAtk, rollLevelUpRewards } from '@/game/state';
import { ENEMY_DEFS } from '@/data/enemies';
import { getJobDefinition } from '@/data/jobs';
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

/** 基础伤害 = max(1, 攻击力 - floor(防御力 / 2) + [-1, 1] 随机浮动)。 */
export function calcDamage(atk: number, def: number): number {
  return Math.max(1, atk - Math.floor(def / 2) + randInt(-1, 1));
}

export interface PlayerDamageResult {
  amount: number;
  directHit: boolean;
  critical: boolean;
}

/**
 * 玩家普通攻击按“信念 -> 直击 -> 暴击”顺序结算；直击和暴击可同时触发。
 * 概率属性使用千分比，暴击倍率由暴击属性额外提高，最终伤害至少为 1。
 */
export function resolvePlayerDamage(hero: HeroState, defense: number, potency = 100): PlayerDamageResult {
  const primaryAttribute = getJobDefinition(hero.jobId)?.primaryAttribute ?? 'strength';
  let amount = calcDamage(heroAtk(hero, primaryAttribute) * (potency / 100), defense);
  amount = Math.round(amount * (1 + hero.attributes.determination / 1000));
  const directHit = Math.random() < Math.min(1, hero.attributes.directHit / 1000);
  const critical = Math.random() < Math.min(1, hero.attributes.criticalHit / 1000);
  if (directHit) amount = Math.round(amount * 1.4);
  if (critical) amount = Math.round(amount * (1.5 + Math.min(0.5, hero.attributes.criticalHit / 2000)));
  return { amount: Math.max(1, amount), directHit, critical };
}

/** 坚韧提供最高 50% 的敌方伤害减免，但不会让单次伤害低于 1。 */
export function mitigateHeroDamage(amount: number, hero: HeroState): number {
  return Math.max(1, Math.floor(amount * (1 - Math.min(0.5, hero.attributes.tenacity / 1000))));
}

export function damageEnemy(state: GameState, enemy: EnemyState, result: PlayerDamageResult): GameState {
  const dmg = state.modifiers.oneHitKill ? enemy.hp : result.amount;
  const enemies = state.floor.enemies
    .map((e) => (e.id === enemy.id ? { ...e, hp: e.hp - dmg, aiState: 'aggro' as const } : e))
    .filter((e) => e.hp > 0);

  let s: GameState = {
    ...state,
    floor: { ...state.floor, enemies },
    log: [...state.log, {
      turn: state.turn,
      text: `你攻击了${enemyName(enemy.type)}，造成 ${dmg} 点伤害。${result.directHit ? '直击！' : ''}${result.critical ? '暴击！' : ''}`,
    }],
  };
  s = addDamageEvent(s, 'dealt', enemy.x, enemy.y, dmg);

  if (!enemies.some((e) => e.id === enemy.id)) {
    const def = ENEMY_DEFS[enemy.type];
    const rewardMultiplier = enemy.isBoss ? 2 : 1;
    const experience = randInt(
      def.experience.min * rewardMultiplier,
      def.experience.max * rewardMultiplier,
    );
    const gil = randInt(def.gil.min * rewardMultiplier, def.gil.max * rewardMultiplier);
    const progression = gainExperience(s.hero, experience);
    s = {
      ...s,
      hero: { ...progression.hero, gil: s.hero.gil + gil },
      stats: { kills: s.stats.kills + 1, experience: s.stats.experience + experience },
      log: [...s.log, {
        turn: s.turn,
        text: `${enemyName(enemy.type)} 被击败了！获得 ${experience} 点经验和 ${gil} Gil。${progression.levelsGained > 0 ? `升级至 ${progression.hero.level} 级！` : ''}`,
      }],
    };
    s = updateObjectiveAfterKill(s, enemy);
    if (progression.levelsGained > 0 && s.phase !== 'victory') {
      s = {
        ...s,
        phase: 'levelUp',
        pendingLevelRewards: progression.levelsGained,
        levelUpRewards: rollLevelUpRewards(),
      };
    }
  }
  return s;
}

export function attackEnemy(state: GameState, enemy: EnemyState): GameState {
  if (!canBasicAttack(state.floor, state.hero, enemy)) return state;
  return damageEnemy(state, enemy, resolvePlayerDamage(state.hero, enemy.def));
}

export function attackHero(state: GameState, enemy: EnemyState, ranged = false): GameState {
  const dmg = mitigateHeroDamage(calcDamage(enemy.atk, state.hero.def), state.hero);
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
