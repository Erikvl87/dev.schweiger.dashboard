// Widgets about one zone: its devices (devices_zone), its moods (moods_zone) and its lights (light_zones).

import { requireData } from '../data.js';
import { isClass, watchDevice } from '../devices.js';
import { note } from '../dom.js';
import { lightsIn, zoneLightControl } from '../sheets/zone-sheets.js';
import { state } from '../state.js';
import { zoneDevices } from '../zones.js';
import { moodDeviceCount, renderDeviceGrid, renderMoodCards } from './favorites.js';

const byName = (a, b) => a.name.localeCompare(b.name);

function findZone(body, widget, setTitle) {
  const zone = state.data.zones?.[widget.data?.zoneId];
  if (zone == null) {
    note(body, 'This zone no longer exists.');
    return null;
  }
  setTitle(zone.name);
  return zone;
}

export function mountZoneDevices({ body, widget, setTitle }) {
  if (!requireData(body, 'devices', 'zones')) return;
  const zone = findZone(body, widget, setTitle);
  if (zone == null) return;
  const { deviceClasses, subzones = true, hideHiddenDevices = false } = widget.data;
  // The app stores null for "all device classes".
  const devices = zoneDevices(zone.id, { recursive: subzones !== false })
    .filter((device) => !deviceClasses?.length || isClass(device, ...deviceClasses))
    .filter((device) => !(hideHiddenDevices && device.hidden))
    .sort(byName);
  if (devices.length === 0) return note(body, 'No devices in this zone.');
  return renderDeviceGrid(body, devices);
}

export function mountZoneMoods({ body, widget, setTitle }) {
  if (!requireData(body, 'moods', 'zones', 'devices')) return;
  const zone = findZone(body, widget, setTitle);
  if (zone == null) return;
  const moods = Object.values(state.data.moods).filter((mood) => mood.zone === zone.id).sort(byName);
  if (moods.length === 0) return note(body, 'No moods in this zone.');
  renderMoodCards(body, moods, moodDeviceCount);
}

export function mountZoneLights({ body, widget, setTitle }) {
  if (!requireData(body, 'devices', 'zones')) return;
  const zone = findZone(body, widget, setTitle);
  if (zone == null) return;
  if (lightsIn(zone.id).length === 0) return note(body, 'No lights in this zone.');
  const control = zoneLightControl(zone, { widget: true, refresh: () => control.update() });
  body.append(control.node);
  const cleanups = control.lights.map((device) => watchDevice(device, control.update));
  return () => cleanups.forEach((cleanup) => cleanup());
}
