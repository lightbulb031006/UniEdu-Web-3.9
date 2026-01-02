/**
 * teachers.js / staff.js - Nhân sự page with tabs: Gia sư, Giáo án, Kế toán, CSKH&SALE, Truyền thông
 */

function formatMonthLabel(month) {
    if (!month || typeof month !== 'string') return '';
    const [year, monthPart] = month.split('-');
    if (!year || !monthPart) return month;
    return `${monthPart.padStart(2, '0')}/${year}`;
}

async function renderTeachers() {
    // Initialize listeners and try optimistic loading
    if (!window.__teachersListenersInitialized) {
        window.UniData?.initPageListeners?.('teachers', renderTeachers, ['teachers', 'classes', 'sessions']);
        window.__teachersListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderTeachers(), 10);
            return;
        } else {
            const main = document.querySelector('#main-content');
            if (main) {
                main.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderTeachers(), 120);
            return;
        }
    }
    
    const main = document.querySelector('#main-content');
    if (!main) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    if (currentUser?.role === 'teacher') {
        const teachers = window.demo?.teachers || [];
        const teacherRecord = teachers.find(t => {
            if (t.userId && currentUser.id) {
                return t.userId === currentUser.id;
            }
            if (currentUser.linkId) {
                return t.id === currentUser.linkId;
            }
            return false;
        });
        if (teacherRecord) {
            if (typeof renderStaffDetail === 'function') {
                renderStaffDetail(teacherRecord.id);
            } else {
                window.UniUI.loadPage(`staff-detail:${teacherRecord.id}`);
            }
            return;
        }
        // Fallback: show access error if no linked teacher profile
        main.innerHTML = `
            <div class="card">
                <h3>Không tìm thấy hồ sơ giáo viên</h3>
                <p class="text-muted">Tài khoản giáo viên này chưa được liên kết với hồ sơ trong hệ thống. Vui lòng liên hệ quản trị viên.</p>
            </div>
        `;
        return;
    }

    const canCreate = window.UniUI.hasRole('admin');
    const canManage = window.UniUI.hasRole('admin');

    // Calculate total received for each teacher
    const teachersWithStats = window.demo.teachers.map(teacher => {
        const classes = window.UniData.getTeacherClasses ? window.UniData.getTeacherClasses(teacher.id) : [];
        const sessions = (window.demo.sessions || []).filter(s => s.teacherId === teacher.id);
        
        let totalReceived = 0;
        sessions.forEach(session => {
            const cls = window.demo.classes.find(c => c.id === session.classId);
            if (cls) {
                const allowances = cls.customTeacherAllowances || {};
                const baseAllowance = allowances[teacher.id] ?? (cls.tuitionPerSession || 0);
                const coefficient = session.coefficient != null ? Number(session.coefficient) : 1;
                // Nếu hệ số = 0 thì số tiền = 0 luôn
                if (coefficient === 0) {
                    totalReceived += 0;
                } else {
                    totalReceived += baseAllowance * coefficient;
                }
            }
        });

        // Extract birth year from birthDate
        const birthYear = teacher.birthDate ? new Date(teacher.birthDate).getFullYear() : null;

        return {
            ...teacher,
            totalReceived,
            birthYear,
            classCount: classes.length
        };
    });

    // Pagination
    const pager = window.AppStore?.store.getState().pager.teachers || { page: 1, pageSize: 10 };
    const start = (pager.page - 1) * pager.pageSize;
    const paginatedTeachers = teachersWithStats.slice(start, start + pager.pageSize);
    const total = teachersWithStats.length;
    const totalPages = Math.max(1, Math.ceil(total / pager.pageSize));

    main.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Gia sư</h2>
            ${canCreate ? `
                <button class="btn btn-primary btn-add-icon" id="newTeacherBtn" title="Thêm gia sư mới">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            ` : ''}
        </div>

        <div class="card">
            <div class="table-container">
                <table class="table-striped" id="teachersTable">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Tên</th>
                            <th>Năm sinh</th>
                            <th>Tỉnh</th>
                            <th>Tổng nhận</th>
                            ${canManage ? '<th style="width: 50px;"></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedTeachers.map(t => `
                            <tr data-id="${t.id}" class="teacher-row-clickable">
                                <td>
                                    ${t.photoUrl ? 
                                        `<img src="${t.photoUrl}" alt="" class="w-10 h-10 rounded-full object-cover" onerror="this.style.display='none'">` : 
                                        `<div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold" style="background: var(--bg); color: var(--muted);">${t.fullName.charAt(0).toUpperCase()}</div>`
                                    }
                                </td>
                                <td>
                                    <span class="font-medium">${t.fullName}</span>
                                    ${t.classCount > 0 ? `<div class="text-muted text-sm">${t.classCount} lớp</div>` : ''}
                                </td>
                                <td>${t.birthYear || '-'}</td>
                                <td>${t.province || '-'}</td>
                                <td class="font-medium">${window.UniData.formatCurrency(t.totalReceived)}</td>
                                ${canManage ? `
                                    <td>
                                        <div class="crud-actions">
                                            <button class="btn-edit-icon" onclick="event.stopPropagation(); openTeacherModal('${t.id}'); return false;" title="Sửa">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                            <button class="btn-delete-icon" onclick="event.stopPropagation(); if(confirm('Bạn có chắc muốn xóa gia sư này?')) { window.TeacherPage.delete('${t.id}'); } return false;" title="Xóa">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                ` : ''}
                            </tr>
                        `).join('')}
                        <tr>
                            <td colspan="${canManage ? 6 : 5}">
                                <div class="pagination-container">
                                    <button 
                                        class="pagination-btn pagination-btn-prev" 
                                        ${pager.page<=1?'disabled':''} 
                                        onclick="(function(){ window.AppStore.store.dispatch({type: window.AppStore.actions.SET_PAGE, payload:{key:'teachers', page: Math.max(1, ${pager.page}-1)}}); renderTeachers(); })()"
                                        title="Trang trước"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="15 18 9 12 15 6"></polyline>
                                        </svg>
                                    </button>
                                    <span class="pagination-page-number">${pager.page}</span>
                                    <button 
                                        class="pagination-btn pagination-btn-next" 
                                        ${pager.page>=totalPages?'disabled':''} 
                                        onclick="(function(){ window.AppStore.store.dispatch({type: window.AppStore.actions.SET_PAGE, payload:{key:'teachers', page: Math.min(${totalPages}, ${pager.page}+1)}}); renderTeachers(); })()"
                                        title="Trang sau"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('newTeacherBtn')?.addEventListener('click', () => openTeacherModal());

    // Handle row click - navigate to teacher detail
    document.querySelectorAll('.teacher-row-clickable').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't navigate if clicking on CRUD action buttons
            if (e.target.closest('.crud-actions') || e.target.closest('.btn-edit-icon') || e.target.closest('.btn-delete-icon')) {
                return;
            }

            // Get teacher ID from row
            const teacherId = row.getAttribute('data-id') || row.dataset.id;
            if (teacherId) {
        e.preventDefault();
                e.stopPropagation();
                window.UniUI.loadPage(`staff-detail:${teacherId}`);
            }
        });
    });
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('teachers', ['teachers', 'classes', 'sessions']);
}

// DEPRECATED: This function is replaced by renderStaffDetail in staff.js
// Keeping for backward compatibility - redirects to staff-detail
function renderTeacherDetail(teacherId, selectedMonth = null) {
    // Redirect to unified staff detail page
    if (typeof renderStaffDetail === 'function') {
        renderStaffDetail(teacherId, selectedMonth);
    } else {
        window.UniUI.loadPage(`staff-detail:${teacherId}`);
    }
    return;
    
    /* OLD IMPLEMENTATION - COMMENTED OUT
    const main = document.querySelector('#main-content');
    const main = document.querySelector('#main-content');
    if (!main) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    if (!currentUser) {
        main.innerHTML = `
            <div class="card">
                <h3>Yêu cầu đăng nhập</h3>
                <p class="text-muted">Vui lòng đăng nhập để xem thông tin giáo viên.</p>
                <button class="btn btn-primary mt-2" onclick="window.UniUI.loadPage('home')">Đến trang đăng nhập</button>
            </div>
        `;
        return;
    }

    const allTeachers = window.demo?.teachers || [];
    const linkedTeacher = allTeachers.find(t => t.id === teacherId);
    const ownTeacherRecord = currentUser.role === 'teacher'
        ? allTeachers.find(t => {
            if (t.userId && currentUser.id) {
                return t.userId === currentUser.id;
            }
            if (currentUser.linkId) {
                return t.id === currentUser.linkId;
            }
            return false;
        })
        : null;

    if (currentUser.role === 'teacher') {
        if (!ownTeacherRecord) {
            main.innerHTML = `
                <div class="card">
                    <h3>Không tìm thấy hồ sơ giáo viên</h3>
                    <p class="text-muted">Tài khoản giáo viên này chưa được liên kết với hồ sơ trong hệ thống. Vui lòng liên hệ quản trị viên.</p>
                </div>
            `;
            return;
        }
        if (!linkedTeacher || linkedTeacher.id !== ownTeacherRecord.id) {
            teacherId = ownTeacherRecord.id;
        }
    }

    const teacher = allTeachers.find(t => t.id === teacherId);
    if (!teacher) {
        if (currentUser.role === 'teacher') {
            main.innerHTML = `
                <div class="card">
                    <h3>Không tìm thấy hồ sơ giáo viên</h3>
                    <p class="text-muted">Tài khoản giáo viên chưa được liên kết với hồ sơ trong hệ thống. Vui lòng liên hệ quản trị viên.</p>
                </div>
            `;
        } else {
            main.innerHTML = '<div class="card"><p>Giáo viên không tồn tại.</p><button class="btn mt-2" onclick="window.UniUI.loadPage(\'teachers\')">← Quay lại danh sách</button></div>';
        }
        return;
    }

    if (currentUser.role === 'student') {
        main.innerHTML = `
            <div class="card">
                <h3>Không có quyền truy cập</h3>
                <p class="text-muted">Học sinh không thể xem thông tin chi tiết của giáo viên.</p>
            </div>
        `;
        return;
    }

    const isTeacherSelf = currentUser.role === 'teacher';
    const isAdmin = window.UniUI.hasRole('admin');
    const showNavigation = !isTeacherSelf;

    // Get all classes teacher is currently teaching (from teacherIds)
    const activeClasses = window.UniData.getTeacherClasses ? window.UniData.getTeacherClasses(teacherId) : [];
    
    // Get all classes teacher has ever taught (has sessions)
    const sessions = (window.demo.sessions || []).filter(s => s.teacherId === teacherId);
    const allClassIdsFromSessions = new Set(sessions.map(s => s.classId).filter(Boolean));
    
    // Combine: classes from teacherIds + classes from sessions
    const allClassIds = new Set([
        ...activeClasses.map(c => c.id),
        ...Array.from(allClassIdsFromSessions)
    ]);
    
    const allClasses = (window.demo.classes || []).filter(c => allClassIds.has(c.id));
    
    // Mark status for each class
    const classesWithStatus = allClasses.map(cls => {
        const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
        const isActive = teacherIds.includes(teacherId);
        return {
            ...cls,
            isActive
        };
    });
    
    // Sort: active classes first, then inactive
    const classes = classesWithStatus.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthSet = new Set(sessions.map(s => (s.date || '').slice(0, 7)).filter(Boolean));
    monthSet.add(currentMonth);
    const monthOptions = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    const month = (selectedMonth && monthOptions.includes(selectedMonth)) ? selectedMonth : (monthOptions[0] || currentMonth);

    const payrollEntries = (window.demo.payroll || []).filter(p => p.teacherId === teacherId);
    const paidThisMonth = payrollEntries
        .filter(p => p.month === month)
        .reduce((sum, p) => sum + (p.totalPay || 0), 0);

    const formatAllowanceValue = (amount) => window.UniData.formatCurrency ? window.UniData.formatCurrency(amount || 0) : `${Number(amount || 0).toLocaleString('vi-VN')} đ`;

    const classStats = classes.map(cls => {
        const allowances = cls.customTeacherAllowances || {};
        const baseAllowance = allowances[teacherId] ?? (cls.tuitionPerSession || 0);
        const studentUnit = (() => {
            if (cls.studentTuitionPerSession) return Number(cls.studentTuitionPerSession);
            if (cls.tuitionPackageTotal && cls.tuitionPackageSessions) {
                return Number(cls.tuitionPackageTotal) / Number(cls.tuitionPackageSessions || 1);
            }
            return 0;
        })();
        const packageLabel = (cls.tuitionPackageTotal && cls.tuitionPackageSessions)
            ? `${window.UniData.formatCurrency(cls.tuitionPackageTotal)} / ${cls.tuitionPackageSessions} buổi`
            : '';
        const classSessions = sessions.filter(s => s.classId === cls.id);

        const monthSessions = classSessions.filter(session => (session.date || '').slice(0, 7) === month);
        const totalMonth = monthSessions.reduce((sum, session) => {
            const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
            return sum + allowanceAmount;
        }, 0);

        // Đã nhận: Tổng số tiền của các buổi lịch sử dạy mà giáo viên đó phụ trách đã ở trạng thái "Thanh toán" trong tháng
        const totalPaid = monthSessions
            .filter(s => (s.paymentStatus || 'unpaid') === 'paid')
            .reduce((sum, session) => {
                const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                return sum + allowanceAmount;
            }, 0);

        // Chưa Nhận: Tổng số tiền của các buổi lịch sử dạy mà giáo viên đó phụ trách đã ở trạng thái "Chưa Thanh toán" trong tất cả các tháng
        const totalUnpaid = classSessions
            .filter(s => (s.paymentStatus || 'unpaid') === 'unpaid')
            .reduce((sum, session) => {
                const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                return sum + allowanceAmount;
            }, 0);

        const totalDeposit = monthSessions
            .filter(s => (s.paymentStatus || 'unpaid') === 'deposit')
            .reduce((sum, session) => {
                const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                return sum + allowanceAmount;
            }, 0);

        return {
            class: cls,
            baseAllowance,
            studentUnit,
            packageLabel,
            totalMonth,
            totalPaid,
            totalUnpaid,
            totalDeposit,
            monthSessionsCount: monthSessions.length,
            isActive: cls.isActive
        };
    });

    const totalMonthAllClasses = classStats.reduce((sum, stat) => sum + stat.totalMonth, 0);
    const normalizedPaid = Math.min(paidThisMonth, totalMonthAllClasses);

    let allocatedPaid = 0;
    classStats.forEach((stat, index) => {
        let paid = 0;
        if (totalMonthAllClasses > 0 && stat.totalMonth > 0) {
            if (index === classStats.length - 1) {
                paid = Math.min(stat.totalMonth, normalizedPaid - allocatedPaid);
            } else {
                paid = Math.min(stat.totalMonth, normalizedPaid * (stat.totalMonth / totalMonthAllClasses));
                allocatedPaid += paid;
            }
        }
        stat.paidInMonth = paid || 0;
        stat.unpaidInMonth = Math.max(0, stat.totalMonth - stat.paidInMonth);
    });

    // Calculate totals by payment status across all classes
    // totalPaid: Tổng số tiền đã nhận trong tháng (paymentStatus = 'paid' trong tháng)
    const totalPaidByStatus = classStats.reduce((sum, stat) => sum + stat.totalPaid, 0);
    // totalUnpaid: Tổng số tiền chưa nhận trong tất cả các tháng (paymentStatus = 'unpaid' trong tất cả các tháng)
    const totalUnpaidByStatus = classStats.reduce((sum, stat) => sum + stat.totalUnpaid, 0);
    const totalDepositByStatus = classStats.reduce((sum, stat) => sum + stat.totalDeposit, 0);
    
    // Tổng nhận (từ trước): Tổng số tiền đã nhận trong tất cả các tháng (paymentStatus = 'paid' trong tất cả các tháng)
    const totalPaidAllTime = sessions
        .filter(s => (s.paymentStatus || 'unpaid') === 'paid')
        .reduce((sum, session) => {
            const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
            return sum + allowanceAmount;
        }, 0);
    
    // Keep old calculation for backward compatibility
    const totalPaidInMonth = classStats.reduce((sum, stat) => sum + stat.paidInMonth, 0);
    const totalUnpaidInMonth = classStats.reduce((sum, stat) => sum + stat.unpaidInMonth, 0);

    const breadcrumb = showNavigation ? (window.UniComponents?.breadcrumb([
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Gia sư', page: 'teachers' },
        { label: teacher.fullName, page: `staff-detail:${teacherId}` }
    ]) || '') : '';

    const monthOptionsHtml = monthOptions.length ? monthOptions.map(m => `
        <option value="${m}" ${m === month ? 'selected' : ''}>${formatMonthLabel(m)}</option>
    `).join('') : `<option value="${month}">${formatMonthLabel(month)}</option>`;

    main.innerHTML = `
        ${breadcrumb}
        <div class="flex justify-between items-start mb-4">
            <div>
                <div class="flex items-center gap-2 mb-2">
                    <button 
                        class="account-icon-btn account-icon-btn-left" 
                        id="teacherAccountBtn"
                        data-teacher-id="${teacherId}"
                        title="Xem thông tin cá nhân"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </button>
                    <h2>${teacher.fullName}</h2>
                </div>
                <div class="flex items-center gap-2 text-muted text-sm">
                    <div class="flex items-center gap-2">
                        <button 
                            class="qr-icon-btn qr-icon-btn-large ${teacher.bankQRLink ? 'qr-icon-btn-active' : 'qr-icon-btn-inactive'}" 
                            data-qr-link="${teacher.bankQRLink ? (teacher.bankQRLink || '').replace(/"/g, '&quot;') : ''}"
                            title="${teacher.bankQRLink ? 'Xem mã QR thanh toán' : 'Chưa có link QR'}"
                            ${!teacher.bankQRLink ? 'style="cursor: not-allowed; opacity: 0.5;"' : ''}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="5" height="5"></rect>
                                <rect x="16" y="3" width="5" height="5"></rect>
                                <rect x="3" y="16" width="5" height="5"></rect>
                                <rect x="16" y="16" width="5" height="5"></rect>
                                <path d="M11 3h2v18h-2z"></path>
                                <path d="M3 11h18v2H3z"></path>
                            </svg>
                        </button>
                        <button 
                            class="qr-icon-btn qr-icon-btn-large qr-icon-btn-upload" 
                            data-teacher-id="${teacherId}"
                            title="Thêm/Cập nhật link QR ngân hàng"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="text-muted text-sm mt-1">Đang dạy ${classes.length} lớp • ${sessions.length} buổi</div>
            </div>
            ${showNavigation ? `<button class="btn" onclick="window.UniUI.loadPage('teachers')">← Quay lại</button>` : ''}
        </div>

        <div class="grid gap-4 mb-4" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
            <div class="card">
                <div class="flex justify-between items-center mb-3">
                    <h3>Thống kê thu nhập</h3>
                    <select id="teacherMonthSelect" class="form-control" style="max-width: 180px;">
                        ${monthOptionsHtml}
                    </select>
                </div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Tổng trợ cấp tháng</div>
                        <div class="stat-value">${window.UniData.formatCurrency(totalMonthAllClasses)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">
                            <span class="badge badge-success" style="margin-right: 8px;">✓</span>
                            Đã thanh toán
                        </div>
                        <div class="stat-value">${window.UniData.formatCurrency(totalPaidByStatus)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">
                            <span class="badge badge-danger" style="margin-right: 8px;">✗</span>
                            Chưa thanh toán
                        </div>
                        <div class="stat-value">${window.UniData.formatCurrency(totalUnpaidByStatus)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">
                            <span class="badge badge-purple" style="margin-right: 8px;">●</span>
                            Cọc
                        </div>
                        <div class="stat-value">${window.UniData.formatCurrency(totalDepositByStatus)}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Tổng nhận (từ trước)</div>
                        <div class="stat-value">${window.UniData.formatCurrency(totalPaidAllTime)}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="flex justify-between items-center mb-3">
                <h3>Các lớp đang dạy</h3>
                ${classes.length ? `<span class="text-muted text-sm">Tháng ${formatMonthLabel(month)}</span>` : ''}
            </div>
            ${classes.length ? `
                <div class="table-container teacher-detail-table">
                    <table class="table-striped">
                        <thead>
                            <tr>
                                <th>Lớp</th>
                                <th>Trợ cấp / hệ số</th>
                                <th>Học phí HS</th>
                                <th>Đã nhận</th>
                                <th>Chưa nhận</th>
                                <th>Tổng Tháng</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classStats.map(stat => `
                                <tr class="teacher-class-row ${stat.isActive ? 'class-active' : 'class-inactive'}" data-class-id="${stat.class.id}" data-is-active="${stat.isActive}" style="cursor: ${stat.isActive ? 'pointer' : 'default'};">
                                    <td>
                                        <div class="font-medium">
                                            ${stat.class.name}
                                            ${stat.isActive ? 
                                                '<span class="class-status-badge class-status-active">(Dạy)</span>' : 
                                                '<span class="class-status-badge class-status-inactive">(Nghỉ Dạy)</span>'
                                            }
                                        </div>
                                        <div class="text-muted text-sm">${stat.monthSessionsCount} buổi trong tháng</div>
                                    </td>
                                    <td>
                                        ${isAdmin ? `
                                            <button class="btn-allowance-edit" data-class-id="${stat.class.id}" data-teacher-id="${teacherId}" onclick="event.stopPropagation();" style="background: transparent; border: none; color: var(--primary); cursor: pointer; padding: var(--spacing-1); border-radius: var(--radius); transition: all 0.2s ease-in-out;" title="Chỉnh sửa trợ cấp">
                                                ${formatAllowanceValue(stat.baseAllowance)}
                                            </button>
                                        ` : `<span class="font-medium">${formatAllowanceValue(stat.baseAllowance)}</span>`}
                                    </td>
                                    <td>
                                        <div class="text-muted text-sm">${formatAllowanceValue(stat.studentUnit)}</div>
                                        ${stat.packageLabel ? `<div class="text-muted text-xs">${stat.packageLabel}</div>` : ''}
                                    </td>
                                    <td>${window.UniData.formatCurrency(stat.totalPaid)}</td>
                                    <td>${window.UniData.formatCurrency(stat.totalUnpaid)}</td>
                                    <td>${window.UniData.formatCurrency(stat.totalMonth)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p class="text-muted">Giáo viên chưa được phân lớp.</p>'}
        </div>
    `;

    main.querySelector('#teacherMonthSelect')?.addEventListener('change', (e) => {
        if (typeof renderStaffDetail === 'function') {
            renderStaffDetail(teacherId, e.target.value);
            } else {
            window.UniUI.loadPage(`staff-detail:${teacherId}`);
        }
    });

    main.querySelector('#teacherAccountBtn')?.addEventListener('click', () => openTeacherInfoPanel(teacherId));

    // Handle QR icon buttons
    main.querySelectorAll('.qr-icon-btn-large').forEach(btn => {
        if (btn.classList.contains('qr-icon-btn-active')) {
            // QR button with link - open link
            btn.addEventListener('click', () => {
                const qrLink = btn.dataset.qrLink;
                if (qrLink) {
                    window.open(qrLink, '_blank');
                }
            });
        } else if (btn.classList.contains('qr-icon-btn-inactive')) {
            // QR button without link - do nothing (already has cursor: not-allowed)
            btn.addEventListener('click', (e) => {
        e.preventDefault();
                e.stopPropagation();
            });
        } else if (btn.classList.contains('qr-icon-btn-upload')) {
            // Upload button - open modal
            btn.addEventListener('click', () => {
                const teacherId = btn.dataset.teacherId;
                if (teacherId) {
                    openQRLinkModal(teacherId);
                }
            });
        }
    });

    // Handle row click - navigate to class detail (only for active classes)
    main.querySelectorAll('.teacher-class-row').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't navigate if clicking on allowance edit button
            if (e.target.closest('.btn-allowance-edit') || e.target.classList.contains('btn-allowance-edit')) {
                return;
            }
            // Only navigate if class is active
            const isActive = row.dataset.isActive === 'true';
            if (!isActive) {
                return;
            }
            const classId = row.dataset.classId;
            if (classId) {
                window.UniUI.loadPage(`class-detail:${classId}`);
            }
        });
    });

    // Handle allowance edit button click
    main.querySelectorAll('.btn-allowance-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const classId = btn.dataset.classId;
            const tId = btn.dataset.teacherId;
            if (typeof openTeacherAllowanceModal === 'function') {
                openTeacherAllowanceModal(classId, tId, () => {
                    // Refresh staff detail page
                    if (typeof renderStaffDetail === 'function') {
                        renderStaffDetail(teacherId, month);
                    } else {
                        window.UniUI.loadPage(`staff-detail:${teacherId}`);
                    }
                    // Refresh teachers list page if it's currently displayed
                    const currentPage = window.location.hash.replace('#', '');
                    if (currentPage === 'teachers' && typeof renderTeachers === 'function') {
                        renderTeachers();
                    }
                    // Refresh classes page if it's currently displayed
                    if (currentPage === 'classes' && typeof renderClasses === 'function') {
                        renderClasses();
                    }
                    // Refresh class detail if it's currently displayed
                    if (currentPage.startsWith('class-detail:')) {
                        const currentClassId = currentPage.split(':')[1];
                        if (currentClassId === classId && typeof renderClassDetail === 'function') {
                            renderClassDetail(classId);
                        }
                    }
                    window.UniUI.toast('Đã cập nhật trợ cấp', 'success');
                });
            }
        });
    });
    */
}

function openTeacherModal(teacherId = null) {
    const isEdit = Boolean(teacherId);
    const teacher = isEdit ? window.demo.teachers.find(t => t.id === teacherId) : {};
    const isAdmin = window.UniUI.hasRole('admin');
    const requiredAttr = isAdmin ? '' : 'required';

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="tFullName">Họ tên${isAdmin ? '' : '*'}</label>
            <input id="tFullName" name="fullName" class="form-control" value="${teacher?.fullName || ''}" ${requiredAttr} placeholder="Nhập họ và tên đầy đủ">
        </div>
        <div class="form-group">
            <label for="tBirthDate">Ngày tháng năm sinh${isAdmin ? '' : '*'}</label>
            <input id="tBirthDate" name="birthDate" type="date" class="form-control date-input" value="${teacher?.birthDate || ''}" ${requiredAttr}>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="tUniversity">Đại học</label>
                <input id="tUniversity" name="university" class="form-control" value="${teacher?.university || ''}" placeholder="Tên trường đại học (tùy chọn)">
            </div>
            <div class="form-group">
                <label for="tHighSchool">Trường THPT${isAdmin ? '' : '*'}</label>
                <input id="tHighSchool" name="highSchool" class="form-control" value="${teacher?.highSchool || ''}" ${requiredAttr} placeholder="Tên trường THPT">
            </div>
        </div>
        <div class="form-group">
            <label for="tProvince">Tỉnh thành${isAdmin ? '' : '*'}</label>
            <input id="tProvince" name="province" class="form-control" value="${teacher?.province || ''}" ${requiredAttr} placeholder="Tỉnh/Thành phố">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="tGmail">Email${isAdmin ? '' : '*'}</label>
                <input id="tGmail" name="gmail" type="email" class="form-control" value="${teacher?.gmail || ''}" ${requiredAttr} placeholder="email@example.com">
            </div>
            <div class="form-group">
                <label for="tPhone">Số điện thoại${isAdmin ? '' : '*'}</label>
                <input id="tPhone" name="phone" class="form-control" value="${teacher?.phone || ''}" ${requiredAttr} placeholder="0912345678">
            </div>
        </div>
        <div class="form-group">
            <label for="tSpecialization">Mô tả chuyên môn${isAdmin ? '' : '*'}</label>
            <textarea id="tSpecialization" name="specialization" class="form-control" rows="4" ${requiredAttr} placeholder="Mô tả chi tiết về môn dạy, kinh nghiệm, thế mạnh của giáo viên...">${teacher?.specialization || ''}</textarea>
            <div class="text-muted text-sm mt-1">Nhập mô tả chi tiết về chuyên môn, kinh nghiệm giảng dạy, thế mạnh của giáo viên</div>
        </div>
        <div class="form-actions">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Tạo mới'}</button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const isAdmin = window.UniUI.hasRole('admin');
        
        const fullName = fd.get('fullName')?.trim() || '';
        const birthDate = fd.get('birthDate')?.trim() || '';
        const university = fd.get('university')?.trim() || '';
        const highSchool = fd.get('highSchool')?.trim() || '';
        const province = fd.get('province')?.trim() || '';
        const gmail = fd.get('gmail')?.trim() || '';
        const phone = fd.get('phone')?.trim() || '';
        const specialization = fd.get('specialization')?.trim() || '';

        // Only validate required fields if not admin
        if (!isAdmin) {
            if (!fullName || !birthDate || !highSchool || !province || !gmail || !phone || !specialization) {
                alert('Vui lòng điền đầy đủ tất cả các trường bắt buộc');
                return;
            }

            // Validate email format (only if email is provided)
            if (gmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(gmail)) {
                    alert('Email không hợp lệ');
                    return;
                }
            }

            // Validate phone (only if phone is provided)
            if (phone) {
                const phoneRegex = /^[0-9]{10,11}$/;
                if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
                    alert('Số điện thoại không hợp lệ (10-11 chữ số)');
                    return;
                }
            }
        } else {
            // For admin: only validate format if field is provided
            if (gmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(gmail)) {
                    alert('Email không hợp lệ');
                    return;
                }
            }

            if (phone) {
                const phoneRegex = /^[0-9]{10,11}$/;
                if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
                    alert('Số điện thoại không hợp lệ (10-11 chữ số)');
                    return;
                }
            }
        }

        // Check email uniqueness (only if email is provided and not empty)
        if (gmail) {
            if (!isEdit) {
                const existingTeacher = window.demo.teachers.find(t => t.gmail === gmail);
                if (existingTeacher) {
                    alert('Email này đã được sử dụng bởi giáo viên khác');
                    return;
                }
    } else {
                const existingTeacher = window.demo.teachers.find(t => t.gmail === gmail && t.id !== teacherId);
                if (existingTeacher) {
                    alert('Email này đã được sử dụng bởi giáo viên khác');
                    return;
                }
            }
        }

        const data = {
            fullName,
            birthDate,
            university,
            highSchool,
            province,
            gmail,
            phone,
            specialization,
            status: teacher?.status || 'active'
        };

        await window.UniData.withOptimisticUpdate(
            () => {
                const teacherEntity = isEdit
                    ? window.UniLogic.updateEntity('teacher', teacherId, data)
                    : window.UniLogic.createEntity('teacher', data);

                return {
                    supabaseEntities: {
                        teachers: [teacherEntity]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderTeachers();
                    window.UniUI.toast(isEdit ? 'Đã cập nhật thông tin giáo viên' : 'Đã tạo giáo viên mới', 'success');
                },
                onError: (error) => {
                    console.error('Failed to save teacher:', error);
                    window.UniUI.toast('Không thể lưu giáo viên: ' + (error.message || 'Lỗi không xác định'), 'error');
                },
                onRollback: () => {
                    renderTeachers();
                }
            }
        );
    });

    window.UniUI.openModal(isEdit ? 'Chỉnh sửa giáo viên' : 'Thêm giáo viên mới', form);

    // Ensure date picker opens on any click within the date input
    const dateInput = form.querySelector('#tBirthDate');
    if (dateInput) {
        // Make the entire input area clickable
        dateInput.style.cursor = 'pointer';
        
        // Add click handler to ensure date picker opens
        dateInput.addEventListener('click', function(e) {
            e.stopPropagation();
            // Focus and show picker
            this.focus();
            this.showPicker?.();
        });

        // Also handle focus to show picker
        dateInput.addEventListener('focus', function() {
            // Some browsers need a small delay
            setTimeout(() => {
                this.showPicker?.();
            }, 10);
        });
    }
}

function openTeacherHistory(teacherId){
    const classes = window.UniData.getTeacherClasses(teacherId);
    const kpis = window.UniData.getTeacherKpis(teacherId);
    const classIds = classes.map(c=>c.id);
    const sessions = (window.demo.sessions||[]).filter(s=>classIds.includes(s.classId));
    const payroll = (window.demo.payroll||[]).filter(p=>p.teacherId===teacherId);
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
            <div class="card"><h4>KPIs</h4><div>Total sessions: ${kpis.totalSessions}</div><div>Total hours: ${kpis.totalHours}h</div><div>Income: ${window.UniData.formatCurrency(kpis.income)}</div></div>
            <div class="card"><h4>Classes</h4><ul class="text-muted">${classes.map(c=>`<li>${c.name}</li>`).join('')}</ul></div>
        </div>
        <div class="card mt-4">
            <h4>Sessions</h4>
            <div class="table-container">
                <table class="table-striped"><thead><tr><th>Date</th><th>Class</th><th>Duration</th></tr></thead><tbody>
                    ${sessions.map(s=>`<tr><td>${s.date}</td><td>${(classes.find(c=>c.id===s.classId)||{}).name||'-'}</td><td>${s.duration}h</td></tr>`).join('')}
                </tbody></table>
            </div>
        </div>
        <div class="card mt-4">
            <h4>Payroll</h4>
            <div class="table-container">
                <table class="table-striped"><thead><tr><th>Month</th><th>Total hours</th><th>Sessions</th><th>Total pay</th></tr></thead><tbody>
                    ${payroll.map(p=>`<tr><td>${p.month}</td><td>${p.totalHours}</td><td>${p.totalSessions}</td><td>${window.UniData.formatCurrency(p.totalPay)}</td></tr>`).join('')}
                </tbody></table>
            </div>
        </div>
    `;
    window.UniUI.openModal('Teacher History', content);
}

async function deleteTeacher(id) {
    const teacher = window.demo.teachers.find(t => t.id === id);
    if (!teacher) return;

    try {
        // Check if teacher is assigned to classes (logic.js will handle this, but we show better error)
        const hasClasses = (window.demo.classes || []).some(c => {
            if (c.teacherIds && Array.isArray(c.teacherIds)) {
                return c.teacherIds.includes(id);
            }
            return c.teacherId === id;
        });
        
        if (hasClasses) {
            alert(`Không thể xóa gia sư "${teacher.fullName}". Gia sư này đang được phân công vào lớp học.`);
            return;
        }

        if (!confirm(`Bạn có chắc muốn xóa gia sư "${teacher.fullName}"?`)) {
            return;
        }

        await window.UniData.withOptimisticUpdate(
            () => {
                window.UniLogic.deleteEntity('teacher', id);
                return {
                    supabaseDeletes: { teachers: [id] }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.toast('Đã xóa gia sư', 'success');
                    renderTeachers();
                },
                onError: (error) => {
                    console.error('Failed to delete teacher:', error);
                    window.UniUI.toast('Không thể xóa gia sư', 'error');
                },
                onRollback: () => {
                    renderTeachers();
                }
            }
        );
    } catch (error) {
        alert('Lỗi khi xóa gia sư: ' + error.message);
    }
}

/**
 * Open QR Link modal to add/update bank QR link
 */
function openQRLinkModal(teacherId) {
    const teacher = window.demo.teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const form = document.createElement('div');
    form.innerHTML = `
        <div class="qr-link-form">
            <div class="form-group">
                <label for="qrLinkInput">Link ảnh QR ngân hàng</label>
                <input 
                    id="qrLinkInput" 
                    type="url" 
                    class="form-control" 
                    value="${teacher.bankQRLink || ''}"
                    placeholder="https://drive.google.com/... hoặc link ảnh QR khác"
                >
                <div class="text-muted text-sm mt-1">
                    Nhập link ảnh QR từ Google Drive hoặc nguồn khác. 
                    ${teacher.bankQRLink ? 'Để trống và lưu để xóa link hiện tại.' : ''}
                </div>
            </div>
            <div class="form-actions">
                <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
                <button type="button" class="btn btn-primary" id="saveQRLinkBtn">Lưu</button>
            </div>
        </div>
    `;

    const saveBtn = form.querySelector('#saveQRLinkBtn');
    saveBtn.addEventListener('click', async () => {
        const qrLinkInput = form.querySelector('#qrLinkInput');
        const qrLink = qrLinkInput.value.trim();

        // Validate URL if provided
        if (qrLink && !qrLink.match(/^https?:\/\/.+/)) {
            alert('Link không hợp lệ. Vui lòng nhập link bắt đầu bằng http:// hoặc https://');
            return;
        }

        // Update teacher data
        const data = {
            bankQRLink: qrLink || null
        };

        await window.UniData.withOptimisticUpdate(
            () => {
                const updatedTeacher = window.UniLogic.updateEntity('teacher', teacherId, data);
                return {
                    supabaseEntities: {
                        teachers: [updatedTeacher]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.toast('Đã cập nhật link QR', 'success');
                    window.UniUI.closeModal();
                    if (typeof renderStaffDetail === 'function') {
                        renderStaffDetail(teacherId);
                    } else {
                        window.UniUI.loadPage(`staff-detail:${teacherId}`);
                    }
                },
                onError: (error) => {
                    console.error('Error updating QR link:', error);
                    window.UniUI.toast('Không thể cập nhật link QR', 'error');
                },
                onRollback: () => {
                    if (typeof renderStaffDetail === 'function') {
                        renderStaffDetail(teacherId);
                    }
                }
            }
        );
    });

    window.UniUI.openModal('Cập nhật link QR ngân hàng', form);
}

/**
 * Open Teacher Info Panel - Display and edit personal information
 */
function openTeacherInfoPanel(teacherId) {
    const teacher = window.demo.teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI.hasRole('admin');
    const isSelfTeacher = currentUser
        && currentUser.role === 'teacher'
        && (
            (teacher.userId && teacher.userId === currentUser.id) ||
            (currentUser.linkId && teacher.id === currentUser.linkId)
        );
    const canEdit = isAdmin || isSelfTeacher;

    const panel = document.createElement('div');
    panel.className = 'teacher-info-panel';
    panel.innerHTML = `
        <div class="teacher-info-header">
            <h3>Thông tin cá nhân</h3>
            <button class="btn-icon-close" id="closeTeacherInfoPanel" aria-label="Đóng">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="teacher-info-content">
            <div class="teacher-info-view" id="teacherInfoView">
                <div class="info-item">
                    <label>Họ tên</label>
                    <div class="info-value">${teacher.fullName || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Ngày sinh</label>
                    <div class="info-value">${teacher.birthDate ? new Date(teacher.birthDate).toLocaleDateString('vi-VN') : '-'}</div>
                </div>
                <div class="info-item">
                    <label>Email</label>
                    <div class="info-value">${teacher.gmail || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Số điện thoại</label>
                    <div class="info-value">${teacher.phone || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Đại học</label>
                    <div class="info-value">${teacher.university || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Trường THPT</label>
                    <div class="info-value">${teacher.highSchool || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Tỉnh thành</label>
                    <div class="info-value">${teacher.province || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Mô tả chuyên môn</label>
                    <div class="info-value">${teacher.specialization || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Link QR ngân hàng</label>
                    <div class="info-value">
                        ${teacher.bankQRLink ? `
                            <a href="${teacher.bankQRLink}" target="_blank" class="qr-link">${teacher.bankQRLink}</a>
                        ` : '-'}
                    </div>
                </div>
                ${canEdit ? `
                    <div class="info-actions">
                        <button class="btn btn-primary" id="editTeacherInfoBtn">Chỉnh sửa</button>
                    </div>
                ` : ''}
            </div>
            ${canEdit ? `
            <div class="teacher-info-edit" id="teacherInfoEdit" style="display: none;">
                <form id="teacherInfoForm">
                    <div class="form-group">
                        <label for="tiFullName">Họ tên</label>
                        <input id="tiFullName" name="fullName" class="form-control" value="${teacher.fullName || ''}" placeholder="Nhập họ và tên đầy đủ">
                    </div>
                    <div class="form-group">
                        <label for="tiBirthDate">Ngày tháng năm sinh</label>
                        <input id="tiBirthDate" name="birthDate" type="date" class="form-control date-input" value="${teacher.birthDate || ''}">
                    </div>
                    <div class="form-group">
                        <label for="tiGmail">Email</label>
                        <input id="tiGmail" name="gmail" type="email" class="form-control" value="${teacher.gmail || ''}" placeholder="email@example.com">
                    </div>
                    <div class="form-group">
                        <label for="tiPhone">Số điện thoại</label>
                        <input id="tiPhone" name="phone" class="form-control" value="${teacher.phone || ''}" placeholder="0912345678">
                    </div>
                    <div class="form-group">
                        <label for="tiUniversity">Đại học</label>
                        <input id="tiUniversity" name="university" class="form-control" value="${teacher.university || ''}" placeholder="Tên trường đại học">
                    </div>
                    <div class="form-group">
                        <label for="tiHighSchool">Trường THPT</label>
                        <input id="tiHighSchool" name="highSchool" class="form-control" value="${teacher.highSchool || ''}" placeholder="Tên trường THPT">
                    </div>
                    <div class="form-group">
                        <label for="tiProvince">Tỉnh thành</label>
                        <input id="tiProvince" name="province" class="form-control" value="${teacher.province || ''}" placeholder="Tỉnh/Thành phố">
                    </div>
                    <div class="form-group">
                        <label for="tiSpecialization">Mô tả chuyên môn</label>
                        <textarea id="tiSpecialization" name="specialization" class="form-control" rows="4" placeholder="Mô tả chi tiết về chuyên môn...">${teacher.specialization || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="tiBankQRLink">Link QR ngân hàng</label>
                        <input id="tiBankQRLink" name="bankQRLink" type="url" class="form-control" value="${teacher.bankQRLink || ''}" placeholder="https://drive.google.com/...">
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn" id="cancelEditBtn">Hủy</button>
                        <button type="submit" class="btn btn-primary">Lưu</button>
                    </div>
                </form>
            </div>
            ` : ''}
        </div>
    `;

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'teacher-info-backdrop';
    backdrop.id = 'teacherInfoBackdrop';

    // Append to body
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // Animate in
    setTimeout(() => {
        backdrop.classList.add('active');
        panel.classList.add('active');
    }, 10);

    // Close handlers
    const closePanel = () => {
        backdrop.classList.remove('active');
        panel.classList.remove('active');
        setTimeout(() => {
            backdrop.remove();
            panel.remove();
        }, 300);
    };

    backdrop.addEventListener('click', closePanel);
    panel.querySelector('#closeTeacherInfoPanel')?.addEventListener('click', closePanel);

    // Edit mode toggle
    if (canEdit) {
        panel.querySelector('#editTeacherInfoBtn')?.addEventListener('click', () => {
            panel.querySelector('#teacherInfoView').style.display = 'none';
            panel.querySelector('#teacherInfoEdit').style.display = 'block';
        });

        panel.querySelector('#cancelEditBtn')?.addEventListener('click', () => {
            panel.querySelector('#teacherInfoView').style.display = 'block';
            panel.querySelector('#teacherInfoEdit').style.display = 'none';
        });

        // Form submit
        panel.querySelector('#teacherInfoForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            
            const data = {
                fullName: fd.get('fullName')?.trim() || '',
                birthDate: fd.get('birthDate')?.trim() || '',
                gmail: fd.get('gmail')?.trim() || '',
                phone: fd.get('phone')?.trim() || '',
                university: fd.get('university')?.trim() || '',
                highSchool: fd.get('highSchool')?.trim() || '',
                province: fd.get('province')?.trim() || '',
                specialization: fd.get('specialization')?.trim() || '',
                bankQRLink: fd.get('bankQRLink')?.trim() || ''
            };

            if (!data.fullName) {
                alert('Họ tên không được để trống');
                return;
            }

            if (data.gmail) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(data.gmail)) {
                    alert('Email không hợp lệ');
                    return;
                }
            }

            if (data.phone) {
                const phoneRegex = /^[0-9]{10}$/;
                if (!phoneRegex.test(data.phone.replace(/\s/g, ''))) {
                    alert('Số điện thoại không hợp lệ (cần 10 chữ số)');
                    return;
                }
            }

            if (data.gmail) {
                const existingTeacher = window.demo.teachers.find(t => t.gmail === data.gmail && t.id !== teacherId);
                if (existingTeacher) {
                    alert('Email này đã được sử dụng bởi giáo viên khác');
                    return;
                }
            }

            if (data.bankQRLink && !/^https?:\/\/.+/.test(data.bankQRLink)) {
                alert('Link QR không hợp lệ. Vui lòng nhập link bắt đầu bằng http:// hoặc https://');
                return;
            }

            const payload = {
                ...data,
                bankQRLink: data.bankQRLink || null
            };

            await window.UniData.withOptimisticUpdate(
                () => {
                    const updatedTeacher = window.UniLogic.updateEntity('teacher', teacherId, payload);
                    return {
                        supabaseEntities: {
                            teachers: [updatedTeacher]
                        }
                    };
                },
                {
                    onSuccess: () => {
                        window.UniUI.toast('Đã cập nhật thông tin', 'success');
                        closePanel();
                        if (typeof renderStaffDetail === 'function') {
                            renderStaffDetail(teacherId);
                        } else {
                            window.UniUI.loadPage(`staff-detail:${teacherId}`);
                        }
                    },
                    onError: (error) => {
                        console.error('Error updating teacher info:', error);
                        window.UniUI.toast('Không thể cập nhật thông tin', 'error');
                    },
                    onRollback: () => {
                        if (typeof renderStaffDetail === 'function') {
                            renderStaffDetail(teacherId);
                        }
                    }
                }
            );
        });

        // Ensure date picker opens on any click
        const dateInput = panel.querySelector('#tiBirthDate');
        if (dateInput) {
            dateInput.addEventListener('click', () => {
                dateInput.showPicker?.();
            });
        }
    }
}

// Redirect renderDetail to renderStaffDetail for unified experience
window.TeacherPage = { 
    render: renderTeachers, 
    openModal: openTeacherModal, 
    delete: deleteTeacher, 
    renderDetail: (teacherId, selectedMonth) => {
        if (typeof renderStaffDetail === 'function') {
            renderStaffDetail(teacherId, selectedMonth);
        } else {
            window.UniUI.loadPage(`staff-detail:${teacherId}`);
        }
    }
};

// Expose functions globally for inline onclick handlers
window.openTeacherModal = openTeacherModal;
window.deleteTeacher = deleteTeacher;
window.renderTeachers = renderTeachers;
// Redirect renderTeacherDetail to renderStaffDetail for unified experience
window.renderTeacherDetail = (teacherId, selectedMonth) => {
    if (typeof renderStaffDetail === 'function') {
        renderStaffDetail(teacherId, selectedMonth);
    } else {
        window.UniUI.loadPage(`staff-detail:${teacherId}`);
    }
};
window.openQRLinkModal = openQRLinkModal;
window.openTeacherInfoPanel = openTeacherInfoPanel;

// End of file
