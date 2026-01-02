/**
 * Staff CSKH Detail Page
 * Displays list of students assigned to a CSKH staff member with payment status management
 */

// Store profit percentage per student (in-memory, could be saved to database later)
const studentProfitPercentages = {};

// Store payment status per student per month (key: staffId_studentId_monthYear, value: 'paid' | 'unpaid' | 'deposit')
function getStudentPaymentStatusKey(staffId, studentId, month, year) {
    return `cskh_payment_${staffId}_${studentId}_${year}-${String(month).padStart(2, '0')}`;
}

function getStudentPaymentStatus(staffId, studentId, month, year) {
    const key = getStudentPaymentStatusKey(staffId, studentId, month, year);
    return localStorage.getItem(key) || 'unpaid';
}

function setStudentPaymentStatus(staffId, studentId, month, year, status) {
    const key = getStudentPaymentStatusKey(staffId, studentId, month, year);
    localStorage.setItem(key, status);
}

/**
 * Check if a student was assigned to CSKH staff in a specific month
 * A student is considered "assigned" if:
 * - They have cskhStaffId matching the staff
 * - AND they have at least one class or session in that month
 */
function wasStudentAssignedInMonth(student, staffId, month, year) {
    // Check if student is currently assigned
    if (student.cskhStaffId !== staffId) return false;
    
    // Check if student has any classes
    const studentClasses = (window.demo.studentClasses || []).filter(sc => sc.studentId === student.id);
    if (studentClasses.length === 0) return false;
    
    // Check if student has any sessions in this month
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    
    // Get all sessions for student's classes in this month
    const studentClassIds = studentClasses.map(sc => sc.classId);
    const monthSessions = (window.demo.sessions || []).filter(session => {
        if (!studentClassIds.includes(session.classId)) return false;
        if (!session.date) return false;
        const sessionDate = new Date(session.date);
        return sessionDate >= monthStart && sessionDate <= monthEnd;
    });
    
    // Check if student attended any sessions in this month
    const monthAttendance = (window.demo.attendance || []).filter(att => {
        if (!monthSessions.find(s => s.id === att.sessionId)) return false;
        return att.studentId === student.id;
    });
    
    // Student is considered assigned if they have classes and (sessions or attendance) in this month
    // OR if they were assigned before this month (for historical data)
    const assignedDate = student.cskhAssignedDate ? new Date(student.cskhAssignedDate) : null;
    if (assignedDate && assignedDate <= monthEnd) {
        // Check if they were still assigned at the end of this month
        const unassignedDate = student.cskhUnassignedDate ? new Date(student.cskhUnassignedDate) : null;
        if (!unassignedDate || unassignedDate > monthEnd) {
            return true; // Was assigned during this month
        }
    }
    
    // If no assigned date, check if they have activity in this month
    return monthSessions.length > 0 || monthAttendance.length > 0;
}

/**
 * Render CSKH detail page for a staff member
 * @param {string} staffId - ID of the CSKH staff member
 */
async function renderStaffCskhDetail(staffId) {
    // Initialize listeners and try optimistic loading
    const pageKey = `staff-cskh-detail-${staffId}`;
    if (!window[`__staffCskhDetailListenersInitialized_${staffId}`]) {
        window.UniData?.initPageListeners?.(pageKey, () => renderStaffCskhDetail(staffId), [
            'teachers', 'students', 'walletTransactions'
        ]);
        window[`__staffCskhDetailListenersInitialized_${staffId}`] = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderStaffCskhDetail(staffId), 10);
            return;
        } else {
            const main = document.querySelector('main');
            if (main) {
                main.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderStaffCskhDetail(staffId), 120);
            return;
        }
    }
    
    const main = document.querySelector('main');
    if (!main) return;

    const staff = (window.demo.teachers || []).find(t => t.id === staffId);
    if (!staff) {
        main.innerHTML = '<div class="card"><p class="text-error">Không tìm thấy nhân sự.</p></div>';
        return;
    }

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI?.hasRole?.('admin');
    const staffRoles = staff.roles || [];
    const hasCskhRole = staffRoles.includes('cskh_sale');
    const isSelf =
        currentUser &&
        currentUser.role === 'teacher' &&
        (currentUser.linkId === staffId || (!!staff.userId && staff.userId === currentUser.id));

    if (!isAdmin && (!hasCskhRole || !isSelf)) {
        main.innerHTML = `
            <div class="card">
                <p class="text-error">Bạn không có quyền truy cập trang CSKH này.</p>
                <button class="btn mt-3" onclick="window.UniUI.loadPage('staff')">← Quay lại</button>
            </div>
        `;
        return;
    }

    // Get current month/year from URL or default to current month
    const urlParams = new URLSearchParams(window.location.search);
    const selectedMonth = parseInt(urlParams.get('month')) || new Date().getMonth() + 1;
    const selectedYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
    
    // Get all students that were assigned to this CSKH staff in the selected month
    const allStudents = window.demo.students || [];
    const assignedStudents = allStudents.filter(s => wasStudentAssignedInMonth(s, staffId, selectedMonth, selectedYear));
    
    // Default profit percentage (can be adjusted in header)
    const defaultProfitPercent = parseFloat(localStorage.getItem(`cskh_default_profit_${staffId}`) || '10');
    
    // Calculate stats for each student
    const studentStats = assignedStudents.map(student => {
        // Get top-up transactions (nạp tiền) for this student in the selected month
        const monthStart = new Date(selectedYear, selectedMonth - 1, 1);
        const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
        
        const monthTopups = (window.demo.walletTransactions || []).filter(tx => {
            if (tx.studentId !== student.id) return false;
            if (tx.type !== 'topup') return false;
            if (!tx.date) return false;
            const txDate = new Date(tx.date);
            return txDate >= monthStart && txDate <= monthEnd;
        });
        
        const totalPaid = monthTopups.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        
        // Get profit percentage for this student (or use default)
        const profitPercent = studentProfitPercentages[`${staffId}_${student.id}`] || defaultProfitPercent;
        const profit = totalPaid * (profitPercent / 100);
        
        // Get payment status for this student in this month
        const paymentStatus = getStudentPaymentStatus(staffId, student.id, selectedMonth, selectedYear);
        
        return {
            student,
            totalPaid,
            profitPercent,
            profit,
            paymentStatus
        };
    });
    
    // Calculate totals based on payment status
    // Tổng số tiền chưa thanh toán = tổng lợi nhuận của học sinh có trạng thái "Chờ thanh toán"
    const totalUnpaidProfit = studentStats
        .filter(s => s.paymentStatus === 'unpaid')
        .reduce((sum, s) => sum + s.profit, 0);
    
    // Tổng Tháng = tổng lợi nhuận của học sinh có trạng thái "Đã thanh toán"
    const totalPaidProfit = studentStats
        .filter(s => s.paymentStatus === 'paid')
        .reduce((sum, s) => sum + s.profit, 0);
    
    // Tổng cộng tất cả (cho hiển thị trong bảng)
    const totalPaidAll = studentStats.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalProfitAll = studentStats.reduce((sum, s) => sum + s.profit, 0);
    
    // Generate month/year options for dropdown (last 12 months)
    const currentDate = new Date();
    const monthOptions = [];
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        monthOptions.push({ month, year, label: `Tháng ${month}/${year}` });
    }
    
    const canEditProfit = Boolean(isAdmin);
    const canManagePaymentStatus = Boolean(isAdmin || hasCskhRole);

    // Payment status labels and classes
    const paymentStatusLabels = {
        paid: 'Đã thanh toán',
        unpaid: 'Chờ thanh toán',
        deposit: 'Cọc'
    };
    const paymentStatusClasses = {
        paid: 'badge-success',
        unpaid: 'badge-danger',
        deposit: 'badge-warning'
    };

    main.innerHTML = `
        <div class="page-header" style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-4); position: sticky; top: 0; background: var(--bg); z-index: 10; padding: var(--spacing-3) 0; border-bottom: 1px solid var(--border);">
            <button 
                id="backBtn" 
                class="btn btn-icon"
                style="padding: var(--spacing-2); min-width: auto;"
                title="Quay lại"
                data-staff-id="${staffId}"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <h1 style="margin: 0; flex: 1; font-size: var(--font-size-xl); font-weight: 600;">📋 Học sinh CSKH - ${staff.fullName}</h1>
        </div>
        
        <div class="card mb-4" data-staff-id="${staffId}">
            <div class="flex justify-between items-center mb-3" style="flex-wrap: wrap; gap: var(--spacing-2);">
                <div class="flex items-center gap-3" style="flex-wrap: wrap;">
                    <label for="monthFilter" style="display: flex; align-items: center; gap: var(--spacing-2); white-space: nowrap;">
                        <span style="font-weight: 500;">Tháng:</span>
                        <select 
                            id="monthFilter" 
                            data-staff-id="${staffId}"
                            style="padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); cursor: pointer; transition: all 0.2s ease;"
                        >
                            ${monthOptions.map(opt => `
                                <option 
                                    value="${opt.month}-${opt.year}" 
                                    ${opt.month == selectedMonth && opt.year == selectedYear ? 'selected' : ''}
                                >
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                    </label>
                </div>
            </div>
            
            ${canManagePaymentStatus ? `
            <div class="bulk-actions" id="studentBulkActions" style="display: none; margin-bottom: var(--spacing-3); padding: var(--spacing-3); background: var(--bg-secondary); border: 1px solid var(--border); border-radius: var(--radius); transition: opacity 0.2s ease, transform 0.2s ease; opacity: 0; transform: translateY(-10px);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-3); flex-wrap: wrap;">
                    <span class="selected-count" id="studentSelectedCount" style="font-weight: 500; color: var(--text); font-size: var(--font-size-sm);"></span>
                    <div style="display: flex; gap: var(--spacing-2); flex-wrap: wrap;">
                        <button type="button" class="btn btn-sm btn-primary" id="bulkStudentStatusBtn" style="display: flex; align-items: center; gap: var(--spacing-2); white-space: nowrap;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            Đánh dấu đã thanh toán
                        </button>
                        <button type="button" class="btn btn-sm btn-outline" id="studentClearSelectionBtn" style="display: flex; align-items: center; gap: var(--spacing-2); white-space: nowrap;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Bỏ chọn tất cả
                        </button>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${assignedStudents.length > 0 ? `
            <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius);">
                <table class="table-striped sessions-table" style="min-width: 1000px; width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);">
                            ${canManagePaymentStatus ? `
                            <th style="padding: var(--spacing-3); text-align: center; width: 50px; min-width: 50px; border-bottom: 2px solid var(--border);">
                                <input 
                                    type="checkbox" 
                                    id="selectAllStudents" 
                                    class="table-checkbox" 
                                    style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--primary);"
                                    title="Chọn tất cả"
                                />
                            </th>
                            ` : ''}
                            <th style="padding: var(--spacing-3); text-align: left; min-width: 200px; border-bottom: 2px solid var(--border); font-weight: 600;">Tên học sinh</th>
                            <th style="padding: var(--spacing-3); text-align: left; min-width: 100px; border-bottom: 2px solid var(--border); font-weight: 600;">Năm sinh</th>
                            <th style="padding: var(--spacing-3); text-align: left; min-width: 150px; border-bottom: 2px solid var(--border); font-weight: 600;">Tỉnh</th>
                            <th style="padding: var(--spacing-3); text-align: right; min-width: 150px; border-bottom: 2px solid var(--border); font-weight: 600;">Đã đóng</th>
                            <th style="padding: var(--spacing-3); text-align: left; min-width: 250px; border-bottom: 2px solid var(--border); font-weight: 600;">
                                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                    <span>Lợi nhuận</span>
                                    <input 
                                        type="number" 
                                        id="defaultProfitPercent" 
                                        data-staff-id="${staffId}"
                                        value="${defaultProfitPercent}" 
                                        min="0" 
                                        max="100" 
                                        step="0.1"
                                        style="width: 60px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius); text-align: center; background: var(--bg);"
                                        title="% lợi nhuận mặc định"
                                        ${canEditProfit ? '' : 'disabled'}
                                    />
                                    <span style="font-size: 0.875rem; color: var(--text-muted);">%</span>
                                </div>
                            </th>
                            <th style="padding: var(--spacing-3); text-align: center; min-width: 150px; border-bottom: 2px solid var(--border); font-weight: 600;">Trạng thái thanh toán</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentStats.map(stat => {
                            const student = stat.student;
                            const statusLabel = paymentStatusLabels[stat.paymentStatus] || paymentStatusLabels.unpaid;
                            const statusClass = paymentStatusClasses[stat.paymentStatus] || paymentStatusClasses.unpaid;
                            return `
                            <tr 
                                class="student-row" 
                                data-student-id="${student.id}"
                                style="cursor: pointer; transition: all 0.2s ease;"
                                onmouseover="this.style.backgroundColor='var(--bg-secondary)'"
                                onmouseout="this.style.backgroundColor=''"
                            >
                                ${canManagePaymentStatus ? `
                                <td style="padding: var(--spacing-3); text-align: center; border-bottom: 1px solid var(--border);" onclick="event.stopPropagation();">
                                    <input 
                                        type="checkbox" 
                                        class="student-checkbox table-checkbox" 
                                        data-student-id="${student.id}"
                                        style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--primary);"
                                    />
                                </td>
                                ` : ''}
                                <td style="padding: var(--spacing-3); border-bottom: 1px solid var(--border);">
                                    <div class="font-medium" style="font-weight: 500; color: var(--text);">${student.fullName || 'N/A'}</div>
                                </td>
                                <td style="padding: var(--spacing-3); border-bottom: 1px solid var(--border); color: var(--text-muted);">${student.birthYear || 'N/A'}</td>
                                <td style="padding: var(--spacing-3); border-bottom: 1px solid var(--border); color: var(--text-muted);">${student.province || 'N/A'}</td>
                                <td style="padding: var(--spacing-3); text-align: right; border-bottom: 1px solid var(--border); font-weight: 500; color: var(--text);">${window.UniData.formatCurrency(stat.totalPaid)}</td>
                                <td style="padding: var(--spacing-3); border-bottom: 1px solid var(--border);">
                                    <div style="display: flex; align-items: center; gap: var(--spacing-2); flex-wrap: wrap;">
                                        <input 
                                            type="number" 
                                            class="student-profit-percent" 
                                            data-staff-id="${staffId}"
                                            data-student-id="${student.id}"
                                            value="${stat.profitPercent}" 
                                            min="0" 
                                            max="100" 
                                            step="0.1"
                                            style="width: 60px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius); text-align: center; background: var(--bg);"
                                            title="% lợi nhuận riêng cho học sinh này"
                                            ${canEditProfit ? '' : 'disabled'}
                                            onclick="event.stopPropagation();"
                                        />
                                        <span style="font-size: 0.875rem; color: var(--text-muted);">%</span>
                                        <span class="font-medium" style="margin-left: var(--spacing-2); font-weight: 500; color: var(--text);">
                                            = ${window.UniData.formatCurrency(stat.profit)}
                                        </span>
                                    </div>
                                </td>
                                <td style="padding: var(--spacing-3); text-align: center; border-bottom: 1px solid var(--border);">
                                    <span class="badge ${statusClass}" style="font-size: var(--font-size-xs); padding: 4px 10px; font-weight: 500;">
                                        ${statusLabel}
                                    </span>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                        <tr style="font-weight: 600; background: var(--bg-secondary); border-top: 2px solid var(--border);">
                            <td ${canManagePaymentStatus ? 'colspan="2"' : ''} style="padding: var(--spacing-3);"><strong>Tổng cộng</strong></td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3); text-align: right;"><strong>${window.UniData.formatCurrency(totalPaidAll)}</strong></td>
                            <td style="padding: var(--spacing-3);"><strong>${window.UniData.formatCurrency(totalProfitAll)}</strong></td>
                            <td style="padding: var(--spacing-3);"></td>
                        </tr>
                        <tr style="font-weight: 600; background: rgba(239, 68, 68, 0.05); border-top: 1px solid var(--border);">
                            <td ${canManagePaymentStatus ? 'colspan="2"' : ''} style="padding: var(--spacing-3); color: var(--danger);">
                                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                    <span class="badge badge-danger" style="font-size: var(--font-size-xs); padding: 4px 8px;">Chờ thanh toán</span>
                                    <span>Chưa thanh toán</span>
                                </div>
                            </td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3); color: var(--danger); font-weight: 600;"><strong>${window.UniData.formatCurrency(totalUnpaidProfit)}</strong></td>
                            <td style="padding: var(--spacing-3);"></td>
                        </tr>
                        <tr style="font-weight: 600; background: rgba(34, 197, 94, 0.05); border-top: 1px solid var(--border);">
                            <td ${canManagePaymentStatus ? 'colspan="2"' : ''} style="padding: var(--spacing-3); color: var(--success);">
                                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                    <span class="badge badge-success" style="font-size: var(--font-size-xs); padding: 4px 8px;">Đã thanh toán</span>
                                    <span>Tổng tháng</span>
                                </div>
                            </td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3);"></td>
                            <td style="padding: var(--spacing-3); color: var(--success); font-weight: 600;"><strong>${window.UniData.formatCurrency(totalPaidProfit)}</strong></td>
                            <td style="padding: var(--spacing-3);"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ` : `
            <div class="text-center" style="padding: var(--spacing-6);">
                ${window.UniUI?.renderEmptyState?.({
                    icon: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
                    title: 'Chưa có học sinh nào',
                    description: `Tháng ${selectedMonth}/${selectedYear} chưa có học sinh nào được phân công cho nhân sự này.`
                }) || '<p class="text-muted">Chưa có học sinh nào được phân công cho nhân sự này.</p>'}
            </div>
            `}
        </div>
    `;
    
    // Attach event listeners
    const backBtn = main.querySelector('#backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.UniUI.loadPage(`staff-detail:${staffId}`);
        });
    }
    
    const monthFilter = main.querySelector('#monthFilter');
    if (monthFilter) {
        monthFilter.addEventListener('change', () => {
            const [month, year] = monthFilter.value.split('-');
            window.location.search = `?month=${month}&year=${year}`;
        });
    }
    
    if (canEditProfit) {
        const defaultProfitInput = main.querySelector('#defaultProfitPercent');
        if (defaultProfitInput) {
            defaultProfitInput.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value) || 0;
                localStorage.setItem(`cskh_default_profit_${staffId}`, value.toString());
                renderStaffCskhDetail(staffId);
            });
        }
    }
    
    // Student row clicks
    main.querySelectorAll('.student-row').forEach(row => {
        const studentId = row.getAttribute('data-student-id');
        row.addEventListener('click', (e) => {
            // Don't navigate if clicking on checkbox or input
            if (e.target.closest('.student-checkbox') || e.target.closest('.student-profit-percent')) return;
            window.UniUI.loadPage(`student-detail:${studentId}`);
        });
    });
    
    // Student profit percent inputs
    if (canEditProfit) {
        main.querySelectorAll('.student-profit-percent').forEach(input => {
            input.addEventListener('change', (e) => {
                const staffIdFromData = e.target.getAttribute('data-staff-id');
                const studentId = e.target.getAttribute('data-student-id');
                const value = parseFloat(e.target.value) || 0;
                studentProfitPercentages[`${staffIdFromData}_${studentId}`] = value;
                renderStaffCskhDetail(staffIdFromData);
            });
        });
    }
    
    // Bulk actions for payment status
    if (canManagePaymentStatus) {
        attachBulkActionsListeners(staffId, selectedMonth, selectedYear);
    }
}

/**
 * Attach event listeners for bulk actions (checkboxes and bulk update)
 */
function attachBulkActionsListeners(staffId, month, year) {
    const main = document.querySelector('main');
    if (!main) return;
    
    const selectAllCheckbox = main.querySelector('#selectAllStudents');
    const studentCheckboxes = Array.from(main.querySelectorAll('.student-checkbox'));
    const bulkActions = main.querySelector('#studentBulkActions');
    const selectedCount = main.querySelector('#studentSelectedCount');
    const bulkStatusBtn = main.querySelector('#bulkStudentStatusBtn');
    const clearSelectionBtn = main.querySelector('#studentClearSelectionBtn');
    
    function updateBulkActions() {
        const checked = main.querySelectorAll('.student-checkbox:checked');
        const count = checked.length;
        
        if (bulkActions) {
            if (count > 0) {
                bulkActions.style.display = 'block';
                // Trigger reflow to ensure transition works
                void bulkActions.offsetHeight;
                bulkActions.style.opacity = '1';
                bulkActions.style.transform = 'translateY(0)';
            } else {
                bulkActions.style.opacity = '0';
                bulkActions.style.transform = 'translateY(-10px)';
                // Hide after transition completes
                setTimeout(() => {
                    if (bulkActions.style.opacity === '0') {
                        bulkActions.style.display = 'none';
                    }
                }, 200);
            }
        }
        
        if (selectedCount) {
            selectedCount.textContent = count > 0 ? `Đã chọn: ${count} học sinh` : '';
        }
        
        if (selectAllCheckbox) {
            const allChecked = studentCheckboxes.length > 0 && checked.length === studentCheckboxes.length;
            const someChecked = checked.length > 0 && checked.length < studentCheckboxes.length;
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked;
        }
    }
    
    // Select all checkbox
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            studentCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            updateBulkActions();
        });
    }
    
    // Individual checkboxes
    studentCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateBulkActions();
        });
    });
    
    // Clear selection button
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            studentCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkActions();
        });
    }
    
    // Bulk update status button
    if (bulkStatusBtn) {
        bulkStatusBtn.addEventListener('click', () => {
            const checked = Array.from(main.querySelectorAll('.student-checkbox:checked'));
            if (checked.length === 0) {
                window.UniUI.toast('Vui lòng chọn ít nhất một học sinh', 'warning');
                return;
            }
            
            const studentIds = checked.map(cb => cb.dataset.studentId).filter(Boolean);
            openBulkStudentStatusModal(staffId, studentIds, month, year);
        });
    }
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.(pageKey, ['teachers', 'students', 'walletTransactions']);
}

/**
 * Open modal to update payment status for selected students
 */
function openBulkStudentStatusModal(staffId, studentIds, month, year) {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="padding: var(--spacing-4);">
            <p style="margin: 0 0 var(--spacing-4) 0; font-size: var(--font-size-base); color: var(--text);">
                Chọn trạng thái thanh toán cho <strong>${studentIds.length}</strong> học sinh đã chọn:
            </p>
            <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
                <button type="button" class="btn btn-block" data-status="paid" style="justify-content: flex-start; padding: var(--spacing-3); background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #047857; transition: all 0.2s ease;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--spacing-2);">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Đã thanh toán
                </button>
                <button type="button" class="btn btn-block" data-status="unpaid" style="justify-content: flex-start; padding: var(--spacing-3); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #991b1b; transition: all 0.2s ease;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--spacing-2);">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Chờ thanh toán
                </button>
                <button type="button" class="btn btn-block" data-status="deposit" style="justify-content: flex-start; padding: var(--spacing-3); background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); color: #6b21a8; transition: all 0.2s ease;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--spacing-2);">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 8v4M12 16h.01"></path>
                    </svg>
                    Cọc
                </button>
            </div>
        </div>
    `;
    
    const statusButtons = modal.querySelectorAll('[data-status]');
    statusButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            updateBulkStudentPaymentStatus(staffId, studentIds, month, year, status);
            window.UniUI.closeModal();
        });
    });
    
    window.UniUI.openModal('Chọn trạng thái thanh toán', modal);
}

/**
 * Update payment status for multiple students
 */
function updateBulkStudentPaymentStatus(staffId, studentIds, month, year, status) {
    studentIds.forEach(studentId => {
        setStudentPaymentStatus(staffId, studentId, month, year, status);
    });
    
    window.UniUI.toast(`Đã cập nhật trạng thái thanh toán cho ${studentIds.length} học sinh`, 'success');
    renderStaffCskhDetail(staffId);
}

/**
 * Update month filter and reload page
 */
function updateMonthFilter(staffId) {
    const select = document.getElementById('monthFilter');
    const [month, year] = select.value.split('-');
    window.location.search = `?month=${month}&year=${year}`;
}

/**
 * Update default profit percentage for CSKH staff
 */
function updateDefaultProfitPercent(staffId, percent) {
    const value = parseFloat(percent) || 0;
    localStorage.setItem(`cskh_default_profit_${staffId}`, value.toString());
    renderStaffCskhDetail(staffId);
}

/**
 * Update profit percentage for a specific student
 */
function updateStudentProfitPercent(staffId, studentId, percent) {
    const value = parseFloat(percent) || 0;
    studentProfitPercentages[`${staffId}_${studentId}`] = value;
    renderStaffCskhDetail(staffId);
}

// Export functions globally
window.renderStaffCskhDetail = renderStaffCskhDetail;
window.updateMonthFilter = updateMonthFilter;
window.updateDefaultProfitPercent = updateDefaultProfitPercent;
window.updateStudentProfitPercent = updateStudentProfitPercent;
