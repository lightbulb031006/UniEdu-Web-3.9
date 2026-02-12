/**
 * API Client
 * Axios instance with interceptors for authentication
 */

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Set to true if using httpOnly cookies
});

// Request interceptor: Add token to requests
// Sử dụng 'unicorns.token' giống code cũ
// Check both localStorage (rememberMe) and sessionStorage (no rememberMe)
api.interceptors.request.use(
  (config) => {
    // Try localStorage first (rememberMe = true)
    let token = localStorage.getItem('unicorns.token');
    // If not found, try sessionStorage (rememberMe = false)
    if (!token) {
      token = sessionStorage.getItem('unicorns.token');
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle errors and auto-refresh token
// Sử dụng 'unicorns.token' và 'unicorns.currentUser' giống code cũ
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't redirect on 401 for login endpoint - let the login form handle the error
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    const isRefreshEndpoint = error.config?.url?.includes('/auth/refresh');
    // Don't redirect on 401 for public endpoints - allow public access
    const isPublicClassEndpoint = error.config?.url?.includes('/classes/') && error.config?.method === 'get';
    const isPublicSessionsEndpoint = error.config?.url?.includes('/sessions') && error.config?.method === 'get';
    const isPublicSurveysEndpoint = error.config?.url?.includes('/surveys') && error.config?.method === 'get';
    const isPublicEndpoint = isPublicClassEndpoint || isPublicSessionsEndpoint || isPublicSurveysEndpoint;
    
    // If 401 and not login/refresh/public endpoint, try to refresh token
    if (error.response?.status === 401 && !isLoginEndpoint && !isRefreshEndpoint && !isPublicEndpoint && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      // Try to refresh token
      try {
        const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
        
        if (refreshToken) {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          
          // Update tokens in storage
          const rememberMe = localStorage.getItem('unicorns.currentUser') 
            ? JSON.parse(localStorage.getItem('unicorns.currentUser')!).rememberMe 
            : false;
          const storage = rememberMe ? localStorage : sessionStorage;
          
          storage.setItem('unicorns.token', data.token);
          storage.setItem('refreshToken', data.refreshToken);
          
          // Update authStore with new token
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            useAuthStore.getState().setAuth(currentUser, data.token, rememberMe);
          }
          
          // Update authorization header
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
          
          // Process queued requests
          processQueue(null, data.token);
          isRefreshing = false;
          
          // Retry original request
          return api(originalRequest);
        } else {
          throw new Error('No refresh token available');
        }
      } catch (refreshError) {
        // Refresh failed - logout and redirect
        processQueue(refreshError, null);
        isRefreshing = false;
        
        localStorage.removeItem('unicorns.token');
        localStorage.removeItem('unicorns.currentUser');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('unicorns.token');
        sessionStorage.removeItem('unicorns.currentUser');
        sessionStorage.removeItem('refreshToken');
        
        // Redirect to home
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }
    
    // Suppress 404 errors for home posts (expected when posts don't exist yet)
    if (error.response?.status === 404 && error.config?.url?.includes('/home/posts/')) {
      // Return a rejected promise but don't log to console
      // The calling code will handle it gracefully
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  }
);

export default api;

