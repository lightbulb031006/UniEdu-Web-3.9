/**
 * Documents Service (Frontend)
 * API calls for documents operations
 */

import api from './api';

export interface Document {
  id: string;
  title: string;
  description?: string;
  file_url: string;
  tags?: string[];
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentFilters {
  search?: string;
  tags?: string[];
}

export interface DocumentFormData {
  title: string;
  description?: string;
  file_url: string;
  tags?: string[];
}

/**
 * Normalize document data from API response
 */
function normalizeDocument(doc: any): Document {
  return {
    id: doc.id,
    title: doc.title || '',
    description: doc.description,
    file_url: doc.file_url || doc.fileUrl || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    uploaded_by: doc.uploaded_by || doc.uploadedBy,
    created_at: doc.created_at || doc.createdAt,
    updated_at: doc.updated_at || doc.updatedAt,
  };
}

/**
 * Fetch all documents with optional filters
 */
export async function fetchDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  const params = new URLSearchParams();
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tag) => params.append('tags', tag));
  }

  const response = await api.get<Document[]>(`/documents?${params.toString()}`);
  return (response.data || []).map(normalizeDocument);
}

/**
 * Fetch a single document by ID
 */
export async function fetchDocumentById(id: string): Promise<Document> {
  const response = await api.get<Document>(`/documents/${id}`);
  return normalizeDocument(response.data);
}

/**
 * Create a new document
 */
export async function createDocument(data: DocumentFormData): Promise<Document> {
  const response = await api.post<Document>('/documents', data);
  return normalizeDocument(response.data);
}

/**
 * Update an existing document
 */
export async function updateDocument(id: string, data: Partial<DocumentFormData>): Promise<Document> {
  const response = await api.put<Document>(`/documents/${id}`, data);
  return normalizeDocument(response.data);
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/documents/${id}`);
}

