/**
 * Attendance Service (Frontend)
 * API calls for attendance operations
 */

import api from './api';

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
 * Normalize attendance data from API response
 */
function normalizeAttendance(attendance: any): Attendance {
  return {
    id: attendance.id,
    session_id: attendance.session_id || attendance.sessionId || '',
    student_id: attendance.student_id || attendance.studentId || '',
    present: attendance.present !== undefined ? attendance.present : true,
    remark: attendance.remark,
    created_at: attendance.created_at || attendance.createdAt,
    updated_at: attendance.updated_at || attendance.updatedAt,
  };
}

/**
 * Fetch attendance records for a session
 */
export async function fetchAttendanceBySession(sessionId: string): Promise<Attendance[]> {
  try {
    const response = await api.get<Attendance[]>(`/attendance?sessionId=${sessionId}`);
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }
    return response.data.map(normalizeAttendance);
  } catch (error) {
    console.error('Failed to fetch attendance:', error);
    return [];
  }
}

/**
 * Create or update attendance records for a session
 */
export async function saveAttendanceForSession(
  sessionId: string,
  attendanceData: Array<{ student_id: string; present: boolean; remark?: string }>
): Promise<Attendance[]> {
  const response = await api.post<Attendance[]>(`/attendance/session/${sessionId}`, {
    attendance: attendanceData,
  });
  return (response.data || []).map(normalizeAttendance);
}

/**
 * Delete attendance records for a session
 */
export async function deleteAttendanceBySession(sessionId: string): Promise<void> {
  await api.delete(`/attendance/session/${sessionId}`);
}

