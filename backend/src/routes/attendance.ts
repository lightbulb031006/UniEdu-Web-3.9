/**
 * Attendance Routes
 */

import { Router } from 'express';
import {
  getAttendanceBySession,
  saveAttendanceForSession,
  deleteAttendanceBySession,
} from '../services/attendanceService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/attendance?sessionId=xxx
 * Get attendance records for a session
 */
router.get('/', async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const attendance = await getAttendanceBySession(sessionId);
    res.json(attendance);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/attendance/session/:sessionId
 * Create or update attendance records for a session
 */
router.post('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { attendance } = req.body;

    if (!Array.isArray(attendance)) {
      return res.status(400).json({ error: 'attendance must be an array' });
    }

    const savedAttendance = await saveAttendanceForSession(sessionId, attendance);
    res.json(savedAttendance);
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/attendance/session/:sessionId
 * Delete attendance records for a session
 */
router.delete('/session/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await deleteAttendanceBySession(sessionId);
    res.status(204).send();
  } catch (error: any) {
    next(error);
  }
});

export default router;

