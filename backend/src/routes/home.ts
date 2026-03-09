/**
 * Home Routes
 * API endpoints for home page sections
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getHomePosts, getHomePostByCategory, upsertHomePost, deleteHomePost } from '../services/homeService';

const router = Router();

/**
 * GET /api/home/posts
 * Get all home posts
 */
router.get('/posts', async (req, res, next) => {
  try {
    const posts = await getHomePosts();
    res.json(posts);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/home/posts/:category
 * Get home post by category
 */
router.get('/posts/:category', async (req, res, next) => {
  try {
    const post = await getHomePostByCategory(req.params.category);
    if (!post) {
      return res.status(404).json({ error: 'Home post not found' });
    }
    res.json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/home/posts
 * Create or update home post (admin only)
 */
router.post('/posts', authenticate, async (req, res, next) => {
  try {
    const post = await upsertHomePost(req.body);
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/home/posts/:id
 * Update home post (admin only)
 */
router.put('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const post = await upsertHomePost({ ...req.body, id: req.params.id });
    res.json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/home/posts/:id
 * Delete home post (admin only)
 */
router.delete('/posts/:id', authenticate, async (req, res, next) => {
  try {
    await deleteHomePost(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

