/**
 * Sessions Routes
 */

import { Router } from 'express';
import { getSessions, getSessionsForDateRange, getSessionById, createSession, updateSession, deleteSession } from '../services/sessionsService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Helper function to filter tuition_fee based on user role
 * Only admin can see tuition_fee
 */
function filterTuitionFeeForRole(session: any, userRole: string): any {
  if (userRole !== 'admin') {
    const { tuition_fee, ...sessionWithoutTuitionFee } = session;
    return sessionWithoutTuitionFee;
  }
  return session;
}

/**
 * GET /api/sessions
 * Get all sessions with optional filters
 * Only admin can see tuition_fee field
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const filters: any = {};
    if (req.query.classId) {
      filters.classId = req.query.classId as string;
    }
    if (req.query.teacherId) {
      filters.teacherId = req.query.teacherId as string;
    }
    if (req.query.date) {
      filters.date = req.query.date as string;
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate as string;
    }

    const userRole = req.user?.role || '';

    // If both startDate and endDate are provided, use date range query
    if (filters.startDate && filters.endDate) {
      const sessions = await getSessionsForDateRange(filters.startDate, filters.endDate, {
        classId: filters.classId,
        teacherId: filters.teacherId,
      });
      // Filter tuition_fee based on role
      const filteredSessions = sessions.map(s => filterTuitionFeeForRole(s, userRole));
      return res.json(filteredSessions);
    }

    const sessions = await getSessions(filters);
    // Filter tuition_fee based on role
    const filteredSessions = sessions.map(s => filterTuitionFeeForRole(s, userRole));
    res.json(filteredSessions);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sessions/:id
 * Get a single session by ID
 * Only admin can see tuition_fee field
 */
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const session = await getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const userRole = req.user?.role || '';
    const filteredSession = filterTuitionFeeForRole(session, userRole);
    res.json(filteredSession);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sessions
 * Create a new session
 */
router.post('/', async (req, res, next) => {
  try {
    const session = await createSession(req.body);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/sessions/:id
 * Update an existing session
 */
router.put('/:id', async (req, res, next) => {
  try {
    const session = await updateSession(req.params.id, req.body);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete a session
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteSession(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

