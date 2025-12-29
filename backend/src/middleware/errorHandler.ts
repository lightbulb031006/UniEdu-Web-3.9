/**
 * Global Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import env from '../config/env';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    // Don't log warnings for 401 "No token provided" - it's normal when user is not logged in
    const isUnauthorizedNoToken = err.statusCode === 401 && err.message === 'No token provided';
    
    if (isUnauthorizedNoToken) {
      // Only log at debug level in development
      if (env.NODE_ENV === 'development') {
        logger.debug(`Unauthorized request (no token): ${req.method} ${req.path}`);
      }
    } else {
      logger.warn(`AppError: ${err.message}`, {
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      });
    }

    return res.status(err.statusCode).json({
      error: err.message,
      ...(err instanceof ValidationError && err.errors && { errors: err.errors }),
    });
  }

  // Unexpected errors
  logger.error('Unexpected error:', {
    message: err.message,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
}

