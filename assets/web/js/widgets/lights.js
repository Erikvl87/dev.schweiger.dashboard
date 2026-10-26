// Light and light group panels.

import { requireData } from '../data.js';
import { deviceIcon, setCapability, watchDevice } from '../devices.js';
import { el, note, paintSlider } from '../dom.js';
import { openDeviceSheet, sheetComponents } from '../sheets/device-sheet.js';
import { state } from '../state.js';
import { average } from '../zones.js';

// customName: the widget's own name for the lights ("Custom Name" in the app), if it has one.
export function mountLights(body, ids, customName = null) {
  if (!requireData(body, 'devices')) return;
  const devices = ids.map((id) => state.data.devices[id]).filter(Boolean);
  if (devices.length === 0) return note(body, 'These lights no longer exist.');

  // Without a name of its own, a group is named after its first light, like "Ecklampe +2" in the mobile app.
  const label = customName || (devices.length > 1 ? `${devices[0].name} +${devices.length - 1}` : devices[0].name);
  const panel = el('div', 'device-panel');
  const head = el('div', 'panel-head');
  const text = el('div', 'panel-text');
  const name = el('div', 'panel-name', label);
  name.title = devices.map((device) => device.name).join(', ');
  text.append(name);
  const toggle = el('button', 'switch');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  head.append(deviceIcon(devices[0], 'panel-icon'), text, toggle);
  panel.append(head);
  body.append(panel);
  if (devices.length === 1 && sheetComponents(devices[0]).length > 0) {
    head.classList.add('is-openable');
    head.addEventListener('click', (event) => {
      if (!event.target.closest('.switch')) openDeviceSheet(devices[0]);
    });
  }

  const switchable = devices.filter((device) => device.capabilitiesObj?.onoff?.setable);
  const dimmable = devices.filter((device) => device.capabilitiesObj?.dim?.setable);
  let slider = null;
  let dragging = false;
  if (dimmable.length > 0) {
    slider = el('input', 'slider');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.setAttribute('aria-label', `Brightness of ${label}`);
    panel.append(slider);
    slider.addEventListener('input', () => {
      dragging = true;
      paintSlider(slider);
    });
    slider.addEventListener('change', () => {
      dragging = false;
      const value = Number(slider.value) / 100;
      for (const device of dimmable) setCapability(device, 'dim', value, update);
    });
  }

  const isOn = () => switchable.some((device) => device.capabilitiesObj.onoff.value === true);

  function update() {
    const on = isOn();
    const unavailable = devices.every((device) => device.available === false);
    panel.classList.toggle('is-on', on);
    toggle.setAttribute('aria-checked', String(on));
    toggle.setAttribute('aria-label', `${on ? 'Turn off' : 'Turn on'} ${label}`);
    toggle.disabled = unavailable || switchable.length === 0;
    if (slider) {
      slider.disabled = unavailable;
      if (!dragging) {
        // A group shows the average dim level of its lights.
        const average = dimmable.reduce((sum, device) => sum + (device.capabilitiesObj.dim.value ?? 0), 0) / dimmable.length;
        slider.value = String(Math.round(average * 100));
        paintSlider(slider);
      }
    }
  }

  toggle.addEventListener('click', () => {
    const next = !isOn();
    for (const device of switchable) setCapability(device, 'onoff', next, update);
  });

  update();
  const cleanups = devices.map((device) => watchDevice(device, update));
  return () => cleanups.forEach((cleanup) => cleanup());
}
