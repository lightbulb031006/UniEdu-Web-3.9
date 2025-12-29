/**
 * Categories Service (Frontend)
 * API calls for categories operations
 */

import api from './api';

export interface Category {
  id: number;
  name: string;
  created_at?: string;
}

/**
 * Normalize category data from API response
 */
function normalizeCategory(category: any): Category {
  return {
    id: category.id,
    name: category.name || '',
    created_at: category.created_at,
  };
}

/**
 * Fetch all categories
 */
export async function fetchCategories(): Promise<Category[]> {
  const response = await api.get<Category[]>('/categories');
  return (response.data || []).map(normalizeCategory);
}

/**
 * Fetch a single category by ID
 */
export async function fetchCategoryById(id: number): Promise<Category> {
  const response = await api.get<Category>(`/categories/${id}`);
  return normalizeCategory(response.data);
}

/**
 * Create a new category
 */
export async function createCategory(data: { name: string }): Promise<Category> {
  const response = await api.post<Category>('/categories', data);
  return normalizeCategory(response.data);
}

/**
 * Update an existing category
 */
export async function updateCategory(id: number, data: { name: string }): Promise<Category> {
  const response = await api.put<Category>(`/categories/${id}`, data);
  return normalizeCategory(response.data);
}

/**
 * Delete a category
 */
export async function deleteCategory(id: number): Promise<void> {
  await api.delete(`/categories/${id}`);
}

