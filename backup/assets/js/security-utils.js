/**
 * security-utils.js - Security utilities for input sanitization and validation
 * 
 * This module provides functions to sanitize user input and prevent XSS attacks
 */

(function() {
    'use strict';

    const DEFAULT_SENSITIVE_KEYS = [
        'unicorns.users',
        'unicorns.token',
        'unicorns.data',
        'unicorns.auditLogs',
        'unicorns.backup',
        'unicorns.lastBackup',
        'unicorns.dashboard.state'
    ];

    const DEFAULT_SENSITIVE_PREFIXES = [
        'cskh_default_profit_',
        'cskh_payment_',
        'auditlog_'
    ];

    const SafeStorage = {
        _initialized: false,
        _patched: false,
        _loggedKeys: new Set(),
        mode: 'dev',
        isProd: false,
        blockSensitiveInProd: true,
        sensitiveKeys: new Set(DEFAULT_SENSITIVE_KEYS),
        sensitivePrefixes: [...DEFAULT_SENSITIVE_PREFIXES],

        init(options = {}) {
            if (this._initialized) return;

            this.mode = (options.mode || getAppMode()).toLowerCase();
            this.isProd = this.mode === 'prod';
            this.blockSensitiveInProd = options.blockSensitiveInProd !== undefined
                ? !!options.blockSensitiveInProd
                : !window.ALLOW_SENSITIVE_LOCAL_CACHE;

            if (Array.isArray(options.extraSensitiveKeys)) {
                options.extraSensitiveKeys.forEach(key => this.registerSensitiveKey(key));
            }

            if (Array.isArray(options.extraSensitivePrefixes)) {
                options.extraSensitivePrefixes.forEach(prefix => this.registerSensitivePrefix(prefix));
            }

            this.hasNativeStorage = supportsLocalStorage();

            if (this.isProd && this.blockSensitiveInProd && this.hasNativeStorage) {
                this.purgeSensitiveKeys();
                this.patchLocalStorage();
            }

            this._initialized = true;

            if (this.isProd && this.blockSensitiveInProd) {
                console.log('[SafeStorage] Production mode detected - sensitive localStorage keys disabled.');
            } else {
                console.log('[SafeStorage] Dev/offline mode - sensitive localStorage keys allowed.');
            }
        },

        registerSensitiveKey(key) {
            if (!key || typeof key !== 'string') return;
            this.sensitiveKeys.add(key);
        },

        registerSensitivePrefix(prefix) {
            if (!prefix || typeof prefix !== 'string') return;
            if (!this.sensitivePrefixes.includes(prefix)) {
                this.sensitivePrefixes.push(prefix);
            }
        },

        canPersistKey(key) {
            if (!this.isProd || !this.blockSensitiveInProd) return true;
            
            // Special handling for unicorns.data:
            // - Allow in dev mode
            // - Allow if Supabase is not enabled (need local cache for offline)
            // - Block only if Supabase is enabled AND in production (can sync from Supabase)
            if (key === 'unicorns.data') {
                const hasSupabase = window.SupabaseAdapter && window.SupabaseAdapter.isEnabled;
                if (!hasSupabase) {
                    return true; // Need local cache if no Supabase
                }
                // If Supabase enabled, block in production (can sync from Supabase)
                return false;
            }
            
            return !this.isSensitiveKey(key);
        },

        isSensitiveKey(key) {
            if (!key || typeof key !== 'string') return false;
            if (this.sensitiveKeys.has(key)) return true;
            return this.sensitivePrefixes.some(prefix => key.startsWith(prefix));
        },

        purgeSensitiveKeys() {
            if (!this.hasNativeStorage) return;
            try {
                for (let index = localStorage.length - 1; index >= 0; index--) {
                    const key = localStorage.key(index);
                    if (this.isSensitiveKey(key)) {
                        localStorage.removeItem(key);
                        this._loggedKeys.add(key);
                    }
                }
                console.log('[SafeStorage] Cleared sensitive localStorage cache for production.');
            } catch (error) {
                console.warn('[SafeStorage] Failed to purge sensitive keys:', error);
            }
        },

        patchLocalStorage() {
            if (this._patched || !this.hasNativeStorage) return;

            const nativeSetItem = localStorage.setItem.bind(localStorage);
            const nativeRemoveItem = localStorage.removeItem.bind(localStorage);
            const nativeClear = localStorage.clear.bind(localStorage);
            const self = this;

            localStorage.setItem = function(key, value) {
                if (self.isSensitiveKey(key)) {
                    if (!self._loggedKeys.has(key)) {
                        console.warn(`[SafeStorage] Blocked setItem for sensitive key "${key}" (APP_MODE=prod).`);
                        self._loggedKeys.add(key);
                    }
                    return;
                }
                return nativeSetItem(key, value);
            };

            localStorage.removeItem = function(key) {
                return nativeRemoveItem(key);
            };

            localStorage.clear = function() {
                const preserved = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!self.isSensitiveKey(key)) {
                        preserved.push({ key, value: localStorage.getItem(key) });
                    }
                }
                nativeClear();
                preserved.forEach(entry => nativeSetItem(entry.key, entry.value));
            };

            this._patched = true;
        }
    };

    /**
     * Detect current app mode.
     * Default: dev on localhost, prod otherwise (can be overridden via window.APP_MODE)
     */
    function getAppMode() {
        if (typeof window === 'undefined') return 'prod';
        if (window.APP_MODE) return window.APP_MODE;

        const hostname = window.location?.hostname || '';
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'dev';
        }
        return 'prod';
    }

    /**
     * Check if localStorage is available (respecting private mode restrictions)
     */
    function supportsLocalStorage() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            const testKey = '__safe_storage_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('[SafeStorage] localStorage not available:', error);
            return false;
        }
    }

    /**
     * Sanitize HTML string to prevent XSS
     * Removes potentially dangerous HTML tags and attributes
     */
    function sanitizeHTML(str) {
        if (!str || typeof str !== 'string') return '';
        
        // Create a temporary div element
        const div = document.createElement('div');
        div.textContent = str; // This automatically escapes HTML
        return div.innerHTML;
    }

    /**
     * Sanitize input string
     * Removes XSS characters and dangerous patterns
     */
    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers (onclick=, onerror=, etc.)
            .replace(/data:text\/html/gi, '') // Remove data:text/html
            .replace(/vbscript:/gi, ''); // Remove vbscript: protocol
    }

    /**
     * Validate email format
     */
    function validateEmail(email) {
        if (!email || typeof email !== 'string') return false;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const sanitized = email.trim();
        
        // Check format
        if (!emailRegex.test(sanitized)) return false;
        
        // Check length (RFC 5321)
        if (sanitized.length > 254) return false;
        
        // Check local part length (before @)
        const localPart = sanitized.split('@')[0];
        if (localPart.length > 64) return false;
        
        return true;
    }

    /**
     * Validate phone number (Vietnamese format)
     */
    function validatePhone(phone) {
        if (!phone || typeof phone !== 'string') return false;
        
        const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
        const cleaned = phone.replace(/\s|-/g, '');
        
        return phoneRegex.test(cleaned) && cleaned.length <= 15;
    }

    /**
     * Validate password strength
     */
    function validatePasswordStrength(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, errors: ['Mật khẩu không được để trống'] };
        }
        
        const errors = [];
        const pwd = password.trim();
        
        // Minimum length
        if (pwd.length < 8) {
            errors.push('Mật khẩu phải có ít nhất 8 ký tự');
        }
        
        // Maximum length (prevent DoS)
        if (pwd.length > 128) {
            errors.push('Mật khẩu không được vượt quá 128 ký tự');
        }
        
        // Must have uppercase
        if (!/[A-Z]/.test(pwd)) {
            errors.push('Mật khẩu phải có ít nhất 1 chữ hoa');
        }
        
        // Must have lowercase
        if (!/[a-z]/.test(pwd)) {
            errors.push('Mật khẩu phải có ít nhất 1 chữ thường');
        }
        
        // Must have number
        if (!/[0-9]/.test(pwd)) {
            errors.push('Mật khẩu phải có ít nhất 1 số');
        }
        
        // Must have special character
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
            errors.push('Mật khẩu phải có ít nhất 1 ký tự đặc biệt');
        }
        
        // Check for common weak passwords
        const commonPasswords = ['12345678', 'password', '123456789', '1234567890', 'qwerty123'];
        if (commonPasswords.includes(pwd.toLowerCase())) {
            errors.push('Mật khẩu quá phổ biến, vui lòng chọn mật khẩu khác');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Sanitize SQL input (for display only, not for queries)
     * Note: Supabase uses parameterized queries, so this is just for display
     */
    function sanitizeForDisplay(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Validate and sanitize name
     */
    function validateName(name) {
        if (!name || typeof name !== 'string') return { valid: false, error: 'Tên không được để trống' };
        
        const sanitized = name.trim();
        
        if (sanitized.length < 2) {
            return { valid: false, error: 'Tên phải có ít nhất 2 ký tự' };
        }
        
        if (sanitized.length > 100) {
            return { valid: false, error: 'Tên không được vượt quá 100 ký tự' };
        }
        
        // Check for dangerous characters
        if (/[<>]/.test(sanitized)) {
            return { valid: false, error: 'Tên không được chứa ký tự < hoặc >' };
        }
        
        return { valid: true, sanitized: sanitized };
    }

    /**
     * Escape special characters for regex
     */
    function escapeRegex(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Check if string contains SQL injection patterns
     * Note: This is a basic check. Supabase uses parameterized queries which is the real protection.
     */
    function containsSQLInjection(input) {
        if (typeof input !== 'string') return false;
        
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
            /(--|;|\/\*|\*\/|'|"|`)/,
            /(UNION.*SELECT|OR.*=.*|AND.*=.*)/i
        ];
        
        return sqlPatterns.some(pattern => pattern.test(input));
    }

    // Export functions
    window.SecurityUtils = {
        sanitizeHTML,
        sanitizeInput,
        validateEmail,
        validatePhone,
        validatePasswordStrength,
        sanitizeForDisplay,
        validateName,
        escapeRegex,
        containsSQLInjection,
        getAppMode,
        SafeStorage
    };

    window.SafeStorage = SafeStorage;

    // Initialize SafeStorage immediately so it can intercept localStorage writes
    SafeStorage.init();

    console.log('✅ Security utilities loaded');
})();

