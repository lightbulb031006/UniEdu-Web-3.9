/**
 * Authentication Service
 * Handles user authentication and JWT token generation
 */

import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import supabase from '../config/database';
import env from '../config/env';
import { AuthenticationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface LoginCredentials {
  email: string; // Can be email, phone, or account_handle
  password: string;
  rememberMe?: boolean; // If true, token expires in 30 days
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    linkId?: string | null;
  };
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: { userId: string; role: string; email?: string }, rememberMe: boolean = false): string {
  // If rememberMe is true, token expires in 30 days, otherwise use default expiration
  const expiresIn = rememberMe ? '30d' : env.JWT_EXPIRES_IN;
  // @ts-ignore - expiresIn accepts string values like "15m", "1h", "30d", etc.
  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: { userId: string }): string {
  // @ts-ignore - expiresIn accepts string values like "7d", "30d", etc.
  return jwt.sign(payload, env.JWT_SECRET as string, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Login user
 * Supports login by email, phone, or account_handle (like old app)
 */
export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  const { email, password, rememberMe = false } = credentials;
  const loginInput = email.trim().toLowerCase();

  // Query user from Supabase - try email, phone, or account_handle
  // Similar to old app's queryUserFromSupabase function
  // Note: Removed .eq('status', 'active') filter in case the column doesn't exist
  // Use separate queries for each field to ensure compatibility
  let user: any = null;

  // Try email first (exact match, case-insensitive using ilike with pattern)
  const { data: emailUsers, error: emailError } = await supabase
    .from('users')
    .select('id, email, password, name, role, phone, account_handle, link_id')
    .ilike('email', `%${loginInput}%`)
    .limit(10);

  if (!emailError && emailUsers && emailUsers.length > 0) {
    // Verify exact match (case-insensitive)
    const found = emailUsers.find((u: any) => u.email && u.email.toLowerCase() === loginInput);
    if (found) {
      user = found;
    }
  }

  // If not found by email, try phone
  if (!user) {
    const { data: phoneUsers, error: phoneError } = await supabase
      .from('users')
      .select('id, email, password, name, role, phone, account_handle, link_id')
      .ilike('phone', `%${loginInput}%`)
      .limit(10);

    if (!phoneError && phoneUsers && phoneUsers.length > 0) {
      // Verify exact match (case-insensitive)
      const found = phoneUsers.find((u: any) => u.phone && u.phone && u.phone.toLowerCase() === loginInput);
      if (found) {
        user = found;
      }
    }

    // If still not found, try account_handle
    if (!user) {
      const { data: handleUsers, error: handleError } = await supabase
        .from('users')
        .select('id, email, password, name, role, phone, account_handle, link_id')
        .ilike('account_handle', `%${loginInput}%`)
        .limit(10);

      if (!handleError && handleUsers && handleUsers.length > 0) {
        // Verify exact match (case-insensitive)
        const found = handleUsers.find((u: any) => u.account_handle && u.account_handle.toLowerCase() === loginInput);
        if (found) {
          user = found;
        }
      }

      // Only log error if it's a real database error (not just "not found")
      if (handleError && handleError.code !== 'PGRST116') {
        logger.error('Supabase query error during login (handle)', { error: handleError.message, loginInput });
      }
    }

    // Only log error if it's a real database error (not just "not found")
    if (!user && phoneError && phoneError.code !== 'PGRST116') {
      logger.error('Supabase query error during login (phone)', { error: phoneError.message, loginInput });
    }
  }

  // Only log error if it's a real database error (not just "not found")
  if (!user && emailError && emailError.code !== 'PGRST116') {
    logger.error('Supabase query error during login (email)', { error: emailError.message, loginInput });
  }

  if (!user) {
    logger.warn('[LOGIN] Login failed: user not found', { 
      loginInput: loginInput.substring(0, 3) + '***',
    });
    throw new AuthenticationError('Invalid email or password');
  }

  // Verify password
  // Check if password is hashed (bcrypt) or plaintext (legacy)
  let passwordValid = false;

  if (!user.password) {
    logger.warn('[LOGIN] Login failed: user has no password', { 
      userId: user.id,
    });
    throw new AuthenticationError('Invalid email or password');
  }

  const isHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');

  if (isHashed) {
    passwordValid = await verifyPassword(password, user.password);
  } else {
    // Legacy: plaintext comparison (for backward compatibility with old admin accounts)
    passwordValid = user.password === password;
    if (passwordValid) {
      logger.warn('Using plaintext password comparison (legacy mode)', { userId: user.id, email: user.email });
    }
  }

  if (!passwordValid) {
    logger.warn('[LOGIN] Login failed: invalid password', { 
      userId: user.id,
    });
    throw new AuthenticationError('Invalid email or password');
  }

  // Generate tokens
  const token = generateToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  }, rememberMe);

  const refreshToken = generateRefreshToken({
    userId: user.id,
  });

  logger.info('[LOGIN] Login successful', { 
    userId: user.id, 
    role: user.role,
  });

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role,
      linkId: user.link_id || null,
    },
  };
}

/**
 * Register new user
 */
export async function register(data: RegisterData): Promise<AuthResult> {
  const { email, password, name, role } = data;

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (existingUser) {
    throw new AuthenticationError('Email already registered');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user in Supabase
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role,
      status: 'active',
    })
    .select('id, email, name, role')
    .single();

  if (error || !user) {
    logger.error('Failed to create user', { error, email });
    throw new Error('Failed to create user account');
  }

  // Generate tokens (default expiration for register, no rememberMe)
  const token = generateToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  }, false);

  const refreshToken = generateRefreshToken({
    userId: user.id,
  });

  logger.info('User registered successfully', { userId: user.id, email: user.email });

  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role,
    },
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, role, status, link_id')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new NotFoundError('User');
  }

  return user;
}

/**
 * Update admin profile (email and/or password)
 * Only admin can update their own profile
 */
export interface UpdateProfileData {
  email?: string;
  oldPassword: string;
  newPassword?: string;
}

export async function updateProfile(userId: string, data: UpdateProfileData) {
  // Get current user
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id, email, password, role')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    throw new NotFoundError('User');
  }

  // Only admin can update profile
  if (user.role !== 'admin') {
    throw new AuthenticationError('Only admin can update profile');
  }

  // Verify old password
  if (!user.password) {
    throw new AuthenticationError('User has no password set');
  }

  const isHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
  let passwordValid = false;

  if (isHashed) {
    passwordValid = await verifyPassword(data.oldPassword, user.password);
  } else {
    // Legacy: plaintext comparison
    passwordValid = user.password === data.oldPassword;
  }

  if (!passwordValid) {
    throw new AuthenticationError('Mật khẩu cũ không đúng');
  }

  // Prepare update data
  const updateData: any = {};

  if (data.email && data.email.trim() !== user.email) {
    // Check if new email is already taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email.toLowerCase().trim())
      .neq('id', userId)
      .single();

    if (existingUser) {
      throw new AuthenticationError('Email đã được sử dụng bởi tài khoản khác');
    }

    updateData.email = data.email.toLowerCase().trim();
  }

  if (data.newPassword && data.newPassword.trim()) {
    // Validate password length (6-8 characters as per old app)
    if (data.newPassword.length < 6 || data.newPassword.length > 8) {
      throw new AuthenticationError('Mật khẩu mới phải có từ 6-8 ký tự');
    }

    // Hash new password
    updateData.password = await hashPassword(data.newPassword);
  }

  // Update user
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select('id, email, name, role')
    .single();

  if (updateError || !updatedUser) {
    logger.error('Failed to update user profile', { error: updateError, userId });
    throw new Error('Không thể cập nhật thông tin tài khoản');
  }

  logger.info('User profile updated successfully', { userId, email: updatedUser.email });

  return updatedUser;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET as string) as {
      userId: string;
    };

    // Get user to verify they still exist and get their role/email
    const user = await getUserById(decoded.userId);

    // Generate new tokens
    const newToken = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    }, false); // Use default expiration for refresh (not rememberMe)

    const newRefreshToken = generateRefreshToken({
      userId: user.id,
    });

    logger.info('[REFRESH] Token refreshed successfully', { userId: user.id });

    return {
      token: newToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      logger.warn('[REFRESH] Invalid or expired refresh token');
      throw new AuthenticationError('Invalid or expired refresh token');
    }
    throw error;
  }
}

/**
 * Get all users (admin only)
 * Filter out visitors
 */
export async function getUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, name, role, status')
    .neq('role', 'visitor')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Failed to fetch users', { error });
    throw new Error('Failed to fetch users');
  }

  return (users || []).map((user: any) => ({
    id: user.id,
    email: user.email,
    name: user.name || user.email || user.id,
    role: user.role,
    status: user.status,
  }));
}

