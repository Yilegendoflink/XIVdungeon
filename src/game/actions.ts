import { DEFAULT_PLAYER_JOB, SAVE_VERSION } from '@/config';
import { getJobDefinition } from '@/data/jobs';
import { DEFAULT_GAME_MODIFIERS, type FloorState, type GameModifiers, type GameState } from '@/game/state';
import { idx } from '@/game/state';
import { generateFloor } from '@/world/generate';
import { computeFOV } from '@/world/fov';

export type PlayerAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'attack'; enemyId: string }
  | { type: 'wait' }
  | { type: 'toggleInventory' }
  | { type: 'useItem'; index: number }
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
      hp: 20,
      maxHp: 20,
      mp: 10,
      maxMp: 10,
      jobResources: job.resources.map((resource) => ({
        id: resource.id,
        name: resource.name,
        current: resource.initial,
        max: resource.max,
      })),
      gil: 0,
      atk: 5,
      def: 1,
      inventory: [],
      buffs: [],
    },
    floor,
    damageEventSequence: 0,
    damageEvents: [],
    log: [
      { turn: 0, text: '你进入了地牢。' },
      { turn: 0, text: `第 1 层目标：${floor.objective.label}` },
    ],
    stats: { kills: 0, experience: 0 },
  };

  computeFOV(state.floor, state.hero.x, state.hero.y);
  return state;
}

export function addLog(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, text }] };
}

export function heroOnExit(state: GameState): boolean {
  return idx(state.hero.x, state.hero.y, state.floor.width) === state.floor.exitIndex;
}
