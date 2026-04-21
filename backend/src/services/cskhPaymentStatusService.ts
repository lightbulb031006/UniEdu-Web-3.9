/**
 * CSKH Payment Status Service
 * Manages payment status for CSKH staff profits from students
 */

import supabase from '../config/database';

export interface CSKHPaymentStatus {
  id: string;
  staff_id: string;
  student_id: string;
  month: string; // YYYY-MM
  payment_status: 'paid' | 'unpaid' | 'deposit';
  profit_percent: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get payment status for a staff member in a specific month
 */
export async function getCSKHPaymentStatuses(staffId: string, month: string) {
  const { data, error } = await supabase
    .from('cskh_payment_status')
    .select('*')
    .eq('staff_id', staffId)
    .eq('month', month);

  if (error) {
    throw new Error(`Failed to fetch CSKH payment statuses: ${error.message}`);
  }

  return (data || []) as CSKHPaymentStatus[];
}

/**
 * Get payment status for a specific student
 */
export async function getCSKHPaymentStatus(staffId: string, studentId: string, month: string) {
  const { data, error } = await supabase
    .from('cskh_payment_status')
    .select('*')
    .eq('staff_id', staffId)
    .eq('student_id', studentId)
    .eq('month', month)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found - return null
      return null;
    }
    throw new Error(`Failed to fetch CSKH payment status: ${error.message}`);
  }

  return data as CSKHPaymentStatus | null;
}

/**
 * Upsert payment status (create or update)
 */
export async function upsertCSKHPaymentStatus(
  staffId: string,
  studentId: string,
  month: string,
  paymentStatus: 'paid' | 'unpaid' | 'deposit',
  profitPercent?: number
) {
  // First, try to get existing record
  const existing = await getCSKHPaymentStatus(staffId, studentId, month);

  const dataToUpsert: any = {
    staff_id: staffId,
    student_id: studentId,
    month,
    payment_status: paymentStatus,
  };

  if (profitPercent !== undefined) {
    dataToUpsert.profit_percent = profitPercent;
  } else if (existing) {
    // Keep existing profit_percent if not provided
    dataToUpsert.profit_percent = existing.profit_percent;
  } else {
    // Default profit percent if creating new record
    dataToUpsert.profit_percent = 10;
  }

  let data, error;

  if (existing) {
    // Update existing record
    ({ data, error } = await supabase
      .from('cskh_payment_status')
      .update(dataToUpsert)
      .eq('staff_id', staffId)
      .eq('student_id', studentId)
      .eq('month', month)
      .select()
      .single());
  } else {
    // Insert new record (let database generate ID)
    ({ data, error } = await supabase
      .from('cskh_payment_status')
      .insert(dataToUpsert)
      .select()
      .single());
  }

  if (error) {
    throw new Error(`Failed to upsert CSKH payment status: ${error.message}`);
  }

  return data as CSKHPaymentStatus;
}

/**
 * Update payment status for multiple students (bulk update)
 */
export async function bulkUpdateCSKHPaymentStatus(
  staffId: string,
  month: string,
  updates: Array<{
    studentId: string;
    paymentStatus: 'paid' | 'unpaid' | 'deposit';
    profitPercent?: number;
  }>
) {
  // Process each update individually to handle upsert correctly
  const results: CSKHPaymentStatus[] = [];
  
  for (const update of updates) {
    try {
      const result = await upsertCSKHPaymentStatus(
        staffId,
        update.studentId,
        month,
        update.paymentStatus,
        update.profitPercent
      );
      results.push(result);
    } catch (error: any) {
      console.error(`Failed to update payment status for student ${update.studentId}:`, error);
      // Continue with other updates even if one fails
    }
  }

  return results;
}

/**
 * Get default profit percent for a staff member
 * Priority: teachers.cskh_default_profit_percent > first cskh_payment_status record > 10%
 */
export async function getDefaultProfitPercent(staffId: string): Promise<number> {
  // 1. Try to read from teachers table (dedicated column)
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('cskh_default_profit_percent')
    .eq('id', staffId)
    .maybeSingle();

  if (!teacherError && teacher && teacher.cskh_default_profit_percent != null) {
    return Number(teacher.cskh_default_profit_percent);
  }

  // 2. Fallback: read from first cskh_payment_status record
  const { data, error } = await supabase
    .from('cskh_payment_status')
    .select('profit_percent')
    .eq('staff_id', staffId)
    .limit(1)
    .maybeSingle();

  if (!error && data) {
    return Number(data.profit_percent) || 10;
  }

  return 10; // Default 10%
}

/**
 * Update default profit percent for a staff member
 * Saves to teachers table AND bulk-updates all existing cskh_payment_status records
 */
export async function updateDefaultProfitPercent(staffId: string, profitPercent: number): Promise<number> {
  // 1. Save to teachers table (dedicated column for persistence)
  const { error: teacherError } = await supabase
    .from('teachers')
    .update({ cskh_default_profit_percent: profitPercent })
    .eq('id', staffId);

  if (teacherError) {
    console.error('Failed to update default profit percent on teachers table:', teacherError);
    // Don't throw - continue with bulk update of payment statuses
  }

  // 2. Bulk-update all existing cskh_payment_status records for this staff
  const { error: bulkError } = await supabase
    .from('cskh_payment_status')
    .update({ profit_percent: profitPercent })
    .eq('staff_id', staffId);

  if (bulkError) {
    console.error('Failed to bulk update profit percent in cskh_payment_status:', bulkError);
  }

  return profitPercent;
}

