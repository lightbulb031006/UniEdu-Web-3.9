/**
 * Students Routes
 * API endpoints for students CRUD operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentClassFinancialData,
  extendStudentSessions,
  refundStudentSessions,
  removeStudentClass,
} from '../services/studentsService';

const router = Router();

/**
 * GET /api/students
 * Get all students with optional filters
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search as string,
      status: req.query.status as 'all' | 'active' | 'inactive',
      province: req.query.province as string,
    };
    const students = await getStudents(filters);
    res.json(students);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/students/:id
 * Get student by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const student = await getStudentById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/students
 * Create new student
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const student = await createStudent(req.body);
    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/students/:id
 * Update student
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const student = await updateStudent(req.params.id, req.body);
    res.json(student);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/students/:id
 * Delete student
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteStudent(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/students/:id/class-financial-data
 * Get financial data for all classes a student is enrolled in
 */
router.get('/:id/class-financial-data', authenticate, async (req, res, next) => {
  try {
    const financialData = await getStudentClassFinancialData(req.params.id);
    res.json(financialData);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/students/:id/extend-sessions
 * Extend sessions for a student in a class
 */
router.post('/:id/extend-sessions', authenticate, async (req, res, next) => {
  try {
    const { classId, sessions, unitPrice } = req.body;
    if (!classId || !sessions || !unitPrice) {
      return res.status(400).json({ error: 'Missing required fields: classId, sessions, unitPrice' });
    }
    const result = await extendStudentSessions(req.params.id, classId, sessions, unitPrice);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/students/:id/refund-sessions
 * Refund sessions for a student in a class
 */
router.post('/:id/refund-sessions', authenticate, async (req, res, next) => {
  try {
    const { classId, sessions, unitPrice } = req.body;
    if (!classId || !sessions || !unitPrice) {
      return res.status(400).json({ error: 'Missing required fields: classId, sessions, unitPrice' });
    }
    const result = await refundStudentSessions(req.params.id, classId, sessions, unitPrice);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/students/:id/remove-class
 * Remove class from student
 */
router.post('/:id/remove-class', authenticate, async (req, res, next) => {
  try {
    const { classId, refundRemaining } = req.body;
    if (!classId) {
      return res.status(400).json({ error: 'Missing required field: classId' });
    }
    const result = await removeStudentClass(req.params.id, classId, refundRemaining !== false);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

export default router;

