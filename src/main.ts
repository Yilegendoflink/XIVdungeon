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
import { canTargetGeirskogul, canTargetJump } from '@/systems/skills';
import { SKILL_DEFINITIONS } from '@/data/skills';

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
type MoveDirection = { dx: number; dy: number };
const heldDirections = new Map<string, MoveDirection>();
const HELD_MOVE_INTERVAL = 120;
let activeHeldDirectionKey: string | null = null;
let heldMoveTimer: number | null = null;

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
    ui.skillDock.classList.add('hidden');
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
  if (targetingSkill === 'jump' || targetingSkill === 'geirskogul') renderer.setJumpTargeting(true, state);
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
  if (SKILL_DEFINITIONS[skillId].targeting === 'self') {
    dispatch({ type: 'useSkill', skillId, x: state.hero.x, y: state.hero.y });
    return;
  }
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

  if (targetingSkill === 'jump' || targetingSkill === 'geirskogul') {
    const valid = targetingSkill === 'jump'
      ? canTargetJump(state, tile)
      : canTargetGeirskogul(state, tile);
    if (!valid) return;
    const skillId = targetingSkill;
    targetingSkill = null;
    const before = state;
    dispatch({ type: 'useSkill', skillId, x: tile.x, y: tile.y });
    if (state === before) {
      targetingSkill = skillId;
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

function moveDirectionForKey(key: string): MoveDirection | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return { dx: 0, dy: -1 };
    case 'ArrowDown':
    case 's':
    case 'S':
      return { dx: 0, dy: 1 };
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return { dx: -1, dy: 0 };
    case 'ArrowRight':
    case 'd':
    case 'D':
      return { dx: 1, dy: 0 };
    case 'q':
    case 'Q':
      return { dx: -1, dy: -1 };
    case 'e':
    case 'E':
      return { dx: 1, dy: -1 };
    case 'z':
    case 'Z':
      return { dx: -1, dy: 1 };
    case 'c':
    case 'C':
      return { dx: 1, dy: 1 };
    default:
      return null;
  }
}

function stopHeldMovement(key?: string): void {
  if (key === undefined) heldDirections.clear();
  else heldDirections.delete(key);

  if (activeHeldDirectionKey === key || !heldDirections.has(activeHeldDirectionKey ?? '')) {
    const keys = [...heldDirections.keys()];
    activeHeldDirectionKey = keys[keys.length - 1] ?? null;
  }
  if (activeHeldDirectionKey || heldMoveTimer === null) return;
  window.clearInterval(heldMoveTimer);
  heldMoveTimer = null;
}

function stepHeldMovement(): void {
  if (onTitle || !state || state.phase !== 'playing') {
    stopHeldMovement();
    return;
  }
  if (targetingSkill || animationLocked) return;
  const direction = activeHeldDirectionKey
    ? heldDirections.get(activeHeldDirectionKey)
    : undefined;
  if (direction) dispatch({ type: 'move', ...direction });
}

function startHeldMovement(key: string, direction: MoveDirection): void {
  if (heldDirections.has(key) || onTitle || !state || state.phase !== 'playing' || targetingSkill || animationLocked) return;
  heldDirections.set(key, direction);
  activeHeldDirectionKey = key;
  stepHeldMovement();
  if (heldMoveTimer === null) heldMoveTimer = window.setInterval(stepHeldMovement, HELD_MOVE_INTERVAL);
}

interface TouchMoveGesture {
  pointerId: number;
  key: string;
  direction: MoveDirection;
  started: boolean;
}

let touchMoveGesture: TouchMoveGesture | null = null;
let touchMoveTimer: number | null = null;
const TOUCH_HOLD_DELAY = 180;

function directionFromScreenPoint(event: PointerEvent): MoveDirection | null {
  const rect = canvas.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const deadzone = Math.max(18, Math.min(rect.width, rect.height) * 0.04);
  if (Math.hypot(dx, dy) < deadzone) return null;
  if (Math.abs(dx) > Math.abs(dy) * 2) return { dx: Math.sign(dx), dy: 0 };
  if (Math.abs(dy) > Math.abs(dx) * 2) return { dx: 0, dy: Math.sign(dy) };
  return { dx: Math.sign(dx), dy: Math.sign(dy) };
}

function clearTouchMoveTimer(): void {
  if (touchMoveTimer === null) return;
  window.clearTimeout(touchMoveTimer);
  touchMoveTimer = null;
}

function startTouchMove(event: PointerEvent): void {
  if (
    event.pointerType !== 'touch' ||
    onTitle ||
    !state ||
    state.phase !== 'playing' ||
    targetingSkill ||
    animationLocked
  ) return;
  const direction = directionFromScreenPoint(event);
  if (!direction) return;

  // Long press is screen-direction input. The pressed tile is intentionally not
  // converted or checked; only a short tap uses the tile as a path/attack target.
  event.preventDefault();
  const key = `screen-touch-${event.pointerId}`;
  touchMoveGesture = { pointerId: event.pointerId, key, direction, started: false };
  canvas.setPointerCapture(event.pointerId);
  clearTouchMoveTimer();
  touchMoveTimer = window.setTimeout(() => {
    if (!touchMoveGesture || touchMoveGesture.pointerId !== event.pointerId) return;
    touchMoveGesture.started = true;
    startHeldMovement(touchMoveGesture.key, touchMoveGesture.direction);
    touchMoveTimer = null;
  }, TOUCH_HOLD_DELAY);
}

function updateTouchMove(event: PointerEvent): void {
  if (event.pointerType !== 'touch' || touchMoveGesture?.pointerId !== event.pointerId) return;
  const direction = directionFromScreenPoint(event);
  if (!direction) return;
  touchMoveGesture.direction = direction;
  if (touchMoveGesture.started) heldDirections.set(touchMoveGesture.key, direction);
}

function endTouchMove(event: PointerEvent): boolean {
  if (event.pointerType !== 'touch' || touchMoveGesture?.pointerId !== event.pointerId) return false;
  const gesture = touchMoveGesture;
  clearTouchMoveTimer();
  touchMoveGesture = null;
  if (!gesture.started) return false;
  stopHeldMovement(gesture.key);
  event.preventDefault();
  return true;
}

function cancelTouchMove(event: PointerEvent): void {
  if (event.pointerType !== 'touch' || touchMoveGesture?.pointerId !== event.pointerId) return;
  clearTouchMoveTimer();
  stopHeldMovement(touchMoveGesture.key);
  touchMoveGesture = null;
}

function handlePointerUp(event: PointerEvent): void {
  if (endTouchMove(event)) return;
  handleMapPointer(event);
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

    const direction = moveDirectionForKey(e.key);
    if (direction) {
      e.preventDefault();
      if (!e.repeat) startHeldMovement(e.key, direction);
      return;
    }

    switch (e.key) {
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

  document.addEventListener('keyup', (e) => {
    if (!moveDirectionForKey(e.key)) return;
    e.preventDefault();
    stopHeldMovement(e.key);
  });
  window.addEventListener('blur', () => stopHeldMovement());

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
  canvas.addEventListener('pointerdown', startTouchMove);
  canvas.addEventListener('pointermove', updateTouchMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', (event) => {
    cancelTouchMove(event);
    cancelAutoPath();
  });
  canvas.addEventListener('lostpointercapture', cancelTouchMove);
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
