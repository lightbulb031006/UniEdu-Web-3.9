import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { CurrencyInput } from '../components/CurrencyInput';
import {
  fetchStudentById,
  getStudentClassFinancialData,
  extendStudentSessions,
  refundStudentSessions,
  removeStudentClass,
  updateStudent,
  updateStudentClassFee,
} from '../services/studentsService';
import { fetchClasses, addStudentToClass } from '../services/classesService';
import { fetchTeachers } from '../services/teachersService';
import { createWalletTransaction, fetchWalletTransactions } from '../services/walletService';
import { useAuthStore } from '../store/authStore';
import { formatCurrencyVND } from '../utils/formatters';
import { hasRole } from '../utils/permissions';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';

/**
 * Student Detail Page Component
 * Shows detailed information about a specific student
 * Migrated from backup/assets/js/pages/students.js - renderStudentDetail
 */

function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [loginInfo] = useState<{ accountHandle?: string; email?: string; password?: string } | null>(null);
  
  // Modal states
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [transactionHistoryModalOpen, setTransactionHistoryModalOpen] = useState(false);
  const [addClassModalOpen, setAddClassModalOpen] = useState(false);
  const [editFeeModalOpen, setEditFeeModalOpen] = useState(false);
  const [editingFeeClassId, setEditingFeeClassId] = useState<string | null>(null);
  const [editLoginInfoModalOpen, setEditLoginInfoModalOpen] = useState(false);
  const [editStudentModalOpen, setEditStudentModalOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  

  const fetchStudentFn = useCallback(() => {
    if (!id) throw new Error('Student ID is required');
    return fetchStudentById(id);
  }, [id]);

  const { data: student, isLoading, error, refetch } = useDataLoading(fetchStudentFn, [id], {
    cacheKey: `student-${id}`,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch classes to get class names
  const { data: classesData } = useDataLoading(() => fetchClasses(), [], {
    cacheKey: 'classes-for-student-detail',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch teachers for CSKH staff selection
  const { data: teachersData } = useDataLoading(() => fetchTeachers(), [], {
    cacheKey: 'teachers-for-student-detail',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch student class financial data
  const fetchFinancialDataFn = useCallback(() => {
    if (!id) throw new Error('Student ID is required');
    return getStudentClassFinancialData(id);
  }, [id]);
  const { data: financialData, refetch: refetchFinancialData } = useDataLoading(fetchFinancialDataFn, [id], {
    cacheKey: `student-financial-${id}`,
    staleTime: 1 * 60 * 1000,
  });

  const classes = Array.isArray(classesData) ? classesData : [];

  // Permission checks
  const isAdmin = hasRole('admin');
  const isTeacherViewer = user?.role === 'teacher';
  const isStudentViewer = user?.role === 'student';
  const canManageStudentRecord = isAdmin;
  const canTopUp = !isStudentViewer;
  const accountIconMode = isAdmin ? 'edit' : isStudentViewer && user?.linkId === id ? 'self' : isTeacherViewer ? 'view' : null;

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Lỗi tải dữ liệu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>{error.message}</p>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/students')}>
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

  if (isLoading || !student) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải thông tin học sinh...</p>
        </div>
      </div>
    );
  }

  // Get class names
  const studentClassIds = student.classIds || (student.classId ? (Array.isArray(student.classId) ? student.classId : [student.classId]) : []);
  const studentClasses = classes.filter((cls) => studentClassIds.includes(cls.id));


  const loanDebtAmount = Number((student as any).loanBalance || 0);
  const walletBalance = formatCurrencyVND((student as any).walletBalance || 0);
  const statusBadgeClass = student.status === 'inactive' ? 'badge-muted' : 'badge-success';
  const statusLabel = student.status === 'inactive' ? 'Ngưng học' : 'Đang học';

  // Handlers for buttons
  const handleAccountBtnClick = () => {
    // Mở modal chỉnh sửa thông tin học sinh (giống backup: openStudentInfoPanel -> openStudentModal)
    setEditStudentModalOpen(true);
  };

  const handleLoginIconBtnClick = () => {
    // Mở modal chỉnh sửa thông tin đăng nhập (giống backup: openStudentLoginInfoModal)
    if (!isAdmin) {
      toast.error('Chỉ quản trị viên mới có quyền chỉnh sửa thông tin đăng nhập');
      return;
    }
    setEditLoginInfoModalOpen(true);
  };

  const handleTopUpClick = () => {
    setTopUpModalOpen(true);
  };

  const handleLoanClick = () => {
    setLoanModalOpen(true);
  };

  const handleTransactionHistoryClick = () => {
    setTransactionHistoryModalOpen(true);
  };

  const handlePayDebtClick = async () => {
    const totalDebt = Number(student.loanBalance || 0);
    if (totalDebt <= 0) {
      toast.info('Học sinh không còn nợ học phí.');
      return;
    }

    const wallet = Number(student.walletBalance || 0);
    if (wallet <= 0) {
      toast.warning('Tài khoản hiện không đủ để thanh toán nợ.');
      return;
    }

    const paidAmount = Math.min(wallet, totalDebt);
    if (paidAmount <= 0) {
      toast.warning('Không thể thanh toán nợ với số dư hiện tại.');
      return;
    }

    try {
      toast.info('Đang xử lý...');
      
      // Tạo transaction - backend sẽ tự động cập nhật walletBalance và loanBalance
      await createWalletTransaction({
        studentId: id!,
        type: 'repayment',
        amount: paidAmount,
        note: 'Thanh toán nợ ứng tiền',
        date: new Date().toISOString().split('T')[0],
      });

      // Refetch để lấy dữ liệu mới từ backend
      await Promise.all([refetch(), refetchFinancialData()]);
      
      // Tính toán lại loan balance (backend đã tự động cập nhật)
      const newLoanBalance = Math.max(0, totalDebt - paidAmount);
      
      if (newLoanBalance <= 0.01) {
        toast.success('Đã thanh toán toàn bộ nợ học phí.');
      } else {
        toast.success(`Đã thanh toán ${formatCurrencyVND(paidAmount)}. Nợ còn lại ${formatCurrencyVND(newLoanBalance)}.`);
      }
    } catch (error: any) {
      console.error('Failed to save repayment transaction:', error);
      toast.error('Không thể thanh toán nợ: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAddClassClick = () => {
    setAddClassModalOpen(true);
  };

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header - Matching code cũ */}
      <div
        className="student-detail-header"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-2)' }}>
            {accountIconMode ? (
              <button
                className="student-account-icon-btn"
                id="studentAccountBtn"
                data-student-id={student.id}
                title="Thông tin tài khoản"
                onClick={handleAccountBtnClick}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  border: '2px solid var(--primary-light)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
            ) : (
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  border: '2px solid var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: 'var(--text)' }}>{student.fullName}</h2>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>ID: {student.id}</div>
            </div>
          </div>
        </div>
        <span
          className={`badge ${statusBadgeClass}`}
          style={{
            background: student.status === 'inactive' ? 'var(--muted)' : 'var(--success)',
            color: 'white',
            border: 'none',
            padding: 'var(--spacing-2) var(--spacing-4)',
            fontWeight: '600',
            borderRadius: 'var(--radius)',
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Grid Cards - Matching code cũ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
        {/* Personal Information Card */}
        <div
          className="card student-info-card"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-5)',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--text)' }}>Thông tin cá nhân</h3>
          </div>
          <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Năm sinh:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600' }}>{student.birthYear || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Giới tính:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600' }}>{(student as any).gender === 'female' ? 'Nữ' : 'Nam'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Email:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600', wordBreak: 'break-word', textAlign: 'right' }}>{student.email || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Tỉnh/Thành:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600' }}>{student.province || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Trường:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600' }}>{student.school || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Mục tiêu học tập:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600', textAlign: 'right' }}>{student.goal || '-'}</span>
            </div>
          </div>
        </div>

        {/* Login Info Card (Admin only) */}
        {canManageStudentRecord && (
          <div
            className="card student-info-card"
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-5)',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
              <button
                className="student-login-icon-btn"
                id={`studentLoginIconBtn_${student.id}`}
                data-student-id={student.id}
                title="Chỉnh sửa thông tin đăng nhập"
                onClick={handleLoginIconBtnClick}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius)',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </button>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--text)' }}>Thông tin đăng nhập</h3>
            </div>
            <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Handle:</span>
                <span style={{ color: 'var(--text)', fontWeight: '600' }}>{loginInfo?.accountHandle || (student as any).accountHandle || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Email đăng nhập:</span>
                <span style={{ color: 'var(--text)', fontWeight: '600', wordBreak: 'break-word', textAlign: 'right' }}>
                  {loginInfo?.email || student.email || '-'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0' }}>
                <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Mật khẩu mặc định:</span>
                <span style={{ color: 'var(--text)', fontWeight: '600' }}>{loginInfo?.password || (student as any).accountPassword || 'Chưa khai báo'}</span>
              </div>
            </div>
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--muted)',
                marginTop: 'var(--spacing-4)',
                paddingTop: 'var(--spacing-3)',
                borderTop: '1px solid var(--border-light)',
                lineHeight: '1.5',
              }}
            >
              Thông tin này chỉ hiển thị cho quản trị. Để chỉnh sửa, vui lòng mở form chỉnh sửa học sinh.
            </p>
          </div>
        )}

        {/* Parent Information Card */}
        <div
          className="card student-info-card"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-5)',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--text)' }}>Thông tin phụ huynh</h3>
          </div>
          <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>Phụ huynh:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600' }}>{(student as any).parentName || '-'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-2) 0' }}>
              <span style={{ color: 'var(--muted)', fontWeight: '500' }}>SĐT phụ huynh:</span>
              <span style={{ color: 'var(--text)', fontWeight: '600' }}>{(student as any).parentPhone || '-'}</span>
            </div>
          </div>
        </div>

        {/* Account Card - Matching code cũ */}
        <div
          className="card student-account-card"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-5)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'white' }}>Tài khoản</h3>
            <button
              className="btn btn-icon"
              id="studentTxnHistoryBtn"
              title="Xem lịch sử giao dịch"
              aria-label="Xem lịch sử giao dịch"
              onClick={handleTransactionHistoryClick}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </button>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700', marginBottom: 'var(--spacing-4)', color: 'white' }}>{walletBalance}</div>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
            {canTopUp ? (
              <button
                className="btn btn-primary"
                id="studentTopUpBtn"
                onClick={handleTopUpClick}
                style={{
                  flex: 1,
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'white',
                  color: 'var(--primary)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Nạp tiền
              </button>
            ) : null}
            <button
              className="btn"
              id="studentLoanBtn"
              onClick={handleLoanClick}
              style={{
                flex: 1,
                padding: 'var(--spacing-2) var(--spacing-4)',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 'var(--radius)',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Ứng tiền
            </button>
          </div>
          <div style={{ paddingTop: 'var(--spacing-4)', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-3)',
              }}
              title="Số tiền học sinh đã ứng để gia hạn buổi học, cần hoàn trả sau"
            >
              <span style={{ opacity: 0.9, fontSize: '0.875rem' }}>Nợ ứng tiền</span>
              <strong style={{ fontSize: '1.125rem' }}>{formatCurrencyVND(loanDebtAmount)}</strong>
            </div>
            <button
              className="btn btn-primary"
              id="studentPayDebtBtn"
              disabled={loanDebtAmount <= 0}
              onClick={handlePayDebtClick}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-4)',
                background: loanDebtAmount > 0 ? 'white' : 'rgba(255,255,255,0.3)',
                color: loanDebtAmount > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.6)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontWeight: '600',
                cursor: loanDebtAmount > 0 ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
              }}
            >
              Thanh toán
            </button>
          </div>
        </div>
      </div>

      {/* Classes Table - Matching code cũ */}
      <div
        className="card"
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-5)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: 'var(--text)' }}>Các lớp đang học</h3>
          </div>
          {!isStudentViewer ? (
            <button
              className="session-icon-btn session-icon-btn-primary"
              id="studentAddClassBtn"
              title="Thêm lớp cho học sinh"
              onClick={handleAddClassClick}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14" />
                <path d="M19 12H5" />
              </svg>
            </button>
          ) : null}
        </div>
        {studentClasses.length > 0 ? (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table
              className="table-striped student-classes-table"
              id="studentClassesTable"
              style={{ width: '100%', borderCollapse: 'collapse' }}
            >
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
                  <th
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Tên lớp
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Học phí
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Đơn giá
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Còn lại
                  </th>
                  <th
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Tổng học
                  </th>
                  {!isStudentViewer ? (
                    <th
                      style={{
                        padding: 'var(--spacing-3) var(--spacing-4)',
                        textAlign: 'center',
                        width: '60px',
                        fontWeight: '600',
                        color: 'var(--text)',
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Xóa
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {studentClasses.map((cls, index) => {
                  // Get financial data for this class
                  const classFinancialData = financialData?.find((fd) => fd.classInfo.id === cls.id);
                  const displayTotal = classFinancialData ? formatCurrencyVND(classFinancialData.total) : '-';
                  const displaySessions = classFinancialData ? `${classFinancialData.sessions} buổi` : '-';
                  const unitPriceLabel = classFinancialData ? formatCurrencyVND(classFinancialData.unitPrice) : '-';
                  const remainingSessions = classFinancialData?.remaining || 0;
                  const remainingLabel = `${remainingSessions} buổi`;
                  const attendedLabel = classFinancialData ? `${classFinancialData.attended} buổi` : '0 buổi';
                  const remainingBadgeClass = remainingSessions > 0 ? 'badge-success' : 'badge-muted';

                  return (
                    <tr
                      key={cls.id}
                      className="student-class-row"
                      data-class-id={cls.id}
                      onClick={() => {
                        if (!isStudentViewer) {
                          navigate(`/classes/${cls.id}`);
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--border-light)',
                        transition: 'background-color 0.2s ease',
                        background: index % 2 === 0 ? 'var(--bg)' : 'var(--bg-secondary)',
                        cursor: !isStudentViewer ? 'pointer' : 'default',
                      }}
                      onMouseEnter={(e) => {
                        if (!isStudentViewer) {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = index % 2 === 0 ? 'var(--bg)' : 'var(--bg-secondary)';
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        {!isStudentViewer ? (
                          <button
                            className="btn student-class-link"
                            data-action="open-class-actions"
                            data-class-id={cls.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/classes/${cls.id}`);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: '600',
                              cursor: 'pointer',
                              padding: 0,
                              textAlign: 'left',
                              transition: 'color 0.2s ease',
                            }}
                          >
                            {cls.name}
                          </button>
                        ) : (
                          <span className="student-class-link-disabled" style={{ color: 'var(--text)', fontWeight: '600' }}>
                            {cls.name}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        <div className="student-class-fee" style={{ marginBottom: 'var(--spacing-2)' }}>
                          {!isStudentViewer ? (
                            <button
                              className="btn btn-link"
                              data-action="edit-fee"
                              data-class-id={cls.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFeeClassId(cls.id);
                                setEditFeeModalOpen(true);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                fontWeight: '600',
                                cursor: 'pointer',
                                padding: 0,
                                textAlign: 'left',
                                transition: 'color 0.2s ease',
                              }}
                            >
                              {displayTotal} / {displaySessions}
                            </button>
                          ) : (
                            <span className="student-fee-static" style={{ color: 'var(--text)', fontWeight: '600' }}>
                              {displayTotal} / {displaySessions}
                            </span>
                          )}
                        </div>
                        {!isStudentViewer ? (
                          <div className="student-class-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                            <button
                              className="btn btn-xs"
                              data-action="extend-class"
                              data-class-id={cls.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClassId(cls.id);
                                // Get financial data for this class
                                setExtendModalOpen(true);
                              }}
                              style={{
                                padding: 'var(--spacing-1) var(--spacing-2)',
                                fontSize: '0.75rem',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              Gia hạn
                            </button>
                            <button
                              className="btn btn-xs"
                              data-action="refund-class"
                              data-class-id={cls.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedClassId(cls.id);
                                setRefundModalOpen(true);
                              }}
                              style={{
                                padding: 'var(--spacing-1) var(--spacing-2)',
                                fontSize: '0.75rem',
                                background: 'var(--warning)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              Hoàn trả
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        <span style={{ color: 'var(--text)', fontWeight: '500', cursor: 'help' }}>{unitPriceLabel}</span>
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        <span
                          className={`badge ${remainingBadgeClass}`}
                          style={{
                            padding: 'var(--spacing-1) var(--spacing-3)',
                            borderRadius: 'var(--radius)',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                          }}
                        >
                          {remainingLabel}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--spacing-4)' }}>
                        <span style={{ color: 'var(--text)', fontWeight: '500' }}>{attendedLabel}</span>
                      </td>
                      {!isStudentViewer ? (
                        <td style={{ padding: 'var(--spacing-4)', textAlign: 'center' }}>
                          <button
                            className="btn-delete-icon"
                            data-action="remove-class"
                            data-class-id={cls.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClassId(cls.id);
                              setRemoveModalOpen(true);
                            }}
                            title="Xóa lớp"
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
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem', fontWeight: '500' }}>Học sinh chưa tham gia lớp nào</p>
          </div>
        )}
      </div>

      {/* Extend Sessions Modal */}
      <Modal
        title="Gia hạn buổi học"
        isOpen={extendModalOpen}
        onClose={() => {
          setExtendModalOpen(false);
          setSelectedClassId(null);
        }}
      >
        {selectedClassId && student && (
          <ExtendSessionsModal
            studentId={id!}
            student={student}
            classId={selectedClassId}
            financialData={financialData || undefined}
            onSuccess={async () => {
              setExtendModalOpen(false);
              // Refetch both student data and financial data to update remaining sessions
              await Promise.all([refetch(), refetchFinancialData()]);
            }}
            onClose={() => {
              setExtendModalOpen(false);
              setSelectedClassId(null);
            }}
          />
        )}
      </Modal>

      {/* Refund Sessions Modal */}
      <Modal
        title="Hoàn trả học phí"
        isOpen={refundModalOpen}
        onClose={() => {
          setRefundModalOpen(false);
          setSelectedClassId(null);
        }}
      >
        {selectedClassId && student && (
          <RefundSessionsModal
            studentId={id!}
            student={student}
            classId={selectedClassId}
            financialData={financialData || undefined}
            onSuccess={async () => {
              setRefundModalOpen(false);
              // Refetch both student data and financial data to update remaining sessions
              await Promise.all([refetch(), refetchFinancialData()]);
            }}
            onClose={() => {
              setRefundModalOpen(false);
              setSelectedClassId(null);
            }}
          />
        )}
      </Modal>

      {/* Remove Class Modal */}
      <Modal
        title="Xóa lớp khỏi học sinh"
        isOpen={removeModalOpen}
        onClose={() => {
          setRemoveModalOpen(false);
          setSelectedClassId(null);
        }}
      >
        {selectedClassId && student && (
          <RemoveClassModal
            studentId={id!}
            student={student}
            classId={selectedClassId}
            classes={classes}
            financialData={financialData || undefined}
            onSuccess={async () => {
              setRemoveModalOpen(false);
              // Refetch both student data and financial data
              await Promise.all([refetch(), refetchFinancialData()]);
            }}
            onClose={() => {
              setRemoveModalOpen(false);
              setSelectedClassId(null);
            }}
          />
        )}
      </Modal>

      {/* Top Up Modal */}
      <Modal
        title="Nạp tiền cho học sinh"
        isOpen={topUpModalOpen}
        onClose={() => setTopUpModalOpen(false)}
      >
        {student && (
          <TopUpModal
            studentId={id!}
            student={student}
            onSuccess={async () => {
              setTopUpModalOpen(false);
              // Refetch cả student data và financial data để đảm bảo số dư được cập nhật
              await Promise.all([refetch(), refetchFinancialData()]);
            }}
            onClose={() => setTopUpModalOpen(false)}
          />
        )}
      </Modal>

      {/* Loan Modal */}
      <Modal
        title="Ứng tiền"
        isOpen={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
      >
        {student && (
          <LoanModal
            studentId={id!}
            student={student}
            onSuccess={async () => {
              setLoanModalOpen(false);
              // Refetch cả student data và financial data để đảm bảo số dư được cập nhật
              await Promise.all([refetch(), refetchFinancialData()]);
            }}
            onClose={() => setLoanModalOpen(false)}
          />
        )}
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        title="Lịch sử giao dịch"
        isOpen={transactionHistoryModalOpen}
        onClose={() => setTransactionHistoryModalOpen(false)}
        size="lg"
      >
        {id && <TransactionHistoryModal studentId={id} />}
      </Modal>

      {/* Add Class Modal */}
      <Modal
        title="Thêm lớp cho học sinh"
        isOpen={addClassModalOpen}
        onClose={() => setAddClassModalOpen(false)}
        size="lg"
      >
        {student && (
          <AddClassModal
            studentId={id!}
            student={student}
            classes={classes}
            onSuccess={() => {
              setAddClassModalOpen(false);
              refetch();
            }}
            onClose={() => setAddClassModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Fee Modal */}
      <Modal
        title="Chỉnh sửa học phí học sinh"
        isOpen={editFeeModalOpen}
        onClose={() => {
          setEditFeeModalOpen(false);
          setEditingFeeClassId(null);
        }}
        size="md"
      >
        {editingFeeClassId && student && classes && financialData && (
          <EditFeeModal
            studentId={id!}
            classId={editingFeeClassId}
            classInfo={classes.find((c) => c.id === editingFeeClassId)}
            financialData={financialData}
            onSuccess={async () => {
              setEditFeeModalOpen(false);
              setEditingFeeClassId(null);
              // Refetch both student data and financial data
              await Promise.all([refetch(), refetchFinancialData()]);
            }}
            onClose={() => {
              setEditFeeModalOpen(false);
              setEditingFeeClassId(null);
            }}
          />
        )}
      </Modal>

      {/* Edit Login Info Modal */}
      <Modal
        title="Chỉnh sửa thông tin đăng nhập"
        isOpen={editLoginInfoModalOpen}
        onClose={() => setEditLoginInfoModalOpen(false)}
        size="md"
      >
        {student && (
          <EditLoginInfoModal
            studentId={id!}
            student={student}
            loginInfo={loginInfo}
            onSuccess={() => {
              setEditLoginInfoModalOpen(false);
              refetch();
            }}
            onClose={() => setEditLoginInfoModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Student Info Modal */}
      <Modal
        title="Chỉnh sửa thông tin học sinh"
        isOpen={editStudentModalOpen}
        onClose={() => setEditStudentModalOpen(false)}
        size="lg"
      >
        {student && teachersData && (
          <EditStudentInfoModal
            studentId={id!}
            student={student}
            teachers={teachersData}
            onSuccess={() => {
              setEditStudentModalOpen(false);
              refetch();
            }}
            onClose={() => setEditStudentModalOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}

// Extend Sessions Modal Component
function ExtendSessionsModal({
  studentId,
  student: _student,
  classId,
  financialData,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  classId: string;
  financialData?: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<string>('1');
  const [loading, setLoading] = useState(false);

  const classData = useMemo(() => {
    return financialData?.find((fd) => fd.classInfo.id === classId);
  }, [financialData, classId]);

  // Calculate reference unit price like backup
  const referenceUnitPrice = useMemo(() => {
    if (!classData) return 0;
    
    const record = classData.record;
    const classInfo = classData.classInfo;
    
    const classDefaultTotal = classInfo?.tuition_package_total || 0;
    const classDefaultSessions = classInfo?.tuition_package_sessions || 0;
    
    // defaultUnit: từ classInfo.student_tuition_per_session hoặc tính từ gói
    const defaultUnit = (() => {
      if (classInfo?.student_tuition_per_session) {
        return Number(classInfo.student_tuition_per_session);
      }
      if (classDefaultTotal > 0 && classDefaultSessions > 0) {
        return classDefaultTotal / classDefaultSessions;
      }
      return 0;
    })();
    
    // manualUnit: từ studentFeeTotal / studentFeeSessions
    const manualUnit = (record?.student_fee_total && record?.student_fee_sessions)
      ? (record.student_fee_total / record.student_fee_sessions)
      : null;
    
    // historicalUnit: từ totalPaidAmount / totalPurchasedSessions
    // Sử dụng unitPrice từ backend (đã được tính từ totalPaidAmount / totalPurchasedSessions)
    // Hoặc có thể tính từ record nếu có total_purchased_sessions và total_paid_amount
    const historicalUnit = classData.unitPrice > 0 ? classData.unitPrice : null;
    
    // resolvedUnit: ưu tiên manualUnit > historicalUnit > defaultUnit
    return manualUnit ?? historicalUnit ?? defaultUnit;
  }, [classData]);

  const [unitPrice, setUnitPrice] = useState<number>(0);

  // Prefill unit price with referenceUnitPrice (giống backup: value="${resolvedUnit || 0}")
  useEffect(() => {
    setUnitPrice(referenceUnitPrice || 0);
  }, [referenceUnitPrice]);

  const walletBalance = Number(_student.walletBalance || 0);
  // Convert sessions string to number for calculation
  const sessionsNum = useMemo(() => {
    const num = parseFloat(sessions);
    return isNaN(num) || num <= 0 ? 0 : num;
  }, [sessions]);
  
  // Tự động tính tổng tiền khi thay đổi sessions hoặc unitPrice (giống backup updateTotal)
  const totalCost = useMemo(() => {
    return sessionsNum > 0 && unitPrice > 0 ? sessionsNum * unitPrice : 0;
  }, [sessionsNum, unitPrice]);
  const insufficient = totalCost > walletBalance && sessionsNum > 0 && unitPrice > 0;
  
  // Calculate reference info for display
  const referenceInfo = useMemo(() => {
    if (!classData) return null;
    
    const record = classData.record;
    const classInfo = classData.classInfo;
    const classDefaultTotal = classInfo?.tuition_package_total || 0;
    const classDefaultSessions = classInfo?.tuition_package_sessions || 0;
    
    const manualUnit = (record?.student_fee_total && record?.student_fee_sessions)
      ? (record.student_fee_total / record.student_fee_sessions)
      : null;
    const defaultUnit = classInfo?.student_tuition_per_session 
      ? Number(classInfo.student_tuition_per_session)
      : (classDefaultTotal > 0 && classDefaultSessions > 0 ? classDefaultTotal / classDefaultSessions : 0);
    
    return {
      manualUnit,
      defaultUnit,
      classDefaultTotal,
      classDefaultSessions,
    };
  }, [classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation giống backup: kiểm tra sessions > 0 và unitPrice > 0
    if (sessionsNum <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error('Vui lòng nhập số buổi hợp lệ');
      return;
    }
    // Round sessions như backup
    const roundedSessions = Math.round(sessionsNum);
    const finalTotalCost = roundedSessions * unitPrice;
    if (walletBalance < finalTotalCost) {
      toast.error('Số dư không đủ để gia hạn');
      return;
    }

    setLoading(true);
    try {
      await extendStudentSessions(studentId, classId, roundedSessions, unitPrice);
      toast.success('Đã gia hạn buổi học');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể gia hạn buổi học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Số buổi muốn gia hạn
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={sessions}
          onChange={(e) => setSessions(e.target.value)}
          onBlur={(e) => {
            // Validate on blur: if empty or invalid, set to 1
            const value = e.target.value.trim();
            if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
              setSessions('1');
            }
          }}
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Giá mỗi buổi (VND)
        </label>
        <CurrencyInput
          value={unitPrice}
          onChange={setUnitPrice}
          placeholder="Nhập giá mỗi buổi"
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        {classData && referenceInfo && (
          <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Giá tham chiếu: {formatCurrencyVND(referenceUnitPrice)}
            {referenceInfo.manualUnit === null && referenceInfo.defaultUnit > 0 && (
              <> (mặc định lớp {formatCurrencyVND(referenceInfo.defaultUnit)})</>
            )}
            {referenceInfo.classDefaultTotal > 0 && referenceInfo.classDefaultSessions > 0 && (
              <>
                <br />
                Gói lớp: {formatCurrencyVND(referenceInfo.classDefaultTotal)} / {referenceInfo.classDefaultSessions} buổi
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)', fontWeight: '600', color: insufficient ? 'var(--danger)' : 'var(--text)' }}>
        Tổng tiền: {formatCurrencyVND(totalCost)} {insufficient && '• Số dư không đủ'}
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)', fontSize: '0.875rem', color: 'var(--muted)' }}>
        Số dư hiện tại: {formatCurrencyVND(walletBalance)}
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading || insufficient}>
          {loading ? 'Đang xử lý...' : 'Gia hạn'}
        </button>
      </div>
    </form>
  );
}

// Refund Sessions Modal Component
function RefundSessionsModal({
  studentId,
  student: _student,
  classId,
  financialData,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  classId: string;
  financialData?: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<string>('1');
  const [loading, setLoading] = useState(false);

  const classData = useMemo(() => {
    return financialData?.find((fd) => fd.classInfo.id === classId);
  }, [financialData, classId]);

  const maxSessions = classData?.remaining || 0;

  // Calculate reference unit price like backup
  const referenceUnitPrice = useMemo(() => {
    if (!classData) return 0;
    
    const record = classData.record;
    const classInfo = classData.classInfo;
    
    const classDefaultTotal = classInfo?.tuition_package_total || 0;
    const classDefaultSessions = classInfo?.tuition_package_sessions || 0;
    
    // defaultUnit: từ classInfo.student_tuition_per_session hoặc tính từ gói
    const defaultUnit = (() => {
      if (classInfo?.student_tuition_per_session) {
        return Number(classInfo.student_tuition_per_session);
      }
      if (classDefaultTotal > 0 && classDefaultSessions > 0) {
        return classDefaultTotal / classDefaultSessions;
      }
      return 0;
    })();
    
    // manualUnit: từ studentFeeTotal / studentFeeSessions
    const manualUnit = (record?.student_fee_total && record?.student_fee_sessions)
      ? (record.student_fee_total / record.student_fee_sessions)
      : null;
    
    // historicalUnit: từ unitPrice từ backend
    const historicalUnit = classData.unitPrice > 0 ? classData.unitPrice : null;
    
    // resolvedUnit: ưu tiên manualUnit > historicalUnit > defaultUnit
    return manualUnit ?? historicalUnit ?? defaultUnit;
  }, [classData]);

  const [unitPrice, setUnitPrice] = useState<number>(0);

  // Prefill unit price and sessions from class data (giống backup: value="${resolvedUnit || 0}")
  useEffect(() => {
    if (classData) {
      setUnitPrice(referenceUnitPrice || 0);
      setSessions(String(Math.min(1, maxSessions)));
    }
  }, [classData, maxSessions, referenceUnitPrice]);

  // Convert sessions string to number for calculation
  const sessionsNum = useMemo(() => {
    const num = parseFloat(sessions);
    return isNaN(num) || num <= 0 ? 0 : num;
  }, [sessions]);

  // Tự động tính tổng tiền hoàn lại khi thay đổi sessions hoặc unitPrice (giống backup updateTotal)
  const totalRefund = useMemo(() => {
    return sessionsNum > 0 && unitPrice > 0 ? sessionsNum * unitPrice : 0;
  }, [sessionsNum, unitPrice]);
  
  // Calculate reference info for display
  const referenceInfo = useMemo(() => {
    if (!classData) return null;
    
    const record = classData.record;
    const classInfo = classData.classInfo;
    const classDefaultTotal = classInfo?.tuition_package_total || 0;
    const classDefaultSessions = classInfo?.tuition_package_sessions || 0;
    
    const manualUnit = (record?.student_fee_total && record?.student_fee_sessions)
      ? (record.student_fee_total / record.student_fee_sessions)
      : null;
    const defaultUnit = classInfo?.student_tuition_per_session 
      ? Number(classInfo.student_tuition_per_session)
      : (classDefaultTotal > 0 && classDefaultSessions > 0 ? classDefaultTotal / classDefaultSessions : 0);
    
    return {
      manualUnit,
      defaultUnit,
      classDefaultTotal,
      classDefaultSessions,
    };
  }, [classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation giống backup
    if (sessionsNum <= 0 || sessionsNum > maxSessions) {
      toast.error('Số buổi hoàn trả không hợp lệ');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error('Giá buổi không hợp lệ');
      return;
    }
    const roundedSessions = Math.round(sessionsNum);

    setLoading(true);
    try {
      await refundStudentSessions(studentId, classId, roundedSessions, unitPrice);
      toast.success('Đã hoàn trả học phí');
      window.dispatchEvent(new CustomEvent('wallet-transaction-created', {
        detail: { type: 'refund', amount: roundedSessions * unitPrice, date: new Date().toISOString().split('T')[0] },
      }));
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể hoàn trả học phí: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Số buổi hoàn trả
        </label>
        <input
          type="number"
          min="1"
          max={maxSessions}
          step="1"
          value={sessions}
          onChange={(e) => setSessions(e.target.value)}
          onBlur={(e) => {
            // Validate on blur: if empty or invalid, set to 1
            const value = e.target.value.trim();
            const num = parseFloat(value);
            if (!value || isNaN(num) || num <= 0) {
              setSessions('1');
            } else if (num > maxSessions) {
              setSessions(String(maxSessions));
            }
          }}
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Có thể hoàn tối đa {maxSessions} buổi.
        </div>
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Giá mỗi buổi (VND)
        </label>
        <CurrencyInput
          value={unitPrice}
          onChange={setUnitPrice}
          placeholder="Nhập giá mỗi buổi"
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        {classData && referenceInfo && (
          <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
            Giá tham chiếu: {formatCurrencyVND(referenceUnitPrice)}
            {referenceInfo.manualUnit === null && referenceInfo.defaultUnit > 0 && (
              <> (mặc định lớp {formatCurrencyVND(referenceInfo.defaultUnit)})</>
            )}
            {referenceInfo.classDefaultTotal > 0 && referenceInfo.classDefaultSessions > 0 && (
              <>
                <br />
                Gói lớp: {formatCurrencyVND(referenceInfo.classDefaultTotal)} / {referenceInfo.classDefaultSessions} buổi
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)', fontWeight: '600', color: 'var(--text)' }}>
        Hoàn lại: {formatCurrencyVND(totalRefund)}
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Hoàn trả'}
        </button>
      </div>
    </form>
  );
}

// Remove Class Modal Component
function RemoveClassModal({
  studentId,
  student: _student,
  classId,
  classes,
  financialData,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  classId: string;
  classes: any[];
  financialData?: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const classInfo = classes.find((c) => c.id === classId);
  const classData = financialData?.find((fd) => fd.classInfo.id === classId);
  const className = classInfo?.name || 'Lớp đã xóa';
  const remainingSessions = classData?.remaining || 0;
  const unitPrice = classData?.unitPrice || 0;
  const refundAmount = remainingSessions > 0 && unitPrice > 0 ? remainingSessions * unitPrice : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== className) {
      alert(`Vui lòng nhập chính xác tên lớp "${className}" để xác nhận`);
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa lớp "${className}" khỏi học sinh?`)) {
      return;
    }

    setLoading(true);
    try {
      await removeStudentClass(studentId, classId, refundAmount > 0);
      if (refundAmount > 0) {
        window.dispatchEvent(new CustomEvent('wallet-transaction-created', {
          detail: { type: 'refund', amount: refundAmount, date: new Date().toISOString().split('T')[0] },
        }));
      }
      onSuccess();
    } catch (error: any) {
      alert('Không thể xóa lớp khỏi học sinh: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <p style={{ marginBottom: 'var(--spacing-3)' }}>
          Bạn có chắc chắn muốn xóa lớp <strong>{className}</strong> khỏi học sinh này?
        </p>
        {remainingSessions > 0 && (
          <div style={{ padding: 'var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 'var(--spacing-3)' }}>
            <p style={{ margin: 0, marginBottom: 'var(--spacing-2)' }}>
              Học sinh còn <strong>{remainingSessions} buổi</strong> chưa học.
            </p>
            {refundAmount > 0 && (
              <p style={{ margin: 0 }}>
                Sẽ hoàn lại <strong>{formatCurrencyVND(refundAmount)}</strong> vào tài khoản học sinh.
              </p>
            )}
          </div>
        )}
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Nhập tên lớp để xác nhận: <strong>{className}</strong>
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          required
          placeholder={className}
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-danger" disabled={loading || confirmText !== className}>
          {loading ? 'Đang xử lý...' : 'Xóa lớp'}
        </button>
      </div>
    </form>
  );
}

// Top Up Modal Component
function TopUpModal({
  studentId,
  student,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      // Tạo transaction - backend sẽ tự động cập nhật walletBalance
      await createWalletTransaction({
        studentId,
        type: 'topup',
        amount: amount,
        note: note.trim() || '',
        date: new Date().toISOString().split('T')[0],
      });
      
      // Dispatch event để Dashboard tự động refetch
      // Cả số dương (nạp) và số âm (trừ) đều ảnh hưởng đến doanh thu
      if (amount !== 0) {
        window.dispatchEvent(new CustomEvent('wallet-transaction-created', {
          detail: { type: 'topup', amount, date: new Date().toISOString().split('T')[0] }
        }));
      }
      
      toast.success(amount > 0 ? 'Đã nạp tiền vào tài khoản' : 'Đã trừ tiền khỏi tài khoản');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể nạp tiền: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Số tiền nạp (VND)
        </label>
        <CurrencyInput
          value={amount}
          onChange={setAmount}
          placeholder="Nhập số tiền"
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Có thể nhập số dương (nạp tiền) hoặc số âm (trừ tiền).
        </div>
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Ghi chú
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ghi chú về giao dịch (tuỳ chọn)"
          rows={3}
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            resize: 'vertical',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Nạp tiền'}
        </button>
      </div>
    </form>
  );
}

// Loan Modal Component
function LoanModal({
  studentId,
  student,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }

    setLoading(true);
    try {
      // Tạo transaction - backend sẽ tự động cập nhật walletBalance và loanBalance
      await createWalletTransaction({
        studentId,
        type: 'advance',
        amount: amount,
        note: note.trim() || '',
        date: new Date().toISOString().split('T')[0],
      });
      
      // Dispatch event để Dashboard tự động refetch (nếu cần)
      window.dispatchEvent(new CustomEvent('wallet-transaction-created', {
        detail: { type: 'advance', amount, date: new Date().toISOString().split('T')[0] }
      }));
      
      toast.success(amount > 0 ? 'Đã cộng tiền vay vào tài khoản' : 'Đã trừ tiền vay khỏi tài khoản');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể ứng tiền: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Số tiền muốn vay (VND)
        </label>
        <CurrencyInput
          value={amount}
          onChange={setAmount}
          placeholder="Nhập số tiền"
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
        <div style={{ marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Có thể nhập số dương (ứng tiền) hoặc số âm (trừ tiền ứng).
        </div>
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Ghi chú
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Mục đích vay (tuỳ chọn)"
          rows={3}
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            resize: 'vertical',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Xác nhận vay'}
        </button>
      </div>
    </form>
  );
}

// Transaction History Modal Component
function TransactionHistoryModal({ studentId }: { studentId: string }) {
  const fetchTransactionsFn = useCallback(() => fetchWalletTransactions({ studentId }), [studentId]);
  const { data: transactions, isLoading } = useDataLoading(fetchTransactionsFn, [studentId], {
    cacheKey: `wallet-transactions-${studentId}`,
    staleTime: 1 * 60 * 1000,
  });

  const typeLabel: Record<string, string> = {
    topup: 'Nạp tiền',
    loan: 'Ứng tiền',
    advance: 'Ứng tiền',
    repayment: 'Thanh toán nợ',
    extend: 'Gia hạn buổi học',
    refund: 'Hoàn trả buổi học',
  };

  // Filter and sort transactions: include all types, sort by created_at (newest first)
  // If created_at is the same, sort by date, then by id (newest first)
  const filteredTransactions = (transactions || []).filter((tx: any) =>
    ['topup', 'loan', 'advance', 'repayment', 'extend', 'refund'].includes(tx.type)
  ).sort((a: any, b: any) => {
    // First sort by created_at (newest first)
    const aCreatedAt = a.createdAt || a.created_at || '';
    const bCreatedAt = b.createdAt || b.created_at || '';
    if (aCreatedAt && bCreatedAt) {
      return bCreatedAt.localeCompare(aCreatedAt);
    }
    // If no created_at, sort by date (newest first)
    const aDate = a.date || '';
    const bDate = b.date || '';
    if (aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }
    // If same date, sort by id (newest first - assuming newer IDs come later alphabetically)
    return (b.id || '').localeCompare(a.id || '');
  });

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 'var(--spacing-4)' }}>Đang tải...</div>;
  }

  if (!filteredTransactions.length) {
    return <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Chưa có giao dịch nào.</p>;
  }

  return (
    <div className="table-container" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>
              Ngày
            </th>
            <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>
              Loại
            </th>
            <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>
              Số tiền
            </th>
            <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem' }}>
              Ghi chú
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.map((tx: any) => (
            <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td style={{ padding: 'var(--spacing-3)' }}>{tx.date || '-'}</td>
              <td style={{ padding: 'var(--spacing-3)' }}>{typeLabel[tx.type] || tx.type}</td>
              <td style={{ padding: 'var(--spacing-3)', fontWeight: '500' }}>{formatCurrencyVND(tx.amount)}</td>
              <td style={{ padding: 'var(--spacing-3)', color: 'var(--muted)' }}>{tx.note || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Add Class Modal Component
function AddClassModal({
  studentId,
  student,
  classes,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  classes: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const studentClassIds = student.classIds || (student.classId ? (Array.isArray(student.classId) ? student.classId : [student.classId]) : []);
  const existingClassIds = new Set(studentClassIds);
  const availableClasses = classes.filter((cls) => !existingClassIds.has(cls.id));

  const normalizeText = (text: string) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableClasses.slice(0, 8);
    }
    const normalizedQuery = normalizeText(searchQuery);
    return availableClasses.filter((cls) => normalizeText(cls.name || '').includes(normalizedQuery));
  }, [availableClasses, searchQuery]);

  const handleAddClass = async (classId: string) => {
    if (existingClassIds.has(classId)) {
      toast.warning('Học sinh đã tham gia lớp này');
      return;
    }

    setLoading(true);
    try {
      await addStudentToClass(classId, studentId);
      toast.success('Đã thêm học sinh vào lớp');
      setSearchQuery('');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể thêm học sinh vào lớp: ' + (error.response?.data?.error || error.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  if (!availableClasses.length) {
    return (
      <div>
        <p style={{ color: 'var(--muted)', textAlign: 'center' }}>Học sinh đã tham gia tất cả các lớp hiện có</p>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>
          Học sinh hiện đang tham gia {existingClassIds.size} lớp.
        </div>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Tìm lớp để thêm vào học sinh
        </label>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm lớp để thêm vào học sinh"
          autoComplete="off"
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)', maxHeight: '400px', overflowY: 'auto' }}>
        {filteredClasses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
            {filteredClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleAddClass(cls.id)}
                disabled={loading}
                style={{
                  padding: 'var(--spacing-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--surface)',
                  textAlign: 'left',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!loading) e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: 'var(--spacing-1)' }}>{cls.name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                  {cls.studentTuitionPerSession
                    ? `Học phí: ${formatCurrencyVND(cls.studentTuitionPerSession)} / buổi`
                    : 'Chưa cấu hình học phí'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--muted)' }}>
            Không tìm thấy lớp phù hợp.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Đóng
        </button>
      </div>
    </div>
  );
}

// Edit Login Info Modal Component
function EditLoginInfoModal({
  studentId,
  student,
  loginInfo,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  loginInfo: { accountHandle?: string; email?: string; password?: string } | null;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [accountHandle, setAccountHandle] = useState<string>(loginInfo?.accountHandle || student.accountHandle || '');
  const [accountPassword, setAccountPassword] = useState<string>(loginInfo?.password || student.accountPassword || '');
  const [loginEmail, setLoginEmail] = useState<string>(loginInfo?.email || student.email || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation giống backup
    if (!accountHandle.trim()) {
      toast.error('Vui lòng nhập Handle / Username');
      return;
    }
    if (!accountPassword.trim()) {
      toast.error('Vui lòng nhập mật khẩu mặc định');
      return;
    }

    const updateData: any = {
      accountHandle: accountHandle.trim(),
      accountPassword: accountPassword.trim(),
    };

    // Nếu có loginEmail, cập nhật email (email đăng nhập)
    if (loginEmail.trim()) {
      updateData.email = loginEmail.trim();
    }

    setLoading(true);
    try {
      await updateStudent(studentId, updateData);
      toast.success('Đã cập nhật thông tin đăng nhập');
      onSuccess();
    } catch (error: any) {
      toast.error('Có lỗi xảy ra khi cập nhật thông tin đăng nhập: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Student Info Header - giống backup */}
      <div style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-2)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <strong style={{ color: 'var(--text)' }}>{student.fullName}</strong>
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>ID: {student.id}</div>
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="loginInfoHandle" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Handle / Username <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <input
          type="text"
          id="loginInfoHandle"
          className="form-control"
          value={accountHandle}
          onChange={(e) => setAccountHandle(e.target.value)}
          placeholder="vd: hocsinh1"
          required
        />
        <small style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Sử dụng cho đăng nhập nội bộ
        </small>
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="loginInfoPassword" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Mật khẩu mặc định <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <input
          type="text"
          id="loginInfoPassword"
          className="form-control"
          value={accountPassword}
          onChange={(e) => setAccountPassword(e.target.value)}
          placeholder="vd: 123456"
          required
        />
        <small style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Dùng khi cấp lại tài khoản
        </small>
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="loginInfoEmail" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Email đăng nhập
        </label>
        <input
          type="email"
          id="loginInfoEmail"
          className="form-control"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          placeholder="Email dùng để đăng nhập (nếu để trống sẽ dùng email liên hệ)"
        />
        <small style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Email đăng nhập có thể khác với email liên hệ. Nếu để trống sẽ dùng email liên hệ làm email đăng nhập.
        </small>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}

// Edit Student Info Modal Component
function EditStudentInfoModal({
  studentId,
  student,
  teachers,
  onSuccess,
  onClose,
}: {
  studentId: string;
  student: any;
  teachers: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  // Get CSKH staff (teachers with cskh_sale role)
  const cskhStaff = useMemo(() => {
    return teachers.filter((t: any) => {
      const roles = t.roles || [];
      return roles.includes('cskh_sale');
    });
  }, [teachers]);

  // Get current CSKH staff ID (check both cskh_staff_id and cskhStaffId)
  const currentCskhStaffId = (student as any).cskh_staff_id || (student as any).cskhStaffId || '';

  const [formData, setFormData] = useState({
    fullName: student.fullName || '',
    birthYear: student.birthYear || new Date().getFullYear() - 15,
    school: student.school || '',
    province: student.province || '',
    email: student.email || '',
    gender: (student as any).gender || 'male',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    status: student.status || 'active',
    goal: student.goal || '',
    cskhStaffId: currentCskhStaffId,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const studentData: any = {
      fullName: formData.fullName.trim(),
      birthYear: formData.birthYear,
      school: formData.school.trim(),
      province: formData.province.trim(),
      parentName: formData.parentName.trim(),
      parentPhone: formData.parentPhone.trim(),
      status: formData.status,
      gender: formData.gender,
    };

    if (formData.email) {
      studentData.email = formData.email.trim();
    }

    if (formData.goal) {
      studentData.goal = formData.goal.trim();
    }

    // Add CSKH staff assignment (send empty string to unassign, matching backup behavior)
    if (formData.cskhStaffId) {
      studentData.cskhStaffId = formData.cskhStaffId;
    } else {
      // If empty, send empty string to unassign (backend will handle null conversion)
      studentData.cskhStaffId = '';
    }

    setLoading(true);
    try {
      await updateStudent(studentId, studentData);
      toast.success('Đã cập nhật thông tin học sinh');
      onSuccess();
    } catch (error: any) {
      toast.error('Lỗi khi cập nhật học sinh: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form sections giống backup */}
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Thông tin cá nhân</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
          <div>
            <label htmlFor="editStudentName" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Họ và tên <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              id="editStudentName"
              className="form-control"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Nhập họ và tên đầy đủ"
              required
            />
          </div>
          <div>
            <label htmlFor="editStudentBirthYear" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Năm sinh <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="number"
              id="editStudentBirthYear"
              className="form-control"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: parseInt(e.target.value, 10) || new Date().getFullYear() - 15 })}
              min="1990"
              max={new Date().getFullYear() - 5}
              required
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-3)' }}>
          <div>
            <label htmlFor="editStudentSchool" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Trường học <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              id="editStudentSchool"
              className="form-control"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              placeholder="Tên trường học"
              required
            />
          </div>
          <div>
            <label htmlFor="editStudentProvince" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Tỉnh thành <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              id="editStudentProvince"
              className="form-control"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              placeholder="Tỉnh/Thành phố"
              required
            />
          </div>
        </div>
        <div style={{ marginTop: 'var(--spacing-3)' }}>
          <label htmlFor="editStudentEmail" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Email liên hệ
          </label>
          <input
            type="email"
            id="editStudentEmail"
            className="form-control"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Email dùng để liên lạc"
          />
        </div>
        <div style={{ marginTop: 'var(--spacing-3)' }}>
          <label htmlFor="editStudentGender" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Giới tính
          </label>
          <select
            id="editStudentGender"
            className="form-control"
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
          >
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>Thông tin phụ huynh</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
          <div>
            <label htmlFor="editStudentParentName" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Phụ huynh <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              id="editStudentParentName"
              className="form-control"
              value={formData.parentName}
              onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              placeholder="Tên phụ huynh"
              required
            />
          </div>
          <div>
            <label htmlFor="editStudentParentPhone" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              SĐT phụ huynh <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="tel"
              id="editStudentParentPhone"
              className="form-control"
              value={formData.parentPhone}
              onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
              placeholder="Số điện thoại"
              required
            />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="editStudentGoal" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Mục tiêu học tập
        </label>
        <textarea
          id="editStudentGoal"
          className="form-control"
          value={formData.goal}
          onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
          placeholder="Mục tiêu học tập của học sinh"
          rows={3}
        />
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="editStudentCskhStaff" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Người phụ trách CSKH
        </label>
        <select
          id="editStudentCskhStaff"
          className="form-control"
          value={formData.cskhStaffId}
          onChange={(e) => setFormData({ ...formData, cskhStaffId: e.target.value })}
        >
          <option value="">Chưa phân công</option>
          {cskhStaff.map((staff: any) => (
            <option key={staff.id} value={staff.id}>
              {staff.fullName || staff.name}
              {staff.email ? ` (${staff.email})` : ''}
            </option>
          ))}
        </select>
        <small style={{ display: 'block', marginTop: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
          Chọn nhân sự có role SALE&CSKH để phụ trách học sinh này
        </small>
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="editStudentStatus" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Trạng thái
        </label>
        <select
          id="editStudentStatus"
          className="form-control"
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
        >
          <option value="active">Đang học</option>
          <option value="inactive">Nghỉ học</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-6)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>
    </form>
  );
}

// Edit Fee Modal Component
function EditFeeModal({
  studentId,
  classId,
  classInfo,
  financialData,
  onSuccess,
  onClose,
}: {
  studentId: string;
  classId: string;
  classInfo: any;
  financialData?: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  // Get current fee data (giống backup: record.studentFeeTotal || record.totalPaidAmount || 0)
  const financialRecord = financialData?.find((fd: any) => fd.classInfo.id === classId);
  const record = financialRecord?.record;
  // Backup: total = record.studentFeeTotal || record.totalPaidAmount || 0
  // Trong frontend: record.student_fee_total hoặc financialRecord.total (đã được tính từ backend)
  const currentTotal = record?.student_fee_total || financialRecord?.total || 0;
  // Backup: sessions = record.studentFeeSessions || record.totalPurchasedSessions || 0
  // Trong frontend: record.student_fee_sessions hoặc financialRecord.sessions
  const currentSessions = record?.student_fee_sessions || financialRecord?.sessions || 1;

  // Calculate default unit price (giống backup)
  const defaultUnit = useMemo(() => {
    if (!classInfo) return 0;
    if (classInfo.studentTuitionPerSession) return Number(classInfo.studentTuitionPerSession);
    const total = Number(classInfo?.tuitionPackageTotal || 0);
    const sessions = Number(classInfo?.tuitionPackageSessions || 0);
    if (total > 0 && sessions > 0) return total / sessions;
    return 0;
  }, [classInfo]);

  // Calculate current unit (giống backup: window.UniData.getStudentFeePerSession(record) || defaultUnit)
  // Backup: currentUnit = window.UniData.getStudentFeePerSession(record) || defaultUnit
  const currentUnit = useMemo(() => {
    if (record?.student_fee_total && record?.student_fee_sessions && record.student_fee_sessions > 0) {
      return record.student_fee_total / record.student_fee_sessions;
    }
    if (financialRecord?.total && financialRecord?.sessions && financialRecord.sessions > 0) {
      return financialRecord.total / financialRecord.sessions;
    }
    return defaultUnit;
  }, [record, financialRecord, defaultUnit]);

  // Initial unit (giống backup: currentUnit || defaultUnit)
  const initialUnit = currentUnit || defaultUnit;

  const [feeTotal, setFeeTotal] = useState<number>(currentTotal);
  const [feeSessions, setFeeSessions] = useState<number>(currentSessions);
  const [feeSessionsInput, setFeeSessionsInput] = useState<string>(String(currentSessions));
  const [loading, setLoading] = useState(false);

  // Prefill values when modal opens or financialData changes
  useEffect(() => {
    // Update all values when currentTotal or currentSessions change
    // This ensures form is prefilled with latest data when modal opens
    setFeeTotal(currentTotal);
    setFeeSessions(currentSessions);
    setFeeSessionsInput(String(currentSessions));
  }, [currentTotal, currentSessions]);

  // Calculate per session price (giống backup: updatePerSession)
  const perSessionPrice = useMemo(() => {
    if (feeSessions > 0 && feeTotal > 0) {
      return feeTotal / feeSessions;
    }
    return initialUnit;
  }, [feeTotal, feeSessions, initialUnit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate giống backup
    if (!Number.isFinite(feeTotal) || feeTotal < 0) {
      toast.error('Tổng học phí không hợp lệ');
      return;
    }
    // Lấy giá trị từ input (giống backup: Number(sessionsInput.value))
    let feeSessionsValue = Number(feeSessionsInput);
    if (!Number.isFinite(feeSessionsValue) || feeSessionsValue <= 0) {
      toast.error('Số buổi không hợp lệ');
      return;
    }
    
    const roundedSessions = Math.round(feeSessionsValue);
    // Cập nhật state để đồng bộ (giống backup: sessionsInput.value = feeSessions)
    setFeeSessions(roundedSessions);
    setFeeSessionsInput(String(roundedSessions));
    
    setLoading(true);
    try {
      await updateStudentClassFee(studentId, classId, feeTotal, roundedSessions);
      toast.success('Đã cập nhật học phí học sinh');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể cập nhật học phí: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="studentFeeTotal" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Tổng học phí (VND) *
        </label>
        <CurrencyInput
          key={`fee-total-${classId}-${feeTotal}`}
          id="studentFeeTotal"
          className="form-control"
          value={feeTotal}
          onChange={(value) => setFeeTotal(value)}
          required
        />
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="studentFeeSessions" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Số buổi *
        </label>
        <input
          type="number"
          id="studentFeeSessions"
          className="form-control"
          min="1"
          step="1"
          value={feeSessionsInput}
          onChange={(e) => {
            // Cho phép xóa hẳn để nhập lại (giống backup)
            const value = e.target.value;
            setFeeSessionsInput(value);
            // Cập nhật feeSessions nếu là số hợp lệ
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue) && numValue > 0) {
              setFeeSessions(numValue);
            }
          }}
          onBlur={(e) => {
            // Khi blur, nếu rỗng hoặc <= 0 thì set về 1 (giống backup validation)
            const value = parseInt(e.target.value, 10);
            if (isNaN(value) || value <= 0) {
              setFeeSessions(1);
              setFeeSessionsInput('1');
            } else {
              setFeeSessions(value);
              setFeeSessionsInput(String(value));
            }
          }}
          required
        />
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }} id="studentFeePerSession">
        Đơn giá 1 buổi: {formatCurrencyVND(perSessionPrice)}
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
  );
}

export default StudentDetail;
