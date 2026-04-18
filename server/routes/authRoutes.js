/**
 * authRoutes.js
 * Auth REST API routes.
 *
 *   POST /api/auth/register  → create account
 *   POST /api/auth/login     → sign in, receive token
 *   GET  /api/auth/me        → verify token, get current user
 */

import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        getMe);

export default router;
