/**
 * Staff CSKH Detail Page
 * Displays list of students assigned to a CSKH staff member with payment status management
 * Migrated from backup/assets/js/pages/staff-cskh-detail.js
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers } from '../services/teachersService';
import {
  updateCSKHPaymentStatus,
  bulkUpdateCSKHPaymentStatus,
} from '../services/cskhPaymentStatusService';
import { fetchCSKHDetailData, CSKHDetailData } from '../services/staffService';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import { formatCurrencyVND } from '../utils/formatters';
import { hasRole } from '../utils/permissions';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';
import { TableSkeleton } from '../components/SkeletonLoader';
import { useDebounce } from '../hooks/useDebounce';

// StudentStat is now from backend API
type StudentStat = CSKHDetailData['students'][0];

function StaffCSKHDetail() {
  const { id: staffId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);

  // Giáo viên chỉ được xem hồ sơ CSKH của chính mình: đảm bảo có linkId, redirect nếu staffId !== linkId
  useEffect(() => {
    if (user?.role !== 'teacher' || !staffId) return;
    const doRedirect = (linkId: string) => {
      if (staffId !== linkId) navigate(`/staff/${linkId}/cskh`, { replace: true });
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
      .catch(() => {});
  }, [user?.role, user?.linkId, staffId, navigate]);

  // Get month/year from URL or default to current month
  const currentMonth = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);

  const selectedMonth = parseInt(searchParams.get('month') || String(currentMonth.month));
  const selectedYear = parseInt(searchParams.get('year') || String(currentMonth.year));

  // State for UI
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [localDefaultPercent, setLocalDefaultPercent] = useState<number | null>(null);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);

  // Giáo viên chỉ được load hồ sơ của chính mình
  const canLoadStaffCSKH = !user || user.role !== 'teacher' || (user.linkId != null && staffId === user.linkId);

  // Fetch staff data
  const fetchStaffFn = useCallback(() => {
    if (!staffId) throw new Error('Staff ID is required');
    return fetchTeachers().then((teachers) => teachers.find((t) => t.id === staffId));
  }, [staffId]);

  const { data: staff, isLoading: staffLoading } = useDataLoading(fetchStaffFn, [staffId], {
    cacheKey: `staff-${staffId}`,
    staleTime: 5 * 60 * 1000,
    enabled: !!staffId && canLoadStaffCSKH,
  });

  // Fetch CSKH detail data from backend (all calculations done in backend)
  // Debounce month change to avoid too many API calls
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const debouncedMonthKey = useDebounce(monthKey, 300);
  
  const fetchCSKHDetailFn = useCallback(() => {
    if (!staffId) throw new Error('Staff ID is required');
    return fetchCSKHDetailData(staffId, debouncedMonthKey);
  }, [staffId, debouncedMonthKey]);

  const { data: cskhDetailData, isLoading: cskhLoading, error: cskhError, refetch: refetchCSKHDetail } = useDataLoading(fetchCSKHDetailFn, [staffId, debouncedMonthKey], {
    cacheKey: `cskh-detail-${staffId}-${debouncedMonthKey}`,
    staleTime: 1 * 60 * 1000,
    enabled: !!staffId && !!debouncedMonthKey && canLoadStaffCSKH,
  });
  
  // Prefetch next month data
  useEffect(() => {
    if (!staffId || !staff || staffLoading) return;
    const [year, month] = debouncedMonthKey.split('-').map(Number);
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear = year + 1;
    }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
    
    const timeoutId = setTimeout(() => {
      fetchCSKHDetailData(staffId, nextMonthStr).catch(() => {});
    }, 2000);
    
    return () => clearTimeout(timeoutId);
  }, [staffId, staff, staffLoading, debouncedMonthKey]);


  // Permission checks (matching backup logic)
  const isAdmin = hasRole('admin');
  const staffRoles = staff?.roles || [];
  const hasCskhRole = Array.isArray(staffRoles) && staffRoles.includes('cskh_sale');
  
  // Check if current user is the same as staff member (matching backup logic)
  const isSelf = user && 
    user.role === 'teacher' && 
    (user.linkId === staffId || (staff?.userId && staff.userId === user.id));
  
  // Access control: must be admin OR (has cskh role AND is self)
  const hasAccess = isAdmin || (hasCskhRole && isSelf);
  
  const canEditProfit = Boolean(isAdmin);
  const canManagePaymentStatus = Boolean(isAdmin || hasCskhRole); // Match backup: no isSelf check for managing payment status

  // Sync localDefaultPercent with backend data when it loads/changes
  useEffect(() => {
    if (cskhDetailData?.defaultProfitPercent != null) {
      setLocalDefaultPercent(cskhDetailData.defaultProfitPercent);
    }
  }, [cskhDetailData?.defaultProfitPercent]);

  // Extract data from backend (all calculations done in backend)
  const studentStats = cskhDetailData?.students || [];
  const defaultProfitPercent = localDefaultPercent ?? cskhDetailData?.defaultProfitPercent ?? 10;
  const totals = cskhDetailData?.totals || {
    totalUnpaidProfit: 0,
    totalPaidProfit: 0,
    totalPaidAll: 0,
    totalProfitAll: 0,
  };

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      options.push({ month, year, label: `Tháng ${month}/${year}`, value: `${month}-${year}` });
    }
    return options;
  }, []);

  // Handlers
  const handleMonthChange = useCallback((value: string) => {
    const [month, year] = value.split('-');
    setSearchParams({ month, year });
  }, [setSearchParams]);

  const handleDefaultProfitChange = async (value: number) => {
    if (!staffId || !canEditProfit || isUpdatingDefault) return;
    // Update local state immediately for responsive UI
    setLocalDefaultPercent(value);
  };

  const handleDefaultProfitBlur = async () => {
    if (!staffId || !canEditProfit || isUpdatingDefault) return;
    const value = localDefaultPercent ?? defaultProfitPercent;
    if (studentStats.length === 0) return;

    setIsUpdatingDefault(true);
    try {
      // Bulk-update ALL students in this month to the new default percent
      const updates = studentStats.map((stat) => ({
        studentId: stat.student.id,
        paymentStatus: stat.paymentStatus,
        profitPercent: value,
      }));
      await bulkUpdateCSKHPaymentStatus(staffId, monthKey, updates);
      await refetchCSKHDetail();
      toast.success(`Đã cập nhật % lợi nhuận mặc định thành ${value}% cho tất cả học sinh`);
    } catch (error: any) {
      toast.error('Không thể cập nhật % lợi nhuận: ' + (error.message || 'Lỗi không xác định'));
      // Revert local state
      setLocalDefaultPercent(cskhDetailData?.defaultProfitPercent ?? 10);
    } finally {
      setIsUpdatingDefault(false);
    }
  };

  const handleStudentProfitChange = async (studentId: string, value: number) => {
    if (!staffId) return;
    
    // Update in database immediately
    try {
      const studentStat = studentStats.find((s) => s.student.id === studentId);
      if (!studentStat) return;
      const currentStatus = studentStat.paymentStatus;
      await updateCSKHPaymentStatus(staffId, studentId, monthKey, currentStatus, value);
      // Refetch to get updated data from backend
      await refetchCSKHDetail();
    } catch (error: any) {
      console.error('Failed to update profit percent:', error);
      // Don't show error toast for profit percent changes to avoid spam
    }
  };

  const handlePaymentStatusChange = async (studentId: string, status: 'paid' | 'unpaid' | 'deposit') => {
    if (!staffId || isUpdatingStatus) return;
    
    // Optimistic update: update UI immediately
    const studentStat = studentStats.find((s) => s.student.id === studentId);
    if (!studentStat) return;
    
    // Store original state for rollback
    const originalStatus = studentStat.paymentStatus;
    
    // Optimistically update local state (will be overwritten by refetch)
    setIsUpdatingStatus(true);
    
    try {
      const profitPercent = studentStat.profitPercent;
      await updateCSKHPaymentStatus(staffId, studentId, monthKey, status, profitPercent);
      // Refetch to get updated data from backend
      await refetchCSKHDetail();
      toast.success('Đã cập nhật trạng thái thanh toán');
    } catch (error: any) {
      toast.error('Không thể cập nhật trạng thái thanh toán: ' + (error.message || 'Lỗi không xác định'));
      // Refetch to restore correct state
      await refetchCSKHDetail();
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(studentStats.map((s) => s.student.id)));
    } else {
      setSelectedStudents(new Set());
    }
  }, [studentStats]);

  const handleStudentSelect = (studentId: string, checked: boolean) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(studentId);
      } else {
        newSet.delete(studentId);
      }
      return newSet;
    });
  };

  const handleBulkStatusUpdate = async (status: 'paid' | 'unpaid' | 'deposit') => {
    if (!staffId || isUpdatingStatus || selectedStudents.size === 0) return;
    
    setShowBulkStatusModal(false);
    setIsUpdatingStatus(true);
    
    try {
      const updates = Array.from(selectedStudents).map((studentId) => {
        const studentStat = studentStats.find((s) => s.student.id === studentId);
        return {
          studentId,
          paymentStatus: status,
          profitPercent: studentStat?.profitPercent || defaultProfitPercent,
        };
      });
      
      await bulkUpdateCSKHPaymentStatus(staffId, monthKey, updates);
      
      // Clear selection
      setSelectedStudents(new Set());
      
      // Refetch to get updated data from backend
      await refetchCSKHDetail();
      
      toast.success(`Đã cập nhật trạng thái thanh toán cho ${updates.length} học sinh`);
    } catch (error: any) {
      toast.error('Không thể cập nhật trạng thái thanh toán: ' + (error.message || 'Lỗi không xác định'));
      // Refetch to restore correct state
      await refetchCSKHDetail();
    } finally {
      setIsUpdatingStatus(false);
    }
  };


  // Payment status labels and classes
  const paymentStatusLabels = {
    paid: 'Đã thanh toán',
    unpaid: 'Chờ thanh toán',
    deposit: 'Cọc',
  };

  const paymentStatusClasses = {
    paid: 'badge-success',
    unpaid: 'badge-danger',
    deposit: 'badge-warning',
  };

  if (staffLoading) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <p style={{ color: 'var(--muted)' }}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <p style={{ color: 'var(--danger)' }}>Không tìm thấy nhân sự.</p>
          <button className="btn btn-secondary mt-3" onClick={() => navigate('/staff')}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Show access denied if no permission (matching backup logic)
  if (!hasAccess && !staffLoading) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <p style={{ color: 'var(--danger)' }}>Bạn không có quyền truy cập trang CSKH này.</p>
          <button className="btn btn-secondary mt-3" onClick={() => navigate('/staff')}>
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  // Show error state (but still show page structure)
  const showError = cskhError && !cskhDetailData;

  const allSelected = studentStats.length > 0 && selectedStudents.size === studentStats.length;
  const someSelected = selectedStudents.size > 0 && selectedStudents.size < studentStats.length;

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-4)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg)',
          zIndex: 10,
          padding: 'var(--spacing-3) 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          className="btn btn-icon"
          style={{ padding: 'var(--spacing-2)', minWidth: 'auto' }}
          title="Quay lại"
          onClick={() => navigate(`/staff/${staffId}`)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, flex: 1, fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
          📋 Học sinh CSKH - {staff.fullName}
        </h1>
      </div>

      {/* Month Filter */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 500 }}>Tháng:</span>
              <select
                value={`${selectedMonth}-${selectedYear}`}
                onChange={(e) => handleMonthChange(e.target.value)}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg)',
                  cursor: 'pointer',
                }}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Bulk Actions */}
        {canManagePaymentStatus && (
          <div
            id="studentBulkActions"
            style={{
              display: selectedStudents.size > 0 ? 'block' : 'none',
              marginBottom: 'var(--spacing-3)',
              padding: 'var(--spacing-3)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              opacity: selectedStudents.size > 0 ? 1 : 0,
              transform: selectedStudents.size > 0 ? 'translateY(0)' : 'translateY(-10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
              <span className="selected-count" id="studentSelectedCount" style={{ fontWeight: 500, color: 'var(--text)', fontSize: 'var(--font-size-sm)' }}>
                {selectedStudents.size > 0 ? `Đã chọn: ${selectedStudents.size} học sinh` : ''}
              </span>
              <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowBulkStatusModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', whiteSpace: 'nowrap' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Đánh dấu đã thanh toán
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setSelectedStudents(new Set())}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', whiteSpace: 'nowrap' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {cskhError && !cskhDetailData && (
          <div style={{ 
            marginTop: 'var(--spacing-4)', 
            padding: 'var(--spacing-4)', 
            background: 'rgba(220, 38, 38, 0.1)', 
            border: '1px solid rgba(220, 38, 38, 0.3)', 
            borderRadius: 'var(--radius)',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--danger)', margin: '0 0 var(--spacing-2) 0' }}>
              Lỗi khi tải dữ liệu: {cskhError.message || 'Lỗi không xác định'}
            </p>
            <button className="btn btn-sm btn-secondary" onClick={() => refetchCSKHDetail()}>
              Thử lại
            </button>
          </div>
        )}

        {/* Students Table */}
        {cskhLoading && !cskhDetailData ? (
          <div style={{ marginTop: 'var(--spacing-4)' }}>
            <TableSkeleton rows={8} columns={canManagePaymentStatus ? 7 : 6} />
          </div>
        ) : cskhError && !cskhDetailData ? null : studentStats.length > 0 ? (
          <div style={{ marginTop: 'var(--spacing-4)', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table style={{ minWidth: '1000px', width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)' }}>
                  {canManagePaymentStatus && (
                    <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', width: '50px', minWidth: '50px', borderBottom: '2px solid var(--border)' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                        title="Chọn tất cả"
                      />
                    </th>
                  )}
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', minWidth: '200px', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>
                    Tên học sinh
                  </th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', minWidth: '100px', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>
                    Năm sinh
                  </th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', minWidth: '150px', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>Tỉnh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', minWidth: '150px', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>
                    Đã đóng
                  </th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', minWidth: '250px', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      <span>Lợi nhuận</span>
                      <input
                        type="number"
                        value={defaultProfitPercent}
                        min="0"
                        max="100"
                        step="0.1"
                        onChange={(e) => handleDefaultProfitChange(parseFloat(e.target.value) || 0)}
                        onBlur={handleDefaultProfitBlur}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                        disabled={!canEditProfit || isUpdatingDefault}
                        style={{
                          width: '60px',
                          padding: '4px',
                          border: `1px solid ${isUpdatingDefault ? 'var(--primary)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius)',
                          textAlign: 'center',
                          background: 'var(--bg)',
                          opacity: isUpdatingDefault ? 0.7 : 1,
                          transition: 'border-color 0.2s ease, opacity 0.2s ease',
                        }}
                        title={canEditProfit ? '% lợi nhuận mặc định – nhấn Enter hoặc click ra ngoài để lưu cho tất cả học sinh' : '% lợi nhuận mặc định'}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>%</span>
                      {isUpdatingDefault && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', whiteSpace: 'nowrap' }}>Đang lưu...</span>
                      )}
                    </div>
                  </th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', minWidth: '150px', borderBottom: '2px solid var(--border)', fontWeight: 600 }}>
                    Trạng thái thanh toán
                  </th>
                </tr>
              </thead>
              <tbody>
                {studentStats.map((stat) => {
                  const student = stat.student;
                  const statusLabel = paymentStatusLabels[stat.paymentStatus];
                  const statusClass = paymentStatusClasses[stat.paymentStatus];
                  const isSelected = selectedStudents.has(student.id);

                  return (
                    <tr
                      key={student.id}
                      className="student-row"
                      data-student-id={student.id}
                      onClick={(e) => {
                        // Don't navigate if clicking on checkbox or input (matching backup)
                        if ((e.target as HTMLElement).closest('.student-checkbox') || (e.target as HTMLElement).closest('.student-profit-percent')) {
                          return;
                        }
                        navigate(`/students/${student.id}`);
                      }}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: isSelected ? 'var(--bg-secondary)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '';
                        }
                      }}
                    >
                      {canManagePaymentStatus && (
                        <td
                          style={{ padding: 'var(--spacing-3)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="student-checkbox table-checkbox"
                            data-student-id={student.id}
                            checked={isSelected}
                            onChange={(e) => handleStudentSelect(student.id, e.target.checked)}
                            style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                          />
                        </td>
                      )}
                      <td style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>{student.fullName || 'N/A'}</div>
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {student.birthYear || 'N/A'}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                        {student.province || 'N/A'}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 500, color: 'var(--text)' }}>
                        {formatCurrencyVND(stat.totalPaid)}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                          <input
                            type="number"
                            className="student-profit-percent"
                            data-staff-id={staffId}
                            data-student-id={student.id}
                            value={stat.profitPercent ?? defaultProfitPercent ?? 10}
                            min="0"
                            max="100"
                            step="0.1"
                            onChange={(e) => handleStudentProfitChange(student.id, parseFloat(e.target.value) || 0)}
                            disabled={!canEditProfit}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '60px',
                              padding: '4px',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              textAlign: 'center',
                              background: 'var(--bg)',
                            }}
                            title="% lợi nhuận riêng cho học sinh này"
                          />
                          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>%</span>
                          <span style={{ marginLeft: 'var(--spacing-2)', fontWeight: 500, color: 'var(--text)' }}>
                            = {formatCurrencyVND(stat.profit)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span
                          className={`badge ${statusClass}`}
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            padding: '4px 10px',
                            fontWeight: 500,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Row */}
                <tr style={{ fontWeight: 600, background: 'var(--bg-secondary)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={canManagePaymentStatus ? 2 : 1} style={{ padding: 'var(--spacing-3)' }}>
                    <strong>Tổng cộng</strong>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)', textAlign: 'right' }}>
                    <strong>{formatCurrencyVND(totals.totalPaidAll)}</strong>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}>
                    <strong>{formatCurrencyVND(totals.totalProfitAll)}</strong>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                </tr>

                {/* Unpaid Row */}
                <tr style={{ fontWeight: 600, background: 'rgba(239, 68, 68, 0.05)', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={canManagePaymentStatus ? 2 : 1} style={{ padding: 'var(--spacing-3)', color: 'var(--danger)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      <span className="badge badge-danger" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                        Chờ thanh toán
                      </span>
                      <span>Chưa thanh toán</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)', color: 'var(--danger)', fontWeight: 600 }}>
                    <strong>{formatCurrencyVND(totals.totalUnpaidProfit)}</strong>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                </tr>

                {/* Paid Row */}
                <tr style={{ fontWeight: 600, background: 'rgba(34, 197, 94, 0.05)', borderTop: '1px solid var(--border)' }}>
                  <td colSpan={canManagePaymentStatus ? 2 : 1} style={{ padding: 'var(--spacing-3)', color: 'var(--success)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                        Đã thanh toán
                      </span>
                      <span>Tổng tháng</span>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                  <td style={{ padding: 'var(--spacing-3)', color: 'var(--success)', fontWeight: 600 }}>
                    <strong>{formatCurrencyVND(totals.totalPaidProfit)}</strong>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-6)', marginTop: 'var(--spacing-4)' }}>
            <p style={{ color: 'var(--muted)' }}>
              Tháng {selectedMonth}/{selectedYear} chưa có học sinh nào được phân công cho nhân sự này.
            </p>
          </div>
        )}
      </div>

      {/* Bulk Status Modal */}
      <Modal
        title="Chọn trạng thái thanh toán"
        isOpen={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
      >
        <div style={{ padding: 'var(--spacing-4)' }}>
          <p style={{ margin: '0 0 var(--spacing-4) 0', fontSize: 'var(--font-size-base)', color: 'var(--text)' }}>
            Chọn trạng thái thanh toán cho <strong>{selectedStudents.size}</strong> học sinh đã chọn:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            <button
              type="button"
              className="btn btn-block"
              onClick={() => handleBulkStatusUpdate('paid')}
              style={{
                justifyContent: 'flex-start',
                padding: 'var(--spacing-3)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#047857',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Đã thanh toán
            </button>
            <button
              type="button"
              className="btn btn-block"
              onClick={() => handleBulkStatusUpdate('unpaid')}
              style={{
                justifyContent: 'flex-start',
                padding: 'var(--spacing-3)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#991b1b',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Chờ thanh toán
            </button>
            <button
              type="button"
              className="btn btn-block"
              onClick={() => handleBulkStatusUpdate('deposit')}
              style={{
                justifyContent: 'flex-start',
                padding: 'var(--spacing-3)',
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#6b21a8',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-2)' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 8v4M12 16h.01"></path>
              </svg>
              Cọc
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

export default StaffCSKHDetail;

