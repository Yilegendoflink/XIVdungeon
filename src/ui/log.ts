import type { LogEntry } from '@/game/state';

export function renderLog(panel: HTMLElement, log: LogEntry[]): void {
  const recent = log.slice(-8);
  const fragment = document.createDocumentFragment();
  for (const entry of recent) {
    const node = document.createElement('div');
    node.className = 'log-entry';
    node.textContent = entry.text;
    fragment.append(node);
  }
  panel.replaceChildren(fragment);
  panel.scrollTop = panel.scrollHeight;
}
