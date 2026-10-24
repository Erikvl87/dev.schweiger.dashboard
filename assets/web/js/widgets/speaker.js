// Speaker with album art, transport and volume; the compact variant (device_speaker_small) has only
// previous / play / next next to the cover.

import { findDevice, putCapability, setCapability, watchDevice } from '../devices.js';
import { el, paintSlider } from '../dom.js';
import { MEDIA_ICONS } from '../icons.js';
import { state } from '../state.js';

const REPEAT_MODES = ['none', 'track', 'playlist'];

export function mountSpeaker({ body, widget, compact = false }) {
  const device = findDevice(body, widget.data?.speakerId);
  if (device == null) return;
  const capabilities = device.capabilitiesObj ?? {};
  const artImage = (device.images?.find((image) => image.id === 'albumart') ?? device.images?.find((image) => image.type === 'media'))?.imageObj;

  // On the cover's blurred colours the speaker is dark with white text; without a cover it is a normal panel.
  const panel = el('div', compact ? 'speaker is-compact' : 'speaker');
  const backdrop = el('div', 'speaker-backdrop');
  const inner = el('div', 'speaker-body');
  const top = el('div', 'speaker-top');
  // A music note until the cover has loaded; it stays when there is no cover or it fails to load (radio, say).
  const art = el('div', 'speaker-art');
  art.innerHTML = MEDIA_ICONS.note;
  const cover = el('img');
  cover.alt = '';
  cover.hidden = true;
  cover.addEventListener('load', () => {
    cover.hidden = false;
    panel.classList.add('has-art');
    backdrop.style.setProperty('--art', `url("${cover.src}")`);
  });
  cover.addEventListener('error', () => {
    cover.hidden = true;
    panel.classList.remove('has-art');
    backdrop.style.removeProperty('--art');
  });
  art.append(cover);
  const meta = el('div', 'speaker-meta');
  const track = el('div', 'speaker-track');
  const artist = el('div', 'speaker-artist');
  // The web app's equaliser bars, animated while the speaker plays.
  const equalizer = el('span', 'eq');
  equalizer.setAttribute('aria-hidden', 'true');
  equalizer.innerHTML = '<span></span>'.repeat(5);
  meta.append(equalizer, track, artist);
  top.append(art, meta);

  const button = (icon, labelText, capabilityId, onClick) => {
    const node = el('button', 'icon-button');
    node.type = 'button';
    node.innerHTML = icon;
    node.setAttribute('aria-label', labelText);
    node.disabled = capabilities[capabilityId]?.setable !== true;
    node.addEventListener('click', onClick);
    return node;
  };
  const shuffle = button(MEDIA_ICONS.shuffle, 'Shuffle', 'speaker_shuffle', () => {
    setCapability(device, 'speaker_shuffle', !capabilities.speaker_shuffle.value, update);
  });
  const previous = button(MEDIA_ICONS.prev, 'Previous', 'speaker_prev', () => putCapability(device, 'speaker_prev', true));
  const play = button(MEDIA_ICONS.play, 'Play', 'speaker_playing', () => {
    setCapability(device, 'speaker_playing', !capabilities.speaker_playing.value, update);
  });
  play.classList.add('play-pause');
  const next = button(MEDIA_ICONS.next, 'Next', 'speaker_next', () => putCapability(device, 'speaker_next', true));
  const repeat = button(MEDIA_ICONS.repeat, 'Repeat', 'speaker_repeat', () => {
    const mode = REPEAT_MODES[(REPEAT_MODES.indexOf(capabilities.speaker_repeat.value) + 1) % REPEAT_MODES.length];
    setCapability(device, 'speaker_repeat', mode, update);
  });
  const controls = el('div', 'speaker-controls');
  if (compact) {
    controls.append(previous, play, next);
    meta.append(controls);
    inner.append(top);
  } else {
    controls.append(shuffle, previous, play, next, repeat);
    inner.append(top, controls);
  }

  let volume = null;
  let dragging = false;
  if (capabilities.volume_set && !compact) {
    const row = el('div', 'speaker-volume');
    volume = el('input', 'slider');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '100';
    volume.setAttribute('aria-label', 'Volume');
    volume.disabled = capabilities.volume_set.setable !== true;
    volume.addEventListener('input', () => {
      dragging = true;
      paintSlider(volume);
    });
    volume.addEventListener('change', () => {
      dragging = false;
      setCapability(device, 'volume_set', Number(volume.value) / 100, update);
    });
    const stepVolume = (delta) => {
      const value = Math.min(1, Math.max(0, Math.round(((capabilities.volume_set.value ?? 0) + delta) * 100) / 100));
      setCapability(device, 'volume_set', value, update);
    };
    row.append(
      button(MEDIA_ICONS.volumeDown, 'Volume down', 'volume_set', () => stepVolume(-0.05)),
      volume,
      button(MEDIA_ICONS.volumeUp, 'Volume up', 'volume_set', () => stepVolume(0.05)),
    );
    inner.append(row);
  }

  panel.append(backdrop, inner);
  body.append(panel);

  const showArt = () => {
    if (artImage?.url == null) return;
    // The image id stays the same when the track changes, so bust the cache. The old cover stays until this loads.
    cover.src = `${state.client.base}${artImage.url}?v=${Date.now()}`;
  };

  function update(capabilityId) {
    track.textContent = capabilities.speaker_track?.value || device.name;
    artist.textContent = [capabilities.speaker_artist?.value, capabilities.speaker_album?.value].filter(Boolean).join(' — ');
    const playing = capabilities.speaker_playing?.value === true;
    equalizer.dataset.active = String(playing);
    play.innerHTML = playing ? MEDIA_ICONS.pause : MEDIA_ICONS.play;
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    shuffle.classList.toggle('is-on', capabilities.speaker_shuffle?.value === true);
    repeat.classList.toggle('is-on', (capabilities.speaker_repeat?.value ?? 'none') !== 'none');
    if (volume && !dragging) {
      volume.value = String(Math.round((capabilities.volume_set.value ?? 0) * 100));
      paintSlider(volume);
    }
    if (['speaker_track', 'speaker_artist', 'speaker_album'].includes(capabilityId)) showArt();
  }

  showArt();
  update();
  return watchDevice(device, update);
}
