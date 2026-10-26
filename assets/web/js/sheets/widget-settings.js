// A widget's settings, opened from edit mode (edit-mode.js) and laid out like the Homey app's: the widget's preview,
// Show Title and its title, the devices an app widget shows, the app widget's own settings as its app declares them
// (https://apps.developer.homey.app/the-basics/widgets/settings) and how it runs here (widget-modes.js). Each setting
// opens a page of its own. The ✓ saves everything to the dashboard on the Homey; closing otherwise drops the changes.
// The Homey app defines the built-in widgets' other settings itself, so those are only changed there.

import { NO_EDIT_PERMISSION, canEditDashboards, locateWidget, updateDashboard } from '../dashboard-save.js';
import { loadData } from '../data.js';
import { deviceIcon } from '../devices.js';
import { el, toast } from '../dom.js';
import {
  CHECK_ICON, CHEVRON_LEFT, CHEVRON_RIGHT, CLOSE_ICON, DRAG_ICON, PENCIL_ICON, PLUS_CIRCLE_ICON, SEARCH_ICON,
} from '../icons.js';
import { state } from '../state.js';
import { WIDGET_MODES, canChooseWidgetMode, saveWidgetMode, widgetMode } from '../widget-modes.js';
import { zoneIcon, zoneOrder } from '../zones.js';

const MODES = {
  sandboxed: {
    title: 'Sandboxed',
    hint: "Runs sealed off from this page, so it can't read the API key. It has no storage, which some widgets need "
      + 'to work.',
  },
  storage: {
    title: 'Sandboxed with storage',
    hint: 'Still sealed off, with storage this page keeps for the app. Its address reads about:srcdoc, which a few '
      + "widgets don't expect.",
  },
  trusted: {
    title: 'Trusted',
    hint: 'Runs as in the Homey app, not sealed off. It can read the API key every paired browser uses, so only choose '
      + 'this for an app you trust.',
  },
};

// The collections the pages need that the dashboard may not have loaded.
async function ensureData(keys) {
  const missing = keys.filter((key) => state.data[key] == null);
  if (missing.length === 0) return;
  const { data } = await loadData(missing);
  Object.assign(state.data, data);
}

const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// name: what the widget is called on the board.
export async function openWidgetSettings(dashboardId, widget, name) {
  const isApp = widget.type === 'app_webview';
  let definition = null;
  if (isApp) {
    await ensureData(['appWidgets']).catch(() => {});
    definition = state.data.appWidgets?.[widget.data?.appWidgetId] ?? null;
  }
  const appId = definition?.ownerUri?.replace(/^homey:app:/, '');
  if (definition?.devices) await ensureData(['devices', 'zones']).catch(() => {});

  const saved = widget.data?.settings ?? {};
  const savedDevices = widget.data?.deviceIds ?? [];
  const automaticTitle = definition?.name ?? (widget.titleModified ? null : widget.title) ?? name ?? '';
  const draft = {
    titleHidden: widget.titleHidden === true,
    title: widget.title ?? '',
    settings: { ...saved },
    deviceIds: [...savedDevices],
    mode: widgetMode(widget.id),
  };
  // A setting's value: what was chosen, else the app's default.
  const valueOf = (setting) => (setting.id in draft.settings ? draft.settings[setting.id] : (setting.value ?? null));
  const allSettings = () => Object.fromEntries((definition?.settings ?? []).map((setting) => [setting.id, valueOf(setting)]));

  document.querySelector('dialog.widget-settings')?.close();
  const dialog = el('dialog', 'widget-settings');
  const header = el('div', 'ws-header');
  const nav = el('button', 'sheet-close');
  nav.type = 'button';
  const title = el('h2', 'ws-title');
  const action = el('button', 'ws-action');
  action.type = 'button';
  action.innerHTML = CHECK_ICON;
  header.append(nav, title, action);
  const content = el('div', 'ws-content');
  dialog.append(header, content);

  // Pages: { title, action?, actionLabel?, render(root, page) }. The first is the widget's own; the rest open from it.
  const pages = [];
  const show = () => {
    const page = pages.at(-1);
    content.replaceChildren();
    content.scrollTop = 0;
    nav.innerHTML = pages.length > 1 ? CHEVRON_LEFT : CLOSE_ICON;
    nav.setAttribute('aria-label', pages.length > 1 ? 'Back' : 'Close');
    title.textContent = page.title;
    action.hidden = page.action == null;
    action.setAttribute('aria-label', page.actionLabel ?? 'Save');
    page.render(content, page);
  };
  const open = (page) => {
    pages.push(page);
    show();
  };
  const back = () => {
    pages.pop();
    show();
  };
  nav.addEventListener('click', () => (pages.length > 1 ? back() : dialog.close()));
  action.addEventListener('click', () => pages.at(-1).action?.());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());

  // ----- Building blocks -----

  const section = (root, heading) => {
    if (heading) root.append(el('h3', 'ws-section', heading));
    const group = el('div', 'ws-group');
    root.append(group);
    return group;
  };
  const hint = (root, text) => {
    if (text) root.append(el('p', 'ws-hint', text));
  };
  const rowButton = (group, label, value, onClick) => {
    const row = el('button', 'ws-row');
    row.type = 'button';
    row.append(el('span', 'ws-label', label), el('span', 'ws-value', value ?? ''));
    row.insertAdjacentHTML('beforeend', CHEVRON_RIGHT);
    row.addEventListener('click', onClick);
    group.append(row);
    return row;
  };
  const switchRow = (group, label, checked, onChange) => {
    const row = el('div', 'ws-row');
    const toggle = el('button', 'switch');
    toggle.type = 'button';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', String(checked));
    toggle.setAttribute('aria-label', label);
    toggle.addEventListener('click', () => {
      const next = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(next));
      onChange(next);
    });
    row.append(el('span', 'ws-label', label), toggle);
    group.append(row);
    return row;
  };

  // ----- The widget's own page -----

  const shownValue = (setting) => {
    const value = valueOf(setting);
    switch (setting.type) {
      case 'checkbox': return value ? 'Yes' : 'No';
      case 'dropdown': return setting.values?.find((choice) => choice.id === value)?.title ?? '';
      case 'autocomplete': return value?.name ?? 'None';
      case 'number': return value == null || value === '' ? '' : `${value}${setting.units ? ` ${setting.units}` : ''}`;
      default: return value == null ? '' : String(value);
    }
  };

  const renderTitleRows = (group) => {
    switchRow(group, 'Show Title', !draft.titleHidden, (on) => {
      draft.titleHidden = !on;
      show();
    });
    if (draft.titleHidden) return;
    // The title is edited in place, like in the app.
    const row = el('div', 'ws-row');
    const edit = el('button', 'ws-title-edit');
    edit.type = 'button';
    edit.append(el('span', 'ws-value', draft.title || automaticTitle));
    edit.insertAdjacentHTML('beforeend', PENCIL_ICON);
    edit.setAttribute('aria-label', 'Rename');
    edit.addEventListener('click', () => {
      const input = el('input', 'ws-inline-input');
      input.value = draft.title || automaticTitle;
      input.setAttribute('aria-label', 'Title');
      // Enter redraws the page, which takes the input away and so blurs it: only the first of the two counts.
      let done = false;
      const finish = (keep) => {
        if (done) return;
        done = true;
        if (keep) draft.title = input.value.trim();
        show();
      };
      const commit = () => finish(true);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') finish(false);
      });
      input.addEventListener('blur', commit);
      edit.replaceWith(input);
      input.focus();
      input.select();
    });
    row.append(el('span', 'ws-label', 'Title'), edit);
    group.append(row);
  };

  const renderDevices = (group) => {
    const devices = state.data.devices ?? {};
    // One device: a row that opens the picker, as in the app.
    if (definition.devices.singular === true && draft.deviceIds.length > 0) {
      const device = devices[draft.deviceIds[0]];
      const row = el('button', 'ws-row');
      row.type = 'button';
      const icon = el('span', 'ws-device-icon');
      if (device) icon.append(deviceIcon(device, 'ws-device-glyph'));
      row.append(icon, el('span', 'ws-label', device?.name ?? 'Unknown device'));
      row.insertAdjacentHTML('beforeend', CHEVRON_RIGHT);
      row.addEventListener('click', () => open(devicesPage()));
      group.append(row);
      return;
    }
    for (const id of draft.deviceIds) {
      const device = devices[id];
      const row = el('div', 'ws-row ws-device');
      row.dataset.id = id;
      const handle = el('span', 'ws-drag');
      handle.innerHTML = DRAG_ICON;
      handle.setAttribute('aria-hidden', 'true');
      const icon = el('span', 'ws-device-icon');
      if (device) icon.append(deviceIcon(device, 'ws-device-glyph'));
      const remove = el('button', 'ws-remove');
      remove.type = 'button';
      remove.innerHTML = CLOSE_ICON;
      remove.setAttribute('aria-label', `Remove ${device?.name ?? 'device'}`);
      remove.addEventListener('click', () => {
        draft.deviceIds = draft.deviceIds.filter((other) => other !== id);
        show();
      });
      row.append(handle, icon, el('span', 'ws-label', device?.name ?? 'Unknown device'), remove);
      group.append(row);
      dragToReorder(group, row, handle);
    }
    const add = el('button', 'ws-row ws-add');
    add.type = 'button';
    add.innerHTML = PLUS_CIRCLE_ICON;
    add.append(el('span', null, definition.devices.singular ? 'Select Device' : 'Select Devices'));
    add.addEventListener('click', () => open(devicesPage()));
    group.append(add);
  };

  // Rows follow the pointer while the handle is held; the order is taken when it is let go. Followed on the document:
  // moving the row in the page ends a pointer capture on its handle.
  const dragToReorder = (group, row, handle) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      row.classList.add('is-dragging');
      const follow = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const others = [...group.querySelectorAll('.ws-device')].filter((other) => other !== row);
        const before = others.find((other) => {
          const box = other.getBoundingClientRect();
          return moveEvent.clientY < box.top + box.height / 2;
        }) ?? group.querySelector('.ws-add');
        if (row.nextSibling !== before) group.insertBefore(row, before);
      };
      const release = (upEvent) => {
        if (upEvent.pointerId !== event.pointerId) return;
        document.removeEventListener('pointermove', follow);
        document.removeEventListener('pointerup', release);
        document.removeEventListener('pointercancel', release);
        row.classList.remove('is-dragging');
        draft.deviceIds = [...group.querySelectorAll('.ws-device')].map((other) => other.dataset.id);
      };
      document.addEventListener('pointermove', follow);
      document.addEventListener('pointerup', release);
      document.addEventListener('pointercancel', release);
    });
  };

  const renderMain = (root) => {
    if (!canEditDashboards()) root.append(el('p', 'ws-banner', NO_EDIT_PERMISSION));
    if (definition) {
      const preview = el('div', 'ws-preview');
      const image = el('img');
      image.alt = '';
      image.src = `${state.client.base}/app/${encodeURIComponent(appId)}/widgets/${encodeURIComponent(definition.ownerId)}/preview-dark.png`;
      image.addEventListener('error', () => preview.classList.add('is-empty'));
      preview.append(image);
      root.append(preview);
    }
    renderTitleRows(section(root, 'Settings'));
    if (isApp && definition == null) {
      hint(root, "The app for this widget isn't running, so its own settings can't be changed now.");
    } else if (!isApp) {
      hint(root, "This widget's other settings can be changed in the Homey app.");
    }
    if (definition?.devices) renderDevices(section(root, definition.devices.singular ? 'Device' : 'Devices'));
    if (definition?.settings?.length) {
      const group = section(root, 'Custom');
      for (const setting of definition.settings) {
        rowButton(group, setting.title, shownValue(setting), () => open(settingPage(setting)));
      }
    }
    if (definition && canChooseWidgetMode()) {
      const group = section(root, 'Web dashboard');
      rowButton(group, 'Runs', MODES[draft.mode].title, () => open(modePage()));
    }
  };

  // ----- A page per setting -----

  const set = (setting, value) => {
    draft.settings[setting.id] = value;
  };

  const settingPage = (setting) => {
    const units = setting.type === 'number' && setting.units && !setting.title.includes(`(${setting.units})`)
      ? ` (${setting.units})` : '';
    return {
      title: `${setting.title.trim()}${units}`,
      render: (root) => {
        if (SETTING_PAGES[setting.type]) SETTING_PAGES[setting.type](root, setting);
        else hint(root, `Settings of the type "${setting.type}" can only be changed in the Homey app.`);
      },
    };
  };

  const textInput = (root, setting, multiline) => {
    const group = section(root);
    const input = el(multiline ? 'textarea' : 'input', 'ws-input');
    input.value = valueOf(setting) ?? '';
    if (setting.placeholder) input.placeholder = setting.placeholder;
    input.setAttribute('aria-label', setting.title);
    const pattern = setting.pattern ? new RegExp(`^(?:${setting.pattern})$`) : null;
    input.addEventListener('input', () => {
      const valid = pattern == null || input.value === '' || pattern.test(input.value);
      input.toggleAttribute('aria-invalid', !valid);
      if (valid) set(setting, input.value === '' ? null : input.value);
    });
    group.append(input);
    hint(root, setting.hint);
    input.focus();
    input.select?.();
  };

  const SETTING_PAGES = {
    dropdown: (root, setting) => {
      const group = section(root);
      for (const choice of setting.values ?? []) {
        const row = el('button', 'ws-row ws-choice');
        row.type = 'button';
        row.append(el('span', 'ws-label', choice.title));
        if (choice.id === valueOf(setting)) row.insertAdjacentHTML('beforeend', CHECK_ICON);
        row.setAttribute('aria-pressed', String(choice.id === valueOf(setting)));
        row.addEventListener('click', () => {
          set(setting, choice.id);
          back();
        });
        group.append(row);
      }
      hint(root, setting.hint);
    },
    checkbox: (root, setting) => {
      switchRow(section(root), setting.title.trim(), valueOf(setting) === true, (on) => set(setting, on));
      hint(root, setting.hint);
    },
    text: (root, setting) => textInput(root, setting, false),
    textarea: (root, setting) => textInput(root, setting, true),
    number: (root, setting) => {
      const group = section(root);
      const input = el('input', 'ws-input');
      input.type = 'number';
      input.inputMode = 'decimal';
      input.step = setting.step ?? 'any';
      if (setting.min != null) input.min = setting.min;
      if (setting.max != null) input.max = setting.max;
      if (setting.placeholder) input.placeholder = setting.placeholder;
      input.value = valueOf(setting) ?? '';
      input.setAttribute('aria-label', setting.title);
      input.addEventListener('input', () => {
        const number = input.value === '' ? null : Number(input.value);
        const valid = number == null || (Number.isFinite(number) && (setting.min == null || number >= setting.min)
          && (setting.max == null || number <= setting.max));
        input.toggleAttribute('aria-invalid', !valid);
        if (valid) set(setting, number);
      });
      group.append(input);
      hint(root, setting.hint);
      input.focus();
      input.select();
    },
    autocomplete: (root, setting) => {
      const group = section(root);
      const search = el('label', 'ws-search');
      search.innerHTML = SEARCH_ICON;
      const input = el('input');
      input.type = 'search';
      input.placeholder = 'Search…';
      input.setAttribute('aria-label', `Search ${setting.title}`);
      search.append(input);
      const list = el('div', 'ws-results');
      group.append(search, list);
      hint(root, setting.hint);

      const choose = (item) => {
        set(setting, item);
        back();
      };
      const resultRow = (item) => {
        const row = el('button', 'ws-row ws-result');
        row.type = 'button';
        if (item.image) {
          const image = el('img', 'ws-result-image');
          image.alt = '';
          image.src = item.image;
          row.append(image);
        }
        row.append(el('span', 'ws-label', item.name ?? ''), el('span', 'ws-value', item.description ?? ''));
        row.insertAdjacentHTML('beforeend', CHEVRON_RIGHT);
        row.addEventListener('click', () => choose(item));
        return row;
      };
      // The app's own suggestions (a "None" too, if it offers one), for what's typed and the other settings as they
      // are now.
      let latest = 0;
      const lookup = async () => {
        const request = ++latest;
        const query = new URLSearchParams({ settingId: setting.id, query: input.value, settings: JSON.stringify(allSettings()) });
        try {
          const items = await state.client.api('GET', `/api/manager/dashboards/appwidget/${encodeURIComponent(definition.id)}/autocomplete?${query}`);
          if (request !== latest) return;
          const rows = (Array.isArray(items) ? items : []).filter((item) => item && typeof item === 'object').map(resultRow);
          list.replaceChildren(...(rows.length ? rows : [el('p', 'ws-hint', 'Nothing found.')]));
        } catch (error) {
          if (request !== latest) return;
          list.replaceChildren(el('p', 'ws-hint', `The app couldn't list choices: ${error.message}`));
        }
      };
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(lookup, 250);
      });
      lookup();
      input.focus();
    },
  };

  // ----- Devices -----

  // The devices the widget may show: its app's own, or any; narrowed by class and capabilities, where "a|b" is
  // either and "a,b" both.
  const candidates = () => {
    const { type, filter = {} } = definition.devices;
    const classes = filter.class ? filter.class.split('|').map((name) => name.trim()) : null;
    const capabilities = filter.capabilities ? filter.capabilities.split('|').map((group) => group.split(',').map((name) => name.trim())) : null;
    return Object.values(state.data.devices ?? {}).filter((device) => (type === 'global' || device.ownerUri === definition.ownerUri)
      && (classes == null || classes.includes(device.class) || classes.includes(device.virtualClass))
      && (capabilities == null || capabilities.some((group) => group.every((name) => device.capabilities?.includes(name)))));
  };

  const devicesPage = () => {
    const single = definition.devices.singular === true;
    const chosen = new Set(draft.deviceIds);
    let query = '';
    const page = {
      title: '',
      actionLabel: 'Done',
      action: () => {
        // Kept devices stay in their order; new ones go at the end.
        draft.deviceIds = [...draft.deviceIds.filter((id) => chosen.has(id)), ...[...chosen].filter((id) => !draft.deviceIds.includes(id))];
        back();
      },
      render: (root) => {
        const heading = el('h2', 'ws-picker-title');
        const lead = el('p', 'ws-picker-lead', single ? 'The selected device appears in your widget.' : 'Selected devices appear in your widget.');
        const search = el('label', 'ws-search');
        search.innerHTML = SEARCH_ICON;
        const input = el('input');
        input.type = 'search';
        input.placeholder = 'Search…';
        input.value = query;
        input.setAttribute('aria-label', 'Search devices');
        search.append(input);
        const groups = el('div', 'ws-zones');
        root.append(heading, lead, search, groups);

        const devices = candidates();
        const updateHeading = () => {
          heading.textContent = single ? 'Select Device' : (chosen.size > 0 ? `${chosen.size} Selected` : 'Select Devices');
        };
        const draw = () => {
          groups.replaceChildren();
          const needle = query.trim().toLowerCase();
          const roots = Object.values(state.data.zones ?? {}).filter((zone) => zone.parent == null);
          const zones = roots.flatMap((zone) => zoneOrder(zone.id));
          const shown = devices.filter((device) => !needle || device.name.toLowerCase().includes(needle));
          for (const zone of zones) {
            const inZone = shown.filter((device) => device.zone === zone.id).sort((a, b) => a.name.localeCompare(b.name));
            if (inZone.length === 0) continue;
            const head = el('div', 'ws-zone');
            head.append(zoneIcon(zone, true), el('span', 'ws-zone-name', zone.name));
            if (!single) {
              const all = el('button', 'ws-select-all', 'Select All');
              all.type = 'button';
              all.addEventListener('click', () => {
                const every = inZone.every((device) => chosen.has(device.id));
                for (const device of inZone) {
                  if (every) chosen.delete(device.id);
                  else chosen.add(device.id);
                }
                draw();
              });
              head.append(all);
            }
            const grid = el('div', 'ws-tiles');
            for (const device of inZone) {
              const tile = el('button', single ? 'ws-tile is-single' : 'ws-tile');
              tile.type = 'button';
              tile.setAttribute('aria-pressed', String(chosen.has(device.id)));
              const box = el('span', 'ws-check');
              box.innerHTML = CHECK_ICON;
              tile.append(deviceIcon(device, 'ws-tile-icon'), box, el('span', 'ws-tile-name', device.name));
              tile.addEventListener('click', () => {
                if (chosen.has(device.id)) chosen.delete(device.id);
                else {
                  if (single) chosen.clear();
                  chosen.add(device.id);
                }
                draw();
              });
              grid.append(tile);
            }
            groups.append(head, grid);
          }
          if (groups.childElementCount === 0) groups.append(el('p', 'ws-hint', devices.length ? 'No devices match.' : 'No devices fit this widget.'));
          updateHeading();
        };
        input.addEventListener('input', () => {
          query = input.value;
          draw();
        });
        draw();
      },
    };
    return page;
  };

  // ----- How it runs here -----

  const modePage = () => ({
    title: 'Runs',
    render: (root) => {
      const group = section(root);
      for (const mode of WIDGET_MODES) {
        const row = el('button', 'ws-row ws-choice');
        row.type = 'button';
        row.append(el('span', 'ws-label', MODES[mode].title));
        if (mode === draft.mode) row.insertAdjacentHTML('beforeend', CHECK_ICON);
        row.setAttribute('aria-pressed', String(mode === draft.mode));
        row.addEventListener('click', () => {
          draft.mode = mode;
          show();
        });
        group.append(row);
      }
      for (const mode of WIDGET_MODES) {
        const text = el('p', mode === 'trusted' ? 'ws-hint is-warning' : 'ws-hint');
        text.append(el('strong', null, `${MODES[mode].title}: `), MODES[mode].hint);
        root.append(text);
      }
    },
  });

  // ----- Saving -----

  const save = async () => {
    const title = draft.title.trim();
    const titleChanged = draft.titleHidden !== (widget.titleHidden === true) || title !== (widget.title ?? '');
    const changed = Object.keys(draft.settings).filter((id) => !sameValue(draft.settings[id], saved[id]));
    const devicesChanged = !sameValue(draft.deviceIds, savedDevices);
    const modeChanged = draft.mode !== widgetMode(widget.id);
    action.disabled = true;
    try {
      if (titleChanged || changed.length > 0 || devicesChanged) {
        await updateDashboard(dashboardId, (columns) => {
          const target = locateWidget(columns, widget.id).widget;
          target.titleHidden = draft.titleHidden;
          if (title !== (widget.title ?? '')) {
            // Cleared, it goes back to the name it gets by itself.
            target.title = title || (definition?.name ?? null);
            target.titleModified = title !== '';
          }
          target.data ??= {};
          if (changed.length > 0) {
            target.data.settings = { ...(target.data.settings ?? {}), ...Object.fromEntries(changed.map((id) => [id, draft.settings[id]])) };
          }
          if (devicesChanged) target.data.deviceIds = draft.deviceIds;
        });
      }
      if (modeChanged) await saveWidgetMode(widget.id, draft.mode);
      dialog.close();
    } catch (error) {
      toast(error.message);
    } finally {
      action.disabled = false;
    }
  };

  document.body.append(dialog);
  open({ title: draft.title || automaticTitle, action: save, actionLabel: 'Save', render: renderMain });
  dialog.showModal();
}
