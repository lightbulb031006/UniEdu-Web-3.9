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
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('unicorns.token');
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
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('unicorns.token');
      localStorage.removeItem('unicorns.currentUser');
      localStorage.removeItem('refreshToken');
      // Redirect to home (giống code cũ)
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;

