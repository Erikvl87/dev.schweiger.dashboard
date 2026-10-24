// Notification timeline and its full-history popup.

import { requireData } from '../data.js';
import { el, initials, note } from '../dom.js';
import { BELL_ICON, CHEVRON_DOWN, SHIELD_ICON } from '../icons.js';
import { subscribe } from '../realtime.js';
import { state } from '../state.js';

// Entries shown before "View all": the large widget and the small one (notifications_timeline_small).
const TIMELINE_COLLAPSED = 6;
const TIMELINE_COLLAPSED_SMALL = 3;

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function mountTimeline({ body, small = false }) {
  const shown = small ? TIMELINE_COLLAPSED_SMALL : TIMELINE_COLLAPSED;
  if (!requireData(body, 'notifications')) return;
  let items = Object.values(state.data.notifications).sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
  let renderDialog = null;

  // The small widget is larger type with plain names and "an hour ago" times, as in the app.
  const list = el('div', small ? 'timeline is-small' : 'timeline');
  const more = el('button', 'timeline-more', 'View all ›');
  more.type = 'button';
  // Like the app, the full history opens in a popup instead of growing the widget.
  more.addEventListener('click', () => {
    renderDialog = openTimelineDialog(() => items, () => {
      renderDialog = null;
    });
  });
  body.append(list, more);

  function render() {
    list.replaceChildren(...items.slice(0, shown).map((item) => renderNotification(item, { small })));
    if (items.length === 0) note(list, 'No notifications yet.');
    more.hidden = items.length === 0;
    renderDialog?.();
  }

  const cleanups = [
    subscribe('homey:manager:notifications', 'notification.create', (notification) => {
      items = [notification, ...items.filter((item) => item.id !== notification.id)];
      render();
    }),
    subscribe('homey:manager:notifications', 'notification.delete', ({ id }) => {
      items = items.filter((item) => item.id !== id);
      render();
    }),
  ];
  // Keeps relative times like "2 hours ago" current.
  const timer = setInterval(render, 60_000);
  render();

  return () => {
    cleanups.forEach((cleanup) => cleanup());
    clearInterval(timer);
  };
}

function openTimelineDialog(getItems, onClose) {
  const dialog = el('dialog', 'timeline-dialog');
  const header = el('div', 'sheet-header');
  const close = el('button', 'sheet-close');
  close.type = 'button';
  close.innerHTML = CHEVRON_DOWN;
  close.setAttribute('aria-label', 'Close');
  close.addEventListener('click', () => dialog.close());
  header.append(close, el('h2', 'sheet-title', 'Timeline'));
  const scroller = el('div', 'timeline-scroll');
  const list = el('div', 'timeline');
  scroller.append(list);
  dialog.append(header, scroller);

  const render = () => {
    const items = getItems();
    list.replaceChildren(...items.map(renderNotification));
    if (items.length === 0) note(list, 'No notifications yet.');
  };
  render();

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    onClose();
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
  return render;
}

function renderNotification(notification, { small = false } = {}) {
  const item = el('div', 'timeline-item');
  const avatar = el('div', 'timeline-avatar');
  const ownerUri = notification.ownerUri ?? '';
  // The excerpt marks names with **bold**; odd segments are the bold parts.
  const segments = String(notification.excerpt ?? '').split(/\*\*(.+?)\*\*/);

  if (ownerUri === 'homey:manager:presence') {
    avatar.classList.add('is-user');
    avatar.textContent = initials(segments[1] ?? notification.ownerName ?? '');
  } else if (ownerUri.startsWith('homey:app:')) {
    const icon = el('span', 'mask-icon');
    icon.style.setProperty('--icon', `url("${state.client.base}/app/${encodeURIComponent(ownerUri.slice('homey:app:'.length))}/assets/icon.svg")`);
    avatar.append(icon);
  } else {
    avatar.innerHTML = ownerUri === 'homey:manager:security' ? SHIELD_ICON : BELL_ICON;
  }

  const text = el('div', 'timeline-text');
  const message = el('div');
  segments.forEach((segment, index) => message.append(index % 2 && !small ? el('strong', null, segment) : segment));
  const date = new Date(notification.dateCreated);
  text.append(message, el('div', 'timeline-time', small ? humanizeTime(date) : formatRelativeTime(date)));
  item.append(avatar, text);
  return item;
}

// "32 minutes ago", "an hour ago", "3 days ago": the rounding the app uses in the small timeline.
function humanizeTime(date) {
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  if (seconds < 45) return 'a few seconds ago';
  if (seconds < 90) return 'a minute ago';
  if (minutes < 45) return `${Math.round(minutes)} minutes ago`;
  if (minutes < 90) return 'an hour ago';
  if (hours < 22) return `${Math.round(hours)} hours ago`;
  if (hours < 36) return 'a day ago';
  if (days < 26) return `${Math.round(days)} days ago`;
  if (days < 45) return 'a month ago';
  if (days < 320) return `${Math.round(days / 30.4)} months ago`;
  if (days < 548) return 'a year ago';
  return `${Math.round(days / 365)} years ago`;
}

function formatRelativeTime(date) {
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3600_000) return relativeTime.format(-Math.floor(elapsed / 60_000), 'minute');
  if (elapsed < 3 * 3600_000) return relativeTime.format(-Math.floor(elapsed / 3600_000), 'hour');
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (date >= startOfToday) return `Today at ${time}`;
  if (date.getTime() >= startOfToday.getTime() - 86_400_000) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} at ${time}`;
}
