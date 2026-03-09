/**
 * Simple Logger Utility
 * In production, replace with Winston or Pino
 */

import env from '../config/env';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const logLevels: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = logLevels[env.LOG_LEVEL] || logLevels.info;

function shouldLog(level: LogLevel): boolean {
  return logLevels[level] <= currentLevel;
}

function sanitizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const sensitive = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized = { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitive.some(s => lowerKey.includes(s))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key]);
    }
  }
  
  return sanitized;
}

export const logger = {
  error: (message: string, error?: any) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${message}`, error ? sanitizeData(error) : '');
    }
  },
  
  warn: (message: string, data?: any) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, data ? sanitizeData(data) : '');
    }
  },
  
  info: (message: string, data?: any) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${message}`, data ? sanitizeData(data) : '');
    }
  },
  
  debug: (message: string, data?: any) => {
    if (shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, data ? sanitizeData(data) : '');
    }
  },
};

