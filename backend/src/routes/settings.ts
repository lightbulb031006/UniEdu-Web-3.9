/**
 * Settings Routes
 * API endpoints for app-level settings (admin only)
 */

import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getDeductionSettings, saveDeductionSettings } from '../services/settingsService';

const router = express.Router();

/**
 * GET /api/settings/deduction
 * Get deduction settings (global + per-teacher)
 * Admin only
 */
router.get('/deduction', authenticate, async (req: AuthRequest, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }
        const settings = await getDeductionSettings();
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /api/settings/deduction
 * Update deduction settings
 * Body: { globalPercent: number, individualDeductions: Record<string, number> }
 * Admin only
 */
router.put('/deduction', authenticate, async (req: AuthRequest, res, next) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin only' });
        }

        const { globalPercent, individualDeductions } = req.body;

        if (globalPercent == null || typeof globalPercent !== 'number') {
            return res.status(400).json({ error: 'globalPercent is required and must be a number' });
        }

        await saveDeductionSettings(
            Math.max(0, Math.min(100, globalPercent)),
            individualDeductions || {}
        );

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

export default router;
