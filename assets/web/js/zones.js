// Zone helpers: the zone tree, its devices, climate averages and zone icons.

import { isClass } from './devices.js';
import { el, maskIcon } from './dom.js';
import { state } from './state.js';

export function zoneSubtree(zoneId) {
  const ids = new Set([zoneId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const zone of Object.values(state.data.zones)) {
      if (zone.parent && ids.has(zone.parent) && !ids.has(zone.id)) {
        ids.add(zone.id);
        grew = true;
      }
    }
  }
  return ids;
}

export const average = (numbers) => numbers.reduce((sum, number) => sum + number, 0) / numbers.length;

// Zone icon ids map onto the zone artwork that Homey's own web app serves at /web/img/zones/
// (the mapping is the web app's). Loading it from the Homey means the app doesn't redistribute it.
const zoneIconBase = () => `${state.client.base}/web/img/zones/`;

const ZONE_ICON_FILES = {
  firstFloor: 'first-floor', groundFloor: 'ground-floor', officeBuildings: 'office-buildings', singleFloor: 'single-floor',
  topFloor: 'top-floor', home: 'home', 'stairs-down': 'basement', basement: 'basement', 'stairs-up': 'floor', floor: 'floor',
  roof: 'attic', attic: 'attic', roofSolar: 'roof_solar_panels', garage: 'garage', pool: 'pool', garden: 'garden',
  gardenShed: 'garden_shed', terrace: 'terrace', carport: 'carport', hallway: 'hallway', living: 'living_room',
  livingRoom: 'living_room', kitchen: 'kitchen', diningRoom: 'dining_room', bedroomSingle: 'bedroom', bed: 'master_bedroom',
  bedroomDouble: 'master_bedroom', bedroomKids: 'kinder_room', shower: 'bathroom', bathroom: 'bathroom', office: 'office',
  gym: 'gym', toilet: 'toilet', entrance: 'entrance_front_door', books: 'study_room', studyRoom: 'study_room',
  gameRoom: 'game_room', utilitiesRoom: 'utilities_room', recreationRoom: 'recreation_room', tipi: 'tipi_tent',
  wardrobe: 'wardrobe', doorClosed: 'door-closed', lounge: 'lounge-chair', fuseBox: 'lightning-bolt',
  laundryRoom: 'laundry-basket', phone: 'phone', coffeeMachine: 'coffee-machine', drinks: 'drinks', pantry: 'pantry',
  suitcase: 'suitcase', door: 'door', toothbrush: 'toothbrush', sink: 'sink',
};

export function zoneIcon(zone, small = false) {
  const square = el('span', small ? 'zone-square is-small' : 'zone-square');
  square.append(maskIcon(`${zoneIconBase()}${ZONE_ICON_FILES[zone?.icon] ?? 'zone'}.svg`));
  return square;
}

export function zoneChildren(zoneId) {
  return Object.values(state.data.zones)
    .filter((zone) => zone.parent === zoneId)
    .sort((a, b) => (a.sortIndex ?? Infinity) - (b.sortIndex ?? Infinity) || a.name.localeCompare(b.name));
}

// The zone followed by its sub-zones, depth first in Homey's order.
export function zoneOrder(zoneId) {
  const zone = state.data.zones[zoneId];
  return zone ? [zone, ...zoneChildren(zoneId).flatMap((child) => zoneOrder(child.id))] : [];
}

// Devices in a zone. Group members are left out: their group stands in for them, as in the app.
export function zoneDevices(zoneId, { recursive = true } = {}) {
  const zones = recursive ? zoneSubtree(zoneId) : new Set([zoneId]);
  return Object.values(state.data.devices).filter((device) => zones.has(device.zone) && !device.group);
}

export function zoneClimate(devices) {
  const sensors = devices.filter((device) => isClass(device, 'sensor', 'thermostat'));
  const readings = (capabilityId) => sensors
    .map((device) => device.capabilitiesObj?.[capabilityId]?.value)
    .filter((reading) => typeof reading === 'number');
  const temperatures = readings('measure_temperature');
  const humidities = readings('measure_humidity');
  return {
    temperature: temperatures.length ? average(temperatures) : null,
    humidity: humidities.length ? average(humidities) : null,
  };
}
