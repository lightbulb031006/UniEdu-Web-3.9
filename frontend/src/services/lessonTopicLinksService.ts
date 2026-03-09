/**
 * Lesson Topic Links Service (Frontend)
 */

import api from './api';

export interface LessonTopicLink {
  id: string;
  topic_id: string;
  lesson_output_id: string;
  order_index?: number;
  created_at?: string;
}

export interface LessonTopicLinkFormData {
  topic_id: string;
  lesson_output_id: string;
  order_index?: number;
}

/**
 * Fetch all lesson topic links with optional filters
 */
export async function fetchLessonTopicLinks(filters?: { topicId?: string; lessonOutputId?: string }): Promise<LessonTopicLink[]> {
  const params = new URLSearchParams();
  if (filters?.topicId) params.append('topicId', filters.topicId);
  if (filters?.lessonOutputId) params.append('lessonOutputId', filters.lessonOutputId);

  const response = await api.get(`/lesson-topic-links?${params.toString()}`);
  return response.data || [];
}

/**
 * Fetch a single lesson topic link by ID
 */
export async function fetchLessonTopicLinkById(id: string): Promise<LessonTopicLink> {
  const response = await api.get(`/lesson-topic-links/${id}`);
  return response.data;
}

/**
 * Create a new lesson topic link
 */
export async function createLessonTopicLink(formData: LessonTopicLinkFormData): Promise<LessonTopicLink> {
  const response = await api.post('/lesson-topic-links', formData);
  return response.data;
}

/**
 * Bulk create lesson topic links
 */
export async function bulkCreateLessonTopicLinks(links: LessonTopicLinkFormData[]): Promise<LessonTopicLink[]> {
  const response = await api.post('/lesson-topic-links/bulk', links);
  return response.data || [];
}

/**
 * Delete a lesson topic link
 */
export async function deleteLessonTopicLink(id: string): Promise<void> {
  await api.delete(`/lesson-topic-links/${id}`);
}

/**
 * Delete lesson topic link by topic and output IDs
 */
export async function deleteLessonTopicLinkByTopicAndOutput(topicId: string, lessonOutputId: string): Promise<void> {
  await api.delete('/lesson-topic-links/by-topic-and-output', {
    data: { topicId, lessonOutputId },
  });
}

/**
 * Bulk update order_index for multiple lesson topic links
 */
export async function bulkUpdateLessonTopicOrder(updates: { id: string; order_index: number }[]): Promise<LessonTopicLink[]> {
  const response = await api.post('/lesson-topic-links/bulk-order', { updates });
  return response.data;
}

