/**
 * Lesson Tasks Routes
 */

import { Router } from 'express';
import {
  getLessonTasks,
  getLessonTaskById,
  createLessonTask,
  updateLessonTask,
  deleteLessonTask,
  bulkUpdateTaskStatuses,
} from '../services/lessonTasksService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/lesson-tasks
 * Get all lesson tasks with optional filters
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
    const tasks = await getLessonTasks(filters);
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-tasks/:id
 * Get a single lesson task by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const task = await getLessonTaskById(req.params.id);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-tasks
 * Create a new lesson task
 */
router.post('/', async (req, res, next) => {
  try {
    const task = await createLessonTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/lesson-tasks/:id
 * Update a lesson task
 */
router.put('/:id', async (req, res, next) => {
  try {
    const task = await updateLessonTask(req.params.id, req.body);
    res.json(task);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-tasks/:id
 * Delete a lesson task
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteLessonTask(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-tasks/bulk-update-status
 * Bulk update task statuses
 */
router.post('/bulk-update-status', async (req, res, next) => {
  try {
    const { taskIds, status } = req.body;
    if (!Array.isArray(taskIds) || !status) {
      return res.status(400).json({ error: 'Missing required fields: taskIds (array), status' });
    }
    await bulkUpdateTaskStatuses(taskIds, status);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

