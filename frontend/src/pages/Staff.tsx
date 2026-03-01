import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers, createTeacher, Teacher } from '../services/teachersService';
import { getStaffUnpaidAmounts } from '../services/staffService';
import { useAuthStore } from '../store/authStore';
import { hasRole, userHasStaffRole } from '../utils/permissions';
import { formatCurrencyVND, formatNumber } from '../utils/formatters';
import { SkeletonLoader } from '../components/SkeletonLoader';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';

/**
 * Staff Page Component - Nhân sự
 * Migrated from backup/assets/js/pages/staff.js
 * UI giống hệt app cũ với tabs: Tất cả, Gia sư, Giáo án, Kế toán, CSKH&SALE, Truyền thông
 */

const STAFF_ROLES = {
  TEACHER: 'teacher',
  LESSON_PLAN: 'lesson_plan',
  ACCOUNTANT: 'accountant',
  CSKH_SALE: 'cskh_sale',
  COMMUNICATION: 'communication',
};

const STAFF_ROLE_LABELS: Record<string, string> = {
  [STAFF_ROLES.TEACHER]: 'Gia sư',
  [STAFF_ROLES.LESSON_PLAN]: 'Giáo án',
  [STAFF_ROLES.ACCOUNTANT]: 'Kế toán',
  [STAFF_ROLES.CSKH_SALE]: 'CSKH & SALE',
  [STAFF_ROLES.COMMUNICATION]: 'Truyền thông',
};

const STAFF_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'teacher', label: STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER] },
  { id: 'lesson_plan', label: STAFF_ROLE_LABELS[STAFF_ROLES.LESSON_PLAN] },
  { id: 'accountant', label: STAFF_ROLE_LABELS[STAFF_ROLES.ACCOUNTANT] },
  { id: 'cskh_sale', label: STAFF_ROLE_LABELS[STAFF_ROLES.CSKH_SALE] },
  { id: 'communication', label: STAFF_ROLE_LABELS[STAFF_ROLES.COMMUNICATION] },
];

function Staff() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('all');
  const [status, setStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
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
      cacheKey: 'staff',
      staleTime: 2 * 60 * 1000,
    }
  );

  // Ensure teachers is always an array
  const teachers = Array.isArray(data) ? data : [];

  // Check if user is tutor (teacher staff role)
  const isTutor = userHasStaffRole('teacher', user, teachers);
  const isAdmin = hasRole('admin');
  const isAccountant = hasRole('accountant');

  // Redirect teacher (tutor) away from staff list page - only admin and accountant can access
  useEffect(() => {
    if (user?.role === 'teacher' && isTutor && !isAdmin && !isAccountant) {
      // Redirect to dashboard (will redirect to staff-detail)
      navigate('/dashboard', { replace: true });
    }
  }, [user, isTutor, isAdmin, isAccountant, navigate, teachers]);

  // Unpaid amounts will be loaded via useDataLoading hook below

  // Fetch unpaid amounts when teachers data changes
  // Use useDataLoading for caching and better performance
  const fetchUnpaidAmountsFn = useCallback(async () => {
    if (teachers.length === 0) return {};
    const staffIds = teachers.map((t) => t.id);
    return await getStaffUnpaidAmounts(staffIds);
  }, [teachers]);

  const { data: unpaidAmountsData, isLoading: isLoadingUnpaid, refetch: refetchUnpaidAmounts } = useDataLoading(
    fetchUnpaidAmountsFn,
    [teachers.length > 0 ? teachers.map(t => t.id).join(',') : ''],
    {
      cacheKey: 'staff-unpaid-amounts',
      staleTime: 10 * 1000, // Giảm cache time xuống 10 giây để cập nhật nhanh hơn
      persistCache: false, // Không persist để tránh cache cũ
      enabled: teachers.length > 0,
      refetchInterval: 30 * 1000, // Tự động refetch mỗi 30 giây
    }
  );

  const unpaidAmounts = unpaidAmountsData || {};

  // Refetch unpaid amounts when component becomes visible (user navigates back from detail page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && teachers.length > 0) {
        // Refetch when page becomes visible (user quay lại từ tab khác)
        refetchUnpaidAmounts();
      }
    };

    const handleFocus = () => {
      if (teachers.length > 0) {
        // Refetch when window gains focus (user quay lại từ window khác)
        refetchUnpaidAmounts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetchUnpaidAmounts, teachers.length]);

  // Refetch when navigating to this page (using location change)
  const location = window.location;
  useEffect(() => {
    if (teachers.length > 0) {
      // Small delay to ensure page is fully loaded
      const timeoutId = setTimeout(() => {
        refetchUnpaidAmounts();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, refetchUnpaidAmounts, teachers.length]);

  // Get unique provinces for filter
  const provinces = React.useMemo(() => {
    const uniqueProvinces = new Set<string>();
    teachers.forEach((s) => {
      if (s.province) uniqueProvinces.add(s.province);
    });
    return Array.from(uniqueProvinces).sort();
  }, [teachers]);

  const filterStaffByTab = useCallback((staffList: Teacher[], tab: string) => {
    if (tab === 'all') return staffList;
    if (tab === 'teacher') {
      return staffList.filter((staff) => {
        const roles = staff.roles || [];
        return roles.length === 0 || roles.includes(STAFF_ROLES.TEACHER);
      });
    }
    const roleKey = Object.values(STAFF_ROLES).find((r) => r === tab);
    if (!roleKey) return staffList;
    return staffList.filter((staff) => {
      const roles = staff.roles || [];
      return roles.includes(roleKey);
    });
  }, []);

  const filteredStaff = React.useMemo(() => {
    let result = filterStaffByTab(teachers, activeTab);

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.fullName || '').toLowerCase().includes(searchLower) ||
          (s.email || '').toLowerCase().includes(searchLower) ||
          (s.province || '').toLowerCase().includes(searchLower)
      );
    }

    if (province !== 'all') {
      result = result.filter((s) => s.province === province);
    }

    if (status !== 'all') {
      result = result.filter((s) => {
        const staffStatus = s.status || 'active';
        return staffStatus === status;
      });
    }

    return result;
  }, [teachers, activeTab, search, province, status, filterStaffByTab]);

  const handleStaffClick = (staffId: string) => {
    navigate(`/staff/${staffId}`);
  };

  const handleOpenAddModal = () => {
    setAddFormData({
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
      status: 'active',
      roles: [],
    });
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const teacherData: any = {
        fullName: addFormData.fullName.trim(),
        province: addFormData.province.trim(),
        status: addFormData.status,
      };
      if (addFormData.birthDate) {
        teacherData.birthDate = addFormData.birthDate;
      } else if (addFormData.birthYear) {
        teacherData.birthYear = addFormData.birthYear;
      }
      if (addFormData.university) teacherData.university = addFormData.university.trim();
      if (addFormData.highSchool) teacherData.highSchool = addFormData.highSchool.trim();
      if (addFormData.email) teacherData.email = addFormData.email.trim();
      if (addFormData.phone) teacherData.phone = addFormData.phone.trim();
      if (addFormData.specialization) teacherData.specialization = addFormData.specialization.trim();
      if (addFormData.photoUrl) teacherData.photoUrl = addFormData.photoUrl.trim();
      if (addFormData.roles && addFormData.roles.length > 0) teacherData.roles = addFormData.roles;

      await createTeacher(teacherData);
      setShowAddModal(false);
      toast.success('Đã thêm nhân sự mới');
      refetch();
    } catch (err: any) {
      toast.error('Lỗi khi thêm nhân sự: ' + (err.response?.data?.error || err.message || 'Lỗi không xác định'));
    }
  };

  if (error) {
    return (
      <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <h2 style={{ color: 'var(--danger)', marginBottom: 'var(--spacing-4)' }}>Lỗi tải dữ liệu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 'var(--spacing-4)' }}>{error.message || 'Không thể tải danh sách nhân sự'}</p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
        <h2>Nhân sự</h2>
        <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Thêm nhân sự
        </button>
      </div>

      {/* Tabs */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className="staff-tabs" style={{ display: 'flex', gap: 'var(--spacing-2)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--spacing-2)' }}>
          {STAFF_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`staff-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: 'var(--spacing-2) var(--spacing-4)',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted)',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label htmlFor="staffSearch" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
              Tìm kiếm
            </label>
            <input
              id="staffSearch"
              type="text"
              className="form-control"
              placeholder="Tên, email, tỉnh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label htmlFor="staffProvince" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
              Tỉnh/Thành phố
            </label>
            <select id="staffProvince" className="form-control" value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="all">Tất cả</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label htmlFor="staffStatus" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
              Trạng thái
            </label>
            <select id="staffStatus" className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <div className="spinner" />
            <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>
              Đang tải danh sách nhân sự...
            </p>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
            <p className="text-muted">Không tìm thấy nhân sự nào.</p>
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600' }}>Tên</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600' }}>Vai trò</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'left', fontWeight: '600' }}>Tỉnh/TP</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '600' }}>Chưa thanh toán</th>
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: '600' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff) => {
                  const roles = staff.roles || [];
                  const roleLabels = roles.length > 0 ? roles.map((r) => STAFF_ROLE_LABELS[r] || r).join(', ') : STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER];
                  return (
                    <tr
                      key={staff.id}
                      onClick={() => handleStaffClick(staff.id)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: 'var(--spacing-3)' }}>{staff.fullName || staff.name || 'Chưa có tên'}</td>
                      <td style={{ padding: 'var(--spacing-3)' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>{roleLabels}</span>
                      </td>
                      <td style={{ padding: 'var(--spacing-3)' }}>{staff.province || '-'}</td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'right', fontWeight: '500', minWidth: '120px' }}>
                        {isLoadingUnpaid ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            <div
                              style={{
                                width: '12px',
                                height: '12px',
                                border: '2px solid var(--border)',
                                borderTopColor: '#dc2626',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                              }}
                            />
                            <SkeletonLoader width="80px" height="16px" />
                          </div>
                        ) : (
                          <span style={{ color: unpaidAmounts[staff.id] > 0 ? '#dc2626' : 'var(--muted)' }}>
                            {formatCurrencyVND(unpaidAmounts[staff.id] || 0)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStaffClick(staff.id);
                          }}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      <Modal
        title="Thêm nhân sự mới"
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="md"
      >
        <form onSubmit={handleAddSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="staffFullName" className="form-label">Họ và tên *</label>
            <input
              type="text"
              id="staffFullName"
              className="form-control"
              value={addFormData.fullName}
              onChange={(e) => setAddFormData({ ...addFormData, fullName: e.target.value })}
              required
              placeholder="Nhập họ và tên đầy đủ"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="staffBirthDate" className="form-label">Ngày tháng năm sinh *</label>
            <input
              type="date"
              id="staffBirthDate"
              className="form-control"
              value={addFormData.birthDate}
              onChange={(e) => {
                const date = e.target.value;
                setAddFormData({
                  ...addFormData,
                  birthDate: date,
                  birthYear: date ? new Date(date).getFullYear() : addFormData.birthYear,
                });
              }}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="staffUniversity" className="form-label">Đại học</label>
              <input
                type="text"
                id="staffUniversity"
                className="form-control"
                value={addFormData.university}
                onChange={(e) => setAddFormData({ ...addFormData, university: e.target.value })}
                placeholder="Tên trường đại học (tùy chọn)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="staffHighSchool" className="form-label">Trường THPT *</label>
              <input
                type="text"
                id="staffHighSchool"
                className="form-control"
                value={addFormData.highSchool}
                onChange={(e) => setAddFormData({ ...addFormData, highSchool: e.target.value })}
                required
                placeholder="Tên trường THPT"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)' }}>
            <div className="form-group">
              <label htmlFor="staffEmail" className="form-label">Email *</label>
              <input
                type="email"
                id="staffEmail"
                className="form-control"
                value={addFormData.email}
                onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                required
                placeholder="email@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="staffPhone" className="form-label">Số điện thoại *</label>
              <input
                type="tel"
                id="staffPhone"
                className="form-control"
                value={addFormData.phone}
                onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                required
                placeholder="0912345678"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="staffSpecialization" className="form-label">Mô tả chuyên môn *</label>
            <textarea
              id="staffSpecialization"
              className="form-control"
              rows={4}
              value={addFormData.specialization}
              onChange={(e) => setAddFormData({ ...addFormData, specialization: e.target.value })}
              required
              placeholder="Mô tả chi tiết về môn dạy, kinh nghiệm, thế mạnh..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="staffProvince" className="form-label">Tỉnh thành *</label>
            <input
              type="text"
              id="staffProvince"
              className="form-control"
              value={addFormData.province}
              onChange={(e) => setAddFormData({ ...addFormData, province: e.target.value })}
              required
              placeholder="Tỉnh/Thành phố"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="staffPhotoUrl" className="form-label">Link ảnh đại diện</label>
            <input
              type="url"
              id="staffPhotoUrl"
              className="form-control"
              value={addFormData.photoUrl}
              onChange={(e) => setAddFormData({ ...addFormData, photoUrl: e.target.value })}
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label className="form-label">Vai trò</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
              {Object.entries(STAFF_ROLE_LABELS).map(([role, label]) => (
                <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>
                  <input
                    type="checkbox"
                    checked={addFormData.roles.includes(role)}
                    onChange={(e) => {
                      const newRoles = e.target.checked
                        ? [...addFormData.roles, role]
                        : addFormData.roles.filter((r) => r !== role);
                      setAddFormData({ ...addFormData, roles: newRoles });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
            <label htmlFor="staffStatus" className="form-label">Trạng thái</label>
            <select
              id="staffStatus"
              className="form-control"
              value={addFormData.status}
              onChange={(e) => setAddFormData({ ...addFormData, status: e.target.value as 'active' | 'inactive' })}
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Tạo mới</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Staff;

