/**
 * Lesson Tasks Service (Frontend)
 */

import api from './api';

export interface LessonTask {
  id: string;
  title: string;
  description?: string;
  assistant_id?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  created_at?: string;
  updated_at?: string;
}

export interface LessonTaskFormData {
  title: string;
  description?: string;
  assistant_id?: string;
  due_date?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
}

export interface LessonTaskFilters {
  assistantId?: string;
  status?: string;
  month?: string; // YYYY-MM format
}

/**
 * Fetch all lesson tasks with optional filters
 */
export async function fetchLessonTasks(filters?: LessonTaskFilters): Promise<LessonTask[]> {
  const params = new URLSearchParams();
  if (filters?.assistantId) params.append('assistantId', filters.assistantId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.month) params.append('month', filters.month);
  
  const response = await api.get(`/lesson-tasks?${params.toString()}`);
  return response.data;
}

/**
 * Fetch a single lesson task by ID
 */
export async function fetchLessonTaskById(id: string): Promise<LessonTask> {
  const response = await api.get(`/lesson-tasks/${id}`);
  return response.data;
}

/**
 * Create a new lesson task
 */
export async function createLessonTask(formData: LessonTaskFormData): Promise<LessonTask> {
  const response = await api.post('/lesson-tasks', formData);
  return response.data;
}

/**
 * Update a lesson task
 */
export async function updateLessonTask(id: string, formData: Partial<LessonTaskFormData>): Promise<LessonTask> {
  const response = await api.put(`/lesson-tasks/${id}`, formData);
  return response.data;
}

/**
 * Delete a lesson task
 */
export async function deleteLessonTask(id: string): Promise<void> {
  await api.delete(`/lesson-tasks/${id}`);
}

/**
 * Bulk update task statuses
 */
export async function bulkUpdateTaskStatuses(taskIds: string[], status: 'pending' | 'in_progress' | 'completed' | 'cancelled'): Promise<void> {
  await api.post('/lesson-tasks/bulk-update-status', { taskIds, status });
}

