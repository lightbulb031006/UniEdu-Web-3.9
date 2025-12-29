/**
 * Staff Service
 * Business logic for staff-related operations including unpaid amount calculation
 */

import supabase from '../config/database';

export interface StaffUnpaidAmount {
  staffId: string;
  unpaidAmount: number;
}

/**
 * Calculate unpaid amount for a staff member
 * This includes:
 * - Unpaid bonuses from bonuses table
 * - Unpaid sessions (for teachers) from sessions table
 */
export async function getStaffUnpaidAmount(staffId: string): Promise<number> {
  let totalUnpaid = 0;

  // Get unpaid bonuses
  const { data: bonuses, error: bonusesError } = await supabase
    .from('bonuses')
    .select('amount')
    .eq('staff_id', staffId)
    .eq('status', 'unpaid');

  if (!bonusesError && bonuses) {
    totalUnpaid += bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
  }

  // Get unpaid sessions for teachers
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('allowance_amount')
    .eq('teacher_id', staffId)
    .eq('payment_status', 'unpaid');

  if (!sessionsError && sessions) {
    totalUnpaid += sessions.reduce((sum, s) => sum + (s.allowance_amount || 0), 0);
  }

  return totalUnpaid;
}

/**
 * Get unpaid amounts for multiple staff members
 */
export async function getStaffUnpaidAmounts(staffIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // Get unpaid bonuses for all staff
  const { data: bonuses, error: bonusesError } = await supabase
    .from('bonuses')
    .select('staff_id, amount')
    .in('staff_id', staffIds)
    .eq('status', 'unpaid');

  if (!bonusesError && bonuses) {
    bonuses.forEach((b) => {
      if (!result[b.staff_id]) {
        result[b.staff_id] = 0;
      }
      result[b.staff_id] += b.amount || 0;
    });
  }

  // Get unpaid sessions for all teachers
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('teacher_id, allowance_amount')
    .in('teacher_id', staffIds)
    .eq('payment_status', 'unpaid');

  if (!sessionsError && sessions) {
    sessions.forEach((s) => {
      if (!result[s.teacher_id]) {
        result[s.teacher_id] = 0;
      }
      result[s.teacher_id] += s.allowance_amount || 0;
    });
  }

  return result;
}

/**
 * Get staff by ID (from teachers table)
 */
async function getStaffById(staffId: string) {
  const { data, error } = await supabase.from('teachers').select('*').eq('id', staffId).single();

  if (error) {
    throw new Error(`Failed to fetch staff: ${error.message}`);
  }

  return data;
}

/**
 * Get work items for a staff member by role
 * Returns work items with stats (unpaid, paid, total) for each role
 */
export async function getStaffWorkItems(staffId: string, month: string) {
  const staff = await getStaffById(staffId);
  if (!staff) {
    throw new Error('Staff not found');
  }

  // Validate and set default month if empty
  const validMonth = month && month.trim() ? month : new Date().toISOString().slice(0, 7);

  const roles = (staff.roles || []) as string[];
  const workItems: Array<{
    name: string;
    type: string;
    unpaid: number;
    paid: number;
    total: number;
    pageUrl?: string;
  }> = [];

  // Import services - handle error if service doesn't exist
  let getLessonOutputs: any = null;
  try {
    const lessonOutputsModule = await import('./lessonOutputsService');
    getLessonOutputs = lessonOutputsModule.getLessonOutputs;
  } catch (error) {
    console.error('Failed to import lessonOutputsService:', error);
  }

  for (const role of roles) {
    switch (role) {
      case 'lesson_plan': {
        // Calculate from lesson_outputs
        const DEFAULT_LESSON_OUTPUT_ALLOWANCE = 50000;
        let outputs: any[] = [];
        if (getLessonOutputs) {
          try {
            outputs = await getLessonOutputs({ assistantId: staffId, month: validMonth });
          } catch (error) {
            console.error('Failed to get lesson outputs:', error);
            outputs = [];
          }
        }

        const unpaidOutputs = outputs.filter((o) => {
          const status = o.status || 'pending';
          return status === 'pending' || status === 'deposit';
        });
        const totalUnpaid = unpaidOutputs.reduce((sum, output) => {
          const amount = Number(output.cost || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
          return sum + amount;
        }, 0);

        const paidOutputs = outputs.filter((o) => (o.status || 'pending') === 'paid');
        const totalPaid = paidOutputs.reduce((sum, output) => {
          const amount = Number(output.cost || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
          return sum + amount;
        }, 0);

        const totalMonth = outputs.reduce((sum, output) => {
          const amount = Number(output.cost || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
          return sum + amount;
        }, 0);

        workItems.push({
          name: 'Giáo án',
          type: 'lesson_plan',
          unpaid: totalUnpaid,
          paid: totalPaid,
          total: totalMonth,
          pageUrl: 'lesson-plans',
        });
        break;
      }
      case 'accountant': {
        workItems.push({
          name: 'Kế toán',
          type: 'accountant',
          unpaid: 0,
          paid: 0,
          total: 0,
          pageUrl: 'costs',
        });
        break;
      }
      case 'cskh_sale': {
        // CSKH stats are calculated separately in StaffCSKHDetail
        workItems.push({
          name: 'CSKH & SALE',
          type: 'cskh_sale',
          unpaid: 0,
          paid: 0,
          total: 0,
          pageUrl: `staff-cskh-detail:${staffId}`,
        });
        break;
      }
      case 'communication': {
        workItems.push({
          name: 'Truyền thông',
          type: 'communication',
          unpaid: 0,
          paid: 0,
          total: 0,
        });
        break;
      }
    }
  }

  return workItems;
}

/**
 * Get bonuses for a staff member in a specific month
 */
export async function getStaffBonuses(staffId: string, month: string) {
  const { getBonuses } = await import('./bonusesService');
  return await getBonuses({ staffId, month });
}

/**
 * Update staff QR payment link
 */
export async function updateStaffQrPaymentLink(staffId: string, qrLink: string) {
  const { data, error } = await supabase
    .from('teachers')
    .update({ bank_qr_link: qrLink || null })
    .eq('id', staffId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update QR payment link: ${error.message}`);
  }

  return data;
}

/**
 * Get staff login info (account handle and password hash) from users table
 */
export async function getStaffLoginInfo(staffId: string) {
  // Query users table with link_id matching staffId and role = 'teacher'
  const { data: users, error } = await supabase
    .from('users')
    .select('id, account_handle, email, role, link_id, password')
    .eq('link_id', staffId)
    .eq('role', 'teacher')
    .limit(1);

  if (error) {
    // Retry without role filter
    const { data: retryUsers, error: retryError } = await supabase
      .from('users')
      .select('id, account_handle, email, role, link_id, password')
      .eq('link_id', staffId)
      .limit(1);

    if (retryError) {
      throw new Error(`Failed to fetch staff login info: ${retryError.message}`);
    }

    if (retryUsers && retryUsers.length > 0) {
      const user = retryUsers[0];
      return {
        accountHandle: user.account_handle || null,
        hasPassword: !!(user.password && user.password.trim().length > 0),
        password: user.password || null, // Return password hash for prefill
      };
    }

    return null;
  }

  if (users && users.length > 0) {
    const user = users[0];
    return {
      accountHandle: user.account_handle || null,
      hasPassword: !!(user.password && user.password.trim().length > 0),
      password: user.password || null, // Return password hash for prefill
    };
  }

  return null;
}

