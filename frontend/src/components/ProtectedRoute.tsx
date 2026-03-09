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
import { fetchClassById } from '../services/classesService';
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

  // Special handling for teacher accessing class detail: check if they are assigned to the class
  const isClassDetailPage = location.pathname.startsWith('/classes/') && location.pathname !== '/classes';
  const classId = isClassDetailPage ? location.pathname.split('/')[2] : null;
  
  // Fetch class data to check teacher assignment (only for teacher role on class detail page)
  const { data: classData, isLoading: isLoadingClass } = useDataLoading(
    () => {
      if (!classId || user?.role !== 'teacher') return Promise.resolve(null);
      return fetchClassById(classId).catch((error) => {
        // Return null on error to allow access check to proceed
        return null;
      });
    },
    [classId, user?.role],
    {
      cacheKey: classId ? `class-for-access-check-${classId}` : undefined,
      staleTime: 2 * 60 * 1000,
      enabled: isClassDetailPage && user?.role === 'teacher' && !!classId,
    }
  );

  // Check if teacher is assigned to this class
  if (isClassDetailPage && user?.role === 'teacher' && classData && !isLoadingClass) {
    const teacherId = user.linkId;
    // Normalize classTeacherIds - handle both array and single value
    let classTeacherIds: string[] = [];
    if (Array.isArray(classData.teacherIds)) {
      classTeacherIds = classData.teacherIds.filter(Boolean);
    } else if (classData.teacherId) {
      classTeacherIds = [classData.teacherId];
    } else if (classData.teacher_ids && Array.isArray(classData.teacher_ids)) {
      classTeacherIds = classData.teacher_ids.filter(Boolean);
    }
    
    // Nếu không có linkId, thử tìm teacher record
    let actualTeacherId = teacherId;
    if (!actualTeacherId && !isLoadingTeachers && teachers.length > 0) {
      let teacherRecord = null;
      if (user.id) {
        teacherRecord = teachers.find((t: any) => (t as any).userId === user.id);
      }
      if (!teacherRecord && user.email) {
        teacherRecord = teachers.find((t) => 
          (t.email || '').toLowerCase() === (user.email || '').toLowerCase()
        );
      }
      if (teacherRecord) {
        actualTeacherId = teacherRecord.id;
      }
    }
    
    // Chỉ redirect nếu:
    // 1. Đã có actualTeacherId (đã tìm được teacher record)
    // 2. VÀ teacher không được assign vào lớp này
    // 3. VÀ đã load xong teachers data (không còn đang loading)
    // 4. VÀ class có ít nhất 1 teacher được assign (để tránh block khi class chưa có teacher)
    if (!isLoadingTeachers && actualTeacherId && classTeacherIds.length > 0 && !classTeacherIds.includes(actualTeacherId)) {
      return <Navigate to="/home" replace />;
    }
    
    // Nếu chưa có actualTeacherId và đã load xong teachers, cho phép truy cập
    // (có thể là admin hoặc có quyền khác, hoặc teacher record chưa được link)
    // Chỉ block nếu chắc chắn teacher không được assign
    // Nếu class không có teacher nào được assign, cho phép truy cập (có thể là class mới)
  }

  // Wait for teachers data to load before checking access (only if needed)
  if (isLoadingTeachers && user?.role === 'teacher' && location.pathname === '/home') {
    return null; // Show nothing while loading teachers for redirect
  }

  // Wait for class data to load before checking access (only if needed)
  // Also wait for teachers data if we need it to find teacher ID
  if (isClassDetailPage && user?.role === 'teacher') {
    const needsTeachersData = !user.linkId;
    if (isLoadingClass || (needsTeachersData && isLoadingTeachers)) {
      return null; // Show nothing while loading data for access check
    }
    
    // If class data failed to load or is null, allow access (let ClassDetail page handle the error)
    // This prevents redirect loop if there's a temporary network issue
  }

  // Check role-based page access (only check once per path change)
  if (user && location.pathname !== lastCheckedPathRef.current) {
    lastCheckedPathRef.current = location.pathname;
    hasRedirectedRef.current = false;
    
    // Extract page name from path (remove leading slash)
    const pageName = location.pathname.replace(/^\//, '') || 'home';
    
    // Normalize page name - handle detail pages correctly
    let normalizedPage = pageName.split('/')[0];
    
    // Map detail pages to their normalized names
    if (normalizedPage === 'classes' && pageName.split('/').length > 1) {
      normalizedPage = 'class-detail';
    } else if (normalizedPage === 'students' && pageName.split('/').length > 1) {
      normalizedPage = 'student-detail';
    } else if (normalizedPage === 'staff' && pageName.split('/').length > 1) {
      normalizedPage = 'staff-detail';
    }
    
    // Get default page for user's role
    const defaultPage = getDefaultPageForRole(user.role || 'guest');
    
    // Avoid redirect loop: don't redirect if already on default page or staff detail
    const isOnDefaultPage = location.pathname === defaultPage || location.pathname === defaultPage + '/';
    const isOnStaffDetail = user.role === 'teacher' && location.pathname.startsWith('/staff/');
    const isOnClassDetail = user.role === 'teacher' && isClassDetailPage;
    
    // Check if user can access this page
    const canAccess = canAccessPage(normalizedPage, user, teachers);
    
    if (!canAccess) {
      // Only redirect if not already on default page and haven't redirected yet
      // Also skip redirect for class detail pages (we handle that separately above)
      if (!isOnDefaultPage && !isOnStaffDetail && !isOnClassDetail && !hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        return <Navigate to={defaultPage} replace />;
      }
    }
  }

  return <>{children}</>;
}

