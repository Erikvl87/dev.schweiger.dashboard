// Shared runtime state: config, Homey client, loaded data and per-render cleanups.

export const STORAGE_KEY = 'homey-web-dashboard';

export const params = new URLSearchParams(location.search);

export const state = {
  config: null,
  client: null,
  realtime: null,
  dashboards: {},
  dashboardId: null,
  system: {},
  me: null,
  data: {},
  dataErrors: {},
  locales: new Map(),
  cleanups: [],
};
