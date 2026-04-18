/**
 * roomRoutes.js
 * Express router for all Room-related HTTP endpoints.
 *
 * Routes:
 *   POST   /api/rooms                    → Create a new room
 *   GET    /api/rooms/:roomId            → Get room details / check existence
 *   GET    /api/rooms/:roomId/history    → Get code history for a room
 */

import { Router } from 'express';
import {
  createRoom,
  getRoomById,
  getRoomHistory,
} from '../controllers/roomController.js';

const router = Router();

// POST /api/rooms
router.post('/', createRoom);

// GET /api/rooms/:roomId
router.get('/:roomId', getRoomById);

// GET /api/rooms/:roomId/history  (Bonus: code history)
router.get('/:roomId/history', getRoomHistory);

export default router;
