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

  // Get current balances BEFORE creating transaction (for note formatting)
  const { getStudentById } = await import('./studentsService');
  const studentBefore = await getStudentById(transactionData.student_id);
  const currentWalletBalance = Number((studentBefore as any)?.wallet_balance || (studentBefore as any)?.walletBalance || 0);
  const currentLoanBalance = Number((studentBefore as any)?.loan_balance || (studentBefore as any)?.loanBalance || 0);

  // Calculate new balances for note formatting
  const amount = Number(transactionData.amount) || 0;
  const absoluteAmount = Math.abs(amount);
  const isPayment = amount < 0;
  let newWalletBalance = currentWalletBalance;
  let newLoanBalance = currentLoanBalance;
  
  // Calculate new balances based on transaction type
  // Khi số dư = 0đ: nạp âm tiền hoặc ứng tiền tính vào nợ học phí (loan_balance)
  switch (transactionData.type) {
    case 'topup':
      if (isPayment) {
        if (currentWalletBalance === 0) {
          newWalletBalance = 0;
          newLoanBalance = currentLoanBalance + absoluteAmount;
        } else {
          newWalletBalance = currentWalletBalance - absoluteAmount;
        }
      } else {
        newWalletBalance = currentWalletBalance + absoluteAmount;
      }
      break;
    case 'loan':
    case 'advance':
      if (isPayment) {
        newWalletBalance = currentWalletBalance - absoluteAmount;
        newLoanBalance = Math.max(0, currentLoanBalance - absoluteAmount);
      } else {
        if (currentWalletBalance === 0) {
          newWalletBalance = 0;
          newLoanBalance = currentLoanBalance + absoluteAmount;
        } else {
          newWalletBalance = currentWalletBalance + absoluteAmount;
          newLoanBalance = currentLoanBalance + absoluteAmount;
        }
      }
      break;
    case 'repayment':
      newWalletBalance = currentWalletBalance - absoluteAmount;
      newLoanBalance = Math.max(0, currentLoanBalance - absoluteAmount);
      break;
    case 'extend':
      newWalletBalance = currentWalletBalance - absoluteAmount;
      break;
    case 'refund':
      newWalletBalance = currentWalletBalance + absoluteAmount;
      break;
    default:
      break;
  }
  
  // Format note with before/after balances
  // Format: [User note (if any)]. Hành động: +/-số tiền. SD: Ađ → Bđ
  const userNote = (transactionData.note || '').trim();
  const formatAmount = (amt: number) => amt.toLocaleString('vi-VN');
  
  // Check if note is already formatted (contains "SD:", "Nợ:" or "→")
  const isAlreadyFormatted = userNote.includes('SD:') || userNote.includes('Nợ:') || userNote.includes('→');
  
  let formattedNote = '';
  
  if (isAlreadyFormatted) {
    // Use note as-is if already formatted
    formattedNote = userNote;
  } else {
    // Build formatted note
    const transactionTypeLabels: Record<string, string> = {
      topup: 'Nạp tiền',
      loan: 'Ứng tiền',
      advance: 'Ứng tiền',
      repayment: 'Thanh toán nợ',
      extend: 'Gia hạn buổi học',
      refund: 'Hoàn trả buổi học',
    };
    
    const typeLabel = transactionTypeLabels[transactionData.type] || transactionData.type;
    const sign = amount >= 0 ? '+' : '-';
    const amountText = formatAmount(absoluteAmount);
    
    // Extract session ID from user note if it's an extend transaction
    // Support formats: [Session: SES...] or [SES...]
    let sessionIdPart = '';
    let cleanUserNote = userNote;
    if (transactionData.type === 'extend' && userNote) {
      // Try to extract session ID from note (format: [Session: SES...] or [SES...])
      const sessionMatch = userNote.match(/\[(?:Session:\s*)?([A-Z0-9]+)\]/i);
      if (sessionMatch) {
        sessionIdPart = ` [${sessionMatch[1]}]`;
        // Remove session ID pattern from user note
        cleanUserNote = userNote.replace(/\[(?:Session:\s*)?[A-Z0-9]+\]/gi, '').trim();
        // Remove extra spaces and clean up
        cleanUserNote = cleanUserNote.replace(/\s+/g, ' ').trim();
      }
    }
    
    // Build action part
    const actionPart = `${typeLabel}${sessionIdPart}: ${sign}${amountText}đ`;
    
    // Build balance part: khi số dư 0 và chỉ thay đổi nợ thì ghi "Nợ: Ađ → Bđ", còn lại "SD: Ađ → Bđ"
    const balancePart =
      currentWalletBalance === 0 && newWalletBalance === 0 && newLoanBalance !== currentLoanBalance
        ? `Nợ: ${formatAmount(currentLoanBalance)}đ → ${formatAmount(newLoanBalance)}đ`
        : `SD: ${formatAmount(currentWalletBalance)}đ → ${formatAmount(newWalletBalance)}đ`;
    
    // Combine: [User note]. Hành động: +/-số tiền. SD/Nợ: Ađ → Bđ
    if (cleanUserNote) {
      formattedNote = `${cleanUserNote}. ${actionPart}. ${balancePart}`;
    } else {
      formattedNote = `${actionPart}. ${balancePart}`;
    }
  }

  // Create transaction with formatted note
  const transactionToInsert = { ...transactionData, id, note: formattedNote };
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert([transactionToInsert])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create wallet transaction: ${error.message}`);
  }

  // Invalidate dashboard cache: số dư thay đổi → bảng gia hạn cần refetch; topup còn ảnh hưởng doanh thu theo tháng
  import('./dashboardService').then(({ invalidateAllDashboardCache, invalidateDashboardCache }) => {
    invalidateAllDashboardCache().catch(() => {});
    if (transactionData.type === 'topup' && amount !== 0) {
      invalidateDashboardCache(transactionData.date || new Date().toISOString().split('T')[0]).catch(() => {});
    }
  }).catch(() => {});

  // Update student wallet_balance and loan_balance based on transaction type
  try {
    if (studentBefore) {

      // Update balances directly in database (bypass updateStudent to avoid field filtering)
      // Note: newWalletBalance and newLoanBalance are already calculated above
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

