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
  // Generate ID for new cost
  const id = `COST${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Ensure month is derived from date if provided
  const month = costData.month || (costData.date ? costData.date.slice(0, 7) : '');
  if (!month) {
    throw new Error('Month is required (either provide month or date)');
  }

  if (!costData.category || !costData.category.trim()) {
    throw new Error('Category is required');
  }

  if (!Number.isFinite(costData.amount)) {
    throw new Error('Amount must be a valid number (có thể dương hoặc âm)');
  }

  // Build core payload (columns that always exist)
  const corePayload: any = {
    id,
    month,
    category: costData.category.trim(),
    amount: Number(costData.amount),
  };

  // Build full payload with optional date/status columns
  const fullPayload: any = { ...corePayload };

  // Add optional fields if provided (only if they have values)
  if (costData.date && costData.date.trim()) {
    try {
      // Validate date format
      new Date(costData.date);
      fullPayload.date = costData.date.trim();
    } catch (e) {
      console.warn('Invalid date format, skipping date field:', costData.date);
    }
  }

  // Only add status if it's a valid value
  if (costData.status && (costData.status === 'paid' || costData.status === 'pending')) {
    fullPayload.status = costData.status;
  }

  console.log('Inserting cost payload:', JSON.stringify(fullPayload, null, 2));

  // Try inserting with all fields first
  let { data, error } = await supabase.from('costs').insert(fullPayload).select().single();

  // If insert fails (e.g., date/status columns don't exist yet), retry with core fields only
  if (error) {
    console.warn('Full insert failed, retrying with core fields only:', error.message);
    const retryResult = await supabase.from('costs').insert(corePayload).select().single();
    data = retryResult.data;
    error = retryResult.error;
  }

  if (error) {
    console.error('Supabase error creating cost:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to create cost: ${error.message || 'Unknown error'}`);
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

