/**
 * Lesson Resources Service
 * Business logic for lesson resources CRUD operations
 */

import supabase from '../config/database';

export interface LessonResource {
  id: string;
  title: string;
  resource_link?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LessonResourceFormData {
  title: string;
  resource_link?: string;
  tags?: string[];
}

/**
 * Get all lesson resources
 */
export async function getLessonResources() {
  const { data, error } = await supabase
    .from('lesson_resources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch lesson resources: ${error.message}`);
  }

  return (data || []) as LessonResource[];
}

/**
 * Get lesson resource by ID
 */
export async function getLessonResourceById(id: string) {
  const { data, error } = await supabase
    .from('lesson_resources')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch lesson resource: ${error.message}`);
  }

  return data as LessonResource;
}

/**
 * Create a new lesson resource
 */
export async function createLessonResource(formData: LessonResourceFormData) {
  const id = `LR${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  const payload: any = {
    id,
    title: formData.title,
    resource_link: formData.resource_link || null,
    tags: formData.tags || [],
  };

  const { data, error } = await supabase
    .from('lesson_resources')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lesson resource: ${error.message}`);
  }

  return data as LessonResource;
}

/**
 * Update a lesson resource
 */
export async function updateLessonResource(id: string, formData: Partial<LessonResourceFormData>) {
  const payload: any = {};
  
  if (formData.title !== undefined) payload.title = formData.title;
  if (formData.resource_link !== undefined) payload.resource_link = formData.resource_link || null;
  if (formData.tags !== undefined) payload.tags = formData.tags || [];

  const { data, error } = await supabase
    .from('lesson_resources')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lesson resource: ${error.message}`);
  }

  return data as LessonResource;
}

/**
 * Delete a lesson resource
 */
export async function deleteLessonResource(id: string) {
  const { error } = await supabase
    .from('lesson_resources')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lesson resource: ${error.message}`);
  }
}

