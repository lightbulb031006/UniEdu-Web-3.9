/**
 * Permissions Utilities
 * Role-based access control helpers
 * Migrated from backup/assets/js/ui.js
 */

import { useAuthStore } from '../store/authStore';
import { Teacher } from '../services/teachersService';

/**
 * Check if current user has one of the specified roles
 */
export function hasRole(...roles: string[]): boolean {
  const user = useAuthStore.getState().user;
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return useAuthStore.getState().user;
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
  return hasRole('admin');
}

/**
 * Check if current user is teacher
 */
export function isTeacher(): boolean {
  return hasRole('teacher');
}

/**
 * Check if current user is student
 */
export function isStudent(): boolean {
  return hasRole('student');
}

/**
 * Get staff roles for a user
 * This checks if user is linked to a teacher record and returns their staff roles
 */
export function getUserStaffRoles(user: any = null, teachers: Teacher[] = []): string[] {
  const targetUser = user || getCurrentUser();
  if (!targetUser) return [];

  // Find staff record for user
  let staffRecord: Teacher | null = null;

  if (targetUser.linkId) {
    staffRecord = teachers.find((t) => t.id === targetUser.linkId) || null;
  }

  if (!staffRecord && targetUser.id) {
    // Try to find by userId if available
    staffRecord = teachers.find((t) => (t as any).userId === targetUser.id) || null;
  }

  if (!staffRecord && targetUser.email) {
    // Try to find by email
    staffRecord = teachers.find((t) => (t as any).email === targetUser.email) || null;
  }

  if (!staffRecord) return [];

  // Return staff roles
  if (Array.isArray(staffRecord.roles) && staffRecord.roles.length > 0) {
    return staffRecord.roles.filter(Boolean);
  }

  // Default to 'teacher' if no roles specified
  return ['teacher'];
}

/**
 * Check if user has a specific staff role
 */
export function userHasStaffRole(role: string, user: any = null, teachers: Teacher[] = []): boolean {
  if (!role) return false;
  const roles = getUserStaffRoles(user, teachers);
  return roles.includes(role);
}

/**
 * Check if user can access a page
 */
export function canAccessPage(page: string, user: any = null, teachers: Teacher[] = []): boolean {
  const targetUser = user || getCurrentUser();
  if (!targetUser) return false;

  const role = targetUser.role;

  // Admin can access all pages
  if (role === 'admin') return true;

  // Page access mapping
  const PAGE_ACCESS: Record<string, string[]> = {
    guest: ['home'],
    visitor: ['home'],
    student: ['dashboard', 'class-detail', 'student-detail', 'home', 'coding'], // Removed 'classes' - only admin and accountant can access classes list
    teacher: ['dashboard', 'class-detail', 'staff-detail', 'teachers', 'schedule', 'home', 'coding'], // Removed 'classes', 'student-detail', and 'staff' - teachers cannot access classes list, student detail, and staff list pages
  };

  const allowedPages = PAGE_ACCESS[role] || [];
  if (allowedPages.includes(page)) return true;

  // Check staff role access
  const staffRoles = getUserStaffRoles(targetUser, teachers);
  const STAFF_ROLE_PAGE_ACCESS: Record<string, string[]> = {
    lesson_plan: ['lesson-plans'],
    accountant: ['classes', 'staff', 'lesson-plans', 'costs'], // Accountant can access classes and staff lists
    cskh_sale: ['staff-cskh-detail'],
    communication: [],
    teacher: [],
  };

  for (const staffRole of staffRoles) {
    const extraPages = STAFF_ROLE_PAGE_ACCESS[staffRole] || [];
    if (extraPages.includes(page)) return true;
  }

  return false;
}

/**
 * Check if user can manage (edit/delete) an entity
 */
export function canManage(entityType: 'student' | 'class' | 'teacher' | 'payment' | 'cost' | 'category' | 'lesson-plan', user: any = null, teachers: Teacher[] = []): boolean {
  const targetUser = user || getCurrentUser();
  if (!targetUser) return false;

  // Admin can manage everything
  if (targetUser.role === 'admin') return true;

  // Accountant can manage costs
  if (entityType === 'cost' && userHasStaffRole('accountant', targetUser, teachers)) return true;

  // Lesson plan staff can manage lesson plans
  if (entityType === 'lesson-plan' && userHasStaffRole('lesson_plan', targetUser, teachers)) return true;

  return false;
}

/**
 * Check if teacher is owner of a class
 */
export function isOwnerTeacherOfClass(classId: string, classTeachers: string[], user: any = null): boolean {
  const targetUser = user || getCurrentUser();
  if (!targetUser || targetUser.role !== 'teacher') return false;
  if (!targetUser.linkId) return false;
  return classTeachers.includes(targetUser.linkId);
}

