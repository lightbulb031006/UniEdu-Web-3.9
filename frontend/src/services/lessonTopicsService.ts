/**
 * Lesson Topics Service (Frontend)
 */

import api from './api';

export interface LessonTopic {
  id: string;
  name: string;
  is_default: boolean;
  level?: number | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LessonTopicFormData {
  name: string;
  is_default?: boolean;
  level?: number | null;
}

/**
 * Initialize default topics
 */
export async function initializeDefaultTopics(): Promise<{ success: boolean; topics: LessonTopic[] }> {
  const response = await api.post('/lesson-topics/initialize-defaults');
  return response.data;
}

/**
 * Fetch all lesson topics
 */
export async function fetchLessonTopics(): Promise<LessonTopic[]> {
  const response = await api.get('/lesson-topics');
  return response.data || [];
}

/**
 * Fetch a single lesson topic by ID
 */
export async function fetchLessonTopicById(id: string): Promise<LessonTopic> {
  const response = await api.get(`/lesson-topics/${id}`);
  return response.data;
}

/**
 * Create a new lesson topic
 */
export async function createLessonTopic(formData: LessonTopicFormData): Promise<LessonTopic> {
  const response = await api.post('/lesson-topics', formData);
  return response.data;
}

/**
 * Update an existing lesson topic
 */
export async function updateLessonTopic(id: string, formData: Partial<LessonTopicFormData>): Promise<LessonTopic> {
  const response = await api.put(`/lesson-topics/${id}`, formData);
  return response.data;
}

/**
 * Delete a lesson topic
 */
export async function deleteLessonTopic(id: string): Promise<void> {
  await api.delete(`/lesson-topics/${id}`);
}

