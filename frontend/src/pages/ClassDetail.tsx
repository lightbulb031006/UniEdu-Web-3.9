import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchClassById, fetchClassStudentsWithRemaining, updateClass, addStudentToClass, removeStudentFromClass, moveStudentToClass, fetchClasses, fetchClassDetailData, ClassDetailData } from '../services/classesService';
import { fetchTeachers } from '../services/teachersService';
import { fetchStudents, updateStudent } from '../services/studentsService';
import { fetchSessions, createSession, updateSession, deleteSession } from '../services/sessionsService';
import { saveAttendanceForSession, fetchAttendanceBySession, AttendanceStatus } from '../services/attendanceService';
import { fetchCategories } from '../services/categoriesService';
import { useAuthStore } from '../store/authStore';
import { formatCurrencyVND, formatDate, formatMonthLabel } from '../utils/formatters';
import { hasRole, userHasStaffRole, getUserStaffRoles } from '../utils/permissions';
import Modal from '../components/Modal';
import { CurrencyInput } from '../components/CurrencyInput';
import AttendanceIcon from '../components/AttendanceIcon';
import { useAttendance } from '../hooks/useAttendance';
import { toast } from '../utils/toast';

/**
 * Class Detail Page Component
 * Shows detailed information about a specific class
 * Migrated from backup/assets/js/pages/classes.js - renderClassDetail
 */

function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);

  // Month state for sessions
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [monthPopupOpen, setMonthPopupOpen] = useState(false);

  // Collapsible sections state
  const [studentsExpanded, setStudentsExpanded] = useState(true);
  const [sessionsExpanded, setSessionsExpanded] = useState(true);

  // Modal states
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [addSessionModalOpen, setAddSessionModalOpen] = useState(false);
  const [editSessionModalOpen, setEditSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editClassModalOpen, setEditClassModalOpen] = useState(false);
  const [editTeacherModalOpen, setEditTeacherModalOpen] = useState(false);
  const [editScheduleModalOpen, setEditScheduleModalOpen] = useState(false);
  const [editStudentModalOpen, setEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [moveStudentModalOpen, setMoveStudentModalOpen] = useState(false);
  const [movingStudent, setMovingStudent] = useState<any | null>(null);
  const [teacherAllowanceModalOpen, setTeacherAllowanceModalOpen] = useState(false);
  const [editingTeacherForAllowance, setEditingTeacherForAllowance] = useState<any | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [bulkSessionStatusModalOpen, setBulkSessionStatusModalOpen] = useState(false);

  const fetchClassFn = useCallback(() => {
    if (!id) throw new Error('Class ID is required');
    return fetchClassById(id);
  }, [id]);

  const { data: classData, isLoading, error, refetch: refetchClass } = useDataLoading(fetchClassFn, [id], {
    cacheKey: `class-${id}`,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch students with remaining sessions
  const fetchStudentsWithRemainingFn = useCallback(() => {
    if (!id) throw new Error('Class ID is required');
    return fetchClassStudentsWithRemaining(id);
  }, [id]);
  const { data: studentsWithRemainingData, refetch: refetchStudents } = useDataLoading(fetchStudentsWithRemainingFn, [id], {
    cacheKey: `class-students-remaining-${id}`,
    staleTime: 1 * 60 * 1000,
  });

  // Fetch sessions
  const fetchSessionsFn = useCallback(() => fetchSessions({ classId: id }), [id]);
  const { data: sessionsData, refetch: refetchSessions } = useDataLoading(fetchSessionsFn, [id], {
    cacheKey: `sessions-class-${id}`,
    staleTime: 1 * 60 * 1000,
  });

  const refetch = useCallback(() => {
    refetchClass();
    refetchStudents();
    refetchSessions();
  }, [refetchClass, refetchStudents, refetchSessions]);

  // Fetch teachers to get teacher names
  const { data: teachersData } = useDataLoading(() => fetchTeachers(), [], {
    cacheKey: 'teachers-for-class-detail',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch categories for type dropdown
  const { data: categoriesData } = useDataLoading(
    () => fetchCategories(),
    [],
    {
      cacheKey: 'categories-for-class-detail',
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fetch students to get enrolled students
  const { data: studentsData } = useDataLoading(() => fetchStudents(), [], {
    cacheKey: 'students-for-class-detail',
    staleTime: 5 * 60 * 1000,
  });


  const teachers = Array.isArray(teachersData) ? teachersData : [];
  const students = Array.isArray(studentsData) ? studentsData : [];
  const sessions = Array.isArray(sessionsData) ? sessionsData : [];
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  // Calculate available teachers (teachers not already assigned to this class)
  const availableTeachers = useMemo(() => {
    if (!classData) return teachers;
    const currentTeacherIds = new Set(classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []));
    return teachers.filter((t) => {
      const roles = Array.isArray(t.roles) ? t.roles : [];
      return (roles.includes('teacher') || roles.length === 0) && !currentTeacherIds.has(t.id);
    });
  }, [teachers, classData]);

  // Permission checks
  const isAdmin = hasRole('admin');
  const canEdit = isAdmin;
  const canManage = isAdmin || hasRole('accountant') || userHasStaffRole('cskh_sale', currentUser, teachers);
  const canManageStudents = canManage;
  const canManageTeacherList = canManage;
  const showClassFinancialDetails = isAdmin;
  
  // Payment status management permissions
  const userStaffRoles = getUserStaffRoles(currentUser, teachers);
  const hasCskhPrivileges = userHasStaffRole('cskh_sale', currentUser, teachers);
  const canManagePaymentStatus = isAdmin || hasRole('accountant') || hasCskhPrivileges;
  
  // Session management permissions
  // Teacher role hoặc staff role 'teacher' đều có thể tạo/chỉnh sửa session
  const isTutor = currentUser?.role === 'teacher' || userHasStaffRole('teacher', currentUser, teachers);
  const canShowDelete = canManage && !isTutor;
  const canSelectSessions = canManage || hasCskhPrivileges;
  const canBulkUpdateStatus = isAdmin || hasRole('accountant') || hasCskhPrivileges;
  // Teacher (gia sư) có thể tạo và chỉnh sửa session
  const canCreateSession = isAdmin || isTutor || hasRole('accountant') || hasCskhPrivileges;
  const canEditSession = isAdmin || isTutor || hasRole('accountant') || hasCskhPrivileges;
  // Chỉ admin và accountant mới có thể chỉnh sửa allowance thủ công
  const canEditAllowanceManually = isAdmin || hasRole('accountant');

  // Month navigation handlers
  const handleMonthChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-');
    let newMonth = parseInt(month) + delta;
    let newYear = parseInt(year);
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const handleYearChange = (delta: number) => {
    const [year, month] = selectedMonth.split('-');
    const newYear = parseInt(year) + delta;
    setSelectedMonth(`${newYear}-${month}`);
  };

  const handleMonthSelect = (monthVal: string) => {
    const [year] = selectedMonth.split('-');
    setSelectedMonth(`${year}-${monthVal}`);
    setMonthPopupOpen(false);
  };

  // Close month popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (monthPopupOpen && !target.closest('.session-month-nav')) {
        setMonthPopupOpen(false);
      }
    };

    if (monthPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [monthPopupOpen]);

  // Filter sessions by selected month
  const monthSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (!s.date) return false;
      const sessionMonth = s.date.slice(0, 7); // YYYY-MM
      return sessionMonth === selectedMonth;
    });
  }, [sessions, selectedMonth]);

  // Get teacher names
  const teacherIds = classData?.teacherIds || (classData?.teacherId ? [classData.teacherId] : []);
  const classTeachers = teachers.filter((t) => teacherIds.includes(t.id));

  // Get enrolled students with remaining sessions
  const enrolledStudents = useMemo(() => {
    if (!classData) return [];
    
    // If we have students with remaining data, use that
    if (studentsWithRemainingData && Array.isArray(studentsWithRemainingData) && studentsWithRemainingData.length > 0) {
      return studentsWithRemainingData.map((item) => {
        const student = item.student || {};
        const studentData = item.student || {};
        return {
          id: studentData.id,
          fullName: studentData.full_name || '',
          birthYear: studentData.birth_year || undefined,
          province: studentData.province || undefined,
          status: studentData.status || 'active',
          remainingSessions: item.remainingSessions || item.studentClass?.remaining_sessions || 0,
          totalAttended: item.totalAttended || item.studentClass?.total_attended_sessions || 0,
        };
      });
    }
    
    // Fallback to regular students list
    return students.filter((s) => {
      const studentClassIds = s.classIds || (s.classId ? [s.classId] : []);
      return studentClassIds.includes(classData.id);
    }).map((s) => ({
      ...s,
      remainingSessions: 0, // Default if not available
      totalAttended: 0,
    }));
  }, [students, classData, studentsWithRemainingData]);

  // Check if current user is a teacher viewer
  const isTeacherViewer = currentUser?.role === 'teacher';
  
  // Fetch class detail data with teacher statistics calculated in backend
  const fetchClassDetailDataFn = useCallback(() => {
    if (!id) throw new Error('Class ID is required');
    return fetchClassDetailData(id);
  }, [id]);

  const { data: classDetailData, refetch: refetchClassDetailData } = useDataLoading(fetchClassDetailDataFn, [id], {
    cacheKey: `class-detail-data-${id}`,
    staleTime: 1 * 60 * 1000,
    enabled: !!classData && !isLoading,
  });

  // Use teacher stats from backend (all calculations done in backend)
  const teacherStats = useMemo(() => {
    if (classDetailData) {
      // Map backend data to match frontend structure
      return classDetailData.teacherStats.map((stat) => {
        const teacher = classTeachers.find((t) => t.id === stat.teacher.id) || stat.teacher;
        return {
          teacher,
          allowance: stat.allowance,
          totalReceived: stat.totalReceived,
        };
      });
    }
    // Fallback: calculate locally if backend data not available (should not happen in production)
    const customAllowances = (classData as any)?.customTeacherAllowances || {};
    const defaultSalary = classData?.tuitionPerSession || 0;
    return classTeachers.map((teacher) => {
      const teacherSessions = sessions.filter((s) => (s as any).teacherId === teacher.id || s.teacher_id === teacher.id);
      const totalReceived = teacherSessions
        .filter((s) => (s as any).paymentStatus === 'paid' || s.payment_status === 'paid')
        .reduce((sum, s) => sum + ((s as any).allowanceAmount || s.allowance_amount || 0), 0);
      const allowance = customAllowances[teacher.id] ?? defaultSalary;
      return {
        teacher,
        allowance,
        totalReceived,
      };
    });
  }, [classDetailData, classTeachers, sessions, classData]);

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Lỗi tải dữ liệu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>{error.message}</p>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
            {/* Chỉ hiển thị nút Quay lại cho admin, không hiển thị cho gia sư */}
            {!isTutor && (
              <button className="btn btn-secondary" onClick={() => navigate('/classes')}>
                Quay lại
              </button>
            )}
            <button className="btn btn-primary" onClick={() => refetch()}>
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !classData) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
          <div className="spinner" />
          <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải thông tin lớp học...</p>
        </div>
      </div>
    );
  }

  const statusClass = classData.status === 'running' ? 'running' : 'inactive';
  const statusLabel = classData.status === 'running' ? 'Đang hoạt động' : 'Đã dừng';

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month] = selectedMonth.split('-');
  const monthNum = parseInt(month, 10);
  const monthLabel = `Tháng ${monthNum}/${year}`;

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header - Matching code cũ */}
      <div
        className="class-detail-header"
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
        <div className="class-detail-header-content" style={{ flex: 1 }}>
          <div className="class-detail-title-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <h1
              className="class-detail-title"
              style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: '700',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              {classData.name}
            </h1>
            {canEdit && (
              <button
                className="btn-icon class-edit-icon"
                onClick={() => {
                  setEditClassModalOpen(true);
                }}
                title="Chỉnh sửa lớp"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          <div className="class-detail-meta" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
            <div className="class-detail-meta-item">
              <span
                className={`class-detail-status-badge ${statusClass}`}
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  background: statusClass === 'running' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                  color: statusClass === 'running' ? '#10b981' : 'var(--muted)',
                }}
              >
                {statusLabel}
              </span>
            </div>
            <div className="class-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>{classData.type || 'Lớp học'}</span>
            </div>
            {showClassFinancialDetails && (
              <>
                {classData.tuitionPerSession && classData.tuitionPerSession > 0 && (
                  <div className="class-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <span>Trợ cấp: {formatCurrencyVND(classData.tuitionPerSession)}/hệ số</span>
                  </div>
                )}
                {classData.studentTuitionPerSession && classData.studentTuitionPerSession > 0 && (
                  <div className="class-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    <span>Học phí: {formatCurrencyVND(classData.studentTuitionPerSession)}/buổi</span>
                  </div>
                )}
                {classData.tuitionPackageTotal && classData.tuitionPackageTotal > 0 && classData.tuitionPackageSessions && classData.tuitionPackageSessions > 0 && (
                  <div className="class-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                    </svg>
                    <span>Gói: {formatCurrencyVND(classData.tuitionPackageTotal)} / {classData.tuitionPackageSessions} buổi</span>
                  </div>
                )}
                {(classData as any).scaleAmount && (classData as any).scaleAmount > 0 && (
                  <div className="class-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', color: 'var(--muted)', fontSize: '0.875rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    <span>Scale: {formatCurrencyVND((classData as any).scaleAmount)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="class-detail-header-actions">
          {/* Chỉ hiển thị nút Quay lại cho admin, không hiển thị cho gia sư */}
          {!isTutor && (
            <button
              className="btn btn-outline"
              onClick={() => navigate('/classes')}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Quay lại
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid - Matching code cũ */}
      <div
        className="class-detail-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        {/* Teacher Card */}
        <div
          className="class-detail-card teacher-card"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-5)',
            background: 'var(--surface)',
          }}
        >
          <div className="class-detail-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <h3
              className="class-detail-card-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Gia sư phụ trách
            </h3>
            {canManageTeacherList && (
              <button
                className="btn btn-sm"
                id="editTeacherBtn"
                title="Chỉnh sửa danh sách gia sư"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTeacherModalOpen(true);
                }}
                style={{
                  cursor: 'pointer',
                }}
              >
                Chỉnh sửa
              </button>
            )}
          </div>
          {(classData as any)?.scaleAmount && (classData as any).scaleAmount > 0 && showClassFinancialDetails && (
            <div className="class-detail-stat-item" style={{ marginBottom: 'var(--spacing-3)', padding: 'var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Tiền scale</div>
              <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text)' }}>{formatCurrencyVND((classData as any).scaleAmount)}</div>
            </div>
          )}
          {isLoading || (teacherStats.length === 0 && !classTeachers.length) ? (
            <div className="class-detail-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              <div style={{ height: '24px', width: '60%', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}></div>
              <div style={{ height: '20px', width: '80%', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}></div>
              <div style={{ height: '20px', width: '70%', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}></div>
            </div>
          ) : teacherStats.length > 0 ? (
            <div className={`teacher-list ${showClassFinancialDetails ? '' : 'teacher-list-basic'}`} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              {showClassFinancialDetails && (
                <div className="teacher-row teacher-row-header" style={{ display: 'grid', gridTemplateColumns: '1fr 140px 160px', gap: 'var(--spacing-3)', alignItems: 'center', padding: '0 var(--spacing-3) var(--spacing-1)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--spacing-2)', cursor: 'default', fontSize: 'var(--font-size-xs)', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--muted)', background: 'transparent' }}>
                  <span className="teacher-col-name" style={{ textAlign: 'left' }}>TÊN GIA SƯ</span>
                  <span className="teacher-col-allowance" style={{ textAlign: 'left' }}>TRỢ CẤP</span>
                  <span className="teacher-col-total" style={{ textAlign: 'right', justifySelf: 'end' }}>TỔNG NHẬN</span>
                </div>
              )}
              {teacherStats.map(({ teacher, allowance, totalReceived }) => {
                const contacts = [(teacher as any).phone, (teacher as any).email || (teacher as any).gmail].filter(Boolean).join(' • ');
                const teacherNameClass = isTeacherViewer ? 'teacher-col-name' : 'teacher-col-name teacher-name-link';
                return (
                  <div
                    key={teacher.id}
                    className={`teacher-row ${showClassFinancialDetails ? '' : 'teacher-row-compact'}${isTeacherViewer ? '' : ' teacher-row-clickable'}`}
                    data-teacher-id={teacher.id}
                    onClick={(e) => {
                      // Don't navigate if clicking on allowance button or if teacher viewer
                      if (isTeacherViewer || (e.target as HTMLElement).closest('.teacher-allowance')) {
                        return;
                      }
                      navigate(`/staff/${teacher.id}`);
                    }}
                    style={{
                      display: showClassFinancialDetails ? 'grid' : 'flex',
                      gridTemplateColumns: showClassFinancialDetails ? '1fr 140px 160px' : '1fr',
                      gap: 'var(--spacing-3)',
                      alignItems: 'center',
                      padding: showClassFinancialDetails ? 'var(--spacing-2) var(--spacing-3)' : 'var(--spacing-2)',
                      borderRadius: 'var(--radius)',
                      background: 'var(--bg-secondary)',
                      cursor: isTeacherViewer ? 'default' : 'pointer',
                      transition: 'background-color 0.2s ease-in-out',
                    }}
                    onMouseEnter={(e) => {
                      if (!isTeacherViewer) {
                        e.currentTarget.style.background = 'var(--bg)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isTeacherViewer) {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '';
                      }
                    }}
                  >
                    <span className={teacherNameClass} style={{ fontWeight: '500' }}>{teacher.fullName || teacher.id}</span>
                    {showClassFinancialDetails && (
                      <>
                        <span className="teacher-col-allowance" style={{ fontWeight: '500', textAlign: 'left' }}>
                          {canManageTeacherList ? (
                            <button
                              className="teacher-allowance"
                              type="button"
                              data-teacher-id={teacher.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTeacherForAllowance(teacher);
                                setTeacherAllowanceModalOpen(true);
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: 'var(--spacing-1) var(--spacing-2)',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                justifySelf: 'start',
                                textAlign: 'left',
                                width: '100%',
                                maxWidth: '120px',
                                fontWeight: '500',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--primary)';
                                e.currentTarget.style.color = 'var(--primary-contrast)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--primary)';
                                e.currentTarget.style.borderColor = 'var(--border)';
                              }}
                              title="Chỉnh sửa trợ cấp"
                            >
                              {formatCurrencyVND(allowance)}
                            </button>
                          ) : (
                            <span>{formatCurrencyVND(allowance)}</span>
                          )}
                        </span>
                        <span className="teacher-col-total" style={{ fontWeight: '500', textAlign: 'right', justifySelf: 'end' }}>{formatCurrencyVND(totalReceived)}</span>
                      </>
                    )}
                    {!showClassFinancialDetails && contacts && (
                      <div className="teacher-col-info" style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>{contacts}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="class-detail-empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
              <div className="class-detail-empty-state-icon">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ opacity: 0.3, color: 'var(--muted)' }}
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem', fontWeight: '500' }}>Chưa có gia sư</p>
            </div>
          )}
        </div>

        {/* Schedule Card */}
        <div
          className="class-detail-card schedule-card"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-5)',
            background: 'var(--surface)',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget.querySelector('.schedule-edit-btn') as HTMLElement;
            if (btn) btn.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget.querySelector('.schedule-edit-btn') as HTMLElement;
            if (btn) btn.style.opacity = '0';
          }}
        >
          <div className="class-detail-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
            <h3
              className="class-detail-card-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Lịch học
            </h3>
            {canManage && (
              <button
                className="btn btn-sm schedule-edit-btn"
                id="editScheduleBtn"
                title="Chỉnh sửa lịch học"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditScheduleModalOpen(true);
                }}
                style={{ 
                  opacity: 0, 
                  transition: 'opacity 0.2s ease-in-out',
                  cursor: 'pointer',
                }}
              >
                Chỉnh sửa
              </button>
            )}
          </div>
          {classData.schedule && Array.isArray(classData.schedule) && classData.schedule.length > 0 ? (
            <ul className="class-detail-schedule-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              {classData.schedule.map((s, idx) => (
                <li
                  key={idx}
                  className="class-detail-schedule-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    padding: 'var(--spacing-2)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-secondary)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>
                    <strong>{s.day}</strong> • {s.time}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="class-detail-empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem', fontWeight: '500' }}>Chưa có lịch học</p>
            </div>
          )}
        </div>
      </div>

      {/* Students Section - Collapsible */}
      <div className="class-detail-section" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div
          className="class-detail-section-header collapsible-section"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-4)',
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setStudentsExpanded(!studentsExpanded)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
          }}
        >
          <div className="section-header-main section-collapse-trigger" data-target="students" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3
              className="class-detail-section-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Học sinh trong lớp ({enrolledStudents.length}
              {classData.maxStudents ? `/${classData.maxStudents}` : ''})
            </h3>
            <span className="toggle-icon" id="students-toggle-icon" style={{ fontSize: '1.25rem', transition: 'transform 0.2s ease', transform: studentsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
              ▼
            </span>
          </div>
        </div>
        {studentsExpanded && (
          <div
            className="class-detail-section-content section-content"
            id="students-content"
            style={{
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
              padding: 'var(--spacing-4)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Tổng số học sinh: {enrolledStudents.length}</span>
              {canManageStudents && (
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <button
                    className="session-icon-btn session-icon-btn-primary"
                    id="addExistingStudentBtn"
                    title="Thêm học sinh có sẵn"
                    onClick={() => {
                      setAddStudentModalOpen(true);
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--primary)',
                      background: 'var(--primary)',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14" />
                      <path d="M19 12H5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {enrolledStudents.length > 0 ? (
              <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
                      <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '180px' }}>Tên</th>
                      <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '100px' }}>Năm sinh</th>
                      <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '120px' }}>Tỉnh</th>
                      <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '120px' }}>Còn lại</th>
                      <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '120px' }}>Trạng thái</th>
                      {canManageStudents && (
                        <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', width: '120px', fontWeight: '600', fontSize: '0.875rem' }}>Thao tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody id="studentsTableBody">
                    {enrolledStudents.map((student) => {
                      const remainingSessions = (student as any).remainingSessions ?? 0;
                      const remainingSummary = remainingSessions > 0 ? `${remainingSessions} buổi` : '0 buổi';
                      return (
                        <tr
                          key={student.id}
                          data-student-id={student.id}
                          onClick={(e) => {
                            // Don't navigate if clicking on action buttons
                            const target = e.target as HTMLElement;
                            // Check if clicked element is a button or inside a button
                            if (
                              target.tagName === 'BUTTON' ||
                              target.closest('button') ||
                              target.closest('.btn-edit-icon') ||
                              target.closest('.btn-transfer-icon') ||
                              target.closest('.btn-delete-icon')
                            ) {
                              return;
                            }
                            // Navigate to student detail when clicking on row (except buttons) - only if not tutor
                            if (!isTutor) {
                              navigate(`/students/${student.id}`);
                            }
                          }}
                          style={{
                            transition: 'all 0.2s ease',
                            cursor: isTutor ? 'default' : 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!isTutor) {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '';
                          }}
                        >
                          <td style={{ padding: 'var(--spacing-3)' }}>
                            <span style={{ fontWeight: '600', color: 'var(--text)' }}>{student.fullName || '-'}</span>
                          </td>
                          <td style={{ padding: 'var(--spacing-3)' }}>
                            <span style={{ color: 'var(--muted)' }}>{student.birthYear || '-'}</span>
                          </td>
                          <td style={{ padding: 'var(--spacing-3)' }}>
                            <span style={{ color: 'var(--muted)' }}>{student.province || '-'}</span>
                          </td>
                          <td style={{ padding: 'var(--spacing-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <span style={{ fontWeight: '500', color: 'var(--text)' }}>{remainingSummary}</span>
                            </div>
                          </td>
                          <td style={{ padding: 'var(--spacing-3)' }}>
                            <span
                              className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-muted'}`}
                              style={{
                                padding: 'var(--spacing-1) var(--spacing-2)',
                                borderRadius: 'var(--radius)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: '500',
                                background: student.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                                color: student.status === 'active' ? '#10b981' : 'var(--muted)',
                              }}
                            >
                              {student.status === 'active' ? '✓ ' : ''}{student.status === 'active' ? 'Đang học' : 'Tạm dừng'}
                            </span>
                          </td>
                          {canManageStudents && (
                            <td style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'center' }}>
                                <button
                                  className="btn-edit-icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStudent(student);
                                  setEditStudentModalOpen(true);
                                }}
                                  title="Sửa thông tin"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg)',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  className="btn-transfer-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingStudent(student);
                                    setMoveStudentModalOpen(true);
                                  }}
                                  title="Chuyển học sinh sang lớp khác"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg)',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M8 3L4 7l4 4" />
                                    <path d="M4 7h16" />
                                    <path d="M16 21l4-4-4-4" />
                                    <path d="M20 17H4" />
                                  </svg>
                                </button>
                                <button
                                  className="btn-delete-icon"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Xóa học sinh này khỏi lớp? (Học sinh sẽ không bị xóa hoàn toàn, chỉ được gỡ khỏi lớp này)`)) {
                                      try {
                                        await removeStudentFromClass(id!, student.id, true);
                                        toast.success('Đã xóa học sinh khỏi lớp');
                                        refetch();
                                      } catch (error: any) {
                                        toast.error('Không thể xóa học sinh khỏi lớp: ' + (error.response?.data?.error || error.message));
                                      }
                                    }
                                  }}
                                  title="Xóa khỏi lớp"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--danger)',
                                    background: 'var(--bg)',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="class-detail-empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--spacing-3)' }}>Chưa có học sinh trong lớp này.</p>
                {canManageStudents && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      // TODO: Open add student modal
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Thêm học sinh đầu tiên
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sessions Section - Collapsible with Month Navigation */}
      <div className="class-detail-section">
        <div
          className="class-detail-section-header collapsible-section"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-4)',
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setSessionsExpanded(!sessionsExpanded)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
          }}
        >
          <div className="section-header-main section-collapse-trigger" data-target="sessions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3
              className="class-detail-section-title"
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: '600',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M8 7h8" />
                <path d="M8 11h8" />
                <path d="M8 15h4" />
              </svg>
              Lịch sử buổi học
            </h3>
            <span className="toggle-icon" id="sessions-toggle-icon" style={{ fontSize: '1.25rem', transition: 'transform 0.2s ease', transform: sessionsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
              ▼
            </span>
          </div>
        </div>
        {sessionsExpanded && (
          <div
            className="class-detail-section-content section-content"
            id="sessions-content"
            style={{
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
              padding: 'var(--spacing-4)',
              background: 'var(--surface)',
            }}
          >
            {/* Session Toolbar with Month Navigation */}
            <div className="session-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Tổng số buổi: {monthSessions.length}</div>
              <div className="session-month-nav" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                <button
                  type="button"
                  className="session-month-btn"
                  id="sessionMonthPrev"
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
                  id="sessionMonthLabelBtn"
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
                  <span className="session-month-label" id="sessionMonthLabel" style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}>{monthLabel}</span>
                </button>
                <button
                  type="button"
                  className="session-month-btn"
                  id="sessionMonthNext"
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
                    id="sessionMonthPopup"
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
                        id="sessionYearPrev"
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
                      <span className="session-month-year-label" id="sessionYearLabel" style={{ fontWeight: '500' }}>{year}</span>
                      <button
                        type="button"
                        className="session-month-year-btn"
                        id="sessionYearNext"
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
                      className="session-month-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: '4px',
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
                            style={{
                              borderRadius: 'var(--radius)',
                              border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                              background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                              color: isActive ? 'var(--primary)' : 'var(--text)',
                              cursor: 'pointer',
                              padding: '3px 0',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: isActive ? '600' : '400',
                              transition: 'all 0.2s ease',
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
              {canCreateSession && (
                <div className="session-toolbar-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <button
                    className="btn btn-primary btn-add-icon"
                    id="addSessionBtn"
                    title="Thêm buổi học"
                    onClick={() => {
                      setAddSessionModalOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Bulk Actions */}
            {canBulkUpdateStatus && selectedSessions.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-3)',
                  marginBottom: 'var(--spacing-4)',
                  padding: 'var(--spacing-3)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: '500' }}>
                  Đã chọn: {selectedSessions.size} buổi
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setBulkSessionStatusModalOpen(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--spacing-1)' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Chuyển trạng thái thanh toán
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setSelectedSessions(new Set())}
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            )}

            {/* Sessions Table */}
            {monthSessions.length > 0 ? (
              <>
                <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table className="table-striped sessions-table" id="sessionsTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%)' }}>
                      {canSelectSessions ? (
                        <th style={{ width: '50px', textAlign: 'center', padding: 'var(--spacing-3)' }}>
                          <input
                            type="checkbox"
                            checked={selectedSessions.size > 0 && selectedSessions.size === monthSessions.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSessions(new Set(monthSessions.map((s) => s.id)));
                              } else {
                                setSelectedSessions(new Set());
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                            title="Chọn tất cả"
                          />
                        </th>
                      ) : (
                        <th style={{ width: '50px', textAlign: 'center', padding: 'var(--spacing-3)' }}>#</th>
                      )}
                      <th className="session-time-header" style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '160px' }} title="Thời gian buổi học">Thời gian</th>
                      <th className="session-notes-header" style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '300px' }}>Nhận xét</th>
                      <th className="session-info-header" style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '200px' }} title="Thông tin buổi học">Thông tin</th>
                      {canShowDelete && (
                        <th className="session-actions-header" style={{ width: '60px', textAlign: 'center', padding: 'var(--spacing-3)' }}></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {monthSessions.map((session) => {
                      // Get teacher - check both camelCase and snake_case
                      const teacherId = (session as any).teacherId || session.teacher_id;
                      const teacher = teacherId ? teachers.find((t) => t.id === teacherId) : null;
                      
                      // Get coefficient - handle both 0 and undefined/null
                      const coefficient = (session as any).coefficient !== undefined && (session as any).coefficient !== null 
                        ? (session as any).coefficient 
                        : session.coefficient !== undefined && session.coefficient !== null
                          ? session.coefficient
                          : 1;
                      
                      // Get paidCount - check both camelCase and snake_case
                      const paidCount = (session as any).studentPaidCount !== undefined 
                        ? (session as any).studentPaidCount 
                        : session.studentPaidCount !== undefined
                          ? session.studentPaidCount
                          : (session as any).student_paid_count !== undefined
                            ? (session as any).student_paid_count
                            : 0;
                      
                      // Get payment status
                      const paymentStatus = (session as any).paymentStatus || session.payment_status || 'unpaid';
                      
                      const formatDateWithWeekday = (dateStr: string) => {
                        if (!dateStr) return '-';
                        try {
                          const date = new Date(dateStr + 'T00:00:00');
                          const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                          const weekday = weekdays[date.getDay()];
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${weekday} : ${day}/${month}/${year}`;
                        } catch {
                          return dateStr;
                        }
                      };
                      const formatTimeRange = (startTime?: string, endTime?: string) => {
                        if (!startTime || !endTime) {
                          // Fallback to duration if available
                          const duration = (session as any).duration || session.duration;
                          if (duration) return `${duration}h`;
                          return '-';
                        }
                        return `${startTime} → ${endTime}`;
                      };
                      const paymentStatusLabels: Record<string, string> = {
                        paid: 'Đã thanh toán',
                        unpaid: 'Chưa thanh toán',
                        deposit: 'Cọc',
                      };
                      const paymentStatusClasses: Record<string, string> = {
                        paid: 'badge-success',
                        unpaid: 'badge-danger',
                        deposit: 'badge-warning',
                      };
                      // Check payment status management permission in this scope
                      const canManagePaymentStatusLocal = isAdmin || hasRole('accountant') || userHasStaffRole('cskh_sale', currentUser, teachers);
                      const sessionDate = (session as any).date || session.date || '';
                      const sessionStartTime = (session as any).startTime || session.start_time;
                      const sessionEndTime = (session as any).endTime || session.end_time;
                      const dateFormatted = formatDateWithWeekday(sessionDate);
                      const timeFormatted = formatTimeRange(sessionStartTime, sessionEndTime);
                      const isSelected = selectedSessions.has(session.id);
                      return (
                        <tr
                          key={session.id}
                          className="session-row"
                          data-session-id={session.id}
                          data-payment-status={paymentStatus}
                          style={{
                            cursor: canEditSession ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            background: isSelected ? 'rgba(59, 130, 246, 0.1)' : '',
                          }}
                          onClick={(e) => {
                            // Don't open modal if clicking on buttons, checkboxes, or other interactive elements
                            const target = e.target as HTMLElement;
                            if (
                              target.tagName === 'BUTTON' ||
                              target.tagName === 'INPUT' ||
                              target.closest('button') ||
                              target.closest('input') ||
                              target.closest('.btn-delete-icon')
                            ) {
                              return;
                            }
                            // Open edit modal when clicking on row (if can edit session)
                            if (canEditSession) {
                              setEditingSession(session);
                              setEditSessionModalOpen(true);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (canManage && !isSelected) {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '';
                            } else {
                              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                            }
                          }}
                        >
                          {canSelectSessions ? (
                            <td
                              onClick={(e) => e.stopPropagation()}
                              style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}
                            >
                              <input
                                type="checkbox"
                                className="session-checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newSelected = new Set(selectedSessions);
                                  if (e.target.checked) {
                                    newSelected.add(session.id);
                                  } else {
                                    newSelected.delete(session.id);
                                  }
                                  setSelectedSessions(newSelected);
                                }}
                                style={{ cursor: 'pointer' }}
                                title="Chọn dòng này"
                              />
                            </td>
                          ) : (
                            <td style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: '600', padding: 'var(--spacing-3)' }}>
                              {monthSessions.indexOf(session) + 1}
                            </td>
                          )}
                          <td className="session-time-cell" style={{ padding: 'var(--spacing-3)' }} title="Thời gian buổi học">
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', lineHeight: 1.5, textAlign: 'center' }}>
                              <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>{dateFormatted}</div>
                              <div style={{ color: 'var(--muted)', fontSize: 'var(--font-size-xs)' }}>{timeFormatted}</div>
                            </div>
                          </td>
                          <td className="session-notes-cell" style={{ padding: 'var(--spacing-3)' }}>
                            {((session as any).notes || session.notes) ? (
                              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                {(session as any).notes || session.notes}
                              </div>
                            ) : (
                              <span style={{ fontStyle: 'italic', fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>Không có ghi chú</span>
                            )}
                          </td>
                          <td className="session-info-cell" style={{ padding: 'var(--spacing-3)' }} title="Thông tin buổi học">
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text)', lineHeight: 1.6, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-1)' }}>
                              <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-1)' }}>
                                {teacher ? (
                                  <>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                      <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <span>{teacher.fullName}</span>
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>-</span>
                                )}
                              </div>
                              <div>
                                <span
                                  className={`badge ${paymentStatusClasses[paymentStatus] || 'badge-muted'}`}
                                  onClick={async (e) => {
                                    if (!canManagePaymentStatusLocal) return;
                                    e.stopPropagation();
                                    // Cycle through payment statuses: unpaid -> paid -> deposit -> unpaid
                                    const statusOrder = ['unpaid', 'paid', 'deposit'];
                                    const currentIndex = statusOrder.indexOf(paymentStatus);
                                    const nextIndex = (currentIndex + 1) % statusOrder.length;
                                    const newStatus = statusOrder[nextIndex];
                                    
                                    try {
                                      await updateSession(session.id, {
                                        payment_status: newStatus as 'paid' | 'unpaid' | 'deposit',
                                      });
                                      toast.success(`Đã chuyển sang: ${paymentStatusLabels[newStatus]}`);
                                      refetch();
                                    } catch (error: any) {
                                      toast.error('Không thể cập nhật trạng thái: ' + (error.response?.data?.error || error.message));
                                    }
                                  }}
                                  style={{
                                    fontSize: 'var(--font-size-xs)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius)',
                                    background:
                                      paymentStatus === 'paid'
                                        ? 'rgba(16, 185, 129, 0.1)'
                                        : paymentStatus === 'deposit'
                                          ? 'rgba(251, 191, 36, 0.1)'
                                          : 'rgba(220, 38, 38, 0.1)',
                                    color: paymentStatus === 'paid' ? '#10b981' : paymentStatus === 'deposit' ? '#f59e0b' : '#dc2626',
                                    cursor: canManagePaymentStatusLocal ? 'pointer' : 'default',
                                    transition: 'all 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (canManagePaymentStatusLocal) {
                                      e.currentTarget.style.opacity = '0.8';
                                      e.currentTarget.style.transform = 'scale(1.05)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (canManagePaymentStatusLocal) {
                                      e.currentTarget.style.opacity = '1';
                                      e.currentTarget.style.transform = 'scale(1)';
                                    }
                                  }}
                                  aria-label={`Trạng thái: ${paymentStatusLabels[paymentStatus] || 'Không xác định'}${canManagePaymentStatusLocal ? ' (Click để chuyển đổi)' : ''}`}
                                  title={canManagePaymentStatusLocal ? 'Click để chuyển đổi trạng thái thanh toán' : undefined}
                                >
                                  {paymentStatus === 'paid' ? '✓ ' : paymentStatus === 'deposit' ? '● ' : ''}
                                  {paymentStatusLabels[paymentStatus] || 'Không xác định'}
                                </span>
                              </div>
                              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
                                <span title={`Hệ số ${coefficient}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                                    <path d="M16 4H8l6 8-6 8h8" />
                                  </svg>
                                  <span>{coefficient}</span>
                                </span>
                                <span title={`${paidCount} học sinh đã gia hạn`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
                                    <path d="M21 21v-1a3 3 0 0 0-2.4-2.9" />
                                    <path d="M16 3a3 3 0 0 1 2.4 2.9" />
                                  </svg>
                                  <span>{paidCount}</span>
                                </span>
                              </div>
                            </div>
                          </td>
                          {canShowDelete && (
                            <td
                              className="session-actions"
                              onClick={(e) => e.stopPropagation()}
                              style={{ textAlign: 'center', padding: 'var(--spacing-3)' }}
                            >
                              <button
                                className="btn-delete-icon"
                                onClick={async () => {
                                  if (!window.confirm('Bạn có chắc chắn muốn xóa buổi học này?')) return;
                                  try {
                                    await deleteSession(session.id);
                                    toast.success('Đã xóa buổi học');
                                    refetch();
                                  } catch (error: any) {
                                    toast.error('Không thể xóa buổi học: ' + (error.response?.data?.error || error.message));
                                  }
                                }}
                                title="Xóa buổi học"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--danger)',
                                  cursor: 'pointer',
                                  padding: 'var(--spacing-1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
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
              <div className="class-detail-stats-grid" style={{ marginTop: 'var(--spacing-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
                <div className="class-detail-stat-item" style={{ padding: 'var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Tổng số buổi</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text)' }}>{monthSessions.length}</div>
                </div>
                <div className="class-detail-stat-item" style={{ padding: 'var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 'var(--spacing-1)' }}>Tổng trợ cấp</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--primary)' }}>
                    {formatCurrencyVND(
                      monthSessions.reduce((sum, s) => {
                        const allowance = (s as any).allowanceAmount || s.allowance_amount || 0;
                        return sum + allowance;
                      }, 0)
                    )}
                  </div>
                </div>
              </div>
              {canManage && (
                <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-3)', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    <span>Chọn một buổi để xem chi tiết hoặc chỉnh sửa trong popup.</span>
                  </div>
                </div>
              )}
              </>
            ) : (
              <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ opacity: 0.3, color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--spacing-3)' }}>
                  Chưa có buổi học trong tháng này.
                </p>
                {canManage && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setAddSessionModalOpen(true);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-1)' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Thêm buổi học
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <Modal
        title="Thêm học sinh vào lớp"
        isOpen={addStudentModalOpen}
        onClose={() => setAddStudentModalOpen(false)}
        size="md"
      >
        {id && (
          <AddStudentToClassModal
            classId={id}
            enrolledStudentIds={enrolledStudents.map((s) => s.id)}
            classData={classData}
            onSuccess={() => {
              setAddStudentModalOpen(false);
              refetch();
            }}
            onClose={() => setAddStudentModalOpen(false)}
          />
        )}
      </Modal>

      {/* Add Session Modal */}
      <Modal
        title="Thêm buổi học"
        isOpen={addSessionModalOpen}
        onClose={() => setAddSessionModalOpen(false)}
        size="md"
      >
        {id && classData && (
          <AddSessionModal
            classId={id}
            classData={classData}
            teachers={classTeachers}
            students={enrolledStudents}
            onSuccess={() => {
              setAddSessionModalOpen(false);
              refetch();
            }}
            onClose={() => setAddSessionModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Class Modal */}
      {editClassModalOpen && classData && (
        <EditClassModal
          isOpen={editClassModalOpen}
          onClose={() => setEditClassModalOpen(false)}
          classData={classData}
          teachers={teachers}
          classTeachers={classTeachers}
          categories={categories}
          onSave={async () => {
            await refetchClass();
            setEditClassModalOpen(false);
          }}
          onOpenTeacherModal={() => {
            setEditTeacherModalOpen(true);
          }}
        />
      )}

      {/* Edit Teacher Modal */}
      <Modal
        title="Chỉnh sửa danh sách gia sư"
        isOpen={editTeacherModalOpen}
        onClose={() => {
          setEditTeacherModalOpen(false);
        }}
        size="md"
        zIndex={2000}
      >
        {id && classData && (
          <EditTeacherModal
            classId={id}
            classData={classData}
            teachers={classTeachers}
            allTeachers={teachers}
            onSuccess={async () => {
              try {
                await refetchClass();
              } catch (error: any) {
                console.error('Failed to refetch class after teacher update:', error);
                toast.error('Đã cập nhật gia sư nhưng không thể tải lại thông tin lớp học');
              }
              setEditTeacherModalOpen(false);
            }}
            onClose={() => setEditTeacherModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Schedule Modal */}
      <Modal
        title="Chỉnh sửa lịch học"
        isOpen={editScheduleModalOpen}
        onClose={() => {
          setEditScheduleModalOpen(false);
        }}
        size="md"
      >
        {id && classData && (
          <EditScheduleModal
            classId={id}
            classData={classData}
            onSuccess={() => {
              setEditScheduleModalOpen(false);
              refetchClass();
            }}
            onClose={() => setEditScheduleModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Session Modal */}
      <Modal
        title="Chỉnh sửa buổi học"
        isOpen={editSessionModalOpen}
        onClose={() => {
          setEditSessionModalOpen(false);
          setEditingSession(null);
        }}
        size="md"
      >
        {id && classData && editingSession && (
          <EditSessionModal
            classId={id}
            classData={classData}
            session={editingSession}
            teachers={classTeachers}
            students={enrolledStudents}
            canManagePaymentStatus={canManagePaymentStatus}
            canEditAllowanceManually={canEditAllowanceManually}
            onSuccess={() => {
              setEditSessionModalOpen(false);
              setEditingSession(null);
              refetch();
            }}
            onClose={() => {
              setEditSessionModalOpen(false);
              setEditingSession(null);
            }}
          />
        )}
      </Modal>

      {/* Edit Student Modal */}
      {editStudentModalOpen && editingStudent && id && (
        <EditStudentModal
          isOpen={editStudentModalOpen}
          onClose={() => {
            setEditStudentModalOpen(false);
            setEditingStudent(null);
          }}
          student={editingStudent}
          onSave={async () => {
            await refetch();
            setEditStudentModalOpen(false);
            setEditingStudent(null);
          }}
        />
      )}

      {/* Move Student Modal */}
      {moveStudentModalOpen && movingStudent && id && (
        <MoveStudentModal
          isOpen={moveStudentModalOpen}
          onClose={() => {
            setMoveStudentModalOpen(false);
            setMovingStudent(null);
          }}
          student={movingStudent}
          currentClassId={id}
          currentClassName={classData?.name || ''}
          onSuccess={async () => {
            await refetch();
            setMoveStudentModalOpen(false);
            setMovingStudent(null);
          }}
        />
      )}

      {/* Teacher Allowance Modal */}
      <Modal
        title="Chỉnh sửa trợ cấp gia sư"
        isOpen={teacherAllowanceModalOpen}
        onClose={() => {
          setTeacherAllowanceModalOpen(false);
          setEditingTeacherForAllowance(null);
        }}
        size="md"
      >
        {id && classData && editingTeacherForAllowance && (
          <TeacherAllowanceModal
            classId={id}
            classData={classData}
            teacher={editingTeacherForAllowance}
            onSuccess={() => {
              setTeacherAllowanceModalOpen(false);
              setEditingTeacherForAllowance(null);
              refetchClass();
            }}
            onClose={() => {
              setTeacherAllowanceModalOpen(false);
              setEditingTeacherForAllowance(null);
            }}
          />
        )}
      </Modal>

      {/* Bulk Session Status Modal */}
      <Modal
        title="Cập nhật trạng thái buổi học"
        isOpen={bulkSessionStatusModalOpen}
        onClose={() => {
          setBulkSessionStatusModalOpen(false);
        }}
        size="md"
      >
        {id && selectedSessions.size > 0 && (
          <BulkSessionStatusModal
            classId={id}
            classData={classData}
            selectedSessionIds={Array.from(selectedSessions)}
            sessions={monthSessions}
            onSuccess={() => {
              setBulkSessionStatusModalOpen(false);
              setSelectedSessions(new Set());
              refetch();
            }}
            onClose={() => {
              setBulkSessionStatusModalOpen(false);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

// Bulk Session Status Modal Component
function BulkSessionStatusModal({
  classId,
  classData,
  selectedSessionIds,
  sessions,
  onSuccess,
  onClose,
}: {
  classId: string;
  classData: any;
  selectedSessionIds: string[];
  sessions: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [paymentStatus, setPaymentStatus] = useState<string>('unpaid');
  const [loading, setLoading] = useState(false);

  const paymentStatusLabels: Record<string, string> = {
    paid: 'Đã thanh toán',
    unpaid: 'Chưa thanh toán',
    deposit: 'Cọc',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter sessions that need updating
    const sessionsToUpdate = sessions.filter(
      (session) =>
        selectedSessionIds.includes(session.id) &&
        ((session as any).paymentStatus || session.payment_status || 'unpaid') !== paymentStatus
    );

    if (sessionsToUpdate.length === 0) {
      toast.info('Các buổi đã ở đúng trạng thái.');
      onClose();
      return;
    }

    setLoading(true);
    try {
      // Update all selected sessions
      const updatePromises = sessionsToUpdate.map((session) =>
        updateSession(session.id, {
          payment_status: paymentStatus as 'paid' | 'unpaid' | 'deposit',
        })
      );

      await Promise.all(updatePromises);
      toast.success(`Đã cập nhật trạng thái ${sessionsToUpdate.length} buổi học`);
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể cập nhật trạng thái buổi học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="bulkSessionStatus" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Trạng thái thanh toán
        </label>
        <select
          id="bulkSessionStatus"
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        >
          <option value="paid">Thanh Toán</option>
          <option value="unpaid">Chưa Thanh Toán</option>
          <option value="deposit">Cọc</option>
        </select>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
          Áp dụng cho {selectedSessionIds.length} buổi đã chọn.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang cập nhật...' : 'Cập nhật'}
        </button>
      </div>
    </form>
  );
}

// Add Student to Class Modal Component
function AddStudentToClassModal({
  classId,
  enrolledStudentIds,
  classData,
  onSuccess,
  onClose,
}: {
  classId: string;
  enrolledStudentIds: string[];
  classData?: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { data: studentsData } = useDataLoading(() => fetchStudents(), [], {
    cacheKey: 'students-for-add-to-class',
    staleTime: 5 * 60 * 1000,
  });
  const { data: classesData } = useDataLoading(() => fetchClasses(), [], {
    cacheKey: 'classes-for-student-info',
    staleTime: 5 * 60 * 1000,
  });

  const availableStudents = useMemo(() => {
    if (!studentsData) return [];
    return studentsData
      .filter((s) => !enrolledStudentIds.includes(s.id) && s.status === 'active')
      .map((student) => {
        // Get other classes for this student
        const otherClasses = classesData
          ? classesData
              .filter((c) => {
                const studentClass = c.students?.find((sc: any) => sc.studentId === student.id);
                return studentClass && c.id !== classId && studentClass.status !== 'inactive';
              })
              .map((c) => c.name)
          : [];
        return {
          ...student,
          normalizedName: (student.fullName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
          otherClasses,
        };
      });
  }, [studentsData, enrolledStudentIds, classesData, classId]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return availableStudents.slice(0, 8);
    const normalizedQuery = searchQuery
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return availableStudents.filter((student) => student.normalizedName.includes(normalizedQuery));
  }, [availableStudents, searchQuery]);

  const currentCount = enrolledStudentIds.length;
  const maxStudents = classData?.maxStudents;

  const handleAddStudent = async (studentId: string) => {
    if (maxStudents && currentCount >= maxStudents) {
      toast.warning(`Lớp đã đạt số lượng tối đa (${maxStudents} học sinh)`);
      return;
    }

    setLoading(true);
    try {
      await addStudentToClass(classId, studentId);
      toast.success('Đã thêm học sinh vào lớp');
      setSearchQuery('');
      setShowResults(false);
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể thêm học sinh vào lớp: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginBottom: 'var(--spacing-2)' }}>
          {maxStudents
            ? `Lớp hiện có ${currentCount}/${maxStudents} học sinh`
            : `Lớp hiện có ${currentCount} học sinh`}
        </div>
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Tìm học sinh theo tên
          </label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Tìm học sinh theo tên..."
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />
          {showResults && filteredStudents.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 'var(--spacing-1)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 10,
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {filteredStudents.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleAddStudent(student.id)}
                  disabled={loading || (maxStudents ? currentCount >= maxStudents : false)}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-3)',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && (!maxStudents || currentCount < maxStudents)) {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>{student.fullName}</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
                    {student.birthYear ? `Năm sinh: ${student.birthYear} • ` : ''}
                    {student.otherClasses.length > 0
                      ? `Đang học: ${student.otherClasses.join(', ')}`
                      : 'Chưa tham gia lớp nào khác'}
                  </div>
                </button>
              ))}
            </div>
          )}
          {showResults && searchQuery && filteredStudents.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 'var(--spacing-1)',
                padding: 'var(--spacing-2)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--muted)',
              }}
            >
              Không tìm thấy học sinh phù hợp.
            </div>
          )}
        </div>
      </div>
      {availableStudents.length === 0 && (
        <p style={{ marginTop: 'var(--spacing-2)', fontSize: '0.875rem', color: 'var(--muted)' }}>
          Không còn học sinh nào có thể thêm vào lớp này.
        </p>
      )}
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Đóng
        </button>
      </div>
    </div>
  );
}

// Teacher Selector Component (similar to EditTeacherModal search)
function TeacherSelector({
  teachers,
  selectedTeacherId,
  onSelectTeacher,
  placeholder = "Nhập tên gia sư ...",
  disabled = false,
}: {
  teachers: any[];
  selectedTeacherId: string;
  onSelectTeacher: (teacherId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) {
      return teachers.slice(0, 6);
    }
    const normalized = searchQuery.trim().toLowerCase();
    return teachers.filter((t) => t.fullName.toLowerCase().includes(normalized));
  }, [teachers, searchQuery]);

  useEffect(() => {
    if (searchQuery && !disabled) {
      setShowDropdown(true);
    }
  }, [searchQuery, disabled]);

  const handleSelectTeacher = (teacherId: string) => {
    if (disabled) return;
    onSelectTeacher(teacherId);
    setSearchQuery('');
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => {
          if (!disabled) {
            setShowDropdown(!showDropdown);
          }
        }}
        style={{
          width: '100%',
          padding: 'var(--spacing-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: disabled ? 'var(--bg-secondary)' : 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '38px',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ color: selectedTeacher ? 'var(--text)' : 'var(--muted)' }}>
          {selectedTeacher ? selectedTeacher.fullName : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {(showDropdown || searchQuery) && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 'var(--spacing-1)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: 'var(--spacing-2)' }}>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              autoFocus
              style={{
                width: '100%',
                padding: 'var(--spacing-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
              onBlur={() => {
                // Delay hiding to allow click on item
                setTimeout(() => setShowDropdown(false), 200);
              }}
            />
          </div>
          {filteredTeachers.length > 0 ? (
            filteredTeachers.map((teacher) => (
              <button
                key={teacher.id}
                type="button"
                onClick={() => handleSelectTeacher(teacher.id)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2)',
                  textAlign: 'left',
                  background: teacher.id === selectedTeacherId ? 'var(--bg-secondary)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  borderTop: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  if (teacher.id !== selectedTeacherId) {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (teacher.id !== selectedTeacherId) {
                    e.currentTarget.style.background = 'none';
                  }
                }}
              >
                {teacher.fullName}
              </button>
            ))
          ) : (
            <div
              style={{
                padding: 'var(--spacing-2)',
                fontSize: '0.875rem',
                color: 'var(--muted)',
                textAlign: 'center',
              }}
            >
              Không tìm thấy gia sư phù hợp.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Add Session Modal Component
function AddSessionModal({
  classId,
  classData,
  teachers,
  students,
  onSuccess,
  onClose,
}: {
  classId: string;
  classData: any;
  teachers: any[];
  students: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = hasRole('admin');
  const hasCskhPrivileges = userHasStaffRole('cskh_sale', currentUser, teachers);
  const canManagePaymentStatus = isAdmin || hasRole('accountant') || hasCskhPrivileges;
  
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('20:00');
  
  // Refs for date and time inputs
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const startTimeInputRef = React.useRef<HTMLInputElement>(null);
  const endTimeInputRef = React.useRef<HTMLInputElement>(null);
  const [teacherId, setTeacherId] = useState<string>(teachers.length > 0 ? teachers[0].id : '');
  const [coefficient, setCoefficient] = useState<number>(1);
  const [coefficientInputValue, setCoefficientInputValue] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'deposit'>('unpaid');
  const [loading, setLoading] = useState(false);
  
  // Attendance state using hook
  const initialAttendanceState = useMemo(() => {
    const state: Record<string, { status: AttendanceStatus; remark: string }> = {};
    students.forEach((student) => {
      const hasRemaining = (student.remainingSessions || 0) > 0;
      state[student.id] = {
        status: hasRemaining ? 'present' : 'absent',
        remark: '',
      };
    });
    return state;
  }, [students]);
  
  const {
    attendance,
    toggleAttendance,
    updateAttendance,
    getAttendanceSummary,
    getEligibleCount,
  } = useAttendance(initialAttendanceState);
  
  // Calculate initial paid count (students with remaining sessions > 0) - fixed value, not affected by attendance changes
  const initialPaidCount = useMemo(() => {
    return students.filter((student) => (student.remainingSessions || 0) > 0).length;
  }, [students]);
  
  // Get attendance summary for display
  const attendanceSummary = useMemo(() => getAttendanceSummary(), [attendance, getAttendanceSummary]);
  
  // Calculate eligible count (present + excused) for allowance calculation
  const eligibleCount = useMemo(() => getEligibleCount(), [attendance, getEligibleCount]);
  
  // Calculate allowance preview - uses eligible count (present + excused) with remaining sessions > 0
  const allowancePreview = useMemo(() => {
    if (!teacherId || coefficient === 0) return 0;
    
    // Count students who are present or excused AND have remaining sessions > 0
    const paidCount = students.filter((student) => {
      const att = attendance[student.id];
      const hasRemaining = (student.remainingSessions || 0) > 0;
      const isEligible = att?.status === 'present' || att?.status === 'excused';
      return isEligible && hasRemaining;
    }).length;
    
    if (paidCount === 0) return 0;
    
    const customAllowances = (classData as any)?.customTeacherAllowances || {};
    const baseAllowance = customAllowances[teacherId] ?? (classData?.tuitionPerSession || 0);
    const scaleAmount = classData?.scaleAmount || 0;
    const maxPerSession = (classData as any)?.maxAllowancePerSession || 0;
    let allowance = baseAllowance * coefficient * paidCount + scaleAmount;
    if (maxPerSession > 0 && allowance > maxPerSession) {
      allowance = maxPerSession;
    }
    return Math.round(allowance > 0 ? allowance : 0);
  }, [teacherId, coefficient, attendance, students, classData]);
  
  // Calculate duration
  const duration = useMemo(() => {
    if (!startTime || !endTime) return null;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) return null;
    const diff = endMinutes - startMinutes;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return { hours, minutes };
  }, [startTime, endTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime || !notes.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin (bao gồm nhận xét)');
      return;
    }
    if (duration === null) {
      toast.error('Giờ kết thúc phải lớn hơn giờ bắt đầu');
      return;
    }

    setLoading(true);
    try {
      // Calculate allowance amount based on actual attendance (students with status 'present' or 'excused' AND have remaining sessions > 0)
      let calculatedAllowance: number | undefined = undefined;
      if (teacherId && coefficient !== 0) {
        // Count students who are present or excused AND have remaining sessions > 0
        const paidCount = students.filter((student) => {
          const att = attendance[student.id];
          const hasRemaining = (student.remainingSessions || 0) > 0;
          const isEligible = att?.status === 'present' || att?.status === 'excused';
          return isEligible && hasRemaining;
        }).length;
        
        if (paidCount > 0) {
          const customAllowances = (classData as any)?.customTeacherAllowances || {};
          const baseAllowance = customAllowances[teacherId] ?? (classData?.tuitionPerSession || 0);
          const scaleAmount = classData?.scaleAmount || 0;
          const maxPerSession = (classData as any)?.maxAllowancePerSession || 0;
          let allowance = baseAllowance * coefficient * paidCount + scaleAmount;
          if (maxPerSession > 0 && allowance > maxPerSession) {
            allowance = maxPerSession;
          }
          calculatedAllowance = Math.round(allowance > 0 ? allowance : 0);
        }
      }
      
      // Create session first
      const newSession = await createSession({
        class_id: classId,
        date,
        start_time: startTime,
        end_time: endTime,
        teacher_id: teacherId || undefined,
        coefficient: coefficient,
        notes: notes.trim(),
        payment_status: canManagePaymentStatus ? paymentStatus : 'unpaid',
        allowance_amount: calculatedAllowance !== undefined && calculatedAllowance > 0 ? calculatedAllowance : undefined,
      });
      
      // Then save attendance records
      if (students.length > 0) {
        const attendanceData = students.map((student) => {
          const att = attendance[student.id] || { status: 'absent' as AttendanceStatus, remark: '' };
          return {
            student_id: student.id,
            status: att.status,
            remark: att.remark || undefined,
          };
        });
        
        await saveAttendanceForSession(newSession.id, attendanceData);
      }
      
      toast.success('Đã thêm buổi học mới');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể thêm buổi học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label 
          htmlFor="add-session-date"
          style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500', cursor: 'pointer' }}
          onClick={(e) => {
            e.preventDefault();
            dateInputRef.current?.showPicker?.();
            dateInputRef.current?.focus();
          }}
        >
          Ngày học *
        </label>
        <input
          ref={dateInputRef}
          id="add-session-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            const input = e.currentTarget;
            input.showPicker?.();
          }}
        />
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Thời gian *
        </label>
        <div className="session-time-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            className="session-time-field" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('input')) {
                startTimeInputRef.current?.showPicker?.();
                startTimeInputRef.current?.focus();
              }
            }}
          >
            <span className="session-time-label" style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Bắt đầu</span>
            <input
              ref={startTimeInputRef}
              id="add-session-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="form-control"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 'var(--spacing-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                const input = e.currentTarget;
                input.showPicker?.();
              }}
            />
          </div>
          <span className="session-time-separator" style={{ fontSize: '18px', color: 'var(--muted)' }}>→</span>
          <div 
            className="session-time-field" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('input')) {
                endTimeInputRef.current?.showPicker?.();
                endTimeInputRef.current?.focus();
              }
            }}
          >
            <span className="session-time-label" style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Kết thúc</span>
            <input
              ref={endTimeInputRef}
              id="add-session-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="form-control"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 'var(--spacing-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                const input = e.currentTarget;
                input.showPicker?.();
              }}
            />
          </div>
        </div>
        {(() => {
          if (!startTime || !endTime) return null;
          const [startH, startM] = startTime.split(':').map(Number);
          const [endH, endM] = endTime.split(':').map(Number);
          if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          if (endMinutes <= startMinutes) {
            return (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', marginTop: 'var(--spacing-1)' }}>
                ⚠️ Giờ kết thúc phải lớn hơn giờ bắt đầu
              </div>
            );
          }
          const diff = endMinutes - startMinutes;
          const hours = Math.floor(diff / 60);
          const minutes = diff % 60;
          const parts = [];
          if (hours > 0) parts.push(`${hours} giờ`);
          if (minutes > 0) parts.push(`${minutes} phút`);
          return (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
              Thời lượng: {parts.length ? parts.join(' ') : '< 1 phút'}
            </div>
          );
        })()}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
        {teachers.length > 0 && (
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Gia sư dạy *
            </label>
            <TeacherSelector
              teachers={teachers}
              selectedTeacherId={teacherId}
              onSelectTeacher={(id) => setTeacherId(id)}
              placeholder="Nhập tên gia sư ..."
            />
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Hệ số (0-10) *
          </label>
          <input
            type="number"
            value={coefficientInputValue}
            onChange={(e) => {
              const value = e.target.value;
              setCoefficientInputValue(value);
              // Allow empty string for clearing - don't update coefficient yet
              if (value === '') {
                // Keep input empty, but set coefficient to 0 for calculations
                setCoefficient(0);
              } else {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  setCoefficient(numValue);
                }
              }
            }}
            onBlur={(e) => {
              // When blur, if empty, set to 0
              if (e.target.value === '') {
                setCoefficientInputValue('0');
                setCoefficient(0);
              }
            }}
            min="0"
            max="10"
            step="0.1"
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
            Hệ số từ 0 đến 10
          </div>
        </div>
      </div>
      
      {/* Allowance Preview */}
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Trợ cấp giáo viên
        </label>
        <div
          style={{
            padding: 'var(--spacing-3)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontSize: '1rem',
            fontWeight: '500',
            color: allowancePreview > 0 ? 'var(--text)' : 'var(--muted)',
          }}
        >
          {allowancePreview > 0 ? (
            formatCurrencyVND(allowancePreview)
          ) : (
            <span style={{ fontStyle: 'italic' }}>Tự động tính sau khi lưu buổi học</span>
          )}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
          {teacherId
            ? `Ước tính dựa trên ${students.filter((s) => {
                const att = attendance[s.id];
                const hasRemaining = (s.remainingSessions || 0) > 0;
                const isEligible = att?.status === 'present' || att?.status === 'excused';
                return isEligible && hasRemaining;
              }).length} học sinh (Học + Phép) • Hệ số ${coefficient}`
            : 'Chọn gia sư để xem trợ cấp dự kiến'}
        </div>
      </div>
      
      {/* Payment Status */}
      {canManagePaymentStatus && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Trạng thái thanh toán *
          </label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as 'paid' | 'unpaid' | 'deposit')}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <option value="unpaid">Chưa Thanh Toán</option>
            <option value="paid">Thanh Toán</option>
            <option value="deposit">Cọc</option>
          </select>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
            Chọn trạng thái thanh toán cho buổi dạy này
          </div>
        </div>
      )}
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Nhận xét *
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Nhận xét về buổi học, tiến độ học sinh..."
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            resize: 'vertical',
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        />
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
          Vui lòng nhập nhận xét cho buổi học
        </div>
      </div>
      
      {/* Attendance Table */}
      {students.length > 0 ? (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Điểm danh học sinh *
          </label>
          <div className="card" style={{ marginTop: 'var(--spacing-2)', maxHeight: '300px', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div className="table-container">
              <table style={{ fontSize: 'var(--font-size-sm)', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center', padding: 'var(--spacing-2)' }}>Trạng thái</th>
                    <th style={{ padding: 'var(--spacing-2)', textAlign: 'left' }}>Tên học sinh</th>
                    <th style={{ padding: 'var(--spacing-2)', textAlign: 'left' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const att = attendance[student.id] || { status: 'absent' as AttendanceStatus, remark: '' };
                    return (
                      <tr key={student.id}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: 'var(--spacing-2)' }}>
                          <AttendanceIcon
                            status={att.status}
                            onClick={() => toggleAttendance(student.id)}
                            size={20}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: 'var(--spacing-2)' }}>{student.fullName}</td>
                        <td style={{ verticalAlign: 'middle', padding: 'var(--spacing-2)' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={att.remark}
                            onChange={(e) => {
                              updateAttendance(student.id, { remark: e.target.value });
                            }}
                            placeholder="Ghi chú (nếu cần)"
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              padding: 'var(--spacing-1) var(--spacing-2)',
                              width: '100%',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-2)', lineHeight: '1.6' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
              <span>
                <span style={{ color: '#10b981', fontWeight: '500' }}>Học</span>: <span id="presentCount">{attendanceSummary.present}</span>
              </span>
              <span>
                <span style={{ color: '#f59e0b', fontWeight: '500' }}>Phép</span>: <span id="excusedCount">{attendanceSummary.excused}</span>
              </span>
              <span>
                <span style={{ color: '#dc2626', fontWeight: '500' }}>Vắng</span>: <span id="absentCount">{attendanceSummary.absent}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
          Lớp chưa có học sinh
        </div>
      )}
      <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-5)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Thêm buổi học'}
        </button>
      </div>
    </form>
  );
}

// Edit Session Modal Component
function EditSessionModal({
  classId,
  classData,
  session,
  teachers,
  students,
  onSuccess,
  onClose,
  canManagePaymentStatus = false,
  canEditAllowanceManually = false,
}: {
  classId: string;
  classData: any;
  session: any;
  teachers: any[];
  students: any[];
  onSuccess: () => void;
  onClose: () => void;
  canManagePaymentStatus?: boolean;
  canEditAllowanceManually?: boolean;
}) {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = hasRole('admin');
  
  const [date, setDate] = useState<string>(session.date || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState<string>((session as any).startTime || session.start_time || '18:00');
  const [endTime, setEndTime] = useState<string>((session as any).endTime || session.end_time || '20:00');
  
  // Refs for date and time inputs
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const startTimeInputRef = React.useRef<HTMLInputElement>(null);
  const endTimeInputRef = React.useRef<HTMLInputElement>(null);
  const [teacherId, setTeacherId] = useState<string>((session as any).teacherId || session.teacher_id || (teachers.length > 0 ? teachers[0].id : ''));
  const initialCoefficient = (session as any).coefficient !== undefined && (session as any).coefficient !== null
    ? (session as any).coefficient
    : session.coefficient !== undefined && session.coefficient !== null
      ? session.coefficient
      : 1;
  const [coefficient, setCoefficient] = useState<number>(initialCoefficient);
  const [coefficientInputValue, setCoefficientInputValue] = useState<string>(String(initialCoefficient));
  const [notes, setNotes] = useState<string>(session.notes || '');
  const [paymentStatus, setPaymentStatus] = useState<string>((session as any).paymentStatus || session.payment_status || 'unpaid');
  const [allowanceAmount, setAllowanceAmount] = useState<number | null>(
    (session as any).allowanceAmount !== undefined && (session as any).allowanceAmount !== null
      ? (session as any).allowanceAmount
      : session.allowance_amount !== undefined && session.allowance_amount !== null
        ? session.allowance_amount
        : null
  );
  const [editingAllowance, setEditingAllowance] = useState(false);
  const [allowanceInputValue, setAllowanceInputValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  
  // Attendance state using hook
  const {
    attendance,
    setAttendance,
    toggleAttendance,
    updateAttendance,
    getAttendanceSummary,
    getEligibleCount,
  } = useAttendance({});

  // Prefill all fields when session changes
  useEffect(() => {
    if (session) {
      // Prefill date
      if (session.date) {
        setDate(session.date);
      }
      
      // Prefill start time
      const sessionStartTime = (session as any).startTime || session.start_time;
      if (sessionStartTime) {
        setStartTime(sessionStartTime);
      }
      
      // Prefill end time
      const sessionEndTime = (session as any).endTime || session.end_time;
      if (sessionEndTime) {
        setEndTime(sessionEndTime);
      }
      
      // Prefill teacher ID
      const sessionTeacherId = (session as any).teacherId || session.teacher_id;
      if (sessionTeacherId) {
        setTeacherId(sessionTeacherId);
      } else if (teachers.length > 0) {
        setTeacherId(teachers[0].id);
      }
      
      // Prefill coefficient
      const sessionCoefficient = (session as any).coefficient !== undefined && (session as any).coefficient !== null
        ? (session as any).coefficient
        : session.coefficient !== undefined && session.coefficient !== null
          ? session.coefficient
          : 1;
      setCoefficient(sessionCoefficient);
      setCoefficientInputValue(String(sessionCoefficient));
      
      // Prefill notes
      if (session.notes !== undefined && session.notes !== null) {
        setNotes(session.notes);
      }
      
      // Prefill payment status
      const sessionPaymentStatus = (session as any).paymentStatus || session.payment_status;
      if (sessionPaymentStatus) {
        setPaymentStatus(sessionPaymentStatus);
      }
      
      // Prefill allowance amount - check both camelCase and snake_case, including 0
      let sessionAllowanceAmount: number | null = null;
      if ((session as any).allowanceAmount !== undefined && (session as any).allowanceAmount !== null) {
        sessionAllowanceAmount = Number((session as any).allowanceAmount);
      } else if (session.allowance_amount !== undefined && session.allowance_amount !== null) {
        sessionAllowanceAmount = Number(session.allowance_amount);
      }
      
      // Set allowance amount (including 0 as valid value)
      setAllowanceAmount(sessionAllowanceAmount);
      setAllowanceInputValue(sessionAllowanceAmount !== null && !isNaN(sessionAllowanceAmount) ? sessionAllowanceAmount.toString() : '');
      setEditingAllowance(false);
    }
  }, [session, teachers]);
  
  // Fetch existing attendance
  useEffect(() => {
    const loadAttendance = async () => {
      try {
        const existingAttendance = await fetchAttendanceBySession(session.id);
        const attendanceMap: Record<string, { status: AttendanceStatus; remark: string }> = {};
        
        // Initialize with existing attendance (check if it's an array)
        if (Array.isArray(existingAttendance)) {
          existingAttendance.forEach((att) => {
            // Use status if available, otherwise convert from present boolean
            const status: AttendanceStatus = att.status || (att.present ? 'present' : 'absent');
            attendanceMap[att.student_id] = {
              status,
              remark: att.remark || '',
            };
          });
        }
        
        // Add students not in attendance (default to present if they have remaining sessions)
        if (Array.isArray(students)) {
          students.forEach((student) => {
            if (!attendanceMap[student.id]) {
              const hasRemaining = (student.remainingSessions || 0) > 0;
              attendanceMap[student.id] = {
                status: hasRemaining ? 'present' : 'absent',
                remark: '',
              };
            }
          });
        }
        
        setAttendance(attendanceMap);
      } catch (error) {
        console.error('Failed to load attendance:', error);
        // Initialize with default values
        const defaultAttendance: Record<string, { status: AttendanceStatus; remark: string }> = {};
        if (Array.isArray(students)) {
          students.forEach((student) => {
            const hasRemaining = (student.remainingSessions || 0) > 0;
            defaultAttendance[student.id] = {
              status: hasRemaining ? 'present' : 'absent',
              remark: '',
            };
          });
        }
        setAttendance(defaultAttendance);
      } finally {
        setLoadingAttendance(false);
      }
    };
    
    loadAttendance();
  }, [session.id, students]);
  
  // Calculate estimated paid count (students with remaining sessions > 0)
  const estimatedPaidCount = useMemo(() => {
    if (session && typeof (session as any).studentPaidCount === 'number') {
      return (session as any).studentPaidCount;
    }
    if (Array.isArray(students)) {
      return students.filter((s) => (s.remainingSessions || 0) > 0).length;
    }
    return 0;
  }, [session, students]);

  // Calculate allowance preview
  const computeAllowancePreview = useCallback((teacherIdValue: string, coefficientValue: number, paidCountValue: number) => {
    if (!teacherIdValue || coefficientValue === 0) return 0;
    const customAllowances = (classData as any)?.customTeacherAllowances || {};
    const baseAllowance = customAllowances[teacherIdValue] ?? (classData?.tuitionPerSession || 0);
    const scaleAmount = classData?.scaleAmount || 0;
    const maxPerSession = (classData as any)?.maxAllowancePerSession || 0;
    let allowance = baseAllowance * coefficientValue * paidCountValue + scaleAmount;
    if (maxPerSession > 0 && allowance > maxPerSession) {
      allowance = maxPerSession;
    }
    return Math.round(allowance > 0 ? allowance : 0);
  }, [classData]);

  // Calculate current allowance
  const currentAllowance = useMemo(() => {
    if (allowanceAmount !== null && allowanceAmount !== undefined && allowanceAmount >= 0) {
      return allowanceAmount;
    }
    if (teacherId && coefficient !== undefined) {
      return computeAllowancePreview(teacherId, coefficient, estimatedPaidCount);
    }
    return 0;
  }, [allowanceAmount, teacherId, coefficient, estimatedPaidCount, computeAllowancePreview]);

  const lockedAllowance = allowanceAmount !== null && allowanceAmount !== undefined && allowanceAmount >= 0;

  // Calculate duration
  const duration = useMemo(() => {
    if (!startTime || !endTime) return null;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return null;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) return null;
    const diff = endMinutes - startMinutes;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return { hours, minutes };
  }, [startTime, endTime]);

  // Calculate attendance summary
  const attendanceSummary = useMemo(() => {
    if (!Array.isArray(students)) return { present: 0, absent: 0 };
    let present = 0;
    let absent = 0;
    students.forEach((student) => {
      if (attendance[student.id]?.present) {
        present++;
      } else {
        absent++;
      }
    });
    return { present, absent };
  }, [attendance, students]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime || !notes.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin (bao gồm nhận xét)');
      return;
    }
    if (duration === null) {
      toast.error('Giờ kết thúc phải lớn hơn giờ bắt đầu');
      return;
    }

    setLoading(true);
    try {
      // Update session
      const updateData: any = {
        class_id: classId,
        date,
        start_time: startTime,
        end_time: endTime,
        teacher_id: teacherId || undefined,
        coefficient: coefficient,
        notes: notes.trim(),
        payment_status: canManagePaymentStatus ? paymentStatus : undefined,
      };
      
      // Include allowance_amount if it's set
      if (allowanceAmount !== null && allowanceAmount !== undefined) {
        updateData.allowance_amount = allowanceAmount;
      }
      
      await updateSession(session.id, updateData);
      
      // Update attendance records
      if (students.length > 0) {
        const attendanceData = students.map((student) => {
          const att = attendance[student.id] || { status: 'absent' as AttendanceStatus, remark: '' };
          return {
            student_id: student.id,
            status: att.status,
            remark: att.remark || undefined,
          };
        });
        
        await saveAttendanceForSession(session.id, attendanceData);
      }
      
      toast.success('Đã cập nhật buổi học');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể cập nhật buổi học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label 
          htmlFor="edit-session-date"
          style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500', cursor: 'pointer' }}
          onClick={(e) => {
            e.preventDefault();
            dateInputRef.current?.showPicker?.();
            dateInputRef.current?.focus();
          }}
        >
          Ngày học *
        </label>
        <input
          ref={dateInputRef}
          id="edit-session-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          style={{
            width: '100%',
            padding: 'var(--spacing-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            const input = e.currentTarget;
            input.showPicker?.();
          }}
        />
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Thời gian *
        </label>
        <div className="session-time-row" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            className="session-time-field" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('input')) {
                startTimeInputRef.current?.showPicker?.();
                startTimeInputRef.current?.focus();
              }
            }}
          >
            <span className="session-time-label" style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Bắt đầu</span>
            <input
              ref={startTimeInputRef}
              id="edit-session-start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="form-control"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 'var(--spacing-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                const input = e.currentTarget;
                input.showPicker?.();
              }}
            />
          </div>
          <span className="session-time-separator" style={{ fontSize: '18px', color: 'var(--muted)' }}>→</span>
          <div 
            className="session-time-field" 
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest('input')) {
                endTimeInputRef.current?.showPicker?.();
                endTimeInputRef.current?.focus();
              }
            }}
          >
            <span className="session-time-label" style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Kết thúc</span>
            <input
              ref={endTimeInputRef}
              id="edit-session-end-time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="form-control"
              style={{
                flex: 1,
                minWidth: 0,
                padding: 'var(--spacing-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                const input = e.currentTarget;
                input.showPicker?.();
              }}
            />
          </div>
        </div>
        {duration && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
            Thời lượng: {duration.hours > 0 ? `${duration.hours} giờ` : ''} {duration.minutes > 0 ? `${duration.minutes} phút` : ''} {duration.hours === 0 && duration.minutes === 0 ? '< 1 phút' : ''}
          </div>
        )}
        {duration === null && startTime && endTime && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', marginTop: 'var(--spacing-1)' }}>
            ⚠️ Giờ kết thúc phải lớn hơn giờ bắt đầu
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
        {teachers.length > 0 && (
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
              Gia sư dạy *
            </label>
            <TeacherSelector
              teachers={teachers}
              selectedTeacherId={teacherId}
              onSelectTeacher={(id) => setTeacherId(id)}
              placeholder="Nhập tên gia sư ..."
              disabled={!isAdmin}
            />
            {!isAdmin && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
                Gia sư mặc định là người tạo buổi học. Chỉ admin mới có thể thay đổi.
              </div>
            )}
          </div>
        )}
        <div>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Hệ số (0-10) *
          </label>
          <input
            type="number"
            value={coefficientInputValue}
            onChange={(e) => {
              const value = e.target.value;
              setCoefficientInputValue(value);
              // Allow empty string for clearing - don't update coefficient yet
              if (value === '') {
                // Keep input empty, but set coefficient to 0 for calculations
                setCoefficient(0);
              } else {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  setCoefficient(numValue);
                }
              }
            }}
            onBlur={(e) => {
              // When blur, if empty, set to 0
              if (e.target.value === '') {
                setCoefficientInputValue('0');
                setCoefficient(0);
              }
            }}
            min="0"
            max="10"
            step="0.1"
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
            Hệ số từ 0 đến 10
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Trợ cấp giáo viên
        </label>
        {editingAllowance && canEditAllowanceManually && lockedAllowance ? (
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <CurrencyInput
                value={allowanceInputValue ? parseFloat(allowanceInputValue) : 0}
                onChange={(value) => {
                  setAllowanceInputValue(String(value));
                }}
                showHint={false}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
                onBlur={async () => {
                  const parsed = allowanceInputValue ? parseFloat(allowanceInputValue) : 0;
                  if (Number.isFinite(parsed)) {
                    try {
                      await updateSession(session.id, { allowance_amount: parsed });
                      setAllowanceAmount(parsed);
                      toast.success('Đã cập nhật trợ cấp');
                    } catch (error: any) {
                      toast.error('Không thể cập nhật trợ cấp: ' + (error.response?.data?.error || error.message));
                    }
                  }
                  setEditingAllowance(false);
                  setAllowanceInputValue('');
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setEditingAllowance(false);
                    setAllowanceInputValue('');
                  }
                }}
                autoFocus
              />
            </div>
          </div>
        ) : (
          <div
            onClick={() => {
              if (canEditAllowanceManually && lockedAllowance) {
                setEditingAllowance(true);
                setAllowanceInputValue(String(currentAllowance));
              }
            }}
            style={{
              padding: 'var(--spacing-2)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              cursor: canEditAllowanceManually && lockedAllowance ? 'pointer' : 'default',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (canEditAllowanceManually && lockedAllowance) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
          >
            {lockedAllowance ? (
              // If allowance is locked (has been set), always show it (even if 0)
              <span style={{ fontWeight: '500' }}>{formatCurrencyVND(currentAllowance)}</span>
            ) : currentAllowance > 0 ? (
              // If allowance is calculated and > 0, show it
              <span style={{ fontWeight: '500' }}>{formatCurrencyVND(currentAllowance)}</span>
            ) : (
              // Otherwise, show placeholder
              <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Tự động tính sau khi lưu buổi học</span>
            )}
            {canEditAllowanceManually && lockedAllowance && (
              <span style={{ marginLeft: 'var(--spacing-1)', fontSize: '0.9em', opacity: 0.7 }}>✏️</span>
            )}
          </div>
        )}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
          {lockedAllowance
            ? `Đã gia hạn: ${estimatedPaidCount} học sinh • Hệ số ${coefficient} • Trợ cấp cố định khi tạo buổi học`
            : session && typeof (session as any).studentPaidCount === 'number'
              ? `Đã gia hạn: ${estimatedPaidCount} học sinh đã gia hạn • Hệ số ${coefficient}`
              : `Ước tính: ${estimatedPaidCount} học sinh đã gia hạn • Hệ số ${coefficient}`}
        </div>
      </div>
      {canManagePaymentStatus && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Trạng thái thanh toán *
          </label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          >
            <option value="unpaid">Chưa Thanh Toán</option>
            <option value="paid">Thanh Toán</option>
            <option value="deposit">Cọc</option>
          </select>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
            Chọn trạng thái thanh toán cho buổi dạy này
          </div>
        </div>
      )}
      {!canManagePaymentStatus && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Trạng thái thanh toán
          </label>
          <div
            style={{
              padding: 'var(--spacing-2)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'not-allowed',
              color: 'var(--muted)',
            }}
          >
            {paymentStatus === 'paid' ? 'Thanh Toán' : paymentStatus === 'deposit' ? 'Cọc' : 'Chưa Thanh Toán'}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
            Chỉ quản trị viên hoặc kế toán có thể cập nhật trạng thái thanh toán.
          </div>
        </div>
      )}
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Nhận xét *
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          required
          placeholder="Nhận xét về buổi học, tiến độ học sinh..."
          style={{
            width: '100%',
            padding: 'var(--spacing-3)',
            border: notes.trim() ? '1px solid var(--border)' : '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
            resize: 'vertical',
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        />
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
          Vui lòng nhập nhận xét cho buổi học
        </div>
        {!notes.trim() && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--danger)', marginTop: 'var(--spacing-1)' }}>
            Vui lòng nhập nhận xét cho buổi học
          </div>
        )}
      </div>
      {students.length > 0 ? (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
            Điểm danh học sinh *
          </label>
          <div className="card" style={{ marginTop: 'var(--spacing-2)', maxHeight: '300px', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div className="table-container">
              <table style={{ fontSize: 'var(--font-size-sm)', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '60px', textAlign: 'center', padding: 'var(--spacing-2)' }}>Trạng thái</th>
                    <th style={{ padding: 'var(--spacing-2)', textAlign: 'left' }}>Tên học sinh</th>
                    <th style={{ padding: 'var(--spacing-2)', textAlign: 'left' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const att = attendance[student.id] || { status: 'absent' as AttendanceStatus, remark: '' };
                    return (
                      <tr key={student.id}>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: 'var(--spacing-2)' }}>
                          <AttendanceIcon
                            status={att.status}
                            onClick={() => toggleAttendance(student.id)}
                            size={20}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: 'var(--spacing-2)' }}>{student.fullName}</td>
                        <td style={{ verticalAlign: 'middle', padding: 'var(--spacing-2)' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={att.remark || ''}
                            onChange={(e) => {
                              updateAttendance(student.id, { remark: e.target.value });
                            }}
                            placeholder="Ghi chú (nếu cần)"
                            style={{
                              fontSize: 'var(--font-size-xs)',
                              padding: 'var(--spacing-1) var(--spacing-2)',
                              width: '100%',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-2)', lineHeight: '1.6' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
              <span>
                <span style={{ color: '#10b981', fontWeight: '500' }}>Học</span>: <span id="presentCount">{getAttendanceSummary().present}</span>
              </span>
              <span>
                <span style={{ color: '#f59e0b', fontWeight: '500' }}>Phép</span>: <span id="excusedCount">{getAttendanceSummary().excused}</span>
              </span>
              <span>
                <span style={{ color: '#dc2626', fontWeight: '500' }}>Vắng</span>: <span id="absentCount">{getAttendanceSummary().absent}</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>
          Lớp chưa có học sinh
        </div>
      )}
      <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-5)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--border)' }}>
        <button type="button" className="btn" onClick={onClose} disabled={loading}>
          Hủy
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Cập nhật'}
        </button>
      </div>
    </form>
  );
}

// Edit Teacher Modal Component
function EditTeacherModal({
  classId,
  classData,
  teachers,
  allTeachers,
  onSuccess,
  onClose,
}: {
  classId: string;
  classData: any;
  teachers: any[];
  allTeachers: any[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [currentTeacherIds, setCurrentTeacherIds] = useState<Set<string>>(
    new Set(classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const availableTeachers = useMemo(() => {
    return allTeachers.filter((t) => {
      const roles = Array.isArray(t.roles) ? t.roles : [];
      return (roles.includes('teacher') || roles.length === 0) && !currentTeacherIds.has(t.id);
    });
  }, [allTeachers, currentTeacherIds]);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return availableTeachers.slice(0, 6);
    const normalized = searchQuery.trim().toLowerCase();
    return availableTeachers.filter((t) => t.fullName.toLowerCase().includes(normalized));
  }, [availableTeachers, searchQuery]);

  const syncTeachers = async (updatedIds: Set<string>) => {
    const updatedArray = Array.from(updatedIds);
    const previousIds = new Set(classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []));
    const currentAllowances = { ...((classData as any).customTeacherAllowances || {}) };
    
    // Build updated allowances: keep existing + add new teachers with default value
    const updatedAllowances: Record<string, number> = {};
    const defaultAllowance = classData.tuitionPerSession || 0;
    
    updatedArray.forEach((teacherId) => {
      // If teacher already has an allowance entry, keep it
      if (currentAllowances.hasOwnProperty(teacherId) && 
          currentAllowances[teacherId] !== null && 
          currentAllowances[teacherId] !== undefined) {
        updatedAllowances[teacherId] = currentAllowances[teacherId];
      } else {
        // New teacher: add with default allowance
        updatedAllowances[teacherId] = defaultAllowance;
      }
    });
    
    // IMPORTANT: Also keep allowances for removed teachers (for history tracking)
    Object.keys(currentAllowances).forEach((teacherId) => {
      // If teacher was removed but has an allowance entry, keep it for history
      if (!updatedArray.includes(teacherId) && 
          currentAllowances[teacherId] !== null && 
          currentAllowances[teacherId] !== undefined) {
        updatedAllowances[teacherId] = currentAllowances[teacherId];
      }
    });

    return {
      teacherIds: updatedArray,
      customTeacherAllowances: updatedAllowances,
    };
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    const newIds = new Set(currentTeacherIds);
    newIds.delete(teacherId);
    setCurrentTeacherIds(newIds);

    setLoading(true);
    try {
      const updateData = await syncTeachers(newIds);
      await updateClass(classId, updateData);
      toast.success('Đã gỡ gia sư khỏi lớp');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể gỡ gia sư khỏi lớp: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (teacherId: string) => {
    const newIds = new Set(currentTeacherIds);
    newIds.add(teacherId);
    setCurrentTeacherIds(newIds);

    setLoading(true);
    try {
      const updateData = await syncTeachers(newIds);
      await updateClass(classId, updateData);
      setSearchQuery('');
      toast.success('Đã thêm gia sư vào lớp');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể thêm gia sư vào lớp: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const currentTeachers = teachers.filter((t) => currentTeacherIds.has(t.id));

  return (
    <div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <h4 style={{ marginBottom: 'var(--spacing-2)', fontSize: '1rem', fontWeight: '600' }}>
          Gia sư đang dạy lớp
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          {currentTeachers.length > 0 ? (
            currentTeachers.map((teacher) => (
              <div
                key={teacher.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-2)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <span>{teacher.fullName}</span>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleRemoveTeacher(teacher.id)}
                  disabled={loading}
                  title="Gỡ khỏi lớp"
                >
                  Xóa
                </button>
              </div>
            ))
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Chưa có gia sư nào trong lớp.</p>
          )}
        </div>
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <h4 style={{ marginBottom: 'var(--spacing-2)', fontSize: '1rem', fontWeight: '600' }}>
          Thêm gia sư mới
        </h4>
        <div style={{ position: 'relative' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nhập tên gia sư ..."
            style={{
              width: '100%',
              padding: 'var(--spacing-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
            }}
          />
          {searchQuery && filteredTeachers.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 'var(--spacing-1)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {filteredTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => handleAddTeacher(teacher.id)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-2)',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  {teacher.fullName}
                </button>
              ))}
            </div>
          )}
          {searchQuery && filteredTeachers.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 'var(--spacing-1)',
                padding: 'var(--spacing-2)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: '0.875rem',
                color: 'var(--muted)',
              }}
            >
              Không tìm thấy gia sư phù hợp.
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose} disabled={loading}>
          Đóng
        </button>
      </div>
    </div>
  );
}

// Edit Schedule Modal Component
function EditScheduleModal({
  classId,
  classData,
  onSuccess,
  onClose,
}: {
  classId: string;
  classData: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [scheduleItems, setScheduleItems] = useState<Array<{ day: string; time: string }>>(
    classData.schedule || []
  );
  const [loading, setLoading] = useState(false);

  const daysOfWeek = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  const handleAddItem = () => {
    setScheduleItems([...scheduleItems, { day: 'Thứ Hai', time: '18:00-20:00' }]);
  };

  const handleRemoveItem = (index: number) => {
    setScheduleItems(scheduleItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: 'day' | 'time', value: string) => {
    const updated = [...scheduleItems];
    updated[index] = { ...updated[index], [field]: value };
    setScheduleItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Format schedule items correctly: { day, time: "HH:mm-HH:mm" }
      const formattedSchedule = scheduleItems
        .filter((item) => item.day && item.time)
        .map((item) => {
          // Ensure time is in format "HH:mm-HH:mm"
          const [startTime, endTime] = item.time ? item.time.split('-') : ['18:00', '20:00'];
          return {
            day: item.day,
            time: `${startTime}-${endTime}`,
          };
        });
      
      await updateClass(classId, { schedule: formattedSchedule });
      toast.success('Đã cập nhật lịch học');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể cập nhật lịch học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Lịch học hiện tại
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          {scheduleItems.length > 0 ? (
            scheduleItems.map((item, index) => {
              const [startTime, endTime] = item.time ? item.time.split('-') : ['18:00', '20:00'];
              return (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: 'var(--spacing-2)',
                    alignItems: 'center',
                  }}
                >
                  <select
                    value={item.day}
                    onChange={(e) => handleUpdateItem(index, 'day', e.target.value)}
                    required
                    style={{
                      flex: 1,
                      padding: 'var(--spacing-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    {daysOfWeek.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleUpdateItem(index, 'time', `${e.target.value}-${endTime}`)}
                    required
                    style={{
                      width: '120px',
                      padding: 'var(--spacing-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <span>-</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleUpdateItem(index, 'time', `${startTime}-${e.target.value}`)}
                    required
                    style={{
                      width: '120px',
                      padding: 'var(--spacing-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => handleRemoveItem(index)}
                  >
                    Xóa
                  </button>
                </div>
              );
            })
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Chưa có lịch học</p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={handleAddItem}
          style={{ marginTop: 'var(--spacing-2)' }}
        >
          + Thêm lịch học
        </button>
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

// Edit Class Modal Component
function EditClassModal({
  isOpen,
  onClose,
  classData,
  teachers,
  classTeachers,
  categories,
  onSave,
  onOpenTeacherModal,
}: {
  isOpen: boolean;
  onClose: () => void;
  classData: any;
  teachers: any[];
  classTeachers: any[];
  categories: any[];
  onSave: () => void;
  onOpenTeacherModal?: () => void;
}) {
  const [formData, setFormData] = useState({
    name: classData.name || '',
    type: classData.type || '',
    status: classData.status || 'running',
    maxStudents: classData.maxStudents || 15,
    tuitionPerSession: classData.tuitionPerSession || 0,
    scaleAmount: classData.scaleAmount || 0,
    maxAllowancePerSession: classData.maxAllowancePerSession || 0,
    studentTuitionPerSession: classData.studentTuitionPerSession || 0,
    tuitionPackageTotal: classData.tuitionPackageTotal || 0,
    tuitionPackageSessions: classData.tuitionPackageSessions || '' as number | '',
  });
  const [loading, setLoading] = useState(false);

  // Use classTeachers prop if available, otherwise calculate from classData and all teachers
  const currentClassTeachers = useMemo(() => {
    // Prefer the prop if it's provided (it's calculated from all teachers in parent component)
    if (classTeachers && Array.isArray(classTeachers)) {
      return classTeachers;
    }
    // Fallback: calculate from classData and teachers prop
    if (!classData || !teachers || !Array.isArray(teachers)) return [];
    const teacherIds = classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []);
    if (!Array.isArray(teacherIds) || teacherIds.length === 0) return [];
    return teachers.filter((t: any) => teacherIds.includes(t.id));
  }, [classData, teachers, classTeachers]);

  useEffect(() => {
    if (isOpen && classData) {
      setFormData({
        name: classData.name || '',
        type: classData.type || '',
        status: classData.status || 'running',
        maxStudents: classData.maxStudents || 15,
        tuitionPerSession: classData.tuitionPerSession || 0,
        scaleAmount: classData.scaleAmount || 0,
        maxAllowancePerSession: classData.maxAllowancePerSession || 0,
        studentTuitionPerSession: classData.studentTuitionPerSession || 0,
        tuitionPackageTotal: classData.tuitionPackageTotal || 0,
        tuitionPackageSessions: classData.tuitionPackageSessions || '',
      });
    }
  }, [isOpen, classData]);

  // Calculate preview values
  const allowancePreview = useMemo(() => {
    if (formData.tuitionPerSession > 0) {
      const example = formData.tuitionPerSession * 1.2;
      return `${formData.tuitionPerSession.toLocaleString('vi-VN')} × 1.2 = ${example.toLocaleString('vi-VN')}`;
    }
    return '';
  }, [formData.tuitionPerSession]);

  const maxAllowancePreview = useMemo(() => {
    if (formData.maxAllowancePerSession > 0) {
      return `${formData.maxAllowancePerSession.toLocaleString('vi-VN')} đ`;
    }
    return 'Không giới hạn, sẽ tính theo công thức trợ cấp × hệ số × số học sinh.';
  }, [formData.maxAllowancePerSession]);

  const feePreview = useMemo(() => {
    const sessions = typeof formData.tuitionPackageSessions === 'number' ? formData.tuitionPackageSessions : 0;
    if (formData.studentTuitionPerSession > 0 && sessions > 0) {
      const total = formData.studentTuitionPerSession * sessions;
      return `Hiện tại: ${formData.studentTuitionPerSession.toLocaleString('vi-VN')} / buổi • Tổng ${total.toLocaleString('vi-VN')} cho ${sessions} buổi.`;
    }
    if (formData.tuitionPackageTotal > 0 && sessions > 0) {
      const perSession = formData.tuitionPackageTotal / sessions;
      return `Hiện tại: ${perSession.toLocaleString('vi-VN')} / buổi • Tổng ${formData.tuitionPackageTotal.toLocaleString('vi-VN')} cho ${sessions} buổi.`;
    }
    if (formData.studentTuitionPerSession > 0) {
      return `Hiện tại: ${formData.studentTuitionPerSession.toLocaleString('vi-VN')} / buổi`;
    }
    return 'Tự động = Tổng tiền / Số buổi.';
  }, [formData.studentTuitionPerSession, formData.tuitionPackageTotal, formData.tuitionPackageSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.type.trim()) {
      toast.warning('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      // Calculate studentTuitionPerSession if needed
      let finalStudentTuitionPerSession = formData.studentTuitionPerSession;
      const sessions = typeof formData.tuitionPackageSessions === 'number' ? formData.tuitionPackageSessions : 0;
      if (formData.tuitionPackageTotal > 0 && sessions > 0 && formData.studentTuitionPerSession === 0) {
        finalStudentTuitionPerSession = Math.round(formData.tuitionPackageTotal / sessions);
      } else if (sessions > 0 && formData.studentTuitionPerSession > 0 && formData.tuitionPackageTotal === 0) {
        // Recalculate total if unit is set
        const recalculatedTotal = Math.round(formData.studentTuitionPerSession * sessions);
        setFormData((prev) => ({ ...prev, tuitionPackageTotal: recalculatedTotal }));
      }

      await updateClass(classData.id, {
        name: formData.name.trim(),
        type: formData.type.trim(),
        status: formData.status,
        maxStudents: formData.maxStudents,
        tuitionPerSession: formData.tuitionPerSession,
        scaleAmount: formData.scaleAmount,
        maxAllowancePerSession: formData.maxAllowancePerSession > 0 ? formData.maxAllowancePerSession : null,
        studentTuitionPerSession: finalStudentTuitionPerSession,
        tuitionPackageTotal: formData.tuitionPackageTotal,
        tuitionPackageSessions: typeof formData.tuitionPackageSessions === 'number' ? formData.tuitionPackageSessions : (formData.tuitionPackageSessions === '' ? 0 : Number(formData.tuitionPackageSessions)),
      });
      toast.success('Đã cập nhật lớp học');
      onSave();
    } catch (error: any) {
      toast.error('Không thể cập nhật lớp học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Chỉnh sửa lớp học"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label htmlFor="editClassName" className="form-label">
            Tên lớp *
          </label>
          <input
            type="text"
            id="editClassName"
            className="form-control"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Nhập tên lớp"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label htmlFor="editClassType" className="form-label">
              Phân loại *
            </label>
            <select
              id="editClassType"
              className="form-control"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <option value="">Chọn phân loại</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="editClassStatus" className="form-label">
              Trạng thái *
            </label>
            <select
              id="editClassStatus"
              className="form-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'running' | 'stopped' })}
              required
            >
              <option value="running">Đang hoạt động</option>
              <option value="stopped">Đã dừng</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label className="form-label">
            Gia sư phụ trách
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            {currentClassTeachers.length === 0 ? (
              <div style={{ padding: 'var(--spacing-2)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: 'var(--font-size-sm)', color: 'var(--muted)', textAlign: 'center' }}>
                Chưa có gia sư nào
              </div>
            ) : (
              <div style={{ 
                padding: 'var(--spacing-2)', 
                background: 'var(--bg-secondary)', 
                borderRadius: 'var(--radius)', 
                border: '1px solid var(--border)',
                maxHeight: '150px',
                overflowY: 'auto'
              }}>
                {currentClassTeachers.map((teacher: any, index: number) => (
                  <div 
                    key={teacher.id}
                    style={{
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text)',
                      borderBottom: index < currentClassTeachers.length - 1 ? '1px solid var(--border)' : 'none'
                    }}
                  >
                    {teacher.fullName || teacher.name || teacher.id}
                  </div>
                ))}
              </div>
            )}
            {onOpenTeacherModal && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenTeacherModal();
                }}
                style={{ alignSelf: 'flex-start' }}
              >
                Chỉnh sửa danh sách
              </button>
            )}
          </div>
          <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
            Nhấn "Chỉnh sửa danh sách" để thêm/xóa gia sư phụ trách
          </small>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label htmlFor="editClassMaxStudents" className="form-label">
            Số học sinh tối đa
          </label>
          <input
            type="number"
            id="editClassMaxStudents"
            className="form-control"
            value={formData.maxStudents}
            onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value, 10) || 15 })}
            min="1"
            placeholder="15"
          />
        </div>

        {/* Tuition Section */}
        <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 'var(--spacing-3)' }}>
          <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)' }}>Trợ cấp giáo viên</h4>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="editClassTuitionPerSession" className="form-label" title="Số tiền giáo viên nhận cho mỗi buổi theo hệ số">
              Trợ cấp / Hệ số (VND) *
            </label>
            <CurrencyInput
              id="editClassTuitionPerSession"
              className="form-control"
              value={formData.tuitionPerSession}
              onChange={(value) => {
                setFormData({ ...formData, tuitionPerSession: value });
              }}
              placeholder="Ví dụ: 150000"
              required
            />
            {allowancePreview && (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
                {allowancePreview}
              </div>
            )}
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="editClassScaleAmount" className="form-label" title="Tiền scale cộng thêm cho mỗi buổi">
              Tiền scale (VND)
            </label>
            <CurrencyInput
              id="editClassScaleAmount"
              className="form-control"
              value={formData.scaleAmount}
              onChange={(value) => {
                setFormData({ ...formData, scaleAmount: value });
              }}
              placeholder="Ví dụ: 50000"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="editClassMaxAllowance" className="form-label" title="Mức trần trợ cấp cho mỗi buổi học">
              Trợ cấp tối đa (VND)
            </label>
            <CurrencyInput
              id="editClassMaxAllowance"
              className="form-control"
              value={formData.maxAllowancePerSession > 0 ? formData.maxAllowancePerSession : 0}
              onChange={(value) => {
                setFormData({ ...formData, maxAllowancePerSession: value || 0 });
              }}
              placeholder="Bỏ trống nếu không giới hạn"
            />
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
              {maxAllowancePreview}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 'var(--spacing-3)' }}>
          <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)' }}>Học phí học sinh</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="editClassTuitionPackageTotal" className="form-label" title="Tổng học phí mặc định cho gói buổi học">
                Tổng tiền học phí (VND)
              </label>
              <CurrencyInput
                id="editClassTuitionPackageTotal"
                className="form-control"
                value={formData.tuitionPackageTotal}
                onChange={(total) => {
                  setFormData((prev) => {
                    // Auto-calculate studentTuitionPerSession if sessions > 0
                    const newData = { ...prev, tuitionPackageTotal: total };
                    const sessions = typeof prev.tuitionPackageSessions === 'number' ? prev.tuitionPackageSessions : 0;
                    if (sessions > 0 && total > 0) {
                      newData.studentTuitionPerSession = Math.round(total / sessions);
                    }
                    return newData;
                  });
                }}
                placeholder="Ví dụ: 2000000"
              />
            </div>
            <div className="form-group">
              <label htmlFor="editClassTuitionPackageSessions" className="form-label" title="Số buổi trong gói học phí">
                Số buổi
              </label>
              <input
                type="number"
                id="editClassTuitionPackageSessions"
                className="form-control"
                value={formData.tuitionPackageSessions}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFormData((prev) => ({ ...prev, tuitionPackageSessions: '' }));
                  } else {
                    const sessions = parseInt(value, 10);
                    if (!isNaN(sessions) && sessions >= 0) {
                      setFormData((prev) => {
                        const newData = { ...prev, tuitionPackageSessions: sessions };
                        // Auto-calculate studentTuitionPerSession if total > 0
                        if (sessions > 0 && prev.tuitionPackageTotal > 0) {
                          newData.studentTuitionPerSession = Math.round(prev.tuitionPackageTotal / sessions);
                        } else if (sessions > 0 && prev.studentTuitionPerSession > 0 && prev.tuitionPackageTotal === 0) {
                          // Recalculate total if unit is set
                          newData.tuitionPackageTotal = Math.round(prev.studentTuitionPerSession * sessions);
                        }
                        return newData;
                      });
                    }
                  }
                }}
                min="0"
                step="1"
                placeholder="Ví dụ: 10"
              />
            </div>
            <div className="form-group">
              <label htmlFor="editClassStudentTuitionPerSession" className="form-label" title="Học phí mỗi buổi">
                Học phí mỗi buổi (VND)
              </label>
              <CurrencyInput
                id="editClassStudentTuitionPerSession"
                className="form-control"
                value={formData.studentTuitionPerSession}
                onChange={(unit) => {
                  setFormData((prev) => {
                    const newData = { ...prev, studentTuitionPerSession: unit };
                    // Recalculate total if sessions > 0
                    const sessions = typeof prev.tuitionPackageSessions === 'number' ? prev.tuitionPackageSessions : 0;
                    if (sessions > 0 && unit > 0) {
                      newData.tuitionPackageTotal = Math.round(unit * sessions);
                    }
                    return newData;
                  });
                }}
                placeholder="Tự động từ tổng tiền / số buổi"
              />
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
                {feePreview}
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Đang cập nhật...' : 'Cập nhật'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Student Modal Component (in class context)
function EditStudentModal({
  isOpen,
  onClose,
  student,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    fullName: student.fullName || '',
    birthYear: student.birthYear || new Date().getFullYear() - 15,
    school: student.school || '',
    province: student.province || '',
    email: student.email || '',
    gender: (student.gender || 'male') as 'male' | 'female',
    parentName: student.parentName || '',
    parentPhone: student.parentPhone || '',
    status: (student.status || 'active') as 'active' | 'inactive',
    goal: student.goal || '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && student) {
      setFormData({
        fullName: student.fullName || '',
        birthYear: student.birthYear || new Date().getFullYear() - 15,
        school: student.school || '',
        province: student.province || '',
        email: student.email || '',
        gender: (student.gender || 'male') as 'male' | 'female',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        status: (student.status || 'active') as 'active' | 'inactive',
        goal: student.goal || '',
      });
    }
  }, [isOpen, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.warning('Vui lòng nhập tên học sinh');
      return;
    }

    setLoading(true);
    try {
      await updateStudent(student.id, {
        fullName: formData.fullName.trim(),
        birthYear: formData.birthYear,
        school: formData.school.trim(),
        province: formData.province.trim(),
        email: formData.email.trim() || undefined,
        gender: formData.gender,
        parentName: formData.parentName.trim(),
        parentPhone: formData.parentPhone.trim(),
        status: formData.status,
        goal: formData.goal.trim() || undefined,
      });
      toast.success('Đã cập nhật thông tin học sinh');
      onSave();
    } catch (error: any) {
      toast.error('Không thể cập nhật học sinh: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Chỉnh sửa học sinh"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label htmlFor="editStudentFullName" className="form-label">
            Họ và tên *
          </label>
          <input
            type="text"
            id="editStudentFullName"
            className="form-control"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
            placeholder="Nhập họ và tên"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label htmlFor="editStudentBirthYear" className="form-label">
              Năm sinh
            </label>
            <input
              type="number"
              id="editStudentBirthYear"
              className="form-control"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: parseInt(e.target.value, 10) || new Date().getFullYear() - 15 })}
              min="1990"
              max={new Date().getFullYear()}
              placeholder="2008"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editStudentGender" className="form-label">
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

          <div className="form-group">
            <label htmlFor="editStudentStatus" className="form-label">
              Trạng thái *
            </label>
            <select
              id="editStudentStatus"
              className="form-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              required
            >
              <option value="active">Đang học</option>
              <option value="inactive">Tạm dừng</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
          <div className="form-group">
            <label htmlFor="editStudentSchool" className="form-label">
              Trường học
            </label>
            <input
              type="text"
              id="editStudentSchool"
              className="form-control"
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              placeholder="Tên trường"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editStudentProvince" className="form-label">
              Tỉnh thành
            </label>
            <input
              type="text"
              id="editStudentProvince"
              className="form-control"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              placeholder="Tỉnh/Thành phố"
            />
          </div>

          <div className="form-group">
            <label htmlFor="editStudentEmail" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="editStudentEmail"
              className="form-control"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
        </div>

        <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 'var(--spacing-3)' }}>
          <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)' }}>Thông tin phụ huynh</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="editStudentParentName" className="form-label">
                Tên phụ huynh
              </label>
              <input
                type="text"
                id="editStudentParentName"
                className="form-control"
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                placeholder="Tên phụ huynh"
              />
            </div>
            <div className="form-group">
              <label htmlFor="editStudentParentPhone" className="form-label">
                SĐT phụ huynh
              </label>
              <input
                type="tel"
                id="editStudentParentPhone"
                className="form-control"
                value={formData.parentPhone}
                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                placeholder="Số điện thoại"
              />
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label htmlFor="editStudentGoal" className="form-label">
            Mục tiêu học tập
          </label>
          <textarea
            id="editStudentGoal"
            className="form-control"
            value={formData.goal}
            onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
            rows={3}
            placeholder="Mục tiêu học tập của học sinh"
          />
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Đang cập nhật...' : 'Cập nhật'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Move Student Modal Component
function MoveStudentModal({
  isOpen,
  onClose,
  student,
  currentClassId,
  currentClassName,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  currentClassId: string;
  currentClassName: string;
  onSuccess: () => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Fetch all classes except current class
      fetchClasses().then((data) => {
        const otherClasses = data.filter((c) => c.id !== currentClassId);
        setClasses(otherClasses);
      });
      setSelectedClassId('');
    }
  }, [isOpen, currentClassId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toast.warning('Vui lòng chọn lớp mới');
      return;
    }

    if (selectedClassId === '__REMOVE__') {
      // Remove student from class
      if (!window.confirm(`Bạn có chắc chắn muốn gỡ "${student.fullName}" khỏi lớp "${currentClassName}"?`)) {
        return;
      }

      setLoading(true);
      try {
        await removeStudentFromClass(currentClassId, student.id, true);
        toast.success('Đã gỡ học sinh khỏi lớp');
        onSuccess();
      } catch (error: any) {
        toast.error('Không thể gỡ học sinh: ' + (error.response?.data?.error || error.message));
      } finally {
        setLoading(false);
      }
      return;
    }

    const targetClass = classes.find((c) => c.id === selectedClassId);
    if (!targetClass) {
      toast.error('Không tìm thấy lớp đích');
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn chuyển "${student.fullName}" từ lớp "${currentClassName}" sang lớp "${targetClass.name}"?\n\nHọc sinh sẽ được hoàn trả số buổi còn lại từ lớp cũ.`)) {
      return;
    }

    setLoading(true);
    try {
      await moveStudentToClass(currentClassId, student.id, selectedClassId, true);
      toast.success(`Đã chuyển học sinh sang lớp "${targetClass.name}"`);
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể chuyển học sinh: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Chuyển học sinh sang lớp khác"
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label className="form-label">
            Học sinh: <strong>{student.fullName}</strong>
          </label>
        </div>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
          <label htmlFor="moveStudentNewClass" className="form-label">
            Chuyển sang lớp *
          </label>
          <select
            id="moveStudentNewClass"
            className="form-control"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            required
          >
            <option value="">-- Chọn lớp --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} ({cls.type})
              </option>
            ))}
            <option value="__REMOVE__">-- Gỡ khỏi lớp --</option>
          </select>
        </div>
        <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Đang xử lý...' : 'Chuyển lớp'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Teacher Allowance Modal Component
function TeacherAllowanceModal({
  classId,
  classData,
  teacher,
  onSuccess,
  onClose,
}: {
  classId: string;
  classData: any;
  teacher: any;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const defaultSalary = classData?.tuitionPerSession || 0;
  const customAllowances = (classData as any)?.customTeacherAllowances || {};
  const currentSalary = customAllowances[teacher.id] ?? defaultSalary;

  const [salary, setSalary] = useState<number>(currentSalary);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSalary(currentSalary);
  }, [currentSalary]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Cho phép số âm (có thể là phạt hoặc trừ tiền)
    if (!Number.isFinite(salary)) {
      toast.error('Vui lòng nhập trợ cấp hợp lệ');
      return;
    }

    setLoading(true);
    try {
      const allowances = { ...customAllowances };

      if (salary === defaultSalary) {
        delete allowances[teacher.id];
      } else {
        allowances[teacher.id] = salary;
      }

      const payload: any = {
        customTeacherAllowances: Object.keys(allowances).length > 0 ? allowances : null,
      };

      await updateClass(classId, payload);
      toast.success('Đã cập nhật trợ cấp');
      onSuccess();
    } catch (error: any) {
      toast.error('Không thể cập nhật trợ cấp: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
        <label htmlFor="salaryInput" className="form-label">
          Trợ cấp / hệ số (VND) - {teacher.fullName}
        </label>
        <CurrencyInput
          id="salaryInput"
          className="form-control"
          value={salary}
          onChange={setSalary}
          placeholder="Nhập trợ cấp (có thể nhập số âm)"
          required
        />
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: 'var(--spacing-1)' }}>
          Trợ cấp mặc định: {formatCurrencyVND(defaultSalary)}
        </div>
      </div>
      <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
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

export default ClassDetail;
