/**
 * Wallet Service
 * API calls for wallet transactions
 */

import api from './api';

export interface WalletTransaction {
  id: string;
  studentId: string;
  type: 'topup' | 'loan' | 'advance' | 'repayment' | 'extend' | 'refund';
  amount: number;
  note?: string;
  date: string;
  createdAt: string;
}

// Normalize wallet transaction data
function normalizeWalletTransaction(tx: any): WalletTransaction {
  return {
    id: tx.id,
    studentId: tx.student_id || tx.studentId,
    type: tx.type,
    amount: Number(tx.amount) || 0,
    note: tx.note,
    date: tx.date,
    createdAt: tx.created_at || tx.createdAt,
  };
}

export async function fetchWalletTransactions(filters?: {
  studentId?: string;
  type?: 'topup' | 'loan' | 'advance' | 'repayment' | 'extend' | 'refund';
  startDate?: string;
  endDate?: string;
}): Promise<WalletTransaction[]> {
  try {
    const response = await api.get<any[]>('/wallet-transactions', { params: filters });
    const data = response.data;
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map(normalizeWalletTransaction);
  } catch (error: any) {
    console.error('Failed to fetch wallet transactions:', error.message);
    throw error;
  }
}

export async function createWalletTransaction(data: Omit<WalletTransaction, 'id' | 'createdAt'>) {
  const apiData: any = {
    student_id: data.studentId,
    type: data.type,
    amount: data.amount,
    note: data.note,
    date: data.date,
  };
  const response = await api.post<any>('/wallet-transactions', apiData);
  return normalizeWalletTransaction(response.data);
}

