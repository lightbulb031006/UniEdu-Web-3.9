/**
 * Wallet Service
 * Business logic for wallet transactions CRUD operations
 */

import supabase from '../config/database';

export interface WalletTransaction {
  id: string;
  student_id: string;
  type: 'topup' | 'loan' | 'advance' | 'repayment';
  amount: number;
  note?: string;
  date: string;
  created_at: string;
}

export interface WalletTransactionFilters {
  studentId?: string;
  type?: 'topup' | 'loan' | 'advance' | 'repayment';
  startDate?: string;
  endDate?: string;
}

/**
 * Get all wallet transactions with optional filters
 */
export async function getWalletTransactions(filters: WalletTransactionFilters = {}) {
  let query = supabase.from('wallet_transactions').select('*').order('date', { ascending: false });

  if (filters.studentId) {
    query = query.eq('student_id', filters.studentId);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch wallet transactions: ${error.message}`);
  }

  return (data || []) as WalletTransaction[];
}

/**
 * Get wallet transaction by ID
 */
export async function getWalletTransactionById(id: string) {
  const { data, error } = await supabase.from('wallet_transactions').select('*').eq('id', id).single();

  if (error) {
    throw new Error(`Failed to fetch wallet transaction: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return data as WalletTransaction;
}

/**
 * Create new wallet transaction
 */
export async function createWalletTransaction(transactionData: Omit<WalletTransaction, 'id' | 'created_at'>) {
  // Generate ID if not provided
  const id = (transactionData as any).id || `WT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert([{ ...transactionData, id }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create wallet transaction: ${error.message}`);
  }

  return data as WalletTransaction;
}

/**
 * Update wallet transaction
 */
export async function updateWalletTransaction(id: string, transactionData: Partial<WalletTransaction>) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .update(transactionData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update wallet transaction: ${error.message}`);
  }

  return data as WalletTransaction;
}

/**
 * Delete wallet transaction
 */
export async function deleteWalletTransaction(id: string) {
  const { error } = await supabase.from('wallet_transactions').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete wallet transaction: ${error.message}`);
  }
}

