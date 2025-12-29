/**
 * Categories Service
 * Business logic for categories CRUD operations
 */

import supabase from '../config/database';

export interface Category {
  id: number;
  name: string;
  created_at?: string;
}

/**
 * Get all categories
 */
export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  return (data || []) as Category[];
}

/**
 * Get a single category by ID
 */
export async function getCategoryById(id: number): Promise<Category | null> {
  const { data, error } = await supabase.from('categories').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch category: ${error.message}`);
  }

  return data as Category;
}

/**
 * Create a new category
 */
export async function createCategory(name: string): Promise<Category> {
  if (!name || !name.trim()) {
    throw new Error('Category name is required');
  }

  const { data, error } = await supabase.from('categories').insert({ name: name.trim() }).select().single();

  if (error) {
    // Check for unique constraint violation
    if (error.code === '23505') {
      throw new Error('Category name already exists');
    }
    throw new Error(`Failed to create category: ${error.message}`);
  }

  return data as Category;
}

/**
 * Update an existing category
 */
export async function updateCategory(id: number, name: string): Promise<Category> {
  if (!name || !name.trim()) {
    throw new Error('Category name is required');
  }

  const { data, error } = await supabase.from('categories').update({ name: name.trim() }).eq('id', id).select().single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Category name already exists');
    }
    throw new Error(`Failed to update category: ${error.message}`);
  }

  return data as Category;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: number): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}

