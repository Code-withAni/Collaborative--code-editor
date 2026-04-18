/**
 * server.js
 * Entry point for the Real-Time Collaborative Coding Platform backend.
 *
 * Responsibilities:
 *  - Bootstrap Express application
 *  - Configure middleware (CORS, JSON parsing, rate limiting, request logging)
 *  - Mount REST API routes
 *  - Initialize Socket.io and attach the socket handler
 *  - Connect to MongoDB
 *  - Start the HTTP server
 */

import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import connectDB from './config/db.js';
import roomRoutes from './routes/roomRoutes.js';
import authRoutes from './routes/authRoutes.js';
import socketHandler from './sockets/socketHandler.js';

// ── Configuration ─────────────────────────────────────────────────────────────
const PORT        = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const NODE_ENV    = process.env.NODE_ENV || 'development';

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet());

// CORS — allow the frontend origin explicitly
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// HTTP request logging (compact in production, verbose in development)
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── HTTP Rate Limiter (REST API only) ─────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                  // Max 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again after 15 minutes.',
  },
});
app.use('/api', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/rooms', roomRoutes);

// Health check endpoint — useful for container probes (K8s, Docker, etc.)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Catch-all 404 for undefined routes
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ── HTTP Server ───────────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// ── Socket.io Server ──────────────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Ping settings to detect dead connections quickly
  pingTimeout: 60000,
  pingInterval: 25000,
  // Limit the size of incoming socket payloads to 1 MB
  maxHttpBufferSize: 1e6,
});

// Attach all socket event logic
socketHandler(io);

// ── Boot Sequence ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log('─────────────────────────────────────────────────');
      console.log(`[Server] 🚀 Running in ${NODE_ENV} mode`);
      console.log(`[Server] 🌐 HTTP  → http://localhost:${PORT}`);
      console.log(`[Server] ⚡ WS    → ws://localhost:${PORT}`);
      console.log(`[Server] ❤️  Health → http://localhost:${PORT}/health`);
      console.log('─────────────────────────────────────────────────');
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

start();

export { app, io };
