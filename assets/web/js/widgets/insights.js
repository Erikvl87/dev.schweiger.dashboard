// Insights line chart.

import { RESOLUTION_LABELS, drawAreaChart, formatLogValue, niceScale, timeTicks } from '../charts.js';
import { el, note } from '../dom.js';
import { state } from '../state.js';

export function mountInsightsChart({ body, widget, setTitle }) {
  const { logId, resolution = 'last24Hours' } = widget.data ?? {};
  if (!logId) return note(body, 'This chart has no Insights log selected.');
  const resolutionLabel = RESOLUTION_LABELS[resolution] ?? resolution;

  const panel = el('div', 'panel');
  const titleNode = el('div', 'chart-title');
  const subNode = el('div', 'chart-sub');
  const wrap = el('div', 'chart-wrap');
  panel.append(titleNode, subNode, wrap);
  body.append(panel);

  let log = null;
  let entries = null;
  let refreshTimer = null;
  let disposed = false;

  const draw = () => {
    if (log && entries) drawInsights(wrap, log, entries);
  };
  const resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(wrap);

  const load = async () => {
    try {
      log ??= await state.client.api('GET', `/api/manager/insights/log/${encodeURIComponent(logId)}`);
      titleNode.textContent = log.ownerName;
      subNode.replaceChildren(el('span', 'series-name', log.title), ` • ${resolutionLabel}`);
      setTitle(log.title);
      // The entries route resolves the log by its full id; the owner segment is only part of the path.
      entries = await state.client.api(
        'GET',
        `/api/manager/insights/log/${encodeURIComponent(log.ownerUri)}/${encodeURIComponent(logId)}/entry?resolution=${encodeURIComponent(resolution)}`,
      );
      draw();
    } catch (error) {
      wrap.replaceChildren();
      note(wrap, error.message, true);
    }
    if (!disposed) {
      const delay = Math.min(Math.max(entries?.updatesIn ?? 60_000, 10_000), 600_000);
      refreshTimer = setTimeout(load, delay);
    }
  };
  load();

  return () => {
    disposed = true;
    clearTimeout(refreshTimer);
    resizeObserver.disconnect();
  };
}

function drawInsights(wrap, log, entries) {
  const isBoolean = log.type === 'boolean';
  const points = entries.values.map((entry) => ({
    t: new Date(entry.t).getTime(),
    v: entry.v == null ? null : isBoolean ? (entry.v ? 1 : 0) : entry.v,
  }));
  const values = points.map((point) => point.v).filter((value) => value != null);
  const scale = isBoolean || values.length === 0
    ? { min: 0, max: 1, ticks: [0, 1] }
    : niceScale(Math.min(...values), Math.max(...values));
  const start = new Date(entries.start).getTime();
  const end = new Date(entries.end).getTime();
  const describe = (value) => (isBoolean ? formatLogValue(log, value === 1) : formatLogValue(log, value));

  drawAreaChart(wrap, {
    points,
    start,
    end,
    min: scale.min,
    max: scale.max,
    yTicks: scale.ticks,
    formatTick: isBoolean ? describe : String,
    units: isBoolean ? null : log.units,
    xTicks: timeTicks(start, end),
    stepped: isBoolean,
    formatValue: (value) => `${describe(value)}${log.units && !isBoolean ? ` ${log.units}` : ''}`,
    ariaLabel: `${log.title}, ${log.ownerName}`,
  });
}
