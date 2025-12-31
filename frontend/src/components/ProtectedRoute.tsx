/**
 * Protected Route Component
 * Redirects to login if not authenticated
 * Checks role-based access and redirects if user doesn't have permission
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { canAccessPage } from '../utils/permissions';
import { useDataLoading } from '../hooks/useDataLoading';
import { fetchTeachers } from '../services/teachersService';
import { useRef } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function getDefaultPageForRole(role: string): string {
  switch (role) {
    case 'admin':
      return '/dashboard';
    case 'teacher':
      return '/home'; // Teacher mặc định ở trang chủ (sẽ redirect đến staff-detail khi đăng nhập)
    case 'student':
      return '/classes';
    default:
      return '/home';
  }
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  const hasRedirectedRef = useRef(false);
  const lastCheckedPathRef = useRef<string>('');
  
  // Fetch teachers for staff role checking
  // CHỈ fetch khi user là teacher (admin không cần check staff roles)
  const { data: teachersData, isLoading: isLoadingTeachers } = useDataLoading(
    () => fetchTeachers(),
    [],
    { 
      cacheKey: 'teachers-for-protected-route', 
      staleTime: 5 * 60 * 1000,
      enabled: user?.role === 'teacher' // CHỈ fetch cho teacher
    }
  );
  
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />; // Will redirect to Home with login modal
  }

  // Special handling for teacher: redirect to staff detail if on home page
  if (user?.role === 'teacher' && location.pathname === '/home') {
    // Nếu có linkId, redirect ngay lập tức
    if (user.linkId) {
      return <Navigate to={`/staff/${user.linkId}`} replace />;
    }
    
    // Nếu không có linkId và đã có teachers data, tìm staff ID
    if (!isLoadingTeachers && teachers.length > 0) {
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
        return <Navigate to={`/staff/${teacherRecord.id}`} replace />;
      }
    }
  }

  // Wait for teachers data to load before checking access (only if needed)
  if (isLoadingTeachers && user?.role === 'teacher' && location.pathname === '/home') {
    return null; // Show nothing while loading teachers for redirect
  }

  // Check role-based page access (only check once per path change)
  if (user && location.pathname !== lastCheckedPathRef.current) {
    lastCheckedPathRef.current = location.pathname;
    hasRedirectedRef.current = false;
    
    // Extract page name from path (remove leading slash)
    const pageName = location.pathname.replace(/^\//, '') || 'home';
    
    // Normalize page name (remove detail IDs)
    const normalizedPage = pageName.split('/')[0];
    
    // Get default page for user's role
    const defaultPage = getDefaultPageForRole(user.role || 'guest');
    
    // Avoid redirect loop: don't redirect if already on default page or staff detail
    const isOnDefaultPage = location.pathname === defaultPage || location.pathname === defaultPage + '/';
    const isOnStaffDetail = user.role === 'teacher' && location.pathname.startsWith('/staff/');
    
    // Check if user can access this page
    if (!canAccessPage(normalizedPage, user, teachers)) {
      // Only redirect if not already on default page and haven't redirected yet
      if (!isOnDefaultPage && !isOnStaffDetail && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        return <Navigate to={defaultPage} replace />;
      }
    }
  }

  return <>{children}</>;
}

