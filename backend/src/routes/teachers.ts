/**
 * Teachers Routes
 * API endpoints for teachers CRUD operations
 * Security: teacher role only sees their own record (linkId). Admin sees all.
 */

import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getUserById } from '../services/authService';
import { getTeachers, getTeacherById, createTeacher, updateTeacher, deleteTeacher } from '../services/teachersService';

const router = Router();

/** Trả về linkId của teacher (từ JWT hoặc load từ DB nếu token cũ chưa có linkId) */
async function getTeacherLinkId(req: AuthRequest): Promise<string | null> {
  if (req.user?.role !== 'teacher') return null;
  if (req.user.linkId) return req.user.linkId;
  try {
    const user = await getUserById(req.user.userId);
    const linkId = (user as any).link_id || null;
    if (linkId) req.user.linkId = linkId;
    return linkId;
  } catch {
    return null;
  }
}

router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const linkId = await getTeacherLinkId(req);
    if (req.user?.role === 'teacher' && linkId) {
      const teacher = await getTeacherById(linkId);
      res.json(teacher ? [teacher] : []);
      return;
    }
    const teachers = await getTeachers();
    res.json(teachers);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const requestedId = req.params.id;
    const linkId = await getTeacherLinkId(req);
    if (req.user?.role === 'teacher') {
      if (!linkId || requestedId !== linkId) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
    }
    const teacher = await getTeacherById(requestedId);
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

