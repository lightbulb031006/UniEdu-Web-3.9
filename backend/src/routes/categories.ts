/**
 * Categories Routes
 */

import { Router } from 'express';
import { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from '../services/categoriesService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/categories
 * Get all categories
 */
router.get('/', async (req, res, next) => {
  try {
    const categories = await getCategories();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/categories/:id
 * Get a single category by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    const category = await getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/categories
 * Create a new category
 */
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const category = await createCategory(name);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/categories/:id
 * Update an existing category
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const category = await updateCategory(id, name);
    res.json(category);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a category
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    await deleteCategory(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

