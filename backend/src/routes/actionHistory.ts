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
    if (req.query.entityType) {
      filters.entityType = req.query.entityType as string;
    }
    if (req.query.entityId) {
      filters.entityId = req.query.entityId as string;
    }
    if (req.query.userId) {
      filters.userId = req.query.userId as string;
    }
    if (req.query.actionType) {
      filters.actionType = req.query.actionType as string;
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string;
    }
    if (req.query.endDate) {
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
    const action = await recordAction(req.body);
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

