/**
 * API Client
 * Axios instance with interceptors for authentication
 */

import axios from 'axios';

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

// Response interceptor: Handle errors
// Sử dụng 'unicorns.token' và 'unicorns.currentUser' giống code cũ
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 for login endpoint - let the login form handle the error
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    // Don't redirect on 401 for public endpoints - allow public access
    const isPublicClassEndpoint = error.config?.url?.includes('/classes/') && error.config?.method === 'get';
    const isPublicSessionsEndpoint = error.config?.url?.includes('/sessions') && error.config?.method === 'get';
    const isPublicSurveysEndpoint = error.config?.url?.includes('/surveys') && error.config?.method === 'get';
    const isPublicEndpoint = isPublicClassEndpoint || isPublicSessionsEndpoint || isPublicSurveysEndpoint;
    
    if (error.response?.status === 401 && !isLoginEndpoint && !isPublicEndpoint) {
      // Token expired or invalid (but not for login attempts or public class access)
      localStorage.removeItem('unicorns.token');
      localStorage.removeItem('unicorns.currentUser');
      localStorage.removeItem('refreshToken');
      // Also clear sessionStorage
      sessionStorage.removeItem('unicorns.token');
      sessionStorage.removeItem('unicorns.currentUser');
      sessionStorage.removeItem('refreshToken');
      // Redirect to home (giống code cũ)
      window.location.href = '/';
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

