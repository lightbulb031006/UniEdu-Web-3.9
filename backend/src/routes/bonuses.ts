/**
 * Bonuses Routes
 * API endpoints for bonuses CRUD operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getBonuses, getBonusById, createBonus, updateBonus, deleteBonus } from '../services/bonusesService';

const router = Router();

/**
 * GET /api/bonuses
 * Get all bonuses with optional filters
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      staffId: req.query.staffId as string,
      month: req.query.month as string,
      status: req.query.status as 'paid' | 'unpaid' | 'deposit',
    };
    const bonuses = await getBonuses(filters);
    res.json(bonuses);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/bonuses/:id
 * Get bonus by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const bonus = await getBonusById(req.params.id);
    if (!bonus) {
      return res.status(404).json({ error: 'Bonus not found' });
    }
    res.json(bonus);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/bonuses
 * Create new bonus
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const bonus = await createBonus(req.body);
    res.status(201).json(bonus);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/bonuses/:id
 * Update bonus
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const bonus = await updateBonus(req.params.id, req.body);
    res.json(bonus);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/bonuses/:id
 * Delete bonus
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteBonus(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

