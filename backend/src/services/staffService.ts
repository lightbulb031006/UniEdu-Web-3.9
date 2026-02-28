/**
 * Staff Service
 * Business logic for staff-related operations including unpaid amount calculation
 */

import supabase from '../config/database';
import {
  getStaffMonthlyStats,
  saveStaffMonthlyStats,
  getOrCalculateStaffMonthlyStats,
} from './staffMonthlyStatsService';

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
 * This should match the calculation in getStaffDetailData (totalUnpaidByStatus)
 * which includes: unpaid from classes (current + previous month) + unpaid work items + unpaid bonuses
 */
export async function getStaffUnpaidAmounts(staffIds: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // Get current month (YYYY-MM)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Calculate previous month (for unpaid calculation: current month + previous month)
  const [year, monthNum] = currentMonth.split('-').map(Number);
  let previousYear = year;
  let previousMonthNum = monthNum - 1;
  if (previousMonthNum === 0) {
    previousMonthNum = 12;
    previousYear = year - 1;
  }
  const previousMonth = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}`;

  const previousMonthStart = new Date(previousYear, previousMonthNum - 1, 1);
  const previousMonthEnd = new Date(previousYear, previousMonthNum, 0, 23, 59, 59);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);

  // Format dates for database query
  const previousMonthStartStr = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}-01`;
  const lastDayOfPreviousMonth = new Date(previousYear, previousMonthNum, 0).getDate();
  const previousMonthEndStr = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}-${String(lastDayOfPreviousMonth).padStart(2, '0')}`;
  const monthStartStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
  const monthEndStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Try to get from cache first (faster)
  const cachePromises = staffIds.map(async (staffId) => {
    const cachedStats = await getStaffMonthlyStats(staffId, currentMonth);
    if (cachedStats) {
      return { staffId, unpaid: cachedStats.total_unpaid_all };
    }
    return { staffId, unpaid: null };
  });

  const cacheResults = await Promise.all(cachePromises);
  const uncachedStaffIds: string[] = [];

  cacheResults.forEach(({ staffId, unpaid }) => {
    if (unpaid !== null) {
      result[staffId] = unpaid;
    } else {
      uncachedStaffIds.push(staffId);
    }
  });

  // If all staff have cache, return early
  if (uncachedStaffIds.length === 0) {
    return result;
  }

  // For uncached staff, calculate unpaid amount
  // This matches the logic in getStaffDetailData:
  // 1. Unpaid from classes (sessions in current + previous month with payment_status='unpaid')
  // 2. Unpaid from work items
  // 3. Unpaid from bonuses

  // Get unpaid bonuses for uncached staff - also check cache first
  // Logic: unpaid bonuses = unpaid from current month + previous month (matching getStaffBonusesStatistics)
  const bonusesCachePromises = uncachedStaffIds.map(async (staffId) => {
    const cachedStats = await getStaffMonthlyStats(staffId, currentMonth);
    if (cachedStats) {
      return { staffId, unpaidBonuses: cachedStats.bonuses_total_unpaid || 0 };
    }
    const previousMonthCached = await getStaffMonthlyStats(staffId, previousMonth);
    if (previousMonthCached) {
      return { staffId, unpaidBonuses: previousMonthCached.bonuses_total_unpaid || 0 };
    }
    return { staffId, unpaidBonuses: null };
  });

  const bonusesCacheResults = await Promise.all(bonusesCachePromises);
  const bonusesUncachedIds: string[] = [];
  const unpaidBonuses: Record<string, number> = {};

  bonusesCacheResults.forEach(({ staffId, unpaidBonuses: unpaid }) => {
    if (unpaid !== null) {
      unpaidBonuses[staffId] = unpaid;
    } else {
      bonusesUncachedIds.push(staffId);
    }
  });

  // Only query database for staff without cache
  // Query bonuses from current month + previous month only (matching getStaffBonusesStatistics logic)
  const { data: bonuses, error: bonusesError } = bonusesUncachedIds.length > 0
    ? await supabase
      .from('bonuses')
      .select('staff_id, amount, month')
      .in('staff_id', bonusesUncachedIds)
      .eq('status', 'unpaid')
      .in('month', [currentMonth, previousMonth])
    : { data: [], error: null };

  // Add bonuses from database query to existing cache results
  if (!bonusesError && bonuses) {
    bonuses.forEach((b) => {
      if (!unpaidBonuses[b.staff_id]) {
        unpaidBonuses[b.staff_id] = 0;
      }
      unpaidBonuses[b.staff_id] += Number(b.amount) || 0;
    });
  }

  // Get unpaid work items for uncached staff - optimize by checking cache for previous month too
  // Try to get from cache for both current and previous month first
  const workItemsCachePromises = uncachedStaffIds.map(async (staffId) => {
    // Check cache for current month work items
    const cachedStats = await getStaffMonthlyStats(staffId, currentMonth);
    if (cachedStats) {
      return { staffId, unpaidWorkItems: cachedStats.work_items_total_unpaid || 0 };
    }
    // If not found, try previous month cache (work items unpaid might be similar)
    const previousMonthCached = await getStaffMonthlyStats(staffId, previousMonth);
    if (previousMonthCached) {
      return { staffId, unpaidWorkItems: previousMonthCached.work_items_total_unpaid || 0 };
    }
    return { staffId, unpaidWorkItems: null };
  });

  const workItemsCacheResults = await Promise.all(workItemsCachePromises);
  const workItemsUncachedIds: string[] = [];
  const unpaidWorkItems: Record<string, number> = {};

  workItemsCacheResults.forEach(({ staffId, unpaidWorkItems: unpaid }) => {
    if (unpaid !== null) {
      unpaidWorkItems[staffId] = unpaid;
    } else {
      workItemsUncachedIds.push(staffId);
    }
  });

  // Only calculate for staff without cache - run in parallel
  if (workItemsUncachedIds.length > 0) {
    const workItemsPromises = workItemsUncachedIds.map(async (staffId) => {
      try {
        const workItems = await getStaffWorkItems(staffId, currentMonth);
        const totalUnpaidWorkItems = workItems.reduce((sum, item) => sum + (item.unpaid || 0), 0);
        return { staffId, unpaidWorkItems: totalUnpaidWorkItems };
      } catch (error) {
        console.error(`Failed to get work items for staff ${staffId}:`, error);
        return { staffId, unpaidWorkItems: 0 };
      }
    });

    const workItemsResults = await Promise.all(workItemsPromises);
    workItemsResults.forEach(({ staffId, unpaidWorkItems: unpaid }) => {
      unpaidWorkItems[staffId] = unpaid;
    });
  }

  // Get unpaid sessions for teachers (in current month + previous month only)
  // This matches the logic in getStaffDetailData
  // Only query for staff without cache
  const { data: sessions, error: sessionsError } = uncachedStaffIds.length > 0
    ? await supabase
      .from('sessions')
      .select('teacher_id, class_id, date, payment_status, allowance_amount')
      .in('teacher_id', uncachedStaffIds)
      .eq('payment_status', 'unpaid')
      .gte('date', previousMonthStartStr)
      .lte('date', monthEndStr)
    : { data: [], error: null };

  const unpaidSessions: Record<string, number> = {};
  if (!sessionsError && sessions) {
    // Get classes to calculate allowance
    const teacherIds = [...new Set(sessions.map((s: any) => s.teacher_id))];
    const { data: classTeachers } = await supabase
      .from('class_teachers')
      .select('teacher_id, class_id')
      .in('teacher_id', teacherIds);

    const classIds = [...new Set((classTeachers || []).map((ct: any) => ct.class_id))];
    let classes: any[] = [];
    if (classIds.length > 0) {
      const classesResult = await supabase
        .from('classes')
        .select('id, tuition_per_session, custom_teacher_allowances')
        .in('id', classIds);
      classes = classesResult.data || [];
    }

    const classMap = new Map();
    (classes || []).forEach((cls: any) => {
      classMap.set(cls.id, cls);
    });

    const teacherClassMap = new Map<string, string[]>();
    (classTeachers || []).forEach((ct: any) => {
      if (!teacherClassMap.has(ct.teacher_id)) {
        teacherClassMap.set(ct.teacher_id, []);
      }
      teacherClassMap.get(ct.teacher_id)!.push(ct.class_id);
    });

    sessions.forEach((s: any) => {
      if (!unpaidSessions[s.teacher_id]) {
        unpaidSessions[s.teacher_id] = 0;
      }

      // Calculate allowance using the same logic as getStaffDetailData
      const cls = classMap.get(s.class_id);
      const classTuition = cls ? (Number(cls.tuition_per_session) || 0) : 0;
      const customAllowances = cls ? ((cls.custom_teacher_allowances as Record<string, number>) || {}) : {};
      const teacherAllowance = customAllowances[s.teacher_id] ?? classTuition;

      // Use getSessionAllowance function to ensure consistency with getStaffDetailData
      const allowance = getSessionAllowance(s, teacherAllowance);
      unpaidSessions[s.teacher_id] += allowance;
    });
  }

  // Combine all unpaid amounts for each uncached staff
  // For cached staff, result already has the value from cache
  uncachedStaffIds.forEach((staffId) => {
    result[staffId] = (unpaidSessions[staffId] || 0) + (unpaidWorkItems[staffId] || 0) + (unpaidBonuses[staffId] || 0);
  });

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

        // Calculate previous month (for unpaid calculation: current month + previous month)
        const [year, monthNum] = validMonth.split('-').map(Number);
        let previousYear = year;
        let previousMonthNum = monthNum - 1;
        if (previousMonthNum === 0) {
          previousMonthNum = 12;
          previousYear = year - 1;
        }
        const previousMonth = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}`;

        // Get outputs for current month (for paid/total display)
        let monthOutputs: any[] = [];
        if (getLessonOutputs) {
          try {
            monthOutputs = await getLessonOutputs({ assistantId: staffId, month: validMonth });
          } catch (error) {
            console.error('Failed to get lesson outputs for month:', error);
            monthOutputs = [];
          }
        }

        // Get outputs for previous month (for unpaid calculation)
        let previousMonthOutputs: any[] = [];
        if (getLessonOutputs) {
          try {
            previousMonthOutputs = await getLessonOutputs({ assistantId: staffId, month: previousMonth });
          } catch (error) {
            console.error('Failed to get lesson outputs for previous month:', error);
            previousMonthOutputs = [];
          }
        }

        // Combine outputs from previous month and current month for unpaid calculation
        const outputsInTwoMonths = [...previousMonthOutputs, ...monthOutputs];

        // Calculate unpaid from outputs in previous month and current month only
        // "Chưa nhận" = tổng số bài chưa thanh toán (status='pending', không tính 'deposit' và 'paid')
        // Filter unpaid outputs from BOTH previous month and current month
        const unpaidOutputs = outputsInTwoMonths.filter((o) => {
          const status = o.status || 'pending';
          // Only count 'pending' status (chưa thanh toán), NOT 'deposit' or 'paid'
          return status === 'pending';
        });

        // Calculate unpaid from outputs in previous month and current month
        const unpaidFromPreviousMonth = previousMonthOutputs.filter((o) => (o.status || 'pending') === 'pending');
        const unpaidFromCurrentMonth = monthOutputs.filter((o) => (o.status || 'pending') === 'pending');

        const totalUnpaid = unpaidOutputs.reduce((sum, output) => {
          const amount = Number(output.cost || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
          return sum + amount;
        }, 0);

        const paidOutputs = monthOutputs.filter((o) => (o.status || 'pending') === 'paid');
        const totalPaid = paidOutputs.reduce((sum, output) => {
          const amount = Number(output.cost || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
          return sum + amount;
        }, 0);

        const totalMonth = monthOutputs.reduce((sum, output) => {
          const amount = Number(output.cost || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
          return sum + amount;
        }, 0);

        workItems.push({
          name: 'Giáo án',
          type: 'lesson_plan',
          unpaid: totalUnpaid, // Total unpaid from previous month + current month
          paid: totalPaid, // Paid in current month
          total: totalMonth, // Total in current month
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
        // Get default profit percent from database (matching StaffCSKHDetail logic)
        const { getDefaultProfitPercent } = await import('./cskhPaymentStatusService');
        let defaultProfitPercent = 10; // Default fallback
        try {
          const defaultProfit = await getDefaultProfitPercent(staffId);
          if (defaultProfit !== null && defaultProfit !== undefined) {
            defaultProfitPercent = defaultProfit;
          }
        } catch (error) {
          console.error('Failed to fetch default profit percent:', error);
        }

        // Parse month (YYYY-MM) to get start and end dates
        // Match backup logic: monthStart = new Date(selectedYear, selectedMonth - 1, 1)
        //                     monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59)
        const [year, monthNum] = validMonth.split('-').map(Number);
        const monthStart = new Date(year, monthNum - 1, 1); // First day of month, 00:00:00
        const monthEnd = new Date(year, monthNum, 0, 23, 59, 59); // Last day of month, 23:59:59

        // Format dates as YYYY-MM-DD for database query (Supabase date column is DATE type)
        // Use local date string to avoid timezone issues
        const monthStartStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
        const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
        const monthEndStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

        // Get students assigned to this CSKH staff (including date fields for filtering)
        // Match StaffCSKHDetail logic: check cskh_staff_id (database uses snake_case, not camelCase)
        const { data: students, error: studentsError } = await supabase
          .from('students')
          .select('id, cskh_staff_id, cskh_assigned_date, cskh_unassigned_date')
          .eq('cskh_staff_id', staffId);

        if (studentsError) {
          console.error('[getStaffWorkItems] CSKH: Failed to fetch CSKH students:', studentsError);
        } else {
        }

        // Get student_classes to check which students have classes (matching backup logic)
        const { data: studentClasses, error: studentClassesError } = await supabase
          .from('student_classes')
          .select('student_id, class_id')
          .eq('status', 'active');

        if (studentClassesError) {
          console.error('Failed to fetch student classes:', studentClassesError);
        }

        // Create a map of student_id -> class_ids
        const studentClassMap = new Map<string, string[]>();
        (studentClasses || []).forEach((sc: any) => {
          const studentId = sc.student_id;
          if (!studentClassMap.has(studentId)) {
            studentClassMap.set(studentId, []);
          }
          studentClassMap.get(studentId)!.push(sc.class_id);
        });

        // Get sessions in the month to check activity (matching backup logic)
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id, class_id, date')
          .gte('date', monthStartStr)
          .lte('date', monthEndStr);

        if (sessionsError) {
          console.error('Failed to fetch sessions:', sessionsError);
        }

        // Get attendance to check student activity (matching backup logic)
        const sessionIds = (sessions || []).map((s: any) => s.id);
        const { data: attendance, error: attendanceError } = sessionIds.length > 0
          ? await supabase
            .from('attendance')
            .select('session_id, student_id')
            .in('session_id', sessionIds)
          : { data: [], error: null };

        if (attendanceError) {
          console.error('Failed to fetch attendance:', attendanceError);
        }

        // Create sets for quick lookup
        const studentsWithClasses = new Set(Array.from(studentClassMap.keys()));
        const sessionClassMap = new Map<string, string>(); // session_id -> class_id
        (sessions || []).forEach((s: any) => {
          sessionClassMap.set(s.id, s.class_id);
        });
        const studentSessions = new Set<string>(); // student_id
        (attendance || []).forEach((att: any) => {
          const classId = sessionClassMap.get(att.session_id);
          if (classId) {
            const studentClassIds = studentClassMap.get(att.student_id) || [];
            if (studentClassIds.includes(classId)) {
              studentSessions.add(att.student_id);
            }
          }
        });

        // Filter students: Simplified logic to match getCSKHDetailData
        // Show ALL students with cskh_staff_id matching and have classes
        const assignedStudentIds = (students || [])
          .filter((s: any) => {
            // Check if student is currently assigned (already filtered by query, but double-check)
            if (s.cskh_staff_id !== staffId) {
              return false;
            }

            // Check if student has any classes
            const classIds = studentClassMap.get(s.id) || [];
            if (classIds.length === 0) {
              return false;
            }

            // Include the student - they are assigned and have classes
            // (Matching simplified logic in getCSKHDetailData)
            return true;
          })
          .map((s: any) => s.id);


        if (assignedStudentIds.length === 0) {
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

        // Get wallet transactions (topup) for assigned students in the month ONLY
        // Only count transactions within the selected month, not previous months
        const { data: transactions, error: transactionsError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .in('student_id', assignedStudentIds)
          .eq('type', 'topup')
          .gte('date', monthStartStr)
          .lte('date', monthEndStr);


        if (transactionsError) {
          console.error('Failed to fetch wallet transactions:', transactionsError);
        }

        // Double-check: Filter out any transactions that are outside the month (safety check)
        // Match backup logic: txDate >= monthStart && txDate <= monthEnd (using Date objects)
        const filteredTransactions = (transactions || []).filter((tx: any) => {
          if (!tx.date) return false;

          // Parse transaction date (should be YYYY-MM-DD format from database)
          const txDate = new Date(tx.date);
          if (isNaN(txDate.getTime())) {
            console.warn(`[getStaffWorkItems] CSKH: WARNING: Transaction ${tx.id} has invalid date: ${tx.date}`);
            return false;
          }

          // Compare using Date objects (matching backup logic)
          const isValid = txDate >= monthStart && txDate <= monthEnd;

          if (!isValid) {
            const txMonth = tx.date.slice(0, 7); // Extract YYYY-MM for logging
            console.warn(`[getStaffWorkItems] CSKH: WARNING: Transaction ${tx.id} has date ${tx.date} (parsed: ${txDate.toISOString()}, month: ${txMonth}) which is outside selected month ${validMonth} (${monthStart.toISOString()} to ${monthEnd.toISOString()})`);
          }
          return isValid;
        });

        if (filteredTransactions.length !== (transactions || []).length) {
          console.warn(`[getStaffWorkItems] CSKH: Filtered out ${(transactions || []).length - filteredTransactions.length} transactions outside month ${validMonth}`);
        }

        // Use filtered transactions instead of raw transactions
        const transactionsToUse = filteredTransactions;

        // Get payment status from database using service (matching StaffCSKHDetail logic)
        const { getCSKHPaymentStatuses } = await import('./cskhPaymentStatusService');

        // Get payment statuses for CURRENT MONTH (for paid/total display)
        let paymentStatusesCurrentMonth: any[] = [];
        try {
          paymentStatusesCurrentMonth = await getCSKHPaymentStatuses(staffId, validMonth);
          // Filter to only include assigned students
          paymentStatusesCurrentMonth = paymentStatusesCurrentMonth.filter((ps: any) => assignedStudentIds.includes(ps.student_id));
        } catch (error) {
          console.error('Failed to fetch payment statuses for current month:', error);
        }

        // Calculate previous month (for unpaid calculation: current month + previous month)
        let previousYear = year;
        let previousMonthNum = monthNum - 1;
        if (previousMonthNum === 0) {
          previousMonthNum = 12;
          previousYear = year - 1;
        }
        const previousMonth = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}`;
        const previousMonthStart = new Date(previousYear, previousMonthNum - 1, 1);
        const previousMonthEnd = new Date(previousYear, previousMonthNum, 0, 23, 59, 59);
        const previousMonthStartStr = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}-01`;
        const lastDayOfPreviousMonth = new Date(previousYear, previousMonthNum, 0).getDate();
        const previousMonthEndStr = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}-${String(lastDayOfPreviousMonth).padStart(2, '0')}`;

        // Get ALL payment statuses for PREVIOUS MONTH (to check which students are paid/unpaid)
        let allPaymentStatusesPreviousMonth: any[] = [];
        try {
          allPaymentStatusesPreviousMonth = await getCSKHPaymentStatuses(staffId, previousMonth);
          // Filter to only include assigned students
          allPaymentStatusesPreviousMonth = allPaymentStatusesPreviousMonth.filter(
            (ps: any) => assignedStudentIds.includes(ps.student_id)
          );
        } catch (error) {
          console.error('Failed to fetch payment statuses for previous month:', error);
        }

        // Filter to only get unpaid payment statuses from previous month
        const unpaidPaymentStatusesPreviousMonth = allPaymentStatusesPreviousMonth.filter(
          (ps: any) => ps.payment_status === 'unpaid'
        );

        // Get payment statuses for CURRENT MONTH with unpaid status (for unpaid calculation)
        const unpaidPaymentStatusesCurrentMonth = paymentStatusesCurrentMonth.filter(
          (ps: any) => ps.payment_status === 'unpaid'
        );

        // Create a map of student_id -> payment status and profit percent for CURRENT MONTH
        const paymentStatusMap = new Map<string, { status: string; profitPercent: number }>();
        paymentStatusesCurrentMonth.forEach((ps: any) => {
          paymentStatusMap.set(ps.student_id, {
            status: ps.payment_status || 'unpaid',
            profitPercent: Number(ps.profit_percent) || defaultProfitPercent,
          });
        });

        // Group transactions by student and calculate totalPaid for each student in CURRENT MONTH
        const studentTotalPaid = new Map<string, number>();
        transactionsToUse.forEach((tx: any) => {
          const studentId = tx.student_id;
          const amount = Number(tx.amount) || 0;
          const currentTotal = studentTotalPaid.get(studentId) || 0;
          studentTotalPaid.set(studentId, currentTotal + amount);
        });

        // Calculate UNPAID profit from PREVIOUS MONTH and CURRENT MONTH
        // "Chưa nhận" = tổng chưa thanh toán của tháng trước + tháng này

        // Step 1: Calculate unpaid from PREVIOUS MONTH
        // Only count students with status='unpaid' or no payment status record (NOT 'paid')
        let totalUnpaidPreviousMonth = 0;

        // 1a. From payment statuses with status='unpaid' in previous month
        for (const unpaidStatus of unpaidPaymentStatusesPreviousMonth) {
          const studentId = unpaidStatus.student_id;

          // Get transactions for this student in previous month
          const { data: previousMonthTransactions } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('student_id', studentId)
            .eq('type', 'topup')
            .gte('date', previousMonthStartStr)
            .lte('date', previousMonthEndStr);

          // Calculate totalPaid for this student in previous month
          const previousMonthTotalPaid = (previousMonthTransactions || []).reduce((sum: number, tx: any) => {
            return sum + (Number(tx.amount) || 0);
          }, 0);

          // Calculate profit for this student in previous month
          const profitPercent = Number(unpaidStatus.profit_percent) || defaultProfitPercent;
          const profit = previousMonthTotalPaid * (profitPercent / 100);

          totalUnpaidPreviousMonth += profit;
        }

        // 1b. From students with transactions in previous month but NO payment status record (unpaid by default)
        // IMPORTANT: Skip students who have payment status='paid' in previous month
        for (const studentId of assignedStudentIds) {
          // Check if student has payment status record in previous month
          const paymentStatusInPreviousMonth = allPaymentStatusesPreviousMonth.find((ps: any) => ps.student_id === studentId);

          // Skip if has payment status record (whether paid or unpaid - already handled in 1a if unpaid)
          if (paymentStatusInPreviousMonth) {
            // If status is 'paid', skip (don't count in unpaid)
            // If status is 'unpaid', already counted in 1a, so skip
            continue;
          }

          // Get transactions for this student in previous month
          const { data: previousMonthTransactions } = await supabase
            .from('wallet_transactions')
            .select('*')
            .eq('student_id', studentId)
            .eq('type', 'topup')
            .gte('date', previousMonthStartStr)
            .lte('date', previousMonthEndStr);

          // Calculate totalPaid for this student in previous month
          const previousMonthTotalPaid = (previousMonthTransactions || []).reduce((sum: number, tx: any) => {
            return sum + (Number(tx.amount) || 0);
          }, 0);

          if (previousMonthTotalPaid > 0) {
            // Student has transactions in previous month but no payment status record = unpaid by default
            const profitPercent = defaultProfitPercent;
            const profit = previousMonthTotalPaid * (profitPercent / 100);
            totalUnpaidPreviousMonth += profit;
          }
        }

        // Calculate paid and total for CURRENT MONTH
        // Calculate profit for ALL assigned students in current month (based on transactions)
        // IMPORTANT: Calculate for ALL assigned students, even if they don't have payment status record
        const studentProfitsCurrentMonth = new Map<string, number>();
        assignedStudentIds.forEach((studentId) => {
          const totalPaid = studentTotalPaid.get(studentId) || 0;
          const paymentStatus = paymentStatusMap.get(studentId);
          const profitPercent = paymentStatus?.profitPercent || defaultProfitPercent;
          const profit = totalPaid * (profitPercent / 100);
          studentProfitsCurrentMonth.set(studentId, profit);
        });

        // Calculate paid profit in CURRENT MONTH (only students with status='paid')
        let totalPaid = 0;
        studentProfitsCurrentMonth.forEach((profit, studentId) => {
          const paymentStatus = paymentStatusMap.get(studentId);
          // If no payment status record, default to 'unpaid' (so not counted in paid)
          const status = paymentStatus?.status || 'unpaid';

          // Only count 'paid' status (NOT 'deposit' or 'unpaid')
          if (status === 'paid') {
            totalPaid += profit;
          }
        });

        // Calculate unpaid profit in CURRENT MONTH (only students with status='unpaid' or no status)
        let totalUnpaidCurrentMonth = 0;
        studentProfitsCurrentMonth.forEach((profit, studentId) => {
          const paymentStatus = paymentStatusMap.get(studentId);
          // If no payment status record, default to 'unpaid'
          const status = paymentStatus?.status || 'unpaid';

          // Only count 'unpaid' status (NOT 'deposit' or 'paid')
          if (status === 'unpaid') {
            totalUnpaidCurrentMonth += profit;
          }
        });

        // Step 2 & 3: Calculate total unpaid from PREVIOUS MONTH + CURRENT MONTH
        // "Chưa nhận" = tổng chưa thanh toán của tháng trước + tháng này
        const totalUnpaidTwoMonths = totalUnpaidPreviousMonth + totalUnpaidCurrentMonth;

        // "Tổng tháng" = totalPaid + totalUnpaidCurrentMonth (all profit in current month)
        // This includes ALL assigned students with transactions in current month
        const totalReceived = totalPaid + totalUnpaidCurrentMonth;

        // "Chưa nhận" = totalUnpaidTwoMonths (unpaid in previous month + current month)
        // "Đã nhận" = totalPaid (paid in current month)

        workItems.push({
          name: 'CSKH & SALE',
          type: 'cskh_sale',
          unpaid: totalUnpaidTwoMonths, // Total unpaid from previous month + current month
          paid: totalPaid, // Paid in current month
          total: totalReceived, // Total in current month (paid + unpaid in current month)
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
 * Get bonuses statistics for a staff member
 * Returns: { totalMonth, paid, unpaid }
 * - totalMonth: Tổng số tiền thưởng trong tháng (tất cả status: paid, unpaid, deposit)
 * - paid: Tổng số tiền đã nhận trong tháng (chỉ status='paid')
 * - unpaid: Tổng số tiền chưa thanh toán tháng này + tháng trước (chỉ status='unpaid')
 */
export async function getStaffBonusesStatistics(staffId: string, month: string) {
  const { getBonuses } = await import('./bonusesService');

  // Calculate previous month (for unpaid calculation: current month + previous month)
  const [year, monthNum] = month.split('-').map(Number);
  let previousYear = year;
  let previousMonthNum = monthNum - 1;
  if (previousMonthNum === 0) {
    previousMonthNum = 12;
    previousYear = year - 1;
  }
  const previousMonth = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}`;

  // Get bonuses for current month
  const currentMonthBonuses = await getBonuses({ staffId, month });

  // Get bonuses for previous month (to calculate unpaid from previous month)
  const previousMonthBonuses = await getBonuses({ staffId, month: previousMonth });

  // Tổng tháng: tổng số tiền thưởng trong tháng (tất cả status: paid, unpaid, deposit)
  const totalMonth = currentMonthBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Đã nhận: tổng số tiền đã nhận trong tháng (chỉ status='paid')
  const paid = currentMonthBonuses
    .filter((b) => (b.status || 'unpaid') === 'paid')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  // Chưa nhận: tổng số tiền chưa thanh toán tháng này + tháng trước (chỉ status='unpaid')
  const unpaidFromPreviousMonth = previousMonthBonuses
    .filter((b) => (b.status || 'unpaid') === 'unpaid')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const unpaidFromCurrentMonth = currentMonthBonuses
    .filter((b) => (b.status || 'unpaid') === 'unpaid')
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const unpaid = unpaidFromPreviousMonth + unpaidFromCurrentMonth;

  return {
    totalMonth,
    paid,
    unpaid,
  };
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

/**
 * Get CSKH detail data with all calculations done in backend
 * Returns assigned students with their stats (totalPaid, profitPercent, profit, paymentStatus)
 * and totals (totalUnpaidProfit, totalPaidProfit, totalPaidAll, totalProfitAll)
 */
export async function getCSKHDetailData(staffId: string, month: string) {
  // Get default profit percent from database
  const { getDefaultProfitPercent } = await import('./cskhPaymentStatusService');
  let defaultProfitPercent = 10; // Default fallback
  try {
    const defaultProfit = await getDefaultProfitPercent(staffId);
    if (defaultProfit !== null && defaultProfit !== undefined) {
      defaultProfitPercent = defaultProfit;
    }
  } catch (error) {
    console.error('Failed to fetch default profit percent:', error);
  }

  // Parse month (YYYY-MM) to get start and end dates
  // monthStart: ngày 1 của tháng (00:00:00)
  // monthEnd: ngày cuối cùng của tháng (23:59:59)
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999); // Ngày 0 của tháng sau = ngày cuối của tháng hiện tại

  // Format dates as YYYY-MM-DD for database query (using local timezone, not UTC)
  // Important: Use local date to avoid timezone issues
  const monthStartStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
  const monthEndStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Get students assigned to this CSKH staff (including date fields for filtering)
  // Database uses snake_case: cskh_staff_id (not camelCase: cskhStaffId)
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, full_name, birth_year, province, cskh_staff_id, cskh_assigned_date, cskh_unassigned_date')
    .eq('cskh_staff_id', staffId);

  if (studentsError) {
    console.error('Failed to fetch CSKH students:', studentsError);
  }

  // Get student_classes to check which students have classes (matching backup logic)
  const { data: studentClasses, error: studentClassesError } = await supabase
    .from('student_classes')
    .select('student_id, class_id')
    .eq('status', 'active');

  if (studentClassesError) {
    console.error('Failed to fetch student classes:', studentClassesError);
  }

  // Create a map of student_id -> class_ids
  const studentClassMap = new Map<string, string[]>();
  (studentClasses || []).forEach((sc: any) => {
    const studentId = sc.student_id;
    if (!studentClassMap.has(studentId)) {
      studentClassMap.set(studentId, []);
    }
    studentClassMap.get(studentId)!.push(sc.class_id);
  });

  // Get sessions in the month to check activity (matching backup logic)
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, class_id, date')
    .gte('date', monthStart.toISOString().split('T')[0])
    .lte('date', monthEnd.toISOString().split('T')[0]);

  if (sessionsError) {
    console.error('Failed to fetch sessions:', sessionsError);
  }

  // Get attendance to check student activity (matching backup logic)
  const sessionIds = (sessions || []).map((s: any) => s.id);
  const { data: attendance, error: attendanceError } = sessionIds.length > 0
    ? await supabase
      .from('attendance')
      .select('session_id, student_id')
      .in('session_id', sessionIds)
    : { data: [], error: null };

  if (attendanceError) {
    console.error('Failed to fetch attendance:', attendanceError);
  }

  // Create sets for quick lookup (matching backup logic exactly)
  // Backup checks: monthSessions.length > 0 || monthAttendance.length > 0
  // So we need to check if student has sessions in their classes OR has attendance

  // Map: student_id -> has sessions in their classes this month
  const studentHasSessions = new Set<string>();
  (sessions || []).forEach((s: any) => {
    const classId = s.class_id;
    // Check if any student has this class
    studentClassMap.forEach((classIds, studentId) => {
      if (classIds.includes(classId)) {
        studentHasSessions.add(studentId);
      }
    });
  });

  // Map: student_id -> has attendance this month
  const studentHasAttendance = new Set<string>();
  const sessionClassMap = new Map<string, string>(); // session_id -> class_id
  (sessions || []).forEach((s: any) => {
    sessionClassMap.set(s.id, s.class_id);
  });
  (attendance || []).forEach((att: any) => {
    const classId = sessionClassMap.get(att.session_id);
    if (classId) {
      const studentClassIds = studentClassMap.get(att.student_id) || [];
      if (studentClassIds.includes(classId)) {
        studentHasAttendance.add(att.student_id);
      }
    }
  });

  // Filter students: Very simple logic - show ALL students with cskh_staff_id matching and have classes
  // This matches backup behavior where all assigned students are shown
  // TEMPORARY: For debugging, show ALL students with cskh_staff_id matching, even without classes
  const assignedStudents = (students || []).filter((s: any) => {
    // Check if student is assigned to this staff (already filtered by query, but double-check)
    if (s.cskh_staff_id !== staffId) {
      return false;
    }

    // Check if student has any classes
    const classIds = studentClassMap.get(s.id) || [];

    // Include the student - they are assigned (and optionally have classes)
    return true;
  });

  if (assignedStudents.length === 0) {
    return {
      students: [],
      defaultProfitPercent,
      totals: {
        totalUnpaidProfit: 0,
        totalPaidProfit: 0,
        totalPaidAll: 0,
        totalProfitAll: 0,
      },
    };
  }

  const assignedStudentIds = assignedStudents.map((s: any) => s.id);

  // Get wallet transactions (topup) for assigned students in the month ONLY
  // Only count transactions within the selected month, not previous months
  // IMPORTANT: Only transactions with date between monthStartStr and monthEndStr (inclusive)
  // Filter by date range to ensure only transactions in the selected month are included
  const { data: transactions, error: transactionsError } = await supabase
    .from('wallet_transactions')
    .select('*')
    .in('student_id', assignedStudentIds)
    .eq('type', 'topup')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr);


  // Double-check: Filter out any transactions that are outside the month (safety check)
  // Match backup logic: txDate >= monthStart && txDate <= monthEnd (using Date objects)
  const filteredTransactions = (transactions || []).filter((tx: any) => {
    if (!tx.date) return false;

    // Parse transaction date (should be YYYY-MM-DD format from database)
    const txDate = new Date(tx.date);
    if (isNaN(txDate.getTime())) {
      console.warn(`[getCSKHDetailData] WARNING: Transaction ${tx.id} has invalid date: ${tx.date}`);
      return false;
    }

    // Compare using Date objects (matching backup logic)
    const isValid = txDate >= monthStart && txDate <= monthEnd;

    if (!isValid) {
      const txMonth = tx.date.slice(0, 7); // Extract YYYY-MM for logging
      console.warn(`[getCSKHDetailData] WARNING: Transaction ${tx.id} has date ${tx.date} (parsed: ${txDate.toISOString()}, month: ${txMonth}) which is outside selected month ${month} (${monthStart.toISOString()} to ${monthEnd.toISOString()})`);
    }
    return isValid;
  });

  if (filteredTransactions.length !== (transactions || []).length) {
    console.warn(`[getCSKHDetailData] Filtered out ${(transactions || []).length - filteredTransactions.length} transactions outside month ${month}`);
  }


  // Use filtered transactions instead of raw transactions
  const transactionsToUse = filteredTransactions;

  if (transactionsError) {
    console.error('Failed to fetch wallet transactions:', transactionsError);
  }

  // Get payment statuses from database
  const { getCSKHPaymentStatuses } = await import('./cskhPaymentStatusService');
  let paymentStatuses: any[] = [];
  try {
    paymentStatuses = await getCSKHPaymentStatuses(staffId, month);
    // Filter to only include assigned students
    paymentStatuses = paymentStatuses.filter((ps: any) => assignedStudentIds.includes(ps.student_id));
  } catch (error) {
    console.error('Failed to fetch payment statuses:', error);
  }

  // Create maps for payment status and profit percent
  const paymentStatusMap = new Map<string, { status: string; profitPercent: number }>();
  paymentStatuses.forEach((ps: any) => {
    paymentStatusMap.set(ps.student_id, {
      status: ps.payment_status || 'unpaid',
      profitPercent: Number(ps.profit_percent) || defaultProfitPercent,
    });
  });

  // Group transactions by student and calculate totalPaid for each student
  // Use filtered transactions to ensure only transactions in the selected month are counted
  const studentTotalPaid = new Map<string, number>();
  transactionsToUse.forEach((tx: any) => {
    const studentId = tx.student_id;
    const amount = Number(tx.amount) || 0;
    const currentTotal = studentTotalPaid.get(studentId) || 0;
    studentTotalPaid.set(studentId, currentTotal + amount);
  });

  // Calculate stats for each assigned student
  const studentStats = assignedStudents.map((student: any) => {
    const totalPaid = studentTotalPaid.get(student.id) || 0;
    const paymentStatus = paymentStatusMap.get(student.id);
    const profitPercent = paymentStatus?.profitPercent || defaultProfitPercent;
    const profit = totalPaid * (profitPercent / 100);
    const paymentStatusValue = paymentStatus?.status || 'unpaid';

    return {
      student: {
        id: student.id,
        fullName: student.full_name,
        birthYear: student.birth_year,
        province: student.province,
        classIds: studentClassMap.get(student.id) || [],
      },
      totalPaid,
      profitPercent,
      profit,
      paymentStatus: paymentStatusValue,
    };
  });

  // Calculate totals
  const totalUnpaidProfit = studentStats
    .filter((s) => s.paymentStatus === 'unpaid')
    .reduce((sum, s) => sum + s.profit, 0);

  const totalPaidProfit = studentStats
    .filter((s) => s.paymentStatus === 'paid')
    .reduce((sum, s) => sum + s.profit, 0);

  const totalPaidAll = studentStats.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalProfitAll = studentStats.reduce((sum, s) => sum + s.profit, 0);

  return {
    students: studentStats,
    defaultProfitPercent,
    totals: {
      totalUnpaidProfit,
      totalPaidProfit,
      totalPaidAll,
      totalProfitAll,
    },
  };
}

/**
 * Get session allowance amount
 * Priority: allowance_amount from database > calculated from coefficient/duration
 */
function getSessionAllowance(session: any, classTuitionPerSession: number = 0): number {
  // Priority: use allowance_amount if available
  if (session.allowance_amount != null && session.allowance_amount !== undefined) {
    return Number(session.allowance_amount) || 0;
  }

  // Calculate from coefficient and duration if available
  const duration = Number(session.duration) || 2.0;
  const coefficient = Number(session.coefficient) || 1.0;
  const baseAmount = classTuitionPerSession || 0;

  return baseAmount * duration * coefficient;
}

/**
 * Get staff detail data with all calculations done in backend
 * Returns teacher class stats, income stats, and session stats
 */
export async function getStaffDetailData(staffId: string, month: string) {
  // Get staff
  const staff = await getStaffById(staffId);
  if (!staff) {
    throw new Error('Staff not found');
  }

  // Try to get cached stats first
  const cachedStats = await getStaffMonthlyStats(staffId, month);

  // Parse month (YYYY-MM)
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1);
  const monthEnd = new Date(year, monthNum, 0, 23, 59, 59);

  // Calculate previous month (for unpaid calculation: current month + previous month)
  // Handle case when current month is January (previous month is December of previous year)
  let previousYear = year;
  let previousMonthNum = monthNum - 1;
  if (previousMonthNum === 0) {
    previousMonthNum = 12;
    previousYear = year - 1;
  }

  const previousMonthStart = new Date(previousYear, previousMonthNum - 1, 1); // First day of previous month
  const previousMonthEnd = new Date(previousYear, previousMonthNum, 0, 23, 59, 59); // Last day of previous month

  // Format dates as YYYY-MM-DD for database query
  const previousMonthStartStr = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}-01`;
  const lastDayOfPreviousMonth = new Date(previousYear, previousMonthNum, 0).getDate();
  const previousMonthEndStr = `${previousYear}-${String(previousMonthNum).padStart(2, '0')}-${String(lastDayOfPreviousMonth).padStart(2, '0')}`;

  const monthStartStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(year, monthNum, 0).getDate();
  const monthEndStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // TỐI GIẢN: Chỉ fetch classes liên quan đến teacher này (dùng denormalized columns)
  // 1. Fetch teacher với denormalized class IDs
  // 2. Chỉ fetch classes có trong active_class_ids + taught_class_ids
  // 3. Không cần fetch tất cả classes rồi filter

  // Step 1: Fetch teacher với denormalized columns (NHANH NHẤT)
  const { data: teacherData, error: teacherError } = await supabase
    .from('teachers')
    .select('id, active_class_ids, taught_class_ids')
    .eq('id', staffId)
    .single();

  if (teacherError) {
    console.error('Failed to fetch teacher:', teacherError);
  }

  // Step 2: Parse class IDs từ denormalized columns (NHANH - không cần query)
  const activeClassIds: string[] = [];
  const taughtClassIds: string[] = [];

  if (teacherData) {
    // Parse active_class_ids
    if (teacherData.active_class_ids) {
      if (Array.isArray(teacherData.active_class_ids)) {
        activeClassIds.push(...teacherData.active_class_ids.filter(Boolean));
      } else if (typeof teacherData.active_class_ids === 'string') {
        try {
          const parsed = JSON.parse(teacherData.active_class_ids);
          if (Array.isArray(parsed)) {
            activeClassIds.push(...parsed.filter(Boolean));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Parse taught_class_ids
    if (teacherData.taught_class_ids) {
      if (Array.isArray(teacherData.taught_class_ids)) {
        taughtClassIds.push(...teacherData.taught_class_ids.filter(Boolean));
      } else if (typeof teacherData.taught_class_ids === 'string') {
        try {
          const parsed = JSON.parse(teacherData.taught_class_ids);
          if (Array.isArray(parsed)) {
            taughtClassIds.push(...parsed.filter(Boolean));
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  // Step 3: Combine tất cả class IDs cần fetch (chỉ những lớp liên quan)
  const allRelevantClassIds = new Set<string>();
  activeClassIds.forEach(id => allRelevantClassIds.add(id));
  taughtClassIds.forEach(id => allRelevantClassIds.add(id));

  // FALLBACK: If denormalized columns are empty (migration not applied), 
  // query class_teachers and sessions tables directly
  if (allRelevantClassIds.size === 0) {
    console.warn('[getStaffDetailData] Denormalized columns empty, falling back to class_teachers query');

    // Get active classes from class_teachers
    const { data: classTeachersData } = await supabase
      .from('class_teachers')
      .select('class_id')
      .eq('teacher_id', staffId);

    if (classTeachersData) {
      classTeachersData.forEach((ct: any) => {
        allRelevantClassIds.add(ct.class_id);
        activeClassIds.push(ct.class_id);
      });
    }

    // Get taught classes from sessions
    const { data: sessionClassData } = await supabase
      .from('sessions')
      .select('class_id')
      .eq('teacher_id', staffId);

    if (sessionClassData) {
      sessionClassData.forEach((s: any) => {
        allRelevantClassIds.add(s.class_id);
        if (!taughtClassIds.includes(s.class_id)) {
          taughtClassIds.push(s.class_id);
        }
      });
    }
  }

  // Step 4: Fetch CHỈ các classes liên quan (NHANH - không fetch tất cả)
  // Parallel fetch: classes + sessions + cache
  const [classesResult, sessionsResult, cachedStatsCheck] = await Promise.all([
    // Chỉ fetch classes có trong danh sách (NHANH HƠN NHIỀU)
    allRelevantClassIds.size > 0
      ? supabase
        .from('classes')
        .select('*')
        .in('id', Array.from(allRelevantClassIds))
      : Promise.resolve({ data: [], error: null }),
    // Fetch sessions (chỉ để tính toán thống kê, không dùng để filter classes)
    supabase
      .from('sessions')
      .select('class_id, date, payment_status, teacher_id, coefficient, allowance_amount, student_paid_count')
      .eq('teacher_id', staffId)
      .order('date', { ascending: false }),
    // Re-check cache in parallel
    getStaffMonthlyStats(staffId, month)
  ]);

  const { data: classesData, error: classesError } = classesResult;
  if (classesError) {
    console.error('Failed to fetch classes:', classesError);
  }

  const { data: sessionsData, error: sessionsError } = sessionsResult;
  if (sessionsError) {
    console.error('Failed to fetch sessions:', sessionsError);
  }

  // Step 5: Parse và map classes (đơn giản hơn nhiều)
  const classesList = ((classesData || []) as any[]).map((cls: any) => {
    // Parse teacher_ids từ denormalized column
    let teacherIds: string[] = [];
    if (cls.teacher_ids) {
      if (Array.isArray(cls.teacher_ids)) {
        teacherIds = cls.teacher_ids.filter(Boolean);
      } else if (typeof cls.teacher_ids === 'string') {
        try {
          const parsed = JSON.parse(cls.teacher_ids);
          teacherIds = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          teacherIds = [];
        }
      }
    }
    return {
      ...cls,
      teacher_ids: teacherIds,
      teacherIds: teacherIds, // camelCase for compatibility
    };
  });

  // Step 6: Đánh dấu status (ĐƠN GIẢN - chỉ check active_class_ids)
  const teacherClasses = classesList.map((cls: any) => {
    const isActive = activeClassIds.includes(cls.id);
    return { ...cls, isActive };
  });

  // Step 7: Sort - active classes trước
  teacherClasses.sort((a: any, b: any) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return 0;
  });

  // Sessions cho tính toán thống kê
  const sessions = (sessionsData || []).filter((s: any) => s.teacher_id === staffId);

  const classIds = teacherClasses.map((c: any) => c.id);

  // Use the cached stats from parallel fetch if available
  const finalCachedStats = cachedStatsCheck || cachedStats;

  // If we have cached stats, we can skip some calculations
  // But we still need work items and bonuses for teacherClassStats (if teacher)
  // For non-teacher, we can use cache completely if available
  let workItems: any[] = [];
  let totalMonthWorkItems = 0;
  let totalPaidWorkItems = 0;
  let totalUnpaidWorkItems = 0;
  let bonusesStatistics: any = { totalMonth: 0, paid: 0, unpaid: 0 };
  let totalMonthBonuses = 0;
  let totalPaidBonuses = 0;
  let totalUnpaidBonuses = 0;

  // If we have cache, use cached values for work items and bonuses
  if (finalCachedStats) {
    totalMonthWorkItems = finalCachedStats.work_items_total_month || 0;
    totalPaidWorkItems = finalCachedStats.work_items_total_paid || 0;
    totalUnpaidWorkItems = finalCachedStats.work_items_total_unpaid || 0;
    totalMonthBonuses = finalCachedStats.bonuses_total_month || 0;
    totalPaidBonuses = finalCachedStats.bonuses_total_paid || 0;
    totalUnpaidBonuses = finalCachedStats.bonuses_total_unpaid || 0;
  } else {
    // Only calculate if no cache
    // Get work items (bảng công việc) - áp dụng cho cả teacher và non-teacher
    workItems = await getStaffWorkItems(staffId, month);
    totalMonthWorkItems = workItems.reduce((sum, item) => sum + (item.total || 0), 0);
    totalPaidWorkItems = workItems.reduce((sum, item) => sum + (item.paid || 0), 0);
    totalUnpaidWorkItems = workItems.reduce((sum, item) => sum + (item.unpaid || 0), 0);

    // Get bonuses statistics (bảng thưởng) - áp dụng cho cả teacher và non-teacher
    bonusesStatistics = await getStaffBonusesStatistics(staffId, month);
    totalMonthBonuses = bonusesStatistics.totalMonth || 0;
    totalPaidBonuses = bonusesStatistics.paid || 0;
    totalUnpaidBonuses = bonusesStatistics.unpaid || 0;
  }

  // Calculate total paid in current year for non-teacher (work items + bonuses only)
  // Query bonuses directly from database
  const { data: bonusesInYearNonTeacher, error: bonusesErrorNonTeacher } = await supabase
    .from('bonuses')
    .select('amount')
    .eq('staff_id', staffId)
    .eq('status', 'paid')
    .like('month', `${year}-%`);

  const totalPaidBonusesInYearNonTeacher = bonusesErrorNonTeacher
    ? 0
    : (bonusesInYearNonTeacher || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  let totalPaidWorkItemsInYearNonTeacher = 0;
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    try {
      const monthWorkItems = await getStaffWorkItems(staffId, monthStr);
      const monthPaid = monthWorkItems.reduce((sum, item) => sum + (item.paid || 0), 0);
      totalPaidWorkItemsInYearNonTeacher += monthPaid;
    } catch (error) {
      // Silently continue if one month fails
    }
  }

  if (classIds.length === 0) {
    // Non-teacher: chỉ tính từ work items và bonuses
    // Try to get cached stats first
    const cachedStatsNonTeacher = await getStaffMonthlyStats(staffId, month);

    let totalMonthAllNonTeacher: number;
    let totalPaidAllNonTeacher: number;
    let totalUnpaidAllNonTeacher: number;
    let totalPaidAllTimeNonTeacher: number;

    if (cachedStatsNonTeacher) {
      // Use cached values
      totalMonthAllNonTeacher = cachedStatsNonTeacher.total_month_all;
      totalPaidAllNonTeacher = cachedStatsNonTeacher.total_paid_all;
      totalUnpaidAllNonTeacher = cachedStatsNonTeacher.total_unpaid_all;
      totalPaidAllTimeNonTeacher = cachedStatsNonTeacher.total_paid_all_time;
    } else {
      // Calculate and cache
      totalMonthAllNonTeacher = totalMonthWorkItems + totalMonthBonuses;
      totalPaidAllNonTeacher = totalPaidWorkItems + totalPaidBonuses;
      totalUnpaidAllNonTeacher = totalUnpaidWorkItems + totalUnpaidBonuses;
      totalPaidAllTimeNonTeacher = totalPaidWorkItemsInYearNonTeacher + totalPaidBonusesInYearNonTeacher;

      // Save to cache
      await saveStaffMonthlyStats(staffId, month, {
        classes_total_month: 0,
        classes_total_paid: 0,
        classes_total_unpaid: 0,
        work_items_total_month: totalMonthWorkItems,
        work_items_total_paid: totalPaidWorkItems,
        work_items_total_unpaid: totalUnpaidWorkItems,
        bonuses_total_month: totalMonthBonuses,
        bonuses_total_paid: totalPaidBonuses,
        bonuses_total_unpaid: totalUnpaidBonuses,
        total_month_all: totalMonthAllNonTeacher,
        total_paid_all: totalPaidAllNonTeacher,
        total_unpaid_all: totalUnpaidAllNonTeacher,
        total_paid_all_time: totalPaidAllTimeNonTeacher,
      });
    }

    return {
      teacherClassStats: [],
      incomeStats: {
        totalMonthAllClasses: totalMonthAllNonTeacher,
        totalPaidByStatus: totalPaidAllNonTeacher,
        totalUnpaidByStatus: totalUnpaidAllNonTeacher,
        totalPaidAllTime: totalPaidAllTimeNonTeacher,
        totalDepositAllTime: 0,
      },
      sessionStats: {
        total: 0,
        paid: 0,
        unpaid: 0,
        totalAllowance: 0,
        paidAllowance: 0,
      },
    };
  }

  // Use classes and sessions already fetched above (giống backup: tính toán từ data đã có)
  // Giống backup: teacherClassStats = teacherClasses.map(cls => { ... })
  const teacherClassStats = teacherClasses.map((cls: any) => {
    // Get sessions for this class (giống backup: const classSessions = sessions.filter(s => s.classId === cls.id))
    const classSessions = sessions.filter((s: any) => s.class_id === cls.id);

    // Filter sessions in selected month (giống backup: const monthSessions = classSessions.filter(session => (session.date || '').slice(0, 7) === month))
    const monthSessions = classSessions.filter((session: any) => {
      if (!session.date) return false;
      return session.date.slice(0, 7) === month;
    });

    // Get allowance (giống backup: const allowances = cls.customTeacherAllowances || {}; const baseAllowance = allowances[staffId] ?? (cls.tuitionPerSession || 0))
    const allowances = cls.custom_teacher_allowances || {};
    const baseAllowance = allowances[staffId] ?? (Number(cls.tuition_per_session) || 0);

    // Calculate totals for month (giống backup: const totalMonth = monthSessions.reduce((sum, session) => { const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0; return sum + allowanceAmount; }, 0))
    const totalMonth = monthSessions.reduce((sum: number, session: any) => {
      const allowanceAmount = session.allowance_amount ?? getSessionAllowance(session, baseAllowance) ?? 0;
      return sum + allowanceAmount;
    }, 0);

    // Calculate total paid (giống backup: const totalPaid = monthSessions.filter(s => (s.paymentStatus || 'unpaid') === 'paid').reduce(...))
    const totalPaid = monthSessions
      .filter((s: any) => (s.payment_status || 'unpaid') === 'paid')
      .reduce((sum: number, session: any) => {
        const allowanceAmount = session.allowance_amount ?? getSessionAllowance(session, baseAllowance) ?? 0;
        return sum + allowanceAmount;
      }, 0);

    // Calculate total unpaid (giống backup: const totalUnpaid = classSessions.filter(s => (s.paymentStatus || 'unpaid') === 'unpaid').reduce(...))
    const totalUnpaid = classSessions
      .filter((s: any) => (s.payment_status || 'unpaid') === 'unpaid')
      .reduce((sum: number, session: any) => {
        const allowanceAmount = session.allowance_amount ?? getSessionAllowance(session, baseAllowance) ?? 0;
        return sum + allowanceAmount;
      }, 0);

    // isActive đã được set ở trên khi map classesWithStatus
    return {
      class: {
        id: cls.id,
        name: cls.name,
        status: cls.status,
      },
      totalMonth,
      totalPaid,
      totalUnpaid,
      monthSessionsCount: monthSessions.length,
      isActive: cls.isActive, // Đã được set ở trên
    };
  });

  // Calculate income stats from classes (bảng các lớp dạy) - chỉ cho teacher
  const totalMonthAllClasses = teacherClassStats.reduce((sum, stat) => sum + stat.totalMonth, 0);
  const totalPaidByStatus = teacherClassStats.reduce((sum, stat) => sum + stat.totalPaid, 0);
  const totalUnpaidByStatus = teacherClassStats.reduce((sum, stat) => sum + stat.totalUnpaid, 0);

  // Use cached values if available, otherwise calculate
  let totalMonthAll: number;
  let totalPaidAll: number;
  let totalUnpaidAll: number;
  let totalPaidAllTime: number;

  // Use finalCachedStats (from parallel fetch) if available
  const statsToUse = finalCachedStats || cachedStats;
  if (statsToUse) {
    // Use cached aggregated values
    totalMonthAll = statsToUse.total_month_all;
    totalPaidAll = statsToUse.total_paid_all;
    totalUnpaidAll = statsToUse.total_unpaid_all;
    totalPaidAllTime = statsToUse.total_paid_all_time;
  } else {
    // Calculate and cache
    // Tổng hợp từ tất cả các bảng:
    // Tổng trợ cấp tháng = tổng tháng bảng các lớp dạy + tổng tháng bảng công việc + tổng tháng bảng thưởng
    totalMonthAll = totalMonthAllClasses + totalMonthWorkItems + totalMonthBonuses;

    // Đã thanh toán = tổng đã nhận các bảng
    totalPaidAll = totalPaidByStatus + totalPaidWorkItems + totalPaidBonuses;

    // Chưa thanh toán = tổng chưa nhận ở các bảng
    totalUnpaidAll = totalUnpaidByStatus + totalUnpaidWorkItems + totalUnpaidBonuses;

    // Total paid in current year from sessions (tổng nhận từ trước = tổng tất cả trong năm hiện tại)
    const currentYear = year;
    const yearStart = new Date(currentYear, 0, 1); // January 1st of current year
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of current year

    // Total paid from sessions in current year
    const totalPaidSessionsInYear = sessions
      .filter((s: any) => {
        if (!s.date || s.payment_status !== 'paid') return false;
        const sessionDate = new Date(s.date);
        return sessionDate >= yearStart && sessionDate <= yearEnd;
      })
      .reduce((sum: number, s: any) => {
        const cls = teacherClasses.find((c: any) => c.id === s.class_id);
        const classTuition = cls ? (Number(cls.tuition_per_session) || 0) : 0;
        const customAllowances = cls ? ((cls.custom_teacher_allowances as Record<string, number>) || {}) : {};
        const teacherAllowance = customAllowances[staffId] ?? classTuition;
        return sum + getSessionAllowance(s, teacherAllowance);
      }, 0);

    // Total paid from bonuses in current year - query directly from database
    const { data: bonusesInYear, error: bonusesError } = await supabase
      .from('bonuses')
      .select('amount')
      .eq('staff_id', staffId)
      .eq('status', 'paid')
      .like('month', `${currentYear}-%`);

    const totalPaidBonusesInYear = bonusesError
      ? 0
      : (bonusesInYear || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    // Total paid from work items in current year
    // Note: Work items calculation is complex (CSKH, Lesson Plan, etc.), so we need to call getStaffWorkItems
    // But we can optimize by batching or caching if needed
    let totalPaidWorkItemsInYear = 0;
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${currentYear}-${String(m).padStart(2, '0')}`;
      try {
        const monthWorkItems = await getStaffWorkItems(staffId, monthStr);
        const monthPaid = monthWorkItems.reduce((sum, item) => sum + (item.paid || 0), 0);
        totalPaidWorkItemsInYear += monthPaid;
      } catch (error) {
        // Silently continue if one month fails
      }
    }

    // Tổng nhận từ trước = tổng tất cả trong năm hiện tại
    totalPaidAllTime = totalPaidSessionsInYear + totalPaidWorkItemsInYear + totalPaidBonusesInYear;

    // Save to cache for future use
    await saveStaffMonthlyStats(staffId, month, {
      classes_total_month: totalMonthAllClasses,
      classes_total_paid: totalPaidByStatus,
      classes_total_unpaid: totalUnpaidByStatus,
      work_items_total_month: totalMonthWorkItems,
      work_items_total_paid: totalPaidWorkItems,
      work_items_total_unpaid: totalUnpaidWorkItems,
      bonuses_total_month: totalMonthBonuses,
      bonuses_total_paid: totalPaidBonuses,
      bonuses_total_unpaid: totalUnpaidBonuses,
      total_month_all: totalMonthAll,
      total_paid_all: totalPaidAll,
      total_unpaid_all: totalUnpaidAll,
      total_paid_all_time: totalPaidAllTime,
    });
  }

  // Total deposit all time from sessions
  const totalDepositAllTime = sessions
    .filter((s: any) => s.payment_status === 'deposit')
    .reduce((sum: number, s: any) => {
      const cls = teacherClasses.find((c: any) => c.id === s.class_id);
      const classTuition = cls ? (Number(cls.tuition_per_session) || 0) : 0;
      const customAllowances = cls ? ((cls.custom_teacher_allowances as Record<string, number>) || {}) : {};
      const teacherAllowance = customAllowances[staffId] ?? classTuition;
      return sum + getSessionAllowance(s, teacherAllowance);
    }, 0);

  // Calculate session statistics (giống backup: tính từ sessions đã có)
  // Filter sessions in selected month for statistics
  const monthSessionsForStats = sessions.filter((s: any) => {
    if (!s.date) return false;
    return s.date.slice(0, 7) === month;
  });

  const totalAllowance = monthSessionsForStats.reduce((sum: number, s: any) => {
    const cls = teacherClasses.find((c: any) => c.id === s.class_id);
    const classTuition = cls ? (Number(cls.tuition_per_session) || 0) : 0;
    const customAllowances = cls ? ((cls.custom_teacher_allowances as Record<string, number>) || {}) : {};
    const teacherAllowance = customAllowances[staffId] ?? classTuition;
    return sum + getSessionAllowance(s, teacherAllowance);
  }, 0);

  const paidAllowance = monthSessionsForStats
    .filter((s: any) => s.payment_status === 'paid')
    .reduce((sum: number, s: any) => {
      const cls = teacherClasses.find((c: any) => c.id === s.class_id);
      const classTuition = cls ? (Number(cls.tuition_per_session) || 0) : 0;
      const customAllowances = cls ? ((cls.custom_teacher_allowances as Record<string, number>) || {}) : {};
      const teacherAllowance = customAllowances[staffId] ?? classTuition;
      return sum + getSessionAllowance(s, teacherAllowance);
    }, 0);

  return {
    teacherClassStats,
    incomeStats: {
      totalMonthAllClasses: totalMonthAll, // Tổng từ tất cả các bảng
      totalPaidByStatus: totalPaidAll, // Tổng đã nhận từ tất cả các bảng
      totalUnpaidByStatus: totalUnpaidAll, // Tổng chưa nhận từ tất cả các bảng
      totalPaidAllTime,
      totalDepositAllTime,
    },
    sessionStats: {
      total: monthSessionsForStats.length,
      paid: monthSessionsForStats.filter((s: any) => s.payment_status === 'paid').length,
      unpaid: monthSessionsForStats.filter((s: any) => s.payment_status === 'unpaid').length,
      totalAllowance,
      paidAllowance,
    },
  };
}

