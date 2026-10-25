'use strict';

// App API at /api/app/dev.schweiger.dashboard/…
// Only the routes marked "public" in app.json are reachable without signing in: two let a new browser ask for a
// code and pick up the API key once its code is approved, three let a dashboard say which screen it is and read and
// close its widget highlight (saying hello and closing check the dashboard's key). Everything else needs a signed-in Homey session with app control, which the
// settings page in the Homey app has.
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

  async approvePairing({ homey, params, body }) {
    return homey.app.approvePairing(params.id, body ?? {});
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

  async listScreens({ homey }) {
    return homey.app.listScreens();
  },

  async renameScreen({ homey, params, body }) {
    return homey.app.renameScreen(params.id, body ?? {});
  },

  async forgetScreen({ homey, params }) {
    return homey.app.forgetScreen(params.id);
  },

  async screenHello({ homey, body }) {
    return homey.app.screenHello(body ?? {});
  },

  async getHighlight({ homey, query }) {
    return homey.app.getHighlight(query?.screen);
  },

  async closeHighlight({ homey, body }) {
    return homey.app.closeHighlightFromScreen(body ?? {});
  },
};
