/**
 * App Initialization
 * 
 * This file initializes application configuration and services.
 * 
 * SECURITY NOTE: Contains Supabase credentials. In production, these should be
 * loaded from environment variables or a secure backend.
 * 
 * IMPORTANT: Ensure Row Level Security (RLS) is enabled on all Supabase tables!
 */

(function() {
    'use strict';
    
    // Try to load from environment variables first (if using build tool)
    const getEnvVar = (name, fallback) => {
        // Check for Vite environment variables (check if import.meta exists)
        try {
            if (typeof window !== 'undefined' && window.import && window.import.meta && window.import.meta.env) {
                return window.import.meta.env[name] || fallback;
            }
        } catch (e) {
            // import.meta not available
        }
        // Check for Node.js environment variables (if server-side)
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name] || fallback;
        }
        // Check for window environment (if injected by build process)
        if (typeof window !== 'undefined' && window.__ENV__) {
            return window.__ENV__[name] || fallback;
        }
        return fallback;
    };
    
    // Load from environment variables or use fallback
    // SECURITY: In production, these should NEVER be hardcoded
    const SUPABASE_URL = getEnvVar('VITE_SUPABASE_URL', getEnvVar('SUPABASE_URL', 'https://vfbmdmspxkaatwzuprbt.supabase.co'));
    const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY', getEnvVar('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmYm1kbXNweGthYXR3enVwcmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjQxMjksImV4cCI6MjA3ODEwMDEyOX0.w0xqmMagye_JCUBlNKgIFEHk88XUCibIEXyo9skVy2c'));
    
    // Check if we're in production and credentials are hardcoded
    const isProduction = typeof window !== 'undefined' && 
        window.location && 
        !['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
    
    if (isProduction && !getEnvVar('VITE_SUPABASE_URL', null) && !getEnvVar('SUPABASE_URL', null)) {
        console.warn('⚠️ SECURITY WARNING: Supabase credentials are hardcoded in production!');
        console.warn('⚠️ Please use environment variables or a secure backend to load credentials.');
        console.warn('⚠️ Ensure Row Level Security (RLS) is enabled on all Supabase tables!');
    }
    
    window.SUPABASE_CONFIG = {
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        enabled: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
    };
    
    // Prevent accidental exposure in console
    Object.defineProperty(window.SUPABASE_CONFIG, 'anonKey', {
        enumerable: true,
        configurable: false,
        get: function() {
            return SUPABASE_ANON_KEY;
        },
        set: function() {
            console.warn('⚠️ Cannot modify SUPABASE_CONFIG.anonKey');
        }
    });
})();

