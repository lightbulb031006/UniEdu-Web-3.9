/**
 * Lesson Topics Service
 * Business logic for lesson topics CRUD operations
 */

import supabase from '../config/database';

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
 * Initialize default topics if they don't exist
 */
export async function initializeDefaultTopics() {
  const defaultTopics = [
    { id: 'all', name: 'Tất cả', is_default: true, level: null },
    { id: 'level-0', name: 'Level 0', is_default: true, level: 0 },
    { id: 'level-1', name: 'Level 1', is_default: true, level: 1 },
    { id: 'level-2', name: 'Level 2', is_default: true, level: 2 },
    { id: 'level-3', name: 'Level 3', is_default: true, level: 3 },
    { id: 'level-4', name: 'Level 4', is_default: true, level: 4 },
    { id: 'level-5', name: 'Level 5', is_default: true, level: 5 },
  ];

  // Check which topics already exist
  const { data: existingTopics } = await supabase
    .from('lesson_topics')
    .select('id')
    .in('id', defaultTopics.map(t => t.id));

  const existingIds = new Set(existingTopics?.map(t => t.id) || []);
  const topicsToInsert = defaultTopics.filter(t => !existingIds.has(t.id));

  if (topicsToInsert.length > 0) {
    await supabase.from('lesson_topics').insert(topicsToInsert);
  }
}

/**
 * Get all lesson topics
 */
export async function getLessonTopics() {
  const { data, error } = await supabase
    .from('lesson_topics')
    .select('*')
    .order('is_default', { ascending: false })
    .order('level', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch lesson topics: ${error.message}`);
  }

  return (data || []) as LessonTopic[];
}

/**
 * Get lesson topic by ID
 */
export async function getLessonTopicById(id: string) {
  const { data, error } = await supabase
    .from('lesson_topics')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch lesson topic: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as LessonTopic;
}

/**
 * Create a new lesson topic
 */
export async function createLessonTopic(formData: LessonTopicFormData, createdBy?: string) {
  const id = `LT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  const payload: any = {
    id,
    name: formData.name,
    is_default: formData.is_default || false,
    level: formData.level || null,
    created_by: createdBy || null,
  };

  const { data, error } = await supabase
    .from('lesson_topics')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lesson topic: ${error.message}`);
  }

  return data as LessonTopic;
}

/**
 * Update an existing lesson topic
 */
export async function updateLessonTopic(id: string, formData: Partial<LessonTopicFormData>) {
  // Don't allow updating default topics
  const existing = await getLessonTopicById(id);
  if (existing?.is_default) {
    throw new Error('Cannot update default topics');
  }

  const payload: any = {};
  
  if (formData.name !== undefined) payload.name = formData.name;
  if (formData.level !== undefined) payload.level = formData.level || null;

  const { data, error } = await supabase
    .from('lesson_topics')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lesson topic: ${error.message}`);
  }

  return data as LessonTopic;
}

/**
 * Delete a lesson topic
 */
export async function deleteLessonTopic(id: string) {
  // Don't allow deleting default topics
  const existing = await getLessonTopicById(id);
  if (existing?.is_default) {
    throw new Error('Cannot delete default topics');
  }

  const { error } = await supabase
    .from('lesson_topics')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lesson topic: ${error.message}`);
  }

  return { success: true };
}

