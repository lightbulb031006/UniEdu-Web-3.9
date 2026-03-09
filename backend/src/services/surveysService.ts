/**
 * Surveys Service
 * Business logic for class surveys CRUD operations
 */

import supabase from '../config/database';

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
export async function getSurveysByClassId(classId: string): Promise<SurveyWithTeacher[]> {
  try {
    const { data, error } = await supabase
      .from('class_surveys')
      .select('*')
      .eq('class_id', classId)
      .order('report_date', { ascending: false })
      .order('test_number', { ascending: false });

    if (error) {
      console.error('[getSurveysByClassId] Error fetching surveys:', error);
      throw new Error(`Failed to fetch surveys: ${error.message}`);
    }

    const surveys = (data || []) as ClassSurvey[];

    // Fetch teacher details for responsible_person_id
    const teacherIds = surveys
      .map((s) => s.responsible_person_id)
      .filter((id): id is string => id !== null && id !== undefined);

    let teachersMap = new Map<string, any>();
    if (teacherIds.length > 0) {
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('id, full_name, email, phone')
        .in('id', teacherIds);

      if (!teachersError && teachersData) {
        teachersData.forEach((teacher: any) => {
          teachersMap.set(teacher.id, {
            id: teacher.id,
            full_name: teacher.full_name,
            email: teacher.email,
            phone: teacher.phone,
          });
        });
      }
    }

    // Map surveys with teacher details
    const surveysWithTeachers: SurveyWithTeacher[] = surveys.map((survey) => ({
      ...survey,
      responsible_person: survey.responsible_person_id
        ? teachersMap.get(survey.responsible_person_id) || null
        : null,
    }));

    return surveysWithTeachers;
  } catch (err: any) {
    console.error('[getSurveysByClassId] Exception:', err);
    throw err;
  }
}

/**
 * Get survey by ID
 */
export async function getSurveyById(id: string): Promise<SurveyWithTeacher | null> {
  try {
    const { data, error } = await supabase
      .from('class_surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[getSurveyById] Error fetching survey:', error);
      throw new Error(`Failed to fetch survey: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const survey = data as ClassSurvey;

    // Fetch teacher details if responsible_person_id exists
    let responsiblePerson = null;
    if (survey.responsible_person_id) {
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, full_name, email, phone')
        .eq('id', survey.responsible_person_id)
        .single();

      if (!teacherError && teacherData) {
        responsiblePerson = {
          id: teacherData.id,
          full_name: teacherData.full_name,
          email: teacherData.email,
          phone: teacherData.phone,
        };
      }
    }

    return {
      ...survey,
      responsible_person: responsiblePerson,
    };
  } catch (err: any) {
    console.error('[getSurveyById] Exception:', err);
    throw err;
  }
}

/**
 * Create new survey
 */
export async function createSurvey(
  surveyData: Omit<ClassSurvey, 'id' | 'created_at' | 'updated_at'>
): Promise<SurveyWithTeacher> {
  try {
    // Generate ID if not provided
    const id = `SRV${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Prepare insert data
    const insertData: any = {
      id,
      class_id: surveyData.class_id,
      test_number: surveyData.test_number,
      responsible_person_id: surveyData.responsible_person_id || null,
      report_date: surveyData.report_date,
      content: surveyData.content,
    };

    const { data, error } = await supabase
      .from('class_surveys')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('[createSurvey] Error creating survey:', error);
      throw new Error(`Failed to create survey: ${error.message}`);
    }

    // Fetch teacher details if responsible_person_id exists
    let responsiblePerson = null;
    if (data.responsible_person_id) {
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, full_name, email, phone')
        .eq('id', data.responsible_person_id)
        .single();

      if (!teacherError && teacherData) {
        responsiblePerson = {
          id: teacherData.id,
          full_name: teacherData.full_name,
          email: teacherData.email,
          phone: teacherData.phone,
        };
      }
    }

    return {
      ...(data as ClassSurvey),
      responsible_person: responsiblePerson,
    };
  } catch (err: any) {
    console.error('[createSurvey] Exception:', err);
    throw err;
  }
}

/**
 * Update survey
 */
export async function updateSurvey(
  id: string,
  updates: Partial<Omit<ClassSurvey, 'id' | 'created_at' | 'updated_at'>>
): Promise<SurveyWithTeacher> {
  try {
    // Map camelCase to snake_case if needed
    const updateData: any = {};
    if (updates.class_id !== undefined) updateData.class_id = updates.class_id;
    if (updates.test_number !== undefined) updateData.test_number = updates.test_number;
    if (updates.responsible_person_id !== undefined)
      updateData.responsible_person_id = updates.responsible_person_id || null;
    if (updates.report_date !== undefined) updateData.report_date = updates.report_date;
    if (updates.content !== undefined) updateData.content = updates.content;

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('class_surveys')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[updateSurvey] Error updating survey:', error);
      throw new Error(`Failed to update survey: ${error.message}`);
    }

    // Fetch teacher details if responsible_person_id exists
    let responsiblePerson = null;
    if (data.responsible_person_id) {
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, full_name, email, phone')
        .eq('id', data.responsible_person_id)
        .single();

      if (!teacherError && teacherData) {
        responsiblePerson = {
          id: teacherData.id,
          full_name: teacherData.full_name,
          email: teacherData.email,
          phone: teacherData.phone,
        };
      }
    }

    return {
      ...(data as ClassSurvey),
      responsible_person: responsiblePerson,
    };
  } catch (err: any) {
    console.error('[updateSurvey] Exception:', err);
    throw err;
  }
}

/**
 * Delete survey
 */
export async function deleteSurvey(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('class_surveys').delete().eq('id', id);

    if (error) {
      console.error('[deleteSurvey] Error deleting survey:', error);
      throw new Error(`Failed to delete survey: ${error.message}`);
    }
  } catch (err: any) {
    console.error('[deleteSurvey] Exception:', err);
    throw err;
  }
}


