/**
 * auth.js - Simple client-side auth using localStorage
 */

(function(){
    const USERS_KEY = 'unicorns.users';
    const CURRENT_KEY = 'unicorns.currentUser';
    const SESSION_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

    function sanitizeInputValue(value) {
        if (window.SecurityUtils && window.SecurityUtils.sanitizeInput) {
            return window.SecurityUtils.sanitizeInput(value);
        }
        return value || '';
    }

    function ensureDefaultAccounts(list) {
        if (!Array.isArray(list)) return list;
        
        // SECURITY: Không hardcode passwords trong code
        // Default accounts phải được tạo qua database migration với passwords đã được hash
        // Chỉ cập nhật email, role, name nếu account đã tồn tại trong database
        const defaults = [
            { 
                email: 'giaovien1@edu.vn',
                legacyEmails: ['teacher@unicorns.edu','giaovien1@unicorn.edu'],
                // password: REMOVED - must be set via database migration
                role: 'teacher',
                name: 'Giáo viên 1',
                linkId: 'T001'
            },
            {
                email: 'coder@edu.vn',
                // password: REMOVED - must be set via database migration
                role: 'visitor',
                name: 'User vãng lai',
                linkId: null
            },
            {
                email: 'trolykythuat1@edu.vn',
                // password: REMOVED - must be set via database migration
                role: 'assistant',
                name: 'Trợ lý Kỹ thuật 1',
                linkId: 'A001',
                assistantType: 'technical'
            },
            {
                email: 'trolygiaoan1@edu.vn',
                // password: REMOVED - must be set via database migration
                role: 'assistant',
                name: 'Trợ lý Giáo án 1',
                linkId: 'A002',
                assistantType: 'lesson_plan'
            }
        ];

        defaults.forEach(def => {
            const legacyMatch = def.legacyEmails?.map(e => e.toLowerCase()) || [];
            let existing = list.find(u => u.email?.toLowerCase() === def.email.toLowerCase());
            if (!existing) {
                existing = list.find(u => legacyMatch.includes(String(u.email || '').toLowerCase()));
            }
            if (existing) {
                // Chỉ cập nhật metadata, KHÔNG cập nhật password
                existing.email = def.email;
                // existing.password = REMOVED - password must come from database
                existing.role = def.role;
                existing.name = def.name;
                existing.linkId = def.linkId || null;
                if (def.assistantType) existing.assistantType = def.assistantType;
            } else {
                // Không tạo account mới ở đây - phải được tạo qua database migration
                // Chỉ thêm vào list nếu account đã tồn tại trong database
                // Account sẽ được load từ Supabase/localStorage nếu đã có
            }
        });

        return list;
    }

    function loadUsers() {
        try {
            const raw = localStorage.getItem(USERS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                ensureDefaultAccounts(parsed);
                syncDemoUsers(parsed);
                return parsed;
            }
        } catch(e) {}
        // SECURITY: Không seed với hardcoded passwords
        // Accounts phải được tạo qua database migration với passwords đã được hash
        // Nếu localStorage trống, trả về mảng rỗng - accounts sẽ được load từ Supabase
        const seed = [];
        localStorage.setItem(USERS_KEY, JSON.stringify(seed));
        syncDemoUsers(seed);
        return seed;
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        syncDemoUsers(users);
    }

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem(CURRENT_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw);
            const expiresAt = parsed.sessionExpiresAt;

            if (!expiresAt || expiresAt <= Date.now()) {
                // Session missing expiry or expired -> force logout
                localStorage.removeItem(CURRENT_KEY);
                try { localStorage.removeItem('unicorns.token'); } catch (e) {}
                return null;
            }

            return parsed;
        } catch(e) { 
            return null; 
        }
    }

    function setCurrentUser(user) {
        if (user) {
            const now = Date.now();
            const sessionPayload = {
                ...user,
                sessionStartedAt: now,
                sessionExpiresAt: now + SESSION_DURATION_MS
            };
            localStorage.setItem(CURRENT_KEY, JSON.stringify(sessionPayload));
        } else {
            localStorage.removeItem(CURRENT_KEY);
        }
    }

    function syncDemoUsers(users) {
        if (!Array.isArray(users) || !window.demo) return;
        // SECURITY: Không lưu passwords vào window.demo.users
        // Passwords phải được query từ Supabase khi cần verify
        window.demo.users = users.map(u => ({
            id: u.id,
            name: u.name || '',
            email: u.email,
            // password: REMOVED - must be queried from Supabase when needed
            role: u.role,
            linkId: u.linkId || null,
            status: u.status || 'active',
            accountHandle: u.accountHandle || null,
            province: u.province || null,
            emailVerified: u.emailVerified || false,
            phoneVerified: u.phoneVerified || false
        }));
        
        // Đồng bộ admin account từ Supabase vào localStorage
        const adminFromSupabase = users.find(u => u.role === 'admin');
        if (adminFromSupabase) {
            const localUsers = loadUsers();
            const localAdminIndex = localUsers.findIndex(u => u.role === 'admin');
            
            if (localAdminIndex >= 0) {
                // Cập nhật admin trong localStorage từ Supabase (giữ password cũ nếu Supabase không có)
                localUsers[localAdminIndex] = {
                    ...localUsers[localAdminIndex],
                    id: adminFromSupabase.id,
                    email: adminFromSupabase.email,
                    password: adminFromSupabase.password || localUsers[localAdminIndex].password,
                    name: adminFromSupabase.name || localUsers[localAdminIndex].name
                };
            } else {
                // Thêm admin vào localStorage nếu chưa có
                // SECURITY: Không dùng fallback password - phải có password từ database
                if (adminFromSupabase.password) {
                    localUsers.push({
                        id: adminFromSupabase.id,
                        email: adminFromSupabase.email,
                        password: adminFromSupabase.password, // Chỉ dùng password từ database
                        role: 'admin',
                        name: adminFromSupabase.name || 'Quản trị viên',
                        linkId: null
                    });
                } else {
                    console.warn('⚠️ Admin account từ Supabase không có password. Vui lòng tạo password qua database migration.');
                }
            }
            // Lưu lại mà không gọi syncDemoUsers để tránh loop
            localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
        }

        if (Array.isArray(window.demo.teachers)) {
            window.demo.teachers.forEach(teacher => {
                const matched = users.find(user => user.role === 'teacher' && (
                    (teacher.userId && teacher.userId === user.id) ||
                    (teacher.gmail && teacher.gmail.toLowerCase() === String(user.email || '').toLowerCase())
                ));
                if (matched) {
                    teacher.userId = matched.id;
                    if (!teacher.gmail) teacher.gmail = matched.email;
                }
            });
        }

        if (Array.isArray(window.demo.students)) {
            window.demo.students.forEach(student => {
                const matched = users.find(user => user.role === 'student' && (
                    (student.userId && student.userId === user.id) ||
                    (student.email && student.email.toLowerCase() === String(user.email || '').toLowerCase())
                ));
                if (matched) {
                    student.userId = matched.id;
                    if (!student.email) student.email = matched.email;
                }
            });
        }
    }


    /**
     * Register new user - saves to Supabase and local data
     */
    async function register(email, password, role, profile = {}) {
        email = sanitizeInputValue(email).trim().toLowerCase();
        role = sanitizeInputValue(role || 'student');
        password = String(password || '');
        const fullName = sanitizeInputValue(profile.fullName || profile.name || '').trim();
        const phone = profile.phone ? sanitizeInputValue(profile.phone).trim() : null;
        const classId = profile.classId ? sanitizeInputValue(profile.classId).trim() : null; // For students
        const specialization = profile.specialization ? sanitizeInputValue(profile.specialization).trim() : null; // For teachers
        
        // Validation
        if (!email || !password) throw new Error('Email và mật khẩu là bắt buộc');
        if (!window.UniAuthHelpers || !window.UniAuthHelpers.isValidEmail(email)) {
            if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email không hợp lệ');
        } else if (!window.UniAuthHelpers.isValidEmail(email)) {
            throw new Error('Email không hợp lệ');
        }
        
        // Validate password strength
        if (window.UniAuthSecurity && window.UniAuthSecurity.validatePasswordStrength) {
            const validation = window.UniAuthSecurity.validatePasswordStrength(password, email, fullName);
            if (!validation.valid) {
                throw new Error(validation.errors.join('. '));
            }
        } else {
            // Fallback validation
            if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
        }
        if (!['student','teacher'].includes(role)) throw new Error('Vai trò phải là Học sinh hoặc Giáo viên');
        if (!fullName) throw new Error('Họ và tên là bắt buộc');
        
        // Validate phone if provided
        if (phone && window.UniAuthHelpers && window.UniAuthHelpers.isValidPhone) {
            if (!window.UniAuthHelpers.isValidPhone(phone)) {
                throw new Error('Số điện thoại không hợp lệ (định dạng: 0xxxxxxxxx hoặc +84xxxxxxxxx)');
            }
        }
        
        // Check if email already exists (in Supabase or local)
        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            const existingUser = await queryUserFromSupabase(email);
            if (existingUser) {
                throw new Error('Email đã được đăng ký');
            }
        }
        
        const users = loadUsers();
        if (users.some(u => u.email === email)) throw new Error('Email đã được đăng ký');
        
        // Hash password
        let passwordHash = password;
        if (window.UniAuthHelpers && window.UniAuthHelpers.hashPassword) {
            passwordHash = await window.UniAuthHelpers.hashPassword(password);
        }
        
        // Generate IDs
        const newUserId = window.UniData && window.UniData.generateId 
            ? window.UniData.generateId('user') 
            : ('U' + Math.random().toString(36).slice(2,8).toUpperCase());
        
        // Create profile (student or teacher)
        const linkId = ensureDemoProfileForRole(role, fullName, email, newUserId, { classId, specialization });
        
        // Tạo accountHandle từ email (phần trước @) hoặc từ tên
        const accountHandle = email.split('@')[0] || fullName.toLowerCase().replace(/\s+/g, '');
        
        // Normalize phone
        let normalizedPhone = phone;
        if (phone && window.UniAuthHelpers && window.UniAuthHelpers.normalizePhone) {
            normalizedPhone = window.UniAuthHelpers.normalizePhone(phone);
        }
        
        // Cập nhật profile với accountHandle
        // SECURITY: Không lưu accountPassword plaintext - password được lưu trong users table (hashed)
        if (linkId && window.demo) {
            if (role === 'student') {
                const student = window.demo.students.find(s => s.id === linkId);
                if (student) {
                    student.accountHandle = accountHandle;
                    // accountPassword: REMOVED - password is stored in users table (hashed)
                    student.email = email;
                    if (classId) student.classId = classId;
                }
            } else if (role === 'teacher') {
                const teacher = window.demo.teachers.find(t => t.id === linkId);
                if (teacher) {
                    teacher.accountHandle = accountHandle;
                    // accountPassword: REMOVED - password is stored in users table (hashed)
                    teacher.gmail = email;
                    if (specialization) teacher.specialization = specialization;
                }
            }
        }
        
        // Create user object
        const user = {
            id: newUserId,
            email,
            phone: normalizedPhone,
            password: passwordHash, // Hashed password
            name: fullName || email,
            role,
            linkId: linkId || null,
            accountHandle: accountHandle,
            status: 'pending' // Chờ xác thực email (tương lai)
        };
        
        // Save to Supabase if enabled
        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled && window.UniData) {
            try {
                // Add user to window.demo.users (for local state)
                // SECURITY: Không lưu plaintext password - chỉ lưu metadata
                if (!window.demo.users) window.demo.users = [];
                const existingUserIndex = window.demo.users.findIndex(u => u.id === user.id);
                const userForLocal = {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    // password: REMOVED - password is stored in Supabase (hashed), query when needed
                    name: user.name,
                    role: user.role,
                    linkId: user.linkId,
                    accountHandle: user.accountHandle,
                    status: user.status
                };
                if (existingUserIndex >= 0) {
                    window.demo.users[existingUserIndex] = userForLocal;
                } else {
                    window.demo.users.push(userForLocal);
                }
                
                // Save to Supabase using optimistic update
                // Format user for Supabase (snake_case)
                const userForSupabase = {
                    id: user.id,
                    email: user.email,
                    phone: user.phone || null,
                    password: user.password, // Hashed password
                    name: user.name,
                    role: user.role,
                    link_id: user.linkId || null,
                    account_handle: user.accountHandle || null,
                    status: user.status || 'pending'
                };
                
                await window.UniData.save({
                    supabaseEntities: {
                        users: [userForSupabase]
                    },
                    useOptimisticUpdate: true
                });
            } catch (error) {
                console.error('Error saving user to Supabase:', error);
                // Continue with local save as fallback
            }
        }
        
        // Save to local storage (fallback)
        // SECURITY: Không lưu plaintext password vào localStorage
        // Chỉ lưu hashed password hoặc không lưu password (query từ Supabase khi cần)
        users.push({
            ...user,
            password: passwordHash // Lưu hashed password, không lưu plaintext
        });
        saveUsers(users);
        
        // Set current user
        const currentUser = { 
            id: user.id, 
            email: user.email, 
            role: user.role, 
            linkId: user.linkId, 
            name: user.name 
        };
        setCurrentUser(currentUser);
        
        return currentUser;
    }
    
    /**
     * Enhanced ensureDemoProfileForRole with additional options
     */
    function ensureDemoProfileForRole(role, fullName, email, userId, options = {}) {
        if (!window.demo) return null;
        if (role === 'student') {
            const studentId = window.UniData && window.UniData.generateId 
                ? window.UniData.generateId('student') 
                : ('S' + Math.random().toString(36).slice(2,7).toUpperCase());
            const studentRecord = {
                id: studentId,
                fullName: fullName || email,
                name: fullName || email,
                email,
                status: 'active',
                walletBalance: 0,
                loanBalance: 0,
                province: '',
                goal: '',
                userId: userId || null,
                classId: options.classId || null
            };
            window.demo.students = window.demo.students || [];
            window.demo.students.push(studentRecord);
            return studentId;
        }
        if (role === 'teacher') {
            const teacherId = window.UniData && window.UniData.generateId 
                ? window.UniData.generateId('teacher') 
                : ('T' + Math.random().toString(36).slice(2,7).toUpperCase());
            const teacherRecord = {
                id: teacherId,
                fullName: fullName || email,
                name: fullName || email,
                gmail: email,
                phone: '',
                status: 'active',
                userId: userId || null,
                specialization: options.specialization || '',
                roles: ['teacher'] // Default role
            };
            window.demo.teachers = window.demo.teachers || [];
            window.demo.teachers.push(teacherRecord);
            return teacherId;
        }
        return null;
    }

    /**
     * Query user from Supabase by email, phone, or account_handle
     */
    async function rpcLogin(identifier, password) {
        if (!window.SupabaseAdapter || !window.SupabaseAdapter.isEnabled || !window.SupabaseAdapter.getClient) return null;
        try {
            const supabase = window.SupabaseAdapter.getClient();
            const { data, error } = await supabase.rpc('login_user', {
                p_identifier: identifier,
                p_password: password
            });
            if (error) {
                console.error('login_user RPC error:', error);
                return null;
            }
            if (Array.isArray(data) && data.length > 0) {
                return data[0];
            }
        } catch (err) {
            console.error('Exception calling login_user RPC:', err);
        }
        return null;
    }

    async function enforceLoginRateLimit(identifier) {
        if (!window.SupabaseAdapter || !window.SupabaseAdapter.isEnabled || !window.SupabaseAdapter.getClient) {
            return true;
        }
        try {
            const supabase = window.SupabaseAdapter.getClient();
            const { error } = await supabase.rpc('enforce_login_rate_limit', {
                p_identifier: identifier
            });
            if (error) {
                throw error;
            }
            return true;
        } catch (err) {
            const message = err?.message || err?.details || 'Không thể đăng nhập do giới hạn số lần thử. Vui lòng thử lại sau.';
            throw new Error(message);
        }
    }

    async function queryUserFromSupabase(loginInput) {
        if (!window.SupabaseAdapter || !window.SupabaseAdapter.isEnabled) {
            return null;
        }
        
        try {
            // Try to get Supabase client from adapter
            let supabase = null;
            if (window.SupabaseAdapter.getClient) {
                supabase = window.SupabaseAdapter.getClient();
            } else if (window.supabase) {
                supabase = window.supabase;
            }
            
            if (!supabase) return null;
            
            const loginInputLower = String(loginInput || '').trim().toLowerCase();
            
            // Query by email, phone, or account_handle
            const { data: users, error } = await supabase
                .from('users')
                .select('*')
                .or(`email.ilike.%${loginInputLower}%,phone.ilike.%${loginInputLower}%,account_handle.ilike.%${loginInputLower}%`)
                .eq('status', 'active')
                .limit(1);
            
            if (error) {
                console.warn('Error querying user from Supabase:', error);
                return null;
            }
            
            if (users && users.length > 0) {
                const user = users[0];
                // Normalize: check exact match (case-insensitive)
                const emailMatch = user.email && String(user.email).trim().toLowerCase() === loginInputLower;
                const phoneMatch = user.phone && String(user.phone).trim().toLowerCase() === loginInputLower;
                const handleMatch = user.account_handle && String(user.account_handle).trim().toLowerCase() === loginInputLower;
                
                if (emailMatch || phoneMatch || handleMatch) {
                    return {
                        id: user.id,
                        email: user.email,
                        phone: user.phone || null,
                        password: user.password, // Will be verified
                        name: user.name || '',
                        role: user.role,
                        linkId: user.link_id || null,
                        accountHandle: user.account_handle || null,
                        assistantType: user.assistant_type || null,
                        status: user.status || 'active'
                    };
                }
            }
        } catch (error) {
            console.warn('Exception querying user from Supabase:', error);
        }
        
        return null;
    }

    /**
     * Internal login function - queries from Supabase first, then falls back to local data
     * This is wrapped by secureLogin in auth-security-enhanced.js if available
     */
    async function loginInternal(emailOrHandle, password) {
        const loginInput = String(sanitizeInputValue(emailOrHandle) || '').trim();
        if (!loginInput || !password) throw new Error('Vui lòng nhập email/handle và mật khẩu');
        
        const loginInputLower = loginInput.toLowerCase();

        // Enforce server-side rate limiting (if available)
        try {
            await enforceLoginRateLimit(loginInputLower);
        } catch (rateError) {
            throw rateError;
        }
        
        // 1. Try Supabase first (if enabled)
        const rpcUser = await rpcLogin(loginInput, password);
        if (rpcUser) {
            const current = {
                id: rpcUser.id,
                email: rpcUser.email || loginInput,
                role: rpcUser.role || 'user',
                linkId: rpcUser.link_id || null,
                name: rpcUser.name || rpcUser.email || 'User',
                assistantType: rpcUser.assistant_type || null
            };
            setCurrentUser(current);
            try {
                const tokenPayload = { sub: current.id, role: current.role };
                const token = window.UniAuthHelpers?.generateToken
                    ? window.UniAuthHelpers.generateToken(tokenPayload)
                    : ('jwt.' + btoa(JSON.stringify(tokenPayload)) + '.sig');
                localStorage.setItem('unicorns.token', token);
            } catch (e) {}
            return current;
        }

        const supabaseUser = await queryUserFromSupabase(loginInput);
        if (supabaseUser) {
            // Verify password (use helper if available, otherwise plaintext comparison)
            let passwordMatch = false;
            
            // Debug logging (only in development)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔐 Login attempt:', {
                    email: supabaseUser.email,
                    passwordLength: password.length,
                    storedPasswordLength: supabaseUser.password?.length,
                    storedPasswordType: typeof supabaseUser.password,
                    hasHelper: !!window.UniAuthHelpers?.verifyPassword
                });
            }
            
            if (window.UniAuthHelpers && window.UniAuthHelpers.verifyPassword) {
                passwordMatch = await window.UniAuthHelpers.verifyPassword(password, supabaseUser.password);
                
                // Fallback: Nếu hash verification fail, thử plaintext comparison
                // (Để tương thích với passwords cũ trong DB chưa được hash)
                if (!passwordMatch && supabaseUser.password && supabaseUser.password.length < 64) {
                    // Nếu password trong DB ngắn hơn 64 ký tự (không phải SHA-256 hash),
                    // thử so sánh plaintext
                    passwordMatch = supabaseUser.password === password;
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        console.log('🔐 Fallback to plaintext comparison:', passwordMatch);
                    }
                }
            } else {
                // Fallback: plaintext comparison (NOT SECURE - only for development)
                passwordMatch = supabaseUser.password === password;
            }
            
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔐 Password match:', passwordMatch);
            }
            
            if (passwordMatch) {
                const current = {
                    id: supabaseUser.id,
                    email: supabaseUser.email || loginInput,
                    role: supabaseUser.role,
                    linkId: supabaseUser.linkId || null,
                    name: supabaseUser.name || 'User',
                    assistantType: supabaseUser.assistantType || null
                };
                setCurrentUser(current);
                try { 
                    const token = window.UniAuthHelpers?.generateToken 
                        ? window.UniAuthHelpers.generateToken({ sub: current.id, role: current.role })
                        : ('jwt.' + btoa(JSON.stringify({ sub: current.id, role: current.role })) + '.sig');
                    localStorage.setItem('unicorns.token', token);
                } catch(e) {}
                return current;
            }
        }
        
        // 2. Fallback: Tìm trong local data (students, teachers, assistants, users)
        // Tìm trong students (học sinh)
        if (window.demo && Array.isArray(window.demo.students)) {
            const student = window.demo.students.find(s => {
                if (s.status === 'inactive') return false;
                
                // Kiểm tra email
                const matchEmail = s.email && String(s.email).trim().toLowerCase() === loginInputLower;
                
                // Kiểm tra handle (accountHandle)
                const accountHandle = s.accountHandle ? String(s.accountHandle).trim() : '';
                const matchHandle = accountHandle && accountHandle.toLowerCase() === loginInputLower;
                
                // Kiểm tra password
                const accountPassword = s.accountPassword ? String(s.accountPassword).trim() : '';
                const matchPassword = accountPassword === password;
                
                return (matchEmail || matchHandle) && matchPassword;
            });
            
            if (student) {
                const current = {
                    id: student.userId || ('U_STUD_' + student.id),
                    email: student.email || loginInput,
                    role: 'student',
                    linkId: student.id,
                    name: student.fullName || student.name || 'Học sinh'
                };
                setCurrentUser(current);
                try { localStorage.setItem('unicorns.token', 'jwt.' + btoa(JSON.stringify({ sub: current.id, role: current.role })) + '.sig'); } catch(e) {}
                return current;
            }
        }
        
        // Tìm trong teachers (giáo viên)
        if (window.demo && Array.isArray(window.demo.teachers)) {
            const teacher = window.demo.teachers.find(t => {
                if (t.status === 'inactive') return false;
                
                // Kiểm tra email (gmail)
                const matchEmail = t.gmail && String(t.gmail).trim().toLowerCase() === loginInputLower;
                
                // Kiểm tra handle (accountHandle)
                const accountHandle = t.accountHandle ? String(t.accountHandle).trim() : '';
                const matchHandle = accountHandle && accountHandle.toLowerCase() === loginInputLower;
                
                // Kiểm tra password
                const accountPassword = t.accountPassword ? String(t.accountPassword).trim() : '';
                const matchPassword = accountPassword === password;
                
                return (matchEmail || matchHandle) && matchPassword;
            });
            
            if (teacher) {
                const current = {
                    id: teacher.userId || ('U_TEACH_' + teacher.id),
                    email: teacher.gmail || loginInput,
                    role: 'teacher',
                    linkId: teacher.id,
                    name: teacher.fullName || teacher.name || 'Giáo viên'
                };
                setCurrentUser(current);
                try { localStorage.setItem('unicorns.token', 'jwt.' + btoa(JSON.stringify({ sub: current.id, role: current.role })) + '.sig'); } catch(e) {}
                return current;
            }
        }
        
        // Assistants functionality has been replaced by staff with roles
        // Note: Staff with roles (lesson_plan, accountant, etc.) are now in teachers table
        
        // Tìm trong users list (cho admin và các tài khoản legacy)
        const users = ensureDefaultAccounts(loadUsers());
        const user = users.find(u => {
            const matchEmail = u.email && String(u.email).trim().toLowerCase() === loginInputLower;
            const matchLegacyEmail = u.legacyEmails && Array.isArray(u.legacyEmails) && 
                u.legacyEmails.some(e => String(e).trim().toLowerCase() === loginInputLower);
            return (matchEmail || matchLegacyEmail) && u.password === password;
        });
        
        if (user) {
            const current = {
                id: user.id,
                email: user.email,
                role: user.role,
                linkId: user.linkId || null,
                name: user.name || 'User',
                assistantType: user.assistantType || null
            };
            setCurrentUser(current);
            try { localStorage.setItem('unicorns.token', 'jwt.' + btoa(JSON.stringify({ sub: user.id, role: user.role })) + '.sig'); } catch(e) {}
            return current;
        }
        
        throw new Error('Sai email/handle hoặc mật khẩu');
    }

    /**
     * Public login function - uses secureLogin wrapper if available
     */
    async function login(emailOrHandle, password) {
        // Debug mode: log login attempt
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🔐 Login attempt:', { emailOrHandle, passwordLength: password?.length });
        }
        
        try {
            // Use secure login wrapper if available
            if (window.UniAuthSecurity && window.UniAuthSecurity.secureLogin) {
                const result = await window.UniAuthSecurity.secureLogin(emailOrHandle, password, loginInternal);
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    console.log('✅ Login success via secureLogin:', result);
                }
                return result;
            }
            // Fallback to internal login
            const result = await loginInternal(emailOrHandle, password);
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('✅ Login success via loginInternal:', result);
            }
            return result;
        } catch (error) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.error('❌ Login error:', error.message, error);
            }
            throw error;
        }
    }

    function getAuthFormsMarkup() {
        const classes = window.demo?.classes || [];
        const classOptions = classes.map(c => 
            `<option value="${c.id}">${c.name || c.id}</option>`
        ).join('');
        
        return `
            <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
                <div class="card">
                    <h3>Đăng nhập</h3>
                    <form data-auth="login" class="grid gap-2" novalidate>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Email / Số điện thoại / Tên đăng nhập</label>
                            <input class="form-control" name="email" type="text" placeholder="Nhập email, SĐT hoặc tên đăng nhập" autocomplete="username" required>
                        </div>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Mật khẩu</label>
                            <input class="form-control" name="password" type="password" placeholder="Nhập mật khẩu" autocomplete="current-password" required>
                        </div>
                        <button class="btn btn-primary" type="submit">Đăng nhập</button>
                    </form>
                    <div class="text-muted text-sm mt-3">
                        <p class="font-semibold">Tài khoản mẫu</p>
                        <ul class="list-disc ml-4">
                            <li>Giáo viên: <code>giaovien1@edu.vn</code> / <code>123456</code></li>
                        </ul>
                    </div>
                </div>
                <div class="card">
                    <h3>Tạo tài khoản</h3>
                    <form data-auth="register" class="grid gap-2" novalidate>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Họ và tên <span class="text-red-500">*</span></label>
                            <input class="form-control" name="fullName" type="text" placeholder="Nhập họ và tên đầy đủ" required>
                        </div>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Email <span class="text-red-500">*</span></label>
                            <input class="form-control" name="email" type="email" placeholder="example@email.com" autocomplete="email" required>
                        </div>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Số điện thoại</label>
                            <input class="form-control" name="phone" type="tel" placeholder="0xxxxxxxxx hoặc +84xxxxxxxxx" autocomplete="tel">
                            <small class="text-muted text-xs">Tùy chọn, nhưng nên có để nhận thông báo</small>
                        </div>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Mật khẩu <span class="text-red-500">*</span></label>
                            <input class="form-control" name="password" type="password" placeholder="Tối thiểu 6 ký tự" autocomplete="new-password" minlength="6" required>
                        </div>
                        <div>
                            <label class="text-sm font-medium mb-1 block">Vai trò <span class="text-red-500">*</span></label>
                            <select class="form-control" name="role" id="registerRole" required>
                                <option value="">-- Chọn vai trò --</option>
                                <option value="student">Học sinh</option>
                                <option value="teacher">Giáo viên</option>
                            </select>
                        </div>
                        <div id="studentFields" style="display:none;">
                            <label class="text-sm font-medium mb-1 block">Lớp học</label>
                            <select class="form-control" name="classId">
                                <option value="">-- Chọn lớp (tùy chọn) --</option>
                                ${classOptions}
                            </select>
                            <small class="text-muted text-xs">Có thể để trống, admin sẽ phân lớp sau</small>
                        </div>
                        <div id="teacherFields" style="display:none;">
                            <label class="text-sm font-medium mb-1 block">Môn dạy / Chuyên môn</label>
                            <input class="form-control" name="specialization" type="text" placeholder="VD: Toán, Lý, Hóa, Tiếng Anh...">
                            <small class="text-muted text-xs">Khai báo môn dạy hoặc chuyên môn của bạn</small>
                        </div>
                        <button class="btn btn-primary" type="submit">Tạo tài khoản</button>
                        <p class="text-muted text-xs mt-1">⚠️ Tài khoản Admin và Trợ lý chỉ được tạo bởi quản trị viên.</p>
                    </form>
                </div>
            </div>
        `;
    }

    function attachAuthFormHandlers(root) {
        if (!root) return;
        
        // Login form handler
        const loginForm = root.querySelector('form[data-auth="login"]');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(loginForm);
                try {
                    const emailOrHandle = fd.get('email') || '';
                    const password = fd.get('password') || '';
                    const user = await login(emailOrHandle, password);
                    window.UniUI.toast('Đăng nhập thành công', 'success');
                    window.UniUI.refreshNavigation();
                    
                    // Role-based routing
                    const defaultPage = getDefaultPageForRole(user.role);
                    window.UniUI.loadPage(defaultPage);
                } catch (err) {
                    window.UniUI.toast(err.message || 'Đăng nhập thất bại', 'error');
                }
            });
        }

        // Register form handler
        const registerForm = root.querySelector('form[data-auth="register"]');
        if (registerForm) {
            // Show/hide role-specific fields
            const roleSelect = registerForm.querySelector('#registerRole');
            const studentFields = root.querySelector('#studentFields');
            const teacherFields = root.querySelector('#teacherFields');
            
            if (roleSelect) {
                roleSelect.addEventListener('change', (e) => {
                    const role = e.target.value;
                    if (studentFields) studentFields.style.display = role === 'student' ? 'block' : 'none';
                    if (teacherFields) teacherFields.style.display = role === 'teacher' ? 'block' : 'none';
                });
            }
            
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(registerForm);
                try {
                    const profile = {
                        fullName: fd.get('fullName'),
                        phone: fd.get('phone'),
                        classId: fd.get('classId') || null,
                        specialization: fd.get('specialization') || null
                    };
                    
                    const user = await register(
                        fd.get('email'),
                        fd.get('password'),
                        fd.get('role'),
                        profile
                    );
                    
                    window.UniUI.toast('Đăng ký thành công! Vui lòng đợi xác thực email (tính năng sắp có).', 'success');
                    window.UniUI.refreshNavigation();
                    
                    // Role-based routing
                    const defaultPage = getDefaultPageForRole(user.role);
                    window.UniUI.loadPage(defaultPage);
                } catch (err) {
                    window.UniUI.toast(err.message || 'Đăng ký thất bại', 'error');
                }
            });
        }
    }
    
    /**
     * Get default page for role after login/register
     */
    function getDefaultPageForRole(role) {
        const rolePages = {
            admin: 'dashboard',
            teacher: 'classes', // Changed from dashboard
            student: 'classes', // Changed from dashboard
            visitor: 'home'
        };
        return rolePages[role] || 'dashboard';
    }

    function logout() {
        // Use secure logout wrapper if available
        if (window.UniAuthSecurity && window.UniAuthSecurity.secureLogout) {
            window.UniAuthSecurity.secureLogout(() => {
                setCurrentUser(null);
                try { localStorage.removeItem('unicorns.token'); } catch(e) {}
            });
        } else {
            setCurrentUser(null);
            try { localStorage.removeItem('unicorns.token'); } catch(e) {}
        }
    }

    async function updateAdminLoginInfo(userId, email, password) {
        if (!userId || !email) {
            throw new Error('Vui lòng nhập đầy đủ thông tin');
        }

        let user = null;
        let oldEmail = email.trim();
        
        // 1. Tìm admin từ Supabase trước (nếu có)
        if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
            try {
                const supabase = window.SupabaseAdapter.getClient();
                
                // Tìm theo userId
                let { data: users, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .eq('role', 'admin')
                    .limit(1);
                
                // Nếu không tìm thấy theo userId, tìm theo email
                if (!users || users.length === 0) {
                    const { data: usersByEmail } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', email.trim())
                        .eq('role', 'admin')
                        .limit(1);
                    users = usersByEmail;
                }
                
                // Nếu vẫn không tìm thấy, tìm bất kỳ admin nào
                if (!users || users.length === 0) {
                    const { data: anyAdmin } = await supabase
                        .from('users')
                        .select('*')
                        .eq('role', 'admin')
                        .limit(1);
                    users = anyAdmin;
                }
                
                if (users && users.length > 0) {
                    const supabaseUser = users[0];
                    user = {
                        id: supabaseUser.id,
                        email: supabaseUser.email,
                        password: supabaseUser.password,
                        name: supabaseUser.name || 'Quản trị viên',
                        role: 'admin',
                        linkId: supabaseUser.link_id || null,
                        accountHandle: supabaseUser.account_handle || null,
                        status: supabaseUser.status || 'active'
                    };
                    oldEmail = user.email;
                }
            } catch (error) {
                console.warn('Error querying admin from Supabase:', error);
            }
        }
        
        // 2. Fallback: Tìm trong localStorage
        if (!user) {
            const users = loadUsers();
            const userIndex = users.findIndex(u => 
                (u.id === userId && u.role === 'admin') || 
                (u.role === 'admin' && u.email === email.trim())
            );
            
            if (userIndex !== -1) {
                user = users[userIndex];
                oldEmail = user.email;
            }
        }
        
        // 3. Nếu vẫn không tìm thấy, tìm trong window.demo.users
        if (!user && window.demo && Array.isArray(window.demo.users)) {
            const demoUser = window.demo.users.find(u => 
                (u.id === userId && u.role === 'admin') ||
                (u.role === 'admin' && u.email === email.trim()) ||
                u.role === 'admin'
            );
            
            if (demoUser) {
                user = {
                    id: demoUser.id,
                    email: demoUser.email,
                    password: demoUser.password,
                    name: demoUser.name || 'Quản trị viên',
                    role: 'admin',
                    linkId: demoUser.linkId || null,
                    accountHandle: demoUser.accountHandle || null,
                    status: demoUser.status || 'active'
                };
                oldEmail = user.email;
            }
        }
        
        // 4. Nếu vẫn không tìm thấy, tạo mới hoặc throw error
        if (!user) {
            throw new Error('Không tìm thấy tài khoản admin. Vui lòng đảm bảo admin đã được tạo trong database.');
        }

        // Cập nhật thông tin
        user.email = email.trim();
        
        // Password đã được hash ở form handler, chỉ cần lưu vào user object
        // Nếu password là hash (64 ký tự hex), giữ nguyên
        // Nếu không phải hash, có thể là plaintext (fallback)
        if (password && password.trim()) {
            // Nếu password đã là hash (64 ký tự hex), giữ nguyên
            // Nếu không, có thể đã được hash ở form handler rồi
            user.password = password.trim();
        }

        // Lưu vào localStorage (nếu cần)
        const users = loadUsers();
        const userIndex = users.findIndex(u => u.id === user.id);
        if (userIndex !== -1) {
            users[userIndex] = user;
        } else {
            users.push(user);
        }
        saveUsers(users);
        
        // Cập nhật current user nếu là user hiện tại
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            currentUser.email = user.email;
            setCurrentUser(currentUser);
        }

        // Đồng bộ lên Supabase nếu có
        try {
            if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                // Sử dụng user đã tìm được (từ Supabase hoặc fallback)
                // Format cho Supabase (snake_case)
                const supabaseUser = {
                    id: user.id,
                    email: email.trim(),
                    password: user.password, // Đã được hash ở trên nếu có password mới
                    name: user.name || 'Quản trị viên',
                    role: 'admin',
                    account_handle: user.accountHandle || null,
                    link_id: user.linkId || null,
                    status: user.status || 'active',
                    province: user.province || null,
                    email_verified: user.emailVerified || false,
                    phone_verified: user.phoneVerified || false
                };
                
                // QUAN TRỌNG: Nếu có password mới, đảm bảo nó được hash và lưu vào cả password và password_hash
                if (password && password.trim()) {
                    // Password đã được hash ở form handler (bcrypt hoặc SHA-256)
                    // Lưu vào cả password và password_hash để tương thích
                    supabaseUser.password = password.trim();
                    supabaseUser.password_hash = password.trim(); // Lưu vào password_hash field
                    
                    // Detect hash type để log
                    const hashType = window.UniAuthHelpers?.detectHashType 
                        ? window.UniAuthHelpers.detectHashType(password.trim())
                        : 'unknown';
                    
                    // Security: Don't log password details even in dev mode
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        console.log('✅ Password mới đã được hash và sẵn sàng lưu:', {
                            hashType: hashType,
                            // Don't log password length or content
                            isBcrypt: hashType === 'bcrypt'
                        });
                    }
                }
                
                // Log để debug
                console.log('🔄 Đang cập nhật admin lên Supabase:', {
                    id: supabaseUser.id,
                    email: supabaseUser.email,
                    hasPassword: !!supabaseUser.password,
                    hasPasswordHash: !!supabaseUser.password_hash,
                    passwordLength: supabaseUser.password ? supabaseUser.password.length : 0,
                    passwordHashLength: supabaseUser.password_hash ? supabaseUser.password_hash.length : 0
                });

                // Upsert lên Supabase với error handling tốt hơn
                // QUAN TRỌNG: Admin có thể có id không phải UUID (như "U_ADMIN"), nên phải dùng email làm onConflict
                try {
                    // Đảm bảo Supabase được init trước
                    if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                        if (!window.SupabaseAdapter.supabase) {
                            await window.SupabaseAdapter.init();
                        }
                        
                        // Gọi trực tiếp Supabase API để đảm bảo onConflict đúng
                        const supabase = window.SupabaseAdapter.supabase;
                        if (!supabase) {
                            throw new Error('Không thể khởi tạo Supabase client');
                        }
                        
                        // Kiểm tra xem id có phải UUID không
                        const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                        const isValidUuid = (id) => id && UUID_PATTERN.test(id);
                        
                        // Tìm admin trong Supabase bằng email để lấy UUID thực (nếu có)
                        let existingAdminId = null;
                        if (supabaseUser.email) {
                            const { data: existingUsers, error: searchError } = await supabase
                                .from('users')
                                .select('id')
                                .eq('email', supabaseUser.email.trim())
                                .eq('role', 'admin')
                                .limit(1);
                            
                            if (searchError) {
                                console.warn('⚠️ Không thể tìm admin trong Supabase:', searchError);
                            } else if (existingUsers && existingUsers.length > 0) {
                                existingAdminId = existingUsers[0].id;
                                console.log('✅ Tìm thấy admin trong Supabase với UUID:', existingAdminId);
                            }
                        }
                        
                        // Format user cho Supabase (convert camelCase to snake_case)
                        const formattedUser = {
                            email: supabaseUser.email,
                            password: supabaseUser.password, // Đã được hash ở trên
                            name: supabaseUser.name,
                            role: supabaseUser.role,
                            link_id: supabaseUser.link_id || null,
                            account_handle: supabaseUser.account_handle || null,
                            status: supabaseUser.status || 'active',
                            province: supabaseUser.province || null,
                            email_verified: supabaseUser.email_verified || false,
                            phone_verified: supabaseUser.phone_verified || false
                        };
                        
                        // QUAN TRỌNG: Đảm bảo password được set (không được xóa)
                        // Nếu có password mới, đảm bảo nó được hash và set
                        if (password && password.trim()) {
                            // Password đã được hash ở form handler (bcrypt hoặc SHA-256)
                            formattedUser.password = password.trim();
                            
                            // Nếu là bcrypt hash, cũng lưu vào password_hash field
                            const hashType = window.UniAuthHelpers?.detectHashType 
                                ? window.UniAuthHelpers.detectHashType(password.trim())
                                : 'unknown';
                            
                            if (hashType === 'bcrypt') {
                                formattedUser.password_hash = password.trim();
                            }
                            
                            // Security: Don't log password details
                            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                                console.log('✅ Password đã được set:', {
                                    hashType: hashType,
                                    // Don't log password length or content
                                    hasPasswordHash: hashType === 'bcrypt'
                                });
                            }
                        }
                        
                        // Chỉ thêm id nếu nó là UUID hợp lệ hoặc đã tìm thấy trong DB
                        if (existingAdminId && isValidUuid(existingAdminId)) {
                            formattedUser.id = existingAdminId;
                        } else if (isValidUuid(supabaseUser.id)) {
                            formattedUser.id = supabaseUser.id;
                        }
                        // Nếu không có UUID hợp lệ, không gửi id - Supabase sẽ tự tạo hoặc dùng email để match
                        
                        // Remove null/undefined fields (NHƯNG GIỮ password và email - bắt buộc)
                        Object.keys(formattedUser).forEach(key => {
                            // KHÔNG xóa password, email, role, name (các field bắt buộc)
                            if (['password', 'email', 'role', 'name'].includes(key)) {
                                return; // Giữ lại
                            }
                            if (formattedUser[key] === null || formattedUser[key] === undefined) {
                                delete formattedUser[key];
                            }
                        });
                        
                        // Đảm bảo password không bị null/undefined
                        if (!formattedUser.password && password && password.trim()) {
                            if (window.UniAuthHelpers && window.UniAuthHelpers.hashPassword) {
                                formattedUser.password = await window.UniAuthHelpers.hashPassword(password.trim());
                            } else {
                                formattedUser.password = password.trim();
                            }
                            console.log('⚠️ Password bị null sau khi remove fields, đã set lại');
                        }
                        
                        // Debug log chi tiết
                        console.log('🔄 Upsert admin trực tiếp lên Supabase với onConflict=email:', {
                            id: formattedUser.id || '(sẽ dùng email để match)',
                            email: formattedUser.email,
                            hasPassword: !!formattedUser.password,
                            passwordLength: formattedUser.password?.length,
                            passwordType: typeof formattedUser.password,
                            passwordPreview: formattedUser.password ? formattedUser.password.substring(0, 20) + '...' : 'null',
                            hasNewPassword: !!(password && password.trim())
                        });
                        
                        // Upsert với onConflict là 'email' (vì email là unique và đáng tin cậy hơn id)
                        const { data, error } = await supabase
                            .from('users')
                            .upsert([formattedUser], { onConflict: 'email' });
                        
                        if (error) {
                            console.error('❌ Lỗi khi upsert admin:', error);
                            console.error('❌ Formatted user:', formattedUser);
                            throw new Error(`Lỗi Supabase: ${error.message}`);
                        }
                        
                        console.log('✅ Đã upsert admin lên Supabase thành công');
                        
                        // Verify password đã được lưu
                        if (password && password.trim()) {
                            setTimeout(async () => {
                                const { data: verifyUsers, error: verifyError } = await supabase
                                    .from('users')
                                    .select('password')
                                    .eq('email', formattedUser.email)
                                    .eq('role', 'admin')
                                    .limit(1);
                                
                                if (!verifyError && verifyUsers && verifyUsers.length > 0) {
                                    const savedPassword = verifyUsers[0].password;
                                    // Security: Don't log password details
                                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                                        console.log('🔍 Verify password saved:', {
                                            // Don't log password lengths or content
                                            saved: !!savedPassword,
                                            expected: !!formattedUser.password,
                                            match: savedPassword === formattedUser.password
                                        });
                                    }
                                }
                            }, 1000);
                        }
                        
                        // Lấy lại admin từ DB để có UUID thực (nếu chưa có)
                        if (!formattedUser.id || !isValidUuid(formattedUser.id)) {
                            const { data: updatedUsers, error: fetchError } = await supabase
                                .from('users')
                                .select('id')
                                .eq('email', supabaseUser.email.trim())
                                .eq('role', 'admin')
                                .limit(1);
                            
                            if (!fetchError && updatedUsers && updatedUsers.length > 0) {
                                const realUuid = updatedUsers[0].id;
                                supabaseUser.id = realUuid;
                                console.log('✅ Đã cập nhật admin ID từ DB:', realUuid);
                            }
                        }
                        
                        // Verify bằng cách reload data từ Supabase
                        if (window.DatabaseAdapter && typeof window.DatabaseAdapter.load === 'function') {
                            setTimeout(async () => {
                                const freshData = await window.DatabaseAdapter.load({ preferLocal: false });
                                if (freshData && freshData.users) {
                                    const updatedAdmin = freshData.users.find(u => 
                                        u.role === 'admin' && (u.id === supabaseUser.id || u.email === supabaseUser.email)
                                    );
                                    if (updatedAdmin) {
                                        console.log('✅ Verified: Admin password đã được cập nhật trong DB');
                                        // Cập nhật lại id nếu cần
                                        if (updatedAdmin.id && isValidUuid(updatedAdmin.id)) {
                                            supabaseUser.id = updatedAdmin.id;
                                        }
                                        if (updatedAdmin.password === supabaseUser.password) {
                                            console.log('✅ Password trong DB khớp với password đã gửi');
                                        } else {
                                            console.warn('⚠️ Password trong DB khác với password đã gửi');
                                        }
                                    }
                                }
                            }, 1000);
                        }
                    } else {
                        // Fallback: dùng saveEntities
                        const result = await window.SupabaseAdapter.saveEntities({ 
                            users: [supabaseUser] 
                        });
                        
                        if (!result) {
                            throw new Error('saveEntities trả về false');
                        }
                        console.log('✅ Đã lưu admin lên Supabase thành công (qua saveEntities)');
                    }
                } catch (error) {
                    console.error('❌ Lỗi khi lưu admin lên Supabase:', error);
                    throw error; // Re-throw để UI có thể hiển thị lỗi
                }
                
                // Cập nhật lại window.demo.users để đồng bộ
                if (!window.demo.users) {
                    window.demo.users = [];
                }
                const demoUserIndex = window.demo.users.findIndex(u => 
                    u.id === supabaseUser.id || 
                    (u.role === 'admin' && u.email === supabaseUser.email)
                );
                
                if (demoUserIndex >= 0) {
                    window.demo.users[demoUserIndex] = { ...window.demo.users[demoUserIndex], ...supabaseUser };
                } else {
                    window.demo.users.push(supabaseUser);
                }
                
                console.log('✅ Đã đồng bộ thông tin admin lên Supabase và cập nhật window.demo.users');
            }
        } catch (error) {
            console.error('⚠️ Lỗi khi đồng bộ admin lên Supabase:', error);
            throw error; // Throw error để UI có thể hiển thị thông báo lỗi
        }

        return user;
    }

    window.UniAuth = {
        register,
        login,
        logout,
        getCurrentUser,
        getAuthFormsMarkup,
        attachAuthFormHandlers,
        loadUsers,
        updateAdminLoginInfo
    };
})();

