/**
 * Costs Routes
 */

import { Router } from 'express';
import { getCosts, getCostById, createCost, updateCost, deleteCost } from '../services/costsService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/costs
 * Get all costs with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters: any = {};
    if (req.query.month) {
      filters.month = req.query.month as string;
    }
    const costs = await getCosts(filters);
    res.json(costs);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/costs/:id
 * Get a single cost by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const cost = await getCostById(req.params.id);
    if (!cost) {
      return res.status(404).json({ error: 'Cost not found' });
    }
    res.json(cost);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/costs
 * Create a new cost
 */
router.post('/', async (req, res, next) => {
  try {
    const cost = await createCost(req.body);
    res.status(201).json(cost);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/costs/:id
 * Update an existing cost
 */
router.put('/:id', async (req, res, next) => {
  try {
    const cost = await updateCost(req.params.id, req.body);
    res.json(cost);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/costs/:id
 * Delete a cost
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteCost(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

