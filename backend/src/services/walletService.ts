/**
 * Wallet Service
 * Business logic for wallet transactions CRUD operations
 */

import supabase from '../config/database';

export interface WalletTransaction {
  id: string;
  student_id: string;
  type: 'topup' | 'loan' | 'advance' | 'repayment' | 'extend' | 'refund';
  amount: number;
  note?: string;
  date: string;
  created_at: string;
}

export interface WalletTransactionFilters {
  studentId?: string;
  type?: 'topup' | 'loan' | 'advance' | 'repayment' | 'extend' | 'refund';
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
 * Automatically updates student wallet_balance based on transaction type
 */
export async function createWalletTransaction(transactionData: Omit<WalletTransaction, 'id' | 'created_at'>) {
  // Generate ID if not provided
  const id = (transactionData as any).id || `WT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Create transaction first
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert([{ ...transactionData, id }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create wallet transaction: ${error.message}`);
  }

  // Invalidate dashboard cache if this is a revenue transaction (only topup, not extend/refund)
  const amount = Number(transactionData.amount) || 0;
  if (transactionData.type === 'topup' && amount !== 0) {
    // Invalidate dashboard cache in background (don't wait)
    // Chỉ tính topup thực sự vào doanh thu, không tính extend/refund
    import('./dashboardService').then(({ invalidateDashboardCache }) => {
      invalidateDashboardCache(transactionData.date || new Date().toISOString().split('T')[0]).catch(() => {});
    }).catch(() => {});
  }

  // Update student wallet_balance and loan_balance based on transaction type
  try {
    const { getStudentById } = await import('./studentsService');
    const student = await getStudentById(transactionData.student_id);
    
    if (student) {
      const currentWalletBalance = Number((student as any).wallet_balance || (student as any).walletBalance || 0);
      const currentLoanBalance = Number((student as any).loan_balance || (student as any).loanBalance || 0);
      const amount = Number(transactionData.amount) || 0;
      let newWalletBalance = currentWalletBalance;
      let newLoanBalance = currentLoanBalance;

      // Calculate new balances based on transaction type
      // Handle negative amounts (payments) correctly
      const isPayment = amount < 0;
      const absoluteAmount = Math.abs(amount);
      
      switch (transactionData.type) {
        case 'topup':
          if (isPayment) {
            // Payment (negative amount): giảm số dư
            newWalletBalance = currentWalletBalance - absoluteAmount;
          } else {
            // Topup (positive amount): tăng số dư
            newWalletBalance = currentWalletBalance + absoluteAmount;
          }
          break;
        case 'loan':
        case 'advance':
          if (isPayment) {
            // Trả nợ ứng (negative amount): giảm số dư VÀ giảm nợ
            newWalletBalance = currentWalletBalance - absoluteAmount;
            newLoanBalance = Math.max(0, currentLoanBalance - absoluteAmount);
          } else {
            // Vay/Ứng (positive amount): tăng số dư VÀ tăng nợ
            newWalletBalance = currentWalletBalance + absoluteAmount;
            newLoanBalance = currentLoanBalance + absoluteAmount;
          }
          break;
        case 'repayment':
          // Trả nợ: giảm số dư VÀ giảm nợ
          newWalletBalance = currentWalletBalance - absoluteAmount;
          newLoanBalance = Math.max(0, currentLoanBalance - absoluteAmount);
          break;
        case 'extend':
          // Gia hạn: giảm số dư (thanh toán cho buổi học)
          newWalletBalance = currentWalletBalance - absoluteAmount;
          break;
        case 'refund':
          // Hoàn trả: tăng số dư (hoàn lại tiền)
          newWalletBalance = currentWalletBalance + absoluteAmount;
          break;
        default:
          // Unknown type, don't update
          break;
      }

      // Update balances directly in database (bypass updateStudent to avoid field filtering)
      const updates: any = {};
      if (newWalletBalance !== currentWalletBalance) {
        updates.wallet_balance = newWalletBalance;
      }
      if (newLoanBalance !== currentLoanBalance) {
        updates.loan_balance = newLoanBalance;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('students')
          .update(updates)
          .eq('id', transactionData.student_id);

        if (updateError) {
          console.error('Failed to update student balances:', updateError);
          throw updateError;
        }
      }
    }
  } catch (updateError) {
    // Log error but don't fail the transaction creation
    console.error('Failed to update student wallet balance:', updateError);
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

