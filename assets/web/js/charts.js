// The SVG area chart used by the Insights and energy widgets.

import { el, note } from './dom.js';

export const RESOLUTION_LABELS = {
  lastHour: 'Last Hour',
  last6Hours: 'Last 6 Hours',
  last24Hours: 'Last 24 Hours',
  last7Days: 'Last 7 Days',
  last14Days: 'Last 14 Days',
  last31Days: 'Last 31 Days',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  thisYear: 'This Year',
  last2Years: 'Last 2 Years',
};

export function formatLogValue(log, value) {
  if (value == null) return '–';
  if (typeof value === 'boolean') return value ? (log.titleTrue ?? 'On') : (log.titleFalse ?? 'Off');
  return String(Number(value.toFixed(Math.min(log.decimals ?? 1, 2))));
}

function niceStep(range, targetCount) {
  const raw = range / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

// A value axis on round numbers that covers the data.
export function niceScale(dataMin, dataMax, targetCount = 4) {
  const step = niceStep(dataMax - dataMin || Math.abs(dataMax) || 1, targetCount);
  const min = Math.floor(dataMin / step) * step;
  let max = Math.ceil(dataMax / step) * step;
  if (max === min) max = min + step;
  const ticks = [];
  for (let tick = min; tick <= max + step / 2; tick += step) ticks.push(Number(tick.toFixed(6)));
  return { min, max, ticks };
}

const TIME_STEPS = [15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080].map((minutes) => minutes * 60_000);

export function timeTicks(start, end) {
  const step = TIME_STEPS.find((candidate) => (end - start) / candidate <= 6) ?? TIME_STEPS.at(-1);
  // Align to local midnight so hour and day ticks land on round times.
  const midnight = new Date(start);
  midnight.setHours(0, 0, 0, 0);
  const ticks = [];
  for (let t = midnight.getTime(); t <= end; t += step) {
    if (t < start) continue;
    const date = new Date(t);
    const label = step < 1440 * 60_000
      ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
      : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    ticks.push({ t, label });
  }
  return ticks;
}

function svgElement(tag, attributes, className) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (className) node.setAttribute('class', className);
  return node;
}

export function drawAreaChart(wrap, {
  points,
  start,
  end,
  min,
  max,
  yTicks,
  formatTick = String,
  units = null,
  xTicks = [],
  stepped = false,
  color = 'var(--series-1)',
  formatValue = String,
  endMarker = false,
  height = 220,
  ariaLabel = '',
}) {
  const width = wrap.clientWidth;
  if (width === 0) return;
  const defined = points.filter((point) => point.v != null);
  wrap.replaceChildren();
  if (defined.length === 0) return note(wrap, 'No data in this period.');

  const pad = { top: units ? 26 : 10, right: endMarker ? 10 : 4, bottom: xTicks.length ? 26 : 8, left: 42 };
  const plotBottom = height - pad.bottom;
  const x = (t) => pad.left + ((t - start) / (end - start || 1)) * (width - pad.left - pad.right);
  const y = (v) => pad.top + (1 - (v - min) / (max - min)) * (plotBottom - pad.top);

  // Break the line wherever there is no value; stepped series hold each value until the next one.
  const segments = [];
  let current = [];
  for (const point of points) {
    if (point.v == null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    if (stepped && current.length) current.push({ t: point.t, v: current.at(-1).v });
    current.push(point);
  }
  if (current.length) segments.push(current);

  const label = (text, attributes) => {
    const node = svgElement('text', attributes, 'axis-label');
    node.textContent = text;
    return node;
  };

  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': ariaLabel });
  const gradientId = `fill-${Math.random().toString(36).slice(2)}`;
  const defs = svgElement('defs', {});
  const gradient = svgElement('linearGradient', { id: gradientId, x1: 0, x2: 0, y1: 0, y2: 1 });
  gradient.append(
    svgElement('stop', { offset: '0%', style: `stop-color: ${color}; stop-opacity: 0.4` }),
    svgElement('stop', { offset: '100%', style: `stop-color: ${color}; stop-opacity: 0.03` }),
  );
  defs.append(gradient);
  svg.append(defs);

  if (units) svg.append(label(units, { x: pad.left - 10, y: 12, 'text-anchor': 'end' }));
  for (const tick of yTicks) {
    svg.append(svgElement('line', { x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick) }, 'grid-line'));
    svg.append(label(formatTick(tick), { x: pad.left - 10, y: y(tick) + 4, 'text-anchor': 'end' }));
  }
  svg.append(svgElement('line', { x1: pad.left, x2: pad.left, y1: pad.top - (units ? 12 : 0), y2: plotBottom }, 'axis-line'));
  for (const tick of xTicks) {
    svg.append(svgElement('line', { x1: x(tick.t), x2: x(tick.t), y1: plotBottom, y2: plotBottom + 5 }, 'axis-line'));
    svg.append(label(tick.label, { x: x(tick.t), y: height - 4, 'text-anchor': 'middle' }));
  }

  const baseline = y(Math.max(min, Math.min(0, max)));
  for (const segment of segments) {
    const line = segment.map((point) => `${x(point.t).toFixed(1)},${y(point.v).toFixed(1)}`).join(' L');
    svg.append(svgElement('path', { d: `M${line} L${x(segment.at(-1).t).toFixed(1)},${baseline} L${x(segment[0].t).toFixed(1)},${baseline} Z`, fill: `url(#${gradientId})` }));
    svg.append(svgElement('path', { d: `M${line}`, style: `stroke: ${color}` }, 'series-line'));
  }
  if (endMarker) {
    const last = defined.at(-1);
    svg.append(svgElement('circle', { cx: x(end), cy: y(last.v), r: 5, style: `fill: ${color}` }, 'end-dot'));
  }

  const crosshair = svgElement('line', { y1: pad.top, y2: plotBottom, visibility: 'hidden' }, 'crosshair');
  const dot = svgElement('circle', { r: 4, visibility: 'hidden', style: `fill: ${color}` }, 'hover-dot');
  const hitArea = svgElement('rect', { x: pad.left, y: 0, width: width - pad.left - pad.right, height, fill: 'transparent' });
  svg.append(crosshair, dot, hitArea);

  const tooltip = el('div', 'chart-tooltip');
  tooltip.hidden = true;
  wrap.append(svg, tooltip);

  hitArea.addEventListener('pointermove', (event) => {
    const bounds = svg.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearest = defined[0];
    for (const point of defined) {
      if (Math.abs(x(point.t) - pointerX) < Math.abs(x(nearest.t) - pointerX)) nearest = point;
    }
    const px = x(nearest.t);
    crosshair.setAttribute('x1', px);
    crosshair.setAttribute('x2', px);
    crosshair.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', px);
    dot.setAttribute('cy', y(nearest.v));
    dot.setAttribute('visibility', 'visible');

    tooltip.replaceChildren(el('strong', null, formatValue(nearest.v)), new Date(nearest.t).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }));
    tooltip.hidden = false;
    // In CSS pixels, not the bounds' screen pixels, which differ while the board is zoomed (js/fit.js).
    const tooltipWidth = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(Math.max(px - tooltipWidth / 2, 0), width - tooltipWidth)}px`;
  });
  hitArea.addEventListener('pointerleave', () => {
    crosshair.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tooltip.hidden = true;
  });
}
