import { activeSkillIds, SKILL_DEFINITIONS, type SkillDefinition } from '@/data/skills';
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

export function skillRangeFor(_hero: GameState['hero'], skillId: SkillId): number {
  return SKILL_DEFINITIONS[skillId].range;
}

export function cooldownTurnsFor(_hero: GameState['hero'], skillId: SkillId): number {
  const base = SKILL_DEFINITIONS[skillId].cooldownTurns;
  return base;
}

export function skillSpendsTurn(skillId: SkillId): boolean {
  return SKILL_DEFINITIONS[skillId].spendsTurn;
}

export function canUseSkill(state: GameState, skillId: SkillId): boolean {
  const skill = SKILL_DEFINITIONS[skillId];
  return state.phase === 'playing' &&
    activeSkillIds(state.hero).includes(skillId) &&
    state.hero.mp >= skill.mpCost &&
    state.hero.skillCooldowns[skillId] === 0;
}

export function canTargetJump(state: GameState, target: SkillTarget): boolean {
  const { hero, floor } = state;
  return (
    canUseSkill(state, 'jump') &&
    chebyshevDistance(hero, target) > 0 &&
    chebyshevDistance(hero, target) <= skillRangeFor(hero, 'jump') &&
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
  for (let distance = 1; distance <= skillRangeFor(state.hero, 'jump'); distance += 1) {
    for (let dy = -distance; dy <= distance; dy += 1) {
      for (let dx = -distance; dx <= distance; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== distance) continue;
        const landing = { x: target.x + dx, y: target.y + dy };
        if (isPassable(state.floor, landing.x, landing.y) && !blocked.has(`${landing.x},${landing.y}`)) return landing;
      }
    }
  }
  return null;
}

function directionTarget(hero: GameState['hero'], target: SkillTarget): { dx: number; dy: number } | null {
  const dx = target.x - hero.x;
  const dy = target.y - hero.y;
  if (dx !== 0 && dy !== 0) return null;
  if (dx === 0 && dy === 0) return null;
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  if (distance > SKILL_DEFINITIONS.geirskogul.range) return null;
  return { dx: Math.sign(dx), dy: Math.sign(dy) };
}

export function canTargetGeirskogul(state: GameState, target: SkillTarget): boolean {
  return canUseSkill(state, 'geirskogul') &&
    directionTarget(state.hero, target) !== null &&
    state.floor.visibility[idx(target.x, target.y, state.floor.width)] === 'visible' &&
    isPassable(state.floor, target.x, target.y);
}

function hasPassive(state: GameState, passiveId: GameState['hero']['passives'][number]): boolean {
  return state.hero.passives.includes(passiveId);
}

function jumpFamilySkillIds(): SkillId[] {
  return (Object.values(SKILL_DEFINITIONS) as SkillDefinition[])
    .filter((skill) => skill.jumpFamily)
    .map((skill) => skill.id);
}

/** Blood of the Dragon: Jump and its upgrades build Dragon Eye, up to three stacks. */
function grantDragonEye(state: GameState, skillId: SkillId): GameState {
  if (!SKILL_DEFINITIONS[skillId].jumpFamily || !hasPassive(state, 'bloodOfDragon')) return state;
  const current = state.hero.buffs.find((buff) => buff.type === 'dragonEye')?.stacks ?? 0;
  const stacks = Math.min(3, current + 1);
  return {
    ...state,
    hero: {
      ...state.hero,
      buffs: [
        ...state.hero.buffs.filter((buff) => buff.type !== 'dragonEye'),
        { type: 'dragonEye', stacks },
      ],
    },
    log: [...state.log, { turn: state.turn, text: `获得 1 层龙眼（${stacks}/3）。` }],
  };
}

/** Jump Mastery: every non-Jump skill reduces Jump-family cooldowns by two turns. */
function applyJumpMastery(state: GameState, skillId: SkillId): GameState {
  if (!hasPassive(state, 'jumpMastery') || SKILL_DEFINITIONS[skillId].jumpFamily) return state;
  const skillCooldowns = { ...state.hero.skillCooldowns };
  for (const jumpSkillId of jumpFamilySkillIds()) {
    skillCooldowns[jumpSkillId] = Math.max(0, (skillCooldowns[jumpSkillId] ?? 0) - 2);
  }
  return { ...state, hero: { ...state.hero, skillCooldowns } };
}

function finalizeSkill(state: GameState, skillId: SkillId, next: GameState): GameState {
  if (next === state) return state;
  return applyJumpMastery(grantDragonEye(next, skillId), skillId);
}

function useLifeSurge(state: GameState): GameState {
  if (!canUseSkill(state, 'lifeSurge')) return state;
  return {
    ...state,
    hero: {
      ...state.hero,
      mp: state.hero.mp,
      skillCooldowns: { ...state.hero.skillCooldowns, lifeSurge: cooldownTurnsFor(state.hero, 'lifeSurge') },
      buffs: [...state.hero.buffs.filter((buff) => buff.type !== 'lifeSurge'), { type: 'lifeSurge', turnsLeft: 3 }],
    },
    log: [...state.log, { turn: state.turn, text: '你获得了龙剑效果：下一次造成伤害必定暴击。' }],
  };
}

function useDragonSight(state: GameState): GameState {
  if (!canUseSkill(state, 'dragonSight')) return state;
  return {
    ...state,
    hero: {
      ...state.hero,
      mp: state.hero.mp - SKILL_DEFINITIONS.dragonSight.mpCost,
      skillCooldowns: { ...state.hero.skillCooldowns, dragonSight: cooldownTurnsFor(state.hero, 'dragonSight') },
      buffs: [...state.hero.buffs.filter((buff) => buff.type !== 'dragonSight'), { type: 'dragonSight', turnsLeft: 10 }],
    },
    log: [...state.log, { turn: state.turn, text: '你施放了巨龙视线：全伤害提高 100%，持续 10 回合。' }],
  };
}

function useElusiveJump(state: GameState): GameState {
  if (!canUseSkill(state, 'elusiveJump')) return state;
  const direction = state.hero.lastDirection ?? { dx: 0, dy: 1 };
  let x = state.hero.x;
  let y = state.hero.y;
  for (let step = 0; step < SKILL_DEFINITIONS.elusiveJump.range; step += 1) {
    const nx = x - direction.dx;
    const ny = y - direction.dy;
    if (!isPassable(state.floor, nx, ny) || state.floor.enemies.some((enemy) => enemy.x === nx && enemy.y === ny)) break;
    x = nx;
    y = ny;
  }
  return {
    ...state,
    hero: {
      ...state.hero,
      x,
      y,
      mp: state.hero.mp - SKILL_DEFINITIONS.elusiveJump.mpCost,
      skillCooldowns: { ...state.hero.skillCooldowns, elusiveJump: cooldownTurnsFor(state.hero, 'elusiveJump') },
    },
    floor: {
      ...state.floor,
      enemies: state.floor.enemies.map((enemy) => enemy.isBoss ? enemy : { ...enemy, aiState: 'free' as const }),
    },
    log: [...state.log, { turn: state.turn, text: '你施放了回避跳跃，拉开了距离。' }],
  };
}

function useGeirskogul(state: GameState, target: SkillTarget): GameState {
  if (!canUseSkill(state, 'geirskogul')) return state;
  const direction = directionTarget(state.hero, target);
  if (!direction) return state;
  const dragonEye = hasPassive(state, 'bloodOfDragon')
    ? state.hero.buffs.find((buff) => buff.type === 'dragonEye')?.stacks ?? 0
    : 0;
  let s: GameState = {
    ...state,
    hero: {
      ...state.hero,
      mp: state.hero.mp - SKILL_DEFINITIONS.geirskogul.mpCost,
      skillCooldowns: { ...state.hero.skillCooldowns, geirskogul: cooldownTurnsFor(state.hero, 'geirskogul') },
      buffs: state.hero.buffs.filter((buff) => buff.type !== 'dragonEye'),
    },
  };
  for (let distance = 1; distance <= SKILL_DEFINITIONS.geirskogul.range; distance += 1) {
    const x = state.hero.x + direction.dx * distance;
    const y = state.hero.y + direction.dy * distance;
    if (!isPassable(state.floor, x, y)) break;
    const enemy = s.floor.enemies.find((candidate) => candidate.x === x && candidate.y === y);
    if (enemy) s = damageEnemy(s, enemy, resolvePlayerDamage(s.hero, enemy.def, SKILL_DEFINITIONS.geirskogul.potency! + dragonEye * 200));
  }
  return { ...s, log: [...s.log, { turn: s.turn, text: '你施放了武神枪。' }] };
}

export function useSkill(state: GameState, skillId: SkillId, target: SkillTarget): GameState {
  if (skillId === 'lifeSurge') return finalizeSkill(state, skillId, useLifeSurge(state));
  if (skillId === 'dragonSight') return finalizeSkill(state, skillId, useDragonSight(state));
  if (skillId === 'elusiveJump') return finalizeSkill(state, skillId, useElusiveJump(state));
  if (skillId === 'geirskogul') return finalizeSkill(state, skillId, useGeirskogul(state, target));
  if (skillId !== 'jump' || !canTargetJump(state, target)) return state;

  const skill = SKILL_DEFINITIONS.jump;
  const targetEnemy = state.floor.enemies.find((enemy) => enemy.x === target.x && enemy.y === target.y);
  const result = targetEnemy ? resolvePlayerDamage(state.hero, targetEnemy.def, skill.potency!) : null;
  const killsTarget = targetEnemy !== undefined && (state.modifiers.oneHitKill || result!.amount >= targetEnemy.hp);
  const landing = targetEnemy ? (killsTarget ? target : nearestLanding(state, target)) : target;
  if (!landing) return state;
  const afterDamage = targetEnemy && result ? damageEnemy(state, targetEnemy, result) : state;
  const next = {
    ...afterDamage,
    hero: {
      ...afterDamage.hero,
      x: landing.x,
      y: landing.y,
      mp: afterDamage.hero.mp - skill.mpCost,
      skillCooldowns: { ...afterDamage.hero.skillCooldowns, jump: cooldownTurnsFor(afterDamage.hero, 'jump') },
    },
    log: [...afterDamage.log, { turn: afterDamage.turn, text: targetEnemy ? '你施放了跳跃，落向敌人。' : '你施放了跳跃。' }],
  };
  return finalizeSkill(state, skillId, next);
}
