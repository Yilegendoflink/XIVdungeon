import type { GameModifiers, GameState } from '@/game/state';
import { heroAtk } from '@/game/state';
import { getJobDefinition, type JobId } from '@/data/jobs';
import { renderLog } from '@/ui/log';
import { renderInventory } from '@/ui/inventory';

export interface UIHandles {
  hpFill: HTMLElement;
  hpText: HTMLElement;
  jobInfo: HTMLElement;
  mpInfo: HTMLElement;
  resourceInfo: HTMLElement;
  gilInfo: HTMLElement;
  floorInfo: HTMLElement;
  objectiveInfo: HTMLElement;
  modifierInfo: HTMLElement;
  turnInfo: HTMLElement;
  atkInfo: HTMLElement;
  logPanel: HTMLElement;
  invOverlay: HTMLElement;
  titleScreen: HTMLElement;
  victoryScreen: HTMLElement;
  deathScreen: HTMLElement;
  deathStats: HTMLElement;
  continueBtn: HTMLButtonElement;
  bagBtn: HTMLButtonElement;
  titleActions: HTMLElement;
  jobSelection: HTMLElement;
  jobOptions: HTMLButtonElement[];
  modifierOptions: HTMLInputElement[];
  confirmJobBtn: HTMLButtonElement;
}

export function bindUI(): UIHandles {
  return {
    hpFill: el('hp-fill'),
    hpText: el('hp-text'),
    jobInfo: el('job-info'),
    mpInfo: el('mp-info'),
    resourceInfo: el('resource-info'),
    gilInfo: el('gil-info'),
    floorInfo: el('floor-info'),
    objectiveInfo: el('objective-info'),
    modifierInfo: el('modifier-info'),
    turnInfo: el('turn-info'),
    atkInfo: el('atk-info'),
    logPanel: el('log-panel'),
    invOverlay: el('inventory-screen'),
    titleScreen: el('title-screen'),
    victoryScreen: el('victory-screen'),
    deathScreen: el('death-screen'),
    deathStats: el('death-stats'),
    continueBtn: el('continue-btn') as HTMLButtonElement,
    bagBtn: el('bag-btn') as HTMLButtonElement,
    titleActions: el('title-actions'),
    jobSelection: el('job-selection'),
    jobOptions: Array.from(document.querySelectorAll<HTMLButtonElement>('.job-option')),
    modifierOptions: Array.from(document.querySelectorAll<HTMLInputElement>('[data-modifier]')),
    confirmJobBtn: el('confirm-job-btn') as HTMLButtonElement,
  };
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

export function updateHUD(ui: UIHandles, state: GameState): void {
  const pct = Math.max(0, state.hero.hp / state.hero.maxHp) * 100;
  ui.hpFill.style.width = `${pct}%`;
  ui.hpText.textContent = `${Math.max(0, state.hero.hp)}/${state.hero.maxHp}`;
  ui.jobInfo.textContent = `职业：${getJobDefinition(state.hero.jobId)?.name ?? state.hero.jobId}`;
  ui.mpInfo.textContent = `MP：${state.hero.mp}/${state.hero.maxMp}`;
  ui.resourceInfo.textContent = `职业资源：${state.hero.jobResources.map((resource) => (
    resource.max === undefined
      ? `${resource.name} ${resource.current}`
      : `${resource.name} ${resource.current}/${resource.max}`
  )).join('、') || '无'}`;
  ui.gilInfo.textContent = `Gil：${state.hero.gil}`;
  ui.floorInfo.textContent = state.floor.isBossFloor
    ? '最终 Boss 层'
    : `第 ${state.floor.number} 层`;
  const objective = state.floor.objective;
  const progress = objective.target > 0 ? `（${objective.progress}/${objective.target}）` : '';
  const exitState = state.floor.exitUnlocked ? ' · 出口已解锁' : '';
  ui.objectiveInfo.textContent = `目标：${objective.label}${progress}${exitState}`;
  const activeModifiers = [
    state.modifiers.infiniteHp ? '无限血量' : '',
    state.modifiers.autoCompleteObjectives ? '目标直达' : '',
    state.modifiers.oneHitKill ? '一击必杀' : '',
  ].filter(Boolean);
  ui.modifierInfo.textContent = activeModifiers.length > 0
    ? `修改器：${activeModifiers.join(' · ')}`
    : '';
  ui.modifierInfo.classList.toggle('hidden', activeModifiers.length === 0);
  ui.turnInfo.textContent = `回合：${state.turn}`;
  ui.atkInfo.textContent = `攻击：${heroAtk(state.hero)}`;
  renderLog(ui.logPanel, state.log);
}

export function updateJobSelection(
  ui: UIHandles,
  open: boolean,
  selectedJob: JobId,
  modifiers: GameModifiers,
): void {
  ui.titleActions.classList.toggle('hidden', open);
  ui.jobSelection.classList.toggle('hidden', !open);
  for (const option of ui.jobOptions) {
    option.classList.toggle('selected', option.dataset.job === selectedJob);
  }
  for (const option of ui.modifierOptions) {
    const key = option.dataset.modifier as keyof GameModifiers | undefined;
    if (key) option.checked = modifiers[key];
  }
}

export function updateScreens(
  ui: UIHandles,
  state: GameState | null,
  opts: { hasSave: boolean; onUseItem: (i: number) => void },
): void {
  const phase = state?.phase ?? 'title';

  ui.titleScreen.classList.toggle('hidden', phase !== 'title');
  ui.victoryScreen.classList.toggle('hidden', phase !== 'victory');
  ui.deathScreen.classList.toggle('hidden', phase !== 'dead');
  ui.continueBtn.classList.toggle('hidden', !opts.hasSave);
  ui.bagBtn.classList.toggle('hidden', !state || (phase !== 'playing' && phase !== 'inventory'));

  if (state && phase === 'dead') {
    ui.deathStats.innerHTML = `<p>击杀数：${state.stats.kills}</p><p>回合数：${state.turn}</p>`;
  }

  if (state) {
    renderInventory(ui.invOverlay, state, opts.onUseItem);
    updateHUD(ui, state);
  }
}
