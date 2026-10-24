// Device control icons, used as CSS masks (only their shape matters).
//
// LICENSING: these are our own drawings standing in for the Homey web app's control icons, which are Athom
// artwork bundled in the web app (served by Homey at /web) and not licensed for redistribution in an app.
// Each entry names the web app icon it replaces. Swap in Athom's artwork if it becomes available under a
// usable licence, for example through https://github.com/athombv/homey-vectors-public (GPL-3.0).
// Search for "LICENSING:" to find every stand-in.

const svg = (body, strokeWidth = 1.8) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
)}`;

const SUN_RAYS = '<path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>';

export const CONTROL_ICONS = {
  tabs: {
    // LICENSING: stand-in for the web app's "capabilityTab.onOff" tab icon.
    toggle: svg('<rect x="2.5" y="7" width="19" height="10" rx="5"/><circle cx="7.5" cy="12" r="2.6" fill="#000"/>'),
    // LICENSING: stand-in for the web app's "capabilityTab.slider" tab icon.
    slider: svg('<path d="M3 12h4.6M14.4 12H21"/><circle cx="11" cy="12" r="3.2"/>'),
    // LICENSING: stand-in for the web app's "capabilityTab.color" tab icon.
    color: svg('<circle cx="12" cy="5.5" r="2.3"/><circle cx="18.2" cy="10" r="2.3"/><circle cx="15.8" cy="17.4" r="2.3"/><circle cx="8.2" cy="17.4" r="2.3"/><circle cx="5.8" cy="10" r="2.3"/><circle cx="12" cy="12.4" r="1.5" fill="#000"/>'),
    // LICENSING: stand-in for the web app's "capabilityTab.ternary" tab icon.
    ternary: svg('<path d="m9 6.5 3-3 3 3M9 17.5l3 3 3-3"/><circle cx="12" cy="12" r="2.2"/>'),
    // LICENSING: stand-in for the web app's "capabilityTab.thermostat" tab icon (a thermometer).
    thermostat: svg('<path d="M10 14.2V4.5a2 2 0 0 1 4 0v9.7a4 4 0 1 1-4 0z"/><circle cx="12" cy="17.3" r="1.6" fill="#000"/><path d="M12 15.7V9"/>'),
  },
  lock: {
    // LICENSING: stand-ins for the app's open and closed padlocks on the lock control.
    open: svg('<path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5" stroke-width="2.4"/><path fill="#000" stroke="none" fill-rule="evenodd" d="M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V12a1.5 1.5 0 0 1 1.5-1.5zm5.5 3a1.6 1.6 0 0 0-.8 3v2h1.6v-2a1.6 1.6 0 0 0-.8-3z"/>'),
    closed: svg('<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke-width="2.4"/><path fill="#000" stroke="none" fill-rule="evenodd" d="M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V12a1.5 1.5 0 0 1 1.5-1.5zm5.5 3a1.6 1.6 0 0 0-.8 3v2h1.6v-2a1.6 1.6 0 0 0-.8-3z"/>'),
  },
  // LICENSING: stand-in for the web app's "capability.onoff" icon on the large power button.
  power: svg('<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>', 2.4),
  ternary: {
    // LICENSING: stand-ins for the web app's up / stop / down icons of the ternary (window coverings) control.
    up: svg('<path d="m6 15 6-6 6 6"/>', 2.4),
    idle: svg('<circle cx="12" cy="12" r="5"/>', 2.4),
    down: svg('<path d="m6 9 6 6 6-6"/>', 2.4),
  },
  slider: {
    // LICENSING: stand-ins for the web app's slider end icons for lights (full and dimmed sun).
    lightUpper: svg(`<circle cx="12" cy="12" r="4.4" fill="#000"/>${SUN_RAYS}`),
    lightLower: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3.5v1M12 19.5v1M3.5 12h1M19.5 12h1M6 6l.7.7M17.3 17.3l.7.7M6 18l.7-.7M17.3 6.7l.7-.7"/>'),
    // LICENSING: stand-ins for the web app's slider end icons for window coverings (open and closed blind).
    blindUpper: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><rect x="4" y="4" width="16" height="4" rx="1.5" fill="#000"/>'),
    blindLower: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 8h16M4 12h16M4 16h16"/>'),
    // LICENSING: stand-ins for the web app's generic slider end icons.
    defaultUpper: svg('<path d="M12 6v12M6 12h12"/>', 2.4),
    defaultLower: svg('<path d="M6 12h12"/>', 2.4),
  },
};
