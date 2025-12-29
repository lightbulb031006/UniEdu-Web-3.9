/**
 * Staff Routes
 * API endpoints for staff-related operations
 */

import express from 'express';
import { getStaffUnpaidAmount, getStaffUnpaidAmounts, getStaffWorkItems, getStaffBonuses, updateStaffQrPaymentLink, getStaffLoginInfo } from '../services/staffService';

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
 */
router.get('/:id/bonuses', async (req, res, next) => {
  try {
    const { id } = req.params;
    const month = req.query.month as string || new Date().toISOString().slice(0, 7);
    const bonuses = await getStaffBonuses(id, month);
    res.json(bonuses);
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

export default router;

