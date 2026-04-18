# Real-Time Collaborative Coding Platform — Backend

A production-ready Node.js backend for a real-time collaborative code editor, built with **Express**, **Socket.io**, and **MongoDB**.

---

## Tech Stack

| Layer        | Technology              |
|--------------|-------------------------|
| Runtime      | Node.js ≥ 18            |
| HTTP Server  | Express 4               |
| Real-Time    | Socket.io 4             |
| Database     | MongoDB + Mongoose 8    |
| Room IDs     | UUID v4                 |
| Security     | Helmet, express-rate-limit, CORS |
| Logging      | Morgan                  |
| Dev Server   | Nodemon                 |

---

## Folder Structure

```
server/
├── config/
│   └── db.js               # MongoDB connection with retry + graceful shutdown
├── controllers/
│   └── roomController.js   # HTTP handlers (create room, get room, code history)
├── models/
│   ├── Room.js             # Room schema (lastCode + codeHistory[50])
│   └── User.js             # User schema (username, socketId, roomId)
├── routes/
│   └── roomRoutes.js       # Express router → /api/rooms
├── sockets/
│   └── socketHandler.js    # All Socket.io event logic
├── utils/
│   └── roomManager.js      # In-memory O(1) room/user store
├── .env                    # Environment variables (not committed)
├── .env.example            # Template for environment variables
├── .gitignore
├── package.json
└── server.js               # Entry point
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally **or** a MongoDB Atlas connection string

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MONGO_URI and CLIENT_ORIGIN
```

### 3. Start (development)
```bash
npm run dev
```

### 4. Start (production)
```bash
npm start
```

The server will start at `http://localhost:5000`.

---

## REST API Endpoints

### `POST /api/rooms`
Create a new collaborative room.

**Response:**
```json
{
  "success": true,
  "message": "Room created successfully.",
  "data": {
    "roomId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### `GET /api/rooms/:roomId`
Check if a room exists and get its metadata.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "roomId": "550e8400-...",
    "lastCode": "console.log('hello');",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Response (404):**
```json
{ "success": false, "message": "Room \"xxx\" not found." }
```

---

### `GET /api/rooms/:roomId/history`
Retrieve the last ≤ 50 code snapshots for a room (Bonus Feature).

---

### `GET /health`
Health check endpoint for container probes.

```json
{ "status": "ok", "uptime": 42.5, "timestamp": "..." }
```

---

## Socket.io Events

### Client → Server

| Event         | Payload                                    | Description                  |
|---------------|--------------------------------------------|------------------------------|
| `join_room`   | `{ roomId: string, username: string }`     | Join an existing room        |
| `code_change` | `{ roomId: string, code: string, username: string }` | Broadcast code update |

### Server → Client

| Event         | Payload                                           | Description                       |
|---------------|---------------------------------------------------|-----------------------------------|
| `user_joined` | `{ username, users, lastCode? }`                  | A user joined the room            |
| `user_left`   | `{ username, users }`                             | A user disconnected               |
| `receive_code`| `{ code, username }`                              | Incoming code from another user   |
| `user_list`   | `{ users: [{ socketId, username }] }`             | Full current user list            |
| `room_error`  | `{ message: string }`                             | Error during join or code_change  |

---

## Client-Side Usage Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

// Step 1: First create a room via REST API
const { data: { roomId } } = await fetch('/api/rooms', { method: 'POST' }).then(r => r.json());

// Step 2: Join the room
socket.emit('join_room', { roomId, username: 'alice' });

// Step 3: Listen for events
socket.on('user_joined', ({ username, users, lastCode }) => {
  console.log(`${username} joined. Code state:`, lastCode);
});

socket.on('receive_code', ({ code, username }) => {
  editor.setValue(code); // update your editor
});

socket.on('user_list', ({ users }) => {
  renderUserList(users);
});

socket.on('user_left', ({ username }) => {
  console.log(`${username} left`);
});

socket.on('room_error', ({ message }) => {
  alert(message);
});

// Step 4: Broadcast code changes (debounce on client side)
editor.on('change', (value) => {
  socket.emit('code_change', { roomId, code: value, username: 'alice' });
});
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Dual-layer state (Map + DB) | In-memory Maps give O(1) RT lookups; MongoDB provides persistence across restarts |
| Reverse socket index | `socketId → { username, roomId }` enables O(1) disconnect cleanup without scanning all rooms |
| Per-socket rate limiting (50 ms) | Prevents malicious/laggy clients from flooding the broadcast channel |
| UUID v4 room IDs | Collision-resistant, no sequential guessing, no auth needed for room lookup |
| `express-rate-limit` on REST | Protects the room creation endpoint from abuse (100 req / 15 min) |
| Code history capped at 50 | Prevents unbounded DB document growth while still providing useful history |

---

## Environment Variables

| Variable        | Default                              | Description                          |
|-----------------|--------------------------------------|--------------------------------------|
| `PORT`          | `5000`                               | HTTP/WS server port                  |
| `NODE_ENV`      | `development`                        | `development` or `production`        |
| `MONGO_URI`     | `mongodb://127.0.0.1:27017/collab_code` | MongoDB connection string         |
| `CLIENT_ORIGIN` | `http://localhost:3000`              | Allowed frontend origin (CORS + WS)  |
