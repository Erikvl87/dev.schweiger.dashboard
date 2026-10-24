// Live power usage of the last minute.

import { drawAreaChart, niceScale } from '../charts.js';
import { deviceIcon, findDevice, watchDevice } from '../devices.js';
import { el, note } from '../dom.js';
import { state } from '../state.js';

const LIVE_WINDOW = 60_000;

export function mountEnergyUsage({ body, widget }) {
  const device = findDevice(body, widget.data?.deviceId);
  if (device == null) return;
  const power = device.capabilitiesObj?.measure_power;
  if (power == null) return note(body, `${device.name} does not report power usage.`);

  const panel = el('div', 'device-panel energy-panel');
  const head = el('div', 'panel-head');
  const text = el('div', 'panel-text');
  text.append(el('div', 'panel-name', device.name), el('div', 'panel-sub', 'Last minute'));
  const value = el('div', 'energy-value');
  head.append(deviceIcon(device, 'panel-icon'), text, value);
  const wrap = el('div', 'chart-wrap');
  panel.append(head, wrap);
  body.append(panel);

  const formatPower = (watts) => (watts == null ? '–' : `${Math.round(watts)} ${power.units ?? 'W'}`);
  // Insights back-fill the minute before the page loaded; live readings continue from there.
  let history = [];
  const live = [{ t: Date.now(), v: power.value }];

  const draw = () => {
    const end = Date.now();
    const start = end - LIVE_WINDOW;
    while (live.length > 1 && live[1].t <= start) live.shift();
    value.textContent = formatPower(power.value);
    const points = [
      ...history.filter((sample) => sample.t >= start - 5_000 && sample.t < live[0].t),
      ...live,
      { t: end, v: live.at(-1).v },
    ].map((sample) => ({ t: Math.max(sample.t, start), v: sample.v }));
    const values = points.map((point) => point.v).filter((watts) => watts != null);
    const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values));
    drawAreaChart(wrap, {
      points,
      start,
      end,
      min: scale.min,
      max: scale.max,
      yTicks: scale.ticks,
      stepped: true,
      color: 'var(--series-energy)',
      formatValue: formatPower,
      endMarker: true,
      height: 150,
      ariaLabel: `${device.name} power usage in the last minute`,
    });
  };

  loadPowerHistory(device).then((samples) => {
    history = samples;
    draw();
  });

  const stop = watchDevice(device, (capabilityId) => {
    if (capabilityId !== 'measure_power') return;
    live.push({ t: Date.now(), v: power.value });
    draw();
  });
  const timer = setInterval(draw, 1000);
  const resizeObserver = new ResizeObserver(draw);
  resizeObserver.observe(wrap);
  draw();

  return () => {
    stop();
    clearInterval(timer);
    resizeObserver.disconnect();
  };
}

// On Homey Pro the `lastHour` resolution is kept at 5-second steps. Energy devices log their
// power as `energy_power`; other devices only have the `measure_power` log.
async function loadPowerHistory(device) {
  const ownerUri = `homey:device:${device.id}`;
  for (const logId of ['energy_power', 'measure_power']) {
    try {
      const entries = await state.client.api(
        'GET',
        `/api/manager/insights/log/${encodeURIComponent(ownerUri)}/${encodeURIComponent(`${ownerUri}:${logId}`)}/entry?resolution=lastHour`,
      );
      return entries.values.map((entry) => ({ t: new Date(entry.t).getTime(), v: entry.v }));
    } catch {
      // Try the next log; without either the chart starts from live readings.
    }
  }
  return [];
}
