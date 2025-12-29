/**
 * Documents Service
 * Business logic for documents CRUD operations
 */

import supabase from '../config/database';

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

/**
 * Get all documents with filters
 */
export async function getDocuments(filters: DocumentFilters = {}) {
  let query = supabase.from('documents').select('*').order('created_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  let documents = (data || []) as Document[];

  // Client-side search
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    documents = documents.filter(
      (doc: Document) =>
        doc.title?.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
    );
  }

  if (filters.tags && filters.tags.length > 0) {
    documents = documents.filter((doc: Document) => {
      if (!doc.tags || doc.tags.length === 0) return false;
      return filters.tags!.some((tag) => doc.tags!.includes(tag));
    });
  }

  return documents;
}

/**
 * Get a single document by ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Create a new document
 */
export async function createDocument(documentData: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document> {
  if (!documentData.title || !documentData.title.trim()) {
    throw new Error('Document title is required');
  }

  if (!documentData.file_url || !documentData.file_url.trim()) {
    throw new Error('File URL is required');
  }

  const payload: any = {
    title: documentData.title.trim(),
    file_url: documentData.file_url.trim(),
  };

  if (documentData.description) {
    payload.description = documentData.description.trim();
  }

  if (documentData.tags && Array.isArray(documentData.tags)) {
    payload.tags = documentData.tags;
  }

  if (documentData.uploaded_by) {
    payload.uploaded_by = documentData.uploaded_by;
  }

  const { data, error } = await supabase.from('documents').insert(payload).select().single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Update an existing document
 */
export async function updateDocument(id: string, updates: Partial<Omit<Document, 'id' | 'created_at'>>): Promise<Document> {
  const payload: any = { ...updates };

  if (payload.title) {
    payload.title = payload.title.trim();
  }

  if (payload.description) {
    payload.description = payload.description.trim();
  }

  if (payload.file_url) {
    payload.file_url = payload.file_url.trim();
  }

  const { data, error } = await supabase.from('documents').update(payload).eq('id', id).select().single();

  if (error) {
    throw new Error(`Failed to update document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

