/**
 * Lesson Plans Routes
 */

import { Router } from 'express';
import { getLessonPlans, getLessonPlanById, createLessonPlan, updateLessonPlan, deleteLessonPlan } from '../services/lessonPlansService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/lesson-plans
 * Get all lesson plans with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters: any = {};
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.level) {
      filters.level = req.query.level as string;
    }
    if (req.query.tag) {
      filters.tag = req.query.tag as string;
    }
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    const lessonPlans = await getLessonPlans(filters);
    res.json(lessonPlans);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-plans/:id
 * Get a single lesson plan by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const lessonPlan = await getLessonPlanById(req.params.id);
    if (!lessonPlan) {
      return res.status(404).json({ error: 'Lesson plan not found' });
    }
    res.json(lessonPlan);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-plans
 * Create a new lesson plan
 */
router.post('/', async (req, res, next) => {
  try {
    const lessonPlan = await createLessonPlan(req.body);
    res.status(201).json(lessonPlan);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/lesson-plans/:id
 * Update an existing lesson plan
 */
router.put('/:id', async (req, res, next) => {
  try {
    const lessonPlan = await updateLessonPlan(req.params.id, req.body);
    res.json(lessonPlan);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-plans/:id
 * Delete a lesson plan
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteLessonPlan(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

