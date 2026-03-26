import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../hooks/useTheme';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers } from '../services/teachersService';
import { userHasStaffRole } from '../utils/permissions';
import AdminProfileModal from './AdminProfileModal';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Layout Component - Giống hệt app cũ
 * Migrated from backup/index.html
 */
function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { theme, setTheme, THEME_DEFAULT, THEME_DARK, THEME_SAKURA } = useTheme();
  const [isAdminProfileModalOpen, setIsAdminProfileModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = user?.role === 'admin';
  const isLandingPage = location.pathname === '/' || location.pathname === '/home';

  // Fetch teachers để check staff roles
  // CHỈ fetch khi user là teacher (admin không cần check staff roles)
  const { data: teachersData } = useDataLoading(
    () => fetchTeachers(),
    [],
    { 
      cacheKey: 'teachers-for-layout-permissions', 
      staleTime: 5 * 60 * 1000,
      enabled: user?.role === 'teacher' // CHỈ fetch cho teacher
    }
  );
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  // Role-based menu items visibility
  // Icon is an array of path strings (each path is a separate <path> element)
  const allMenuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: ['M3 13h8V3H3z', 'M13 21h8V8h-8z', 'M3 21h8v-6H3z', 'M13 3v3h8V3z'], roles: ['admin', 'student'], excludeRoles: ['teacher'] }, // Ẩn Dashboard với teacher
    { path: '/home', label: 'Trang chủ', icon: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'], roles: ['teacher'] }, // Thêm Trang chủ cho teacher
    { path: '/staff', label: 'Nhân sự', icon: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'], roles: ['admin'], requireStaffRole: 'accountant' }, // Only admin and accountant can access
    { path: '/classes', label: 'Lớp học', icon: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'], roles: ['admin'], requireStaffRole: 'accountant' }, // Only admin and accountant can access
    { path: '/schedule', label: 'Lịch Học', icon: ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18'], roles: ['admin'] },
    { path: '/coding', label: 'Lập trình', icon: ['M2 4h20v14H2z', 'M8 20h8', 'M12 16v4'], roles: ['admin', 'teacher', 'student'] },
    { path: '/students', label: 'Học sinh', icon: ['M22 10v6M2 10l10-5 10 5M2 17l10 5 10-5M2 12l10 5 10-5'], roles: ['admin'] },
    { path: '/costs', label: 'Chi phí', icon: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'], roles: ['admin'] },
    { path: '/categories', label: 'Phân loại lớp', icon: ['M4 7h16', 'M4 12h16', 'M4 17h16'], roles: ['admin'] },
    { path: '/lesson-plans', label: 'Giáo Án', icon: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', 'M8 7h8', 'M8 11h8', 'M8 15h4'], roles: ['admin', 'teacher'], requireStaffRole: 'lesson_plan' },
    { path: '/action-history', label: 'Lịch sử', icon: ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2 2.32v-4.14c-2.25-.56-3.87-2.11-3.87-4.37 0-2.45 2.13-4.44 4.76-4.44V4h2.67v1.93c1.71.36 3.16 1.46 3.27 3.4h-1.96c-.1-1.05-.82-1.87-2-2.32v4.14c2.25.56 3.87 2.11 3.87 4.37 0 2.45-2.13 4.44-4.76 4.44z'], roles: ['admin'], showOnlyForAdmin: true },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (isAdmin) return true;
    if (item.showOnlyForAdmin) return false;
    
    // Exclude items for specific roles
    if ((item as any).excludeRoles && (item as any).excludeRoles.includes(user?.role || 'guest')) {
      return false;
    }
    
    // Check base role access
    if (!item.roles.includes(user?.role || 'guest')) return false;
    
    // Check staff role requirement for teacher
    if (user?.role === 'teacher' && item.requireStaffRole) {
      return userHasStaffRole(item.requireStaffRole, user, teachers);
    }
    
    // For admin role, check if item requires staff role (e.g., accountant)
    // Admin can access everything, but we still check requireStaffRole for consistency
    if (isAdmin && item.requireStaffRole) {
      // Admin can access, but we can also check if they have the staff role
      return true; // Admin always has access
    }
    
    return true;
  });

  const topNavItems = allMenuItems.filter(item => {
    if (isAdmin) return false;
    if (item.showOnlyForAdmin) return false;
    
    // Exclude items for specific roles
    if ((item as any).excludeRoles && (item as any).excludeRoles.includes(user?.role || 'guest')) {
      return false;
    }
    
    // Check base role access
    if (!item.roles.includes(user?.role || 'guest')) return false;
    
    // Check staff role requirement for teacher
    if (user?.role === 'teacher' && item.requireStaffRole) {
      return userHasStaffRole(item.requireStaffRole, user, teachers);
    }
    
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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

  // Update main content padding based on navigation type
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      if (isAdmin && !isLandingPage) {
        mainContent.style.paddingTop = '';
      } else if (!isAdmin && !isLandingPage) {
        mainContent.style.paddingTop = '8px';
      } else {
        mainContent.style.paddingTop = '';
      }
    }
  }, [isAdmin, isLandingPage]);

  return (
    <>
      {/* Top Navigation for non-admin roles */}
      {!isAdmin && !isLandingPage && user && (
        <header id="topNav" className="top-nav" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 20 }}>
          <div className="top-nav-inner" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="top-nav-left" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div className="top-nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6z" fill="currentColor" />
                </svg>
                <span className="text-base font-semibold">Unicorns Edu</span>
              </div>
              <nav className="top-nav-tabs" role="tablist" aria-label="Navigation" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 2px' }}>
                {topNavItems.map((item) => (
                  <button
                    key={item.path}
                    className={`tab ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                    type="button"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: 'var(--radius)', border: 'none', background: isActive(item.path) ? 'var(--primary)' : 'transparent', color: isActive(item.path) ? 'var(--primary-contrast)' : 'var(--muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {Array.isArray(item.icon) ? item.icon.map((path, idx) => <path key={idx} d={path} />) : <path d={item.icon} />}
                    </svg>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="top-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="theme-switcher" style={{ display: 'flex', gap: '4px' }}>
                <button
                  className={`btn theme-btn theme-icon-only ${theme === THEME_DEFAULT ? 'theme-active' : ''}`}
                  data-theme-option="light"
                  onClick={() => setTheme(THEME_DEFAULT)}
                  aria-label="Chế độ sáng"
                  title="Chế độ sáng"
                  style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius)' }}
                >
                  <span aria-hidden="true">☀️</span>
                </button>
                <button
                  className={`btn theme-btn theme-icon-only ${theme === THEME_DARK ? 'theme-active' : ''}`}
                  data-theme-option="dark"
                  onClick={() => setTheme(THEME_DARK)}
                  aria-label="Chế độ tối"
                  title="Chế độ tối"
                  style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius)' }}
                >
                  <span aria-hidden="true">🌙</span>
                </button>
                <button
                  className={`btn theme-btn theme-icon-only ${theme === THEME_SAKURA ? 'theme-active' : ''}`}
                  data-theme-option="sakura"
                  onClick={() => setTheme(THEME_SAKURA)}
                  aria-label="Hoa Anh Đào"
                  title="Hoa Anh Đào"
                  style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius)' }}
                >
                  <span aria-hidden="true">🌸</span>
                </button>
              </div>
              <div className="top-nav-user-card">
                <div className="user-account-card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="user-account-btn"
                    onClick={async () => {
                      if (isAdmin) {
                        setIsAdminProfileModalOpen(true);
                      } else if (user?.role === 'teacher') {
                        // Teacher: redirect đến staff detail
                        if (user.linkId) {
                          navigate(`/staff/${user.linkId}`, { replace: false });
                          return;
                        }
                        
                        // Nếu không có linkId, cần fetch teachers nếu chưa có
                        let teachersToUse = teachers;
                        if (teachersToUse.length === 0) {
                          try {
                            const { fetchTeachers } = await import('../services/teachersService');
                            teachersToUse = await fetchTeachers();
                          } catch (err) {
                            console.error('[Layout] Error fetching teachers:', err);
                            return;
                          }
                        }
                        
                          // Tìm teacher record
                          let teacherRecord = null;
                          if (user.id) {
                          teacherRecord = teachersToUse.find((t) => (t as any).userId === user.id);
                          }
                          if (!teacherRecord && user.email) {
                          teacherRecord = teachersToUse.find((t) => 
                              t.email?.toLowerCase() === user.email?.toLowerCase()
                            );
                          }
                        
                          if (teacherRecord) {
                            navigate(`/staff/${teacherRecord.id}`, { replace: false });
                        } else {
                          console.warn('[Layout] Teacher record not found for user:', {
                            userId: user.id,
                            email: user.email,
                            teachersCount: teachersToUse.length,
                          });
                        }
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius)' }}
                    title={isAdmin ? 'Thông tin tài khoản' : user?.role === 'teacher' ? 'Chi tiết nhân sự' : undefined}
                    aria-label={isAdmin ? 'Thông tin tài khoản' : user?.role === 'teacher' ? 'Chi tiết nhân sự' : undefined}
                  >
                    <div className="user-avatar">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                      </svg>
                    </div>
                    <div className="user-info-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <div className="user-name" style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>{user.name || user.email || 'User'}</div>
                      <div className="user-role" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--muted)' }}>{getRoleLabel(user.role || 'guest')}</div>
                    </div>
                  </button>
                  <button className="logout-btn" onClick={handleLogout} title="Đăng xuất" aria-label="Đăng xuất" type="button" style={{ padding: '6px', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Admin Profile Modal for top nav */}
      {isAdmin && user && !isLandingPage && (
        <AdminProfileModal
          isOpen={isAdminProfileModalOpen}
          onClose={() => setIsAdminProfileModalOpen(false)}
          currentEmail={user.email || ''}
        />
      )}

      <div className="layout" style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
        {/* Sidebar - Only for admin, always show when logged in as admin (except on landing page) */}
        {isAdmin && user && !isLandingPage && (
          <Sidebar
            menuItems={menuItems}
            user={user}
            onLogout={handleLogout}
            onProfileClick={() => setIsAdminProfileModalOpen(true)}
            onCollapseChange={setIsSidebarCollapsed}
          />
        )}

        {/* Main Content */}
        <main
          id="main-content"
          className="main-content"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: isAdmin && !isLandingPage ? (isSidebarCollapsed && window.innerWidth > 768 ? '56px' : '240px') : '0',
            transition: 'margin-left 0.3s ease-in-out',
          }}
        >
          {children}
        </main>
      </div>

      {/* Admin Profile Modal */}
      {isAdmin && user && (
        <AdminProfileModal
          isOpen={isAdminProfileModalOpen}
          onClose={() => setIsAdminProfileModalOpen(false)}
          currentEmail={user.email || ''}
        />
      )}
    </>
  );
}

export default Layout;

