/**
 * students.js - Students page renderer and CRUD operations
 */

// Student validation rules
const studentValidation = {
    fullName: { required: true },
    birthYear: { required: true, min: 1990, max: new Date().getFullYear() - 5 },
    school: { required: true },
    province: { required: true },
    parentName: { required: true },
    parentPhone: { required: true, phone: true },
    email: { email: true },
    accountHandle: { required: true, pattern: /^[a-zA-Z0-9_.-]{3,}$/ },
    accountPassword: { required: true, pattern: /^.{4,}$/ }
};

const STUDENT_NAME_SORT_OPTIONS = { sensitivity: 'base', ignorePunctuation: true };

/**
 * Load student login info from DB (users table)
 * @param {string} studentId - Student ID
 * @returns {Promise<Object|null>} Login info object or null
 */
async function loadStudentLoginInfoFromDB(studentId) {
    if (!studentId) {
        console.warn('[loadStudentLoginInfoFromDB] No studentId provided');
        return null;
    }
    
    // Đảm bảo Supabase đã được khởi tạo
    if (!window.SupabaseAdapter?.supabase) {
        console.warn('[loadStudentLoginInfoFromDB] Supabase not initialized, trying to init...');
        try {
            await window.SupabaseAdapter?.init?.();
            if (!window.SupabaseAdapter?.supabase) {
                console.error('[loadStudentLoginInfoFromDB] Failed to initialize Supabase');
                return null;
            }
        } catch (e) {
            console.error('[loadStudentLoginInfoFromDB] Error initializing Supabase:', e);
            return null;
        }
    }
    
    try {
        console.log('[loadStudentLoginInfoFromDB] Querying DB for studentId:', studentId);
        
        // Query users table with link_id matching studentId and role = 'student'
        const { data: users, error } = await window.SupabaseAdapter.supabase
            .from('users')
            .select('id, account_handle, email, role, link_id, password')
            .eq('link_id', studentId)
            .eq('role', 'student');
        
        if (error) {
            console.error('[loadStudentLoginInfoFromDB] Supabase query error:', error);
            // Retry without role filter
            const { data: retryUsers, error: retryError } = await window.SupabaseAdapter.supabase
                .from('users')
                .select('id, account_handle, email, role, link_id, password')
                .eq('link_id', studentId);
            
            if (retryError) {
                console.error('[loadStudentLoginInfoFromDB] Retry query also failed:', retryError);
                return null;
            }
            
            if (retryUsers && retryUsers.length > 0) {
                const user = retryUsers[0];
                const hasPassword = !!(user.password && user.password.trim().length > 0);
                return {
                    id: user.id,
                    accountHandle: user.account_handle || null,
                    email: user.email || null,
                    role: user.role || null,
                    linkId: user.link_id || null,
                    hasPassword,
                    password: user.password || null // Trả về password để hiển thị (đã hash)
                };
            }
            
            return null;
        }
        
        if (users && users.length > 0) {
            const user = users[0];
            const hasPassword = !!(user.password && user.password.trim().length > 0);
            // Security: Don't log sensitive user data in production
            if (window.APP_MODE === 'dev' || window.location?.hostname === 'localhost') {
                console.log('[loadStudentLoginInfoFromDB] Found user:', { accountHandle: user.account_handle, hasPassword });
            }
            
            return {
                id: user.id,
                accountHandle: user.account_handle || null,
                email: user.email || null,
                role: user.role || null,
                linkId: user.link_id || null,
                hasPassword,
                password: user.password || null // Trả về password để hiển thị (đã hash)
            };
        }
        
        // Security: Only log in development mode
        if (window.APP_MODE === 'dev' || window.location?.hostname === 'localhost') {
            console.log('[loadStudentLoginInfoFromDB] No user found for studentId:', studentId);
        }
        return null;
    } catch (e) {
        console.error('[loadStudentLoginInfoFromDB] Exception:', e);
        return null;
    }
}

function sortStudentsByName(list) {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
        const nameA = (a?.fullName || '').toString();
        const nameB = (b?.fullName || '').toString();
        return nameA.localeCompare(nameB, 'vi', STUDENT_NAME_SORT_OPTIONS);
    });
}

function computeStudentClassFinancialData(studentId) {
    const records = window.UniData.getStudentClassesForStudent(studentId);
    return records.map(record => {
        const classInfo = (window.demo.classes || []).find(c => c.id === record.classId) || null;
        const manualSessions = Number(record.studentFeeSessions || 0);
        const manualTotal = Number(record.studentFeeTotal || 0);
        const classDefaultTotal = Number(classInfo?.tuitionPackageTotal || 0);
        const classDefaultSessions = Number(classInfo?.tuitionPackageSessions || 0);
        const explicitUnit = Number(record.studentTuitionPerSession || 0);
        const classDefaultUnit = (() => {
            if (!classInfo) return 0;
            if (classInfo.studentTuitionPerSession) return Number(classInfo.studentTuitionPerSession);
            if (classDefaultTotal > 0 && classDefaultSessions > 0) return classDefaultTotal / classDefaultSessions;
            return 0;
        })();
        const inferredUnit = (() => {
            if (manualTotal > 0 && manualSessions > 0) return manualTotal / manualSessions;
            if (explicitUnit > 0) return explicitUnit;
            if (classDefaultUnit > 0) return classDefaultUnit;
            if (classDefaultTotal > 0 && classDefaultSessions > 0) return classDefaultTotal / classDefaultSessions;
            return 0;
        })();

        const sessions = manualSessions > 0
            ? manualSessions
            : (classDefaultSessions > 0 ? classDefaultSessions : 0);

        const total = manualTotal > 0
            ? manualTotal
            : (sessions > 0 && inferredUnit > 0 ? inferredUnit * sessions : 0);

        const remaining = Math.max(0, Number(record.remainingSessions || 0));
        const attended = Math.max(0, Number(record.totalAttendedSessions || 0));
        const outstandingSessions = Math.max(0, Number(record.unpaidSessions || 0));
        const outstandingAmount = outstandingSessions > 0 && inferredUnit > 0 ? outstandingSessions * inferredUnit : 0;

        let unitSource = 'class-default';
        if (manualTotal > 0 && manualSessions > 0) unitSource = 'student-override';
        else if (explicitUnit > 0) unitSource = 'student-record';
        else if (classDefaultUnit > 0) unitSource = 'class-default';
        else if (total > 0 && sessions > 0) unitSource = 'derived';

        return {
            record,
            classInfo,
            total,
            sessions,
            unitPrice: inferredUnit,
            unitSource,
            remaining,
            attended,
            outstandingSessions,
            outstandingAmount
        };
    });
}

function formatCurrencyVND(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0 đ';
    return `${numeric.toLocaleString('vi-VN')} đ`;
}

function recordStudentWalletTransaction(studentId, type, amount, options = {}) {
    if (!studentId || !type || !Number.isFinite(amount)) return null;
    window.demo.walletTransactions = Array.isArray(window.demo.walletTransactions)
        ? window.demo.walletTransactions
        : [];
    const transaction = {
        id: window.UniData?.generateId ? window.UniData.generateId('wallet') : ('WT' + Math.random().toString(36).slice(2, 8).toUpperCase()),
        studentId,
        type,
        amount: Number(amount) || 0,
        note: options.note || '',
        date: options.date || new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString()
    };
    window.demo.walletTransactions.unshift(transaction);
    return transaction;
}

async function renderStudentDetail(studentId) {
    // Initialize listeners and try optimistic loading
    const pageKey = `student-detail-${studentId}`;
    if (!window[`__studentDetailListenersInitialized_${studentId}`]) {
        window.UniData?.initPageListeners?.(pageKey, () => renderStudentDetail(studentId), [
            'students', 'classes', 'studentClasses', 'sessions', 'payments', 'walletTransactions'
        ]);
        window[`__studentDetailListenersInitialized_${studentId}`] = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderStudentDetail(studentId), 10);
            return;
        } else {
            const main = document.querySelector('#main-content');
            if (main) {
                main.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderStudentDetail(studentId), 120);
            return;
        }
    }
    
    const main = document.querySelector('#main-content');
    if (!main) return;

    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) {
        main.innerHTML = '<div class="card"><p>Học sinh không tồn tại.</p><button class="btn mt-2" onclick="window.UniUI.loadPage(\'students\')">← Quay lại danh sách</button></div>';
        return;
    }
    
    // Load login info từ DB nếu đang xem trang detail
    let loginInfo = null;
    if (window.SupabaseAdapter?.isEnabled && window.SupabaseAdapter?.supabase) {
        try {
            loginInfo = await loadStudentLoginInfoFromDB(studentId);
            console.log('[renderStudentDetail] Loaded login info:', loginInfo);
            
            // Cập nhật student object với thông tin từ DB nếu có
            if (loginInfo) {
                if (loginInfo.accountHandle) {
                    student.accountHandle = loginInfo.accountHandle;
                }
                if (loginInfo.email) {
                    student.email = loginInfo.email;
                }
                if (loginInfo.password) {
                    student.accountPassword = loginInfo.password;
                }
            }
        } catch (err) {
            console.warn('[renderStudentDetail] Failed to load login info from DB:', err);
        }
    }

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    if (!currentUser) {
        main.innerHTML = `
            <div class="card">
                <h3>Yêu cầu đăng nhập</h3>
                <p class="text-muted">Vui lòng đăng nhập để xem thông tin học sinh.</p>
                <button class="btn btn-primary mt-2" onclick="window.UniUI.loadPage('home')">Đến trang đăng nhập</button>
        </div>
        `;
        return;
    }
    if (currentUser.role === 'student' && currentUser.linkId !== studentId) {
        main.innerHTML = `
            <div class="card">
                <h3>Không có quyền truy cập</h3>
                <p class="text-muted">Bạn chỉ có thể xem hồ sơ của chính mình.</p>
            </div>
        `;
        return;
    }
    if (currentUser.role === 'teacher') {
        const teacherClasses = window.UniData.getTeacherClasses ? window.UniData.getTeacherClasses(currentUser.linkId) : [];
        const allowedClassIds = new Set((teacherClasses || []).map(cls => cls.id));
        const isStudentOfTeacher = (window.demo.studentClasses || []).some(record =>
            record.studentId === studentId && allowedClassIds.has(record.classId) && record.status !== 'inactive'
        );
        if (!isStudentOfTeacher) {
            main.innerHTML = `
                <div class="card">
                    <h3>Không có quyền truy cập</h3>
                    <p class="text-muted">Học sinh này không thuộc lớp bạn quản lý.</p>
                </div>
            `;
            return;
        }
    }

    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    const isTeacherViewer = currentUser.role === 'teacher';
    const isStudentViewer = currentUser.role === 'student';
    const canManageClassActions = !isStudentViewer;
    const canEditStudentClassFinance = !isStudentViewer;
    const canExtendStudentClass = true;
    const canRefundStudentClass = !isStudentViewer;
    const canTopUp = !isStudentViewer;
    const canManageStudentRecord = isAdmin;
    const accountIconMode = (() => {
        if (isAdmin) return 'edit';
        if (isStudentViewer && currentUser.linkId === studentId) return 'self';
        if (isTeacherViewer) return 'view';
        return null;
    })();

    const breadcrumb = window.UniComponents?.breadcrumb([
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Học sinh', page: 'students' },
        { label: student.fullName, page: `student-detail:${studentId}` }
    ]) || '';

    const loanDebtAmount = Number(student.loanBalance || 0);
    const classData = computeStudentClassFinancialData(studentId);
    const showClassDeleteColumn = canManageClassActions;
    const walletBalance = formatCurrencyVND(student.walletBalance || 0);
    const statusBadgeClass = student.status === 'inactive' ? 'badge-muted' : 'badge-success';
    const statusLabel = student.status === 'inactive' ? 'Ngưng học' : 'Đang học';

    const classesTableHtml = classData.length ? `
        <div class="table-container" style="overflow-x: auto;">
            <table class="table-striped student-classes-table" id="studentClassesTable" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: var(--bg-secondary); border-bottom: 2px solid var(--border);">
                        <th style="padding: var(--spacing-3) var(--spacing-4); text-align: left; font-weight: 600; color: var(--text); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Tên lớp</th>
                        <th style="padding: var(--spacing-3) var(--spacing-4); text-align: left; font-weight: 600; color: var(--text); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Học phí</th>
                        <th style="padding: var(--spacing-3) var(--spacing-4); text-align: left; font-weight: 600; color: var(--text); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Đơn giá</th>
                        <th style="padding: var(--spacing-3) var(--spacing-4); text-align: left; font-weight: 600; color: var(--text); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Còn lại</th>
                        <th style="padding: var(--spacing-3) var(--spacing-4); text-align: left; font-weight: 600; color: var(--text); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Tổng học</th>
                        ${showClassDeleteColumn ? '<th style="padding: var(--spacing-3) var(--spacing-4); text-align: center; width: 60px; font-weight: 600; color: var(--text); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Xóa</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${classData.map((item, index) => {
                        const classId = item.classInfo ? item.classInfo.id : '';
                        const className = item.classInfo ? item.classInfo.name : 'Lớp đã xóa';
                        const displayTotal = item.total > 0 ? formatCurrencyVND(item.total) : '-';
                        const displaySessions = item.sessions > 0 ? `${item.sessions} buổi` : '-';
                        const unitPriceLabel = item.unitPrice > 0 ? formatCurrencyVND(item.unitPrice) : '-';
                        const remainingLabel = `${item.remaining || 0} buổi`;
                        const attendedLabel = `${item.attended || 0} buổi`;
                        const remainingSessions = item.remaining || 0;
                        const remainingBadgeClass = remainingSessions > 0 ? 'badge-success' : 'badge-muted';
                        const unitTooltip = (() => {
                            switch (item.unitSource) {
                                case 'student-override':
                                    return 'Đơn giá do học sinh chỉnh sửa thủ công';
                                case 'student-record':
                                    return 'Đơn giá ghi nhận từ dữ liệu học sinh';
                                case 'historical':
                                    return 'Đơn giá tính từ lịch sử thanh toán';
                                default:
                                    return 'Đơn giá mặc định của lớp';
                            }
                        })();
                        return `
                            <tr class="student-class-row" data-class-id="${classId}" data-record-id="${item.record.id}" style="border-bottom: 1px solid var(--border-light); transition: background-color 0.2s ease; ${index % 2 === 0 ? 'background: var(--bg);' : 'background: var(--bg-secondary);'}">
                                <td style="padding: var(--spacing-4);">
                                    ${canManageClassActions ? `
                                        <button class="btn student-class-link" data-action="open-class-actions" data-class-id="${classId}" style="background: transparent; border: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0; text-align: left; transition: color 0.2s ease;">
                                            ${className}
                                        </button>
                                    ` : `
                                        <span class="student-class-link-disabled" style="color: var(--text); font-weight: 600;">${className}</span>
                                    `}
                                </td>
                                <td style="padding: var(--spacing-4);">
                                    <div class="student-class-fee" style="margin-bottom: var(--spacing-2);">
                                        ${canEditStudentClassFinance ? `
                                            <button class="btn btn-link" data-action="edit-fee" data-class-id="${classId}" style="background: transparent; border: none; color: var(--primary); font-weight: 600; cursor: pointer; padding: 0; text-align: left; transition: color 0.2s ease;">
                                                ${displayTotal} / ${displaySessions}
                                            </button>
                                        ` : `
                                            <span class="student-fee-static" style="color: var(--text); font-weight: 600;">${displayTotal} / ${displaySessions}</span>
                                        `}
                                    </div>
                                    ${(canEditStudentClassFinance || canExtendStudentClass || canRefundStudentClass) ? `
                                        <div class="student-class-actions" style="display: flex; gap: var(--spacing-2);">
                                            ${canExtendStudentClass ? `<button class="btn btn-xs" data-action="extend-class" data-class-id="${classId}" style="padding: var(--spacing-1) var(--spacing-2); font-size: 0.75rem; background: var(--primary); color: white; border: none; border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease;">Gia hạn</button>` : ''}
                                            ${canRefundStudentClass ? `<button class="btn btn-xs" data-action="refund-class" data-class-id="${classId}" style="padding: var(--spacing-1) var(--spacing-2); font-size: 0.75rem; background: var(--warning); color: white; border: none; border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease;">Hoàn trả</button>` : ''}
                                        </div>
                                    ` : ''}
                                </td>
                                <td style="padding: var(--spacing-4);">
                                    <span title="${unitTooltip}" style="color: var(--text); font-weight: 500; cursor: help;">${unitPriceLabel}</span>
                                </td>
                                <td style="padding: var(--spacing-4);">
                                    <span class="badge ${remainingBadgeClass}" style="padding: var(--spacing-1) var(--spacing-3); border-radius: var(--radius); font-size: 0.875rem; font-weight: 600;">${remainingLabel}</span>
                                </td>
                                <td style="padding: var(--spacing-4);">
                                    <span style="color: var(--text); font-weight: 500;">${attendedLabel}</span>
                                </td>
                                ${showClassDeleteColumn ? `
                                    <td style="padding: var(--spacing-4); text-align: center;">
                                        <button class="btn-delete-icon" data-action="remove-class" data-class-id="${classId}" data-record-id="${item.record.id}" title="Xóa lớp" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--danger); border-radius: var(--radius); color: var(--danger); cursor: pointer; transition: all 0.2s ease;">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px;">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </td>
                                ` : ''}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    ` : `
        <div style="padding: var(--spacing-8); text-align: center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; color: var(--muted); margin-bottom: var(--spacing-4);">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <p style="margin: 0; color: var(--muted); font-size: 1rem; font-weight: 500;">Học sinh chưa tham gia lớp nào</p>
        </div>
    `;

    main.innerHTML = `
        ${breadcrumb}
        <div class="student-detail-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-6); padding: var(--spacing-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-2);">
                    ${accountIconMode ? `
                        <button 
                            class="student-account-icon-btn" 
                            id="studentAccountBtn"
                            data-student-id="${student.id}"
                            title="Thông tin tài khoản"
                            style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: 2px solid var(--primary-light); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </button>
                    ` : `
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: 2px solid var(--primary-light); display: flex; align-items: center; justify-content: center; color: white;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </div>
                    `}
                    <div>
                        <h2 style="margin: 0; font-size: 1.75rem; font-weight: 700; color: var(--text);">${student.fullName}</h2>
                        <div style="font-size: 0.875rem; color: var(--muted); margin-top: var(--spacing-1);">ID: ${student.id}</div>
                    </div>
                </div>
            </div>
            <span class="badge ${statusBadgeClass}" style="background: ${student.status === 'inactive' ? 'var(--muted)' : 'var(--success)'}; color: white; border: none; padding: var(--spacing-2) var(--spacing-4); font-weight: 600; border-radius: var(--radius);">${statusLabel}</span>
        </div>
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
            <div class="card student-info-card" style="border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-5); transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-4);">
                    <div style="width: 40px; height: 40px; border-radius: var(--radius); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--text);">Thông tin cá nhân</h3>
                </div>
                <div class="student-info-grid" style="display: grid; gap: var(--spacing-3);">
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Năm sinh:</span>
                        <span style="color: var(--text); font-weight: 600;">${student.birthYear || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Giới tính:</span>
                        <span style="color: var(--text); font-weight: 600;">${student.gender === 'female' ? 'Nữ' : 'Nam'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Email:</span>
                        <span style="color: var(--text); font-weight: 600; word-break: break-word; text-align: right;">${student.email || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Tỉnh/Thành:</span>
                        <span style="color: var(--text); font-weight: 600;">${student.province || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Trường:</span>
                        <span style="color: var(--text); font-weight: 600;">${student.school || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0;">
                        <span style="color: var(--muted); font-weight: 500;">Mục tiêu học tập:</span>
                        <span style="color: var(--text); font-weight: 600; text-align: right;">${student.goal || '-'}</span>
                    </div>
                </div>
            </div>
            ${canManageStudentRecord ? `
            <div class="card student-info-card" style="border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-5); transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-4);">
                    <button 
                        class="student-login-icon-btn" 
                        id="studentLoginIconBtn_${student.id}"
                        data-student-id="${student.id}"
                        title="Chỉnh sửa thông tin đăng nhập"
                        style="width: 40px; height: 40px; border-radius: var(--radius); background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; align-items: center; justify-content: center; color: white; border: none; cursor: pointer; transition: all 0.2s ease;"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </button>
                    <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--text);">Thông tin đăng nhập</h3>
                </div>
                <div class="student-info-grid" style="display: grid; gap: var(--spacing-3);">
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Handle:</span>
                        <span style="color: var(--text); font-weight: 600;">${loginInfo?.accountHandle || student.accountHandle || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Email đăng nhập:</span>
                        <span style="color: var(--text); font-weight: 600; word-break: break-word; text-align: right;">${loginInfo?.email || student.email || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0;">
                        <span style="color: var(--muted); font-weight: 500;">Mật khẩu mặc định:</span>
                        <span style="color: var(--text); font-weight: 600;">${loginInfo?.password || student.accountPassword || 'Chưa khai báo'}</span>
                    </div>
                </div>
                <p style="font-size: 0.75rem; color: var(--muted); margin-top: var(--spacing-4); padding-top: var(--spacing-3); border-top: 1px solid var(--border-light); line-height: 1.5;">Thông tin này chỉ hiển thị cho quản trị. Để chỉnh sửa, vui lòng mở form chỉnh sửa học sinh.</p>
            </div>
            ` : ''}
            <div class="card student-info-card" style="border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-5); transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-4);">
                    <div style="width: 40px; height: 40px; border-radius: var(--radius); background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); display: flex; align-items: center; justify-content: center; color: white;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                    </div>
                    <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--text);">Thông tin phụ huynh</h3>
                </div>
                <div class="student-info-grid" style="display: grid; gap: var(--spacing-3);">
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0; border-bottom: 1px solid var(--border-light);">
                        <span style="color: var(--muted); font-weight: 500;">Phụ huynh:</span>
                        <span style="color: var(--text); font-weight: 600;">${student.parentName || '-'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: var(--spacing-2) 0;">
                        <span style="color: var(--muted); font-weight: 500;">SĐT phụ huynh:</span>
                        <span style="color: var(--text); font-weight: 600;">${student.parentPhone || '-'}</span>
                    </div>
                </div>
            </div>
            <div class="card student-account-card" style="border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-5); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-4);">
                    <h3 style="margin: 0; font-size: 1.125rem; font-weight: 600; color: white;">Tài khoản</h3>
                    <button class="btn btn-icon" id="studentTxnHistoryBtn" title="Xem lịch sử giao dịch" aria-label="Xem lịch sử giao dịch" style="width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                            <line x1="1" y1="10" x2="23" y2="10"></line>
                        </svg>
                    </button>
                </div>
                <div style="font-size: 2rem; font-weight: 700; margin-bottom: var(--spacing-4); color: white;">${walletBalance}</div>
                <div style="display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-4);">
                    ${canTopUp ? `<button class="btn btn-primary" id="studentTopUpBtn" style="flex: 1; padding: var(--spacing-2) var(--spacing-4); background: white; color: var(--primary); border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; transition: all 0.2s ease;">Nạp tiền</button>` : ''}
                    <button class="btn" id="studentLoanBtn" style="flex: 1; padding: var(--spacing-2) var(--spacing-4); background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: var(--radius); font-weight: 600; cursor: pointer; transition: all 0.2s ease;">Ứng tiền</button>
                </div>
                <div style="padding-top: var(--spacing-4); border-top: 1px solid rgba(255,255,255,0.2);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-3);" title="Số tiền học sinh đã ứng để gia hạn buổi học, cần hoàn trả sau">
                        <span style="opacity: 0.9; font-size: 0.875rem;">Nợ ứng tiền</span>
                        <strong style="font-size: 1.125rem;">${formatCurrencyVND(loanDebtAmount)}</strong>
                    </div>
                    <button class="btn btn-primary" id="studentPayDebtBtn" ${loanDebtAmount > 0 ? '' : 'disabled'} style="width: 100%; padding: var(--spacing-2) var(--spacing-4); background: ${loanDebtAmount > 0 ? 'white' : 'rgba(255,255,255,0.3)'}; color: ${loanDebtAmount > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.6)'}; border: none; border-radius: var(--radius); font-weight: 600; cursor: ${loanDebtAmount > 0 ? 'pointer' : 'not-allowed'}; transition: all 0.2s ease;">Thanh toán</button>
                </div>
            </div>
        </div>
        <div class="card mt-4" style="border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-5); box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-4);">
                <div style="display: flex; align-items: center; gap: var(--spacing-3);">
                    <div style="width: 40px; height: 40px; border-radius: var(--radius); background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; align-items: center; justify-content: center; color: white;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                    </div>
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--text);">Các lớp đang học</h3>
                </div>
                ${canManageClassActions ? `
                    <button class="session-icon-btn session-icon-btn-primary" id="studentAddClassBtn" title="Thêm lớp cho học sinh" style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M12 5v14"></path>
                            <path d="M19 12H5"></path>
                        </svg>
                    </button>
                ` : ''}
            </div>
            ${classesTableHtml}
        </div>
    `;

    if (accountIconMode) {
        const accountBtn = main.querySelector('#studentAccountBtn');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => openStudentInfoPanel(student.id));
        }
    }

    // Attach event listener for login info icon (only for admin)
    if (canManageStudentRecord) {
        const loginIconBtn = main.querySelector(`#studentLoginIconBtn_${student.id}`);
        if (loginIconBtn) {
            loginIconBtn.addEventListener('click', () => openStudentLoginInfoModal(student.id));
        }
    }

    const topUpBtn = main.querySelector('#studentTopUpBtn');
    if (topUpBtn) topUpBtn.addEventListener('click', () => openStudentTopUpModal(studentId));

    const loanBtn = main.querySelector('#studentLoanBtn');
    if (loanBtn) loanBtn.addEventListener('click', () => openStudentLoanModal(studentId));

    const historyBtn = main.querySelector('#studentTxnHistoryBtn');
    if (historyBtn) historyBtn.addEventListener('click', () => openStudentTransactionHistory(studentId));

    const payDebtBtn = main.querySelector('#studentPayDebtBtn');
    if (payDebtBtn) payDebtBtn.addEventListener('click', () => handleStudentDebtPayment(studentId));

    const addClassBtn = main.querySelector('#studentAddClassBtn');
    if (addClassBtn) addClassBtn.addEventListener('click', () => openStudentTransferModal(studentId));

    attachStudentClassRowEvents(studentId);
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.(pageKey, [
        'students', 'classes', 'studentClasses', 'sessions', 'payments', 'walletTransactions'
    ]);
}

function openStudentInfoPanel(studentId) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    const isSelfStudent = currentUser?.role === 'student' && currentUser.linkId === studentId;
    const canEdit = isAdmin || isSelfStudent;

    const panel = document.createElement('div');
    panel.className = 'teacher-info-panel student-info-panel';
    panel.id = 'studentInfoPanel';
    panel.innerHTML = `
        <div class="teacher-info-header">
            <h3>Thông tin cá nhân</h3>
            <button class="btn-icon-close" id="closeStudentInfoPanel" aria-label="Đóng">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="teacher-info-content">
            <div class="teacher-info-view" id="studentInfoView">
                <div class="info-item">
                    <label>Họ tên</label>
                    <div class="info-value">${student.fullName || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Năm sinh</label>
                    <div class="info-value">${student.birthYear || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Email</label>
                    <div class="info-value">${student.email || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Handle đăng nhập</label>
                    <div class="info-value">${student.accountHandle || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Mật khẩu mặc định</label>
                    <div class="info-value">${student.accountPassword || 'Chưa khai báo'}</div>
                </div>
                <div class="info-item">
                    <label>Trường</label>
                    <div class="info-value">${student.school || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Tỉnh/Thành</label>
                    <div class="info-value">${student.province || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Phụ huynh</label>
                    <div class="info-value">${student.parentName || '-'}</div>
                </div>
                <div class="info-item">
                    <label>SĐT phụ huynh</label>
                    <div class="info-value">${student.parentPhone || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Mục tiêu học tập</label>
                    <div class="info-value">${student.goal || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Trạng thái</label>
                    <div class="info-value">${student.status === 'inactive' ? 'Ngưng học' : 'Đang học'}</div>
                </div>
                ${canEdit ? `
                    <div class="info-actions">
                        <button class="btn btn-primary" id="editStudentInfoBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: var(--spacing-2);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            Chỉnh sửa
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'teacher-info-backdrop student-info-backdrop';
    backdrop.id = 'studentInfoBackdrop';

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    setTimeout(() => {
        backdrop.classList.add('active');
        panel.classList.add('active');
    }, 10);

    const closePanel = () => {
        backdrop.classList.remove('active');
        panel.classList.remove('active');
        setTimeout(() => {
            backdrop.remove();
            panel.remove();
        }, 300);
    };

    backdrop.addEventListener('click', closePanel);
    panel.querySelector('#closeStudentInfoPanel')?.addEventListener('click', closePanel);

    if (canEdit) {
        // Open edit modal when clicking edit button
        panel.querySelector('#editStudentInfoBtn')?.addEventListener('click', () => {
            closePanel();
            // Open student edit modal
            if (typeof openStudentModal === 'function') {
                openStudentModal(studentId, true);
            } else if (window.StudentPage && typeof window.StudentPage.openStudentModal === 'function') {
                window.StudentPage.openStudentModal(studentId, true);
            }
        });
    }
}

function openStudentLoginInfoModal(studentId) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) {
        window.UniUI.toast('Không tìm thấy học sinh', 'error');
        return;
    }

    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    if (!isAdmin) {
        window.UniUI.toast('Chỉ quản trị viên mới có quyền chỉnh sửa thông tin đăng nhập', 'error');
        return;
    }

    const form = document.createElement('form');
    form.className = 'student-login-info-form';
    form.innerHTML = `
        <div style="margin-bottom: var(--spacing-4); padding: var(--spacing-3); background: var(--bg-secondary); border-radius: var(--radius); border-left: 3px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <strong style="color: var(--text);">${student.fullName}</strong>
            </div>
            <div style="font-size: 0.875rem; color: var(--muted);">ID: ${student.id}</div>
        </div>

        <div class="form-group">
            <label for="loginInfoHandle">Handle / Username <span class="text-danger">*</span></label>
            <input 
                type="text" 
                id="loginInfoHandle" 
                name="accountHandle" 
                value="${student.accountHandle || ''}" 
                placeholder="vd: hocsinh1"
                required
                style="width: 100%; padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--border); border-radius: var(--radius);"
            >
            <small class="text-muted" style="display: block; margin-top: var(--spacing-1); font-size: 0.875rem;">Sử dụng cho đăng nhập nội bộ</small>
        </div>

        <div class="form-group">
            <label for="loginInfoPassword">Mật khẩu mặc định <span class="text-danger">*</span></label>
            <input 
                type="text" 
                id="loginInfoPassword" 
                name="accountPassword" 
                value="${student.accountPassword || ''}" 
                placeholder="vd: 123456"
                required
                style="width: 100%; padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--border); border-radius: var(--radius);"
            >
            <small class="text-muted" style="display: block; margin-top: var(--spacing-1); font-size: 0.875rem;">Dùng khi cấp lại tài khoản</small>
        </div>

        <div class="form-group">
            <label for="loginInfoEmail">Email đăng nhập</label>
            <input 
                type="email" 
                id="loginInfoEmail" 
                name="loginEmail" 
                value="${student.email || ''}"
                placeholder="Email dùng để đăng nhập (nếu để trống sẽ dùng email liên hệ)"
                style="width: 100%; padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--border); border-radius: var(--radius);"
            >
            <small class="text-muted" style="display: block; margin-top: var(--spacing-1); font-size: 0.875rem;">Email đăng nhập có thể khác với email liên hệ. Nếu để trống sẽ dùng email liên hệ làm email đăng nhập.</small>
        </div>

        <div class="form-actions" style="display: flex; justify-content: flex-end; gap: var(--spacing-2); margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border);">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()" style="padding: var(--spacing-2) var(--spacing-4); border-radius: var(--radius);">Hủy</button>
            <button type="submit" class="btn btn-primary" style="padding: var(--spacing-2) var(--spacing-4); border-radius: var(--radius);">Lưu thay đổi</button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const accountHandle = String(formData.get('accountHandle') || '').trim();
        const accountPassword = String(formData.get('accountPassword') || '').trim();
        const loginEmail = String(formData.get('loginEmail') || '').trim();

        // Validation
        if (!accountHandle) {
            window.UniUI.toast('Vui lòng nhập Handle / Username', 'error');
            return;
        }
        if (!accountPassword) {
            window.UniUI.toast('Vui lòng nhập mật khẩu mặc định', 'error');
            return;
        }

        const updateData = {
            accountHandle: accountHandle,
            accountPassword: accountPassword
        };

        // Nếu có loginEmail, cập nhật email (email đăng nhập)
        if (loginEmail) {
            updateData.email = loginEmail;
        }

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                const result = window.UniLogic.updateEntity('student', studentId, updateData);
                return {
                    supabaseEntities: result.supabaseEntities || { students: [] },
                    supabaseDeletes: result.supabaseDeletes || null
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    window.UniUI.toast('Đã cập nhật thông tin đăng nhập', 'success');
                    renderStudentDetail(studentId);
                },
                onError: (error) => {
                    console.error('Error updating login info:', error);
                    window.UniUI.toast('Có lỗi xảy ra khi cập nhật thông tin đăng nhập: ' + error.message, 'error');
                },
                onRollback: () => {
                    // UI will be refreshed in onError
                }
            }
        );
    });

    window.UniUI.openModal('Chỉnh sửa thông tin đăng nhập', form);
}

function openStudentClassActionsModal(studentId, classId) {
    const record = (window.demo.studentClasses || []).find(sc => sc.studentId === studentId && sc.classId === classId);
    const classInfo = (window.demo.classes || []).find(c => c.id === classId) || null;

    if (!record) {
        window.UniUI.toast('Không tìm thấy dữ liệu lớp học cho học sinh này', 'error');
        return;
    }

    const unitForDebt = (() => {
        if (record.studentTuitionPerSession) return Number(record.studentTuitionPerSession);
        if (record.studentFeeTotal && record.studentFeeSessions) {
            const calculated = Number(record.studentFeeTotal) / Number(record.studentFeeSessions || 1);
            if (Number.isFinite(calculated)) return calculated;
        }
        return defaultStudentUnit;
    })();
    const outstandingSessions = Math.max(0, Number(record.unpaidSessions || 0));
    const outstandingAmount = outstandingSessions > 0 && unitForDebt > 0 ? outstandingSessions * unitForDebt : 0;

    const container = document.createElement('div');
    container.className = 'grid gap-3';
    const defaultPackageTotal = classInfo?.tuitionPackageTotal || 0;
    const defaultPackageSessions = classInfo?.tuitionPackageSessions || 0;
    const defaultStudentUnit = (() => {
        if (!classInfo) return 0;
        if (classInfo.studentTuitionPerSession) return Number(classInfo.studentTuitionPerSession);
        if (defaultPackageTotal > 0 && defaultPackageSessions > 0) return defaultPackageTotal / defaultPackageSessions;
        return 0;
    })();
    container.innerHTML = `
        <div class="text-muted">
            <div><strong>Lớp:</strong> ${classInfo ? classInfo.name : 'Lớp đã xóa'}</div>
            <div><strong>Gia sư:</strong> ${classInfo && Array.isArray(classInfo.teacherIds) ? classInfo.teacherIds.map(tid => (window.demo.teachers || []).find(t => t.id === tid)?.fullName).filter(Boolean).join(', ') || '-' : '-'}</div>
            <div><strong>Học phí mỗi buổi:</strong> ${formatCurrencyVND(defaultStudentUnit)}</div>
            ${(defaultPackageTotal > 0 && defaultPackageSessions > 0) ? `<div><strong>Gói học phí:</strong> ${formatCurrencyVND(defaultPackageTotal)} / ${defaultPackageSessions} buổi</div>` : ''}
        </div>
        <div class="grid gap-2 text-muted">
            <div><strong>Buổi đã mua:</strong> ${record.totalPurchasedSessions || 0}</div>
            <div><strong>Buổi còn lại:</strong> ${record.remainingSessions || 0}</div>
            <div><strong>Nợ học phí:</strong> ${formatCurrencyVND(outstandingAmount)}</div>
            <div><strong>Tổng buổi đã học:</strong> ${record.totalAttendedSessions || 0}</div>
        </div>
        <div class="flex gap-2">
            <button class="btn btn-primary" id="studentExtendSessionsBtn">Gia hạn buổi</button>
            <button class="btn" id="studentRefundSessionsBtn">Hoàn trả</button>
            <button class="btn" id="studentViewClassBtn" ${classInfo ? '' : 'disabled'}>Xem lớp</button>
        </div>
    `;

    window.UniUI.openModal('Quản lý lớp học của học sinh', container);

    container.querySelector('#studentExtendSessionsBtn')?.addEventListener('click', () => {
        window.UniUI.closeModal();
        openStudentExtendSessionsModal(studentId, classId);
    });
    container.querySelector('#studentRefundSessionsBtn')?.addEventListener('click', () => {
        window.UniUI.closeModal();
        openStudentRefundSessionsModal(studentId, classId);
    });
    container.querySelector('#studentViewClassBtn')?.addEventListener('click', () => {
        if (classInfo) {
            window.UniUI.closeModal();
            window.UniUI.loadPage(`class-detail:${classInfo.id}`);
        }
    });
}

function openStudentTopUpModal(studentId) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return;

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="topUpAmount">Số tiền nạp (VND)</label>
            <input type="text" inputmode="numeric" id="topUpAmount" name="amount" class="form-control" required>
            <div class="text-muted text-sm mt-1">Có thể nhập số lẻ (>= 1.000₫).</div>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Nạp tiền</button>
        </div>
    `;

    const amountInput = form.querySelector('#topUpAmount');
    if (amountInput) {
        window.UniUI.attachCurrencyInput(amountInput, { required: true });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const amount = window.UniUI.getCurrencyValue(amountInput);
        if (!Number.isFinite(amount) || amount <= 0) {
            window.UniUI.toast('Số tiền không hợp lệ', 'error');
            return;
        }

        // 1. Optimistic update: Update local state immediately
        const previousStudent = JSON.parse(JSON.stringify(student));
        const updatedStudent = window.UniData.adjustStudentWallet(studentId, amount) || student;
        const transaction = recordStudentWalletTransaction(studentId, 'topup', amount);
        
        // 2. Update UI immediately (optimistic)
        renderStudentDetail(studentId);
        window.UniUI.toast('Đang xử lý...', 'info');

        // 3. Save with optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                const entities = { students: [updatedStudent] };
                if (transaction) {
                    entities.walletTransactions = [transaction];
                }
                return {
                    supabaseEntities: entities
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderStudentDetail(studentId);
                    window.UniUI.toast('Đã nạp tiền vào tài khoản', 'success');
                },
                onError: (error) => {
                    console.error('Failed to save transaction:', error);
                    window.UniUI.toast('Không thể nạp tiền: ' + error.message, 'error');
                    renderStudentDetail(studentId);
                },
                onRollback: () => {
                    renderStudentDetail(studentId);
                }
            }
        );
    });

    window.UniUI.openModal('Nạp tiền cho học sinh', form);
}

function openStudentLoanModal(studentId) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return;

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="loanAmount">Số tiền muốn vay (VND)</label>
            <input type="text" inputmode="numeric" id="loanAmount" name="amount" class="form-control" required>
            <div class="text-muted text-sm mt-1">Số tiền vay sẽ được cộng vào tài khoản hiện tại.</div>
        </div>
        <div class="form-group">
            <label for="loanNote">Ghi chú</label>
            <textarea id="loanNote" name="note" class="form-control" rows="3" placeholder="Mục đích vay (tuỳ chọn)"></textarea>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Xác nhận vay</button>
        </div>
    `;

    const amountInput = form.querySelector('#loanAmount');
    window.UniUI.attachCurrencyInput(amountInput, { required: true });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const amount = window.UniUI.getCurrencyValue(amountInput);
        if (!Number.isFinite(amount) || amount <= 0) {
            window.UniUI.toast('Số tiền vay không hợp lệ', 'error');
            return;
        }

        // 1. Optimistic update: Update local state immediately
        const previousStudent = JSON.parse(JSON.stringify(student));
        const updatedStudent = window.UniData.adjustStudentWallet(studentId, amount) || student;
        updatedStudent.loanBalance = Number(updatedStudent.loanBalance || 0) + amount;
        let note = '';
        if (form.loanNote) {
            note = form.loanNote.value.trim();
            if (note) {
                updatedStudent.lastLoanNote = note;
            }
        }
        const transaction = recordStudentWalletTransaction(studentId, 'advance', amount, { note });
        
        // 2. Update UI immediately (optimistic) - đảm bảo student object được refresh từ window.demo
        // Refresh student từ window.demo để đảm bảo có dữ liệu mới nhất
        const currentStudent = (window.demo.students || []).find(s => s.id === studentId);
        if (currentStudent) {
            Object.assign(currentStudent, updatedStudent);
        }
        renderStudentDetail(studentId);
        window.UniUI.toast('Đang xử lý...', 'info');

        // 3. Save with optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                const entities = { students: [updatedStudent] };
                if (transaction) {
                    entities.walletTransactions = [transaction];
                }
                return {
                    supabaseEntities: entities
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    // Đảm bảo refresh student từ window.demo trước khi render
                    const refreshedStudent = (window.demo.students || []).find(s => s.id === studentId);
                    if (refreshedStudent) {
                        Object.assign(refreshedStudent, updatedStudent);
                    }
                    renderStudentDetail(studentId);
                    window.UniUI.toast('Đã cộng tiền vay vào tài khoản', 'success');
                },
                onError: (error) => {
                    console.error('Failed to save loan transaction:', error);
                    window.UniUI.toast('Không thể ứng tiền: ' + error.message, 'error');
                    // Rollback: restore previous student state
                    const studentToRollback = (window.demo.students || []).find(s => s.id === studentId);
                    if (studentToRollback) {
                        Object.assign(studentToRollback, previousStudent);
                    }
                    renderStudentDetail(studentId);
                },
                onRollback: () => {
                    // Rollback: restore previous student state
                    const studentToRollback = (window.demo.students || []).find(s => s.id === studentId);
                    if (studentToRollback) {
                        Object.assign(studentToRollback, previousStudent);
                    }
                    renderStudentDetail(studentId);
                }
            }
        );
    });

    window.UniUI.openModal('Ứng tiền', form);
}

function openStudentTransactionHistory(studentId) {
    const transactions = (window.demo.walletTransactions || [])
        .filter(tx => tx.studentId === studentId && ['topup', 'loan', 'advance', 'repayment'].includes(tx.type))
        .sort((a, b) => ((b.date || '').localeCompare(a.date || '')));

    const typeLabel = {
        topup: 'Nạp tiền',
        loan: 'Ứng tiền',
        advance: 'Ứng tiền',
        repayment: 'Thanh toán nợ'
    };

    const container = document.createElement('div');
    container.className = 'transaction-history';
    container.innerHTML = transactions.length
        ? `
            <div class="table-container transaction-table">
                <table>
                    <thead>
                        <tr>
                            <th>Ngày</th>
                            <th>Loại</th>
                            <th>Số tiền</th>
                            <th>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(tx => `
                            <tr>
                                <td>${tx.date || '-'}</td>
                                <td>${typeLabel[tx.type] || tx.type}</td>
                                <td>${formatCurrencyVND(tx.amount)}</td>
                                <td>${tx.note || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `
        : '<p class="text-muted">Chưa có giao dịch nào.</p>';

    window.UniUI.openModal('Lịch sử giao dịch', container);
}

function openStudentExtendSessionsModal(studentId, classId) {
    const record = window.UniData.ensureStudentClassRecord(studentId, classId);
    const classInfo = (window.demo.classes || []).find(c => c.id === classId) || null;
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!record || !student) return;

    const classDefaultTotal = classInfo?.tuitionPackageTotal || 0;
    const classDefaultSessions = classInfo?.tuitionPackageSessions || 0;
    const defaultUnit = (() => {
        if (!classInfo) return 0;
        if (classInfo.studentTuitionPerSession) return Number(classInfo.studentTuitionPerSession);
        if (classDefaultTotal > 0 && classDefaultSessions > 0) return classDefaultTotal / classDefaultSessions;
        return 0;
    })();
    const manualUnit = (record.studentFeeTotal && record.studentFeeSessions)
        ? (record.studentFeeTotal / record.studentFeeSessions)
        : null;
    const historicalUnit = (record.totalPurchasedSessions && record.totalPaidAmount)
        ? (record.totalPaidAmount / record.totalPurchasedSessions)
        : null;
    const resolvedUnit = manualUnit ?? historicalUnit ?? defaultUnit;
    const walletBalance = Number(student.walletBalance || 0);

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="extendSessions">Số buổi muốn gia hạn</label>
            <input type="number" id="extendSessions" name="sessions" class="form-control" min="1" step="1" required>
        </div>
        <div class="form-group">
            <label for="extendUnitPrice">Giá mỗi buổi (VND)</label>
            <input type="text" inputmode="numeric" id="extendUnitPrice" name="unitPrice" class="form-control" value="${resolvedUnit || 0}" required>
            <div class="text-muted text-sm mt-1">
                Giá tham chiếu: ${formatCurrencyVND(resolvedUnit || 0)}
                ${manualUnit === null && defaultUnit > 0 ? `(mặc định lớp ${formatCurrencyVND(defaultUnit)})` : ''}
                ${classDefaultTotal > 0 && classDefaultSessions > 0 ? `<br>Gói lớp: ${formatCurrencyVND(classDefaultTotal)} / ${classDefaultSessions} buổi` : ''}
            </div>
        </div>
        <div class="form-group text-muted" id="extendTotalAmount">Tổng tiền: 0 VND</div>
        <div class="text-muted">Số dư hiện tại: ${formatCurrencyVND(walletBalance)}</div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Gia hạn</button>
        </div>
    `;

    const sessionsInput = form.querySelector('#extendSessions');
    const unitInput = form.querySelector('#extendUnitPrice');
    const totalLabel = form.querySelector('#extendTotalAmount');

    const updateTotal = () => {
        const sessions = Number(sessionsInput.value || 0);
        const unitPrice = window.UniUI.getCurrencyValue(unitInput);
        const total = sessions > 0 && unitPrice > 0 ? sessions * unitPrice : 0;
        const insufficient = total > walletBalance && sessions > 0 && unitPrice > 0;
        totalLabel.textContent = `Tổng tiền: ${formatCurrencyVND(total)}${insufficient ? ' • Số dư không đủ' : ''}`;
    };

    sessionsInput.addEventListener('input', updateTotal);
    window.UniUI.attachCurrencyInput(unitInput, { required: true, onChange: updateTotal });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        let sessions = Number(sessionsInput.value);
        const unitPrice = window.UniUI.getCurrencyValue(unitInput);
        if (!Number.isFinite(sessions) || sessions <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
            window.UniUI.toast('Vui lòng nhập dữ liệu hợp lệ', 'error');
            return;
        }
        sessions = Math.round(sessions);
        sessionsInput.value = sessions;
        const totalCost = sessions * unitPrice;
        if ((student.walletBalance || 0) < totalCost) {
            window.UniUI.toast('Số dư không đủ để gia hạn', 'error');
            return;
        }

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                record.totalPurchasedSessions = (record.totalPurchasedSessions || 0) + sessions;
                record.totalPaidAmount = (record.totalPaidAmount || 0) + totalCost;
                record.remainingSessions = (record.remainingSessions || 0) + sessions;
                record.studentTuitionPerSession = unitPrice;

                const updatedStudent = window.UniData.adjustStudentWallet(studentId, -totalCost) || student;
                
                return {
                    supabaseEntities: {
                        students: [updatedStudent],
                        studentClasses: [record]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderStudentDetail(studentId);
                    window.UniUI.toast('Đã gia hạn buổi học', 'success');
                },
                onError: (error) => {
                    console.error('Failed to extend sessions:', error);
                    window.UniUI.toast('Không thể gia hạn buổi học: ' + error.message, 'error');
                    renderStudentDetail(studentId);
                },
                onRollback: () => {
                    renderStudentDetail(studentId);
                }
            }
        );
    });

    window.UniUI.openModal('Gia hạn buổi học', form);
    updateTotal();
}

async function handleStudentDebtPayment(studentId) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) return;

    const totalDebt = Number(student.loanBalance || 0);
    if (totalDebt <= 0) {
        window.UniUI.toast('Học sinh không còn nợ học phí.', 'info');
        return;
    }

    const wallet = Number(student.walletBalance || 0);
    if (wallet <= 0) {
        window.UniUI.toast('Tài khoản hiện không đủ để thanh toán nợ.', 'warning');
        return;
    }

    const paidAmount = Math.min(wallet, totalDebt);
    if (paidAmount <= 0) {
        window.UniUI.toast('Không thể thanh toán nợ với số dư hiện tại.', 'warning');
        return;
    }

    // 1. Optimistic update: Update local state immediately
    const previousStudent = JSON.parse(JSON.stringify(student));
    const adjustedStudent = window.UniData.adjustStudentWallet(studentId, -paidAmount) || student;
    adjustedStudent.loanBalance = Math.max(0, Number(adjustedStudent.loanBalance || 0) - paidAmount);
    const transaction = recordStudentWalletTransaction(studentId, 'repayment', paidAmount, { note: 'Thanh toán nợ ứng tiền' });
    
    // 2. Update UI immediately - đảm bảo student object được refresh từ window.demo
    const currentStudent = (window.demo.students || []).find(s => s.id === studentId);
    if (currentStudent) {
        Object.assign(currentStudent, adjustedStudent);
    }
    renderStudentDetail(studentId);
    window.UniUI.toast('Đang xử lý...', 'info');

    // 3. Save with optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            const entities = { students: [adjustedStudent] };
            if (transaction) {
                entities.walletTransactions = [transaction];
            }
            return {
                supabaseEntities: entities
            };
        },
        {
            onSuccess: () => {
                window.UniUI.closeModal();
                // Đảm bảo refresh student từ window.demo trước khi render
                const refreshedStudent = (window.demo.students || []).find(s => s.id === studentId);
                if (refreshedStudent) {
                    Object.assign(refreshedStudent, adjustedStudent);
                }
                renderStudentDetail(studentId);
                const remainingDebt = adjustedStudent.loanBalance || 0;
                if (remainingDebt <= 0.01) {
                    window.UniUI.toast('Đã thanh toán toàn bộ nợ học phí.', 'success');
                } else {
                    window.UniUI.toast(`Đã thanh toán ${formatCurrencyVND(paidAmount)}. Nợ còn lại ${formatCurrencyVND(remainingDebt)}.`, 'info');
                }
            },
            onError: (error) => {
                console.error('Failed to save repayment transaction:', error);
                window.UniUI.toast('Không thể thanh toán nợ: ' + error.message, 'error');
                // Rollback: restore previous student state
                const studentToRollback = (window.demo.students || []).find(s => s.id === studentId);
                if (studentToRollback) {
                    Object.assign(studentToRollback, previousStudent);
                }
                renderStudentDetail(studentId);
            },
            onRollback: () => {
                // Rollback: restore previous student state
                const studentToRollback = (window.demo.students || []).find(s => s.id === studentId);
                if (studentToRollback) {
                    Object.assign(studentToRollback, previousStudent);
                }
                renderStudentDetail(studentId);
            }
        }
    );
}

function openStudentRefundSessionsModal(studentId, classId) {
    const record = window.UniData.ensureStudentClassRecord(studentId, classId);
    const classInfo = (window.demo.classes || []).find(c => c.id === classId) || null;
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!record || !student) return;

    const classDefaultTotal = classInfo?.tuitionPackageTotal || 0;
    const classDefaultSessions = classInfo?.tuitionPackageSessions || 0;
    const defaultUnit = (() => {
        if (!classInfo) return 0;
        if (classInfo.studentTuitionPerSession) return Number(classInfo.studentTuitionPerSession);
        if (classDefaultTotal > 0 && classDefaultSessions > 0) return classDefaultTotal / classDefaultSessions;
        return 0;
    })();
    const manualUnit = (record.studentFeeTotal && record.studentFeeSessions)
        ? (record.studentFeeTotal / record.studentFeeSessions)
        : null;
    const historicalUnit = (record.totalPurchasedSessions && record.totalPaidAmount)
        ? (record.totalPaidAmount / record.totalPurchasedSessions)
        : null;
    const resolvedUnit = manualUnit ?? historicalUnit ?? defaultUnit;

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="refundSessions">Số buổi hoàn trả</label>
            <input type="number" id="refundSessions" name="sessions" class="form-control" min="1" max="${record.remainingSessions || 0}" required>
            <div class="text-muted text-sm mt-1">Có thể hoàn tối đa ${record.remainingSessions || 0} buổi.</div>
        </div>
        <div class="form-group">
            <label for="refundUnitPrice">Giá mỗi buổi (VND)</label>
            <input type="text" inputmode="numeric" id="refundUnitPrice" name="unitPrice" class="form-control" value="${resolvedUnit || 0}" required>
            <div class="text-muted text-sm mt-1">
                Giá tham chiếu: ${formatCurrencyVND(resolvedUnit || 0)}
                ${manualUnit === null && defaultUnit > 0 ? `(mặc định lớp ${formatCurrencyVND(defaultUnit)})` : ''}
                ${classDefaultTotal > 0 && classDefaultSessions > 0 ? `<br>Gói lớp: ${formatCurrencyVND(classDefaultTotal)} / ${classDefaultSessions} buổi` : ''}
            </div>
        </div>
        <div class="form-group text-muted" id="refundTotalAmount">Hoàn lại: 0 VND</div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Hoàn trả</button>
        </div>
    `;

    const sessionsInput = form.querySelector('#refundSessions');
    const unitInput = form.querySelector('#refundUnitPrice');
    const totalLabel = form.querySelector('#refundTotalAmount');

    const updateTotal = () => {
        const sessions = Number(sessionsInput.value || 0);
        const unitPriceValue = window.UniUI.getCurrencyValue(unitInput);
        const total = sessions > 0 && unitPriceValue > 0 ? sessions * unitPriceValue : 0;
        totalLabel.textContent = `Hoàn lại: ${formatCurrencyVND(total)}`;
    };

    sessionsInput.addEventListener('input', updateTotal);
    window.UniUI.attachCurrencyInput(unitInput, { required: true, onChange: updateTotal });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        let sessions = Number(sessionsInput.value);
        const unitPriceValue = window.UniUI.getCurrencyValue(unitInput);
        if (!Number.isFinite(sessions) || sessions <= 0 || sessions > (record.remainingSessions || 0)) {
            window.UniUI.toast('Số buổi hoàn trả không hợp lệ', 'error');
            return;
        }
        if (!Number.isFinite(unitPriceValue) || unitPriceValue <= 0) {
            window.UniUI.toast('Giá buổi không hợp lệ', 'error');
            return;
        }
        sessions = Math.round(sessions);
        sessionsInput.value = sessions;
        const totalRefund = sessions * unitPriceValue;

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                record.remainingSessions = Math.max(0, (record.remainingSessions || 0) - sessions);
                record.totalPurchasedSessions = Math.max(0, (record.totalPurchasedSessions || 0) - sessions);
                record.totalPaidAmount = Math.max(0, (record.totalPaidAmount || 0) - totalRefund);
                record.studentTuitionPerSession = unitPriceValue;

                const updatedStudent = window.UniData.adjustStudentWallet(studentId, totalRefund) || student;
                
                return {
                    supabaseEntities: {
                        students: [updatedStudent],
                        studentClasses: [record]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderStudentDetail(studentId);
                    window.UniUI.toast('Đã hoàn trả học phí', 'success');
                },
                onError: (error) => {
                    console.error('Failed to refund sessions:', error);
                    window.UniUI.toast('Không thể hoàn trả học phí: ' + error.message, 'error');
                    renderStudentDetail(studentId);
                },
                onRollback: () => {
                    renderStudentDetail(studentId);
                }
            }
        );
    });

    window.UniUI.openModal('Hoàn trả học phí', form);
    updateTotal();
}

async function handleRemoveStudentFromClass(studentId, classId, recordId) {
    const records = (window.demo.studentClasses || []);
    const recordIndex = records.findIndex(sc => sc.id === recordId || (sc.studentId === studentId && sc.classId === classId));
    if (recordIndex === -1) {
        window.UniUI.toast('Không tìm thấy lớp để xóa', 'error');
        return;
    }

    const record = records[recordIndex];
    const classInfo = (window.demo.classes || []).find(c => c.id === classId) || null;
    if (!confirm('Bạn có chắc chắn muốn xóa lớp này khỏi học sinh?')) {
        return;
    }

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            const remainingSessions = Math.max(0, Number(record.remainingSessions || 0));
            let refundAmount = 0;
            if (remainingSessions > 0) {
                const unitPrice = window.UniData.getStudentFeePerSession
                    ? window.UniData.getStudentFeePerSession(record)
                    : 0;
                if (unitPrice > 0) {
                    refundAmount = Math.round(remainingSessions * unitPrice);
                }
            }

            let updatedStudent = null;
            if (refundAmount > 0) {
                updatedStudent = window.UniData.adjustStudentWallet(studentId, refundAmount);
            } else {
                updatedStudent = (window.demo.students || []).find(s => s.id === studentId) || null;
            }

            records.splice(recordIndex, 1);
            
            // Sync student.classId with all remaining active classes
            if (updatedStudent && window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
                window.UniData.syncStudentClassId(studentId);
                updatedStudent = (window.demo.students || []).find(s => s.id === studentId) || updatedStudent;
            }

            const supabaseEntities = {};
            const supabaseDeletes = {};
            
            if (record.id) {
                supabaseDeletes.studentClasses = [record.id];
            }
            // Note: We don't save student.classId to database (it's memory-only, synced from studentClasses)
            // Only save if wallet was adjusted (for refund)
            if (updatedStudent && refundAmount > 0) {
                // Remove classId before saving to avoid foreign key constraint issues
                const studentToSave = { ...updatedStudent };
                delete studentToSave.classId;
                supabaseEntities.students = [studentToSave];
            }
            if (refundAmount > 0) {
                window.demo.payments = window.demo.payments || [];
                const paymentRecord = {
                    id: window.UniData.generateId ? window.UniData.generateId('payment') : ('P' + Math.random().toString(36).slice(2, 8).toUpperCase()),
                    studentId,
                    classId,
                    amount: refundAmount,
                    status: 'refund',
                    date: new Date().toISOString().slice(0, 10),
                    note: `Hoàn trả do xóa lớp ${classInfo ? classInfo.name : classId} khỏi học sinh`
                };
                window.demo.payments.push(paymentRecord);
                supabaseEntities.payments = [paymentRecord];
            }

            return {
                supabaseEntities: Object.keys(supabaseEntities).length > 0 ? supabaseEntities : null,
                supabaseDeletes: Object.keys(supabaseDeletes).length > 0 ? supabaseDeletes : null
            };
        },
        {
            onSuccess: () => {
                window.UniUI.closeModal();
                renderStudentDetail(studentId);
                const remainingSessions = Math.max(0, Number(record.remainingSessions || 0));
                let refundAmount = 0;
                if (remainingSessions > 0) {
                    const unitPrice = window.UniData.getStudentFeePerSession
                        ? window.UniData.getStudentFeePerSession(record)
                        : 0;
                    if (unitPrice > 0) {
                        refundAmount = Math.round(remainingSessions * unitPrice);
                    }
                }
                const message = refundAmount > 0
                    ? `Đã xóa lớp khỏi học sinh và hoàn ${formatCurrencyVND(refundAmount)} vào tài khoản.`
                    : 'Đã xóa lớp khỏi học sinh.';
                window.UniUI.toast(message, 'success');
            },
            onError: (error) => {
                console.error('Failed to remove student from class:', error);
                window.UniUI.toast('Không thể xóa lớp khỏi học sinh: ' + error.message, 'error');
                renderStudentDetail(studentId);
            },
            onRollback: () => {
                renderStudentDetail(studentId);
            }
        }
    );
}

function openStudentTransferModal(studentId) {
    const student = (window.demo.students || []).find(s => s.id === studentId);
    if (!student) {
        window.UniUI.toast('Không tìm thấy học sinh', 'error');
        return;
    }

    const classes = window.demo.classes || [];
    const existingClassIds = new Set(window.UniData.getStudentClassesForStudent(studentId).map(record => record.classId));
    const availableClasses = classes
        .filter(cls => !existingClassIds.has(cls.id))
        .map(cls => ({
            ...cls,
            normalizedName: window.UniData?.normalizeText
                ? window.UniData.normalizeText(cls.name)
                : (cls.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        }));

    if (!availableClasses.length) {
        window.UniUI.toast('Học sinh đã tham gia tất cả các lớp hiện có', 'info');
        return;
    }

    const form = document.createElement('div');
    form.className = 'grid gap-3';
    form.innerHTML = `
        <div>
            <div class="text-muted text-sm mb-2">Học sinh hiện đang tham gia ${existingClassIds.size} lớp.</div>
            <div class="form-group">
                <label for="studentClassSearch">Tìm lớp để thêm vào học sinh</label>
                <input type="search" id="studentClassSearch" class="form-control" placeholder="Tìm lớp để thêm vào học sinh" autocomplete="off">
                <div id="studentClassSearchResults" class="search-dropdown"></div>
            </div>
        </div>
        <div class="form-actions mt-2">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Đóng</button>
        </div>
    `;

    const formatCurrency = (value) => {
        if (window.UniData && typeof window.UniData.formatCurrency === 'function') {
            return window.UniData.formatCurrency(value);
        }
        return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
    };

    function renderClassResults(query = '') {
        const container = form.querySelector('#studentClassSearchResults');
        const normalizedQuery = window.UniData?.normalizeText
            ? window.UniData.normalizeText(query)
            : query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        const matches = normalizedQuery
            ? availableClasses.filter(cls => cls.normalizedName.includes(normalizedQuery))
            : availableClasses.slice(0, 8);

        if (!matches.length) {
            container.innerHTML = '<div class="search-empty text-muted">Không tìm thấy lớp phù hợp.</div>';
            container.classList.add('visible');
            return;
        }

        container.innerHTML = matches.map(cls => `
            <button type="button" class="search-item student-class-search-item" data-class-id="${cls.id}">
                <div class="search-item-title">${cls.name}</div>
                <div class="search-item-sub text-muted text-xs">
                    ${cls.studentTuitionPerSession ? `Học phí: ${formatCurrency(cls.studentTuitionPerSession)} / buổi` : 'Chưa cấu hình học phí'}
                </div>
            </button>
        `).join('');
        container.classList.add('visible');
    }

    form.addEventListener('click', async (event) => {
        const item = event.target.closest('.student-class-search-item');
        if (!item) return;

        const classId = item.dataset.classId;
        if (!classId || existingClassIds.has(classId)) {
            window.UniUI.toast('Học sinh đã tham gia lớp này', 'warning');
            return;
        }

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                const record = window.UniData.ensureStudentClassRecord(studentId, classId, { status: 'active' });
                // Sync student.classId with all active classes (memory-only, not saved to DB)
                if (window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
                    window.UniData.syncStudentClassId(studentId);
                } else {
                    // Fallback: ensure classId includes this class
                    const currentClassId = student.classId;
                    const currentClassIdArray = Array.isArray(currentClassId) 
                        ? currentClassId 
                        : (currentClassId ? [currentClassId] : []);
                    
                    if (!currentClassIdArray.includes(classId)) {
                        currentClassIdArray.push(classId);
                        student.classId = currentClassIdArray.length > 0 ? currentClassIdArray : null;
                }
                }
                
                // IMPORTANT: Do NOT save student.classId to database (it's memory-only, synced from studentClasses)
                // Only save studentClass record
                return {
                    supabaseEntities: {
                        studentClasses: [record]
                        // Removed: students: [student] - don't save student when adding to class
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    window.UniUI.toast('Đã thêm học sinh vào lớp', 'success');
                    renderStudentDetail(studentId);
                },
                onError: (error) => {
                    console.error('Failed to add student to class:', error);
                    window.UniUI.toast('Không thể thêm học sinh vào lớp: ' + error.message, 'error');
                },
                onRollback: () => {
                    // UI will be refreshed in onError
                }
            }
        );

        const searchInput = form.querySelector('#studentClassSearch');
        if (searchInput) searchInput.value = '';
        renderClassResults('');
    });

    const searchInput = form.querySelector('#studentClassSearch');
    searchInput.addEventListener('input', (event) => {
        renderClassResults(event.target.value);
    });
    searchInput.addEventListener('focus', () => renderClassResults(searchInput.value));

    document.addEventListener('click', function handleOutside(event) {
        if (!form.contains(event.target)) {
            const resultsContainer = form.querySelector('#studentClassSearchResults');
            if (resultsContainer) {
                resultsContainer.classList.remove('visible');
            }
            document.removeEventListener('click', handleOutside);
        }
    });

    window.UniUI.openModal('Thêm lớp cho học sinh', form);
}

function openStudentClassFeeModal(studentId, classId) {
    const record = window.UniData.ensureStudentClassRecord(studentId, classId);
    if (!record) {
        window.UniUI.toast('Không tìm thấy dữ liệu lớp để chỉnh sửa học phí', 'error');
        return;
    }

    const classInfo = (window.demo.classes || []).find(c => c.id === classId) || null;
    const defaultUnit = (() => {
        if (!classInfo) return 0;
        if (classInfo.studentTuitionPerSession) return Number(classInfo.studentTuitionPerSession);
        const total = Number(classInfo?.tuitionPackageTotal || 0);
        const sessions = Number(classInfo?.tuitionPackageSessions || 0);
        if (total > 0 && sessions > 0) return total / sessions;
        return 0;
    })();
    const currentUnit = window.UniData.getStudentFeePerSession ? window.UniData.getStudentFeePerSession(record) : defaultUnit;
    const total = record.studentFeeTotal || record.totalPaidAmount || 0;
    const sessions = record.studentFeeSessions || record.totalPurchasedSessions || 0;
    const unit = currentUnit || defaultUnit;

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="studentFeeTotal">Tổng học phí (VND)</label>
            <input type="text" inputmode="numeric" id="studentFeeTotal" name="feeTotal" class="form-control" value="${total}" required>
        </div>
        <div class="form-group">
            <label for="studentFeeSessions">Số buổi</label>
            <input type="number" id="studentFeeSessions" name="feeSessions" class="form-control" min="1" step="1" value="${sessions || 1}" required>
        </div>
        <div class="form-group text-muted" id="studentFeePerSession">Đơn giá 1 buổi: ${formatCurrencyVND(unit)}</div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </div>
    `;

    const totalInput = form.querySelector('#studentFeeTotal');
    const sessionsInput = form.querySelector('#studentFeeSessions');
    const perSessionLabel = form.querySelector('#studentFeePerSession');

    window.UniUI.attachCurrencyInput(totalInput, { required: true, onChange: () => updatePerSession() });

    const updatePerSession = () => {
        const totalAmount = window.UniUI.getCurrencyValue(totalInput);
        const sessionCount = Number(sessionsInput.value || 0);
        const perSession = sessionCount > 0 ? totalAmount / sessionCount : 0;
        perSessionLabel.textContent = `Đơn giá 1 buổi: ${formatCurrencyVND(perSession)}`;
    };

    sessionsInput.addEventListener('input', updatePerSession);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const feeTotal = window.UniUI.getCurrencyValue(totalInput);
        let feeSessions = Number(sessionsInput.value);
        if (!Number.isFinite(feeTotal) || feeTotal < 0) {
            window.UniUI.toast('Tổng học phí không hợp lệ', 'error');
            return;
        }
        if (!Number.isFinite(feeSessions) || feeSessions <= 0) {
            window.UniUI.toast('Số buổi không hợp lệ', 'error');
            return;
        }
        feeSessions = Math.round(feeSessions);
        sessionsInput.value = feeSessions;

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                record.studentFeeTotal = feeTotal;
                record.studentFeeSessions = feeSessions;
                record.studentTuitionPerSession = feeSessions > 0 ? Math.round(feeTotal / feeSessions) : 0;
                
                return {
                    supabaseEntities: {
                        studentClasses: [record]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderStudentDetail(studentId);
                    window.UniUI.toast('Đã cập nhật học phí học sinh', 'success');
                },
                onError: (error) => {
                    console.error('Failed to update student fee:', error);
                    window.UniUI.toast('Không thể cập nhật học phí: ' + error.message, 'error');
                    renderStudentDetail(studentId);
                },
                onRollback: () => {
                    renderStudentDetail(studentId);
                }
            }
        );
    });

    window.UniUI.openModal('Chỉnh sửa học phí học sinh', form);
    updatePerSession();
}

/**
 * Render students list page
 */
// Filter state for students page
let studentsFilterState = {
    search: '',
    classId: 'all',
    province: 'all',
    status: 'all'
};

async function renderStudents() {
    // Initialize listeners and try optimistic loading
    if (!window.__studentsListenersInitialized) {
        window.UniData?.initPageListeners?.('students', renderStudents, ['students', 'classes', 'studentClasses']);
        window.__studentsListenersInitialized = true;
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;
    
    // Ensure function is available globally immediately
    if (typeof window !== 'undefined') {
        window.renderStudents = renderStudents;
    }

    // Show loading state initially
    const showLoadingState = () => {
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="card" style="padding: var(--spacing-8); text-align: center;">
                    <div class="spinner" style="margin: 0 auto var(--spacing-4);"></div>
                    <p class="text-muted">Đang tải dữ liệu học sinh từ cơ sở dữ liệu...</p>
                </div>
            `;
        }
    };

    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        showLoadingState();
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderStudents(), 10);
            return;
        } else {
            setTimeout(() => renderStudents(), 120);
            return;
        }
    }

    // Fetch fresh data from DB in background to sync
    let dbStudentsCount = null;
    let syncWarning = null;
    
    const fetchAndSyncStudents = async () => {
        try {
            if (window.DatabaseAdapter && window.DatabaseAdapter.load) {
                console.log('[renderStudents] Fetching students from DB for sync check...');
                const dbData = await window.DatabaseAdapter.load({ 
                    preferLocal: false, 
                    skipLocal: false,
                    tables: ['students']
                });
                
                if (dbData && Array.isArray(dbData.students)) {
                    // Filter out test/demo students (same filter as local)
                    const dbStudents = dbData.students.filter(s => 
                        s.id !== 'S001' && 
                        String(s.email || '').toLowerCase() !== 'hocsinh1@edu.vn' &&
                        String(s.fullName || '').trim() !== 'Nguyễn Văn Tâm'
                    );
                    
                    dbStudentsCount = dbStudents.length;
                    
                    // Get local students count (same filter)
                    const localStudents = (window.demo.students || []).filter(s => 
                        s.id !== 'S001' && 
                        String(s.email || '').toLowerCase() !== 'hocsinh1@edu.vn' &&
                        String(s.fullName || '').trim() !== 'Nguyễn Văn Tâm'
                    );
                    
                    const localCount = localStudents.length;
                    
                    console.log(`[renderStudents] DB sync check: DB has ${dbStudentsCount} students, Local has ${localCount} students`);
                    
                    // If counts don't match, sync local data with DB
                    if (dbStudentsCount !== localCount) {
                        console.warn(`[renderStudents] ⚠️ Mismatch detected: DB (${dbStudentsCount}) vs Local (${localCount})`);
                        
                        // Update window.demo with fresh DB data
                        // Merge DB students with local students (keep local changes if any)
                        const dbStudentMap = new Map();
                        dbStudents.forEach(s => {
                            if (s && s.id) {
                                dbStudentMap.set(s.id, s);
                            }
                        });
                        
                        // Merge: DB students overwrite local, but keep local-only students temporarily
                        const localStudentMap = new Map();
                        localStudents.forEach(s => {
                            if (s && s.id) {
                                localStudentMap.set(s.id, s);
                            }
                        });
                        
                        // Update window.demo.students with DB data
                        window.demo.students = Array.from(dbStudentMap.values());
                        
                        // Log any students that exist in DB but not in local (these are the "missing" ones)
                        const missingStudents = dbStudents.filter(s => !localStudentMap.has(s.id));
                        if (missingStudents.length > 0) {
                            console.log(`[renderStudents] Found ${missingStudents.length} students in DB that were missing in local:`, missingStudents.map(s => s.id));
                            syncWarning = `Phát hiện ${missingStudents.length} học sinh mới từ cơ sở dữ liệu. Đã tự động đồng bộ.`;
                        }
                        
                        console.log('[renderStudents] ✅ Synced local students with DB data');
                        
                        // Save to localStorage
                        try {
                            localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
                            console.log('[renderStudents] ✅ Saved synced data to localStorage');
                        } catch (e) {
                            console.warn('[renderStudents] Failed to save to localStorage:', e);
                        }
                        
                        // Re-render with fresh data
                        setTimeout(() => renderStudents(), 100);
                        return;
                    } else {
                        console.log('[renderStudents] ✅ Students count matches between DB and local');
                    }
                }
            }
        } catch (error) {
            console.error('[renderStudents] Error fetching students from DB:', error);
        }
    };

    // Start background sync (don't await - let it run async)
    fetchAndSyncStudents().catch(err => {
        console.error('[renderStudents] Background sync failed:', err);
    });

    const canCreate = window.UniUI.hasRole('admin','teacher');
    
    // Get all students for counting (from local, which may be synced by background fetch)
    const allStudents = (window.demo.students || []).filter(s => 
        s.id !== 'S001' && 
        String(s.email || '').toLowerCase() !== 'hocsinh1@edu.vn' &&
        String(s.fullName || '').trim() !== 'Nguyễn Văn Tâm'
    );
    
    // Get filtered students count
    const filteredStudents = getFilteredStudents(allStudents);
    const localCount = allStudents.length;
    
    // Get unique values for filters
    const classes = window.demo.classes || [];
    const provinces = [...new Set(allStudents.map(s => s.province).filter(Boolean))].sort();
    
    // Determine display count and warning message
    const displayCount = dbStudentsCount !== null ? dbStudentsCount : localCount;
    const countMismatch = dbStudentsCount !== null && dbStudentsCount !== localCount;

    mainContent.innerHTML = `
        ${syncWarning ? `
            <div class="card" style="margin-bottom: var(--spacing-4); background: var(--warning-light, #fff3cd); border: 1px solid var(--warning, #ffc107); padding: var(--spacing-3); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--warning, #ffc107); flex-shrink: 0;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span style="color: var(--warning-dark, #856404); font-weight: 500;">${syncWarning}</span>
                </div>
            </div>
        ` : ''}
        <div class="students-page-header">
            <div class="students-page-title-row">
                <h2>Học sinh</h2>
                <div class="students-count-badge" style="position: relative;">
                    <span class="students-count-number">${filteredStudents.length}</span>
                    <span class="students-count-label">học sinh</span>
                    ${countMismatch ? `
                        <span style="position: absolute; top: -8px; right: -8px; background: var(--error, #dc3545); color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;" title="Số lượng không khớp với DB">!</span>
                    ` : ''}
                </div>
            </div>
            ${canCreate ? `
                <button onclick="openStudentModal()" class="btn btn-primary btn-add-icon" title="Thêm học sinh mới">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            ` : ''}
        </div>

        <div class="students-filters-card card">
            <div class="students-search-bar">
                <div class="search-input-wrapper">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
            <input 
                type="text" 
                        id="studentSearchInput" 
                        class="search-input" 
                        placeholder="Tìm kiếm theo tên, email, trường..."
                        value="${studentsFilterState.search}"
                        autocomplete="off"
                    />
                    ${studentsFilterState.search ? `
                        <button class="search-clear-btn" onclick="clearStudentSearch()" title="Xóa tìm kiếm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="students-filters-row">
                <div class="filter-group">
                    <label class="filter-label">Lớp</label>
                    <select id="studentClassFilter" class="filter-select">
                        <option value="all">Tất cả lớp</option>
                        ${classes.map(c => `
                            <option value="${c.id}" ${studentsFilterState.classId === c.id ? 'selected' : ''}>${c.name}</option>
                        `).join('')}
            </select>
                </div>
                
                <div class="filter-group">
                    <label class="filter-label">Tỉnh/Thành</label>
                    <select id="studentProvinceFilter" class="filter-select">
                        <option value="all">Tất cả tỉnh</option>
                        ${provinces.map(p => `
                            <option value="${p}" ${studentsFilterState.province === p ? 'selected' : ''}>${p}</option>
                `).join('')}
            </select>
                </div>
                
                <div class="filter-group">
                    <label class="filter-label">Trạng thái</label>
                    <select id="studentStatusFilter" class="filter-select">
                        <option value="all">Tất cả</option>
                        <option value="active" ${studentsFilterState.status === 'active' ? 'selected' : ''}>Đang học</option>
                        <option value="inactive" ${studentsFilterState.status === 'inactive' ? 'selected' : ''}>Nghỉ học</option>
                    </select>
                </div>
                
                <div class="filter-actions">
                    <button class="btn btn-secondary" onclick="resetStudentFilters()" title="Đặt lại bộ lọc">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        Đặt lại
                    </button>
                </div>
            </div>
        </div>

        <div class="card">
            <div style="padding: var(--spacing-3); border-bottom: 1px solid var(--border); background: var(--surface-subtle, #f8f9fa);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-2);">
                    <span style="color: var(--muted); font-size: 0.875rem;">
                        ${countMismatch ? `
                            <span style="color: var(--error, #dc3545); font-weight: 500;">⚠️ Đang hiển thị ${localCount}/${displayCount} học sinh</span>
                            <span style="margin-left: var(--spacing-2);">(Chưa tải đủ dữ liệu từ cơ sở dữ liệu)</span>
                        ` : `
                            Đang hiển thị <strong>${filteredStudents.length}</strong> / <strong>${displayCount}</strong> học sinh
                        `}
                    </span>
                    ${countMismatch ? `
                        <button class="btn btn-sm" onclick="renderStudents()" style="display: flex; align-items: center; gap: var(--spacing-1);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                            Tải lại dữ liệu
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="table-container">
                <table id="studentsTable" class="table-striped">
                    <thead>
                        <tr>
                            <th>Tên</th>
                            <th>Tỉnh</th>
                            <th>Lớp</th>
                            <th>Trạng thái</th>
                            ${window.UniUI.hasRole('admin') ? '<th style="width: 80px;"></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>${renderStudentRows()}</tbody>
                </table>
            </div>
        </div>
    `;

    attachStudentRowListeners();
    attachStudentFilterListeners();
    
    // Restore search input handler if input was recreated
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput && studentSearchInputHandler) {
        // Remove old listener if exists
        searchInput.removeEventListener('input', studentSearchInputHandler);
        // Re-attach
        searchInput.addEventListener('input', studentSearchInputHandler);
    }
}

function getFilteredStudents(students) {
    let filtered = [...students];
    
    // Search filter
    if (studentsFilterState.search) {
        const searchLower = studentsFilterState.search.toLowerCase();
        filtered = filtered.filter(s => 
            (s.fullName || '').toLowerCase().includes(searchLower) ||
            (s.email || '').toLowerCase().includes(searchLower) ||
            (s.school || '').toLowerCase().includes(searchLower) ||
            (s.province || '').toLowerCase().includes(searchLower)
        );
    }
    
    // Class filter
    if (studentsFilterState.classId !== 'all') {
        filtered = filtered.filter(s => {
            // Check if student is in the filtered class (classId can be array)
            const studentClassIds = Array.isArray(s.classId) 
                ? s.classId.filter(Boolean)
                : (s.classId ? [s.classId] : []);
            return studentClassIds.includes(studentsFilterState.classId);
        });
    }
    
    // Province filter
    if (studentsFilterState.province !== 'all') {
        filtered = filtered.filter(s => s.province === studentsFilterState.province);
    }
    
    // Status filter
    if (studentsFilterState.status !== 'all') {
        filtered = filtered.filter(s => (s.status || 'active') === studentsFilterState.status);
    }
    
    return filtered;
}

// Store search input reference to prevent re-attachment
let studentSearchInputHandler = null;

function attachStudentFilterListeners() {
    // Search input - preserve focus and cursor position
    const searchInput = document.getElementById('studentSearchInput');
    if (searchInput && !studentSearchInputHandler) {
        let searchTimeout;
        let isUpdating = false;
        
        const handleInput = (e) => {
            // Update state immediately for UI responsiveness
            studentsFilterState.search = e.target.value;
            
            // Update clear button visibility immediately
            const wrapper = searchInput.closest('.search-input-wrapper');
            if (wrapper) {
                const clearBtn = wrapper.querySelector('.search-clear-btn');
                if (e.target.value) {
                    if (!clearBtn) {
                        const btn = document.createElement('button');
                        btn.className = 'search-clear-btn';
                        btn.onclick = clearStudentSearch;
                        btn.title = 'Xóa tìm kiếm';
                        btn.innerHTML = `
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        `;
                        wrapper.appendChild(btn);
                    }
                } else {
                    if (clearBtn) clearBtn.remove();
                }
            }
            
            // Debounce the actual filtering
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (!isUpdating) {
                    isUpdating = true;
                    // Reset to page 1 when filtering
                    if (window.AppStore?.store) {
                        window.AppStore.store.dispatch({
                            type: window.AppStore.actions.SET_PAGE,
                            payload: { key: 'students', page: 1 }
                        });
                    }
                    // Only re-render table, not the entire page
                    renderStudentTableOnly();
                    isUpdating = false;
                }
            }, 300); // Debounce 300ms
        };
        
        searchInput.addEventListener('input', handleInput);
        studentSearchInputHandler = handleInput;
    }
    
    // Class filter
    const classFilter = document.getElementById('studentClassFilter');
    if (classFilter) {
        classFilter.addEventListener('change', (e) => {
            studentsFilterState.classId = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'students', page: 1 }
                });
            }
            renderStudents();
        });
    }
    
    // Province filter
    const provinceFilter = document.getElementById('studentProvinceFilter');
    if (provinceFilter) {
        provinceFilter.addEventListener('change', (e) => {
            studentsFilterState.province = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'students', page: 1 }
                });
            }
            renderStudents();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('studentStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            studentsFilterState.status = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'students', page: 1 }
                });
            }
            renderStudents();
        });
    }
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('students', ['students', 'classes', 'studentClasses']);
}

function clearStudentSearch() {
    studentsFilterState.search = '';
    if (window.AppStore?.store) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'students', page: 1 }
        });
    }
    renderStudents();
}

function resetStudentFilters() {
    studentsFilterState = {
        search: '',
        classId: 'all',
        province: 'all',
        status: 'all'
    };
    if (window.AppStore?.store) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'students', page: 1 }
        });
    }
    renderStudents();
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.clearStudentSearch = clearStudentSearch;
    window.resetStudentFilters = resetStudentFilters;
}

/**
 * Render table rows for students
 */
function renderStudentRows() {
    // IMPORTANT: Filter out "Nguyễn Văn Tâm" (S001) if it somehow still exists
const allStudents = (window.demo.students || []).filter(s => 
        s.id !== 'S001' && 
        String(s.email || '').toLowerCase() !== 'hocsinh1@edu.vn' &&
        String(s.fullName || '').trim() !== 'Nguyễn Văn Tâm'
    );
    
    // Apply filters
    const filteredStudents = getFilteredStudents(allStudents);
    const sortedStudents = sortStudentsByName(filteredStudents);
    
    const pager = window.AppStore?.store.getState().pager.students || { page:1, pageSize:10 };
    const total = sortedStudents.length;
    const totalPages = Math.max(1, Math.ceil(total / pager.pageSize));
    const start = (pager.page - 1) * pager.pageSize;
    const slice = sortedStudents.slice(start, start + pager.pageSize);
    const canEdit = window.UniUI.hasRole('admin');
    
    const rows = slice.map(student => {
        const classRecords = window.UniData ? window.UniData.getStudentClassesForStudent(student.id) : [];
        // classId can be array, string, or null - get all classes
        const studentClassIds = Array.isArray(student.classId) 
            ? student.classId.filter(Boolean)
            : (student.classId ? [student.classId] : []);
        
        // Get all class names for this student
        const classNames = studentClassIds
            .map(classId => {
                const cls = (window.demo.classes || []).find(c => c.id === classId);
                return cls ? cls.name : null;
            })
            .filter(Boolean);
        
        // Display all classes, separated by comma or bullet
        const classesDisplay = classNames.length > 0 
            ? classNames.join(', ') 
            : '-';
        
        const status = student.status || 'active';
        const statusLabel = status === 'inactive' ? 'Nghỉ học' : 'Đang học';
        const statusClass = status === 'inactive' ? 'status-inactive' : 'status-active';
        
            return `
            <tr class="student-row-clickable" data-id="${student.id}">
                    <td>
                    <a href="#" class="teacher-name-link" onclick="event.preventDefault(); event.stopPropagation(); window.goToStudentDetail('${student.id}');">${student.fullName}</a>
                    </td>
                <td>${student.province || '-'}</td>
                <td>${classesDisplay}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${status === 'inactive' ? `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                        ` : `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        `}
                        ${statusLabel}
                        </span>
                    </td>
                ${canEdit ? `
                    <td>
                        <div class="crud-actions">
                            <button class="btn-edit-icon" onclick="event.stopPropagation(); openStudentModal('${student.id}'); return false;" title="Sửa">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                            <button class="btn-delete-icon" onclick="event.stopPropagation(); if(confirm('Bạn có chắc muốn xóa học sinh này?')) { window.StudentPage.delete('${student.id}'); } return false;" title="Xóa">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        </div>
                    </td>
                ` : ''}
                </tr>
            `;
        }).join('');
    
    // Calculate student count up to current page
    const studentsUpToCurrentPage = Math.min(start + slice.length, total);
    
    const pagerHtml = `
        <tr>
            <td colspan="${canEdit ? 5 : 4}">
                <div class="pagination-container">
                    <button 
                        class="pagination-btn pagination-btn-prev" 
                        ${pager.page<=1?'disabled':''} 
                        onclick="(function(){ window.AppStore.store.dispatch({type: window.AppStore.actions.SET_PAGE, payload:{key:'students', page: Math.max(1, ${pager.page}-1)}}); renderStudents(); })()"
                        title="Trang trước"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <span class="pagination-page-info">
                        <span class="pagination-current">${studentsUpToCurrentPage}</span>
                        <span class="pagination-separator">/</span>
                        <span class="pagination-total">${total}</span>
                    </span>
                    <button 
                        class="pagination-btn pagination-btn-next" 
                        ${pager.page>=totalPages?'disabled':''} 
                        onclick="(function(){ window.AppStore.store.dispatch({type: window.AppStore.actions.SET_PAGE, payload:{key:'students', page: Math.min(${totalPages}, ${pager.page}+1)}}); renderStudents(); })()"
                        title="Trang sau"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
    return rows + pagerHtml;
}

/**
 * Render only the table without re-rendering filters (to preserve input focus)
 */
function renderStudentTableOnly() {
    const tbody = document.querySelector('#studentsTable tbody');
    if (!tbody) {
        renderStudents();
        return;
    }
    
    tbody.innerHTML = renderStudentRows();
    attachStudentRowListeners();
}

/**
 * Attach event listeners for student page
 */
function attachStudentRowListeners() {
    const rows = document.querySelectorAll('#studentsTable tbody tr.student-row-clickable');
    rows.forEach(row => {
        row.removeEventListener('click', handleStudentRowClick);
        row.addEventListener('click', handleStudentRowClick);
    });
}

function handleStudentRowClick(event) {
    if (event.target.closest('.crud-actions') || event.target.closest('.btn-edit-icon') || event.target.closest('.btn-delete-icon')) {
        return;
    }
    const row = event.currentTarget;
    const studentId = row?.dataset?.id;
    if (!studentId) return;
    event.preventDefault();
    window.goToStudentDetail(studentId);
}

/**
 * Open student modal for view/edit
 * @param {string} [studentId] - Student ID
 * @param {boolean} [editMode] - Whether to open in edit mode
 * @param {string} [defaultClassId] - Preselect class when creating
 * @param {Function} [onSaved] - Callback after successful save
 */
// Toggle password visibility - Enhanced
function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    // Update icons using the new structure
    const eyeIcon = button.querySelector('.password-eye-icon');
    const eyeOffIcon = button.querySelector('.password-eye-off-icon');
    
    if (eyeIcon && eyeOffIcon) {
        if (isPassword) {
            // Show password - hide eye, show eye-off
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        } else {
            // Hide password - show eye, hide eye-off
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
        }
    } else {
        // Fallback for old structure
        const svg = button.querySelector('svg');
        if (svg) {
            if (isPassword) {
                svg.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        }
    }
}

function openStudentModal(studentId = null, editMode = false, defaultClassId = null, onSaved = null) {
    const student = studentId ? 
        window.demo.students.find(s => s.id === studentId) : 
        { status: 'active', gender: 'male', classId: defaultClassId, accountHandle: '', accountPassword: '' };

    if (studentId && !student) {
        window.UniUI.openModal('Error', '<p>Student not found</p>');
        return;
    }

    if (!editMode && studentId) {
        // View mode
        // classId can be array, string, or null - get all classes
        const studentClassIds = Array.isArray(student.classId) 
            ? student.classId.filter(Boolean)
            : (student.classId ? [student.classId] : []);
        
        // Get all class names for this student
        const classNames = studentClassIds
            .map(classId => {
                const cls = window.demo.classes.find(c => c.id === classId);
                return cls ? cls.name : null;
            })
            .filter(Boolean);
        
        const classesDisplay = classNames.length > 0 
            ? classNames.join(', ') 
            : 'Not assigned';
        
        const content = `
            <div class="student-detail">
                <div class="mb-4">
                    <h4>${student.fullName}</h4>
                    <div class="text-muted">ID: ${student.id}</div>
                </div>

                <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                    <div>
                        <strong>Personal Information</strong>
                        <div class="text-muted">Birth Year: ${student.birthYear}</div>
                        <div class="text-muted">Gender: ${student.gender}</div>
                        <div class="text-muted">Email: ${student.email || '-'}</div>
                        <div class="text-muted">Handle: ${student.accountHandle || '-'}</div>
                        <div class="text-muted">Default password: ${student.accountPassword || 'N/A'}</div>
                    </div>

                    <div>
                        <strong>School Information</strong>
                        <div class="text-muted">School: ${student.school}</div>
                        <div class="text-muted">Province: ${student.province}</div>
                        <div class="text-muted">Classes: ${classesDisplay}</div>
                    </div>

                    <div>
                        <strong>Parent Information</strong>
                        <div class="text-muted">Name: ${student.parentName}</div>
                        <div class="text-muted">Phone: ${student.parentPhone}</div>
                    </div>
                </div>

                <div class="mt-4">
                    <strong>Goal</strong>
                    <p class="text-muted">${student.goal || 'No goal specified'}</p>
                </div>

                <div class="flex gap-2 mt-4">
                    <button onclick="openStudentModal('${student.id}', true)" class="btn">
                        Edit
                    </button>
                    <button onclick="deleteStudent('${student.id}')" class="btn btn-danger">
                        Delete
                    </button>
                </div>
            </div>
        `;

        window.UniUI.openModal('Student Details', content);
        return;
    }

    // Create/Edit mode
    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    const form = document.createElement('form');
    form.className = 'staff-form-enhanced';
    form.innerHTML = `
        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <h3>Thông tin cá nhân</h3>
            </div>
            <div class="form-section-content">
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="studentName" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Họ và tên*
                        </label>
                <input 
                    type="text" 
                    id="studentName" 
                    name="fullName" 
                            class="form-control-enhanced"
                    value="${student?.fullName || ''}" 
                    required
                            placeholder="Nhập họ và tên đầy đủ"
                >
            </div>
            
                    <div class="form-group-enhanced">
                        <label for="studentBirthYear" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Năm sinh*
                        </label>
                <input 
                    type="number" 
                    id="studentBirthYear" 
                    name="birthYear" 
                            class="form-control-enhanced"
                    value="${student?.birthYear || new Date().getFullYear() - 15}" 
                    min="1990" 
                    max="${new Date().getFullYear() - 5}"
                    required
                            placeholder="Năm sinh"
                >
            </div>
        </div>

                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="studentSchool" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            Trường học*
                        </label>
                <input 
                    type="text" 
                    id="studentSchool" 
                    name="school" 
                            class="form-control-enhanced"
                    value="${student?.school || ''}" 
                    required
                            placeholder="Tên trường học"
                >
            </div>
            
                    <div class="form-group-enhanced">
                        <label for="studentProvince" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            Tỉnh thành*
                        </label>
                <input 
                    type="text" 
                    id="studentProvince" 
                    name="province" 
                            class="form-control-enhanced"
                    value="${student?.province || ''}" 
                    required
                            placeholder="Tỉnh/Thành phố"
                >
            </div>
        </div>

                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="studentEmail" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            Email liên hệ
                        </label>
                        <input 
                            type="email" 
                            id="studentEmail" 
                            name="email" 
                            class="form-control-enhanced"
                            value="${student?.email || ''}"
                            placeholder="Email dùng để liên lạc"
                        >
                    </div>
                    
                    <div class="form-group-enhanced">
                        <label for="studentGender" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="8" r="7"></circle>
                                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                            </svg>
                            Giới tính
                        </label>
                        <select id="studentGender" name="gender" class="form-control-enhanced">
                            <option value="male" ${student?.gender === 'male' ? 'selected' : ''}>Nam</option>
                            <option value="female" ${student?.gender === 'female' ? 'selected' : ''}>Nữ</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <h3>Thông tin phụ huynh</h3>
            </div>
            <div class="form-section-content">
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="studentParentName" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Tên phụ huynh*
                        </label>
                <input 
                    type="text" 
                    id="studentParentName" 
                    name="parentName" 
                            class="form-control-enhanced"
                    value="${student?.parentName || ''}" 
                    required
                            placeholder="Họ và tên phụ huynh"
                >
            </div>
            
                    <div class="form-group-enhanced">
                        <label for="studentParentPhone" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            Số điện thoại phụ huynh*
                        </label>
                <input 
                    type="tel" 
                    id="studentParentPhone" 
                    name="parentPhone" 
                            class="form-control-enhanced"
                    value="${student?.parentPhone || ''}" 
                    required
                            placeholder="0912345678"
                >
                    </div>
                </div>
            </div>
        </div>

        ${isAdmin ? `
        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <h3>Thông tin đăng nhập (Chỉ quản trị)</h3>
            </div>
            <div class="form-section-content">
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="studentHandle" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Handle / Username*
                        </label>
                        <input 
                            type="text" 
                            id="studentHandle" 
                            name="accountHandle" 
                            class="form-control-enhanced"
                            value="${student?.accountHandle || ''}" 
                            placeholder="vd: hocsinh1"
                            required
                        >
                        <small class="form-hint">Sử dụng cho đăng nhập nội bộ</small>
                    </div>
                    
                    <div class="form-group-enhanced">
                        <label for="studentAccountPassword" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Mật khẩu mặc định*
                        </label>
                        <div class="password-input-wrapper">
                            <input 
                                type="password" 
                                id="studentAccountPassword" 
                                name="accountPassword" 
                                class="form-control-enhanced"
                                value="${student?.accountPassword || ''}" 
                                placeholder="${studentId ? 'Nhập mật khẩu mới (nếu muốn đổi)' : 'vd: 123456'}"
                                ${studentId ? '' : 'required'}
                            >
                            <button type="button" class="password-toggle-btn-enhanced" onclick="togglePasswordVisibility('studentAccountPassword', this)" aria-label="Hiện/ẩn mật khẩu">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="password-eye-icon">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="password-eye-off-icon" style="display: none;">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                </svg>
                            </button>
                        </div>
                        <small class="form-hint">${studentId ? 'Chỉ nhập nếu muốn thay đổi mật khẩu' : 'Dùng khi cấp lại tài khoản'}</small>
                    </div>
                </div>
                <div class="form-group-enhanced">
                    <label for="studentLoginEmail" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                            <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        Email đăng nhập
                    </label>
                <input 
                    type="email" 
                        id="studentLoginEmail" 
                        name="loginEmail" 
                        class="form-control-enhanced"
                    value="${student?.email || ''}"
                        placeholder="Email dùng để đăng nhập (nếu để trống sẽ dùng email liên hệ)"
                >
                    <small class="form-hint">Email đăng nhập có thể khác với email liên hệ. Nếu để trống sẽ dùng email liên hệ làm email đăng nhập.</small>
            </div>
            </div>
        </div>
        ` : ''}

        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <h3>Lớp học và trạng thái</h3>
            </div>
            <div class="form-section-content">
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced" style="grid-column: 1 / -1;">
                        <label class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            Lớp học (có thể chọn nhiều)
                        </label>
                        <div class="class-checkbox-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color, #e0e0e0); border-radius: 4px; padding: 8px;">
                    ${window.demo.classes.length > 0 ? window.demo.classes.map(c => {
                        // classId can be array, string, or null - check if this class is in the array
                        const studentClassId = student?.classId;
                        const isChecked = Array.isArray(studentClassId) 
                            ? studentClassId.includes(c.id)
                            : (studentClassId === c.id);
                        
                        return `
                            <label style="display: flex; align-items: center; padding: 8px; cursor: pointer; border-radius: 4px; transition: background-color 0.2s;" 
                                   onmouseover="this.style.backgroundColor='var(--hover-bg, #f5f5f5)'" 
                                   onmouseout="this.style.backgroundColor='transparent'">
                                <input 
                                    type="checkbox" 
                                    name="classIds" 
                                    value="${c.id}"
                                    ${isChecked ? 'checked' : ''}
                                    style="margin-right: 8px; width: 18px; height: 18px; cursor: pointer;"
                                >
                                <span>${c.name}</span>
                            </label>
                        `;
                    }).join('') : '<div style="padding: 8px; color: var(--text-muted, #999);">Chưa có lớp nào</div>'}
                        </div>
                        <small class="form-hint">Chọn tất cả các lớp mà học sinh đang học. Có thể bỏ chọn để xóa học sinh khỏi lớp.</small>
                    </div>
            
                    <div class="form-group-enhanced">
                        <label for="studentStatus" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            Trạng thái
                        </label>
                        <select id="studentStatus" name="status" class="form-control-enhanced">
                            <option value="active" ${student?.status === 'active' ? 'selected' : ''}>Đang học</option>
                            <option value="inactive" ${student?.status === 'inactive' ? 'selected' : ''}>Ngừng học</option>
                </select>
            </div>
        </div>

                ${isAdmin ? `
                <div class="form-group-enhanced">
                    <label for="studentCskhStaff" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Người phụ trách CSKH
                    </label>
                    <select id="studentCskhStaff" name="cskhStaffId" class="form-control-enhanced">
                        <option value="">Chưa phân công</option>
                        ${(() => {
                            // Get all staff with CSKH_SALE role
                            const cskhStaff = (window.demo.teachers || []).filter(t => {
                                const roles = t.roles || [];
                                return roles.includes('cskh_sale');
                            });
                            return cskhStaff.map(s => `
                                <option 
                                    value="${s.id}" 
                                    ${s.id === student?.cskhStaffId ? 'selected' : ''}
                                >
                                    ${s.fullName}${s.gmail ? ` (${s.gmail})` : ''}
                                </option>
                            `).join('');
                        })()}
                    </select>
                    <small class="form-hint">Chọn nhân sự có role SALE&CSKH để phụ trách học sinh này</small>
                </div>
                ` : ''}
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <h3>Mục tiêu học tập</h3>
            </div>
            <div class="form-section-content">
                <div class="form-group-enhanced">
                    <label for="studentGoal" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Mục tiêu học tập
                    </label>
            <textarea 
                id="studentGoal" 
                name="goal" 
                        class="form-control-enhanced"
                        rows="4"
                        placeholder="Nhập mục tiêu học tập của học sinh..."
            >${student?.goal || ''}</textarea>
                </div>
            </div>
        </div>

        <div class="form-actions-enhanced">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Hủy
            </button>
            ${studentId && window.UniUI?.hasRole && window.UniUI.hasRole('admin') ? `
                <button type="button" class="btn btn-danger" onclick="if(confirm('Bạn có chắc chắn muốn xóa học sinh này?')) { window.StudentPage.delete('${studentId}'); window.UniUI.closeModal(); }">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Xóa học sinh
                </button>
            ` : ''}
            <button type="submit" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                ${studentId ? 'Cập nhật' : 'Tạo mới'}
            </button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const contactEmail = formData.get('email')?.trim() || '';
        const loginEmail = isAdmin ? (formData.get('loginEmail')?.trim() || '') : '';
        
        // Get multiple class IDs from checkboxes
        const classIds = formData.getAll('classIds').filter(Boolean);
        
        const data = {
            fullName: formData.get('fullName'),
            birthYear: Number(formData.get('birthYear')),
            school: formData.get('school'),
            province: formData.get('province'),
            parentName: formData.get('parentName'),
            parentPhone: formData.get('parentPhone'),
            email: loginEmail || contactEmail, // Email đăng nhập: ưu tiên loginEmail, nếu không có thì dùng email liên hệ
            gender: formData.get('gender'),
            classId: classIds.length > 0 ? classIds : null, // Array of class IDs or null
            status: formData.get('status'),
            goal: formData.get('goal')
        };

        // Add CSKH staff ID if admin and provided
        if (isAdmin) {
            const cskhStaffId = formData.get('cskhStaffId')?.trim() || null;
            if (cskhStaffId) {
                data.cskhStaffId = cskhStaffId;
            } else {
                data.cskhStaffId = null;
            }
        } else {
            // Keep existing value if not admin
            if (studentId && student) {
                data.cskhStaffId = student.cskhStaffId || null;
            }
        }
        
        // Chỉ admin mới có thể chỉnh sửa thông tin đăng nhập
        if (isAdmin) {
            const accountHandle = String(formData.get('accountHandle') || '').trim();
            const accountPassword = String(formData.get('accountPassword') || '').trim();
            
            // Chỉ cập nhật nếu có giá trị
            if (accountHandle) {
                data.accountHandle = accountHandle;
            }
            if (accountPassword) {
                data.accountPassword = accountPassword;
            }
        } else {
            // Nếu không phải admin, giữ nguyên giá trị cũ của thông tin đăng nhập
            if (studentId && student) {
                // Khi edit: giữ nguyên giá trị cũ
                data.accountHandle = student.accountHandle || '';
                data.accountPassword = student.accountPassword || '';
            } else {
                // Khi tạo mới: để trống (sẽ được tạo sau bởi admin hoặc hệ thống)
                data.accountHandle = '';
                data.accountPassword = '';
            }
        }

        // Validation: chỉ validate thông tin đăng nhập nếu là admin
        const validationData = { ...data };
        if (!isAdmin) {
            // Nếu không phải admin, bỏ qua validation cho accountHandle và accountPassword
            delete validationData.accountHandle;
            delete validationData.accountPassword;
        }
        
        const validation = window.UniLogic.validateForm(validationData, studentValidation);
        if (!validation.isValid) {
            // Show inline errors
            Object.keys(validation.errors).forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                if (input) {
                    input.classList.add('error');
                    let errorDiv = form.querySelector(`#${field}-error`);
                    if (!errorDiv) {
                        errorDiv = document.createElement('div');
                        errorDiv.id = `${field}-error`;
                        errorDiv.className = 'form-error';
                        input.parentNode.appendChild(errorDiv);
                    }
                    errorDiv.textContent = validation.errors[field];
                }
            });
            // Also show toast
            window.UniUI.toast('Vui lòng kiểm tra lại các trường đã nhập', 'error');
            return;
        }

        // Clear errors
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach(el => el.remove());

        // Use optimistic update pattern for create/update
        await window.UniData.withOptimisticUpdate(
            () => {
                let supabaseEntities = {};
                let supabaseDeletes = null;
                
            if (studentId) {
                    // Update existing student
                    const studentIndex = window.demo.students.findIndex(s => s.id === studentId);
                    if (studentIndex === -1) {
                        throw new Error('Student not found');
                    }
                    
                    const oldStudent = { ...window.demo.students[studentIndex] };
                    const newStudent = { ...window.demo.students[studentIndex], ...data };
                    
                    // Ghi lại hành động chỉnh sửa
                    if (window.ActionHistoryService) {
                        const changedFields = window.ActionHistoryService.getChangedFields(oldStudent, newStudent);
                        window.ActionHistoryService.recordAction({
                            entityType: 'student',
                            entityId: studentId,
                            actionType: 'update',
                            beforeValue: oldStudent,
                            afterValue: newStudent,
                            changedFields: changedFields,
                            description: `Cập nhật học sinh: ${newStudent.fullName || studentId}`
                        });
                    }
                    
                    Object.assign(window.demo.students[studentIndex], data);
                    
                    // Handle studentClass entries if classId changed
                    // classId can be: array (multiple classes), string (single class), or null
                    let studentClassEntry = null;
                    const studentClassRemovedIds = [];
                    if ('classId' in data) {
                        window.demo.studentClasses = window.demo.studentClasses || [];
                        
                        // Normalize classId to array
                        const newClassIds = Array.isArray(data.classId) 
                            ? data.classId.filter(Boolean)
                            : (data.classId ? [data.classId] : []);
                        
                        // Get old classIds (normalize to array)
                        const oldClassIds = Array.isArray(oldStudent.classId)
                            ? oldStudent.classId.filter(Boolean)
                            : (oldStudent.classId ? [oldStudent.classId] : []);
                        
                        // Compare to see what changed
                        const oldSet = new Set(oldClassIds);
                        const newSet = new Set(newClassIds);
                        
                        // Add new classes
                        newClassIds.forEach(classId => {
                            if (!oldSet.has(classId)) {
                            if (window.UniData && window.UniData.ensureStudentClassRecord) {
                                    window.UniData.ensureStudentClassRecord(studentId, classId, { status: 'active' });
            } else {
                                const scId = window.UniData.generateId ? window.UniData.generateId('studentClass') : ('SC' + Math.random().toString(36).slice(2, 7).toUpperCase());
                                const newRecord = {
                                    id: scId,
                                    studentId: studentId,
                                        classId: classId,
                                    startDate: new Date().toISOString().slice(0, 10),
                                    status: 'active',
                                    totalPurchasedSessions: 0,
                                    remainingSessions: 0,
                                    totalAttendedSessions: 0,
                                    unpaidSessions: 0,
                                    totalPaidAmount: 0
                                };
                                window.demo.studentClasses.push(newRecord);
                                }
                            }
                        });
                        
                        // Remove classes that are no longer in classId
                        oldClassIds.forEach(classId => {
                            if (!newSet.has(classId)) {
                                const record = window.demo.studentClasses.find(sc => sc.studentId === studentId && sc.classId === classId);
                                if (record) {
                                    studentClassRemovedIds.push(record.id);
                                    const index = window.demo.studentClasses.findIndex(sc => sc.id === record.id);
                                    if (index !== -1) {
                                        window.demo.studentClasses.splice(index, 1);
                                    }
                                }
                            }
                        });
                        
                        // Update student.classId to be array (or null if empty)
                        window.demo.students[studentIndex].classId = newClassIds.length > 0 ? newClassIds : null;
                        
                        // Sync classId with all active classes from studentClasses (to ensure consistency)
                        if (window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
                            window.UniData.syncStudentClassId(studentId);
                        }
                    }
                    
                    supabaseEntities.students = [window.demo.students[studentIndex]];
                    if (studentClassEntry) {
                        supabaseEntities.studentClasses = [studentClassEntry];
                    }
                    if (studentClassRemovedIds.length > 0) {
                        supabaseDeletes = { studentClasses: studentClassRemovedIds };
                    }
                } else {
                    // Create new student
                    const newId = window.UniData.generateId ? window.UniData.generateId('student') : ('S' + Math.random().toString(36).slice(2, 8).toUpperCase());
                    const newStudent = {
                        id: newId,
                        status: 'active',
                        email: '',
                        gender: 'male',
                        lastAttendance: null,
                        walletBalance: 0,
                        accountHandle: '',
                        accountPassword: '',
                        loanBalance: 0,
                        ...data
                    };
                    window.demo.students.push(newStudent);
                    
                    // Ghi lại hành động tạo mới
                    if (window.ActionHistoryService) {
                        window.ActionHistoryService.recordAction({
                            entityType: 'student',
                            entityId: newId,
                            actionType: 'create',
                            beforeValue: null,
                            afterValue: newStudent,
                            changedFields: null,
                            description: `Tạo học sinh mới: ${newStudent.fullName || newId}`
                        });
                    }
                    
                    // Auto-create studentClass entry if classId is provided
                    let studentClassEntry = null;
                    if (newStudent.classId) {
                        const scId = window.UniData.generateId ? window.UniData.generateId('studentClass') : ('SC' + Math.random().toString(36).slice(2, 7).toUpperCase());
                        studentClassEntry = {
                            id: scId,
                            studentId: newStudent.id,
                            classId: newStudent.classId,
                            startDate: new Date().toISOString().slice(0, 10),
                            status: 'active',
                            totalPurchasedSessions: 0,
                            remainingSessions: 0,
                            totalAttendedSessions: 0,
                            unpaidSessions: 0,
                            totalPaidAmount: 0
                        };
                        window.demo.studentClasses = window.demo.studentClasses || [];
                        window.demo.studentClasses.push(studentClassEntry);
                    }
                    
                    supabaseEntities.students = [newStudent];
                    if (studentClassEntry) {
                        supabaseEntities.studentClasses = [studentClassEntry];
                    }
                }
                
                return {
                    supabaseEntities,
                    supabaseDeletes
                };
            },
            {
                onSuccess: () => {
            window.UniUI.closeModal();
                    window.UniUI.toast(
                        studentId ? 'Đã cập nhật thông tin học sinh' : 'Đã tạo học sinh mới',
                        'success'
                    );
                    if (typeof onSaved === 'function') {
                        try { onSaved(); } catch(e) {}
                    } else {
            renderStudents();
                    }
                },
                onError: (error) => {
                    console.error('Failed to save student:', error);
                    window.UniUI.toast(
                        studentId ? 'Không thể cập nhật học sinh: ' + (error.message || 'Lỗi không xác định') : 'Không thể tạo học sinh: ' + (error.message || 'Lỗi không xác định'),
                        'error'
                    );
                    // Keep modal open on error so user can fix and retry
                    renderStudents(); // Re-render to show original state
                },
                onRollback: () => {
                    window.UniUI.closeModal();
                    renderStudents(); // Re-render to show original state
                }
            }
        );
    });

    // Wrap form với tabs nếu đang edit và có EntityHistoryPanel
    let modalContent = form;
    if (studentId && window.EntityHistoryPanel && window.EntityHistoryPanel.createTabsForEditModal) {
        // Lấy innerHTML của form để wrap với tabs
        const formHTML = form.innerHTML;
        const tabsContainer = window.EntityHistoryPanel.createTabsForEditModal('student', studentId, formHTML);
        // Replace form content với tabs container
        form.innerHTML = '';
        form.appendChild(tabsContainer);
        modalContent = form;
    }

    window.UniUI.openModal(
        studentId ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới',
        modalContent
    );
}

/**
 * Delete student after confirmation
 * @param {string} studentId - Student ID to delete
 */
async function deleteStudent(studentId) {
    const student = window.demo.students.find(s => s.id === studentId);
    if (!student) {
        window.UniUI.toast('Học sinh không tồn tại', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete student "${student.fullName}"?`)) {
        return;
    }

    // Get related data to delete BEFORE deletion
    const studentClasses = (window.demo.studentClasses || []).filter(sc => sc.studentId === studentId);
    const studentClassIds = studentClasses.map(sc => sc.id);
    const attendanceRecords = (window.demo.attendance || []).filter(a => a.studentId === studentId);
    const attendanceIds = attendanceRecords.map(a => a.id);
    const walletTransactions = (window.demo.walletTransactions || []).filter(wt => wt.studentId === studentId);
    const walletTransactionIds = walletTransactions.map(wt => wt.id);
    const payments = (window.demo.payments || []).filter(p => p.studentId === studentId);
    const paymentIds = payments.map(p => p.id);

    const beforeSnapshot = {
        ...student,
        __related: {
            studentClasses: studentClasses.map(sc => ({ ...sc })),
            attendance: attendanceRecords.map(a => ({ ...a })),
            walletTransactions: walletTransactions.map(wt => ({ ...wt })),
            payments: payments.map(p => ({ ...p }))
        }
    };

    // Store original state for rollback
    const originalStudents = [...window.demo.students];
    const originalStudentClasses = [...(window.demo.studentClasses || [])];
    const originalAttendance = [...(window.demo.attendance || [])];
    const originalWalletTransactions = [...(window.demo.walletTransactions || [])];
    const originalPayments = [...(window.demo.payments || [])];

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Delete student from local state - MUST be done first
            const studentIndex = window.demo.students.findIndex(s => s.id === studentId);
            if (studentIndex !== -1) {
                // Ghi lại hành động xóa trước khi xóa
                if (window.ActionHistoryService) {
                    window.ActionHistoryService.recordAction({
                        entityType: 'student',
                        entityId: studentId,
                        actionType: 'delete',
                        beforeValue: beforeSnapshot,
                        afterValue: null,
                        changedFields: null,
                        description: `Xóa học sinh: ${student.fullName || studentId}`
                    });
                }
                window.demo.students.splice(studentIndex, 1);
            }
            
            // Delete related studentClasses
            if (studentClassIds.length > 0) {
                window.demo.studentClasses = (window.demo.studentClasses || []).filter(
                    sc => !studentClassIds.includes(sc.id)
                );
            }
            
            // Delete related attendance
            if (attendanceIds.length > 0) {
                window.demo.attendance = (window.demo.attendance || []).filter(
                    a => !attendanceIds.includes(a.id)
                );
            }
            
            // Delete related walletTransactions
            if (walletTransactionIds.length > 0) {
                window.demo.walletTransactions = (window.demo.walletTransactions || []).filter(
                    wt => !walletTransactionIds.includes(wt.id)
                );
            }
            
            // Delete related payments
            if (paymentIds.length > 0) {
                window.demo.payments = (window.demo.payments || []).filter(
                    p => !paymentIds.includes(p.id)
                );
            }
            
            // Update localStorage immediately to reflect deletion
            try {
                localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
            } catch (e) {
                console.warn('Failed to update localStorage:', e);
            }
            
            return {
                supabaseDeletes: {
                    students: [studentId],
                    studentClasses: studentClassIds,
                    attendance: attendanceIds,
                    walletTransactions: walletTransactionIds,
                    payments: paymentIds
                }
            };
        },
        {
            onSuccess: async () => {
                // Refetch from Supabase to ensure complete sync
                try {
                    const freshData = await window.DatabaseAdapter.load({ preferLocal: false, skipLocal: false });
                    if (freshData && freshData.students) {
                        // Replace students array completely with fresh data
                        window.demo.students = Array.isArray(freshData.students) ? freshData.students : [];
                        // Update localStorage with fresh data
                        localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
                        console.log('✅ Refetched students after deletion:', window.demo.students.length);
                    }
                } catch (e) {
                    console.warn('Failed to refetch after deletion:', e);
                }
                
                window.UniUI.toast('Đã xóa học sinh', 'success');
        renderStudents();
            },
            onError: (error) => {
                console.error('Failed to delete student:', error);
                // Rollback local state
                window.demo.students = originalStudents;
                window.demo.studentClasses = originalStudentClasses;
                window.demo.attendance = originalAttendance;
                window.demo.walletTransactions = originalWalletTransactions;
                window.demo.payments = originalPayments;
                // Update localStorage with rolled back state
                try {
                    localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
                } catch (e) {
                    console.warn('Failed to rollback localStorage:', e);
                }
                window.UniUI.toast('Không thể xóa học sinh: ' + (error.message || 'Lỗi không xác định'), 'error');
                renderStudents();
            },
            onRollback: () => {
                // Rollback local state
                window.demo.students = originalStudents;
                window.demo.studentClasses = originalStudentClasses;
                window.demo.attendance = originalAttendance;
                window.demo.walletTransactions = originalWalletTransactions;
                window.demo.payments = originalPayments;
                // Update localStorage with rolled back state
                try {
                    localStorage.setItem('unicorns.data', JSON.stringify(window.demo));
                } catch (e) {
                    console.warn('Failed to rollback localStorage:', e);
                }
                renderStudents();
            }
        }
    );
}

// Export student page functions
window.StudentPage = {
    render: renderStudents,
    openModal: openStudentModal,
    delete: deleteStudent,
    detail: renderStudentDetail
};

// Expose functions globally for inline onclick handlers
window.openStudentModal = openStudentModal;
window.deleteStudent = deleteStudent;
window.renderStudents = renderStudents;
window.renderStudentDetail = renderStudentDetail;
window.openStudentTransferModal = openStudentTransferModal;
window.goToStudentDetail = function(studentId) {
    if (!studentId) return;
    window.UniUI.loadPage(`student-detail:${studentId}`);
};

function attachStudentClassRowEvents(studentId) {
    const container = document.getElementById('studentClassesTable');
    if (!container) return;
    if (container.dataset.enhanced === 'true') return;
    container.dataset.enhanced = 'true';

    container.querySelectorAll('[data-action="open-class-actions"]').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const classId = btn.dataset.classId;
            if (classId) {
                openStudentClassActionsModal(studentId, classId);
            }
        });
    });

    container.querySelectorAll('[data-action="edit-fee"]').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const classId = btn.dataset.classId;
            if (classId) openStudentClassFeeModal(studentId, classId);
        });
    });

    container.querySelectorAll('[data-action="extend-class"]').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const classId = btn.dataset.classId;
            if (classId) openStudentExtendSessionsModal(studentId, classId);
        });
    });

    container.querySelectorAll('[data-action="refund-class"]').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const classId = btn.dataset.classId;
            if (classId) openStudentRefundSessionsModal(studentId, classId);
        });
    });

    container.querySelectorAll('[data-action="remove-class"]').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const classId = btn.dataset.classId || '';
            const recordId = btn.dataset.recordId;
            handleRemoveStudentFromClass(studentId, classId, recordId);
        });
    });

    container.querySelectorAll('.student-class-row').forEach(row => {
        const classId = row.dataset.classId || '';
        row.addEventListener('mouseenter', () => row.classList.add('student-class-row-hover'));
        row.addEventListener('mouseleave', () => row.classList.remove('student-class-row-hover'));
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            if (classId) {
                window.UniUI.loadPage(`class-detail:${classId}`);
            }
        });
    });
}