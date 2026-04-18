/**
 * roomController.js
 * HTTP controller functions for the Room resource.
 *
 * Handles:
 *  - POST /api/rooms    → Create a new room
 *  - GET  /api/rooms/:roomId → Check if a room exists
 *  - GET  /api/rooms/:roomId/history → Get code history for a room
 */

import { v4 as uuidv4 } from 'uuid';
import Room from '../models/Room.js';

// ── POST /api/rooms ───────────────────────────────────────────────────────────
/**
 * Create a new room.
 * Generates a UUID-based roomId, persists it to MongoDB, and returns the room.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
export const createRoom = async (req, res) => {
  try {
    const { owner } = req.body;

    if (!owner) {
      return res.status(400).json({ success: false, message: 'Owner username is required.' });
    }

    const roomId = uuidv4();

    const room = await Room.create({ roomId, owner });

    console.log(`[RoomController] Room created: ${roomId} by ${owner}`);

    return res.status(201).json({
      success: true,
      message: 'Room created successfully.',
      data: {
        roomId: room.roomId,
        owner: room.owner,
        createdAt: room.createdAt,
      },
    });
  } catch (err) {
    console.error('[RoomController] createRoom error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create room. Please try again.',
    });
  }
};

// ── GET /api/rooms/:roomId ────────────────────────────────────────────────────
/**
 * Check if a room exists in the database.
 * Returns basic room metadata without sensitive code history.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
export const getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Validate UUID format before hitting the DB
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(roomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID format.',
      });
    }

    const room = await Room.findByRoomId(roomId).select('-codeHistory -__v');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Room "${roomId}" not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        roomId: room.roomId,
        owner: room.owner,
        lastCode: room.lastCode,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (err) {
    console.error('[RoomController] getRoomById error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};

// ── GET /api/rooms/:roomId/history ────────────────────────────────────────────
/**
 * Retrieve the code history for a room (Bonus Feature).
 * Returns up to the last 50 snapshots.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
export const getRoomHistory = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findByRoomId(roomId).select('roomId codeHistory');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Room "${roomId}" not found.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        roomId: room.roomId,
        history: room.codeHistory,
      },
    });
  } catch (err) {
    console.error('[RoomController] getRoomHistory error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
    });
  }
};
