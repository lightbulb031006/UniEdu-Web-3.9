/**
 * Authentication Store (Zustand)
 * Migrated from backup/assets/js/auth.js
 * Giữ nguyên logic cũ: token key 'unicorns.token', user key 'unicorns.currentUser'
 */

import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  linkId?: string | null;
  assistantType?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string, rememberMe?: boolean) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  initFromStorage: () => void;
}

const CURRENT_KEY = 'unicorns.currentUser';
const TOKEN_KEY = 'unicorns.token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token, rememberMe: boolean = false) => {
    try {
      // Lưu token (giống code cũ)
      localStorage.setItem(TOKEN_KEY, token);
      
      // Lưu user với session expiration
      // If rememberMe is true, session lasts 30 days, otherwise 24 hours
      const SESSION_DURATION_MS = rememberMe 
        ? 30 * 24 * 60 * 60 * 1000 // 30 days
        : 24 * 60 * 60 * 1000; // 24 hours
      const now = Date.now();
      const sessionPayload = {
        ...user,
        sessionStartedAt: now,
        sessionExpiresAt: now + SESSION_DURATION_MS,
        rememberMe,
      };
      localStorage.setItem(CURRENT_KEY, JSON.stringify(sessionPayload));
      
      set({ user, token, isAuthenticated: true });
    } catch (e) {
      console.error('Failed to save auth data:', e);
    }
  },

  logout: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('refreshToken');
      localStorage.removeItem(CURRENT_KEY);
    } catch (e) {
      // Ignore
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    const current = get();
    if (current.user) {
      const updated = { ...current.user, ...user };
      current.setAuth(updated, current.token || '');
    } else {
      set({ user });
    }
  },

  initFromStorage: () => {
    try {
      // Load user từ localStorage (giống code cũ)
      const raw = localStorage.getItem(CURRENT_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const expiresAt = parsed.sessionExpiresAt;

      // Check if expired (giống code cũ)
      if (!expiresAt || expiresAt <= Date.now()) {
        // Session expired -> force logout
        localStorage.removeItem(CURRENT_KEY);
        localStorage.removeItem(TOKEN_KEY);
        return;
      }

      const token = localStorage.getItem(TOKEN_KEY);
      if (token && parsed.id) {
        // Remove session metadata
        const { sessionStartedAt, sessionExpiresAt, ...user } = parsed;
        set({ user, token, isAuthenticated: true });
      }
    } catch (e) {
      // Clear invalid data
      try {
        localStorage.removeItem(CURRENT_KEY);
        localStorage.removeItem(TOKEN_KEY);
      } catch (e2) {
        // Ignore
      }
    }
  },
}));

