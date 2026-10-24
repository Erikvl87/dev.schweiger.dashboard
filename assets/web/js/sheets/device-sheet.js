// Device controls sheet (power, slider, colour, up/stop/down), mirroring the Homey web app.

import { clamp, hexToHsv, lightHex, lightMode, lighten, temperatureSelectorColor } from '../color.js';
import { groupMembers, isClass, setCapability, watchDevice } from '../devices.js';
import { el, maskIcon, pulse } from '../dom.js';
import { BACK_ICON, CHEVRON_DOWN } from '../icons.js';
import { CONTROL_ICONS } from '../icons/control-icons.js';
import { state } from '../state.js';

const SHEET_COMPONENTS = ['thermostat', 'toggle', 'slider', 'color', 'ternary'];

const SHEET_TAB_LABELS = { thermostat: 'Temperature', toggle: 'Power', slider: 'Level', color: 'Colour', ternary: 'Position' };

const COLOR_PRESETS = {
  color: ['#FF0000', '#FE7023', '#FFC836', '#D4FF42', '#1EFE43', '#12D3FC', '#004EF9', '#E80FF9'],
  temperature: ['#FFDB74', '#FEDD7F', '#FFEAB3', '#FFF4D5', '#FFFFFF', '#F7FFFF', '#E4FFFF', '#CFFBFE'],
};

export function sheetComponents(device) {
  return (device.ui?.components ?? []).filter((component) => SHEET_COMPONENTS.includes(component.id)
    && component.capabilities?.some((capabilityId) => device.capabilitiesObj?.[capabilityId]));
}

export function openDeviceSheet(initialDevice) {
  if (sheetComponents(initialDevice).length === 0) return;
  document.querySelector('dialog.device-sheet')?.close();

  const dialog = el('dialog', 'device-sheet');
  const tint = el('div', 'sheet-tint');
  const inner = el('div', 'sheet-inner');
  const header = el('div', 'sheet-header');
  const close = el('button', 'sheet-close');
  close.type = 'button';
  close.innerHTML = CHEVRON_DOWN;
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => dialog.close());
  const title = el('h2', 'sheet-title');
  const titleButton = el('button', 'sheet-title-button');
  titleButton.type = 'button';
  const menu = el('div', 'sheet-menu');
  menu.hidden = true;
  title.append(titleButton, menu);
  header.append(close, title);
  const body = el('div', 'sheet-body');
  const tabs = el('div', 'sheet-tabs');
  tabs.setAttribute('role', 'tablist');
  inner.append(header, body, tabs);
  dialog.append(tint, inner);

  // A group and its members share one sheet; the title switches between them.
  const group = (initialDevice.group && state.data.devices?.[initialDevice.group]) || initialDevice;
  const choices = [group, ...groupMembers(group)].filter((candidate) => sheetComponents(candidate).length > 0);
  let device = initialDevice;
  let panel = null;
  let stop = () => {};

  // The light's colour washes over the sheet, stronger when it is brighter (from the web app).
  const updateTint = () => {
    const capabilities = device.capabilitiesObj ?? {};
    const color = (capabilities.light_hue || capabilities.light_temperature) ? lightHex(device) : null;
    if (color == null) {
      tint.style.opacity = '0';
      return;
    }
    let on = capabilities.onoff?.value ?? true;
    if (on && capabilities.dim?.value === 0) on = false;
    const dim = capabilities.dim?.value ?? 1;
    tint.style.setProperty('--tint-start', `color-mix(in srgb, ${color} 70%, #262626)`);
    tint.style.setProperty('--tint-stop', `color-mix(in srgb, ${color} 40%, #131313)`);
    tint.style.opacity = on ? String(Math.exp(Math.log(0.4) + (Math.log(0.8) - Math.log(0.4)) * dim)) : '0';
  };
  const refresh = (capabilityId) => {
    panel?.update(capabilityId);
    updateTint();
  };

  const show = (component) => {
    for (const tab of tabs.children) tab.setAttribute('aria-selected', String(tab.dataset.component === component.id));
    panel?.dispose?.();
    body.replaceChildren();
    panel = SHEET_PANELS[component.id](body, device, component, refresh);
  };

  const select = (next) => {
    device = next;
    stop();
    menu.hidden = true;
    titleButton.replaceChildren(device.name);
    titleButton.setAttribute('aria-expanded', 'false');
    if (choices.length > 1) titleButton.insertAdjacentHTML('beforeend', CHEVRON_DOWN);
    titleButton.disabled = choices.length < 2;
    menu.replaceChildren(...choices.map((choice) => {
      const item = el('button', 'sheet-menu-item', choice.name);
      item.type = 'button';
      item.setAttribute('aria-current', String(choice.id === device.id));
      item.addEventListener('click', () => select(choice));
      return item;
    }));

    const components = sheetComponents(device);
    tabs.replaceChildren(...components.map((component) => {
      const tab = el('button', 'sheet-tab');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-label', component.capabilities[0] === 'locked' ? 'Lock' : SHEET_TAB_LABELS[component.id]);
      tab.dataset.component = component.id;
      tab.append(maskIcon(CONTROL_ICONS.tabs[component.id]));
      tab.addEventListener('click', () => show(component));
      return tab;
    }));
    tabs.hidden = components.length < 2;
    stop = watchDevice(device, refresh);
    const start = device.ui?.components?.[device.ui.componentsStartAt ?? 0];
    show(components.find((component) => component.id === start?.id) ?? components[0]);
    updateTint();
  };

  titleButton.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    titleButton.setAttribute('aria-expanded', String(!menu.hidden));
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
    else if (!menu.hidden && !title.contains(event.target)) menu.hidden = true;
  });
  dialog.addEventListener('close', () => {
    stop();
    panel?.dispose?.();
    dialog.remove();
  });

  document.body.append(dialog);
  select(initialDevice);
  dialog.showModal();
}

function sliderIcons(capabilityId, device) {
  const base = capabilityId.split('.')[0];
  if (base === 'dim' && isClass(device, 'light')) return { upper: CONTROL_ICONS.slider.lightUpper, lower: CONTROL_ICONS.slider.lightLower };
  if (base === 'windowcoverings_set') return { upper: CONTROL_ICONS.slider.blindUpper, lower: CONTROL_ICONS.slider.blindLower };
  return { upper: CONTROL_ICONS.slider.defaultUpper, lower: CONTROL_ICONS.slider.defaultLower };
}

// Locks: Unlock and Lock as two round buttons with their names under them; the current state is white with a green
// padlock, as in the app.
function lockPanel(body, device, capabilityId, refresh) {
  const capability = device.capabilitiesObj[capabilityId];
  const column = el('div', 'lock-choices');
  const choices = [[false, 'Unlock', CONTROL_ICONS.lock.open], [true, 'Lock', CONTROL_ICONS.lock.closed]].map(([locked, label, icon]) => {
    const choice = el('div', 'lock-choice');
    const button = el('button', 'lock-button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.append(maskIcon(icon));
    button.addEventListener('click', () => {
      pulse(button);
      setCapability(device, capabilityId, locked, refresh);
    });
    choice.append(button, el('span', 'lock-label', label));
    column.append(choice);
    return { button, locked };
  });
  body.append(column);
  const update = () => {
    for (const { button, locked } of choices) {
      button.setAttribute('aria-pressed', String(capability.value === locked));
      button.disabled = device.available === false || capability.setable === false;
    }
  };
  update();
  return { update };
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};

// The thermostat dial, following the Homey web app's: one tick per temperature step round a 270° arc (open at the
// bottom), the target and the measured temperature's ticks bold and the ticks between them lit, a white marker on the
// target; the target large in the middle and the measured temperature under it. As in the mobile app, down / up
// buttons sit in the opening. Coordinates: centre 0,0, ring radius 140, angles clockwise from the right (SVG).
const DIAL_RADIUS = 140;
const DIAL_START = Math.PI * 0.75; // bottom left
const DIAL_SWEEP = Math.PI * 1.5;
const MAX_TICKS = 120;

function radial(angle, length, radius = DIAL_RADIUS) {
  const outer = radius + length / 2;
  const inner = radius - length / 2;
  return { x1: outer * Math.cos(angle), y1: outer * Math.sin(angle), x2: inner * Math.cos(angle), y2: inner * Math.sin(angle) };
}

function thermostatPanel(body, device, component, refresh) {
  const capabilities = device.capabilitiesObj;
  const targetId = component.capabilities.find((id) => id.startsWith('target_temperature') && capabilities[id]);
  const measureId = component.capabilities.find((id) => id.startsWith('measure_temperature') && capabilities[id]);
  const target = capabilities[targetId];
  const measure = capabilities[measureId];
  const min = target?.min ?? 5;
  const max = target?.max ?? 35;
  const step = target?.step ?? 0.5;
  const steps = Math.min(MAX_TICKS, Math.max(1, Math.round((max - min) / step)));
  const fraction = (value) => (clamp(value, min, max) - min) / (max - min || 1);
  const angleOf = (value) => DIAL_START + fraction(value) * DIAL_SWEEP;
  const tickOf = (value) => (value == null ? null : Math.round(fraction(value) * steps));
  const degrees = (value) => (value == null ? '–' : `${Number(value).toFixed(1)}°`);

  const svg = svgEl('svg', { class: 'dial', viewBox: '-200 -200 400 400', role: 'group', 'aria-label': target?.title ?? 'Temperature' });
  const tickLines = [];
  for (let index = 0; index <= steps; index += 1) {
    const line = svgEl('line', { class: 'dial-tick', ...radial(DIAL_START + (index / steps) * DIAL_SWEEP, 16) });
    tickLines.push(line);
    svg.append(line);
  }
  const marker = svgEl('line', { class: 'dial-marker' });
  const targetText = svgEl('text', { class: 'dial-target', x: 0, y: 0 });
  const measureText = svgEl('text', { class: 'dial-measure', x: 0, y: 62 });
  svg.append(marker, targetText, measureText);

  // An annular sector between two angles: the arc-shaped buttons.
  const sector = (from, to, inner, outer) => {
    const point = (angle, radius) => `${radius * Math.cos(angle)} ${radius * Math.sin(angle)}`;
    return `M${point(from, outer)}A${outer} ${outer} 0 0 1 ${point(to, outer)}L${point(to, inner)}A${inner} ${inner} 0 0 0 ${point(from, inner)}Z`;
  };
  const toRadians = (angle) => (angle * Math.PI) / 180;
  const stepButton = (from, to, delta, label, chevron) => {
    const group = svgEl('g', { class: 'dial-step', role: 'button', tabindex: '0', 'aria-label': label });
    group.append(svgEl('path', { d: sector(toRadians(from), toRadians(to), 114, 152) }));
    const middle = toRadians((from + to) / 2);
    group.append(svgEl('path', { class: 'dial-chevron', d: chevron, transform: `translate(${133 * Math.cos(middle)} ${133 * Math.sin(middle)})` }));
    const press = () => preview((local ?? target?.value ?? min) + delta);
    group.addEventListener('click', press);
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        press();
      }
    });
    svg.append(group);
    return group;
  };
  // 90° is straight down; the buttons fill the opening, down on the left and up on the right.
  const down = stepButton(91, 122, -step, 'Lower', 'M-7 -3l7 7 7-7');
  const up = stepButton(58, 89, step, 'Higher', 'M-7 4l7-7 7 7');
  body.append(svg);

  let local = null;
  let sendTimer = null;
  const snap = (value) => Number(clamp(Math.round((value - min) / step) * step + min, min, max).toFixed(4));
  const render = () => {
    const value = local ?? target?.value;
    const targetTick = target ? tickOf(value ?? min) : null;
    const measureTick = tickOf(measure?.value);
    tickLines.forEach((line, index) => {
      const bold = index === targetTick || index === measureTick;
      const between = targetTick != null && measureTick != null
        && index >= Math.min(targetTick, measureTick) && index <= Math.max(targetTick, measureTick);
      line.classList.toggle('is-lit', bold || between);
      line.classList.toggle('is-bold', bold);
    });
    if (target) Object.entries(radial(angleOf(value ?? min), 24)).forEach(([name, coordinate]) => marker.setAttribute(name, coordinate));
    marker.style.display = target ? '' : 'none';
    targetText.textContent = degrees(target ? value : measure?.value);
    measureText.textContent = target && measure ? degrees(measure.value) : '';
    const disabled = !target || target.setable === false || device.available === false;
    for (const button of [down, up]) button.classList.toggle('is-disabled', disabled);
  };
  // Like the sliders: follow taps and drags locally and send once they settle.
  function preview(value) {
    if (!target || target.setable === false || device.available === false) return;
    local = snap(value);
    render();
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
      const next = local;
      local = null;
      setCapability(device, targetId, next, refresh);
    }, 600);
  }

  // Dragging along the ring sets the target; in the opening at the bottom it sticks to the nearer end.
  const pointOf = (event) => {
    const rect = svg.getBoundingClientRect();
    return [((event.clientX - rect.left) / rect.width) * 400 - 200, ((event.clientY - rect.top) / rect.height) * 400 - 200];
  };
  const valueAt = (event) => {
    const [x, y] = pointOf(event);
    const turned = (Math.atan2(y, x) - DIAL_START + Math.PI * 4) % (Math.PI * 2);
    const position = turned <= DIAL_SWEEP ? turned / DIAL_SWEEP : (turned > DIAL_SWEEP + Math.PI / 4 ? 0 : 1);
    return min + position * (max - min);
  };
  svg.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.dial-step')) return;
    const [x, y] = pointOf(event);
    if (Math.hypot(x, y) < 100) return;
    svg.setPointerCapture(event.pointerId);
    preview(valueAt(event));
    const move = (moveEvent) => preview(valueAt(moveEvent));
    const end = () => {
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', end);
      svg.removeEventListener('pointercancel', end);
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  });

  render();
  return {
    update: () => {
      if (local == null) render();
    },
    dispose: () => clearTimeout(sendTimer),
  };
}

const SHEET_PANELS = {
  thermostat: thermostatPanel,

  toggle(body, device, component, refresh) {
    const capabilityId = component.capabilities[0];
    if (capabilityId === 'locked') return lockPanel(body, device, capabilityId, refresh);
    const capability = device.capabilitiesObj[capabilityId];
    const button = el('button', 'big-toggle');
    button.type = 'button';
    button.setAttribute('aria-label', capability.title ?? 'Power');
    button.append(maskIcon(CONTROL_ICONS.power));
    button.addEventListener('click', () => {
      pulse(button);
      // Write-only switches can only be pressed, not toggled.
      setCapability(device, capabilityId, capability.getable === false ? true : !capability.value, refresh);
    });
    body.append(button);

    const update = () => {
      button.classList.toggle('is-on', capability.value === true);
      button.setAttribute('aria-pressed', String(capability.value === true));
      button.disabled = device.available === false;
    };
    update();
    return { update };
  },

  ternary(body, device, component, refresh) {
    const capabilityId = component.capabilities[0];
    const capability = device.capabilitiesObj[capabilityId];
    const values = capability.values?.length ? capability.values : [{ id: 'up' }, { id: 'idle' }, { id: 'down' }];
    const column = el('div', 'ternary');
    const buttons = values.map(({ id, title }) => {
      const button = el('button');
      button.type = 'button';
      button.setAttribute('aria-label', title ?? id);
      button.append(maskIcon(CONTROL_ICONS.ternary[id] ?? CONTROL_ICONS.ternary.idle));
      button.addEventListener('click', () => {
        pulse(button);
        setCapability(device, capabilityId, id, refresh);
      });
      column.append(button);
      return { button, id };
    });
    body.append(column);

    const update = () => {
      for (const { button, id } of buttons) {
        button.setAttribute('aria-pressed', String(capability.value === id));
        button.disabled = device.available === false;
      }
    };
    update();
    return { update };
  },

  slider(body, device, component, refresh) {
    const capabilityId = component.capabilities[0];
    const capability = device.capabilitiesObj[capabilityId];
    const min = capability.min ?? 0;
    const max = capability.max ?? 1;
    const step = capability.step ?? (max - min) / 100;
    const icons = sliderIcons(capabilityId, device);
    const isVolume = capabilityId.startsWith('volume_set');

    const wrap = el('div', 'vslider-wrap');
    const iconButton = (url, label) => {
      const button = el('button', 'vslider-end');
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.append(maskIcon(url));
      return button;
    };
    const upper = iconButton(icons.upper, isVolume ? 'Louder' : 'Maximum');
    const lower = iconButton(icons.lower, isVolume ? 'Quieter' : 'Minimum');
    const track = el('div', 'vslider');
    track.tabIndex = 0;
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', capability.title ?? 'Level');
    track.setAttribute('aria-orientation', 'vertical');
    track.setAttribute('aria-valuemin', String(min));
    track.setAttribute('aria-valuemax', String(max));
    const fill = el('div', 'vslider-fill');
    const output = el('div', 'vslider-output');
    track.append(fill, output);
    wrap.append(upper, track, lower);
    body.append(wrap);

    const fraction = (value) => (clamp(value, min, max) - min) / (max - min || 1);
    const format = (value) => (capability.units === '%' || (min === 0 && max === 1)
      ? `${Math.round(fraction(value) * 100)}%`
      : `${Number(value.toFixed(Math.min(capability.decimals ?? 1, 2)))}${capability.units ? ` ${capability.units}` : ''}`);
    const snap = (value) => Number(clamp(Math.round((value - min) / step) * step + min, min, max).toFixed(6));

    let local = null;
    let sendTimer = null;
    const render = (value) => {
      const shown = value ?? min;
      track.style.setProperty('--value', fraction(shown));
      output.textContent = format(shown);
      track.setAttribute('aria-valuenow', String(shown));
      track.setAttribute('aria-valuetext', format(shown));
    };
    const send = (value) => {
      clearTimeout(sendTimer);
      local = null;
      setCapability(device, capabilityId, value, refresh);
    };
    // Like the web app: follow the pointer locally and send once the value settles for half a second.
    const preview = (value) => {
      local = value;
      render(value);
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => send(value), 500);
    };
    const valueAt = (clientY) => {
      const rect = track.getBoundingClientRect();
      return snap(min + clamp(1 - (clientY - rect.top - 8) / (rect.height - 16), 0, 1) * (max - min));
    };

    track.addEventListener('pointerdown', (event) => {
      track.setPointerCapture(event.pointerId);
      track.classList.add('is-dragging');
      preview(valueAt(event.clientY));
    });
    track.addEventListener('pointermove', (event) => {
      if (track.classList.contains('is-dragging')) preview(valueAt(event.clientY));
    });
    const endDrag = () => track.classList.remove('is-dragging');
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('keydown', (event) => {
      const current = local ?? capability.value ?? min;
      const keyStep = Math.max(step, (max - min) / 20);
      const next = {
        ArrowUp: current + keyStep,
        ArrowRight: current + keyStep,
        ArrowDown: current - keyStep,
        ArrowLeft: current - keyStep,
        PageUp: current + keyStep * 4,
        PageDown: current - keyStep * 4,
        Home: min,
        End: max,
      }[event.key];
      if (next == null) return;
      event.preventDefault();
      preview(snap(next));
    });
    upper.addEventListener('click', () => send(isVolume ? snap((local ?? capability.value ?? 0) + step) : max));
    lower.addEventListener('click', () => send(isVolume ? snap((local ?? capability.value ?? 0) - step) : min));

    const update = () => {
      if (local == null) render(capability.value);
      track.toggleAttribute('aria-disabled', device.available === false);
    };
    update();
    return { update };
  },

  color(body, device, _component, refresh) {
    const capabilities = device.capabilitiesObj;
    const modes = [];
    if (capabilities.light_hue && capabilities.light_saturation) modes.push('color');
    if (capabilities.light_temperature) modes.push('temperature');

    let modeOverride = null;
    let showWheel = false;
    let depth = 0;
    let shades = [];
    let selected = null;
    let view = null;
    const currentMode = () => modeOverride ?? lightMode(device);
    let renderedMode = currentMode();

    const panel = el('div', 'color-panel');
    const stage = el('div', 'color-stage');
    const modeRow = el('div', 'mode-row');
    panel.append(stage, modeRow);
    body.append(panel);

    const applyHex = (hex) => {
      const { hue, saturation } = hexToHsv(hex);
      setCapability(device, 'light_hue', hue / 360, refresh);
      setCapability(device, 'light_saturation', saturation, refresh);
    };

    const renderPresets = (mode) => {
      const colors = depth === 1 ? shades : COLOR_PRESETS[mode];
      const center = el('div', 'preset-current');
      const paintCenter = () => {
        center.style.background = selected ?? lightHex(device, mode) ?? '#ffffff';
      };
      paintCenter();
      stage.append(center);

      const bubbles = colors.map((color, index) => {
        const angle = ((360 / 8) * (depth === 1 ? index - 1 : index - 2) * Math.PI) / 180;
        const bubble = el('button', 'preset');
        bubble.type = 'button';
        bubble.style.background = color;
        bubble.setAttribute('aria-label', `Preset ${color}`);
        bubble.style.setProperty('--x', `${Math.round(100 * Math.cos(angle))}px`);
        bubble.style.setProperty('--y', `${Math.round(100 * Math.sin(angle))}px`);
        bubble.addEventListener('click', () => {
          selected = color;
          if (mode === 'temperature') {
            setCapability(device, 'light_temperature', 1 - COLOR_PRESETS.temperature.indexOf(color) / 8, refresh);
            paintCenter();
            return;
          }
          applyHex(color);
          if (depth === 1) {
            paintCenter();
            return;
          }
          // A colour opens seven lighter shades of itself.
          shades = [];
          let shade = color;
          for (let step = 0; step < 7; step++) shades.push(shade = lighten(shade, 5));
          depth = 1;
          renderStage();
        });
        return bubble;
      });
      if (depth === 1) {
        const back = el('button', 'preset preset-back');
        back.type = 'button';
        back.setAttribute('aria-label', 'Back to all colours');
        back.innerHTML = BACK_ICON;
        back.style.setProperty('--x', '0px');
        back.style.setProperty('--y', '-100px');
        back.addEventListener('click', () => {
          depth = 0;
          renderStage();
        });
        bubbles.push(back);
      }
      stage.append(...bubbles);
      // Fly out from the centre on the next frame.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        for (const bubble of bubbles) bubble.classList.add('is-placed');
      }));
      return { update: () => { if (selected == null) paintCenter(); } };
    };

    const renderWheel = () => {
      const wheel = el('div', 'color-wheel');
      const selector = el('div', 'wheel-selector');
      wheel.append(selector);
      let dragging = false;
      let current = { hue: (capabilities.light_hue.value ?? 0) * 360, saturation: capabilities.light_saturation.value ?? 1 };
      const place = () => {
        const radians = (current.hue * Math.PI) / 180;
        selector.style.setProperty('--sx', `${Math.sin(radians) * current.saturation * 125}px`);
        selector.style.setProperty('--sy', `${-Math.cos(radians) * current.saturation * 125}px`);
        selector.style.background = `hsl(${current.hue} 100% ${100 - current.saturation * 50}%)`;
      };
      const follow = (event) => {
        const rect = wheel.getBoundingClientRect();
        const radius = rect.width / 2;
        const x = event.clientX - rect.left - radius;
        const y = event.clientY - rect.top - radius;
        current = {
          hue: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360,
          saturation: Math.min(Math.hypot(x, y) / radius, 1),
        };
        place();
      };
      wheel.addEventListener('pointerdown', (event) => {
        wheel.setPointerCapture(event.pointerId);
        dragging = true;
        follow(event);
      });
      wheel.addEventListener('pointermove', (event) => {
        if (dragging) follow(event);
      });
      wheel.addEventListener('pointerup', () => {
        dragging = false;
        setCapability(device, 'light_hue', current.hue / 360, refresh);
        setCapability(device, 'light_saturation', current.saturation, refresh);
      });
      place();
      stage.append(wheel);
      return {
        update: () => {
          if (dragging) return;
          current = { hue: (capabilities.light_hue.value ?? 0) * 360, saturation: capabilities.light_saturation.value ?? 1 };
          place();
        },
      };
    };

    const renderTemperatureDisc = () => {
      const disc = el('div', 'temperature-disc');
      const selector = el('div', 'wheel-selector');
      disc.append(selector);
      let dragging = false;
      let x = 0;
      let current = capabilities.light_temperature.value ?? 0.5;
      const place = () => {
        selector.style.setProperty('--sx', `${x}px`);
        selector.style.setProperty('--sy', `${(current - 0.5) * 250}px`);
        selector.style.background = temperatureSelectorColor(current);
      };
      const follow = (event) => {
        const rect = disc.getBoundingClientRect();
        const radius = rect.width / 2;
        let px = event.clientX - rect.left - radius;
        let py = event.clientY - rect.top - radius;
        const distance = Math.hypot(px, py);
        if (distance > radius) {
          px = (px / distance) * radius;
          py = (py / distance) * radius;
        }
        x = px;
        current = (py + radius) / (radius * 2);
        place();
      };
      disc.addEventListener('pointerdown', (event) => {
        disc.setPointerCapture(event.pointerId);
        dragging = true;
        follow(event);
      });
      disc.addEventListener('pointermove', (event) => {
        if (dragging) follow(event);
      });
      disc.addEventListener('pointerup', () => {
        dragging = false;
        setCapability(device, 'light_temperature', current, refresh);
      });
      place();
      stage.append(disc);
      return {
        update: () => {
          if (dragging) return;
          current = capabilities.light_temperature.value ?? 0.5;
          place();
        },
      };
    };

    function renderStage() {
      stage.replaceChildren();
      const mode = currentMode();
      if (!showWheel) view = renderPresets(mode);
      else view = mode === 'color' ? renderWheel() : renderTemperatureDisc();
    }

    function renderModes() {
      modeRow.replaceChildren(...modes.map((mode) => {
        const button = el('button', `mode-button mode-${mode}`);
        button.type = 'button';
        button.setAttribute('aria-label', mode === 'color' ? 'Colour' : 'White temperature');
        button.setAttribute('aria-pressed', String(mode === currentMode()));
        button.addEventListener('click', () => {
          // The active mode switches between presets and the wheel; the other mode changes the light.
          if (mode === currentMode()) {
            showWheel = !showWheel;
          } else if (capabilities.light_mode) {
            modeOverride = null;
            setCapability(device, 'light_mode', mode, refresh);
          } else {
            modeOverride = mode;
          }
          depth = 0;
          selected = null;
          renderedMode = currentMode();
          renderStage();
          renderModes();
        });
        return button;
      }));
    }

    renderStage();
    renderModes();
    return {
      update: () => {
        if (currentMode() !== renderedMode) {
          renderedMode = currentMode();
          depth = 0;
          selected = null;
          renderStage();
          renderModes();
          return;
        }
        view?.update();
      },
    };
  },
};
