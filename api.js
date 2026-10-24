'use strict';

// App API at /api/app/dev.schweiger.dashboard/…
// Only the two pairing routes marked "public" in app.json are reachable without signing in: they let a new
// browser ask for a code and pick up the API key once its code is approved. Everything else needs a signed-in
// Homey session with app control, which the settings page in the Homey app has.
module.exports = {
  async requestPairing({ homey, body }) {
    return homey.app.requestPairing(body ?? {});
  },

  async getPairing({ homey, params }) {
    return homey.app.getPairing(params.id);
  },

  async listPairings({ homey }) {
    return homey.app.listPairings();
  },

  async approvePairing({ homey, params }) {
    return homey.app.approvePairing(params.id);
  },

  async declinePairing({ homey, params }) {
    return homey.app.declinePairing(params.id);
  },

  async getApiKeyStatus({ homey }) {
    return homey.app.getApiKeyStatus();
  },

  async setApiKey({ homey, body }) {
    return homey.app.setApiKey(body?.key);
  },
};
