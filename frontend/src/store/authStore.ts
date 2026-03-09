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
      // If rememberMe is true, use localStorage (persists for 30 days)
      // If rememberMe is false, use sessionStorage (cleared when browser closes)
      const storage = rememberMe ? localStorage : sessionStorage;
      
      // Lưu token
      storage.setItem(TOKEN_KEY, token);
      
      // Lưu user với session expiration
      // If rememberMe is true, session lasts 30 days, otherwise sessionStorage will be cleared on browser close
      const SESSION_DURATION_MS = rememberMe 
        ? 30 * 24 * 60 * 60 * 1000 // 30 days
        : 24 * 60 * 60 * 1000; // 24 hours (fallback, but sessionStorage clears on close anyway)
      const now = Date.now();
      const sessionPayload = {
        ...user,
        sessionStartedAt: now,
        sessionExpiresAt: now + SESSION_DURATION_MS,
        rememberMe,
      };
      storage.setItem(CURRENT_KEY, JSON.stringify(sessionPayload));
      
      // refreshToken is already saved in the correct storage by authService before setAuth is called
      
      set({ user, token, isAuthenticated: true });
    } catch (e) {
      console.error('Failed to save auth data:', e);
    }
  },

  logout: () => {
    try {
      // Clear both localStorage and sessionStorage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('refreshToken');
      localStorage.removeItem(CURRENT_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem(CURRENT_KEY);
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
      // Try localStorage first (rememberMe = true)
      let raw = localStorage.getItem(CURRENT_KEY);
      let storage = localStorage;
      
      // If not found in localStorage, try sessionStorage (rememberMe = false)
      if (!raw) {
        raw = sessionStorage.getItem(CURRENT_KEY);
        storage = sessionStorage;
      }
      
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const expiresAt = parsed.sessionExpiresAt;

      // Check if expired
      if (!expiresAt || expiresAt <= Date.now()) {
        // Session expired -> force logout
        storage.removeItem(CURRENT_KEY);
        storage.removeItem(TOKEN_KEY);
        storage.removeItem('refreshToken');
        return;
      }

      const token = storage.getItem(TOKEN_KEY);
      if (token && parsed.id) {
        // Remove session metadata
        const { sessionStartedAt, sessionExpiresAt, rememberMe, ...user } = parsed;
        set({ user, token, isAuthenticated: true });
      }
    } catch (e) {
      // Clear invalid data from both storages
      try {
        localStorage.removeItem(CURRENT_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem(CURRENT_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem('refreshToken');
      } catch (e2) {
        // Ignore
      }
    }
  },
}));

