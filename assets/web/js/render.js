// Renders the selected dashboard: columns of widgets, each mounted by its widget module.

import { loadData } from './data.js';
import { $, el, note } from './dom.js';
import { fitBoard } from './fit.js';
import { state } from './state.js';
import { WIDGETS } from './widgets/index.js';

// The board's widgets by id, with the settings they were drawn with, so a highlight can lift one (highlight.js).
const drawn = new Map();
let drawnDashboardId = null;

function teardown() {
  for (const cleanup of state.cleanups.splice(0)) cleanup();
  drawn.clear();
  drawnDashboardId = null;
}

let renderCount = 0;
let held = false;
let heldRender = false;

// While a highlight shows one of the board's own widgets, drawing the board again would replace that widget and lose
// what it is doing (a page opened in a frame, a live stream), so the board is drawn once it is let go.
export function holdBoard(hold) {
  held = hold;
  if (held || !heldRender) return;
  heldRender = false;
  renderDashboard();
}

// The board's own section for a widget, if it is drawn with these settings.
export function drawnWidget(dashboardId, widget) {
  const entry = dashboardId === drawnDashboardId ? drawn.get(widget.id) : null;
  return entry && JSON.stringify(entry.widget) === JSON.stringify(widget) ? entry.section : null;
}

export async function renderDashboard() {
  if (held) {
    heldRender = true;
    return;
  }
  const renderId = ++renderCount;
  teardown();
  const board = $('board');
  board.replaceChildren();

  const dashboard = state.dashboards[state.dashboardId];
  if (dashboard == null) {
    $('dashboard-name').textContent = 'Homey';
    note(board, 'No dashboards yet. Create one in the Homey mobile app.');
    fitBoard();
    return;
  }
  $('dashboard-name').textContent = dashboard.name;
  document.title = `${dashboard.name} · Homey`;

  const columns = dashboard.columns ?? [];
  // The highlighted widget reads the same data, so keep loading what it needs.
  const widgets = [...columns.flatMap((column) => column.widgets), ...(state.highlighted ? [state.highlighted] : [])];
  const needed = widgets.flatMap((widget) => WIDGETS[widget.type]?.needs ?? []);
  const { data, errors } = await loadData(needed);
  if (renderId !== renderCount) return; // Superseded by a newer render.
  state.data = data;
  state.dataErrors = errors;

  drawnDashboardId = dashboard.id;
  for (const column of columns) {
    const columnNode = el('div', 'column');
    board.append(columnNode);
    for (const widget of column.widgets) {
      const { section, cleanup } = renderWidget(widget, columnNode);
      if (cleanup) state.cleanups.push(cleanup);
      drawn.set(widget.id, { widget, section });
    }
  }
  fitBoard();
}

// Also used for the highlight. Returns the widget's section and its cleanup, if it has one.
export function renderWidget(widget, parent) {
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
    return { section };
  }

  try {
    const cleanup = definition.mount({ widget, section, body, setTitle });
    return { section, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
  } catch (error) {
    note(body, error.message, true);
    return { section };
  }
}
