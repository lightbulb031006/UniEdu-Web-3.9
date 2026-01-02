/**
 * password-reset.js - Password reset functionality
 */

(function() {
    'use strict';

    /**
     * Request password reset
     */
    async function requestPasswordReset(email) {
        if (!email || !window.UniAuthHelpers?.isValidEmail(email)) {
            throw new Error('Email không hợp lệ');
        }

        // Sanitize email
        const sanitizedEmail = window.UniSecurity?.sanitizeInput 
            ? window.UniSecurity.sanitizeInput(email, 'email')
            : email.trim().toLowerCase();

        try {
            // Check if user exists
            if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase) {
                    // Query user by email
                    const { data: users, error } = await supabase
                        .from('users')
                        .select('id, email, name')
                        .eq('email', sanitizedEmail)
                        .eq('status', 'active')
                        .limit(1);

                    if (error) {
                        console.error('Error querying user:', error);
                        throw new Error('Không thể kiểm tra email. Vui lòng thử lại sau.');
                    }

                    if (!users || users.length === 0) {
                        // Don't reveal if email exists (security best practice)
                        return { success: true, message: 'Nếu email tồn tại, bạn sẽ nhận được link reset mật khẩu.' };
                    }

                    const user = users[0];
                    
                    // Generate reset token
                    const resetToken = window.UniAuthHelpers?.generateResetToken 
                        ? window.UniAuthHelpers.generateResetToken()
                        : Math.random().toString(36).slice(2) + Date.now().toString(36);
                    
                    // Set expiration (1 hour)
                    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

                    // Update user with reset token
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            reset_token: resetToken,
                            reset_token_expires: resetTokenExpires
                        })
                        .eq('id', user.id);

                    if (updateError) {
                        console.error('Error updating reset token:', updateError);
                        throw new Error('Không thể tạo reset token. Vui lòng thử lại sau.');
                    }

                    // TODO: Send email with reset link
                    // For now, log the token (in production, send via email service)
                    // Security: Only log in development
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        console.log('🔐 Reset token (DEV ONLY):', resetToken);
                        console.log('🔗 Reset link:', `${window.location.origin}${window.location.pathname}#auth?reset=${resetToken}`);
                    }

                    return {
                        success: true,
                        message: 'Nếu email tồn tại, bạn sẽ nhận được link reset mật khẩu.',
                        // In development, return token for testing
                        ...(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                            ? { devToken: resetToken, devLink: `${window.location.origin}${window.location.pathname}#auth?reset=${resetToken}` }
                            : {})
                    };
                }
            }

            // Fallback: local check
            const users = window.demo?.users || [];
            const user = users.find(u => u.email && u.email.toLowerCase() === sanitizedEmail);
            
            if (!user) {
                // Don't reveal if email exists
                return { success: true, message: 'Nếu email tồn tại, bạn sẽ nhận được link reset mật khẩu.' };
            }

            // Generate reset token
            const resetToken = window.UniAuthHelpers?.generateResetToken 
                ? window.UniAuthHelpers.generateResetToken()
                : Math.random().toString(36).slice(2) + Date.now().toString(36);

            // Store reset token (in production, this should be in database)
            if (!window.demo.passwordResetTokens) {
                window.demo.passwordResetTokens = {};
            }
            window.demo.passwordResetTokens[resetToken] = {
                email: sanitizedEmail,
                expires: Date.now() + 60 * 60 * 1000 // 1 hour
            };

            // TODO: Send email with reset link
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔐 Reset token (DEV ONLY):', resetToken);
            }

            return {
                success: true,
                message: 'Nếu email tồn tại, bạn sẽ nhận được link reset mật khẩu.',
                ...(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? { devToken: resetToken }
                    : {})
            };
        } catch (error) {
            console.error('Error requesting password reset:', error);
            throw error;
        }
    }

    /**
     * Verify reset token
     */
    async function verifyResetToken(token) {
        if (!token) return { valid: false, error: 'Token không hợp lệ' };

        try {
            if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase) {
                    const { data: users, error } = await supabase
                        .from('users')
                        .select('id, email, reset_token_expires')
                        .eq('reset_token', token)
                        .limit(1);

                    if (error) {
                        console.error('Error verifying token:', error);
                        return { valid: false, error: 'Không thể xác thực token' };
                    }

                    if (!users || users.length === 0) {
                        return { valid: false, error: 'Token không hợp lệ hoặc đã hết hạn' };
                    }

                    const user = users[0];
                    const expires = new Date(user.reset_token_expires);
                    
                    if (expires < new Date()) {
                        return { valid: false, error: 'Token đã hết hạn' };
                    }

                    return { valid: true, userId: user.id, email: user.email };
                }
            }

            // Fallback: local check
            if (window.demo?.passwordResetTokens && window.demo.passwordResetTokens[token]) {
                const tokenData = window.demo.passwordResetTokens[token];
                if (tokenData.expires < Date.now()) {
                    delete window.demo.passwordResetTokens[token];
                    return { valid: false, error: 'Token đã hết hạn' };
                }
                return { valid: true, email: tokenData.email };
            }

            return { valid: false, error: 'Token không hợp lệ' };
        } catch (error) {
            console.error('Error verifying reset token:', error);
            return { valid: false, error: 'Không thể xác thực token' };
        }
    }

    /**
     * Reset password with token
     */
    async function resetPassword(token, newPassword) {
        if (!token) throw new Error('Token không hợp lệ');
        if (!newPassword) throw new Error('Mật khẩu mới là bắt buộc');

        // Validate password
        const validation = window.UniAuthHelpers?.validatePassword 
            ? window.UniAuthHelpers.validatePassword(newPassword)
            : { valid: newPassword.length >= 6, error: newPassword.length < 6 ? 'Mật khẩu phải có ít nhất 6 ký tự' : null };

        if (!validation.valid) {
            throw new Error(validation.error || 'Mật khẩu không hợp lệ');
        }

        // Verify token
        const tokenVerification = await verifyResetToken(token);
        if (!tokenVerification.valid) {
            throw new Error(tokenVerification.error || 'Token không hợp lệ');
        }

        try {
            // Hash new password
            const passwordHash = window.UniAuthHelpers?.hashPassword 
                ? await window.UniAuthHelpers.hashPassword(newPassword)
                : newPassword; // Fallback

            if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                const supabase = window.SupabaseAdapter.getClient();
                if (supabase && tokenVerification.userId) {
                    // Update password and clear reset token
                    const { error } = await supabase
                        .from('users')
                        .update({
                            password: passwordHash,
                            reset_token: null,
                            reset_token_expires: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', tokenVerification.userId);

                    if (error) {
                        console.error('Error resetting password:', error);
                        throw new Error('Không thể đặt lại mật khẩu. Vui lòng thử lại sau.');
                    }

                    return { success: true, message: 'Mật khẩu đã được đặt lại thành công.' };
                }
            }

            // Fallback: local update
            const users = window.demo?.users || [];
            const userIndex = users.findIndex(u => 
                u.email && u.email.toLowerCase() === tokenVerification.email.toLowerCase()
            );

            if (userIndex >= 0) {
                users[userIndex].password = passwordHash;
                // Clear reset token
                if (window.demo.passwordResetTokens && window.demo.passwordResetTokens[token]) {
                    delete window.demo.passwordResetTokens[token];
                }
                return { success: true, message: 'Mật khẩu đã được đặt lại thành công.' };
            }

            throw new Error('Không tìm thấy người dùng');
        } catch (error) {
            console.error('Error resetting password:', error);
            throw error;
        }
    }

    window.UniPasswordReset = {
        requestPasswordReset,
        verifyResetToken,
        resetPassword
    };
})();

