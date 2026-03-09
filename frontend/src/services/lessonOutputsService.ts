/**
 * Lesson Outputs Service (Frontend)
 * API calls for lesson outputs operations
 */

import api from './api';

export interface LessonOutput {
  id: string;
  tag?: string;
  level?: string;
  lesson_name: string;
  original_title?: string;
  original_link?: string;
  source?: string;
  cost?: number;
  date: string;
  status?: 'paid' | 'pending' | 'deposit';
  contest_uploaded?: string;
  link?: string;
  completed_by?: string;
  assistant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LessonOutputFilters {
  search?: string;
  level?: string;
  tag?: string;
  status?: string;
  assistantId?: string;
  month?: string; // YYYY-MM format
}

export interface LessonOutputFormData {
  lesson_name: string;
  original_title?: string;
  original_link?: string;
  source?: string;
  tag?: string;
  level?: string;
  cost?: number;
  date: string;
  status?: 'paid' | 'pending' | 'deposit';
  contest_uploaded?: string;
  link?: string;
  completed_by?: string;
  assistant_id?: string;
}

/**
 * Fetch all lesson outputs with optional filters
 */
export async function fetchLessonOutputs(filters?: LessonOutputFilters): Promise<LessonOutput[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.level) params.append('level', filters.level);
  if (filters?.tag) params.append('tag', filters.tag);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.assistantId) params.append('assistantId', filters.assistantId);
  if (filters?.month) params.append('month', filters.month);
  
  const response = await api.get(`/lesson-outputs?${params.toString()}`);
  return response.data || [];
}

/**
 * Fetch a single lesson output by ID
 */
export async function fetchLessonOutputById(id: string): Promise<LessonOutput> {
  const response = await api.get(`/lesson-outputs/${id}`);
  return response.data;
}

/**
 * Create a new lesson output
 */
export async function createLessonOutput(formData: LessonOutputFormData): Promise<LessonOutput> {
  const response = await api.post('/lesson-outputs', formData);
  return response.data;
}

/**
 * Update a lesson output
 */
export async function updateLessonOutput(id: string, formData: Partial<LessonOutputFormData>): Promise<LessonOutput> {
  const response = await api.put(`/lesson-outputs/${id}`, formData);
  return response.data;
}

/**
 * Delete a lesson output
 */
export async function deleteLessonOutput(id: string): Promise<void> {
  await api.delete(`/lesson-outputs/${id}`);
}

/**
 * Bulk update lesson output statuses
 */
export async function bulkUpdateLessonOutputStatuses(outputIds: string[], status: 'paid' | 'pending' | 'deposit'): Promise<void> {
  await api.post('/lesson-outputs/bulk-update-status', { outputIds, status });
}

