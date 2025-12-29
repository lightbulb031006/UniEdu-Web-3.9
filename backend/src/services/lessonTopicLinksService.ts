/**
 * Lesson Topic Links Service
 * Business logic for lesson topic links (many-to-many relationship)
 */

import supabase from '../config/database';

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
 * Get all lesson topic links
 */
export async function getLessonTopicLinks(filters?: { topicId?: string; lessonOutputId?: string }) {
  let query = supabase
    .from('lesson_topic_links')
    .select('*')
    .order('order_index', { ascending: true });

  if (filters?.topicId) {
    query = query.eq('topic_id', filters.topicId);
  }

  if (filters?.lessonOutputId) {
    query = query.eq('lesson_output_id', filters.lessonOutputId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch lesson topic links: ${error.message}`);
  }

  return (data || []) as LessonTopicLink[];
}

/**
 * Get lesson topic link by ID
 */
export async function getLessonTopicLinkById(id: string) {
  const { data, error } = await supabase
    .from('lesson_topic_links')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch lesson topic link: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as LessonTopicLink;
}

/**
 * Create a new lesson topic link
 */
export async function createLessonTopicLink(formData: LessonTopicLinkFormData) {
  // Check if link already exists
  const { data: existing } = await supabase
    .from('lesson_topic_links')
    .select('id')
    .eq('topic_id', formData.topic_id)
    .eq('lesson_output_id', formData.lesson_output_id)
    .single();

  if (existing) {
    // Link already exists, return it
    return await getLessonTopicLinkById(existing.id);
  }

  const id = `LTL${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  const payload: any = {
    id,
    topic_id: formData.topic_id,
    lesson_output_id: formData.lesson_output_id,
    order_index: formData.order_index || 0,
  };

  const { data, error } = await supabase
    .from('lesson_topic_links')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lesson topic link: ${error.message}`);
  }

  return data as LessonTopicLink;
}

/**
 * Delete a lesson topic link
 */
export async function deleteLessonTopicLink(id: string) {
  const { error } = await supabase
    .from('lesson_topic_links')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lesson topic link: ${error.message}`);
  }

  return { success: true };
}

/**
 * Delete lesson topic link by topic and output IDs
 */
export async function deleteLessonTopicLinkByTopicAndOutput(topicId: string, lessonOutputId: string) {
  const { error } = await supabase
    .from('lesson_topic_links')
    .delete()
    .eq('topic_id', topicId)
    .eq('lesson_output_id', lessonOutputId);

  if (error) {
    throw new Error(`Failed to delete lesson topic link: ${error.message}`);
  }

  return { success: true };
}

/**
 * Bulk create lesson topic links
 */
export async function bulkCreateLessonTopicLinks(links: LessonTopicLinkFormData[]) {
  // Remove duplicates
  const uniqueLinks = links.filter((link, index, self) =>
    index === self.findIndex(l => l.topic_id === link.topic_id && l.lesson_output_id === link.lesson_output_id)
  );

  const payloads = uniqueLinks.map(link => ({
    id: `LTL${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    topic_id: link.topic_id,
    lesson_output_id: link.lesson_output_id,
    order_index: link.order_index || 0,
  }));

  const { data, error } = await supabase
    .from('lesson_topic_links')
    .insert(payloads)
    .select();

  if (error) {
    throw new Error(`Failed to bulk create lesson topic links: ${error.message}`);
  }

  return data as LessonTopicLink[];
}

/**
 * Bulk update order_index for multiple lesson topic links
 */
export async function bulkUpdateLessonTopicOrder(updates: { id: string; order_index: number }[]) {
  if (!updates || updates.length === 0) {
    return [];
  }

  // Update each link individually (Supabase doesn't support bulk update with different values easily)
  const results = await Promise.all(
    updates.map(async (update) => {
      const { data, error } = await supabase
        .from('lesson_topic_links')
        .update({ order_index: update.order_index })
        .eq('id', update.id)
        .select()
        .single();

      if (error) {
        console.error(`Failed to update lesson topic link ${update.id}:`, error);
        return null;
      }

      return data as LessonTopicLink;
    })
  );

  return results.filter((r) => r !== null) as LessonTopicLink[];
}

