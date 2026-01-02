/**
 * Payments Routes
 * API endpoints for payments operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getPayments, getPaymentById, createPayment, updatePayment, deletePayment, getPaymentsStatistics } from '../services/paymentsService';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status as 'all' | 'paid' | 'pending',
      classId: req.query.classId as string,
      studentId: req.query.studentId as string,
    };
    const payments = await getPayments(filters);
    res.json(payments);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const payment = await getPaymentById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const payment = await createPayment(req.body);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const payment = await updatePayment(req.params.id, req.body);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deletePayment(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/payments/statistics
 * Get payments statistics with all calculations done in backend
 * Query: status, classId, studentId
 */
router.get('/statistics', authenticate, async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status as 'all' | 'paid' | 'pending',
      classId: req.query.classId as string,
      studentId: req.query.studentId as string,
    };
    const stats = await getPaymentsStatistics(filters);
    res.json(stats);
  } catch (error: any) {
    next(error);
  }
});

export default router;

