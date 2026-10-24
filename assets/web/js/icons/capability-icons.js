// Sensor capability icons, used as CSS masks (only their shape matters). Keyed by capability; sensors.js falls
// back to "measure" for other readings and "alarm_generic" for other alarms. An entry may add an "active"
// variant, shown while a boolean capability is on.
//
// LICENSING: these are our own drawings standing in for the Homey apps' capability icons, which are Athom
// artwork bundled in the Homey web app (served by Homey at /web) and not licensed for redistribution in an app.
// The key names the capability whose icon is replaced. Athom's https://github.com/athombv/homey-vectors-public
// (GPL-3.0) has a few today (alarm_rain, measure_PM1, measure_PM10, measure_VOC, measure_CH4, measure_dewpoint);
// icons can be requested there. Search for "LICENSING:" to find every stand-in.

const svg = (body) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
)}`;
const icon = (body) => ({ default: svg(body) });

// Shapes shared by several icons.
const THERMOMETER = '<path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z"/><path d="M12 9.5v6.5"/>';
const DROP = '<path d="M12 3.5s5.5 6 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 9.5 12 3.5 12 3.5z"/>';
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
const GAUGE = '<path d="M4.6 17.5a8.5 8.5 0 1 1 14.8 0"/><path d="m12 14 3.5-4.5"/><circle cx="12" cy="14" r="1.2" fill="#000"/>';
const BOLT = '<path d="M13 2.5 5.5 13.5H12l-1 8 7.5-11H12z"/>';
const BELL = '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>';
const FLAME = '<path d="M12 21.5a6 6 0 0 0 6-6c0-4.5-4-6.5-4.5-11-2.5 2-3.5 4.5-3.5 6.5-1-.5-1.8-1.6-2-3C6.6 9.6 6 11.6 6 15.5a6 6 0 0 0 6 6z"/>';
const PERSON = '<circle cx="12" cy="4.5" r="2"/><path d="M12 8v7M8 11l4-2 4 2M9.5 21l2.5-6 2.5 6"/>';
const WARNING = '<path d="M17.5 13.5 22 21h-9z" fill="#000" stroke="none"/>';
// A small gauge with a text badge underneath, for the air quality readings.
const BADGE_GAUGE = '<path d="M5.5 12.5a6.5 6.5 0 1 1 13 0"/><path d="m12 12.5 2.5-3.5"/>';
const label = (text, size = 6.5) => `<text x="12" y="21.5" fill="#000" stroke="none" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" text-anchor="middle">${text}</text>`;

export const SENSOR_CAPABILITY_ICONS = {
  // LICENSING: stand-in for the generic "measure" icon (any numeric reading without its own icon).
  measure: icon(GAUGE),
  // LICENSING: stand-in for "alarm_generic" (any alarm without its own icon).
  alarm_generic: icon(`${BELL}<path d="M12 9v3"/><circle cx="12" cy="14.4" r=".6" fill="#000"/>`),
  // LICENSING: stand-in for "measure_temperature".
  measure_temperature: icon(THERMOMETER),
  // LICENSING: stand-in for "measure_humidity".
  measure_humidity: icon(DROP),
  // LICENSING: stand-in for "measure_luminance".
  measure_luminance: icon(SUN),
  // LICENSING: stand-in for "measure_ultraviolet".
  measure_ultraviolet: icon(`<circle cx="12" cy="8.5" r="3"/><path d="M12 2.5v1.2M6 8.5h1.2M16.8 8.5H18M7.8 4.3l.8.8M15.4 5.1l.8-.8"/>${label('UV')}`),
  // LICENSING: stand-in for "measure_co2".
  measure_co2: icon(`${BADGE_GAUGE}${label('CO₂')}`),
  // LICENSING: stand-in for "measure_co".
  measure_co: icon(`${BADGE_GAUGE}${label('CO')}`),
  // LICENSING: stand-in for "measure_pm25".
  measure_pm25: icon(`${BADGE_GAUGE}${label('PM2.5', 5.5)}`),
  // LICENSING: stand-in for "measure_pm10" (homey-vectors-public has a measure_PM10 icon).
  measure_pm10: icon(`${BADGE_GAUGE}${label('PM10', 5.5)}`),
  // LICENSING: stand-in for "measure_pm1" (homey-vectors-public has a measure_PM1 icon).
  measure_pm1: icon(`${BADGE_GAUGE}${label('PM1')}`),
  // LICENSING: stand-in for "measure_tvoc" (homey-vectors-public has a measure_VOC icon).
  measure_tvoc: icon(`${BADGE_GAUGE}${label('VOC', 5.5)}`),
  // LICENSING: stand-in for "level_aqi".
  level_aqi: icon(`<path d="M7.5 13h9a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 7.8 6.5 3.2 3.2 0 0 0 7.5 13z"/>${label('AQI')}`),
  // LICENSING: stand-in for "measure_aqi".
  measure_aqi: icon(`<path d="M7.5 13h9a3.2 3.2 0 0 0 .4-6.4A4.8 4.8 0 0 0 7.8 6.5 3.2 3.2 0 0 0 7.5 13z"/>${label('AQI')}`),
  // LICENSING: stand-in for "measure_pressure".
  measure_pressure: icon(`${BADGE_GAUGE}${label('hPa', 5.5)}`),
  // LICENSING: stand-in for "measure_power".
  measure_power: icon(BOLT),
  // LICENSING: stand-in for "meter_power".
  meter_power: icon(`${BOLT}<path d="M4 21.5h16"/>`),
  // LICENSING: stand-in for "measure_voltage".
  measure_voltage: icon(`<circle cx="12" cy="12" r="8.5"/><path d="m8.5 8 3.5 8.5L15.5 8"/>`),
  // LICENSING: stand-in for "measure_current".
  measure_current: icon(`<circle cx="12" cy="12" r="8.5"/><path d="m8.5 16.5 3.5-9 3.5 9M9.7 13.5h4.6"/>`),
  // LICENSING: stand-in for "measure_noise".
  measure_noise: icon('<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  // LICENSING: stand-in for "measure_rain".
  measure_rain: icon('<path d="M7 14h10a3.5 3.5 0 0 0 .5-7A5.5 5.5 0 0 0 6.6 7.2 3.5 3.5 0 0 0 7 14z"/><path d="m8 17.5-1 2.5M12 17.5 11 20M16 17.5l-1 2.5"/>'),
  // LICENSING: stand-in for "measure_wind_strength".
  measure_wind_strength: icon('<path d="M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12.5h15a3 3 0 1 1-3 3M3 16.5h7"/>'),
  // LICENSING: stand-in for "measure_wind_angle".
  measure_wind_angle: icon('<circle cx="12" cy="12" r="8.5"/><path d="m12 6 2.5 6-2.5 6-2.5-6z"/>'),
  // LICENSING: stand-in for "meter_water".
  meter_water: icon(`${DROP}<path d="M9.5 15h5"/>`),
  // LICENSING: stand-in for "meter_gas".
  meter_gas: icon(FLAME),
  // LICENSING: stand-in for "alarm_motion".
  alarm_motion: icon(`${PERSON}<path d="M4 9a5 5 0 0 0 0 6M20 9a5 5 0 0 1 0 6"/>`),
  // LICENSING: stand-in for "alarm_presence".
  alarm_presence: icon(PERSON),
  // LICENSING: stand-in for "alarm_occupancy".
  alarm_occupancy: icon(PERSON),
  // LICENSING: stand-in for "alarm_contact".
  alarm_contact: icon('<path d="M5 21.5V3.5h10v18M3 21.5h18"/><path d="M15 4.5 19 6v14l-4 1.5"/><circle cx="12.5" cy="12.5" r=".7" fill="#000"/>'),
  // LICENSING: stand-in for "alarm_water".
  alarm_water: icon(`<path d="M10 3.5s4.5 5 4.5 8.5a4.5 4.5 0 0 1-9 0C5.5 8.5 10 3.5 10 3.5z"/>${WARNING}`),
  // LICENSING: stand-in for "alarm_rain" (homey-vectors-public has an alarm_rain icon; the iPad shows drops with a warning triangle).
  alarm_rain: icon(`<path d="M7.5 4s3 3.3 3 5.6a3 3 0 0 1-6 0C4.5 7.3 7.5 4 7.5 4z"/><path d="M14 6.5s2.4 2.6 2.4 4.4a2.4 2.4 0 0 1-4.8 0c0-1.8 2.4-4.4 2.4-4.4z"/>${WARNING}`),
  // LICENSING: stand-in for "alarm_smoke".
  alarm_smoke: icon('<path d="M6 19.5h12M8 16c-2-2 1-3.5-.5-5.5M12 16c-2-2 1-3.5-.5-5.5M16 16c-2-2 1-3.5-.5-5.5"/><path d="M7 7.5a3 3 0 0 1 5-2 3.5 3.5 0 0 1 5.5 2"/>'),
  // LICENSING: stand-in for "alarm_fire".
  alarm_fire: icon(FLAME),
  // LICENSING: stand-in for "alarm_heat".
  alarm_heat: icon(`${THERMOMETER}${WARNING}`),
  // LICENSING: stand-in for "alarm_co".
  alarm_co: icon(`${BADGE_GAUGE}${label('CO')}`),
  // LICENSING: stand-in for "alarm_co2".
  alarm_co2: icon(`${BADGE_GAUGE}${label('CO₂')}`),
  // LICENSING: stand-in for "alarm_battery".
  alarm_battery: icon('<rect x="2.5" y="7" width="16" height="10" rx="2"/><path d="M21.5 10.5v3M7 12h6"/>'),
  // LICENSING: stand-in for "alarm_tamper".
  alarm_tamper: icon('<path d="M12 2.5 4.5 5.6v5.6c0 4.6 3.2 8.8 7.5 10.3 4.3-1.5 7.5-5.7 7.5-10.3V5.6z"/><path d="M12 8v4.5"/><circle cx="12" cy="15.6" r=".7" fill="#000"/>'),
  // LICENSING: stand-in for "alarm_vibration".
  alarm_vibration: icon('<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3"/>'),
};
