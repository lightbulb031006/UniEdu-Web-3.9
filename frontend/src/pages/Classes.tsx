import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchClasses, createClass, updateClass, deleteClass, Class, ClassFilters } from '../services/classesService';
import { fetchTeachers } from '../services/teachersService';
import { fetchCategories } from '../services/categoriesService';
import { useAuthStore } from '../store/authStore';
import { hasRole, userHasStaffRole } from '../utils/permissions';
import { formatNumber } from '../utils/formatters';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';
import { CurrencyInput } from '../components/CurrencyInput';

/**
 * Classes Page Component
 * Migrated from backup/assets/js/pages/classes.js
 * UI giống hệt app cũ với CRUD operations
 */

function Classes() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<ClassFilters>({
    search: '',
    type: 'all',
    status: 'all',
  });
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    status: 'running' as 'running' | 'stopped',
    teacherIds: [] as string[],
    maxStudents: 15,
    tuitionPerSession: 0,
    studentTuitionPerSession: 0,
    tuitionPackageTotal: 0,
    tuitionPackageSessions: '' as number | '',
  });
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');

  const { data, isLoading, error, refetch } = useDataLoading(
    () => fetchClasses(filters),
    [filters.search, filters.type, filters.status],
    {
      cacheKey: `classes-${filters.search}-${filters.type}-${filters.status}`,
      staleTime: 1 * 60 * 1000,
    }
  );

  // Fetch teachers to display teacher names and for form
  const { data: teachersData } = useDataLoading(
    () => fetchTeachers(),
    [],
    {
      cacheKey: 'teachers-for-classes',
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Fetch categories for type dropdown
  const { data: categoriesData } = useDataLoading(
    () => fetchCategories(),
    [],
    {
      cacheKey: 'categories-for-classes',
      staleTime: 5 * 60 * 1000,
    }
  );

  // Ensure classes, teachers, and categories are always arrays
  const classes = Array.isArray(data) ? data : [];
  const teachers = Array.isArray(teachersData) ? teachersData : [];
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  
  // Check if user is tutor (teacher staff role)
  const isTutor = userHasStaffRole('teacher', user, teachers);
  const isAdmin = hasRole('admin');
  
  // Redirect teacher (tutor) away from classes list page
  useEffect(() => {
    if (user?.role === 'teacher' && isTutor && !isAdmin) {
      // Redirect to dashboard (will redirect to staff-detail)
      navigate('/dashboard', { replace: true });
    }
  }, [user, isTutor, isAdmin, navigate, teachers]);

  // Get available teachers (with teacher role or no roles)
  const availableTeachers = useMemo(() => {
    return teachers.filter((t: any) => {
      const roles = t.roles || [];
      return roles.includes('teacher') || roles.length === 0;
    });
  }, [teachers]);

  // Get teachers available for selection (not already selected)
  const availableTeachersForSelection = useMemo(() => {
    const selectedIds = new Set(formData.teacherIds);
    return availableTeachers.filter((t: any) => !selectedIds.has(t.id));
  }, [availableTeachers, formData.teacherIds]);

  // Filter teachers based on search query
  const filteredAvailableTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return availableTeachersForSelection.slice(0, 6);
    const normalized = teacherSearchQuery.trim().toLowerCase();
    return availableTeachersForSelection.filter((t) => 
      t.fullName?.toLowerCase().includes(normalized) || 
      t.name?.toLowerCase().includes(normalized)
    );
  }, [availableTeachersForSelection, teacherSearchQuery]);

  // Get currently selected teachers
  const selectedTeachers = useMemo(() => {
    return teachers.filter((t: any) => formData.teacherIds.includes(t.id));
  }, [teachers, formData.teacherIds]);

  // Get teacher names for a class
  const getClassTeacherNames = (cls: Class): string => {
    const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
    const ids = Array.isArray(teacherIds) ? teacherIds : [teacherIds].filter(Boolean);
    
    const teacherNames = ids
      .map((id) => {
        const teacher = teachers.find((t) => t.id === id);
        return teacher ? teacher.fullName : null;
      })
      .filter(Boolean);

    return teacherNames.length > 0 ? teacherNames.join(', ') : '-';
  };

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  };

  const handleTypeFilterChange = (type: string) => {
    setFilters((prev) => ({ ...prev, type }));
  };

  const handleStatusFilterChange = (status: 'all' | 'running' | 'stopped') => {
    setFilters((prev) => ({ ...prev, status }));
  };

  const handleCreate = () => {
    setEditingClass(null);
    const defaultType = categories.length > 0 ? categories[0].name : '';
    setFormData({
      name: '',
      type: defaultType,
      status: 'running',
      teacherIds: [],
      maxStudents: 15,
      tuitionPerSession: 0,
      studentTuitionPerSession: 0,
      tuitionPackageTotal: 0,
      tuitionPackageSessions: '',
    });
    setTeacherSearchQuery('');
    setShowModal(true);
  };

  const handleEdit = (cls: Class) => {
    setEditingClass(cls);
    const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
    setFormData({
      name: cls.name || '',
      type: cls.type || '',
      status: cls.status || 'running',
      teacherIds: Array.isArray(teacherIds) ? teacherIds : [teacherIds].filter(Boolean),
      maxStudents: cls.maxStudents || 15,
      tuitionPerSession: cls.tuitionPerSession || 0,
      studentTuitionPerSession: cls.studentTuitionPerSession || 0,
      tuitionPackageTotal: cls.tuitionPackageTotal || 0,
      tuitionPackageSessions: cls.tuitionPackageSessions || '',
    });
    setTeacherSearchQuery('');
    setShowModal(true);
  };

  const handleAddTeacher = (teacherId: string) => {
    if (!formData.teacherIds.includes(teacherId)) {
      setFormData({ ...formData, teacherIds: [...formData.teacherIds, teacherId] });
      setTeacherSearchQuery('');
    }
  };

  const handleRemoveTeacher = (teacherId: string) => {
    setFormData({ ...formData, teacherIds: formData.teacherIds.filter(id => id !== teacherId) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.teacherIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một gia sư');
      return;
    }

    try {
      const classData: any = {
        name: formData.name.trim(),
        type: formData.type.trim(),
        status: formData.status,
        teacherIds: formData.teacherIds,
        maxStudents: formData.maxStudents,
      };

      if (formData.tuitionPerSession > 0) {
        classData.tuitionPerSession = formData.tuitionPerSession;
      }

      if (formData.studentTuitionPerSession > 0) {
        classData.studentTuitionPerSession = formData.studentTuitionPerSession;
      }

      if (formData.tuitionPackageTotal > 0) {
        classData.tuitionPackageTotal = formData.tuitionPackageTotal;
      }

      if (formData.tuitionPackageSessions !== '' && formData.tuitionPackageSessions > 0) {
        classData.tuitionPackageSessions = typeof formData.tuitionPackageSessions === 'number' 
          ? formData.tuitionPackageSessions 
          : Number(formData.tuitionPackageSessions);
      }

      if (editingClass) {
        await updateClass(editingClass.id, classData);
      } else {
        await createClass(classData);
      }

      setShowModal(false);
      toast.success(editingClass ? 'Đã cập nhật lớp học' : 'Đã thêm lớp học mới');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi khi lưu lớp học: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa lớp này?')) return;
    try {
      await deleteClass(id);
      toast.success('Đã xóa lớp học');
      refetch();
    } catch (err) {
      toast.error('Lỗi khi xóa lớp');
    }
  };

  const handleClassClick = (classId: string) => {
    navigate(`/classes/${classId}`);
  };

  // Filter classes client-side
  const filteredClasses = (classes || []).filter((cls) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (
        !cls.name?.toLowerCase().includes(searchLower) &&
        !cls.type?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (filters.type && filters.type !== 'all') {
      if (cls.type !== filters.type) return false;
    }
    if (filters.status && filters.status !== 'all') {
      if (cls.status !== filters.status) return false;
    }
    return true;
  });

  const uniqueTypes = Array.from(new Set(classes.map((c) => c.type).filter(Boolean))).sort();

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)' }}>Lỗi tải dữ liệu</h2>
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
          <h2 style={{ margin: 0 }}>Lớp học</h2>
          <div className="students-count-badge" style={{ display: 'flex', alignItems: 'baseline', gap: '4px', padding: 'var(--spacing-2) var(--spacing-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700' }}>
              {isLoading ? (
                <div className="skeleton-loading" style={{ height: '20px', width: '30px', borderRadius: '4px' }} />
              ) : (
                formatNumber(filteredClasses.length)
              )}
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>lớp</span>
          </div>
        </div>
        <button className="btn btn-primary btn-add-icon" onClick={handleCreate} title="Thêm lớp mới">
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
              className="search-input"
              placeholder="Tìm kiếm theo tên lớp, phân loại, giáo viên..."
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
              Phân loại
            </label>
            <select
              className="filter-select"
              value={filters.type || 'all'}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
            >
              <option value="all">Tất cả phân loại</option>
              {uniqueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{ flex: '1', minWidth: '200px' }}>
            <label className="filter-label" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
              Trạng thái
            </label>
            <select
              className="filter-select"
              value={filters.status || 'all'}
              onChange={(e) => handleStatusFilterChange(e.target.value as 'all' | 'running' | 'stopped')}
            >
              <option value="all">Tất cả</option>
              <option value="running">Đang hoạt động</option>
              <option value="stopped">Đã dừng</option>
            </select>
          </div>
          <div className="filter-actions">
            <button
              className="btn btn-secondary"
              onClick={() => setFilters({ search: '', type: 'all', status: 'all' })}
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
        <div className="table-container" style={{ overflowX: 'auto' }}>
          {isLoading && filteredClasses.length === 0 ? (
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Phân loại</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Giáo viên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '150px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px' }} />
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
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên lớp</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Phân loại</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Giáo viên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Trạng thái</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredClasses.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--muted)' }}>
                      Không có lớp học nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredClasses.map((cls) => (
                    <tr
                      key={cls.id}
                      onClick={() => handleClassClick(cls.id)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '';
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: '500', color: 'var(--primary)', cursor: 'pointer' }}>
                        {cls.name}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{cls.type || '-'}</td>
                      <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{getClassTeacherNames(cls)}</td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        <span
                          className={`badge ${cls.status === 'running' ? 'badge-success' : 'badge-muted'}`}
                          style={{
                            padding: 'var(--spacing-1) var(--spacing-2)',
                            borderRadius: 'var(--radius)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: '500',
                            background: cls.status === 'running' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                            color: cls.status === 'running' ? '#10b981' : 'var(--muted)',
                          }}
                        >
                          {cls.status === 'running' ? 'Đang hoạt động' : 'Đã dừng'}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="crud-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                          <button
                            className="btn-edit-icon"
                            onClick={() => handleEdit(cls)}
                            title="Chỉnh sửa lớp"
                            style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn-delete-icon"
                            onClick={() => handleDelete(cls.id)}
                            title="Xóa lớp"
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
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Class Modal */}
      <Modal
        title={editingClass ? 'Chỉnh sửa lớp học' : 'Thêm lớp học mới'}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="className" className="form-label">
              Tên lớp *
            </label>
            <input
              type="text"
              id="className"
              className="form-control"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Nhập tên lớp"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="classType" className="form-label">
                Phân loại *
              </label>
              <select
                id="classType"
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
              <label htmlFor="classStatus" className="form-label">
                Trạng thái *
              </label>
              <select
                id="classStatus"
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
                      <span>{teacher.fullName || teacher.name || teacher.id}</span>
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
                        {teacher.fullName || teacher.name || teacher.id}
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
            <label htmlFor="classMaxStudents" className="form-label">
              Số học sinh tối đa
            </label>
            <input
              type="number"
              id="classMaxStudents"
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
              <label htmlFor="classTuitionPerSession" className="form-label">
                Trợ cấp / Hệ số (VND)
              </label>
              <CurrencyInput
                id="classTuitionPerSession"
                className="form-control"
                value={formData.tuitionPerSession}
                onChange={(value) => {
                  setFormData({ ...formData, tuitionPerSession: value });
                }}
                placeholder="Ví dụ: 150000"
              />
            </div>
          </div>

          <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: 'var(--spacing-3)' }}>
            <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: '600', marginBottom: 'var(--spacing-3)' }}>Học phí học sinh</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-3)' }}>
              <div className="form-group">
                <label htmlFor="classTuitionPackageTotal" className="form-label">
                  Tổng tiền học phí (VND)
                </label>
                <CurrencyInput
                  id="classTuitionPackageTotal"
                  className="form-control"
                  value={formData.tuitionPackageTotal}
                  onChange={(value) => {
                    setFormData({ ...formData, tuitionPackageTotal: value });
                  }}
                  placeholder="Ví dụ: 2000000"
                />
              </div>
              <div className="form-group">
                <label htmlFor="classTuitionPackageSessions" className="form-label">
                  Số buổi
                </label>
                <input
                  type="number"
                  id="classTuitionPackageSessions"
                  className="form-control"
                  value={formData.tuitionPackageSessions}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setFormData({ ...formData, tuitionPackageSessions: '' });
                    } else {
                      const sessions = parseInt(value, 10);
                      if (!isNaN(sessions) && sessions >= 0) {
                        setFormData({ ...formData, tuitionPackageSessions: sessions });
                        // Auto-calculate student tuition per session
                        if (sessions > 0 && formData.tuitionPackageTotal > 0) {
                          setFormData((prev) => ({
                            ...prev,
                            studentTuitionPerSession: Math.round(prev.tuitionPackageTotal / sessions),
                          }));
                        }
                      }
                    }
                  }}
                  min="0"
                  step="1"
                  placeholder="Ví dụ: 10"
                />
              </div>
              <div className="form-group">
                <label htmlFor="classStudentTuitionPerSession" className="form-label">
                  Học phí mỗi buổi (VND)
                </label>
                <CurrencyInput
                  id="classStudentTuitionPerSession"
                  className="form-control"
                  value={formData.studentTuitionPerSession}
                  onChange={(value) => {
                    setFormData({ ...formData, studentTuitionPerSession: value });
                  }}
                  placeholder="Tự động từ tổng tiền / số buổi"
                />
              </div>
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editingClass ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Classes;
