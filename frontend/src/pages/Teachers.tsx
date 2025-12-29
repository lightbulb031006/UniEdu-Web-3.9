import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers, createTeacher, updateTeacher, deleteTeacher, Teacher } from '../services/teachersService';
import { fetchClasses } from '../services/classesService';
import { formatCurrencyVND, formatNumber } from '../utils/formatters';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';

/**
 * Teachers Page Component
 * Migrated from backup/assets/js/pages/teachers.js
 * UI giống hệt app cũ với CRUD operations
 */

function Teachers() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    birthYear: new Date().getFullYear() - 25,
    university: '',
    highSchool: '',
    province: '',
    email: '',
    phone: '',
    specialization: '',
    photoUrl: '',
    status: 'active' as 'active' | 'inactive',
    roles: [] as string[],
  });

  const { data, isLoading, error, refetch } = useDataLoading(
    () => fetchTeachers(),
    [],
    {
      cacheKey: 'teachers',
      staleTime: 2 * 60 * 1000,
    }
  );

  // Fetch classes to calculate class count
  const { data: classesData } = useDataLoading(
    () => fetchClasses(),
    [],
    {
      cacheKey: 'classes-for-teachers',
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Ensure teachers and classes are always arrays
  const teachers = Array.isArray(data) ? data : [];
  const classes = Array.isArray(classesData) ? classesData : [];

  // Calculate teacher stats (class count)
  const teachersWithStats = useMemo(() => {
    return teachers.map((teacher) => {
      // Get classes where teacher is assigned
      const teacherClasses = classes.filter((cls) => {
        const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
        return Array.isArray(teacherIds) ? teacherIds.includes(teacher.id) : teacherIds === teacher.id;
      });

      // Extract birth year from birthDate
      const birthYear = teacher.birthDate ? new Date(teacher.birthDate).getFullYear() : null;

      return {
        ...teacher,
        classCount: teacherClasses.length,
        birthYear,
      };
    });
  }, [teachers, classes]);

  const handleCreate = () => {
    setEditingTeacher(null);
    const defaultYear = new Date().getFullYear() - 25;
    setFormData({
      fullName: '',
      birthDate: '',
      birthYear: defaultYear,
      university: '',
      highSchool: '',
      province: '',
      email: '',
      phone: '',
      specialization: '',
      photoUrl: '',
      status: 'active',
      roles: [],
    });
    setShowModal(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    // Extract birth year from birthDate if available
    let birthYear = teacher.birthYear;
    let birthDate = '';
    if ((teacher as any).birthDate) {
      birthDate = (teacher as any).birthDate;
      birthYear = new Date(birthDate).getFullYear();
    } else if (teacher.birthYear) {
      birthYear = teacher.birthYear;
      // Create a date string from birth year (use Jan 1st)
      birthDate = `${birthYear}-01-01`;
    }

    setFormData({
      fullName: teacher.fullName || '',
      birthDate: birthDate,
      birthYear: birthYear || new Date().getFullYear() - 25,
      university: (teacher as any).university || '',
      highSchool: (teacher as any).highSchool || '',
      province: teacher.province || '',
      email: (teacher as any).email || '',
      phone: (teacher as any).phone || '',
      specialization: (teacher as any).specialization || '',
      photoUrl: teacher.photoUrl || '',
      status: teacher.status || 'active',
      roles: teacher.roles || [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const teacherData: any = {
        fullName: formData.fullName.trim(),
        province: formData.province.trim(),
        status: formData.status,
      };

      // Use birthDate if provided, otherwise use birthYear
      if (formData.birthDate) {
        teacherData.birthDate = formData.birthDate;
      } else if (formData.birthYear) {
        teacherData.birthYear = formData.birthYear;
      }

      if (formData.university) {
        teacherData.university = formData.university.trim();
      }

      if (formData.highSchool) {
        teacherData.highSchool = formData.highSchool.trim();
      }

      if (formData.email) {
        teacherData.email = formData.email.trim();
      }

      if (formData.phone) {
        teacherData.phone = formData.phone.trim();
      }

      if (formData.specialization) {
        teacherData.specialization = formData.specialization.trim();
      }

      if (formData.photoUrl) {
        teacherData.photoUrl = formData.photoUrl.trim();
      }

      if (formData.roles && formData.roles.length > 0) {
        teacherData.roles = formData.roles;
      }

      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, teacherData);
      } else {
        await createTeacher(teacherData);
      }

      setShowModal(false);
      toast.success(editingTeacher ? 'Đã cập nhật giáo viên' : 'Đã thêm giáo viên mới');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi khi lưu giáo viên: ' + (err.message || 'Lỗi không xác định'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa giáo viên này?')) return;
    try {
      await deleteTeacher(id);
      toast.success('Đã xóa giáo viên');
      refetch();
    } catch (err) {
      toast.error('Lỗi khi xóa giáo viên');
    }
  };

  const handleTeacherClick = (teacherId: string) => {
    navigate(`/staff/${teacherId}`);
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2 style={{ margin: 0 }}>Gia sư</h2>
        <button className="btn btn-primary btn-add-icon" onClick={handleCreate} title="Thêm gia sư mới">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container" style={{ overflowX: 'auto' }}>
          {isLoading && teachers.length === 0 ? (
            <table className="table-striped" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}></th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Năm sinh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tỉnh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tổng nhận</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '40px', width: '40px', borderRadius: '50%' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '120px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '60px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: 'var(--spacing-3)' }}>
                      <div className="skeleton-loading" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
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
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}></th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Năm sinh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tỉnh</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Tổng nhận</th>
                  <th style={{ padding: 'var(--spacing-3)', width: '80px', borderBottom: '2px solid var(--border)' }}></th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 'var(--spacing-6)', textAlign: 'center', color: 'var(--muted)' }}>
                      Không có giáo viên nào.
                    </td>
                  </tr>
                ) : (
                  teachersWithStats.map((teacher) => (
                    <tr
                      key={teacher.id}
                      onClick={() => handleTeacherClick(teacher.id)}
                      style={{ cursor: 'pointer' }}
                      className="teacher-row-clickable"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '';
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        {teacher.photoUrl ? (
                          <img
                            src={teacher.photoUrl}
                            alt=""
                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--bg-secondary)',
                              color: 'var(--muted)',
                              fontWeight: '600',
                            }}
                          >
                            {(teacher.fullName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        <span style={{ fontWeight: '500', color: 'var(--text)' }}>{teacher.fullName || '-'}</span>
                        {teacher.classCount > 0 && (
                          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)', marginTop: '2px' }}>
                            {teacher.classCount} lớp
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{teacher.birthYear || '-'}</td>
                      <td style={{ padding: 'var(--spacing-3)', color: 'var(--text)' }}>{teacher.province || '-'}</td>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: '500', color: 'var(--text)' }}>
                        {formatCurrencyVND(0)}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }} onClick={(e) => e.stopPropagation()}>
                        <div className="crud-actions" style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                          <button
                            className="btn-edit-icon"
                            onClick={() => handleEdit(teacher)}
                            title="Sửa"
                            style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn-delete-icon"
                            onClick={() => handleDelete(teacher.id)}
                            title="Xóa"
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

      {/* Teacher Modal */}
      <Modal
        title={editingTeacher ? 'Chỉnh sửa giáo viên' : 'Thêm giáo viên mới'}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="teacherFullName" className="form-label">
              Họ và tên *
            </label>
            <input
              type="text"
              id="teacherFullName"
              className="form-control"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              placeholder="Nhập họ và tên đầy đủ"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="teacherBirthDate" className="form-label">
              Ngày tháng năm sinh *
            </label>
            <input
              type="date"
              id="teacherBirthDate"
              className="form-control"
              value={formData.birthDate}
              onChange={(e) => {
                const date = e.target.value;
                setFormData({
                  ...formData,
                  birthDate: date,
                  birthYear: date ? new Date(date).getFullYear() : formData.birthYear,
                });
              }}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="teacherUniversity" className="form-label">
                Đại học
              </label>
              <input
                type="text"
                id="teacherUniversity"
                className="form-control"
                value={formData.university}
                onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                placeholder="Tên trường đại học (tùy chọn)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacherHighSchool" className="form-label">
                Trường THPT *
              </label>
              <input
                type="text"
                id="teacherHighSchool"
                className="form-control"
                value={formData.highSchool}
                onChange={(e) => setFormData({ ...formData, highSchool: e.target.value })}
                required
                placeholder="Tên trường THPT"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="teacherEmail" className="form-label">
                Email *
              </label>
              <input
                type="email"
                id="teacherEmail"
                className="form-control"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="email@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="teacherPhone" className="form-label">
                Số điện thoại *
              </label>
              <input
                type="tel"
                id="teacherPhone"
                className="form-control"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="0912345678"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="teacherSpecialization" className="form-label">
              Mô tả chuyên môn *
            </label>
            <textarea
              id="teacherSpecialization"
              className="form-control"
              rows={4}
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              required
              placeholder="Mô tả chi tiết về môn dạy, kinh nghiệm, thế mạnh của giáo viên..."
            />
            <small className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
              Nhập mô tả chi tiết về chuyên môn, kinh nghiệm giảng dạy, thế mạnh của giáo viên
            </small>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="teacherProvince" className="form-label">
              Tỉnh thành *
            </label>
            <input
              type="text"
              id="teacherProvince"
              className="form-control"
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              required
              placeholder="Tỉnh/Thành phố"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="teacherPhotoUrl" className="form-label">
              Link ảnh đại diện
            </label>
            <input
              type="url"
              id="teacherPhotoUrl"
              className="form-control"
              value={formData.photoUrl}
              onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="teacherStatus" className="form-label">
              Trạng thái
            </label>
            <select
              id="teacherStatus"
              className="form-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTeacher ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Teachers;
