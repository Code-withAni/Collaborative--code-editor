/**
 * User.js
 * Mongoose schema/model for a user session in a room.
 *
 * This model is used to persist basic user-session data.
 * Active in-memory state is managed by roomManager.js for performance.
 *
 * Fields:
 *  - username : Display name chosen by the user.
 *  - socketId : Current socket connection ID (transient, updated on reconnect).
 *  - roomId   : The room this user belongs to.
 *  - joinedAt : When the user entered the room.
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [1, 'Username must be at least 1 character'],
      maxlength: [50, 'Username cannot exceed 50 characters'],
    },

    socketId: {
      type: String,
      required: [true, 'Socket ID is required'],
      trim: true,
    },

    roomId: {
      type: String,
      required: [true, 'Room ID is required'],
      trim: true,
      index: true,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ── Compound index to prevent duplicate (username + roomId) entries ───────────
userSchema.index({ username: 1, roomId: 1 }, { unique: true });

// ── Static: get all users in a specific room ──────────────────────────────────
userSchema.statics.getUsersInRoom = function (roomId) {
  return this.find({ roomId }, 'username socketId joinedAt isOnline lastSeenAt');
};

// ── Static: remove all users in a room (called when room is destroyed) ────────
userSchema.statics.clearRoom = function (roomId) {
  return this.deleteMany({ roomId });
};

// ── Static: mark a user offline by socketId (called on disconnect) ────────────
userSchema.statics.markOffline = function (socketId) {
  return this.findOneAndUpdate(
    { socketId },
    { isOnline: false, lastSeenAt: new Date() },
    { new: true }
  );
};

const User = mongoose.model('User', userSchema, 'room_sessions');

export default User;
