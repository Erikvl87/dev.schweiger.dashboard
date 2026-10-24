// A web page in a frame (web_frame), with the app's settings: frame height (default square, or fixed),
// a scroll position the page is shown from, scrolling on or off (off by default), and automatic reload.
// A page on this Homey's own origin is framed without same-origin rights, so it can't read the dashboard's stored key;
// other sites keep their own origin, which can't reach this page anyway. Sites that send X-Frame-Options or
// frame-ancestors (Google, for one) refuse to be framed at all, which no attribute here can change.

import { el, note } from '../dom.js';

// height: { type, value }. Without it the frame is square. Type 1 is a fixed height in the app's units, which scale
// with the column: 200 shows 243 px tall in a 437 px wide column, i.e. as if the column were 360 units wide.
// Other types (a ratio) haven't been seen yet; a "16:9"-like value is read as a ratio.
const APP_COLUMN_UNITS = 360;

function applyFrameHeight(box, height) {
  const value = height?.value;
  if (value == null || value === '') return;
  const ratio = String(value).match(/^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/);
  if (ratio) box.style.aspectRatio = `${ratio[1]} / ${ratio[2]}`;
  else if (height.type === 1 && Number(value) > 0) box.style.aspectRatio = `${APP_COLUMN_UNITS} / ${Number(value)}`;
}

export function mountWebFrame({ body, widget }) {
  const data = widget.data ?? {};
  let url;
  try {
    url = new URL(data.url ?? '');
  } catch {
    return note(body, 'This web page has no valid address.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return note(body, 'Only http and https pages can be shown.');

  const box = el('div', 'web-frame');
  applyFrameHeight(box, data.height);
  const frame = el('iframe');
  frame.title = url.hostname;
  frame.referrerPolicy = 'no-referrer';
  const sandbox = ['allow-scripts', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox'];
  if (url.origin !== location.origin) sandbox.push('allow-same-origin');
  frame.setAttribute('sandbox', sandbox.join(' '));
  if (data.scrollEnabled !== true) frame.setAttribute('scrolling', 'no');
  // Another site's page can't be scrolled from here, so the frame is made taller and moved up instead.
  const offset = Math.max(0, Number(data.scrollPosition) || 0);
  if (offset > 0) {
    frame.style.top = `${-offset}px`;
    frame.style.height = `calc(100% + ${offset}px)`;
  }
  frame.src = url.href;
  box.append(frame);
  body.append(box);

  const refresh = data.refresh;
  if (!refresh?.enabled || !(Number(refresh.interval) > 0)) return undefined;
  const timer = setInterval(() => {
    frame.src = url.href;
  }, Math.max(10, Number(refresh.interval)) * 1000);
  return () => clearInterval(timer);
}
