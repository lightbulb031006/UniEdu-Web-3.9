/**
 * Lesson Plans Service
 * Business logic for lesson plans (lesson_outputs) CRUD operations
 */

import supabase from '../config/database';

export interface LessonPlan {
  id: string;
  tag?: string;
  level?: string;
  lesson_name: string;
  original_title?: string;
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

/**
 * Get all lesson plans with filters
 */
export async function getLessonPlans(filters: LessonPlanFilters = {}) {
  let query = supabase.from('lesson_outputs').select('*').order('date', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.level) {
    query = query.eq('level', filters.level);
  }

  if (filters.tag) {
    query = query.eq('tag', filters.tag);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch lesson plans: ${error.message}`);
  }

  let lessonPlans = (data || []) as LessonPlan[];

  // Client-side search (can be moved to backend with full-text search)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    lessonPlans = lessonPlans.filter(
      (plan: LessonPlan) =>
        plan.lesson_name?.toLowerCase().includes(searchLower) ||
        plan.original_title?.toLowerCase().includes(searchLower) ||
        plan.tag?.toLowerCase().includes(searchLower) ||
        plan.completed_by?.toLowerCase().includes(searchLower)
    );
  }

  return lessonPlans;
}

/**
 * Get a single lesson plan by ID
 */
export async function getLessonPlanById(id: string): Promise<LessonPlan | null> {
  const { data, error } = await supabase.from('lesson_outputs').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch lesson plan: ${error.message}`);
  }

  return data as LessonPlan;
}

/**
 * Create a new lesson plan
 */
export async function createLessonPlan(planData: Omit<LessonPlan, 'id' | 'created_at' | 'updated_at'>): Promise<LessonPlan> {
  if (!planData.lesson_name || !planData.lesson_name.trim()) {
    throw new Error('Lesson name is required');
  }

  if (!planData.date) {
    throw new Error('Date is required');
  }

  const payload: any = {
    lesson_name: planData.lesson_name.trim(),
    date: planData.date,
  };

  // Add optional fields
  if (planData.tag) payload.tag = planData.tag;
  if (planData.level) payload.level = planData.level;
  if (planData.original_title) payload.original_title = planData.original_title;
  if (planData.cost !== undefined) payload.cost = planData.cost || 0;
  if (planData.status) payload.status = planData.status;
  if (planData.contest_uploaded) payload.contest_uploaded = planData.contest_uploaded;
  if (planData.link) payload.link = planData.link;
  if (planData.completed_by) payload.completed_by = planData.completed_by;
  if (planData.assistant_id) payload.assistant_id = planData.assistant_id;

  const { data, error } = await supabase.from('lesson_outputs').insert(payload).select().single();

  if (error) {
    throw new Error(`Failed to create lesson plan: ${error.message}`);
  }

  return data as LessonPlan;
}

/**
 * Update an existing lesson plan
 */
export async function updateLessonPlan(id: string, updates: Partial<Omit<LessonPlan, 'id' | 'created_at'>>): Promise<LessonPlan> {
  const payload: any = { ...updates };

  // Trim string fields
  if (payload.lesson_name) payload.lesson_name = payload.lesson_name.trim();
  if (payload.original_title) payload.original_title = payload.original_title.trim();
  if (payload.tag) payload.tag = payload.tag.trim();
  if (payload.completed_by) payload.completed_by = payload.completed_by.trim();

  const { data, error } = await supabase.from('lesson_outputs').update(payload).eq('id', id).select().single();

  if (error) {
    throw new Error(`Failed to update lesson plan: ${error.message}`);
  }

  return data as LessonPlan;
}

/**
 * Delete a lesson plan
 */
export async function deleteLessonPlan(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_outputs').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lesson plan: ${error.message}`);
  }
}

