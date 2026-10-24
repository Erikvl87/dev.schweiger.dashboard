// Shortcuts to other dashboards, shown as pills like favorite flows. main.js does the switching.

import { el, note, pulse } from '../dom.js';
import { DASHBOARD_ICON } from '../icons.js';
import { state } from '../state.js';

export function mountDashboardShortcuts({ widget, body }) {
  const dashboards = (widget.data?.dashboardIds ?? []).map((id) => state.dashboards[id]).filter(Boolean);
  if (dashboards.length === 0) return note(body, 'No dashboards to show.');

  const grid = el('div', 'pair-grid');
  body.append(grid);
  for (const dashboard of dashboards) {
    const button = el('button', 'action flow-pill');
    button.type = 'button';
    button.title = dashboard.name;
    const badge = el('span', 'dashboard-badge');
    badge.innerHTML = DASHBOARD_ICON;
    button.append(badge, el('span', 'action-name', dashboard.name));
    button.addEventListener('click', () => {
      pulse(button);
      document.dispatchEvent(new CustomEvent('show-dashboard', { detail: dashboard.id }));
    });
    grid.append(button);
  }
}
