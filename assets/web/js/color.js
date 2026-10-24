// Colour conversions and the Homey web app's light colour formulas.

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toHex = (r, g, b) => `#${[r, g, b].map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function hsvToHex(hue, saturation, value) {
  const f = (n) => {
    const k = (n + hue / 60) % 6;
    return value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return toHex(f(5) * 255, f(3) * 255, f(1) * 255);
}

export function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === r / 255) hue = 60 * (((g - b) / 255 / delta) % 6);
    else if (max === g / 255) hue = 60 * ((b - r) / 255 / delta + 2);
    else hue = 60 * ((r - g) / 255 / delta + 4);
  }
  return { hue: (hue + 360) % 360, saturation: max === 0 ? 0 : delta / max };
}

// Raise HSL lightness by `amount` percentage points (tinycolor's lighten).
export function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let hue = 0;
  let saturation = 0;
  let lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    hue = max === rn ? (gn - bn) / delta + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4;
    hue /= 6;
  }
  lightness = clamp(lightness + amount / 100, 0, 1);
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (t) => {
    const x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return saturation === 0
    ? toHex(lightness * 255, lightness * 255, lightness * 255)
    : toHex(channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255);
}

// The web app's colour for a light_temperature (0 = cool, 1 = warm).
export function temperatureHex(temperature) {
  if (temperature < 0.125) return toHex(207, 255, 255);
  return toHex(
    temperature >= 0.5 ? 255 : 285 * temperature ** 0.154,
    temperature <= 0.5 ? 255 : 217 * temperature ** -0.234,
    temperature <= 0.5 ? 255 : 116 * temperature ** -1.2,
  );
}

export function temperatureSelectorColor(temperature) {
  if (temperature < 0.5) return `hsl(181 100% ${90 + temperature * 20}%)`;
  if (temperature > 0.5) return `hsl(42 100% ${75 + (1 - temperature) * 50}%)`;
  return '#ffffff';
}

export function lightMode(device) {
  const capabilities = device.capabilitiesObj ?? {};
  if (capabilities.light_mode?.value != null) return capabilities.light_mode.value;
  if (!capabilities.light_temperature && capabilities.light_hue && capabilities.light_saturation) return 'color';
  return 'temperature';
}

export function lightHex(device, mode = lightMode(device)) {
  const capabilities = device.capabilitiesObj ?? {};
  if (mode === 'color' && capabilities.light_hue) {
    return hsvToHex((capabilities.light_hue.value ?? 0) * 360, capabilities.light_saturation?.value ?? 1, 1);
  }
  if (capabilities.light_temperature) return temperatureHex(capabilities.light_temperature.value ?? 0.5);
  return null;
}
