/**
 * Lesson Topic Links Routes
 */

import { Router } from 'express';
import {
  getLessonTopicLinks,
  getLessonTopicLinkById,
  createLessonTopicLink,
  deleteLessonTopicLink,
  deleteLessonTopicLinkByTopicAndOutput,
  bulkCreateLessonTopicLinks,
  bulkUpdateLessonTopicOrder,
} from '../services/lessonTopicLinksService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/lesson-topic-links
 * Get all lesson topic links with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters: any = {};
    if (req.query.topicId) {
      filters.topicId = req.query.topicId as string;
    }
    if (req.query.lessonOutputId) {
      filters.lessonOutputId = req.query.lessonOutputId as string;
    }
    const links = await getLessonTopicLinks(filters);
    res.json(links);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/lesson-topic-links/:id
 * Get a single lesson topic link by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const link = await getLessonTopicLinkById(req.params.id);
    res.json(link);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-topic-links
 * Create a new lesson topic link
 */
router.post('/', async (req, res, next) => {
  try {
    const link = await createLessonTopicLink(req.body);
    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-topic-links/bulk
 * Bulk create lesson topic links
 */
router.post('/bulk', async (req, res, next) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array' });
    }
    const links = await bulkCreateLessonTopicLinks(req.body);
    res.status(201).json(links);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-topic-links/:id
 * Delete a lesson topic link
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteLessonTopicLink(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/lesson-topic-links/by-topic-and-output
 * Delete a lesson topic link by topic and output IDs
 */
router.delete('/by-topic-and-output', async (req, res, next) => {
  try {
    const { topicId, lessonOutputId } = req.body;
    if (!topicId || !lessonOutputId) {
      return res.status(400).json({ error: 'Missing required fields: topicId, lessonOutputId' });
    }
    await deleteLessonTopicLinkByTopicAndOutput(topicId, lessonOutputId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/lesson-topic-links/bulk-order
 * Bulk update order_index for multiple lesson topic links
 */
router.post('/bulk-order', async (req, res, next) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid input: updates must be an array' });
    }
    const updatedLinks = await bulkUpdateLessonTopicOrder(updates);
    res.json(updatedLinks);
  } catch (error) {
    next(error);
  }
});

export default router;

