/**
 * Room.js
 * Mongoose schema/model for a collaborative coding room.
 *
 * Fields:
 *  - roomId     : UUID-based unique identifier for the room.
 *  - createdAt  : Timestamp of room creation.
 *  - lastCode   : Persists the most recent code state (bonus feature).
 *  - codeHistory: Stores up to the last 50 code snapshots (optional history).
 */

import mongoose from 'mongoose';

// ── Code History Entry ────────────────────────────────────────────────────────
const codeSnapshotSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: '',
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    savedBy: {
      type: String, // username of who triggered the save
      default: 'anonymous',
    },
  },
  { _id: false }
);

// ── Room Schema ───────────────────────────────────────────────────────────────
const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: [true, 'roomId is required'],
      unique: true,
      trim: true,
      index: true,
    },

    owner: {
      type: String, // username or account info
      required: [true, 'Room must have an owner'],
    },

    // Persisted last code state (Bonus Feature)
    lastCode: {
      type: String,
      default: '',
    },

    // Optional: store last 50 code snapshots for history
    codeHistory: {
      type: [codeSnapshotSchema],
      default: [],
    },

    // Persisted file tree for shared explorer
    files: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ── Instance Method: append a code snapshot ──────────────────────────────────
roomSchema.methods.addSnapshot = function (code, username) {
  // Keep only the last 50 snapshots to prevent unbounded growth
  if (this.codeHistory.length >= 50) {
    this.codeHistory.shift();
  }
  this.codeHistory.push({ code, savedBy: username });
  this.lastCode = code;
};

// ── Static Method: retrieve a room by roomId ─────────────────────────────────
roomSchema.statics.findByRoomId = function (roomId) {
  return this.findOne({ roomId });
};

const Room = mongoose.model('Room', roomSchema);

export default Room;
