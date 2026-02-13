import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchDashboardData, fetchQuickViewData, DashboardParams } from '../services/dashboardService';
import { fetchTeachers } from '../services/teachersService';
import { useAuthStore } from '../store/authStore';
import { formatCurrencyVND, formatNumber, formatMonthKey } from '../utils/formatters';
import { DualLineChart } from '../components/DualLineChart';
import { DashboardAlert } from '../components/DashboardAlert';

/**
 * Dashboard Page Component
 * Migrated from backup/assets/js/pages/dashboard.js
 * UI giống hệt app cũ với UX tối ưu loading
 */

const QUICK_VIEW_TABS = [
  { id: 'finance', label: 'Tài chính' },
  { id: 'operations', label: 'Vận hành' },
  { id: 'students', label: 'Học viên' },
];

function getDefaultPeriodValue(type: 'month' | 'quarter' | 'year'): string {
  const now = new Date();
  const year = now.getFullYear();
  const monthValue = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (type === 'year') return `${year}`;
  if (type === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }
  return monthValue;
}

function getFilterRange(state: ReturnType<typeof getDefaultDashboardState>) {
  const type = state.filterType || 'month';
  const value = state.filterValue || getDefaultPeriodValue(type);

  if (type === 'quarter') {
    const matches = value.match(/^(\d{4})-Q([1-4])$/);
    const year = matches ? Number(matches[1]) : new Date().getFullYear();
    const quarter = matches ? Number(matches[2]) : 1;
    const monthIndex = (quarter - 1) * 3;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 3, 0, 23, 59, 59, 999);
    return {
      type,
      value,
      start,
      end,
      label: `Quý ${quarter} • ${year}`,
      shortLabel: `Q${quarter}/${String(year).slice(-2)}`,
    };
  }

  if (type === 'year') {
    const year = Number(value) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return {
      type,
      value,
      start,
      end,
      label: `Năm ${year}`,
      shortLabel: `${year}`,
    };
  }

  // Month
  const matches = value.match(/^(\d{4})-(\d{2})$/);
  const year = matches ? Number(matches[1]) : new Date().getFullYear();
  const month = matches ? Number(matches[2]) - 1 : new Date().getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return {
    type,
    value,
    start,
    end,
    label: `Tháng ${String(month + 1).padStart(2, '0')} • ${year}`,
    shortLabel: `T${String(month + 1).padStart(2, '0')}/${String(year).slice(-2)}`,
  };
}

function getDefaultDashboardState() {
  return {
    filterType: 'month' as 'month' | 'quarter' | 'year',
    filterValue: getDefaultPeriodValue('month'),
    quickView: 'finance' as 'finance' | 'operations' | 'students',
    quickViewYear: new Date().getFullYear().toString(),
    chartPanelOpen: false,
  };
}

function loadStoredDashboardState() {
  try {
    const stored = localStorage.getItem('unicorns.dashboard.state');
    if (!stored) return getDefaultDashboardState();
    const parsed = JSON.parse(stored);
    return {
      ...getDefaultDashboardState(),
      ...parsed,
      filterValue: parsed.filterValue || getDefaultPeriodValue(parsed.filterType || 'month'),
    };
  } catch {
    return getDefaultDashboardState();
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [state, setState] = useState(loadStoredDashboardState());
  const hasRedirectedRef = useRef(false);
  
  // Reset redirect flag when user changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [user?.id]);
  
  // Redirect logic cho teacher/staff: tự động redirect đến staff-detail NGAY LẬP TỨC
  // Ưu tiên: Nếu có linkId, redirect ngay mà không cần fetch teachers
  useEffect(() => {
    // Check if already on staff-detail page to avoid redirect loop
    const currentPath = location.pathname;
    if (currentPath.startsWith('/staff/')) {
      hasRedirectedRef.current = true; // Mark as redirected if already on staff page
      return; // Already on staff detail page, don't redirect
    }
    
    if (!user) {
      return;
    }
    
    // Check if user is teacher role
    const isTeacherRole = user.role === 'teacher';
    if (!isTeacherRole) {
      return; // Not a teacher/staff user
    }
    
    // Nếu có linkId, redirect ngay lập tức mà không cần fetch teachers
    if (user.linkId) {
      if (!hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      const targetPath = `/staff/${user.linkId}`;
      if (currentPath !== targetPath) {
        navigate(targetPath, { replace: true });
        }
      }
      return;
    }
  }, [user?.id, user?.role, user?.linkId, navigate, location.pathname]);
  
  // CHỈ fetch teachers nếu không có linkId và cần tìm teacher record
  const needsTeacherLookup = user?.role === 'teacher' && !user?.linkId;
  const { data: teachersData, isLoading: isLoadingTeachers } = useDataLoading(
    () => fetchTeachers(),
    [],
    { 
      cacheKey: 'teachers-for-dashboard-redirect', 
      staleTime: 5 * 60 * 1000,
      enabled: needsTeacherLookup // CHỈ fetch nếu không có linkId
    }
  );
  
  const teachers = Array.isArray(teachersData) ? teachersData : [];
  
  // Fallback: Nếu không có linkId, tìm teacher record từ teachers list
  useEffect(() => {
    // Check if already on staff-detail page to avoid redirect loop
    const currentPath = location.pathname;
    if (currentPath.startsWith('/staff/')) {
      hasRedirectedRef.current = true; // Mark as redirected if already on staff page
      return; // Already on staff detail page, don't redirect
    }
    
    if (!user || !needsTeacherLookup) {
      return;
    }
    
    // Chỉ redirect khi teachers data đã load xong
    if (isLoadingTeachers) {
      return; // Wait for teachers data
    }
    
    // Nếu đã redirect rồi thì không redirect nữa
    if (hasRedirectedRef.current) {
      return;
    }
    
    // Tìm teacher record theo userId hoặc email
    let teacherRecord = null;
    
    if (user.id && teachers.length > 0) {
      teacherRecord = teachers.find((t) => (t as any).userId === user.id);
    }
    
    if (!teacherRecord && user.email && teachers.length > 0) {
      teacherRecord = teachers.find((t) => 
        t.email?.toLowerCase() === user.email?.toLowerCase()
      );
    }
    
    if (teacherRecord) {
      // Mark as redirected to prevent multiple redirects
      hasRedirectedRef.current = true;
      // Redirect đến staff-detail của teacher này NGAY LẬP TỨC
      const targetPath = `/staff/${teacherRecord.id}`;
      if (currentPath !== targetPath) {
        navigate(targetPath, { replace: true });
      }
      return;
    } else if (teachers.length > 0) {
      // Nếu không tìm thấy teacher record sau khi đã load teachers, log để debug
      console.warn('[Dashboard] Teacher record not found for user:', {
        userId: user.id,
        linkId: user.linkId,
        email: user.email,
        role: user.role,
        teachersCount: teachers.length
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, teachers.length, isLoadingTeachers, needsTeacherLookup, navigate, location.pathname]);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem('unicorns.dashboard.state', JSON.stringify(state));
  }, [state]);

  // Stable fetch function for dashboard data
  const fetchDashboardDataFn = useCallback(
    () => fetchDashboardData({
      filterType: state.filterType,
      filterValue: state.filterValue,
    }),
    [state.filterType, state.filterValue]
  );

  // Stable fetch function for quick view data
  const fetchQuickViewDataFn = useCallback(
    () => fetchQuickViewData(state.quickViewYear),
    [state.quickViewYear]
  );

  // Fetch dashboard data with optimized loading
  // Chỉ fetch nếu user là admin (teacher sẽ được redirect)
  const { data, isLoading, error, refetch } = useDataLoading(
    fetchDashboardDataFn,
    [state.filterType, state.filterValue],
    {
      cacheKey: `dashboard-${state.filterType}-${state.filterValue}`,
      staleTime: 2 * 60 * 1000, // 2 minutes
      enabled: user?.role === 'admin', // Chỉ fetch cho admin
    }
  );

  // Optimistic revenue updates - chỉ cộng/trừ transaction mới, không tính lại từ đầu
  const [revenueAdjustment, setRevenueAdjustment] = useState<number>(0);

  // Khi số dư học sinh thay đổi (topup/loan/refund/...) → xóa cache dashboard để quay lại sẽ refetch bảng gia hạn
  const invalidateDashboardCacheStorage = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('dashboard-')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch (e) {
      // Ignore
    }
  }, []);

  // Listen for wallet transaction events: xóa cache dashboard (bảng gia hạn refetch khi quay lại) + optimistic revenue nếu topup
  useEffect(() => {
    if (user?.role !== 'admin') return;

    const handleWalletTransactionCreated = (event: CustomEvent) => {
      const { type, amount, date } = event.detail || {};
      // Bất kỳ giao dịch nào ảnh hưởng số dư → xóa cache để dashboard refetch bảng gia hạn khi quay lại
      invalidateDashboardCacheStorage();
      // Optimistic doanh thu chỉ cho topup trong range hiện tại
      if (type === 'topup' && amount !== 0) {
        const range = getFilterRange(state);
        const transactionDate = new Date(date);
        if (transactionDate >= range.start && transactionDate <= range.end) {
          setRevenueAdjustment((prev) => prev + amount);
        }
      }
    };

    window.addEventListener('wallet-transaction-created', handleWalletTransactionCreated as EventListener);

    return () => {
      window.removeEventListener('wallet-transaction-created', handleWalletTransactionCreated as EventListener);
    };
  }, [user?.role, state, invalidateDashboardCacheStorage]);

  // Reset revenue adjustment khi filter thay đổi
  useEffect(() => {
    setRevenueAdjustment(0);
  }, [state.filterType, state.filterValue]);

  // Fetch quick view data
  // Chỉ fetch nếu user là admin (teacher sẽ được redirect)
  const { data: quickView, isLoading: quickViewLoading } = useDataLoading(
    fetchQuickViewDataFn,
    [state.quickViewYear],
    {
      cacheKey: `quickview-${state.quickViewYear}`,
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: user?.role === 'admin', // Chỉ fetch cho admin
    }
  );

  const handleFilterTypeChange = (type: 'month' | 'quarter' | 'year') => {
    setState((prev: ReturnType<typeof getDefaultDashboardState>) => ({
      ...prev,
      filterType: type,
      filterValue: getDefaultPeriodValue(type),
    }));
  };

  const handleFilterValueChange = (value: string) => {
    setState((prev: ReturnType<typeof getDefaultDashboardState>) => ({
      ...prev,
      filterValue: value,
    }));
  };

  const handleQuickViewTabChange = (tab: 'finance' | 'operations' | 'students') => {
    setState((prev: ReturnType<typeof getDefaultDashboardState>) => ({
      ...prev,
      quickView: tab,
    }));
  };

  const handleChartPanelToggle = () => {
    setState((prev: ReturnType<typeof getDefaultDashboardState>) => ({
      ...prev,
      chartPanelOpen: !prev.chartPanelOpen,
    }));
  };

  // Cache summary data với useMemo để tránh tính toán lại
  // PHẢI GỌI TẤT CẢ HOOKS TRƯỚC KHI RETURN
  const summary = useMemo(() => {
    const baseSummary = data?.summary || {
      totalClasses: 0,
      activeClasses: 0,
      totalStudents: 0,
      activeStudents: 0,
      totalTeachers: 0,
      revenue: 0,
      uncollected: 0,
    };
    
    // Áp dụng optimistic revenue adjustment (chỉ cộng/trừ transaction mới)
    return {
      ...baseSummary,
      revenue: baseSummary.revenue + revenueAdjustment,
    };
  }, [data?.summary, revenueAdjustment]);

  // Cache finance report với useMemo
  const financeReport = useMemo(() => {
    const baseReport = data?.financeReport || { rows: [] };
    
    // Áp dụng optimistic revenue adjustment cho row "Doanh Thu"
    const adjustedRows = baseReport.rows.map((row: any) => {
      if (row.key === 'revenue') {
        return {
          ...row,
          amount: (row.amount || 0) + revenueAdjustment,
        };
      }
      return row;
    });
    
    return {
      ...baseReport,
      rows: adjustedRows,
    };
  }, [data?.financeReport, revenueAdjustment]);

  // Cache charts với useMemo
  const charts = useMemo(() => {
    return data?.charts || { revenueProfitLine: [] };
  }, [data?.charts]);

  // Cache alerts với useMemo
  const alerts = useMemo(() => {
    return data?.alerts || {
      studentsNeedRenewal: [],
      pendingStaffPayouts: [],
      classesWithoutSurvey: {
        maxTestNumber: 0,
        classes: [],
      },
      financeRequests: {
        loans: [],
        refunds: [],
      },
    };
  }, [data?.alerts]);

  // Cache quick view data với useMemo
  const quickViewData = useMemo(() => {
    return quickView || null;
  }, [quickView]);

  // Cache year options với useMemo
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  }, []);

  // Cache filter range với useMemo
  const filterRange = useMemo(() => {
    return getFilterRange(state);
  }, [state.filterType, state.filterValue]);

  // Chỉ hiển thị admin dashboard cho admin role
  // Teacher sẽ được redirect trong useEffect ở trên (không hiển thị trang loading)
  if (user?.role !== 'admin') {
    // Nếu là teacher và đã redirect, không hiển thị gì (đang redirect)
    if (user?.role === 'teacher' && hasRedirectedRef.current) {
      return null;
    }
    // Nếu là teacher và chưa redirect nhưng đang load, không hiển thị gì
    if (user?.role === 'teacher' && (isLoadingTeachers || teachers.length === 0)) {
      return null;
    }
    // Các role khác (student, etc.) - không hiển thị gì
    return null;
  }

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 'var(--spacing-4)' }}>Lỗi tải dữ liệu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>
            {error.message || 'Không thể tải dữ liệu dashboard'}
          </p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)', position: 'relative' }}>
      {/* Filter Bar */}
      <div className="card dashboard-filter-bar" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
            <label htmlFor="dashboardFilterType" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Bộ lọc theo thời gian
            </label>
            <select
              id="dashboardFilterType"
              className="form-control"
              value={state.filterType}
              onChange={(e) => handleFilterTypeChange(e.target.value as 'month' | 'quarter' | 'year')}
            >
              <option value="month">Theo tháng</option>
              <option value="quarter">Theo quý</option>
              <option value="year">Theo năm</option>
            </select>
          </div>
          <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
            <label htmlFor="dashboardFilterValue" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              {state.filterType === 'quarter' ? 'Chọn quý' : state.filterType === 'year' ? 'Chọn năm' : 'Chọn tháng'}
            </label>
            {state.filterType === 'month' ? (
              <input
                type="month"
                id="dashboardFilterValue"
                className="form-control"
                value={state.filterValue}
                onChange={(e) => handleFilterValueChange(e.target.value)}
                max={getDefaultPeriodValue('month')}
              />
            ) : (
              <select
                id="dashboardFilterValue"
                className="form-control"
                value={state.filterValue}
                onChange={(e) => handleFilterValueChange(e.target.value)}
              >
                {state.filterType === 'quarter' ? (
                  <>
                    {Array.from({ length: 12 }, (_, i) => {
                      const year = new Date().getFullYear() - Math.floor(i / 4);
                      const quarter = 4 - (i % 4);
                      const value = `${year}-Q${quarter}`;
                      return (
                        <option key={value} value={value}>
                          Quý {quarter} • {year}
                        </option>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {Array.from({ length: 6 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return (
                        <option key={year} value={String(year)}>
                          Năm {year}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
            )}
          </div>
          <div className="filter-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                // Export PDF
                const range = getFilterRange(state);
                const exportRows = [
                  { Metric: 'Tổng lớp học', Value: summary.totalClasses, 'Ghi chú': `${summary.activeClasses} đang hoạt động` },
                  { Metric: 'Học sinh', Value: summary.totalStudents, 'Ghi chú': `${summary.activeStudents} đang học` },
                  { Metric: 'Giáo viên', Value: summary.totalTeachers, 'Ghi chú': 'Đã liên kết tài khoản' },
                  { Metric: `Doanh thu (${range.label})`, Value: formatCurrencyVND(summary.revenue), 'Ghi chú': 'Tổng doanh thu đã thu' },
                  { Metric: 'Chưa thu', Value: formatCurrencyVND(summary.uncollected), 'Ghi chú': 'Tổng số tiền học phí chưa thu' },
                ];
                const printable = exportRows.map((row) => `${row.Metric}: ${row.Value} (${row['Ghi chú'] || ''})`).join('\n');
                const win = window.open('', '_blank');
                if (win) {
                  win.document.write(`<pre><strong>${range.label}</strong>\n\n${printable}</pre>`);
                  win.document.close();
                  win.focus();
                  win.print();
                }
              }}
              title="Xuất báo cáo PDF"
            >
              Xuất PDF
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                // Export Excel (CSV)
                const range = getFilterRange(state);
                const headers = ['Metric', 'Value', 'Ghi chú'];
                const exportRows = [
                  { Metric: 'Tổng lớp học', Value: summary.totalClasses, 'Ghi chú': `${summary.activeClasses} đang hoạt động` },
                  { Metric: 'Học sinh', Value: summary.totalStudents, 'Ghi chú': `${summary.activeStudents} đang học` },
                  { Metric: 'Giáo viên', Value: summary.totalTeachers, 'Ghi chú': 'Đã liên kết tài khoản' },
                  { Metric: `Doanh thu (${range.label})`, Value: formatCurrencyVND(summary.revenue), 'Ghi chú': 'Tổng doanh thu đã thu' },
                  { Metric: 'Chưa thu', Value: formatCurrencyVND(summary.uncollected), 'Ghi chú': 'Tổng số tiền học phí chưa thu' },
                ];
                const payload = exportRows.map((row) => ({
                  Metric: row.Metric,
                  Value: row.Value,
                  'Ghi chú': row['Ghi chú'] || '',
                }));
                const csvContent = [headers.join(','), ...payload.map((row) => [row.Metric, row.Value, row['Ghi chú']].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `dashboard-${range.value}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              title="Xuất báo cáo Excel (CSV)"
            >
              Xuất Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <div className="stat-card">
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>Lớp học</h3>
          <div className="value" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--text)', marginBottom: 'var(--spacing-1)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '32px', width: '60px', borderRadius: '4px' }} />
            ) : (
              formatNumber(summary.totalClasses)
            )}
          </div>
          <div className="text-muted text-sm" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px', marginTop: '4px' }} />
            ) : (
              `${summary.activeClasses} đang hoạt động`
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>Học sinh</h3>
          <div className="value" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--text)', marginBottom: 'var(--spacing-1)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '32px', width: '60px', borderRadius: '4px' }} />
            ) : (
              formatNumber(summary.totalStudents)
            )}
          </div>
          <div className="text-muted text-sm" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px', marginTop: '4px' }} />
            ) : (
              `${summary.activeStudents} đang học`
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>Giáo viên</h3>
          <div className="value" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--text)', marginBottom: 'var(--spacing-1)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '32px', width: '60px', borderRadius: '4px' }} />
            ) : (
              formatNumber(summary.totalTeachers)
            )}
          </div>
          <div className="text-muted text-sm" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px', marginTop: '4px' }} />
            ) : (
              'Đang hợp tác'
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>Doanh thu</h3>
          <div className="value" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--text)', marginBottom: 'var(--spacing-1)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '32px', width: '120px', borderRadius: '4px' }} />
            ) : (
              formatCurrencyVND(summary.revenue)
            )}
          </div>
          <div className="text-muted text-sm" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '16px', width: '200px', borderRadius: '4px', marginTop: '4px' }} />
            ) : (
              'Tổng tiền học sinh nạp vào tài khoản'
            )}
          </div>
        </div>

        <div className="stat-card">
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>Chưa thu</h3>
          <div className="value" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '700', color: 'var(--text)', marginBottom: 'var(--spacing-1)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '32px', width: '120px', borderRadius: '4px' }} />
            ) : (
              formatCurrencyVND(summary.uncollected)
            )}
          </div>
          <div className="text-muted text-sm" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
            {isLoading ? (
              <div className="skeleton-loading" style={{ height: '16px', width: '200px', borderRadius: '4px', marginTop: '4px' }} />
            ) : (
              'Tổng số tiền đang nợ hiện tại'
            )}
          </div>
        </div>
      </div>

      {/* Chart Panel Toggle */}
      {charts.revenueProfitLine && charts.revenueProfitLine.length > 0 && (
        <div className="dashboard-chart-toggle" style={{ marginBottom: 'var(--spacing-4)' }}>
          <button
            className="btn btn-outline"
            onClick={handleChartPanelToggle}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}
          >
            {state.chartPanelOpen ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}
          </button>
        </div>
      )}

      {/* Chart Panel Overlay */}
      {state.chartPanelOpen && (
        <div
          className="chart-panel-overlay"
          onClick={handleChartPanelToggle}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            opacity: state.chartPanelOpen ? 1 : 0,
            transition: 'opacity 0.3s',
            pointerEvents: state.chartPanelOpen ? 'auto' : 'none',
          }}
        />
      )}

      {/* Chart Panel */}
      {charts.revenueProfitLine && charts.revenueProfitLine.length > 0 && (
        <aside
          className="chart-panel"
          style={{
            position: 'fixed',
            top: 0,
            right: state.chartPanelOpen ? 0 : '-400px',
            width: '400px',
            height: '100vh',
            background: 'var(--bg)',
            boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1001,
            transition: 'right 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            className="chart-panel-header"
            style={{
              padding: 'var(--spacing-4)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h4 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
              Doanh thu & Lợi nhuận theo tháng
            </h4>
            <button
              className="btn btn-icon btn-panel-close"
              onClick={handleChartPanelToggle}
              aria-label="Đóng popup"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-2)',
                color: 'var(--text)',
                fontSize: '20px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <div
            className="chart-panel-body"
            style={{
              padding: 'var(--spacing-4)',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            <DualLineChart data={charts.revenueProfitLine} />
          </div>
        </aside>
      )}

      {/* Finance Report */}
      <div className="card dashboard-finance" style={{ marginBottom: 'var(--spacing-6)' }}>
        <div className="dashboard-section-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-4)', paddingBottom: 'var(--spacing-2)', borderBottom: '2px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Báo cáo tài chính</span>
        </div>

        {isLoading && financeReport.rows.length === 0 ? (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="finance-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)' }}>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid var(--border)' }}>Danh mục</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid var(--border)' }}>Giá trị</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid var(--border)' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '150px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', marginLeft: 'auto', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '200px', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="finance-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)' }}>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid var(--border)' }}>Danh mục</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid var(--border)' }}>Giá trị</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid var(--border)' }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {financeReport.rows.map((row: any, index: number) => {
                  const isHeader = row.key === 'pendingAllowances' || row.key === 'staffCost';
                  const rowStyle = isHeader ? { background: 'var(--bg-secondary)', fontWeight: '600' } : {};
                  const cellStyle = isHeader ? { padding: 'var(--spacing-3) var(--spacing-4)' } : { padding: 'var(--spacing-3)' };
                  
                  // Render breakdown if exists (giống backup - hiển thị trong cột Ghi chú)
                  let breakdownHtml = null;
                  if (row.breakdown) {
                    const breakdownItems = [];
                    if (row.breakdown.teacher !== undefined) {
                      breakdownItems.push(
                        <span key="teacher">
                          Gia sư: <strong style={{ color: 'var(--text)', fontWeight: '600' }}>{formatCurrencyVND(row.breakdown.teacher || 0)}</strong>
                        </span>
                      );
                    }
                    if (row.breakdown.lessonPlan !== undefined) {
                      breakdownItems.push(
                        <span key="lessonPlan">
                          Giáo án: <strong style={{ color: 'var(--text)', fontWeight: '600' }}>{formatCurrencyVND(row.breakdown.lessonPlan || 0)}</strong>
                        </span>
                      );
                    }
                    if (row.breakdown.cskh !== undefined) {
                      breakdownItems.push(
                        <span key="cskh">
                          SALE&CSKH: <strong style={{ color: 'var(--text)', fontWeight: '600' }}>{formatCurrencyVND(row.breakdown.cskh || 0)}</strong>
                        </span>
                      );
                    }
                    if (row.breakdown.bonus !== undefined) {
                      breakdownItems.push(
                        <span key="bonus">
                          Thưởng: <strong style={{ color: 'var(--text)', fontWeight: '600' }}>{formatCurrencyVND(row.breakdown.bonus || 0)}</strong>
                        </span>
                      );
                    }
                    
                    if (breakdownItems.length > 0) {
                      // Format breakdown giống backup - tất cả items trên một dòng với bullet (•) giữa các item
                      breakdownHtml = (
                        <div key="breakdown-container" style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                            {breakdownItems.map((item, idx) => (
                              <React.Fragment key={`breakdown-item-${idx}`}>
                                {idx > 0 && <span style={{ color: 'var(--text-muted)' }}>•</span>}
                                {item}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // Chỉ hiển thị breakdown, không hiển thị note nếu có breakdown (giống backup)
                  const noteText = row.breakdown ? '' : (row.note || '');
                  
                  return (
                    <tr
                      key={row.key}
                      style={{
                        ...rowStyle,
                        borderBottom: index < financeReport.rows.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {/* Cột 1: Danh mục - CHỈ có row.label, KHÔNG có breakdown */}
                      <td style={{ ...cellStyle, verticalAlign: 'top' }}>
                        <div style={{ fontWeight: isHeader ? '600' : '500', color: 'var(--text)' }}>
                          {row.label}
                        </div>
                        {/* KHÔNG có breakdown ở đây - breakdown chỉ ở cột 3 */}
                      </td>
                      {/* Cột 2: Giá trị - CHỈ có row.amount, KHÔNG có breakdown */}
                      <td style={{ ...cellStyle, textAlign: 'right', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: isHeader ? '600' : '500', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          {formatCurrencyVND(row.amount)}
                        </div>
                        {/* KHÔNG có breakdown ở đây - breakdown chỉ ở cột 3 */}
                      </td>
                      {/* Cột 3: Ghi chú - CHỈ cột này có breakdown */}
                      <td style={{ ...cellStyle, verticalAlign: 'top' }}>
                        {noteText && (
                          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                            {noteText}
                          </div>
                        )}
                        {/* Breakdown CHỈ được render ở đây - trong cột Ghi chú (cột thứ 3) */}
                        {breakdownHtml}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alerts Section */}
      {alerts && (
        <div className="card dashboard-alerts-card" style={{ marginBottom: 'var(--spacing-6)' }}>
          <div
            className="dashboard-section-title"
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: '600',
              marginBottom: 'var(--spacing-4)',
              paddingBottom: 'var(--spacing-2)',
              borderBottom: '2px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Cảnh báo & hành động</span>
          </div>
          <div
            className="dashboard-alerts"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 'var(--spacing-3)',
              overflowX: 'auto',
            }}
          >
            {/* Students Need Renewal */}
            <div
              className="alert-widget"
              data-widget="students"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                minWidth: 0,
              }}
            >
              <div
                className="alert-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.12) 0%, rgba(220, 38, 38, 0.04) 100%)',
                  borderBottom: '2px solid rgba(220, 38, 38, 0.3)',
                  gap: 'var(--spacing-2)',
                  minHeight: '48px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(220, 38, 38, 0.15)',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#dc2626' }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Học sinh cần gia hạn
                  </span>
                  <span
                    className="badge badge-danger"
                    style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-full)',
                      width: 'fit-content',
                      background: 'rgba(220, 38, 38, 0.15)',
                      color: '#b91c1c',
                    }}
                  >
                    {(alerts.studentsNeedRenewal?.length || 0) + (alerts.studentsLowBalance?.length || 0)} mục
                  </span>
                </div>
              </div>
              <div className="alert-body" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0, maxHeight: '320px' }}>
                <ul className="alert-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {alerts.studentsNeedRenewal && alerts.studentsNeedRenewal.length > 0 ? (
                    <>
                      {(alerts.studentsNeedRenewal.slice(0, 10) as any[]).map((item: any) => (
                        <li
                          key={item.id}
                          style={{
                            padding: 'var(--spacing-2)',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.2s ease',
                            borderLeft: '3px solid #dc2626',
                          }}
                        >
                          <button
                            className="alert-link"
                            onClick={() => item.studentId && navigate(`/students/${item.studentId}`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontWeight: '500',
                              textAlign: 'left',
                              padding: 0,
                              margin: 0,
                              width: '100%',
                              fontSize: 'var(--font-size-sm)',
                            }}
                          >
                            {item.studentName}
                          </button>
                          <span className="alert-meta" style={{ display: 'block', marginTop: 'var(--spacing-1)', color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>
                            {item.className}
                          </span>
                        </li>
                      ))}
                      {alerts.studentsNeedRenewal.length > 10 && (
                        <li style={{ padding: 'var(--spacing-2)', color: 'var(--muted)', fontSize: 'var(--font-size-xs)', borderBottom: '1px solid var(--border)', borderLeft: '3px solid #dc2626' }}>
                          ... ({alerts.studentsNeedRenewal.length - 10}+)
                        </li>
                      )}
                    </>
                  ) : (
                    <li className="text-muted" style={{ padding: 'var(--spacing-2)', textAlign: 'center', fontSize: 'var(--font-size-xs)' }}>
                      Không có học sinh số dư = 0
                    </li>
                  )}
                </ul>
                {/* Số dư dưới 200k - bên dưới bảng học sinh cần gia hạn */}
                {alerts.studentsLowBalance && alerts.studentsLowBalance.length > 0 && (
                  <>
                    <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderTop: '1px solid var(--border)', fontSize: 'var(--font-size-xs)', fontWeight: '600', color: '#92400e', background: 'rgba(251, 191, 36, 0.08)' }}>
                      Số dư ít hơn 200.000 đ
                    </div>
                    <ul className="alert-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {(alerts.studentsLowBalance.slice(0, 10) as any[]).map((item: any) => (
                        <li
                          key={item.id}
                          style={{
                            padding: 'var(--spacing-2)',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.2s ease',
                            borderLeft: '3px solid #f59e0b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 'var(--spacing-2)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <button
                              className="alert-link"
                              onClick={() => item.studentId && navigate(`/students/${item.studentId}`)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#b45309',
                                cursor: 'pointer',
                                fontWeight: '500',
                                textAlign: 'left',
                                padding: 0,
                                margin: 0,
                                width: '100%',
                                fontSize: 'var(--font-size-sm)',
                              }}
                            >
                              {item.studentName}
                            </button>
                            <span className="alert-meta" style={{ display: 'block', marginTop: 'var(--spacing-1)', color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>
                              {item.className}
                            </span>
                          </div>
                          <span style={{ flexShrink: 0, fontSize: 'var(--font-size-xs)', color: '#92400e', whiteSpace: 'nowrap' }}>
                            Còn {typeof item.walletBalance === 'number' ? item.walletBalance.toLocaleString('vi-VN') : '0'} đồng
                          </span>
                        </li>
                      ))}
                      {alerts.studentsLowBalance.length > 10 && (
                        <li style={{ padding: 'var(--spacing-2)', color: 'var(--muted)', fontSize: 'var(--font-size-xs)', borderBottom: '1px solid var(--border)', borderLeft: '3px solid #f59e0b' }}>
                          ... ({alerts.studentsLowBalance.length - 10}+)
                        </li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {/* Pending Staff Payouts */}
            <div
              className="alert-widget"
              data-widget="staff"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                minWidth: 0,
              }}
            >
              <div
                className="alert-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
                  borderBottom: '2px solid rgba(168, 85, 247, 0.3)',
                  gap: 'var(--spacing-2)',
                  minHeight: '48px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(168, 85, 247, 0.2)',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#6b21a8' }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Chờ thanh toán trợ cấp
                  </span>
                  <span
                    className="badge badge-purple"
                    style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-full)',
                      width: 'fit-content',
                      background: 'rgba(168, 85, 247, 0.2)',
                      color: '#6b21a8',
                    }}
                  >
                    {alerts.pendingStaffPayouts?.length || 0} mục
                  </span>
                </div>
              </div>
              <div className="alert-body" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0, maxHeight: '200px' }}>
                <ul className="alert-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {alerts.pendingStaffPayouts && alerts.pendingStaffPayouts.length > 0 ? (
                    alerts.pendingStaffPayouts.map((item: any, index: number) => {
                      const unpaidTeacher = item.unpaidTeacher || 0;
                      const unpaidWorkItems = item.unpaidWorkItems || 0;
                      const unpaidBonuses = item.unpaidBonuses || 0;
                      
                      return (
                        <li
                          key={index}
                          style={{
                            padding: 'var(--spacing-2)',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 0.2s ease',
                          }}
                        >
                          <button
                            className="alert-link"
                            onClick={() => item.staffId && navigate(`/staff/${item.staffId}`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              fontWeight: '500',
                              textAlign: 'left',
                              padding: 0,
                              margin: 0,
                              fontSize: 'var(--font-size-sm)',
                              lineHeight: '1.4',
                              width: '100%',
                            }}
                          >
                            {item.staffName}
                          </button>
                          <div
                            className="alert-meta"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '4px',
                              flexWrap: 'wrap',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            {unpaidTeacher > 0 && (
                              <span style={{ color: '#f59e0b', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {formatCurrencyVND(unpaidTeacher)}
                              </span>
                            )}
                            {unpaidWorkItems > 0 && (
                              <span style={{ color: '#dc2626', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {formatCurrencyVND(unpaidWorkItems)}
                              </span>
                            )}
                            {unpaidBonuses > 0 && (
                              <span style={{ color: '#059669', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {formatCurrencyVND(unpaidBonuses)}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-muted" style={{ padding: 'var(--spacing-2)', textAlign: 'center', fontSize: '12px' }}>
                      Không có trợ cấp nào đang chờ thanh toán
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* Classes Without Survey */}
            {alerts.classesWithoutSurvey && alerts.classesWithoutSurvey.maxTestNumber > 0 && (
              <DashboardAlert
                title={`Lớp chưa báo cáo lần ${alerts.classesWithoutSurvey.maxTestNumber}`}
                count={alerts.classesWithoutSurvey.classes?.length || 0}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#dc2626' }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                }
                iconColor="#dc2626"
                iconBg="rgba(239, 68, 68, 0.2)"
                headerBg="linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)"
                borderColor="rgba(239, 68, 68, 0.3)"
                badgeBg="rgba(239, 68, 68, 0.2)"
                badgeColor="#991b1b"
                items={alerts.classesWithoutSurvey.classes || []}
                emptyMessage="Tất cả các lớp đã có báo cáo"
              />
                  )}

            {/* Finance Requests */}
            <div
              className="alert-widget"
              data-widget="finance"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                minWidth: 0,
              }}
            >
              <div
                className="alert-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%)',
                  borderBottom: '2px solid rgba(251, 191, 36, 0.3)',
                  gap: 'var(--spacing-2)',
                  minHeight: '48px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(251, 191, 36, 0.2)',
                    flexShrink: 0,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#f59e0b' }}>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Yêu cầu tài chính
                  </span>
                  <span
                    className="badge badge-warning"
                    style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-full)',
                      width: 'fit-content',
                      background: 'rgba(251, 191, 36, 0.2)',
                      color: '#92400e',
                    }}
                  >
                    {(alerts.financeRequests?.loans?.length || 0) + (alerts.financeRequests?.refunds?.length || 0)} mục
                  </span>
                </div>
              </div>
              <div className="alert-body" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0, maxHeight: '200px' }}>
                <p
                  className="alert-note"
                  style={{
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    margin: 0,
                    color: 'var(--muted)',
                    fontSize: '11px',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(251, 191, 36, 0.05)',
                    lineHeight: '1.4',
                  }}
                >
                  ⚠️ Chức năng tạm thời không khả dụng. Sẽ phát triển trong phiên bản sau.
                </p>
                <ul className="alert-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {(() => {
                    const loanItems = (alerts.financeRequests?.loans || []).map((entry: any, idx: number) => (
                      <li key={`loan-${idx}`} style={{ padding: 'var(--spacing-2)', borderBottom: '1px solid var(--border)', fontSize: '12px', lineHeight: '1.4' }}>
                        Ứng tiền • {entry.name} – {formatCurrencyVND(entry.amount || 0)}
                      </li>
                    ));
                    const refundItems = (alerts.financeRequests?.refunds || []).map((entry: any, idx: number) => (
                      <li key={`refund-${idx}`} style={{ padding: 'var(--spacing-2)', borderBottom: '1px solid var(--border)', fontSize: '12px', lineHeight: '1.4' }}>
                        Hoàn tiền • {entry.studentId || entry.id} – {formatCurrencyVND(entry.amount || 0)}
                      </li>
                    ));
                    const all = [...loanItems, ...refundItems];
                    return all.length > 0 ? all : <li className="text-muted" style={{ padding: 'var(--spacing-2)', textAlign: 'center', fontSize: '12px' }}>Chưa có yêu cầu mới</li>;
                  })()}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Section */}
      {quickViewData && (
        <div className="card dashboard-quickview" style={{ marginBottom: 'var(--spacing-6)' }}>
          <div
            className="quickview-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-4)',
              flexWrap: 'wrap',
              gap: 'var(--spacing-3)',
            }}
          >
            <div className="dashboard-section-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
              Chế độ xem nhanh theo phân hệ
            </div>
            <label
              className="quickview-year-selector"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>Năm</span>
              <select
                id="quickViewYear"
                className="form-control"
                value={state.quickViewYear}
                onChange={(e) =>
                  setState((prev: ReturnType<typeof getDefaultDashboardState>) => ({
                    ...prev,
                    quickViewYear: e.target.value,
                  }))
                }
                style={{ minWidth: '120px' }}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Quick View Tabs */}
          <div
            className="quickview-tabs"
            style={{
              display: 'flex',
              gap: 'var(--spacing-2)',
              marginBottom: 'var(--spacing-4)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {QUICK_VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleQuickViewTabChange(tab.id as 'finance' | 'operations' | 'students')}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'none',
                  border: 'none',
                  borderBottom: state.quickView === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                  color: state.quickView === tab.id ? 'var(--primary)' : 'var(--muted)',
                  fontWeight: state.quickView === tab.id ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick View Content */}
          <div className="quickview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
            {quickViewData[state.quickView] && quickViewData[state.quickView].length > 0 ? (
              quickViewData[state.quickView].map((item: any, index: number) => (
                <div
                  key={index}
                  className="quickview-card"
                  style={{
                    padding: 'var(--spacing-4)',
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="label"
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--muted)',
                      marginBottom: 'var(--spacing-2)',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="value"
                    style={{
                      fontSize: 'var(--font-size-xl)',
                      fontWeight: '700',
                      color: 'var(--text)',
                      marginBottom: item.hint ? 'var(--spacing-1)' : 0,
                    }}
                  >
                    {item.value}
                  </div>
                  {item.hint && (
                    <div
                      className="hint"
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--muted)',
                        marginTop: 'var(--spacing-1)',
                      }}
                    >
                      {item.hint}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--muted)', padding: 'var(--spacing-4)', textAlign: 'center', gridColumn: '1 / -1' }}>
                Chưa có dữ liệu cho chế độ này.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
