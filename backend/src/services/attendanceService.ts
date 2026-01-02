/**
 * Attendance Service
 * Business logic for attendance CRUD operations
 */

import supabase from '../config/database';

export type AttendanceStatus = 'present' | 'excused' | 'absent';

export interface Attendance {
  id: string;
  session_id: string;
  student_id: string;
  present?: boolean; // Deprecated: Use status instead
  status: AttendanceStatus;
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

  // Normalize data: ensure status field exists, fallback to present boolean if needed
  const normalized = (data || []).map((att: any) => ({
    ...att,
    status: att.status || (att.present ? 'present' : 'absent'),
  })) as Attendance[];

  return normalized;
}

/**
 * Create or update attendance records for a session
 */
export async function saveAttendanceForSession(
  sessionId: string,
  attendanceData: Array<{ student_id: string; present?: boolean; status?: AttendanceStatus; remark?: string }>
): Promise<Attendance[]> {
  // First, delete existing attendance records for this session
  await supabase.from('attendance').delete().eq('session_id', sessionId);

  // Then, insert new attendance records
  const recordsToInsert = attendanceData.map((att, index) => {
    // Determine status: use status if provided, otherwise convert present boolean
    let status: AttendanceStatus = 'present';
    if (att.status && ['present', 'excused', 'absent'].includes(att.status)) {
      status = att.status;
    } else if (att.present !== undefined) {
      status = att.present ? 'present' : 'absent';
    }

    // Generate unique ID for each record
    const uniqueId = `ATT${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`;

    // Build record with both status and present for compatibility
    const record: any = {
      id: uniqueId,
      session_id: sessionId,
      student_id: att.student_id,
      status, // Include status field
      present: status === 'present', // Keep for backward compatibility
      remark: att.remark || null,
    };

    return record;
  });

  const { data, error } = await supabase
    .from('attendance')
    .insert(recordsToInsert)
    .select();

  if (error) {
    console.error('[saveAttendanceForSession] Error details:', {
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      recordsCount: recordsToInsert.length,
      firstRecord: recordsToInsert[0],
    });
    throw new Error(`Failed to save attendance: ${error.message}${error.details ? ` - ${error.details}` : ''}${error.hint ? ` (Hint: ${error.hint})` : ''}`);
  }

  // Normalize response
  const normalized = (data || []).map((att: any) => ({
    ...att,
    status: att.status || (att.present ? 'present' : 'absent'),
  })) as Attendance[];

  return normalized;
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

