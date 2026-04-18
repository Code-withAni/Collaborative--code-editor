/**
 * AuthAccount.js
 * Mongoose model for registered user accounts.
 * Stores credentials separately from the in-room session User model.
 *
 * Fields:
 *  - username : Unique display name (used to identify the user across sessions).
 *  - password : bcrypt-hashed password (never stored in plaintext).
 *  - createdAt: Auto-managed by timestamps.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const authAccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Username must be at least 2 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password field by default
    },
  },
  { timestamps: true }
);

// ── Pre-save: hash password before storing ────────────────────────────────────
authAccountSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Method: compare plaintext password against stored hash ────────────────────
authAccountSchema.methods.matchPassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.password);
};

const AuthAccount = mongoose.model('AuthAccount', authAccountSchema);

export default AuthAccount;
