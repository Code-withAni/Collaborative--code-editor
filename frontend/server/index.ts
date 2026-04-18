/**
 * server/index.ts
 *
 * This file is loaded by vite.config.ts during development via the
 * expressPlugin(). It runs INSIDE Vite's dev server HTTP process, so
 * Express acts as middleware and Socket.io attaches to the same port (8080).
 *
 * Exports:
 *   createExpressApp()  → returns an Express Application (used as middleware)
 *   setupSocketIO(io)   → registers all Socket.io event handlers
 *
 * In-memory room store is used for dev speed. For production, the standalone
 * server/ backend uses MongoDB (see ../server/).
 */

import express, { Application, Request, Response } from "express";
import { Server as SocketIOServer, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserEntry {
  socketId: string;
  username: string;
}

interface RoomEntry {
  createdAt: Date;
  lastCode: string;
  /** socketId → username */
  users: Map<string, string>;
}

// ── In-Memory Store ───────────────────────────────────────────────────────────

/** roomId → RoomEntry  */
const rooms = new Map<string, RoomEntry>();

/** socketId → { username, roomId } — reverse index for O(1) disconnect */
const socketIndex = new Map<string, { username: string; roomId: string }>();

/** socketId → last code_change timestamp — for rate limiting */
const rateLimitMap = new Map<string, number>();

// ── Room Manager Helpers ──────────────────────────────────────────────────────

const getUsersInRoom = (roomId: string): UserEntry[] => {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room.users.entries()].map(([socketId, username]) => ({
    socketId,
    username,
  }));
};

const isRateLimited = (socketId: string, limitMs = 50): boolean => {
  const now = Date.now();
  const last = rateLimitMap.get(socketId) ?? 0;
  if (now - last < limitMs) return true;
  rateLimitMap.set(socketId, now);
  return false;
};

// ── Express App ───────────────────────────────────────────────────────────────

/**
 * Creates and configures the Express application with REST API routes.
 * This app is mounted as middleware inside the Vite dev server.
 */
export const createExpressApp = (): Application => {
  const app = express();

  app.use(express.json());

  // ── POST /api/rooms — create a new room ──────────────────────────────────
  app.post("/api/rooms", (_req: Request, res: Response) => {
    const roomId = uuidv4();
    rooms.set(roomId, {
      createdAt: new Date(),
      lastCode: "",
      users: new Map(),
    });
    console.log(`[API] Room created: ${roomId}`);
    res.status(201).json({
      success: true,
      message: "Room created successfully.",
      data: { roomId, createdAt: new Date() },
    });
  });

  // ── GET /api/rooms/:roomId — check room existence ────────────────────────
  app.get("/api/rooms/:roomId", (req: Request, res: Response) => {
    const roomId = String(req.params.roomId);
    const room = rooms.get(roomId);

    if (!room) {
      res.status(404).json({
        success: false,
        message: `Room "${roomId}" not found.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        roomId,
        lastCode: room.lastCode,
        userCount: room.users.size,
        createdAt: room.createdAt,
      },
    });
  });

  // ── GET /health ──────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      activeRooms: rooms.size,
      connectedSockets: socketIndex.size,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
};

// ── Socket.io Handler ─────────────────────────────────────────────────────────

/**
 * Registers all Socket.io event handlers on the given server instance.
 *
 * Events (Client → Server):
 *   join_room    { roomId, username }           → join/create session in room
 *   code_change  { roomId, code, username }     → broadcast code delta
 *   leave_room   { roomId }                     → explicit leave (optional)
 *
 * Events (Server → Client):
 *   user_joined  { username, users, lastCode? } → notify room of new user
 *   user_left    { username, users }            → notify room of departure
 *   receive_code { code, username }             → deliver code update
 *   user_list    { users }                      → full user list refresh
 *   room_error   { message }                    → error feedback to sender
 *   load_code    { code }                       → send persisted code on join
 */
export const setupSocketIO = (io: SocketIOServer): void => {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── join_room ───────────────────────────────────────────────────────────
    socket.on("join_room", ({ roomId, username }: { roomId?: string; username?: string } = {}) => {
      // Validate inputs
      if (!roomId?.trim() || !username?.trim()) {
        socket.emit("room_error", { message: "roomId and username are required." });
        return;
      }

      const rid = roomId.trim();
      const uname = username.trim().substring(0, 50);

      // Verify room exists
      const room = rooms.get(rid);
      if (!room) {
        socket.emit("room_error", {
          message: `Room "${rid}" does not exist. Create it first via POST /api/rooms.`,
        });
        return;
      }

      // Prevent duplicate username in the same room (different socket)
      const existingDuplicate = [...room.users.entries()].find(
        ([sid, uname2]) => uname2 === uname && sid !== socket.id,
      );
      if (existingDuplicate) {
        socket.emit("room_error", {
          message: `Username "${uname}" is already taken in this room.`,
        });
        return;
      }

      // Register user
      room.users.set(socket.id, uname);
      socketIndex.set(socket.id, { username: uname, roomId: rid });

      // Join the Socket.io channel
      socket.join(rid);

      const users = getUsersInRoom(rid);

      // Send persisted code state to the joining user
      if (room.lastCode) {
        socket.emit("load_code", { code: room.lastCode });
      }

      // Notify the joining user
      socket.emit("user_joined", { username: uname, users });

      // Notify all other users
      socket.to(rid).emit("user_joined", { username: uname, users });

      // Broadcast fresh user list to everyone
      io.in(rid).emit("user_list", { users });

      console.log(`[Socket] "${uname}" joined room "${rid}". Total: ${users.length}`);
    });

    // ── code_change ─────────────────────────────────────────────────────────
    socket.on(
      "code_change",
      ({ roomId, code, username }: { roomId?: string; code?: string; username?: string } = {}) => {
        // Rate limit: max 1 event per 50ms per socket
        if (isRateLimited(socket.id, 50)) return;

        if (!roomId || typeof code !== "string") {
          socket.emit("room_error", { message: "roomId and code are required." });
          return;
        }

        const rid = roomId.trim();

        // Broadcast to all peers except sender
        socket.to(rid).emit("receive_code", { code, username });

        // Persist latest code state in memory
        const room = rooms.get(rid);
        if (room) {
          room.lastCode = code;
        }
      },
    );

    // ── leave_room (explicit) ───────────────────────────────────────────────
    socket.on("leave_room", ({ roomId }: { roomId?: string } = {}) => {
      if (!roomId) return;

      const session = socketIndex.get(socket.id);
      if (!session) return;

      const { username } = session;
      const rid = roomId.trim();

      // Remove user
      const room = rooms.get(rid);
      if (room) {
        room.users.delete(socket.id);
        if (room.users.size === 0) {
          rooms.delete(rid);
          console.log(`[Socket] Room "${rid}" is now empty and removed.`);
        }
      }

      socketIndex.delete(socket.id);
      rateLimitMap.delete(socket.id);
      socket.leave(rid);

      const users = getUsersInRoom(rid);
      socket.to(rid).emit("user_left", { username, users });
      io.in(rid).emit("user_list", { users });

      console.log(`[Socket] "${username}" explicitly left room "${rid}".`);
    });

    // ── disconnect ──────────────────────────────────────────────────────────
    socket.on("disconnect", (reason: string) => {
      console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);

      const session = socketIndex.get(socket.id);
      if (!session) return;

      const { username, roomId } = session;

      // Clean up
      const room = rooms.get(roomId);
      if (room) {
        room.users.delete(socket.id);
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`[Socket] Room "${roomId}" emptied and removed.`);
        }
      }

      socketIndex.delete(socket.id);
      rateLimitMap.delete(socket.id);

      const users = getUsersInRoom(roomId);
      socket.to(roomId).emit("user_left", { username, users });
      io.in(roomId).emit("user_list", { users });

      console.log(`[Socket] "${username}" disconnected from room "${roomId}". Remaining: ${users.length}`);
    });
  });
};
