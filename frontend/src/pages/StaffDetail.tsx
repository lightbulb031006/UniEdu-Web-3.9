import React, { useCallback, useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers, updateTeacher } from '../services/teachersService';
import { fetchClasses, removeTeacherFromClass } from '../services/classesService';
import { fetchSessions } from '../services/sessionsService';
import { getStaffUnpaidAmounts, fetchStaffWorkItems, fetchStaffBonuses, updateStaffQrPaymentLink, getStaffLoginInfo, fetchStaffDetailData, StaffDetailData } from '../services/staffService';
import api from '../services/api';
import { fetchBonuses, createBonus, updateBonus, deleteBonus, Bonus } from '../services/bonusesService';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { formatCurrencyVND, formatDate, formatMonthLabel } from '../utils/formatters';
import { hasRole } from '../utils/permissions';
import Modal from '../components/Modal';
import { toast } from '../utils/toast';
import { CurrencyInput } from '../components/CurrencyInput';
import { TableSkeleton, SkeletonLoader } from '../components/SkeletonLoader';
import { useDebounce } from '../hooks/useDebounce';

// Add spin animation for loading spinner
const spinAnimation = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Inject animation style
if (typeof document !== 'undefined' && !document.getElementById('spin-animation-style')) {
  const style = document.createElement('style');
  style.id = 'spin-animation-style';
  style.textContent = spinAnimation;
  document.head.appendChild(style);
}

/**
 * Staff Detail Page Component
 * Shows detailed information about a specific staff member
 * Migrated from backup/assets/js/pages/staff.js - renderStaffDetail
 */

function StaffDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // Giáo viên chỉ được xem hồ sơ cá nhân: đảm bảo có linkId (gọi /me nếu token cũ), rồi redirect nếu id !== linkId
  useEffect(() => {
    if (user?.role !== 'teacher' || !id) return;
    const doRedirect = (linkId: string) => {
      if (id !== linkId) navigate(`/staff/${linkId}`, { replace: true });
    };
    if (user.linkId != null) {
      doRedirect(user.linkId);
      return;
    }
    authService.getCurrentUser()
      .then((data) => {
        const linkId = data?.linkId ?? null;
        if (linkId != null) doRedirect(linkId);
      })
      .catch(() => { });
  }, [user?.role, user?.linkId, id, navigate]);

  // Month state for income statistics
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  // Debounce month change to avoid too many API calls
  const debouncedMonth = useDebounce(selectedMonth, 300);

  const fetchTeacherFn = useCallback(async () => {
    if (!id) throw new Error('Staff ID is required');
    const cacheKey = 'teachers-for-staff-detail';
    // Giáo viên chỉ nhận 1 bản ghi từ API → không dùng cache list để tránh hiển thị nhầm người
    if (user?.role !== 'teacher') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data: cachedTeachers, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            const teacher = cachedTeachers.find((t: any) => t.id === id);
            if (teacher) return teacher;
          }
        }
      } catch {
        // ignore
      }
    }
    const teachers = await fetchTeachers();

    // Lưu vào cache
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: teachers,
        timestamp: Date.now(),
      }));
    } catch {
      // Ignore storage errors
    }

    const teacher = teachers.find((t) => t.id === id);
    if (!teacher) {
      throw new Error(`Không tìm thấy nhân sự với ID: ${id}`);
    }
    return teacher;
  }, [id, user?.role]);

  // Giáo viên chỉ được load hồ sơ của chính mình (id === linkId)
  // Backend đã enforce security (trả 404 nếu teacher truy cập record khác), nên frontend chỉ cần kiểm tra cơ bản
  // Không block loading khi linkId chưa sẵn sàng — useEffect ở trên sẽ redirect nếu cần
  const canLoadStaff = !user || user.role !== 'teacher' || !user.linkId || id === user.linkId;
  const { data: staff, isLoading, error, refetch } = useDataLoading(fetchTeacherFn, [id], {
    cacheKey: `staff-${id}`,
    staleTime: 5 * 60 * 1000,
    enabled: !!id && canLoadStaff,
  });

  // Log errors only
  useEffect(() => {
    if (error) {
      console.error('[StaffDetail] Error loading staff:', error);
    }
  }, [error]);

  // Fetch classes to get classes taught by this staff
  // Chỉ fetch khi staff đã load xong
  const { data: classesData } = useDataLoading(() => fetchClasses(), [], {
    cacheKey: 'classes-for-staff-detail',
    staleTime: 5 * 60 * 1000,
    enabled: !!staff && !isLoading, // Chỉ fetch khi staff đã load
  });

  // Fetch sessions for this staff (all sessions, not filtered by month)
  // Chỉ fetch khi staff đã load xong
  const fetchSessionsFn = useCallback(() => fetchSessions({ teacherId: id }), [id]);
  const { data: sessionsData } = useDataLoading(fetchSessionsFn, [id], {
    cacheKey: `sessions-staff-${id}`,
    staleTime: 2 * 60 * 1000, // Tăng cache time
    enabled: !!staff && !isLoading, // Chỉ fetch khi staff đã load
  });


  // Fetch unpaid amounts WITH BREAKDOWN (same API as Staff list page for consistency)
  // This ensures StaffDetail shows the same unpaid value as the Staff list
  const [unpaidBreakdown, setUnpaidBreakdown] = useState<{ classesAndWork: number; bonuses: number; total: number } | null>(null);
  useEffect(() => {
    if (id && staff && !isLoading) {
      getStaffUnpaidAmounts([id])
        .then((result) => {
          const bd = result.breakdown?.[id];
          if (bd) {
            setUnpaidBreakdown(bd);
          } else {
            // Fallback: put everything in classesAndWork if no breakdown
            const total = result.totals?.[id] || 0;
            setUnpaidBreakdown({ classesAndWork: total, bonuses: 0, total });
          }
        })
        .catch((err) => {
          // Không log 429 errors
          if (err?.response?.status !== 429) {
            console.error('Failed to fetch unpaid amounts:', err);
          }
          setUnpaidBreakdown(null);
        });
    }
  }, [id, staff, isLoading, sessionsData, debouncedMonth]);

  // Load deduction settings from backend (synced across devices)
  const [deductionSettings, setDeductionSettings] = useState<{ globalPercent: number; individualDeductions: Record<string, number> }>({
    globalPercent: 0, individualDeductions: {},
  });
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/settings/deduction');
        if (res.data) {
          setDeductionSettings({
            globalPercent: res.data.globalPercent ?? 0,
            individualDeductions: res.data.individualDeductions ?? {},
          });
        }
      } catch {
        // Fallback to localStorage
        try {
          const globalStr = localStorage.getItem('staff_deduction_percent');
          const indStr = localStorage.getItem('staff_individual_deductions');
          setDeductionSettings({
            globalPercent: globalStr ? Number(globalStr) : 0,
            individualDeductions: indStr ? JSON.parse(indStr) : {},
          });
        } catch { /* ignore */ }
      }
    })();
  }, []);

  // Fetch work items - use debounced month to avoid too many calls
  const fetchWorkItemsFn = useCallback(async () => {
    if (!id) throw new Error('Staff ID is required');
    return await fetchStaffWorkItems(id, debouncedMonth);
  }, [id, debouncedMonth]);
  const { data: workItemsData, isLoading: workItemsLoading, refetch: refetchWorkItems } = useDataLoading(fetchWorkItemsFn, [id, debouncedMonth], {
    cacheKey: `staff-work-items-${id}-${debouncedMonth}`,
    staleTime: 5 * 60 * 1000, // Tăng cache time lên 5 phút
    persistCache: true, // Lưu vào localStorage để persist qua sessions
    enabled: !!staff && !isLoading,
  });

  // Prefetch next month work items
  useEffect(() => {
    if (!id || !staff || isLoading) return;
    const [year, month] = debouncedMonth.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

    const timeoutId = setTimeout(() => {
      fetchStaffWorkItems(id, nextMonthStr).catch(() => { });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [id, staff, isLoading, debouncedMonth]);

  // Fetch bonuses - use debounced month
  const fetchBonusesFn = useCallback(async () => {
    if (!id) throw new Error('Staff ID is required');
    return await fetchStaffBonuses(id, debouncedMonth);
  }, [id, debouncedMonth]);
  const { data: bonusesData, refetch: refetchBonuses } = useDataLoading(fetchBonusesFn, [id, debouncedMonth], {
    cacheKey: `staff-bonuses-${id}-${debouncedMonth}`,
    staleTime: 2 * 60 * 1000,
    enabled: !!staff && !isLoading,
  });

  // Prefetch next month bonuses
  useEffect(() => {
    if (!id || !staff || isLoading) return;
    const [year, month] = debouncedMonth.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

    const timeoutId = setTimeout(() => {
      fetchStaffBonuses(id, nextMonthStr).catch(() => { });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [id, staff, isLoading, debouncedMonth]);

  // Fetch staff detail data (all calculations done in backend) - use debounced month
  const fetchStaffDetailDataFn = useCallback(async () => {
    if (!id) throw new Error('Staff ID is required');
    return await fetchStaffDetailData(id, debouncedMonth);
  }, [id, debouncedMonth]);
  const { data: staffDetailData, isLoading: staffDetailDataLoading, refetch: refetchStaffDetailData } = useDataLoading(fetchStaffDetailDataFn, [id, debouncedMonth], {
    cacheKey: `staff-detail-data-${id}-${debouncedMonth}`,
    staleTime: 10 * 60 * 1000, // Tăng cache time lên 10 phút
    persistCache: true, // Lưu vào localStorage để persist qua sessions
    enabled: !!staff && !isLoading,
  });

  // Background refresh: Load fresh data in background after showing cached data
  // This ensures UI shows immediately while data is being updated
  useEffect(() => {
    if (!id || !staff || isLoading || !staffDetailData) return;

    // If we have cached data, refresh in background to ensure it's up-to-date
    // But don't show loading state - just update silently
    const timeoutId = setTimeout(() => {
      refetchStaffDetailData();
    }, 500); // Small delay to let UI render first

    return () => clearTimeout(timeoutId);
  }, [id, staff, isLoading, staffDetailData, refetchStaffDetailData]);

  // Listen for teacher-class-updated events to refetch immediately
  useEffect(() => {
    if (!id || !staff) return;

    const handleTeacherClassUpdated = (event: CustomEvent) => {
      const { teacherId, action } = event.detail || {};
      // If this staff is the affected teacher, refetch immediately
      if (teacherId === id) {
        // Clear cache for current month
        const cacheKey = `staff-detail-data-${id}-${debouncedMonth}`;
        localStorage.removeItem(cacheKey);
        sessionStorage.removeItem(cacheKey);
        // Refetch immediately
        refetchStaffDetailData();
      }
    };

    window.addEventListener('teacher-class-updated', handleTeacherClassUpdated as EventListener);
    return () => {
      window.removeEventListener('teacher-class-updated', handleTeacherClassUpdated as EventListener);
    };
  }, [id, staff, debouncedMonth, refetchStaffDetailData]);

  // Prefetch next month detail data
  useEffect(() => {
    if (!id || !staff || isLoading) return;
    const [year, month] = debouncedMonth.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;

    const timeoutId = setTimeout(() => {
      fetchStaffDetailData(id, nextMonthStr).catch(() => { });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [id, staff, isLoading, debouncedMonth]);

  const workItems = Array.isArray(workItemsData) ? workItemsData : [];
  // Parse bonuses data (now includes statistics)
  const bonuses = bonusesData?.bonuses || (Array.isArray(bonusesData) ? bonusesData : []);
  const bonusesStatistics = bonusesData?.statistics || { totalMonth: 0, paid: 0, unpaid: 0 };

  const classes = Array.isArray(classesData) ? classesData : [];
  // Sort sessions by date (newest first)
  const sessions = useMemo(() => {
    const sessionsList = Array.isArray(sessionsData) ? sessionsData : [];
    return [...sessionsList].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }, [sessionsData]);

  // Permission checks
  const isAdmin = hasRole('admin');
  const canManageStaff = isAdmin || hasRole('accountant');
  // Cho phép nhân sự (staff) thêm và chỉnh sửa bonus
  const canManageBonuses = isAdmin || hasRole('accountant') || user?.role === 'teacher';
  const showNavigation = user?.role !== 'teacher';

  // Month navigation handlers - memoized to prevent re-renders
  const handleMonthChange = useCallback((delta: number) => {
    setSelectedMonth((currentMonth) => {
      const [year, month] = currentMonth.split('-');
      let newMonth = parseInt(month) + delta;
      let newYear = parseInt(year);
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
      return `${newYear}-${String(newMonth).padStart(2, '0')}`;
    });
  }, []);

  const handleYearChange = useCallback((delta: number) => {
    setSelectedMonth((currentMonth) => {
      const [year, month] = currentMonth.split('-');
      const newYear = parseInt(year) + delta;
      return `${newYear}-${month}`;
    });
  }, []);

  const handleMonthSelect = useCallback((monthVal: string) => {
    setSelectedMonth((currentMonth) => {
      const [year] = currentMonth.split('-');
      return `${year}-${monthVal}`;
    });
    setMonthPopupOpen(false);
  }, []);

  const [monthPopupOpen, setMonthPopupOpen] = useState(false);
  const [addBonusModalOpen, setAddBonusModalOpen] = useState(false);
  const [qrEditModalOpen, setQrEditModalOpen] = useState(false);
  const [editStaffModalOpen, setEditStaffModalOpen] = useState(false);
  const [staffInfoPanelOpen, setStaffInfoPanelOpen] = useState(false);
  const [depositDetailsModalOpen, setDepositDetailsModalOpen] = useState(false);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);

  // Memoized modal handlers to prevent re-renders
  const handleCloseBonusModal = useCallback(() => {
    setAddBonusModalOpen(false);
    setEditingBonus(null);
  }, []);

  const handleSaveBonus = useCallback(async () => {
    await refetchBonuses();
    setAddBonusModalOpen(false);
    setEditingBonus(null);
  }, [refetchBonuses]);

  const handleCloseQrModal = useCallback(() => {
    setQrEditModalOpen(false);
  }, []);

  const handleSaveQr = useCallback(async () => {
    await refetch();
    setQrEditModalOpen(false);
  }, [refetch]);

  const handleCloseDepositModal = useCallback(() => {
    setDepositDetailsModalOpen(false);
  }, []);

  const handleCloseEditStaffModal = useCallback(() => {
    setEditStaffModalOpen(false);
  }, []);

  const handleSuccessEditStaff = useCallback(() => {
    setEditStaffModalOpen(false);
    // Xóa cache để refetch lấy dữ liệu mới từ DB, tránh UI lệch với DB
    try {
      sessionStorage.removeItem('teachers-for-staff-detail');
    } catch {
      // ignore
    }
    refetch();
  }, [refetch]);

  const handleCloseStaffInfoPanel = useCallback(() => {
    setStaffInfoPanelOpen(false);
  }, []);

  const handleEditFromInfoPanel = useCallback(() => {
    setStaffInfoPanelOpen(false);
    setEditStaffModalOpen(true);
  }, []);

  // Filter sessions by selected month
  const monthSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (!s.date) return false;
      const sessionMonth = s.date.slice(0, 7); // YYYY-MM
      return sessionMonth === selectedMonth;
    });
  }, [sessions, selectedMonth]);

  // Get classes taught by this staff
  const staffClasses = useMemo(() => {
    return classes.filter((cls) => {
      const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
      return teacherIds.includes(staff?.id || '');
    });
  }, [classes, staff?.id]);

  // Logic tính trợ cấp cho session: ưu tiên dùng allowanceAmount nếu có, nếu không thì tính từ computeSessionAllowance (giống backup)
  const getSessionAllowance = useMemo(() => {
    return (session: any) => {
      // Ưu tiên dùng allowance_amount hoặc allowanceAmount nếu có (giống backup: session.allowanceAmount ?? computeSessionAllowance(session) ?? 0)
      // Kiểm tra cả allowance_amount và allowanceAmount (camelCase)
      const allowanceAmount = session.allowance_amount ?? session.allowanceAmount;
      // Nếu allowanceAmount có giá trị (không phải null/undefined), dùng nó (kể cả khi = 0)
      // Giống backup: session.allowanceAmount ?? computeSessionAllowance(session) ?? 0
      if (allowanceAmount != null && allowanceAmount !== undefined) {
        const numValue = Number(allowanceAmount);
        // Nếu giá trị > 0, dùng nó
        // Nếu giá trị = 0, vẫn dùng 0 (không tính lại, vì có thể đã được set rõ ràng là 0)
        return numValue;
      }

      // Tính từ class's customTeacherAllowances, coefficient, và studentPaidCount (giống backup)
      const cls = classes.find((c) => c.id === session.class_id);
      if (!cls) return 0;

      const customAllowances = (cls as any)?.customTeacherAllowances || {};
      const baseAllowance = Number(customAllowances[id || ''] ?? (cls.tuitionPerSession || 0)) || 0;
      const coefficient = session.coefficient != null ? Number(session.coefficient) : 1;

      // Nếu hệ số = 0 thì số tiền = 0 luôn
      if (coefficient === 0) {
        return 0;
      }

      // Số học sinh đã thanh toán (từ attendance hoặc studentPaidCount)
      const paidCount = Number(session.studentPaidCount || session.student_paid_count || 0) || 0;
      const scale = Number((cls as any)?.scaleAmount || 0) || 0;
      const maxPerSession = Number((cls as any)?.maxAllowancePerSession || 0) || 0;

      // Công thức: (baseAllowance * coefficient * paidCount) + scale
      let allowance = (baseAllowance * coefficient * paidCount) + scale;

      // Nếu có maxPerSession thì giới hạn tối đa
      if (maxPerSession > 0 && allowance > maxPerSession) {
        allowance = maxPerSession;
      }

      return allowance > 0 ? Math.round(allowance) : 0;
    };
  }, [classes, id]);

  // Use data from backend (all calculations done in backend)
  // For teachers, use backend calculated data; for display purposes, still need getSessionAllowance for individual session display
  const teacherClassStats = useMemo(() => {
    if (!staffDetailData) {
      // Fallback: calculate locally if backend data not available (should not happen in production)
      if (!staff?.id) return [];
      return staffClasses.map((cls) => {
        const classSessions = sessions.filter((s) => s.class_id === cls.id);
        const monthSessionsForClass = classSessions.filter((s) => {
          if (!s.date) return false;
          return s.date.slice(0, 7) === selectedMonth;
        });

        const totalMonth = monthSessionsForClass.reduce((sum, s) => sum + getSessionAllowance(s), 0);
        const totalPaid = monthSessionsForClass
          .filter((s) => s.payment_status === 'paid')
          .reduce((sum, s) => sum + getSessionAllowance(s), 0);
        const teacherSessionsForClass = classSessions.filter((s) =>
          (s.teacher_id === staff.id || s.teacherId === staff.id)
        );
        const totalUnpaid = teacherSessionsForClass
          .filter((s) => s.payment_status === 'unpaid')
          .reduce((sum, s) => sum + getSessionAllowance(s), 0);

        const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
        const isActive = teacherIds.includes(staff.id);

        return {
          class: cls,
          totalMonth,
          totalPaid,
          totalUnpaid,
          monthSessionsCount: monthSessionsForClass.length,
          isActive,
        };
      });
    }

    // Use backend calculated data, but map class IDs to full class objects
    return staffDetailData.teacherClassStats.map((stat) => {
      const cls = staffClasses.find((c) => c.id === stat.class.id) || stat.class;
      return {
        ...stat,
        class: cls,
      };
    });
  }, [staffDetailData, staffClasses, sessions, selectedMonth, staff?.id, getSessionAllowance]);

  // Calculate income stats directly from UI data (workItems, bonuses, classes) - no need for API call
  // Tính từ TẤT CẢ dữ liệu đã load từ các bảng, không chỉ tháng hiện tại
  // Khi các bảng load xong thì tự động tính toán
  const incomeStats = useMemo(() => {
    // Chỉ tính khi các bảng đã có dữ liệu
    if (!workItemsData && !bonusesData && !sessions.length) {
      return {
        totalMonthAllClasses: 0,
        totalPaidByStatus: 0,
        totalUnpaidByStatus: 0,
        totalMonthWorkItems: 0,
        totalPaidWorkItems: 0,
        totalUnpaidWorkItems: 0,
        totalMonthBonuses: 0,
        totalPaidBonuses: 0,
        totalUnpaidBonuses: 0,
        totalMonthAll: 0,
        totalPaidAll: 0,
        totalUnpaidAll: 0,
        totalPaidAllTime: 0,
        totalDepositAllTime: 0,
      };
    }

    // Calculate from work items (bảng công việc) - tính từ TẤT CẢ work items đã load
    const totalMonthWorkItems = workItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalPaidWorkItems = workItems.reduce((sum, item) => sum + (item.paid || 0), 0);
    const totalUnpaidWorkItems = workItems.reduce((sum, item) => sum + (item.unpaid || 0), 0);

    // Calculate from bonuses (bảng thưởng) - tính từ TẤT CẢ bonuses đã load
    // Nếu có statistics thì dùng, nếu không thì tính từ bonuses array
    let totalMonthBonuses = bonusesStatistics.totalMonth || 0;
    let totalPaidBonuses = bonusesStatistics.paid || 0;
    let totalUnpaidBonuses = bonusesStatistics.unpaid || 0;

    // Nếu không có statistics, tính từ bonuses array
    if (totalMonthBonuses === 0 && bonuses.length > 0) {
      totalMonthBonuses = bonuses.reduce((sum, b) => sum + (b.amount || 0), 0);
      totalPaidBonuses = bonuses.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0);
      totalUnpaidBonuses = bonuses.filter(b => b.status === 'unpaid').reduce((sum, b) => sum + (b.amount || 0), 0);
    }

    // Calculate from classes (bảng các lớp dạy) - tính từ TẤT CẢ sessions đã load, không filter theo tháng
    // Tính từ tất cả sessions, không chỉ tháng hiện tại
    const allClassSessions = sessions.filter((s) => s.teacher_id === id || s.teacherId === id);

    // Tính tổng cho tháng hiện tại (selectedMonth)
    const monthSessions = allClassSessions.filter((s) => {
      if (!s.date) return false;
      return s.date.slice(0, 7) === selectedMonth;
    });

    const totalMonthAllClasses = monthSessions.reduce((sum, s) => sum + getSessionAllowance(s), 0);
    const totalPaidByStatus = monthSessions
      .filter((s) => s.payment_status === 'paid')
      .reduce((sum, s) => sum + getSessionAllowance(s), 0);

    // Tính unpaid từ tháng hiện tại + tháng trước (theo logic backend)
    const [year, month] = selectedMonth.split('-').map(Number);
    let previousYear = year;
    let previousMonth = month - 1;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear = year - 1;
    }
    const previousMonthStr = `${previousYear}-${String(previousMonth).padStart(2, '0')}`;

    const unpaidSessions = allClassSessions.filter((s) => {
      if (!s.date || s.payment_status !== 'unpaid') return false;
      const sessionMonth = s.date.slice(0, 7);
      return sessionMonth === selectedMonth || sessionMonth === previousMonthStr;
    });

    const totalUnpaidByStatus = unpaidSessions.reduce((sum, s) => sum + getSessionAllowance(s), 0);

    // Calculate total paid in current year from TẤT CẢ 3 bảng (Classes + Work Items + Bonuses)
    const currentYear = selectedMonth.split('-')[0]; // Lấy năm từ selectedMonth

    // Tính từ Classes (sessions) trong năm hiện tại
    const yearSessions = allClassSessions.filter((s) => {
      if (!s.date) return false;
      return s.date.slice(0, 4) === currentYear && s.payment_status === 'paid';
    });
    const totalPaidClassesYear = yearSessions.reduce((sum, s) => sum + getSessionAllowance(s), 0);

    // Tính từ Work Items trong năm hiện tại
    const yearWorkItems = workItems.filter((item) => {
      if (!item.month) return false;
      return item.month.slice(0, 4) === currentYear;
    });
    const totalPaidWorkItemsYear = yearWorkItems.reduce((sum, item) => sum + (item.paid || 0), 0);

    // Tính từ Bonuses trong năm hiện tại
    const yearBonuses = bonuses.filter((b) => {
      if (!b.month) return false;
      return b.month.slice(0, 4) === currentYear && b.status === 'paid';
    });
    const totalPaidBonusesYear = yearBonuses.reduce((sum, b) => sum + (b.amount || 0), 0);

    // Tổng năm = Classes + Work Items + Bonuses (đã thanh toán trong năm)
    const totalPaidAllTime = totalPaidClassesYear + totalPaidWorkItemsYear + totalPaidBonusesYear;

    // Tính cọc từ TẤT CẢ sessions (không giới hạn năm, khớp với DepositDetailsModal)
    const yearDepositSessions = allClassSessions.filter((s) => {
      if (!s.date) return false;
      return s.payment_status === 'deposit';
    });
    const totalDepositAllTime = yearDepositSessions.reduce((sum, s) => sum + getSessionAllowance(s), 0);

    // Read deduction % for this staff from backend-synced state
    let deductionX = 0;
    if (deductionSettings.individualDeductions[id || ''] != null) {
      deductionX = Number(deductionSettings.individualDeductions[id || '']);
    } else {
      deductionX = deductionSettings.globalPercent;
    }
    const deductionMultiplier = (100 - deductionX) / 100;

    // Calculate totals with deduction: (classes + work items) * (100 - x%) + bonuses
    const totalMonthAll = Math.round((totalMonthAllClasses + totalMonthWorkItems) * deductionMultiplier) + totalMonthBonuses;
    const totalPaidAll = Math.round((totalPaidByStatus + totalPaidWorkItems) * deductionMultiplier) + totalPaidBonuses;
    // Always calculate from fresh local data (sessions, workItems, bonuses already loaded on this page)
    // Previously this preferred unpaidBreakdown from the backend API, but that reads from
    // staff_monthly_stats cache which can be stale after payment status changes
    const totalUnpaidAll = Math.round((totalUnpaidByStatus + totalUnpaidWorkItems) * deductionMultiplier) + totalUnpaidBonuses;

    // Totals WITHOUT deduction (cũ) = classes + work items + bonuses (no deduction applied)
    const totalMonthAllNoDeduction = totalMonthAllClasses + totalMonthWorkItems + totalMonthBonuses;
    const totalPaidAllNoDeduction = totalPaidByStatus + totalPaidWorkItems + totalPaidBonuses;
    const totalUnpaidAllNoDeduction = totalUnpaidByStatus + totalUnpaidWorkItems + totalUnpaidBonuses;

    return {
      // Classes (bảng các lớp dạy)
      totalMonthAllClasses,
      totalPaidByStatus,
      totalUnpaidByStatus,
      // Work items (bảng công việc)
      totalMonthWorkItems,
      totalPaidWorkItems,
      totalUnpaidWorkItems,
      // Bonuses (bảng thưởng)
      totalMonthBonuses,
      totalPaidBonuses,
      totalUnpaidBonuses,
      // Totals with deduction
      totalMonthAll,
      totalPaidAll,
      totalUnpaidAll,
      // Totals without deduction (cũ)
      totalMonthAllNoDeduction,
      totalPaidAllNoDeduction,
      totalUnpaidAllNoDeduction,
      // All time
      totalPaidAllTime,
      totalDepositAllTime,
    };
  }, [workItems, workItemsData, bonuses, bonusesData, bonusesStatistics, sessions, selectedMonth, id, getSessionAllowance, deductionSettings]);

  // Check if income stats are loading
  // Income stats are calculated from UI data, so only show loading if work items are loading
  // Không cần đợi debounce vì tính từ dữ liệu đã có
  const isIncomeStatsLoading = workItemsLoading;

  // Use session stats from backend
  const sessionStats = useMemo(() => {
    if (staffDetailData) {
      return staffDetailData.sessionStats;
    }
    // Fallback calculation (should not happen in production)
    return {
      total: sessions.length,
      paid: sessions.filter((s) => s.payment_status === 'paid').length,
      unpaid: sessions.filter((s) => s.payment_status === 'unpaid').length,
      totalAllowance: sessions.reduce((sum, s) => sum + getSessionAllowance(s), 0),
      paidAllowance: sessions.filter((s) => s.payment_status === 'paid').reduce((sum, s) => sum + getSessionAllowance(s), 0),
    };
  }, [staffDetailData, sessions, getSessionAllowance]);

  // Get roles from staff
  const roles = staff?.roles || [];
  const isTeacher = roles.includes('teacher') || roles.length === 0;
  const nonTeacherRoles = roles.filter((r) => r !== 'teacher');
  const hasCskhRole = roles.includes('cskh_sale');

  const roleLabels: Record<string, string> = {
    teacher: 'Gia sư',
    lesson_plan: 'Giáo án',
    accountant: 'Kế toán',
    cskh_sale: 'CSKH & SALE',
    communication: 'Truyền thông',
  };

  // QR payment link - match backup logic: qr_payment_link || qrPaymentLink || bank_qr_link || bankQRLink
  // Check all possible field names and filter out empty strings
  const qrPaymentLink =
    (staff as any)?.qr_payment_link ||
    (staff as any)?.qrPaymentLink ||
    (staff as any)?.bank_qr_link ||
    (staff as any)?.bankQRLink ||
    null;
  const hasQrPaymentLink = Boolean(qrPaymentLink && qrPaymentLink.trim());

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Lỗi tải dữ liệu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>{error.message}</p>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/staff')}>
              Quay lại
            </button>
            <button className="btn btn-primary" onClick={() => refetch()}>
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Progressive loading: Show page structure even while loading
  // Only show full page loading if staff data is not available
  if (isLoading && !staff) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải thông tin nhân sự...</p>
        </div>
      </div>
    );
  }

  // If staff is loaded but other data is loading, show page with skeleton loaders
  // Also handle case where staff is null after loading (shouldn't happen but safety check)
  if (!staff && !isLoading) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Không tìm thấy nhân sự</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>
            Không thể tải thông tin nhân sự với ID: {id}
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/staff')}>
              Quay lại
            </button>
            <button className="btn btn-primary" onClick={() => refetch()}>
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading if still loading or staff not available yet
  if (isLoading || !staff) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải thông tin nhân sự...</p>
        </div>
      </div>
    );
  }

  // Safety check: ensure staff exists before rendering
  if (!staff) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Không tìm thấy nhân sự</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>
            Không thể tải thông tin nhân sự với ID: {id}
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/staff')}>
              Quay lại
            </button>
            <button className="btn btn-primary" onClick={() => refetch()}>
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = selectedMonth.split('-');
  const monthNum = parseInt(month, 10);

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header - Matching code cũ */}
      <div
        className="staff-detail-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--spacing-6)',
          padding: 'var(--spacing-5)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <button
              className="staff-account-icon-btn"
              id="staffAccountBtn"
              data-staff-id={staff.id}
              title="Xem thông tin cá nhân"
              onClick={() => setStaffInfoPanelOpen(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--primary)',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: 'var(--text)', lineHeight: '1.2' }}>
                {staff.fullName || staff.name || 'Chưa có tên'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-1)', flexWrap: 'wrap' }}>
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <span
                      key={role}
                      className="role-badge"
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: 'var(--primary)',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        marginRight: '4px',
                      }}
                    >
                      {roleLabels[role] || role}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Chưa phân chức vụ</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap', marginTop: 'var(--spacing-2)' }}>
            {(staff as any).phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>{(staff as any).phone}</span>
              </div>
            )}
            {(staff as any).email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>{(staff as any).email}</span>
              </div>
            )}
            {hasCskhRole && (
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/staff/${id}/cskh`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-1)',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  fontSize: '0.875rem',
                }}
                title="Xem danh sách học sinh CSKH"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Học sinh CSKH</span>
              </button>
            )}
          </div>
        </div>
        {showNavigation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexShrink: 0 }}>
            <button
              className="btn btn-outline"
              onClick={() => navigate('/staff')}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Quay lại
            </button>
          </div>
        )}
      </div>

      {/* Staff Info Card - Matching backup */}
      <div className="staff-detail-card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className="staff-detail-card-header">
          <h3 className="staff-detail-card-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Thông tin nhân sự
          </h3>
          {canManageStaff && (
            <button
              className="btn btn-sm"
              id="editStaffBtn"
              data-staff-id={staff.id}
              onClick={() => setEditStaffModalOpen(true)}
            >
              Chỉnh sửa
            </button>
          )}
        </div>
        <div className="staff-detail-info-grid staff-detail-info-grid--summary">
          {/* QR Card */}
          <div
            className={`staff-qr-card ${hasQrPaymentLink ? 'has-qr' : 'no-qr'}`}
            data-qr-link={qrPaymentLink || ''}
            title={hasQrPaymentLink ? 'Click để mở link QR thanh toán' : 'Chưa có link QR thanh toán'}
            onClick={() => {
              if (hasQrPaymentLink && qrPaymentLink) {
                window.open(qrPaymentLink, '_blank');
              }
            }}
          >
            {canManageStaff && (
              <button
                type="button"
                className="staff-qr-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setQrEditModalOpen(true);
                }}
                data-staff-id={staff.id}
                title="Chỉnh sửa link QR thanh toán"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            )}
            <div className="staff-qr-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="3" y="3" width="5" height="5" />
                <rect x="16" y="3" width="5" height="5" />
                <rect x="3" y="16" width="5" height="5" />
                <rect x="16" y="16" width="5" height="5" />
                <path d="M11 3h2v18h-2z" />
                <path d="M3 11h18v2H3z" />
              </svg>
            </div>
            <div className="staff-qr-status">
              {hasQrPaymentLink ? 'Đã có QR thanh toán' : 'Chưa có link QR'}
            </div>
            <div className="staff-qr-link-hint">
              {hasQrPaymentLink ? 'Nhấn để mở link' : 'Chưa có link QR thanh toán'}
            </div>
          </div>

          {/* Province */}
          <div className="staff-detail-info-item">
            <div className="staff-detail-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Tỉnh thành
            </div>
            <div className="staff-detail-info-value">
              {staff.province || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Chưa cập nhật</span>}
            </div>
          </div>

          {/* Birth Date */}
          <div className="staff-detail-info-item">
            <div className="staff-detail-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Ngày sinh
            </div>
            <div className="staff-detail-info-value">
              {staff.birthDate ? new Date(staff.birthDate).toLocaleDateString('vi-VN') : <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Chưa cập nhật</span>}
            </div>
          </div>

          {/* Phone */}
          <div className="staff-detail-info-item">
            <div className="staff-detail-info-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Số điện thoại
            </div>
            <div className="staff-detail-info-value">
              {(staff as any).phone || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Chưa cập nhật</span>}
            </div>
          </div>
        </div>

        {/* Specialization Section */}
        <div className="staff-detail-specialization-section">
          <div className="staff-detail-info-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Mô tả chuyên môn
          </div>
          <div className="staff-detail-info-value" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
            {(staff as any).specialization || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Chưa khai báo</span>}
          </div>
        </div>
      </div>

      {/* Income Statistics - Matching backup */}
      {(isTeacher || nonTeacherRoles.length > 0) && (
        <div className="staff-detail-cards-grid" style={{ marginBottom: 'var(--spacing-4)' }}>
          <div className="staff-detail-card" style={{ overflow: 'visible' }}>
            <div className="staff-detail-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
              <h3 className="staff-detail-card-title" style={{ margin: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Thống kê thu nhập
              </h3>
              {/* Month Navigation */}
              <div className="session-month-nav" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', zIndex: 1002 }}>
                <button
                  type="button"
                  className="session-month-btn"
                  onClick={() => handleMonthChange(-1)}
                  title="Tháng trước"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    minWidth: '32px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="session-month-label-btn"
                  onClick={() => setMonthPopupOpen(!monthPopupOpen)}
                  title="Chọn tháng/năm"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <span style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Tháng {formatMonthLabel(selectedMonth)}
                    {debouncedMonth !== selectedMonth && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }}>⏳</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="session-month-btn"
                  onClick={() => handleMonthChange(1)}
                  title="Tháng sau"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.color = 'var(--text)';
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    minWidth: '32px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  ▶
                </button>
                {/* Month Popup */}
                {monthPopupOpen && (
                  <div
                    id="staffMonthPopup"
                    className="session-month-popup"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      marginTop: '6px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      boxShadow: 'var(--shadow-sm)',
                      padding: '6px 8px 8px',
                      zIndex: 1003,
                      minWidth: '200px',
                    }}
                  >
                    <div className="session-month-popup-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: 'var(--font-size-xs)' }}>
                      <button
                        type="button"
                        className="session-month-year-btn"
                        onClick={() => handleYearChange(-1)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: 'var(--radius)',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        ‹
                      </button>
                      <span style={{ fontWeight: '500' }}>{year}</span>
                      <button
                        type="button"
                        className="session-month-year-btn"
                        onClick={() => handleYearChange(1)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: 'var(--radius)',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        ›
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '2px',
                      }}
                    >
                      {monthNames.map((label, idx) => {
                        const val = String(idx + 1).padStart(2, '0');
                        const isActive = val === month;
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`session-month-cell${isActive ? ' active' : ''}`}
                            data-month={val}
                            onClick={() => handleMonthSelect(val)}
                            style={{
                              padding: '4px 6px',
                              borderRadius: 'var(--radius)',
                              border: 'none',
                              background: isActive ? 'var(--primary)' : 'transparent',
                              color: isActive ? 'white' : 'var(--text)',
                              cursor: 'pointer',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: isActive ? '600' : '400',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'var(--bg)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="staff-detail-stats-grid" style={{ position: 'relative' }}>
              {/* Loading overlay khi đang refetch nhưng đã có data */}
              {isIncomeStatsLoading && (workItemsData || bonusesData) && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(2px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    borderRadius: 'var(--radius-lg)',
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        border: '3px solid var(--border)',
                        borderTopColor: 'var(--primary)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Đang cập nhật...</span>
                  </div>
                </div>
              )}
              {isIncomeStatsLoading && !workItemsData && !bonusesData ? (
                // Show skeleton loaders when loading for the first time
                Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="staff-detail-stat-item">
                    <div className="staff-detail-stat-label">
                      <SkeletonLoader width="120px" height="16px" />
                    </div>
                    <div className="staff-detail-stat-value">
                      <SkeletonLoader width="100px" height="20px" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="staff-detail-stat-item">
                    <div className="staff-detail-stat-label">Tổng trợ cấp tháng</div>
                    <div className="staff-detail-stat-value" style={{ color: 'var(--primary)', opacity: isIncomeStatsLoading ? 0.6 : 1, transition: 'opacity 0.3s ease', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                      {isIncomeStatsLoading ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Đang tải...
                        </span>
                      ) : (
                        formatCurrencyVND(incomeStats.totalMonthAll)
                      )}
                    </div>
                  </div>
                  <div className="staff-detail-stat-item">
                    <div className="staff-detail-stat-label">
                      <span className="badge badge-success" style={{ marginRight: '8px' }}>✓</span>
                      Đã thanh toán
                    </div>
                    <div className="staff-detail-stat-value" style={{ color: '#059669', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                      {isIncomeStatsLoading ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Đang tải...
                        </span>
                      ) : (
                        formatCurrencyVND(incomeStats.totalPaidAll)
                      )}
                    </div>
                  </div>
                  <div className="staff-detail-stat-item">
                    <div className="staff-detail-stat-label">
                      <span className="badge badge-danger" style={{ marginRight: '8px' }}>✗</span>
                      Chưa thanh toán
                    </div>
                    <div className="staff-detail-stat-value" style={{ color: '#dc2626', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                      {isIncomeStatsLoading ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Đang tải...
                        </span>
                      ) : (
                        formatCurrencyVND(incomeStats.totalUnpaidAll)
                      )}
                    </div>
                  </div>
                  <div className="staff-detail-stat-item">
                    <div className="staff-detail-stat-label">Tổng năm</div>
                    <div className="staff-detail-stat-value" style={{ color: 'var(--primary)', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                      {isIncomeStatsLoading ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Đang tải...
                        </span>
                      ) : (
                        formatCurrencyVND(incomeStats.totalPaidAllTime)
                      )}
                    </div>
                  </div>
                  <div
                    className="staff-detail-stat-item"
                    id="depositStatItem"
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    title="Click để xem chi tiết"
                    onClick={() => setDepositDetailsModalOpen(true)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="staff-detail-stat-label">
                      <span className="badge badge-purple" style={{ marginRight: '8px' }}>●</span>
                      Cọc
                    </div>
                    <div className="staff-detail-stat-value" style={{ color: '#9333ea', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                      {isIncomeStatsLoading ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem' }}>⏳</span>
                          <span style={{ fontSize: '0.875rem' }}>Đang tải...</span>
                        </span>
                      ) : (
                        formatCurrencyVND(incomeStats.totalDepositAllTime)
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="staff-detail-stat-item">
                      <div className="staff-detail-stat-label">Tổng trợ cấp tháng (cũ)</div>
                      <div className="staff-detail-stat-value" style={{ color: 'var(--primary)', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                        {isIncomeStatsLoading ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Đang tải...
                          </span>
                        ) : (
                          formatCurrencyVND(incomeStats.totalMonthAllNoDeduction)
                        )}
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="staff-detail-stat-item">
                      <div className="staff-detail-stat-label">
                        <span className="badge badge-success" style={{ marginRight: '8px' }}>✓</span>
                        Đã thanh toán (cũ)
                      </div>
                      <div className="staff-detail-stat-value" style={{ color: '#059669', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                        {isIncomeStatsLoading ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Đang tải...
                          </span>
                        ) : (
                          formatCurrencyVND(incomeStats.totalPaidAllNoDeduction)
                        )}
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="staff-detail-stat-item">
                      <div className="staff-detail-stat-label">
                        <span className="badge badge-danger" style={{ marginRight: '8px' }}>✗</span>
                        Chưa thanh toán (cũ)
                      </div>
                      <div className="staff-detail-stat-value" style={{ color: '#dc2626', opacity: isIncomeStatsLoading ? 0.5 : 1, transition: 'opacity 0.2s', minHeight: '24px', display: 'flex', alignItems: 'center' }}>
                        {isIncomeStatsLoading ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--border)', borderTopColor: '#dc2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Đang tải...
                          </span>
                        ) : (
                          formatCurrencyVND(incomeStats.totalUnpaidAllNoDeduction)
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Left (Classes + Work) | Right (Bonuses) */}
      <div className="staff-detail-two-column-layout" style={{ marginBottom: 'var(--spacing-4)' }}>
        {/* Left Column: Classes + Work */}
        <div className="staff-detail-left-column">
          {/* Teacher Classes (only if has teacher role) */}
          {isTeacher && (
            <div className="staff-detail-section">
              <div className="staff-detail-section-header">
                <h3 className="staff-detail-section-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  Các lớp
                </h3>
              </div>
              <div className="staff-detail-section-content">
                {teacherClassStats.length > 0 ? (
                  <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Tên lớp</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Số buổi trong tháng</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Tổng tháng</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Đã nhận</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>Chưa nhận</th>
                          {canManageStaff && <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', width: '60px', fontWeight: '600', fontSize: '0.875rem' }}></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {teacherClassStats.map((stat) => {
                          const statusLabel = stat.isActive ? 'Dạy' : 'Dừng';
                          const statusColor = stat.isActive ? '#059669' : '#dc2626';
                          return (
                            <tr
                              key={stat.class.id}
                              className={`teacher-class-row ${stat.isActive ? 'class-active' : 'class-inactive'}`}
                              data-class-id={stat.class.id}
                              data-is-active={stat.isActive}
                              onClick={() => {
                                // Allow admin to click on stopped classes, or allow clicking on active classes
                                if (isAdmin || stat.isActive) {
                                  navigate(`/classes/${stat.class.id}`);
                                }
                              }}
                              style={{
                                cursor: (isAdmin || stat.isActive) ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s ease',
                                opacity: stat.isActive ? 1 : 0.7,
                                pointerEvents: (isAdmin || stat.isActive) ? 'auto' : 'none',
                              }}
                            >
                              <td style={{ padding: 'var(--spacing-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)' }}>
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                  </svg>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                                    <div style={{ fontWeight: '600', color: 'var(--text)' }}>{stat.class.name}</div>
                                    <span
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        color: statusColor,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: `${statusColor}15`,
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={stat.isActive ? 'Lớp đang dạy' : 'Lớp đã dừng, không còn phụ trách'}
                                    >
                                      {statusLabel}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)' }}>
                                <div style={{ fontWeight: '500', color: 'var(--text)' }}>{stat.monthSessionsCount}</div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text)' }}>{formatCurrencyVND(stat.totalMonth)}</div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)' }}>
                                <div style={{ fontWeight: '500', color: '#059669' }}>{formatCurrencyVND(stat.totalPaid)}</div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)' }}>
                                <div style={{ fontWeight: '500', color: '#dc2626' }}>{formatCurrencyVND(stat.totalUnpaid)}</div>
                              </td>
                              {canManageStaff && (
                                <td style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
                                  <button
                                    className="btn-delete-class"
                                    data-class-id={stat.class.id}
                                    data-staff-id={staff.id}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const className = stat.class.name || 'lớp này';
                                      const staffName = staff.full_name || 'gia sư này';

                                      if (!window.confirm(`Bạn có chắc chắn muốn gỡ "${staffName}" khỏi lớp "${className}"?\n\nLớp sẽ chuyển sang trạng thái "Dừng" nhưng vẫn hiển thị trong danh sách để giữ dữ liệu thống kê.`)) {
                                        return;
                                      }

                                      try {
                                        await removeTeacherFromClass(stat.class.id, id || '');
                                        toast.success('Đã gỡ gia sư khỏi lớp. Lớp chuyển sang trạng thái "Dừng"');
                                        // Refresh data
                                        await refetch();
                                        // Also refresh classes data
                                        if (classesData) {
                                          // Trigger refetch by updating dependency
                                          window.location.reload(); // Simple refresh for now
                                        }
                                      } catch (error: any) {
                                        toast.error('Không thể gỡ gia sư khỏi lớp: ' + (error.response?.data?.error || error.message));
                                      }
                                    }}
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      padding: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: 'transparent',
                                      border: '1px solid var(--danger)',
                                      borderRadius: 'var(--radius)',
                                      color: 'var(--danger)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                    }}
                                    title="Xóa lớp khỏi danh sách"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="staff-detail-empty-state">
                    <div className="staff-detail-empty-state-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    </div>
                    <p>Chưa có lớp nào được phân công.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Work Items Table (for non-teacher roles) */}
          {nonTeacherRoles.length > 0 && (
            <div className="staff-detail-section">
              <div className="staff-detail-section-header">
                <h3 className="staff-detail-section-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Công việc
                </h3>
                <span className="text-muted text-sm">Tháng {formatMonthLabel(selectedMonth)}</span>
              </div>
              <div className="staff-detail-section-content">
                {workItemsLoading && !workItemsData ? (
                  <TableSkeleton rows={3} columns={4} />
                ) : workItems.length > 0 ? (
                  <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                    {/* Loading overlay khi đang refetch */}
                    {workItemsLoading && workItemsData && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(255, 255, 255, 0.7)',
                          backdropFilter: 'blur(2px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10,
                          borderRadius: 'var(--radius-lg)',
                          transition: 'opacity 0.3s ease',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '24px',
                              height: '24px',
                              border: '3px solid var(--border)',
                              borderTopColor: 'var(--primary)',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite',
                            }}
                          />
                          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Đang cập nhật...</span>
                        </div>
                      </div>
                    )}
                    <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '200px' }}>Tên công việc</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem', minWidth: '140px' }}>Tổng tháng</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem', minWidth: '140px' }}>Đã nhận</th>
                          <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600', fontSize: '0.875rem', minWidth: '140px' }}>Chưa nhận</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workItems.map((item, index) => {
                          const hasAction = item.pageUrl || item.clickAction;
                          const pageUrl = item.pageUrl || '';
                          const rowClass = hasAction ? 'work-item-row' : '';

                          return (
                            <tr
                              key={item.type}
                              className={rowClass}
                              data-page-url={hasAction ? pageUrl : undefined}
                              data-work-item-index={hasAction ? index : undefined}
                              onClick={() => {
                                if (hasAction && pageUrl) {
                                  if (pageUrl.startsWith('staff-cskh-detail:')) {
                                    navigate(`/staff/${id}/cskh`);
                                  } else {
                                    navigate(`/${pageUrl}`);
                                  }
                                }
                              }}
                              style={{
                                cursor: hasAction ? 'pointer' : 'default',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (hasAction) {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                } else {
                                  e.currentTarget.style.background = 'var(--bg-secondary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '';
                                e.currentTarget.style.transform = 'translateX(0)';
                              }}
                            >
                              <td style={{ padding: 'var(--spacing-3)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)' }}>
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                  </svg>
                                  <span style={{ fontWeight: 500, color: hasAction ? 'var(--primary)' : 'var(--text)' }}>
                                    {item.name}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                  {formatCurrencyVND(item.total || 0)}
                                </div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                                <div style={{ fontWeight: 500, color: '#059669' }}>
                                  {formatCurrencyVND(item.paid || 0)}
                                </div>
                              </td>
                              <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                                <div style={{ fontWeight: 500, color: '#dc2626' }}>
                                  {formatCurrencyVND(item.unpaid || 0)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="staff-detail-empty-state">
                    <p>Chưa có công việc nào trong tháng này.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Bonuses */}
        <div className="staff-detail-right-column">
          <div className="staff-detail-section">
            <div className="staff-detail-section-header">
              <h3 className="staff-detail-section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Thưởng tháng
              </h3>
              {canManageBonuses && (
                <button
                  className="btn btn-sm btn-primary"
                  id="addBonusBtn"
                  data-staff-id={staff.id}
                  data-month={selectedMonth}
                  onClick={() => {
                    setEditingBonus(null);
                    setAddBonusModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Thêm thưởng
                </button>
              )}
            </div>
            <div className="staff-detail-section-content">
              {/* Statistics Row */}
              <div style={{
                padding: 'var(--spacing-4)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderBottom: 'none',
                borderTopLeftRadius: 'var(--radius-lg)',
                borderTopRightRadius: 'var(--radius-lg)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--spacing-4)',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Tổng tháng</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--primary)' }}>
                    {formatCurrencyVND(bonusesStatistics.totalMonth)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Đã nhận</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#059669' }}>
                    {formatCurrencyVND(bonusesStatistics.paid)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>Chưa nhận</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#dc2626' }}>
                    {formatCurrencyVND(bonusesStatistics.unpaid)}
                  </div>
                </div>
              </div>
              {bonuses.length > 0 ? (
                <div className="table-container" style={{ borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)', borderTop: 'none', background: 'var(--bg)' }}>
                  <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
                        <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '180px' }}>Công việc</th>
                        <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '140px' }}>Trạng thái</th>
                        <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '140px' }}>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bonuses.map((bonus: Bonus) => {
                        const status = bonus.status || 'unpaid';
                        const statusText = status === 'paid' ? 'Đã thanh toán' : status === 'deposit' ? 'Cọc' : 'Chờ thanh toán';
                        const statusClass = status === 'paid' ? 'badge-success' : status === 'deposit' ? 'badge-warning' : 'badge-danger';

                        return (
                          <tr
                            key={bonus.id}
                            className="bonus-row"
                            data-bonus-id={bonus.id}
                            style={{
                              transition: 'all 0.2s ease',
                              cursor: canManageBonuses ? 'pointer' : 'default',
                            }}
                            title={canManageBonuses ? 'Click để chỉnh sửa' : ''}
                            onClick={(e) => {
                              // Don't trigger if clicking on delete button
                              if ((e.target as HTMLElement).closest('.btn-icon-delete')) {
                                return;
                              }
                              if (canManageBonuses) {
                                setEditingBonus(bonus);
                                setAddBonusModalOpen(true);
                              }
                            }}
                          >
                            <td style={{ padding: 'var(--spacing-3)', fontWeight: '500', color: 'var(--text)' }}>{bonus.work_type || 'Khác'}</td>
                            <td style={{ padding: 'var(--spacing-3)' }}>
                              <span
                                className={`badge ${statusClass}`}
                                style={{
                                  fontSize: 'var(--font-size-xs)',
                                  padding: '4px 10px',
                                  fontWeight: '500',
                                }}
                                title={statusText}
                              >
                                {statusText}
                              </span>
                            </td>
                            <td style={{ padding: 'var(--spacing-3)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-2)' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text)' }} title={formatCurrencyVND(bonus.amount || 0)}>
                                  {formatCurrencyVND(bonus.amount || 0)}
                                </div>
                                {canManageBonuses && (
                                  <button
                                    className="btn-icon-delete"
                                    data-bonus-id={bonus.id}
                                    title="Xóa"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: 'var(--danger)',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: 'var(--radius)',
                                      transition: 'all 0.2s ease',
                                      flexShrink: 0,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm('Bạn có chắc muốn xóa thưởng này?')) {
                                        deleteBonus(bonus.id)
                                          .then(() => {
                                            toast.success('Đã xóa thưởng');
                                            refetchBonuses();
                                          })
                                          .catch((error: any) => {
                                            toast.error('Không thể xóa thưởng: ' + (error.message || 'Lỗi không xác định'));
                                          });
                                      }
                                    }}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{
                  padding: 'var(--spacing-6)',
                  textAlign: 'center',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderBottomLeftRadius: 'var(--radius-lg)',
                  borderBottomRightRadius: 'var(--radius-lg)',
                }}>
                  <div className="staff-detail-empty-state-icon" style={{ marginBottom: 'var(--spacing-2)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '48px', height: '48px', color: 'var(--text-secondary)' }}>
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Chưa có thưởng nào trong tháng này.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Lịch sử buổi dạy</h3>
            {/* Month Navigation */}
            <div className="session-month-nav" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
              <button
                type="button"
                className="session-month-btn"
                onClick={() => handleMonthChange(-1)}
                title="Tháng trước"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  minWidth: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                ◀
              </button>
              <button
                type="button"
                className="session-month-label-btn"
                onClick={() => setMonthPopupOpen(!monthPopupOpen)}
                title="Chọn tháng/năm"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s ease',
                }}
              >
                <span style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>Tháng {formatMonthLabel(selectedMonth)}</span>
              </button>
              <button
                type="button"
                className="session-month-btn"
                onClick={() => handleMonthChange(1)}
                title="Tháng sau"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  minWidth: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                ▶
              </button>
              {/* Month Popup */}
              {monthPopupOpen && (
                <div
                  id="staffMonthPopup"
                  className="session-month-popup"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '6px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '6px 8px 8px',
                    zIndex: 30,
                    minWidth: '200px',
                  }}
                >
                  <div className="session-month-popup-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', fontSize: 'var(--font-size-xs)' }}>
                    <button
                      type="button"
                      className="session-month-year-btn"
                      onClick={() => handleYearChange(-1)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: 'var(--radius)',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      ‹
                    </button>
                    <span style={{ fontWeight: '500' }}>{year}</span>
                    <button
                      type="button"
                      className="session-month-year-btn"
                      onClick={() => handleYearChange(1)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '2px 4px',
                        borderRadius: 'var(--radius)',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      ›
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '2px',
                    }}
                  >
                    {monthNames.map((label, idx) => {
                      const val = String(idx + 1).padStart(2, '0');
                      const isActive = val === month;
                      return (
                        <button
                          key={val}
                          type="button"
                          className={`session-month-cell${isActive ? ' active' : ''}`}
                          data-month={val}
                          onClick={() => handleMonthSelect(val)}
                          style={{
                            padding: '4px 6px',
                            borderRadius: 'var(--radius)',
                            border: 'none',
                            background: isActive ? 'var(--primary)' : 'transparent',
                            color: isActive ? 'white' : 'var(--text)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: isActive ? '600' : '400',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'var(--bg)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Ngày</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Thời gian</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', borderBottom: '2px solid var(--border)' }}>Trợ cấp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {monthSessions.map((session) => {
                  const cls = classes.find((c) => c.id === session.class_id);
                  const sessionAllowance = getSessionAllowance(session);
                  return (
                    <tr key={session.id}>
                      <td style={{ padding: 'var(--spacing-3)' }}>{formatDate(session.date) || '-'}</td>
                      <td style={{ padding: 'var(--spacing-3)' }}>{cls?.name || '-'}</td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        {session.start_time ? session.start_time.slice(0, 5) : '-'} - {session.end_time ? session.end_time.slice(0, 5) : '-'}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '500' }}>
                        {sessionAllowance > 0 ? formatCurrencyVND(sessionAllowance) : '-'}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        <span
                          className={`badge ${session.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}
                          style={{
                            padding: 'var(--spacing-1) var(--spacing-2)',
                            borderRadius: 'var(--radius)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: '500',
                            background: session.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                            color: session.payment_status === 'paid' ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {session.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3} style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600' }}>
                    Tổng trợ cấp:
                  </td>
                  <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>
                    {formatCurrencyVND(monthSessions.reduce((sum, s) => sum + getSessionAllowance(s), 0))}
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Bonus Modal - Only render when open */}
      {addBonusModalOpen && (
        <BonusModal
          isOpen={addBonusModalOpen}
          onClose={handleCloseBonusModal}
          staffId={id || ''}
          month={selectedMonth}
          bonus={editingBonus}
          staff={staff}
          onSave={handleSaveBonus}
        />
      )}

      {/* QR Edit Modal - Only render when open */}
      {qrEditModalOpen && (
        <QREditModal
          isOpen={qrEditModalOpen}
          onClose={handleCloseQrModal}
          staffId={id || ''}
          currentQrLink={qrPaymentLink || ''}
          onSave={handleSaveQr}
        />
      )}

      {/* Deposit Details Modal - Only render when open */}
      {depositDetailsModalOpen && (
        <DepositDetailsModal
          isOpen={depositDetailsModalOpen}
          onClose={handleCloseDepositModal}
          staffId={id || ''}
          staff={staff}
          sessions={sessions}
          bonuses={bonuses}
          classes={classes}
        />
      )}

      {/* Edit Staff Modal - Only render when open */}
      {editStaffModalOpen && (
        <Modal
          title="Chỉnh sửa thông tin nhân sự"
          isOpen={editStaffModalOpen}
          onClose={handleCloseEditStaffModal}
          size="lg"
        >
          {staff && (
            <EditStaffModal
              staffId={id!}
              staff={staff}
              onSuccess={handleSuccessEditStaff}
              onClose={handleCloseEditStaffModal}
            />
          )}
        </Modal>
      )}

      {/* Staff Info Panel (Sidebar) - Only render when open */}
      {staffInfoPanelOpen && staff && (
        <StaffInfoPanel
          staff={staff}
          canEdit={canManageStaff}
          onClose={handleCloseStaffInfoPanel}
          onEdit={handleEditFromInfoPanel}
        />
      )}
    </div>
  );
}

// Bonus Modal Component
function BonusModal({
  isOpen,
  onClose,
  staffId,
  month,
  bonus,
  onSave,
  staff,
}: {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  month: string;
  bonus?: Bonus | null;
  onSave: () => void;
  staff?: any;
}) {
  const [workType, setWorkType] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'deposit'>('unpaid');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Get work types from staff roles (giống backup)
  const workTypes = useMemo(() => {
    const roles = staff?.roles || [];
    const types: string[] = [];
    if (roles.includes('teacher')) types.push('Gia sư');
    if (roles.includes('lesson_plan')) types.push('Giáo án');
    if (roles.includes('accountant')) types.push('Kế toán');
    if (roles.includes('cskh_sale')) types.push('CSKH & SALE');
    if (roles.includes('communication')) types.push('Truyền thông');
    if (types.length === 0) types.push('Khác');
    return types;
  }, [staff?.roles]);

  // Prefill form when modal opens or bonus changes
  useEffect(() => {
    if (isOpen) {
      if (bonus && bonus.id) {
        // Edit mode: prefill from bonus
        setWorkType(bonus.work_type || '');
        setAmount(bonus.amount ?? 0);
        setStatus(bonus.status || 'unpaid');
        setNote(bonus.note || '');
      } else {
        // Add mode: reset to defaults
        setWorkType('');
        setAmount(0);
        setStatus('unpaid');
        setNote('');
      }
    } else {
      // Reset when modal closes
      setWorkType('');
      setAmount(0);
      setStatus('unpaid');
      setNote('');
    }
  }, [isOpen, bonus?.id]); // Use bonus?.id as key to detect bonus changes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workType.trim()) {
      toast.warning('Vui lòng chọn công việc');
      return;
    }

    if (!Number.isFinite(amount)) {
      toast.warning('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setLoading(true);
    try {
      if (bonus) {
        await updateBonus(bonus.id, {
          work_type: workType.trim(),
          amount: amount,
          status,
          note: note.trim() || undefined,
          month,
        });
        toast.success('Đã cập nhật thưởng');
      } else {
        await createBonus({
          staff_id: staffId,
          work_type: workType.trim(),
          amount: amount,
          status,
          note: note.trim() || undefined,
          month,
        });
        toast.success('Đã thêm thưởng mới');
      }
      onSave();
    } catch (error: any) {
      toast.error('Không thể lưu thưởng: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={bonus ? 'Chỉnh sửa thưởng' : 'Thêm thưởng mới'}
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Công việc <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <option value="">-- Chọn công việc --</option>
            {workTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Số tiền <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <CurrencyInput
            value={amount}
            onChange={(value) => setAmount(value)}
            required
            placeholder="Ví dụ: 1.500.000"
            showHint={true}
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Trạng thái <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'paid' | 'unpaid' | 'deposit')}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <option value="unpaid">Chờ thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="deposit">Cọc</option>
          </select>
        </div>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Ghi chú
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Ghi chú về thưởng này..."
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Đang lưu...' : bonus ? 'Cập nhật' : 'Thêm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// QR Edit Modal Component
function QREditModal({
  isOpen,
  onClose,
  staffId,
  currentQrLink,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  currentQrLink: string;
  onSave: () => void;
}) {
  const [qrLink, setQrLink] = useState(currentQrLink);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQrLink(currentQrLink);
    }
  }, [isOpen, currentQrLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate URL if provided
    if (qrLink.trim() && !/^https?:\/\/.+/i.test(qrLink.trim())) {
      toast.warning('Link QR thanh toán không hợp lệ. Vui lòng nhập link bắt đầu bằng http hoặc https.');
      return;
    }

    setLoading(true);
    try {
      await updateStaffQrPaymentLink(staffId, qrLink.trim() || '');
      toast.success('Đã cập nhật link QR thanh toán');
      onSave();
    } catch (error: any) {
      toast.error('Không thể lưu link QR: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Chỉnh sửa link QR thanh toán"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Link QR thanh toán
          </label>
          <input
            type="url"
            value={qrLink}
            onChange={(e) => setQrLink(e.target.value)}
            placeholder="https://drive.google.com/... hoặc link ảnh QR"
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />
          <p style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Thêm link ảnh QR thanh toán (để trống nếu muốn xóa).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Staff Modal Component
function EditStaffModal({
  staffId,
  staff,
  onSuccess,
  onClose,
}: {
  staffId: string;
  staff: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: staff.fullName || staff.full_name || '',
    birthDate: staff.birthDate || staff.birth_date || '',
    university: staff.university || '',
    highSchool: staff.highSchool || staff.high_school || '',
    province: staff.province || '',
    email: staff.email || staff.gmail || '',
    phone: staff.phone || '',
    specialization: staff.specialization || '',
    qrPaymentLink: (staff as any).bank_qr_link || (staff as any).bankQRLink || (staff as any).qr_payment_link || '',
    accountHandle: (staff as any).accountHandle || (staff as any).account_handle || '',
    accountPassword: '',
    roles: staff.roles || [],
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginInfo, setLoginInfo] = useState<{
    accountHandle: string | null;
    hasPassword: boolean;
    password: string | null;
  } | null>(null);
  const [originalPassword, setOriginalPassword] = useState<string | null>(null);

  // Load login info from DB when modal opens
  useEffect(() => {
    const loadLoginInfo = async () => {
      try {
        const info = await getStaffLoginInfo(staffId);
        if (info) {
          setLoginInfo(info);
          // Prefill account handle
          if (info.accountHandle) {
            setFormData((prev) => ({ ...prev, accountHandle: info.accountHandle || '' }));
          }
          // Prefill password bằng hash hiện tại để admin nhìn/ghi chú được
          if (info.hasPassword && info.password) {
            setOriginalPassword(info.password);
            setFormData((prev) => ({ ...prev, accountPassword: info.password || '' }));
          }
        }
      } catch (error) {
        console.error('Failed to load login info:', error);
      }
    };
    loadLoginInfo();
  }, [staffId]);

  const STAFF_ROLES = {
    TEACHER: 'teacher',
    LESSON_PLAN: 'lesson_plan',
    ACCOUNTANT: 'accountant',
    CSKH_SALE: 'cskh_sale',
    COMMUNICATION: 'communication',
  };

  const handleRoleChange = (role: string, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, roles: [...formData.roles, role] });
    } else {
      setFormData({ ...formData, roles: formData.roles.filter((r) => r !== role) });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation (đồng bộ với backup: bắt buộc họ tên, ngày sinh, trường, tỉnh, email, SĐT)
    if (
      !formData.fullName.trim() ||
      !formData.birthDate ||
      !formData.highSchool.trim() ||
      !formData.province.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim()
    ) {
      toast.warning('Vui lòng điền đầy đủ tất cả các trường bắt buộc');
      return;
    }

    // Email validation
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        toast.warning('Email không hợp lệ');
        return;
      }
    }

    // Phone validation
    if (formData.phone.trim()) {
      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(formData.phone.trim().replace(/\s/g, ''))) {
        toast.warning('Số điện thoại không hợp lệ (10-11 chữ số)');
        return;
      }
    }

    // QR link validation
    if (formData.qrPaymentLink.trim() && !/^https?:\/\/.+/i.test(formData.qrPaymentLink.trim())) {
      toast.warning('Link QR thanh toán không hợp lệ. Vui lòng nhập link bắt đầu bằng http hoặc https.');
      return;
    }

    // Gửi đủ tất cả trường để DB cập nhật đúng (chuỗi rỗng = xóa nội dung ô, trừ handle sẽ giữ nguyên nếu không nhập gì)
    const updateData: any = {
      fullName: formData.fullName.trim(),
      province: formData.province.trim(),
      roles: formData.roles.length > 0 ? formData.roles : [STAFF_ROLES.TEACHER],
      ...(formData.birthDate ? { birthDate: formData.birthDate } : {}),
      university: (formData.university || '').trim(),
      highSchool: (formData.highSchool || '').trim(),
      email: (formData.email || '').trim(),
      phone: (formData.phone || '').trim(),
      specialization: (formData.specialization || '').trim(),
    };

    // Đồng bộ logic accountHandle với backup:
    // - Nếu user nhập handle mới -> dùng handle mới
    // - Nếu để trống -> giữ nguyên handle từ DB (loginInfo hoặc staff hiện tại)
    const trimmedHandle = (formData.accountHandle || '').trim();
    if (trimmedHandle) {
      updateData.accountHandle = trimmedHandle;
    } else if (loginInfo?.accountHandle) {
      updateData.accountHandle = loginInfo.accountHandle;
    } else {
      const existingHandle =
        (staff as any)?.accountHandle ||
        (staff as any)?.account_handle ||
        null;
      if (existingHandle) {
        updateData.accountHandle = existingHandle;
      }
    }

    // Only update password if provided (if empty, backend will keep old password)
    // Handle password: if empty or same as original (hash), keep old password
    let effectivePassword = '';
    if (!formData.accountPassword || formData.accountPassword.trim() === '') {
      // Empty -> keep old password (don't send password field)
      if (loginInfo?.hasPassword && originalPassword) {
        effectivePassword = originalPassword;
      }
    } else if (originalPassword && formData.accountPassword === originalPassword) {
      // Same as original hash -> keep old password
      effectivePassword = originalPassword;
    } else {
      // New password -> use new password
      effectivePassword = formData.accountPassword;
    }

    // Only update password if it's different from original
    if (effectivePassword && effectivePassword !== originalPassword) {
      updateData.accountPassword = effectivePassword;
    }

    const payloadForLog = { ...updateData };
    if (payloadForLog.accountPassword) payloadForLog.accountPassword = '[REDACTED]';
    console.log('[StaffDetail save] staffId=', staffId, 'updateData keys=', Object.keys(updateData), 'payload (no password)=', payloadForLog);

    setLoading(true);
    try {
      await updateTeacher(staffId, updateData);
      console.log('[StaffDetail save] updateTeacher OK');

      // Update QR link separately if changed
      const currentQrLink = (staff as any).qr_payment_link || (staff as any).qrPaymentLink || (staff as any).bank_qr_link || (staff as any).bankQRLink || '';
      if (formData.qrPaymentLink !== currentQrLink) {
        await updateStaffQrPaymentLink(staffId, formData.qrPaymentLink);
      }

      toast.success('Đã cập nhật thông tin nhân sự');
      onSuccess();
    } catch (error: any) {
      console.error('[StaffDetail save] error:', error?.message, 'response=', error?.response?.status, error?.response?.data);
      toast.error('Lỗi khi cập nhật nhân sự: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="staff-form-enhanced">
      {/* Thông tin cá nhân */}
      <div className="form-section">
        <div className="form-section-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <h3>Thông tin cá nhân</h3>
        </div>
        <div className="form-section-content">
          <div className="form-group-enhanced">
            <label htmlFor="editStaffFullName" className="form-label-with-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Họ tên <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              id="editStaffFullName"
              className="form-control-enhanced"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Nhập họ và tên đầy đủ"
              autoComplete="name"
              required
            />
          </div>
          <div className="form-group-enhanced">
            <label htmlFor="editStaffBirthDate" className="form-label-with-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Ngày tháng năm sinh <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="date"
              id="editStaffBirthDate"
              className="form-control-enhanced date-input"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              autoComplete="bday"
              required
            />
          </div>
          <div className="form-row-enhanced">
            <div className="form-group-enhanced">
              <label htmlFor="editStaffUniversity" className="form-label-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Đại học
              </label>
              <input
                type="text"
                id="editStaffUniversity"
                className="form-control-enhanced"
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                placeholder="Tên trường đại học (tùy chọn)"
              />
            </div>
            <div className="form-group-enhanced">
              <label htmlFor="editStaffHighSchool" className="form-label-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Trường THPT <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                id="editStaffHighSchool"
                className="form-control-enhanced"
                value={formData.highSchool}
                onChange={(e) => setFormData({ ...formData, highSchool: e.target.value })}
                placeholder="Tên trường THPT"
                required
              />
            </div>
          </div>
          <div className="form-group-enhanced">
            <label htmlFor="editStaffProvince" className="form-label-with-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Tỉnh thành <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              id="editStaffProvince"
              className="form-control-enhanced"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              placeholder="Tỉnh/Thành phố"
              required
            />
          </div>
          <div className="form-group-enhanced">
            <label htmlFor="editStaffQrPaymentLink" className="form-label-with-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="5" height="5" />
                <rect x="16" y="3" width="5" height="5" />
                <rect x="3" y="16" width="5" height="5" />
                <rect x="16" y="16" width="5" height="5" />
                <path d="M11 3h2v18h-2z" />
                <path d="M3 11h18v2H3z" />
              </svg>
              Link QR thanh toán
            </label>
            <input
              type="url"
              id="editStaffQrPaymentLink"
              className="form-control-enhanced"
              value={formData.qrPaymentLink}
              onChange={(e) => setFormData({ ...formData, qrPaymentLink: e.target.value })}
              placeholder="https://drive.google.com/... hoặc link ảnh QR"
            />
            <small className="form-hint">Thêm link ảnh QR thanh toán (để trống nếu muốn xóa).</small>
          </div>
        </div>
      </div>

      {/* Liên hệ */}
      <div className="form-section">
        <div className="form-section-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <h3>Liên hệ</h3>
        </div>
        <div className="form-section-content">
          <div className="form-row-enhanced">
            <div className="form-group-enhanced">
              <label htmlFor="editStaffEmail" className="form-label-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="email"
                id="editStaffEmail"
                className="form-control-enhanced"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group-enhanced">
              <label htmlFor="editStaffPhone" className="form-label-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Số điện thoại <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="tel"
                id="editStaffPhone"
                className="form-control-enhanced"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0912345678"
                autoComplete="tel"
                required
              />
            </div>
          </div>
          <div className="form-group-enhanced">
            <label htmlFor="editStaffSpecialization" className="form-label-with-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Mô tả chuyên môn
            </label>
            <textarea
              id="editStaffSpecialization"
              className="form-control-enhanced"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="Mô tả chi tiết về chuyên môn, kinh nghiệm..."
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Thông tin đăng nhập */}
      <div className="form-section">
        <div className="form-section-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h3>Thông tin đăng nhập</h3>
        </div>
        <div className="form-section-content">
          <div className="form-row-enhanced">
            <div className="form-group-enhanced">
              <label htmlFor="editStaffAccountHandle" className="form-label-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Handle đăng nhập
              </label>
              <input
                type="text"
                id="editStaffAccountHandle"
                className="form-control-enhanced"
                value={formData.accountHandle}
                onChange={(e) => setFormData({ ...formData, accountHandle: e.target.value })}
                placeholder="Tên đăng nhập (ví dụ: nguyenvana)"
                autoComplete="username"
              />
              <small className="form-hint">Dùng để đăng nhập thay cho email</small>
            </div>
            <div className="form-group-enhanced">
              <label htmlFor="editStaffAccountPassword" className="form-label-with-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Mật khẩu (để trống nếu không đổi)
              </label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="editStaffAccountPassword"
                  className="form-control-enhanced"
                  value={formData.accountPassword}
                  onChange={(e) => setFormData({ ...formData, accountPassword: e.target.value })}
                  placeholder={loginInfo?.hasPassword ? 'Mật khẩu hiện tại (ẩn), nhập mới để thay đổi' : 'Nhập mật khẩu mới (nếu muốn đổi)'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn-enhanced"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Hiện/ẩn mật khẩu"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="password-eye-off-icon">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="password-eye-icon">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <small className="form-hint">
                {loginInfo?.hasPassword
                  ? 'Mật khẩu đã được khai báo. Để trống nếu không muốn thay đổi, hoặc nhập mật khẩu mới.'
                  : 'Chưa có mật khẩu. Nhập mật khẩu mới nếu muốn thiết lập.'}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Chức vụ */}
      <div className="form-section">
        <div className="form-section-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>Chức vụ</h3>
        </div>
        <div className="form-section-content">
          <div className="staff-roles-checkboxes-enhanced">
            {[
              { value: STAFF_ROLES.TEACHER, label: 'Gia sư' },
              { value: STAFF_ROLES.LESSON_PLAN, label: 'Giáo án' },
              { value: STAFF_ROLES.ACCOUNTANT, label: 'Kế toán' },
              { value: STAFF_ROLES.CSKH_SALE, label: 'CSKH & SALE' },
              { value: STAFF_ROLES.COMMUNICATION, label: 'Truyền thông' },
            ].map((role) => (
              <label key={role.value} className="role-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.roles.includes(role.value)}
                  onChange={(e) => handleRoleChange(role.value, e.target.checked)}
                />
                <span className="role-checkbox-custom"></span>
                <span className="role-checkbox-text">{role.label}</span>
              </label>
            ))}
          </div>
          <small className="form-hint">Một nhân sự có thể đảm nhận nhiều chức vụ</small>
        </div>
      </div>

      <div className="form-actions-enhanced">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {loading ? 'Đang lưu...' : 'Cập nhật'}
        </button>
      </div>
    </form>
  );
}

// Staff Info Panel Component (Sidebar)
function StaffInfoPanel({
  staff,
  canEdit,
  onClose,
  onEdit,
}: {
  staff: any;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add active class after mount to trigger animation (like backup)
    setTimeout(() => {
      if (backdropRef.current) {
        backdropRef.current.classList.add('active');
      }
      if (panelRef.current) {
        panelRef.current.classList.add('active');
      }
    }, 10);
  }, []);

  const handleClose = () => {
    // Remove active class to trigger close animation
    if (backdropRef.current) {
      backdropRef.current.classList.remove('active');
    }
    if (panelRef.current) {
      panelRef.current.classList.remove('active');
    }
    // Call onClose after animation completes (300ms)
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const roleLabels: Record<string, string> = {
    teacher: 'Gia sư',
    lesson_plan: 'Giáo án',
    accountant: 'Kế toán',
    cskh_sale: 'CSKH & SALE',
    communication: 'Truyền thông',
  };

  const roles = staff.roles || [];

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="teacher-info-backdrop staff-info-backdrop"
        onClick={handleClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="teacher-info-panel staff-info-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '500px',
          background: 'var(--bg)',
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
          zIndex: 2001,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div
          className="teacher-info-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--spacing-4)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Thông tin cá nhân</h3>
          <button
            className="btn-icon-close"
            onClick={handleClose}
            aria-label="Đóng"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: 'var(--bg-secondary)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div
          className="teacher-info-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--spacing-4)',
          }}
        >
          <div className="teacher-info-view">
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Họ tên
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>{staff.fullName || staff.full_name || '-'}</div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Ngày sinh
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>
                {staff.birthDate || staff.birth_date
                  ? new Date((staff.birthDate || staff.birth_date) + 'T00:00:00').toLocaleDateString('vi-VN')
                  : '-'}
              </div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Email
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>{staff.email || staff.gmail || '-'}</div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Số điện thoại
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>{(staff as any).phone || '-'}</div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Đại học
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>{staff.university || '-'}</div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Trường THPT
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>{staff.highSchool || staff.high_school || '-'}</div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Tỉnh thành
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>{staff.province || '-'}</div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Mô tả chuyên môn
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500', whiteSpace: 'pre-wrap' }}>
                {staff.specialization || '-'}
              </div>
            </div>
            <div className="info-item" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label style={{ display: 'block', marginBottom: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem', fontWeight: '500' }}>
                Chức vụ
              </label>
              <div className="info-value" style={{ color: 'var(--text)', fontWeight: '500' }}>
                {roles.length > 0 ? roles.map((role: string) => roleLabels[role] || role).join(', ') : 'Gia sư'}
              </div>
            </div>
            {canEdit && (
              <div className="info-actions" style={{ marginTop: 'var(--spacing-6)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleClose();
                    // Delay onEdit to allow close animation
                    setTimeout(() => {
                      onEdit();
                    }, 300);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--spacing-2)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Chỉnh sửa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Deposit Details Modal Component
interface DepositDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staff: any;
  sessions: any[];
  bonuses: any[];
  classes: any[];
}

function DepositDetailsModal({ isOpen, onClose, staffId, staff, sessions, bonuses, classes }: DepositDetailsModalProps) {
  const roles = staff?.roles || [];
  const isTeacher = roles.includes('teacher') || roles.length === 0;

  // Get all deposit sessions (if teacher)
  const depositSessions = useMemo(() => {
    if (!isTeacher) return [];
    const allSessionsForStaff = sessions.filter((s) => s.teacher_id === staffId || s.teacherId === staffId);
    const depositSessionsData = allSessionsForStaff.filter((s) => (s.payment_status || 'unpaid') === 'deposit');

    return depositSessionsData.map((session) => {
      const cls = classes.find((c) => c.id === session.class_id || c.id === session.classId);
      const allowanceAmount = session.allowance_amount || 0;
      const date = session.date ? formatDate(session.date) : '-';

      return {
        type: 'session',
        id: session.id,
        className: cls?.name || 'Không xác định',
        date: date,
        amount: allowanceAmount,
        notes: session.notes || '',
      };
    });
  }, [isTeacher, sessions, staffId, classes]);

  // Get all deposit bonuses
  const depositBonuses = useMemo(() => {
    const depositBonusesData = bonuses.filter((b) => (b.status || 'unpaid') === 'deposit');

    return depositBonusesData.map((bonus) => {
      const date = bonus.date ? formatDate(bonus.date) : '-';
      const amount = bonus.amount || 0;

      return {
        type: 'bonus',
        id: bonus.id,
        role: 'Trợ cấp',
        taskName: bonus.description || bonus.notes || 'Trợ cấp',
        date: date,
        amount: amount,
        notes: bonus.notes || bonus.description || '',
      };
    });
  }, [bonuses]);

  // Combine and sort all deposits
  const allDeposits = useMemo(() => {
    const combined = [...depositSessions, ...depositBonuses];
    return combined.sort((a, b) => {
      const dateA = a.date && a.date !== '-' ? new Date(a.date.split('/').reverse().join('-')) : new Date(0);
      const dateB = b.date && b.date !== '-' ? new Date(b.date.split('/').reverse().join('-')) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [depositSessions, depositBonuses]);

  const totalDeposit = allDeposits.reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <Modal title="Chi tiết tiền cọc" isOpen={isOpen} onClose={onClose} size="lg">
      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <h3 style={{ margin: 0 }}>Chi tiết tiền cọc</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 'var(--spacing-2)' }}>
            Tổng cộng: <strong>{formatCurrencyVND(totalDeposit)}</strong>
          </p>
        </div>

        {allDeposits.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 'var(--spacing-8)' }}>
            Chưa có tiền cọc nào
          </div>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="table-striped" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Thông tin</th>
                  <th>Ngày</th>
                  <th>Số tiền</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {allDeposits.map((item) => (
                  <tr key={`${item.type}-${item.id}`}>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      {item.type === 'session' ? (
                        <span className="badge badge-primary">Buổi dạy</span>
                      ) : (
                        <span className="badge badge-info">Công việc</span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      {item.type === 'session' ? (
                        <strong>{item.className}</strong>
                      ) : (
                        <>
                          <strong>{item.role}</strong>
                          <br />
                          <small style={{ color: 'var(--muted)' }}>{item.taskName}</small>
                        </>
                      )}
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>{item.date}</td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <strong>{formatCurrencyVND(item.amount)}</strong>
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <small style={{ color: 'var(--muted)' }}>{item.notes || '-'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default StaffDetail;
