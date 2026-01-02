/**
 * Payments Service
 * Business logic for payments operations
 */

import supabase from '../config/database';

export interface PaymentFilters {
  status?: 'all' | 'paid' | 'pending';
  classId?: string;
  studentId?: string;
}

export interface Payment {
  id: string;
  student_id: string;
  class_id: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending';
  note?: string;
}

export async function getPayments(filters: PaymentFilters = {}) {
  let query = supabase.from('payments').select('*');

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.classId) {
    query = query.eq('class_id', filters.classId);
  }

  if (filters.studentId) {
    query = query.eq('student_id', filters.studentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  return (data || []) as Payment[];
}

export async function getPaymentById(id: string) {
  const { data, error } = await supabase.from('payments').select('*').eq('id', id).single();

  if (error) {
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }

  return data as Payment | null;
}

export async function createPayment(paymentData: Omit<Payment, 'id'>) {
  const { data, error } = await supabase.from('payments').insert([paymentData]).select().single();

  if (error) {
    throw new Error(`Failed to create payment: ${error.message}`);
  }

  return data as Payment;
}

export async function updatePayment(id: string, paymentData: Partial<Payment>) {
  const { data, error } = await supabase.from('payments').update(paymentData).eq('id', id).select().single();

  if (error) {
    throw new Error(`Failed to update payment: ${error.message}`);
  }

  return data as Payment;
}

export async function deletePayment(id: string) {
  const { error } = await supabase.from('payments').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete payment: ${error.message}`);
  }
}

/**
 * Get payments statistics with all calculations done in backend
 */
export async function getPaymentsStatistics(filters: PaymentFilters = {}) {
  const payments = await getPayments(filters);
  
  const stats = {
    total: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    paid: payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
    pending: payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0),
  };

  return stats;
}

