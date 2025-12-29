/**
 * Students Service
 * Business logic for students CRUD operations
 */

import supabase from '../config/database';

export interface StudentFilters {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  province?: string;
}

export interface Student {
  id: string;
  full_name: string;
  birth_year: number;
  school: string;
  province: string;
  parent_name: string;
  parent_phone: string;
  email?: string;
  account_handle?: string;
  account_password?: string;
  status?: 'active' | 'inactive';
  wallet_balance?: number;
  loan_balance?: number;
  goal?: string;
  class_id?: string | string[] | null; // Single class ID or array of class IDs
  class_ids?: string[]; // Array of class IDs for compatibility
}

/**
 * Get all students with filters
 */
export async function getStudents(filters: StudentFilters = {}) {
  let query = supabase.from('students').select('*');

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.province) {
    query = query.eq('province', filters.province);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch students: ${error.message}`);
  }

  let students = (data || []) as any[];

  // Fetch student_classes relationships to get class IDs for each student
  const { data: studentClassesData, error: studentClassesError } = await supabase
    .from('student_classes')
    .select('student_id, class_id, status');

  if (!studentClassesError && studentClassesData) {
    // Group class IDs by student ID
    const classMap = new Map<string, string[]>();
    studentClassesData.forEach((sc: any) => {
      if (sc.status === 'active') {
        const studentId = sc.student_id;
        if (!classMap.has(studentId)) {
          classMap.set(studentId, []);
        }
        classMap.get(studentId)!.push(sc.class_id);
      }
    });

    // Add class_id array to each student
    students = students.map((student: any) => {
      const classIds = classMap.get(student.id) || [];
      return {
        ...student,
        class_id: classIds.length > 0 ? classIds : null,
        class_ids: classIds, // Also include as array for compatibility
      };
    });
  }

  // Client-side search (can be moved to backend with full-text search)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    students = students.filter(
      (student: any) =>
        student.full_name?.toLowerCase().includes(searchLower) ||
        student.school?.toLowerCase().includes(searchLower) ||
        student.province?.toLowerCase().includes(searchLower) ||
        student.parent_name?.toLowerCase().includes(searchLower) ||
        student.parent_phone?.toLowerCase().includes(searchLower)
    );
  }

  return students as Student[];
}

/**
 * Get student by ID
 */
export async function getStudentById(id: string) {
  const { data, error } = await supabase.from('students').select('*').eq('id', id).single();

  if (error) {
    throw new Error(`Failed to fetch student: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const student = data as any;

  // Fetch student_classes relationships to get class IDs
  const { data: studentClassesData, error: studentClassesError } = await supabase
    .from('student_classes')
    .select('class_id')
    .eq('student_id', id)
    .eq('status', 'active');

  if (!studentClassesError && studentClassesData) {
    const classIds = studentClassesData.map((sc: any) => sc.class_id);
    student.class_id = classIds.length > 0 ? classIds : null;
    student.class_ids = classIds;
  } else {
    student.class_id = null;
    student.class_ids = [];
  }

  return student as Student;
}

/**
 * Create new student
 */
export async function createStudent(studentData: Omit<Student, 'id' | 'class_id' | 'class_ids'> & { classIds?: string[] }) {
  // Extract classIds if provided
  const { classIds, ...studentFields } = studentData as any;
  
  // Generate ID if not provided
  const id = (studentData as any).id || `STU${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  
  const { data, error } = await supabase
    .from('students')
    .insert([{ ...studentFields, id }])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create student: ${error.message}`);
  }

  const student = data as Student;

  // Handle class assignments if classIds provided
  if (classIds && Array.isArray(classIds) && classIds.length > 0) {
    const studentClassRecords = classIds.map((classId) => ({
      id: `SC${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      student_id: id,
      class_id: classId,
      start_date: new Date().toISOString().slice(0, 10),
      status: 'active',
    }));

    const { error: scError } = await supabase.from('student_classes').insert(studentClassRecords);

    if (scError) {
      console.error('Failed to create student_classes records:', scError);
      // Don't throw - student is already created, just log the error
    }
  }

  // Fetch the student with class relationships
  return await getStudentById(id);
}

/**
 * Update student
 */
export async function updateStudent(id: string, studentData: Partial<Student> & { classIds?: string[]; gender?: string; cskhStaffId?: string; cskh_staff_id?: string }) {
  // Extract classIds and other non-database fields
  const { classIds, gender, cskhStaffId, ...studentFields } = studentData as any;
  
  // Remove classIds from studentFields if present (it's handled separately)
  delete studentFields.classIds;
  
  // Handle cskhStaffId -> cskh_staff_id mapping
  if (cskhStaffId !== undefined) {
    studentFields.cskh_staff_id = cskhStaffId;
  }
  
  // Handle gender if provided (only include if database supports it)
  if (gender !== undefined) {
    studentFields.gender = gender;
  }

  // Filter out undefined values to avoid sending them to database
  const cleanFields: any = {};
  Object.keys(studentFields).forEach((key) => {
    if (studentFields[key] !== undefined) {
      cleanFields[key] = studentFields[key];
    }
  });

  // Update student basic info
  const { data, error } = await supabase
    .from('students')
    .update(cleanFields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update student: ${error.message}`);
  }

  // Handle class assignments if classIds provided
  if (classIds !== undefined) {
    // Get current class assignments
    const { data: currentClasses } = await supabase
      .from('student_classes')
      .select('class_id')
      .eq('student_id', id)
      .eq('status', 'active');

    const currentClassIds = (currentClasses || []).map((sc: any) => sc.class_id);
    const newClassIds = Array.isArray(classIds) ? classIds.filter(Boolean) : [];

    // Find classes to add
    const toAdd = newClassIds.filter((classId) => !currentClassIds.includes(classId));
    // Find classes to remove (set status to inactive)
    const toRemove = currentClassIds.filter((classId) => !newClassIds.includes(classId));

    // Add new class assignments
    if (toAdd.length > 0) {
      const newRecords = toAdd.map((classId) => ({
        id: `SC${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        student_id: id,
        class_id: classId,
        start_date: new Date().toISOString().slice(0, 10),
        status: 'active',
      }));

      const { error: addError } = await supabase.from('student_classes').insert(newRecords);
      if (addError) {
        console.error('Failed to add student_classes records:', addError);
      }
    }

    // Remove class assignments (set status to inactive)
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from('student_classes')
        .update({ status: 'inactive' })
        .eq('student_id', id)
        .in('class_id', toRemove);

      if (removeError) {
        console.error('Failed to remove student_classes records:', removeError);
      }
    }
  }

  // Fetch the updated student with class relationships
  return await getStudentById(id);
}

/**
 * Delete student
 */
export async function deleteStudent(id: string) {
  const { error } = await supabase.from('students').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete student: ${error.message}`);
  }
}

/**
 * Get student class financial data
 * Computes financial information for all classes a student is enrolled in
 */
export async function getStudentClassFinancialData(studentId: string) {
  // Get all active student_classes records
  const { data: studentClasses, error: scError } = await supabase
    .from('student_classes')
    .select('*, classes(*)')
    .eq('student_id', studentId)
    .eq('status', 'active');

  if (scError) {
    throw new Error(`Failed to fetch student classes: ${scError.message}`);
  }

  if (!studentClasses || studentClasses.length === 0) {
    return [];
  }

  // Get attendance count for each class
  const classIds = studentClasses.map((sc: any) => sc.class_id);
  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('session_id, sessions!inner(class_id)')
    .in('sessions.class_id', classIds)
    .eq('present', true);

  // Count attended sessions per class
  const attendedCountMap = new Map<string, number>();
  if (attendanceData) {
    attendanceData.forEach((att: any) => {
      const classId = att.sessions?.class_id;
      if (classId) {
        attendedCountMap.set(classId, (attendedCountMap.get(classId) || 0) + 1);
      }
    });
  }

  // Process each student_class record
  return studentClasses.map((record: any) => {
    const classInfo = record.classes || {};
    
    // Get financial data from student_classes record (with fallbacks to class defaults)
    const manualSessions = Number(record.student_fee_sessions || 0);
    const manualTotal = Number(record.student_fee_total || 0);
    const classDefaultTotal = Number(classInfo.tuition_package_total || 0);
    const classDefaultSessions = Number(classInfo.tuition_package_sessions || 0);
    const explicitUnit = Number(record.student_tuition_per_session || 0);
    const classDefaultUnit = (() => {
      if (classInfo.student_tuition_per_session) return Number(classInfo.student_tuition_per_session);
      if (classDefaultTotal > 0 && classDefaultSessions > 0) return classDefaultTotal / classDefaultSessions;
      return 0;
    })();
    
    const inferredUnit = (() => {
      if (manualTotal > 0 && manualSessions > 0) return manualTotal / manualSessions;
      if (explicitUnit > 0) return explicitUnit;
      if (classDefaultUnit > 0) return classDefaultUnit;
      if (classDefaultTotal > 0 && classDefaultSessions > 0) return classDefaultTotal / classDefaultSessions;
      return 0;
    })();

    const sessions = manualSessions > 0
      ? manualSessions
      : (classDefaultSessions > 0 ? classDefaultSessions : 0);

    const total = manualTotal > 0
      ? manualTotal
      : (sessions > 0 && inferredUnit > 0 ? inferredUnit * sessions : 0);

    const remaining = Math.max(0, Number(record.remaining_sessions || 0));
    const attended = Math.max(0, Number(record.total_attended_sessions || 0) || attendedCountMap.get(record.class_id) || 0);
    const outstandingSessions = Math.max(0, Number(record.unpaid_sessions || 0));
    const outstandingAmount = outstandingSessions > 0 && inferredUnit > 0 ? outstandingSessions * inferredUnit : 0;

    return {
      record: {
        id: record.id,
        student_id: record.student_id,
        class_id: record.class_id,
        start_date: record.start_date,
        status: record.status,
        remaining_sessions: remaining,
        student_fee_total: manualTotal,
        student_fee_sessions: manualSessions,
        student_tuition_per_session: explicitUnit,
        total_attended_sessions: attended,
        unpaid_sessions: outstandingSessions,
      },
      classInfo: {
        id: classInfo.id,
        name: classInfo.name,
        type: classInfo.type,
        status: classInfo.status,
        tuition_package_total: classDefaultTotal,
        tuition_package_sessions: classDefaultSessions,
        student_tuition_per_session: classInfo.student_tuition_per_session,
      },
      total,
      sessions,
      unitPrice: inferredUnit,
      remaining,
      attended,
      outstandingSessions,
      outstandingAmount,
    };
  });
}

/**
 * Extend sessions for a student in a class
 * Updates remaining_sessions and creates wallet transaction
 */
export async function extendStudentSessions(
  studentId: string,
  classId: string,
  sessions: number,
  unitPrice: number
) {
  // Validate inputs
  if (!Number.isFinite(sessions) || sessions <= 0) {
    throw new Error('Số buổi phải là số dương');
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error('Giá mỗi buổi phải là số dương');
  }

  const totalCost = sessions * unitPrice;

  // Get student to check wallet balance
  const student = await getStudentById(studentId);
  if (!student) {
    throw new Error('Học sinh không tồn tại');
  }

  const walletBalance = Number((student as any).wallet_balance || (student as any).walletBalance || 0);
  if (walletBalance < totalCost) {
    throw new Error('Số dư không đủ để gia hạn');
  }

  // Get student_class record
  const { data: studentClass, error: scError } = await supabase
    .from('student_classes')
    .select('*')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('status', 'active')
    .single();

  if (scError || !studentClass) {
    throw new Error('Không tìm thấy lớp học của học sinh');
  }

  // Update student_classes
  const newRemainingSessions = (studentClass.remaining_sessions || 0) + sessions;
  const newTotalPurchasedSessions = (studentClass.total_purchased_sessions || 0) + sessions;
  const newTotalPaidAmount = (studentClass.total_paid_amount || 0) + totalCost;

  const { error: updateError } = await supabase
    .from('student_classes')
    .update({
      remaining_sessions: newRemainingSessions,
      total_purchased_sessions: newTotalPurchasedSessions,
      total_paid_amount: newTotalPaidAmount,
      student_tuition_per_session: unitPrice,
    })
    .eq('id', studentClass.id);

  if (updateError) {
    throw new Error(`Không thể cập nhật lớp học: ${updateError.message}`);
  }

  // Update student wallet balance
  const newWalletBalance = walletBalance - totalCost;
  const { error: studentUpdateError } = await supabase
    .from('students')
    .update({ wallet_balance: newWalletBalance })
    .eq('id', studentId);

  if (studentUpdateError) {
    throw new Error(`Không thể cập nhật số dư: ${studentUpdateError.message}`);
  }

  // Create wallet transaction (negative amount for payment)
  const walletService = await import('./walletService');
  await walletService.createWalletTransaction({
    student_id: studentId,
    type: 'topup',
    amount: -totalCost, // Negative because it's a payment
    note: `Gia hạn ${sessions} buổi học`,
    date: new Date().toISOString().slice(0, 10),
  });

  return {
    success: true,
    remainingSessions: newRemainingSessions,
    newWalletBalance,
  };
}

/**
 * Refund sessions for a student in a class
 * Updates remaining_sessions and creates wallet transaction
 */
export async function refundStudentSessions(
  studentId: string,
  classId: string,
  sessions: number,
  unitPrice: number
) {
  // Validate inputs
  if (!Number.isFinite(sessions) || sessions <= 0) {
    throw new Error('Số buổi phải là số dương');
  }
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error('Giá mỗi buổi phải là số dương');
  }

  // Get student_class record
  const { data: studentClass, error: scError } = await supabase
    .from('student_classes')
    .select('*')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('status', 'active')
    .single();

  if (scError || !studentClass) {
    throw new Error('Không tìm thấy lớp học của học sinh');
  }

  const currentRemaining = studentClass.remaining_sessions || 0;
  if (sessions > currentRemaining) {
    throw new Error(`Số buổi hoàn trả không được vượt quá ${currentRemaining} buổi còn lại`);
  }

  const totalRefund = sessions * unitPrice;

  // Update student_classes
  const newRemainingSessions = Math.max(0, currentRemaining - sessions);
  const newTotalPurchasedSessions = Math.max(0, (studentClass.total_purchased_sessions || 0) - sessions);
  const newTotalPaidAmount = Math.max(0, (studentClass.total_paid_amount || 0) - totalRefund);

  const { error: updateError } = await supabase
    .from('student_classes')
    .update({
      remaining_sessions: newRemainingSessions,
      total_purchased_sessions: newTotalPurchasedSessions,
      total_paid_amount: newTotalPaidAmount,
      student_tuition_per_session: unitPrice,
    })
    .eq('id', studentClass.id);

  if (updateError) {
    throw new Error(`Không thể cập nhật lớp học: ${updateError.message}`);
  }

  // Update student wallet balance
  const student = await getStudentById(studentId);
  if (!student) {
    throw new Error('Học sinh không tồn tại');
  }

  const walletBalance = Number((student as any).wallet_balance || (student as any).walletBalance || 0);
  const newWalletBalance = walletBalance + totalRefund;

  const { error: studentUpdateError } = await supabase
    .from('students')
    .update({ wallet_balance: newWalletBalance })
    .eq('id', studentId);

  if (studentUpdateError) {
    throw new Error(`Không thể cập nhật số dư: ${studentUpdateError.message}`);
  }

  // Create wallet transaction
  const walletService = await import('./walletService');
  await walletService.createWalletTransaction({
    student_id: studentId,
    type: 'topup',
    amount: totalRefund,
    note: `Hoàn trả ${sessions} buổi học`,
    date: new Date().toISOString().slice(0, 10),
  });

  return {
    success: true,
    remainingSessions: newRemainingSessions,
    newWalletBalance,
  };
}

/**
 * Remove class from student
 * Sets student_classes status to inactive and optionally creates refund transaction
 */
export async function removeStudentClass(
  studentId: string,
  classId: string,
  refundRemaining: boolean = true
) {
  // Get student_class record
  const { data: studentClass, error: scError } = await supabase
    .from('student_classes')
    .select('*')
    .eq('student_id', studentId)
    .eq('class_id', classId)
    .eq('status', 'active')
    .single();

  if (scError || !studentClass) {
    throw new Error('Không tìm thấy lớp học của học sinh');
  }

  // Get class info for name
  const { data: classInfo } = await supabase.from('classes').select('name').eq('id', classId).single();

  // Update student_classes status to inactive
  const { error: updateError } = await supabase
    .from('student_classes')
    .update({ status: 'inactive' })
    .eq('id', studentClass.id);

  if (updateError) {
    throw new Error(`Không thể xóa lớp học: ${updateError.message}`);
  }

  // If refund remaining sessions
  if (refundRemaining && studentClass.remaining_sessions > 0) {
    const remainingSessions = studentClass.remaining_sessions || 0;
    const unitPrice = studentClass.student_tuition_per_session || 0;
    
    if (unitPrice > 0) {
      const refundAmount = remainingSessions * unitPrice;

      // Update student wallet balance
      const student = await getStudentById(studentId);
      if (student) {
        const walletBalance = Number((student as any).wallet_balance || (student as any).walletBalance || 0);
        const newWalletBalance = walletBalance + refundAmount;

        await supabase
          .from('students')
          .update({ wallet_balance: newWalletBalance })
          .eq('id', studentId);

        // Create wallet transaction
        const walletService = await import('./walletService');
        await walletService.createWalletTransaction({
          student_id: studentId,
          type: 'topup',
          amount: refundAmount,
          note: `Hoàn trả do xóa lớp ${classInfo?.name || classId} khỏi học sinh`,
          date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }

  return {
    success: true,
    refunded: refundRemaining && studentClass.remaining_sessions > 0,
  };
}

