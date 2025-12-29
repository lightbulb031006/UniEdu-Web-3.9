/**
 * Attendance Service
 * Business logic for attendance CRUD operations
 */

import supabase from '../config/database';

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  present: boolean;
  remark?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get attendance records for a session
 */
export async function getAttendanceBySession(sessionId: string): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to fetch attendance: ${error.message}`);
  }

  return (data || []) as Attendance[];
}

/**
 * Create or update attendance records for a session
 */
export async function saveAttendanceForSession(
  sessionId: string,
  attendanceData: Array<{ student_id: string; present: boolean; remark?: string }>
): Promise<Attendance[]> {
  // First, delete existing attendance records for this session
  await supabase.from('attendance').delete().eq('session_id', sessionId);

  // Then, insert new attendance records
  const recordsToInsert = attendanceData.map((att) => ({
    id: `ATT${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    session_id: sessionId,
    student_id: att.student_id,
    present: att.present,
    remark: att.remark || null,
  }));

  const { data, error } = await supabase
    .from('attendance')
    .insert(recordsToInsert)
    .select();

  if (error) {
    throw new Error(`Failed to save attendance: ${error.message}`);
  }

  return (data || []) as Attendance[];
}

/**
 * Delete attendance records for a session
 */
export async function deleteAttendanceBySession(sessionId: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('session_id', sessionId);

  if (error) {
    throw new Error(`Failed to delete attendance: ${error.message}`);
  }
}

