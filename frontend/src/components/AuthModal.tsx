/**
 * Auth Modal Component
 * Login and Register modal - giống code cũ
 * Migrated from backup/assets/js/pages/home.js openHomeAuthModal
 */

import React, { useState } from 'react';
import Modal from './Modal';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { fetchTeachers } from '../services/teachersService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'login' | 'register';
  onModeChange?: (mode: 'login' | 'register') => void;
}

export default function AuthModal({ isOpen, onClose, mode, onModeChange }: AuthModalProps) {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  const isLogin = mode === 'login';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sanitize input (giống code cũ)
      const loginInput = loginEmail.trim();
      const password = loginPassword;

      if (!loginInput || !password) {
        setError('Vui lòng nhập email/handle và mật khẩu');
        setLoading(false);
        return;
      }

      const response = await authService.login({ email: loginInput, password, rememberMe });
      setAuth(response.user, response.token, rememberMe);
      
      // Nếu là user nhân sự (teacher role), tìm staff ID và redirect thẳng đến staff detail
      if (response.user.role === 'teacher') {
        try {
          // Fetch teachers để tìm staff ID
          const teachers = await fetchTeachers();
          const user = response.user;
          
          // Tìm teacher record theo nhiều cách
          let teacherRecord = null;
          
          if (user.linkId) {
            teacherRecord = teachers.find((t) => t.id === user.linkId);
          }
          
          if (!teacherRecord && user.id) {
            teacherRecord = teachers.find((t: any) => t.userId === user.id);
          }
          
          if (!teacherRecord && user.email) {
            teacherRecord = teachers.find((t) => 
              t.email?.toLowerCase() === user.email?.toLowerCase()
            );
          }
          
          if (teacherRecord) {
            // Redirect thẳng đến staff detail
            onClose();
            setTimeout(() => {
              navigate(`/staff/${teacherRecord.id}`, { replace: true });
            }, 100);
            return;
          }
        } catch (err) {
          // Nếu không tìm thấy, fallback về dashboard
          console.warn('[AuthModal] Could not find staff record, redirecting to dashboard');
        }
      }
      
      // Role-based routing (giống code cũ)
      const defaultPage = getDefaultPageForRole(response.user.role);
      onClose();
      
      // Navigate sau khi đóng modal
      setTimeout(() => {
        navigate(defaultPage);
      }, 100);
    } catch (err: any) {
      // Check if it's a rate limit error
      if (err.response?.status === 429) {
        setError(err.response?.data?.message || 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 10 phút.');
      } else {
        // Error message từ authService đã được format
        setError(err.message || 'Đăng nhập thất bại');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (regPassword !== regPasswordConfirm) {
      setError('Mật khẩu và xác nhận không khớp');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register({
        email: regEmail,
        password: regPassword,
        role: 'student',
        profile: {
          fullName: regName,
        },
      });

      setAuth(response.user, response.token, false);
      
      // Role-based routing
      const defaultPage = getDefaultPageForRole(response.user.role);
      onClose();
      navigate(defaultPage);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPageForRole = (role: string) => {
    // Tất cả user đều redirect đến dashboard sau khi đăng nhập
    return '/dashboard';
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    // TODO: Show toast notification
    alert('Liên hệ admin để đặt lại mật khẩu.');
  };

  return (
    <Modal
      title={isLogin ? 'Đăng nhập' : 'Đăng ký tài khoản'}
      isOpen={isOpen}
      onClose={onClose}
      size="md"
    >
      <form className="home-auth-form" onSubmit={isLogin ? handleLogin : handleRegister}>
        {error && (
          <div className="text-danger text-sm" style={{ padding: 'var(--spacing-2)', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius)', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: 'var(--spacing-3)' }}>
            {error}
          </div>
        )}

        {isLogin ? (
          <>
            <div className="form-group">
              <label htmlFor="homeAuthEmail">Email / Tên đăng nhập</label>
              <input
                id="homeAuthEmail"
                className="form-control"
                type="text"
                required
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="homeAuthPassword">Mật khẩu</label>
              <input
                id="homeAuthPassword"
                className="form-control"
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="rememberMe" style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer', userSelect: 'none' }}>
                Remember me for a month
              </label>
            </div>
            <div className="form-actions mt-4">
              <button type="button" className="btn" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </button>
            </div>
            <div className="text-right mt-2">
              <a href="#" className="text-sm" onClick={handleForgotPassword} style={{ color: 'var(--muted)' }}>
                Quên mật khẩu?
              </a>
            </div>
            {onModeChange && (
              <div className="text-center mt-3">
                <span className="text-sm text-muted">Chưa có tài khoản? </span>
                <button
                  type="button"
                  className="text-sm"
                  onClick={() => onModeChange('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Đăng ký ngay
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="homeRegName">Họ tên</label>
              <input
                id="homeRegName"
                className="form-control"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="homeRegEmail">Email</label>
              <input
                id="homeRegEmail"
                className="form-control"
                type="email"
                required
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="homeRegPassword">Mật khẩu</label>
              <input
                id="homeRegPassword"
                className="form-control"
                type="password"
                required
                autoComplete="new-password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="homeRegPasswordConfirm">Xác nhận mật khẩu</label>
              <input
                id="homeRegPasswordConfirm"
                className="form-control"
                type="password"
                required
                autoComplete="new-password"
                value={regPasswordConfirm}
                onChange={(e) => setRegPasswordConfirm(e.target.value)}
              />
            </div>
            <div className="form-actions mt-4">
              <button type="button" className="btn" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Đang đăng ký...' : 'Đăng ký'}
              </button>
            </div>
            <p className="text-muted text-sm mt-2">
              Đăng ký mặc định với vai trò Học sinh. Liên hệ admin nếu bạn là giáo viên.
            </p>
            {onModeChange && (
              <div className="text-center mt-3">
                <span className="text-sm text-muted">Đã có tài khoản? </span>
                <button
                  type="button"
                  className="text-sm"
                  onClick={() => onModeChange('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Đăng nhập ngay
                </button>
              </div>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}

