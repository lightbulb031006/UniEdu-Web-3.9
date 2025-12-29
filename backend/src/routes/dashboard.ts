/**
 * Dashboard Routes
 * API endpoints for dashboard data
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardData, getQuickViewData } from '../services/dashboardService';

const router = Router();

/**
 * GET /api/dashboard
 * Get dashboard data with filters
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { filterType = 'month', filterValue } = req.query;

    if (!filterValue) {
      return res.status(400).json({ error: 'filterValue is required' });
    }

    const data = await getDashboardData({
      filterType: filterType as 'month' | 'quarter' | 'year',
      filterValue: filterValue as string,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/quick-view
 * Get quick view data for a specific year
 */
router.get('/quick-view', authenticate, async (req, res, next) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: 'year is required' });
    }

    const data = await getQuickViewData(year as string);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;

