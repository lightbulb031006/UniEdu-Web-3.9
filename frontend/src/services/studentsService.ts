/**
 * Students Service
 * API calls for students CRUD operations
 */

import api from './api';

export interface Student {
  id: string;
  fullName: string;
  birthYear: number;
  school: string;
  province: string;
  parentName: string;
  parentPhone: string;
  email?: string;
  accountHandle?: string;
  accountPassword?: string;
  status?: 'active' | 'inactive';
  walletBalance?: number;
  loanBalance?: number;
  goal?: string;
  classId?: string | string[] | null; // Single class ID or array of class IDs
  classIds?: string[]; // Array of class IDs for compatibility
  cskhStaffId?: string; // CSKH staff ID (from cskh_staff_id in DB)
  cskh_staff_id?: string; // Also keep snake_case for compatibility
}

export interface StudentFilters {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  province?: string;
}

/**
 * Normalize student data from backend (snake_case) to frontend (camelCase)
 */
function normalizeStudent(data: any): Student {
  // Handle class_id - can be string, array, or null
  let classId: string | string[] | null = null;
  if (data.class_id) {
    if (Array.isArray(data.class_id)) {
      classId = data.class_id.length > 0 ? data.class_id : null;
    } else {
      classId = data.class_id;
    }
  } else if (data.class_ids && Array.isArray(data.class_ids) && data.class_ids.length > 0) {
    classId = data.class_ids.length === 1 ? data.class_ids[0] : data.class_ids;
  } else if (data.classId) {
    classId = data.classId;
  }

  return {
    id: data.id,
    fullName: data.full_name || data.fullName || '',
    birthYear: data.birth_year || data.birthYear || 0,
    school: data.school || '',
    province: data.province || '',
    parentName: data.parent_name || data.parentName || '',
    parentPhone: data.parent_phone || data.parentPhone || '',
    email: data.email,
    accountHandle: data.account_handle || data.accountHandle,
    accountPassword: data.account_password || data.accountPassword,
    status: data.status || 'active',
    walletBalance: data.wallet_balance ?? data.walletBalance ?? 0,
    loanBalance: data.loan_balance ?? data.loanBalance ?? 0,
    goal: data.goal,
    classId: classId,
    classIds: Array.isArray(classId) ? classId : classId ? [classId] : [],
    // Map CSKH staff ID (keep both camelCase and snake_case for compatibility)
    cskhStaffId: data.cskh_staff_id || data.cskhStaffId || undefined,
    cskh_staff_id: data.cskh_staff_id || data.cskhStaffId || undefined,
  };
}

/**
 * Fetch all students with filters
 */
export async function fetchStudents(filters?: StudentFilters): Promise<Student[]> {
  const response = await api.get<any[]>('/students', { params: filters });
  const data = response.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(normalizeStudent);
}

/**
 * Fetch student by ID
 */
export async function fetchStudentById(id: string) {
  const response = await api.get<any>(`/students/${id}`);
  return normalizeStudent(response.data);
}

/**
 * Create new student
 */
export async function createStudent(data: Omit<Student, 'id'>) {
  // Convert camelCase to snake_case for API
  const apiData: any = {
    full_name: data.fullName,
    birth_year: data.birthYear,
    school: data.school,
    province: data.province,
    parent_name: data.parentName,
    parent_phone: data.parentPhone,
    email: data.email,
    account_handle: data.accountHandle,
    account_password: data.accountPassword,
    status: data.status || 'active',
    wallet_balance: data.walletBalance || 0,
    loan_balance: data.loanBalance || 0,
    goal: data.goal,
  };
  const response = await api.post<any>('/students', apiData);
  return normalizeStudent(response.data);
}

/**
 * Update student
 */
export async function updateStudent(id: string, data: Partial<Student>) {
  // Convert camelCase to snake_case for API
  const apiData: any = {};
  if (data.fullName !== undefined) apiData.full_name = data.fullName;
  if (data.birthYear !== undefined) apiData.birth_year = data.birthYear;
  if (data.school !== undefined) apiData.school = data.school;
  if (data.province !== undefined) apiData.province = data.province;
  if (data.parentName !== undefined) apiData.parent_name = data.parentName;
  if (data.parentPhone !== undefined) apiData.parent_phone = data.parentPhone;
  if (data.email !== undefined) apiData.email = data.email;
  if (data.accountHandle !== undefined) apiData.account_handle = data.accountHandle;
  if (data.accountPassword !== undefined) apiData.account_password = data.accountPassword;
  if (data.status !== undefined) apiData.status = data.status;
  if (data.walletBalance !== undefined) apiData.wallet_balance = data.walletBalance;
  if (data.loanBalance !== undefined) apiData.loan_balance = data.loanBalance;
  if (data.goal !== undefined) apiData.goal = data.goal;
  // Handle gender and cskhStaffId if provided (extract from data before sending)
  if ((data as any).gender !== undefined) apiData.gender = (data as any).gender;
  if ((data as any).cskhStaffId !== undefined) apiData.cskh_staff_id = (data as any).cskhStaffId;
  // Extract classIds separately (not part of student update, handled separately in backend)
  const classIds = (data as any).classIds;
  if (classIds !== undefined) {
    apiData.classIds = classIds;
  }
  const response = await api.put<any>(`/students/${id}`, apiData);
  return normalizeStudent(response.data);
}

/**
 * Delete student
 */
export async function deleteStudent(id: string) {
  const response = await api.delete(`/students/${id}`);
  return response.data;
}

export interface StudentClassFinancialData {
  record: {
    id: string;
    student_id: string;
    class_id: string;
    start_date: string;
    status: string;
    remaining_sessions: number;
    student_fee_total: number;
    student_fee_sessions: number;
    student_tuition_per_session: number;
    total_attended_sessions: number;
    unpaid_sessions: number;
  };
  classInfo: {
    id: string;
    name: string;
    type: string;
    status: string;
    tuition_package_total: number;
    tuition_package_sessions: number;
    student_tuition_per_session?: number;
  };
  total: number;
  sessions: number;
  unitPrice: number;
  remaining: number;
  attended: number;
  outstandingSessions: number;
  outstandingAmount: number;
}

export async function getStudentClassFinancialData(studentId: string): Promise<StudentClassFinancialData[]> {
  const response = await api.get<StudentClassFinancialData[]>(`/students/${studentId}/class-financial-data`);
  return response.data || [];
}

export async function extendStudentSessions(studentId: string, classId: string, sessions: number, unitPrice: number) {
  const response = await api.post(`/students/${studentId}/extend-sessions`, {
    classId,
    sessions,
    unitPrice,
  });
  return response.data;
}

export async function refundStudentSessions(studentId: string, classId: string, sessions: number, unitPrice: number) {
  const response = await api.post(`/students/${studentId}/refund-sessions`, {
    classId,
    sessions,
    unitPrice,
  });
  return response.data;
}

export async function removeStudentClass(studentId: string, classId: string, refundRemaining: boolean = true) {
  const response = await api.post(`/students/${studentId}/remove-class`, {
    classId,
    refundRemaining,
  });
  return response.data;
}

export async function updateStudentClassFee(studentId: string, classId: string, feeTotal: number, feeSessions: number) {
  const response = await api.patch(`/students/${studentId}/class-fee`, {
    classId,
    student_fee_total: feeTotal,
    student_fee_sessions: feeSessions,
  });
  return response.data;
}

