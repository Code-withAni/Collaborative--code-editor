import "dotenv/config";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import http from "http";
import { handleDemo } from "./routes/demo";

interface User {
  id: string;
  username: string;
}

interface Room {
  code: string;
  users: Map<string, User>;
}

const rooms = new Map<string, Room>();

export function createExpressApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}

export function setupSocketIO(io: SocketIOServer) {
  // Socket.io event handlers
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join_room", (data: { roomId: string; username: string }) => {
      const { roomId, username } = data;

      // Join socket.io room
      socket.join(roomId);

      // Get or create room
      let room = rooms.get(roomId);
      if (!room) {
        room = {
          code: "",
          users: new Map(),
        };
        rooms.set(roomId, room);
      }

      // Add user to room
      room.users.set(socket.id, {
        id: socket.id,
        username,
      });

      // Send existing code to the new user
      socket.emit("load_code", { code: room.code });

      // Notify all users in room about the updated user list
      const usersList = Array.from(room.users.values());
      io.to(roomId).emit("user_joined", {
        username,
        users: usersList,
      });

      console.log(`${username} joined room ${roomId}`);
    });

    socket.on("code_change", (data: { roomId: string; code: string }) => {
      const { roomId, code } = data;
      const room = rooms.get(roomId);

      if (room) {
        room.code = code;
        // Broadcast code change to other users in the room
        socket.to(roomId).emit("receive_code", { code });
      }
    });

    socket.on("leave_room", (data: { roomId: string }) => {
      const { roomId } = data;
      const room = rooms.get(roomId);

      if (room) {
        const user = room.users.get(socket.id);
        if (user) {
          room.users.delete(socket.id);

          // Notify others that user left
          const usersList = Array.from(room.users.values());
          io.to(roomId).emit("user_left", {
            username: user.username,
            users: usersList,
          });

          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(roomId);
          }
        }
      }

      socket.leave(roomId);
    });

    socket.on("disconnect", () => {
      // Remove user from all rooms
      for (const [roomId, room] of rooms.entries()) {
        const user = room.users.get(socket.id);
        if (user) {
          room.users.delete(socket.id);

          // Notify others in the room
          if (room.users.size > 0) {
            const usersList = Array.from(room.users.values());
            io.to(roomId).emit("user_left", {
              username: user.username,
              users: usersList,
            });
          } else {
            // Clean up empty room
            rooms.delete(roomId);
          }
        }
      }

      console.log(`User disconnected: ${socket.id}`);
    });

    socket.on("error", (error) => {
      console.error(`Socket error: ${error}`);
    });
  });
}

export function createServer() {
  const app = createExpressApp();

  // Create HTTP server for Socket.io
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  setupSocketIO(io);

  return { app, httpServer, io };
}
