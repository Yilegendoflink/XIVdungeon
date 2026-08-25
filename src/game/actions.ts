import { DEFAULT_PLAYER_JOB, SAVE_VERSION } from '@/config';
import { getJobDefinition } from '@/data/jobs';
import {
  DEFAULT_GAME_MODIFIERS,
  maxHpForAttributes,
  rollLevelUpRewards,
  type FloorState,
  type GameModifiers,
  type GameState,
  type LevelUpRewardId,
} from '@/game/state';
import { idx } from '@/game/state';
import { generateFloor } from '@/world/generate';
import { computeFOV } from '@/world/fov';

export type PlayerAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'attack'; enemyId: string }
  | { type: 'wait' }
  | { type: 'toggleInventory' }
  | { type: 'useItem'; index: number }
  | { type: 'useSkill'; skillId: 'jump'; x: number; y: number }
  | { type: 'chooseLevelReward'; reward: LevelUpRewardId }
  | { type: 'closeOverlay' };

export function applyFloorModifiers(floor: FloorState, modifiers: GameModifiers): FloorState {
  // 目标直达用于跳过普通楼层任务，最终 Boss 仍需正常击破。
  if (!modifiers.autoCompleteObjectives || floor.isBossFloor || floor.exitUnlocked) return floor;
  return {
    ...floor,
    objective: { ...floor.objective, progress: floor.objective.target },
    exitUnlocked: true,
  };
}

export function createNewGame(
  seed = Date.now(),
  jobId = DEFAULT_PLAYER_JOB,
  modifiers: GameModifiers = DEFAULT_GAME_MODIFIERS,
): GameState {
  const floor = applyFloorModifiers(generateFloor(seed, 1), modifiers);
  const entranceY = Math.floor(floor.entranceIndex / floor.width);
  const entranceX = floor.entranceIndex % floor.width;

  const job = getJobDefinition(jobId) ?? getJobDefinition(DEFAULT_PLAYER_JOB);
  if (!job) throw new Error('未找到默认职业');
  const attributes = { ...job.attributes };
  const maxHp = maxHpForAttributes(attributes);

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    turn: 0,
    phase: 'playing',
    modifiers: { ...modifiers },
    hero: {
      x: entranceX,
      y: entranceY,
      jobId: job.id,
      hp: maxHp,
      maxHp,
      mp: 100,
      maxMp: 100,
      jobResources: job.resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        current: resource.initial,
        max: resource.max,
      })),
      gil: 0,
      level: 1,
      experience: 0,
      attributes,
      skillCooldowns: { jump: 0 },
      def: 2,
      inventory: [],
      buffs: [],
    },
    floor,
    damageEventSequence: 0,
    damageEvents: [],
    levelUpRewards: [],
    pendingLevelRewards: 0,
    log: [
      { turn: 0, text: '你进入了地牢。' },
      { turn: 0, text: `第 1 层目标：${floor.objective.label}` },
    ],
    stats: { kills: 0, experience: 0 },
  };

  computeFOV(state.floor, state.hero.x, state.hero.y);
  return state;
}

export function applyLevelUpReward(state: GameState, reward: LevelUpRewardId): GameState {
  if (state.phase !== 'levelUp' || !state.levelUpRewards.includes(reward)) return state;
  const job = getJobDefinition(state.hero.jobId);
  if (!job) return state;
  const attributes = { ...state.hero.attributes };
  let label: string;
  if (reward === 'attack') {
    attributes[job.primaryAttribute] = Math.ceil(attributes[job.primaryAttribute] * 1.3);
    label = '攻击强化';
  } else if (reward === 'survival') {
    const beforeMaxHp = maxHpForAttributes(attributes);
    attributes.tenacity = Math.ceil(attributes.tenacity * 1.3);
    const maxHp = state.hero.maxHp + maxHpForAttributes(attributes) - beforeMaxHp;
    const remaining = state.pendingLevelRewards - 1;
    return {
      ...state,
      hero: { ...state.hero, attributes, maxHp },
      pendingLevelRewards: remaining,
      levelUpRewards: remaining > 0 ? rollLevelUpRewards() : [],
      phase: remaining > 0 ? 'levelUp' : 'playing',
      log: [...state.log, { turn: state.turn, text: `获得升级奖励：生存强化（坚韧 ${attributes.tenacity}）。` }],
    };
  } else {
    attributes.criticalHit = Math.ceil(attributes.criticalHit * 1.3);
    label = '暴击强化';
  }
  const remaining = state.pendingLevelRewards - 1;
  return {
    ...state,
    hero: { ...state.hero, attributes },
    pendingLevelRewards: remaining,
    levelUpRewards: remaining > 0 ? rollLevelUpRewards() : [],
    phase: remaining > 0 ? 'levelUp' : 'playing',
    log: [...state.log, { turn: state.turn, text: `获得升级奖励：${label}。` }],
  };
}

export function addLog(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, text }] };
}

export function heroOnExit(state: GameState): boolean {
  return idx(state.hero.x, state.hero.y, state.floor.width) === state.floor.exitIndex;
}
