// Every widget type the dashboard can render: its default title, the Homey data it needs, and how to mount it.
// A widget's mount function receives { widget, section, body, setTitle } and may return a cleanup function.
// fill: a picture or page that stretches to fill the screen when highlighted full screen (others are zoomed to fit).

import { mountAppWidget } from './app-widget.js';
import { mountBatteries, mountLowBatteries } from './batteries.js';
import { mountCameraLive } from './camera-live.js';
import { mountCameraSnapshot } from './camera.js';
import { mountDashboardShortcuts } from './dashboard-shortcuts.js';
import { mountEnergyUsage } from './energy.js';
import { mountEnergyPrices } from './energy-prices.js';
import {
  mountCustomDevices, mountCustomFlows, mountCustomMoods, mountFavoriteDevices, mountFavoriteFlows, mountFavoriteMoods,
} from './favorites.js';
import { mountInsightsChart } from './insights.js';
import { mountLights } from './lights.js';
import { mountNote } from './note.js';
import { mountSensors } from './sensors.js';
import { mountSpeaker } from './speaker.js';
import { mountThermostat } from './thermostat.js';
import { mountTimeline } from './timeline.js';
import { mountUsers } from './users.js';
import { mountVariables } from './variables.js';
import { mountCurrentWeather, mountWeather } from './weather.js';
import { mountWebFrame } from './web-frame.js';
import { mountZoneControls } from './zone-controls.js';
import { mountZoneDevices, mountZoneLights, mountZoneMoods } from './zone-widgets.js';

// Readable names of the widget types (as the highlight card in app.js names them), for edit mode and the widget's
// settings when a widget has no title.
const TYPE_NAMES = {
  app_webview: 'App widget',
  dashboards_shortcuts: 'Dashboards',
  devices_favorites: 'Favorite devices',
  flows_favorites: 'Favorite flows',
  moods_favorites: 'Favorite moods',
  devices_custom: 'Devices',
  flows_custom: 'Flows',
  moods_custom: 'Moods',
  devices_zone: 'Zone devices',
  moods_zone: 'Zone moods',
  light_zones: 'Zone lights',
  insights_chart_line: 'Chart',
  light_device: 'Light',
  light_group: 'Lights',
  device_speaker_large: 'Speaker',
  device_speaker_small: 'Speaker',
  energy_usage: 'Energy',
  thermostat: 'Thermostat',
  notifications_timeline_large: 'Timeline',
  notifications_timeline_small: 'Timeline',
  device_camera_snapshot: 'Camera snapshot',
  device_camera_live: 'Live camera',
  web_frame: 'Web frame',
  energy_dynamic_prices: 'Electricity prices',
  logic_variables: 'Variables',
  note: 'Note',
  sensors_selection: 'Sensors',
  zone_controls: 'Zone controls',
  users_avatars: 'Users',
  batteries_devices: 'Batteries',
  batteries_device_low: 'Low batteries',
  weather_forecast: 'Weather forecast',
  weather: 'Weather',
};

export const widgetTypeName = (type) => TYPE_NAMES[type] ?? type;

// The name a widget gives what it shows ("Custom Name" in the app): data.name, unless nameHidden.
const customName = (widget) => (widget.data?.nameHidden !== true && typeof widget.data?.name === 'string' ? widget.data.name.trim() : null);

export const WIDGETS = {
  app_webview: { needs: ['appWidgets'], mount: mountAppWidget },
  dashboards_shortcuts: { title: 'Dashboards', mount: mountDashboardShortcuts },
  devices_favorites: { title: 'Favorite Devices', needs: ['devices'], mount: mountFavoriteDevices },
  flows_favorites: { title: 'Favorite Flows', needs: ['flows', 'advancedFlows'], mount: mountFavoriteFlows },
  moods_favorites: { title: 'Favorite Moods', needs: ['moods', 'zones'], mount: mountFavoriteMoods },
  devices_custom: { title: 'Devices', needs: ['devices'], mount: mountCustomDevices },
  flows_custom: { title: 'Flows', needs: ['flows', 'advancedFlows'], mount: mountCustomFlows },
  moods_custom: { title: 'Moods', needs: ['moods', 'zones'], mount: mountCustomMoods },
  devices_zone: { needs: ['devices', 'zones'], mount: mountZoneDevices },
  moods_zone: { needs: ['moods', 'zones', 'devices'], mount: mountZoneMoods },
  light_zones: { needs: ['devices', 'zones'], mount: mountZoneLights },
  insights_chart_line: { mount: mountInsightsChart },
  light_device: { needs: ['devices'], mount: ({ body, widget }) => mountLights(body, [widget.data?.lightId], customName(widget)) },
  light_group: { needs: ['devices'], mount: ({ body, widget }) => mountLights(body, widget.data?.lightIds ?? [], customName(widget)) },
  device_speaker_large: { needs: ['devices'], mount: mountSpeaker },
  device_speaker_small: { needs: ['devices'], mount: (context) => mountSpeaker({ ...context, compact: true }) },
  energy_usage: { needs: ['devices'], mount: mountEnergyUsage },
  thermostat: { needs: ['devices'], mount: mountThermostat },
  notifications_timeline_large: { title: 'Timeline', needs: ['notifications'], mount: mountTimeline },
  notifications_timeline_small: { title: 'Timeline', needs: ['notifications'], mount: (context) => mountTimeline({ ...context, small: true }) },
  device_camera_snapshot: { needs: ['devices'], fill: true, mount: mountCameraSnapshot },
  device_camera_live: { needs: ['devices'], fill: true, mount: mountCameraLive },
  web_frame: { title: 'Web Frame', fill: true, mount: mountWebFrame },
  energy_dynamic_prices: { title: 'Electricity Prices', mount: mountEnergyPrices },
  logic_variables: { title: 'Variables', needs: ['variables'], mount: mountVariables },
  note: { mount: mountNote },
  sensors_selection: { needs: ['devices'], mount: mountSensors },
  zone_controls: { needs: ['devices', 'zones'], mount: mountZoneControls },
  users_avatars: { needs: ['users'], mount: mountUsers },
  batteries_devices: { title: 'Batteries', needs: ['devices', 'zones'], mount: mountBatteries },
  batteries_device_low: { title: 'Low batteries', needs: ['devices', 'zones'], mount: mountLowBatteries },
  weather_forecast: { needs: ['weather'], mount: mountWeather },
  weather: { needs: ['weather'], mount: mountCurrentWeather },
};
