import { SKILL_DEFINITIONS } from '@/data/skills';
import { getJobDefinition } from '@/data/jobs';
import type { GameState, SkillId } from '@/game/state';
import { idx, isPassable } from '@/game/state';
import { damageEnemy, resolvePlayerDamage } from '@/systems/combat';

export interface SkillTarget {
  x: number;
  y: number;
}

export function chebyshevDistance(a: SkillTarget, b: SkillTarget): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function canTargetJump(state: GameState, target: SkillTarget): boolean {
  const skill = SKILL_DEFINITIONS.jump;
  const { hero, floor } = state;
  const job = getJobDefinition(hero.jobId);
  return (
    state.phase === 'playing' &&
    job?.skills.includes('jump') === true &&
    hero.mp >= skill.mpCost &&
    hero.skillCooldowns.jump === 0 &&
    chebyshevDistance(hero, target) > 0 &&
    chebyshevDistance(hero, target) <= skill.range &&
    isPassable(floor, target.x, target.y) &&
    floor.visibility[idx(target.x, target.y, floor.width)] === 'visible' &&
    !floor.items.some((item) => item.x === target.x && item.y === target.y)
  );
}

function nearestLanding(state: GameState, target: SkillTarget): SkillTarget | null {
  const blocked = new Set([
    ...state.floor.enemies.map((enemy) => `${enemy.x},${enemy.y}`),
    ...state.floor.items.map((item) => `${item.x},${item.y}`),
  ]);
  for (let distance = 1; distance <= SKILL_DEFINITIONS.jump.range; distance += 1) {
    for (let dy = -distance; dy <= distance; dy += 1) {
      for (let dx = -distance; dx <= distance; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const landing = { x: target.x + dx, y: target.y + dy };
        if (isPassable(state.floor, landing.x, landing.y) && !blocked.has(`${landing.x},${landing.y}`)) {
          return landing;
        }
      }
    }
  }
  return null;
}

export function useSkill(state: GameState, skillId: SkillId, target: SkillTarget): GameState {
  if (skillId !== 'jump' || !canTargetJump(state, target)) return state;
  const skill = SKILL_DEFINITIONS.jump;
  const targetEnemy = state.floor.enemies.find((enemy) => enemy.x === target.x && enemy.y === target.y);
  const result = targetEnemy ? resolvePlayerDamage(state.hero, targetEnemy.def, skill.potency) : null;
  const killsTarget = targetEnemy !== undefined && (state.modifiers.oneHitKill || result!.amount >= targetEnemy.hp);
  const landing = targetEnemy
    ? (killsTarget ? target : nearestLanding(state, target))
    : target;
  if (!landing) return state;

  const afterDamage = targetEnemy && result ? damageEnemy(state, targetEnemy, result) : state;
  return {
    ...afterDamage,
    hero: {
      ...afterDamage.hero,
      x: landing.x,
      y: landing.y,
      mp: afterDamage.hero.mp - skill.mpCost,
      skillCooldowns: { ...afterDamage.hero.skillCooldowns, jump: skill.cooldownTurns },
    },
    log: [...afterDamage.log, {
      turn: afterDamage.turn,
      text: targetEnemy ? `你施放了跳跃，落向${targetEnemy.type === 'morbol' ? '魔界花' : '敌人'}。` : '你施放了跳跃。',
    }],
  };
}
