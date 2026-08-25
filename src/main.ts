import '@/styles/main.css';
import { DEFAULT_PLAYER_JOB, MAP_H, MAP_W, RENDER_SCALE, SAVE_KEY, TILE_SIZE } from '@/config';
import { getJobDefinition, type JobId } from '@/data/jobs';
import { createNewGame, type PlayerAction } from '@/game/actions';
import { processTurn } from '@/game/turn';
import { DEFAULT_GAME_MODIFIERS, type GameModifiers, type GameState } from '@/game/state';
import type { SkillId } from '@/game/state';
import { idx, isPassable } from '@/game/state';
import { computeFOV } from '@/world/fov';
import { findPath } from '@/world/pathfinding';
import { GameRenderer } from '@/render/app';
import { bindUI, setAttributesPanelOpen, updateJobSelection, updateScreens } from '@/ui/screens';
import { deleteSave, loadGame, saveGame } from '@/save/save';
import { canTargetJump } from '@/systems/skills';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ui = bindUI();

let state: GameState | null = null;
let renderer: GameRenderer;
let onTitle = true;
let jobSelectionOpen = false;
let selectedJob: JobId = DEFAULT_PLAYER_JOB;
let selectedModifiers: GameModifiers = { ...DEFAULT_GAME_MODIFIERS };
let pathToken = 0;
let pathTimer: number | null = null;
let targetingSkill: SkillId | null = null;
let animationLocked = false;

function saveExists(): boolean {
  try {
    if (!localStorage.getItem(SAVE_KEY)) return false;
    return loadGame() !== null;
  } catch {
    return false;
  }
}

function refresh(): void {
  updateJobSelection(ui, onTitle && jobSelectionOpen, selectedJob, selectedModifiers);
  if (onTitle) {
    ui.titleScreen.classList.remove('hidden');
    ui.victoryScreen.classList.add('hidden');
    ui.deathScreen.classList.add('hidden');
    ui.invOverlay.classList.add('hidden');
    ui.bagBtn.classList.add('hidden');
    ui.continueBtn.classList.toggle('hidden', !saveExists());
    return;
  }

  if (!state) return;
  updateScreens(ui, state, {
    hasSave: saveExists(),
    onUseItem: (index) => dispatch({ type: 'useItem', index }),
    onChooseLevelReward: (reward) => dispatch({ type: 'chooseLevelReward', reward }),
    onSelectSkill: startSkillTargeting,
  });
  renderer.render(state);
  if (targetingSkill === 'jump') renderer.setJumpTargeting(true, state);
}

function startNewGame(jobId = selectedJob): void {
  cancelAutoPath();
  deleteSave();
  setAttributesPanelOpen(ui, false);
  onTitle = false;
  jobSelectionOpen = false;
  state = createNewGame(Date.now(), jobId, selectedModifiers);
  refresh();
  void renderer.setPlayerJobTexture(jobId).then(refresh);
}

function openJobSelection(): void {
  cancelAutoPath();
  deleteSave();
  setAttributesPanelOpen(ui, false);
  state = null;
  onTitle = true;
  jobSelectionOpen = true;
  selectedJob = DEFAULT_PLAYER_JOB;
  selectedModifiers = { ...DEFAULT_GAME_MODIFIERS };
  refresh();
}

function continueGame(): void {
  const saved = loadGame();
  if (!saved || saved.phase === 'dead' || saved.phase === 'victory') {
    startNewGame();
    return;
  }
  onTitle = false;
  jobSelectionOpen = false;
  setAttributesPanelOpen(ui, false);
  state = saved;
  computeFOV(state.floor, state.hero.x, state.hero.y);
  refresh();
  void renderer.setPlayerJobTexture(state.hero.jobId).then(refresh);
}

function dispatch(action: PlayerAction, fromAutoPath = false): void {
  if (!fromAutoPath) cancelAutoPath();
  if (onTitle || !state || animationLocked) return;
  if (state.phase === 'dead' || state.phase === 'victory') return;

  const previous = state;
  state = processTurn(state, action);

  const jumped = action.type === 'useSkill' && state !== previous && state.hero.skillCooldowns.jump > previous.hero.skillCooldowns.jump;
  if (jumped) {
    animationLocked = true;
    renderer.playJump(
      { x: previous.hero.x, y: previous.hero.y },
      { x: state.hero.x, y: state.hero.y },
      () => {
        animationLocked = false;
        refresh();
      },
    );
  }

  if (state.phase === 'playing' || state.phase === 'inventory' || state.phase === 'levelUp') {
    saveGame(state);
  } else if (state.phase === 'dead' || state.phase === 'victory') {
    deleteSave();
  }

  refresh();
}

function startSkillTargeting(skillId: SkillId): void {
  if (!state || state.phase !== 'playing' || animationLocked) return;
  targetingSkill = skillId;
  cancelAutoPath();
  refresh();
}

function cancelSkillTargeting(): void {
  if (!targetingSkill) return;
  targetingSkill = null;
  refresh();
}

function cancelAutoPath(): void {
  pathToken += 1;
  if (pathTimer !== null) {
    window.clearTimeout(pathTimer);
    pathTimer = null;
  }
}

function tileFromPointer(event: PointerEvent): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const camera = renderer.getCameraOffset();
  const x = Math.floor((canvasX / RENDER_SCALE - camera.x) / TILE_SIZE);
  const y = Math.floor((canvasY / RENDER_SCALE - camera.y) / TILE_SIZE);
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
  return { x, y };
}

function followPath(targetX: number, targetY: number): void {
  if (!state || state.phase !== 'playing') return;

  cancelAutoPath();
  const blocked = new Set(state.floor.enemies.map((enemy) => `${enemy.x},${enemy.y}`));
  const path = findPath(state.floor, state.hero.x, state.hero.y, targetX, targetY, blocked);
  if (path.length === 0) return;

  const run = pathToken;
  const advance = (): void => {
    if (run !== pathToken || !state || state.phase !== 'playing') return;
    const next = path.shift();
    if (!next) return;

    const dx = next.x - state.hero.x;
    const dy = next.y - state.hero.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) {
      cancelAutoPath();
      return;
    }

    pathTimer = null;
    dispatch({ type: 'move', dx, dy }, true);
    if (!state || state.phase !== 'playing' || state.hero.x !== next.x || state.hero.y !== next.y) {
      cancelAutoPath();
      return;
    }
    if (path.length > 0) pathTimer = window.setTimeout(advance, 90);
  };

  advance();
}

function handleMapPointer(event: PointerEvent): void {
  if (onTitle || !state || state.phase !== 'playing') return;
  event.preventDefault();

  const tile = tileFromPointer(event);
  if (!tile) return;

  if (targetingSkill === 'jump') {
    if (!canTargetJump(state, tile)) return;
    targetingSkill = null;
    const before = state;
    dispatch({ type: 'useSkill', skillId: 'jump', x: tile.x, y: tile.y });
    if (state === before) {
      targetingSkill = 'jump';
      refresh();
    }
    return;
  }

  const tileIndex = idx(tile.x, tile.y, state.floor.width);
  const enemy = state.floor.visibility[tileIndex] === 'visible'
    ? state.floor.enemies.find((candidate) => candidate.x === tile.x && candidate.y === tile.y)
    : undefined;

  if (enemy) {
    dispatch({ type: 'attack', enemyId: enemy.id });
    return;
  }

  if (!isPassable(state.floor, tile.x, tile.y)) return;
  if (state.floor.visibility[tileIndex] === 'unseen') return;
  followPath(tile.x, tile.y);
}

function setupInput(): void {
  document.addEventListener('keydown', (e) => {
    if (onTitle) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (saveExists()) continueGame();
        else openJobSelection();
      }
      return;
    }

    if (!state) return;

    if (targetingSkill && e.key === 'Escape') {
      e.preventDefault();
      cancelSkillTargeting();
      return;
    }

    if (state.phase === 'dead' || state.phase === 'victory') {
      if (e.key === 'Enter') {
        e.preventDefault();
        openJobSelection();
      }
      return;
    }

    if (e.key === 'Escape' && !ui.attributesPanel.classList.contains('closed')) {
      e.preventDefault();
      setAttributesPanelOpen(ui, false);
      return;
    }

    if (targetingSkill) return;

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        dispatch({ type: 'move', dx: 0, dy: -1 });
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        dispatch({ type: 'move', dx: 0, dy: 1 });
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        dispatch({ type: 'move', dx: -1, dy: 0 });
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        dispatch({ type: 'move', dx: 1, dy: 0 });
        break;
      case 'q':
      case 'Q':
        e.preventDefault();
        dispatch({ type: 'move', dx: -1, dy: -1 });
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        dispatch({ type: 'move', dx: 1, dy: -1 });
        break;
      case 'z':
      case 'Z':
        e.preventDefault();
        dispatch({ type: 'move', dx: -1, dy: 1 });
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        dispatch({ type: 'move', dx: 1, dy: 1 });
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        dispatch({ type: 'toggleInventory' });
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        startSkillTargeting('jump');
        break;
      case 'Escape':
        e.preventDefault();
        dispatch({ type: 'closeOverlay' });
        break;
      case '.':
        e.preventDefault();
        dispatch({ type: 'wait' });
        break;
      case '1':
      case '2':
      case '3':
      case '4':
        dispatch({ type: 'useItem', index: Number(e.key) - 1 });
        break;
    }
  });

  document.getElementById('new-game-btn')!.addEventListener('click', openJobSelection);
  ui.continueBtn.addEventListener('click', continueGame);
  document.getElementById('play-again-btn')!.addEventListener('click', openJobSelection);
  document.getElementById('try-again-btn')!.addEventListener('click', openJobSelection);
  ui.bagBtn.addEventListener('click', () => dispatch({ type: 'toggleInventory' }));
  ui.attributesToggle.addEventListener('click', () => {
    setAttributesPanelOpen(ui, ui.attributesPanel.classList.contains('closed'));
  });
  ui.jobOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const jobId = option.dataset.job;
      if (jobId && getJobDefinition(jobId)) {
        selectedJob = jobId as JobId;
        refresh();
      }
    });
  });
  ui.modifierOptions.forEach((option) => {
    option.addEventListener('change', () => {
      const key = option.dataset.modifier as keyof GameModifiers | undefined;
      if (!key) return;
      selectedModifiers = { ...selectedModifiers, [key]: option.checked };
      refresh();
    });
  });
  ui.confirmJobBtn.addEventListener('click', () => startNewGame(selectedJob));
  canvas.addEventListener('pointerup', handleMapPointer);
  canvas.addEventListener('pointercancel', cancelAutoPath);
}

async function main(): Promise<void> {
  renderer = new GameRenderer();
  await renderer.init(canvas);
  window.addEventListener('resize', () => renderer.resize());
  setupInput();
  onTitle = true;
  refresh();
}

main().catch(console.error);
