/**
 * Costs Service
 * Business logic for costs CRUD operations
 */

import supabase from '../config/database';

export interface Cost {
  id: string;
  month: string; // Format: YYYY-MM
  category: string;
  amount: number;
  date?: string; // Optional date field
  status?: 'paid' | 'pending'; // Optional status field
  created_at?: string;
  updated_at?: string;
}

export interface CostFilters {
  month?: string; // Format: YYYY-MM
}

/**
 * Get all costs with filters
 */
export async function getCosts(filters: CostFilters = {}) {
  let query = supabase.from('costs').select('*').order('created_at', { ascending: false });

  if (filters.month) {
    query = query.eq('month', filters.month);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch costs: ${error.message}`);
  }

  return (data || []) as Cost[];
}

/**
 * Get a single cost by ID
 */
export async function getCostById(id: string): Promise<Cost | null> {
  const { data, error } = await supabase.from('costs').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch cost: ${error.message}`);
  }

  return data as Cost;
}

/**
 * Create a new cost
 */
export async function createCost(costData: Omit<Cost, 'id' | 'created_at' | 'updated_at'>): Promise<Cost> {
  // Ensure month is derived from date if provided
  const month = costData.month || (costData.date ? costData.date.slice(0, 7) : '');
  if (!month) {
    throw new Error('Month is required (either provide month or date)');
  }

  const payload: any = {
    month,
    category: costData.category,
    amount: costData.amount,
  };

  // Add optional fields if provided
  if (costData.date) {
    payload.date = costData.date;
  }
  if (costData.status) {
    payload.status = costData.status;
  }

  const { data, error } = await supabase.from('costs').insert(payload).select().single();

  if (error) {
    throw new Error(`Failed to create cost: ${error.message}`);
  }

  return data as Cost;
}

/**
 * Update an existing cost
 */
export async function updateCost(id: string, updates: Partial<Omit<Cost, 'id' | 'created_at'>>): Promise<Cost> {
  const payload: any = { ...updates };

  // If date is updated, ensure month is also updated
  if (updates.date && !updates.month) {
    payload.month = updates.date.slice(0, 7);
  }

  const { data, error } = await supabase.from('costs').update(payload).eq('id', id).select().single();

  if (error) {
    throw new Error(`Failed to update cost: ${error.message}`);
  }

  return data as Cost;
}

/**
 * Delete a cost
 */
export async function deleteCost(id: string): Promise<void> {
  const { error } = await supabase.from('costs').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete cost: ${error.message}`);
  }
}

