/**
 * auth-security-enhanced.js - Client-side security helpers
 * Provides basic rate limiting, password strength validation, and session helpers
 */

(function() {
    'use strict';

    if (window.UniAuthSecurity) {
        return; // Prevent double initialization
    }

    const STORAGE_KEY = 'unicorns.login_attempts';
    const DEFAULT_CONFIG = {
        MAX_LOGIN_ATTEMPTS: 5,
        RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
        LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
        DEBUG: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    };

    function loadAttempts() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            console.warn('Unable to load login attempts:', error);
            return {};
        }
    }

    function saveAttempts(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn('Unable to save login attempts:', error);
        }
    }

    function getIdentifier(identifier) {
        return String(identifier || '').trim().toLowerCase();
    }

    function cleanupOldAttempts(record, config) {
        const now = Date.now();
        record.attempts = (record.attempts || []).filter(ts => now - ts < config.RATE_LIMIT_WINDOW);
        return record;
    }

    async function secureLogin(identifier, password, loginFn, config = DEFAULT_CONFIG) {
        const key = getIdentifier(identifier);
        if (!key) {
            return loginFn(identifier, password);
        }
        
        const attempts = loadAttempts();
        const record = cleanupOldAttempts(attempts[key] || { attempts: [] }, config);
        const now = Date.now();
        
        if (record.lockUntil && record.lockUntil > now) {
            const remainingMs = record.lockUntil - now;
            const minutesLeft = Math.max(1, Math.ceil(remainingMs / 60000));
            throw new Error(`Tài khoản bị khóa tạm thời. Vui lòng thử lại sau ${minutesLeft} phút.`);
        }
        
        if (record.attempts.length >= config.MAX_LOGIN_ATTEMPTS) {
            record.lockUntil = now + config.LOCKOUT_DURATION;
            attempts[key] = record;
            saveAttempts(attempts);
            const lockoutMinutes = Math.max(1, Math.ceil(config.LOCKOUT_DURATION / 60000));
            throw new Error(`Quá nhiều lần thử đăng nhập. Vui lòng đợi ${lockoutMinutes} phút và thử lại.`);
        }
        
        // Register tentative attempt
        record.attempts.push(now);
        attempts[key] = record;
        saveAttempts(attempts);
        
        try {
            const result = await loginFn(identifier, password);
            delete attempts[key];
            saveAttempts(attempts);
            return result;
        } catch (error) {
            if (config.DEBUG) {
                console.warn('secureLogin error:', error);
            }
            throw error;
        }
    }

    function validatePasswordStrength(password, email, name) {
        if (window.SecurityUtils && window.SecurityUtils.validatePasswordStrength) {
            return window.SecurityUtils.validatePasswordStrength(password, email, name);
        }
        
        const errors = [];
        if (!password || password.length < 8) {
            errors.push('Mật khẩu phải có ít nhất 8 ký tự');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Mật khẩu phải có chữ hoa');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Mật khẩu phải có chữ thường');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Mật khẩu phải có số');
        }
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Mật khẩu phải có ký tự đặc biệt');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }

    function clearSession() {
        try {
            localStorage.removeItem('unicorns.token');
            sessionStorage.clear();
        } catch (error) {
            console.warn('Unable to clear session:', error);
        }
    }

    function secureLogout(callback) {
        clearSession();
        if (typeof callback === 'function') {
            callback();
        }
    }

    function clearAllLoginAttempts() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn('Unable to clear login attempts:', error);
        }
    }

    function debugLoginStatus(identifier) {
        if (!(DEFAULT_CONFIG.DEBUG)) return;
        const key = getIdentifier(identifier);
        const attempts = loadAttempts();
        console.log('🔐 Login status:', { key, record: attempts[key] });
    }

    window.UniAuthSecurity = {
        secureLogin,
        secureLogout,
        validatePasswordStrength,
        clearSession,
        clearAllLoginAttempts,
        debugLoginStatus
    };
})();