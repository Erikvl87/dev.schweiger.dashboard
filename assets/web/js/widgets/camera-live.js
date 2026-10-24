// Live camera (device_camera_live). Homey Pro converts the camera's stream (RTSP, HLS, …) to WebRTC with go2rtc, so the
// browser plays it directly: it sends a WebRTC offer to the Homey and keeps the stream alive. The stream stops while
// the page is hidden and starts again when it is shown.

import { findDevice } from '../devices.js';
import { el, note } from '../dom.js';
import { EXPAND_ICON } from '../icons.js';
import { state } from '../state.js';

const KEEP_ALIVE = 30_000; // Homey drops a stream after two minutes without one.
const RETRY = 10_000;

function iceGathered(pc, timeout) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    };
    const check = () => pc.iceGatheringState === 'complete' && done();
    pc.addEventListener('icegatheringstatechange', check);
    setTimeout(done, timeout);
  });
}

export function mountCameraLive({ body, widget }) {
  const device = findDevice(body, widget.data?.deviceId);
  if (device == null) return;
  const video = device.videos?.find((candidate) => candidate.id === widget.data?.deviceVideoId) ?? device.videos?.[0];
  const videoId = video?.videoObj?.id;
  if (videoId == null) return note(body, `${device.name} has no live video.`);

  const frame = el('div', 'snapshot camera-live');
  const player = el('video');
  player.muted = true;
  player.playsInline = true;
  player.autoplay = true;
  const snapshot = device.images?.find((image) => image.type === 'camera')?.imageObj?.url;
  if (snapshot) player.poster = `${state.client.base}${snapshot}?v=${Date.now()}`;
  // Like the app: the name and the stream's title over the picture, a red "Live" once it plays, a full-screen button.
  const overlay = el('div', 'camera-overlay');
  overlay.append(el('div', 'camera-name', `${widget.title ?? device.name} - ${video.title ?? 'Live'}`));
  const status = el('button', 'camera-status');
  status.type = 'button';
  overlay.append(status);
  const fullscreen = el('button', 'camera-fullscreen');
  fullscreen.type = 'button';
  fullscreen.innerHTML = EXPAND_ICON;
  fullscreen.setAttribute('aria-label', 'Full screen');
  fullscreen.addEventListener('click', () => {
    if (frame.requestFullscreen) frame.requestFullscreen().catch(() => {});
    else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
    else player.webkitEnterFullscreen?.();
  });
  frame.append(player, overlay, fullscreen);
  body.append(frame);

  let pc = null;
  let keepAlive = null;
  let retry = null;
  let unmounted = false;
  const api = (path, payload) => state.client.api('POST', `/api/manager/videos/video/${videoId}${path}`, payload);
  const showStatus = (text) => {
    status.textContent = text || 'Live';
    status.classList.toggle('is-live', !text);
  };

  function stop() {
    clearInterval(keepAlive);
    clearTimeout(retry);
    pc?.close();
    pc = null;
    player.srcObject = null;
  }

  function retryLater(message) {
    stop();
    showStatus(message);
    if (!unmounted && document.visibilityState === 'visible') retry = setTimeout(start, RETRY);
  }

  async function start() {
    stop();
    showStatus('Connecting…');
    const connection = new RTCPeerConnection();
    pc = connection;
    connection.addTransceiver('video', { direction: 'recvonly' });
    connection.addTransceiver('audio', { direction: 'recvonly' });
    connection.addEventListener('track', (event) => {
      const stream = player.srcObject ?? event.streams[0] ?? new MediaStream();
      if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track);
      player.srcObject = stream;
      player.play().catch(() => {});
    });
    connection.addEventListener('connectionstatechange', () => {
      if (pc !== connection) return;
      if (connection.connectionState === 'connected') showStatus('');
      if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') retryLater('Reconnecting…');
    });
    try {
      await connection.setLocalDescription(await connection.createOffer());
      await iceGathered(connection, 3000);
      const { answerSdp, streamId } = await api('/offer', { offer: connection.localDescription.sdp });
      if (pc !== connection) return;
      await connection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      if (streamId) keepAlive = setInterval(() => api('/keep-alive', { streamId }).catch(() => {}), KEEP_ALIVE);
    } catch (error) {
      if (pc === connection) retryLater(`No live video: ${error.message}`);
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') start();
    else stop();
  };
  status.addEventListener('click', start);
  if (widget.data?.autoplay === false) {
    showStatus('Play live video');
  } else {
    start();
  }
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    unmounted = true;
    document.removeEventListener('visibilitychange', onVisibility);
    stop();
  };
}
