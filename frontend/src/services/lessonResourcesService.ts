/**
 * Lesson Resources Service (Frontend)
 */

import api from './api';

export interface LessonResource {
  id: string;
  title: string;
  resource_link?: string;
  description?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LessonResourceFormData {
  title: string;
  resource_link?: string;
  description?: string;
  tags?: string[];
}

/**
 * Fetch all lesson resources
 */
export async function fetchLessonResources(): Promise<LessonResource[]> {
  const response = await api.get('/lesson-resources');
  return response.data;
}

/**
 * Fetch a single lesson resource by ID
 */
export async function fetchLessonResourceById(id: string): Promise<LessonResource> {
  const response = await api.get(`/lesson-resources/${id}`);
  return response.data;
}

/**
 * Create a new lesson resource
 */
export async function createLessonResource(formData: LessonResourceFormData): Promise<LessonResource> {
  const response = await api.post('/lesson-resources', formData);
  return response.data;
}

/**
 * Update a lesson resource
 */
export async function updateLessonResource(id: string, formData: Partial<LessonResourceFormData>): Promise<LessonResource> {
  const response = await api.put(`/lesson-resources/${id}`, formData);
  return response.data;
}

/**
 * Delete a lesson resource
 */
export async function deleteLessonResource(id: string): Promise<void> {
  await api.delete(`/lesson-resources/${id}`);
}

