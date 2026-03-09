/**
 * Classes Service
 * API calls for classes CRUD operations
 */

import api from './api';

export interface Class {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped';
  teacherIds?: string[];
  teacherId?: string;
  maxStudents?: number;
  tuitionPerSession?: number;
  studentTuitionPerSession?: number;
  tuitionPackageTotal?: number;
  tuitionPackageSessions?: number;
  schedule?: Array<{ day: string; time: string }>;
  scaleAmount?: number;
  maxAllowancePerSession?: number;
  customTeacherAllowances?: Record<string, number>;
}

export interface ClassFilters {
  search?: string;
  type?: string;
  status?: 'all' | 'running' | 'stopped';
}

// Normalize class data
function normalizeClass(cls: any): Class & { teachers?: Array<{ id: string; fullName: string; email?: string; phone?: string; roles?: string[] }> } {
  if (!cls) {
    throw new Error('Cannot normalize null or undefined class data');
  }
  
  // Ensure teacherIds is always an array
  let teacherIds: string[] = [];
  if (Array.isArray(cls.teacher_ids)) {
    teacherIds = cls.teacher_ids.filter(Boolean);
  } else if (Array.isArray(cls.teacherIds)) {
    teacherIds = cls.teacherIds.filter(Boolean);
  } else if (cls.teacher_id) {
    teacherIds = [cls.teacher_id];
  }
  
  const normalized: Class & { teachers?: Array<{ id: string; fullName: string; email?: string; phone?: string; roles?: string[] }> } = {
    id: cls.id,
    name: cls.name,
    type: cls.type,
    status: cls.status || 'running',
    teacherIds: teacherIds,
    teacherId: cls.teacher_id || cls.teacherId,
    maxStudents: cls.max_students || cls.maxStudents,
    tuitionPerSession: cls.tuition_per_session || cls.tuitionPerSession,
    studentTuitionPerSession: cls.student_tuition_per_session || cls.studentTuitionPerSession,
    tuitionPackageTotal: cls.tuition_package_total || cls.tuitionPackageTotal,
    tuitionPackageSessions: cls.tuition_package_sessions || cls.tuitionPackageSessions,
    schedule: Array.isArray(cls.schedule) ? cls.schedule : (cls.schedule ? JSON.parse(cls.schedule) : []),
    scaleAmount: cls.scale_amount || cls.scaleAmount,
    maxAllowancePerSession: cls.max_allowance_per_session || cls.maxAllowancePerSession,
    customTeacherAllowances: cls.custom_teacher_allowances || cls.customTeacherAllowances || {},
  };
  
  // Preserve teachers array if it exists (from includeTeachers option)
  if (cls.teachers && Array.isArray(cls.teachers)) {
    normalized.teachers = cls.teachers;
  }
  
  return normalized;
}

export async function fetchClasses(filters?: ClassFilters): Promise<Class[]> {
  const response = await api.get<any[]>('/classes', { params: filters });
  const data = response.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(normalizeClass);
}

export async function fetchClassById(id: string, options: { includeTeachers?: boolean } = {}) {
  try {
    const params = options.includeTeachers ? { include: 'teachers' } : {};
    const response = await api.get<any>(`/classes/${id}`, { params });
    if (!response.data) {
      throw new Error('Class not found');
    }
    return normalizeClass(response.data);
  } catch (error: any) {
    console.error(`[fetchClassById] Error fetching class ${id}:`, error);
    throw error;
  }
}

export async function createClass(data: Omit<Class, 'id'>) {
  const apiData: any = {
    name: data.name,
    type: data.type,
    status: data.status || 'running',
    teacher_ids: data.teacherIds || (data.teacherId ? [data.teacherId] : []),
    max_students: data.maxStudents,
    tuition_per_session: data.tuitionPerSession,
    student_tuition_per_session: data.studentTuitionPerSession,
    tuition_package_total: data.tuitionPackageTotal,
    tuition_package_sessions: data.tuitionPackageSessions,
  };
  const response = await api.post<any>('/classes', apiData);
  return normalizeClass(response.data);
}

export async function updateClass(id: string, data: Partial<Class> & { schedule?: any; customTeacherAllowances?: any; scaleAmount?: number; maxAllowancePerSession?: number }) {
  const apiData: any = {};
  if (data.name !== undefined) apiData.name = data.name;
  if (data.type !== undefined) apiData.type = data.type;
  if (data.status !== undefined) apiData.status = data.status;
  if (data.teacherIds !== undefined) apiData.teacherIds = data.teacherIds;
  if (data.maxStudents !== undefined) apiData.max_students = data.maxStudents;
  if (data.tuitionPerSession !== undefined) apiData.tuition_per_session = data.tuitionPerSession;
  if (data.studentTuitionPerSession !== undefined) apiData.student_tuition_per_session = data.studentTuitionPerSession;
  if (data.tuitionPackageTotal !== undefined) apiData.tuition_package_total = data.tuitionPackageTotal;
  if (data.tuitionPackageSessions !== undefined) apiData.tuition_package_sessions = data.tuitionPackageSessions;
  if (data.schedule !== undefined) apiData.schedule = data.schedule;
  if (data.customTeacherAllowances !== undefined) apiData.customTeacherAllowances = data.customTeacherAllowances;
  if (data.scaleAmount !== undefined) apiData.scaleAmount = data.scaleAmount;
  if (data.maxAllowancePerSession !== undefined) apiData.maxAllowancePerSession = data.maxAllowancePerSession;
  const response = await api.put<any>(`/classes/${id}`, apiData);
  return normalizeClass(response.data);
}

export async function deleteClass(id: string) {
  await api.delete(`/classes/${id}`);
}

export interface ClassStudentWithRemaining {
  student: {
    id: string;
    full_name: string;
    birth_year?: number;
    province?: string;
    status?: string;
  };
  studentClass: {
    id: string;
    student_id: string;
    class_id: string;
    start_date: string;
    status: string;
    remaining_sessions: number;
    total_attended_sessions: number;
  };
  remainingSessions: number;
  totalAttended: number;
}

export async function fetchClassStudentsWithRemaining(id: string): Promise<ClassStudentWithRemaining[]> {
  const response = await api.get<ClassStudentWithRemaining[]>(`/classes/${id}/students-with-remaining`);
  return response.data || [];
}

export async function addStudentToClass(classId: string, studentId: string) {
  const response = await api.post(`/classes/${classId}/add-student`, { studentId });
  return response.data;
}

/**
 * Remove a teacher from a class
 */
export async function removeTeacherFromClass(classId: string, teacherId: string) {
  const response = await api.post(`/classes/${classId}/remove-teacher`, { teacherId });
  return response.data;
}

export async function removeStudentFromClass(classId: string, studentId: string, refundRemaining: boolean = true) {
  const response = await api.post(`/classes/${classId}/remove-student`, { studentId, refundRemaining });
  return response.data;
}

/**
 * Move a student from one class to another
 */
export async function moveStudentToClass(fromClassId: string, studentId: string, toClassId: string, refundRemaining: boolean = true) {
  const response = await api.post(`/classes/${fromClassId}/move-student`, { studentId, toClassId, refundRemaining });
  return response.data;
}

/**
 * Get class detail data with teacher statistics calculated in backend
 */
export interface ClassDetailData {
  teacherStats: Array<{
    teacher: {
      id: string;
      fullName: string;
      email?: string;
      phone?: string;
    };
    allowance: number;
    totalReceived: number;
  }>;
}

export async function fetchClassDetailData(classId: string): Promise<ClassDetailData> {
  const response = await api.get<ClassDetailData>(`/classes/${classId}/detail-data`);
  return response.data;
}

