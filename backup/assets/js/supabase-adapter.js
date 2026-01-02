/**
 * supabase-adapter.js - Supabase client adapter for Unicorns Edu
 * 
 * This adapter connects the app to Supabase PostgreSQL database
 * It works alongside IndexedDB/localStorage for offline support
 */

(function() {
    'use strict';

    // Check if Supabase is configured
    const config = window.SUPABASE_CONFIG || {};
    const isEnabled = config.enabled === true && config.url && config.anonKey;

    if (!isEnabled) {
        console.log('Supabase is not enabled. Using local storage.');
        window.SupabaseAdapter = {
            isEnabled: false,
            init: () => Promise.resolve(false),
            save: () => Promise.resolve(false),
            load: () => Promise.resolve(null),
            sync: () => Promise.resolve(false),
            testConnection: () => Promise.resolve(false),
            subscribeToChanges: () => () => {},
            normalizeRow: (_table, row) => row
        };
        return;
    }

    // Load Supabase client library
    let supabase = null;
    let realtimeChannel = null;
    const realtimeListeners = new Set();
    const REQUIRED_SUPABASE_COLUMNS = {
        classes: [
            {
                column: 'student_tuition_per_session',
                sql: 'alter table "classes" add column "student_tuition_per_session" numeric default 0;',
                description: 'Đơn giá mỗi buổi mặc định cho học sinh'
            },
            {
                column: 'tuition_package_total',
                sql: 'alter table "classes" add column "tuition_package_total" numeric default 0;',
                description: 'Tổng học phí mặc định của gói'
            },
            {
                column: 'tuition_package_sessions',
                sql: 'alter table "classes" add column "tuition_package_sessions" numeric default 0;',
                description: 'Số buổi của gói học phí mặc định'
            },
            {
                column: 'scale_amount',
                sql: 'alter table "classes" add column "scale_amount" numeric default 0;',
                description: 'Tiền scale cộng thêm cho mỗi buổi học'
            }
        ],
        sessions: [
            {
                column: 'allowance_amount',
                sql: 'alter table "sessions" add column "allowance_amount" numeric default 0;',
                description: 'Tổng trợ cấp đã tính của buổi học'
            }
        ],
        students: [
            {
                column: 'loan_balance',
                sql: 'alter table "students" add column "loan_balance" numeric default 0;',
                description: 'Số tiền học sinh đã vay cần hoàn trả'
            }
        ],
        payments: [
            {
                column: 'note',
                sql: 'alter table "payments" add column "note" text;',
                description: 'Ghi chú giao dịch (ví dụ lý do hoàn trả)'
            }
        ],
        teachers: [
            {
                column: 'user_id',
                sql: 'alter table "teachers" add column "user_id" uuid;',
                description: 'Liên kết giáo viên với tài khoản Supabase Auth'
            }
        ],
        wallet_transactions: [
            {
                column: 'student_id',
                sql: 'alter table "wallet_transactions" add column "student_id" text references "students"(id) on delete cascade;',
                description: 'Liên kết giao dịch với học sinh'
            },
            {
                column: 'type',
                sql: 'alter table "wallet_transactions" add column "type" text;',
                description: 'Loại giao dịch (topup/advance/repayment)'
            },
            {
                column: 'amount',
                sql: 'alter table "wallet_transactions" add column "amount" numeric default 0;',
                description: 'Giá trị giao dịch'
            },
            {
                column: 'date',
                sql: 'alter table "wallet_transactions" add column "date" date default now();',
                description: 'Ngày giao dịch'
            },
            {
                column: 'note',
                sql: 'alter table "wallet_transactions" add column "note" text;',
                description: 'Ghi chú giao dịch'
            }
        ],
        home_posts: [
            {
                column: 'attachments',
                sql: 'alter table "home_posts" add column "attachments" jsonb default \'[]\'::jsonb;',
                description: 'Danh sách tệp đính kèm'
            },
            {
                column: 'tags',
                sql: 'alter table "home_posts" add column "tags" jsonb default \'[]\'::jsonb;',
                description: 'Danh sách thẻ bài viết'
            }
        ]
    };

    function notifyRealtimeListeners(payload) {
        realtimeListeners.forEach(fn => {
            try { fn(payload); } catch (err) { console.error('Realtime listener error:', err); }
        });
    }

    function notifyMissingColumns(missingColumns) {
        if (!Array.isArray(missingColumns) || missingColumns.length === 0) return;
        const instructions = missingColumns.map(item => {
            return `• Bảng "${item.table}" thiếu cột "${item.column}" (${item.description}).\n  ➜ Chạy SQL:\n    ${item.sql}`;
        }).join('\n\n');
        console.warn('[UniEdu] Supabase schema thiếu cột:\n' + instructions);
        if (window && window.UniUI && typeof window.UniUI.toast === 'function') {
            window.UniUI.toast('Thiếu cột mới trên Supabase. Mở console để xem hướng dẫn tạo.', 'warning', 8000);
        }
        if (typeof window !== 'undefined') {
            window.UniDev = window.UniDev || {};
            window.UniDev.missingSupabaseColumns = missingColumns;
        }
    }

    const ensureRealtimeChannel = async () => {
        if (realtimeChannel) return realtimeChannel;
        if (!supabase) {
            await loadSupabase();
        }
        if (!supabase) return null;

        realtimeChannel = supabase.channel('unicorns-realtime');
        realtimeChannel.on('postgres_changes', { event: '*', schema: 'public' }, payload => {
            if (payload) {
                console.log(`🔄 Supabase change detected: ${payload.eventType} on ${payload.table}`);
            }
            notifyRealtimeListeners(payload);
        });
        realtimeChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Supabase realtime subscribed');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('Supabase realtime channel error');
            }
        });
        return realtimeChannel;
    };

    const teardownRealtimeChannelIfIdle = async () => {
        if (realtimeChannel && realtimeListeners.size === 0 && supabase) {
            try {
                await supabase.removeChannel(realtimeChannel);
            } catch (err) {
                console.warn('Failed to remove Supabase realtime channel', err);
            }
            realtimeChannel = null;
        }
    };

    const loadSupabase = () => {
        return new Promise((resolve, reject) => {
            if (window.supabase) {
                supabase = window.supabase.createClient(config.url, config.anonKey);
                resolve(true);
                return;
            }

            // Dynamically load Supabase JS library
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
            script.onload = () => {
                supabase = window.supabase.createClient(config.url, config.anonKey);
                console.log('Supabase client loaded');
                resolve(true);
            };
            script.onerror = () => {
                console.error('Failed to load Supabase library');
                reject(new Error('Failed to load Supabase'));
            };
            document.head.appendChild(script);
        });
    };

    function nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function logDuration(label, startedAt) {
        if (!label) return;
        try {
            const elapsed = nowMs() - startedAt;
            const display = Number.isFinite(elapsed) ? `${elapsed.toFixed(1)}ms` : 'n/a';
            console.log(`${label} completed in ${display}`);
        } catch (err) {
            console.log(label);
        }
    }

    /**
     * Convert camelCase to snake_case
     */
    function toSnakeCase(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

function isValidUuid(value) {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

    /**
     * Convert object keys from camelCase to snake_case
     */
    function generateClientUuid() {
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

    function convertKeysToSnakeCase(obj, mapping) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => convertKeysToSnakeCase(item, mapping));
        
        // If mapping is undefined, use default snake_case conversion
        if (!mapping || typeof mapping !== 'object') {
            const converted = {};
            for (const [key, value] of Object.entries(obj)) {
                if (value === null || value === undefined) continue;
                converted[toSnakeCase(key)] = value;
            }
            return converted;
        }
        
        const converted = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip null/undefined values
            if (value === null || value === undefined) continue;
            
            const newKey = mapping[key] || toSnakeCase(key);
            // Handle nested objects (like schedule, customTeacherAllowances)
            if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                converted[newKey] = value; // Keep JSONB objects as is
            } else {
                converted[newKey] = convertKeysToSnakeCase(value, mapping);
            }
        }
        return converted;
    }

    /**
     * Convert snake_case back to camelCase
     */
    function toCamelCase(str) {
        return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    /**
     * Convert object keys from snake_case to camelCase
     */
    function convertKeysToCamelCase(obj, mapping) {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => convertKeysToCamelCase(item, mapping));
        
        const converted = {};
        // Reverse mapping
        const reverseMapping = {};
        if (mapping) {
            for (const [camel, snake] of Object.entries(mapping)) {
                reverseMapping[snake] = camel;
            }
        }
        
        for (const [key, value] of Object.entries(obj)) {
            const newKey = reverseMapping[key] || toCamelCase(key);
            if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                converted[newKey] = value; // Keep JSONB objects as is
            } else {
                converted[newKey] = convertKeysToCamelCase(value, mapping);
            }
        }
        return converted;
    }

    const ENTITY_FIELD_MAPPINGS = {
        users: {
            linkId: 'link_id',
            accountHandle: 'account_handle',
            assistantType: 'assistant_type',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        teachers: {
            fullName: 'full_name',
            bankAccount: 'bank_account',
            bankQRLink: 'bank_qr_link',
            photoUrl: 'photo_url',
            birthDate: 'birth_date',
            highSchool: 'high_school',
            gmail: 'email',
            customTeacherAllowances: 'custom_teacher_allowances',
            userId: 'user_id',
            roles: 'roles' // JSON array of staff roles
        },
        students: {
            fullName: 'full_name',
            parentName: 'parent_name',
            parentPhone: 'parent_phone',
            classId: 'class_id',
            lastAttendance: 'last_attendance',
            birthYear: 'birth_year',
            walletBalance: 'wallet_balance',
            loanBalance: 'loan_balance',
            cskhStaffId: 'cskh_staff_id'
        },
        classes: {
            maxStudents: 'max_students',
            tuitionPerSession: 'tuition_per_session',
            studentTuitionPerSession: 'student_tuition_per_session',
            tuitionPackageTotal: 'tuition_package_total',
            tuitionPackageSessions: 'tuition_package_sessions',
            scaleAmount: 'scale_amount',
            customTeacherAllowances: 'custom_teacher_allowances'
        },
        sessions: {
            classId: 'class_id',
            teacherId: 'teacher_id',
            startTime: 'start_time',
            endTime: 'end_time',
            paymentStatus: 'payment_status',
            studentPaidCount: 'student_paid_count',
            studentTotalStudents: 'student_total_students',
            allowanceAmount: 'allowance_amount'
        },
        attendance: {
            sessionId: 'session_id',
            studentId: 'student_id'
        },
        studentClasses: {
            studentId: 'student_id',
            classId: 'class_id',
            startDate: 'start_date',
            totalPurchasedSessions: 'total_purchased_sessions',
            remainingSessions: 'remaining_sessions',
            totalAttendedSessions: 'total_attended_sessions',
            unpaidSessions: 'unpaid_sessions',
            totalPaidAmount: 'total_paid_amount'
        },
        payments: {
            studentId: 'student_id',
            classId: 'class_id'
        },
        payroll: {
            teacherId: 'teacher_id',
            totalHours: 'total_hours',
            totalSessions: 'total_sessions',
            baseRate: 'base_rate',
            totalPay: 'total_pay'
        },
        revenue: {
            classId: 'class_id',
            enrolledCount: 'enrolled_count',
            tuitionPerStudent: 'tuition_per_student',
            totalRevenue: 'total_revenue'
        },
        walletTransactions: {
            studentId: 'student_id',
            type: 'type',
            amount: 'amount',
            note: 'note',
            date: 'date',
            createdAt: 'created_at'
        },
        homePosts: {
            category: 'category',
            title: 'title',
            content: 'content',
            attachments: 'attachments',
            tags: 'tags',
            badge: 'badge',
            authorId: 'author_id',
            authorName: 'author_name',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        classTeachers: {
            classId: 'class_id',
            teacherId: 'teacher_id',
            customAllowance: 'custom_allowance'
        },
        documents: {
            title: 'title',
            description: 'description',
            fileUrl: 'file_url',
            tags: 'tags',
            uploadedBy: 'uploaded_by',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        lessonResources: {
            resourceLink: 'resource_link',
            createdBy: 'created_by',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        lessonTasks: {
            assistantId: 'assistant_id',
            dueDate: 'due_date',
            createdBy: 'created_by',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        lessonOutputs: {
            lessonName: 'lesson_name',
            originalTitle: 'original_title',
            contestUploaded: 'contest_uploaded',
            completedBy: 'completed_by',
            assistantId: 'assistant_id',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        lessonTopics: {
            isDefault: 'is_default',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        lessonTopicLinks: {
            topicId: 'topic_id',
            lessonOutputId: 'lesson_output_id',
            orderIndex: 'order_index',
            createdAt: 'created_at'
        },
        bonuses: {
            staffId: 'staff_id',
            workType: 'work_type',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        },
        users: {
            linkId: 'link_id',
            accountHandle: 'account_handle',
            assistantType: 'assistant_type',
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    };

    const SUPABASE_TABLE_TO_ENTITY = {
        teachers: 'teachers',
        students: 'students',
        classes: 'classes',
        sessions: 'sessions',
        attendance: 'attendance',
        payments: 'payments',
        payroll: 'payroll',
        revenue: 'revenue',
        wallet_transactions: 'walletTransactions',
        home_posts: 'homePosts',
        costs: {
            date: 'date',
            month: 'month',
            category: 'category',
            amount: 'amount',
            status: 'status'
        },
        categories: null,
        student_classes: 'studentClasses',
        class_teachers: 'classTeachers',
        documents: 'documents',
        lesson_plans: 'lessonPlans',
        lesson_resources: 'lessonResources',
        lesson_tasks: 'lessonTasks',
        lesson_outputs: 'lessonOutputs',
        lesson_topics: 'lessonTopics',
        lesson_topic_links: 'lessonTopicLinks',
        bonuses: 'bonuses',
        users: 'users'
    };

    function normalizeSupabaseRow(tableName, row) {
        if (!row || typeof row !== 'object') return row;
        const entityKey = SUPABASE_TABLE_TO_ENTITY[tableName] || null;
        const mapping = entityKey ? ENTITY_FIELD_MAPPINGS[entityKey] : null;
        let converted = convertKeysToCamelCase(row, mapping);
        if (!converted || typeof converted !== 'object') {
            converted = { ...row };
        }
        if (tableName === 'teachers' && row.email && !converted.gmail) {
            converted.gmail = row.email;
        }
        if (tableName === 'students' && row.email && !converted.gmail) {
            converted.gmail = row.email;
        }
        // IMPORTANT: class_id is not stored in database (to avoid foreign key issues with array)
        // It will be synced from studentClasses when loading data
        // Set to null initially, will be populated by syncStudentClassId after loading
        if (tableName === 'students') {
            converted.classId = null;
        }
        if (!converted.id && row.id !== undefined) {
            converted.id = row.id;
        }
        if (tableName === 'class_teachers' && !converted.id) {
            converted.id = `CT_${row.class_id}_${row.teacher_id}`;
        }
        if (tableName === 'categories') {
            converted = {
                id: converted.id ?? row.id ?? null,
                name: (converted.name ?? converted.value ?? row.name ?? '').trim()
            };
        }
        return converted;
    }

    function cleanSupabaseEntity(entity) {
        const cleaned = { ...entity };
        for (const key in cleaned) {
            if ((key.includes('date') || key.includes('_at') || key.includes('time')) && cleaned[key] === '') {
                cleaned[key] = null;
            }
            if (cleaned[key] === undefined) {
                delete cleaned[key];
            }
        }
        return cleaned;
    }

    function formatPartialForSupabase(entityType, items) {
        if (!items || items.length === 0) return [];

        switch (entityType) {
            case 'teachers':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.teachers);
                    if (item.gmail && !converted.email) {
                        converted.email = item.gmail;
                    }
                    if (converted.birth_date === '' || converted.birth_date === null) {
                        converted.birth_date = null;
                    }
                    if (converted.user_id && !isValidUuid(converted.user_id)) {
                        delete converted.user_id;
                    }
                    // IMPORTANT: Remove accountHandle and accountPassword from teachers table
                    // These fields should only be stored in users table, not in teachers table
                    delete converted.account_handle;
                    delete converted.account_password;
                    return cleanSupabaseEntity(converted);
                });
            case 'students':
                return items.map(item => {
                    // IMPORTANT: Remove classId BEFORE converting to snake_case to ensure it's never sent to DB
                    // class_id is denormalized data for quick queries in memory only
                    // The source of truth is the studentClasses table
                    // Setting to null to avoid foreign key constraint violations
                    // class_id will be synced from studentClasses when loading from DB
                    const itemWithoutClassId = { ...item };
                    delete itemWithoutClassId.classId;
                    
                    const converted = convertKeysToSnakeCase(itemWithoutClassId, ENTITY_FIELD_MAPPINGS.students);
                    if (item.gmail && !converted.email) {
                        converted.email = item.gmail;
                    }
                    if (converted.last_attendance === '' || converted.last_attendance === null) {
                        converted.last_attendance = null;
                    }
                    // Double-check: ensure class_id is not present (defensive programming)
                    if ('class_id' in converted) {
                        delete converted.class_id;
                    }
                    // IMPORTANT: Remove accountHandle and accountPassword from students table
                    // These fields should only be stored in users table, not in students table
                    delete converted.account_handle;
                    delete converted.account_password;
                    return cleanSupabaseEntity(converted);
                });
            case 'classes':
                return items.map(item => {
                    // Debug: Log customTeacherAllowances before conversion
                    if (item.customTeacherAllowances) {
                        console.log(`[toSupabaseFormat] Class ${item.id} customTeacherAllowances BEFORE conversion:`, JSON.stringify(item.customTeacherAllowances));
                    }
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.classes);
                    delete converted.teacher_ids;
                    delete converted.teacher_id;
                    // Debug: Log custom_teacher_allowances after conversion
                    if (converted.custom_teacher_allowances) {
                        console.log(`[toSupabaseFormat] Class ${item.id} custom_teacher_allowances AFTER conversion:`, JSON.stringify(converted.custom_teacher_allowances));
                    } else {
                        console.warn(`[toSupabaseFormat] ⚠️ Class ${item.id} custom_teacher_allowances is MISSING after conversion! Original:`, JSON.stringify(item.customTeacherAllowances));
                    }
                    return cleanSupabaseEntity(converted);
                });
            case 'classTeachers':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.classTeachers);
                    return cleanSupabaseEntity(converted);
                });
            case 'studentClasses':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.studentClasses);
                    return cleanSupabaseEntity(converted);
                });
            case 'sessions':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.sessions);
                    return cleanSupabaseEntity(converted);
                });
            case 'attendance':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.attendance);
                    return cleanSupabaseEntity(converted);
                });
            case 'payments':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.payments);
                    return cleanSupabaseEntity(converted);
                });
            case 'payroll':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.payroll);
                    return cleanSupabaseEntity(converted);
                });
            case 'revenue':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.revenue);
                    return cleanSupabaseEntity(converted);
                });
            case 'costs':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, {})));
            case 'users':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.users);
                    // Users table uses UUID for id, but we may have generated a TEXT id
                    // If id is not a valid UUID, let Supabase generate it (remove id field)
                    if (converted.id && !isValidUuid(converted.id)) {
                        // For existing users, try to find by email instead
                        // Remove id and let upsert handle by email (onConflict: 'email')
                        delete converted.id;
                    }
                    return cleanSupabaseEntity(converted);
                });
            case 'walletTransactions':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.walletTransactions)));
            case 'homePosts':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.homePosts)));
            case 'documents':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.documents);
                    // Ensure tags is a JSON array
                    if (converted.tags && !Array.isArray(converted.tags)) {
                        converted.tags = typeof converted.tags === 'string' 
                            ? converted.tags.split(',').map(t => t.trim()).filter(Boolean)
                            : [];
                    }
                    return cleanSupabaseEntity(converted);
                });
            case 'lessonPlans':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.lessonPlans)));
            case 'lessonResources':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.lessonResources);
                    if (converted.tags && !Array.isArray(converted.tags)) {
                        converted.tags = typeof converted.tags === 'string' 
                            ? converted.tags.split(',').map(t => t.trim()).filter(Boolean)
                            : [];
                    }
                    return cleanSupabaseEntity(converted);
                });
            case 'lessonTasks':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.lessonTasks)));
            case 'lessonOutputs':
                return items.map(item => {
                    // Remove 'tags' field before converting (it's only used locally, not in Supabase)
                    const cleaned = { ...item };
                    if ('tags' in cleaned) {
                        delete cleaned.tags;
                    }
                    return cleanSupabaseEntity(convertKeysToSnakeCase(cleaned, ENTITY_FIELD_MAPPINGS.lessonOutputs));
                });
            case 'lessonTopics':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.lessonTopics)));
            case 'lessonTopicLinks':
                return items.map(item => {
                    const converted = convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.lessonTopicLinks);
                    // Ensure required fields exist
                    if (!converted.topic_id || !converted.lesson_output_id) {
                        console.warn('Invalid lessonTopicLink:', converted);
                        return null;
                    }
                    return cleanSupabaseEntity(converted);
                }).filter(Boolean);
            case 'bonuses':
                return items.map(item => cleanSupabaseEntity(convertKeysToSnakeCase(item, ENTITY_FIELD_MAPPINGS.bonuses)));
            case 'categories':
                return items.map(item => {
                    if (typeof item === 'object' && item !== null) {
                        const payload = {
                            name: item.name ?? item.value ?? item.label ?? ''
                        };
                        if (item.id !== undefined && item.id !== null) {
                            payload.id = item.id;
                        }
                        if (!payload.id && payload.id !== 0) {
                            delete payload.id;
                        }
                        return cleanSupabaseEntity(payload);
                    }
                    if (typeof item === 'string') {
                        return cleanSupabaseEntity({ name: item });
                    }
                    return null;
                }).filter(Boolean);
            default:
                return [];
        }
    }

    function dedupeEntitiesByConfig(entities, config) {
        if (!Array.isArray(entities) || !entities.length) return entities;
        const uniqueKeys = config?.uniqueKeys;
        if (!uniqueKeys || uniqueKeys.length === 0) {
            return entities;
        }
        const seen = new Map();
        const keyFromEntity = (entity) => uniqueKeys.map(k => (entity?.[k] ?? '')).join('__');
        for (const entity of entities) {
            const composite = keyFromEntity(entity);
            if (!seen.has(composite)) {
                seen.set(composite, entity);
            } else {
                seen.set(composite, { ...seen.get(composite), ...entity });
            }
        }
        return Array.from(seen.values());
    }

    /**
     * Convert local data structure to Supabase format
     */
    function toSupabaseFormat(localData) {
        // Convert teachers - handle gmail -> email mapping and empty dates
        const teachers = (localData.teachers || []).map(t => {
            const converted = convertKeysToSnakeCase(t, ENTITY_FIELD_MAPPINGS.teachers);
            // If gmail exists but email doesn't, use gmail as email
            if (t.gmail && !converted.email) {
                converted.email = t.gmail;
            }
            // Convert empty string dates to null
            if (converted.birth_date === '' || converted.birth_date === null) {
                converted.birth_date = null;
            }
            if (converted.user_id && !isValidUuid(converted.user_id)) {
                delete converted.user_id;
            }
            // IMPORTANT: Remove accountHandle and accountPassword from teachers table
            // These fields should only be stored in users table, not in teachers table
            delete converted.account_handle;
            delete converted.account_password;
            return converted;
        });

        // Convert classes - remove teacherIds (already extracted to classTeachers)
        const classes = (localData.classes || []).map(c => {
            const converted = convertKeysToSnakeCase(c, ENTITY_FIELD_MAPPINGS.classes);
            // Remove teacherIds and teacherId (not in schema, already in class_teachers table)
            delete converted.teacher_ids;
            delete converted.teacher_id;
            return converted;
        });

        // Convert categories - handle array format
        const categories = (localData.categories || []).map(cat => {
            if (typeof cat === 'object' && cat !== null) {
                const payload = {
                    name: cat.name ?? cat.value ?? cat.label ?? ''
                };
                if (cat.id !== undefined && cat.id !== null) {
                    payload.id = cat.id;
                }
                if (!payload.id && payload.id !== 0) {
                    delete payload.id;
                }
                return cleanSupabaseEntity(payload);
            }
            if (typeof cat === 'string') {
                return cleanSupabaseEntity({ name: cat });
            }
            return null;
        }).filter(Boolean);

        return {
            categories: categories,
            teachers: teachers,
            students: (localData.students || []).map(s => {
                const converted = convertKeysToSnakeCase(s, ENTITY_FIELD_MAPPINGS.students);
                // Convert empty string dates to null
                if (converted.last_attendance === '' || converted.last_attendance === null) {
                    converted.last_attendance = null;
                }
                // IMPORTANT: Remove accountHandle and accountPassword from students table
                // These fields should only be stored in users table, not in students table
                delete converted.account_handle;
                delete converted.account_password;
                return converted;
            }),
            classes: classes,
            sessions: (localData.sessions || []).map(s => convertKeysToSnakeCase(s, ENTITY_FIELD_MAPPINGS.sessions)),
            attendance: (localData.attendance || []).map(a => convertKeysToSnakeCase(a, ENTITY_FIELD_MAPPINGS.attendance)),
            payments: (localData.payments || []).map(p => convertKeysToSnakeCase(p, ENTITY_FIELD_MAPPINGS.payments)),
            payroll: (localData.payroll || []).map(p => convertKeysToSnakeCase(p, ENTITY_FIELD_MAPPINGS.payroll)),
            revenue: (localData.revenue || []).map(r => convertKeysToSnakeCase(r, ENTITY_FIELD_MAPPINGS.revenue)),
            costs: localData.costs || [],
            studentClasses: (localData.studentClasses || []).map(sc => convertKeysToSnakeCase(sc, ENTITY_FIELD_MAPPINGS.studentClasses)),
            classTeachers: extractClassTeachers(localData.classes || []),
            walletTransactions: (localData.walletTransactions || []).map(tx => convertKeysToSnakeCase(tx, ENTITY_FIELD_MAPPINGS.walletTransactions)),
            homePosts: (localData.homePosts || []).map(post => convertKeysToSnakeCase(post, ENTITY_FIELD_MAPPINGS.homePosts)),
            documents: (localData.documents || []).map(doc => {
                const converted = convertKeysToSnakeCase(doc, ENTITY_FIELD_MAPPINGS.documents);
                // Ensure tags is a JSON array
                if (converted.tags && !Array.isArray(converted.tags)) {
                    converted.tags = typeof converted.tags === 'string' 
                        ? converted.tags.split(',').map(t => t.trim()).filter(Boolean)
                        : [];
                }
                return cleanSupabaseEntity(converted);
            }),
            lessonPlans: (localData.lessonPlans || []).map(lp => cleanSupabaseEntity(convertKeysToSnakeCase(lp, ENTITY_FIELD_MAPPINGS.lessonPlans))),
            lessonResources: (localData.lessonResources || []).map(lr => {
                const converted = convertKeysToSnakeCase(lr, ENTITY_FIELD_MAPPINGS.lessonResources);
                if (converted.tags && !Array.isArray(converted.tags)) {
                    converted.tags = typeof converted.tags === 'string' 
                        ? converted.tags.split(',').map(t => t.trim()).filter(Boolean)
                        : [];
                }
                return cleanSupabaseEntity(converted);
            }),
            lessonTasks: (localData.lessonTasks || []).map(lt => cleanSupabaseEntity(convertKeysToSnakeCase(lt, ENTITY_FIELD_MAPPINGS.lessonTasks))),
            lessonOutputs: (localData.lessonOutputs || []).map(lo => {
                // Remove 'tags' field before converting (it's only used locally, not in Supabase)
                const cleaned = { ...lo };
                if ('tags' in cleaned) {
                    delete cleaned.tags;
                }
                return cleanSupabaseEntity(convertKeysToSnakeCase(cleaned, ENTITY_FIELD_MAPPINGS.lessonOutputs));
            }),
            lessonTopics: (localData.lessonTopics || []).map(lt => cleanSupabaseEntity(convertKeysToSnakeCase(lt, ENTITY_FIELD_MAPPINGS.lessonTopics))),
            lessonTopicLinks: (localData.lessonTopicLinks || []).map(ltl => {
                const converted = convertKeysToSnakeCase(ltl, ENTITY_FIELD_MAPPINGS.lessonTopicLinks);
                // Validate foreign keys exist
                if (!converted.topic_id || !converted.lesson_output_id) {
                    console.warn('Invalid lessonTopicLink (missing foreign keys):', converted);
                    return null;
                }
                return cleanSupabaseEntity(converted);
            }).filter(Boolean),
            bonuses: (localData.bonuses || []).map(b => cleanSupabaseEntity(convertKeysToSnakeCase(b, ENTITY_FIELD_MAPPINGS.bonuses))),
            // Extract users from students and teachers (for login info: accountHandle and accountPassword)
            users: extractUsersFromEntities(localData)
        };
    }

    function normalizeLocalUsersCollection(users) {
        if (!Array.isArray(users)) return [];
        return users
            .map(user => {
                if (!user || typeof user !== 'object') return null;
                const normalized = { ...user };
                normalized.linkId = user.linkId || user.link_id || user.linkID || null;
                normalized.accountHandle = user.accountHandle || user.account_handle || user.email || '';
                const password = user.password || user.accountPassword || user.account_password || '';
                normalized.password = password;
                normalized.accountPassword = user.accountPassword || user.account_password || password;
                normalized.role = typeof user.role === 'string'
                    ? user.role.toLowerCase()
                    : (user.userRole || '').toLowerCase();
                normalized.assistantType = user.assistantType || user.assistant_type || null;
                if (!normalized.id || !isValidUuid(normalized.id)) {
                    normalized.id = generateClientUuid();
                }
                return normalized;
            })
            .filter(Boolean);
    }

    /**
     * Extract user records from students and teachers for login info
     * Maps accountHandle and accountPassword to users table with link_id
     */
    function extractUsersFromEntities(localData) {
        const users = [];
        const existingUsers = normalizeLocalUsersCollection(localData.users || []);
        
        // Extract from students
        (localData.students || []).forEach(student => {
            if (student.accountHandle && student.accountPassword) {
                const existingUser = existingUsers.find(u => 
                    u.linkId === student.id && u.role === 'student'
                );
                
                if (existingUser) {
                    users.push({
                        id: existingUser.id,
                        account_handle: student.accountHandle,
                        email: student.email || student.accountHandle,
                        password: student.accountPassword,
                        name: student.fullName || student.name || '',
                        role: 'student',
                        link_id: student.id,
                        province: student.province || null,
                        status: student.status || 'active'
                    });
                } else {
                    users.push({
                        account_handle: student.accountHandle,
                        email: student.email || student.accountHandle,
                        password: student.accountPassword,
                        name: student.fullName || student.name || '',
                        role: 'student',
                        link_id: student.id,
                        province: student.province || null,
                        status: student.status || 'active'
                    });
                }
            }
        });
        
        // Extract from teachers (staff)
        (localData.teachers || []).forEach(teacher => {
            if (teacher.accountHandle && teacher.accountPassword) {
                const existingUser = existingUsers.find(u => 
                    u.linkId === teacher.id && u.role === 'teacher'
                );
                
                if (existingUser) {
                    users.push({
                        id: existingUser.id,
                        account_handle: teacher.accountHandle,
                        email: teacher.gmail || teacher.email || teacher.accountHandle,
                        password: teacher.accountPassword,
                        name: teacher.fullName || teacher.name || '',
                        role: 'teacher',
                        link_id: teacher.id,
                        province: teacher.province || null,
                        status: teacher.status || 'active'
                    });
                } else {
                    users.push({
                        account_handle: teacher.accountHandle,
                        email: teacher.gmail || teacher.email || teacher.accountHandle,
                        password: teacher.accountPassword,
                        name: teacher.fullName || teacher.name || '',
                        role: 'teacher',
                        link_id: teacher.id,
                        province: teacher.province || null,
                        status: teacher.status || 'active'
                    });
                }
            }
        });
        
        // Extract from teachers (assistants are now staff with roles)
        // Note: Assistants functionality has been replaced by staff with roles
        
        return users;
    }

    /**
     * Delete Supabase records that no longer exist in local data
     * @param {string} tableName
     * @param {Array<Object>} entities
     * @param {Object} options
     */
    async function deleteMissingSupabaseRecords(tableName, entities, options = {}) {
        const { idColumn = 'id', deleteMissing = true } = options;
        if (!deleteMissing) return { deleted: 0 };

        const keepIds = entities
            .map(entity => entity[idColumn])
            .filter(id => id !== null && id !== undefined);

        try {
            const { data: existingRows, error: fetchError } = await supabase
                .from(tableName)
                .select(idColumn);

            if (fetchError) {
                console.error(`❌ Failed to fetch existing rows from ${tableName}:`, fetchError);
                return { error: fetchError };
            }

            const idsToDelete = (existingRows || [])
                .map(row => row[idColumn])
                .filter(id => id !== null && id !== undefined && !keepIds.includes(id));

            if (idsToDelete.length === 0) {
                return { deleted: 0 };
            }

            const { error: deleteError } = await supabase
                .from(tableName)
                .delete()
                .in(idColumn, idsToDelete);

            if (deleteError) {
                console.error(`❌ Failed to delete stale rows from ${tableName}:`, deleteError);
                return { error: deleteError };
            }

            console.log(`🗑️ Deleted ${idsToDelete.length} stale records from ${tableName}`);
            return { deleted: idsToDelete.length };
        } catch (e) {
            console.error(`❌ Exception while deleting missing records from ${tableName}:`, e);
            return { error: e };
        }
    }

    /**
     * Extract class-teacher relationships from classes
     */
    function extractClassTeachers(classes) {
        const classTeachers = [];
        classes.forEach(cls => {
            const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
            teacherIds.forEach(teacherId => {
                if (teacherId) {
                    classTeachers.push({
                        id: `CT_${cls.id}_${teacherId}`,
                        class_id: cls.id,
                        teacher_id: teacherId,
                        custom_allowance: (cls.customTeacherAllowances || {})[teacherId] || null
                    });
                }
            });
        });
        return classTeachers;
    }

    /**
     * Convert Supabase format to local data structure
     */
    function fromSupabaseFormat(supabaseData) {
        // Reverse mappings (snake_case -> camelCase)
        const teachersMapping = {
            full_name: 'fullName',
            bank_account: 'bankAccount',
            bank_qr_link: 'bankQRLink',
            photo_url: 'photoUrl',
            birth_date: 'birthDate',
            high_school: 'highSchool',
            email: 'gmail', // Map email back to gmail for compatibility
            user_id: 'userId'
        };

        const studentsMapping = {
            full_name: 'fullName',
            parent_name: 'parentName',
            parent_phone: 'parentPhone',
            class_id: 'classId',
            last_attendance: 'lastAttendance',
            birth_year: 'birthYear',
            wallet_balance: 'walletBalance'
        };

        const classesMapping = {
            max_students: 'maxStudents',
            tuition_per_session: 'tuitionPerSession',
            student_tuition_per_session: 'studentTuitionPerSession',
            tuition_package_total: 'tuitionPackageTotal',
            tuition_package_sessions: 'tuitionPackageSessions',
            scale_amount: 'scaleAmount',
            custom_teacher_allowances: 'customTeacherAllowances'
        };

        const sessionsMapping = {
            class_id: 'classId',
            teacher_id: 'teacherId',
            start_time: 'startTime',
            end_time: 'endTime',
            payment_status: 'paymentStatus',
            allowance_amount: 'allowanceAmount'
        };

        const attendanceMapping = {
            session_id: 'sessionId',
            student_id: 'studentId'
        };

        const paymentsMapping = {
            student_id: 'studentId',
            class_id: 'classId'
        };

        const payrollMapping = {
            teacher_id: 'teacherId',
            total_hours: 'totalHours',
            total_sessions: 'totalSessions',
            base_rate: 'baseRate',
            total_pay: 'totalPay'
        };

        const revenueMapping = {
            class_id: 'classId',
            enrolled_count: 'enrolledCount',
            tuition_per_student: 'tuitionPerStudent',
            total_revenue: 'totalRevenue'
        };

        const studentClassesMapping = {
            student_id: 'studentId',
            class_id: 'classId',
            start_date: 'startDate',
            status: 'status',
            total_purchased_sessions: 'totalPurchasedSessions',
            remaining_sessions: 'remainingSessions',
            total_attended_sessions: 'totalAttendedSessions',
            unpaid_sessions: 'unpaidSessions',
            total_paid_amount: 'totalPaidAmount',
            student_fee_total: 'studentFeeTotal',
            student_fee_sessions: 'studentFeeSessions'
        };

        // Reconstruct classes with teacherIds
        const classes = (supabaseData.classes || []).map(cls => {
            const classTeachers = supabaseData.classTeachers || [];
            const teacherIds = classTeachers
                .filter(ct => ct.class_id === cls.id)
                .map(ct => ct.teacher_id);
            
            // Build customTeacherAllowances from classTeachers table (active teachers)
            const customTeacherAllowances = {};
            classTeachers
                .filter(ct => ct.class_id === cls.id && ct.custom_allowance)
                .forEach(ct => {
                    customTeacherAllowances[ct.teacher_id] = ct.custom_allowance;
                });
            
            // IMPORTANT: Also merge from classes.custom_teacher_allowances JSONB field
            // This preserves allowances for inactive teachers (removed from teacherIds but kept for history)
            const converted = convertKeysToCamelCase(cls, classesMapping);
            if (converted.customTeacherAllowances && typeof converted.customTeacherAllowances === 'object') {
                // Merge: classTeachers (active) + classes.custom_teacher_allowances (includes inactive)
                // Priority: classTeachers takes precedence for active teachers
                Object.keys(converted.customTeacherAllowances).forEach(teacherId => {
                    if (converted.customTeacherAllowances[teacherId] !== null && 
                        converted.customTeacherAllowances[teacherId] !== undefined) {
                        // Only add if not already in customTeacherAllowances (from classTeachers)
                        // This ensures we keep allowances for inactive teachers
                        if (!customTeacherAllowances.hasOwnProperty(teacherId)) {
                            customTeacherAllowances[teacherId] = converted.customTeacherAllowances[teacherId];
                        }
                    }
                });
            }

            return {
                ...converted,
                id: cls.id,
                teacherIds: teacherIds,
                customTeacherAllowances: customTeacherAllowances
            };
        });

        // Convert teachers - map email back to gmail and sync login info from users table
        const teachers = (supabaseData.teachers || []).map(t => {
            const converted = convertKeysToCamelCase(t, teachersMapping);
            // Map email back to gmail for compatibility
            if (t.email && !converted.gmail) {
                converted.gmail = t.email;
            }
            // Sync accountHandle and accountPassword from users table
            if (supabaseData.users && Array.isArray(supabaseData.users)) {
                const userRecord = supabaseData.users.find(u => 
                    u.link_id === t.id && u.role === 'teacher'
                );
                if (userRecord) {
                    // Use account_handle if available, otherwise use email
                    converted.accountHandle = userRecord.account_handle || userRecord.email || converted.accountHandle || '';
                    converted.accountPassword = userRecord.password || converted.accountPassword || '';
                }
            }
            return converted;
        });

        const sessions = (supabaseData.sessions || []).map(s => convertKeysToCamelCase(s, sessionsMapping));
        if (Array.isArray(sessions)) {
            sessions.forEach(session => {
                if (typeof session.allowanceAmount !== 'number' || session.allowanceAmount <= 0) {
                    try {
                        if (window.UniData && typeof window.UniData.computeSessionAllowance === 'function') {
                            session.allowanceAmount = window.UniData.computeSessionAllowance(session);
                        }
                    } catch (err) {
                        // Ignore compute errors, keep default
                    }
                    if (typeof session.allowanceAmount !== 'number') {
                        session.allowanceAmount = 0;
                    }
                }
            });
        }

        // Convert students and sync login info from users table
        const students = (supabaseData.students || []).map(s => {
            const converted = convertKeysToCamelCase(s, studentsMapping);
            // Sync accountHandle and accountPassword from users table
            if (supabaseData.users && Array.isArray(supabaseData.users)) {
                const userRecord = supabaseData.users.find(u => 
                    u.link_id === s.id && u.role === 'student'
                );
                if (userRecord) {
                    // Use account_handle if available, otherwise use email
                    converted.accountHandle = userRecord.account_handle || userRecord.email || converted.accountHandle || '';
                    converted.accountPassword = userRecord.password || converted.accountPassword || '';
                }
            }
            return converted;
        });

        const users = (supabaseData.users || []).map(user => 
            convertKeysToCamelCase(user, ENTITY_FIELD_MAPPINGS.users)
        );

        // Convert classTeachers - keep original data for cache conversion
        const classTeachers = (supabaseData.classTeachers || []).map(ct => 
            convertKeysToCamelCase(ct, ENTITY_FIELD_MAPPINGS.classTeachers)
        );

        return {
            users,
            teachers: teachers,
            students: students,
            classes: classes,
            sessions: sessions,
            attendance: (supabaseData.attendance || []).map(a => convertKeysToCamelCase(a, attendanceMapping)),
            payments: (supabaseData.payments || []).map(p => convertKeysToCamelCase(p, paymentsMapping)),
            payroll: (supabaseData.payroll || []).map(p => convertKeysToCamelCase(p, payrollMapping)),
            revenue: (supabaseData.revenue || []).map(r => convertKeysToCamelCase(r, revenueMapping)),
            costs: supabaseData.costs || [],
            walletTransactions: (supabaseData.walletTransactions || []).map(tx => convertKeysToCamelCase(tx, ENTITY_FIELD_MAPPINGS.walletTransactions)),
            studentClasses: (supabaseData.studentClasses || []).map(sc => convertKeysToCamelCase(sc, studentClassesMapping)),
            classTeachers: classTeachers, // IMPORTANT: Keep classTeachers for cache conversion
            categories: (supabaseData.categories || []).map(row => normalizeSupabaseRow('categories', row)).filter(cat => cat && cat.name),
            homePosts: (supabaseData.homePosts || []).map(post => convertKeysToCamelCase(post, ENTITY_FIELD_MAPPINGS.homePosts)),
            documents: (supabaseData.documents || []).map(doc => convertKeysToCamelCase(doc, ENTITY_FIELD_MAPPINGS.documents)),
            // Assistants functionality has been replaced by staff with roles
            lessonPlans: (supabaseData.lesson_plans || []).map(lp => convertKeysToCamelCase(lp, ENTITY_FIELD_MAPPINGS.lessonPlans)),
            lessonResources: ((supabaseData.lessonResources || supabaseData.lesson_resources) || []).map(lr => convertKeysToCamelCase(lr, ENTITY_FIELD_MAPPINGS.lessonResources)),
            lessonTasks: ((supabaseData.lessonTasks || supabaseData.lesson_tasks) || []).map(lt => convertKeysToCamelCase(lt, ENTITY_FIELD_MAPPINGS.lessonTasks)),
            lessonOutputs: ((supabaseData.lessonOutputs || supabaseData.lesson_outputs) || []).map(lo => convertKeysToCamelCase(lo, ENTITY_FIELD_MAPPINGS.lessonOutputs)),
            lessonTopics: ((supabaseData.lessonTopics || supabaseData.lesson_topics) || []).map(lt => convertKeysToCamelCase(lt, ENTITY_FIELD_MAPPINGS.lessonTopics)),
            lessonTopicLinks: ((supabaseData.lessonTopicLinks || supabaseData.lesson_topic_links) || []).map(ltl => convertKeysToCamelCase(ltl, ENTITY_FIELD_MAPPINGS.lessonTopicLinks)),
            bonuses: (supabaseData.bonuses || []).map(b => convertKeysToCamelCase(b, ENTITY_FIELD_MAPPINGS.bonuses))
        };
    }

    /**
     * Save data to Supabase
     */
    async function saveToSupabase(data) {
        if (!supabase) {
            await loadSupabase();
            if (!supabase) {
                throw new Error('Supabase not initialized');
            }
        }

        const mutationStart = nowMs();
        const formatted = toSupabaseFormat(data);
        const errors = [];

        // Save each entity type in correct order (parent tables first, child tables after)
        // This ensures foreign key constraints are satisfied
        const entityTypes = [
            'categories',      // No dependencies
            'teachers',        // Parent table
            'classes',         // Parent table (may reference teachers)
            'students',        // May reference classes
            'users',           // Depends on students and teachers (for login info)
            'classTeachers',   // Depends on classes and teachers
            'studentClasses',  // Depends on students and classes
            'sessions',        // Depends on classes and teachers
            'attendance',      // Depends on sessions and students
            'payments',        // Depends on students and classes
            'walletTransactions',
            'homePosts',
            'payroll',         // Depends on teachers
            'revenue',         // Depends on classes
            'costs',           // No dependencies
            'bonuses',         // Depends on teachers
            'documents'        // No dependencies
        ];

        const tableConfig = {
            categories: { table: 'categories', idColumn: 'id', onConflict: 'id', deleteMissing: false, uniqueKeys: ['id','name'] },
            teachers: { table: 'teachers', idColumn: 'id' },
            classes: { table: 'classes', idColumn: 'id' },
            students: { table: 'students', idColumn: 'id' },
            users: { table: 'users', idColumn: 'id', onConflict: 'email', uniqueKeys: ['account_handle', 'email'] },
            classTeachers: { table: 'class_teachers', idColumn: 'id' },
            studentClasses: { table: 'student_classes', idColumn: 'id' },
            sessions: { table: 'sessions', idColumn: 'id' },
            attendance: { table: 'attendance', idColumn: 'id', onConflict: 'session_id,student_id', uniqueKeys: ['session_id','student_id'] },
            payments: { table: 'payments', idColumn: 'id' },
            walletTransactions: { table: 'wallet_transactions', idColumn: 'id' },
            homePosts: { table: 'home_posts', idColumn: 'id' },
            payroll: { table: 'payroll', idColumn: 'id' },
            revenue: { table: 'revenue', idColumn: 'id' },
            costs: { table: 'costs', idColumn: 'id' },
            bonuses: { table: 'bonuses', idColumn: 'id' },
            documents: { table: 'documents', idColumn: 'id' }
        };

        for (const entityType of entityTypes) {
            const config = tableConfig[entityType] || { table: entityType, idColumn: 'id', deleteMissing: true };
            const tableName = config.table;
            const idColumn = config.idColumn || 'id';
            const deleteMissing = config.deleteMissing !== false;
            const onConflict = config.onConflict || idColumn;
            const entities = formatted[entityType] || [];
            const timeLabel = `[Supabase] save:${entityType}`;
            if (console.time) console.time(timeLabel);

            try {
                const deleteResult = await deleteMissingSupabaseRecords(tableName, entities, { idColumn, deleteMissing });
                if (deleteResult?.error) {
                    errors.push({ type: entityType, error: deleteResult.error.message || deleteResult.error });
                    continue;
                }

                if (entities.length === 0) {
                    if (deleteMissing && (deleteResult?.deleted || 0) > 0) {
                        console.log(`🗑️ Cleared all records in ${entityType} (no local data)`);
                    } else {
                        console.log(`⏭️ Skipping ${entityType} (no data)`);
                    }
                    continue;
                }

                console.log(`📤 Saving ${entityType} (${entities.length} records)...`);

                const cleanedEntities = entities.map(entity => {
                    const cleaned = { ...entity };
                    for (const key in cleaned) {
                        if ((key.includes('date') || key.includes('_at') || key.includes('time')) && cleaned[key] === '') {
                            cleaned[key] = null;
                        }
                        if (cleaned[key] === undefined) {
                            delete cleaned[key];
                        }
                    }
                    return cleaned;
                });

                const { error } = await supabase
                    .from(tableName)
                    .upsert(cleanedEntities, { onConflict });

                if (error) {
                    console.error(`❌ Error saving ${entityType}:`, error);
                    errors.push({ type: entityType, error: error.message || error });
                } else {
                    console.log(`✅ ${entityType} saved successfully`);
                }
            } catch (e) {
                console.error(`❌ Exception saving ${entityType}:`, e);
                errors.push({ type: entityType, error: e.message || e });
            } finally {
                if (console.timeEnd) console.timeEnd(timeLabel);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Failed to save some entities: ${JSON.stringify(errors)}`);
        }

        logDuration('[Supabase] save(full-dataset)', mutationStart);
        return true;
    }

    /**
     * Save selected entities to Supabase (partial update)
     * @param {Object} entitiesMap
     */
    async function savePartialEntities(entitiesMap = {}, options = {}) {
        if (!entitiesMap || typeof entitiesMap !== 'object') {
            entitiesMap = {};
        }

        const deleteMap = options.deletes || {};

        const hasEntities = Object.values(entitiesMap).some(items => Array.isArray(items) && items.length > 0);
        const hasDeletes = Object.values(deleteMap).some(items => Array.isArray(items) && items.length > 0);

        if (!hasEntities && !hasDeletes) return false;

        if (!supabase) {
            await loadSupabase();
        }

        const tableConfig = {
            teachers: { table: 'teachers', idColumn: 'id' },
            students: { table: 'students', idColumn: 'id' },
            classes: { table: 'classes', idColumn: 'id' },
            sessions: { table: 'sessions', idColumn: 'id' },
            attendance: { table: 'attendance', idColumn: 'id', onConflict: 'session_id,student_id', uniqueKeys: ['session_id','student_id'] },
            studentClasses: { table: 'student_classes', idColumn: 'id', onConflict: 'student_id,class_id' },
            classTeachers: { table: 'class_teachers', idColumn: 'id', onConflict: 'class_id,teacher_id' },
            payments: { table: 'payments', idColumn: 'id' },
            walletTransactions: { table: 'wallet_transactions', idColumn: 'id' },
            homePosts: { table: 'home_posts', idColumn: 'id' },
            payroll: { table: 'payroll', idColumn: 'id' },
            revenue: { table: 'revenue', idColumn: 'id' },
            costs: { table: 'costs', idColumn: 'id' },
            categories: { table: 'categories', idColumn: 'id', onConflict: 'id' },
            documents: { table: 'documents', idColumn: 'id' },
            lessonPlans: { table: 'lesson_plans', idColumn: 'id' },
            lessonResources: { table: 'lesson_resources', idColumn: 'id' },
            lessonTasks: { table: 'lesson_tasks', idColumn: 'id' },
            lessonOutputs: { table: 'lesson_outputs', idColumn: 'id' },
            lessonTopics: { table: 'lesson_topics', idColumn: 'id' },
            lessonTopicLinks: { table: 'lesson_topic_links', idColumn: 'id' },
            bonuses: { table: 'bonuses', idColumn: 'id' },
            users: { table: 'users', idColumn: 'id', onConflict: 'account_handle', uniqueKeys: ['account_handle', 'email'] }
        };

        const errors = [];
        const totalStart = nowMs();
        const touchedTargets = new Set();

        for (const [entityType, items] of Object.entries(entitiesMap)) {
            if (!items || items.length === 0) continue;

            const formatted = formatPartialForSupabase(entityType, items);
            if (!formatted || formatted.length === 0) continue;

            const config = tableConfig[entityType];
            if (!config) continue;

            let prepared = dedupeEntitiesByConfig(formatted, config);
            if (!prepared || prepared.length === 0) continue;

            // For lessonTopicLinks, validate foreign keys before saving
            if (entityType === 'lessonTopicLinks' && prepared.length > 0) {
                // Check if all topic_ids and lesson_output_ids exist
                const allTopics = (window.demo?.lessonTopics || []);
                const allOutputs = (window.demo?.lessonOutputs || []);
                
                const validLinks = prepared.filter(link => {
                    const topicExists = allTopics.find(t => t.id === link.topic_id);
                    const outputExists = allOutputs.find(o => o.id === link.lesson_output_id);
                    
                    if (!topicExists) {
                        console.warn(`Invalid lessonTopicLink: topic_id ${link.topic_id} does not exist`);
                        return false;
                    }
                    if (!outputExists) {
                        console.warn(`Invalid lessonTopicLink: lesson_output_id ${link.lesson_output_id} does not exist`);
                        return false;
                    }
                    return true;
                });
                
                if (validLinks.length < prepared.length) {
                    console.warn(`Filtered out ${prepared.length - validLinks.length} invalid lessonTopicLinks`);
                }
                
                if (validLinks.length === 0) {
                    console.warn(`No valid lessonTopicLinks to save, skipping`);
                    continue;
                }
                
                prepared = validLinks;
            }

            const label = `[Supabase] partial:${entityType}`;
            if (console.time) console.time(label);
            touchedTargets.add(entityType);

            try {
                const { error } = await supabase
                    .from(config.table)
                    .upsert(prepared, { onConflict: config.onConflict || config.idColumn || 'id' });

                if (error) {
                    console.error(`❌ Error saving ${entityType}:`, error);
                    errors.push({ type: entityType, error: error.message || error });
                } else {
                    console.log(`✅ ${entityType} (partial) saved successfully`);
                }
            } catch (e) {
                console.error(`❌ Exception saving ${entityType}:`, e);
                errors.push({ type: entityType, error: e.message || e });
            } finally {
                if (console.timeEnd) console.timeEnd(label);
            }
        }

        // After saving students/teachers, extract and save user records
        // This ensures user login info (accountHandle, accountPassword) is synced
        const userExtractionNeeded = ['students', 'teachers'].some(type => 
            entitiesMap[type] && entitiesMap[type].length > 0
        );
        
        if (userExtractionNeeded && window.demo) {
            // Extract users from current window.demo state (which includes the newly saved entities)
            // IMPORTANT: Use a fresh copy of window.demo to ensure we have the latest data
            const currentDemo = JSON.parse(JSON.stringify(window.demo));
            const extractedUsers = extractUsersFromEntities(currentDemo);
            
                console.log(`[User Sync] Extracted ${extractedUsers.length} users from ${currentDemo.students?.length || 0} students, ${currentDemo.teachers?.length || 0} teachers`);
            
            if (extractedUsers && extractedUsers.length > 0) {
                // Format users for Supabase
                const formattedUsers = extractedUsers.map(user => {
                const formatted = convertKeysToSnakeCase(user, ENTITY_FIELD_MAPPINGS.users);
                if (!formatted.id || !isValidUuid(formatted.id)) {
                    formatted.id = generateClientUuid();
                }
                    // Ensure required fields
                    if (!formatted.account_handle && formatted.email) {
                        formatted.account_handle = formatted.email;
                    }
                    // Ensure account_handle is unique and not empty
                    if (!formatted.account_handle) {
                        console.warn('[User Sync] Skipping user without account_handle:', formatted);
                        return null;
                    }
                    // IMPORTANT: Remove id if it's null/undefined for new users
                    // Supabase will auto-generate UUID for new users via DEFAULT uuid_generate_v4()
                    // Only include id if it's a valid UUID (for existing users)
                    if (!formatted.id || formatted.id === null || formatted.id === undefined) {
                        delete formatted.id;
                    }
                    return cleanSupabaseEntity(formatted);
                }).filter(Boolean);

                if (formattedUsers.length > 0) {
                    // Deduplicate users by email/account_handle to avoid constraint violations
                    const dedupByEmail = new Map();
                    const dedupByHandle = new Map();
                    const dedupedUsers = [];

                    formattedUsers.forEach(user => {
                        const emailKey = user.email ? String(user.email).trim().toLowerCase() : null;
                        const handleKey = user.account_handle ? String(user.account_handle).trim().toLowerCase() : null;
                        const existing = (emailKey && dedupByEmail.get(emailKey)) || (handleKey && dedupByHandle.get(handleKey));
                        if (existing) {
                            Object.assign(existing, user);
                        } else {
                            dedupedUsers.push(user);
                            if (emailKey) dedupByEmail.set(emailKey, user);
                            if (handleKey) dedupByHandle.set(handleKey, user);
                        }
                    });

                    const userConfig = tableConfig.users;
                    const usersWithHandle = dedupedUsers.filter(u => !!u.account_handle);
                    const usersWithEmailOnly = dedupedUsers.filter(u => !u.account_handle && !!u.email);

                    const upsertUsers = async (list, conflictTarget) => {
                        if (!list.length) return;
                        const label = `[Supabase] partial:users (${conflictTarget})`;
                        if (console.time) console.time(label);
                        touchedTargets.add(`users:${conflictTarget}`);
                        try {
                            console.log(`[User Sync] Saving ${list.length} users (conflict=${conflictTarget})`, list.map(u => ({
                                id: u.id || '(new)',
                                account_handle: u.account_handle || '(none)',
                                email: u.email || '(none)',
                                role: u.role,
                                link_id: u.link_id
                            })));
                            
                            // Để tránh foreign key constraint violation khi update user đã tồn tại:
                            // - Không gửi id trong payload khi upsert với onConflict
                            // - Supabase sẽ tự động match bằng conflictTarget (account_handle hoặc email)
                            // - Chỉ update các field khác, không update id (vì có foreign key constraint từ audit_logs)
                            const usersToUpsert = list.map(user => {
                                const { id, ...userWithoutId } = user;
                                // Loại bỏ id để tránh foreign key constraint violation
                                // Supabase sẽ match bằng conflictTarget và chỉ update các field khác
                                return userWithoutId;
                            });
                            
                            const { error } = await supabase
                                .from(userConfig.table)
                                .upsert(usersToUpsert, { 
                                    onConflict: conflictTarget,
                                    // Chỉ update các field được chỉ định, không update id
                                    ignoreDuplicates: false
                                });
                            if (error) {
                                console.error(`❌ Error saving users (conflict=${conflictTarget}):`, error);
                                errors.push({ type: 'users', error: error.message || error });
                            } else {
                                console.log(`✅ users (conflict=${conflictTarget}) saved successfully`);
                            }
                        } catch (e) {
                            console.error(`❌ Exception saving users (conflict=${conflictTarget}):`, e);
                            errors.push({ type: 'users', error: e.message || e });
                        } finally {
                            if (console.timeEnd) console.timeEnd(label);
                        }
                    };

                    await upsertUsers(usersWithHandle, 'account_handle');
                    await upsertUsers(usersWithEmailOnly, 'email');
                } else {
                    console.warn('[User Sync] No valid users to save after formatting');
                }
            } else {
                console.log('[User Sync] No users extracted - students/teachers may not have accountHandle and accountPassword set');
            }
        }

        // Delete in correct order to respect foreign key constraints
        // Child tables (with foreign keys) must be deleted before parent tables
        const deleteOrder = [
            'lessonTopicLinks',  // Must be deleted before lessonTopics (has foreign key to lesson_topics)
            'lessonTopics',      // Can be deleted after links are removed
            'lessonOutputs',
            'lessonTasks',
            'lessonResources',
            'attendance',
            'sessions',
            'studentClasses',
            'classTeachers',
            'payments',
            'payroll',
            'revenue',
            'walletTransactions',
            'homePosts',
            'costs',
            'documents',
            'students',
            'classes',
            'teachers',
            'categories'
        ];
        
        // First, delete entities in the correct order
        for (const entityType of deleteOrder) {
            const ids = deleteMap[entityType];
            if (!ids || ids.length === 0) continue;

            const config = tableConfig[entityType];
            if (!config) continue;

            const label = `[Supabase] delete:${entityType}`;
            if (console.time) console.time(label);
            touchedTargets.add(`${entityType}:delete`);

            try {
                const { error } = await supabase
                    .from(config.table)
                    .delete()
                    .in(config.idColumn || 'id', ids);

                if (error) {
                    console.error(`❌ Error deleting ${entityType}:`, error);
                    errors.push({ type: entityType, error: error.message || error });
                } else {
                    console.log(`🗑️ ${entityType} (partial) deleted ${ids.length} records`);
                }
            } catch (e) {
                console.error(`❌ Exception deleting ${entityType}:`, e);
                errors.push({ type: entityType, error: e.message || e });
            } finally {
                if (console.timeEnd) console.timeEnd(label);
            }
        }
        
        // Then delete any remaining entities not in the ordered list
        for (const [entityType, ids] of Object.entries(deleteMap)) {
            if (deleteOrder.includes(entityType)) continue; // Already processed
            if (!ids || ids.length === 0) continue;

            const config = tableConfig[entityType];
            if (!config) continue;

            const label = `[Supabase] delete:${entityType}`;
            if (console.time) console.time(label);
            touchedTargets.add(`${entityType}:delete`);

            try {
                const { error } = await supabase
                    .from(config.table)
                    .delete()
                    .in(config.idColumn || 'id', ids);

                if (error) {
                    console.error(`❌ Error deleting ${entityType}:`, error);
                    errors.push({ type: entityType, error: error.message || error });
                } else {
                    console.log(`🗑️ ${entityType} (partial) deleted ${ids.length} records`);
                }
            } catch (e) {
                console.error(`❌ Exception deleting ${entityType}:`, e);
                errors.push({ type: entityType, error: e.message || e });
            } finally {
                if (console.timeEnd) console.timeEnd(label);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Failed to save some entities: ${JSON.stringify(errors)}`);
        }

        if (touchedTargets.size > 0) {
            const label = `[Supabase] saveEntities(${Array.from(touchedTargets).join(',')})`;
            logDuration(label, totalStart);
        }

        return true;
    }

    /**
     * Load data from Supabase
     */
    function normalizeTableFilter(tables) {
        if (!Array.isArray(tables)) return null;
        const normalized = tables
            .map(name => (typeof name === 'string' ? name.trim() : ''))
            .filter(Boolean);
        if (!normalized.length) return null;
        return new Set(normalized);
    }

    async function loadFromSupabase(tableFilter = null) {
        if (!supabase) {
            await loadSupabase();
            if (!supabase) {
                throw new Error('Supabase not initialized');
            }
        }

        const filterSet = normalizeTableFilter(tableFilter);

        const data = {};
        const entityTypes = [
            { key: 'teachers', table: 'teachers' },
            { key: 'students', table: 'students' },
            { key: 'classes', table: 'classes' },
            { key: 'sessions', table: 'sessions' },
            { key: 'attendance', table: 'attendance' },
            { key: 'payments', table: 'payments' },
            { key: 'payroll', table: 'payroll' },
            { key: 'revenue', table: 'revenue' },
            { key: 'costs', table: 'costs' },
            { key: 'studentClasses', table: 'student_classes' },
            { key: 'classTeachers', table: 'class_teachers' },
            { key: 'walletTransactions', table: 'wallet_transactions' },
            { key: 'users', table: 'users' },
            { key: 'categories', table: 'categories' },
            { key: 'homePosts', table: 'home_posts' },
            { key: 'lessonResources', table: 'lesson_resources' },
            { key: 'lessonTasks', table: 'lesson_tasks' },
            { key: 'lessonOutputs', table: 'lesson_outputs' },
            { key: 'lessonTopics', table: 'lesson_topics' },
            { key: 'lessonTopicLinks', table: 'lesson_topic_links' },
            { key: 'bonuses', table: 'bonuses' }
        ];

        const missingColumns = [];

        for (const { key, table } of entityTypes) {
            if (filterSet && !filterSet.has(key) && !filterSet.has(table)) {
                continue;
            }
            try {
                let query = supabase.from(table).select('*');
                
                // Add consistent ordering to preserve display order
                // Order by created_at (oldest first) to maintain insertion order
                // If created_at is null, fallback to id for consistent ordering
                if (table === 'teachers' || table === 'students') {
                    query = query.order('created_at', { ascending: true, nullsFirst: false })
                                 .order('id', { ascending: true });
                }
                
                const { data: rows, error } = await query;
                
                if (error) {
                    console.error(`Error loading ${key}:`, error);
                    data[key] = [];
                } else {
                    data[key] = rows || [];
                }
            } catch (e) {
                console.error(`Exception loading ${key}:`, e);
                data[key] = [];
            }

            const requirements = REQUIRED_SUPABASE_COLUMNS[table];
            if (requirements && Array.isArray(requirements)) {
                const rows = data[key];
                if (Array.isArray(rows) && rows.length > 0) {
                    requirements.forEach(req => {
                        if (!(req.column in rows[0])) {
                            missingColumns.push({
                                table,
                                column: req.column,
                                sql: req.sql,
                                description: req.description
                            });
                        }
                    });
                }
            }
        }

        if (missingColumns.length > 0) {
            notifyMissingColumns(missingColumns);
        }

        return fromSupabaseFormat(data);
    }

    /**
     * Supabase Adapter
     */
    const SupabaseAdapter = {
        isEnabled: true,

        /**
         * Initialize Supabase client
         */
        async init() {
            try {
                await loadSupabase();
                console.log('Supabase adapter initialized');
                return true;
            } catch (e) {
                console.error('Failed to initialize Supabase:', e);
                return false;
            }
        },

        /**
         * Save data to Supabase
         */
        async save(data) {
            try {
                await saveToSupabase(data);
                return true;
            } catch (e) {
                console.error('Failed to save to Supabase:', e);
                return false;
            }
        },

        async subscribeToChanges(listener) {
            if (typeof listener !== 'function') {
                return () => {};
            }
            realtimeListeners.add(listener);
            try {
                await ensureRealtimeChannel();
            } catch (e) {
                console.error('Failed to initialize realtime channel:', e);
            }
            return () => {
                realtimeListeners.delete(listener);
                teardownRealtimeChannelIfIdle();
            };
        },

        normalizeRow(table, row) {
            return normalizeSupabaseRow(table, row);
        },

        /**
         * Save selected entities (partial)
         */
        async saveEntities(entitiesMap, options = {}) {
            try {
                const result = await savePartialEntities(entitiesMap, options);
                return result !== false;
            } catch (e) {
                console.error('Failed to save entities:', e);
                return false;
            }
        },

        /**
         * Load data from Supabase
         */
        async load(options = {}) {
            try {
                const data = await loadFromSupabase(options.tables || null);
                return data;
            } catch (e) {
                console.error('Failed to load from Supabase:', e);
                return null;
            }
        },

        /**
         * Delete records from Supabase table with simple equality filters
         * @param {string} table - table name
         * @param {Object} filters - key/value pairs for eq filters
         */
        async deleteRecords(table, filters = {}) {
            if (!supabase) {
                const initialized = await this.init();
                if (!initialized) return false;
            }

            try {
                let query = supabase.from(table).delete();
                for (const [key, value] of Object.entries(filters)) {
                    if (Array.isArray(value)) {
                        query = query.in(key, value);
                    } else {
                        query = query.eq(key, value);
                    }
                }

                const { error } = await query;
                if (error) {
                    console.error(`Failed to delete from ${table}:`, error);
                    return false;
                }
                return true;
            } catch (e) {
                console.error(`Exception deleting from ${table}:`, e);
                return false;
            }
        },

        /**
         * Sync local data with Supabase
         */
        async sync(localData) {
            try {
                // Load from Supabase
                const remoteData = await this.load();
                
                if (!remoteData) {
                    // No remote data, push local to remote
                    await this.save(localData);
                    return { action: 'pushed', data: localData };
                }

                // Simple merge strategy: remote wins (can be improved)
                return { action: 'pulled', data: remoteData };
            } catch (e) {
                console.error('Sync failed:', e);
                return { action: 'error', error: e.message };
            }
        },

        /**
         * Get Supabase client instance
         */
        getClient() {
            return supabase;
        },

        /**
         * Test connection
         */
        async testConnection() {
            try {
                if (!supabase) {
                    await this.init();
                }
                const { data, error } = await supabase.from('teachers').select('count').limit(1);
                return !error;
            } catch (e) {
                return false;
            }
        },

        /**
         * Sync all users from window.demo to Supabase
         * This is useful for syncing existing students/teachers that have accountHandle and accountPassword
         */
        async syncAllUsers() {
            try {
                if (!supabase) {
                    await this.init();
                }
                
                if (!window.demo) {
                    console.warn('[User Sync] window.demo is not available');
                    return { success: false, error: 'window.demo is not available' };
                }

                console.log('[User Sync] Starting sync of all users from window.demo to Supabase...');
                
                // Extract all users from current window.demo
                const extractedUsers = extractUsersFromEntities(window.demo);
                
                if (!extractedUsers || extractedUsers.length === 0) {
                    console.log('[User Sync] No users found with accountHandle and accountPassword');
                    return { success: true, synced: 0, message: 'No users to sync' };
                }

                console.log(`[User Sync] Found ${extractedUsers.length} users to sync`);

                // Format users for Supabase
                const formattedUsers = extractedUsers.map(user => {
                    const formatted = convertKeysToSnakeCase(user, ENTITY_FIELD_MAPPINGS.users);
                    // Ensure required fields
                    if (!formatted.account_handle && formatted.email) {
                        formatted.account_handle = formatted.email;
                    }
                    // Ensure account_handle is unique and not empty
                    if (!formatted.account_handle) {
                        console.warn('[User Sync] Skipping user without account_handle:', formatted);
                        return null;
                    }
                    // IMPORTANT: Remove id if it's null/undefined for new users
                    // Supabase will auto-generate UUID for new users via DEFAULT uuid_generate_v4()
                    // Only include id if it's a valid UUID (for existing users)
                    if (!formatted.id || formatted.id === null || formatted.id === undefined) {
                        delete formatted.id;
                    }
                    return cleanSupabaseEntity(formatted);
                }).filter(Boolean);

                if (formattedUsers.length === 0) {
                    console.warn('[User Sync] No valid users after formatting');
                    return { success: false, error: 'No valid users after formatting' };
                }

                // Save to Supabase
                const { error } = await supabase
                    .from('users')
                    .upsert(formattedUsers, { onConflict: 'account_handle' });

                if (error) {
                    console.error('[User Sync] Error saving users:', error);
                    return { success: false, error: error.message };
                }

                console.log(`[User Sync] ✅ Successfully synced ${formattedUsers.length} users to Supabase`);
                return { 
                    success: true, 
                    synced: formattedUsers.length,
                    users: formattedUsers.map(u => ({ account_handle: u.account_handle, role: u.role, link_id: u.link_id }))
                };
            } catch (e) {
                console.error('[User Sync] Exception:', e);
                return { success: false, error: e.message };
            }
        }
    };

    // Expose supabase client for direct access (useful for custom operations)
    Object.defineProperty(SupabaseAdapter, 'supabase', {
        get: function() {
            return supabase;
        },
        enumerable: false,
        configurable: false
    });

    // Auto-initialize
    SupabaseAdapter.init();

    // Export
    window.SupabaseAdapter = SupabaseAdapter;
})();

