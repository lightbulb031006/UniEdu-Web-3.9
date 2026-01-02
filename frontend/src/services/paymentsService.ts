/**
 * Payments Service
 * API calls for payments operations
 */

import api from './api';

export interface Payment {
  id: string;
  studentId?: string;
  student_id?: string;
  classId?: string;
  class_id?: string;
  amount: number;
  date: string;
  status: 'paid' | 'pending';
  note?: string;
}

// Normalize payment data
function normalizePayment(payment: any): Payment {
  return {
    id: payment.id,
    studentId: payment.student_id || payment.studentId,
    classId: payment.class_id || payment.classId,
    amount: payment.amount,
    date: payment.date,
    status: payment.status,
    note: payment.note,
  };
}

export interface PaymentFilters {
  status?: 'all' | 'paid' | 'pending';
  classId?: string;
  studentId?: string;
}

export async function fetchPayments(filters?: PaymentFilters): Promise<Payment[]> {
  const response = await api.get<any[]>('/payments', { params: filters });
  const data = response.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(normalizePayment);
}

export async function createPayment(data: Omit<Payment, 'id'>) {
  const apiData: any = {
    student_id: data.studentId,
    class_id: data.classId,
    amount: data.amount,
    date: data.date,
    status: data.status || 'pending',
    note: data.note,
  };
  const response = await api.post<any>('/payments', apiData);
  return normalizePayment(response.data);
}

export async function updatePayment(id: string, data: Partial<Payment>) {
  const apiData: any = {};
  if (data.studentId !== undefined) apiData.student_id = data.studentId;
  if (data.classId !== undefined) apiData.class_id = data.classId;
  if (data.amount !== undefined) apiData.amount = data.amount;
  if (data.date !== undefined) apiData.date = data.date;
  if (data.status !== undefined) apiData.status = data.status;
  if (data.note !== undefined) apiData.note = data.note;
  const response = await api.put<any>(`/payments/${id}`, apiData);
  return normalizePayment(response.data);
}

export async function deletePayment(id: string) {
  await api.delete(`/payments/${id}`);
}

/**
 * Get payments statistics with all calculations done in backend
 */
export interface PaymentsStatistics {
  total: number;
  paid: number;
  pending: number;
}

export async function fetchPaymentsStatistics(filters?: PaymentFilters): Promise<PaymentsStatistics> {
  const response = await api.get<PaymentsStatistics>('/payments/statistics', { params: filters });
  return response.data;
}

