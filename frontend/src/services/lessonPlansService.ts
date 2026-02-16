/**
 * Lesson Plans Service (Frontend)
 * API calls for lesson plans operations
 */

import api from './api';

export interface LessonPlan {
  id: string;
  tag?: string;
  level?: string;
  lesson_name: string;
  original_title?: string;
  original_link?: string;
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

export interface LessonPlanFilters {
  search?: string;
  level?: string;
  tag?: string;
  status?: 'paid' | 'pending' | 'deposit' | 'all';
}

export interface LessonPlanFormData {
  lesson_name: string;
  original_title?: string;
  original_link?: string;
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
 * Normalize lesson plan data from API response
 */
function normalizeLessonPlan(plan: any): LessonPlan {
  return {
    id: plan.id,
    tag: plan.tag || undefined,
    level: plan.level || undefined,
    lesson_name: plan.lesson_name || '',
    original_title: plan.original_title || undefined,
    original_link: plan.original_link || undefined,
    cost: plan.cost || 0,
    date: plan.date || '',
    status: plan.status || 'pending',
    contest_uploaded: plan.contest_uploaded || undefined,
    link: plan.link || undefined,
    completed_by: plan.completed_by || undefined,
    assistant_id: plan.assistant_id || undefined,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  };
}

/**
 * Fetch all lesson plans with optional filters
 */
export async function fetchLessonPlans(filters: LessonPlanFilters = {}): Promise<LessonPlan[]> {
  const params = new URLSearchParams();
  if (filters.search) {
    params.append('search', filters.search);
  }
  if (filters.level) {
    params.append('level', filters.level);
  }
  if (filters.tag) {
    params.append('tag', filters.tag);
  }
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status);
  }

  const response = await api.get<LessonPlan[]>(`/lesson-plans?${params.toString()}`);
  return (response.data || []).map(normalizeLessonPlan);
}

/**
 * Fetch a single lesson plan by ID
 */
export async function fetchLessonPlanById(id: string): Promise<LessonPlan> {
  const response = await api.get<LessonPlan>(`/lesson-plans/${id}`);
  return normalizeLessonPlan(response.data);
}

/**
 * Create a new lesson plan
 */
export async function createLessonPlan(data: LessonPlanFormData): Promise<LessonPlan> {
  const response = await api.post<LessonPlan>('/lesson-plans', data);
  return normalizeLessonPlan(response.data);
}

/**
 * Update an existing lesson plan
 */
export async function updateLessonPlan(id: string, data: Partial<LessonPlanFormData>): Promise<LessonPlan> {
  const response = await api.put<LessonPlan>(`/lesson-plans/${id}`, data);
  return normalizeLessonPlan(response.data);
}

/**
 * Delete a lesson plan
 */
export async function deleteLessonPlan(id: string): Promise<void> {
  await api.delete(`/lesson-plans/${id}`);
}

