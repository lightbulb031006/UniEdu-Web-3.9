/**
 * Sessions Service (Frontend)
 * API calls for sessions operations
 */

import api from './api';

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
  studentPaidCount?: number; // Number of students who paid (present in attendance)
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
 * Normalize session data from API response
 */
function normalizeSession(session: any): Session {
  return {
    id: session.id,
    class_id: session.class_id || session.classId || '',
    teacher_id: session.teacher_id || session.teacherId,
    date: session.date || '',
    start_time: session.start_time || session.startTime,
    end_time: session.end_time || session.endTime,
    duration: session.duration,
    coefficient: session.coefficient !== undefined && session.coefficient !== null ? session.coefficient : 1,
    notes: session.notes,
    payment_status: session.payment_status || session.paymentStatus,
    allowance_amount: session.allowance_amount != null ? session.allowance_amount : (session.allowanceAmount != null ? session.allowanceAmount : undefined),
    subsidy_original: session.subsidy_original || session.subsidyOriginal,
    subsidy_modified_by: session.subsidy_modified_by || session.subsidyModifiedBy,
    subsidy_modified_at: session.subsidy_modified_at || session.subsidyModifiedAt,
    studentPaidCount: session.studentPaidCount !== undefined ? session.studentPaidCount : (session.student_paid_count !== undefined ? session.student_paid_count : 0),
    created_at: session.created_at || session.createdAt,
    updated_at: session.updated_at || session.updatedAt,
  };
}

/**
 * Fetch all sessions with optional filters
 */
export async function fetchSessions(filters: SessionFilters = {}): Promise<Session[]> {
  const params = new URLSearchParams();
  if (filters.classId) {
    params.append('classId', filters.classId);
  }
  if (filters.teacherId) {
    params.append('teacherId', filters.teacherId);
  }
  if (filters.date) {
    params.append('date', filters.date);
  }
  if (filters.startDate) {
    params.append('startDate', filters.startDate);
  }
  if (filters.endDate) {
    params.append('endDate', filters.endDate);
  }

  const response = await api.get<Session[]>(`/sessions?${params.toString()}`);
  return (response.data || []).map(normalizeSession);
}

/**
 * Fetch a single session by ID
 */
export async function fetchSessionById(id: string): Promise<Session> {
  const response = await api.get<Session>(`/sessions/${id}`);
  return normalizeSession(response.data);
}

/**
 * Create a new session
 */
export async function createSession(data: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Promise<Session> {
  const response = await api.post<Session>('/sessions', data);
  return normalizeSession(response.data);
}

/**
 * Update an existing session
 */
export async function updateSession(id: string, data: Partial<Session>): Promise<Session> {
  const response = await api.put<Session>(`/sessions/${id}`, data);
  return normalizeSession(response.data);
}

/**
 * Delete a session
 */
export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/sessions/${id}`);
}

