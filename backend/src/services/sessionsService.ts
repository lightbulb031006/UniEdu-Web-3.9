/**
 * Sessions Service
 * Business logic for sessions CRUD operations
 */

import supabase from '../config/database';

export interface Session {
  id: string;
  class_id: string;
  teacher_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  coefficient?: number;
  notes?: string;
  payment_status?: 'paid' | 'unpaid' | 'deposit';
  allowance_amount?: number;
  subsidy_original?: number;
  subsidy_modified_by?: string;
  subsidy_modified_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SessionFilters {
  classId?: string;
  teacherId?: string;
  startDate?: string;
  endDate?: string;
  date?: string;
}

/**
 * Get all sessions with filters
 */
export async function getSessions(filters: SessionFilters = {}) {
  let query = supabase.from('sessions').select('*').order('date', { ascending: true });

  if (filters.classId) {
    query = query.eq('class_id', filters.classId);
  }

  if (filters.teacherId) {
    query = query.eq('teacher_id', filters.teacherId);
  }

  if (filters.date) {
    query = query.eq('date', filters.date);
  }

  if (filters.startDate) {
    query = query.gte('date', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  const sessions = (data || []) as Session[];

  // Calculate studentPaidCount for each session from attendance records
  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('session_id, present')
      .in('session_id', sessionIds);

    if (attendanceData) {
      // Count present students per session
      const paidCountMap = new Map<string, number>();
      attendanceData.forEach((att: any) => {
        if (att.present) {
          const current = paidCountMap.get(att.session_id) || 0;
          paidCountMap.set(att.session_id, current + 1);
        }
      });

      // Add studentPaidCount to each session
      sessions.forEach((session: any) => {
        session.studentPaidCount = paidCountMap.get(session.id) || 0;
      });
    } else {
      // If no attendance data, set to 0
      sessions.forEach((session: any) => {
        session.studentPaidCount = 0;
      });
    }
  }

  return sessions;
}

/**
 * Get sessions for a date range (for schedule view)
 */
export async function getSessionsForDateRange(startDate: string, endDate: string, filters: { classId?: string; teacherId?: string } = {}) {
  const sessionFilters: SessionFilters = {
    startDate,
    endDate,
    ...filters,
  };
  return getSessions(sessionFilters);
}

/**
 * Get a single session by ID
 */
export async function getSessionById(id: string): Promise<Session | null> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch session: ${error.message}`);
  }

  const session = data as any;

  // Calculate studentPaidCount from attendance records
  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('present')
    .eq('session_id', id);

  if (attendanceData) {
    session.studentPaidCount = attendanceData.filter((att: any) => att.present).length;
  } else {
    session.studentPaidCount = 0;
  }

  return session as Session;
}

/**
 * Apply session to students - update remaining_sessions and total_attended_sessions
 * This is called after creating a session to deduct remaining sessions from all students in the class
 */
export async function applySessionToStudents(classId: string): Promise<void> {
  // Get all active student_classes records for this class
  const { data: studentClasses, error: studentClassesError } = await supabase
    .from('student_classes')
    .select('id, student_id, remaining_sessions, total_attended_sessions')
    .eq('class_id', classId)
    .eq('status', 'active');

  if (studentClassesError) {
    throw new Error(`Failed to fetch student classes: ${studentClassesError.message}`);
  }

  if (!studentClasses || studentClasses.length === 0) {
    return; // No students in class
  }

  // Update each student_class record
  const updatePromises = studentClasses.map(async (sc) => {
    const currentRemaining = sc.remaining_sessions || 0;
    const currentAttended = sc.total_attended_sessions || 0;

    // Always increment total_attended_sessions
    // If remaining_sessions > 0, decrement it
    const updates: any = {
      total_attended_sessions: currentAttended + 1,
    };

    if (currentRemaining > 0) {
      updates.remaining_sessions = currentRemaining - 1;
    } else {
      // If no remaining sessions, increment unpaid_sessions
      const { data: currentRecord } = await supabase
        .from('student_classes')
        .select('unpaid_sessions')
        .eq('id', sc.id)
        .single();

      const currentUnpaid = (currentRecord as any)?.unpaid_sessions || 0;
      updates.unpaid_sessions = currentUnpaid + 1;
    }

    const { error } = await supabase
      .from('student_classes')
      .update(updates)
      .eq('id', sc.id);

    if (error) {
      console.error(`Failed to update student_class ${sc.id}:`, error);
      // Don't throw - continue with other students
    }
  });

  await Promise.all(updatePromises);
}

/**
 * Create a new session
 */
export async function createSession(sessionData: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Promise<Session> {
  if (!sessionData.class_id || !sessionData.date) {
    throw new Error('Class ID and date are required');
  }

  // Generate unique ID for session
  const id = `SES${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data, error } = await supabase
    .from('sessions')
    .insert({ ...sessionData, id })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  // Apply session to students - deduct remaining sessions
  try {
    await applySessionToStudents(sessionData.class_id);
  } catch (applyError) {
    console.error('Failed to apply session to students:', applyError);
    // Don't fail the session creation if this fails - log and continue
  }

  return data as Session;
}

/**
 * Update an existing session
 */
export async function updateSession(id: string, updates: Partial<Omit<Session, 'id' | 'created_at'>>): Promise<Session> {
  const { data, error } = await supabase.from('sessions').update(updates).eq('id', id).select().single();

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  return data as Session;
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('sessions').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

