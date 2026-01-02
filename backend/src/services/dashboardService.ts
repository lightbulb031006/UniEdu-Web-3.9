/**
 * Dashboard Service
 * Business logic for dashboard data aggregation
 */

import supabase from '../config/database';

// Cache TTL constants
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes for dashboard
const QUICK_VIEW_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for quick view

/**
 * Get cached data from database
 */
async function getCachedData<T>(cacheKey: string, cacheType: 'dashboard' | 'quickview'): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('dashboard_cache')
      .select('data, expires_at')
      .eq('cache_key', cacheKey)
      .eq('cache_type', cacheType)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      // Cache expired, delete it
      await supabase
        .from('dashboard_cache')
        .delete()
        .eq('cache_key', cacheKey);
      return null;
    }

    return data.data as T;
  } catch (error) {
    console.error('[Dashboard Cache] Error getting cached data:', error);
    return null;
  }
}

/**
 * Set cached data in database
 */
async function setCachedData<T>(cacheKey: string, cacheType: 'dashboard' | 'quickview', data: T, ttl: number): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttl);

    await supabase
      .from('dashboard_cache')
      .upsert({
        cache_key: cacheKey,
        cache_type: cacheType,
        data: data as any,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'cache_key',
      });
  } catch (error) {
    console.error('[Dashboard Cache] Error setting cached data:', error);
  }
}

/**
 * Cleanup expired cache entries (run periodically)
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const now = new Date().toISOString();
    await supabase
      .from('dashboard_cache')
      .delete()
      .lt('expires_at', now);
  } catch (error) {
    console.error('[Dashboard Cache] Error cleaning up expired cache:', error);
  }
}

/**
 * Invalidate dashboard cache for a specific date range
 * Used when wallet transactions are created/updated
 */
export async function invalidateDashboardCache(date: string): Promise<void> {
  try {
    // Parse date to get month, quarter, and year
    const transactionDate = new Date(date);
    const year = transactionDate.getFullYear();
    const month = transactionDate.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;
    
    // Invalidate cache for month
    const monthKey = `dashboard:month:${year}-${String(month).padStart(2, '0')}`;
    // Invalidate cache for quarter
    const quarterKey = `dashboard:quarter:${year}-Q${quarter}`;
    // Invalidate cache for year
    const yearKey = `dashboard:year:${year}`;
    
    // Delete all matching cache entries
    await Promise.all([
      supabase.from('dashboard_cache').delete().eq('cache_key', monthKey),
      supabase.from('dashboard_cache').delete().eq('cache_key', quarterKey),
      supabase.from('dashboard_cache').delete().eq('cache_key', yearKey),
    ]);
  } catch (error) {
    console.error('[Dashboard Cache] Error invalidating cache:', error);
  }
}

export interface DashboardParams {
  filterType: 'month' | 'quarter' | 'year';
  filterValue: string;
}

interface DateRange {
  start: Date;
  end: Date;
  label: string;
  shortLabel: string;
}

function parseFilterRange(filterType: 'month' | 'quarter' | 'year', filterValue: string): DateRange {
  if (filterType === 'quarter') {
    const match = filterValue.match(/^(\d{4})-Q([1-4])$/);
    const year = match ? Number(match[1]) : new Date().getFullYear();
    const quarter = match ? Number(match[2]) : 1;
    const monthIndex = (quarter - 1) * 3;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 3, 0, 23, 59, 59, 999);
    return {
      start,
      end,
      label: `Quý ${quarter} • ${year}`,
      shortLabel: `Q${quarter}/${String(year).slice(-2)}`,
    };
  }

  if (filterType === 'year') {
    const year = Number(filterValue) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return {
      start,
      end,
      label: `Năm ${year}`,
      shortLabel: `${year}`,
    };
  }

  // Month
  const match = filterValue.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const month = match ? Number(match[2]) - 1 : new Date().getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return {
    start,
    end,
    label: `Tháng ${String(month + 1).padStart(2, '0')} • ${year}`,
    shortLabel: `T${String(month + 1).padStart(2, '0')}/${String(year).slice(-2)}`,
  };
}

function isWithinRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date >= range.start && date <= range.end;
}

export async function getDashboardData(params: DashboardParams) {
  // Check cache first
  const cacheKey = `dashboard:${params.filterType}:${params.filterValue}`;
  const cached = await getCachedData(cacheKey, 'dashboard');
  if (cached) {
    return cached;
  }

  const range = parseFilterRange(params.filterType, params.filterValue);

  // Fetch all required data from Supabase
  const [
    classesResult,
    studentsResult,
    teachersResult,
    paymentsResult,
    sessionsResult,
    costsResult,
    walletTxResult,
    studentClassesResult,
    classTeachersResult,
    bonusesResult,
    lessonOutputsResult,
  ] = await Promise.all([
    supabase.from('classes').select('*'),
    supabase.from('students').select('*'),
    supabase.from('teachers').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('sessions').select('*'),
    supabase.from('costs').select('*'),
    supabase.from('wallet_transactions').select('*'),
    supabase.from('student_classes').select('*'),
    supabase.from('class_teachers').select('*'),
    supabase.from('bonuses').select('*'),
    supabase.from('lesson_outputs').select('*'),
  ]);

  const classes = classesResult.data || [];
  const students = studentsResult.data || [];
  const teachers = teachersResult.data || [];
  const payments = paymentsResult.data || [];
  const sessions = sessionsResult.data || [];
  const costs = costsResult.data || [];
  const walletTransactions = walletTxResult.data || [];
  const studentClasses = studentClassesResult.data || [];
  const classTeachers = classTeachersResult.data || [];
  const bonuses = bonusesResult.data || [];
  const lessonOutputs = lessonOutputsResult.data || [];

  // Calculate summary
  // Doanh thu: Tổng số tiền học sinh nạp vào tài khoản trong tháng (không tính tiền ứng)
  // Số dương = tăng doanh thu, số âm = giảm doanh thu
  const totalRevenue = walletTransactions
    .filter((tx: any) => {
      if (tx.type !== 'topup') return false; // Chỉ tính tiền nạp, không tính tiền ứng
      if (!isWithinRange(tx.date, range)) return false;
      const amount = Number(tx.amount) || 0;
      return amount !== 0; // Tính cả số dương (nạp) và số âm (trừ)
    })
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

  const outstandingTuition = students.reduce((sum: number, student: any) => {
    const loanBalance = Math.max(0, Number(student.loan_balance || student.loanBalance || 0));
    return sum + loanBalance;
  }, 0);

  // Calculate staff costs (giống backup)
  // - Gia sư: Tổng số tiền của tất cả các buổi dạy trong tháng
  const sessionsInRange = sessions.filter((session: any) => isWithinRange(session.date, range));
  const tutorCost = sessionsInRange.reduce((sum: number, session: any) => {
    const allowance = Number(session.allowance_amount || session.allowanceAmount || 0);
    return sum + allowance;
  }, 0);

  // - Giáo án: Tổng số tiền của tất cả các bài đã làm trong tháng
  const DEFAULT_LESSON_OUTPUT_ALLOWANCE = 50000;
  const lessonOutputsInRange = lessonOutputs.filter((output: any) => {
    if (output.date) {
      return isWithinRange(output.date, range);
    }
    // If no date, include it if we're looking at current month (legacy data)
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rangeMonthKey = `${range.start.getFullYear()}-${String(range.start.getMonth() + 1).padStart(2, '0')}`;
    return currentMonthKey === rangeMonthKey;
  });
  const lessonPlanCost = lessonOutputsInRange.reduce((sum: number, output: any) => {
    const amount = Number(output.amount || output.payment_amount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
    return sum + amount;
  }, 0);

  // - SALE&CSKH: Tổng lợi nhuận của tất cả học sinh trong tháng (không phân biệt trạng thái thanh toán)
  // Simplified: Calculate based on students assigned to CSKH staff and their topups in range
  const rangeMonth = range.start.getMonth() + 1;
  const rangeYear = range.start.getFullYear();
  let cskhCost = 0;
  const cskhStaff = teachers.filter((t: any) => {
    const roles = t.roles || [];
    return roles.includes('cskh_sale');
  });
  
  cskhStaff.forEach((staff: any) => {
    const assignedStudents = students.filter((s: any) => {
      const staffId = s.cskh_staff_id || s.cskhStaffId;
      if (staffId !== staff.id) return false;
      const studentClassRecords = studentClasses.filter((sc: any) => sc.student_id === s.id);
      return studentClassRecords.length > 0;
    });
    
    // Default profit percent: 10% (can be enhanced to use database config)
    const defaultProfitPercent = 10;
    
    assignedStudents.forEach((student: any) => {
      const monthStart = new Date(rangeYear, rangeMonth - 1, 1);
      const monthEnd = new Date(rangeYear, rangeMonth, 0, 23, 59, 59);
      
      const monthTopups = walletTransactions.filter((tx: any) => {
        if (tx.student_id !== student.id) return false;
        if (tx.type !== 'topup') return false;
        if (!tx.date) return false;
        const txDate = new Date(tx.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });
      
      const totalPaid = monthTopups.reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
      const profit = totalPaid * (defaultProfitPercent / 100);
      cskhCost += profit;
    });
  });

  // - Thưởng: Tổng số tiền thưởng trong tháng (tất cả thưởng có createdAt trong range)
  const bonusesInRange = bonuses.filter((bonus: any) => {
    if (!bonus.created_at && !bonus.createdAt) return false;
    const createdAt = bonus.created_at || bonus.createdAt;
    return isWithinRange(createdAt, range);
  });
  const bonusCost = bonusesInRange.reduce((sum: number, bonus: any) => sum + (Number(bonus.amount) || 0), 0);

  // Tổng chi phí nhân sự = Tổng tháng của tất cả nhân sự
  const totalStaffCost = tutorCost + lessonPlanCost + cskhCost + bonusCost;

  const costsInRange = costs
    .filter((cost: any) => {
      const reference = cost.date || (cost.month ? `${cost.month}-01` : null);
      return isWithinRange(reference, range);
    })
    .reduce((sum: number, cost: any) => sum + (Number(cost.amount) || 0), 0);

  // Calculate pending allowances (giống backup)
  // Chờ thanh toán trợ cấp - Gia sư: Tổng số tiền trong các buổi dạy chưa thanh toán
  const pendingTeacherSessions = sessions
    .filter((s: any) => (s.payment_status || 'unpaid') !== 'paid')
    .map((s: any) => ({
      ...s,
      allowance: Number(s.allowance_amount || s.allowanceAmount || 0),
    }));
  const pendingTeacherAllowance = pendingTeacherSessions.reduce((sum: number, session: any) => sum + (session.allowance || 0), 0);

  // Chờ thanh toán trợ cấp - Giáo án: Tổng số tiền trong các bài đã làm chưa thanh toán trợ cấp
  const pendingLessonOutputs = lessonOutputs.filter((o: any) => (o.status || 'unpaid') !== 'paid');
  const pendingLessonPlanAllowance = pendingLessonOutputs.reduce((sum: number, output: any) => {
    const amount = Number(output.amount || output.payment_amount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
    return sum + amount;
  }, 0);

  // Chờ thanh toán trợ cấp - SALE&CSKH: Tổng số tiền chăm sóc học sinh chưa được thanh toán
  // Simplified: Calculate based on unpaid profit for CSKH staff
  // Note: In backup, this uses localStorage for payment status. We'll use a simplified approach.
  let pendingCskhAllowance = 0;
  cskhStaff.forEach((staff: any) => {
    const assignedStudents = students.filter((s: any) => {
      const staffId = s.cskh_staff_id || s.cskhStaffId;
      if (staffId !== staff.id) return false;
      const studentClassRecords = studentClasses.filter((sc: any) => sc.student_id === s.id);
      return studentClassRecords.length > 0;
    });
    
    const defaultProfitPercent = 10;
    
    assignedStudents.forEach((student: any) => {
      const monthStart = new Date(rangeYear, rangeMonth - 1, 1);
      const monthEnd = new Date(rangeYear, rangeMonth, 0, 23, 59, 59);
      
      const monthTopups = walletTransactions.filter((tx: any) => {
        if (tx.student_id !== student.id) return false;
        if (tx.type !== 'topup') return false;
        if (!tx.date) return false;
        const txDate = new Date(tx.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });
      
      const totalPaid = monthTopups.reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
      const profit = totalPaid * (defaultProfitPercent / 100);
      
      // Simplified: Assume unpaid if no payment record exists
      // In production, this should check payment status from database
      pendingCskhAllowance += profit;
    });
  });

  // Chờ thanh toán trợ cấp - Thưởng: Tổng số tiền thưởng chưa thanh toán
  const pendingBonusAllowance = bonuses
    .filter((b: any) => (b.status || 'unpaid') === 'unpaid')
    .reduce((sum: number, bonus: any) => sum + (Number(bonus.amount) || 0), 0);

  // Tổng chờ thanh toán trợ cấp
  const totalPendingAllowance = pendingTeacherAllowance + pendingLessonPlanAllowance + pendingCskhAllowance + pendingBonusAllowance;

  // Calculate alerts
  // 1. Students need renewal (students with remainingSessions = 0 or 1)
  // remainingSessions = 0: màu đỏ, remainingSessions = 1: màu vàng
  const studentsNeedRenewal = studentClasses
    .filter((sc: any) => (sc.status || 'active') !== 'inactive')
    .map((sc: any) => {
      const student = students.find((s: any) => s.id === sc.student_id);
      const classItem = classes.find((c: any) => c.id === sc.class_id);
      // Get remaining sessions from student_classes table
      const remaining = Number(sc.remaining_sessions || sc.remainingSessions || 0);
      return {
        id: sc.id,
        studentId: sc.student_id,
        studentName: student?.full_name || student?.fullName || student?.id || '',
        className: classItem?.name || sc.class_id || '',
        remaining: remaining,
      };
    })
    .filter((item: any) => item.remaining <= 1) // Chỉ lấy học sinh có số buổi <= 1
    .sort((a: any, b: any) => a.remaining - b.remaining) // Sắp xếp: 0 trước, 1 sau
    .slice(0, 10); // Limit to 10 for display

  // 2. Pending staff payouts - Group by staff and aggregate from 3 tables
  // Gia sư (màu vàng) + Công việc/Giáo án (màu đỏ) + Bonus (màu xanh)
  const pendingStaffMap = new Map<string, any>();

  // Group by teacher (Gia sư - màu vàng)
  pendingTeacherSessions.forEach((session: any) => {
    const teacherId = session.teacher_id || '';
    if (!teacherId) return;

    if (!pendingStaffMap.has(teacherId)) {
      const teacher = teachers.find((t: any) => t.id === teacherId);
      pendingStaffMap.set(teacherId, {
        staffId: teacherId,
        staffName: teacher?.full_name || teacher?.fullName || 'Chưa xác định',
        unpaidTeacher: 0, // Gia sư (màu vàng)
        unpaidWorkItems: 0, // Công việc/Giáo án (màu đỏ)
        unpaidBonuses: 0, // Bonus (màu xanh)
      });
    }
    const entry = pendingStaffMap.get(teacherId)!;
    entry.unpaidTeacher += session.allowance || 0;
  });

  // Group by lesson plan staff (Công việc/Giáo án - màu đỏ)
  pendingLessonOutputs.forEach((output: any) => {
    const staffId = output.staff_id || output.teacher_id || '';
    if (!staffId) return;

    if (!pendingStaffMap.has(staffId)) {
      const staff = teachers.find((t: any) => t.id === staffId);
      pendingStaffMap.set(staffId, {
        staffId,
        staffName: staff?.full_name || staff?.fullName || 'Chưa xác định',
        unpaidTeacher: 0,
        unpaidWorkItems: 0,
        unpaidBonuses: 0,
      });
    }
    const entry = pendingStaffMap.get(staffId)!;
    const amount = Number(output.amount || output.payment_amount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
    entry.unpaidWorkItems += amount;
  });

  // Group by bonuses (Bonus - màu xanh)
  bonuses
    .filter((b: any) => (b.status || 'unpaid') === 'unpaid')
    .forEach((bonus: any) => {
      const staffId = bonus.staff_id || '';
      if (!staffId) return;

      if (!pendingStaffMap.has(staffId)) {
        const staff = teachers.find((t: any) => t.id === staffId);
        pendingStaffMap.set(staffId, {
          staffId,
          staffName: staff?.full_name || staff?.fullName || 'Chưa xác định',
          unpaidTeacher: 0,
          unpaidWorkItems: 0,
          unpaidBonuses: 0,
        });
      }
      const entry = pendingStaffMap.get(staffId)!;
      entry.unpaidBonuses += Number(bonus.amount || 0);
    });

  // Convert to array and filter only staff with unpaid amounts
  const pendingStaffPayouts = Array.from(pendingStaffMap.values())
    .filter((item) => item.unpaidTeacher > 0 || item.unpaidWorkItems > 0 || item.unpaidBonuses > 0)
    .map((item) => ({
      staffId: item.staffId,
      staffName: item.staffName,
      unpaidTeacher: item.unpaidTeacher,
      unpaidWorkItems: item.unpaidWorkItems,
      unpaidBonuses: item.unpaidBonuses,
      totalAllowance: item.unpaidTeacher + item.unpaidWorkItems + item.unpaidBonuses,
    }))
    .sort((a, b) => b.totalAllowance - a.totalAllowance);

  // 3. Classes without teacher
  const classTeacherMap = new Map<string, string[]>();
  classTeachers.forEach((ct: any) => {
    if (!classTeacherMap.has(ct.class_id)) {
      classTeacherMap.set(ct.class_id, []);
    }
    classTeacherMap.get(ct.class_id)!.push(ct.teacher_id);
  });

  const classesWithoutTeacher = classes
    .filter((cls: any) => {
      const teacherIds = classTeacherMap.get(cls.id) || [];
      return teacherIds.length === 0;
    })
    .map((cls: any) => ({
      id: cls.id,
      name: cls.name || cls.id,
    }));

  // 4. Finance requests (loans and refunds)
  const loanRequests = students
    .filter((s: any) => Number(s.loan_balance || s.loanBalance || 0) > 0)
    .map((s: any) => ({
      name: s.full_name || s.fullName || s.id,
      amount: Number(s.loan_balance || s.loanBalance || 0),
    }));

  const refundRequests = payments
    .filter((p: any) => p.status === 'refund')
    .map((p: any) => ({
      id: p.id,
      studentId: p.student_id,
      amount: Number(p.amount || 0),
    }));

  // Lợi nhuận ròng: Doanh Thu - (Chi phí Nhân sự + Chi phí Khác)
  const netProfit = totalRevenue - (totalStaffCost + costsInRange);

  // Get unique cost categories for note
  const costCategories = costs
    .filter((cost: any) => {
      const reference = cost.date || (cost.month ? `${cost.month}-01` : null);
      return isWithinRange(reference, range);
    })
    .map((cost: any) => cost.category || 'Khác');
  const uniqueCategories = Array.from(new Set(costCategories)).slice(0, 3).join(', ');

  // Build finance report (giống backup)
  const financeReport = {
    rows: [
      {
        key: 'revenue',
        label: 'Doanh Thu',
        amount: totalRevenue,
        note: 'Tổng doanh thu đã thu',
      },
      {
        key: 'pending',
        label: 'Chưa Thu',
        amount: outstandingTuition,
        note: 'Tổng số tiền học phí chưa thu',
      },
      {
        key: 'pendingAllowances',
        label: 'Chờ Thanh Toán Trợ Cấp',
        amount: totalPendingAllowance,
        breakdown: {
          teacher: pendingTeacherAllowance,
          lessonPlan: pendingLessonPlanAllowance,
          cskh: pendingCskhAllowance,
          bonus: pendingBonusAllowance,
        },
      },
      {
        key: 'staffCost',
        label: 'Chi phí Nhân Sự',
        amount: totalStaffCost,
        note: 'Tổng tháng của tất cả nhân sự',
        breakdown: {
          teacher: tutorCost,
          lessonPlan: lessonPlanCost,
          cskh: cskhCost,
          bonus: bonusCost,
        },
      },
      {
        key: 'otherCost',
        label: 'Chi phí Khác',
        amount: costsInRange,
        note: uniqueCategories || 'Chưa phát sinh',
      },
      {
        key: 'netProfit',
        label: 'Lợi nhuận ròng',
        amount: netProfit,
        note: 'Doanh Thu - (Chi phí Nhân sự + Chi phí Khác)',
      },
    ],
  };

  const result = {
    summary: {
      totalClasses: classes.length,
      activeClasses: classes.filter((cls: any) => cls.status === 'running').length,
      totalStudents: students.length,
      activeStudents: students.filter((student: any) => (student.status || 'active') === 'active').length,
      totalTeachers: teachers.length,
      revenue: totalRevenue,
      uncollected: outstandingTuition,
    },
    financeReport,
    charts: {
      revenueProfitLine: [], // TODO: Implement chart data
    },
    alerts: {
      studentsNeedRenewal,
      pendingStaffPayouts,
      classesWithoutTeacher,
      financeRequests: {
        loans: loanRequests,
        refunds: refundRequests,
      },
    },
  };

  // Cache the result in database
  await setCachedData(cacheKey, 'dashboard', result, CACHE_TTL);

  return result;
}

export async function getQuickViewData(year: string) {
  // Check cache first
  const cacheKey = `quickview:${year}`;
  const cached = await getCachedData(cacheKey, 'quickview');
  if (cached) {
    return cached;
  }

  const yearStr = String(year);

  // Fetch all required data
  const [
    walletTxResult,
    sessionsResult,
    costsResult,
    studentClassesResult,
    bonusesResult,
    classesResult,
    teachersResult,
  ] = await Promise.all([
    supabase.from('wallet_transactions').select('*'),
    supabase.from('sessions').select('*'),
    supabase.from('costs').select('*'),
    supabase.from('student_classes').select('*'),
    supabase.from('bonuses').select('*'),
    supabase.from('classes').select('*'),
    supabase.from('teachers').select('*'),
  ]);

  const walletTransactions = walletTxResult.data || [];
  const sessions = sessionsResult.data || [];
  const costs = costsResult.data || [];
  const studentClasses = studentClassesResult.data || [];
  const bonuses = bonusesResult.data || [];
  const classes = classesResult.data || [];
  const teachers = teachersResult.data || [];

  // Filter by year
  const walletTxYear = walletTransactions.filter((tx: any) => (tx.date || '').startsWith(yearStr));
  // Chỉ tính tiền nạp, không tính tiền ứng
  // Số dương = tăng doanh thu, số âm = giảm doanh thu
  const revenueYear = walletTxYear
    .filter((tx: any) => {
      if (tx.type !== 'topup') return false; // Chỉ tính tiền nạp, không tính tiền ứng
      const amount = Number(tx.amount) || 0;
      return amount !== 0; // Tính cả số dương (nạp) và số âm (trừ)
    })
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
  const advanceCount = walletTxYear.filter((tx: any) => tx.type === 'advance' || tx.type === 'loan').length;

  const sessionsYear = sessions.filter((session: any) => (session.date || '').startsWith(yearStr));
  const classesOpened = new Set(sessionsYear.map((s: any) => s.class_id).filter(Boolean));
  const teachersInvolved = new Set(sessionsYear.map((s: any) => s.teacher_id).filter(Boolean));

  // Calculate tutor cost (simplified - should use payroll if available)
  const tutorCostYear = sessionsYear.reduce((sum: number, session: any) => {
    const allowance = Number(session.allowance_amount || 0);
    return sum + allowance;
  }, 0);

  // Calculate other costs
  const costsYear = costs.filter((cost: any) => {
    const marker = cost.month || cost.date || '';
    return marker && marker.startsWith(yearStr);
  });
  const otherCostYear = costsYear.reduce((sum: number, cost: any) => sum + (Number(cost.amount) || 0), 0);

  const netProfitYear = revenueYear - (tutorCostYear + otherCostYear);

  const studentRegistrations = studentClasses.filter((sc: any) => (sc.start_date || '').startsWith(yearStr));
  const avgSessionsPerStudent = studentRegistrations.length > 0 ? sessionsYear.length / studentRegistrations.length : 0;

  // Helper functions for formatting
  const formatCurrencyVND = (value: number): string => {
    const numeric = Number(value || 0);
    return `${numeric.toLocaleString('vi-VN')} đ`;
  };

  const formatNumber = (value: number): string => {
    return Number(value || 0).toLocaleString('vi-VN');
  };

  const result = {
    finance: [
      { label: 'Tổng doanh thu', value: formatCurrencyVND(revenueYear), hint: `Năm ${yearStr}` },
      { label: 'Chi phí gia sư', value: formatCurrencyVND(tutorCostYear), hint: 'Payroll theo năm' },
      { label: 'Chi phí khác', value: formatCurrencyVND(otherCostYear), hint: 'Marketing, vận hành...' },
      { label: 'Lợi nhuận ròng', value: formatCurrencyVND(netProfitYear), hint: 'Doanh thu - Chi phí' },
    ],
    operations: [
      { label: 'Lớp đã mở', value: formatNumber(classesOpened.size), hint: `${formatNumber(sessionsYear.length)} buổi` },
      { label: 'Buổi đã dạy', value: formatNumber(sessionsYear.length), hint: `${formatNumber(teachersInvolved.size)} giáo viên` },
      { label: 'Giáo viên tham gia', value: formatNumber(teachersInvolved.size), hint: 'Có buổi trong năm' },
    ],
    students: [
      { label: 'Học sinh đăng ký', value: formatNumber(studentRegistrations.length), hint: `Năm ${yearStr}` },
      { label: 'Buổi học trung bình', value: avgSessionsPerStudent.toFixed(1), hint: 'Buổi/học sinh' },
      { label: 'Số lần ứng tiền', value: formatNumber(advanceCount), hint: 'Giao dịch ứng tiền' },
    ],
  };

  // Cache the result in database
  await setCachedData(cacheKey, 'quickview', result, QUICK_VIEW_CACHE_TTL);

  return result;
}

