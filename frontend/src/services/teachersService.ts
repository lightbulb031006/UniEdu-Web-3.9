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

export async function updateTeacher(id: string, data: Partial<Teacher>) {
  const apiData: any = {};
  if (data.fullName !== undefined) apiData.full_name = data.fullName;
  if (data.birthDate !== undefined) apiData.birth_date = data.birthDate;
  if (data.birthYear !== undefined) apiData.birth_year = data.birthYear;
  if (data.email !== undefined) apiData.email = data.email;
  if (data.phone !== undefined) apiData.phone = data.phone;
  if (data.university !== undefined) apiData.university = data.university;
  if (data.highSchool !== undefined) apiData.high_school = data.highSchool;
  if (data.province !== undefined) apiData.province = data.province;
  if (data.specialization !== undefined) apiData.specialization = data.specialization;
  if (data.photoUrl !== undefined) apiData.photo_url = data.photoUrl;
  if (data.status !== undefined) apiData.status = data.status;
  if (data.roles !== undefined) apiData.roles = data.roles;
  const response = await api.put<any>(`/teachers/${id}`, apiData);
  return normalizeTeacher(response.data);
}

export async function deleteTeacher(id: string) {
  await api.delete(`/teachers/${id}`);
}

