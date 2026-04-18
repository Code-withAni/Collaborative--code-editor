/**
 * server/node-build.ts
 * Production entry point — builds as a standalone Node.js server.
 * Referenced by vite.config.server.ts (build:server script).
 *
 * In production the Express app + Socket.io run on their own port,
 * and serve the pre-built SPA from dist/spa/.
 */

import express from "express";
import http from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";
import { createExpressApp, setupSocketIO } from "./index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// ── Create base Express app (API routes) ──────────────────────────────────────
const app = createExpressApp();

// ── Serve the built SPA ───────────────────────────────────────────────────────
const spaPath = path.resolve(__dirname, "../spa");
app.use(express.static(spaPath));

// Fallback to index.html for client-side routing
app.get("*", (_req, res) => {
  res.sendFile(path.join(spaPath, "index.html"));
});

// ── HTTP + Socket.io ──────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
});

setupSocketIO(io);

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[Server] 🚀 Production server running on http://localhost:${PORT}`);
});
