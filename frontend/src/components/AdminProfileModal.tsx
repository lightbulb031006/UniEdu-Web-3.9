/**
 * Admin Profile Modal Component
 * Form để admin đổi thông tin đăng nhập (email, password)
 * Migrated from backup/assets/js/ui.js
 */

import React, { useState } from 'react';
import Modal from './Modal';
import api from '../services/api';

interface AdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
}

export default function AdminProfileModal({ isOpen, onClose, currentEmail }: AdminProfileModalProps) {
  const [formData, setFormData] = useState({
    email: currentEmail,
    oldPassword: '',
    newPassword: '',
  });
  const [errors, setErrors] = useState<{ oldPassword?: string; newPassword?: string; email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Validate
      if (!formData.email.trim()) {
        setErrors({ email: 'Email không được để trống' });
        setIsSubmitting(false);
        return;
      }

      if (!formData.oldPassword.trim()) {
        setErrors({ oldPassword: 'Vui lòng nhập mật khẩu cũ để xác thực' });
        setIsSubmitting(false);
        return;
      }

      if (formData.newPassword.trim() && (formData.newPassword.length < 6 || formData.newPassword.length > 8)) {
        setErrors({ newPassword: 'Mật khẩu mới phải có từ 6-8 ký tự' });
        setIsSubmitting(false);
        return;
      }

      // Call API to update admin profile
      const payload: any = {
        email: formData.email.trim(),
        oldPassword: formData.oldPassword,
      };

      if (formData.newPassword.trim()) {
        payload.newPassword = formData.newPassword;
      }

      await api.put('/auth/profile', payload);

      alert('Đã cập nhật thông tin đăng nhập thành công');
      onClose();
      setFormData({
        email: currentEmail,
        oldPassword: '',
        newPassword: '',
      });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Không thể cập nhật thông tin';
      if (message.includes('mật khẩu') || message.includes('password')) {
        setErrors({ oldPassword: message });
      } else if (message.includes('email')) {
        setErrors({ email: message });
      } else {
        alert('Lỗi: ' + message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      email: currentEmail,
      oldPassword: '',
      newPassword: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Modal title="Đổi thông tin đăng nhập" isOpen={isOpen} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="adminEmail" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
            Email đăng nhập *
          </label>
          <input
            id="adminEmail"
            type="email"
            className="form-control"
            value={formData.email}
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            placeholder="email@example.com"
            required
            autoComplete="email"
          />
          <small className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            Email dùng để đăng nhập vào hệ thống
          </small>
          {errors.email && <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)' }}>{errors.email}</div>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="adminOldPassword" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
            Mật khẩu cũ *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="adminOldPassword"
              type={showOldPassword ? 'text' : 'password'}
              className="form-control"
              value={formData.oldPassword}
              onChange={(e) => {
                setFormData({ ...formData, oldPassword: e.target.value });
                if (errors.oldPassword) setErrors({ ...errors, oldPassword: undefined });
              }}
              placeholder="Nhập mật khẩu hiện tại"
              required
              autoComplete="off"
              style={{ paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowOldPassword(!showOldPassword)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--muted)',
              }}
              aria-label={showOldPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              title={showOldPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showOldPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <small className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            Nhập mật khẩu hiện tại để xác thực
          </small>
          {errors.oldPassword && <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)' }}>{errors.oldPassword}</div>}
        </div>

        <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="adminPassword" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
            Mật khẩu mới
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="adminPassword"
              type={showNewPassword ? 'text' : 'password'}
              className="form-control"
              value={formData.newPassword}
              onChange={(e) => {
                setFormData({ ...formData, newPassword: e.target.value });
                if (errors.newPassword) setErrors({ ...errors, newPassword: undefined });
              }}
              placeholder="Nhập mật khẩu mới (để trống nếu không đổi)"
              autoComplete="new-password"
              style={{ paddingRight: '40px' }}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--muted)',
              }}
              aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showNewPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <small className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'var(--spacing-1)', fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            Mật khẩu mới phải có từ 6-8 ký tự, bao gồm chữ cái và số
          </small>
          {errors.newPassword && <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)' }}>{errors.newPassword}</div>}
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
          <button type="button" className="btn btn-outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', marginRight: '8px' }} />
                Đang lưu...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

