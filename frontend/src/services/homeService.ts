/**
 * Home Service (Frontend)
 * API calls for home page sections
 */

import api from './api';

export interface HomePost {
  id: string;
  category: 'intro' | 'news' | 'docs' | 'policy';
  title: string;
  content: string;
  attachments?: any[];
  tags?: string[];
  badge?: string;
  author_id?: string;
  author_name?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get all home posts
 */
export async function fetchHomePosts(): Promise<HomePost[]> {
  const response = await api.get<HomePost[]>('/home/posts');
  return response.data || [];
}

/**
 * Get home post by category
 * Returns null if post doesn't exist (404) - this is expected behavior
 */
export async function fetchHomePostByCategory(category: string): Promise<HomePost | null> {
  try {
    const response = await api.get<HomePost>(`/home/posts/${category}`);
    return response.data || null;
  } catch (error: any) {
    // 404 is expected when posts don't exist yet - return null silently
    if (error.response?.status === 404) {
      return null;
    }
    // For other errors, still return null to prevent blocking the page
    // Only log non-404 errors
    if (error.response?.status !== 404) {
      console.debug(`Failed to fetch home post for category ${category}:`, error);
    }
    return null;
  }
}

/**
 * Create or update home post
 */
export async function upsertHomePost(postData: Omit<HomePost, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<HomePost> {
  const response = await api.post<HomePost>('/home/posts', postData);
  return response.data;
}

/**
 * Update home post
 */
export async function updateHomePost(id: string, postData: Partial<HomePost>): Promise<HomePost> {
  const response = await api.put<HomePost>(`/home/posts/${id}`, postData);
  return response.data;
}

/**
 * Delete home post
 */
export async function deleteHomePost(id: string): Promise<void> {
  await api.delete(`/home/posts/${id}`);
}

