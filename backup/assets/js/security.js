/**
 * security.js - Security utilities and checks
 * Handles HTTPS enforcement, CSP, CSRF protection, and other security features
 */

(function() {
    'use strict';

    /**
     * Enforce HTTPS (except localhost)
     */
    function enforceHTTPS() {
        if (location.protocol !== 'https:' && 
            location.hostname !== 'localhost' && 
            location.hostname !== '127.0.0.1' &&
            !location.hostname.startsWith('192.168.') &&
            !location.hostname.startsWith('10.') &&
            !location.hostname.endsWith('.local')) {
            console.warn('⚠️ HTTPS required. Redirecting...');
            location.replace('https:' + window.location.href.substring(window.location.protocol.length));
        }
    }

    /**
     * Generate CSRF token
     */
    function generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get or create CSRF token
     */
    function getCSRFToken() {
        const TOKEN_KEY = 'unicorns.csrf_token';
        let token = sessionStorage.getItem(TOKEN_KEY);
        if (!token) {
            token = generateCSRFToken();
            sessionStorage.setItem(TOKEN_KEY, token);
        }
        return token;
    }

    /**
     * Verify CSRF token
     */
    function verifyCSRFToken(token) {
        const storedToken = sessionStorage.getItem('unicorns.csrf_token');
        return storedToken && storedToken === token;
    }

    /**
     * Add CSRF token to fetch requests
     */
    function addCSRFToHeaders(headers = {}) {
        const token = getCSRFToken();
        return {
            ...headers,
            'X-CSRF-Token': token
        };
    }

    /**
     * Sanitize HTML to prevent XSS
     */
    function sanitizeHTML(html) {
        if (typeof html !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    /**
     * Escape HTML entities
     */
    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return str.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Validate and sanitize input
     */
    function sanitizeInput(input, type = 'text') {
        if (input === null || input === undefined) return '';
        if (typeof input !== 'string') input = String(input);
        
        // Trim whitespace
        input = input.trim();
        
        // Type-specific sanitization
        switch (type) {
            case 'email':
                // Remove any HTML tags
                input = input.replace(/<[^>]*>/g, '');
                // Remove invalid characters
                input = input.replace(/[^\w@.-]/g, '');
                break;
            case 'phone':
                // Remove any HTML tags
                input = input.replace(/<[^>]*>/g, '');
                // Keep only digits, +, spaces, and hyphens
                input = input.replace(/[^\d+\s-]/g, '');
                break;
            case 'number':
                // Remove any non-numeric characters
                input = input.replace(/[^\d.-]/g, '');
                break;
            case 'url':
                // Basic URL validation
                try {
                    const url = new URL(input);
                    return url.href;
                } catch {
                    return '';
                }
            default:
                // Remove HTML tags for text
                input = input.replace(/<[^>]*>/g, '');
        }
        
        return input;
    }

    /**
     * Check if running in secure context
     */
    function isSecureContext() {
        return window.isSecureContext || location.protocol === 'https:';
    }

    /**
     * Initialize security features
     */
    function initSecurity() {
        // Enforce HTTPS
        enforceHTTPS();
        
        // Generate CSRF token on page load
        getCSRFToken();
        
        // Log security warnings in development
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            console.log('🔒 Security features initialized');
            if (!isSecureContext()) {
                console.warn('⚠️ Not running in secure context (HTTPS required for production)');
            }
        }
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSecurity);
    } else {
        initSecurity();
    }

    // Export
    window.UniSecurity = {
        enforceHTTPS,
        getCSRFToken,
        verifyCSRFToken,
        addCSRFToHeaders,
        sanitizeHTML,
        escapeHTML,
        sanitizeInput,
        isSecureContext,
        initSecurity
    };
})();

