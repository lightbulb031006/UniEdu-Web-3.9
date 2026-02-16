/**
 * Lesson Outputs Service
 * Business logic for lesson outputs operations
 */

import supabase from '../config/database';

export interface LessonOutput {
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

export interface LessonOutputFilters {
  assistantId?: string;
  status?: 'pending' | 'paid' | 'deposit';
  month?: string; // Format: YYYY-MM
  search?: string;
  level?: string;
  tag?: string;
}

export interface LessonOutputFormData {
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
 * Get all lesson outputs with optional filters
 */
export async function getLessonOutputs(filters: LessonOutputFilters = {}) {
  let query = supabase.from('lesson_outputs').select('*').order('date', { ascending: false });

  if (filters.assistantId) {
    query = query.eq('assistant_id', filters.assistantId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.level) {
    query = query.eq('level', filters.level);
  }

  if (filters.tag) {
    query = query.eq('tag', filters.tag);
  }

  if (filters.month) {
    // Filter by month from date
    // Use date range: from YYYY-MM-01 to before YYYY-(MM+1)-01
    const [year, month] = filters.month.split('-').map(Number);
    const startDate = `${filters.month}-01`;
    // Calculate next month for end date (exclusive)
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    query = query.gte('date', startDate).lt('date', endDate);
  }

  if (filters.search) {
    query = query.or(`lesson_name.ilike.%${filters.search}%,original_title.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch lesson outputs: ${error.message}`);
  }

  return (data || []) as LessonOutput[];
}

/**
 * Get lesson output by ID
 */
export async function getLessonOutputById(id: string) {
  const { data, error } = await supabase.from('lesson_outputs').select('*').eq('id', id).single();

  if (error) {
    throw new Error(`Failed to fetch lesson output: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as LessonOutput;
}

/**
 * Create a new lesson output
 */
export async function createLessonOutput(formData: LessonOutputFormData) {
  const id = `LO${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  const payload: any = {
    id,
    lesson_name: formData.lesson_name,
    original_title: formData.original_title || null,
    original_link: formData.original_link || null,
    tag: formData.tag || null,
    level: formData.level || null,
    cost: formData.cost || 0,
    date: formData.date,
    status: formData.status || 'pending',
    contest_uploaded: formData.contest_uploaded || null,
    link: formData.link || null,
    completed_by: formData.completed_by || null,
    assistant_id: formData.assistant_id || null,
  };

  const { data, error } = await supabase
    .from('lesson_outputs')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lesson output: ${error.message}`);
  }

  return data as LessonOutput;
}

/**
 * Update an existing lesson output
 */
export async function updateLessonOutput(id: string, formData: Partial<LessonOutputFormData>) {
  const payload: any = {};
  
  if (formData.lesson_name !== undefined) payload.lesson_name = formData.lesson_name;
  if (formData.original_title !== undefined) payload.original_title = formData.original_title || null;
  if (formData.original_link !== undefined) payload.original_link = formData.original_link || null;
  if (formData.tag !== undefined) payload.tag = formData.tag || null;
  if (formData.level !== undefined) payload.level = formData.level || null;
  if (formData.cost !== undefined) payload.cost = formData.cost || 0;
  if (formData.date !== undefined) payload.date = formData.date;
  if (formData.status !== undefined) payload.status = formData.status;
  if (formData.contest_uploaded !== undefined) payload.contest_uploaded = formData.contest_uploaded || null;
  if (formData.link !== undefined) payload.link = formData.link || null;
  if (formData.completed_by !== undefined) payload.completed_by = formData.completed_by || null;
  if (formData.assistant_id !== undefined) payload.assistant_id = formData.assistant_id || null;

  const { data, error } = await supabase
    .from('lesson_outputs')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lesson output: ${error.message}`);
  }

  return data as LessonOutput;
}

/**
 * Delete a lesson output
 */
export async function deleteLessonOutput(id: string) {
  const { error } = await supabase
    .from('lesson_outputs')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lesson output: ${error.message}`);
  }

  return { success: true };
}

/**
 * Bulk update statuses of multiple lesson outputs
 */
export async function bulkUpdateLessonOutputStatuses(outputIds: string[], status: 'paid' | 'pending' | 'deposit') {
  const { data, error } = await supabase
    .from('lesson_outputs')
    .update({ status })
    .in('id', outputIds)
    .select();

  if (error) {
    throw new Error(`Failed to bulk update lesson output statuses: ${error.message}`);
  }

  return data as LessonOutput[];
}

