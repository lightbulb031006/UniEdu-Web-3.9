/**
 * Register Page
 * Khôi phục UI/UX giống hệt app cũ
 * Migrated from backup/assets/js/auth.js getAuthFormsMarkup()
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    role: 'student',
    classId: '',
    specialization: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  // Load classes for student registration
  useEffect(() => {
    // TODO: Load classes from API
    // For now, use empty array
    setClasses([]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const profile = {
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        classId: formData.role === 'student' ? formData.classId || undefined : undefined,
        specialization: formData.role === 'teacher' ? formData.specialization || undefined : undefined,
      };

      const response = await authService.register({
        email: formData.email,
        password: formData.password,
        role: formData.role,
        profile,
      });

      setAuth(response.user, response.token);
      
      // Role-based routing
      const defaultPage = getDefaultPageForRole(response.user.role);
      navigate(defaultPage);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPageForRole = (role: string) => {
    switch (role) {
      case 'admin':
        return '/dashboard';
      case 'teacher':
        return '/classes';
      case 'student':
        return '/classes';
      default:
        return '/dashboard';
    }
  };

  return (
    <div className="page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--spacing-6)' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', width: '100%', maxWidth: '800px' }}>
        {/* Register Card */}
        <div className="card">
          <h3>Tạo tài khoản</h3>
          <form data-auth="register" className="grid gap-2" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="text-danger text-sm" style={{ padding: 'var(--spacing-2)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {error}
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                className="form-control"
                name="fullName"
                type="text"
                placeholder="Nhập họ và tên đầy đủ"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                className="form-control"
                name="email"
                type="email"
                placeholder="example@email.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Số điện thoại</label>
              <input
                className="form-control"
                name="phone"
                type="tel"
                placeholder="0xxxxxxxxx hoặc +84xxxxxxxxx"
                autoComplete="tel"
                value={formData.phone}
                onChange={handleChange}
              />
              <small className="text-muted text-xs">Tùy chọn, nhưng nên có để nhận thông báo</small>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <input
                className="form-control"
                name="password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                autoComplete="new-password"
                minLength={6}
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Vai trò <span className="text-red-500">*</span>
              </label>
              <select
                className="form-control"
                name="role"
                id="registerRole"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="student">Học sinh</option>
                <option value="teacher">Giáo viên</option>
              </select>
            </div>

            {/* Student Fields */}
            {formData.role === 'student' && (
              <div id="studentFields">
                <div>
                  <label className="text-sm font-medium mb-1 block">Lớp học</label>
                  <select
                    className="form-control"
                    name="classId"
                    value={formData.classId}
                    onChange={handleChange}
                  >
                    <option value="">Chọn lớp (tùy chọn)</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name || cls.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Teacher Fields */}
            {formData.role === 'teacher' && (
              <div id="teacherFields">
                <div>
                  <label className="text-sm font-medium mb-1 block">Chuyên môn</label>
                  <input
                    className="form-control"
                    name="specialization"
                    type="text"
                    placeholder="Ví dụ: Toán, Lý, Hóa, Tin học..."
                    value={formData.specialization}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </form>
        </div>

        {/* Login Card */}
        <div className="card">
          <h3>Đăng nhập</h3>
          <div className="text-muted text-sm mb-3">
            <p>Đã có tài khoản? Đăng nhập ngay.</p>
          </div>
          <Link to="/login" className="btn btn-outline" style={{ width: '100%' }}>
            Đi tới trang đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

