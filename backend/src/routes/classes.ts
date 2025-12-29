/**
 * Classes Routes
 * API endpoints for classes CRUD operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getClassStudentsWithRemainingSessions,
  addStudentToClass,
  removeTeacherFromClass,
  moveStudentToClass,
} from '../services/classesService';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const filters = {
      search: req.query.search as string,
      type: req.query.type as string,
      status: req.query.status as 'all' | 'running' | 'stopped',
    };
    const classes = await getClasses(filters);
    res.json(classes);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const cls = await getClassById(req.params.id);
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(cls);
  } catch (error: any) {
    console.error(`[GET /classes/:id] Error for class ${req.params.id}:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch class' });
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const cls = await createClass(req.body);
    res.status(201).json(cls);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const cls = await updateClass(req.params.id, req.body);
    res.json(cls);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteClass(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/classes/:id/students-with-remaining
 * Get students enrolled in a class with their remaining sessions
 */
router.get('/:id/students-with-remaining', authenticate, async (req, res, next) => {
  try {
    const students = await getClassStudentsWithRemainingSessions(req.params.id);
    res.json(students);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/classes/:id/add-student
 * Add a student to a class
 */
router.post('/:id/add-student', authenticate, async (req, res, next) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Missing required field: studentId' });
    }
    const result = await addStudentToClass(studentId, req.params.id);
    res.status(201).json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/classes/:id/remove-student
 * Remove a student from a class
 */
router.post('/:id/remove-student', authenticate, async (req, res, next) => {
  try {
    const { studentId, refundRemaining } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Missing required field: studentId' });
    }
    const { removeStudentFromClass } = await import('../services/classesService');
    const result = await removeStudentFromClass(studentId, req.params.id, refundRemaining !== false);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/classes/:id/remove-teacher
 * Remove a teacher from a class
 */
router.post('/:id/remove-teacher', authenticate, async (req, res, next) => {
  try {
    const { teacherId } = req.body;
    if (!teacherId) {
      return res.status(400).json({ error: 'Missing required field: teacherId' });
    }
    const result = await removeTeacherFromClass(req.params.id, teacherId);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/classes/:id/move-student
 * Move a student from current class to another class
 */
router.post('/:id/move-student', authenticate, async (req, res, next) => {
  try {
    const { studentId, toClassId, refundRemaining } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'Missing required field: studentId' });
    }
    if (!toClassId) {
      return res.status(400).json({ error: 'Missing required field: toClassId' });
    }
    const result = await moveStudentToClass(studentId, req.params.id, toClassId, refundRemaining !== false);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

export default router;

