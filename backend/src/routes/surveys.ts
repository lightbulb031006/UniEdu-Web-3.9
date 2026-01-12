/**
 * Surveys Routes
 * API endpoints for class surveys CRUD operations
 */

import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import {
  getSurveysByClassId,
  getSurveyById,
  createSurvey,
  updateSurvey,
  deleteSurvey,
} from '../services/surveysService';

const router = Router();

// Get all surveys for a class - public access allowed
router.get('/class/:classId', optionalAuthenticate, async (req, res, next) => {
  try {
    const surveys = await getSurveysByClassId(req.params.classId);
    res.json(surveys);
  } catch (error: any) {
    console.error(`[GET /surveys/class/:classId] Error:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch surveys' });
  }
});

// Get survey by ID - public access allowed
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    const survey = await getSurveyById(req.params.id);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    res.json(survey);
  } catch (error: any) {
    console.error(`[GET /surveys/:id] Error:`, error);
    res.status(500).json({ error: error.message || 'Failed to fetch survey' });
  }
});

// Create new survey
router.post('/', authenticate, async (req, res, next) => {
  try {
    const survey = await createSurvey(req.body);
    res.status(201).json(survey);
  } catch (error: any) {
    console.error(`[POST /surveys] Error:`, error);
    res.status(500).json({ error: error.message || 'Failed to create survey' });
  }
});

// Update survey
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const survey = await updateSurvey(req.params.id, req.body);
    res.json(survey);
  } catch (error: any) {
    console.error(`[PUT /surveys/:id] Error:`, error);
    res.status(500).json({ error: error.message || 'Failed to update survey' });
  }
});

// Delete survey
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteSurvey(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    console.error(`[DELETE /surveys/:id] Error:`, error);
    res.status(500).json({ error: error.message || 'Failed to delete survey' });
  }
});

export default router;


