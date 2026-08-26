import type { GameModifiers, GameState, LevelUpRewardId } from '@/game/state';
import { experienceRequiredForLevel, heroAtk, mpRegenPerTurn } from '@/game/state';
import { getJobDefinition, type JobId } from '@/data/jobs';
import { renderLog } from '@/ui/log';
import { renderInventory } from '@/ui/inventory';
import { activeSkillIds, SKILL_DEFINITIONS } from '@/data/skills';
import { PASSIVE_DEFINITIONS } from '@/data/passives';
import { LEVEL_UP_REWARDS } from '@/data/level-rewards';
import { MAX_ACTIVE_SKILLS, skillIconPath } from '@/config';
import type { SkillId } from '@/game/state';

export interface UIHandles {
  hpFill: HTMLElement;
  hpText: HTMLElement;
  mpFill: HTMLElement;
  jobInfo: HTMLElement;
  levelInfo: HTMLElement;
  mpInfo: HTMLElement;
  attributeInfo: HTMLElement;
  derivedInfo: HTMLElement;
  resourceInfo: HTMLElement;
  gilInfo: HTMLElement;
  floorInfo: HTMLElement;
  objectiveInfo: HTMLElement;
  modifierInfo: HTMLElement;
  turnInfo: HTMLElement;
  logPanel: HTMLElement;
  invOverlay: HTMLElement;
  titleScreen: HTMLElement;
  victoryScreen: HTMLElement;
  deathScreen: HTMLElement;
  levelUpScreen: HTMLElement;
  levelUpOptions: HTMLElement;
  deathStats: HTMLElement;
  continueBtn: HTMLButtonElement;
  bagBtn: HTMLButtonElement;
  skillDock: HTMLElement;
  skillSlotCount: HTMLElement;
  skillBar: HTMLElement;
  titleActions: HTMLElement;
  jobSelection: HTMLElement;
  jobOptions: HTMLButtonElement[];
  modifierOptions: HTMLInputElement[];
  confirmJobBtn: HTMLButtonElement;
  attributesToggle: HTMLButtonElement;
  attributesPanel: HTMLElement;
  passiveInfo: HTMLElement;
}

export function bindUI(): UIHandles {
  return {
    hpFill: el('hp-fill'),
    hpText: el('hp-text'),
    mpFill: el('mp-fill'),
    jobInfo: el('job-info'),
    levelInfo: el('level-info'),
    mpInfo: el('mp-info'),
    attributeInfo: el('attribute-info'),
    derivedInfo: el('derived-info'),
    resourceInfo: el('resource-info'),
    gilInfo: el('gil-info'),
    floorInfo: el('floor-info'),
    objectiveInfo: el('objective-info'),
    modifierInfo: el('modifier-info'),
    turnInfo: el('turn-info'),
    logPanel: el('log-panel'),
    invOverlay: el('inventory-screen'),
    titleScreen: el('title-screen'),
    victoryScreen: el('victory-screen'),
    deathScreen: el('death-screen'),
    levelUpScreen: el('level-up-screen'),
    levelUpOptions: el('level-up-options'),
    deathStats: el('death-stats'),
    continueBtn: el('continue-btn') as HTMLButtonElement,
    bagBtn: el('bag-btn') as HTMLButtonElement,
    skillDock: el('skill-dock'),
    skillSlotCount: el('skill-slot-count'),
    skillBar: el('skill-bar'),
    titleActions: el('title-actions'),
    jobSelection: el('job-selection'),
    jobOptions: Array.from(document.querySelectorAll<HTMLButtonElement>('.job-option')),
    modifierOptions: Array.from(document.querySelectorAll<HTMLInputElement>('[data-modifier]')),
    confirmJobBtn: el('confirm-job-btn') as HTMLButtonElement,
    attributesToggle: el('attributes-toggle') as HTMLButtonElement,
    attributesPanel: el('attribute-panel'),
    passiveInfo: el('passive-info'),
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
  ui.hpFill.parentElement?.setAttribute('aria-valuenow', String(Math.max(0, state.hero.hp)));
  ui.hpFill.parentElement?.setAttribute('aria-valuemax', String(state.hero.maxHp));
  const mpPct = Math.max(0, state.hero.mp / state.hero.maxMp) * 100;
  ui.mpFill.style.width = `${mpPct}%`;
  ui.mpInfo.textContent = `${state.hero.mp}/${state.hero.maxMp}`;
  ui.mpFill.parentElement?.setAttribute('aria-valuenow', String(Math.max(0, state.hero.mp)));
  ui.mpFill.parentElement?.setAttribute('aria-valuemax', String(state.hero.maxMp));
  const job = getJobDefinition(state.hero.jobId);
  ui.jobInfo.textContent = `职业：${job?.name ?? state.hero.jobId}`;
  const requiredExperience = experienceRequiredForLevel(state.hero.level);
  ui.levelInfo.textContent = state.hero.level >= 30
    ? '等级：30（满级）'
    : `等级：${state.hero.level}（${state.hero.experience}/${requiredExperience}）`;
  const a = state.hero.attributes;
  const resourceText = state.hero.jobResources.map((resource) => (
    resource.max === undefined
      ? `${resource.name} ${resource.current}`
      : `${resource.name} ${resource.current}/${resource.max}`
  )).join('、') || '无';
  ui.resourceInfo.innerHTML = state.hero.jobResources.length === 0
    ? '<span class="resource-empty">无职业资源</span>'
    : state.hero.jobResources.map((resource) => {
      const value = resource.max === undefined ? `${resource.current}` : `${resource.current}/${resource.max}`;
      const ratio = resource.max === undefined
        ? 100
        : Math.max(0, Math.min(100, (resource.current / resource.max) * 100));
      return `<div class="resource-mini"><div class="resource-mini-label"><span>${resource.name}</span><strong>${value}</strong></div><div class="resource-mini-track"><div class="resource-mini-fill" style="width: ${ratio}%"></div></div></div>`;
    }).join('');
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
  const attack = heroAtk(state.hero, job?.primaryAttribute ?? 'strength');
  ui.attributeInfo.innerHTML = [
    ['力量', a.strength],
    ['敏捷', a.dexterity],
    ['智力', a.intelligence],
    ['精神', a.mind],
    ['坚韧', a.tenacity],
    ['信仰', a.piety],
    ['信念', a.determination],
    ['直击', a.directHit],
    ['暴击', a.criticalHit],
  ].map(([label, value]) => `<div class="attribute-cell"><span>${label}</span><strong>${value}</strong></div>`).join('');
  ui.derivedInfo.innerHTML = [
    ['攻击力', attack],
    ['防御力', state.hero.def],
    ['HP 上限', state.hero.maxHp],
    ['MP 上限', state.hero.maxMp],
    ['MP 回复', `${mpRegenPerTurn(a)}/回合`],
    ['职业资源', resourceText],
    ['Gil', state.hero.gil],
    ['本局击杀', state.stats.kills],
  ].map(([label, value]) => `<div class="derived-cell"><span>${label}</span><strong>${value}</strong></div>`).join('');
  ui.passiveInfo.innerHTML = state.hero.passives.length === 0
    ? '<span class="passive-empty">尚未获得被动技能</span>'
    : state.hero.passives.map((passiveId) => {
      const passive = PASSIVE_DEFINITIONS[passiveId];
      return `<div class="passive-card"><strong>${passive.name}<small>${passive.englishName}</small></strong><span>${passive.description}</span></div>`;
    }).join('');
  renderLog(ui.logPanel, state.log);
}

export function setAttributesPanelOpen(ui: UIHandles, open: boolean): void {
  ui.attributesPanel.classList.toggle('closed', !open);
  ui.attributesPanel.setAttribute('aria-hidden', String(!open));
  ui.attributesToggle.setAttribute('aria-expanded', String(open));
  ui.attributesToggle.textContent = open ? '收起属性' : '属性';
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
  opts: {
    hasSave: boolean;
    onUseItem: (i: number) => void;
    onChooseLevelReward: (reward: LevelUpRewardId) => void;
    onSelectSkill: (skillId: SkillId) => void;
  },
): void {
  const phase = state?.phase ?? 'title';

  ui.titleScreen.classList.toggle('hidden', phase !== 'title');
  ui.victoryScreen.classList.toggle('hidden', phase !== 'victory');
  ui.deathScreen.classList.toggle('hidden', phase !== 'dead');
  ui.levelUpScreen.classList.toggle('hidden', phase !== 'levelUp');
  ui.continueBtn.classList.toggle('hidden', !opts.hasSave);
  ui.bagBtn.classList.toggle('hidden', !state || (phase !== 'playing' && phase !== 'inventory'));
  ui.skillDock.classList.toggle('hidden', !state);
  if (state) {
    const skillIds = activeSkillIds(state.hero).slice(0, MAX_ACTIVE_SKILLS);
    ui.skillSlotCount.textContent = `${skillIds.length}/${MAX_ACTIVE_SKILLS}`;
    ui.skillBar.innerHTML = Array.from({ length: MAX_ACTIVE_SKILLS }, (_, index) => {
      const skillId = skillIds[index];
      if (!skillId) {
        return `<div class="skill-slot empty" aria-hidden="true"><span class="skill-slot-number">${index + 1}</span><span class="skill-empty-mark">+</span></div>`;
      }
      const skill = SKILL_DEFINITIONS[skillId];
      const cooldown = state.hero.skillCooldowns[skillId];
      const disabled = phase !== 'playing' || state.hero.mp < skill.mpCost || cooldown > 0;
      return `<button class="skill-button" type="button" data-skill="${skillId}" ${disabled ? 'disabled' : ''} title="${skill.name} / ${skill.englishName}：消耗 ${skill.mpCost} MP，冷却 ${skill.cooldownTurns} 回合"><span class="skill-slot-number">${index + 1}</span><img src="${skillIconPath(skillId)}" alt="" onerror="this.hidden=true"><span class="skill-name">${skill.name}</span><small class="skill-english">${skill.englishName}</small><span class="skill-meta"><small class="skill-cost">MP ${skill.mpCost}</small>${cooldown > 0 ? `<small class="skill-cooldown">CD ${cooldown}</small>` : ''}</span></button>`;
    }).join('');
    ui.skillBar.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach((button) => {
      button.addEventListener('click', () => opts.onSelectSkill(button.dataset.skill as SkillId));
    });
  }

  if (state && phase === 'dead') {
    ui.deathStats.innerHTML = `<p>击杀数：${state.stats.kills}</p><p>经验：${state.stats.experience}</p><p>回合数：${state.turn}</p>`;
  }

  if (state && phase === 'levelUp') {
    ui.levelUpOptions.innerHTML = state.levelUpRewards.map((reward) => {
      const definition = LEVEL_UP_REWARDS[reward];
      return `<button class="level-up-option" type="button" data-reward="${reward}"><strong>${definition.name}${definition.englishName ? `<small class="reward-english">${definition.englishName}</small>` : ''}</strong><span>${definition.description}</span></button>`;
    }).join('');
    ui.levelUpOptions.querySelectorAll<HTMLButtonElement>('[data-reward]').forEach((button) => {
      button.addEventListener('click', () => opts.onChooseLevelReward(button.dataset.reward as LevelUpRewardId));
    });
  }

  if (state) {
    renderInventory(ui.invOverlay, state, opts.onUseItem);
    updateHUD(ui, state);
  }
}
