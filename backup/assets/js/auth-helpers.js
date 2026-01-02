/**
 * auth-helpers.js - Password hashing and authentication utilities
 * 
 * Note: In browser environment, we use Web Crypto API for hashing.
 * For production, consider using Supabase Auth or a backend service with bcrypt/argon2.
 */

(function() {
    'use strict';

    /**
     * Hash password using Web Crypto API (SHA-256)
     * In production, this should be done on the backend with bcrypt/argon2
     */
    async function hashPassword(password) {
        if (!password) return null;
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (error) {
            console.error('Error hashing password:', error);
            // Fallback: return plaintext (NOT SECURE - chỉ dùng cho development)
            return password;
        }
    }

    /**
     * Detect hash type from stored password
     * Returns: 'bcrypt', 'sha256', or 'plaintext'
     */
    function detectHashType(storedPassword) {
        if (!storedPassword || typeof storedPassword !== 'string') return 'plaintext';
        
        // bcrypt hash: starts with $2a$, $2b$, or $2y$, followed by cost, then 53 chars
        if (/^\$2[aby]\$\d{2}\$[./0-9A-Za-z]{53}$/.test(storedPassword)) {
            return 'bcrypt';
        }
        
        // SHA-256 hash: 64 hex characters
        if (/^[0-9a-f]{64}$/i.test(storedPassword)) {
            return 'sha256';
        }
        
        // Plaintext (fallback)
        return 'plaintext';
    }

    /**
     * Verify password against hash
     * Supports bcrypt, SHA-256, and plaintext passwords
     * QUAN TRỌNG: Phải dùng await khi gọi hàm này
     */
    async function verifyPassword(password, storedPassword) {
        if (!password || !storedPassword) return false;
        
        // Trim và loại bỏ ký tự vô hình
        password = String(password).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        storedPassword = String(storedPassword).trim();
        
        if (!password || !storedPassword) return false;
        
        try {
            const hashType = detectHashType(storedPassword);
            
            if (hashType === 'bcrypt') {
                // Dùng bcryptjs.compare() để verify bcrypt hash
                // bcryptjs.compare() là callback-based, cần wrap trong Promise
                const bcryptLib = typeof bcryptjs !== 'undefined' ? bcryptjs : 
                                 typeof window.bcryptjs !== 'undefined' ? window.bcryptjs :
                                 typeof window.bcrypt !== 'undefined' ? window.bcrypt : null;
                
                if (bcryptLib && bcryptLib.compare) {
                    try {
                        const match = await new Promise((resolve, reject) => {
                            bcryptLib.compare(password, storedPassword, (err, result) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(result);
                                }
                            });
                        });
                        return match;
                    } catch (compareError) {
                        console.error('Error comparing password with bcrypt:', compareError);
                        return false;
                    }
                } else {
                    console.error('bcryptjs library not loaded');
                    return false;
                }
            } else if (hashType === 'sha256') {
                // SHA-256 hash: hash password input và so sánh
                const passwordHash = await hashPassword(password);
                
                // Debug logging (chỉ trong development)
                const isDebug = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (isDebug) {
                    console.log('🔍 SHA-256 verification details:', {
                        inputPassword: password,
                        inputPasswordLength: password.length,
                        computedHash: passwordHash,
                        computedHashLength: passwordHash?.length,
                        storedHash: storedPassword,
                        storedHashLength: storedPassword?.length,
                        match: passwordHash === storedPassword,
                        hashComparison: {
                            first10Chars: {
                                computed: passwordHash?.substring(0, 10),
                                stored: storedPassword?.substring(0, 10)
                            },
                            last10Chars: {
                                computed: passwordHash?.substring(-10),
                                stored: storedPassword?.substring(-10)
                            }
                        }
                    });
                }
                
                return passwordHash === storedPassword;
            } else {
                // Plaintext (fallback cho development)
                // KHÔNG nên dùng trong production
                return password === storedPassword;
            }
        } catch (error) {
            console.error('Error verifying password:', error);
            // Fallback: compare plaintext (NOT SECURE - chỉ dùng cho development)
            return password === storedPassword;
        }
    }

    /**
     * Hash password using bcrypt (preferred) or SHA-256 (fallback)
     * @param {string} password - Plain text password
     * @param {number} saltRounds - bcrypt salt rounds (default: 10)
     * @returns {Promise<string>} Hashed password
     */
    async function hashPasswordWithBcrypt(password, saltRounds = 10) {
        if (!password) return null;
        
        // Trim và loại bỏ ký tự vô hình
        password = String(password).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        try {
            // Ưu tiên dùng bcryptjs nếu có
            if (typeof bcryptjs !== 'undefined' && bcryptjs.hash) {
                const hash = await bcryptjs.hash(password, saltRounds);
                return hash;
            } else {
                // Fallback: dùng SHA-256
                console.warn('bcryptjs not available, using SHA-256');
                return await hashPassword(password);
            }
        } catch (error) {
            console.error('Error hashing password with bcrypt:', error);
            // Fallback: dùng SHA-256
            return await hashPassword(password);
        }
    }

    /**
     * Generate a simple JWT-like token (for client-side only)
     * In production, use proper JWT from backend
     */
    function generateToken(payload) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const encodedHeader = btoa(JSON.stringify(header));
        const encodedPayload = btoa(JSON.stringify(payload));
        const signature = btoa(JSON.stringify({ ...payload, timestamp: Date.now() }));
        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }

    /**
     * Decode token (client-side only, no verification)
     */
    function decodeToken(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            const payload = JSON.parse(atob(parts[1]));
            return payload;
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    }

    /**
     * Validate email format
     */
    function isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Validate phone number (Vietnamese format)
     */
    function isValidPhone(phone) {
        if (!phone || typeof phone !== 'string') return false;
        const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
        const cleaned = phone.replace(/\s|-/g, '');
        return phoneRegex.test(cleaned);
    }

    /**
     * Normalize phone number to standard format (0xxxxxxxxx)
     */
    function normalizePhone(phone) {
        if (!phone || typeof phone !== 'string') return null;
        const cleaned = phone.replace(/\s|-/g, '');
        if (cleaned.startsWith('+84')) {
            return '0' + cleaned.substring(3);
        }
        if (cleaned.startsWith('84')) {
            return '0' + cleaned.substring(2);
        }
        if (cleaned.startsWith('0')) {
            return cleaned;
        }
        return null;
    }

    /**
     * Generate a random reset token
     */
    function generateResetToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    window.UniAuthHelpers = {
        hashPassword, // SHA-256 (legacy)
        hashPasswordWithBcrypt, // bcrypt (preferred)
        verifyPassword,
        detectHashType,
        generateToken,
        decodeToken,
        isValidEmail,
        isValidPhone,
        normalizePhone,
        generateResetToken
    };
})();

