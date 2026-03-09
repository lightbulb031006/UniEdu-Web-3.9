/**
 * Action History Routes
 */

import { Router } from 'express';
import { getActionHistory, recordAction, undoAction } from '../services/actionHistoryService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/action-history
 * Get action history with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters: any = {};
    
    // Only add filter if value is not empty (like backup)
    if (req.query.entityType && req.query.entityType !== '') {
      filters.entityType = req.query.entityType as string;
    }
    if (req.query.entityId && req.query.entityId !== '') {
      filters.entityId = req.query.entityId as string;
    }
    if (req.query.userId && req.query.userId !== '') {
      filters.userId = req.query.userId as string;
    }
    if (req.query.actionType && req.query.actionType !== '') {
      filters.actionType = req.query.actionType as string;
    }
    if (req.query.startDate && req.query.startDate !== '') {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate && req.query.endDate !== '') {
      filters.endDate = req.query.endDate as string;
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.offset) {
      filters.offset = parseInt(req.query.offset as string, 10);
    }

    const history = await getActionHistory(filters);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/action-history
 * Record a new action (usually called internally by other services)
 */
router.post('/', async (req, res, next) => {
  try {
    const user = (req as any).user; // Set by authenticate middleware
    
    // Automatically add user info from authenticated request
    const params = {
      ...req.body,
      userId: req.body.userId || user?.userId,
      userEmail: req.body.userEmail || user?.email,
      userRole: req.body.userRole || user?.role,
    };
    
    const action = await recordAction(params);
    res.status(201).json(action);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/action-history/:id/undo
 * Undo an action
 */
router.post('/:id/undo', async (req, res, next) => {
  try {
    const user = (req as any).user; // Set by authenticate middleware
    const result = await undoAction(req.params.id, user?.id, user?.email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

