/**
 * Bonuses Service
 * Business logic for bonuses CRUD operations
 */

import supabase from '../config/database';

export interface Bonus {
  id: string;
  staff_id: string;
  work_type: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'deposit';
  note?: string;
  month: string; // Format: YYYY-MM
  created_at?: string;
  updated_at?: string;
}

export interface BonusFilters {
  staffId?: string;
  month?: string;
  status?: 'paid' | 'unpaid' | 'deposit';
}

/**
 * Get all bonuses with optional filters
 */
export async function getBonuses(filters: BonusFilters = {}) {
  let query = supabase.from('bonuses').select('*').order('created_at', { ascending: false });

  if (filters.staffId) {
    query = query.eq('staff_id', filters.staffId);
  }

  if (filters.month) {
    query = query.eq('month', filters.month);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch bonuses: ${error.message}`);
  }

  return (data || []) as Bonus[];
}

/**
 * Get bonus by ID
 */
export async function getBonusById(id: string) {
  const { data, error } = await supabase.from('bonuses').select('*').eq('id', id).single();

  if (error) {
    throw new Error(`Failed to fetch bonus: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as Bonus;
}

/**
 * Create new bonus
 */
export async function createBonus(bonusData: Omit<Bonus, 'id' | 'created_at' | 'updated_at'>) {
  // Generate ID if not provided
  const id = `BN${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data, error } = await supabase
    .from('bonuses')
    .insert([
      {
        id,
        staff_id: bonusData.staff_id,
        work_type: bonusData.work_type,
        amount: bonusData.amount,
        status: bonusData.status || 'unpaid',
        note: bonusData.note,
        month: bonusData.month,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create bonus: ${error.message}`);
  }

  return data as Bonus;
}

/**
 * Update bonus
 */
export async function updateBonus(id: string, bonusData: Partial<Bonus>) {
  const { data, error } = await supabase
    .from('bonuses')
    .update({
      work_type: bonusData.work_type,
      amount: bonusData.amount,
      status: bonusData.status,
      note: bonusData.note,
      month: bonusData.month,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update bonus: ${error.message}`);
  }

  return data as Bonus;
}

/**
 * Delete bonus
 */
export async function deleteBonus(id: string) {
  const { error } = await supabase.from('bonuses').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete bonus: ${error.message}`);
  }
}

