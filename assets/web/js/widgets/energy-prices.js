// Today's dynamic electricity prices (energy_dynamic_prices): the current price and a bar per interval.
// Only shown when the Homey's electricity price type is "dynamic"; otherwise it says so, like the app.

import { el, note } from '../dom.js';
import { WARNING_ICON } from '../icons.js';
import { state } from '../state.js';

const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function mountEnergyPrices({ body }) {
  const card = el('div', 'panel energy-prices');
  body.append(card);
  let prices = null;
  let loadedFor = null;

  const formatPrice = (value) => (value == null ? '–' : `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })} ${prices?.priceUnit ?? ''}`.trim());

  function render() {
    const intervals = prices?.pricesPerInterval ?? [];
    if (intervals.length === 0) {
      card.replaceChildren();
      return note(card, 'No prices for today yet.');
    }
    const now = Date.now();
    const current = intervals.find((p) => Date.parse(p.periodStart) <= now && now < Date.parse(p.periodEnd));
    const values = intervals.map((p) => p.value);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const head = el('div', 'prices-head');
    head.append(el('div', 'prices-now', formatPrice(current?.value)), el('div', 'panel-sub', `per ${prices.measureUnit ?? 'kWh'} now`));
    const bars = el('div', 'prices-bars');
    for (const period of intervals) {
      const bar = el('span', period === current ? 'prices-bar is-now' : 'prices-bar');
      bar.style.height = `${8 + ((period.value - min) / range) * 92}%`;
      bar.title = `${new Date(period.periodStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${formatPrice(period.value)}`;
      bars.append(bar);
    }
    const summary = el('div', 'panel-sub', `Low ${formatPrice(Math.min(...values))} · High ${formatPrice(Math.max(...values))}`);
    card.replaceChildren(head, bars, summary);
  }

  async function load() {
    const today = localDate(new Date());
    try {
      const type = await state.client.api('GET', '/api/manager/energy/price/electricity/type');
      if (type !== 'dynamic') {
        const icon = el('span', 'prices-empty-icon');
        icon.innerHTML = WARNING_ICON;
        card.replaceChildren(icon, el('div', 'prices-empty-text', "Dynamic pricing isn't enabled."));
        card.classList.add('is-empty');
        return;
      }
      card.classList.remove('is-empty');
      if (loadedFor !== today) {
        prices = await state.client.api('GET', `/api/manager/energy/price/electricity/dynamic?date=${today}`);
        loadedFor = today;
      }
      render();
    } catch (error) {
      card.replaceChildren();
      note(card, `Prices unavailable: ${error.message}`, true);
    }
  }
  load();
  // Moves the "now" marker along and fetches the next day after midnight.
  const timer = setInterval(load, 5 * 60_000);
  return () => clearInterval(timer);
}
