/**
 * authController.js
 * Handles user registration and login.
 * Issues JWT tokens on success.
 */

import jwt from 'jsonwebtoken';
import AuthAccount from '../models/AuthAccount.js';

const JWT_SECRET  = process.env.JWT_SECRET  || 'collab_code_dev_secret_change_in_prod';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

/** Sign a JWT for the given account _id + username */
const signToken = (account) =>
  jwt.sign(
    { id: account._id, username: account.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

// ── POST /api/auth/register ───────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Check for duplicate username
    const existing = await AuthAccount.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    const account = await AuthAccount.create({
      username: username.trim(),
      password,
    });

    const token = signToken(account);

    console.log(`[Auth] New account registered: "${account.username}"`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { token, username: account.username },
    });
  } catch (err) {
    console.error('[Auth] register error:', err.message);

    // Mongoose duplicate key error
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }

    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    // Explicitly select password since it has select:false
    const account = await AuthAccount.findOne({ username: username.trim() }).select('+password');

    if (!account) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const isMatch = await account.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const token = signToken(account);

    console.log(`[Auth] Login: "${account.username}"`);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      data: { token, username: account.username },
    });
  } catch (err) {
    console.error('[Auth] login error:', err.message);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the logged-in user from the JWT (used by the frontend on page load)
export const getMe = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const account = await AuthAccount.findById(decoded.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    res.status(200).json({
      success: true,
      data: { username: account.username },
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};
