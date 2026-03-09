/**
 * Teachers Service
 * API calls for teachers CRUD operations
 */

import api from './api';

export interface Teacher {
  id: string;
  fullName?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birth_date?: string;
  birthYear?: number;
  birth_year?: number;
  university?: string;
  highSchool?: string;
  high_school?: string;
  province?: string;
  specialization?: string;
  photoUrl?: string;
  photo_url?: string;
  status?: 'active' | 'inactive';
  roles?: string[];
  userId?: string; // Link to users table
  // QR payment link fields (for compatibility with different naming conventions)
  bank_qr_link?: string;
  bankQRLink?: string;
  qr_payment_link?: string;
  qrPaymentLink?: string;
}

// Normalize teacher data
function normalizeTeacher(teacher: any): Teacher {
  const normalized: Teacher = {
    id: teacher.id,
    fullName: teacher.full_name || teacher.fullName,
    email: teacher.email,
    phone: teacher.phone,
    birthDate: teacher.birth_date || teacher.birthDate,
    birthYear: teacher.birth_year || teacher.birthYear || (teacher.birth_date ? new Date(teacher.birth_date).getFullYear() : undefined),
    university: teacher.university,
    highSchool: teacher.high_school || teacher.highSchool,
    province: teacher.province,
    specialization: teacher.specialization,
    photoUrl: teacher.photo_url || teacher.photoUrl,
    status: teacher.status,
    roles: teacher.roles,
    userId: teacher.user_id || teacher.userId,
  };
  
  // Preserve QR payment link fields from raw data (for compatibility)
  // Always preserve these fields even if they are null/empty to ensure data is available
  if ('bank_qr_link' in teacher) normalized.bank_qr_link = teacher.bank_qr_link;
  if ('bankQRLink' in teacher) normalized.bankQRLink = teacher.bankQRLink;
  if ('qr_payment_link' in teacher) normalized.qr_payment_link = teacher.qr_payment_link;
  if ('qrPaymentLink' in teacher) normalized.qrPaymentLink = teacher.qrPaymentLink;
  
  return normalized;
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const response = await api.get<any[]>('/teachers');
  const data = response.data;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(normalizeTeacher);
}

export async function fetchTeacherById(id: string) {
  const response = await api.get<any>(`/teachers/${id}`);
  return normalizeTeacher(response.data);
}

export async function createTeacher(data: Omit<Teacher, 'id'>) {
  const apiData: any = {
    full_name: data.fullName,
    province: data.province,
    status: data.status || 'active',
  };

  if (data.birthDate) {
    apiData.birth_date = data.birthDate;
  } else if (data.birthYear) {
    apiData.birth_year = data.birthYear;
  }

  if (data.email) apiData.email = data.email;
  if (data.phone) apiData.phone = data.phone;
  if (data.university) apiData.university = data.university;
  if (data.highSchool) apiData.high_school = data.highSchool;
  if (data.specialization) apiData.specialization = data.specialization;
  if (data.photoUrl) apiData.photo_url = data.photoUrl;
  if (data.roles) apiData.roles = data.roles;

  const response = await api.post<any>('/teachers', apiData);
  return normalizeTeacher(response.data);
}

export async function updateTeacher(id: string, data: Partial<Teacher> & { accountHandle?: string; accountPassword?: string }) {
  const apiData: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => { if (v !== undefined) apiData[k] = v; };
  set('full_name', data.fullName);
  set('birth_date', data.birthDate);
  set('birth_year', data.birthYear);
  set('email', data.email);
  set('phone', data.phone);
  set('university', data.university);
  set('high_school', data.highSchool);
  set('province', data.province);
  set('specialization', data.specialization);
  set('photo_url', data.photoUrl);
  set('status', data.status);
  set('roles', data.roles);
  set('account_handle', data.accountHandle);
  set('account_password', data.accountPassword);
  const logPayload = { ...apiData };
  if (logPayload.account_password !== undefined) logPayload.account_password = '[REDACTED]';
  console.log('[teachersService.updateTeacher] PUT', `/teachers/${id}`, 'apiData keys=', Object.keys(apiData), 'body=', logPayload);
  const response = await api.put<any>(`/teachers/${id}`, apiData);
  console.log('[teachersService.updateTeacher] response status=', response.status, 'data id=', response.data?.id);
  return normalizeTeacher(response.data);
}

export async function deleteTeacher(id: string) {
  await api.delete(`/teachers/${id}`);
}

