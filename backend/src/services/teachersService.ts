/**
 * Teachers Service
 * Business logic for teachers CRUD operations
 */

import supabase from '../config/database';
import { formatSupabaseError } from '../utils/supabaseError';

export interface Teacher {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  birth_date?: string; // DATE format YYYY-MM-DD
  birth_year?: number; // For compatibility
  university?: string;
  high_school?: string;
  province?: string;
  specialization?: string;
  bank_account?: string;
  bank_qr_link?: string;
  photo_url?: string;
  roles?: string[];
  status?: 'active' | 'inactive';
}

export async function getTeachers() {
  const { data, error } = await supabase.from('teachers').select('*');

  if (error) {
    throw new Error(formatSupabaseError(error, 'fetch teachers'));
  }

  return (data || []) as Teacher[];
}

export async function getTeacherById(id: string) {
  const { data, error } = await supabase.from('teachers').select('*').eq('id', id).single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'fetch teacher'));
  }

  return data as Teacher | null;
}

export async function createTeacher(teacherData: Omit<Teacher, 'id'>) {
  const { data, error } = await supabase.from('teachers').insert([teacherData]).select().single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'create teacher'));
  }

  return data as Teacher;
}

export async function updateTeacher(id: string, teacherData: Partial<Teacher>) {
  const { data, error } = await supabase.from('teachers').update(teacherData).eq('id', id).select().single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'update teacher'));
  }

  return data as Teacher;
}

export async function deleteTeacher(id: string) {
  const { error } = await supabase.from('teachers').delete().eq('id', id);

  if (error) {
    throw new Error(formatSupabaseError(error, 'delete teacher'));
  }
}

