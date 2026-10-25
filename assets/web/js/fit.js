// Fit to width: instead of scrolling sideways, the board shrinks until all columns fit the window. Columns keep their
// full-size layout and are zoomed as a whole, so widgets look the same, only smaller. Never zooms in.
// Turned on per browser in Settings, or for one address with ?fit.

import { $ } from './dom.js';
import { STORAGE_KEY, params } from './state.js';

const FIT_KEY = `${STORAGE_KEY}:fit`;

let fit = false;

function readStored() {
  try {
    return localStorage.getItem(FIT_KEY) === 'true';
  } catch {
    return false;
  }
}

function store() {
  try {
    if (fit) localStorage.setItem(FIT_KEY, 'true');
    else localStorage.removeItem(FIT_KEY);
  } catch {
    // Storage can be unavailable (private mode); fitting then lasts for this visit.
  }
}

// Call after the board's columns change. Measures the board at full size, then zooms it to the window's width.
export function fitBoard() {
  const board = $('board');
  board.style.zoom = '';
  if (!fit) return;
  const scale = Math.min(1, board.clientWidth / board.scrollWidth);
  if (scale < 1) board.style.zoom = String(scale);
}

export function isFit() {
  return fit;
}

export function setFit(on) {
  fit = on;
  store();
  document.documentElement.classList.toggle('fit', fit);
  fitBoard();
}

export function initFit() {
  fit = readStored() || params.has('fit');
  document.documentElement.classList.toggle('fit', fit);
  addEventListener('resize', fitBoard);
}
