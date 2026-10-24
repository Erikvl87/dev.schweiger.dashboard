// Weather: current conditions (weather), and with a six-day forecast (weather_forecast).

import { DATA_SOURCES, requireData } from '../data.js';
import { el } from '../dom.js';
import { state } from '../state.js';

const WEATHER_PARTS = {
  sun: '<circle cx="12" cy="12" r="4.5" fill="#ffc83d"/><path stroke="#ffc83d" stroke-width="2" stroke-linecap="round" d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path fill="#eef2f6" d="M14.5 3a8.5 8.5 0 1 0 6.5 13.2A9 9 0 0 1 14.5 3z"/>',
  smallSun: '<circle cx="8.5" cy="8" r="3.4" fill="#ffc83d"/><path stroke="#ffc83d" stroke-width="1.6" stroke-linecap="round" d="M8.5 2v1.4M2.5 8h1.4M4.3 3.8l1 1M12.7 3.8l-1 1"/>',
  smallMoon: '<path fill="#eef2f6" d="M9.5 3a5 5 0 1 0 4 8 5.5 5.5 0 0 1-4-8z"/>',
  cloud: '<path fill="#eef2f6" d="M7 19h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 10.1 4.5 4.5 0 0 0 7 19z"/>',
  highCloud: '<path fill="#eef2f6" d="M7 15.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 6.6 4.5 4.5 0 0 0 7 15.5z"/>',
  rain: '<path stroke="#8cc8ff" stroke-width="1.8" stroke-linecap="round" d="M8.5 18 7.5 21M12.5 18l-1 3M16.5 18l-1 3"/>',
  snow: '<g fill="#ffffff"><circle cx="8" cy="19.5" r="1.2"/><circle cx="12" cy="21" r="1.2"/><circle cx="16" cy="19.5" r="1.2"/></g>',
  bolt: '<path fill="#ffc83d" d="M12.8 15.5 10 20h2.4l-1.2 3.5 3.8-5h-2.4l1.4-3z"/>',
  fog: '<path stroke="#eef2f6" stroke-width="1.8" stroke-linecap="round" d="M4 9h16M6 13h12M4 17h16"/>',
};

function weatherIcon(iconId = '') {
  const night = iconId.endsWith('_night');
  const parts = (() => {
    if (iconId.startsWith('clear')) return [night ? 'moon' : 'sun'];
    if (iconId.startsWith('clouds_light')) return [night ? 'smallMoon' : 'smallSun', 'cloud'];
    if (iconId.startsWith('clouds')) return ['cloud'];
    if (iconId.startsWith('rain') || iconId.startsWith('drizzle') || iconId.startsWith('shower')) return ['highCloud', 'rain'];
    if (iconId.startsWith('snow') || iconId.startsWith('sleet')) return ['highCloud', 'snow'];
    if (iconId.startsWith('thunder') || iconId.startsWith('storm')) return ['highCloud', 'bolt'];
    if (iconId.startsWith('fog') || iconId.startsWith('mist') || iconId.startsWith('haze')) return ['fog'];
    return ['cloud'];
  })();
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${parts.map((part) => WEATHER_PARTS[part]).join('')}</svg>`;
}

// The Homey app prints temperatures as they come (9.62°), not rounded to one decimal.
const degrees = (value) => (value == null ? '–' : `${Math.round(Number(value) * 100) / 100}°`);
const wholeDegrees = (value) => (value == null ? '–' : `${Math.round(Number(value))}°`);

export function mountWeather({ body }) {
  return mountWeatherCard(body, { forecast: true });
}

export function mountCurrentWeather({ body }) {
  return mountWeatherCard(body, { forecast: false });
}

function mountWeatherCard(body, { forecast }) {
  if (!requireData(body, 'weather')) return;
  const card = el('div', forecast ? 'weather' : 'weather is-current');
  body.append(card);

  const render = (weather) => {
    const [from, to] = weather.colors ?? [];
    if (from && to) {
      card.style.setProperty('--weather-from', `rgb(${from.r} ${from.g} ${from.b})`);
      card.style.setProperty('--weather-to', `rgb(${to.r} ${to.g} ${to.b})`);
    }
    card.innerHTML = `
      <div class="weather-head">
        <div>
          <div class="weather-state"></div>
          <div class="weather-range"><span>↑ ${degrees(weather.temperatureMax)}</span><span class="weather-low">↓ ${degrees(weather.temperatureMin)}</span></div>
        </div>
        <div class="weather-now">${weatherIcon(weather.iconId)}<span>${degrees(weather.temperature)}</span></div>
      </div>
      <div class="weather-days"></div>`;
    card.querySelector('.weather-state').textContent = weather.state ?? '';
    const days = card.querySelector('.weather-days');
    days.hidden = !forecast;
    for (const day of forecast ? (weather.forecast ?? []).slice(0, 6) : []) {
      const node = el('div', 'weather-day');
      node.append(el('span', 'day-name', new Date(day.time * 1000).toLocaleDateString('en', { weekday: 'short' })));
      node.insertAdjacentHTML('beforeend', weatherIcon(day.iconId));
      node.append(el('span', 'day-max', wholeDegrees(day.temperatureMax)), el('span', 'day-min', wholeDegrees(day.temperatureMin)));
      days.append(node);
    }
  };
  render(state.data.weather);

  // Homey refreshes the forecast every few minutes and doesn't push it.
  const timer = setInterval(() => {
    state.client.api('GET', DATA_SOURCES.weather).then(render).catch(() => {});
  }, 15 * 60_000);
  return () => clearInterval(timer);
}
