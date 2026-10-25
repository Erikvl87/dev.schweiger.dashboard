// The parent side of Homey's CrossFrame protocol, so app widgets run in iframes like in the mobile app.

import { isDarkMode } from './dom.js';
import { subscribe } from './realtime.js';
import { state } from './state.js';

const CROSSFRAME_PREFIX = 'CF2_MESSAGE';

const NO_REPLY = Symbol('no-reply');

// Widget iframes keyed by their window, so CrossFrame messages can be routed to the right host.
export const widgetHosts = new Map();

const hexEncode = (text) => text.replace(/[\s\S]/g, (char) => char.charCodeAt(0).toString(16).padStart(4, '0'));

const hexDecode = (hex) => (hex.match(/.{1,4}/g) ?? []).map((unit) => String.fromCharCode(parseInt(unit, 16))).join('');

// Sandboxed widgets have an opaque origin that can't be named, so the reply targets the frame's window object itself.
function postToWidget(target, message) {
  // The frame is gone when the dashboard was re-rendered (switched, say) while the widget was still talking to us.
  if (target == null) return;
  target.postMessage(CROSSFRAME_PREFIX + hexEncode(JSON.stringify(message)), '*');
}

window.addEventListener('message', (event) => {
  if (typeof event.data !== 'string' || !event.data.startsWith(CROSSFRAME_PREFIX)) return;
  // Only windows of iframes this page created are answered; sandboxed frames report the origin "null".
  const host = widgetHosts.get(event.source);
  if (host == null) return;

  let message;
  try {
    message = JSON.parse(hexDecode(event.data.slice(CROSSFRAME_PREFIX.length)));
  } catch {
    return;
  }
  if (message.type !== 'tx') return;

  const reply = (error, result) => {
    if (message.callbackId == null || result === NO_REPLY) return;
    postToWidget(event.source, {
      type: 'cb',
      callbackId: message.callbackId,
      args: [error ? { type: 'Error', data: error.message ?? String(error) } : null, result ?? null],
    });
  };

  handleWidgetMessage(host, event.source, message).then(
    (result) => reply(null, result),
    (error) => reply(error),
  );
});

async function handleWidgetMessage(host, source, { event, data, callbackId }) {
  switch (event) {
    case 'getInitialData':
      return {
        settings: host.settings,
        deviceIds: host.deviceIds,
        transparent: host.transparent,
        locales: await getAppLocales(host.appId),
        language: state.system.language ?? 'en',
        devmode: false,
        fontScale: 1,
        isDarkMode: isDarkMode(),
      };
    case 'ready':
      applyWidgetHeight(host, data?.height);
      host.onReady();
      return null;
    case 'setHeight':
      applyWidgetHeight(host, data?.height);
      return null;
    case 'api': {
      const method = String(data?.method ?? 'GET').toUpperCase();
      const path = String(data?.path ?? '/');
      // A widget only reaches its own widget API. The URL is resolved first: dot segments ("..", "%2e%2e") in the
      // path would otherwise lead this page's API key to any other part of Homey's API.
      const base = new URL(`/api/app/${host.appId}/widget/${host.widgetId}/${host.instanceId}`, state.client.base);
      const url = new URL(base.pathname + (path.startsWith('/') ? path : `/${path}`), base);
      if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname}/`)) {
        throw new Error('Widgets can only call their own API');
      }
      return state.client.api(method, url.pathname + url.search, data?.body);
    }
    case 'registerRealtimeListener':
      // Every realtime event is delivered as a callback on the id of the registration message.
      host.cleanups.push(
        subscribe(`homey:app:${host.appId}`, data, (payload) => {
          postToWidget(source, { type: 'cb', callbackId, args: [payload] });
        }),
      );
      return NO_REPLY;
    case 'popup':
      if (data?.url) window.open(data.url, '_blank', 'noopener');
      return null;
    case 'shortPressHapticFeedback':
    case 'emit':
      return null;
    default:
      throw new Error(`Unsupported widget call: ${event}`);
  }
}

function applyWidgetHeight(host, height) {
  if (typeof height === 'string' && height.trim().endsWith('%')) {
    const percent = parseFloat(height);
    if (percent > 0) {
      host.iframe.style.height = 'auto';
      host.iframe.style.aspectRatio = `100 / ${percent}`;
    }
    return;
  }
  const pixels = Number(height);
  if (height != null && pixels > 0) {
    host.iframe.style.aspectRatio = '';
    host.iframe.style.height = `${pixels}px`;
  }
}

async function getAppLocales(appId) {
  if (!state.locales.has(appId)) {
    state.locales.set(
      appId,
      state.client.api('GET', `/api/manager/apps/app/${encodeURIComponent(appId)}/locale`).catch(() => ({})),
    );
  }
  return state.locales.get(appId);
}
