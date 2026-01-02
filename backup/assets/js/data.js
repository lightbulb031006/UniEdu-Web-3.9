/**
 * data.js - Demo data and storage management
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateLocalUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    let timestamp = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = (timestamp + Math.random() * 16) % 16 | 0;
        timestamp = Math.floor(timestamp / 16);
        if (char === 'x') {
            return random.toString(16);
        }
        return ((random & 0x3) | 0x8).toString(16);
    });
}

function normalizeUsersCollection(usersInput) {
    if (!Array.isArray(usersInput)) return [];
    return usersInput
        .map(user => {
            if (!user || typeof user !== 'object') return null;
            const normalized = { ...user };
            if (normalized.linkId === undefined && normalized.link_id !== undefined) {
                normalized.linkId = normalized.link_id;
            }
            if (normalized.accountHandle === undefined && normalized.account_handle !== undefined) {
                normalized.accountHandle = normalized.account_handle;
            }
            if (normalized.accountPassword === undefined && normalized.account_password !== undefined) {
                normalized.accountPassword = normalized.account_password;
            }
            if (!normalized.accountPassword && normalized.password) {
                normalized.accountPassword = normalized.password;
            } else if (!normalized.password && normalized.accountPassword) {
                normalized.password = normalized.accountPassword;
            }
            if (normalized.assistantType === undefined && normalized.assistant_type !== undefined) {
                normalized.assistantType = normalized.assistant_type;
            }
            normalized.role = (normalized.role || '').toLowerCase();
            const currentId = typeof normalized.id === 'string' ? normalized.id : '';
            if (!UUID_PATTERN.test(currentId)) {
                normalized.id = generateLocalUuid();
            }
            delete normalized.link_id;
            delete normalized.account_handle;
            delete normalized.account_password;
            delete normalized.assistant_type;
            return normalized;
        })
        .filter(Boolean);
}

const ARRAY_DATA_KEYS = [
    'teachers',
    'classes',
    'sessions',
    'attendance',
    'payments',
    'studentClasses',
    'classTeachers',
    'payroll',
    'revenue',
    'costs',
    'walletTransactions',
    'homePosts',
    'documents',
    'lessonResources',
    'lessonTasks',
    'lessonOutputs',
    'lessonTopics',
    'lessonTopicLinks',
    'histories',
    'categories',
    'bonuses',
    'users'
];

function emitDataEvent(name, detail = {}) {
    try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (error) {
        console.warn(`[UniData] Failed to dispatch event ${name}:`, error);
    }
}

function filterLegacyStudents(studentsInput) {
    const students = Array.isArray(studentsInput) ? studentsInput : [];
    return students.filter(student => {
        const id = student?.id;
        const email = String(student?.email || '').toLowerCase();
        const fullName = String(student?.fullName || student?.name || '').trim();
        const isLegacy =
            id === 'S001' ||
            email === 'hocsinh1@edu.vn' ||
            fullName === 'Nguyễn Văn Tâm';
        return !isLegacy;
    });
}

function applyDataSnapshot(rawData, sourceLabel = 'remote', options = {}) {
    if (!rawData || typeof rawData !== 'object') return false;
    window.demo = window.demo || {};
    
    const { replaceMissing = true } = options;

    let studentsCount = window.demo.students?.length || 0;
    if (rawData.hasOwnProperty('students')) {
        const students = filterLegacyStudents(rawData.students);
        window.demo.students = students;
        studentsCount = students.length;
        
        // Sync classId for all students after loading (to ensure consistency with studentClasses)
        if (window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
            students.forEach(student => {
                if (student && student.id) {
                    window.UniData.syncStudentClassId(student.id);
                }
            });
        }
    } else if (replaceMissing && !window.demo.students) {
        window.demo.students = [];
        studentsCount = 0;
    }

    // Preserve and merge local-only data (histories) before applying snapshot
    // Load from separate localStorage key first (for production mode compatibility)
    let localHistories = Array.isArray(window.demo.histories) ? [...window.demo.histories] : [];
    try {
        const storedHistories = localStorage.getItem('unicorns.histories');
        if (storedHistories) {
            const parsed = JSON.parse(storedHistories);
            if (Array.isArray(parsed)) {
                // Merge with existing localHistories, deduplicate by id
                const historyMap = new Map();
                localHistories.forEach(h => {
                    if (h && h.id) historyMap.set(h.id, h);
                });
                parsed.forEach(h => {
                    if (h && h.id && !historyMap.has(h.id)) historyMap.set(h.id, h);
                });
                localHistories = Array.from(historyMap.values());
            }
        }
    } catch (e) {
        console.warn('[applyDataSnapshot] Failed to load histories from separate key:', e);
    }
    const incomingHistories = Array.isArray(rawData.histories) ? rawData.histories : [];
    
    // Merge histories: keep local histories, add any new ones from incoming data (deduplicate by id)
    const historyMap = new Map();
    localHistories.forEach(h => {
        if (h && h.id) historyMap.set(h.id, h);
    });
    incomingHistories.forEach(h => {
        if (h && h.id && !historyMap.has(h.id)) historyMap.set(h.id, h);
    });
    const mergedHistories = Array.from(historyMap.values()).sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA; // Newest first
    });

    ARRAY_DATA_KEYS.forEach(key => {
        // Skip histories - it's local-only and not synced to Supabase
        if (key === 'histories') return;
        
        // Debug log for lessonTopics to see if it's being processed
        if (key === 'lessonTopics' || key === 'lessonTopicLinks') {
            console.log(`[UniData:applyDataSnapshot] ARRAY_DATA_KEYS loop - Processing ${key}:`, {
                timestamp: Date.now(),
                hasKey: rawData.hasOwnProperty(key),
                rawDataKeys: Object.keys(rawData),
                sourceLabel
            });
        }
        
        if (key === 'users') {
            if (rawData.hasOwnProperty('users')) {
                const normalizedUsers = normalizeUsersCollection(rawData.users || []);
                window.demo.users = normalizedUsers;
            } else if (replaceMissing && !window.demo.users) {
                window.demo.users = [];
            }
        } else if (key === 'categories') {
            if (rawData.hasOwnProperty(key)) {
                const categories = Array.isArray(rawData[key]) ? rawData[key] : [];
                window.demo.categories = categories.length ? categories : window.demo.categories || ['1-1','Basic','Advance','Hardcore'];
            } else if (replaceMissing && (!Array.isArray(window.demo.categories) || !window.demo.categories.length)) {
                window.demo.categories = ['1-1','Basic','Advance','Hardcore'];
            }
        } else if (rawData.hasOwnProperty(key)) {
            const incomingData = Array.isArray(rawData[key]) ? rawData[key] : [];
            const existingData = Array.isArray(window.demo[key]) ? window.demo[key] : [];
            
            
            // IMPORTANT: Preserve cache data for critical junction tables if incoming data is empty
            // This prevents losing cache data when Supabase is still loading
            // Only preserve if:
            // 1. Incoming data is empty (Supabase still loading)
            // 2. Existing data has items (from cache)
            // 3. Source is from Supabase (not from cache)
            const isFromSupabase = sourceLabel && (sourceLabel.startsWith('supabase') || sourceLabel.includes('remote'));
            const shouldPreserveCache = isFromSupabase && 
                                       incomingData.length === 0 && 
                                       existingData.length > 0 &&
                                       (key === 'classTeachers' || key === 'studentClasses' || key === 'bonuses' || 
                                        key === 'costs' || key === 'lessonResources' || key === 'lessonTasks' || key === 'lessonOutputs' ||
                                        key === 'lessonTopics' || key === 'lessonTopicLinks' || key === 'walletTransactions' ||
                                        key === 'payroll' || key === 'payments');
            
            
            // Special handling for lessonTopics: merge custom topics from cache with Supabase data
            // This ensures custom topics are preserved even when Supabase data has fewer items
            const shouldMergeLessonTopics = isFromSupabase && 
                                           key === 'lessonTopics' && 
                                           incomingData.length > 0 && 
                                           existingData.length > 0;
            
            
            if (shouldPreserveCache) {
                // Keep existing cache data, don't replace with empty array
                // Don't overwrite - keep existing data
                return; // Skip setting window.demo[key] = incomingData
            } else if (key === 'walletTransactions' || key === 'lessonOutputs' || key === 'bonuses' || 
                      key === 'payroll' || key === 'payments') {
                // Continue to overwrite with incoming data
                window.demo[key] = incomingData;
            } else if (shouldMergeLessonTopics) {
                // Merge custom topics from cache with Supabase data
                // Keep custom topics from cache that don't exist in Supabase data
                const existingCustomTopics = existingData.filter(t => !t.isDefault);
                const incomingTopicIds = new Set(incomingData.map(t => t.id));
                const customTopicsToKeep = existingCustomTopics.filter(t => !incomingTopicIds.has(t.id));
                
                if (customTopicsToKeep.length > 0) {
                    window.demo[key] = [...incomingData, ...customTopicsToKeep];
                } else {
                    window.demo[key] = incomingData;
                }
            } else {
                window.demo[key] = incomingData;
            }
            
            // After loading studentClasses, sync all students' classId
            if (key === 'studentClasses' && window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
                const allStudentIds = [...new Set((window.demo.students || []).map(s => s.id))];
                allStudentIds.forEach(studentId => {
                    if (studentId) {
                        window.UniData.syncStudentClassId(studentId);
                    }
                });
            }
        } else if (replaceMissing && !window.demo[key]) {
            window.demo[key] = [];
        }
    });
    
    // After loading classes and classTeachers, reconstruct teacherIds from classTeachers
    // This ensures classes.teacherIds is available when loading from cache or Supabase
    // IMPORTANT: Convert for both cache and Supabase data (Supabase data may not have teacherIds if fromSupabaseFormat didn't run)
    // CRITICAL: Use forEach to modify in-place to avoid changing array reference (which would trigger snapshot change and re-render)
    // Use a flag to track if conversion was done to avoid duplicate conversions
    const conversionFlagKey = `__teacherIdsConverted_${sourceLabel}`;
    const alreadyConverted = window[conversionFlagKey];
    
    if (!alreadyConverted && window.demo.classes && Array.isArray(window.demo.classes) && window.demo.classTeachers && Array.isArray(window.demo.classTeachers)) {
        const classTeachers = window.demo.classTeachers;
        let hasChanges = false;
        const conversionStartTime = Date.now();
        console.log(`[UniData:applyDataSnapshot] Starting classTeachers → teacherIds conversion`, {
            sourceLabel,
            classesCount: window.demo.classes.length,
            classTeachersCount: classTeachers.length
        });
        window.demo.classes.forEach((cls, index) => {
            // Only update if teacherIds is missing or empty (to avoid overwriting if already set)
            if (!cls.teacherIds || cls.teacherIds.length === 0) {
                const teacherIds = classTeachers
                    .filter(ct => ct.class_id === cls.id || ct.classId === cls.id)
                    .map(ct => ct.teacher_id || ct.teacherId)
                    .filter(Boolean);
                
                // Build customTeacherAllowances from classTeachers table (active teachers)
                const customTeacherAllowances = {};
                classTeachers
                    .filter(ct => (ct.class_id === cls.id || ct.classId === cls.id) && (ct.custom_allowance || ct.customAllowance))
                    .forEach(ct => {
                        const teacherId = ct.teacher_id || ct.teacherId;
                        if (teacherId) {
                            const allowance = ct.custom_allowance || ct.customAllowance;
                            if (allowance !== null && allowance !== undefined) {
                                customTeacherAllowances[teacherId] = allowance;
                            }
                        }
                    });
                
                // Merge with existing customTeacherAllowances from classes (preserves inactive teachers)
                // Priority: classTeachers takes precedence for active teachers
                if (cls.customTeacherAllowances && typeof cls.customTeacherAllowances === 'object') {
                    Object.keys(cls.customTeacherAllowances).forEach(teacherId => {
                        if (cls.customTeacherAllowances[teacherId] !== null && 
                            cls.customTeacherAllowances[teacherId] !== undefined) {
                            // Only add if not already in customTeacherAllowances (from classTeachers)
                            // This ensures we keep allowances for inactive teachers
                            if (!customTeacherAllowances.hasOwnProperty(teacherId)) {
                                customTeacherAllowances[teacherId] = cls.customTeacherAllowances[teacherId];
                            }
                        }
                    });
                }
                
                // Modify in-place to avoid changing array reference
                cls.teacherIds = teacherIds.length > 0 ? teacherIds : (cls.teacherId ? [cls.teacherId] : []);
                cls.customTeacherAllowances = customTeacherAllowances;
                hasChanges = true;
            }
        });
        // Mark as converted to avoid duplicate conversions
        if (hasChanges) {
            window[conversionFlagKey] = true;
            const conversionDuration = Date.now() - conversionStartTime;
            console.log(`[UniData:applyDataSnapshot] Converted classTeachers → teacherIds for classes (in-place) (${conversionDuration}ms, source: ${sourceLabel})`);
        } else {
            window[conversionFlagKey] = true; // Mark even if no changes to avoid re-checking
            console.log(`[UniData:applyDataSnapshot] No conversion needed - all classes already have teacherIds (source: ${sourceLabel})`);
        }
    } else if (alreadyConverted) {
        console.log(`[UniData:applyDataSnapshot] Skipping conversion - already converted for source: ${sourceLabel}`);
    } else {
        console.log(`[UniData:applyDataSnapshot] Skipping conversion - missing classes or classTeachers array (source: ${sourceLabel})`);
    }
    
    // Restore merged local-only data after applying snapshot (before processing other keys)
    window.demo.histories = mergedHistories;
    
    // Also save to separate localStorage key for production mode compatibility
    try {
        localStorage.setItem('unicorns.histories', JSON.stringify(mergedHistories));
    } catch (e) {
        console.warn('[applyDataSnapshot] Failed to save histories to separate key:', e);
    }

    Object.keys(rawData).forEach(key => {
        if (key === 'students') return;
        if (ARRAY_DATA_KEYS.includes(key)) return;
        // Skip histories - it's local-only and not synced to Supabase
        if (key === 'histories') return;
        window.demo[key] = rawData[key];
    });

    if (window.AppStore && typeof window.AppStore.setCategoriesSilently === 'function' && Array.isArray(window.demo.categories)) {
        window.AppStore.setCategoriesSilently(window.demo.categories);
    }

    if (typeof ensureStudentFinanceDefaults === 'function') {
        ensureStudentFinanceDefaults(window.demo);
    }

    const logPrefix = sourceLabel.startsWith('supabase') ? '✅' : (sourceLabel === 'local-cache' ? '🗂️' : 'ℹ️');
    console.log(`${logPrefix} Students synced from ${sourceLabel}:`, studentsCount, 'students');

    emitDataEvent('UniData:dataset-applied', {
        source: sourceLabel,
        counts: {
            students: studentsCount,
            teachers: window.demo.teachers?.length || 0,
            classes: window.demo.classes?.length || 0
        }
    });
    
    // Mark that data has changed - this will trigger UI updates if needed
    if (sourceLabel.startsWith('supabase')) {
        window.__pendingDataChange = true;
        // Clear flag after a short delay to allow pages to check it
        setTimeout(() => {
            window.__pendingDataChange = false;
        }, 1000);
    }
    
    return true;
}

// Initialize demo data
window.demo = window.demo || (function(){
    const seed = {
        // All seed data cleared - data will be loaded from Supabase database
        users: [],
        students: [],
        classes: [],
        teachers: [],
        payments: [],
        walletTransactions: [],
        homePosts: [],
        documents: [],
        lessonResources: [],
        lessonTasks: [],
        lessonOutputs: [],
        lessonTopics: [],
        lessonTopicLinks: [],
        histories: [],
        studentClasses: [],
        sessions: [],
        attendance: [],
        payroll: [],
        revenue: [],
        costs: [],
        bonuses: [],
        // Keep categories as they may be needed for system functionality
        categories: ['1-1','Basic','Advance','Hardcore']
    };

    // Try to load from DatabaseAdapter (Supabase/IndexedDB/localStorage)
    try {
        // Wait a bit for DatabaseAdapter to initialize
        let loaded = null;
        
        // Try DatabaseAdapter first (Supabase/IndexedDB) - ưu tiên Supabase
        if (window.DatabaseAdapter && window.DatabaseAdapter.load) {
            // Load cached snapshot instantly for UX (IndexedDB/localStorage) before remote fetch finishes
            window.DatabaseAdapter.load({ preferLocal: true, skipRemote: true }).then(localData => {
                if (localData) {
                    applyDataSnapshot(localData, 'local-cache', { replaceMissing: false });
                    emitDataEvent('UniData:ready', { source: 'cache' });
                    // Hide spinner if cache data loaded successfully
                    hideSpinnerIfLoaded();
                }
            }).catch(err => {
                console.warn('Failed to load local cache snapshot:', err);
            });
            
            const essentialTables = ['students','teachers','classes','studentClasses','sessions'];
            
            const loadFullDataset = () => {
                window.DatabaseAdapter.load({ preferLocal: false, skipLocal: false }).then(fullData => {
                    if (fullData !== null && fullData !== undefined) {
                        // Save snapshot before applying to compare later
                        const snapshotBefore = JSON.stringify(window.demo);
                        applyDataSnapshot(fullData, 'supabase-full', { replaceMissing: true });
                        
                        // Save to localStorage for next F5
                        try {
                            localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
                            localStorage.setItem('unicorns.data.timestamp', Date.now().toString());
                            console.log('✅ [UniData] Saved snapshot to localStorage');
                        } catch (e) {
                            console.warn('Failed to persist full dataset:', e);
                        }
                        
                        // Hide spinner when DB data loaded
                        hideSpinnerIfLoaded();
                        emitDataEvent('UniData:updated', { source: 'supabase-full' });
                    } else {
                        // No data from DB, hide spinner anyway
                        hideSpinnerIfLoaded();
                    }
                }).catch(err => {
                    console.warn('Failed to load full Supabase dataset:', err);
                    // Hide spinner and show fallback message
                    hideSpinnerIfLoaded();
                    // Show toast notification about fallback to local data
                    if (window.UniUI && typeof window.UniUI.toast === 'function') {
                        window.UniUI.toast('Đang hiển thị dữ liệu đã lưu', 'info', 4000);
                    }
                });
            };
            
            window.DatabaseAdapter.load({ preferLocal: false, skipLocal: false, tables: essentialTables }).then(data => {
                if (data !== null && data !== undefined) {
                    applyDataSnapshot(data, 'supabase-initial', { replaceMissing: false });
                    emitDataEvent('UniData:ready', { source: 'supabase-initial' });
                    
                    if (window.UniUI && typeof window.UniUI.refreshCurrentPage === 'function') {
                        setTimeout(() => window.UniUI.refreshCurrentPage(), 100);
                    } else {
                        window.__UniPendingPageRefresh = true;
                    }
                    
                    loadFullDataset();
                } else {
                    // Fallback to loading everything if partial request returned nothing
                    loadFullDataset();
                }
            }).catch(e => {
                console.warn('Failed to load essential tables from Supabase:', e);
                emitDataEvent('UniData:error', { source: 'supabase', error: e?.message || String(e) });
                loadFullDataset();
            });
        } else {
            // Fallback to localStorage if DatabaseAdapter not available
            const stored = localStorage.getItem('unicorns.data');
            if (stored) {
                loaded = JSON.parse(stored);
                // IMPORTANT: Clear students from localStorage if it contains stale data
                if (loaded && loaded.students) {
                    // Filter out any students with ID 'S001' (Nguyễn Văn Tâm) or email 'hocsinh1@edu.vn'
                    loaded.students = loaded.students.filter(s => 
                        s.id !== 'S001' && 
                        String(s.email || '').toLowerCase() !== 'hocsinh1@edu.vn'
                    );
                }
            }
            emitDataEvent('UniData:ready', { source: loaded ? 'localStorage' : 'seed' });
        }
        
        if (loaded) {
            // DON'T call ensureSampleStudentLink - it creates "Nguyễn Văn Tâm" automatically
            // ensureSampleStudentLink(loaded);
            // Migrate old data structure to ensure consistency
            if (loaded.students) {
                loaded.students.forEach(s => {
                    if (!s.hasOwnProperty('lastAttendance')) s.lastAttendance = null;
                    if (!s.hasOwnProperty('email')) s.email = '';
                    if (!s.hasOwnProperty('gender')) s.gender = 'male';
                    if (typeof s.walletBalance !== 'number' || Number.isNaN(s.walletBalance)) {
                        s.walletBalance = 0;
                    }
                });
            }
            if (loaded.studentClasses) {
                loaded.studentClasses.forEach(sc => {
                    if (typeof sc.totalPurchasedSessions !== 'number') sc.totalPurchasedSessions = 0;
                    if (typeof sc.remainingSessions !== 'number') sc.remainingSessions = 0;
                    if (typeof sc.totalAttendedSessions !== 'number') sc.totalAttendedSessions = 0;
                    if (typeof sc.unpaidSessions !== 'number') sc.unpaidSessions = 0;
                    if (typeof sc.totalPaidAmount !== 'number') sc.totalPaidAmount = 0;
                });
            }
            if (loaded.sessions) {
                loaded.sessions.forEach(session => {
                    if (typeof session.studentPaidCount !== 'number') session.studentPaidCount = 0;
                    if (typeof session.studentTotalStudents !== 'number') session.studentTotalStudents = 0;
                    if (typeof session.allowanceAmount !== 'number' || session.allowanceAmount <= 0) {
                        session.allowanceAmount = computeSessionAllowance(session);
                    }
                });
            }
            if (loaded.classes) {
                loaded.classes.forEach(c => {
                    if (!c.hasOwnProperty('schedule')) c.schedule = [];
                    if (!c.hasOwnProperty('maxStudents')) c.maxStudents = 15;
                    if (!c.hasOwnProperty('tuitionPerSession')) c.tuitionPerSession = 0;
                    if (!c.hasOwnProperty('studentTuitionPerSession')) {
                        c.studentTuitionPerSession = typeof c.tuitionPerSession === 'number' ? c.tuitionPerSession : 0;
                    }
                    if (!c.hasOwnProperty('tuitionPackageTotal')) c.tuitionPackageTotal = 0;
                    if (!c.hasOwnProperty('tuitionPackageSessions')) c.tuitionPackageSessions = 0;
                    if (!c.hasOwnProperty('scaleAmount')) c.scaleAmount = 0;
                    if (!c.hasOwnProperty('maxAllowancePerSession')) c.maxAllowancePerSession = 0;
                    // Migrate teacherId to teacherIds (array)
                    if (c.hasOwnProperty('teacherId') && !c.hasOwnProperty('teacherIds')) {
                        c.teacherIds = c.teacherId ? [c.teacherId] : [];
                        delete c.teacherId;
                    }
                    if (!c.hasOwnProperty('teacherIds')) {
                        c.teacherIds = [];
                    }

                    // Ensure custom teacher allowances exist
                    if (!c.hasOwnProperty('customTeacherAllowances') || typeof c.customTeacherAllowances !== 'object') {
                        c.customTeacherAllowances = {};
                    }

                    // Migrate old customTeacherSalary to new allowances map
                    if (c.hasOwnProperty('customTeacherSalary') && c.customTeacherSalary !== null && typeof c.customTeacherSalary !== 'undefined') {
                        const allowanceValue = Number(c.customTeacherSalary) || 0;
                        if (allowanceValue > 0) {
                            const allowanceMap = {};
                            const teacherIds = Array.isArray(c.teacherIds) ? c.teacherIds : [];
                            if (teacherIds.length > 0) {
                                teacherIds.forEach(tid => { allowanceMap[tid] = allowanceValue; });
                            }
                            c.customTeacherAllowances = allowanceMap;
                        }
                        delete c.customTeacherSalary;
                    }
                });
            }
            if (loaded.teachers) {
                loaded.teachers.forEach(t => {
                    if (!t.hasOwnProperty('photoUrl')) t.photoUrl = '';
                    if (!t.hasOwnProperty('status')) t.status = 'active';
                    // Ensure new required fields exist (with defaults for old data)
                    if (!t.hasOwnProperty('birthDate')) t.birthDate = '';
                    if (!t.hasOwnProperty('university')) t.university = '';
                    if (!t.hasOwnProperty('highSchool')) t.highSchool = '';
                    if (!t.hasOwnProperty('province')) t.province = '';
                    if (!t.hasOwnProperty('specialization')) t.specialization = '';
                });
            }
            // Migrate sessions to include teacherId
            if (loaded.sessions) {
                loaded.sessions.forEach(s => {
                    if (!s.hasOwnProperty('teacherId')) {
                        // Try to get teacherId from class
                        const cls = loaded.classes?.find(c => c.id === s.classId);
                        if (cls) {
                            if (cls.teacherIds && cls.teacherIds.length > 0) {
                                s.teacherId = cls.teacherIds[0]; // Use first teacher as default
                            } else if (cls.teacherId) {
                                s.teacherId = cls.teacherId;
                            }
                        }
                    }
                    if (!s.hasOwnProperty('startTime')) s.startTime = '';
                    if (!s.hasOwnProperty('endTime')) s.endTime = '';
                    if (!s.hasOwnProperty('coefficient')) s.coefficient = 1;
                });
            }
            // Ensure arrays exist
            if (!loaded.studentClasses) loaded.studentClasses = [];
            if (!loaded.sessions) loaded.sessions = [];
            if (!loaded.attendance) loaded.attendance = [];
            if (!Array.isArray(loaded.lessonResources)) loaded.lessonResources = seed.lessonResources || [];
            if (!Array.isArray(loaded.lessonTasks)) loaded.lessonTasks = seed.lessonTasks || [];
            if (!Array.isArray(loaded.lessonOutputs)) loaded.lessonOutputs = seed.lessonOutputs || [];
            if (!Array.isArray(loaded.lessonTopics)) loaded.lessonTopics = seed.lessonTopics || [];
            if (!Array.isArray(loaded.lessonTopicLinks)) loaded.lessonTopicLinks = seed.lessonTopicLinks || [];
            if (!Array.isArray(loaded.walletTransactions)) loaded.walletTransactions = [];
            if (!Array.isArray(loaded.homePosts)) loaded.homePosts = [];
            if (!Array.isArray(loaded.walletTransactions)) loaded.walletTransactions = [];
            if (Array.isArray(loaded.costs)) {
                loaded.costs = loaded.costs.map(cost => {
                    const normalized = Object.assign({}, cost);
                    if (!normalized.id) {
                        normalized.id = generateId('cost');
                    }
                    if (typeof normalized.amount !== 'number') {
                        const parsedAmount = Number(normalized.amount);
                        normalized.amount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
                    }
                    if (typeof normalized.category !== 'string' || !normalized.category.trim()) {
                        normalized.category = 'Khác';
                    } else if (normalized.category.length > 60) {
                        normalized.category = normalized.category.slice(0, 60);
                    }
                    const monthFromDate = (value) => {
                        if (!value || typeof value !== 'string') return '';
                        return value.slice(0, 7);
                    };
                    if (!normalized.date && normalized.month) {
                        normalized.date = `${normalized.month}-01`;
                    }
                    if (!normalized.month && normalized.date) {
                        normalized.month = monthFromDate(normalized.date);
                    }
                    if (!normalized.month) {
                        const today = new Date();
                        normalized.month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                    }
                    if (!normalized.date) {
                        normalized.date = `${normalized.month}-01`;
                    }
                    if (!['paid', 'pending'].includes(normalized.status)) {
                        normalized.status = 'paid';
                    }
                    return normalized;
                });
            } else {
                loaded.costs = [];
            }
            if (!Array.isArray(loaded.users)) {
                loaded.users = [];
            }
            loaded.users = normalizeUsersCollection(loaded.users);
            if (!loaded.payroll) loaded.payroll = [];
            if (!loaded.revenue) loaded.revenue = [];
            if (!loaded.categories) loaded.categories = seed.categories;
            if (!Array.isArray(loaded.documents)) loaded.documents = seed.documents || [];
            return loaded;
        }
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }
    
    // Seed data is already empty - all data will be loaded from Supabase database
    return seed;
})();

let skipSupabaseNextSave = false;

function ensureStudentFinanceDefaults(targetData = null) {
    const data = (targetData && typeof targetData === 'object') ? targetData : window.demo;
    if (!data || typeof data !== 'object') return data;
    let localSnapshot = null;
    try {
        const stored = localStorage.getItem('unicorns.data');
        if (stored) localSnapshot = JSON.parse(stored);
    } catch (error) {
        console.warn('Failed to parse local snapshot for finance defaults:', error);
    }
    const localStudentMap = new Map();
    const localStudentClassMap = new Map();
    if (localSnapshot) {
        (localSnapshot.students || []).forEach(student => {
            localStudentMap.set(student.id, student);
        });
        (localSnapshot.studentClasses || []).forEach(record => {
            localStudentClassMap.set(record.id, record);
        });
    }

    const ensureNumber = (value, fallback = 0) => (typeof value === 'number' && !Number.isNaN(value)) ? value : fallback;

    data.students = (Array.isArray(data.students) ? data.students : []).map(student => {
        const localStudent = localStudentMap.get(student.id) || {};
        student.walletBalance = ensureNumber(student.walletBalance, ensureNumber(localStudent.walletBalance));
        return student;
    });
    data.studentClasses = (Array.isArray(data.studentClasses) ? data.studentClasses : []).map(record => {
        const localRecord = localStudentClassMap.get(record.id) || {};
        const coerce = (value, fallback = 0) => ensureNumber(value, ensureNumber(fallback));
        const classInfo = (data.classes || []).find(cls => cls.id === record.classId) || {};
        const classTotal = ensureNumber(classInfo.tuitionPackageTotal);
        const classSessions = ensureNumber(classInfo.tuitionPackageSessions);
        const classUnit = ensureNumber(classInfo.studentTuitionPerSession || classInfo.tuitionPerSession);
        record.totalPurchasedSessions = coerce(record.totalPurchasedSessions, localRecord.totalPurchasedSessions);
        record.remainingSessions = coerce(record.remainingSessions, localRecord.remainingSessions);
        record.totalAttendedSessions = coerce(record.totalAttendedSessions, localRecord.totalAttendedSessions);
        record.unpaidSessions = coerce(record.unpaidSessions, localRecord.unpaidSessions);
        record.totalPaidAmount = coerce(record.totalPaidAmount, localRecord.totalPaidAmount);
        const fallbackTotal = coerce(record.studentFeeTotal, coerce(localRecord.studentFeeTotal, record.totalPaidAmount || classTotal || 0));
        const fallbackSessions = coerce(record.studentFeeSessions, coerce(localRecord.studentFeeSessions, record.totalPurchasedSessions || classSessions || (classUnit > 0 && fallbackTotal > 0 ? Math.round(fallbackTotal / classUnit) : 0)));
        record.studentFeeTotal = fallbackTotal;
        record.studentFeeSessions = fallbackSessions;
        return record;
    });
    data.sessions = (Array.isArray(data.sessions) ? data.sessions : []).map(session => {
        const coerce = (value) => ensureNumber(value, 0);
        session.studentPaidCount = coerce(session.studentPaidCount);
        session.studentTotalStudents = coerce(session.studentTotalStudents);
        return session;
    });

    return data;
}

ensureStudentFinanceDefaults(window.demo);

/**
 * Save current state to database (Supabase/IndexedDB/localStorage)
 */
/**
 * Save with optimistic update pattern:
 * 1. Update local state immediately (optimistic)
 * 2. Send mutation to database
 * 3. If success: refetch to sync with database
 * 4. If error: rollback local state and show error
 * 
 * @param {Object} options - Save options
 * @param {Object} options.supabaseEntities - Entities to save to Supabase
 * @param {Object} options.supabaseDeletes - Entities to delete from Supabase
 * @param {Function} options.onSuccess - Callback on success
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onRollback - Callback when rolling back
 * @returns {Promise<boolean>} Success status
 */
async function saveWithOptimisticUpdate(options = {}) {
    // 1. Create snapshot of current state for rollback
    const snapshot = JSON.parse(JSON.stringify(window.demo));
    
    try {
        const skipSupabase = options.skipSupabase || skipSupabaseNextSave;
        const supabaseEntities = (options.supabaseEntities && typeof options.supabaseEntities === 'object') ? options.supabaseEntities : null;
        const supabaseDeletes = (options.supabaseDeletes && typeof options.supabaseDeletes === 'object') ? options.supabaseDeletes : null;
        skipSupabaseNextSave = false;
        const saveOptions = { ...options, skipSupabase };

        // 2. Update local state immediately (optimistic update)
        // This is already done by the caller before calling this function
        
        // 3. Save to localStorage immediately for offline support
        try {
            localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }

        // 4. Send mutation to database
        if (window.DatabaseAdapter && window.DatabaseAdapter.save) {
            const success = await window.DatabaseAdapter.save(window.demo, {
                ...saveOptions,
                supabaseEntities,
                supabaseDeletes,
                skipRefetch: true // We'll refetch manually after success
            });

            if (success) {
                // 5. Call success callback IMMEDIATELY (before refetch) to close modal
                if (options.onSuccess && typeof options.onSuccess === 'function') {
                    options.onSuccess();
                }
                
                // 6. Refetch from Supabase to sync with database (async, non-blocking)
                if (!skipSupabase && window.DatabaseAdapter && window.DatabaseAdapter.load) {
                    // Don't await - let it run in background
                    window.DatabaseAdapter.load({ preferLocal: false }).then(freshData => {
                        if (freshData) {
                            // Preserve and merge local-only data (histories) before merging
                            const localHistories = Array.isArray(window.demo.histories) ? [...window.demo.histories] : [];
                            const incomingHistories = Array.isArray(freshData.histories) ? freshData.histories : [];
                            
                            // Merge histories: keep local histories, add any new ones from incoming data (deduplicate by id)
                            const historyMap = new Map();
                            localHistories.forEach(h => {
                                if (h && h.id) historyMap.set(h.id, h);
                            });
                            incomingHistories.forEach(h => {
                                if (h && h.id && !historyMap.has(h.id)) historyMap.set(h.id, h);
                            });
                            const mergedHistories = Array.from(historyMap.values()).sort((a, b) => {
                                const timeA = new Date(a.timestamp || 0).getTime();
                                const timeB = new Date(b.timestamp || 0).getTime();
                                return timeB - timeA; // Newest first
                            });
                            
                            // Merge fresh data with current state (preserve optimistic updates if they match)
                            Object.keys(freshData).forEach(key => {
                                // Skip histories - it's local-only and not synced to Supabase
                                if (key === 'histories') return;
                                
                                if (Array.isArray(freshData[key])) {
                                    window.demo[key] = freshData[key];
                                } else if (typeof freshData[key] === 'object' && freshData[key] !== null) {
                                    window.demo[key] = { ...window.demo[key], ...freshData[key] };
                                } else {
                                    window.demo[key] = freshData[key];
                                }
                            });
                            
                            // Restore merged local-only data after merge
                            window.demo.histories = mergedHistories;
                            
                            // Also save to separate localStorage key for production mode compatibility
                            try {
                                localStorage.setItem('unicorns.histories', JSON.stringify(mergedHistories));
                            } catch (e) {
                                console.warn('[saveWithOptimisticUpdate] Failed to save histories to separate key:', e);
                            }
                            
                            // Update localStorage with synced data (including preserved histories)
                            localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
                        }
                    }).catch(refetchError => {
                        console.warn('Failed to refetch after save:', refetchError);
                        // Continue anyway - optimistic update is already applied
                    });
                }
                
                return true;
            } else {
                throw new Error('Save to database failed');
            }
        } else {
            // No DatabaseAdapter, just use localStorage
            if (options.onSuccess && typeof options.onSuccess === 'function') {
                options.onSuccess();
            }
            return true;
        }
    } catch (e) {
        console.error('Save with optimistic update failed:', e);
        
        // 7. Rollback: Restore previous state
        window.demo = snapshot;
        try {
            localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
        } catch (e2) {
            console.error('Failed to rollback localStorage:', e2);
        }

        // 8. Call rollback callback
        if (options.onRollback && typeof options.onRollback === 'function') {
            options.onRollback(snapshot);
        }

        // 9. Call error callback
        if (options.onError && typeof options.onError === 'function') {
            options.onError(e);
        } else {
            // Default error handling
            if (window.UniUI && typeof window.UniUI.toast === 'function') {
                window.UniUI.toast('Không thể cập nhật dữ liệu. Đã khôi phục trạng thái trước đó.', 'error');
            }
        }
        return false;
    }
}

async function saveToLocalStorage(options = {}) {
    try {
        const skipSupabase = options.skipSupabase || skipSupabaseNextSave;
        const supabaseEntities = (options.supabaseEntities && typeof options.supabaseEntities === 'object') ? options.supabaseEntities : null;
        const supabaseDeletes = (options.supabaseDeletes && typeof options.supabaseDeletes === 'object') ? options.supabaseDeletes : null;
        skipSupabaseNextSave = false;
        const saveOptions = { ...options, skipSupabase };

        // Use DatabaseAdapter if available (Supabase/IndexedDB with fallback)
        if (window.DatabaseAdapter && window.DatabaseAdapter.save) {
            // Use optimistic update pattern if requested
            if (options.useOptimisticUpdate) {
                return await saveWithOptimisticUpdate({
                    ...saveOptions,
                    supabaseEntities,
                    supabaseDeletes,
                    onSuccess: options.onSuccess,
                    onError: options.onError,
                    onRollback: options.onRollback
                });
            }
            
            // Legacy: Async save (fire and forget for now to maintain compatibility)
            window.DatabaseAdapter.save(window.demo, {
                ...saveOptions,
                supabaseEntities,
                supabaseDeletes
            }).catch(e => {
                console.error('DatabaseAdapter save failed:', e);
                // Fallback to direct localStorage
                localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
            });
            return true;
        } else {
            // Fallback to direct localStorage
            localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
            return true;
        }
    } catch (e) {
        console.error('Failed to save to database:', e);
    try {
        localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
        return true;
        } catch (e2) {
            console.error('Failed to save even to localStorage:', e2);
        return false;
        }
    }
}

/**
 * Generate a unique ID for a given entity type
 * @param {string} type - Entity type (S: Student, C: Class, T: Teacher, P: Payment)
 * @returns {string} Unique ID
 */
function generateId(type) {
    const types = {
        student: 'S',
        class: 'C',
        teacher: 'T',
        payment: 'P',
        cost: 'CO',
        wallet: 'WT',
        home: 'HP',
        lessonResource: 'LR',
        lessonTask: 'LT',
        lessonOutput: 'LO'
    };
    const prefix = types[type] || 'X';
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}${random}`;
}

/**
 * Export data to CSV
 * @param {string} filename - Name of the CSV file
 * @param {Array} headers - Array of column headers
 * @param {Array} data - Array of data rows
 */
function exportToCSV(filename, headers, data) {
    const rows = [
        headers,
        ...data.map(row => headers.map(header => row[header] || ''))
    ];
    
    const csvContent = rows
        .map(row => 
            row.map(cell => 
                typeof cell === 'string' ? 
                    `"${cell.replace(/"/g, '""')}"` : 
                    cell
            ).join(',')
        )
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Format currency in VND
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount
 */
function formatCurrency(amount) {
    const numeric = Number(amount || 0);
    if (!Number.isFinite(numeric)) return '0 đ';
    // Hỗ trợ số âm: hiển thị dấu trừ trước số
    if (numeric < 0) {
        return `-${Math.abs(numeric).toLocaleString('vi-VN')} đ`;
    }
    return `${numeric.toLocaleString('vi-VN')} đ`;
}

/**
 * Convert number to Vietnamese words (đồng)
 * @param {number} amount - Integer amount (can be negative)
 * @returns {string} Amount in Vietnamese words with trailing "đồng"
 */
function numberToVietnameseText(amount) {
    const n = Number.isFinite(amount) ? Math.floor(amount) : NaN;
    if (!Number.isFinite(n)) return '';
    if (n === 0) return 'Không đồng';
    
    // Xử lý số âm: lấy giá trị tuyệt đối và thêm "Âm" vào đầu
    const isNegative = n < 0;
    const absN = Math.abs(n);

    const digitWords = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const unitWords = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];

    function readThreeDigits(num, full) {
        const hundreds = Math.floor(num / 100);
        const tens = Math.floor((num % 100) / 10);
        const units = num % 10;
        let result = '';

        if (hundreds > 0 || full) {
            result += `${digitWords[hundreds]} trăm`;
        }

        if (tens > 1) {
            result += (result ? ' ' : '') + `${digitWords[tens]} mươi`;
            if (units === 1) {
                result += ' mốt';
            } else if (units === 4) {
                result += ' tư';
            } else if (units === 5) {
                result += ' lăm';
            } else if (units > 0) {
                result += ' ' + digitWords[units];
            }
        } else if (tens === 1) {
            result += (result ? ' ' : '') + 'mười';
            if (units === 1) {
                result += ' một';
            } else if (units === 4) {
                result += ' bốn';
            } else if (units === 5) {
                result += ' lăm';
            } else if (units > 0) {
                result += ' ' + digitWords[units];
            }
        } else if (tens === 0 && units > 0) {
            if (hundreds > 0 || full) {
                result += (result ? ' ' : '') + 'lẻ';
            }
            if (units === 4 && tens !== 0) {
                result += ' tư';
            } else if (units === 5 && (hundreds > 0 || full)) {
                result += ' năm';
            } else {
                result += (result ? ' ' : '') + digitWords[units];
            }
        }

        return result.trim();
    }

    let remaining = absN;
    let groupIndex = 0;
    let parts = [];

    while (remaining > 0 && groupIndex < unitWords.length) {
        const groupValue = remaining % 1000;
        if (groupValue > 0) {
            const full = groupIndex > 0 && groupValue < 100;
            const groupText = readThreeDigits(groupValue, full);
            const suffix = unitWords[groupIndex] ? ' ' + unitWords[groupIndex] : '';
            parts.unshift(groupText + suffix);
        }
        remaining = Math.floor(remaining / 1000);
        groupIndex += 1;
    }

    const sentence = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (!sentence) return '';

    const wordsText = sentence.charAt(0).toUpperCase() + sentence.slice(1) + ' đồng';
    // Thêm "Âm" vào đầu nếu là số âm
    return isNegative ? 'Âm ' + wordsText.toLowerCase() : wordsText;
}

/**
 * Format tuition/price in thousands (K VND / Hệ số)
 * @param {number} amountInVND - Amount in VND
 * @returns {string} Formatted amount in K VND / Hệ số
 */
function formatTuition(amountInVND) {
    const thousands = amountInVND / 1000;
    return new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(thousands) + ' K VND / Hệ số';
}

/**
 * Convert thousands to VND
 * @param {number} thousands - Amount in thousands
 * @returns {number} Amount in VND
 */
function convertThousandsToVND(thousands) {
    return Math.round((thousands || 0) * 1000);
}

/**
 * Convert VND to thousands
 * @param {number} vnd - Amount in VND
 * @returns {number} Amount in thousands
 */
function convertVNDToThousands(vnd) {
    return (vnd || 0) / 1000;
}

/**
 * Log an action to the demo histories array and persist
 * @param {string} action - Action type (create/update/delete)
 * @param {string} entity - Entity type (student/class/teacher/payment)
 * @param {string} entityId - ID of the entity affected
 * @param {Object} details - Optional details about the change
 */
function logAction(action, entity, entityId, details = {}) {
    try {
        if (!window.demo) {
            console.warn('[logAction] window.demo is not initialized');
            return null;
        }
        
        const entry = {
            id: 'H' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            timestamp: new Date().toISOString(),
            action,
            entity,
            entityId,
            details
        };

        window.demo.histories = window.demo.histories || [];
        window.demo.histories.unshift(entry);
        // Keep recent 200 entries to avoid bloating localStorage
        if (window.demo.histories.length > 200) window.demo.histories.length = 200;
        
        console.log('[logAction] Logged action:', action, entity, entityId, 'Total histories:', window.demo.histories.length);
        
        // Save histories to a separate localStorage key that is NOT blocked by SafeStorage
        // This ensures histories persist even in production mode
        try {
            const historiesKey = 'unicorns.histories'; // Not in sensitive keys list
            localStorage.setItem(historiesKey, JSON.stringify(window.demo.histories));
            console.log('[logAction] Saved histories to localStorage key:', historiesKey);
        } catch (e) {
            console.warn('[logAction] Failed to save histories to localStorage:', e);
        }
        
        // Also try to save via saveToLocalStorage (may be blocked in prod, but that's ok)
        saveToLocalStorage({ skipSupabase: true });
        return entry;
    } catch (e) {
        console.error('[logAction] Failed to log action', e, { action, entity, entityId });
        return null;
    }
}

/**
 * Retrieve saved action logs
 * @returns {Array}
 */
function getLogs() {
    return window.demo.histories || [];
}

/**
 * Optimistic mutation helper - Wrapper for CRUD operations with optimistic update
 * This function provides a reusable pattern for optimistic updates with rollback
 * 
 * Usage:
 * await window.UniData.withOptimisticUpdate(
 *   () => {
 *     // 1. Update local state immediately (optimistic)
 *     const entity = window.UniLogic.createEntity('student', data);
 *     return { supabaseEntities: { students: [entity] } };
 *   },
 *   {
 *     onSuccess: () => renderStudents(),
 *     onError: (error) => console.error(error),
 *     onRollback: () => renderStudents()
 *   }
 * );
 */
async function withOptimisticUpdate(mutationFn, callbacks = {}) {
    // 1. Create snapshot for rollback
    const snapshot = JSON.parse(JSON.stringify(window.demo));
    
    try {
        // 2. Show loading state
        if (callbacks.onLoading && typeof callbacks.onLoading === 'function') {
            callbacks.onLoading();
        } else if (window.UniUI && typeof window.UniUI.toast === 'function') {
            window.UniUI.toast('Đang xử lý...', 'info');
        }
        
        // 3. Perform mutation (updates local state immediately)
        const saveOptions = mutationFn();
        if (!saveOptions || typeof saveOptions !== 'object') {
            throw new Error('Mutation function must return save options');
        }
        
        // 4. Save with optimistic update
        const success = await window.UniData.save({
            ...saveOptions,
            useOptimisticUpdate: true,
            onSuccess: () => {
                if (callbacks.onSuccess && typeof callbacks.onSuccess === 'function') {
                    callbacks.onSuccess();
                }
            },
            onError: (error) => {
                if (callbacks.onError && typeof callbacks.onError === 'function') {
                    callbacks.onError(error);
                }
            },
            onRollback: () => {
                if (callbacks.onRollback && typeof callbacks.onRollback === 'function') {
                    callbacks.onRollback();
                }
            }
        });
        
        if (success) {
            return { success: true };
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('Optimistic update failed:', error);
        
        // Rollback is already handled in saveWithOptimisticUpdate
        // But we can call additional rollback callback if needed
        if (callbacks.onRollback && typeof callbacks.onRollback === 'function') {
            callbacks.onRollback();
        }
        
        if (callbacks.onError && typeof callbacks.onError === 'function') {
            callbacks.onError(error);
        }
        
        return { success: false, error };
    }
}

// Export functions for use in other modules
if (!window.UniData) window.UniData = {};
Object.assign(window.UniData, {
    save: saveToLocalStorage,
    generateId,
    exportToCSV,
    formatCurrency,
    numberToVietnameseText,
    withOptimisticUpdate
});

// Expose logging API
window.UniData.logAction = logAction;
window.UniData.getLogs = getLogs;

// Expose currency helpers
window.UniData.formatTuition = formatTuition;
window.UniData.convertThousandsToVND = convertThousandsToVND;
window.UniData.convertVNDToThousands = convertVNDToThousands;
window.UniData.ensureStudentFinanceDefaults = ensureStudentFinanceDefaults;
window.UniData.computeSessionAllowance = computeSessionAllowance;
window.UniData.normalizeUsersCollection = normalizeUsersCollection;
window.UniData.generateUuid = generateLocalUuid;

window.UniData.skipSupabaseOnce = function() {
    skipSupabaseNextSave = true;
};

const DEFAULT_CATEGORIES = [
    { id: null, name: '1-1' },
    { id: null, name: 'Basic' },
    { id: null, name: 'Advance' },
    { id: null, name: 'Hardcore' }
];

function normalizeCategoryEntry(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) return null;
        return { id: null, name };
    }
    if (typeof entry === 'object') {
        const name = (entry.name ?? entry.value ?? entry.label ?? '').trim();
        if (!name) return null;
        const id = entry.id !== undefined ? entry.id : (entry.ID !== undefined ? entry.ID : null);
        return {
            id: id === undefined ? null : id,
            name
        };
    }
    const name = String(entry).trim();
    if (!name) return null;
    return { id: null, name };
}

function dedupeCategories(list) {
    const seen = new Set();
    return list.filter(cat => {
        const key = (cat.name || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(cat => ({ id: cat.id ?? null, name: cat.name }));
}

function cloneCategories(list) {
    return list.map(cat => ({ id: cat.id ?? null, name: cat.name }));
}

function normalizeCategoriesList(list, options = {}) {
    const { mutateDemo = false } = options;
    const source = Array.isArray(list) ? list : DEFAULT_CATEGORIES;
    const normalized = source
        .map(normalizeCategoryEntry)
        .filter(Boolean);
    const deduped = dedupeCategories(normalized);
    if (mutateDemo) {
        window.demo = window.demo || {};
        window.demo.categories = cloneCategories(deduped);
    }
    return cloneCategories(deduped);
}

window.UniData.normalizeCategory = normalizeCategoryEntry;
window.UniData.normalizeCategories = normalizeCategoriesList;

// Categories API
window.UniData.getCategories = function(){
    const source = (window.demo && Array.isArray(window.demo.categories)) ? window.demo.categories : DEFAULT_CATEGORIES;
    return normalizeCategoriesList(source, { mutateDemo: true });
};
window.UniData.setCategories = function(categories){
    if (!Array.isArray(categories)) return;
    const normalized = normalizeCategoriesList(categories, { mutateDemo: true });
    saveToLocalStorage({
        supabaseEntities: {
            categories: normalized
        }
    });
};

// Helpers for new entities
window.UniData.getSessionsByClass = function(classId){
    return (window.demo.sessions || []).filter(s => s.classId === classId).sort((a,b)=> (a.date>b.date?-1:1));
};

window.UniData.getStudentClassesForStudent = function(studentId){
    return (window.demo.studentClasses || []).filter(sc => sc.studentId === studentId && sc.status !== 'inactive');
};

/**
 * Sync student.classId with all active classes from studentClasses
 * classId will be an array of class IDs, or null if student has no classes
 * @param {string} studentId - Student ID
 * @returns {Array<string>|null} Array of class IDs or null
 */
window.UniData.syncStudentClassId = function(studentId) {
    if (!studentId) return null;
    
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return null;
    
    // Get all active classes for this student
    const activeClasses = window.UniData.getStudentClassesForStudent(studentId);
    const classIds = activeClasses.map(sc => sc.classId).filter(Boolean);
    
    // Update student.classId to be array of all class IDs (or null if empty)
    const newClassId = classIds.length > 0 ? classIds : null;
    
    // Only update if changed
    const currentClassId = student.classId;
    const currentClassIdArray = Array.isArray(currentClassId) 
        ? currentClassId 
        : (currentClassId ? [currentClassId] : []);
    
    // Compare arrays (order doesn't matter)
    const currentSet = new Set(currentClassIdArray);
    const newSet = new Set(classIds);
    
    if (currentSet.size !== newSet.size || !classIds.every(id => currentSet.has(id))) {
        student.classId = newClassId;
        // Log removed to reduce console noise
        // console.log(`[syncStudentClassId] Updated student ${studentId} classId from [${currentClassIdArray.join(', ')}] to [${classIds.join(', ')}]`);
        return newClassId;
    }
    
    return newClassId;
};

function computeClassTuitionDefaults(cls = {}) {
    const defaultTotal = Number(cls?.tuitionPackageTotal || 0) || 0;
    const defaultSessions = Number(cls?.tuitionPackageSessions || 0) || 0;
    const explicitUnit = Number(cls?.studentTuitionPerSession || 0) || 0;
    const derivedUnit = defaultSessions > 0 && defaultTotal > 0 ? defaultTotal / defaultSessions : 0;
    const unit = explicitUnit > 0 ? explicitUnit : derivedUnit;
    return {
        defaultTotal,
        defaultSessions,
        unit,
        resolvedTotal: defaultTotal > 0 ? defaultTotal : (unit > 0 && defaultSessions > 0 ? unit * defaultSessions : 0),
        resolvedSessions: defaultSessions > 0 ? defaultSessions : (unit > 0 && defaultTotal > 0 ? Math.round(defaultTotal / unit) : 0)
    };
}

function computeSessionAllowance(session) {
    if (!session) return 0;
    const demo = typeof window !== 'undefined' && window.demo ? window.demo : {};
    const classList = Array.isArray(demo.classes) ? demo.classes : [];
    const cls = classList.find(c => c.id === session.classId) || {};
    const customAllowances = cls?.customTeacherAllowances || {};
    const baseAllowance = Number(customAllowances?.[session.teacherId] ?? cls?.tuitionPerSession ?? 0) || 0;
    // Xử lý đúng trường hợp coefficient = 0 (không dùng || 1 vì 0 là falsy)
    const coefficient = session.coefficient != null ? Number(session.coefficient) : 1;
    // Nếu hệ số = 0 thì số tiền = 0 luôn, không tính theo công thức
    if (coefficient === 0) return 0;
    const paidCount = Number(session.studentPaidCount || 0) || 0;
    const scale = Number(cls?.scaleAmount || 0) || 0;
    const maxPerSession = Number(cls?.maxAllowancePerSession || 0) || 0;
    let allowance = (baseAllowance * coefficient * paidCount) + scale;
    if (maxPerSession > 0 && allowance > maxPerSession) {
        allowance = maxPerSession;
    }
    return allowance > 0 ? Math.round(allowance) : 0;
}

window.UniData.ensureStudentClassRecord = function(studentId, classId, overrides = {}) {
    if (!studentId || !classId) return null;
    window.demo.studentClasses = window.demo.studentClasses || [];
    let record = window.demo.studentClasses.find(sc => sc.studentId === studentId && sc.classId === classId);
    const cls = (window.demo.classes || []).find(c => c.id === classId) || {};
    const tuitionDefaults = computeClassTuitionDefaults(cls);

    const isNewRecord = !record;
    if (!record) {
        record = {
            id: 'SC' + Math.random().toString(36).slice(2, 7).toUpperCase(),
            studentId,
            classId,
            startDate: new Date().toISOString().slice(0, 10),
            status: 'active',
            totalPurchasedSessions: 0,
            remainingSessions: 0,
            totalAttendedSessions: 0,
            unpaidSessions: 0,
            totalPaidAmount: 0,
            studentFeeTotal: tuitionDefaults.resolvedTotal,
            studentFeeSessions: tuitionDefaults.resolvedSessions,
            studentTuitionPerSession: tuitionDefaults.unit
        };
        window.demo.studentClasses.push(record);
    } else {
        if ((!record.studentFeeTotal || record.studentFeeTotal <= 0) && tuitionDefaults.resolvedTotal > 0) {
            record.studentFeeTotal = tuitionDefaults.resolvedTotal;
        }
        if ((!record.studentFeeSessions || record.studentFeeSessions <= 0) && tuitionDefaults.resolvedSessions > 0) {
            record.studentFeeSessions = tuitionDefaults.resolvedSessions;
        }
        if ((!record.studentTuitionPerSession || record.studentTuitionPerSession <= 0) && tuitionDefaults.unit > 0) {
            record.studentTuitionPerSession = tuitionDefaults.unit;
        }
    }
    if (overrides && typeof overrides === 'object') {
        Object.assign(record, overrides);
    }
    if (record.studentFeeTotal > 0 && record.studentFeeSessions > 0) {
        record.studentTuitionPerSession = record.studentFeeTotal / record.studentFeeSessions;
    }
    
    // Sync student.classId with all active classes after creating/updating record
    if (isNewRecord || (overrides && overrides.status === 'active')) {
        if (window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
            window.UniData.syncStudentClassId(studentId);
        }
    }
    
    return record;
};

window.UniData.describeStudentClassFinancial = function(record) {
    if (!record) return null;
    const classInfo = (window.demo.classes || []).find(c => c.id === record.classId) || null;
    const tuitionDefaults = computeClassTuitionDefaults(classInfo || {});

    const manualTotal = Number(record.studentFeeTotal || 0);
    const manualSessions = Number(record.studentFeeSessions || 0);
    const manualUnit = manualTotal > 0 && manualSessions > 0 ? manualTotal / manualSessions : null;

    const recordedUnit = Number(record.studentTuitionPerSession || 0);
    const historicalTotal = Number(record.totalPaidAmount || 0);
    const historicalSessions = Number(record.totalPurchasedSessions || 0);
    const historicalUnit = historicalSessions > 0 && historicalTotal > 0 ? historicalTotal / historicalSessions : null;

    let unitPrice = 0;
    let unitSource = 'class-default';
    let total = 0;
    let totalSource = 'class-default';
    let sessions = 0;
    const manualOverride = manualTotal > 0 && manualSessions > 0;

    if (manualOverride) {
        unitPrice = manualUnit || 0;
        total = manualTotal;
        sessions = manualSessions;
        unitSource = 'student-override';
        totalSource = 'student-override';
    } else {
        if (recordedUnit > 0) {
            unitPrice = recordedUnit;
            unitSource = 'student-record';
        } else if (historicalUnit) {
            unitPrice = historicalUnit;
            unitSource = 'historical';
        } else {
            unitPrice = tuitionDefaults.unit;
            unitSource = 'class-default';
        }

        if (tuitionDefaults.resolvedSessions > 0) {
            sessions = tuitionDefaults.resolvedSessions;
            if (tuitionDefaults.defaultTotal > 0) {
                total = tuitionDefaults.defaultTotal;
                totalSource = 'class-default';
            } else {
                total = unitPrice > 0 ? unitPrice * tuitionDefaults.resolvedSessions : 0;
                totalSource = 'derived';
            }
        } else if (historicalSessions > 0) {
            sessions = historicalSessions;
            if (historicalTotal > 0) {
                total = historicalTotal;
                totalSource = 'historical';
            } else {
                total = unitPrice > 0 ? unitPrice * historicalSessions : 0;
                totalSource = 'derived';
            }
        } else {
            sessions = manualSessions > 0 ? manualSessions : (unitPrice > 0 ? 1 : 0);
            total = unitPrice > 0 ? unitPrice * sessions : 0;
            totalSource = 'derived';
        }
    }

    return {
        record,
        classInfo,
        manualOverride,
        total,
        sessions,
        unitPrice,
        unitSource,
        totalSource,
        remaining: Number(record.remainingSessions || 0),
        unpaid: Number(record.unpaidSessions || 0),
        attended: Number(record.totalAttendedSessions || 0)
    };
};

window.UniData.updateStudentClassRecord = function(recordId, patch = {}) {
    if (!recordId) return null;
    const records = window.demo.studentClasses || [];
    const idx = records.findIndex(r => r.id === recordId);
    if (idx === -1) return null;
    const record = records[idx];
    Object.keys(patch).forEach(key => {
        const value = patch[key];
        if (value === null || value === undefined) return;
        record[key] = value;
    });
    // Sanitise numeric fields
    ['totalPurchasedSessions','remainingSessions','totalAttendedSessions','unpaidSessions','totalPaidAmount','studentFeeTotal','studentFeeSessions'].forEach(key => {
        if (typeof record[key] !== 'number' || Number.isNaN(record[key])) {
            record[key] = 0;
        }
        if (record[key] < 0) record[key] = 0;
    });
    return record;
};

window.UniData.getStudentFeePerSession = function(record) {
    if (!record) return 0;
    const sessions = record.studentFeeSessions || record.totalPurchasedSessions || 0;
    if (sessions <= 0) return 0;
    const total = record.studentFeeTotal || record.totalPaidAmount || 0;
    return total / sessions;
};

window.UniData.adjustStudentWallet = function(studentId, delta) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return null;
    const balance = typeof student.walletBalance === 'number' ? student.walletBalance : 0;
    student.walletBalance = Math.max(0, balance + delta);
    return student;
};

window.UniData.applySessionToStudents = function(session) {
    if (!session || !session.classId) return { coveredCount: 0, affected: [] };
    const classId = session.classId;
    window.demo.studentClasses = window.demo.studentClasses || [];

    const activeStudents = (window.UniLogic?.getRelated('class', classId, 'students') || [])
        .filter(student => (student?.status || 'active') !== 'inactive');
    const activeStudentIds = new Set(activeStudents.map(student => student.id).filter(Boolean));

    // Fallback: if no students returned from relation, try legacy mapping
    if (activeStudentIds.size === 0) {
        (window.demo.students || []).forEach(student => {
            if (student.classId === classId && (student.status || 'active') !== 'inactive') {
                activeStudentIds.add(student.id);
            }
        });
    }

    if (activeStudentIds.size === 0) {
        session.studentPaidCount = 0;
        session.studentTotalStudents = 0;
        session.allowanceAmount = computeSessionAllowance(session);
        return { coveredCount: 0, affected: [] };
    }

    const recordsByStudent = new Map();
    (window.demo.studentClasses || [])
        .filter(record => record.classId === classId && activeStudentIds.has(record.studentId))
        .forEach(record => {
            if (!recordsByStudent.has(record.studentId)) {
                recordsByStudent.set(record.studentId, record);
            }
        });

    activeStudentIds.forEach(studentId => {
        if (!recordsByStudent.has(studentId) && typeof window.UniData.ensureStudentClassRecord === 'function') {
            const record = window.UniData.ensureStudentClassRecord(studentId, classId, { status: 'active' });
            if (record) {
                recordsByStudent.set(studentId, record);
            }
        }
    });

    const activeRecords = Array.from(recordsByStudent.values());
    let coveredCount = 0;
    const affectedRecords = [];

    activeRecords.forEach(record => {
        record.totalAttendedSessions = (record.totalAttendedSessions || 0) + 1;
        if ((record.remainingSessions || 0) > 0) {
            record.remainingSessions -= 1;
            coveredCount += 1;
        } else {
            record.unpaidSessions = (record.unpaidSessions || 0) + 1;
        }
        affectedRecords.push(record);
    });

    session.studentPaidCount = coveredCount;
    session.studentTotalStudents = activeRecords.length;
    session.allowanceAmount = computeSessionAllowance(session);

    return { coveredCount, affected: affectedRecords };
};

window.UniData.addSession = function(classId, date, startTime, endTime, teacherId, coefficient, notes, paymentStatus){
    const id = 'SE' + Math.random().toString(36).slice(2,7).toUpperCase();
    const session = { 
        id, 
        classId, 
        date, 
        startTime: startTime || '', 
        endTime: endTime || '', 
        teacherId: teacherId || null,
        coefficient: coefficient || 1,
        paymentStatus: paymentStatus || 'unpaid',
        notes: notes || '' 
    };
    // Calculate duration from startTime and endTime if provided
    if (startTime && endTime) {
        const start = new Date(`2000-01-01 ${startTime}`);
        const end = new Date(`2000-01-01 ${endTime}`);
        session.duration = (end - start) / (1000 * 60 * 60); // hours
    } else {
        session.duration = 2; // default
    }
    window.demo.sessions = window.demo.sessions || [];
    window.demo.sessions.unshift(session);
    const { affected } = window.UniData.applySessionToStudents(session);
    saveToLocalStorage({
        supabaseEntities: {
            sessions: [session],
            ...(affected.length ? { studentClasses: affected } : {})
        }
    });
    try { window.UniData.logAction('create','session', id, { classId, date, teacherId }); } catch(e){}
    return session;
};
window.UniData.getTeacherClasses = function(teacherId){
    return (window.demo.classes || []).filter(c => {
        if (c.teacherIds && Array.isArray(c.teacherIds)) {
            return c.teacherIds.includes(teacherId);
        }
        // Fallback for old data structure
        return c.teacherId === teacherId;
    });
};
window.UniData.getTeacherKpis = function(teacherId){
    const classes = window.UniData.getTeacherClasses(teacherId);
    const classIds = classes.map(c => c.id);
    const sessions = (window.demo.sessions||[]).filter(s => classIds.includes(s.classId));
    const totalSessions = sessions.length;
    const totalHours = sessions.reduce((s, x)=> s + (x.duration||0), 0);
    const paid = (window.demo.payments||[]).filter(p => classIds.includes(p.classId) && p.status==='paid').reduce((s,p)=> s+(p.amount||0), 0);
    return { totalSessions, totalHours, income: paid };
};

// Sync helpers - ensure data consistency
window.UniData.syncStudentLastAttendance = function(studentId){
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return;
    const lastAtt = (window.demo.attendance || [])
        .filter(a => a.studentId === studentId && a.present)
        .sort((a,b) => {
            const sessA = (window.demo.sessions || []).find(s => s.id === a.sessionId);
            const sessB = (window.demo.sessions || []).find(s => s.id === b.sessionId);
            return (sessB?.date || '') > (sessA?.date || '') ? 1 : -1;
        })[0];
    if (lastAtt) {
        const sess = (window.demo.sessions || []).find(s => s.id === lastAtt.sessionId);
        student.lastAttendance = sess ? sess.date : null;
    } else {
        student.lastAttendance = null;
    }
    saveToLocalStorage({
        supabaseEntities: {
            students: [student]
        }
    });
};

// Sync all students' last attendance
window.UniData.syncAllLastAttendance = function(){
    (window.demo.students || []).forEach(s => window.UniData.syncStudentLastAttendance(s.id));
};

// Revenue/Cost/Profit helpers
window.UniData.getMonthlyFinance = function(){
    const revByMonth = (window.demo.revenue||[]).reduce((m, r)=>{ m[r.month]=(m[r.month]||0)+(r.totalRevenue||0); return m; },{});
    const payByMonth = (window.demo.payroll||[]).reduce((m, p)=>{ m[p.month]=(m[p.month]||0)+(p.totalPay||0); return m; },{});
    const costByMonth = (window.demo.costs||[]).reduce((m, c)=>{ m[c.month]=(m[c.month]||0)+(c.amount||0); return m; },{});
    const months = Array.from(new Set([...Object.keys(revByMonth),...Object.keys(payByMonth),...Object.keys(costByMonth)])).sort();
    return months.map(m=>{
        const revenue = revByMonth[m]||0;
        const costs = (costByMonth[m]||0) + (payByMonth[m]||0);
        const profit = revenue - costs;
        return { month: m, revenue, costs, profit };
    });
};

// DISABLED: ensureSampleStudentLink function - it was creating "Nguyễn Văn Tâm" automatically
// This function is no longer needed as we load all data from Supabase database
/*
function ensureSampleStudentLink(targetData = window.demo) {
    // Function disabled to prevent automatic creation of "Nguyễn Văn Tâm"
}
*/

// Don't call ensureSampleStudentLink on startup
// ensureSampleStudentLink();

/**
 * Page Rendering Optimization Helpers
 * Provides optimistic loading, data snapshotting, and auto-refresh for all pages
 */

// Helper function to load data from cache for optimistic rendering
// Helper to hide spinner when data is loaded from cache
function hideSpinnerIfLoaded() {
    const spinner = document.getElementById('appBootSkeleton');
    if (spinner && spinner.dataset.state !== 'hidden') {
        spinner.dataset.state = 'hidden';
        // Update message
        const messageEl = document.getElementById('appBootMessage');
        if (messageEl) {
            messageEl.textContent = 'Đang hiển thị dữ liệu đã lưu. Đang kiểm tra cập nhật...';
        }
    }
}

async function loadPageDataFromCache() {
    console.log(`!!!!!![UniData:Cache] loadPageDataFromCache() called`, {
        timestamp: Date.now(),
        hasWindowDemo: !!window.demo,
        windowDemoKeys: window.demo ? Object.keys(window.demo).length : 0,
        hasClassTeachers: Array.isArray(window.demo?.classTeachers) && window.demo.classTeachers.length > 0,
        classTeachersCount: Array.isArray(window.demo?.classTeachers) ? window.demo.classTeachers.length : 0
    });
    
    // Check if we have complete data (not just any data)
    // Return early only if we have classTeachers OR all classes have teacherIds
    const hasWindowDemo = window.demo && Object.keys(window.demo).length > 0;
    const hasClassTeachers = Array.isArray(window.demo?.classTeachers) && window.demo.classTeachers.length > 0;
    const allClassesHaveTeacherIds = Array.isArray(window.demo?.classes) && 
        window.demo.classes.length > 0 &&
        window.demo.classes.every(cls => cls.teacherIds && Array.isArray(cls.teacherIds) && cls.teacherIds.length > 0);
    const hasCompleteData = hasWindowDemo && (hasClassTeachers || allClassesHaveTeacherIds);
    
    if (hasCompleteData) {
        console.log(`[UniData:Cache] Early return - window.demo already has complete data`, {
            hasClassTeachers,
            allClassesHaveTeacherIds,
            classesCount: Array.isArray(window.demo?.classes) ? window.demo.classes.length : 0
        });
        hideSpinnerIfLoaded();
        return true; // Already has complete data
    } else if (hasWindowDemo) {
        console.log(`[UniData:Cache] window.demo exists but missing classTeachers or teacherIds, attempting to load from cache...`);
    }
    
    try {
        // Priority 1: Try localStorage first (fastest, most reliable for F5)
        const stored = localStorage.getItem('unicorns.data');
        console.log(`[UniData:Cache] Checking localStorage`, {
            timestamp: Date.now(),
            hasStored: !!stored,
            storedLength: stored ? stored.length : 0,
            isProdMode: window.APP_MODE === 'prod'
        });
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    if (!window.demo) window.demo = {};
                    Object.keys(parsed).forEach(key => {
                        if (Array.isArray(parsed[key])) {
                            window.demo[key] = parsed[key];
                        } else if (parsed[key] !== null && parsed[key] !== undefined) {
                            window.demo[key] = parsed[key];
                        }
                    });
                    const timestamp = localStorage.getItem('unicorns.data.timestamp');
                    const cacheInfo = {
                        teachers: Array.isArray(parsed.teachers) ? parsed.teachers.length : (parsed.teachers ? 'not-array' : 'missing'),
                        classTeachers: Array.isArray(parsed.classTeachers) ? parsed.classTeachers.length : (parsed.classTeachers ? 'not-array' : 'missing'),
                        classes: Array.isArray(parsed.classes) ? parsed.classes.length : (parsed.classes ? 'not-array' : 'missing'),
                        classesWithTeacherIds: Array.isArray(parsed.classes) ? parsed.classes.filter(c => c.teacherIds && Array.isArray(c.teacherIds) && c.teacherIds.length > 0).length : 0,
                        walletTransactions: Array.isArray(parsed.walletTransactions) ? parsed.walletTransactions.length : (parsed.walletTransactions ? 'not-array' : 'missing'),
                        lessonOutputs: Array.isArray(parsed.lessonOutputs) ? parsed.lessonOutputs.length : (parsed.lessonOutputs ? 'not-array' : 'missing'),
                        bonuses: Array.isArray(parsed.bonuses) ? parsed.bonuses.length : (parsed.bonuses ? 'not-array' : 'missing')
                    };
                    console.log(`🗂️ [UniData] Loaded from localStorage${timestamp ? ` (saved ${Math.round((Date.now() - parseInt(timestamp)) / 1000)}s ago)` : ''}`, cacheInfo);
                    console.log(`[UniData:Cache] After loading from localStorage, window.demo state:`, {
                        timestamp: Date.now(),
                        hasClasses: Array.isArray(window.demo.classes),
                        classesCount: Array.isArray(window.demo.classes) ? window.demo.classes.length : 0,
                        hasClassTeachers: Array.isArray(window.demo.classTeachers),
                        classTeachersCount: Array.isArray(window.demo.classTeachers) ? window.demo.classTeachers.length : 0,
                        classesWithTeacherIds: Array.isArray(window.demo.classes) ? window.demo.classes.filter(c => c.teacherIds && Array.isArray(c.teacherIds) && c.teacherIds.length > 0).length : 0,
                        walletTransactionsCount: Array.isArray(window.demo.walletTransactions) ? window.demo.walletTransactions.length : 0,
                        lessonOutputsCount: Array.isArray(window.demo.lessonOutputs) ? window.demo.lessonOutputs.length : 0,
                        bonusesCount: Array.isArray(window.demo.bonuses) ? window.demo.bonuses.length : 0
                    });
                    
                    // Apply conversion logic for classTeachers → teacherIds (same as applyDataSnapshot)
                    // IMPORTANT: Only convert if needed, and do it in-place to avoid changing object references unnecessarily
                    if (window.demo.classes && Array.isArray(window.demo.classes) && window.demo.classTeachers && Array.isArray(window.demo.classTeachers)) {
                        const classTeachers = window.demo.classTeachers;
                        let hasChanges = false;
                        const conversionStartTime = Date.now();
                        console.log(`[UniData:Cache] Starting classTeachers → teacherIds conversion (localStorage)`, {
                            classesCount: window.demo.classes.length,
                            classTeachersCount: classTeachers.length
                        });
                        window.demo.classes.forEach((cls, index) => {
                            // Only update if teacherIds is missing or empty (to avoid overwriting if already set)
                            if (!cls.teacherIds || cls.teacherIds.length === 0) {
                                const teacherIds = classTeachers
                                    .filter(ct => ct.class_id === cls.id || ct.classId === cls.id)
                                    .map(ct => ct.teacher_id || ct.teacherId)
                                    .filter(Boolean);
                                
                                // Build customTeacherAllowances from classTeachers table (active teachers)
                                const customTeacherAllowances = {};
                                classTeachers
                                    .filter(ct => (ct.class_id === cls.id || ct.classId === cls.id) && (ct.custom_allowance || ct.customAllowance))
                                    .forEach(ct => {
                                        const teacherId = ct.teacher_id || ct.teacherId;
                                        if (teacherId) {
                                            const allowance = ct.custom_allowance || ct.customAllowance;
                                            if (allowance !== null && allowance !== undefined) {
                                                customTeacherAllowances[teacherId] = allowance;
                                            }
                                        }
                                    });
                                
                                // Merge with existing customTeacherAllowances from classes (preserves inactive teachers)
                                if (cls.customTeacherAllowances && typeof cls.customTeacherAllowances === 'object') {
                                    Object.keys(cls.customTeacherAllowances).forEach(teacherId => {
                                        if (cls.customTeacherAllowances[teacherId] !== null && 
                                            cls.customTeacherAllowances[teacherId] !== undefined) {
                                            if (!customTeacherAllowances.hasOwnProperty(teacherId)) {
                                                customTeacherAllowances[teacherId] = cls.customTeacherAllowances[teacherId];
                                            }
                                        }
                                    });
                                }
                                
                                // Modify in-place to avoid changing array reference
                                cls.teacherIds = teacherIds.length > 0 ? teacherIds : (cls.teacherId ? [cls.teacherId] : []);
                                cls.customTeacherAllowances = customTeacherAllowances;
                                hasChanges = true;
                            }
                        });
                        // Only log if we actually made changes
                        if (hasChanges) {
                            const conversionDuration = Date.now() - conversionStartTime;
                            console.log(`[UniData:Cache] Converted classTeachers → teacherIds for cached classes (localStorage) (${conversionDuration}ms)`);
                        } else {
                            console.log(`[UniData:Cache] No conversion needed - all classes already have teacherIds (localStorage)`);
                        }
                    } else {
                        console.log(`[UniData:Cache] Skipping conversion - missing classes or classTeachers array (localStorage)`);
                    }
                    
                    // Hide spinner when cache loaded
                    hideSpinnerIfLoaded();
                    return true;
                }
            } catch (e) {
                console.warn('[UniData] Failed to parse localStorage data:', e);
            }
        }
        
        // Priority 2: Try DatabaseAdapter (IndexedDB/Supabase cache)
        if (window.DatabaseAdapter && typeof window.DatabaseAdapter.load === 'function') {
            try {
                const cached = await window.DatabaseAdapter.load({ preferLocal: true, skipRemote: true });
                if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
                    // Apply cached data
                    if (!window.demo) window.demo = {};
                    Object.keys(cached).forEach(key => {
                        if (Array.isArray(cached[key])) {
                            window.demo[key] = cached[key];
                        } else if (cached[key] !== null && cached[key] !== undefined) {
                            window.demo[key] = cached[key];
                        }
                    });
                    const cacheInfo = {
                        teachers: Array.isArray(cached.teachers) ? cached.teachers.length : (cached.teachers ? 'not-array' : 'missing'),
                        classTeachers: Array.isArray(cached.classTeachers) ? cached.classTeachers.length : (cached.classTeachers ? 'not-array' : 'missing'),
                        classes: Array.isArray(cached.classes) ? cached.classes.length : (cached.classes ? 'not-array' : 'missing'),
                        classesWithTeacherIds: Array.isArray(cached.classes) ? cached.classes.filter(c => c.teacherIds && Array.isArray(c.teacherIds) && c.teacherIds.length > 0).length : 0,
                        walletTransactions: Array.isArray(cached.walletTransactions) ? cached.walletTransactions.length : (cached.walletTransactions ? 'not-array' : 'missing'),
                        lessonOutputs: Array.isArray(cached.lessonOutputs) ? cached.lessonOutputs.length : (cached.lessonOutputs ? 'not-array' : 'missing'),
                        bonuses: Array.isArray(cached.bonuses) ? cached.bonuses.length : (cached.bonuses ? 'not-array' : 'missing')
                    };
                    console.log('🗂️ [UniData] Loaded from IndexedDB cache', cacheInfo);
                    console.log(`[UniData:Cache] After loading from IndexedDB, window.demo state:`, {
                        timestamp: Date.now(),
                        hasClasses: Array.isArray(window.demo.classes),
                        classesCount: Array.isArray(window.demo.classes) ? window.demo.classes.length : 0,
                        hasClassTeachers: Array.isArray(window.demo.classTeachers),
                        classTeachersCount: Array.isArray(window.demo.classTeachers) ? window.demo.classTeachers.length : 0,
                        classesWithTeacherIds: Array.isArray(window.demo.classes) ? window.demo.classes.filter(c => c.teacherIds && Array.isArray(c.teacherIds) && c.teacherIds.length > 0).length : 0,
                        walletTransactionsCount: Array.isArray(window.demo.walletTransactions) ? window.demo.walletTransactions.length : 0,
                        lessonOutputsCount: Array.isArray(window.demo.lessonOutputs) ? window.demo.lessonOutputs.length : 0,
                        bonusesCount: Array.isArray(window.demo.bonuses) ? window.demo.bonuses.length : 0
                    });
                    
                    // Apply conversion logic for classTeachers → teacherIds (same as applyDataSnapshot)
                    // IMPORTANT: Only convert if needed, and do it in-place to avoid changing object references unnecessarily
                    if (window.demo.classes && Array.isArray(window.demo.classes) && window.demo.classTeachers && Array.isArray(window.demo.classTeachers)) {
                        const classTeachers = window.demo.classTeachers;
                        let hasChanges = false;
                        const conversionStartTime = Date.now();
                        console.log(`[UniData:Cache] Starting classTeachers → teacherIds conversion (IndexedDB)`, {
                            classesCount: window.demo.classes.length,
                            classTeachersCount: classTeachers.length
                        });
                        window.demo.classes.forEach((cls, index) => {
                            // Only update if teacherIds is missing or empty (to avoid overwriting if already set)
                            if (!cls.teacherIds || cls.teacherIds.length === 0) {
                                const teacherIds = classTeachers
                                    .filter(ct => ct.class_id === cls.id || ct.classId === cls.id)
                                    .map(ct => ct.teacher_id || ct.teacherId)
                                    .filter(Boolean);
                                
                                // Build customTeacherAllowances from classTeachers table (active teachers)
                                const customTeacherAllowances = {};
                                classTeachers
                                    .filter(ct => (ct.class_id === cls.id || ct.classId === cls.id) && (ct.custom_allowance || ct.customAllowance))
                                    .forEach(ct => {
                                        const teacherId = ct.teacher_id || ct.teacherId;
                                        if (teacherId) {
                                            const allowance = ct.custom_allowance || ct.customAllowance;
                                            if (allowance !== null && allowance !== undefined) {
                                                customTeacherAllowances[teacherId] = allowance;
                                            }
                                        }
                                    });
                                
                                // Merge with existing customTeacherAllowances from classes (preserves inactive teachers)
                                if (cls.customTeacherAllowances && typeof cls.customTeacherAllowances === 'object') {
                                    Object.keys(cls.customTeacherAllowances).forEach(teacherId => {
                                        if (cls.customTeacherAllowances[teacherId] !== null && 
                                            cls.customTeacherAllowances[teacherId] !== undefined) {
                                            if (!customTeacherAllowances.hasOwnProperty(teacherId)) {
                                                customTeacherAllowances[teacherId] = cls.customTeacherAllowances[teacherId];
                                            }
                                        }
                                    });
                                }
                                
                                // Modify in-place to avoid changing array reference
                                cls.teacherIds = teacherIds.length > 0 ? teacherIds : (cls.teacherId ? [cls.teacherId] : []);
                                cls.customTeacherAllowances = customTeacherAllowances;
                                hasChanges = true;
                            }
                        });
                        // Only log if we actually made changes
                        if (hasChanges) {
                            const conversionDuration = Date.now() - conversionStartTime;
                            console.log(`[UniData:Cache] Converted classTeachers → teacherIds for cached classes (IndexedDB) (${conversionDuration}ms)`);
                        } else {
                            console.log(`[UniData:Cache] No conversion needed - all classes already have teacherIds (IndexedDB)`);
                        }
                    } else {
                        console.log(`[UniData:Cache] Skipping conversion - missing classes or classTeachers array (IndexedDB)`);
                    }
                    
                    // Hide spinner when cache loaded
                    hideSpinnerIfLoaded();
                    return true;
                }
            } catch (e) {
                console.warn('[UniData] Failed to load from IndexedDB:', e);
            }
        } else {
            console.log(`[UniData:Cache] DatabaseAdapter not available or load method missing`);
        }
    } catch (error) {
        console.warn('[UniData] Failed to load from cache:', error);
    }
    
    console.log(`[UniData:Cache] loadPageDataFromCache() returning false - no cache found`, {
        timestamp: Date.now(),
        finalWindowDemoState: window.demo ? {
            hasData: Object.keys(window.demo).length > 0,
            keys: Object.keys(window.demo),
            hasClasses: Array.isArray(window.demo.classes),
            hasClassTeachers: Array.isArray(window.demo.classTeachers)
        } : 'window.demo is null/undefined'
    });
    return false;
}

// Data snapshot storage for comparison
const pageDataSnapshots = new Map();

// Create a snapshot of relevant data for a page
// Uses a simple hash based on data length and IDs to detect changes
function snapshotPageData(pageKey, requiredKeys = null) {
    // Default required keys if not provided
    if (!requiredKeys) {
        requiredKeys = [
            'students', 'teachers', 'classes', 'sessions', 'attendance',
            'payments', 'walletTransactions', 'payroll', 'costs', 'bonuses',
            'studentClasses', 'lessonOutputs', 'lessonResources', 'lessonTasks', 'lessonTopics'
        ];
    }
    
    const snapshot = {};
    requiredKeys.forEach(key => {
        const data = window.demo?.[key];
        if (Array.isArray(data)) {
            // Special handling for class-detail pages: only snapshot sessions related to the class
            if (key === 'sessions' && pageKey.startsWith('class-detail-')) {
                const classId = pageKey.replace('class-detail-', '');
                const classSessions = data.filter(s => s.classId === classId);
                const ids = classSessions.slice(0, 10).map(item => item?.id || '').join(',');
                snapshot[key] = `${classSessions.length}:${ids}`;
            } else if (key === 'classes' && pageKey.startsWith('class-detail-')) {
                // Special handling for classes: only snapshot the specific class to avoid false positives
                const classId = pageKey.replace('class-detail-', '');
                const cls = data.find(c => c.id === classId);
                if (cls) {
                    // Snapshot only relevant fields that affect teachers display
                    const teacherIds = Array.isArray(cls.teacherIds) ? cls.teacherIds.sort().join(',') : (cls.teacherId || '');
                    snapshot[key] = `${cls.id}:${teacherIds}`;
                } else {
                    const ids = data.slice(0, 10).map(item => item?.id || '').join(',');
                    snapshot[key] = `${data.length}:${ids}`;
                }
            } else {
            // Create a simple hash: length + first few IDs (for change detection)
            const ids = data.slice(0, 10).map(item => item?.id || '').join(',');
            snapshot[key] = `${data.length}:${ids}`;
            }
        } else if (data !== null && data !== undefined) {
            // For non-array data, use JSON string (limited length)
            const str = JSON.stringify(data).substring(0, 100);
            snapshot[key] = str;
        }
    });
    return JSON.stringify(snapshot);
}

// Check if data has changed for a page
function hasPageDataChanged(pageKey, requiredKeys = null) {
    const current = snapshotPageData(pageKey, requiredKeys);
    const previous = pageDataSnapshots.get(pageKey);
    
    // [DEBUG] Log snapshot comparison for class-detail pages
    if (pageKey.startsWith('class-detail-')) {
        const currentParsed = current ? JSON.parse(current) : {};
        const previousParsed = previous ? JSON.parse(previous) : {};
        console.log(`[UniData:Snapshot] Page ${pageKey} - Snapshot comparison:`, {
            timestamp: Date.now(),
            hasPrevious: !!previous,
            currentSnapshot: currentParsed,
            previousSnapshot: previousParsed,
            changed: current !== previous,
            classesChanged: currentParsed.classes !== previousParsed.classes,
            teachersChanged: currentParsed.teachers !== previousParsed.teachers,
            classTeachersChanged: currentParsed.classTeachers !== previousParsed.classTeachers,
            sessionsChanged: currentParsed.sessions !== previousParsed.sessions
        });
    }
    
    if (!previous) {
        pageDataSnapshots.set(pageKey, current);
        return true; // First render - always render on first load
    }
    if (current !== previous) {
        pageDataSnapshots.set(pageKey, current);
        return true; // Data changed
    }
    return false; // No change - don't re-render
}

// Page refresh handlers storage
const pageRefreshHandlers = new Map();

// Initialize event listeners for a page
function initPageListeners(pageKey, refreshCallback, requiredKeys = null) {
    if (pageRefreshHandlers.has(pageKey)) {
        return; // Already initialized
    }
    
    const handler = (event) => {
        const source = event?.detail?.source || '';
        
        // [DEBUG] Log event received
        if (pageKey.startsWith('class-detail-')) {
            console.log(`[UniData:Event] Page ${pageKey} - Event received:`, {
                timestamp: Date.now(),
                source,
                eventType: event.type,
                willProcess: source === 'supabase-full' || source === 'supabase-initial'
            });
        }
        
        // Only refresh when we get full dataset from Supabase
        if (source === 'supabase-full' || source === 'supabase-initial') {
            // Check if data actually changed
            const dataChanged = hasPageDataChanged(pageKey, requiredKeys);
            
            // [DEBUG] Log change detection result
            if (pageKey.startsWith('class-detail-')) {
                console.log(`[UniData:Event] Page ${pageKey} - Data changed check:`, {
                    timestamp: Date.now(),
                    dataChanged,
                    source,
                    willRender: dataChanged
                });
            }
            
            if (dataChanged) {
                // Mark that there's a pending data change for this page
                window.__pendingDataChange = true;
                
                // [DEBUG] Log pending state
                if (pageKey.startsWith('class-detail-')) {
                    console.log(`[UniData:Event] Page ${pageKey} - Setting __pendingDataChange = true, scheduling render in 100ms`);
                }
                
                // Debounce to avoid multiple rapid renders
                const timeoutKey = `__pageRefreshTimeout_${pageKey}`;
                if (window[timeoutKey]) {
                    clearTimeout(window[timeoutKey]);
                }
                window[timeoutKey] = setTimeout(() => {
                    // [DEBUG] Log render execution
                    if (pageKey.startsWith('class-detail-')) {
                        console.log(`[UniData:Event] Page ${pageKey} - Executing render callback now`);
                    }
                    if (typeof refreshCallback === 'function') {
                        refreshCallback();
                    }
                    window[timeoutKey] = null;
                }, 100);
            } else {
                // Data hasn't changed -> don't render, just re-attach events if needed
                console.log(`[UniData] Page ${pageKey}: Data unchanged, skipping render`);
            }
        }
    };
    
    window.addEventListener('UniData:updated', handler);
    window.addEventListener('UniData:dataset-applied', handler);
    
    pageRefreshHandlers.set(pageKey, handler);
}

// Cleanup event listeners for a page
function cleanupPageListeners(pageKey) {
    const handler = pageRefreshHandlers.get(pageKey);
    if (handler) {
        window.removeEventListener('UniData:updated', handler);
        window.removeEventListener('UniData:dataset-applied', handler);
        pageRefreshHandlers.delete(pageKey);
    }
}

// Skeleton loading HTML generator
function generateSkeletonLoading(pageKey = 'default') {
    const skeletons = {
        dashboard: `
            <div class="card">
                <div class="skeleton skeleton-title" style="width: 200px; height: 24px; margin-bottom: 16px;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; height: 60px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; height: 60px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-text" style="width: 80%; height: 60px;"></div>
            </div>
        `,
        default: `
            <div class="card">
                <div class="skeleton skeleton-title" style="width: 150px; height: 24px; margin-bottom: 16px;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; height: 40px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-text" style="width: 90%; height: 40px; margin-bottom: 12px;"></div>
                <div class="skeleton skeleton-text" style="width: 75%; height: 40px;"></div>
            </div>
        `
    };
    
    const skeleton = skeletons[pageKey] || skeletons.default;
    return `
        <div class="data-loading-indicator">
            <div class="loading-badge">
                <span class="loading-spinner-small"></span>
                <span>Đang kiểm tra dữ liệu...</span>
            </div>
        </div>
        ${skeleton}
    `;
}

// Wrapper to add optimistic loading to any render function
function withOptimisticPageRender(renderFn, pageKey, requiredKeys = null) {
    return async function(...args) {
        // Initialize listeners on first render
        initPageListeners(pageKey, () => renderFn.apply(this, args), requiredKeys);
        
        const main = document.querySelector('#main-content');
        
        // Optimistic loading: try to load from cache immediately when F5
        if (!window.demo || Object.keys(window.demo).length === 0) {
            console.log(`[UniData] Page ${pageKey}: Loading from cache for immediate render...`);
            
            // Show skeleton loading while checking cache
            if (main) {
                main.innerHTML = generateSkeletonLoading(pageKey);
            }
            
            const loaded = await loadPageDataFromCache();
            if (loaded) {
                // Data loaded from cache, render immediately with cached data
                console.log(`[UniData] Page ${pageKey}: Rendered with cached data`);
                
                // Hide spinner when cache loaded
                hideSpinnerIfLoaded();
                
                // Update snapshot BEFORE rendering so we can compare later
                hasPageDataChanged(pageKey, requiredKeys);
                
                // Render immediately with cached data
                setTimeout(() => {
                    renderFn.apply(this, args);
                    // Show badge that we're checking for updates (only if spinner is hidden)
                    if (main) {
                        const spinner = document.getElementById('appBootSkeleton');
                        if (spinner && spinner.dataset.state === 'hidden') {
                            const badge = document.createElement('div');
                            badge.className = 'data-sync-badge';
                            badge.innerHTML = '<span class="sync-icon">🔄</span> Đang kiểm tra cập nhật...';
                            document.body.appendChild(badge);
                            
                            // Remove badge after 3 seconds or when data updates
                            setTimeout(() => {
                                if (badge.parentNode) {
                                    badge.style.opacity = '0';
                                    badge.style.transition = 'opacity 0.3s';
                                    setTimeout(() => badge.remove(), 300);
                                }
                            }, 3000);
                        }
                    }
                }, 10);
                return;
            } else {
                // No cache available, show loading and wait for DB
                console.log(`[UniData] Page ${pageKey}: No cache, waiting for DB...`);
                if (main) {
                    main.innerHTML = `
                        <div class="card">
                            <div class="text-center" style="padding: 40px;">
                                <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
                                <p class="text-muted">Đang tải dữ liệu từ máy chủ...</p>
                            </div>
                        </div>
                    `;
                }
                // Wait a bit for DB to load, then render
                setTimeout(() => {
                    hasPageDataChanged(pageKey, requiredKeys);
                    renderFn.apply(this, args);
                }, 120);
                return;
            }
        }
        
        // Render with existing data (already loaded from cache or DB)
        await renderFn.apply(this, args);
        
        // Update snapshot after rendering so we can compare on next data update
        hasPageDataChanged(pageKey, requiredKeys);
    };
}

// Export helpers to window.UniData for global access
if (!window.UniData) window.UniData = {};
window.UniData.loadPageDataFromCache = loadPageDataFromCache;
window.UniData.snapshotPageData = snapshotPageData;
window.UniData.hasPageDataChanged = hasPageDataChanged;
window.UniData.initPageListeners = initPageListeners;
window.UniData.cleanupPageListeners = cleanupPageListeners;

/**
 * Check if cache has teachers data
 * Checks multiple sources: window.demo (in-memory), localStorage, IndexedDB
 * @returns {Object} Cache status information
 */
window.UniData.checkCacheStatus = function() {
    const result = {
        source: 'none',
        hasCache: false,
        teachers: { exists: false, count: 0, isArray: false },
        classTeachers: { exists: false, count: 0, isArray: false },
        classes: { exists: false, count: 0, isArray: false },
        classesWithTeacherIds: 0,
        timestamp: null,
        timestampAge: null
    };
    
    // Priority 1: Check window.demo (in-memory, already loaded)
    if (window.demo && typeof window.demo === 'object' && Object.keys(window.demo).length > 0) {
        const teachers = window.demo.teachers;
        const classTeachers = window.demo.classTeachers;
        const classes = window.demo.classes;
        
        result.source = 'memory';
        result.hasCache = true;
        result.teachers = {
            exists: teachers !== undefined && teachers !== null,
            count: Array.isArray(teachers) ? teachers.length : 0,
            isArray: Array.isArray(teachers),
            sample: Array.isArray(teachers) && teachers.length > 0 ? {
                id: teachers[0].id,
                fullName: teachers[0].fullName
            } : null
        };
        result.classTeachers = {
            exists: classTeachers !== undefined && classTeachers !== null,
            count: Array.isArray(classTeachers) ? classTeachers.length : 0,
            isArray: Array.isArray(classTeachers),
            sample: Array.isArray(classTeachers) && classTeachers.length > 0 ? {
                id: classTeachers[0].id,
                class_id: classTeachers[0].class_id || classTeachers[0].classId,
                teacher_id: classTeachers[0].teacher_id || classTeachers[0].teacherId
            } : null
        };
        const classesWithTeacherIdsCount = Array.isArray(classes) ? classes.filter(c => c.teacherIds && Array.isArray(c.teacherIds) && c.teacherIds.length > 0).length : 0;
        result.classes = {
            exists: classes !== undefined && classes !== null,
            count: Array.isArray(classes) ? classes.length : 0,
            isArray: Array.isArray(classes),
            classesWithTeacherIds: classesWithTeacherIdsCount,
            sample: Array.isArray(classes) && classes.length > 0 ? {
                id: classes[0].id,
                name: classes[0].name,
                hasTeacherIds: !!(classes[0].teacherIds && Array.isArray(classes[0].teacherIds) && classes[0].teacherIds.length > 0),
                teacherIds: classes[0].teacherIds || []
            } : null
        };
        result.classesWithTeacherIds = classesWithTeacherIdsCount; // Sync top-level property
        return result;
    }
    
    // Priority 2: Check localStorage (may be blocked in PROD mode)
    try {
        const stored = localStorage.getItem('unicorns.data');
        if (stored) {
            const parsed = JSON.parse(stored);
            const teachers = parsed.teachers;
            const classTeachers = parsed.classTeachers;
            const classes = parsed.classes;
            
            result.source = 'localStorage';
            result.hasCache = true;
            result.teachers = {
                exists: teachers !== undefined && teachers !== null,
                count: Array.isArray(teachers) ? teachers.length : 0,
                isArray: Array.isArray(teachers),
                sample: Array.isArray(teachers) && teachers.length > 0 ? {
                    id: teachers[0].id,
                    fullName: teachers[0].fullName
                } : null
            };
            result.classTeachers = {
                exists: classTeachers !== undefined && classTeachers !== null,
                count: Array.isArray(classTeachers) ? classTeachers.length : 0,
                isArray: Array.isArray(classTeachers),
                sample: Array.isArray(classTeachers) && classTeachers.length > 0 ? {
                    id: classTeachers[0].id,
                    class_id: classTeachers[0].class_id || classTeachers[0].classId,
                    teacher_id: classTeachers[0].teacher_id || classTeachers[0].teacherId
                } : null
            };
            const classesWithTeacherIdsCount = Array.isArray(classes) ? classes.filter(c => c.teacherIds && Array.isArray(c.teacherIds) && c.teacherIds.length > 0).length : 0;
            result.classes = {
                exists: classes !== undefined && classes !== null,
                count: Array.isArray(classes) ? classes.length : 0,
                isArray: Array.isArray(classes),
                classesWithTeacherIds: classesWithTeacherIdsCount,
                sample: Array.isArray(classes) && classes.length > 0 ? {
                    id: classes[0].id,
                    name: classes[0].name,
                    hasTeacherIds: !!(classes[0].teacherIds && Array.isArray(classes[0].teacherIds) && classes[0].teacherIds.length > 0),
                    teacherIds: classes[0].teacherIds || []
                } : null
            };
            result.classesWithTeacherIds = classesWithTeacherIdsCount; // Sync top-level property
            const timestamp = localStorage.getItem('unicorns.data.timestamp');
            result.timestamp = timestamp;
            result.timestampAge = timestamp ? Math.round((Date.now() - parseInt(timestamp)) / 1000) : null;
            return result;
        }
    } catch (e) {
        // localStorage may be blocked in PROD mode
        result.localStorageError = e.message;
    }
    
    // Priority 3: Check IndexedDB (async, but we return what we have)
    // Note: IndexedDB check would be async, so we return the result we have so far
    // User can check IndexedDB separately if needed
    
    return result;
};
window.UniData.withOptimisticPageRender = withOptimisticPageRender;
window.UniData.hideSpinnerIfLoaded = hideSpinnerIfLoaded;