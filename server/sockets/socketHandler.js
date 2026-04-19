/**
 * socketHandler.js
 * Central Socket.io event handler.
 *
 * This module is intentionally isolated from server.js to maintain separation
 * of concerns and keep socket logic independently testable.
 *
 * ── Events (Client → Server) ──────────────────────────────────────────────────
 *   join_room     { roomId, username }          → Join/create a room session
 *   code_change   { roomId, code, username }    → Broadcast code delta to peers
 *
 * ── Events (Server → Client) ──────────────────────────────────────────────────
 *   receive_code  { code }                      → Deliver code update to client
 *   user_joined   { username, users }           → Notify room of new participant
 *   user_left     { username, users }           → Notify room of departure
 *   room_error    { message }                   → Communicate join/room errors
 *   user_list     { users }                     → Full updated user list
 */

import Room from '../models/Room.js';
import User from '../models/User.js';
import {
  addUser,
  removeUser,
  getUsersInRoom,
  grantAccess,
  revokeAccess,
} from '../utils/roomManager.js';

// ── Rate-Limiting State (Bonus Feature) ───────────────────────────────────────
// Tracks timestamps of code_change events per socket to throttle spammy clients.
const rateLimitMap = new Map(); // socketId → last event timestamp

/**
 * Simple per-socket rate limiter for socket events.
 * Allows at most 1 event per `limitMs` milliseconds.
 *
 * @param {string} socketId
 * @param {number} limitMs  - Minimum interval between events in milliseconds.
 * @returns {boolean} true if the event should be BLOCKED.
 */
const isRateLimited = (socketId, limitMs = 50) => {
  const now = Date.now();
  const last = rateLimitMap.get(socketId) || 0;

  if (now - last < limitMs) {
    return true; // Too frequent
  }

  rateLimitMap.set(socketId, now);
  return false;
};

// ── Main Handler ──────────────────────────────────────────────────────────────

/**
 * Registers all Socket.io event listeners.
 *
 * @param {import('socket.io').Server} io - The Socket.io server instance.
 */
const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`[Socket] ✅ Client connected: ${socket.id}`);
    console.log(`[Socket]    origin: ${socket.handshake.headers.origin ?? 'unknown'}`);

    // ── Debug: log every incoming event name + payload ────────────────────────
    // Remove or gate behind NODE_ENV=development in production.
    socket.onAny((eventName, ...args) => {
      console.debug(`[Socket][→ IN ] "${eventName}" from ${socket.id}`, JSON.stringify(args).slice(0, 200));
    });

    // ── join_room ─────────────────────────────────────────────────────────────
    /**
     * Payload: { roomId: string, username: string }
     *
     * 1. Validate inputs.
     * 2. Verify room exists in DB.
     * 3. Register user in memory via roomManager.
     * 4. Join the Socket.io room channel.
     * 5. Notify room members.
     * 6. Send persisted last code state back to the joining client.
     */
    socket.on('join_room', async ({ roomId, username } = {}) => {
      try {
        // ── Input validation ──────────────────────────────────────────────
        if (!roomId || typeof roomId !== 'string' || roomId.trim() === '') {
          socket.emit('room_error', { message: 'A valid roomId is required.' });
          return;
        }

        if (!username || typeof username !== 'string' || username.trim() === '') {
          socket.emit('room_error', { message: 'A valid username is required.' });
          return;
        }

        const sanitizedRoomId  = roomId.trim();
        const sanitizedUsername = username.trim().substring(0, 50); // cap length

        // ── Check room exists in DB ───────────────────────────────────────
        const room = await Room.findByRoomId(sanitizedRoomId);

        if (!room) {
          socket.emit('room_error', {
            message: `Room "${sanitizedRoomId}" does not exist. Please create it first via the API.`,
          });
          return;
        }

        // ── Check if user is owner ────────────────────────────────────────
        const isOwner = (sanitizedUsername === room.owner);

        // ── Register user in memory ───────────────────────────────────────
        const result = addUser(sanitizedRoomId, socket.id, sanitizedUsername, isOwner);

        if (!result.success) {
          socket.emit('room_error', { message: result.reason });
          return;
        }

        // ── Join the Socket.io channel ────────────────────────────────────
        socket.join(sanitizedRoomId);

        // ── Persist user session in DB ────────────────────────────────────
        // Upsert: if the user reconnects, update their socketId and mark online.
        await User.findOneAndUpdate(
          { username: sanitizedUsername, roomId: sanitizedRoomId },
          { socketId: socket.id, joinedAt: new Date(), isOnline: true },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // ── Build updated user list ───────────────────────────────────────
        const users = getUsersInRoom(sanitizedRoomId);

        // Notify the NEW user of successful join + send persisted code
        socket.emit('user_joined', {
          username: sanitizedUsername,
          users,
          lastCode: room.lastCode || '',
          files: room.files || [],
        });

        // Notify all OTHER users in the room
        socket.to(sanitizedRoomId).emit('user_joined', {
          username: sanitizedUsername,
          users,
        });

        // Broadcast the fresh user list to everyone in the room
        io.in(sanitizedRoomId).emit('user_list', { users });

        console.log(
          `[Socket] "${sanitizedUsername}" joined room "${sanitizedRoomId}". Total: ${users.length}`
        );
      } catch (err) {
        console.error('[Socket] join_room error:', err.message);
        socket.emit('room_error', { message: 'Failed to join room due to a server error.' });
      }
    });

    // ── code_change ───────────────────────────────────────────────────────────
    /**
     * Payload: { roomId: string, code: string, username: string }
     *
     * 1. Rate-limit check.
     * 2. Validate inputs.
     * 3. Broadcast code to all other peers in the room.
     * 4. Persist the latest code state + snapshot to DB (debounced via immediate update).
     */
    socket.on('code_change', async ({ roomId, code, username } = {}) => {
      try {
        // ── Rate limit ────────────────────────────────────────────────────
        if (isRateLimited(socket.id, 50)) {
          // Silently drop the event; clients should implement their own debounce.
          return;
        }

        // ── Input validation ──────────────────────────────────────────────
        if (!roomId || !username) {
          socket.emit('room_error', { message: 'roomId and username are required for code_change.' });
          return;
        }

        if (typeof code !== 'string') {
          socket.emit('room_error', { message: 'Code payload must be a string.' });
          return;
        }

        const sanitizedRoomId = roomId.trim();

        // Check in-memory permissions
        const usersInRoom = getUsersInRoom(sanitizedRoomId);
        const me = usersInRoom.find(u => u.socketId === socket.id);
        if (!me || (!me.canEdit)) {
          socket.emit('room_error', { message: 'You do not have permission to edit the code.' });
          return;
        }

        // ── Broadcast to all OTHER clients in the room ────────────────────
        socket.to(sanitizedRoomId).emit('receive_code', {
          code,
          username: username.trim(),
        });

        // ── Persist to DB (Bonus Feature) ─────────────────────────────────
        // Use findOneAndUpdate with $set to avoid race conditions.
        const room = await Room.findByRoomId(sanitizedRoomId);
        if (room) {
          room.addSnapshot(code, username.trim());
          await room.save();
        }
      } catch (err) {
        console.error('[Socket] code_change error:', err.message);
      }
    });

    // ── files_update ─────────────────────────────────────────────────────────
    /**
     * Broadcast updated file tree to room peers.
     * Payload: { roomId, files }
     */
    socket.on('files_update', async ({ roomId, files } = {}) => {
      try {
        if (!roomId || !Array.isArray(files)) return;
        const sanitizedRoomId = roomId.trim();

        // Broadcast to others
        socket.to(sanitizedRoomId).emit('receive_files', { files });

        // Persist to DB
        await Room.findOneAndUpdate(
          { roomId: sanitizedRoomId },
          { $set: { files } }
        );
      } catch (err) {
        console.error('[Socket] files_update error:', err.message);
      }
    });

    // ── Edit Permissions Management ────────────────────────────────────────────────
    socket.on('grant_edit_access', async ({ roomId, targetSocketId } = {}) => {
      if (!roomId || !targetSocketId) return;
      const sanitizedRoomId = roomId.trim();
      const room = await Room.findByRoomId(sanitizedRoomId);
      if (!room) return;
      
      const session = getUsersInRoom(sanitizedRoomId).find(u => u.socketId === socket.id);
      if (!session || session.username !== room.owner) {
        socket.emit('room_error', { message: 'Only the room admin can grant edit access.' });
        return;
      }
      
      if (grantAccess(sanitizedRoomId, targetSocketId)) {
        const users = getUsersInRoom(sanitizedRoomId);
        io.in(sanitizedRoomId).emit('user_list', { users });
      }
    });

    socket.on('revoke_edit_access', async ({ roomId, targetSocketId } = {}) => {
      if (!roomId || !targetSocketId) return;
      const sanitizedRoomId = roomId.trim();
      const room = await Room.findByRoomId(sanitizedRoomId);
      if (!room) return;
      
      const session = getUsersInRoom(sanitizedRoomId).find(u => u.socketId === socket.id);
      if (!session || session.username !== room.owner) {
        socket.emit('room_error', { message: 'Only the room admin can revoke edit access.' });
        return;
      }
      
      if (revokeAccess(sanitizedRoomId, targetSocketId)) {
        const users = getUsersInRoom(sanitizedRoomId);
        io.in(sanitizedRoomId).emit('user_list', { users });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    /**
     * Triggered automatically when a client disconnects (tab close, network drop).
     *
     * 1. Look up the user's room via the reverse socket index.
     * 2. Remove them from in-memory state.
     * 3. Clean up their DB record.
     * 4. Notify remaining room members.
     */
    socket.on('disconnect', async (reason) => {
      try {
        console.log(`[Socket] Client disconnected: ${socket.id} (reason: ${reason})`);

        // Remove from in-memory store
        const { username, roomId } = removeUser(socket.id);

        // Clean up rate-limit map entry to prevent memory accumulation
        rateLimitMap.delete(socket.id);

        if (!username || !roomId) {
          // Socket was never fully joined; nothing more to do.
          return;
        }

        // Mark user offline in DB — keeps the record for future sessions
        // so the username is remembered and can be reused in MongoDB.
        await User.markOffline(socket.id);

        console.log(`[Socket] Marked "${username}" offline in DB (socketId: ${socket.id})`);

        // Get remaining users and notify them
        const users = getUsersInRoom(roomId);

        socket.to(roomId).emit('user_left', { username, users });
        io.in(roomId).emit('user_list', { users });

        console.log(
          `[Socket] "${username}" left room "${roomId}". Remaining: ${users.length}`
        );
      } catch (err) {
        console.error('[Socket] disconnect error:', err.message);
      }
    });
  });
};

export default socketHandler;
