import supabase from '../config/database';

export type AttendanceStatus = 'present' | 'excused' | 'absent';

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  present: boolean;
  remark?: string;
}

/**
 * Get attendance records for a session
 */
export async function getAttendanceBySession(sessionId: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to fetch attendance: ${error.message}`);
  }

  // Normalize response to ensure status is always present
  const normalized = (data || []).map((att: any) => ({
    ...att,
    status: att.status || (att.present ? 'present' : 'absent'),
  })) as Attendance[];

  return normalized;
}

/**
 * Rollback financial changes from previous attendance
 * This is called before processing new attendance to avoid double deduction
 */
async function rollbackAttendanceFinancials(
  sessionId: string,
  oldAttendanceData: Array<{ student_id: string; status: AttendanceStatus }>
): Promise<void> {
  console.log('[rollbackAttendanceFinancials] Starting rollback for session:', sessionId);
  console.log('[rollbackAttendanceFinancials] Attendance data:', oldAttendanceData);
  
  // Get session to retrieve class_id
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, class_id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    console.warn(`[rollbackAttendanceFinancials] Session not found: ${sessionId}`);
    return;
  }

  const classId = session.class_id;

  // Rollback each student's attendance
  for (const att of oldAttendanceData) {
    const { student_id, status } = att;
    console.log(`[rollbackAttendanceFinancials] Processing student ${student_id} with status: ${status}`);

    // Get student_class record
    const { data: studentClass, error: scError } = await supabase
      .from('student_classes')
      .select('id, student_id, remaining_sessions, total_attended_sessions')
      .eq('student_id', student_id)
      .eq('class_id', classId)
      .eq('status', 'active')
      .single();

    if (scError || !studentClass) {
      continue;
    }

    const updates: any = {};

    // Rollback: Add back remaining_sessions if it was deducted
    // We need to check wallet transactions to see if we deducted from wallet/loan
    // Look for transactions with session_id in the note
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('student_id', student_id)
      .like('note', `%${sessionId}%`)
      .order('created_at', { ascending: false });

    // Find transactions related to this specific session
    const sessionTransactions = transactions || [];
    
    // Determine what was deducted based on attendance status and transactions
    // Logic khi xóa session:
    // - Nếu status là "present" hoặc "excused": Luôn khôi phục 1 remaining_session (vì đã được tính là 1 học sinh cho gia sư)
    // - Nếu status là "absent": Chỉ khôi phục nếu đã trừ từ remaining_sessions (không có wallet transactions)
    // - Nếu có wallet transactions: Rollback wallet/loan, nhưng vẫn khôi phục remaining_sessions nếu status là present/excused
    
    // Chỉ khôi phục remaining_sessions cho học sinh có trạng thái present/excused
    // Hoặc absent nhưng không có wallet transactions (tức là đã trừ từ remaining_sessions)
    const shouldRestoreSession = (status === 'present' || status === 'excused') || 
                                  (status === 'absent' && sessionTransactions.length === 0);
    
    // Rollback wallet/loan transactions for this session
    if (sessionTransactions.length > 0) {
      // Get current student balance
      const { data: student } = await supabase
        .from('students')
        .select('wallet_balance, loan_balance')
        .eq('id', student_id)
        .single();

      if (student) {
        let totalWalletRefund = 0;
        let totalLoanRefund = 0;

        // Process each transaction
        for (const transaction of sessionTransactions) {
          if (transaction.amount < 0) {
            const amount = Math.abs(transaction.amount);
            if (transaction.type === 'loan') {
              totalLoanRefund += amount;
            } else {
              totalWalletRefund += amount;
            }
          }

          // Delete the transaction
          await supabase
            .from('wallet_transactions')
            .delete()
            .eq('id', transaction.id);
        }

        // Update balances
        const currentWallet = Number(student.wallet_balance || 0);
        const currentLoan = Number(student.loan_balance || 0);
        const studentUpdates: any = {};

        if (totalWalletRefund > 0) {
          studentUpdates.wallet_balance = currentWallet + totalWalletRefund;
        }
        if (totalLoanRefund > 0) {
          studentUpdates.loan_balance = Math.max(0, currentLoan - totalLoanRefund);
        }

        if (Object.keys(studentUpdates).length > 0) {
          await supabase
            .from('students')
            .update(studentUpdates)
            .eq('id', student_id);
        }
      }
    }
    
    // Restore remaining_sessions if needed
    // For present/excused: Always restore 1 session (because it was counted as 1 student for teacher)
    // For absent: Only restore if no wallet transactions (meaning it was deducted from remaining_sessions)
    if (shouldRestoreSession) {
      const currentRemaining = studentClass.remaining_sessions || 0;
      updates.remaining_sessions = currentRemaining + 1;
      console.log(`[rollbackAttendanceFinancials] Restoring 1 session for student ${student_id} (status: ${status}). Current: ${currentRemaining} → New: ${currentRemaining + 1}`);
    } else {
      console.log(`[rollbackAttendanceFinancials] NOT restoring session for student ${student_id} (status: ${status}, hasTransactions: ${sessionTransactions.length > 0})`);
    }

    // Rollback total_attended_sessions for present/excused
    if (status === 'present' || status === 'excused') {
      const currentAttended = studentClass.total_attended_sessions || 0;
      if (currentAttended > 0) {
        updates.total_attended_sessions = currentAttended - 1;
      }
    }

    // Update student_class
    if (Object.keys(updates).length > 0) {
      console.log(`[rollbackAttendanceFinancials] Updating student_class for student ${student_id}:`, updates);
      const { error: updateError } = await supabase
        .from('student_classes')
        .update(updates)
        .eq('id', studentClass.id);
      
      if (updateError) {
        console.error(`[rollbackAttendanceFinancials] Error updating student_class for student ${student_id}:`, updateError);
      } else {
        console.log(`[rollbackAttendanceFinancials] Successfully updated student_class for student ${student_id}`);
      }
    } else {
      console.log(`[rollbackAttendanceFinancials] No updates needed for student ${student_id}`);
    }
  }
  
  console.log('[rollbackAttendanceFinancials] Rollback completed for session:', sessionId);
}

/**
 * Create or update attendance records for a session
 * @param skipFinancialProcessing - If true, skip rollback and financial processing (for editing attendance only)
 */
export async function saveAttendanceForSession(
  sessionId: string,
  attendanceData: Array<{ student_id: string; present?: boolean; status?: AttendanceStatus; remark?: string }>,
  skipFinancialProcessing: boolean = false
): Promise<Attendance[]> {
  // Get existing attendance BEFORE deleting to rollback financials
  const existingAttendance = await getAttendanceBySession(sessionId);
  
  // Rollback financial changes from old attendance if it exists and not skipping financial processing
  if (existingAttendance.length > 0 && !skipFinancialProcessing) {
    try {
      const oldAttendanceData = existingAttendance.map(att => ({
        student_id: att.student_id,
        status: att.status,
      }));
      await rollbackAttendanceFinancials(sessionId, oldAttendanceData);
    } catch (rollbackError) {
      console.error('[saveAttendanceForSession] Error rolling back financials:', rollbackError);
      // Continue anyway - better to have new attendance saved even if rollback fails
    }
  }

  // First, delete existing attendance records for this session
  await supabase.from('attendance').delete().eq('session_id', sessionId);

  // Then, insert new attendance records
  const recordsToInsert = attendanceData.map((att, index) => {
    // Determine status: use status if provided, otherwise convert present boolean
    let status: AttendanceStatus = 'present';
    if (att.status && ['present', 'excused', 'absent'].includes(att.status)) {
      status = att.status;
    } else if (att.present !== undefined) {
      status = att.present ? 'present' : 'absent';
    }

    // Generate unique ID for each record
    const uniqueId = `ATT${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;

    // Build record with both status and present for compatibility
    const record: any = {
      id: uniqueId,
      session_id: sessionId,
      student_id: att.student_id,
      status, // Include status field
      present: status === 'present', // Keep for backward compatibility
      remark: att.remark || null,
    };

    return record;
  });

  const { data, error } = await supabase
    .from('attendance')
    .insert(recordsToInsert)
    .select();

  if (error) {
    console.error('[saveAttendanceForSession] Error details:', {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      recordsCount: recordsToInsert.length,
      firstRecord: recordsToInsert[0],
    });
    throw new Error(`Failed to save attendance: ${error.message}${error.details ? ` - ${error.details}` : ''}${error.hint ? ` (Hint: ${error.hint})` : ''}`);
  }

  // Normalize response
  const normalized = (data || []).map((att: any) => ({
    ...att,
    status: att.status || (att.present ? 'present' : 'absent'),
  })) as Attendance[];

  // Process financial calculations based on NEW attendance status (only if not skipping)
  if (!skipFinancialProcessing) {
    try {
      // Filter and normalize attendance data to ensure status is always defined
      const normalizedAttendanceData = attendanceData
        .map(att => {
          // Determine status: use status if provided, otherwise convert present boolean
          let status: AttendanceStatus = 'present';
          if (att.status && ['present', 'excused', 'absent'].includes(att.status)) {
            status = att.status;
          } else if (att.present !== undefined) {
            status = att.present ? 'present' : 'absent';
          }
          return {
            student_id: att.student_id,
            status,
          };
        })
        .filter(att => att.status !== undefined); // Ensure status is defined
      
      await processAttendanceFinancials(sessionId, normalizedAttendanceData);
    } catch (financialError) {
      console.error('[saveAttendanceForSession] Error processing financials:', financialError);
      // Don't fail the attendance save if financial processing fails
      // Log error and continue
    }
  } else {
    console.log('[saveAttendanceForSession] Skipping financial processing (edit mode)');
  }

  return normalized;
}

/**
 * Delete attendance records for a session
 */
export async function deleteAttendanceBySession(sessionId: string): Promise<void> {
  // Simply delete attendance records without rolling back financials
  // When a session is deleted, we just remove the attendance records
  // No financial rollback is performed (as per user requirement)
  const { error } = await supabase.from('attendance').delete().eq('session_id', sessionId);
  if (error) {
    throw new Error(`Failed to delete attendance: ${error.message}`);
  }
}

/**
 * Process attendance and calculate tuition fees and debts
 * This function handles the complex logic for calculating fees based on attendance status
 * 
 * Logic:
 * - Present (Học): 
 *   - If remaining_sessions > 0 → deduct 1 session
 *   - If not → deduct from wallet_balance (tuition_fee)
 *   - If wallet_balance < tuition_fee → add to loan_balance
 *   - Increment total_attended_sessions
 *   - Counts as 1 student for teacher allowance
 * - Excused (Phép):
 *   - Same financial logic as present
 *   - Cannot select if walletBalance === 0 and remainingSessions === 0
 *   - Increment total_attended_sessions
 *   - Counts as 1 student for teacher allowance
 * - Absent (Vắng):
 *   - If remaining_sessions > 0 → deduct 1 session
 *   - If not → deduct from wallet_balance (if available)
 *   - If wallet_balance = 0 → do nothing (don't add to loan)
 *   - Does NOT increment total_attended_sessions
 *   - Does NOT count for teacher allowance
 */
export async function processAttendanceFinancials(
  sessionId: string,
  attendanceData: Array<{ student_id: string; status: AttendanceStatus }>
): Promise<void> {
  // Get session to retrieve tuition_fee
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, class_id, tuition_fee')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`Failed to fetch session: ${sessionError?.message || 'Session not found'}`);
  }

  const tuitionFee = session.tuition_fee || 0;
  const classId = session.class_id;

  // Process each student's attendance
  for (const att of attendanceData) {
    const { student_id, status } = att;

    // Get student_class record with tuition information
    const { data: studentClass, error: scError } = await supabase
      .from('student_classes')
      .select('id, student_id, remaining_sessions, class_id, student_tuition_per_session, student_fee_total, student_fee_sessions')
      .eq('student_id', student_id)
      .eq('class_id', classId)
      .eq('status', 'active')
      .single();

    if (scError || !studentClass) {
      console.warn(`[processAttendanceFinancials] Student class not found for student ${student_id} in class ${classId}`);
      continue;
    }

    const remainingSessions = studentClass.remaining_sessions || 0;
    const updates: any = {};

    // Calculate student's tuition per session
    // Priority: student_tuition_per_session > calculated from student_fee > class default (from session tuition_fee / number of students)
    let studentTuitionPerSession = Number(studentClass.student_tuition_per_session || 0);
    if (studentTuitionPerSession === 0) {
      const studentFeeTotal = Number(studentClass.student_fee_total || 0);
      const studentFeeSessions = Number(studentClass.student_fee_sessions || 0);
      if (studentFeeTotal > 0 && studentFeeSessions > 0) {
        studentTuitionPerSession = studentFeeTotal / studentFeeSessions;
      } else {
        // Fallback: use session tuition_fee divided by number of eligible students
        // This is a rough estimate, but better than 0
        const eligibleCount = attendanceData.filter(a => a.status === 'present' || a.status === 'excused').length;
        studentTuitionPerSession = eligibleCount > 0 ? (tuitionFee / eligibleCount) : 0;
      }
    }

    // Get student to check wallet balance
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, wallet_balance, loan_balance')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      console.warn(`[processAttendanceFinancials] Student not found: ${student_id}`);
      continue;
    }

    const walletBalance = Number(student.wallet_balance || 0);
    const loanBalance = Number(student.loan_balance || 0);

    // Validation: Cannot select "excused" if walletBalance <= 0 (số buổi còn lại không cần dương)
    if (status === 'excused' && walletBalance <= 0) {
      throw new Error(`Không thể chọn trạng thái "Phép" cho học sinh khi số dư = 0`);
    }

    // Process financial deductions based on attendance status
    if (status === 'absent') {
      // Absent (Vắng): Only deduct if there are remaining sessions or wallet balance
      // If wallet balance is 0 and no remaining sessions, do nothing (don't add to loan)
      if (remainingSessions > 0) {
        // Deduct from remaining sessions
        updates.remaining_sessions = remainingSessions - 1;
      } else if (walletBalance > 0 && studentTuitionPerSession > 0) {
        // No remaining sessions, but has wallet balance - deduct from wallet
        if (walletBalance >= studentTuitionPerSession) {
          // Deduct full amount from wallet
          const newWalletBalance = walletBalance - studentTuitionPerSession;
          await supabase
            .from('students')
            .update({ wallet_balance: newWalletBalance })
            .eq('id', student_id);

          // Create wallet transaction with session ID
          const formatAmount = (amt: number) => amt.toLocaleString('vi-VN');
          await supabase.from('wallet_transactions').insert({
            id: `WTX${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            student_id: student_id,
            type: 'extend',
            amount: -studentTuitionPerSession,
            date: new Date().toISOString().split('T')[0],
            note: `Gia hạn buổi học [${sessionId}]: -${formatAmount(studentTuitionPerSession)}đ. SD: ${formatAmount(walletBalance)}đ → ${formatAmount(newWalletBalance)}đ`,
          });
        } else {
          // Deduct partial amount (use all remaining wallet balance)
          const newWalletBalance = 0;
          await supabase
            .from('students')
            .update({ wallet_balance: newWalletBalance })
            .eq('id', student_id);

          // Create wallet transaction with session ID
          const formatAmount = (amt: number) => amt.toLocaleString('vi-VN');
          await supabase.from('wallet_transactions').insert({
            id: `WTX${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            student_id: student_id,
            type: 'extend',
            amount: -walletBalance,
            date: new Date().toISOString().split('T')[0],
            note: `Gia hạn buổi học [${sessionId}]: -${formatAmount(walletBalance)}đ. SD: ${formatAmount(walletBalance)}đ → 0đ`,
          });
        }
        // Note: For absent, if wallet balance is insufficient, we don't add to loan
      }
      // If remainingSessions === 0 and walletBalance === 0, do nothing (no updates)
    } else {
      // Present (Học) or Excused (Phép): Full financial logic
      if (remainingSessions > 0) {
        // Deduct from remaining sessions
        updates.remaining_sessions = remainingSessions - 1;
      } else {
        // No remaining sessions, deduct from wallet or add to loan
        // Use student's individual tuition per session
        if (studentTuitionPerSession > 0) {
          if (walletBalance >= studentTuitionPerSession) {
            // Deduct from wallet
            const newWalletBalance = walletBalance - studentTuitionPerSession;
            await supabase
              .from('students')
              .update({ wallet_balance: newWalletBalance })
              .eq('id', student_id);

            // Create wallet transaction with detailed note (like bank statement)
            const formatAmount = (amt: number) => amt.toLocaleString('vi-VN');
            await supabase.from('wallet_transactions').insert({
              id: `WTX${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              student_id: student_id,
              type: 'extend',
              amount: -studentTuitionPerSession,
              date: new Date().toISOString().split('T')[0],
              note: `Gia hạn buổi học [${sessionId}]: -${formatAmount(studentTuitionPerSession)}đ. SD: ${formatAmount(walletBalance)}đ → ${formatAmount(newWalletBalance)}đ`,
            });
          } else {
            // Add to loan
            const debtAmount = studentTuitionPerSession - walletBalance;
            const newWalletBalance = 0;
            const newLoanBalance = loanBalance + debtAmount;

            await supabase
              .from('students')
              .update({
                wallet_balance: newWalletBalance,
                loan_balance: newLoanBalance,
              })
              .eq('id', student_id);

            // Create wallet transaction for loan with detailed note (like bank statement)
            if (walletBalance > 0) {
              const formatAmount = (amt: number) => amt.toLocaleString('vi-VN');
              await supabase.from('wallet_transactions').insert({
                id: `WTX${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                student_id: student_id,
                type: 'extend',
                amount: -walletBalance,
                date: new Date().toISOString().split('T')[0],
                note: `Gia hạn buổi học [${sessionId}]: -${formatAmount(walletBalance)}đ. SD: ${formatAmount(walletBalance)}đ → 0đ`,
              });
            }

            const formatAmount = (amt: number) => amt.toLocaleString('vi-VN');
            await supabase.from('wallet_transactions').insert({
              id: `WTX${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              student_id: student_id,
              type: 'loan',
              amount: debtAmount,
              date: new Date().toISOString().split('T')[0],
              note: `Ứng tiền [${sessionId}]: +${formatAmount(debtAmount)}đ. Nợ: ${formatAmount(loanBalance)}đ → ${formatAmount(newLoanBalance)}đ`,
            });
          }
        }
      }
    }

    // Only increment total_attended_sessions for present and excused (not absent)
    if (status === 'present' || status === 'excused') {
      const { data: currentRecord } = await supabase
        .from('student_classes')
        .select('total_attended_sessions')
        .eq('id', studentClass.id)
        .single();

      const currentAttended = (currentRecord as any)?.total_attended_sessions || 0;
      updates.total_attended_sessions = currentAttended + 1;
    }

    // Update student_class
    if (Object.keys(updates).length > 0) {
      await supabase
        .from('student_classes')
        .update(updates)
        .eq('id', studentClass.id);
    }
  }
}
