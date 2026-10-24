// Renders the selected dashboard: columns of widgets, each mounted by its widget module.

import { loadData } from './data.js';
import { $, el, note } from './dom.js';
import { state } from './state.js';
import { WIDGETS } from './widgets/index.js';

function teardown() {
  for (const cleanup of state.cleanups.splice(0)) cleanup();
}

let renderCount = 0;

export async function renderDashboard() {
  const renderId = ++renderCount;
  teardown();
  const board = $('board');
  board.replaceChildren();

  const dashboard = state.dashboards[state.dashboardId];
  if (dashboard == null) {
    $('dashboard-name').textContent = 'Homey';
    note(board, 'No dashboards yet. Create one in the Homey mobile app.');
    return;
  }
  $('dashboard-name').textContent = dashboard.name;
  document.title = `${dashboard.name} · Homey`;

  const columns = dashboard.columns ?? [];
  const needed = columns.flatMap((column) => column.widgets).flatMap((widget) => WIDGETS[widget.type]?.needs ?? []);
  const { data, errors } = await loadData(needed);
  if (renderId !== renderCount) return; // Superseded by a newer render.
  state.data = data;
  state.dataErrors = errors;

  for (const column of columns) {
    const columnNode = el('div', 'column');
    board.append(columnNode);
    for (const widget of column.widgets) {
      renderWidget(widget, columnNode);
    }
  }
}

function renderWidget(widget, parent) {
  const section = el('section', 'widget');
  const titleNode = el('h2', 'widget-title');
  const body = el('div', 'widget-body');
  section.append(titleNode, body);
  // Attach first: an iframe only gets a contentWindow once it is in the document.
  parent.append(section);

  const definition = WIDGETS[widget.type];
  const setTitle = (fallback) => {
    const title = widget.title ?? fallback;
    titleNode.textContent = title ?? '';
    titleNode.hidden = widget.titleHidden === true || !title;
  };
  setTitle(definition?.title);

  if (definition == null) {
    setTitle(widget.type);
    note(body, `The "${widget.type}" widget is only available in the Homey mobile app.`);
    return;
  }

  try {
    const cleanup = definition.mount({ widget, section, body, setTitle });
    if (typeof cleanup === 'function') state.cleanups.push(cleanup);
  } catch (error) {
    note(body, error.message, true);
  }
}
