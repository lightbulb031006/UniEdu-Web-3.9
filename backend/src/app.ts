/**
 * UniEdu Backend API
 * Express server with authentication and CRUD operations
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import studentsRoutes from './routes/students';
import classesRoutes from './routes/classes';
import teachersRoutes from './routes/teachers';
import paymentsRoutes from './routes/payments';
import costsRoutes from './routes/costs';
import categoriesRoutes from './routes/categories';
import lessonPlansRoutes from './routes/lessonPlans';
import lessonResourcesRoutes from './routes/lessonResources';
import lessonTasksRoutes from './routes/lessonTasks';
import actionHistoryRoutes from './routes/actionHistory';
import sessionsRoutes from './routes/sessions';
import documentsRoutes from './routes/documents';
import staffRoutes from './routes/staff';
import walletTransactionsRoutes from './routes/walletTransactions';
import homeRoutes from './routes/home';
import bonusesRoutes from './routes/bonuses';
import lessonOutputsRoutes from './routes/lessonOutputs';
import lessonTopicsRoutes from './routes/lessonTopics';
import lessonTopicLinksRoutes from './routes/lessonTopicLinks';
import attendanceRoutes from './routes/attendance';

const app = express();

// Trust proxy - Required for Vercel serverless functions
// This allows Express to trust the X-Forwarded-* headers from Vercel
app.set('trust proxy', true);

// Security middleware
app.use(helmet());

// CORS configuration - allow multiple origins in development
const allowedOrigins = env.NODE_ENV === 'development'
  ? ['http://localhost:3000', 'http://localhost:5173', env.FRONTEND_URL].filter(Boolean)
  : [env.FRONTEND_URL];

// Helper function to check if origin is from Vercel
const isVercelOrigin = (origin: string): boolean => {
  return origin.includes('.vercel.app') || origin.includes('vercel.app');
};

// Helper function to check if origin is custom domain (unicornsedu.com)
const isCustomDomain = (origin: string): boolean => {
  return origin.includes('unicornsedu.com');
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, allow Vercel preview URLs, custom domain, and configured FRONTEND_URL
    if (env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin) || isVercelOrigin(origin) || isCustomDomain(origin)) {
        return callback(null, true);
      }
    } else {
      // In development, use strict list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(generalLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/costs', costsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/lesson-plans', lessonPlansRoutes);
app.use('/api/lesson-resources', lessonResourcesRoutes);
app.use('/api/lesson-tasks', lessonTasksRoutes);
app.use('/api/action-history', actionHistoryRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/wallet-transactions', walletTransactionsRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/bonuses', bonusesRoutes);
app.use('/api/lesson-outputs', lessonOutputsRoutes);
app.use('/api/lesson-topics', lessonTopicsRoutes);
app.use('/api/lesson-topic-links', lessonTopicLinksRoutes);
app.use('/api/attendance', attendanceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Helper function to find and kill process on port
function killProcessOnPort(port: number): boolean {
  try {
    const { execSync } = require('child_process');
    const isWindows = process.platform === 'win32';
    let killed = false;
    
    if (isWindows) {
      // Windows: Find process using port
      try {
        const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        const lines = result.trim().split('\n');
        const pids = new Set<string>();
        
        for (const line of lines) {
          const match = line.match(/\s+(\d+)\s*$/);
          if (match) {
            pids.add(match[1]);
          }
        }
        
        // Kill each process
        for (const pid of pids) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
            logger.warn(`Killed process ${pid} on port ${port}`);
            killed = true;
          } catch (err) {
            // Ignore errors
          }
        }
      } catch (err) {
        // Port might be free or command failed
      }
    } else {
      // Unix/Linux/Mac: Find and kill process
      try {
        const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
        const pids = result.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            logger.warn(`Killed process ${pid} on port ${port}`);
            killed = true;
          } catch (err) {
            // Ignore errors
          }
        }
      } catch (err) {
        // Port might be free or command failed
      }
    }
    return killed;
  } catch (err) {
    return false;
  }
}

// Start server
const PORT = parseInt(env.PORT);

// Cleanup expired dashboard cache every hour
setInterval(async () => {
  try {
    const { cleanupExpiredCache } = await import('./services/dashboardService');
    await cleanupExpiredCache();
    logger.info('✅ Cleaned up expired dashboard cache');
  } catch (error) {
    logger.error('[App] Error cleaning up expired cache:', error);
  }
}, 60 * 60 * 1000); // Every hour

// Run cleanup once on startup
(async () => {
  try {
    const { cleanupExpiredCache } = await import('./services/dashboardService');
    await cleanupExpiredCache();
    logger.info('✅ Initial dashboard cache cleanup completed');
  } catch (error) {
    logger.error('[App] Error in initial cache cleanup:', error);
  }
})();

// Try to start server
function startServer() {
  const server = app.listen(PORT, () => {
    logger.info(`🚀 Backend server running on port ${PORT}`);
    logger.info(`📝 Environment: ${env.NODE_ENV}`);
    logger.info(`🌐 Frontend URL: ${env.FRONTEND_URL}`);
    logger.info(`🔐 JWT expires in: ${env.JWT_EXPIRES_IN}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${PORT} is already in use!`);
      logger.warn(`Attempting to kill process on port ${PORT}...`);
      const killed = killProcessOnPort(PORT);
      
      if (killed) {
        logger.info(`Waiting 2 seconds for port to be released...`);
        setTimeout(() => {
          logger.info(`Retrying to start server on port ${PORT}...`);
          startServer();
        }, 2000);
      } else {
        logger.error(`❌ Cannot kill process on port ${PORT}. Please manually kill the process:`);
        if (process.platform === 'win32') {
          logger.error(`   Windows: netstat -ano | findstr :${PORT}`);
          logger.error(`   Then: taskkill /PID <PID> /F`);
          logger.error(`   Or run: .\\start-backend.ps1 (it will auto-kill the port)`);
        } else {
          logger.error(`   Unix/Mac: lsof -ti:${PORT} | xargs kill -9`);
        }
        process.exit(1);
      }
    } else {
      throw err;
    }
  });

  return server;
}

// Chỉ start server khi chạy local (không phải Vercel)
// Vercel sẽ tự động handle serverless function
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startServer();
}

export default app;

