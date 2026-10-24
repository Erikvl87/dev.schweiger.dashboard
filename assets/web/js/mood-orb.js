// A mood's orb: the colours the mood gives its lights, sorted by hue and blended into a blurred diagonal gradient in a
// circle. This follows how the Homey web app draws its mood icons (re-implemented here, not copied).

import { hexToHsv, temperatureHex } from './color.js';

// A mood without lights that turn on: a dark blue-grey orb on black.
const EMPTY = [{ hue: 232, saturation: 0.2, value: 0.05 }, { hue: 240, saturation: 0.25, value: 0.21 }];
const MIX_LIGHTEN = 2.5;
let orbCount = 0;

// The colour each light is set to; lights the mood turns off don't count. Anything without a light mode counts as warm white.
function moodColors(mood) {
  const colors = [];
  for (const { state = {} } of Object.values(mood.devices ?? {})) {
    if (state.onoff === false) continue;
    if (state.light_mode === 'color') {
      colors.push({ hue: (state.light_hue ?? 0) * 360, saturation: state.light_saturation ?? 1, value: 1 });
    } else {
      const temperature = state.light_mode === 'temperature' ? (state.light_temperature ?? 1) : 1;
      colors.push({ ...hexToHsv(temperatureHex(temperature)), value: 1 });
    }
  }
  return colors;
}

// Fully saturated HSL: paler colours get lighter; the HSV value becomes the opacity.
const toHsla = ({ hue, saturation, value }) => ({ hue, saturation: 100, lightness: 100 - 50 * saturation, alpha: value });

// The colour between two others, averaged on the colour wheel: the further apart they are, the paler the result.
function between(a, b) {
  const point = (color) => {
    const angle = (color.hue * Math.PI) / 180;
    return [Math.cos(angle) * color.saturation, Math.sin(angle) * color.saturation];
  };
  const [ax, ay] = point(a);
  const [bx, by] = point(b);
  const x = (ax + bx) / 2;
  const y = (ay + by) / 2;
  const length = Math.hypot(x, y);
  return {
    hue: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    saturation: 100,
    lightness: (a.lightness + b.lightness) / 2 + (100 - length) / MIX_LIGHTEN,
    alpha: (a.alpha + b.alpha) / 2,
  };
}

function gradientStops(colors) {
  if (colors.length === 1) {
    const [color] = colors;
    return [
      { ...color, hue: color.hue - 10, lightness: Math.max(0, color.lightness - 5) },
      color,
      { ...color, hue: color.hue + 10, lightness: Math.min(100, color.lightness + 10) },
    ];
  }
  // The ends get extra weight; neighbours are joined by their blend.
  return colors.flatMap((color, index) => {
    const end = index === 0 || index === colors.length - 1;
    const stops = end ? [color, color, color] : [color];
    return index < colors.length - 1 ? [...stops, between(color, colors[index + 1])] : stops;
  });
}

export function moodOrb(mood, size = 34) {
  const lights = moodColors(mood);
  const empty = lights.length === 0;
  const stops = gradientStops((empty ? EMPTY : lights).map(toHsla).sort((a, b) => a.hue - b.hue));
  const id = `mood-orb-${(orbCount += 1)}`;
  const half = size / 2;
  const node = document.createElement('span');
  node.className = 'mood-orb';
  node.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <filter id="${id}-blur"><feGaussianBlur stdDeviation="${size / 6}"/><feComposite operator="over" in2="SourceGraphic"/></filter>
      <linearGradient id="${id}-fill" x1="0%" y1="100%" x2="100%" y2="0%">${stops.map((stop, index) => `<stop offset="${(index / stops.length) * 100}%" stop-color="hsl(${stop.hue} ${stop.saturation}% ${stop.lightness}%)" stop-opacity="${stop.alpha}"/>`).join('')}</linearGradient>
      <clipPath id="${id}-clip"><circle cx="${half}" cy="${half}" r="${half}"/></clipPath>
    </defs>
    ${empty ? `<circle cx="${half}" cy="${half}" r="${half}" fill="#000000"/>` : ''}
    <rect width="${size}" height="${size}" fill="url(#${id}-fill)" clip-path="url(#${id}-clip)" filter="url(#${id}-blur)"/>
  </svg>`;
  return node;
}
