// Logic variables.

import { requireData } from '../data.js';
import { el, note } from '../dom.js';
import { subscribe } from '../realtime.js';
import { state } from '../state.js';

const VARIABLE_BADGES = {
  string: { label: 'a', color: '#5cbf3a' },
  number: { label: '#', color: '#4a9ff5' },
  boolean: { label: '✓', color: '#b347ea' },
};

export function mountVariables({ body, widget }) {
  if (!requireData(body, 'variables')) return;
  const grid = el('div', 'pair-grid');
  body.append(grid);
  const tiles = new Map();

  for (const id of widget.data?.variableIds ?? []) {
    const variable = state.data.variables[id];
    if (variable == null) continue;
    const tile = el('div', 'variable-tile');
    const value = el('div', 'variable-value');
    const badge = el('span', 'variable-type', VARIABLE_BADGES[variable.type]?.label ?? '?');
    badge.style.background = VARIABLE_BADGES[variable.type]?.color ?? 'var(--text-muted)';
    tile.append(el('div', 'variable-name', variable.name), value, badge);
    grid.append(tile);
    tiles.set(id, (next) => {
      value.textContent = typeof next.value === 'boolean' ? (next.value ? 'Yes' : 'No') : String(next.value ?? '');
    });
    tiles.get(id)(variable);
  }
  if (tiles.size === 0) return note(body, 'These variables no longer exist.');

  return subscribe('homey:manager:logic', 'variable.update', (variable) => {
    tiles.get(variable?.id)?.(variable);
  });
}
