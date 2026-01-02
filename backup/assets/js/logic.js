/**
 * logic.js - Business logic and data manipulation
 */

const ENTITY_SUPABASE_MAP = {
    student: 'students',
    class: 'classes',
    teacher: 'teachers',
    payment: 'payments',
    lessonResource: 'lesson_resources',
    lessonTask: 'lesson_tasks',
    lessonOutput: 'lesson_outputs',
    lessonTopic: 'lesson_topics',
    lessonTopicLink: 'lesson_topic_links'
};

function buildClassTeacherRelations(cls) {
    const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
    const allowances = cls.customTeacherAllowances || {};
    return teacherIds
        .filter(Boolean)
        .map(teacherId => ({
            id: `CT_${cls.id}_${teacherId}`,
            classId: cls.id,
            teacherId,
            customAllowance: allowances[teacherId] || null
        }));
}

/**
 * Sort data array by field
 * @param {Array} data - Array to sort
 * @param {string} field - Field to sort by
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted array
 */
function sortData(data, field, direction = 'asc') {
    return [...data].sort((a, b) => {
        let valueA = a[field];
        let valueB = b[field];

        // Handle nested object paths (e.g., 'student.name')
        if (field.includes('.')) {
            const path = field.split('.');
            valueA = path.reduce((obj, key) => obj?.[key], a);
            valueB = path.reduce((obj, key) => obj?.[key], b);
        }

        // Handle numbers
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }

        // Handle strings
        valueA = String(valueA || '').toLowerCase();
        valueB = String(valueB || '').toLowerCase();
        
        return direction === 'asc' 
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
    });
}

/**
 * Filter data array by predicate function
 * @param {Array} data - Array to filter
 * @param {Object} filters - Filter criteria object
 * @returns {Array} Filtered array
 */
function filterData(data, filters) {
    return data.filter(item => {
        return Object.entries(filters).every(([key, value]) => {
            if (!value) return true; // Skip empty filters
            
            const itemValue = String(item[key] || '').toLowerCase();
            const filterValue = String(value).toLowerCase();
            
            return itemValue.includes(filterValue);
        });
    });
}

/**
 * Validate form data with better error messages
 * @param {Object} data - Form data object
 * @param {Object} rules - Validation rules
 * @returns {Object} Validation result {isValid, errors}
 */
function validateForm(data, rules) {
    const errors = {};
    const fieldLabels = {
        fullName: 'Họ và tên',
        name: 'Tên',
        email: 'Email',
        gmail: 'Email',
        phone: 'Số điện thoại',
        birthYear: 'Năm sinh',
        school: 'Trường học',
        province: 'Tỉnh',
        parentName: 'Tên phụ huynh',
        parentPhone: 'Số điện thoại phụ huynh',
        teacherId: 'Gia sư',
        teacherIds: 'Gia sư',
        type: 'Phân loại',
        status: 'Trạng thái',
        accountHandle: 'Handle đăng nhập',
        accountPassword: 'Mật khẩu mặc định'
    };
    
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        const label = fieldLabels[field] || field;
        
        if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
            errors[field] = `${label} là bắt buộc`;
            continue;
        }
        
        if (value === null || value === undefined || value === '') continue;
        
        if (rule.min !== undefined && Number(value) < rule.min) {
            errors[field] = `${label} phải tối thiểu ${rule.min}`;
        }
        
        if (rule.max !== undefined && Number(value) > rule.max) {
            errors[field] = `${label} phải tối đa ${rule.max}`;
        }
        
        if (rule.pattern && !rule.pattern.test(String(value))) {
            errors[field] = `${label} không hợp lệ`;
        }
        
        if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors[field] = `${label} không đúng định dạng email`;
        }
        
        if (rule.phone && !/^[0-9]{9,12}$/.test(String(value).replace(/\s|-/g, ''))) {
            errors[field] = `${label} không đúng định dạng số điện thoại`;
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Create new entity with optimistic update support
 * @param {string} type - Entity type ('student', 'class', 'teacher', 'payment')
 * @param {Object} data - Entity data
 * @param {Object} options - Options including useOptimisticUpdate, onSuccess, onError, onRollback
 * @returns {Promise<Object>|Object} Created entity (Promise if useOptimisticUpdate is true)
 */
async function createEntityWithOptimisticUpdate(type, data, options = {}) {
    const { useOptimisticUpdate = false, onSuccess, onError, onRollback } = options;
    
    if (!useOptimisticUpdate) {
        // Legacy behavior: sync create
        return createEntity(type, data);
    }
    
    // Optimistic update pattern
    const snapshot = JSON.parse(JSON.stringify(window.demo));
    
    try {
        // 1. Create entity locally (optimistic)
        const entity = createEntity(type, data);
        
        // 2. Get supabase entities from createEntity result
        const supabaseEntities = {};
        switch (type) {
            case 'student':
                supabaseEntities.students = [entity];
                break;
            case 'class':
                supabaseEntities.classes = [entity];
                break;
            case 'teacher':
                supabaseEntities.teachers = [entity];
                break;
            // Add more cases as needed
        }
        
        // 3. Save with optimistic update
        const success = await window.UniData.save({
            supabaseEntities,
            useOptimisticUpdate: true,
            onSuccess: () => {
                if (onSuccess) onSuccess(entity);
            },
            onError: (error) => {
                if (onError) onError(error);
            },
            onRollback: () => {
                if (onRollback) onRollback(snapshot);
            }
        });
        
        if (success) {
            return entity;
        } else {
            throw new Error('Failed to create entity');
        }
    } catch (error) {
        // Rollback already handled in saveWithOptimisticUpdate
        throw error;
    }
}

/**
 * Create new entity with default values
 * @param {string} type - Entity type ('student', 'class', 'teacher', 'payment')
 * @param {Object} data - Entity data
 * @returns {Object} Created entity
 */
function createEntity(type, data) {
    const id = window.UniData.generateId(type);
    let entity = { id, ...data };
    let supabaseEntities = null;
    let supabaseDeletes = null;
    let requiresFullSync = false;
    
    // Set defaults based on type
    switch (type) {
        case 'student':
            entity = {
                status: 'active',
                email: '',
                gender: 'male',
                lastAttendance: null,
                walletBalance: 0,
                accountHandle: '',
                accountPassword: '',
                ...entity
            };
            window.demo.students.push(entity);
            // Auto-create studentClass entries for all classes in classId
            // classId can be: string (single class), array (multiple classes), or null
            const classIds = Array.isArray(entity.classId) 
                ? entity.classId.filter(Boolean)
                : (entity.classId ? [entity.classId] : []);
            
            if (classIds.length > 0) {
                window.demo.studentClasses = window.demo.studentClasses || [];
                classIds.forEach(classId => {
                    // Check if record already exists
                    const existing = window.demo.studentClasses.find(
                        sc => sc.studentId === entity.id && sc.classId === classId
                    );
                    if (!existing) {
                        const scId = 'SC' + Math.random().toString(36).slice(2,7).toUpperCase();
                window.demo.studentClasses.push({
                    id: scId,
                    studentId: entity.id,
                            classId: classId,
                    startDate: new Date().toISOString().slice(0,10),
                    status: 'active',
                    totalPurchasedSessions: 0,
                    remainingSessions: 0,
                    totalAttendedSessions: 0,
                    unpaidSessions: 0,
                    totalPaidAmount: 0
                });
                    }
                });
                // Ensure classId is stored as array (or null if empty)
                entity.classId = classIds.length > 0 ? classIds : null;
            } else {
                entity.classId = null;
            }
            break;
        case 'class':
            entity = {
                schedule: [],
                status: 'running',
                maxStudents: 15,
                tuitionPerSession: 0,
                studentTuitionPerSession: 0,
                tuitionPackageTotal: 0,
                tuitionPackageSessions: 0,
                scaleAmount: 0,
                teacherIds: entity.teacherIds || (entity.teacherId ? [entity.teacherId] : []),
                customTeacherAllowances: entity.customTeacherAllowances || {},
                ...entity
            };
            // Remove old teacherId if teacherIds is provided
            if (entity.teacherIds && entity.teacherIds.length > 0) {
                delete entity.teacherId;
            }
            if (!entity.customTeacherAllowances || typeof entity.customTeacherAllowances !== 'object') {
                entity.customTeacherAllowances = {};
            }
            window.demo.classes.push(entity);
            supabaseEntities = {
                classes: [entity]
            };
            const classRelations = buildClassTeacherRelations(entity);
            if (classRelations.length > 0) {
                supabaseEntities.classTeachers = classRelations;
            }
            break;
        case 'teacher':
            entity = {
                photoUrl: '',
                status: 'active',
                birthDate: entity.birthDate || '',
                university: entity.university || '',
                highSchool: entity.highSchool || '',
                province: entity.province || '',
                specialization: entity.specialization || '',
                bankQRLink: entity.bankQRLink || null,
                ...entity
            };
                window.demo.teachers.push(entity);
            supabaseEntities = {
                teachers: [entity]
            };
            break;
        case 'payment':
            entity = {
                status: 'pending',
                date: new Date().toISOString().slice(0,10),
                ...entity
            };
            window.demo.payments.push(entity);
            supabaseEntities = {
                payments: [entity]
            };
            break;
        case 'lessonResource':
            entity = {
                resourceLink: entity.resourceLink || '',
                title: entity.title || '',
                description: entity.description || '',
                tags: Array.isArray(entity.tags) ? entity.tags : (entity.tags ? String(entity.tags).split(',').map(tag => tag.trim()).filter(Boolean) : []),
                createdBy: entity.createdBy || null,
                createdAt: entity.createdAt || new Date().toISOString(),
                updatedAt: entity.updatedAt || new Date().toISOString(),
                ...entity
            };
            window.demo.lessonResources = window.demo.lessonResources || [];
            window.demo.lessonResources.push(entity);
            supabaseEntities = {
                lessonResources: [entity]
            };
            break;
        case 'lessonTask':
            entity = {
                assistantId: entity.assistantId || '',
                title: entity.title || '',
                description: entity.description || '',
                status: entity.status || 'pending',
                priority: entity.priority || 'medium',
                dueDate: entity.dueDate || null,
                createdBy: entity.createdBy || null,
                createdAt: entity.createdAt || new Date().toISOString(),
                updatedAt: entity.updatedAt || new Date().toISOString(),
                ...entity
            };
            window.demo.lessonTasks = window.demo.lessonTasks || [];
            window.demo.lessonTasks.push(entity);
            supabaseEntities = {
                lessonTasks: [entity]
            };
            break;
        case 'lessonOutput':
            entity = {
                lessonName: entity.lessonName || '',
                tag: entity.tag || '',
                level: entity.level || '',
                cost: Number(entity.cost) || 0,
                date: entity.date || new Date().toISOString().slice(0,10),
                status: entity.status || 'pending',
                contestUploaded: entity.contestUploaded || '',
                completedBy: entity.completedBy || '',
                link: entity.link || '',
                assistantId: entity.assistantId || null,
                createdAt: entity.createdAt || new Date().toISOString(),
                updatedAt: entity.updatedAt || new Date().toISOString(),
                ...entity
            };
            window.demo.lessonOutputs = window.demo.lessonOutputs || [];
            window.demo.lessonOutputs.push(entity);
            const supabaseOutput = { ...entity };
            if ('tags' in supabaseOutput) {
                // 'tags' is only used locally (JSON array) and does not exist on Supabase table
                delete supabaseOutput.tags;
            }
            supabaseEntities = {
                lessonOutputs: [supabaseOutput]
            };
            break;
        case 'lessonTopic':
            entity = {
                name: entity.name || '',
                isDefault: entity.isDefault || false,
                level: entity.level !== undefined ? entity.level : null,
                createdBy: entity.createdBy || null,
                createdAt: entity.createdAt || new Date().toISOString(),
                updatedAt: entity.updatedAt || new Date().toISOString(),
                ...entity
            };
            window.demo.lessonTopics = window.demo.lessonTopics || [];
            window.demo.lessonTopics.push(entity);
            supabaseEntities = {
                lessonTopics: [entity]
            };
            break;
        case 'lessonTopicLink':
            entity = {
                topicId: entity.topicId || '',
                lessonOutputId: entity.lessonOutputId || '',
                orderIndex: Number(entity.orderIndex) || 0,
                createdAt: entity.createdAt || new Date().toISOString(),
                ...entity
            };
            window.demo.lessonTopicLinks = window.demo.lessonTopicLinks || [];
            window.demo.lessonTopicLinks.push(entity);
            supabaseEntities = {
                lessonTopicLinks: [entity]
            };
            break;
        default:
            requiresFullSync = true;
            break;
    }
    
    if (type === 'student') {
        supabaseEntities = supabaseEntities || {};
        const studentEntry = window.demo.students.find(s => s.id === entity.id);
        if (studentEntry) {
            supabaseEntities.students = [studentEntry];
        }
        const studentClassEntry = (window.demo.studentClasses || []).find(sc => sc.studentId === entity.id);
        if (studentClassEntry) {
            supabaseEntities.studentClasses = [studentClassEntry];
        }
    }

    if (!supabaseEntities || requiresFullSync) {
        window.UniData.save();
    } else {
        window.UniData.save({
            supabaseEntities,
            supabaseDeletes
        });
    }
    // Log action and show toast
    console.log('[createEntity] Called for type:', type, 'entityId:', entity.id);
    try {
        if (window.UniData && typeof window.UniData.logAction === 'function') {
            console.log('[createEntity] Calling logAction...');
            window.UniData.logAction('create', type, entity.id, { data: entity });
            console.log('[createEntity] logAction called successfully');
        } else {
            console.warn('[createEntity] window.UniData.logAction not available', { 
                hasUniData: !!window.UniData, 
                type, 
                entityId: entity.id 
            });
        }
    } catch(e) {
        console.error('[createEntity] Failed to log action', e, { type, entityId: entity.id });
    }
    try { window.UniUI.toast(`${type} created`, 'success'); } catch(e){}
    return entity;
}

/**
 * Update existing entity and sync related data
 * @param {string} type - Entity type
 * @param {string} id - Entity ID
 * @param {Object} data - Updated data
 * @returns {Object} Updated entity
 */
function updateEntity(type, id, data) {
    let collection;
    let supabaseEntities = null;
    let supabaseDeletes = null;
    let requiresFullSync = false;
    let studentClassEntry = null;
    let studentClassRemovedIds = [];
    let classTeacherRemovedIds = [];
    switch (type) {
        case 'student':
            collection = window.demo.students;
            break;
        case 'class':
            collection = window.demo.classes;
            break;
        case 'teacher':
            collection = window.demo.teachers;
            break;
        case 'payment':
            collection = window.demo.payments;
            break;
        case 'lessonResource':
            collection = window.demo.lessonResources || [];
            break;
        case 'lessonTask':
            collection = window.demo.lessonTasks || [];
            break;
        case 'lessonOutput':
            collection = window.demo.lessonOutputs || [];
            break;
        case 'lessonTopic':
            collection = window.demo.lessonTopics || [];
            break;
        case 'lessonTopicLink':
            collection = window.demo.lessonTopicLinks || [];
            break;
        default:
            throw new Error(`Invalid entity type: ${type}`);
    }
    
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) throw new Error(`Entity not found: ${id}`);
    
    const oldEntity = { ...collection[index] };
    // Handle null values (for removing fields like customTeacherSalary)
    Object.keys(data).forEach(key => {
        if (data[key] === null) {
            delete collection[index][key];
        } else {
            collection[index][key] = data[key];
        }
    });
    
    // Sync related data
    if (type === 'student' && 'classId' in data) {
        // Update studentClasses pivot table
        // classId can be: array (multiple classes), string (single class), or null
        window.demo.studentClasses = window.demo.studentClasses || [];
        
        // Normalize classId to array
        const newClassIds = Array.isArray(data.classId) 
            ? data.classId.filter(Boolean)
            : (data.classId ? [data.classId] : []);
        
        // Get old classIds (normalize to array for comparison)
        const oldClassIds = Array.isArray(oldEntity.classId)
            ? oldEntity.classId.filter(Boolean)
            : (oldEntity.classId ? [oldEntity.classId] : []);
        
        // Compare sets to see what changed
        const oldSet = new Set(oldClassIds);
        const newSet = new Set(newClassIds);
        
        // Find classes to add (in new but not in old)
        const classesToAdd = newClassIds.filter(classId => !oldSet.has(classId));
        
        // Find classes to remove (in old but not in new)
        const classesToRemove = oldClassIds.filter(classId => !newSet.has(classId));
        
        // Add new classes
        classesToAdd.forEach(classId => {
            if (window.UniData && window.UniData.ensureStudentClassRecord) {
                window.UniData.ensureStudentClassRecord(id, classId, { status: 'active' });
            } else {
                const scId = 'SC' + Math.random().toString(36).slice(2,7).toUpperCase();
                window.demo.studentClasses.push({
                    id: scId,
                    studentId: id,
                    classId: classId,
                    startDate: new Date().toISOString().slice(0,10),
                    status: 'active',
                    totalPurchasedSessions: 0,
                    remainingSessions: 0,
                    totalAttendedSessions: 0,
                    unpaidSessions: 0,
                    totalPaidAmount: 0
                });
            }
        });
        
        // Remove classes that are no longer in classId
        classesToRemove.forEach(classId => {
            const record = window.demo.studentClasses.find(sc => sc.studentId === id && sc.classId === classId);
            if (record) {
                studentClassRemovedIds.push(record.id);
                const index = window.demo.studentClasses.findIndex(sc => sc.id === record.id);
                if (index !== -1) {
                    window.demo.studentClasses.splice(index, 1);
                }
            }
        });
        
        // Ensure classId in entity is stored as array (or null if empty)
        collection[index].classId = newClassIds.length > 0 ? newClassIds : null;
        
        // Sync classId with all active classes from studentClasses (to ensure consistency)
        if (window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
            window.UniData.syncStudentClassId(id);
        }
    }

    if (type === 'class' && ('teacherIds' in data || 'teacherId' in data || 'customTeacherAllowances' in data)) {
        const oldTeacherIds = Array.isArray(oldEntity.teacherIds) ? oldEntity.teacherIds.filter(Boolean)
            : (oldEntity.teacherId ? [oldEntity.teacherId] : []);
        const newTeacherIds = Array.isArray(collection[index].teacherIds) ? collection[index].teacherIds.filter(Boolean)
            : (collection[index].teacherId ? [collection[index].teacherId] : []);
        
        // Find removed teachers - these should be marked as 'inactive' instead of deleted
        const removedTeacherIds = oldTeacherIds.filter(teacherId => !newTeacherIds.includes(teacherId));
        
        // Instead of deleting, we'll update status to 'inactive' in classTeachers
        // Store removed teacher IDs for later processing
        if (removedTeacherIds.length > 0) {
            // Mark these for status update (not deletion)
            classTeacherRemovedIds = removedTeacherIds.map(teacherId => `CT_${id}_${teacherId}`);
        }
    }
    
    // Prepare Supabase payloads
    switch (type) {
        case 'student': {
            const studentRecord = collection[index];
            supabaseEntities = {
                students: [studentRecord]
            };
            if (studentClassEntry) {
                supabaseEntities.studentClasses = [studentClassEntry];
            }
            if (studentClassRemovedIds.length > 0) {
                supabaseDeletes = {
                    studentClasses: studentClassRemovedIds
                };
            }
            break;
        }
        case 'teacher': {
            supabaseEntities = {
                teachers: [collection[index]]
            };
            break;
        }
        case 'class': {
            const classRecord = collection[index];
            supabaseEntities = {
                classes: [classRecord]
            };
            const relations = buildClassTeacherRelations(classRecord);
            if (relations.length > 0) {
                supabaseEntities.classTeachers = relations;
            }
            if (classTeacherRemovedIds.length > 0) {
                supabaseDeletes = {
                    ...(supabaseDeletes || {}),
                    classTeachers: classTeacherRemovedIds
                };
            }

            const packageChanged =
                ('tuitionPackageTotal' in data && data.tuitionPackageTotal !== oldEntity.tuitionPackageTotal) ||
                ('tuitionPackageSessions' in data && data.tuitionPackageSessions !== oldEntity.tuitionPackageSessions) ||
                ('studentTuitionPerSession' in data && data.studentTuitionPerSession !== oldEntity.studentTuitionPerSession);
            if (packageChanged) {
                const newTotal = typeof classRecord.tuitionPackageTotal === 'number' ? classRecord.tuitionPackageTotal || 0 : 0;
                const newSessions = typeof classRecord.tuitionPackageSessions === 'number' ? classRecord.tuitionPackageSessions || 0 : 0;
                const newUnit = typeof classRecord.studentTuitionPerSession === 'number' ? classRecord.studentTuitionPerSession || 0 : 0;
                const resolvedUnit = newUnit > 0
                    ? newUnit
                    : (newSessions > 0 && newTotal > 0 ? newTotal / newSessions : 0);
                const resolvedSessions = newSessions > 0
                    ? newSessions
                    : (resolvedUnit > 0 && newTotal > 0 ? Math.round(newTotal / resolvedUnit) : 0);
                const resolvedTotal = newTotal > 0
                    ? newTotal
                    : (resolvedUnit > 0 && resolvedSessions > 0 ? resolvedUnit * resolvedSessions : 0);

                const oldTotal = typeof oldEntity.tuitionPackageTotal === 'number' ? oldEntity.tuitionPackageTotal || 0 : 0;
                const oldSessions = typeof oldEntity.tuitionPackageSessions === 'number' ? oldEntity.tuitionPackageSessions || 0 : 0;
                const oldUnit = typeof oldEntity.studentTuitionPerSession === 'number' ? oldEntity.studentTuitionPerSession || 0 : 0;
                const oldResolvedUnit = oldUnit > 0
                    ? oldUnit
                    : (oldTotal > 0 && oldSessions > 0 ? oldTotal / oldSessions : 0);
                const oldResolvedTotal = oldTotal > 0
                    ? oldTotal
                    : (oldResolvedUnit > 0 && oldSessions > 0 ? oldResolvedUnit * oldSessions : 0);

                const relatedRecords = (window.demo.studentClasses || []).filter(sc => sc.classId === id);
                if (relatedRecords.length > 0) {
                    const updatedRecords = [];
                    const nearlyEqual = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.5;
                    relatedRecords.forEach(sc => {
                        const wasUsingDefault = (
                            (oldSessions > 0 && nearlyEqual(sc.studentFeeSessions, oldSessions) && nearlyEqual(sc.studentFeeTotal, oldResolvedTotal)) ||
                            (sc.studentFeeTotal === 0 && sc.studentFeeSessions === 0)
                        );
                        if (!wasUsingDefault) return;

                        if (resolvedTotal >= 0) sc.studentFeeTotal = resolvedTotal;
                        if (resolvedSessions >= 0) sc.studentFeeSessions = resolvedSessions;
                        if (resolvedUnit > 0) sc.studentTuitionPerSession = resolvedUnit;
                        updatedRecords.push(sc);
                    });
                    if (updatedRecords.length > 0) {
                        supabaseEntities.studentClasses = [
                            ...(supabaseEntities.studentClasses || []),
                            ...updatedRecords
                        ];
                    }
                }
            }

            const scaleChanged = ('scaleAmount' in data && data.scaleAmount !== oldEntity.scaleAmount);
            const baseAllowanceChanged = ('tuitionPerSession' in data && data.tuitionPerSession !== oldEntity.tuitionPerSession);
            const customAllowanceChanged = ('customTeacherAllowances' in data);
            if (scaleChanged || baseAllowanceChanged || customAllowanceChanged) {
                console.log('[UniLogic] Allowance settings changed for class', id, '— existing sessions keep original allowanceAmount');
            }
            break;
        }
        case 'payment': {
            supabaseEntities = {
                payments: [collection[index]]
            };
            break;
        }
        case 'lessonResource': {
            supabaseEntities = {
                lessonResources: [collection[index]]
            };
            break;
        }
        case 'lessonTask': {
            supabaseEntities = {
                lessonTasks: [collection[index]]
            };
            break;
        }
        case 'lessonOutput': {
            const supabaseOutput = { ...collection[index] };
            if ('tags' in supabaseOutput) {
                delete supabaseOutput.tags;
            }
            supabaseEntities = {
                lessonOutputs: [supabaseOutput]
            };
            break;
        }
        case 'lessonTopic': {
            supabaseEntities = {
                lessonTopics: [collection[index]]
            };
            break;
        }
        case 'lessonTopicLink': {
            supabaseEntities = {
                lessonTopicLinks: [collection[index]]
            };
            break;
        }
        default:
            requiresFullSync = true;
            break;
    }

    if (!supabaseEntities || requiresFullSync) {
        window.UniData.save();
    } else {
        window.UniData.save({
            supabaseEntities,
            supabaseDeletes
        });
    }
    // Log action and show toast
    console.log('[updateEntity] Called for type:', type, 'id:', id);
    try {
        if (window.UniData && typeof window.UniData.logAction === 'function') {
            console.log('[updateEntity] Calling logAction...');
            window.UniData.logAction('update', type, id, { data });
            console.log('[updateEntity] logAction called successfully');
        } else {
            console.warn('[updateEntity] window.UniData.logAction not available', { 
                hasUniData: !!window.UniData, 
                type, 
                id 
            });
        }
    } catch(e) {
        console.error('[updateEntity] Failed to log action', e, { type, id });
    }
    try { window.UniUI.toast(`${type} updated`, 'success'); } catch(e){}

    return collection[index];
}

/**
 * Delete entity and clean up related data
 * @param {string} type - Entity type
 * @param {string} id - Entity ID
 * @returns {boolean} Success status
 */
function deleteEntity(type, id) {
    let collection;
    const supabaseDeletes = {};
    const supabaseKey = ENTITY_SUPABASE_MAP[type];
    if (supabaseKey) {
        supabaseDeletes[supabaseKey] = [id];
    }
    let requiresFullSync = false;
    switch (type) {
        case 'student':
            collection = window.demo.students;
            // Clean up studentClasses
            if (window.demo.studentClasses) {
                const related = window.demo.studentClasses.filter(sc => sc.studentId === id).map(sc => sc.id);
                if (related.length > 0) {
                    supabaseDeletes.studentClasses = related;
                }
                window.demo.studentClasses = window.demo.studentClasses.filter(sc => sc.studentId !== id);
            }
            // Clean up payments
            if (window.demo.payments) {
                const relatedPayments = window.demo.payments.filter(p => p.studentId === id).map(p => p.id);
                if (relatedPayments.length > 0) {
                    supabaseDeletes.payments = relatedPayments;
                }
                window.demo.payments = window.demo.payments.filter(p => p.studentId !== id);
            }
            // Clean up attendance
            if (window.demo.attendance) {
                const relatedAttendance = window.demo.attendance.filter(a => a.studentId === id).map(a => a.id);
                if (relatedAttendance.length > 0) {
                    supabaseDeletes.attendance = relatedAttendance;
                }
                window.demo.attendance = window.demo.attendance.filter(a => a.studentId !== id);
            }
            break;
        case 'class':
            collection = window.demo.classes;
            // Check if has students
            const hasStudents = (window.demo.students || []).some(s => s.classId === id);
            if (hasStudents) {
                throw new Error('Cannot delete class with enrolled students');
            }
            // Clean up studentClasses
            if (window.demo.studentClasses) {
                const relatedStudentClasses = window.demo.studentClasses.filter(sc => sc.classId === id).map(sc => sc.id);
                if (relatedStudentClasses.length > 0) {
                    supabaseDeletes.studentClasses = relatedStudentClasses;
                }
                window.demo.studentClasses = window.demo.studentClasses.filter(sc => sc.classId !== id);
            }
            // Clean up sessions
            if (window.demo.sessions) {
                const sessionIds = (window.demo.sessions || []).filter(s => s.classId === id).map(s => s.id);
                if (sessionIds.length > 0) {
                    supabaseDeletes.sessions = sessionIds;
                }
                window.demo.sessions = window.demo.sessions.filter(s => s.classId !== id);
                // Clean up attendance for deleted sessions
                if (window.demo.attendance) {
                    const attendanceIds = window.demo.attendance.filter(a => sessionIds.includes(a.sessionId)).map(a => a.id);
                    if (attendanceIds.length > 0) {
                        supabaseDeletes.attendance = (supabaseDeletes.attendance || []).concat(attendanceIds);
                    }
                    window.demo.attendance = window.demo.attendance.filter(a => !sessionIds.includes(a.sessionId));
                }
            }
            // Clean up payments
            if (window.demo.payments) {
                const relatedPayments = window.demo.payments.filter(p => p.classId === id).map(p => p.id);
                if (relatedPayments.length > 0) {
                    supabaseDeletes.payments = (supabaseDeletes.payments || []).concat(relatedPayments);
                }
                window.demo.payments = window.demo.payments.filter(p => p.classId !== id);
            }
            // Clean up revenue
            if (window.demo.revenue) {
                const relatedRevenue = window.demo.revenue.filter(r => r.classId === id).map(r => r.id);
                if (relatedRevenue.length > 0) {
                    supabaseDeletes.revenue = relatedRevenue;
                }
                window.demo.revenue = window.demo.revenue.filter(r => r.classId !== id);
            }
            // Clean up class teachers
            const classRelations = buildClassTeacherRelations({ ...collection.find(c => c.id === id), id });
            if (classRelations.length > 0) {
                const relationIds = classRelations.map(rel => rel.id);
                supabaseDeletes.classTeachers = relationIds;
            }
            break;
        case 'teacher':
            collection = window.demo.teachers;
            // Check if has classes (support both teacherId and teacherIds)
            const hasClasses = (window.demo.classes || []).some(c => {
                if (c.teacherIds && Array.isArray(c.teacherIds)) {
                    return c.teacherIds.includes(id);
                }
                return c.teacherId === id;
            });
            if (hasClasses) {
                throw new Error('Cannot delete teacher assigned to classes');
            }
            // Clean up payroll
            if (window.demo.payroll) {
                const relatedPayroll = window.demo.payroll.filter(p => p.teacherId === id).map(p => p.id);
                if (relatedPayroll.length > 0) {
                    supabaseDeletes.payroll = relatedPayroll;
                }
                window.demo.payroll = window.demo.payroll.filter(p => p.teacherId !== id);
            }
            break;
        case 'payment':
            collection = window.demo.payments;
            break;
        case 'lessonResource':
            collection = window.demo.lessonResources || [];
            break;
        case 'lessonTask':
            collection = window.demo.lessonTasks || [];
            break;
        case 'lessonOutput':
            collection = window.demo.lessonOutputs || [];
            break;
        case 'lessonTopic':
            collection = window.demo.lessonTopics || [];
            break;
        case 'lessonTopicLink':
            collection = window.demo.lessonTopicLinks || [];
            break;
        default:
            requiresFullSync = true;
            return false;
    }
    
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    collection.splice(index, 1);
    if (!supabaseKey || requiresFullSync) {
        window.UniData.save();
    } else {
        window.UniData.save({
            supabaseDeletes
        });
    }
    // Log action and show toast
    console.log('[deleteEntity] Called for type:', type, 'id:', id);
    try {
        if (window.UniData && typeof window.UniData.logAction === 'function') {
            console.log('[deleteEntity] Calling logAction...');
            window.UniData.logAction('delete', type, id, {});
            console.log('[deleteEntity] logAction called successfully');
        } else {
            console.warn('[deleteEntity] window.UniData.logAction not available', { 
                hasUniData: !!window.UniData, 
                type, 
                id 
            });
        }
    } catch(e) {
        console.error('[deleteEntity] Failed to log action', e, { type, id });
    }
    try { window.UniUI.toast(`${type} deleted`, 'info'); } catch(e){}

    return true;
}

/**
 * Get related entities
 * @param {string} type - Entity type
 * @param {string} id - Entity ID
 * @param {string} relation - Relation type
 * @returns {Array} Related entities
 */
function getRelated(type, id, relation) {
    switch (type) {
        case 'class':
            if (relation === 'students') {
                const pivotStudentIds = (window.demo.studentClasses || [])
                    .filter(sc => sc.classId === id && sc.status !== 'inactive')
                    .map(sc => sc.studentId);
                const uniqueIds = Array.from(new Set(pivotStudentIds));
                const studentsFromPivot = uniqueIds.map(studentId => (window.demo.students || []).find(s => s.id === studentId)).filter(Boolean);
                if (studentsFromPivot.length) return studentsFromPivot;
                return window.demo.students.filter(s => s.classId === id);
            }
            if (relation === 'teacher') {
                return window.demo.teachers.find(t => t.id === id);
            }
            break;
            
        case 'student':
            if (relation === 'class') {
                return window.demo.classes.find(c => c.id === id);
            }
            if (relation === 'payments') {
                return window.demo.payments.filter(p => p.studentId === id);
            }
            break;
            
        case 'teacher':
            if (relation === 'classes') {
                return window.demo.classes.filter(c => {
                    if (c.teacherIds && Array.isArray(c.teacherIds)) {
                        return c.teacherIds.includes(id);
                    }
                    // Fallback for old data structure
                    return c.teacherId === id;
                });
            }
            break;
    }
    
    return [];
}

// Export logic functions
window.UniLogic = {
    sortData,
    filterData,
    validateForm,
    createEntity,
    updateEntity,
    deleteEntity,
    getRelated
};