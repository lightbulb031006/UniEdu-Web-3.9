/**
 * Wallet Transactions Routes
 * API endpoints for wallet transactions CRUD operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getWalletTransactions,
  getWalletTransactionById,
  createWalletTransaction,
  updateWalletTransaction,
  deleteWalletTransaction,
} from '../services/walletService';

const router = Router();

/**
 * GET /api/wallet-transactions
 * Get all wallet transactions with optional filters
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      studentId: req.query.studentId as string,
      type: req.query.type as 'topup' | 'loan' | 'advance' | 'repayment',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };
    const transactions = await getWalletTransactions(filters);
    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/wallet-transactions/:id
 * Get wallet transaction by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const transaction = await getWalletTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Wallet transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/wallet-transactions
 * Create new wallet transaction
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const transaction = await createWalletTransaction(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/wallet-transactions/:id
 * Update wallet transaction
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const transaction = await updateWalletTransaction(req.params.id, req.body);
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/wallet-transactions/:id
 * Delete wallet transaction
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteWalletTransaction(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

