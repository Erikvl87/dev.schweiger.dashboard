// Zone sheets opened from the zone controls: lights, speakers, batteries and climate.

import { lightHex } from '../color.js';
import { deviceIcon, isClass, setCapability, watchDevice } from '../devices.js';
import { el, note, paintSlider, pulse } from '../dom.js';
import { CHEVRON_DOWN, CHEVRON_LEFT, CHEVRON_RIGHT, MEDIA_ICONS, SENSOR_ICONS, ZONE_ICONS } from '../icons.js';
import { state } from '../state.js';
import { batteryRow } from '../widgets/batteries.js';
import { mountLights } from '../widgets/lights.js';
import { thermostatControl } from '../widgets/thermostat.js';
import { zoneChildren, zoneClimate, zoneDevices, zoneIcon, zoneOrder, zoneSubtree } from '../zones.js';

export const ZONE_SHEETS = {
  lights: { title: 'Lights', color: 'var(--active)', render: renderLightsSheet },
  speakers: { title: 'Speakers', color: '#9033fc', render: renderSpeakersSheet },
  batteries: { title: 'Batteries', color: '#3fc700', render: renderBatteriesSheet },
  climate: { title: 'Climate', color: '#ff9713', render: renderClimateSheet },
};

export function openZoneSheet(kind, zoneId) {
  const config = ZONE_SHEETS[kind];
  document.querySelector('dialog.zone-sheet')?.close();
  const dialog = el('dialog', 'zone-sheet');
  dialog.style.setProperty('--sheet-accent', config.color);
  const header = el('div', 'zone-sheet-header');
  const nav = el('button', 'sheet-close');
  nav.type = 'button';
  const title = el('h2', 'zone-sheet-title');
  title.innerHTML = ZONE_ICONS[kind];
  title.append(config.title);
  header.append(nav, title);
  const content = el('div', 'zone-sheet-content');
  dialog.append(header, content);

  // Tapping a sub-zone drills into it; the header button then goes back.
  const trail = [];
  let cleanups = [];
  const show = (id) => {
    cleanups.forEach((cleanup) => cleanup());
    content.replaceChildren();
    content.scrollTop = 0;
    nav.innerHTML = trail.length ? CHEVRON_LEFT : CHEVRON_DOWN;
    nav.setAttribute('aria-label', trail.length ? 'Back' : 'Close');
    cleanups = config.render(content, id, (childId) => {
      trail.push(id);
      show(childId);
    }) ?? [];
  };
  nav.addEventListener('click', () => (trail.length ? show(trail.pop()) : dialog.close()));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    cleanups.forEach((cleanup) => cleanup());
    dialog.remove();
  });
  document.body.append(dialog);
  show(zoneId);
  dialog.showModal();
}

function zoneHero(zone, extra) {
  const hero = el('div', 'zone-hero');
  hero.append(zoneIcon(zone), el('h3', 'zone-hero-name', zone.name));
  if (extra) hero.append(extra);
  return hero;
}

function zoneName(zone, navigate, className) {
  if (navigate == null) return el('span', className, zone.name);
  const button = el('button', `${className} is-link`, zone.name);
  button.type = 'button';
  button.insertAdjacentHTML('beforeend', CHEVRON_RIGHT);
  button.addEventListener('click', () => navigate(zone.id));
  return button;
}

function zoneGroupHeader(zone, navigate, chip) {
  const row = el('div', 'zone-group');
  row.append(zoneIcon(zone, true), zoneName(zone, navigate, 'zone-group-name'));
  if (chip) row.append(chip);
  return row;
}

// Unavailable lights don't count, matching the app's "5 of 12 lights are on".
export function lightsIn(zoneId, recursive = true) {
  return zoneDevices(zoneId, { recursive })
    .filter((device) => isClass(device, 'light') && device.capabilitiesObj?.onoff && device.available !== false);
}

// All lights of a zone behind one switch and one brightness slider. As the light_zones widget (widget: true) it has
// no status line and takes the colour of the lights that are on.
export function zoneLightControl(zone, { hero = false, widget = false, navigate = null, refresh }) {
  const lights = lightsIn(zone.id);
  const switchable = lights.filter((device) => device.capabilitiesObj.onoff.setable);
  const dimmable = lights.filter((device) => device.capabilitiesObj.dim?.setable);

  const node = el('div', hero ? 'zone-light is-hero' : widget ? 'zone-light is-widget' : 'zone-light');
  const head = el('div', 'zone-light-head');
  const text = el('div', 'panel-text');
  const status = el('div', 'panel-sub');
  text.append(zoneName(zone, navigate, 'zone-light-name'));
  if (!hero && !widget) text.append(status);
  const toggle = el('button', 'switch');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  head.append(zoneIcon(zone, true), text, toggle);
  const slider = el('input', 'slider');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.setAttribute('aria-label', `Brightness in ${zone.name}`);
  node.append(head, slider);

  let dragging = false;
  const isOn = () => lights.some((device) => device.capabilitiesObj.onoff.value === true);
  const update = () => {
    const on = lights.filter((device) => device.capabilitiesObj.onoff.value === true).length;
    node.classList.toggle('is-on', on > 0);
    toggle.setAttribute('aria-checked', String(on > 0));
    toggle.setAttribute('aria-label', `${on > 0 ? 'Turn off' : 'Turn on'} the lights in ${zone.name}`);
    toggle.disabled = switchable.length === 0;
    status.textContent = on === 0 ? 'All lights are off' : on === lights.length ? 'All lights are on' : `${on} of ${lights.length} lights are on`;
    if (widget) {
      const lit = lights.find((device) => device.capabilitiesObj.onoff.value === true);
      const color = lit ? lightHex(lit) : null;
      if (color) node.style.setProperty('--zone-light', color);
      else node.style.removeProperty('--zone-light');
    }
    slider.hidden = dimmable.length === 0;
    if (!dragging && dimmable.length > 0) {
      // The brightness of the lights that are on, or of all of them when everything is off.
      const lit = dimmable.filter((device) => device.capabilitiesObj.onoff?.value === true);
      const pool = lit.length > 0 ? lit : dimmable;
      const level = pool.reduce((sum, device) => sum + (device.capabilitiesObj.dim.value ?? 0), 0) / pool.length;
      slider.value = String(Math.round(level * 100));
      paintSlider(slider);
    }
  };
  toggle.addEventListener('click', () => {
    const next = !isOn();
    for (const device of switchable) setCapability(device, 'onoff', next, refresh);
  });
  slider.addEventListener('input', () => {
    dragging = true;
    paintSlider(slider);
  });
  slider.addEventListener('change', () => {
    dragging = false;
    for (const device of dimmable) setCapability(device, 'dim', Number(slider.value) / 100, refresh);
  });
  update();
  return { node, update, lights };
}

function renderLightsSheet(content, zoneId, navigate) {
  const zone = state.data.zones[zoneId];
  const updates = [];
  const refresh = () => updates.forEach((update) => update());
  const cleanups = [];

  const band = el('div', 'zone-band');
  const hero = zoneLightControl(zone, { hero: true, refresh });
  band.append(hero.node);
  updates.push(hero.update);
  content.append(band);

  const children = zoneChildren(zoneId).filter((child) => lightsIn(child.id).length > 0);
  if (children.length > 0) {
    content.append(el('h3', 'zone-section-title', 'Zones'));
    const stack = el('div', 'zone-stack');
    for (const child of children) {
      const control = zoneLightControl(child, { navigate, refresh });
      stack.append(control.node);
      updates.push(control.update);
    }
    content.append(stack);
  }

  const own = lightsIn(zoneId, false);
  if (own.length > 0) {
    content.append(el('h3', 'zone-section-title', 'Lights'));
    const stack = el('div', 'zone-stack');
    for (const device of own) {
      const holder = el('div');
      stack.append(holder);
      const cleanup = mountLights(holder, [device.id]);
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    }
    content.append(stack);
  }
  if (hero.lights.length === 0) note(content, 'There are no lights in this zone.');

  for (const device of hero.lights) cleanups.push(watchDevice(device, refresh));
  return cleanups;
}

function speakerCard(device) {
  const capabilities = device.capabilitiesObj;
  const node = el('div', 'sheet-card speaker-card');
  const head = el('div', 'speaker-card-head');
  const play = el('button', 'speaker-play');
  play.type = 'button';
  play.disabled = capabilities.speaker_playing.setable !== true;
  head.append(deviceIcon(device, 'sheet-device-icon'), el('div', 'speaker-card-name', device.name), play);
  node.append(head);

  let volume = null;
  let dragging = false;
  if (capabilities.volume_set) {
    volume = el('input', 'slider');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '100';
    volume.disabled = capabilities.volume_set.setable !== true;
    volume.setAttribute('aria-label', `Volume of ${device.name}`);
    volume.addEventListener('input', () => {
      dragging = true;
      paintSlider(volume);
    });
    volume.addEventListener('change', () => {
      dragging = false;
      setCapability(device, 'volume_set', Number(volume.value) / 100, update);
    });
    node.append(volume);
  }

  function update() {
    const playing = capabilities.speaker_playing.value === true;
    play.innerHTML = playing ? MEDIA_ICONS.pause : MEDIA_ICONS.play;
    play.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${device.name}`);
    if (volume && !dragging) {
      volume.value = String(Math.round((capabilities.volume_set.value ?? 0) * 100));
      paintSlider(volume);
    }
  }
  play.addEventListener('click', () => {
    pulse(play);
    setCapability(device, 'speaker_playing', capabilities.speaker_playing.value !== true, update);
  });
  update();
  return { node, cleanup: watchDevice(device, update) };
}

function renderSpeakersSheet(content, zoneId) {
  content.append(zoneHero(state.data.zones[zoneId]));
  const cleanups = [];
  for (const section of zoneOrder(zoneId)) {
    const speakers = zoneDevices(section.id, { recursive: false })
      .filter((device) => isClass(device, 'speaker') && device.capabilitiesObj?.speaker_playing);
    if (speakers.length === 0) continue;
    content.append(zoneGroupHeader(section));
    const stack = el('div', 'zone-stack');
    for (const device of speakers) {
      const card = speakerCard(device);
      stack.append(card.node);
      cleanups.push(card.cleanup);
    }
    content.append(stack);
  }
  if (cleanups.length === 0) note(content, 'There are no speakers in this zone.');
  return cleanups;
}

function renderBatteriesSheet(content, zoneId) {
  content.append(zoneHero(state.data.zones[zoneId]));
  const zones = zoneSubtree(zoneId);
  const level = (device) => device.capabilitiesObj.measure_battery.value;
  const devices = Object.values(state.data.devices)
    .filter((device) => zones.has(device.zone) && typeof device.capabilitiesObj?.measure_battery?.value === 'number')
    .sort((a, b) => level(a) - level(b));

  // What to buy: the batteries of every (nearly) empty device.
  const needed = new Map();
  for (const device of devices.filter((candidate) => level(candidate) <= 10)) {
    for (const battery of device.energyObj?.batteries ?? []) needed.set(battery, (needed.get(battery) ?? 0) + 1);
  }
  if (needed.size > 0) {
    content.append(el('h3', 'zone-section-title', 'Replacements'));
    const chips = el('div', 'battery-chips');
    for (const [battery, count] of needed) chips.append(el('span', 'battery-chip', `${count}x ${battery}`));
    content.append(chips);
  }

  content.append(el('h3', 'zone-section-title', 'Devices'));
  const stack = el('div', 'zone-stack');
  const cleanups = devices.map((device) => {
    const row = batteryRow(device, { avatar: false });
    stack.append(row.node);
    return row.cleanup;
  });
  content.append(stack);
  if (devices.length === 0) note(stack, 'There are no battery devices in this zone.');
  return cleanups;
}

function climateChip(devices, className) {
  const { temperature, humidity } = zoneClimate(devices);
  if (temperature == null && humidity == null) return null;
  const chip = el('span', className);
  if (temperature != null) {
    chip.insertAdjacentHTML('beforeend', SENSOR_ICONS.thermometer);
    chip.append(el('span', null, `${temperature.toFixed(1)}°`));
  }
  if (humidity != null) {
    chip.insertAdjacentHTML('beforeend', SENSOR_ICONS.drop);
    chip.append(el('span', null, `${Math.round(humidity)}%`));
  }
  return chip;
}

function renderClimateSheet(content, zoneId, navigate) {
  const zones = zoneSubtree(zoneId);
  const everything = Object.values(state.data.devices).filter((device) => zones.has(device.zone));
  content.append(zoneHero(state.data.zones[zoneId], climateChip(everything, 'zone-hero-summary')));
  const cleanups = [];
  for (const section of zoneOrder(zoneId)) {
    const direct = zoneDevices(section.id, { recursive: false });
    const thermostats = direct.filter((device) => device.capabilitiesObj?.target_temperature);
    if (thermostats.length === 0) continue;
    content.append(zoneGroupHeader(section, section.id === zoneId ? null : navigate, climateChip(direct, 'zone-chip')));
    const stack = el('div', 'zone-stack');
    for (const device of thermostats) {
      const control = thermostatControl(device, { variant: 'list' });
      stack.append(control.node);
      cleanups.push(control.cleanup);
    }
    content.append(stack);
  }
  if (cleanups.length === 0) note(content, 'There are no thermostats in this zone.');
  return cleanups;
}
