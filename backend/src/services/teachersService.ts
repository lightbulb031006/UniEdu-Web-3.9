/**
 * Teachers Service
 * Business logic for teachers CRUD operations
 * Note: account_handle and password are stored in users table (link_id = teacher id), not in teachers table.
 */

import supabase from '../config/database';
import { formatSupabaseError } from '../utils/supabaseError';
import { hashPassword } from './authService';

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

// DB columns we allow updating (snake_case). Omit id, created_at, updated_at.
const TEACHERS_UPDATE_COLUMNS = [
  'full_name', 'email', 'phone', 'birth_date', 'university', 'high_school',
  'province', 'specialization', 'bank_account', 'bank_qr_link', 'photo_url', 'roles', 'status',
] as const;

function pickTeacherUpdatePayload(raw: Record<string, unknown>): Record<string, unknown> {
  const snakeToCamel: Record<string, string> = {
    full_name: 'fullName', birth_date: 'birthDate', birth_year: 'birthYear',
    high_school: 'highSchool', photo_url: 'photoUrl', bank_account: 'bankAccount', bank_qr_link: 'bankQrLink',
  };
  const out: Record<string, unknown> = {};
  for (const col of TEACHERS_UPDATE_COLUMNS) {
    const val = raw[col] ?? (snakeToCamel[col] ? raw[snakeToCamel[col]] : undefined);
    if (val !== undefined) out[col] = val;
  }
  return out;
}

export async function updateTeacher(id: string, teacherData: Partial<Teacher> & { account_handle?: string; account_password?: string; accountHandle?: string; accountPassword?: string }) {
  console.log('[updateTeacher] id=', id, 'incoming keys=', Object.keys(teacherData as object));

  const accountHandle = teacherData.account_handle ?? teacherData.accountHandle;
  const accountPassword = teacherData.account_password ?? teacherData.accountPassword;

  const teachersPayload = pickTeacherUpdatePayload(teacherData as Record<string, unknown>);
  console.log('[updateTeacher] teachersPayload (for DB)=', JSON.stringify(teachersPayload));
  if (Object.keys(teachersPayload).length === 0) {
    console.warn('[updateTeacher] WARNING: teachersPayload is empty - no columns will be updated. Check that req.body uses snake_case or camelCase expected by pickTeacherUpdatePayload.');
  }

  const { data, error } = await supabase.from('teachers').update(teachersPayload).eq('id', id).select().single();

  console.log('[updateTeacher] supabase update result: error=', error?.message ?? null, 'data id=', data?.id ?? null, 'data full_name=', (data as any)?.full_name ?? null);

  if (error) {
    throw new Error(formatSupabaseError(error, 'update teacher'));
  }

  if (accountHandle !== undefined || accountPassword !== undefined) {
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('link_id', id)
      .eq('role', 'teacher')
      .limit(1);

    const userUpdate: { account_handle?: string | null; password?: string } = {};
    if (accountHandle !== undefined) {
      const val = (accountHandle && String(accountHandle).trim()) || null;
      userUpdate.account_handle = val;
    }
    if (accountPassword !== undefined && accountPassword !== '') {
      // For staff accounts, store password as-is (plaintext or hash) so admin can manage it directly
      userUpdate.password = String(accountPassword);
    }

    if (existingUsers && existingUsers.length > 0) {
      if (Object.keys(userUpdate).length > 0) {
        const { error: userError } = await supabase.from('users').update(userUpdate).eq('id', existingUsers[0].id);
        if (userError) {
          throw new Error(formatSupabaseError(userError, 'update staff login info'));
        }
      }
    } else {
      // No user row yet: create one so login info can be saved
      const teacher = (data as Teacher) || (await getTeacherById(id));
      const name = teacher?.full_name ?? teacherData.full_name ?? '';
      const emailVal = (teacher as any)?.email ?? (teacherData as any).email ?? '';
      const insertPayload: Record<string, unknown> = {
        role: 'teacher',
        link_id: id,
        name: name || `Teacher ${id}`,
        status: 'active',
      };
      if (userUpdate.account_handle !== undefined) insertPayload.account_handle = userUpdate.account_handle;
      // Default password for new staff accounts (stored as plaintext, login logic supports both hash and plaintext)
      insertPayload.password = userUpdate.password || 'ChangeMe1!';

      if (emailVal && String(emailVal).trim()) insertPayload.email = String(emailVal).trim().toLowerCase();
      else insertPayload.email = `teacher-${id}@placeholder.local`;

      const { error: insertError } = await supabase.from('users').insert(insertPayload);
      if (insertError) {
        throw new Error(formatSupabaseError(insertError, 'create staff login account'));
      }
    }
  }

  return data as Teacher;
}

export async function deleteTeacher(id: string) {
  const { error } = await supabase.from('teachers').delete().eq('id', id);

  if (error) {
    throw new Error(formatSupabaseError(error, 'delete teacher'));
  }
}

