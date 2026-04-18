/**
 * socket.ts
 * Singleton Socket.io client with full debug instrumentation.
 *
 * FIX #1: Backend runs on port 5000, NOT on window.location.origin (8080).
 *         The URL is read from VITE_SOCKET_URL env var, falling back to
 *         http://localhost:5000 so no code change is needed to switch.
 *
 * Debug: Set localStorage.debug = 'socket.io-client:*' in the browser
 *        console to enable socket.io's own verbose transport logs.
 */

import { io, Socket } from 'socket.io-client';

// ── Backend URL ───────────────────────────────────────────────────────────────
// Reads VITE_SOCKET_URL from .env (e.g. VITE_SOCKET_URL=http://localhost:5000).
// Falls back to port 5000 on the same host for local dev.
const SOCKET_URL =
  (import.meta as any).env?.VITE_SOCKET_URL ?? 'http://localhost:5000';

let socket: Socket | null = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export const initSocket = (): Socket => {
  // Guard: return existing socket if it's already alive
  if (socket && socket.connected) {
    console.debug('[Socket] Reusing existing connected socket:', socket.id);
    return socket;
  }

  // Disconnect stale socket if it exists but is not connected
  if (socket && !socket.connected) {
    console.warn('[Socket] Stale disconnected socket found — creating fresh connection.');
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  console.log(`[Socket] Connecting to ${SOCKET_URL} …`);

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'], // try WebSocket first, fall back to polling
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  // ── Debug: log EVERY event (client → server and server → client) ───────────
  socket.onAny((eventName: string, ...args: unknown[]) => {
    console.debug(`[Socket][←] Event received: "${eventName}"`, args);
  });

  socket.onAnyOutgoing((eventName: string, ...args: unknown[]) => {
    console.debug(`[Socket][→] Event sent:     "${eventName}"`, args);
  });

  // ── Core lifecycle logs ────────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log(`%c[Socket] ✅ Connected  | socket.id = ${socket?.id}`, 'color: #22c55e; font-weight: bold');
  });

  socket.on('connect_error', (err: Error) => {
    console.error(`[Socket] ❌ Connection failed: ${err.message}`);
    console.error('[Socket]    → Is the backend running on', SOCKET_URL, '?');
    console.error('[Socket]    → Is CORS configured to allow', window.location.origin, '?');
  });

  socket.on('disconnect', (reason: string) => {
    console.warn(`%c[Socket] ⚡ Disconnected | reason = ${reason}`, 'color: #f97316; font-weight: bold');
    // 'io server disconnect' means the server explicitly kicked the client
    if (reason === 'io server disconnect') {
      console.warn('[Socket]    → Server closed this socket. Reconnecting manually…');
      socket?.connect();
    }
  });

  socket.on('reconnect', (attempt: number) => {
    console.log(`[Socket] 🔄 Reconnected after ${attempt} attempt(s). New id: ${socket?.id}`);
  });

  socket.on('reconnect_error', (err: Error) => {
    console.error('[Socket] Reconnect error:', err.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('[Socket] ❌ All reconnect attempts exhausted. Backend unreachable.');
  });

  return socket;
};

// ── Getters / Helpers ─────────────────────────────────────────────────────────

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    console.log('[Socket] Manually disconnecting socket:', socket.id);
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/** Expose socket globally in dev for easy browser console inspection. */
if (import.meta.env?.DEV) {
  (window as any).__socket = {
    get instance() { return socket; },
    get id() { return socket?.id; },
    get connected() { return socket?.connected; },
  };
  console.info(
    '[Socket] 🔧 Dev mode: access socket via window.__socket in browser console.',
  );
}
