import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../utils/toast';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers, createTeacher, Teacher } from '../services/teachersService';
import { getStaffUnpaidAmounts } from '../services/staffService';
import { useAuthStore } from '../store/authStore';
import { hasRole, userHasStaffRole } from '../utils/permissions';
import { formatCurrencyVND, formatNumber } from '../utils/formatters';
import { SkeletonLoader } from '../components/SkeletonLoader';

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
  const [deductionPercent, setDeductionPercent] = useState<number>(() => {
    const saved = localStorage.getItem('staff_deduction_percent');
    return saved ? Number(saved) : 0;
  });
  const [individualDeductions, setIndividualDeductions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('staff_individual_deductions');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    province: '',
    university: '',
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

  const unpaidAmounts = (unpaidAmountsData as any)?.totals || unpaidAmountsData || {};
  const unpaidBreakdown = (unpaidAmountsData as any)?.breakdown || {};

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

  const handleAddStaff = async () => {
    if (!addForm.fullName.trim()) {
      toast.error('Vui lòng nhập tên nhân sự');
      return;
    }
    setAddSubmitting(true);
    try {
      await createTeacher({
        fullName: addForm.fullName.trim(),
        email: addForm.email.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        province: addForm.province.trim() || undefined,
        university: addForm.university.trim() || undefined,
        roles: addForm.roles.length > 0 ? addForm.roles : undefined,
        status: 'active',
      });
      toast.success('Đã thêm nhân sự thành công');
      setShowAddModal(false);
      setAddForm({ fullName: '', email: '', phone: '', province: '', university: '', roles: [] });
      refetch();
    } catch (error: any) {
      toast.error('Không thể thêm nhân sự: ' + (error.response?.data?.error || error.message));
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleStaffClick = (staffId: string) => {
    navigate(`/staff/${staffId}`);
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
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
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
                  <th style={{ padding: 'var(--spacing-3)', textAlign: 'center', fontWeight: '600', minWidth: '120px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span>Khấu trừ</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          id="deductionPercentInput"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={deductionPercent}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            setDeductionPercent(val);
                            localStorage.setItem('staff_deduction_percent', String(val));
                            // Reset all individual overrides to the new global value
                            setIndividualDeductions({});
                            localStorage.removeItem('staff_individual_deductions');
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '52px',
                            padding: '2px 4px',
                            fontSize: 'var(--font-size-sm)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            textAlign: 'center',
                            fontWeight: '600',
                            background: 'var(--surface)',
                            color: 'var(--primary)',
                          }}
                        />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--muted)' }}>%</span>
                      </div>
                    </div>
                  </th>
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
                          <span style={{ color: (() => { const bd = unpaidBreakdown[staff.id]; const d = individualDeductions[staff.id] ?? deductionPercent; if (bd) return Math.round(bd.classesAndWork * (100 - d) / 100) + bd.bonuses; return Math.round((unpaidAmounts[staff.id] || 0) * (100 - d) / 100); })() > 0 ? '#dc2626' : 'var(--muted)' }}>
                            {formatCurrencyVND((() => { const bd = unpaidBreakdown[staff.id]; const d = individualDeductions[staff.id] ?? deductionPercent; if (bd) return Math.round(bd.classesAndWork * (100 - d) / 100) + bd.bonuses; return Math.round((unpaidAmounts[staff.id] || 0) * (100 - d) / 100); })())}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'center', minWidth: '80px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={individualDeductions[staff.id] ?? deductionPercent}
                            onChange={(e) => {
                              e.stopPropagation();
                              const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              const updated = { ...individualDeductions, [staff.id]: val };
                              setIndividualDeductions(updated);
                              localStorage.setItem('staff_individual_deductions', JSON.stringify(updated));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '48px',
                              padding: '2px 4px',
                              fontSize: 'var(--font-size-sm)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)',
                              textAlign: 'center',
                              fontWeight: '500',
                              background: (individualDeductions[staff.id] != null && individualDeductions[staff.id] !== deductionPercent) ? '#fef3c7' : 'var(--surface)',
                              color: 'var(--text)',
                            }}
                          />
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>%</span>
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-3)', textAlign: 'center' }}>
                        <button
                          className="btn btn-sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const name = staff.fullName || (staff as any).name || 'nhân sự này';
                            if (!window.confirm(`Bạn có chắc chắn muốn xóa "${name}"?`)) return;
                            try {
                              await deleteTeacher(staff.id);
                              toast.success(`Đã xóa "${name}"`);
                              refetch();
                            } catch (err: any) {
                              toast.error('Không thể xóa: ' + (err.response?.data?.error || err.message));
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Xóa
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
      {showAddModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{ width: '480px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', padding: 'var(--spacing-6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Thêm nhân sự mới</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Họ tên *</label>
                <input className="form-control" value={addForm.fullName} onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })} placeholder="Nhập họ tên" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Email</label>
                <input className="form-control" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Số điện thoại</label>
                <input className="form-control" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} placeholder="0912345678" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Tỉnh/Thành phố</label>
                <input className="form-control" value={addForm.province} onChange={(e) => setAddForm({ ...addForm, province: e.target.value })} placeholder="Hà Nội, TP.HCM..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Trường đại học</label>
                <input className="form-control" value={addForm.university} onChange={(e) => setAddForm({ ...addForm, university: e.target.value })} placeholder="Nhập trường" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Vai trò</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                  {Object.entries(STAFF_ROLE_LABELS).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={addForm.roles.includes(key)}
                        onChange={(e) => {
                          const newRoles = e.target.checked
                            ? [...addForm.roles, key]
                            : addForm.roles.filter((r) => r !== key);
                          setAddForm({ ...addForm, roles: newRoles });
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
              <button className="btn btn-outline" onClick={() => setShowAddModal(false)} disabled={addSubmitting}>Hủy</button>
              <button className="btn btn-primary" onClick={handleAddStaff} disabled={addSubmitting}>
                {addSubmitting ? 'Đang lưu...' : 'Thêm nhân sự'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Staff;

