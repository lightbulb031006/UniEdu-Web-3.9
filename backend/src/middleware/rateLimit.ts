/**
 * Rate Limiting Middleware
 */

import rateLimit from 'express-rate-limit';
import env from '../config/env';

const windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
const max = parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 100;

// In development, disable rate limiting completely
const isDevelopment = env.NODE_ENV === 'development';

export const generalLimiter = rateLimit({
  windowMs,
  max: isDevelopment ? 100000 : max, // Very high limit in development (effectively disabled)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Disable trust proxy validation for Vercel serverless functions
  // Vercel requires trust proxy, but we don't want rate limiter to warn about it
  validate: {
    trustProxy: false,
  },
  skip: () => {
    // Skip rate limiting completely in development
    return isDevelopment;
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per window
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  // Disable trust proxy validation for Vercel
  validate: {
    trustProxy: false,
  },
});

// Rate limiter for login failures - lock for 10 minutes after 5 failed attempts
export const loginFailureLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes lock period
  max: 5, // 5 failed attempts
  message: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  // Disable trust proxy validation for Vercel
  validate: {
    trustProxy: false,
  },
  skip: () => {
    // Skip in development for easier testing
    return isDevelopment;
  },
});

