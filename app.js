'use strict';

const crypto = require('crypto');
const Homey = require('homey');

// What the dashboard needs, named as in my.homey.app's API key form (group → box); that form lacks the first and the
// energy one, so those are named by scope.
const NEEDED_SCOPES = [
  ['homey.dashboard.readonly', 'View dashboards (homey.dashboard.readonly; not offered in the my.homey.app form)'],
  ['homey.device.readonly', 'Devices → View devices'],
  ['homey.device.control', 'Devices → Control devices'],
  ['homey.flow.readonly', 'Flows → View Flows'],
  ['homey.flow.start', 'Flows → Start Flows'],
  ['homey.mood.readonly', 'Moods → View Moods'],
  ['homey.mood.set', 'Moods → Set Moods'],
  ['homey.logic.readonly', 'Variables → View Variables'],
  ['homey.zone.readonly', 'Zones → View Zones'],
  ['homey.notifications.readonly', 'Notifications → View Notifications'],
  ['homey.app.readonly', 'Apps → View Apps'],
  ['homey.user.readonly', 'Users → View Users'],
  ['homey.user.self', 'Users → Edit Self User'],
  ['homey.insights.readonly', 'Logs → View Logs'],
  ['homey.energy.readonly', 'View energy (homey.energy.readonly; not offered in the my.homey.app form)'],
  ['homey.presence.self', 'Presence → Edit Self Presence'],
  ['homey.system.readonly', 'System → View System'],
  ['homey.geolocation.readonly', 'Location → View Location'],
];

// Ticking a group's own box (or Homey) also allows deleting and changing things; every paired browser holds the key.
const BROAD_SCOPES = {
  homey: 'Homey (everything)',
  'homey.app': 'Apps (installs and removes apps)',
  'homey.app.control': 'Apps → Control Apps (changes app settings, this one included)',
  'homey.user': 'Users (adds and removes users)',
  'homey.system': 'System (firmware, restarts)',
  'homey.updates': 'Updates',
  'homey.device': 'Devices (deletes and changes devices)',
  'homey.flow': 'Flows (edits and deletes Flows)',
  'homey.mood': 'Moods (edits and deletes moods)',
  'homey.logic': 'Variables (edits and deletes variables)',
  'homey.zone': 'Zones (edits and deletes zones)',
  'homey.dashboard': 'Dashboards (edits and deletes dashboards)',
  'homey.energy': 'Energy (changes energy settings)',
  'homey.notifications': 'Notifications (deletes notifications)',
  'homey.insights': 'Logs (deletes logs)',
  'homey.presence': "Presence (sets other people's presence)",
  'homey.alarm': 'Alarms',
  'homey.geolocation': 'Location',
};

// A scope is granted by itself or by any parent (homey.device grants homey.device.readonly; homey grants all).
const grants = (scopes, scope) => scope.split('.').some((_, index, parts) => scopes.includes(parts.slice(0, index + 1).join('.')));

// How long a browser's code stays valid, and how many browsers may wait at once.
const PAIRING_TTL = 10 * 60 * 1000;
const MAX_WAITING = 10;

// The dashboard is static files in assets/web/, which Homey serves at /app/<app id>/assets/web/.
// The app works out that address for the settings page, keeps the API key the dashboard uses, and hands
// it to browsers you approve (pairing), so the key only has to be entered once.
module.exports = class DashboardApp extends Homey.App {
  async onInit() {
    // Waiting browsers live in memory only; a restart simply asks them for a new code.
    this.pairings = new Map();

    const address = await this.homey.cloud.getLocalAddress(); // e.g. "192.168.3.210:80"
    const ip = address.split(':')[0];
    const path = `/app/${this.manifest.id}/assets/web/index.html`;
    // *.homey.homeylocal.com resolves to the Homey on the local network and has a valid HTTPS certificate.
    const secureUrl = `https://${ip.replace(/\./g, '-')}.homey.homeylocal.com${path}`;
    const localUrl = `http://${address}${path}`;

    this.homey.settings.set('dashboardUrl', secureUrl);
    this.homey.settings.set('dashboardLocalUrl', localUrl);
    this.log(`Dashboard: ${secureUrl}`);
  }

  // ----- Pairing (public routes: an unknown browser can only ask for a code and poll it) -----

  // purpose 'pair' hands an approved browser the API key. 'unlock' only lets a kiosk tablet, which already has the
  // key, open its settings: approving it hands out nothing.
  requestPairing({ name, purpose }) {
    const unlock = purpose === 'unlock';
    if (!unlock && !this.homey.settings.get('apiKey')) {
      throw new Error('No API key is set yet. Add one in the Web Dashboard settings in the Homey app.');
    }
    this.prunePairings();

    const pairing = {
      // The id is the browser's secret for polling; the short code is what the user compares.
      id: crypto.randomBytes(16).toString('hex'),
      code: String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'),
      name: String(name || 'Browser').slice(0, 60),
      purpose: unlock ? 'unlock' : 'pair',
      createdAt: Date.now(),
      status: 'waiting',
    };
    this.pairings.set(pairing.id, pairing);

    // Keep the list short so a flood of requests can't bury a real one for long.
    const waiting = [...this.pairings.values()].filter((entry) => entry.status === 'waiting');
    for (const stale of waiting.slice(0, Math.max(0, waiting.length - MAX_WAITING))) this.pairings.delete(stale.id);

    this.announcePairings();
    return { id: pairing.id, code: pairing.code, expiresAt: pairing.createdAt + PAIRING_TTL };
  }

  // The browser polls with its secret id. The key is handed over once, after approval, then the pairing is gone.
  getPairing(id) {
    this.prunePairings();
    const pairing = this.pairings.get(id);
    if (pairing == null) return { status: 'expired' };
    if (pairing.status === 'waiting') return { status: 'waiting' };

    this.pairings.delete(id);
    if (pairing.status === 'declined') return { status: 'declined' };
    if (pairing.purpose === 'unlock') return { status: 'approved' };
    const token = this.homey.settings.get('apiKey');
    if (!token) return { status: 'declined' };
    return { status: 'approved', token };
  }

  // ----- Pairing (settings page) -----

  listPairings() {
    this.prunePairings();
    return [...this.pairings.values()]
      .filter((pairing) => pairing.status === 'waiting')
      .map(({ id, code, name, purpose, createdAt }) => ({ id, code, name, purpose, createdAt }));
  }

  approvePairing(id) {
    return this.decide(id, 'approved');
  }

  declinePairing(id) {
    return this.decide(id, 'declined');
  }

  decide(id, status) {
    this.prunePairings();
    const pairing = this.pairings.get(id);
    if (pairing == null || pairing.status !== 'waiting') throw new Error('This browser is no longer waiting.');
    pairing.status = status;
    this.log(`Pairing ${pairing.code} (${pairing.name}, ${pairing.purpose}) ${status}`);
    this.announcePairings();
    return { status };
  }

  prunePairings() {
    const now = Date.now();
    for (const [id, pairing] of this.pairings) {
      if (now - pairing.createdAt > PAIRING_TTL) this.pairings.delete(id);
    }
  }

  // Lets an open settings page update its list without polling.
  announcePairings() {
    this.homey.api.realtime('pairings', this.listPairings());
  }

  // ----- API key (settings page) -----

  // Also asks Homey what the saved key may do, so the settings page can name missing and too broad permissions.
  async getApiKeyStatus() {
    const status = this.homey.settings.get('apiKeyStatus') ?? { set: false };
    if (!status.set) return status;
    const scopes = await this.keyScopes(this.homey.settings.get('apiKey')).catch(() => null);
    if (scopes == null) return status;
    return {
      ...status,
      missing: NEEDED_SCOPES.filter(([scope]) => !grants(scopes, scope)).map(([, label]) => label),
      // With "homey" everything else is implied, so that alone is named.
      broad: Object.entries(BROAD_SCOPES)
        .filter(([scope]) => scopes.includes(scope) && (scope === 'homey' || !scopes.includes('homey')))
        .map(([, label]) => label),
    };
  }

  async keyScopes(token) {
    const localUrl = await this.homey.api.getLocalUrl();
    const response = await fetch(`${localUrl}/api/manager/sessions/session/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const session = await response.json();
    return session.intersectedScopes ?? session.scopes ?? null;
  }

  // Checks the key against this Homey before storing it, so a typo doesn't surface later on every tablet.
  async setApiKey(key) {
    if (typeof key !== 'string' || key.trim() === '') {
      this.homey.settings.unset('apiKey');
      this.homey.settings.unset('apiKeyStatus');
      return { set: false };
    }
    const token = key.trim();
    const localUrl = await this.homey.api.getLocalUrl();
    const call = (path) => fetch(`${localUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });

    const me = await call('/api/manager/users/user/me');
    if (me.status === 401) throw new Error('Homey doesn\'t accept this API key.');
    if (!me.ok) throw new Error(`The key can't read your user (homey.user.self): ${me.status}`);
    const dashboards = await call('/api/manager/dashboards/dashboard');
    if (!dashboards.ok) throw new Error(`The key can't read dashboards (homey.dashboard.readonly): ${dashboards.status}`);

    const user = await me.json();
    const status = { set: true, user: user.name, savedAt: new Date().toISOString() };
    this.homey.settings.set('apiKey', token);
    this.homey.settings.set('apiKeyStatus', status);
    this.log(`API key saved (user ${user.name})`);
    return this.getApiKeyStatus();
  }
};
