/**
 * Home Service
 * Business logic for home page sections (home_posts)
 */

import supabase from '../config/database';

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
export async function getHomePosts() {
  const { data, error } = await supabase.from('home_posts').select('*').order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch home posts: ${error.message}`);
  }

  return (data || []) as HomePost[];
}

/**
 * Get home post by category
 */
export async function getHomePostByCategory(category: string) {
  const { data, error } = await supabase.from('home_posts').select('*').eq('category', category).single();

  if (error) {
    // Not found is OK - return null
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch home post: ${error.message}`);
  }

  return data as HomePost | null;
}

/**
 * Create or update home post
 */
export async function upsertHomePost(postData: Omit<HomePost, 'id' | 'created_at' | 'updated_at'> & { id?: string }) {
  // Generate ID if not provided
  const id = postData.id || `HP${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data, error } = await supabase
    .from('home_posts')
    .upsert(
      [
        {
          id,
          category: postData.category,
          title: postData.title,
          content: postData.content,
          attachments: postData.attachments || [],
          tags: postData.tags || [],
          badge: postData.badge,
          author_id: postData.author_id,
          author_name: postData.author_name,
        },
      ],
      {
        onConflict: 'id',
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save home post: ${error.message}`);
  }

  return data as HomePost;
}

/**
 * Delete home post
 */
export async function deleteHomePost(id: string) {
  const { error } = await supabase.from('home_posts').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete home post: ${error.message}`);
  }
}

