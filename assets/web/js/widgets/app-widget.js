// App widgets: the app's own HTML in an iframe.

import { widgetHosts } from '../crossframe-host.js';
import { requireData } from '../data.js';
import { el, note } from '../dom.js';
import { state } from '../state.js';

export function mountAppWidget({ widget, section, body, setTitle }) {
  if (!requireData(body, 'appWidgets')) return;
  const definition = state.data.appWidgets[widget.data?.appWidgetId];
  if (definition == null) {
    note(body, 'The app for this widget is not running or no longer installed.');
    return;
  }
  setTitle(definition.name);
  section.classList.add('is-loading');
  if (definition.transparent === true) section.classList.add('is-transparent');

  const defaults = Object.fromEntries((definition.settings ?? []).map((setting) => [setting.id, setting.value ?? null]));
  const appId = definition.ownerUri.replace(/^homey:app:/, '');

  const frame = el('div', 'app-frame');
  const iframe = el('iframe', 'widget-frame');
  iframe.title = definition.name;
  iframe.style.height = `${definition.height ?? 200}px`;
  // Served by the Homey app, this page shares Homey's origin with every app's widgets. Without
  // allow-same-origin the widget runs in its own opaque origin, so it can't read the API key this page stores.
  // Set before src, so the first load is already sandboxed.
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox');
  iframe.src = `${state.client.base}/app/${encodeURIComponent(appId)}/widgets/${encodeURIComponent(definition.ownerId)}/index.html?widgetInstanceId=${encodeURIComponent(widget.id)}`;
  frame.append(iframe);
  body.append(frame);

  const host = {
    iframe,
    appId,
    widgetId: definition.ownerId,
    instanceId: widget.id,
    settings: { ...defaults, ...(widget.data.settings ?? {}) },
    deviceIds: widget.data.deviceIds ?? [],
    transparent: definition.transparent === true,
    cleanups: [],
    onReady: () => {
      clearTimeout(revealTimer);
      section.classList.remove('is-loading');
    },
  };
  // Reveal anyway if a widget never calls Homey.ready().
  const revealTimer = setTimeout(host.onReady, 8000);

  // Register before the frame loads: the widget asks for its initial data immediately.
  const frameWindow = iframe.contentWindow;
  widgetHosts.set(frameWindow, host);

  return () => {
    clearTimeout(revealTimer);
    for (const cleanup of host.cleanups) cleanup();
    widgetHosts.delete(frameWindow);
  };
}
