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
      return '/dashboard'; // Sẽ redirect đến staff-detail trong Dashboard
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
  const { data: teachersData, isLoading: isLoadingTeachers } = useDataLoading(
    () => fetchTeachers(),
    [],
    { cacheKey: 'teachers-for-protected-route', staleTime: 5 * 60 * 1000 }
  );
  
  const teachers = Array.isArray(teachersData) ? teachersData : [];

  // Check authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />; // Will redirect to Home with login modal
  }

  // Wait for teachers data to load before checking access
  if (isLoadingTeachers) {
    return null; // Or a loading spinner
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
    
    // Avoid redirect loop: don't redirect if already on default page
    const isOnDefaultPage = location.pathname === defaultPage || location.pathname === defaultPage + '/';
    
    // Check if user can access this page
    if (!canAccessPage(normalizedPage, user, teachers)) {
      // Only redirect if not already on default page and haven't redirected yet
      if (!isOnDefaultPage && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        return <Navigate to={defaultPage} replace />;
      }
    }
  }

  return <>{children}</>;
}

