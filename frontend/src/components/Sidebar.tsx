import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';

// Export version constant
export const APP_VERSION = '3.9.2';

interface MenuItem {
  path: string;
  label: string;
  icon: string | string[];
  roles?: string[];
  excludeRoles?: string[];
  requireStaffRole?: string;
  showOnlyForAdmin?: boolean;
}

interface SidebarProps {
  menuItems: MenuItem[];
  user: any;
  onLogout: () => void;
  onProfileClick: () => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

/**
 * Sidebar Component - Khôi phục từ backup
 * Giống hệt sidebar ban đầu trong backup/index.html
 */
export function Sidebar({ menuItems, user, onLogout, onProfileClick, onCollapseChange }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, THEME_DEFAULT, THEME_DARK, THEME_SAKURA } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Chỉ auto collapse trên mobile, desktop giữ nguyên state
      if (mobile) {
        setIsCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Notify parent when collapse state changes
  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  const isActive = (path: string) => location.pathname === path;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Quản trị viên',
      teacher: 'Giáo viên',
      student: 'Học sinh',
      assistant: 'Trợ lý',
      visitor: 'Khách',
    };
    return labels[role] || role.toUpperCase();
  };

  // Width: tối thiểu vừa đủ chứa icon khi collapsed
  const sidebarWidth = isCollapsed ? '56px' : '240px';
  const transitionDuration = '0.3s';

  return (
    <>
      {/* Mobile overlay when sidebar is open */}
      {isMobile && !isCollapsed && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsCollapsed(true)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 998,
            transition: `opacity ${transitionDuration} ease-in-out`,
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className="sidebar"
        style={{
          width: sidebarWidth,
          flex: `0 0 ${sidebarWidth}`,
          transition: `width ${transitionDuration} ease-in-out`,
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          maxHeight: '100vh',
          zIndex: 999,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: isCollapsed ? 'var(--spacing-3)' : 'var(--spacing-5) var(--spacing-4)',
          overflow: 'hidden',
        }}
      >
        {/* Brand Section - Giống backup */}
        {!isCollapsed && (
          <div
            className="brand"
            style={{
              marginBottom: 'var(--spacing-6)',
              paddingBottom: 'var(--spacing-4)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-3)',
              opacity: isCollapsed ? 0 : 1,
              transition: `opacity ${transitionDuration} ease-in-out`,
              overflow: 'hidden',
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{ color: 'var(--primary)', flexShrink: 0 }}
            >
              <path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" fill="currentColor" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)', color: 'var(--text)' }}>
                Unicorns Edu
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
                Version {APP_VERSION}
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button (Desktop - top right corner) */}
        {!isMobile && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              transition: `all ${transitionDuration} ease-in-out`,
              opacity: 0.7,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.background = 'var(--surface)';
            }}
            aria-label={isCollapsed ? 'Mở sidebar' : 'Đóng sidebar'}
            title={isCollapsed ? 'Mở sidebar' : 'Đóng sidebar'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: `transform ${transitionDuration} ease-in-out`,
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Toggle Button (Mobile) */}
        {isMobile && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              position: 'absolute',
              top: isCollapsed ? '8px' : '8px',
              right: isCollapsed ? '-40px' : '-12px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              transition: `right ${transitionDuration} ease-in-out, top ${transitionDuration} ease-in-out`,
              boxShadow: 'var(--shadow-sm)',
            }}
            aria-label={isCollapsed ? 'Mở sidebar' : 'Đóng sidebar'}
            title={isCollapsed ? 'Mở sidebar' : 'Đóng sidebar'}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: `transform ${transitionDuration} ease-in-out`,
              }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        {/* Navigation - Tất cả items trong cùng một nav, giống backup */}
        <nav
          className="tabs"
          role="tablist"
          aria-label="Sidebar Navigation"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: isCollapsed ? '4px' : '8px',
            paddingRight: '2px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {menuItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                className={`tab ${active ? 'active' : ''}`}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) {
                    setIsCollapsed(true);
                  }
                }}
                type="button"
                aria-current={active ? 'page' : undefined}
                title={isCollapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  textAlign: isCollapsed ? 'center' : 'left',
                  padding: isCollapsed ? 'var(--spacing-2)' : 'var(--spacing-2) var(--spacing-3)',
                  border: 'none',
                  background: active
                    ? 'linear-gradient(90deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.08) 100%)'
                    : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--muted)',
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: `all 0.2s ease-in-out`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: isCollapsed ? '0' : 'var(--spacing-2)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: active ? 600 : 500,
                  minHeight: '42px',
                  position: 'relative',
                  boxShadow: active ? 'inset 0 0 0 1px rgba(59,130,246,0.25)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.boxShadow = 'inset 0 0 0 1px rgba(59,130,246,0.15)';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) {
                      svg.style.opacity = '1';
                      svg.style.color = 'inherit';
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted)';
                    e.currentTarget.style.boxShadow = 'none';
                    const svg = e.currentTarget.querySelector('svg');
                    if (svg) {
                      svg.style.opacity = '0.7';
                    }
                  }
                }}
              >
                {/* Active indicator bar - giống backup */}
                {active && (
                  <div
                    style={{
                      content: '',
                      position: 'absolute',
                      left: '-6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '6px',
                      height: '60%',
                      background: 'var(--primary)',
                      borderRadius: '0 var(--radius) var(--radius) 0',
                      boxShadow: '0 8px 20px rgba(59,130,246,0.3)',
                    }}
                  />
                )}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    flexShrink: 0,
                    opacity: active ? 1 : 0.7,
                    transition: 'opacity 0.2s ease-in-out',
                  }}
                >
                  {Array.isArray(item.icon) ? item.icon.map((path, idx) => <path key={idx} d={path} />) : <path d={item.icon} />}
                </svg>
                {!isCollapsed && (
                  <span
                    style={{
                      opacity: isCollapsed ? 0 : 1,
                      transition: `opacity ${transitionDuration} ease-in-out`,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Actions Section - Theme Switcher + User Section */}
        <div
          className="actions"
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingTop: 'var(--spacing-4)',
            borderTop: '1px solid var(--border)',
          }}
        >
          {/* Theme Switcher */}
          <div
            className="theme-switcher"
            style={{
              display: 'flex',
              flexDirection: isCollapsed ? 'column' : 'row',
              gap: '4px',
              alignItems: isCollapsed ? 'center' : 'flex-start',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              transition: `flex-direction ${transitionDuration} ease-in-out, gap ${transitionDuration} ease-in-out`,
            }}
          >
            <button
              className={`btn theme-btn theme-icon-only ${theme === THEME_DEFAULT ? 'theme-active' : ''}`}
              data-theme-option="light"
              onClick={() => setTheme(THEME_DEFAULT)}
              aria-label="Chế độ sáng"
              title={isCollapsed ? 'Chế độ sáng' : undefined}
              style={{
                padding: isCollapsed ? '8px' : '6px',
                border: 'none',
                background: theme === THEME_DEFAULT ? 'var(--primary)' : 'transparent',
                color: theme === THEME_DEFAULT ? 'var(--primary-contrast)' : 'var(--muted)',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: `all ${transitionDuration} ease-in-out`,
                width: isCollapsed ? '100%' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: isCollapsed ? '18px' : '16px' }}>☀️</span>
            </button>
            <button
              className={`btn theme-btn theme-icon-only ${theme === THEME_DARK ? 'theme-active' : ''}`}
              data-theme-option="dark"
              onClick={() => setTheme(THEME_DARK)}
              aria-label="Chế độ tối"
              title={isCollapsed ? 'Chế độ tối' : undefined}
              style={{
                padding: isCollapsed ? '8px' : '6px',
                border: 'none',
                background: theme === THEME_DARK ? 'var(--primary)' : 'transparent',
                color: theme === THEME_DARK ? 'var(--primary-contrast)' : 'var(--muted)',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: `all ${transitionDuration} ease-in-out`,
                width: isCollapsed ? '100%' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: isCollapsed ? '18px' : '16px' }}>🌙</span>
            </button>
            <button
              className={`btn theme-btn theme-icon-only ${theme === THEME_SAKURA ? 'theme-active' : ''}`}
              data-theme-option="sakura"
              onClick={() => setTheme(THEME_SAKURA)}
              aria-label="Hoa Anh Đào"
              title={isCollapsed ? 'Hoa Anh Đào' : undefined}
              style={{
                padding: isCollapsed ? '8px' : '6px',
                border: 'none',
                background: theme === THEME_SAKURA ? 'var(--primary)' : 'transparent',
                color: theme === THEME_SAKURA ? 'var(--primary-contrast)' : 'var(--muted)',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: `all ${transitionDuration} ease-in-out`,
                width: isCollapsed ? '100%' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: isCollapsed ? '18px' : '16px' }}>🌸</span>
            </button>
          </div>

          {/* User Section - Ẩn khi collapsed */}
          {user && !isCollapsed && (
            <div
              className="sidebar-user-section"
              style={{
                paddingTop: 'var(--spacing-4)',
                borderTop: '1px solid var(--border)',
                marginTop: 'var(--spacing-4)',
                opacity: isCollapsed ? 0 : 1,
                transition: `opacity ${transitionDuration} ease-in-out`,
                overflow: 'hidden',
              }}
            >
              <div
                className="user-account-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <button
                  className="user-account-btn"
                  onClick={onProfileClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius)',
                    flex: 1,
                    transition: `all ${transitionDuration} ease-in-out`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  title="Thông tin tài khoản"
                  aria-label="Thông tin tài khoản"
                >
                  <div className="user-avatar" style={{ flexShrink: 0 }}>
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="8" r="4" />
                      <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                    </svg>
                  </div>
                  <div
                    className="user-info-content"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      flex: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <div className="user-name" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                      {user.name || user.email || 'Admin'}
                    </div>
                    <div className="user-role" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>
                      {getRoleLabel(user.role || 'admin')}
                    </div>
                  </div>
                </button>
                <button
                  className="logout-btn btn-icon-only"
                  onClick={onLogout}
                  title="Đăng xuất"
                  aria-label="Đăng xuất"
                  type="button"
                  style={{
                    padding: '6px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius)',
                    transition: `all ${transitionDuration} ease-in-out`,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* User Icon khi collapsed */}
          {user && isCollapsed && (
            <button
              className="user-icon-collapsed"
              onClick={onProfileClick}
              title="Thông tin tài khoản"
              aria-label="Thông tin tài khoản"
              style={{
                padding: '8px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: 'var(--radius)',
                transition: `all ${transitionDuration} ease-in-out`,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 'var(--spacing-2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
              </svg>
            </button>
          )}

        </div>
      </aside>
    </>
  );
}
