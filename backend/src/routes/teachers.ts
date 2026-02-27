/**
 * Teachers Routes
 * API endpoints for teachers CRUD operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from '../services/teachersService';

const router = Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const teachers = await getTeachers();
    res.json(teachers);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const teacher = await getTeacherById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(teacher);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const teacher = await createTeacher(req.body);
    res.status(201).json(teacher);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = { ...req.body };
    if (body.account_password !== undefined) body.account_password = '[REDACTED]';
    if (body.accountPassword !== undefined) body.accountPassword = '[REDACTED]';
    console.log('[teachers PUT] id=', id, 'body keys=', Object.keys(req.body), 'body (no password)=', body);
    const teacher = await updateTeacher(id, req.body);
    console.log('[teachers PUT] success, returned teacher id=', teacher?.id);
    res.json(teacher);
  } catch (error) {
    console.error('[teachers PUT] error:', error);
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteTeacher(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

