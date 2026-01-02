/**
 * action-history-service.js - Service layer để quản lý lịch sử hành động chỉnh sửa
 * Lưu trữ và lấy lịch sử từ Supabase action_history table
 */

(function() {
    'use strict';
    
    const LOCAL_HISTORY_KEY = 'unicorns.action_history';
    const MEMORY_HISTORY_LIMIT = 500;
    const memoryHistory = [];

    /**
     * Ghi lại một hành động chỉnh sửa
     */
    async function recordAction(action) {
        const authUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;

        // Convert user.id to UUID if it's a valid UUID string, otherwise set to null
        let userId = null;
        if (authUser?.id) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(authUser.id)) {
                userId = authUser.id;
            } else {
                console.warn('[ActionHistory] user.id is not a valid UUID:', authUser.id);
            }
        }

        const actionRecord = {
            id: 'action_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
            user_id: userId,
            user_email: authUser?.email || action.userEmail || 'anonymous@local',
            user_role: authUser?.role || action.userRole || 'unknown',
            entity_type: action.entityType || 'unknown',
            entity_id: action.entityId || null,
            action_type: action.actionType || 'update', // 'create', 'update', 'delete', 'undo'
            before_value: clonePayload(action.beforeValue),
            after_value: clonePayload(action.afterValue),
            changed_fields: clonePayload(action.changedFields), // Chỉ cho update: { field1: { old: '...', new: '...' } }
            description: action.description || '',
            ip_address: action.ipAddress || 'restricted-by-csp',
            user_agent: action.userAgent || navigator.userAgent,
            created_at: new Date().toISOString()
        };

        // Lưu vào Supabase
        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            try {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase) {
                    const { error } = await supabase
                        .from('action_history')
                        .insert([{
                            id: actionRecord.id,
                            user_id: actionRecord.user_id,
                            user_email: actionRecord.user_email,
                            user_role: actionRecord.user_role,
                            entity_type: actionRecord.entity_type,
                            entity_id: actionRecord.entity_id,
                            action_type: actionRecord.action_type,
                            before_value: actionRecord.before_value,
                            after_value: actionRecord.after_value,
                            changed_fields: actionRecord.changed_fields,
                            description: actionRecord.description,
                            ip_address: actionRecord.ip_address,
                            user_agent: actionRecord.user_agent
                        }]);

                    // Tự động cleanup localStorage nếu có quá nhiều records
                    cleanupLocalStorageHistory();

                    if (error) {
                        console.warn('[ActionHistory] Failed to save to Supabase:', error);
                        // Fallback to localStorage
                        saveToLocalStorage(actionRecord);
                    }
                    return actionRecord;
                }
            } catch (e) {
                console.warn('[ActionHistory] Error saving to Supabase:', e);
            }
        }

        // Fallback to localStorage
        saveToLocalStorage(actionRecord);
        return actionRecord;
    }

    /**
     * Lưu vào localStorage (backup)
     */
    function saveToLocalStorage(record) {
        upsertMemoryHistory(record);
        try {
            const stored = localStorage.getItem(LOCAL_HISTORY_KEY);
            let history = stored ? JSON.parse(stored) : [];
            if (!Array.isArray(history)) history = [];

            history = upsertHistoryArray(history, record);
            history = filterHistoryWindow(history);

            localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
            syncMemoryFromList(history);
        } catch (e) {
            console.warn('[ActionHistory] Failed to save to localStorage:', e);
        }
    }

    /**
     * Cleanup localStorage: Xóa các record cũ hơn 30 ngày
     */
    function cleanupLocalStorageHistory() {
        try {
            const stored = localStorage.getItem(LOCAL_HISTORY_KEY);
            if (!stored) return;
            
            let history = JSON.parse(stored);
            if (!Array.isArray(history)) history = [];

            const filteredHistory = filterHistoryWindow(history);
            localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(filteredHistory));
            syncMemoryFromList(filteredHistory);
        } catch (e) {
            console.warn('[ActionHistory] Failed to cleanup localStorage:', e);
            cleanupMemoryHistory();
        }
    }

    /**
     * Lấy lịch sử hành động với filter
     */
    async function getActionHistory(filters = {}) {
        const {
            entityType = null,
            entityId = null,
            userId = null,
            actionType = null,
            startDate = null,
            endDate = null,
            limit = 100,
            offset = 0
        } = filters;

        const user = window.UniAuth?.getCurrentUser();
        const isAdmin = user?.role === 'admin';

        // Nếu không phải admin, chỉ lấy lịch sử của chính user đó
        const effectiveUserId = isAdmin ? userId : (userId || user?.id);

        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            try {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase) {
                    let query = supabase
                        .from('action_history')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .range(offset, offset + limit - 1);

                    if (entityType) {
                        query = query.eq('entity_type', entityType);
                    }
                    if (entityId) {
                        query = query.eq('entity_id', entityId);
                    }
                    if (effectiveUserId) {
                        query = query.eq('user_id', effectiveUserId);
                    }
                    if (actionType) {
                        query = query.eq('action_type', actionType);
                    }
                    if (startDate) {
                        query = query.gte('created_at', startDate);
                    } else {
                        // Mặc định chỉ lấy 30 ngày gần nhất
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        query = query.gte('created_at', thirtyDaysAgo.toISOString());
                    }
                    if (endDate) {
                        query = query.lte('created_at', endDate);
                    }

                    const { data, error } = await query;

                    if (error) {
                        console.warn('[ActionHistory] Error fetching from Supabase:', error);
                        return getLocalActionHistory(filters);
                    }

                    return data || [];
                }
            } catch (e) {
                console.warn('[ActionHistory] Error fetching from Supabase:', e);
            }
        }

        return getLocalActionHistory(filters);
    }

    /**
     * Lấy lịch sử từ localStorage (fallback)
     */
    function getLocalActionHistory(filters = {}) {
        try {
            let history = null;
            try {
                const stored = localStorage.getItem(LOCAL_HISTORY_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    history = Array.isArray(parsed) ? parsed : [];
                }
            } catch (storageError) {
                console.warn('[ActionHistory] Unable to read localStorage, using memory fallback', storageError);
                history = null;
            }
            
            if (history) {
                history = filterHistoryWindow(history);
                syncMemoryFromList(history);
            } else {
                history = filterHistoryWindow([...memoryHistory]);
            }
            
            // Apply filters
            if (filters.entityType) {
                history = history.filter(h => h.entity_type === filters.entityType);
            }
            if (filters.entityId) {
                history = history.filter(h => h.entity_id === filters.entityId);
            }
            if (filters.userId) {
                history = history.filter(h => h.user_id === filters.userId);
            }
            if (filters.actionType) {
                history = history.filter(h => h.action_type === filters.actionType);
            }
            if (filters.startDate) {
                const start = new Date(filters.startDate);
                history = history.filter(h => new Date(h.created_at) >= start);
            }
            if (filters.endDate) {
                const end = new Date(filters.endDate);
                history = history.filter(h => new Date(h.created_at) <= end);
            }
            
            // Sort by created_at descending
            history.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            });
            
            // Limit
            const limit = filters.limit || 100;
            const offset = filters.offset || 0;
            return history.slice(offset, offset + limit);
        } catch (e) {
            console.error('[ActionHistory] Error getting local history:', e);
            return filterHistoryWindow([...memoryHistory]);
        }
    }

    /**
     * Undo một hành động cụ thể
     */
    async function undoAction(actionId) {
        const user = window.UniAuth?.getCurrentUser();
        const isAdmin = user?.role === 'admin';

        if (!isAdmin) {
            return {
                success: false,
                message: 'Chỉ admin mới có thể thực hiện undo'
            };
        }

        // Lấy thông tin hành động
        const history = await getActionHistory({ limit: 1000 });
        const action = history.find(a => a.id === actionId);

        if (!action) {
            return {
                success: false,
                message: 'Không tìm thấy hành động'
            };
        }

        if (!action.before_value) {
            return {
                success: false,
                message: 'Không thể undo: thiếu dữ liệu trước khi thay đổi'
            };
        }

        try {
            // Khôi phục dữ liệu từ before_value
            const { entity: beforeData, related } = extractEntitySnapshot(action.before_value);
            const entityType = action.entity_type;
            const entityId = action.entity_id;

            // Tìm collection tương ứng
            const collectionKey = entityType === 'student' ? 'students' :
                                 entityType === 'teacher' ? 'teachers' :
                                 entityType === 'class' ? 'classes' :
                                 entityType + 's';

            const collection = window.demo[collectionKey];
            if (!Array.isArray(collection)) {
                return {
                    success: false,
                    message: `Không tìm thấy collection: ${collectionKey}`
                };
            }

            // Tạo snapshot hiện tại trước khi undo
            const currentValue = collection.find(item => item.id === entityId);
            
            // Khôi phục dữ liệu
            if (action.action_type === 'delete') {
                // Nếu là delete, khôi phục lại entity
                collection.push({ ...beforeData });
            } else if (action.action_type === 'create') {
                // Nếu là create, xóa entity
                const index = collection.findIndex(item => item.id === entityId);
                if (index !== -1) {
                    collection.splice(index, 1);
                }
            } else {
                // Nếu là update, thay thế bằng before_value
                const index = collection.findIndex(item => item.id === entityId);
                if (index !== -1) {
                    collection[index] = { ...beforeData };
                } else {
                    // Entity không tồn tại, thêm lại
                    collection.push({ ...beforeData });
                }
            }

            // Khôi phục dữ liệu liên quan (studentClasses, attendance, ...)
            const extraSupabaseEntities = restoreRelatedData(entityType, related);

            // Đồng bộ với Supabase
            if (window.UniData && window.UniData.save) {
                const supabaseEntities = extraSupabaseEntities || {};
                let supabaseDeletes = null;

                if (action.action_type === 'create') {
                    supabaseDeletes = {
                        [collectionKey]: [entityId]
                    };
                } else {
                    const entityToSync = collection.find(item => item.id === entityId);
                    if (entityToSync) {
                        supabaseEntities[collectionKey] = [entityToSync];
                    }
                }

                const payload = { skipAudit: true };
                if (Object.keys(supabaseEntities).length > 0) {
                    payload.supabaseEntities = supabaseEntities;
                }
                if (supabaseDeletes) {
                    payload.supabaseDeletes = supabaseDeletes;
                }
                if (payload.supabaseEntities || payload.supabaseDeletes) {
                    await window.UniData.save(payload);
                }
            }

            // Lưu local snapshot để UI khác có thể đọc ngay
            try {
                localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
            } catch (storageError) {
                console.warn('[ActionHistory] Failed to persist local snapshot after undo', storageError);
            }

            // Ghi lại hành động undo
            await recordAction({
                entityType: action.entity_type,
                entityId: action.entity_id,
                actionType: 'undo',
                beforeValue: currentValue || null,
                afterValue: beforeData,
                description: `Undo: ${action.description || action.action_type}`,
                changedFields: null
            });

            // Refresh UI
            if (window.UniUI && window.UniUI.refreshCurrentPage) {
                setTimeout(() => {
                    window.UniUI.refreshCurrentPage();
                }, 300);
            }

            return {
                success: true,
                message: `Đã khôi phục: ${action.description || action.action_type}`
            };
        } catch (e) {
            console.error('[ActionHistory] Undo failed:', e);
            return {
                success: false,
                message: 'Lỗi khi khôi phục: ' + e.message
            };
        }
    }

    /**
     * Lấy lịch sử của một entity cụ thể
     */
    async function getEntityHistory(entityType, entityId, limit = 50) {
        return getActionHistory({
            entityType,
            entityId,
            limit
        });
    }

    /**
     * So sánh 2 object và trả về các field bị thay đổi
     */
    function getChangedFields(before, after) {
        if (!before || !after) return null;
        
        const changed = {};
        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
        
        allKeys.forEach(key => {
            const beforeVal = before[key];
            const afterVal = after[key];
            
            // So sánh deep (đơn giản)
            if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                changed[key] = {
                    old: beforeVal,
                    new: afterVal
                };
            }
        });
        
        return Object.keys(changed).length > 0 ? changed : null;
    }

    function clonePayload(payload) {
        if (payload === undefined || payload === null) return payload ?? null;
        try {
            return JSON.parse(JSON.stringify(payload));
        } catch (e) {
            console.warn('[ActionHistory] Failed to clone payload', e);
            return payload;
        }
    }

    function extractEntitySnapshot(beforeValue) {
        if (!beforeValue) return { entity: null, related: null };
        const snapshot = clonePayload(beforeValue);
        if (snapshot && typeof snapshot === 'object' && snapshot.__related) {
            const related = snapshot.__related;
            delete snapshot.__related;
            return { entity: snapshot, related };
        }
        return { entity: snapshot, related: null };
    }

    function restoreRelatedData(entityType, related) {
        if (!related) return {};
        const supabaseEntities = {};

        if (entityType === 'student') {
            restoreCollectionRecords('studentClasses', related.studentClasses, 'studentClasses', supabaseEntities);
            restoreCollectionRecords('attendance', related.attendance || related.attendanceRecords, 'attendance', supabaseEntities);
            restoreCollectionRecords('walletTransactions', related.walletTransactions, 'walletTransactions', supabaseEntities);
            restoreCollectionRecords('payments', related.payments, 'payments', supabaseEntities);
        }

        return supabaseEntities;
    }

    function restoreCollectionRecords(localKey, records, supabaseKey, supabaseEntities = {}) {
        if (!Array.isArray(records) || records.length === 0) return;
        window.demo[localKey] = window.demo[localKey] || [];
        const collection = window.demo[localKey];
        const existingIds = new Set(collection.map(item => item.id));
        const toInsert = [];

        records.forEach(record => {
            if (!record || !record.id) return;
            if (existingIds.has(record.id)) return;
            const clone = clonePayload(record);
            collection.push(clone);
            existingIds.add(record.id);
            toInsert.push(clone);
        });

        if (toInsert.length > 0) {
            supabaseEntities[supabaseKey || localKey] = toInsert;
        }
    }

    /**
     * Helpers for local/memory cache
     */
    function upsertMemoryHistory(record) {
        const index = memoryHistory.findIndex(item => item.id === record.id);
        if (index !== -1) {
            memoryHistory[index] = record;
        } else {
            memoryHistory.push(record);
        }
        cleanupMemoryHistory();
    }

    function syncMemoryFromList(list) {
        if (!Array.isArray(list)) return;
        memoryHistory.length = 0;
        memoryHistory.push(...filterHistoryWindow(list));
    }

    function cleanupMemoryHistory() {
        const filtered = filterHistoryWindow([...memoryHistory]);
        memoryHistory.length = 0;
        memoryHistory.push(...filtered);
    }

    function upsertHistoryArray(list, record) {
        const next = Array.isArray(list) ? [...list] : [];
        const index = next.findIndex(item => item.id === record.id);
        if (index !== -1) {
            next[index] = record;
        } else {
            next.push(record);
        }
        return next;
    }

    function filterHistoryWindow(list) {
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 30);
        const filtered = (list || []).filter(entry => {
            if (!entry) return false;
            if (!entry.created_at) return true;
            const recordDate = new Date(entry.created_at);
            if (Number.isNaN(recordDate.getTime())) return true;
            return recordDate >= limitDate;
        });
        if (filtered.length > MEMORY_HISTORY_LIMIT) {
            return filtered.slice(filtered.length - MEMORY_HISTORY_LIMIT);
        }
        return filtered;
    }

    // Export API
    window.ActionHistoryService = {
        recordAction,
        getActionHistory,
        getEntityHistory,
        undoAction,
        getChangedFields
    };
})();

