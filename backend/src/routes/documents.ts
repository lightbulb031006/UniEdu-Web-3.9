/**
 * Documents Routes
 */

import { Router } from 'express';
import { getDocuments, getDocumentById, createDocument, updateDocument, deleteDocument } from '../services/documentsService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/documents
 * Get all documents with optional filters
 */
router.get('/', async (req, res, next) => {
  try {
    const filters: any = {};
    if (req.query.search) {
      filters.search = req.query.search as string;
    }
    if (req.query.tags) {
      filters.tags = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
    }
    const documents = await getDocuments(filters);
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id
 * Get a single document by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const document = await getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(document);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents
 * Create a new document
 */
router.post('/', async (req, res, next) => {
  try {
    const document = await createDocument(req.body);
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/documents/:id
 * Update an existing document
 */
router.put('/:id', async (req, res, next) => {
  try {
    const document = await updateDocument(req.params.id, req.body);
    res.json(document);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteDocument(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

