// User avatars and the presence sheet.

import { requireData } from '../data.js';
import { el, initials } from '../dom.js';
import { PRESENCE_ICONS } from '../icons.js';
import { subscribe } from '../realtime.js';
import { state } from '../state.js';

// Every rendered avatar and the open profile sheet re-render from state.data.users.
const presenceViews = new Set();

function refreshPresence() {
  for (const view of presenceViews) view();
}

export function mountUsers({ body }) {
  if (!requireData(body, 'users')) return;
  const row = el('div', 'avatar-row');
  body.append(row);

  // Athom avatars redirect to a placeholder when none is set, so show initials like the mobile app.
  const views = Object.values(state.data.users)
    .filter((user) => user.enabled !== false)
    .map((user) => {
      const avatar = el('button', 'avatar', initials(user.name ?? ''));
      avatar.type = 'button';
      avatar.addEventListener('click', () => openProfile(user.id));
      row.append(avatar);
      const view = () => {
        const current = state.data.users[user.id];
        avatar.classList.toggle('is-away', current.present === false);
        avatar.setAttribute('aria-label', `${current.name}, ${current.present === false ? 'away' : current.asleep ? 'asleep' : 'at home'}`);
      };
      view();
      presenceViews.add(view);
      return view;
    });

  const stop = subscribe('homey:manager:users', 'user.update', (user) => {
    if (state.data.users[user?.id] == null) return;
    state.data.users[user.id] = { ...state.data.users[user.id], ...user };
    refreshPresence();
  });
  return () => {
    stop();
    for (const view of views) presenceViews.delete(view);
  };
}

let profileDialog = null;

function openProfile(userId) {
  profileDialog?.remove();
  const dialog = el('dialog', 'profile');
  profileDialog = dialog;
  const avatar = el('div', 'avatar');
  const name = el('h2', 'profile-name');
  const error = el('p', 'profile-error');
  error.setAttribute('role', 'alert');

  const segmented = (key, options) => {
    const group = el('div', 'segmented');
    group.setAttribute('role', 'group');
    const buttons = options.map(({ value, label, icon }) => {
      const button = el('button', 'segment');
      button.type = 'button';
      button.innerHTML = icon;
      button.append(label);
      button.addEventListener('click', () => setPresence(userId, key, value, error));
      group.append(button);
      return { button, value };
    });
    return { group, buttons };
  };
  const presence = segmented('present', [
    { value: true, label: 'At home', icon: PRESENCE_ICONS.home },
    { value: false, label: 'Away', icon: PRESENCE_ICONS.away },
  ]);
  const sleep = segmented('asleep', [
    { value: false, label: 'Awake', icon: PRESENCE_ICONS.awake },
    { value: true, label: 'Asleep', icon: PRESENCE_ICONS.asleep },
  ]);

  const done = el('button', 'profile-done', 'Done');
  done.type = 'button';
  done.addEventListener('click', () => dialog.close());
  dialog.append(avatar, name, presence.group, sleep.group, error, done);

  const view = () => {
    const user = state.data.users[userId];
    avatar.textContent = initials(user.name ?? '');
    name.textContent = user.name;
    for (const { button, value } of presence.buttons) button.setAttribute('aria-pressed', String(user.present === value));
    for (const { button, value } of sleep.buttons) button.setAttribute('aria-pressed', String(user.asleep === value));
  };
  view();
  presenceViews.add(view);

  // Clicking the backdrop closes the sheet, like tapping outside it in the app.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    presenceViews.delete(view);
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
}

async function setPresence(userId, key, value, errorNode) {
  const user = state.data.users[userId];
  if (user[key] === value) return;
  const previous = user[key];
  user[key] = value;
  errorNode.textContent = '';
  refreshPresence();
  // Your own presence only needs homey.presence.self; other people need homey.presence.
  const target = userId === state.me?.id ? 'me' : encodeURIComponent(userId);
  try {
    await state.client.api('PUT', `/api/manager/presence/${target}/${key}`, { value });
  } catch (error) {
    user[key] = previous;
    errorNode.textContent = error.message;
    refreshPresence();
  }
}
