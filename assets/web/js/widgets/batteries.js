// Battery lists: chosen devices (batteries_devices), every low battery (batteries_device_low), and the batteries sheet.

import { clamp, hsvToHex } from '../color.js';
import { requireData } from '../data.js';
import { deviceIcon, watchDevice } from '../devices.js';
import { el, note } from '../dom.js';
import { state } from '../state.js';

function batteryType(device) {
  const batteries = device.energyObj?.batteries;
  if (!Array.isArray(batteries) || batteries.length === 0) return 'Unknown battery';
  const counts = new Map();
  for (const battery of batteries) counts.set(battery, (counts.get(battery) ?? 0) + 1);
  return [...counts].map(([battery, count]) => `${count}x ${battery}`).join(', ');
}

export function batteryRow(device, { avatar = true } = {}) {
  const row = el('div', 'battery-row');
  const icon = el('div', avatar ? 'battery-avatar' : 'battery-avatar is-plain');
  if (avatar) icon.style.background = device.color ?? 'var(--control)';
  icon.append(deviceIcon(device, ''));
  const text = el('div', 'battery-text');
  text.append(
    el('div', 'battery-zone', state.data.zones?.[device.zone]?.name ?? ''),
    el('div', 'battery-name', device.name),
    el('div', 'battery-type', batteryType(device)),
  );
  const level = el('div', 'battery-level');
  const percent = el('span');
  const gauge = el('div', 'battery-gauge');
  const fill = el('div', 'battery-fill');
  gauge.append(fill);
  level.append(percent, gauge);
  row.append(icon, text, level);

  const update = () => {
    const value = device.capabilitiesObj?.measure_battery?.value;
    percent.textContent = typeof value === 'number' ? `${Math.round(value)}%` : '–';
    // Even an empty battery keeps a red sliver, like the app.
    fill.style.width = typeof value === 'number' ? `${clamp(value, 5, 100)}%` : '0%';
    // Red through yellow to green, like the mobile app's gauge (38% #c9a000, 75% #51c901, 90% #03c900).
    fill.style.background = typeof value === 'number' ? hsvToHex(clamp(value * 1.32 - 2, 0, 120), 1, 0.79) : '';
  };
  update();
  return { node: row, cleanup: watchDevice(device, update) };
}

// Homey's own low-battery threshold (ENERGY_LOW_BATTERY_THRESHOLD in the firmware). Like the app, unavailable devices
// are left out, hidden ones are not.
const LOW_BATTERY = 15;

export function mountLowBatteries({ body }) {
  if (!requireData(body, 'devices', 'zones')) return;
  const level = (device) => device.capabilitiesObj?.measure_battery?.value;
  const devices = Object.values(state.data.devices)
    .filter((device) => device.available !== false && typeof level(device) === 'number' && level(device) < LOW_BATTERY)
    .sort((a, b) => level(a) - level(b));
  if (devices.length === 0) return note(body, 'No low batteries.');
  const list = el('div', 'battery-list');
  body.append(list);
  const cleanups = devices.map((device) => {
    const row = batteryRow(device);
    list.append(row.node);
    return row.cleanup;
  });
  return () => cleanups.forEach((cleanup) => cleanup());
}

export function mountBatteries({ body, widget }) {
  if (!requireData(body, 'devices')) return;
  const list = el('div', 'battery-list');
  body.append(list);
  const level = (device) => device.capabilitiesObj?.measure_battery?.value ?? Infinity;
  // Emptiest first, like the mobile app.
  const devices = (widget.data?.deviceIds ?? [])
    .map((id) => state.data.devices[id])
    .filter(Boolean)
    .sort((a, b) => level(a) - level(b));
  const cleanups = devices.map((device) => {
    const row = batteryRow(device);
    list.append(row.node);
    return row.cleanup;
  });
  if (cleanups.length === 0) return note(body, 'These devices no longer exist.');
  return () => cleanups.forEach((cleanup) => cleanup());
}
