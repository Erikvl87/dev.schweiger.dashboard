# Web Dashboard for Homey

A Homey app that shows the dashboards you build in the Homey mobile app in any browser on your home network, live. Editing stays in the mobile app.

The dashboard is static files in `assets/web/`, which Homey serves at `/app/dev.schweiger.dashboard/assets/web/index.html`.
`app.js` works out that address for the settings page, keeps the API key the dashboard uses, and hands it to browsers you approve.

## Using it

1. Install the app and open its settings in the Homey app.
2. Save an API key from my.homey.app → Settings → API Keys. The settings page lists the permissions it needs; the app checks the key against your Homey before saving it.
3. Open the address shown there on a tablet (or tap **Open dashboard**). The browser shows a six-digit code and the settings page lists it under *Browsers waiting to be paired*. Approve it if the codes match; the browser then gets the key and stores it.

**Use an API key** on the pairing screen skips pairing and takes a key typed into that browser.

Pick the dashboard by tapping its name at the top (as in the app), with a dashboard shortcut widget, or with `?dashboard=<name or id>` in the address. Each browser remembers its choice.

**Kiosk mode** (for a wall tablet): in the dashboard's **Settings**, choose a dashboard and turn on *Always show this dashboard*. That browser then shows only that dashboard: tapping its name no longer switches, and the Settings button is gone. It keeps the screen on, and after two minutes without a touch it closes open controls and returns to that dashboard. To change it, press and hold the dashboard name: the tablet shows a code, and approving it in the app's settings in the Homey app opens Settings on the tablet. That approval hands out nothing, and after two minutes without a touch the tablet locks again. `?kiosk&dashboard=<name>` does the same for one address without storing it.

On an iPad, *Share → Add to Home Screen* opens the dashboard without Safari's address bar. The home-screen app has its own storage, so it pairs once more.

## Developing

Plain ES modules, no build step, no dependencies. Serve the dashboard folder over HTTP (browsers don't load modules from `file://`):

```sh
npm run serve          # python3 -m http.server 8766 --directory assets/web
```

Served from anywhere but the Homey, the page asks for the Homey address too (`https://<ip-with-dashes>.homey.homeylocal.com`), or reads it from a `config.json` next to `index.html`: `{ "homeyUrl": "…", "token": "…" }`. Served by the app, it uses its own origin and ignores `config.json`.

```sh
homey app validate --level publish
homey app install      # or `homey app run` while developing
homey app publish
```

## Pairing

Routes in `api.js` (`/api/app/dev.schweiger.dashboard/…`):

| Route | Who | |
| --- | --- | --- |
| `POST /pairing` | public | a browser asks for a code (`purpose`: `pair`, or `unlock` for a kiosk tablet's settings); returns `{ id, code, expiresAt }` |
| `GET /pairing/:id` | public | the browser polls with its secret `id`: `waiting`, `declined`, `expired`, or once `{ status: 'approved', token }` (no token for `unlock`) |
| `GET /pairings`, `POST /pairings/:id/approve`, `POST /pairings/:id/decline` | settings page | waiting browsers; changes are also sent as the realtime event `pairings` |
| `GET /api-key`, `PUT /api-key` | settings page | key status; `PUT` validates and stores the key (an empty key removes it) |

Waiting browsers are kept in memory for 10 minutes, at most 10 at a time; an app restart drops them and the browsers ask for a new code. Without a saved key, `POST /pairing` refuses. Served by the app, a browser whose key Homey rejects (401) forgets it and pairs again.

## Layout

```
app.js                  dashboard address, API key, pairing
api.js                  app API routes for pairing and the key
settings/index.html     settings page: address, waiting browsers, API key
assets/web/
  index.html            markup only
  css/                  tokens (light/dark), base layout, widgets, popups
  js/main.js            entry: connect, pick the dashboard, live updates, setup form
  js/pairing.js         asks the app for a code and waits for approval
  js/kiosk.js           kiosk mode: fixed dashboard, screen on, idle reset, hold the name for Settings
  js/mood-orb.js        mood icons: a gradient of the colours a mood sets (the Homey web app's method)
  manifest.json, img/   Add to Home Screen
  js/render.js          renders a dashboard's columns of widgets
  js/widgets/index.js   registry of widget types → title, data needed, mount function
  js/widgets/*.js       one module per widget type
  js/sheets/            device controls; lights / speakers / batteries / climate zone sheets
  js/crossframe-host.js parent side of Homey's widget protocol (app widgets run in sandboxed iframes)
  js/realtime.js        socket.io live updates
  js/icons.js, js/icons/  icons (see below)
  js/…                  api client, config, data loading, devices, zones, colours, charts, DOM helpers
```

## Adding a widget type

1. Look at how the mobile app stores it: `GET /api/manager/dashboards/dashboard`.
2. Add `assets/web/js/widgets/<name>.js` exporting `mount<Name>({ widget, section, body, setTitle })`. Return a cleanup function if it subscribes to anything.
3. Register it in `assets/web/js/widgets/index.js` with the Homey collections it needs (see `DATA_SOURCES` in `data.js`).

## Icons and licensing

- **Device and zone icons** are loaded at runtime from the Homey's own web app (`/web/img/devices/`, `/web/img/zones/`), so the app doesn't ship them.
- **Control and sensor icons** (`assets/web/js/icons/`) are our own drawings standing in for the Homey apps' icons, which are Athom artwork not licensed for redistribution. Every stand-in is marked with a `LICENSING:` comment naming the original; search for it to see what should eventually be there. Missing icons can be requested at https://github.com/athombv/homey-vectors-public (GPL-3.0).
- Colour presets, the colour-temperature formula and the zone icon name mapping follow the Homey web app's behaviour; they're data, not artwork.

## Security

Served by the app, the dashboard shares Homey's origin with Homey's own web app and every app's widgets and settings pages. App widgets therefore run in iframes sandboxed without `allow-same-origin`, so they can't read the stored API key. Use a key with only the permissions listed in the settings page.

Pairing hands every approved browser the same key, so it lives in the app settings and in each browser's storage. Anyone on the network can ask for a code, but only a browser you approve gets the key, and only the browser holding the random poll id can collect it. To sign out one browser, clear its storage (**Settings → Forget** on the dashboard); to sign out all of them, delete the key in my.homey.app and save a new one. Never give the key `homey.app.control`: with it, a paired browser could change this app's settings and approve itself or others.

## Licence

GPL-3.0, see `LICENSE`.
