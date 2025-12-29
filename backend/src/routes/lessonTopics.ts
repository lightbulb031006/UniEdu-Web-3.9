/**
 * Lesson Topics Routes
 */

import { Router } from 'express';
import {
  getLessonTopics,
  getLessonTopicById,
  createLessonTopic,
  updateLessonTopic,
  deleteLessonTopic,
  initializeDefaultTopics,
} from '../services/lessonTopicsService';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/lesson-topics/initialize-defaults
 * Initialize default topics (idempotent)
 */
router.post('/initialize-defaults', async (req, res, next) => {
  try {
    await initializeDefaultTopics();
    const topics = await getLessonTopics();
    res.json({ success: true, topics });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-topics
 * Get all lesson topics
 */
router.get('/', async (req, res, next) => {
  try {
    const topics = await getLessonTopics();
    res.json(topics);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-topics/:id
 * Get a single lesson topic by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const topic = await getLessonTopicById(req.params.id);
    res.json(topic);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-topics
 * Create a new lesson topic
 */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const topic = await createLessonTopic(req.body, req.user?.userId);
    res.status(201).json(topic);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/lesson-topics/:id
 * Update an existing lesson topic
 */
router.put('/:id', async (req, res, next) => {
  try {
    const topic = await updateLessonTopic(req.params.id, req.body);
    res.json(topic);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-topics/:id
 * Delete a lesson topic
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteLessonTopic(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

