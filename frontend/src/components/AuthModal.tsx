/**
 * Auth Modal Component
 * Login and Register modal - giống code cũ
 * Migrated from backup/assets/js/pages/home.js openHomeAuthModal
 */

import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { fetchTeachers } from '../services/teachersService';
import { toast } from '../utils/toast';

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
  
  // Track failed login attempts
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  
  // Check lock status on mount
  useEffect(() => {
    const lockData = localStorage.getItem('loginLock');
    if (lockData) {
      const { lockUntil: storedLockUntil, attempts } = JSON.parse(lockData);
      const now = Date.now();
      
      if (storedLockUntil > now) {
        // Still locked
        setIsLocked(true);
        setLockUntil(storedLockUntil);
        setFailedAttempts(attempts || 0);
        
        const minutesLeft = Math.ceil((storedLockUntil - now) / (60 * 1000));
        toast.error(`Tài khoản bị khóa. Vui lòng thử lại sau ${minutesLeft} phút.`, 5000);
      } else {
        // Lock expired, clear it
        localStorage.removeItem('loginLock');
        setFailedAttempts(0);
        setIsLocked(false);
        setLockUntil(null);
      }
    }
  }, []);

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
      // Check if account is locked
      if (isLocked && lockUntil && lockUntil > Date.now()) {
        const minutesLeft = Math.ceil((lockUntil - Date.now()) / (60 * 1000));
        // Only show toast, don't set error in form
        toast.error(`Tài khoản bị khóa. Vui lòng thử lại sau ${minutesLeft} phút.`, 5000);
        setLoading(false);
        return;
      }

      // Sanitize input (giống code cũ)
      const loginInput = loginEmail.trim();
      const password = loginPassword;

      if (!loginInput || !password) {
        // Only show toast for validation errors too
        toast.warning('Vui lòng nhập email/handle và mật khẩu', 3000);
        setLoading(false);
        return;
      }

      const response = await authService.login({ email: loginInput, password, rememberMe });
      
      // Login successful - clear failed attempts
      localStorage.removeItem('loginLock');
      setFailedAttempts(0);
      setIsLocked(false);
      setLockUntil(null);
      
      // Set auth first to ensure state is saved before navigation
      setAuth(response.user, response.token, rememberMe);
      
      // Wait a bit to ensure storage is written (especially for sessionStorage)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Nếu là user nhân sự (teacher role), redirect thẳng đến staff detail
      if (response.user.role === 'teacher') {
        const user = response.user;
        
        // Nếu có linkId, redirect ngay lập tức
        if (user.linkId) {
          onClose();
          setTimeout(() => {
            navigate(`/staff/${user.linkId}`, { replace: true });
          }, 100);
          return;
        }
        
        // Nếu không có linkId, fetch teachers để tìm staff ID
        try {
          const teachers = await fetchTeachers();
          
          // Tìm teacher record theo userId hoặc email
          let teacherRecord = null;
          
          if (user.id) {
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
            // Wait a bit more to ensure auth state is fully initialized
            setTimeout(() => {
              navigate(`/staff/${teacherRecord.id}`, { replace: true });
            }, 200);
            return;
          } else {
            // Nếu không tìm thấy teacher record, log và fallback
            console.warn('[AuthModal] Teacher record not found for user:', {
              userId: user.id,
              email: user.email,
              teachersCount: teachers.length,
            });
            onClose();
            setTimeout(() => {
              navigate('/home', { replace: true });
            }, 200);
            return;
          }
        } catch (err) {
          // Nếu có lỗi khi fetch teachers, log và fallback về home
          console.error('[AuthModal] Error fetching teachers:', err);
          onClose();
          setTimeout(() => {
            navigate('/home', { replace: true });
          }, 200);
          return;
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
      // Check if it's a rate limit error (account locked)
      if (err.response?.status === 429) {
        const lockDuration = 30 * 60 * 1000; // 30 minutes
        const lockUntil = Date.now() + lockDuration;
        
        setIsLocked(true);
        setLockUntil(lockUntil);
        setFailedAttempts(5);
        
        // Store lock info
        localStorage.setItem('loginLock', JSON.stringify({
          lockUntil,
          attempts: 5,
        }));
        
        const errorMsg = err.response?.data?.message || 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 30 phút.';
        // Don't set error in form, only show toast
        toast.error(errorMsg, 5000);
        // Clear password for security, keep email
        setLoginPassword('');
      } else {
        // Increment failed attempts
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        
        // Show toast for each failed attempt
        const remainingAttempts = 5 - newAttempts;
        if (remainingAttempts > 0) {
          toast.warning(`Mật khẩu sai. Còn ${remainingAttempts} lần thử trước khi bị khóa.`, 4000);
        } else {
          // This shouldn't happen (should be caught by 429), but just in case
          toast.error('Đã vượt quá số lần thử. Tài khoản sẽ bị khóa trong 30 phút.', 5000);
        }
        
        // Don't set error in form, only show toast
        // Clear password for security, keep email
        setLoginPassword('');
      }
    } finally {
      setLoading(false);
      // Form stays open - don't close modal on error
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
        {/* Only show error in form for register form, login errors use toast only */}
        {error && !isLogin && (
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

