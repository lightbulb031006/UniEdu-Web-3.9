/**
 * Classes Service
 * Business logic for classes CRUD operations
 */

import supabase from '../config/database';

export interface ClassFilters {
  search?: string;
  type?: string;
  status?: 'all' | 'running' | 'stopped';
}

export interface Class {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped';
  teacher_ids?: string[];
  max_students?: number;
  tuition_per_session?: number;
  student_tuition_per_session?: number;
  tuition_package_total?: number;
  tuition_package_sessions?: number;
}

export async function getClasses(filters: ClassFilters = {}) {
  try {
    // Select columns including denormalized teacher_ids for fast access
    let query = supabase.from('classes').select('id, name, type, status, max_students, tuition_per_session, scale_amount, max_allowance_per_session, student_tuition_per_session, tuition_package_total, tuition_package_sessions, schedule, custom_teacher_allowances, teacher_ids, created_at, updated_at');

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getClasses] Error fetching classes:', error);
      throw new Error(`Failed to fetch classes: ${error.message}`);
    }

    let classes = (data || []) as any[];

    // Use denormalized teacher_ids from classes table (much faster than joining)
    // Ensure teacher_ids is always an array
    classes = classes.map((cls: any) => {
      let teacherIds: string[] = [];
      if (cls.teacher_ids) {
        if (Array.isArray(cls.teacher_ids)) {
          teacherIds = cls.teacher_ids.filter(Boolean);
        } else if (typeof cls.teacher_ids === 'string') {
          // Handle JSONB string format
          try {
            const parsed = JSON.parse(cls.teacher_ids);
            teacherIds = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
          } catch {
            teacherIds = [];
          }
        }
      }
      return {
        ...cls,
        teacher_ids: teacherIds,
      };
    });

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      classes = classes.filter(
        (cls: any) => cls.name?.toLowerCase().includes(searchLower) || cls.type?.toLowerCase().includes(searchLower)
      );
    }

    return classes as Class[];
  } catch (err: any) {
    console.error('[getClasses] Exception:', err);
    throw err;
  }
}

export async function getClassById(id: string, options: { includeTeachers?: boolean } = {}) {
  try {
    // Select columns including denormalized teacher_ids for fast access
    const { data, error } = await supabase.from('classes').select('id, name, type, status, max_students, tuition_per_session, scale_amount, max_allowance_per_session, student_tuition_per_session, tuition_package_total, tuition_package_sessions, schedule, custom_teacher_allowances, teacher_ids, created_at, updated_at').eq('id', id).single();

    if (error) {
      console.error(`[getClassById] Error fetching class ${id}:`, error);
      throw new Error(`Failed to fetch class: ${error.message}`);
    }

    if (!data) {
      console.warn(`[getClassById] Class ${id} not found`);
      return null;
    }

    const cls = data as any;

    // Use denormalized teacher_ids from classes table (much faster than querying class_teachers)
    let teacherIds: string[] = [];
    if (cls.teacher_ids) {
      if (Array.isArray(cls.teacher_ids)) {
        teacherIds = cls.teacher_ids.filter(Boolean);
      } else if (typeof cls.teacher_ids === 'string') {
        // Handle JSONB string format
        try {
          const parsed = JSON.parse(cls.teacher_ids);
          teacherIds = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          teacherIds = [];
        }
      }
    }
    cls.teacher_ids = teacherIds;

    // If includeTeachers is true, fetch teacher details
    if (options.includeTeachers && cls.teacher_ids.length > 0) {
      try {
        const { data: teachersData, error: teachersError } = await supabase
          .from('teachers')
          .select('id, full_name, email, phone, roles')
          .in('id', cls.teacher_ids);

        if (teachersError) {
          console.error(`[getClassById] Error fetching teachers for class ${id}:`, teachersError);
          cls.teachers = [];
        } else {
          cls.teachers = (teachersData || []).map((t: any) => ({
            id: t.id,
            fullName: t.full_name,
            email: t.email,
            phone: t.phone,
            roles: t.roles || [],
          }));
        }
      } catch (err: any) {
        console.error(`[getClassById] Exception fetching teachers for class ${id}:`, err);
        cls.teachers = [];
      }
    }

    return cls as Class & { teachers?: Array<{ id: string; fullName: string; email?: string; phone?: string; roles?: string[] }> };
  } catch (err: any) {
    console.error(`[getClassById] Exception fetching class ${id}:`, err);
    throw err;
  }
}

export async function createClass(classData: Omit<Class, 'id' | 'teacher_ids'> & { teacherIds?: string[] }) {
  // Extract teacherIds if provided
  const { teacherIds, ...classFields } = classData as any;

  // Generate ID if not provided
  const id = (classData as any).id || `CLS${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Prepare insert data - map camelCase fields to snake_case for database
  const insertData: any = { id };
  
  // Map camelCase fields to snake_case for database
  const fieldMapping: Record<string, string> = {
    name: 'name',
    type: 'type',
    status: 'status',
    maxStudents: 'max_students',
    tuitionPerSession: 'tuition_per_session',
    studentTuitionPerSession: 'student_tuition_per_session',
    tuitionPackageTotal: 'tuition_package_total',
    tuitionPackageSessions: 'tuition_package_sessions',
    scaleAmount: 'scale_amount',
    maxAllowancePerSession: 'max_allowance_per_session',
  };

  // Only include valid fields and map them
  Object.keys(classFields).forEach((key) => {
    // Skip teacher-related fields - they are handled separately via class_teachers table
    if (key === 'teacherIds' || key === 'teacher_ids' || key === 'teacherId' || key === 'teacher_id') {
      return;
    }
    
    if (fieldMapping[key] !== undefined) {
      const dbField = fieldMapping[key];
      let value = classFields[key];
      
      // Handle empty string for numeric fields - convert to null
      if ((dbField === 'tuition_package_sessions' || 
           dbField === 'tuition_package_total' || 
           dbField === 'student_tuition_per_session' ||
           dbField === 'tuition_per_session' ||
           dbField === 'scale_amount' ||
           dbField === 'max_allowance_per_session') && 
          value === '') {
        value = null;
      }
      
      insertData[dbField] = value;
    } else if (key === 'schedule' || key === 'customTeacherAllowances') {
      // These are handled separately if needed
    } else if (key.startsWith('_') || key === 'id' || key === 'created_at' || key === 'updated_at') {
      // Skip internal fields
    } else {
      // For unknown fields, try to use as-is (might be snake_case already)
      // But skip teacher_ids to avoid database error
      if (key !== 'teacher_ids') {
        insertData[key] = classFields[key];
      }
    }
  });

  const { data, error } = await supabase
    .from('classes')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('[createClass] Error creating class:', error);
    console.error('[createClass] Insert data:', JSON.stringify(insertData, null, 2));
    throw new Error(`Failed to create class: ${error.message}`);
  }

  const cls = data as any;

  // Handle teacher assignments if teacherIds provided
  if (teacherIds && Array.isArray(teacherIds) && teacherIds.length > 0) {
    const classTeacherRecords = teacherIds.map((teacherId) => ({
      id: `CT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      class_id: id,
      teacher_id: teacherId,
    }));

    const { error: ctError } = await supabase.from('class_teachers').insert(classTeacherRecords);

    if (ctError) {
      console.error('Failed to create class_teachers records:', ctError);
      // Don't throw - class is already created, just log the error
    }
  }

  // Fetch the class with teacher relationships
  return await getClassById(id);
}

export async function updateClass(id: string, classData: Partial<Class> & { teacherIds?: string[]; schedule?: any; customTeacherAllowances?: any }) {
  // Extract teacherIds if provided
  const { teacherIds, schedule, customTeacherAllowances, ...classFields } = classData as any;

  // Prepare update data - only include fields that exist in the database schema
  const updateData: any = {};
  
  // Map camelCase fields to snake_case for database
  const fieldMapping: Record<string, string> = {
    name: 'name',
    type: 'type',
    status: 'status',
    maxStudents: 'max_students',
    tuitionPerSession: 'tuition_per_session',
    studentTuitionPerSession: 'student_tuition_per_session',
    tuitionPackageTotal: 'tuition_package_total',
    tuitionPackageSessions: 'tuition_package_sessions',
    scaleAmount: 'scale_amount',
    maxAllowancePerSession: 'max_allowance_per_session',
  };

  // Only include valid fields
  Object.keys(classFields).forEach((key) => {
    if (fieldMapping[key] !== undefined) {
      const dbField = fieldMapping[key];
      let value = classFields[key];
      
      // Handle empty string for numeric fields - convert to null
      if ((dbField === 'tuition_package_sessions' || 
           dbField === 'tuition_package_total' || 
           dbField === 'student_tuition_per_session' ||
           dbField === 'tuition_per_session' ||
           dbField === 'scale_amount' ||
           dbField === 'max_allowance_per_session') && 
          value === '') {
        value = null;
      }
      
      updateData[dbField] = value;
    } else if (key === 'schedule' || key === 'customTeacherAllowances') {
      // These are handled separately
    } else if (key.startsWith('_') || key === 'id' || key === 'created_at' || key === 'updated_at') {
      // Skip internal fields
    } else {
      // For unknown fields, try to use as-is (might be snake_case already)
      updateData[key] = classFields[key];
    }
  });

  // Handle schedule (JSONB field)
  if (schedule !== undefined) {
    // Ensure schedule is an array
    if (Array.isArray(schedule)) {
      updateData.schedule = schedule;
    } else if (typeof schedule === 'string') {
      // If it's a string, try to parse it
      try {
        updateData.schedule = JSON.parse(schedule);
      } catch (e) {
        // If parsing fails, set to empty array
        updateData.schedule = [];
      }
    } else {
      // If it's not an array or string, set to empty array
      updateData.schedule = [];
    }
  }

  // Handle customTeacherAllowances (JSONB field) - map camelCase to snake_case
  if (customTeacherAllowances !== undefined) {
    updateData.custom_teacher_allowances = customTeacherAllowances;
  }

  // Update class basic info
  const { data, error } = await supabase
    .from('classes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update class:', error);
    console.error('Update data:', JSON.stringify(updateData, null, 2));
    console.error('Original classData:', JSON.stringify(classData, null, 2));
    throw new Error(`Failed to update class: ${error.message}`);
  }

  // Handle teacher assignments if teacherIds provided
  if (teacherIds !== undefined) {
    // Get current teacher assignments
    const { data: currentTeachers } = await supabase
      .from('class_teachers')
      .select('teacher_id')
      .eq('class_id', id);

    const currentTeacherIds = (currentTeachers || []).map((ct: any) => ct.teacher_id);
    const newTeacherIds = Array.isArray(teacherIds) ? teacherIds.filter(Boolean) : [];

    // Find teachers to add
    const toAdd = newTeacherIds.filter((teacherId) => !currentTeacherIds.includes(teacherId));
    // Find teachers to remove
    const toRemove = currentTeacherIds.filter((teacherId) => !newTeacherIds.includes(teacherId));

    // Add new teacher assignments
    if (toAdd.length > 0) {
      const newRecords = toAdd.map((teacherId) => ({
        id: `CT${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        class_id: id,
        teacher_id: teacherId,
      }));

      const { error: addError } = await supabase.from('class_teachers').insert(newRecords);
      if (addError) {
        console.error('Failed to add class_teachers records:', addError);
      }
    }

    // Remove teacher assignments
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('class_teachers')
        .delete()
        .eq('class_id', id)
        .in('teacher_id', toRemove);

      if (removeError) {
        console.error('Failed to remove class_teachers records:', removeError);
      }
    }
  }

  // Fetch the updated class with teacher relationships
  return await getClassById(id);
}

/**
 * Remove a teacher from a class
 * This removes the class_teachers relationship but keeps custom_teacher_allowances for history
 */
export async function removeTeacherFromClass(classId: string, teacherId: string) {
  // Check if the relationship exists
  const { data: existing } = await supabase
    .from('class_teachers')
    .select('id')
    .eq('class_id', classId)
    .eq('teacher_id', teacherId)
    .single();

  if (!existing) {
    throw new Error('Giáo viên không có trong lớp này');
  }

  // Remove the class_teachers relationship
  const { error } = await supabase
    .from('class_teachers')
    .delete()
    .eq('class_id', classId)
    .eq('teacher_id', teacherId);

  if (error) {
    throw new Error(`Không thể gỡ giáo viên khỏi lớp: ${error.message}`);
  }

  // Get the class to ensure custom_teacher_allowances entry exists for history
  const { data: classData } = await supabase
    .from('classes')
    .select('custom_teacher_allowances, tuition_per_session')
    .eq('id', classId)
    .single();

  if (classData) {
    const currentAllowances = (classData.custom_teacher_allowances as Record<string, number>) || {};
    
    // Ensure allowance entry exists for history tracking
    if (!currentAllowances.hasOwnProperty(teacherId) || currentAllowances[teacherId] === null || currentAllowances[teacherId] === undefined) {
      const defaultAllowance = classData.tuition_per_session || 0;
      currentAllowances[teacherId] = defaultAllowance;
      
      // Update class to keep the allowance entry
      await supabase
        .from('classes')
        .update({ custom_teacher_allowances: currentAllowances })
        .eq('id', classId);
    }
  }

  return await getClassById(classId);
}

export async function deleteClass(id: string) {
  const { error } = await supabase.from('classes').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete class: ${error.message}`);
  }
}

/**
 * Get students enrolled in a class with their remaining sessions
 */
export async function getClassStudentsWithRemainingSessions(classId: string) {
  // Get all active student_classes records for this class
  const { data: studentClasses, error: scError } = await supabase
    .from('student_classes')
    .select('*, students(*)')
    .eq('class_id', classId)
    .eq('status', 'active');

  if (scError) {
    throw new Error(`Failed to fetch class students: ${scError.message}`);
  }

  if (!studentClasses || studentClasses.length === 0) {
    return [];
  }

  // Get attendance count for each student in this class
  const studentIds = studentClasses.map((sc: any) => sc.student_id);
  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('student_id, session_id, sessions!inner(class_id)')
    .eq('sessions.class_id', classId)
    .in('student_id', studentIds)
    .eq('present', true);

  // Count attended sessions per student
  const attendedCountMap = new Map<string, number>();
  if (attendanceData) {
    attendanceData.forEach((att: any) => {
      const studentId = att.student_id;
      attendedCountMap.set(studentId, (attendedCountMap.get(studentId) || 0) + 1);
    });
  }

  // Get class info to calculate default tuition
  const { data: classData } = await supabase
    .from('classes')
    .select('student_tuition_per_session, tuition_package_total, tuition_package_sessions')
    .eq('id', classId)
    .single();

  const classDefaultTuition = classData?.student_tuition_per_session || 0;
  const classPackageTotal = classData?.tuition_package_total || 0;
  const classPackageSessions = classData?.tuition_package_sessions || 0;
  const classCalculatedTuition = classDefaultTuition > 0 
    ? classDefaultTuition 
    : (classPackageTotal > 0 && classPackageSessions > 0 ? classPackageTotal / classPackageSessions : 0);

  // Process each student_class record
  return studentClasses.map((sc: any) => {
    const student = sc.students || {};
    const remaining = Math.max(0, Number(sc.remaining_sessions || 0));
    const attended = Math.max(0, Number(sc.total_attended_sessions || 0) || attendedCountMap.get(sc.student_id) || 0);

    // Calculate student tuition per session
    // Priority: student_tuition_per_session > calculated from student_fee > class default
    const studentTuitionPerSession = sc.student_tuition_per_session || 0;
    const studentFeeTotal = sc.student_fee_total || 0;
    const studentFeeSessions = sc.student_fee_sessions || 0;
    const calculatedFromFee = studentFeeTotal > 0 && studentFeeSessions > 0 ? studentFeeTotal / studentFeeSessions : 0;
    const tuitionPerSession = studentTuitionPerSession > 0 
      ? studentTuitionPerSession 
      : (calculatedFromFee > 0 ? calculatedFromFee : classCalculatedTuition);

    return {
      student: {
        id: student.id,
        full_name: student.full_name,
        birth_year: student.birth_year,
        province: student.province,
        status: student.status,
      },
      studentClass: {
        id: sc.id,
        student_id: sc.student_id,
        class_id: sc.class_id,
        start_date: sc.start_date,
        status: sc.status,
        remaining_sessions: remaining,
        total_attended_sessions: attended,
        student_tuition_per_session: sc.student_tuition_per_session,
        student_fee_total: sc.student_fee_total,
        student_fee_sessions: sc.student_fee_sessions,
      },
      remainingSessions: remaining,
      totalAttended: attended,
      tuitionPerSession: tuitionPerSession, // Add tuition per session for this student
    };
  });
}

/**
 * Add a student to a class
 * Creates a student_classes record
 */
export async function addStudentToClass(studentId: string, classId: string) {
  // Validate inputs
  if (!studentId || !classId) {
    throw new Error('Missing required fields: studentId and classId');
  }

  // Check if student exists
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    throw new Error('Học sinh không tồn tại');
  }

  // Check if class exists
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id, max_students')
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    throw new Error('Lớp học không tồn tại');
  }

  // Check if student is already enrolled (check all statuses, not just active)
  const { data: existing, error: existingError } = await supabase
    .from('student_classes')
    .select('id, status')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    // PGRST116 is "not found" error, which is expected
    throw new Error(`Không thể kiểm tra học sinh: ${existingError.message}`);
  }

  if (existing) {
    if (existing.status === 'active') {
      throw new Error('Học sinh đã có trong lớp này');
    } else {
      // If student was previously enrolled but inactive, reactivate them
      const { data: updated, error: updateError } = await supabase
        .from('student_classes')
        .update({ status: 'active', start_date: new Date().toISOString().slice(0, 10) })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Không thể kích hoạt lại học sinh: ${updateError.message}`);
      }

      return updated;
    }
  }

  // Check max students limit
  if (classData.max_students) {
    const { count, error: countError } = await supabase
      .from('student_classes')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('status', 'active');

    if (!countError && count !== null && count >= classData.max_students) {
      throw new Error(`Lớp đã đạt số lượng học sinh tối đa (${classData.max_students})`);
    }
  }

  // Create student_classes record
  const id = `SC${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const startDate = new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabase
    .from('student_classes')
    .insert([
      {
        id,
        student_id: studentId,
        class_id: classId,
        start_date: startDate,
        status: 'active',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Failed to add student to class:', error);
    console.error('Insert data:', { id, student_id: studentId, class_id: classId, start_date: startDate, status: 'active' });
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      throw new Error('Học sinh đã có trong lớp này');
    }
    
    throw new Error(`Không thể thêm học sinh vào lớp: ${error.message}`);
  }

  return data;
}

/**
 * Remove a student from a class
 * Sets student_classes status to inactive and optionally creates refund transaction
 */
export async function removeStudentFromClass(studentId: string, classId: string, refundRemaining: boolean = true) {
  // This is the same as removeStudentClass in studentsService
  // Import and reuse that function
  const { removeStudentClass } = await import('./studentsService');
  return removeStudentClass(studentId, classId, refundRemaining);
}

/**
 * Move a student from one class to another
 * This removes the student from the current class and adds them to the new class
 */
export async function moveStudentToClass(studentId: string, fromClassId: string, toClassId: string, refundRemaining: boolean = true) {
  // First, remove student from current class (with optional refund)
  await removeStudentFromClass(studentId, fromClassId, refundRemaining);
  
  // Then, add student to new class
  // Check if student is already in the new class
  const { data: existing } = await supabase
    .from('student_classes')
    .select('id')
    .eq('student_id', studentId)
    .eq('class_id', toClassId)
    .eq('status', 'active')
    .single();

  if (existing) {
    throw new Error('Học sinh đã có trong lớp này');
  }

  // Create new student_classes record
  const id = `SC${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const { data, error } = await supabase
    .from('student_classes')
    .insert([
      {
        id,
        student_id: studentId,
        class_id: toClassId,
        start_date: new Date().toISOString().slice(0, 10),
        status: 'active',
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Không thể thêm học sinh vào lớp mới: ${error.message}`);
  }

  return data;
}

/**
 * Get class detail data with teacher statistics calculated in backend
 * Returns teacher stats (totalReceived, allowance) for each teacher in the class
 */
export async function getClassDetailData(classId: string) {
  // Get class data
  const classData = await getClassById(classId);
  if (!classData) {
    throw new Error('Class not found');
  }

  // Get class teachers
  const { data: classTeachersData, error: classTeachersError } = await supabase
    .from('class_teachers')
    .select('teacher_id')
    .eq('class_id', classId);

  if (classTeachersError) {
    console.error('Failed to fetch class_teachers:', classTeachersError);
  }

  const teacherIds = (classTeachersData || []).map((ct: any) => ct.teacher_id);

  if (teacherIds.length === 0) {
    return {
      teacherStats: [],
    };
  }

  // Get teachers
  const { data: teachers, error: teachersError } = await supabase
    .from('teachers')
    .select('id, full_name, email, phone')
    .in('id', teacherIds);

  if (teachersError) {
    console.error('Failed to fetch teachers:', teachersError);
  }

  // Get all sessions for this class
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('*')
    .eq('class_id', classId)
    .order('date', { ascending: false });

  if (sessionsError) {
    console.error('Failed to fetch sessions:', sessionsError);
  }

  // Get custom allowances
  const customAllowances = ((classData as any)?.custom_teacher_allowances || {}) as Record<string, number>;
  const defaultSalary = Number(classData.tuition_per_session) || 0;

  // Calculate teacher stats
  const teacherStats = (teachers || []).map((teacher: any) => {
    const teacherSessions = (sessions || []).filter((s: any) => s.teacher_id === teacher.id);
    
    // Calculate total received from paid sessions
    const totalReceived = teacherSessions
      .filter((s: any) => s.payment_status === 'paid')
      .reduce((sum: number, s: any) => {
        // Use allowance_amount if available
        const allowance = s.allowance_amount != null ? Number(s.allowance_amount) : 0;
        return sum + allowance;
      }, 0);

    const allowance = customAllowances[teacher.id] ?? defaultSalary;

    return {
      teacher: {
        id: teacher.id,
        fullName: teacher.full_name,
        email: teacher.email,
        phone: teacher.phone,
      },
      allowance,
      totalReceived,
    };
  });

  return {
    teacherStats,
  };
}

