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

**Fit to screen width**: by default the columns keep their width and scroll sideways. Turn on *Fit to screen width* in the dashboard's **Settings** and that browser shrinks the whole dashboard until every column fits instead (it never enlarges it). `?fit` does the same for one address without storing it.

**Screens**: every browser showing the dashboard is a screen with a name, so flow cards can aim at one ("Hallway tablet"). You name a browser when you approve it (the field starts as e.g. *Safari on iPad*). The app's settings in the Homey app list all screens to rename or forget them, and the dashboard's **Settings** shows its own name. A browser keeps a random id in its storage, so the name survives reloads and **Forget**; clearing the browser's data makes it a new screen. Browsers paired before screens existed, or set up with a typed key, show up under their browser name. A private window can't keep an id, so it only follows cards aimed at all screens.

**Flow cards**: put one widget or dashboard in front of everyone, or of one screen, e.g. the front-door camera on the hallway tablet when the doorbell rings. Each card's first choice is the screen: *All screens* or a named one.

- *Highlight a widget* (action): pick the screen, a dashboard, then one of its widgets, *large* or *full screen*, and optionally the seconds after which it closes. That screen (or every open one) shows it over whatever it is showing; large zooms the widget up on a card, full screen fills the window (a camera or web frame edge to edge, other widgets zoomed to fit). A screen showing that dashboard lifts its own widget, so it keeps what it was doing (a page opened in a web frame, an app widget's state); other screens show a copy. A new highlight replaces what those screens showed.
- *Close the widget highlight on …* (action), *A widget highlight is open on …* (condition; *Any screen* or one), and *The widget highlight was closed* (trigger, with the widget, its dashboard, the screen it was aimed at and who closed it: `screen`, `flow` or `timer`; not when a new highlight replaces it).
- *Show a dashboard* (action): switches that screen (or every open one) to that dashboard; behind a highlight, it shows once the highlight closes. A kiosk tablet counts it as a touch and goes back to its own dashboard after two minutes alone.

Closing a highlight on one screen (✕, Esc or a tap beside it) closes it on every screen showing it. Kiosk tablets keep it open when left alone. It is kept in memory, so an app restart closes it. Only dashboards served by the app show highlights.

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
| `POST /screen-hello` | public | a dashboard says which screen it is: `{ token, id, name }`; acts only if Homey accepts the token, adds an unknown screen under `name`, returns `{ name }` |
| `GET /screens`, `PUT /screens/:id`, `DELETE /screens/:id` | settings page | list, rename (`{ name }`) and forget screens; changes are also sent as the realtime event `screens`. Approving a pairing takes `{ name }` too |
| `GET /highlight?screen=<id>` | public | that screen's highlight `{ highlight: { id, target, dashboardId, widgetId, name, dashboardName, size } }` or `{ highlight: null }` (the all-screens one without a known id); changes are sent as the realtime event `highlight` with every screen's |
| `POST /highlight/close` | public | a dashboard closed a highlight: `{ token, id }`; acts only if Homey accepts the token, on every screen showing that `id` |

Waiting browsers are kept in memory for 10 minutes, at most 10 at a time; an app restart drops them and the browsers ask for a new code. Without a saved key, `POST /pairing` refuses. Served by the app, a browser whose key Homey rejects (401) forgets it and pairs again.

## Layout

```
app.js                  dashboard address, API key, pairing, widget highlight flow cards
api.js                  app API routes for pairing, the key and the highlight
.homeycompose/flow/     flow cards (app.json is generated from .homeycompose/)
settings/index.html     settings page: address, waiting browsers, screens, API key
assets/web/
  index.html            markup only
  css/                  tokens (light/dark), base layout, widgets, popups
  js/main.js            entry: connect, pick the dashboard, live updates, setup form
  js/pairing.js         asks the app for a code and waits for approval
  js/screen.js          this browser's lasting screen id and the name the app gives it
  js/kiosk.js           kiosk mode: fixed dashboard, screen on, idle reset, hold the name for Settings
  js/fit.js             fit to screen width: zooms the board out so all columns fit
  js/highlight.js       shows the widget a flow highlighted, large or full screen
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
3. Register it in `assets/web/js/widgets/index.js` with the Homey collections it needs (see `DATA_SOURCES` in `data.js`). Mark it `fill: true` if it is a picture or page that should fill the screen when highlighted full screen.
4. Give it a readable name for the highlight card in `WIDGET_TYPES` in `app.js`.

## Icons and licensing

- **Device and zone icons** are loaded at runtime from the Homey's own web app (`/web/img/devices/`, `/web/img/zones/`), so the app doesn't ship them.
- **Control and sensor icons** (`assets/web/js/icons/`) are our own drawings standing in for the Homey apps' icons, which are Athom artwork not licensed for redistribution. Every stand-in is marked with a `LICENSING:` comment naming the original; search for it to see what should eventually be there. Missing icons can be requested at https://github.com/athombv/homey-vectors-public (GPL-3.0).
- Colour presets, the colour-temperature formula and the zone icon name mapping follow the Homey web app's behaviour; they're data, not artwork.

## Security

Served by the app, the dashboard shares Homey's origin with Homey's own web app and every app's widgets and settings pages. App widgets therefore run in iframes sandboxed without `allow-same-origin`, so they can't read the stored API key. Use a key with only the permissions listed in the settings page.

Pairing hands every approved browser the same key, so it lives in the app settings and in each browser's storage. Anyone on the network can ask for a code, but only a browser you approve gets the key, and only the browser holding the random poll id can collect it. To sign out one browser, clear its storage (**Settings → Forget** on the dashboard); to sign out all of them, delete the key in my.homey.app and save a new one. Never give the key `homey.app.control`: with it, a paired browser could change this app's settings and approve itself or others.

## Licence

GPL-3.0, see `LICENSE`.
