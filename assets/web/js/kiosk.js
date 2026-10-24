// Kiosk mode for wall tablets: the browser always shows one dashboard, chosen once in Settings, without the dashboard
// menu or the Settings button. It asks the browser to keep the screen on, stray touches don't select or zoom, and a
// tablet left alone goes back to its dashboard. Pressing and holding the dashboard name asks to unlock Settings (approved in the Homey app).
// Turned on per browser in Settings, or for one address with ?kiosk (and ?dashboard=… to pick the dashboard).

import { $ } from './dom.js';
import { STORAGE_KEY, params, state } from './state.js';

const KIOSK_KEY = `${STORAGE_KEY}:kiosk`;
const IDLE_RESET = 2 * 60 * 1000;
const HOLD_FOR_SETTINGS = 1500;

let kiosk = null; // { home: dashboard id } while on
let wakeLock = null;
let requestingWakeLock = false;
let lastTouch = Date.now();

// Counts as a touch, e.g. when an unlock is approved on a phone while nobody touched the tablet.
export function resetIdle() {
  lastTouch = Date.now();
}

function readStored() {
  try {
    return JSON.parse(localStorage.getItem(KIOSK_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function store() {
  try {
    if (kiosk) localStorage.setItem(KIOSK_KEY, JSON.stringify(kiosk));
    else localStorage.removeItem(KIOSK_KEY);
  } catch {
    // Storage can be unavailable (private mode); kiosk mode then lasts for this visit.
  }
}

// Screen wake lock. Chrome grants it on load; Safari only during a tap, so every tap tries again until it holds.
// It is lost whenever the page is hidden, and the browser may refuse it (power saving), so it is best effort.
async function keepScreenOn() {
  if (!kiosk || wakeLock || requestingWakeLock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  requestingWakeLock = true;
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      if (wakeLock === sentinel) wakeLock = null;
    });
    if (kiosk) wakeLock = sentinel;
    else sentinel.release();
  } catch {
    // Not now (no tap yet, power saving); the next tap tries again.
  } finally {
    requestingWakeLock = false;
  }
}

// For Settings: whether the screen is really being kept on, and if not, why.
export function screenState() {
  if (!window.isSecureContext) return 'insecure';
  if (!('wakeLock' in navigator)) return 'unsupported';
  return wakeLock ? 'on' : 'off';
}

function apply() {
  document.documentElement.classList.toggle('kiosk', kiosk != null);
  if (kiosk) {
    keepScreenOn();
  } else {
    wakeLock?.release();
    wakeLock = null;
  }
}

export function isKiosk() {
  return kiosk != null;
}

export function kioskHome() {
  return kiosk?.home ?? null;
}

export function setKiosk(on, home) {
  kiosk = on ? { home } : null;
  store();
  apply();
}

// After the first load. An address that names a dashboard decides the home dashboard; otherwise the stored one
// does, as long as it still exists.
export function settleKioskHome() {
  if (!kiosk) return;
  if (kiosk.home == null || params.has('dashboard') || state.dashboards[kiosk.home] == null) {
    kiosk.home = state.dashboardId;
    if (!params.has('kiosk')) store();
  }
}

// onHold: the dashboard name was held. onIdle: nobody touched the tablet for two minutes.
export function initKiosk({ onHold, onIdle }) {
  kiosk = readStored() ?? (params.has('kiosk') ? { home: null } : null);
  apply();

  for (const type of ['pointerdown', 'keydown', 'wheel']) {
    addEventListener(type, () => {
      lastTouch = Date.now();
    }, { capture: true, passive: true });
  }
  // The events during which Safari lets a page keep the screen on.
  for (const type of ['click', 'touchend', 'keydown']) {
    addEventListener(type, keepScreenOn, { capture: true, passive: true });
  }
  // Taps inside an app widget's frame never reach this page. The first one moves the focus into the frame, which does
  // (later taps in the same frame stay invisible).
  addEventListener('blur', () => {
    if (document.activeElement?.tagName !== 'IFRAME') return;
    lastTouch = Date.now();
    keepScreenOn();
  });
  document.addEventListener('visibilitychange', keepScreenOn);
  // A long press would otherwise open the context menu on Android.
  addEventListener('contextmenu', (event) => {
    if (kiosk) event.preventDefault();
  });

  let holdTimer = null;
  const title = $('dashboard-name');
  title.addEventListener('pointerdown', () => {
    if (kiosk) holdTimer = setTimeout(onHold, HOLD_FOR_SETTINGS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
    title.addEventListener(type, () => clearTimeout(holdTimer));
  }

  setInterval(() => {
    if (!kiosk || Date.now() - lastTouch < IDLE_RESET) return;
    lastTouch = Date.now();
    onIdle();
  }, 10000);
}
