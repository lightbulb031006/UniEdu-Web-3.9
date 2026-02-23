/**
 * Dashboard Routes
 * API endpoints for dashboard data
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardData, getQuickViewData, invalidateAllDashboardCache } from '../services/dashboardService';

const router = Router();

/**
 * GET /api/dashboard
 * Get dashboard data with filters
 * Query: refresh=1 để bỏ cache và lấy số liệu mới (dùng khi vừa đổi công thức backend)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { filterType = 'month', filterValue, refresh } = req.query;

    if (!filterValue) {
      return res.status(400).json({ error: 'filterValue is required' });
    }

    if (refresh === '1') {
      await invalidateAllDashboardCache();
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

