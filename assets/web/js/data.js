// Loads the Homey collections the widgets on a dashboard need.

import { note } from './dom.js';
import { state } from './state.js';

export const DATA_SOURCES = {
  appWidgets: '/api/manager/dashboards/appwidget',
  devices: '/api/manager/devices/device',
  zones: '/api/manager/zones/zone',
  flows: '/api/manager/flow/flow',
  advancedFlows: '/api/manager/flow/advancedflow',
  moods: '/api/manager/moods/mood',
  notifications: '/api/manager/notifications/notification',
  variables: '/api/manager/logic/variable',
  users: '/api/manager/users/user',
  weather: '/api/manager/weather/weather',
};

// Fetches each named collection once; a failed one is reported per widget instead of failing the dashboard.
export async function loadData(keys) {
  const needed = new Set(keys);
  const data = {};
  const errors = {};
  await Promise.all(
    [...needed].map(async (key) => {
      try {
        data[key] = await state.client.api('GET', DATA_SOURCES[key]);
      } catch (error) {
        errors[key] = error.message;
      }
    }),
  );
  return { data, errors };
}

// Writes an error note and returns false when data a widget depends on could not be loaded.
export function requireData(body, ...keys) {
  const missing = keys.find((key) => state.data[key] == null);
  if (missing == null) return true;
  note(body, `Could not load ${missing}: ${state.dataErrors[missing] ?? 'unknown error'}`, true);
  return false;
}
