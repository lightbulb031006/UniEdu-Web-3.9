/**
 * audit-log.js - Audit logging for security and compliance
 * Logs all important security events to Supabase audit_logs table
 */

(function() {
    'use strict';

    /**
     * Log an event to audit_logs
     */
    async function logAuditEvent(event) {
        const user = window.UniAuth?.getCurrentUser();
        
        const auditEntry = {
            id: 'audit_' + Date.now() + '_' + Math.random().toString(36).slice(2),
            user_id: user?.id || null,
            user_email: user?.email || event.email || null,
            user_role: user?.role || null,
            action: event.action || 'unknown',
            resource_type: event.resource_type || null,
            resource_id: event.resource_id || null,
            ip_address: event.ip_address || await getClientIP(),
            user_agent: event.user_agent || navigator.userAgent,
            details: event.details || {},
            created_at: new Date().toISOString()
        };

        // Try to save to Supabase
        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            try {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase) {
                    const { error } = await supabase
                        .from('audit_logs')
                        .insert([{
                            id: auditEntry.id,
                            user_id: auditEntry.user_id,
                            user_email: auditEntry.user_email,
                            user_role: auditEntry.user_role,
                            action: auditEntry.action,
                            resource_type: auditEntry.resource_type,
                            resource_id: auditEntry.resource_id,
                            ip_address: auditEntry.ip_address,
                            user_agent: auditEntry.user_agent,
                            details: auditEntry.details
                        }]);

                    if (error) {
                        console.warn('Failed to log audit event to Supabase:', error);
                        // Fallback to localStorage
                        saveToLocalStorage(auditEntry);
                    } else {
                        // Success - also keep in localStorage as backup
                        saveToLocalStorage(auditEntry);
                    }
                    return;
                }
            } catch (e) {
                console.warn('Error logging to Supabase:', e);
            }
        }

        // Fallback to localStorage
        saveToLocalStorage(auditEntry);
    }

    /**
     * Save audit entry to localStorage (backup)
     */
    function saveToLocalStorage(entry) {
        try {
            const key = 'unicorns.audit_logs';
            const stored = localStorage.getItem(key);
            const logs = stored ? JSON.parse(stored) : [];
            
            logs.push(entry);
            
            // Keep only last 1000 entries
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            
            localStorage.setItem(key, JSON.stringify(logs));
        } catch (e) {
            console.error('Error saving audit log to localStorage:', e);
        }
    }

    /**
     * Get client IP (approximate)
     */
    async function getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Get audit logs (for admin view)
     */
    async function getAuditLogs(filters = {}) {
        const { action, resource_type, user_id, limit = 100 } = filters;

        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            try {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase) {
                    let query = supabase
                        .from('audit_logs')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(limit);

                    if (action) {
                        query = query.eq('action', action);
                    }
                    if (resource_type) {
                        query = query.eq('resource_type', resource_type);
                    }
                    if (user_id) {
                        query = query.eq('user_id', user_id);
                    }

                    const { data, error } = await query;

                    if (error) {
                        console.warn('Error fetching audit logs:', error);
                        return getLocalAuditLogs(filters);
                    }

                    return data || [];
                }
            } catch (e) {
                console.warn('Error fetching audit logs from Supabase:', e);
            }
        }

        return getLocalAuditLogs(filters);
    }

    /**
     * Get audit logs from localStorage
     */
    function getLocalAuditLogs(filters = {}) {
        try {
            const key = 'unicorns.audit_logs';
            const stored = localStorage.getItem(key);
            if (!stored) return [];
            
            let logs = JSON.parse(stored);
            
            // Apply filters
            if (filters.action) {
                logs = logs.filter(log => log.action === filters.action);
            }
            if (filters.resource_type) {
                logs = logs.filter(log => log.resource_type === filters.resource_type);
            }
            if (filters.user_id) {
                logs = logs.filter(log => log.user_id === filters.user_id);
            }
            
            // Sort by created_at descending
            logs.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeB - timeA;
            });
            
            // Limit
            if (filters.limit) {
                logs = logs.slice(0, filters.limit);
            }
            
            return logs;
        } catch (e) {
            console.error('Error getting local audit logs:', e);
            return [];
        }
    }

    /**
     * Get security events (failed logins, lockouts, etc.)
     */
    async function getSecurityEvents(limit = 50) {
        return getAuditLogs({
            action: ['login_failed', 'account_locked', 'password_reset', 'password_changed'],
            limit
        });
    }

    // Export
    window.UniAuditLog = {
        log: logAuditEvent,
        getLogs: getAuditLogs,
        getSecurityEvents,
        getLocalLogs: getLocalAuditLogs
    };
})();
