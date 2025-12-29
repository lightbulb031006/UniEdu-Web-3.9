/**
 * Lesson Tasks Service
 * Business logic for lesson tasks CRUD operations
 */

import supabase from '../config/database';

export interface LessonTask {
  id: string;
  title: string;
  assistant_id?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface LessonTaskFormData {
  title: string;
  assistant_id?: string;
  due_date?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

export interface LessonTaskFilters {
  assistantId?: string;
  status?: string;
  month?: string; // YYYY-MM format
}

/**
 * Get all lesson tasks with optional filters
 */
export async function getLessonTasks(filters: LessonTaskFilters = {}) {
  let query = supabase
    .from('lesson_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  // Note: assistant_id can reference either assistants table or teachers table (for lesson_plan role)
  if (filters.assistantId) {
    query = query.eq('assistant_id', filters.assistantId);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch lesson tasks: ${error.message}`);
  }

  let filteredData = (data || []) as LessonTask[];

  // Filter by month in created_at or due_date if needed
  if (filters.month) {
    filteredData = filteredData.filter((task) => {
      if (!task.created_at && !task.due_date) return true; // Show items without date
      const itemDate = task.created_at || task.due_date;
      if (!itemDate) return true;
      const itemMonth = itemDate.toString().slice(0, 7); // YYYY-MM format
      return itemMonth === filters.month;
    });
  }

  return filteredData;
}

/**
 * Get lesson task by ID
 */
export async function getLessonTaskById(id: string) {
  const { data, error } = await supabase
    .from('lesson_tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch lesson task: ${error.message}`);
  }

  return data as LessonTask;
}

/**
 * Create a new lesson task
 */
export async function createLessonTask(formData: LessonTaskFormData) {
  const id = `LT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  const payload: any = {
    id,
    title: formData.title,
    assistant_id: formData.assistant_id || null,
    due_date: formData.due_date || null,
    status: formData.status || 'pending',
  };

  const { data, error } = await supabase
    .from('lesson_tasks')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lesson task: ${error.message}`);
  }

  return data as LessonTask;
}

/**
 * Update a lesson task
 */
export async function updateLessonTask(id: string, formData: Partial<LessonTaskFormData>) {
  const payload: any = {};
  
  if (formData.title !== undefined) payload.title = formData.title;
  if (formData.assistant_id !== undefined) payload.assistant_id = formData.assistant_id || null;
  if (formData.due_date !== undefined) payload.due_date = formData.due_date || null;
  if (formData.status !== undefined) payload.status = formData.status;

  const { data, error } = await supabase
    .from('lesson_tasks')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lesson task: ${error.message}`);
  }

  return data as LessonTask;
}

/**
 * Delete a lesson task
 */
export async function deleteLessonTask(id: string) {
  const { error } = await supabase
    .from('lesson_tasks')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lesson task: ${error.message}`);
  }
}

/**
 * Bulk update task statuses
 */
export async function bulkUpdateTaskStatuses(taskIds: string[], status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  const { error } = await supabase
    .from('lesson_tasks')
    .update({ status })
    .in('id', taskIds);

  if (error) {
    throw new Error(`Failed to bulk update task statuses: ${error.message}`);
  }
}

