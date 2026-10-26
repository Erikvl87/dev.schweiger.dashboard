// Storage for sandboxed app widgets (the 'storage' mode, see widget-modes.js). A sandboxed frame has an opaque origin,
// where localStorage throws, which breaks widgets that keep a cache or their choices there. Such a widget's page is
// fetched and loaded as srcdoc instead, with a script in front that gives it a localStorage kept by this page (per
// app, so an app's widgets share it and other apps can't read it) and a sessionStorage for the frame's lifetime. The
// frame stays sandboxed, so it still can't read this page's own storage, where the API key is.
// What a srcdoc page can't have: its address is about:srcdoc. A <base> keeps relative links on the widget's folder and
// URLs built from location.href resolve as on the real page (so Homey.getWidgetInstanceId() works), but code reading
// location.search or location.pathname itself sees about:srcdoc.

import { widgetHosts } from './crossframe-host.js';
import { STORAGE_KEY } from './state.js';

const PREFIX = 'WD_STORAGE';
// Characters per app (keys and values), well within the browser's limit for this page, which also holds the key.
const QUOTA = 256 * 1024;

const storageKey = (appId) => `${STORAGE_KEY}:widget-storage:${appId}`;

function readItems(appId) {
  try {
    const items = JSON.parse(localStorage.getItem(storageKey(appId)) ?? '{}');
    return items && typeof items === 'object' ? items : {};
  } catch {
    return {};
  }
}

function writeItems(appId, items) {
  try {
    if (Object.keys(items).length === 0) localStorage.removeItem(storageKey(appId));
    else localStorage.setItem(storageKey(appId), JSON.stringify(items));
  } catch {
    // Unavailable storage (private mode): the widget keeps its values until the frame reloads.
  }
}

const used = (items) => Object.entries(items).reduce((sum, [key, value]) => sum + key.length + value.length, 0);

// Runs first in the widget's frame, before Homey's scripts. Serialised into the page, so it uses nothing from here.
function frameScript({ prefix, href, items, quota }) {
  // URLs resolved against the frame's own address resolve against the widget's real one.
  const NativeURL = URL;
  const real = (value) => (String(value) === 'about:srcdoc' ? href : value);
  const FrameURL = class URL extends NativeURL {
    constructor(url, ...base) {
      super(real(url), ...base.map(real));
    }
  };
  if (NativeURL.canParse) FrameURL.canParse = (url, ...base) => NativeURL.canParse(real(url), ...base.map(real));
  if (NativeURL.parse) FrameURL.parse = (url, ...base) => NativeURL.parse(real(url), ...base.map(real));
  window.URL = FrameURL;

  const post = (change) => parent.postMessage(prefix + JSON.stringify(change), '*');

  // A Storage lookalike over a Map; changes to a persistent one go to the page, which keeps them.
  function storage(map, persist) {
    const size = () => [...map].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
    // Configurable, or the proxy below would have to list them as the storage's keys.
    const api = Object.create(Storage.prototype, {
      length: { get: () => map.size, configurable: true },
      key: { value: (index) => [...map.keys()][Number(index)] ?? null, configurable: true },
      getItem: { value: (key) => (map.has(String(key)) ? map.get(String(key)) : null), configurable: true },
      setItem: {
        configurable: true,
        value: (key, value) => {
          const name = String(key);
          const text = String(value);
          const before = map.has(name) ? name.length + map.get(name).length : 0;
          if (persist && size() - before + name.length + text.length > quota) {
            throw new DOMException('The widget storage is full.', 'QuotaExceededError');
          }
          map.set(name, text);
          if (persist) post({ set: name, value: text });
        },
      },
      removeItem: {
        configurable: true,
        value: (key) => {
          if (map.delete(String(key)) && persist) post({ remove: String(key) });
        },
      },
      clear: {
        configurable: true,
        value: () => {
          if (map.size === 0) return;
          map.clear();
          if (persist) post({ clear: true });
        },
      },
    });
    const own = (prop) => typeof prop === 'string' && !(prop in api);
    return new Proxy(api, {
      get: (target, prop) => (own(prop) ? (map.get(prop) ?? undefined) : Reflect.get(target, prop)),
      set: (target, prop, value) => (own(prop) ? (target.setItem(prop, value), true) : Reflect.set(target, prop, value)),
      deleteProperty: (target, prop) => (own(prop) ? (target.removeItem(prop), true) : Reflect.deleteProperty(target, prop)),
      has: (target, prop) => (own(prop) ? map.has(prop) : prop in target),
      ownKeys: () => [...map.keys()],
      getOwnPropertyDescriptor: (_target, prop) => (map.has(prop)
        ? { value: map.get(prop), writable: true, enumerable: true, configurable: true }
        : undefined),
    });
  }

  const local = new Map(Object.entries(items));
  const localStorage = storage(local, true);
  Object.defineProperty(window, 'localStorage', { value: localStorage, configurable: true, enumerable: true });
  Object.defineProperty(window, 'sessionStorage', { value: storage(new Map(), false), configurable: true, enumerable: true });

  // Changes another frame of the same app made, as a 'storage' event like the browser fires. Registered before the
  // widget's own listeners, which never see these messages.
  addEventListener('message', (event) => {
    if (event.source !== parent || typeof event.data !== 'string' || !event.data.startsWith(prefix)) return;
    event.stopImmediatePropagation();
    let change;
    try {
      change = JSON.parse(event.data.slice(prefix.length));
    } catch {
      return;
    }
    const key = change.set ?? change.remove ?? null;
    const oldValue = key == null ? null : (local.get(key) ?? null);
    if (change.set != null) local.set(change.set, String(change.value));
    else if (change.remove != null) local.delete(change.remove);
    else if (change.clear) local.clear();
    else return;
    dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: change.set != null ? String(change.value) : null, url: href }));
  });

  // With the <base>, a link to "#…" would load the widget's real page, without this script; scroll like the browser
  // does instead. Left to the widget if it handled the click itself.
  addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (link == null || event.defaultPrevented || (link.target && link.target !== '_self')) return;
    event.preventDefault();
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = id ? (document.getElementById(id) ?? document.getElementsByName(id)[0]) : null;
    if (target) target.scrollIntoView();
    else if (!id || id === 'top') scrollTo(0, 0);
  });
}

// The widget page at src (on the Homey) loaded into the sandboxed iframe as srcdoc, with storage for its app.
export async function loadWithStorage(iframe, src, appId) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const config = JSON.stringify({ prefix: PREFIX, href: src, items: readItems(appId), quota: QUOTA })
    .replace(/</g, '\\u003c');
  const head = `<base href="${src.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"><script>(${frameScript})(${config});</script>`;
  // Homey adds its scripts to the page's <head>, so there is always one; ours goes in front of them.
  const opening = /<head\b[^>]*>/i.exec(html);
  iframe.srcdoc = opening
    ? html.slice(0, opening.index + opening[0].length) + head + html.slice(opening.index + opening[0].length)
    : head + html;
}

// Changes from a widget frame in the storage mode: kept for its app, and passed on to the app's other such frames.
addEventListener('message', (event) => {
  if (typeof event.data !== 'string' || !event.data.startsWith(PREFIX)) return;
  const host = widgetHosts.get(event.source);
  if (host?.storage !== true) return;
  let change;
  try {
    change = JSON.parse(event.data.slice(PREFIX.length));
  } catch {
    return;
  }
  const items = readItems(host.appId);
  if (typeof change.set === 'string' && typeof change.value === 'string') items[change.set] = change.value;
  else if (typeof change.remove === 'string') delete items[change.remove];
  else if (change.clear === true) for (const key of Object.keys(items)) delete items[key];
  else return;
  // The frame checks the quota itself; one that doesn't (it could post anything) gets nothing kept.
  if (used(items) > QUOTA) return;
  writeItems(host.appId, items);
  for (const [frameWindow, other] of widgetHosts) {
    if (other !== host && other.storage === true && other.appId === host.appId) {
      frameWindow.postMessage(PREFIX + JSON.stringify(change), '*');
    }
  }
});
