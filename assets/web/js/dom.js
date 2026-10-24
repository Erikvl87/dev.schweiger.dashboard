// Small DOM and UI helpers shared by every widget.

export const $ = (id) => document.getElementById(id);

export const darkQuery = matchMedia('(prefers-color-scheme: dark)');

export function isDarkMode() {
  const theme = document.documentElement.dataset.theme;
  return theme ? theme === 'dark' : darkQuery.matches;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function note(parent, text, isError = false) {
  parent.append(el('div', isError ? 'note is-error' : 'note', text));
}

let toastTimer;

export function toast(text) {
  document.querySelector('.toast')?.remove();
  const node = el('div', 'toast', text);
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 4000);
}

// A range input's position as a 0–1 fraction; the CSS ends the fill at the thumb's centre.
export function paintSlider(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  input.style.setProperty('--fill', String((Number(input.value) - min) / (max - min || 1)));
}

export function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
}

export function maskIcon(url, className = '') {
  const node = el('span', `mask-icon ${className}`);
  node.style.setProperty('--icon', `url("${url}")`);
  return node;
}

// A short ripple from the press point, like the web app's quick actions and moods.
export function pulse(button) {
  const ring = el('span', 'pulse');
  button.append(ring);
  ring.addEventListener('animationend', () => ring.remove());
}
