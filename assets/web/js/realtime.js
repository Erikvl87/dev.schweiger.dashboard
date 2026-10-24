// Live updates over socket.io, using the same handshake as the Homey apps.

import { state } from './state.js';

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

export function createRealtime({ base, token }, { onStatus, onReconnect }) {
  const listeners = new Set();
  const subscriptions = new Map();
  let apiSocket = null;
  let connectedBefore = false;

  const root = window.io(base, { transports: ['websocket'] });

  // Homey authenticates the connection on the root namespace, then hands out the namespace to use.
  const handshake = () => {
    root.emit('handshakeClient', { token }, (error, result) => {
      if (error) {
        onStatus('error', error.error ?? 'Realtime handshake failed');
        return;
      }
      if (apiSocket == null) {
        apiSocket = root.io.socket(result.namespace);
        apiSocket.on('connect', () => {
          for (const uri of subscriptions.keys()) apiSocket.emit('subscribe', uri);
          onStatus('live', 'Live');
          if (connectedBefore) onReconnect();
          connectedBefore = true;
        });
        apiSocket.on('disconnect', () => onStatus('offline', 'Offline'));
        // After a reconnect the namespace can be rejected because it raced the handshake.
        apiSocket.on('connect_error', () => {
          setTimeout(() => {
            if (root.connected && !apiSocket.active) handshake();
          }, 2000);
        });
        apiSocket.onAny((uri, event, data) => {
          for (const listener of listeners) {
            if (listener.uri === uri && listener.event === event) listener.fn(data);
          }
        });
      }
      if (!apiSocket.active) apiSocket.connect();
    });
  };
  root.on('connect', handshake);
  root.on('disconnect', () => onStatus('offline', 'Offline'));
  root.on('connect_error', () => onStatus('offline', 'Offline'));

  function on(uri, event, fn) {
    const listener = { uri, event, fn };
    listeners.add(listener);
    const count = subscriptions.get(uri) ?? 0;
    subscriptions.set(uri, count + 1);
    if (count === 0 && apiSocket?.connected) apiSocket.emit('subscribe', uri);

    return () => {
      listeners.delete(listener);
      const remaining = (subscriptions.get(uri) ?? 1) - 1;
      if (remaining > 0) {
        subscriptions.set(uri, remaining);
      } else {
        subscriptions.delete(uri);
        if (apiSocket?.connected) apiSocket.emit('unsubscribe', uri);
      }
    };
  }

  return { on };
}

export function subscribe(uri, event, fn) {
  return state.realtime ? state.realtime.on(uri, event, fn) : () => {};
}
