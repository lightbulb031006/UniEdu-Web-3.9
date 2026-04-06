import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { useAuthStore } from '../store/authStore';
import { fetchStudents, createStudent, updateStudent, deleteStudent, Student, StudentFilters } from '../services/studentsService';
import { fetchClasses } from '../services/classesService';
import { fetchTeachers } from '../services/teachersService';
import { formatCurrencyVND, formatNumber } from '../utils/formatters';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';

/**
 * Students Page Component
 * Migrated from backup/assets/js/pages/students.js
 * UI giống hệt app cũ với CRUD operations
 */

function Students() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [filters, setFilters] = useState<StudentFilters & { classId?: string; province?: string }>({
    search: '',
    status: 'all',
    classId: 'all',
    province: 'all',
  });
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    birthYear: new Date().getFullYear() - 15,
    school: '',
    province: '',
    email: '',
    gender: 'male' as 'male' | 'female',
    parentName: '',
    parentPhone: '',
    accountHandle: '',
    accountPassword: '',
    loginEmail: '',
    status: 'active' as 'active' | 'inactive',
    goal: '',
    classIds: [] as string[],
    cskhStaffId: '',
  });

  // Prepare filters for API (only send valid filters, not 'all')
  const apiFilters = useMemo(() => {
    const apiFilter: StudentFilters = {};
    if (filters.search) {
      apiFilter.search = filters.search;
    }
    if (filters.status && filters.status !== 'all') {
      apiFilter.status = filters.status;
    }
    if (filters.province && filters.province !== 'all') {
      apiFilter.province = filters.province;
    }
    return apiFilter;
  }, [filters.search, filters.status, filters.province]);

  // Fetch students with optimized loading
  const { data, isLoading, error, refetch } = useDataLoading(
    () => fetchStudents(apiFilters),
    [apiFilters],
    {
      cacheKey: `students-${JSON.stringify(apiFilters)}`,
      staleTime: 1 * 60 * 1000, // 1 minute
    }
  );

  // Fetch classes for filter and form
  const { data: classesData } = useDataLoading(
    () => fetchClasses(),
    [],
    {
      cacheKey: 'classes-for-students',
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fetch teachers for CSKH staff selection
  const { data: teachersData } = useDataLoading(
    () => fetchTeachers(),
    [],
    {
      cacheKey: 'teachers-for-students',
      staleTime: 5 * 60 * 1000,
    }
  );

  // Ensure students, classes, and teachers are always arrays
  const students = Array.isArray(data) ? data : [];
  const classes = Array.isArray(classesData) ? classesData : [];
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  // Get CSKH staff (teachers with cskh_sale role)
  const cskhStaff = useMemo(() => {
    return teachers.filter((t: any) => {
      const roles = t.roles || [];
      return roles.includes('cskh_sale');
    });
  }, [teachers]);

  // Get unique provinces from students
  const provinces = useMemo(() => {
    const uniqueProvinces = new Set<string>();
    students.forEach((s) => {
      if (s.province) uniqueProvinces.add(s.province);
    });
    return Array.from(uniqueProvinces).sort();
  }, [students]);

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleStatusFilterChange = (status: 'all' | 'active' | 'inactive') => {
    setFilters((prev) => ({ ...prev, status }));
  };

  const handleClassFilterChange = (classId: string) => {
    setFilters((prev) => ({ ...prev, classId }));
  };

  const handleProvinceFilterChange = (province: string) => {
    setFilters((prev) => ({ ...prev, province }));
  };

  const handleCreate = () => {
    setEditingStudent(null);
    setFormData({
      fullName: '',
      birthYear: new Date().getFullYear() - 15,
      school: '',
      province: '',
      email: '',
      gender: 'male',
      parentName: '',
      parentPhone: '',
      accountHandle: '',
      accountPassword: '',
      loginEmail: '',
      status: 'active',
      goal: '',
      classIds: [],
      cskhStaffId: '',
    });
    setShowModal(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    // Get class IDs from student
    const studentClassIds = Array.isArray(student.classId)
      ? student.classId.filter(Boolean)
      : student.classId
      ? [student.classId]
      : student.classIds && Array.isArray(student.classIds)
      ? student.classIds.filter(Boolean)
      : [];

    setFormData({
      fullName: student.fullName || '',
      birthYear: student.birthYear || new Date().getFullYear() - 15,
      school: student.school || '',
      province: student.province || '',
      email: student.email || '',
      gender: (student as any).gender || 'male',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      accountHandle: student.accountHandle || '',
      accountPassword: '', // Don't pre-fill password
      loginEmail: student.email || '',
      status: student.status || 'active',
      goal: student.goal || '',
      classIds: studentClassIds,
      cskhStaffId: (student as any).cskhStaffId || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa học sinh này?')) return;
    try {
      await deleteStudent(id);
      toast.success('Đã xóa học sinh');
      refetch();
    } catch (err) {
      toast.error('Lỗi khi xóa học sinh');
    }
  };

  const handleStudentClick = (studentId: string) => {
    navigate(`/students/${studentId}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const studentData: any = {
        fullName: formData.fullName.trim(),
        birthYear: formData.birthYear,
        school: formData.school.trim(),
        province: formData.province.trim(),
        parentName: formData.parentName.trim(),
        parentPhone: formData.parentPhone.trim(),
        status: formData.status,
        gender: formData.gender,
        classIds: formData.classIds, // Include class IDs for student_classes relationships
      };

      if (formData.email) {
        studentData.email = formData.email.trim();
      }

      if (formData.goal) {
        studentData.goal = formData.goal.trim();
      }

      // Admin-only fields
      if (isAdmin) {
        if (formData.accountHandle) {
          studentData.accountHandle = formData.accountHandle.trim();
        }
        if (formData.accountPassword) {
          studentData.accountPassword = formData.accountPassword;
        }
        if (formData.loginEmail) {
          studentData.email = formData.loginEmail.trim();
        }
        // Always send cskhStaffId when admin changes it (including empty string to unassign)
        studentData.cskhStaffId = formData.cskhStaffId || '';
      }

      if (editingStudent) {
        await updateStudent(editingStudent.id, studentData);
      } else {
        await createStudent(studentData);
      }

      setShowModal(false);
      toast.success(editingStudent ? 'Đã cập nhật học sinh' : 'Đã thêm học sinh mới');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi khi lưu học sinh: ' + (err.response?.data?.error || err.message || 'Lỗi không xác định'));
    }
  };

  // Filter students client-side (for now, can be moved to backend)
  const filteredStudents = useMemo(() => {
    return (students || []).filter((student) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !student.fullName?.toLowerCase().includes(searchLower) &&
          !student.email?.toLowerCase().includes(searchLower) &&
          !student.school?.toLowerCase().includes(searchLower) &&
          !student.province?.toLowerCase().includes(searchLower) &&
          !student.parentName?.toLowerCase().includes(searchLower) &&
          !student.parentPhone?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Class filter
      if (filters.classId && filters.classId !== 'all') {
        // Handle both classId and classIds
        const studentClassIds = Array.isArray(student.classId)
          ? student.classId.filter(Boolean)
          : student.classId
          ? [student.classId]
          : student.classIds && Array.isArray(student.classIds)
          ? student.classIds.filter(Boolean)
          : [];
        if (studentClassIds.length === 0 || !studentClassIds.includes(filters.classId)) {
          return false;
        }
      }

      // Province filter
      if (filters.province && filters.province !== 'all') {
        if (student.province !== filters.province) return false;
      }

      // Status filter
      if (filters.status && filters.status !== 'all') {
        if ((student.status || 'active') !== filters.status) return false;
      }

      return true;
    });
  }, [students, filters]);

  // Get class names for each student
  const getStudentClassNames = (student: Student): string => {
    // Handle both classId and classIds
    const studentClassIds = Array.isArray(student.classId)
      ? student.classId.filter(Boolean)
      : student.classId
      ? [student.classId]
      : student.classIds && Array.isArray(student.classIds)
      ? student.classIds.filter(Boolean)
      : [];

    const classNames = studentClassIds
      .map((classId) => {
        const cls = classes.find((c) => c.id === classId);
        return cls ? cls.name : null;
      })
      .filter(Boolean);

    return classNames.length > 0 ? classNames.join(', ') : '-';
  };

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 'var(--spacing-4)' }}>Lỗi tải dữ liệu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>
            {error.message || 'Không thể tải danh sách học sinh. Vui lòng kiểm tra kết nối với server.'}
          </p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      {/* Header */}
      <div className="students-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <div className="students-page-title-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
          <h2 style={{ margin: 0 }}>Học sinh</h2>
          <div className="students-count-badge" style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: 'var(--spacing-2) var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span className="students-count-number" style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', color: 'var(--text)' }}>
              {isLoading ? (
                <div className="skeleton-loading" style={{ height: '20px', width: '30px', borderRadius: '4px' }} />
              ) : (
                formatNumber(filteredStudents.length)
              )}
            </span>
            <span className="students-count-label" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>học sinh</span>
          </div>
        </div>
        <button className="btn btn-primary btn-add-icon" onClick={handleCreate} title="Thêm học sinh mới">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="students-filters-card card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className="students-search-bar" style={{ marginBottom: 'var(--spacing-3)' }}>
          <div className="search-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 'var(--spacing-3)', color: 'var(--muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="search-input form-control"
              placeholder="Tìm kiếm theo tên, trường, tỉnh, phụ huynh..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ paddingLeft: '40px', width: '100%' }}
            />
            {filters.search && (
              <button
                className="search-clear-btn"
                onClick={() => handleSearchChange('')}
                title="Xóa tìm kiếm"
                style={{ position: 'absolute', right: 'var(--spacing-2)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="students-filters-row" style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
            <label className="filter-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Lớp
            </label>
            <select
              className="filter-select form-control"
              value={filters.classId || 'all'}
              onChange={(e) => handleClassFilterChange(e.target.value)}
            >
              <option value="all">Tất cả lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
            <label className="filter-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Tỉnh/Thành
            </label>
            <select
              className="filter-select form-control"
              value={filters.province || 'all'}
              onChange={(e) => handleProvinceFilterChange(e.target.value)}
            >
              <option value="all">Tất cả tỉnh</option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
            <label className="filter-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Trạng thái
            </label>
            <select
              className="filter-select form-control"
              value={filters.status || 'all'}
              onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">Tất cả</option>
              <option value="active">Đang học</option>
              <option value="inactive">Nghỉ học</option>
            </select>
          </div>
          <div className="filter-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setFilters({ search: '', status: 'all', classId: 'all', province: 'all' })}
              title="Đặt lại bộ lọc"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Đặt lại
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
            <span style={{ color: 'var(--muted)', fontSize: 'var(--font-size-sm)' }}>
              Đang hiển thị <strong>{formatNumber(filteredStudents.length)}</strong> / <strong>{formatNumber(students.length)}</strong> học sinh
            </span>
          </div>
        </div>
        <div className="table-container" style={{ overflowX: 'auto' }}>
          {isLoading && filteredStudents.length === 0 ? (
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tỉnh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '150px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '20px', width: '80px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '32px', width: '60px', borderRadius: '4px' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tỉnh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--muted)' }}>
                      Không có học sinh nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => {
                    const status = student.status || 'active';
                    const statusLabel = status === 'inactive' ? 'Nghỉ học' : 'Đang học';
                    return (
                      <tr
                        key={student.id}
                        onClick={() => handleStudentClick(student.id)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '';
                        }}
                      >
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          <span style={{ fontWeight: '500', color: 'var(--primary)', textDecoration: 'none' }}>
                            {student.fullName}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{student.province || '-'}</td>
                        <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{getStudentClassNames(student)}</td>
                        <td style={{ padding: 'var(--spacing-3)' }}>
                          <span
                            className={`status-badge ${status === 'inactive' ? 'status-inactive' : 'status-active'}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-1)',
                              padding: 'var(--spacing-1) var(--spacing-2)',
                              borderRadius: 'var(--radius)',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: '500',
                              background: status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                              color: status === 'active' ? '#10b981' : 'var(--muted)',
                            }}
                          >
                            {status === 'inactive' ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                            )}
                            {statusLabel}
                          </span>
                        </td>
                        <td style={{ padding: 'var(--spacing-3)' }} onClick={(e) => e.stopPropagation()}>
                          <div className="crud-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                            <button
                              className="btn-edit-icon"
                              onClick={() => handleEdit(student)}
                              title="Chỉnh sửa học sinh"
                              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="btn-delete-icon"
                              onClick={() => handleDelete(student.id)}
                              title="Xóa học sinh"
                              style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Student Modal */}
      <Modal
        title={editingStudent ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới'}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          {/* Personal Information Section */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Thông tin cá nhân
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
              <div className="form-group">
                <label htmlFor="studentName" className="form-label">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  id="studentName"
                  className="form-control"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  placeholder="Nhập họ và tên đầy đủ"
                />
              </div>
              <div className="form-group">
                <label htmlFor="studentBirthYear" className="form-label">
                  Năm sinh *
                </label>
                <input
                  type="number"
                  id="studentBirthYear"
                  className="form-control"
                  value={formData.birthYear}
                  onChange={(e) => setFormData({ ...formData, birthYear: parseInt(e.target.value, 10) || new Date().getFullYear() - 15 })}
                  min="1990"
                  max={new Date().getFullYear() - 5}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="studentGender" className="form-label">
                  Giới tính
                </label>
                <select
                  id="studentGender"
                  className="form-control"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-3)' }}>
              <div className="form-group">
                <label htmlFor="studentSchool" className="form-label">
                  Trường học *
                </label>
                <input
                  type="text"
                  id="studentSchool"
                  className="form-control"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  required
                  placeholder="Tên trường học"
                />
              </div>
              <div className="form-group">
                <label htmlFor="studentProvince" className="form-label">
                  Tỉnh thành *
                </label>
                <input
                  type="text"
                  id="studentProvince"
                  className="form-control"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  required
                  placeholder="Tỉnh/Thành phố"
                />
              </div>
              <div className="form-group">
                <label htmlFor="studentEmail" className="form-label">
                  Email liên hệ
                </label>
                <input
                  type="email"
                  id="studentEmail"
                  className="form-control"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Email dùng để liên lạc"
                />
              </div>
            </div>
          </div>

          {/* Parent Information Section */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Thông tin phụ huynh
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
              <div className="form-group">
                <label htmlFor="studentParentName" className="form-label">
                  Tên phụ huynh *
                </label>
                <input
                  type="text"
                  id="studentParentName"
                  className="form-control"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  required
                  placeholder="Họ và tên phụ huynh"
                />
              </div>
              <div className="form-group">
                <label htmlFor="studentParentPhone" className="form-label">
                  Số điện thoại phụ huynh *
                </label>
                <input
                  type="tel"
                  id="studentParentPhone"
                  className="form-control"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  required
                  placeholder="0912345678"
                />
              </div>
            </div>
          </div>

          {/* Login Information Section (Admin only) */}
          {isAdmin && (
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Thông tin đăng nhập (Chỉ quản trị)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
                <div className="form-group">
                  <label htmlFor="studentHandle" className="form-label">
                    Handle / Username *
                  </label>
                  <input
                    type="text"
                    id="studentHandle"
                    className="form-control"
                    value={formData.accountHandle}
                    onChange={(e) => setFormData({ ...formData, accountHandle: e.target.value })}
                    required
                    placeholder="vd: hocsinh1"
                  />
                  <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>Sử dụng cho đăng nhập nội bộ</small>
                </div>
                <div className="form-group">
                  <label htmlFor="studentAccountPassword" className="form-label">
                    Mật khẩu mặc định {editingStudent ? '' : '*'}
                  </label>
                  <input
                    type="password"
                    id="studentAccountPassword"
                    className="form-control"
                    value={formData.accountPassword}
                    onChange={(e) => setFormData({ ...formData, accountPassword: e.target.value })}
                    required={!editingStudent}
                    placeholder={editingStudent ? 'Nhập mật khẩu mới (nếu muốn đổi)' : 'vd: 123456'}
                  />
                  <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                    {editingStudent ? 'Chỉ nhập nếu muốn thay đổi mật khẩu' : 'Dùng khi cấp lại tài khoản'}
                  </small>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 'var(--spacing-3)' }}>
                <label htmlFor="studentLoginEmail" className="form-label">
                  Email đăng nhập
                </label>
                <input
                  type="email"
                  id="studentLoginEmail"
                  className="form-control"
                  value={formData.loginEmail}
                  onChange={(e) => setFormData({ ...formData, loginEmail: e.target.value })}
                  placeholder="Email dùng để đăng nhập (nếu để trống sẽ dùng email liên hệ)"
                />
                <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Email đăng nhập có thể khác với email liên hệ. Nếu để trống sẽ dùng email liên hệ làm email đăng nhập.
                </small>
              </div>
            </div>
          )}

          {/* Classes and Status Section */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              Lớp học và trạng thái
            </h4>
            <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
              <label className="form-label">Lớp học (có thể chọn nhiều)</label>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--spacing-2)' }}>
                {classes.length > 0 ? (
                  classes.map((cls) => {
                    const isChecked = formData.classIds.includes(cls.id);
                    return (
                      <label
                        key={cls.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: 'var(--spacing-2)',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius)',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, classIds: [...formData.classIds, cls.id] });
                            } else {
                              setFormData({ ...formData, classIds: formData.classIds.filter((id) => id !== cls.id) });
                            }
                          }}
                          style={{ marginRight: 'var(--spacing-2)', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span>{cls.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <div style={{ padding: 'var(--spacing-2)', color: 'var(--muted)' }}>Chưa có lớp nào</div>
                )}
              </div>
              <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                Chọn tất cả các lớp mà học sinh đang học. Có thể bỏ chọn để xóa học sinh khỏi lớp.
              </small>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)' }}>
              <div className="form-group">
                <label htmlFor="studentStatus" className="form-label">
                  Trạng thái
                </label>
                <select
                  id="studentStatus"
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Đang học</option>
                  <option value="inactive">Ngừng học</option>
                </select>
              </div>
              {isAdmin && (
                <div className="form-group">
                  <label htmlFor="studentCskhStaff" className="form-label">
                    Người phụ trách CSKH
                  </label>
                  <select
                    id="studentCskhStaff"
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
                  <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                    Chọn nhân sự có role SALE&CSKH để phụ trách học sinh này
                  </small>
                </div>
              )}
            </div>
          </div>

          {/* Goal Section */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Mục tiêu học tập
            </h4>
            <div className="form-group">
              <label htmlFor="studentGoal" className="form-label">
                Mục tiêu học tập
              </label>
              <textarea
                id="studentGoal"
                className="form-control"
                rows={4}
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                placeholder="Nhập mục tiêu học tập của học sinh..."
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Hủy
            </button>
            {editingStudent && isAdmin && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  if (window.confirm('Bạn có chắc chắn muốn xóa học sinh này?')) {
                    await handleDelete(editingStudent.id);
                    setShowModal(false);
                  }
                }}
              >
                Xóa học sinh
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {editingStudent ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Students;
