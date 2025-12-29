/**
 * Authentication Service
 * Migrated from backup/assets/js/auth.js
 * Giữ nguyên logic cũ với error handling và validation
 */

import api from './api';
import { useAuthStore } from '../store/authStore';

export interface LoginCredentials {
  email: string; // Can be email, phone, or account_handle
  password: string;
  rememberMe?: boolean; // Remember me for 30 days
}

export interface RegisterData {
  email: string;
  password: string;
  role: 'student' | 'teacher' | 'admin';
  name?: string;
  phone?: string;
  accountHandle?: string;
  profile?: {
    fullName?: string;
    phone?: string;
    classId?: string;
    specialization?: string;
  };
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    linkId?: string | null;
    assistantType?: string | null;
  };
}

/**
 * Sanitize input value (giống code cũ)
 */
function sanitizeInputValue(value: any): string {
  if (value == null) return '';
  return String(value).trim();
}

export const authService = {
  /**
   * Login - giống logic cũ với validation và error handling
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Sanitize input (giống code cũ)
    const loginInput = sanitizeInputValue(credentials.email);
    const password = credentials.password;

    if (!loginInput || !password) {
      throw new Error('Vui lòng nhập email/handle và mật khẩu');
    }

    try {
      // Debug logging (chỉ trong development)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔐 Login attempt:', {
          emailOrHandle: loginInput,
          passwordLength: password.length,
        });
      }

      const { data } = await api.post<AuthResponse>('/auth/login', {
        email: loginInput, // Backend sẽ xử lý email/phone/handle
        password,
        rememberMe: credentials.rememberMe || false,
      });

      // Set auth (sẽ lưu vào localStorage với key 'unicorns.token' và 'unicorns.currentUser')
      useAuthStore.getState().setAuth(data.user, data.token, credentials.rememberMe || false);
      
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      // Debug logging
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('✅ Login success:', {
          userId: data.user.id,
          email: data.user.email,
          role: data.user.role,
        });
      }

      return data;
    } catch (error: any) {
      // Error handling (giống code cũ)
      const errorMessage = error.response?.data?.error || error.message || 'Đăng nhập thất bại';
      
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.error('❌ Login error:', errorMessage, error);
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Register - giống logic cũ
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // Sanitize và validate
    const email = sanitizeInputValue(data.email);
    const password = data.password;
    const name = sanitizeInputValue(data.name || data.profile?.fullName || '');

    if (!email || !password) {
      throw new Error('Vui lòng nhập đầy đủ thông tin');
    }

    if (password.length < 6) {
      throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
    }

    try {
      const response = await api.post<AuthResponse>('/auth/register', {
        email,
        password,
        name: name || email.split('@')[0],
        role: data.role || 'student',
        phone: data.phone || data.profile?.phone,
        accountHandle: data.accountHandle,
      });

      useAuthStore.getState().setAuth(response.data.user, response.data.token, false);
      
      if (response.data.refreshToken) {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      }

      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Đăng ký thất bại';
      throw new Error(errorMessage);
    }
  },

  /**
   * Get current user from API
   */
  async getCurrentUser() {
    try {
      const { data } = await api.get('/auth/me');
      useAuthStore.getState().updateUser(data);
      return data;
    } catch (error: any) {
      // If token is invalid, clear auth
      useAuthStore.getState().logout();
      throw error;
    }
  },

  /**
   * Logout
   */
  logout() {
    useAuthStore.getState().logout();
  },
};

