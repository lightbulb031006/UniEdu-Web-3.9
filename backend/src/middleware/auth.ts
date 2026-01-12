/**
 * JWT Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import env from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email?: string;
  };
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, env.JWT_SECRET as string) as {
      userId: string;
      role: string;
      email?: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    }
    next(error);
  }
}

/**
 * Optional authentication middleware
 * Tries to authenticate user if token is provided, but doesn't require it
 * Sets req.user if token is valid, otherwise leaves it undefined
 */
export function optionalAuthenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      req.user = undefined;
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET as string) as {
        userId: string;
        role: string;
        email?: string;
      };

      req.user = decoded;
      next();
    } catch (tokenError) {
      // Invalid or expired token, continue without authentication
      req.user = undefined;
      next();
    }
  } catch (error) {
    // Any other error, continue without authentication
    req.user = undefined;
    next();
  }
}

export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError('Not authenticated');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AuthorizationError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
    }

    next();
  };
}

