// Selected sensor readings.

import { requireData } from '../data.js';
import { formatCapability, watchDevice } from '../devices.js';
import { el, maskIcon, note } from '../dom.js';
import { SENSOR_CAPABILITY_ICONS } from '../icons/capability-icons.js';
import { state } from '../state.js';

// Colours sampled from the mobile app; anything else, including sub-capabilities like
// "measure_temperature.vorlauf", is purple there too.
const SENSOR_COLORS = {
  measure_luminance: '#fcb900',
  measure_temperature: '#fe6600',
  measure_humidity: '#0093ff',
  level_aqi: '#6ed700',
  measure_aqi: '#6ed700',
  measure_co: '#e41f20',
  measure_co2: '#e41f20',
  measure_pm1: '#e41f20',
  measure_pm25: '#e41f20',
  measure_pm10: '#e41f20',
};

const SENSOR_DEFAULT_COLOR = '#b820e2';

function sensorStyle(capabilityId, value) {
  const [base, sub] = capabilityId.split('.');
  const icons = SENSOR_CAPABILITY_ICONS[base]
    ?? (base.startsWith('alarm_') ? SENSOR_CAPABILITY_ICONS.alarm_generic : SENSOR_CAPABILITY_ICONS.measure);
  return {
    icon: value === true && icons.active ? icons.active : icons.default,
    color: sub ? SENSOR_DEFAULT_COLOR : SENSOR_COLORS[base] ?? SENSOR_DEFAULT_COLOR,
  };
}

function formatSensorValue(capability) {
  const { value } = capability;
  if (value == null) return '–';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (capability.type === 'enum') {
    return capability.values?.find((option) => option.id === value)?.title ?? String(value);
  }
  return formatCapability(capability);
}

export function mountSensors({ body, widget }) {
  if (!requireData(body, 'devices')) return;
  const grid = el('div', 'pair-grid');
  body.append(grid);
  const cleanups = [];

  for (const entry of widget.data?.capabilitiesIds ?? []) {
    const separator = entry.indexOf(':');
    const device = state.data.devices[entry.slice(0, separator)];
    const capabilityId = entry.slice(separator + 1);
    const capability = device?.capabilitiesObj?.[capabilityId];
    if (capability == null) continue;

    const style = sensorStyle(capabilityId, capability.value);
    const tile = el('div', 'tile-card');
    const row = el('div', 'tile-row');
    row.style.color = style.color;
    const icon = maskIcon(style.icon, 'sensor-icon');
    row.append(icon);
    const text = el('div', 'panel-text');
    text.append(el('div', 'tile-label', capability.title), el('div', 'tile-detail', device.name));
    row.append(text);
    const value = el('div', 'tile-value');
    tile.append(row, value);
    grid.append(tile);

    const update = () => {
      value.textContent = formatSensorValue(capability);
      // Alarms switch to their "active" icon while on.
      icon.style.setProperty('--icon', `url("${sensorStyle(capabilityId, capability.value).icon}")`);
    };
    update();
    cleanups.push(watchDevice(device, update));
  }
  if (cleanups.length === 0) return note(body, 'These sensors no longer exist.');
  return () => cleanups.forEach((cleanup) => cleanup());
}
