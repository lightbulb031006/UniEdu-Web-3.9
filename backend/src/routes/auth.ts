/**
 * Authentication Routes
 */

import express from 'express';
import { z } from 'zod';
import { login, register, getUserById, updateProfile, getUsers } from '../services/authService';
import { authenticate } from '../middleware/auth';
import { authLimiter, loginFailureLimiter } from '../middleware/rateLimit';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
// Login supports email, phone, or account_handle (like old app)
const loginSchema = z.object({
  email: z.string().min(1, 'Email/Phone/Handle is required'), // Can be email, phone, or handle
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false), // Remember me for 30 days
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['student', 'teacher', 'admin']),
});

/**
 * POST /api/auth/login
 * Login user
 * Rate limiting: 5 failed attempts -> lock for 30 minutes
 */
router.post('/login', loginFailureLimiter, async (req, res, next) => {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await login(validated);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[LOGIN] Validation error', {
        errors: error.errors,
      });
      next(new ValidationError('Invalid input', error.errors));
    } else {
      // Failed login attempt - will be counted by rate limiter
      // Error is already logged in authService
      next(error);
    }
  }
});

/**
 * POST /api/auth/register
 * Register new user
 */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const validated = registerSchema.parse(req.body);
    const result = await register(validated);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid input', error.errors));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', authenticate, async (req: any, res, next) => {
  try {
    // Only admin can access
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin only' });
    }
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/auth/profile
 * Update admin profile (email and/or password)
 */
const updateProfileSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(8, 'New password must be at most 8 characters').optional(),
});

router.put('/profile', authenticate, async (req: any, res, next) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const updatedUser = await updateProfile(req.user.userId, validated);
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ValidationError('Invalid input', error.errors));
    } else {
      next(error);
    }
  }
});

export default router;

