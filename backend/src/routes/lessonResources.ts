/**
 * Lesson Resources Routes
 */

import { Router } from 'express';
import {
  getLessonResources,
  getLessonResourceById,
  createLessonResource,
  updateLessonResource,
  deleteLessonResource,
} from '../services/lessonResourcesService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/lesson-resources
 * Get all lesson resources
 */
router.get('/', async (req, res, next) => {
  try {
    const resources = await getLessonResources();
    res.json(resources);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-resources/:id
 * Get a single lesson resource by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const resource = await getLessonResourceById(req.params.id);
    res.json(resource);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-resources
 * Create a new lesson resource
 */
router.post('/', async (req, res, next) => {
  try {
    const resource = await createLessonResource(req.body);
    res.status(201).json(resource);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/lesson-resources/:id
 * Update a lesson resource
 */
router.put('/:id', async (req, res, next) => {
  try {
    const resource = await updateLessonResource(req.params.id, req.body);
    res.json(resource);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-resources/:id
 * Delete a lesson resource
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteLessonResource(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

