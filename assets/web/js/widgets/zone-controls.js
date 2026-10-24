// Zone control tiles (lights, activity, speakers, energy, climate, batteries).

import { requireData } from '../data.js';
import { isClass, watchDevice } from '../devices.js';
import { el } from '../dom.js';
import { SENSOR_ICONS, ZONE_ICONS } from '../icons.js';
import { subscribe } from '../realtime.js';
import { ZONE_SHEETS, openZoneSheet } from '../sheets/zone-sheets.js';
import { state } from '../state.js';
import { zoneClimate, zoneSubtree } from '../zones.js';

const ZONE_COLORS = {
  lights: 'var(--active)',
  activity: 'var(--zone-activity)',
  speakers: 'var(--play)',
  energy: 'var(--zone-energy)',
  climate: 'var(--zone-climate)',
  batteries: 'var(--danger)',
};

// Each control summarises one aspect of the zone (and its sub-zones), like the mobile app.
const ZONE_CONTROL_SUMMARIES = {
  lights: (devices) => {
    const lights = devices.filter((device) => isClass(device, 'light') && device.capabilitiesObj?.onoff);
    const on = lights.filter((device) => device.capabilitiesObj.onoff.value === true).length;
    return { text: on > 0 ? `${on} turned on` : 'All off', active: on > 0, watch: lights };
  },
  speakers: (devices) => {
    const speakers = devices.filter((device) => isClass(device, 'speaker') && device.capabilitiesObj?.speaker_playing);
    const playing = speakers.filter((device) => device.capabilitiesObj.speaker_playing.value === true).length;
    return { text: playing > 0 ? `${playing} playing` : 'All paused', active: playing > 0, watch: speakers };
  },
  climate: (devices) => {
    const { temperature, humidity } = zoneClimate(devices);
    const parts = [];
    if (temperature != null) parts.push(`${temperature.toFixed(1)}°`);
    if (humidity != null) parts.push(`${Math.round(humidity)}%`);
    return { text: parts.join(' | ') || 'No sensors', active: parts.length > 0, watch: devices.filter((device) => isClass(device, 'sensor', 'thermostat')) };
  },
  batteries: (devices) => {
    const powered = devices.filter((device) => typeof device.capabilitiesObj?.measure_battery?.value === 'number');
    const empty = powered.filter((device) => device.capabilitiesObj.measure_battery.value <= 10).length;
    const low = powered.filter((device) => device.capabilitiesObj.measure_battery.value <= 25).length;
    const text = empty > 0 ? `${empty} empty` : low > 0 ? `${low} low` : 'All good';
    return { text, active: empty > 0, watch: powered };
  },
};

export function mountZoneControls({ body, widget }) {
  if (!requireData(body, 'devices', 'zones')) return;
  const grid = el('div', 'pair-grid');
  body.append(grid);
  const cleanups = [];

  for (const control of widget.data?.controls ?? []) {
    const [zoneId, kind] = control.split(':');
    const zone = state.data.zones[zoneId];
    if (zone == null) continue;

    const tile = el('div', 'zone-tile');
    tile.style.setProperty('--zone-color', ZONE_COLORS[kind] ?? 'var(--text-primary)');
    tile.innerHTML = ZONE_ICONS[kind] ?? SENSOR_ICONS.gauge;
    const text = el('div', 'panel-text');
    const status = el('div', 'tile-detail');
    text.append(el('div', 'tile-label', zone.name), status);
    tile.append(text);
    grid.append(tile);
    if (ZONE_SHEETS[kind]) {
      tile.classList.add('is-openable');
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      tile.setAttribute('aria-label', `${ZONE_SHEETS[kind].title} in ${zone.name}`);
      tile.addEventListener('click', () => openZoneSheet(kind, zoneId));
      tile.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openZoneSheet(kind, zoneId);
      });
    }

    const show = ({ text: statusText, active }) => {
      status.textContent = statusText;
      tile.classList.toggle('is-active', active);
    };

    if (kind === 'activity') {
      show({ text: zone.active ? 'Active' : 'Inactive', active: zone.active === true });
      cleanups.push(subscribe('homey:manager:zones', 'zone.update', (updated) => {
        if (updated?.id !== zoneId) return;
        state.data.zones[zoneId] = updated;
        show({ text: updated.active ? 'Active' : 'Inactive', active: updated.active === true });
      }));
    } else if (kind === 'energy') {
      // The live energy report has no realtime event, so poll it.
      const refresh = () => state.client.api('GET', `/api/manager/energy/live?zone=${encodeURIComponent(zoneId)}`)
        .then((report) => {
          const watts = report.totalCumulative?.W ?? report.totalConsumed?.W;
          show({ text: watts == null ? 'No data' : `${Math.round(watts)} W`, active: watts != null });
        })
        .catch((error) => show({ text: error.message, active: false }));
      refresh();
      const timer = setInterval(refresh, 10_000);
      cleanups.push(() => clearInterval(timer));
    } else if (ZONE_CONTROL_SUMMARIES[kind]) {
      const zones = zoneSubtree(zoneId);
      const devices = Object.values(state.data.devices).filter((device) => zones.has(device.zone));
      const update = () => show(ZONE_CONTROL_SUMMARIES[kind](devices));
      const { watch } = ZONE_CONTROL_SUMMARIES[kind](devices);
      update();
      for (const device of watch) cleanups.push(watchDevice(device, update));
    } else {
      show({ text: 'Not available on web', active: false });
    }
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
