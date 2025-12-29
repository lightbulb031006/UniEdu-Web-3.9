/**
 * Lesson Outputs Routes
 */

import { Router } from 'express';
import {
  getLessonOutputs,
  getLessonOutputById,
  createLessonOutput,
  updateLessonOutput,
  deleteLessonOutput,
  bulkUpdateLessonOutputStatuses,
} from '../services/lessonOutputsService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/lesson-outputs
 * Get all lesson outputs with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters: any = {};
    if (req.query.assistantId) {
      filters.assistantId = req.query.assistantId as string;
    }
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.month) {
      filters.month = req.query.month as string;
    }
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.level) {
      filters.level = req.query.level as string;
    }
    if (req.query.tag) {
      filters.tag = req.query.tag as string;
    }
    const outputs = await getLessonOutputs(filters);
    res.json(outputs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-outputs/:id
 * Get a single lesson output by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const output = await getLessonOutputById(req.params.id);
    res.json(output);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-outputs
 * Create a new lesson output
 */
router.post('/', async (req, res, next) => {
  try {
    const output = await createLessonOutput(req.body);
    res.status(201).json(output);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/lesson-outputs/:id
 * Update an existing lesson output
 */
router.put('/:id', async (req, res, next) => {
  try {
    const output = await updateLessonOutput(req.params.id, req.body);
    res.json(output);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-outputs/:id
 * Delete a lesson output
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteLessonOutput(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-outputs/bulk-update-status
 * Bulk update statuses of multiple lesson outputs
 */
router.post('/bulk-update-status', async (req, res, next) => {
  try {
    const { outputIds, status } = req.body;
    if (!Array.isArray(outputIds) || !status) {
      return res.status(400).json({ error: 'Missing required fields: outputIds (array), status' });
    }
    const updatedOutputs = await bulkUpdateLessonOutputStatuses(outputIds, status);
    res.json(updatedOutputs);
  } catch (error: any) {
    next(error);
  }
});

export default router;

