/**
 * Staff CSKH Detail Page
 * Displays list of students assigned to a CSKH staff member with payment status management
 * Migrated from backup/assets/js/pages/staff-cskh-detail.js
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers } from '../services/teachersService';
import { fetchStudents } from '../services/studentsService';
import { fetchWalletTransactions } from '../services/walletService';
import { useAuthStore } from '../store/authStore';
import { formatCurrencyVND } from '../utils/formatters';
import { hasRole } from '../utils/permissions';

interface StudentStat {
  student: any;
  totalPaid: number;
  profitPercent: number;
  profit: number;
  paymentStatus: 'paid' | 'unpaid' | 'deposit';
}

function StaffCSKHDetail() {
  const { id: staffId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);

  // Get month/year from URL or default to current month
  const currentMonth = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);

  const selectedMonth = parseInt(searchParams.get('month') || String(currentMonth.month));
  const selectedYear = parseInt(searchParams.get('year') || String(currentMonth.year));

  // State for profit percentages (stored in localStorage)
  const [defaultProfitPercent, setDefaultProfitPercent] = useState<number>(10);
  const [studentProfitPercentages, setStudentProfitPercentages] = useState<Record<string, number>>({});
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, 'paid' | 'unpaid' | 'deposit'>>({});

  // Fetch staff data
  const fetchStaffFn = useCallback(() => {
    if (!staffId) throw new Error('Staff ID is required');
    return fetchTeachers().then((teachers) => teachers.find((t) => t.id === staffId));
  }, [staffId]);

  const { data: staff, isLoading: staffLoading } = useDataLoading(fetchStaffFn, [staffId], {
    cacheKey: `staff-${staffId}`,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch students
  const { data: studentsData } = useDataLoading(() => fetchStudents(), [], {
    cacheKey: 'students-for-cskh-detail',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch wallet transactions
  const { data: walletTransactionsData } = useDataLoading(() => fetchWalletTransactions(), [], {
    cacheKey: 'wallet-transactions-for-cskh-detail',
    staleTime: 1 * 60 * 1000,
  });

  // Load default profit percent from localStorage
  useEffect(() => {
    if (staffId) {
      const saved = localStorage.getItem(`cskh_default_profit_${staffId}`);
      if (saved) {
        setDefaultProfitPercent(parseFloat(saved) || 10);
      }
    }
  }, [staffId]);

  // Load payment statuses from localStorage
  useEffect(() => {
    if (staffId) {
      const statuses: Record<string, 'paid' | 'unpaid' | 'deposit'> = {};
      const students = studentsData || [];
      students.forEach((student) => {
        const key = `cskh_payment_${staffId}_${student.id}_${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const status = localStorage.getItem(key);
        if (status && (status === 'paid' || status === 'unpaid' || status === 'deposit')) {
          statuses[student.id] = status;
        }
      });
      setPaymentStatuses(statuses);
    }
  }, [staffId, studentsData, selectedMonth, selectedYear]);

  // Permission checks
  const isAdmin = hasRole('admin');
  const staffRoles = staff?.roles || [];
  const hasCskhRole = Array.isArray(staffRoles) && staffRoles.includes('cskh_sale');
  const isSelf = user?.role === 'teacher' && (user.linkId === staffId || staff?.userId === user.id);
  const canEditProfit = isAdmin;
  const canManagePaymentStatus = isAdmin || (hasCskhRole && isSelf);

  // Check if student was assigned in month
  const wasStudentAssignedInMonth = useCallback(
    (student: any, month: number, year: number) => {
      if (student.cskhStaffId !== staffId) return false;

      // Check if student has classes
      const studentClassIds = student.classIds || (student.classId ? [student.classId] : []);
      if (studentClassIds.length === 0) return false;

      // For now, if student has cskhStaffId matching, consider them assigned
      // In a full implementation, we'd check sessions/attendance in that month
      return true;
    },
    [staffId]
  );

  // Get assigned students for selected month
  const assignedStudents = useMemo(() => {
    if (!studentsData) return [];
    return studentsData.filter((s) => wasStudentAssignedInMonth(s, selectedMonth, selectedYear));
  }, [studentsData, selectedMonth, selectedYear, wasStudentAssignedInMonth]);

  // Calculate stats for each student
  const studentStats = useMemo<StudentStat[]>(() => {
    if (!assignedStudents.length || !walletTransactionsData) return [];

    const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

    return assignedStudents.map((student) => {
      // Get top-up transactions for this student in the selected month
      const monthTopups = (walletTransactionsData || []).filter((tx: any) => {
        if (tx.studentId !== student.id) return false;
        if (tx.type !== 'topup') return false;
        if (!tx.date) return false;
        const txDate = new Date(tx.date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const totalPaid = monthTopups.reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

      // Get profit percentage for this student (or use default)
      const profitPercentKey = `${staffId}_${student.id}`;
      const profitPercent = studentProfitPercentages[profitPercentKey] || defaultProfitPercent;
      const profit = totalPaid * (profitPercent / 100);

      // Get payment status for this student in this month
      const paymentStatus = paymentStatuses[student.id] || 'unpaid';

      return {
        student,
        totalPaid,
        profitPercent,
        profit,
        paymentStatus,
      };
    });
  }, [assignedStudents, walletTransactionsData, selectedMonth, selectedYear, defaultProfitPercent, studentProfitPercentages, paymentStatuses, staffId]);

  // Calculate totals
  const totalUnpaidProfit = useMemo(() => {
    return studentStats.filter((s) => s.paymentStatus === 'unpaid').reduce((sum, s) => sum + s.profit, 0);
  }, [studentStats]);

  const totalPaidProfit = useMemo(() => {
    return studentStats.filter((s) => s.paymentStatus === 'paid').reduce((sum, s) => sum + s.profit, 0);
  }, [studentStats]);

  const totalPaidAll = useMemo(() => {
    return studentStats.reduce((sum, s) => sum + s.totalPaid, 0);
  }, [studentStats]);

  const totalProfitAll = useMemo(() => {
    return studentStats.reduce((sum, s) => sum + s.profit, 0);
  }, [studentStats]);

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
  const handleMonthChange = (value: string) => {
    const [month, year] = value.split('-');
    setSearchParams({ month, year });
  };

  const handleDefaultProfitChange = (value: number) => {
    if (!staffId) return;
    setDefaultProfitPercent(value);
    localStorage.setItem(`cskh_default_profit_${staffId}`, value.toString());
  };

  const handleStudentProfitChange = (studentId: string, value: number) => {
    if (!staffId) return;
    const key = `${staffId}_${studentId}`;
    setStudentProfitPercentages((prev) => ({ ...prev, [key]: value }));
  };

  const handlePaymentStatusChange = (studentId: string, status: 'paid' | 'unpaid' | 'deposit') => {
    if (!staffId) return;
    const key = `cskh_payment_${staffId}_${studentId}_${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    localStorage.setItem(key, status);
    setPaymentStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(studentStats.map((s) => s.student.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };

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

  const handleBulkStatusUpdate = (status: 'paid' | 'unpaid' | 'deposit') => {
    selectedStudents.forEach((studentId) => {
      handlePaymentStatusChange(studentId, status);
    });
    setSelectedStudents(new Set());
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

  if (!isAdmin && (!hasCskhRole || !isSelf)) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <p style={{ color: 'var(--danger)' }}>Bạn không có quyền truy cập trang CSKH này.</p>
          <button className="btn btn-secondary mt-3" onClick={() => navigate('/staff')}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

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
        {canManagePaymentStatus && selectedStudents.size > 0 && (
          <div
            style={{
              marginTop: 'var(--spacing-3)',
              padding: 'var(--spacing-3)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>Đã chọn: {selectedStudents.size} học sinh</span>
              <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => handleBulkStatusUpdate('paid')}
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

        {/* Students Table */}
        {studentStats.length > 0 ? (
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
                        disabled={!canEditProfit}
                        style={{
                          width: '60px',
                          padding: '4px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          textAlign: 'center',
                          background: 'var(--bg)',
                        }}
                        title="% lợi nhuận mặc định"
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>%</span>
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
                      onClick={() => {
                        if (!canManagePaymentStatus) {
                          navigate(`/students/${student.id}`);
                        }
                      }}
                      style={{
                        cursor: canManagePaymentStatus ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        background: isSelected ? 'var(--bg-secondary)' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!canManagePaymentStatus) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                        }
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
                            value={stat.profitPercent}
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
                      <td
                        style={{ padding: 'var(--spacing-3)', textAlign: 'center', borderBottom: '1px solid var(--border)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={stat.paymentStatus}
                          onChange={(e) => handlePaymentStatusChange(student.id, e.target.value as 'paid' | 'unpaid' | 'deposit')}
                          disabled={!canManagePaymentStatus}
                          style={{
                            padding: 'var(--spacing-1) var(--spacing-2)',
                            borderRadius: 'var(--radius)',
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            cursor: canManagePaymentStatus ? 'pointer' : 'default',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 500,
                          }}
                        >
                          <option value="unpaid">Chờ thanh toán</option>
                          <option value="paid">Đã thanh toán</option>
                          <option value="deposit">Cọc</option>
                        </select>
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
                    <strong>{formatCurrencyVND(totalPaidAll)}</strong>
                  </td>
                  <td style={{ padding: 'var(--spacing-3)' }}>
                    <strong>{formatCurrencyVND(totalProfitAll)}</strong>
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
                    <strong>{formatCurrencyVND(totalUnpaidProfit)}</strong>
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
                    <strong>{formatCurrencyVND(totalPaidProfit)}</strong>
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
    </div>
  );
}

export default StaffCSKHDetail;

