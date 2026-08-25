import type { GameState } from '@/game/state';
import { itemName } from '@/game/state';
import { INVENTORY_SIZE } from '@/config';

export function renderInventory(
  panel: HTMLElement,
  state: GameState,
  onUse: (index: number) => void,
): void {
  const open = state.phase === 'inventory';
  panel.classList.toggle('hidden', !open);
  if (!open) return;

  const slots = Array.from({ length: INVENTORY_SIZE }, (_, i) => {
    const item = state.hero.inventory[i];
    if (!item) {
      return `<button class="inv-slot empty" disabled data-index="${i}">—</button>`;
    }
    return `<button class="inv-slot" data-index="${i}">${itemName(item.type)}</button>`;
  }).join('');

  panel.innerHTML = `
    <div class="inv-panel">
      <h2>背包</h2>
      <p class="inv-hint">点击使用 · Esc / I 关闭</p>
      <div class="inv-grid">${slots}</div>
    </div>
  `;

  panel.querySelectorAll<HTMLButtonElement>('.inv-slot:not(.empty)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      onUse(index);
    });
  });
}
