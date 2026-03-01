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
import { useSessionFinancials } from '../hooks/useSessionFinancials';
import { toast } from '../utils/toast';
import SurveyTab from '../components/SurveyTab';
import { recordAction } from '../services/actionHistoryService';

/**
 * Class Detail Page Component
 * Shows detailed information about a specific class
 * Migrated from backup/assets/js/pages/classes.js - renderClassDetail
 */

function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

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

  // Tab state for Sessions/Surveys section
  const [activeTab, setActiveTab] = useState<'sessions' | 'surveys'>('sessions');

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
  const [headerTuitionFee, setHeaderTuitionFee] = useState<number>(0);
  const [isEditingHeaderTuitionFee, setIsEditingHeaderTuitionFee] = useState<boolean>(false);
  const [editingHeaderTuitionFeeValue, setEditingHeaderTuitionFeeValue] = useState<number>(0);
  const [isHeaderTuitionFeeManuallyEdited, setIsHeaderTuitionFeeManuallyEdited] = useState<boolean>(false);

  // State for Edit Session Modal header tuition fee
  const [editHeaderTuitionFee, setEditHeaderTuitionFee] = useState<number>(0);
  const [isEditingEditHeaderTuitionFee, setIsEditingEditHeaderTuitionFee] = useState<boolean>(false);
  const [editingEditHeaderTuitionFeeValue, setEditingEditHeaderTuitionFeeValue] = useState<number>(0);
  const [isEditHeaderTuitionFeeManuallyEdited, setIsEditHeaderTuitionFeeManuallyEdited] = useState<boolean>(false);

  // Callback to handle estimated tuition fee changes from EditSessionModal
  const handleEditEstimatedTuitionFeeChange = useCallback((fee: number) => {
    // Only update if not manually edited AND if we don't have a value from DB yet
    // This prevents estimatedTuitionFee from overriding the DB value when modal first opens
    if (!isEditHeaderTuitionFeeManuallyEdited && editHeaderTuitionFee === 0) {
      setEditHeaderTuitionFee(fee);
    }
  }, [isEditHeaderTuitionFeeManuallyEdited, editHeaderTuitionFee]);

  const fetchClassFn = useCallback(() => {
    if (!id) throw new Error('Class ID is required');
    // Include teachers in class data to avoid fetching all teachers
    return fetchClassById(id, { includeTeachers: true }).catch((error) => {
      console.error('[ClassDetail] Error fetching class:', error);
      throw error;
    });
  }, [id]);

  const { data: classData, isLoading, error, refetch: refetchClass } = useDataLoading(fetchClassFn, [id], {
    cacheKey: `class-${id}`,
    staleTime: 2 * 60 * 1000,
    allowPublicAccess: true, // Allow fetching without authentication for public class view
  });

  // Fetch students with remaining sessions - allow public access
  const fetchStudentsWithRemainingFn = useCallback(() => {
    if (!id) throw new Error('Class ID is required');
    return fetchClassStudentsWithRemaining(id).catch((error) => {
      console.error('[ClassDetail] Error fetching students with remaining:', error);
      // Return empty array if not authenticated instead of throwing
      if (error?.response?.status === 401) {
        return [];
      }
      throw error;
    });
  }, [id]);
  const { data: studentsWithRemainingData, refetch: refetchStudents } = useDataLoading(fetchStudentsWithRemainingFn, [id], {
    cacheKey: `class-students-remaining-${id}`,
    staleTime: 1 * 60 * 1000,
    allowPublicAccess: true, // Allow fetching without authentication for public class view
  });

  // Fetch sessions - allow public access
  const fetchSessionsFn = useCallback(() => {
    return fetchSessions({ classId: id }).catch((error) => {
      console.error('[ClassDetail] Error fetching sessions:', error);
      // Return empty array if not authenticated instead of throwing
      if (error?.response?.status === 401) {
        return [];
      }
      throw error;
    });
  }, [id]);
  const { data: sessionsData, refetch: refetchSessions } = useDataLoading(fetchSessionsFn, [id], {
    cacheKey: `sessions-class-${id}`,
    staleTime: 1 * 60 * 1000,
    allowPublicAccess: true, // Allow fetching without authentication for public class view
  });

  // Optimistic updates state for sessions
  const [optimisticSessions, setOptimisticSessions] = useState<any[]>([]);
  const [optimisticOperations, setOptimisticOperations] = useState<Map<string, 'create' | 'update' | 'delete'>>(new Map());

  // Sync optimistic sessions with server data
  useEffect(() => {
    if (sessionsData && Array.isArray(sessionsData)) {
      // If no pending operations, sync with server data
      if (optimisticOperations.size === 0) {
        setOptimisticSessions(sessionsData);
      }
    }
  }, [sessionsData]);

  // Use optimistic sessions if available, otherwise use server data
  const sessions = optimisticSessions.length > 0 ? optimisticSessions : (Array.isArray(sessionsData) ? sessionsData : []);

  // Fetch class detail data (teacher stats) - must be declared before refetch callback
  const fetchClassDetailDataFn = useCallback(() => {
    if (!id) throw new Error('Class ID is required');
    return fetchClassDetailData(id).catch((error) => {
      console.error('[ClassDetail] Error fetching class detail data:', error);
      if (error?.response?.status === 401) {
        return { teacherStats: [] };
      }
      throw error;
    });
  }, [id]);

  const { data: classDetailData, refetch: refetchClassDetailData } = useDataLoading(fetchClassDetailDataFn, [id], {
    cacheKey: `class-detail-data-${id}`,
    staleTime: 1 * 60 * 1000,
    enabled: isAuthenticated && !!classData && !isLoading, // Only fetch if authenticated
  });

  const refetch = useCallback(() => {
    refetchClass();
    refetchStudents();
    refetchSessions();
    if (refetchClassDetailData) {
      refetchClassDetailData(); // Also refetch teacher stats to update unpaidAmount
    }
    // Clear optimistic operations after refetch
    setOptimisticOperations(new Map());
  }, [refetchClass, refetchStudents, refetchSessions, refetchClassDetailData]);

  // Fetch all teachers only when needed (for EditTeacherModal) - lazy loading
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [isLoadingAllTeachers, setIsLoadingAllTeachers] = useState(false);

  const loadAllTeachers = useCallback(async () => {
    if (allTeachers.length > 0) return; // Already loaded
    setIsLoadingAllTeachers(true);
    try {
      const teachers = await fetchTeachers();
      setAllTeachers(teachers);
    } catch (error) {
      console.error('Failed to load all teachers:', error);
    } finally {
      setIsLoadingAllTeachers(false);
    }
  }, [allTeachers.length]);

  // Load all teachers when EditClassModal opens (needed for teacher search and display)
  useEffect(() => {
    if (editClassModalOpen && allTeachers.length === 0) {
      loadAllTeachers();
    }
  }, [editClassModalOpen, allTeachers.length, loadAllTeachers]);

  // Fetch categories for type dropdown - only if authenticated (not needed for public view)
  const { data: categoriesData } = useDataLoading(
    () => {
      return fetchCategories().catch((error) => {
        console.error('[ClassDetail] Error fetching categories:', error);
        if (error?.response?.status === 401) {
          return [];
        }
        throw error;
      });
    },
    [],
    {
      cacheKey: 'categories-for-class-detail',
      staleTime: 5 * 60 * 1000,
      enabled: isAuthenticated, // Only fetch if authenticated
    }
  );

  // Fetch students to get enrolled students - only if authenticated
  const { data: studentsData } = useDataLoading(() => {
    return fetchStudents().catch((error) => {
      console.error('[ClassDetail] Error fetching students:', error);
      if (error?.response?.status === 401) {
        return [];
      }
      throw error;
    });
  }, [], {
    cacheKey: 'students-for-class-detail',
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated, // Only fetch if authenticated
  });

  const students = Array.isArray(studentsData) ? studentsData : [];
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  // Get class teachers from classData (included in API response via includeTeachers option)
  // This avoids fetching all teachers just to filter
  const classTeachers = useMemo(() => {
    if (!classData) {
      return [];
    }
    // Use teachers from classData if available (from includeTeachers option)
    if ((classData as any).teachers && Array.isArray((classData as any).teachers)) {
      return (classData as any).teachers;
    }
    // Fallback: if teachers not included, return empty array
    return [];
  }, [classData]);

  // Calculate available teachers (for EditTeacherModal) - only when allTeachers is loaded
  const availableTeachers = useMemo(() => {
    if (allTeachers.length === 0) return [];
    if (!classData) return allTeachers;
    const currentTeacherIds = new Set(classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []));
    return allTeachers.filter((t) => {
      const roles = Array.isArray(t.roles) ? t.roles : [];
      return (roles.includes('teacher') || roles.length === 0) && !currentTeacherIds.has(t.id);
    });
  }, [allTeachers, classData]);

  // Permission checks - only allow actions if authenticated
  const isAdmin = isAuthenticated && hasRole('admin');
  const canEdit = isAuthenticated && isAdmin;
  const canManage = isAuthenticated && (isAdmin || hasRole('accountant') || userHasStaffRole('cskh_sale', currentUser, classTeachers));
  const canManageStudents = canManage;
  const canManageTeacherList = canManage;
  // Show financial details only if authenticated and admin
  const showClassFinancialDetails = isAuthenticated && isAdmin;

  // Payment status management permissions
  const userStaffRoles = isAuthenticated ? getUserStaffRoles(currentUser, classTeachers) : [];
  const hasCskhPrivileges = isAuthenticated && userHasStaffRole('cskh_sale', currentUser, classTeachers);
  const canManagePaymentStatus = isAuthenticated && (isAdmin || hasRole('accountant') || hasCskhPrivileges);

  // Session management permissions
  // Teacher role hoặc staff role 'teacher' đều có thể tạo/chỉnh sửa session
  const isTutor = isAuthenticated && (currentUser?.role === 'teacher' || userHasStaffRole('teacher', currentUser, classTeachers));
  const canShowDelete = canManage && !isTutor;
  const canSelectSessions = canManage || hasCskhPrivileges;
  const canBulkUpdateStatus = isAuthenticated && (isAdmin || hasRole('accountant') || hasCskhPrivileges);
  // Teacher (gia sư) có thể tạo và chỉnh sửa session
  const canCreateSession = isAuthenticated && (isAdmin || isTutor || hasRole('accountant') || hasCskhPrivileges);
  const canEditSession = isAuthenticated && (isAdmin || isTutor || hasRole('accountant') || hasCskhPrivileges);
  // Chỉ admin và accountant mới có thể chỉnh sửa allowance thủ công
  const canEditAllowanceManually = isAuthenticated && (isAdmin || hasRole('accountant'));
  // Teacher (gia sư) có thể chỉnh sửa lịch học
  const canEditSchedule = isAuthenticated && (isAdmin || isTutor || hasRole('accountant') || hasCskhPrivileges);
  // Teacher (gia sư) có thể quản lý khảo sát
  const canManageSurveys = isAuthenticated && (isAdmin || isTutor || hasRole('accountant') || hasCskhPrivileges);
  // Chỉ admin mới có thể xóa khảo sát
  const canDeleteSurveys = isAuthenticated && isAdmin;

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

  // Filter sessions by selected month and sort by created_at (newest first)
  const monthSessions = useMemo(() => {
    const filtered = sessions.filter((s) => {
      if (!s.date) return false;
      const sessionMonth = s.date.slice(0, 7); // YYYY-MM
      return sessionMonth === selectedMonth;
    });

    // Sort by created_at (newest first), then by date and time
    return filtered.sort((a, b) => {
      // First sort by created_at (newest first)
      const aCreatedAt = (a as any).createdAt || (a as any).created_at || '';
      const bCreatedAt = (b as any).createdAt || (b as any).created_at || '';
      if (aCreatedAt && bCreatedAt) {
        return bCreatedAt.localeCompare(aCreatedAt);
      }
      // If no created_at, sort by date (newest first)
      const aDate = a.date || '';
      const bDate = b.date || '';
      if (aDate !== bDate) {
        return bDate.localeCompare(aDate);
      }
      // If same date, sort by start_time (newest first)
      const aTime = (a as any).start_time || (a as any).startTime || '';
      const bTime = (b as any).start_time || (b as any).startTime || '';
      if (aTime !== bTime) {
        return bTime.localeCompare(aTime);
      }
      // If same date and time, sort by id (newest first)
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [sessions, selectedMonth]);

  // Callback to add session optimistically
  const handleSessionCreated = useCallback((newSession: any) => {
    setOptimisticSessions((prev) => {
      const updated = [...prev, newSession];
      // Sort by created_at (newest first), then by date and time
      return updated.sort((a, b) => {
        // First sort by created_at (newest first)
        const aCreatedAt = a.createdAt || a.created_at || '';
        const bCreatedAt = b.createdAt || b.created_at || '';
        if (aCreatedAt && bCreatedAt) {
          return bCreatedAt.localeCompare(aCreatedAt);
        }
        // If no created_at, sort by date (newest first)
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        // If same date, sort by start_time (newest first)
        const timeA = a.start_time || a.startTime || '';
        const timeB = b.start_time || b.startTime || '';
        if (timeA !== timeB) {
          return timeB.localeCompare(timeA);
        }
        // If same date and time, sort by id (newest first)
        return (b.id || '').localeCompare(a.id || '');
      });
    });
  }, []);

  // Callback to update session optimistically
  const handleSessionUpdated = useCallback((updatedSession: any) => {
    setOptimisticSessions((prev) => {
      return prev.map((s) => (s.id === updatedSession.id ? updatedSession : s));
    });
  }, []);

  // Get teacher names
  // classTeachers is now computed from classData.teachers (included in API response)

  // Get enrolled students with remaining sessions
  const enrolledStudents = useMemo(() => {
    if (!classData) return [];

    // If we have students with remaining data, use that
    if (studentsWithRemainingData && Array.isArray(studentsWithRemainingData) && studentsWithRemainingData.length > 0) {
      return studentsWithRemainingData.map((item) => {
        const student = item.student || {};
        const studentData = item.student || {};
        const walletBalance = Number(studentData.wallet_balance ?? (studentData as any).walletBalance ?? 0);
        return {
          id: studentData.id,
          fullName: studentData.full_name || '',
          birthYear: studentData.birth_year || undefined,
          province: studentData.province || undefined,
          status: studentData.status || 'active',
          remainingSessions: item.remainingSessions || item.studentClass?.remaining_sessions || 0,
          totalAttended: item.totalAttended || item.studentClass?.total_attended_sessions || 0,
          tuitionPerSession: item.tuitionPerSession || 0,
          wallet_balance: walletBalance,
          walletBalance: walletBalance,
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

  // Calculate initial estimated tuition fee for header display
  // Must be after isAdmin and enrolledStudents are declared
  useEffect(() => {
    if (addSessionModalOpen && isAdmin && enrolledStudents.length > 0) {
      let initialFee = 0;
      enrolledStudents.forEach((student) => {
        const hasRemaining = (student.remainingSessions || 0) > 0;
        // Default: students with remaining sessions are "present"
        if (hasRemaining) {
          const studentTuition = (student as any).tuitionPerSession || 0;
          initialFee += studentTuition;
        }
      });
      // Only set initial fee if not manually edited
      if (!isHeaderTuitionFeeManuallyEdited) {
        setHeaderTuitionFee(initialFee);
      }
    } else if (!addSessionModalOpen) {
      setHeaderTuitionFee(0);
      setIsHeaderTuitionFeeManuallyEdited(false);
    }
  }, [isAdmin, enrolledStudents, addSessionModalOpen, isHeaderTuitionFeeManuallyEdited]);

  // Load tuition fee from session when opening Edit Session Modal or when editingSession changes
  useEffect(() => {
    if (editSessionModalOpen && isAdmin && editingSession) {
      // Get tuition fee from session (check both camelCase and snake_case)
      const sessionTuitionFee = (editingSession as any).tuitionFee !== undefined && (editingSession as any).tuitionFee !== null
        ? Number((editingSession as any).tuitionFee)
        : (editingSession as any).tuition_fee !== undefined && (editingSession as any).tuition_fee !== null
          ? Number((editingSession as any).tuition_fee)
          : 0;

      const newTuitionFee = sessionTuitionFee > 0 ? sessionTuitionFee : 0;

      // Always sync with editingSession to ensure UI matches DB
      // When loading from DB, set the flag to prevent estimatedTuitionFee from overriding
      // This ensures the DB value takes precedence over calculated estimate
      setEditHeaderTuitionFee((prev) => {
        // Only update if value actually changed to avoid unnecessary re-renders
        if (prev !== newTuitionFee) {
          // Set flag to prevent estimatedTuitionFee from overriding DB value
          // But only if we have a valid value from DB (newTuitionFee > 0)
          if (newTuitionFee > 0) {
            setIsEditHeaderTuitionFeeManuallyEdited(true);
          }
          return newTuitionFee;
        }
        return prev;
      });
    } else if (!editSessionModalOpen) {
      setEditHeaderTuitionFee(0);
      setIsEditingEditHeaderTuitionFee(false);
      setIsEditHeaderTuitionFeeManuallyEdited(false);
    }
  }, [isAdmin, editingSession, editSessionModalOpen]);

  // Check if current user is a teacher viewer
  const isTeacherViewer = currentUser?.role === 'teacher';

  // Use teacher stats from backend (all calculations done in backend)
  const teacherStats = useMemo(() => {
    if (classDetailData) {
      // Map backend data to match frontend structure
      return classDetailData.teacherStats.map((stat) => {
        const teacher = classTeachers.find((t) => t.id === stat.teacher.id) || stat.teacher;
        return {
          teacher,
          allowance: stat.allowance,
          unpaidAmount: stat.unpaidAmount || 0,
        };
      });
    }
    // Fallback: calculate locally if backend data not available (should not happen in production)
    const customAllowances = (classData as any)?.customTeacherAllowances || {};
    const defaultSalary = classData?.tuitionPerSession || 0;
    // Calculate unpaid amount for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return classTeachers.map((teacher) => {
      const teacherSessions = sessions.filter((s) => (s as any).teacherId === teacher.id || s.teacher_id === teacher.id);
      const unpaidAmount = teacherSessions
        .filter((s) => {
          const isUnpaid = ((s as any).paymentStatus || s.payment_status || 'unpaid') === 'unpaid';
          const sessionDate = s.date ? new Date(s.date) : null;
          const isWithin30Days = sessionDate && sessionDate >= thirtyDaysAgo;
          return isUnpaid && isWithin30Days;
        })
        .reduce((sum, s) => sum + ((s as any).allowanceAmount || s.allowance_amount || 0), 0);
      const allowance = customAllowances[teacher.id] ?? defaultSalary;
      return {
        teacher,
        allowance,
        unpaidAmount,
      };
    });
  }, [classDetailData, classTeachers, sessions, classData]);

  // Log errors for debugging
  useEffect(() => {
    if (error) {
      console.error('[ClassDetail] Error loading class:', error);
    }
  }, [error]);

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
                  <span className="teacher-col-total" style={{ textAlign: 'right', justifySelf: 'end' }}>CHƯA NHẬN</span>
                </div>
              )}
              {teacherStats.map(({ teacher, allowance, unpaidAmount }) => {
                const contacts = [(teacher as any).phone, (teacher as any).email || (teacher as any).gmail].filter(Boolean).join(' • ');
                const teacherNameClass = isTeacherViewer ? 'teacher-col-name' : 'teacher-col-name teacher-name-link';
                return (
                  <div
                    key={teacher.id}
                    className={`teacher-row ${showClassFinancialDetails ? '' : 'teacher-row-compact'}${isTeacherViewer || !isAuthenticated ? '' : ' teacher-row-clickable'}`}
                    data-teacher-id={teacher.id}
                    onClick={(e) => {
                      // Don't navigate if clicking on allowance button, if teacher viewer, or if not authenticated
                      if (isTeacherViewer || !isAuthenticated || (e.target as HTMLElement).closest('.teacher-allowance')) {
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
                      cursor: isTeacherViewer || !isAuthenticated ? 'default' : 'pointer',
                      transition: 'background-color 0.2s ease-in-out',
                    }}
                    onMouseEnter={(e) => {
                      if (!isTeacherViewer && isAuthenticated) {
                        e.currentTarget.style.background = 'var(--bg)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isTeacherViewer && isAuthenticated) {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                        e.currentTarget.style.transform = '';
                        e.currentTarget.style.boxShadow = '';
                      }
                    }}
                  >
                    <span className={teacherNameClass} style={{ fontWeight: '500' }}>{teacher.fullName || teacher.full_name || teacher.id}</span>
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
                        <span className="teacher-col-total" style={{ fontWeight: '500', textAlign: 'right', justifySelf: 'end' }}>{formatCurrencyVND(unpaidAmount || 0)}</span>
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
            {canEditSchedule && (
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
                      {showClassFinancialDetails && (
                        <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', minWidth: '120px' }}>Còn lại</th>
                      )}
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
                            // Navigate to student detail when clicking on row (except buttons) - only if not tutor and authenticated
                            if (!isTutor && isAuthenticated) {
                              navigate(`/students/${student.id}`);
                            }
                          }}
                          style={{
                            transition: 'all 0.2s ease',
                            cursor: isTutor || !isAuthenticated ? 'default' : 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!isTutor && isAuthenticated) {
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
                          {showClassFinancialDetails && (
                            <td style={{ padding: 'var(--spacing-3)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span style={{ fontWeight: '500', color: 'var(--text)' }}>{remainingSummary}</span>
                              </div>
                            </td>
                          )}
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

                                        // Record action history
                                        try {
                                          await recordAction({
                                            entityType: 'student_class',
                                            entityId: `${student.id}_${id}`,
                                            actionType: 'delete',
                                            beforeValue: { student_id: student.id, class_id: id, student_name: student.name },
                                            description: `Xóa học sinh "${student.name}" khỏi lớp "${classData?.name || id}"`,
                                          });
                                        } catch (err) {
                                          // Silently fail - action history is not critical
                                        }

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
                    onClick={() => setAddStudentModalOpen(true)}
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
              Lịch sử & Khảo sát
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
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                gap: 'var(--spacing-2)',
                marginBottom: 'var(--spacing-4)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('sessions')}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'sessions' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === 'sessions' ? 'var(--primary)' : 'var(--muted)',
                  fontWeight: activeTab === 'sessions' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                Lịch sử buổi học
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('surveys')}
                style={{
                  padding: 'var(--spacing-2) var(--spacing-4)',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'surveys' ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeTab === 'surveys' ? 'var(--primary)' : 'var(--muted)',
                  fontWeight: activeTab === 'surveys' ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                Khảo sát
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'sessions' ? (
              <div>
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
                            const teacher = teacherId ? classTeachers.find((t) => t.id === teacherId) : null;

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
                            const canManagePaymentStatusLocal = isAdmin || hasRole('accountant') || userHasStaffRole('cskh_sale', currentUser, classTeachers);
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
                                          <span>{teacher.fullName || teacher.full_name}</span>
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
                                            const oldStatus = session.payment_status;
                                            await updateSession(session.id, {
                                              payment_status: newStatus as 'paid' | 'unpaid' | 'deposit',
                                            });

                                            // Record action history
                                            try {
                                              await recordAction({
                                                entityType: 'session',
                                                entityId: session.id,
                                                actionType: 'update',
                                                beforeValue: { ...session, payment_status: oldStatus },
                                                afterValue: { ...session, payment_status: newStatus },
                                                changedFields: { payment_status: { old: oldStatus, new: newStatus } },
                                                description: `Cập nhật trạng thái thanh toán buổi học ngày ${formatDate(session.date)} từ "${paymentStatusLabels[oldStatus || 'unpaid']}" sang "${paymentStatusLabels[newStatus]}"`,
                                              });
                                            } catch (err) {
                                              // Silently fail - action history is not critical
                                            }

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
                                          const sessionToDelete = { ...session };
                                          await deleteSession(session.id);

                                          // Record action history
                                          try {
                                            await recordAction({
                                              entityType: 'session',
                                              entityId: session.id,
                                              actionType: 'delete',
                                              beforeValue: sessionToDelete,
                                              description: `Xóa buổi học ngày ${formatDate(session.date)} của lớp ${classes.find(c => c.id === session.class_id)?.name || session.class_id}`,
                                            });
                                          } catch (err) {
                                            // Silently fail - action history is not critical
                                          }

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
                      {showClassFinancialDetails && (
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
                      )}
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
            ) : (
              <div>
                {id && <SurveyTab classId={id} canManage={canManageSurveys} canDelete={canDeleteSurveys} />}
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
        onClose={() => {
          setAddSessionModalOpen(false);
          setHeaderTuitionFee(0);
          setIsEditingHeaderTuitionFee(false);
          setIsHeaderTuitionFeeManuallyEdited(false);
        }}
        size="md"
        headerExtra={
          isAdmin ? (
            isEditingHeaderTuitionFee ? (
              <CurrencyInput
                value={editingHeaderTuitionFeeValue}
                onChange={(value) => setEditingHeaderTuitionFeeValue(value > 0 ? value : 0)}
                placeholder="Nhập học phí"
                showHint={false}
                style={{
                  width: '120px',
                  fontSize: '0.875rem',
                  marginLeft: 'var(--spacing-2)',
                  minWidth: '120px',
                  maxWidth: '150px',
                }}
                autoFocus
                onBlur={(e) => {
                  // Nếu có giá trị nhập vào thì lấy giá trị đó, còn không thì giữ nguyên giá trị cũ
                  const newValue = editingHeaderTuitionFeeValue > 0 ? editingHeaderTuitionFeeValue : headerTuitionFee;
                  setHeaderTuitionFee(newValue);
                  setIsEditingHeaderTuitionFee(false);
                  if (editingHeaderTuitionFeeValue > 0 && editingHeaderTuitionFeeValue !== headerTuitionFee) {
                    setIsHeaderTuitionFeeManuallyEdited(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const newValue = editingHeaderTuitionFeeValue > 0 ? editingHeaderTuitionFeeValue : headerTuitionFee;
                    setHeaderTuitionFee(newValue);
                    setIsEditingHeaderTuitionFee(false);
                    if (editingHeaderTuitionFeeValue > 0 && editingHeaderTuitionFeeValue !== headerTuitionFee) {
                      setIsHeaderTuitionFeeManuallyEdited(true);
                    }
                    (e.currentTarget as HTMLElement).blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingHeaderTuitionFeeValue(headerTuitionFee);
                    setIsEditingHeaderTuitionFee(false);
                    (e.currentTarget as HTMLElement).blur();
                  }
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#10b981',
                  marginLeft: 'var(--spacing-2)',
                  cursor: 'pointer',
                  padding: 'var(--spacing-1) var(--spacing-2)',
                  borderRadius: 'var(--radius)',
                  transition: 'background-color 0.2s',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingHeaderTuitionFeeValue(headerTuitionFee);
                  setIsEditingHeaderTuitionFee(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {headerTuitionFee > 0 ? formatCurrencyVND(headerTuitionFee) : 'Click để nhập học phí'}
              </span>
            )
          ) : null
        }
      >
        {id && classData && (
          <AddSessionModal
            classId={id}
            classData={classData}
            teachers={classTeachers}
            students={enrolledStudents}
            headerTuitionFee={headerTuitionFee}
            onEstimatedTuitionFeeChange={(fee) => {
              // Only update if not manually edited
              if (!isHeaderTuitionFeeManuallyEdited) {
                setHeaderTuitionFee(fee);
              }
            }}
            onSessionCreated={handleSessionCreated}
            onSuccess={() => {
              setAddSessionModalOpen(false);
              setHeaderTuitionFee(0);
              setIsEditingHeaderTuitionFee(false);
              setIsHeaderTuitionFeeManuallyEdited(false);
              refetch();
            }}
            onClose={() => {
              setAddSessionModalOpen(false);
              setHeaderTuitionFee(0);
              setIsEditingHeaderTuitionFee(false);
              setIsHeaderTuitionFeeManuallyEdited(false);
            }}
          />
        )}
      </Modal>

      {/* Edit Class Modal */}
      {editClassModalOpen && classData && (
        <EditClassModal
          isOpen={editClassModalOpen}
          onClose={() => {
            setEditClassModalOpen(false);
          }}
          classData={classData}
          teachers={allTeachers.length > 0 ? allTeachers : (classData?.teachers || [])}
          classTeachers={classTeachers}
          categories={categories}
          mode="edit"
          onSave={async () => {
            await refetchClass();
            setEditClassModalOpen(false);
          }}
          onOpenTeacherModal={() => {
            // Load all teachers if not already loaded
            if (allTeachers.length === 0) {
              loadAllTeachers();
            }
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
            allTeachers={allTeachers}
            onLoadAllTeachers={loadAllTeachers}
            isLoadingAllTeachers={isLoadingAllTeachers}
            onSuccess={async () => {
              try {
                // Invalidate cache before refetching to ensure fresh data
                if (id) {
                  const cacheKey = `class-${id}`;
                  sessionStorage.removeItem(cacheKey);
                  localStorage.removeItem(cacheKey);
                }
                await refetchClass();
                // Cache invalidation is handled in handleAddTeacher/handleRemoveTeacher
                // This callback is called after those functions complete
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
          setEditHeaderTuitionFee(0);
          setIsEditingEditHeaderTuitionFee(false);
          setIsEditHeaderTuitionFeeManuallyEdited(false);
        }}
        size="md"
        headerExtra={
          isAdmin ? (
            isEditingEditHeaderTuitionFee ? (
              <CurrencyInput
                value={editingEditHeaderTuitionFeeValue}
                onChange={(value) => setEditingEditHeaderTuitionFeeValue(value > 0 ? value : 0)}
                placeholder="Nhập học phí"
                showHint={false}
                style={{
                  width: '120px',
                  fontSize: '0.875rem',
                  marginLeft: 'var(--spacing-2)',
                  minWidth: '120px',
                  maxWidth: '150px',
                }}
                autoFocus
                onBlur={async (e) => {
                  // Lưu giá trị vào database ngay khi blur (giống logic trợ cấp)
                  const newValue = editingEditHeaderTuitionFeeValue;

                  if (newValue !== editHeaderTuitionFee) {
                    try {
                      // Lưu vào database ngay lập tức
                      const tuitionFeeValue = newValue > 0 ? newValue : null;
                      const updatedSession = await updateSession(editingSession.id, { tuition_fee: tuitionFeeValue });

                      // Lấy giá trị từ response của server để đảm bảo đồng bộ
                      const savedTuitionFee = (updatedSession as any).tuition_fee !== undefined && (updatedSession as any).tuition_fee !== null
                        ? Number((updatedSession as any).tuition_fee)
                        : (updatedSession as any).tuitionFee !== undefined && (updatedSession as any).tuitionFee !== null
                          ? Number((updatedSession as any).tuitionFee)
                          : 0;

                      // Cập nhật state với giá trị từ server
                      setEditHeaderTuitionFee(savedTuitionFee);

                      // Cập nhật editingSession với giá trị từ server để đồng bộ UI
                      // Đảm bảo cả tuition_fee và tuitionFee đều được set
                      const sessionWithTuitionFee = {
                        ...updatedSession,
                        tuition_fee: savedTuitionFee > 0 ? savedTuitionFee : null,
                        tuitionFee: savedTuitionFee > 0 ? savedTuitionFee : null,
                      };

                      setEditingSession(sessionWithTuitionFee);

                      // Reset flag để cho phép sync lại từ editingSession nếu cần
                      // Nhưng vẫn giữ flag để không bị auto-update từ estimatedTuitionFee
                      setIsEditHeaderTuitionFeeManuallyEdited(true);

                      if (handleSessionUpdated) {
                        handleSessionUpdated(sessionWithTuitionFee);
                      }

                      toast.success('Đã cập nhật học phí');
                    } catch (error: any) {
                      toast.error('Không thể cập nhật học phí: ' + (error.response?.data?.error || error.message));
                      // Khôi phục giá trị cũ nếu lỗi
                      setEditingEditHeaderTuitionFeeValue(editHeaderTuitionFee);
                    }
                  }
                  setIsEditingEditHeaderTuitionFee(false);
                }}
                onKeyDown={async (e) => {
                  const target = e.currentTarget as HTMLElement;

                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Lưu giá trị vào database ngay khi nhấn Enter (giống logic trợ cấp)
                    const newValue = editingEditHeaderTuitionFeeValue;

                    if (newValue !== editHeaderTuitionFee) {
                      try {
                        // Lưu vào database ngay lập tức
                        const tuitionFeeValue = newValue > 0 ? newValue : null;
                        const updatedSession = await updateSession(editingSession.id, { tuition_fee: tuitionFeeValue });

                        // Lấy giá trị từ response của server để đảm bảo đồng bộ
                        const savedTuitionFee = (updatedSession as any).tuition_fee !== undefined && (updatedSession as any).tuition_fee !== null
                          ? Number((updatedSession as any).tuition_fee)
                          : (updatedSession as any).tuitionFee !== undefined && (updatedSession as any).tuitionFee !== null
                            ? Number((updatedSession as any).tuitionFee)
                            : 0;

                        // Cập nhật state với giá trị từ server
                        setEditHeaderTuitionFee(savedTuitionFee);

                        // Cập nhật editingSession với giá trị từ server để đồng bộ UI
                        const sessionWithTuitionFee = {
                          ...updatedSession,
                          tuition_fee: savedTuitionFee > 0 ? savedTuitionFee : null,
                          tuitionFee: savedTuitionFee > 0 ? savedTuitionFee : null,
                        };

                        setEditingSession(sessionWithTuitionFee);
                        setIsEditHeaderTuitionFeeManuallyEdited(true);

                        if (handleSessionUpdated) {
                          handleSessionUpdated(sessionWithTuitionFee);
                        }

                        toast.success('Đã cập nhật học phí');
                      } catch (error: any) {
                        toast.error('Không thể cập nhật học phí: ' + (error.response?.data?.error || error.message));
                        // Khôi phục giá trị cũ nếu lỗi
                        setEditingEditHeaderTuitionFeeValue(editHeaderTuitionFee);
                      }
                    }
                    setIsEditingEditHeaderTuitionFee(false);
                    // Use setTimeout to ensure blur happens after state update
                    setTimeout(() => {
                      if (target && target.blur) {
                        target.blur();
                      }
                    }, 0);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingEditHeaderTuitionFeeValue(editHeaderTuitionFee);
                    setIsEditingEditHeaderTuitionFee(false);
                    // Use setTimeout to ensure blur happens after state update
                    setTimeout(() => {
                      if (target && target.blur) {
                        target.blur();
                      }
                    }, 0);
                  }
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#10b981',
                  marginLeft: 'var(--spacing-2)',
                  cursor: 'pointer',
                  padding: 'var(--spacing-1) var(--spacing-2)',
                  borderRadius: 'var(--radius)',
                  transition: 'background-color 0.2s',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingEditHeaderTuitionFeeValue(editHeaderTuitionFee);
                  setIsEditingEditHeaderTuitionFee(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {editHeaderTuitionFee > 0 ? formatCurrencyVND(editHeaderTuitionFee) : 'Click để nhập học phí'}
              </span>
            )
          ) : null
        }
      >
        {id && classData && editingSession && (
          <EditSessionModal
            classId={id}
            classData={classData}
            session={editingSession}
            teachers={classTeachers}
            students={enrolledStudents}
            headerTuitionFee={editHeaderTuitionFee}
            onEstimatedTuitionFeeChange={handleEditEstimatedTuitionFeeChange}
            canManagePaymentStatus={canManagePaymentStatus}
            canEditAllowanceManually={canEditAllowanceManually}
            onSessionUpdated={handleSessionUpdated}
            onSuccess={() => {
              setEditSessionModalOpen(false);
              setEditingSession(null);
              setEditHeaderTuitionFee(0);
              setIsEditingEditHeaderTuitionFee(false);
              setIsEditHeaderTuitionFeeManuallyEdited(false);
              refetch();
            }}
            onClose={() => {
              setEditSessionModalOpen(false);
              setEditingSession(null);
              setEditHeaderTuitionFee(0);
              setIsEditingEditHeaderTuitionFee(false);
              setIsEditHeaderTuitionFeeManuallyEdited(false);
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
              // Refetch both classData and classDetailData to update UI
              refetchClass();
              refetchClassDetailData();
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

      // Record action history
      try {
        const student = students.find(s => s.id === studentId);
        await recordAction({
          entityType: 'student_class',
          entityId: `${studentId}_${classId}`,
          actionType: 'create',
          afterValue: { student_id: studentId, class_id: classId, student_name: student?.name },
          description: `Thêm học sinh "${student?.name || studentId}" vào lớp "${classData?.name || classId}"`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

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
    return teachers.filter((t) => {
      const name = (t.fullName || t.full_name || '').toLowerCase();
      return name.includes(normalized);
    });
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
          {selectedTeacher ? (selectedTeacher.fullName || selectedTeacher.full_name) : placeholder}
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
                {teacher.fullName || teacher.full_name}
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
  headerTuitionFee,
  onEstimatedTuitionFeeChange,
  onSessionCreated,
}: {
  classId: string;
  classData: any;
  teachers: any[];
  students: any[];
  onSuccess: () => void;
  onClose: () => void;
  headerTuitionFee: number;
  onEstimatedTuitionFeeChange?: (fee: number) => void;
  onSessionCreated?: (session: any) => void;
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

  // Attendance state using hook - MUST be initialized before estimatedTuitionFee
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
    toggleAttendance: baseToggleAttendance,
    updateAttendance,
    getAttendanceSummary,
    getEligibleCount,
  } = useAttendance(initialAttendanceState);

  // Use session financials hook to calculate tuition fee and allowance
  const { estimatedTuitionFee, allowancePreview, allowanceFormula } = useSessionFinancials(
    students,
    attendance,
    teacherId,
    coefficient,
    classData
  );

  // Notify parent component when estimated tuition fee changes
  useEffect(() => {
    if (onEstimatedTuitionFeeChange) {
      onEstimatedTuitionFeeChange(estimatedTuitionFee);
    }
  }, [estimatedTuitionFee, onEstimatedTuitionFeeChange]);

  // Use headerTuitionFee as the tuition fee value (synced from parent)
  const tuitionFee = headerTuitionFee > 0 ? headerTuitionFee : undefined;

  // Custom toggle with validation for "excused" status
  const toggleAttendance = useCallback((studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentStatus = attendance[studentId]?.status || 'absent';
    const nextStatus = currentStatus === 'present' ? 'excused' : currentStatus === 'excused' ? 'absent' : 'present';

    // Check if trying to set to "excused" when student has no wallet balance
    // Cho phép chọn Phép khi số dư > 0 (số buổi còn lại không cần dương)
    if (nextStatus === 'excused') {
      const walletBalance = (student as any).wallet_balance || (student as any).walletBalance || 0;

      if (walletBalance <= 0) {
        // Cannot select "excused" - show error and skip to absent
        toast.error('Không thể chọn "Phép" khi số dư = 0');
        // Skip excused status - toggle twice to go from present → absent
        if (currentStatus === 'present') {
          baseToggleAttendance(studentId); // present → excused
          baseToggleAttendance(studentId); // excused → absent
        } else {
          // If already absent, just go to present
          baseToggleAttendance(studentId);
        }
        return;
      }
    }

    baseToggleAttendance(studentId);
  }, [attendance, students, baseToggleAttendance]);

  // Get attendance summary for display
  const attendanceSummary = useMemo(() => getAttendanceSummary(), [attendance, getAttendanceSummary]);

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
      // Calculate allowance amount using hook (already calculated above as allowancePreview)
      const calculatedAllowance = allowancePreview > 0 ? allowancePreview : undefined;

      // Create temporary session object for optimistic update
      const tempSessionId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const tempSession: any = {
        id: tempSessionId,
        class_id: classId,
        date,
        start_time: startTime,
        end_time: endTime,
        teacher_id: teacherId || undefined,
        coefficient: coefficient,
        notes: notes.trim(),
        payment_status: canManagePaymentStatus ? paymentStatus : 'unpaid',
        allowance_amount: calculatedAllowance !== undefined && calculatedAllowance > 0 ? calculatedAllowance : undefined,
        tuition_fee: tuitionFee && tuitionFee > 0 ? tuitionFee : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Optimistic update: add session to UI immediately
      // Note: We need to access parent's optimistic state, so we'll use onSuccess callback
      // For now, we'll create the session first and let onSuccess handle the refetch

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
        tuition_fee: tuitionFee && tuitionFee > 0 ? tuitionFee : undefined,
      });

      // Record action history
      try {
        await recordAction({
          entityType: 'session',
          entityId: newSession.id,
          actionType: 'create',
          afterValue: newSession,
          description: `Tạo buổi học mới cho lớp ${classData?.name || classId} vào ngày ${date}`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

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

        try {
          await saveAttendanceForSession(newSession.id, attendanceData);
        } catch (attendanceError: any) {
          console.error('Error saving attendance:', attendanceError);
          toast.error('Buổi học đã được tạo nhưng lưu điểm danh thất bại: ' + (attendanceError.response?.data?.error || attendanceError.message));
        }
      }

      // Optimistic update: add session to UI immediately
      if (onSessionCreated) {
        onSessionCreated(newSession);
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
            Hệ số (0-1) *
          </label>
          <input
            type="number"
            value={coefficientInputValue}
            onChange={(e) => {
              const value = e.target.value;
              setCoefficientInputValue(value);
              if (value === '') {
                setCoefficient(0);
              } else {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  const clamped = Math.min(1, Math.max(0, numValue));
                  setCoefficient(clamped);
                  if (clamped !== numValue) setCoefficientInputValue(String(clamped));
                }
              }
            }}
            onBlur={(e) => {
              if (e.target.value === '') {
                setCoefficientInputValue('0');
                setCoefficient(0);
              } else {
                const numValue = parseFloat(e.target.value);
                if (!isNaN(numValue)) {
                  const clamped = Math.min(1, Math.max(0, numValue));
                  setCoefficient(clamped);
                  setCoefficientInputValue(String(clamped));
                }
              }
            }}
            min="0"
            max="1"
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
            Hệ số từ 0 đến 1
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
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)', lineHeight: '1.6' }}>
          {teacherId && allowanceFormula ? (
            <div>
              <div style={{ marginBottom: 'var(--spacing-1)' }}>
                <strong>Học sinh:</strong> {allowanceFormula.weightedFormula}
              </div>
              <div>
                <strong>Trợ cấp:</strong> {allowanceFormula.allowanceFormula}
              </div>
            </div>
          ) : teacherId ? (
            'Chưa có học sinh đủ điều kiện tính trợ cấp'
          ) : (
            'Chọn gia sư để xem trợ cấp dự kiến'
          )}
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
  headerTuitionFee,
  onEstimatedTuitionFeeChange,
  onSessionUpdated,
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
  headerTuitionFee: number;
  onEstimatedTuitionFeeChange?: (fee: number) => void;
  onSessionUpdated?: (session: any) => void;
  canManagePaymentStatus?: boolean;
  canEditAllowanceManually?: boolean;
}) {

  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = hasRole('admin');

  // Initialize state with empty/default values - will be populated by useEffect
  const [date, setDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('18:00');
  const [endTime, setEndTime] = useState<string>('20:00');

  // Refs for date and time inputs
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const startTimeInputRef = React.useRef<HTMLInputElement>(null);
  const endTimeInputRef = React.useRef<HTMLInputElement>(null);
  const [teacherId, setTeacherId] = useState<string>('');
  const [coefficient, setCoefficient] = useState<number>(1);
  const [coefficientInputValue, setCoefficientInputValue] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('unpaid');
  const [allowanceAmount, setAllowanceAmount] = useState<number | null>(null);

  const [editingAllowance, setEditingAllowance] = useState(false);
  const [allowanceInputValue, setAllowanceInputValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  // Attendance state using hook
  const {
    attendance,
    setAttendance,
    toggleAttendance: baseToggleAttendance,
    updateAttendance,
    getAttendanceSummary,
    getEligibleCount,
  } = useAttendance({});

  // Use ref to track current loading session to prevent duplicate fetches
  const loadingSessionIdRef = useRef<string | null>(null);

  // Custom toggle with validation for "excused" status
  const toggleAttendance = useCallback((studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const currentStatus = attendance[studentId]?.status || 'absent';
    const nextStatus = currentStatus === 'present' ? 'excused' : currentStatus === 'excused' ? 'absent' : 'present';

    // Check if trying to set to "excused" when student has no wallet balance
    // Cho phép chọn Phép khi số dư > 0 (số buổi còn lại không cần dương)
    if (nextStatus === 'excused') {
      const walletBalance = (student as any).wallet_balance || (student as any).walletBalance || 0;

      if (walletBalance <= 0) {
        // Cannot select "excused" - show error and skip to absent
        toast.error('Không thể chọn "Phép" khi số dư = 0');
        // Skip excused status - toggle twice to go from present → absent
        if (currentStatus === 'present') {
          baseToggleAttendance(studentId); // present → excused
          baseToggleAttendance(studentId); // excused → absent
        } else {
          // If already absent, just go to present
          baseToggleAttendance(studentId);
        }
        return;
      }
    }

    baseToggleAttendance(studentId);
  }, [attendance, students, baseToggleAttendance]);

  // Prefill all fields when session or classData changes
  // Use session.id as key to ensure we re-run when a different session is selected
  useEffect(() => {
    if (!session || !session.id) {
      return;
    }

    // Prefill date (from session, no class default)
    const sessionDate = session.date || new Date().toISOString().slice(0, 10);
    setDate(sessionDate);

    // Prefill start time (from session, no class default)
    const sessionStartTime = (session as any).startTime || session.start_time || '18:00';
    setStartTime(sessionStartTime);

    // Prefill end time (from session, no class default)
    const sessionEndTime = (session as any).endTime || session.end_time || '20:00';
    setEndTime(sessionEndTime);

    // Prefill teacher ID (from session, fallback to class teacherIds)
    const sessionTeacherId = (session as any).teacherId || session.teacher_id;
    if (sessionTeacherId) {
      setTeacherId(sessionTeacherId);
    } else {
      // Use first teacher from class if available
      if (classData?.teacherIds && Array.isArray(classData.teacherIds) && classData.teacherIds.length > 0) {
        setTeacherId(classData.teacherIds[0]);
      } else if (teachers.length > 0) {
        setTeacherId(teachers[0].id);
      }
    }

    // Prefill coefficient (from session, default to 1)
    const sessionCoefficient = (session as any).coefficient !== undefined && (session as any).coefficient !== null
      ? (session as any).coefficient
      : session.coefficient !== undefined && session.coefficient !== null
        ? session.coefficient
        : null;
    const finalCoefficient = sessionCoefficient !== null ? sessionCoefficient : 1;
    setCoefficient(finalCoefficient);
    setCoefficientInputValue(String(finalCoefficient));

    // Prefill notes (from session, default to empty)
    const sessionNotes = session.notes !== undefined && session.notes !== null ? session.notes : '';
    setNotes(sessionNotes);

    // Prefill payment status (from session, default to 'unpaid')
    const sessionPaymentStatus = (session as any).paymentStatus || session.payment_status || 'unpaid';
    setPaymentStatus(sessionPaymentStatus);

    // Prefill allowance amount (from session, no class default - calculated dynamically)
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

    // Tuition fee is now managed by parent component via headerTuitionFee prop
    // No need to set local state here
  }, [session?.id, classData?.teacherIds, teachers]);

  // Fetch existing attendance - combined reset and load logic
  useEffect(() => {
    const sessionId = session?.id;

    // Don't fetch if session.id is not available or students are not ready
    if (!sessionId || !Array.isArray(students) || students.length === 0) {
      setLoadingAttendance(false);
      setAttendance({});
      loadingSessionIdRef.current = null;
      return;
    }

    // Prevent duplicate fetches for the same session
    if (loadingSessionIdRef.current === sessionId) {
      return;
    }

    // Mark this session as loading
    loadingSessionIdRef.current = sessionId;

    const loadAttendance = async () => {
      // Reset attendance to empty first to prevent showing stale data
      setAttendance({});
      setLoadingAttendance(true);

      try {
        const existingAttendance = await fetchAttendanceBySession(sessionId);

        // Check if session is still the same (user might have changed session while loading)
        if (loadingSessionIdRef.current !== sessionId) {
          return;
        }

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
        console.error('[EditSessionModal] Failed to load attendance:', error);

        // Check if session is still the same
        if (loadingSessionIdRef.current !== sessionId) {
          return;
        }

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
        // Only clear loading flag if this is still the current session
        if (loadingSessionIdRef.current === sessionId) {
          setLoadingAttendance(false);
          loadingSessionIdRef.current = null;
        }
      }
    };

    loadAttendance();

    // Cleanup: reset ref if component unmounts or session changes
    return () => {
      if (loadingSessionIdRef.current === sessionId) {
        loadingSessionIdRef.current = null;
      }
    };
  }, [session?.id, students, setAttendance]);

  // Use session financials hook to calculate allowance and tuition fee
  const { estimatedTuitionFee, allowancePreview: calculatedAllowancePreview, allowanceFormula } = useSessionFinancials(
    students,
    attendance,
    teacherId,
    coefficient,
    classData
  );

  // Notify parent component when estimated tuition fee changes
  // Use ref to track previous value and avoid infinite loops
  const prevEstimatedTuitionFeeRef = React.useRef<number>(estimatedTuitionFee);
  useEffect(() => {
    if (onEstimatedTuitionFeeChange && estimatedTuitionFee !== prevEstimatedTuitionFeeRef.current) {
      prevEstimatedTuitionFeeRef.current = estimatedTuitionFee;
      onEstimatedTuitionFeeChange(estimatedTuitionFee);
    }
  }, [estimatedTuitionFee, onEstimatedTuitionFeeChange]);

  // Use headerTuitionFee as the tuition fee value (synced from parent)
  // Always use headerTuitionFee value (even if 0) to preserve manual edits
  const tuitionFee = headerTuitionFee;

  // Calculate current allowance (use manual value if set, otherwise use calculated)
  const currentAllowance = useMemo(() => {
    if (allowanceAmount !== null && allowanceAmount !== undefined && allowanceAmount >= 0) {
      return allowanceAmount;
    }
    return calculatedAllowancePreview;
  }, [allowanceAmount, calculatedAllowancePreview]);

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
      // Calculate allowance amount using hook (already calculated above)
      const calculatedAllowance = calculatedAllowancePreview > 0 ? calculatedAllowancePreview : undefined;

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

      // Include allowance_amount: use manual value if set, otherwise use calculated value
      if (allowanceAmount !== null && allowanceAmount !== undefined && allowanceAmount >= 0) {
        // Manual override
        updateData.allowance_amount = allowanceAmount;
      } else if (calculatedAllowance !== undefined && calculatedAllowance > 0) {
        // Auto-calculated based on attendance
        updateData.allowance_amount = calculatedAllowance;
      }

      // Include tuition_fee if admin - always save headerTuitionFee value
      // The headerTuitionFee is synced from parent and reflects any manual edits
      if (isAdmin) {
        // Always include tuition_fee: use headerTuitionFee value (even if 0, to allow clearing)
        // If headerTuitionFee > 0, use it; if 0, set to null to clear in database
        if (headerTuitionFee > 0) {
          updateData.tuition_fee = headerTuitionFee;
        } else {
          // If 0, set to null to clear the value in database
          updateData.tuition_fee = null;
        }
      }

      // Get old session data for action history
      const oldSession = { ...session };

      // Update session
      const updatedSession = await updateSession(session.id, updateData);

      // Record action history
      try {
        const changedFields: Record<string, { old: any; new: any }> = {};
        if (oldSession.date !== updateData.date) changedFields.date = { old: oldSession.date, new: updateData.date };
        if (oldSession.start_time !== updateData.start_time) changedFields.start_time = { old: oldSession.start_time, new: updateData.start_time };
        if (oldSession.end_time !== updateData.end_time) changedFields.end_time = { old: oldSession.end_time, new: updateData.end_time };
        if (oldSession.notes !== updateData.notes) changedFields.notes = { old: oldSession.notes, new: updateData.notes };
        if (oldSession.payment_status !== updateData.payment_status) changedFields.payment_status = { old: oldSession.payment_status, new: updateData.payment_status };
        if (oldSession.allowance_amount !== updateData.allowance_amount) changedFields.allowance_amount = { old: oldSession.allowance_amount, new: updateData.allowance_amount };
        if (oldSession.tuition_fee !== updateData.tuition_fee) changedFields.tuition_fee = { old: oldSession.tuition_fee, new: updateData.tuition_fee };

        await recordAction({
          entityType: 'session',
          entityId: session.id,
          actionType: 'update',
          beforeValue: oldSession,
          afterValue: updatedSession,
          changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
          description: `Cập nhật buổi học ngày ${formatDate(updateData.date)} của lớp ${classData?.name || session.class_id}`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

      // Update attendance records
      // When editing a session, skip financial processing to avoid affecting student balances
      if (students.length > 0) {
        const attendanceData = students.map((student) => {
          const att = attendance[student.id] || { status: 'absent' as AttendanceStatus, remark: '' };
          return {
            student_id: student.id,
            status: att.status,
            remark: att.remark || undefined,
          };
        });

        // Skip financial processing when editing (session already exists and financials were calculated on creation)
        await saveAttendanceForSession(session.id, attendanceData, true);
      }

      // Optimistic update: update session in UI immediately
      // Ensure the updated session includes the tuition_fee value
      const sessionWithTuitionFee = {
        ...updatedSession,
        tuition_fee: updateData.tuition_fee,
        tuitionFee: updateData.tuition_fee,
      };

      if (onSessionUpdated && sessionWithTuitionFee) {
        onSessionUpdated(sessionWithTuitionFee);
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
            Hệ số (0-1) *
          </label>
          <input
            type="number"
            value={coefficientInputValue}
            onChange={(e) => {
              const value = e.target.value;
              setCoefficientInputValue(value);
              if (value === '') {
                setCoefficient(0);
              } else {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  const clamped = Math.min(1, Math.max(0, numValue));
                  setCoefficient(clamped);
                  if (clamped !== numValue) setCoefficientInputValue(String(clamped));
                }
              }
            }}
            onBlur={(e) => {
              if (e.target.value === '') {
                setCoefficientInputValue('0');
                setCoefficient(0);
              } else {
                const numValue = parseFloat(e.target.value);
                if (!isNaN(numValue)) {
                  const clamped = Math.min(1, Math.max(0, numValue));
                  setCoefficient(clamped);
                  setCoefficientInputValue(String(clamped));
                }
              }
            }}
            min="0"
            max="1"
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
            Hệ số từ 0 đến 1
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontWeight: '500' }}>
          Trợ cấp giáo viên
        </label>
        {editingAllowance && canEditAllowanceManually ? (
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
                  if (Number.isFinite(parsed) && parsed >= 0) {
                    try {
                      await updateSession(session.id, { allowance_amount: parsed });
                      setAllowanceAmount(parsed);
                      toast.success('Đã cập nhật trợ cấp');
                      // Trigger refetch to update UI
                      if (onSessionUpdated) {
                        const updatedSession = { ...session, allowance_amount: parsed };
                        onSessionUpdated(updatedSession);
                      }
                    } catch (error: any) {
                      toast.error('Không thể cập nhật trợ cấp: ' + (error.response?.data?.error || error.message));
                    }
                  } else if (allowanceInputValue && !Number.isFinite(parseFloat(allowanceInputValue))) {
                    toast.error('Vui lòng nhập số hợp lệ');
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
              if (canEditAllowanceManually) {
                setEditingAllowance(true);
                setAllowanceInputValue(String(currentAllowance > 0 ? currentAllowance : ''));
              }
            }}
            style={{
              padding: 'var(--spacing-3)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              fontSize: '1rem',
              fontWeight: '500',
              color: currentAllowance > 0 ? 'var(--text)' : 'var(--muted)',
              cursor: canEditAllowanceManually ? 'pointer' : 'default',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (canEditAllowanceManually) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
          >
            {lockedAllowance ? (
              // If allowance is locked (has been set), always show it (even if 0)
              formatCurrencyVND(currentAllowance)
            ) : currentAllowance > 0 ? (
              // If allowance is calculated and > 0, show it
              formatCurrencyVND(currentAllowance)
            ) : (
              // Otherwise, show placeholder
              <span style={{ fontStyle: 'italic' }}>Click để nhập trợ cấp thủ công</span>
            )}
            {canEditAllowanceManually && lockedAllowance && (
              <span style={{ marginLeft: 'var(--spacing-1)', fontSize: '0.9em', opacity: 0.7 }}>✏️</span>
            )}
          </div>
        )}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)', marginTop: 'var(--spacing-1)', lineHeight: '1.6' }}>
          {teacherId && allowanceFormula ? (
            <div>
              <div style={{ marginBottom: 'var(--spacing-1)' }}>
                <strong>Học sinh:</strong> {allowanceFormula.weightedFormula}
              </div>
              <div>
                <strong>Trợ cấp:</strong> {allowanceFormula.allowanceFormula}
              </div>
            </div>
          ) : teacherId ? (
            'Chưa có học sinh đủ điều kiện tính trợ cấp'
          ) : (
            'Chọn gia sư để xem trợ cấp dự kiến'
          )}
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
          {loadingAttendance ? (
            <div className="card" style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-4)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>Đang tải dữ liệu điểm danh...</div>
            </div>
          ) : (
            <>
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
            </>
          )}
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
  onLoadAllTeachers,
  isLoadingAllTeachers,
  onSuccess,
  onClose,
}: {
  classId: string;
  classData: any;
  teachers: any[];
  allTeachers: any[];
  onLoadAllTeachers?: () => void;
  isLoadingAllTeachers?: boolean;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [currentTeacherIds, setCurrentTeacherIds] = useState<Set<string>>(
    new Set(classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Load all teachers when modal opens (lazy loading)
  useEffect(() => {
    if (onLoadAllTeachers && allTeachers.length === 0) {
      onLoadAllTeachers();
    }
  }, [onLoadAllTeachers, allTeachers.length]);

  const availableTeachers = useMemo(() => {
    if (allTeachers.length === 0) return [];
    return allTeachers.filter((t) => {
      const roles = Array.isArray(t.roles) ? t.roles : [];
      return (roles.includes('teacher') || roles.length === 0) && !currentTeacherIds.has(t.id);
    });
  }, [allTeachers, currentTeacherIds]);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return availableTeachers.slice(0, 6);
    const normalized = searchQuery.trim().toLowerCase();
    return availableTeachers.filter((t) => {
      const name = (t.fullName || t.full_name || '').toLowerCase();
      return name.includes(normalized);
    });
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
      const oldClassData = { ...classData };
      await updateClass(classId, updateData);

      // Record action history
      try {
        const removedTeacher = allTeachers.find(t => t.id === teacherId);
        await recordAction({
          entityType: 'class',
          entityId: classId,
          actionType: 'update',
          beforeValue: oldClassData,
          afterValue: { ...oldClassData, ...updateData },
          description: `Gỡ gia sư "${removedTeacher?.fullName || removedTeacher?.full_name || teacherId}" khỏi lớp "${classData?.name || classId}"`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

      toast.success('Đã gỡ gia sư khỏi lớp');

      // Invalidate class cache to ensure fresh data on refetch
      const cacheKey = `class-${classId}`;
      sessionStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheKey);

      // Invalidate staff detail cache for the teacher that was just removed
      // This ensures StaffDetail page updates immediately
      for (let year = 2020; year <= 2030; year++) {
        for (let month = 1; month <= 12; month++) {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          const cacheKey = `staff-detail-data-${teacherId}-${monthStr}`;
          localStorage.removeItem(cacheKey);
          sessionStorage.removeItem(cacheKey);
        }
      }

      // Dispatch event to trigger refetch in StaffDetail if it's open
      window.dispatchEvent(new CustomEvent('teacher-class-updated', {
        detail: { teacherId, classId, action: 'removed' }
      }));

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
      const oldClassData = { ...classData };
      await updateClass(classId, updateData);

      // Record action history
      try {
        const addedTeacher = allTeachers.find(t => t.id === teacherId);
        await recordAction({
          entityType: 'class',
          entityId: classId,
          actionType: 'update',
          beforeValue: oldClassData,
          afterValue: { ...oldClassData, ...updateData },
          description: `Thêm gia sư "${addedTeacher?.fullName || addedTeacher?.full_name || teacherId}" vào lớp "${classData?.name || classId}"`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

      setSearchQuery('');
      toast.success('Đã thêm gia sư vào lớp');

      // Invalidate class cache to ensure fresh data on refetch
      const cacheKey = `class-${classId}`;
      sessionStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheKey);

      // Invalidate staff detail cache for the teacher that was just added
      // This ensures StaffDetail page updates immediately
      for (let year = 2020; year <= 2030; year++) {
        for (let month = 1; month <= 12; month++) {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`;
          const cacheKey = `staff-detail-data-${teacherId}-${monthStr}`;
          localStorage.removeItem(cacheKey);
          sessionStorage.removeItem(cacheKey);
        }
      }

      // Dispatch event to trigger refetch in StaffDetail if it's open
      window.dispatchEvent(new CustomEvent('teacher-class-updated', {
        detail: { teacherId, classId, action: 'added' }
      }));

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
                <span>{teacher.fullName || teacher.full_name}</span>
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
                  {teacher.fullName || teacher.full_name}
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

      const oldSchedule = classData?.schedule;
      await updateClass(classId, { schedule: formattedSchedule });

      // Record action history
      try {
        await recordAction({
          entityType: 'class',
          entityId: classId,
          actionType: 'update',
          beforeValue: { ...classData, schedule: oldSchedule },
          afterValue: { ...classData, schedule: formattedSchedule },
          changedFields: { schedule: { old: oldSchedule, new: formattedSchedule } },
          description: `Cập nhật lịch học của lớp "${classData?.name || classId}"`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

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
// Unified EditClassModal component - used in both Classes.tsx and ClassDetail.tsx
export function EditClassModal({
  isOpen,
  onClose,
  classData,
  teachers,
  classTeachers,
  categories,
  onSave,
  onOpenTeacherModal,
  mode = 'edit',
  onCreateClass,
}: {
  isOpen: boolean;
  onClose: () => void;
  classData: any | null;
  teachers: any[];
  classTeachers?: any[];
  categories: any[];
  onSave: (createdClassId?: string) => void;
  onOpenTeacherModal?: () => void;
  mode?: 'create' | 'edit';
  onCreateClass?: (data: any) => Promise<{ id: string } | void>;
}) {
  // Removed excessive logging to prevent re-render loops

  const [formData, setFormData] = useState({
    name: '',
    type: '',
    status: 'running' as 'running' | 'stopped',
    teacherIds: [] as string[],
    maxStudents: 15,
    tuitionPerSession: 0,
    scaleAmount: 0,
    maxAllowancePerSession: 0,
    studentTuitionPerSession: 0,
    tuitionPackageTotal: 0,
    tuitionPackageSessions: '' as number | '',
  });
  const [loading, setLoading] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  // Get available teachers for selection (excluding already selected)
  const availableTeachersForSelection = useMemo(() => {
    const selectedIds = new Set(formData.teacherIds);
    return teachers.filter((t: any) => !selectedIds.has(t.id));
  }, [teachers, formData.teacherIds]);

  // Filter teachers based on search query
  const filteredAvailableTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return availableTeachersForSelection.slice(0, 6);
    const normalized = teacherSearchQuery.trim().toLowerCase();
    return availableTeachersForSelection.filter((t) => {
      const name = (t.fullName || t.full_name || t.name || '').toLowerCase();
      return name.includes(normalized);
    });
  }, [availableTeachersForSelection, teacherSearchQuery]);

  // Get currently selected teachers
  // Priority: classTeachers prop > teachers prop > classData.teachers
  const selectedTeachers = useMemo(() => {
    if (formData.teacherIds.length === 0) return [];

    // Priority 1: Use classTeachers prop if available
    if (classTeachers && Array.isArray(classTeachers) && classTeachers.length > 0) {
      const filtered = classTeachers.filter((t: any) => formData.teacherIds.includes(t.id));
      if (filtered.length > 0) {
        return filtered;
      }
    }

    // Priority 2: Filter from teachers prop
    if (teachers && Array.isArray(teachers) && teachers.length > 0) {
      const filtered = teachers.filter((t: any) => formData.teacherIds.includes(t.id));
      if (filtered.length > 0) {
        return filtered;
      }
    }

    // Priority 3: Use classData.teachers if available
    if (classData && (classData as any).teachers && Array.isArray((classData as any).teachers)) {
      const filtered = (classData as any).teachers.filter((t: any) => formData.teacherIds.includes(t.id));
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return [];
  }, [teachers, formData.teacherIds, classTeachers, classData]);

  const handleAddTeacher = (teacherId: string) => {
    if (!formData.teacherIds.includes(teacherId)) {
      setFormData({ ...formData, teacherIds: [...formData.teacherIds, teacherId] });
      setTeacherSearchQuery('');
    }
  };

  const handleRemoveTeacher = (teacherId: string) => {
    setFormData({ ...formData, teacherIds: formData.teacherIds.filter(id => id !== teacherId) });
  };

  // Prefill formData when modal opens or classData changes
  useEffect(() => {
    if (!isOpen) {
      // Reset when modal closes
      setFormData({
        name: '',
        type: '',
        status: 'running',
        teacherIds: [],
        maxStudents: 15,
        tuitionPerSession: 0,
        scaleAmount: 0,
        maxAllowancePerSession: 0,
        studentTuitionPerSession: 0,
        tuitionPackageTotal: 0,
        tuitionPackageSessions: '',
      });
      setTeacherSearchQuery('');
      return;
    }

    if (mode === 'create' || !classData) {
      // Create mode - reset to defaults
      const defaultType = categories.length > 0 ? categories[0].name : '';
      setFormData({
        name: '',
        type: defaultType,
        status: 'running',
        teacherIds: [],
        maxStudents: 15,
        tuitionPerSession: 0,
        scaleAmount: 0,
        maxAllowancePerSession: 0,
        studentTuitionPerSession: 0,
        tuitionPackageTotal: 0,
        tuitionPackageSessions: '',
      });
      setTeacherSearchQuery('');
      return;
    }

    // Edit mode - prefill from classData
    const teacherIds = classData.teacherIds || (classData.teacherId ? [classData.teacherId] : []);
    const normalizedTeacherIds = Array.isArray(teacherIds) ? teacherIds : [teacherIds].filter(Boolean);

    // Handle tuitionPackageSessions - can be number, string, or empty
    let tuitionPackageSessionsValue: number | '' = '';
    if (classData.tuitionPackageSessions !== undefined && classData.tuitionPackageSessions !== null) {
      if (typeof classData.tuitionPackageSessions === 'number') {
        tuitionPackageSessionsValue = classData.tuitionPackageSessions;
      } else if (typeof classData.tuitionPackageSessions === 'string' && classData.tuitionPackageSessions.trim() !== '') {
        const parsed = parseInt(classData.tuitionPackageSessions, 10);
        tuitionPackageSessionsValue = isNaN(parsed) ? '' : parsed;
      }
    }

    const newFormData = {
      name: classData.name || '',
      type: classData.type || '',
      status: (classData.status || 'running') as 'running' | 'stopped',
      teacherIds: normalizedTeacherIds,
      maxStudents: classData.maxStudents ?? 15,
      tuitionPerSession: classData.tuitionPerSession ?? 0,
      scaleAmount: classData.scaleAmount ?? 0,
      maxAllowancePerSession: classData.maxAllowancePerSession ?? 0,
      studentTuitionPerSession: classData.studentTuitionPerSession ?? 0,
      tuitionPackageTotal: classData.tuitionPackageTotal ?? 0,
      tuitionPackageSessions: tuitionPackageSessionsValue,
    };

    setFormData(newFormData);
    setTeacherSearchQuery('');
  }, [isOpen, classData?.id, mode, categories.length]);


  // Calculate preview values (removed × 1.2 preview as per backup)

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

    if (formData.teacherIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một gia sư');
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

      const classDataToSave: any = {
        name: formData.name.trim(),
        type: formData.type.trim(),
        status: formData.status,
        teacherIds: formData.teacherIds,
        maxStudents: formData.maxStudents,
      };

      if (formData.tuitionPerSession > 0) {
        classDataToSave.tuitionPerSession = formData.tuitionPerSession;
      }
      if (formData.scaleAmount > 0) {
        classDataToSave.scaleAmount = formData.scaleAmount;
      }
      if (formData.maxAllowancePerSession > 0) {
        classDataToSave.maxAllowancePerSession = formData.maxAllowancePerSession;
      }
      if (finalStudentTuitionPerSession > 0) {
        classDataToSave.studentTuitionPerSession = finalStudentTuitionPerSession;
      }
      if (formData.tuitionPackageTotal > 0) {
        classDataToSave.tuitionPackageTotal = formData.tuitionPackageTotal;
      }
      if (formData.tuitionPackageSessions !== '' && formData.tuitionPackageSessions > 0) {
        classDataToSave.tuitionPackageSessions = typeof formData.tuitionPackageSessions === 'number'
          ? formData.tuitionPackageSessions
          : Number(formData.tuitionPackageSessions);
      }

      if (mode === 'create' && onCreateClass) {
        const created = await onCreateClass(classDataToSave);
        // Skip recordAction for create: entity_id is required by DB and we don't have the new class id yet
        toast.success('Đã thêm lớp học mới');
        onSave((created as any)?.id);
        return;
      } else if (mode === 'edit' && classData) {
        const oldClassData = { ...classData };
        await updateClass(classData.id, classDataToSave);

        // Record action history for update
        try {
          const changedFields: Record<string, { old: any; new: any }> = {};
          if (oldClassData.name !== classDataToSave.name) changedFields.name = { old: oldClassData.name, new: classDataToSave.name };
          if (oldClassData.type !== classDataToSave.type) changedFields.type = { old: oldClassData.type, new: classDataToSave.type };
          if (oldClassData.status !== classDataToSave.status) changedFields.status = { old: oldClassData.status, new: classDataToSave.status };
          if (oldClassData.maxStudents !== classDataToSave.maxStudents) changedFields.maxStudents = { old: oldClassData.maxStudents, new: classDataToSave.maxStudents };
          if (oldClassData.tuitionPerSession !== classDataToSave.tuitionPerSession) changedFields.tuitionPerSession = { old: oldClassData.tuitionPerSession, new: classDataToSave.tuitionPerSession };

          await recordAction({
            entityType: 'class',
            entityId: classData.id,
            actionType: 'update',
            beforeValue: oldClassData,
            afterValue: { ...oldClassData, ...classDataToSave },
            changedFields: Object.keys(changedFields).length > 0 ? changedFields : undefined,
            description: `Cập nhật thông tin lớp học "${classDataToSave.name}"`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }
        toast.success('Đã cập nhật lớp học');
      }

      onSave();
    } catch (error: any) {
      toast.error('Không thể lưu lớp học: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={mode === 'create' ? 'Thêm lớp học mới' : 'Chỉnh sửa lớp học'}
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
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
            }}
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
          <label className="form-label" style={{ marginBottom: 'var(--spacing-2)' }}>
            Gia sư * (có thể chọn nhiều)
          </label>

          {/* Current Teachers List */}
          <div style={{ marginBottom: 'var(--spacing-3)' }}>
            <h4 style={{ marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: '600' }}>
              Gia sư đã chọn
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
              {selectedTeachers.length > 0 ? (
                selectedTeachers.map((teacher) => (
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
                    <span>{teacher.fullName || teacher.full_name || teacher.name || teacher.id}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveTeacher(teacher.id)}
                      title="Gỡ khỏi danh sách"
                    >
                      Xóa
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Chưa chọn gia sư nào.</p>
              )}
            </div>
          </div>

          {/* Add Teacher Search */}
          <div>
            <h4 style={{ marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: '600' }}>
              Thêm gia sư mới
            </h4>
            <div style={{ position: 'relative' }}>
              <input
                type="search"
                value={teacherSearchQuery}
                onChange={(e) => setTeacherSearchQuery(e.target.value)}
                placeholder="Nhập tên gia sư để tìm kiếm..."
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}
              />
              {teacherSearchQuery && filteredAvailableTeachers.length > 0 && (
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
                  {filteredAvailableTeachers.map((teacher) => (
                    <button
                      key={teacher.id}
                      type="button"
                      onClick={() => handleAddTeacher(teacher.id)}
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
                      {teacher.fullName || teacher.full_name || teacher.name || teacher.id}
                    </button>
                  ))}
                </div>
              )}
              {teacherSearchQuery && filteredAvailableTeachers.length === 0 && (
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
            {loading ? (mode === 'create' ? 'Đang tạo...' : 'Đang cập nhật...') : (mode === 'create' ? 'Tạo mới' : 'Cập nhật')}
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

        // Record action history
        try {
          await recordAction({
            entityType: 'student_class',
            entityId: `${student.id}_${currentClassId}`,
            actionType: 'delete',
            beforeValue: { student_id: student.id, class_id: currentClassId, student_name: student.name },
            description: `Xóa học sinh "${student.name}" khỏi lớp`,
          });
        } catch (err) {
          // Silently fail - action history is not critical
        }

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

      // Record action history
      try {
        await recordAction({
          entityType: 'student_class',
          entityId: `${student.id}_${currentClassId}`,
          actionType: 'delete',
          beforeValue: { student_id: student.id, class_id: currentClassId, student_name: student.name },
          description: `Xóa học sinh "${student.name}" khỏi lớp hiện tại`,
        });
        await recordAction({
          entityType: 'student_class',
          entityId: `${student.id}_${selectedClassId}`,
          actionType: 'create',
          afterValue: { student_id: student.id, class_id: selectedClassId, student_name: student.name },
          description: `Chuyển học sinh "${student.name}" sang lớp "${targetClass.name}"`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

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

      const oldClassData = { ...classData };
      await updateClass(classId, payload);

      // Record action history
      try {
        await recordAction({
          entityType: 'class',
          entityId: classId,
          actionType: 'update',
          beforeValue: oldClassData,
          afterValue: { ...oldClassData, ...payload },
          changedFields: { custom_teacher_allowances: { old: oldClassData.customTeacherAllowances, new: payload.custom_teacher_allowances } },
          description: `Cập nhật trợ cấp cho gia sư "${teacher?.fullName || teacher?.full_name || teacher?.id}" trong lớp "${classData?.name || classId}"`,
        });
      } catch (err) {
        // Silently fail - action history is not critical
      }

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
          Trợ cấp / hệ số (VND) - {teacher.fullName || teacher.full_name}
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
