/**
 * Staff Routes
 * API endpoints for staff-related operations
 */

import express from 'express';
import { getStaffUnpaidAmount, getStaffUnpaidAmounts, getStaffWorkItems, getStaffBonuses, getStaffBonusesStatistics, updateStaffQrPaymentLink, getStaffLoginInfo, getCSKHDetailData, getStaffDetailData } from '../services/staffService';
import {
  getCSKHPaymentStatuses,
  getCSKHPaymentStatus,
  upsertCSKHPaymentStatus,
  bulkUpdateCSKHPaymentStatus,
  getDefaultProfitPercent,
} from '../services/cskhPaymentStatusService';

const router = express.Router();

/**
 * GET /api/staff/:id/unpaid
 * Get unpaid amount for a specific staff member
 */
router.get('/:id/unpaid', async (req, res, next) => {
  try {
    const { id } = req.params;
    const unpaidAmount = await getStaffUnpaidAmount(id);
    res.json({ staffId: id, unpaidAmount });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/staff/unpaid-amounts
 * Get unpaid amounts for multiple staff members
 * Body: { staffIds: string[] }
 */
router.post('/unpaid-amounts', async (req, res, next) => {
  try {
    const { staffIds } = req.body;
    if (!Array.isArray(staffIds)) {
      return res.status(400).json({ error: 'staffIds must be an array' });
    }
    const unpaidAmounts = await getStaffUnpaidAmounts(staffIds);
    res.json(unpaidAmounts);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/work-items
 * Get work items for a staff member
 * Query: month (YYYY-MM)
 */
router.get('/:id/work-items', async (req, res, next) => {
  try {
    const { id } = req.params;
    const month = req.query.month as string || new Date().toISOString().slice(0, 7);
    const workItems = await getStaffWorkItems(id, month);
    res.json(workItems);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/bonuses
 * Get bonuses for a staff member
 * Query: month (YYYY-MM)
 * Returns: { bonuses: Bonus[], statistics: { totalMonth, paid, unpaid } }
 */
router.get('/:id/bonuses', async (req, res, next) => {
  try {
    const { id } = req.params;
    const month = req.query.month as string || new Date().toISOString().slice(0, 7);
    const bonuses = await getStaffBonuses(id, month);
    const statistics = await getStaffBonusesStatistics(id, month);
    res.json({ bonuses, statistics });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/staff/:id/qr-payment-link
 * Update staff QR payment link
 * Body: { qrLink: string }
 */
router.put('/:id/qr-payment-link', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { qrLink } = req.body;
    if (typeof qrLink !== 'string') {
      return res.status(400).json({ error: 'qrLink must be a string' });
    }
    const updated = await updateStaffQrPaymentLink(id, qrLink);
    res.json(updated);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/login-info
 * Get staff login info (account handle and password hash)
 */
router.get('/:id/login-info', async (req, res, next) => {
  try {
    const { id } = req.params;
    const loginInfo = await getStaffLoginInfo(id);
    res.json(loginInfo);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/cskh/payment-status
 * Get payment statuses for CSKH staff in a specific month
 * Query: month (YYYY-MM)
 */
router.get('/:id/cskh/payment-status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const statuses = await getCSKHPaymentStatuses(id, month);
    res.json(statuses);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/cskh/default-profit-percent
 * Get default profit percent for CSKH staff
 */
router.get('/:id/cskh/default-profit-percent', async (req, res, next) => {
  try {
    const { id } = req.params;
    const profitPercent = await getDefaultProfitPercent(id);
    res.json({ profitPercent });
  } catch (error: any) {
    next(error);
  }
});

/**
 * PUT /api/staff/:id/cskh/payment-status
 * Update payment status for a student
 * Body: { studentId: string, month: string, paymentStatus: 'paid'|'unpaid'|'deposit', profitPercent?: number }
 */
router.put('/:id/cskh/payment-status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentId, month, paymentStatus, profitPercent } = req.body;

    if (!studentId || !month || !paymentStatus) {
      return res.status(400).json({ error: 'studentId, month, and paymentStatus are required' });
    }

    if (!['paid', 'unpaid', 'deposit'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'paymentStatus must be paid, unpaid, or deposit' });
    }

    const status = await upsertCSKHPaymentStatus(id, studentId, month, paymentStatus, profitPercent);
    res.json(status);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/staff/:id/cskh/payment-status/bulk
 * Bulk update payment statuses for multiple students
 * Body: { month: string, updates: Array<{ studentId: string, paymentStatus: 'paid'|'unpaid'|'deposit', profitPercent?: number }> }
 */
router.post('/:id/cskh/payment-status/bulk', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { month, updates } = req.body;

    if (!month || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'month and updates array are required' });
    }

    const statuses = await bulkUpdateCSKHPaymentStatus(id, month, updates);
    res.json(statuses);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/cskh/detail
 * Get CSKH detail data with all calculations done in backend
 * Query: month (YYYY-MM)
 */
router.get('/:id/cskh/detail', async (req, res, next) => {
  try {
    const { id } = req.params;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const data = await getCSKHDetailData(id, month);
    res.json(data);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/staff/:id/detail-data
 * Get staff detail data with all calculations done in backend (for teachers)
 * Query: month (YYYY-MM)
 */
router.get('/:id/detail-data', async (req, res, next) => {
  try {
    const { id } = req.params;
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const data = await getStaffDetailData(id, month);
    res.json(data);
  } catch (error: any) {
    next(error);
  }
});

export default router;

