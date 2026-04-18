/**
 * roomManager.js
 * In-memory store for active room sessions.
 *
 * Manages the mapping of:
 *   roomId  →  Set of { username, socketId }
 *   socketId → { username, roomId }     (reverse lookup for disconnect)
 *
 * Using Map + Set provides O(1) lookups and avoids array duplication issues.
 * This is intentionally kept in-memory for low-latency real-time use;
 * the DB layer (Room / User models) handles persistence separately.
 */

// ── Internal Maps ─────────────────────────────────────────────────────────────

/** @type {Map<string, Map<string, string>>} roomId → Map<socketId, username> */
const rooms = new Map();

/** @type {Map<string, { username: string, roomId: string }>} socketId → { username, roomId } */
const socketIndex = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Ensures a room Map exists for the given roomId.
 * @param {string} roomId
 */
const ensureRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map()); // socketId → username
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a user to a room.
 * If the username already exists in the room (e.g., tab refresh), the old
 * socket entry is silently overwritten to prevent phantom users.
 *
 * @param {string} roomId
 * @param {string} socketId
 * @param {string} username
 * @returns {{ success: boolean, reason?: string }}
 */
const addUser = (roomId, socketId, username) => {
  ensureRoom(roomId);
  const room = rooms.get(roomId);

  // Check if username is already taken by a *different* socket
  const existingSocket = [...room.entries()].find(
    ([sid, uname]) => uname === username && sid !== socketId
  );

  if (existingSocket) {
    return { success: false, reason: `Username "${username}" is already taken in this room.` };
  }

  room.set(socketId, username);
  socketIndex.set(socketId, { username, roomId });

  console.log(`[RoomManager] User "${username}" (${socketId}) joined room "${roomId}"`);
  return { success: true };
};

/**
 * Remove a user by their socketId.
 * Cleans up the room if it becomes empty.
 *
 * @param {string} socketId
 * @returns {{ username: string|null, roomId: string|null }}
 */
const removeUser = (socketId) => {
  const entry = socketIndex.get(socketId);

  if (!entry) {
    return { username: null, roomId: null };
  }

  const { username, roomId } = entry;
  socketIndex.delete(socketId);

  const room = rooms.get(roomId);
  if (room) {
    room.delete(socketId);

    // Clean up empty rooms to prevent memory leaks
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`[RoomManager] Room "${roomId}" is now empty and has been removed from memory.`);
    }
  }

  console.log(`[RoomManager] User "${username}" (${socketId}) left room "${roomId}"`);
  return { username, roomId };
};

/**
 * Retrieve all users in a room as an array of { socketId, username } objects.
 *
 * @param {string} roomId
 * @returns {Array<{ socketId: string, username: string }>}
 */
const getUsersInRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return [];

  return [...room.entries()].map(([socketId, username]) => ({ socketId, username }));
};

/**
 * Check whether a room currently has any active users.
 *
 * @param {string} roomId
 * @returns {boolean}
 */
const roomExists = (roomId) => rooms.has(roomId) && rooms.get(roomId).size > 0;

/**
 * Get the count of all active rooms (for monitoring / health checks).
 *
 * @returns {number}
 */
const activeRoomCount = () => rooms.size;

/**
 * Get the total count of connected users across all rooms.
 *
 * @returns {number}
 */
const totalUserCount = () => socketIndex.size;

/**
 * Get the session info for a specific socket (used in disconnect handler).
 *
 * @param {string} socketId
 * @returns {{ username: string, roomId: string } | null}
 */
const getSessionBySocket = (socketId) => socketIndex.get(socketId) || null;

export {
  addUser,
  removeUser,
  getUsersInRoom,
  roomExists,
  activeRoomCount,
  totalUserCount,
  getSessionBySocket,
};
