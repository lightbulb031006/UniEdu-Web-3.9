/**
 * CSKH Payment Status Service (Frontend)
 * API calls for CSKH payment status operations
 */

import api from './api';

export interface CSKHPaymentStatus {
  id: string;
  staff_id: string;
  student_id: string;
  month: string;
  payment_status: 'paid' | 'unpaid' | 'deposit';
  profit_percent: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get payment statuses for a CSKH staff member in a specific month
 */
export async function getCSKHPaymentStatuses(staffId: string, month: string): Promise<CSKHPaymentStatus[]> {
  const response = await api.get<CSKHPaymentStatus[]>(`/staff/${staffId}/cskh/payment-status?month=${month}`);
  return response.data || [];
}

/**
 * Get default profit percent for a CSKH staff member
 */
export async function getDefaultProfitPercent(staffId: string): Promise<number> {
  const response = await api.get<{ profitPercent: number }>(`/staff/${staffId}/cskh/default-profit-percent`);
  return response.data?.profitPercent || 10;
}

/**
 * Update payment status for a student
 */
export async function updateCSKHPaymentStatus(
  staffId: string,
  studentId: string,
  month: string,
  paymentStatus: 'paid' | 'unpaid' | 'deposit',
  profitPercent?: number
): Promise<CSKHPaymentStatus> {
  const response = await api.put<CSKHPaymentStatus>(`/staff/${staffId}/cskh/payment-status`, {
    studentId,
    month,
    paymentStatus,
    profitPercent,
  });
  return response.data;
}

/**
 * Bulk update payment statuses for multiple students
 */
export async function bulkUpdateCSKHPaymentStatus(
  staffId: string,
  month: string,
  updates: Array<{
    studentId: string;
    paymentStatus: 'paid' | 'unpaid' | 'deposit';
    profitPercent?: number;
  }>
): Promise<CSKHPaymentStatus[]> {
  const response = await api.post<CSKHPaymentStatus[]>(`/staff/${staffId}/cskh/payment-status/bulk`, {
    month,
    updates,
  });
  return response.data || [];
}

