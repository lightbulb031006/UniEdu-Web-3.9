/**
 * Surveys Service
 * Frontend service for class surveys CRUD operations
 */

import api from './api';

export interface ClassSurvey {
  id: string;
  class_id: string;
  test_number: number; // Bài kiểm tra lần mấy
  responsible_person_id: string | null; // Người phụ trách
  report_date: string; // Ngày báo cáo (YYYY-MM-DD)
  content: string; // Nội dung báo cáo
  created_at?: string;
  updated_at?: string;
}

export interface SurveyWithTeacher extends ClassSurvey {
  responsible_person?: {
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
  } | null;
}

/**
 * Get all surveys for a class
 */
export async function fetchSurveysByClassId(classId: string): Promise<SurveyWithTeacher[]> {
  const response = await api.get<SurveyWithTeacher[]>(`/surveys/class/${classId}`);
  return response.data;
}

/**
 * Get survey by ID
 */
export async function fetchSurveyById(id: string): Promise<SurveyWithTeacher | null> {
  const response = await api.get<SurveyWithTeacher>(`/surveys/${id}`);
  return response.data;
}

/**
 * Create new survey
 */
export async function createSurvey(
  surveyData: Omit<ClassSurvey, 'id' | 'created_at' | 'updated_at'>
): Promise<SurveyWithTeacher> {
  const response = await api.post<SurveyWithTeacher>('/surveys', surveyData);
  return response.data;
}

/**
 * Update survey
 */
export async function updateSurvey(
  id: string,
  updates: Partial<Omit<ClassSurvey, 'id' | 'created_at' | 'updated_at'>>
): Promise<SurveyWithTeacher> {
  const response = await api.put<SurveyWithTeacher>(`/surveys/${id}`, updates);
  return response.data;
}

/**
 * Delete survey
 */
export async function deleteSurvey(id: string): Promise<void> {
  await api.delete(`/surveys/${id}`);
}


