/**
 * dashboard.js - Dashboard page renderer
 */

const DASHBOARD_STATE_KEY = 'unicorns.dashboard.state';
const QUICK_VIEW_TABS = [
    { id: 'finance', label: 'Tài chính' },
    { id: 'operations', label: 'Vận hành' },
    { id: 'students', label: 'Học viên' }
];

function formatCurrencyVND(value) {
    if (window.UniData && typeof window.UniData.formatCurrency === 'function') {
        return window.UniData.formatCurrency(value || 0);
    }
    const numeric = Number(value || 0);
    return `${numeric.toLocaleString('vi-VN')} đ`;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('vi-VN');
}

function formatShortCurrency(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) {
        return `${(n / 1_000_000_000).toFixed(1)}B`;
    }
    if (abs >= 1_000_000) {
        return `${(n / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
        return `${(n / 1_000).toFixed(0)}K`;
    }
    return `${n}`;
}

function isDataLoading() {
    return window.__pendingDataChange === true;
}

function shouldShowLoading(value, isLoading) {
    // Chỉ hiển thị loading khi: đang loading VÀ giá trị chưa được tính toán (undefined/null)
    // Không hiển thị loading nếu giá trị là 0 (vì 0 là giá trị hợp lệ)
    if (!isLoading) return false;
    return value === undefined || value === null;
}

function renderLoadingSpinner(size = '16px') {
    return `
        <span class="dashboard-loading-spinner" style="display: inline-block; width: ${size}; height: ${size}; vertical-align: middle; margin-left: 4px;">
            <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5"/>
            </svg>
        </span>
    `;
}

function renderSkeletonValue(width = '80px') {
    return `<div class="skeleton-loading" style="height: 24px; width: ${width}; display: inline-block; border-radius: 4px;"></div>`;
}

function monthKeyToDate(key) {
    if (!key || typeof key !== 'string') return null;
    const [year, month] = key.split('-').map(Number);
    if (!year || !month) return null;
    return new Date(year, month - 1, 1);
}

function buildLast12MonthSeries(financeEntries = []) {
    const sorted = [...financeEntries].sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    const map = new Map(sorted.map(entry => [entry.month, entry]));
    const reference = sorted.length ? monthKeyToDate(sorted[sorted.length - 1].month) : new Date();
    const months = [];
    for (let i = 11; i >= 0; i -= 1) {
        const date = new Date(reference.getFullYear(), reference.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        const entry = map.get(key) || { revenue: 0, profit: 0 };
        months.push({
            label: key,
            displayLabel: `${month}/${String(year).slice(-2)}`,
            revenue: Number(entry.revenue || 0),
            profit: Number(entry.profit || 0)
        });
    }
    return months;
}

function getMonthKeyFromDate(dateValue) {
    if (!dateValue || typeof dateValue !== 'string') return null;
    if (dateValue.length >= 7) {
        return dateValue.slice(0, 7);
    }
    return null;
}

function aggregateWalletRevenueByMonth() {
    const map = new Map();
    const txs = Array.isArray(window.demo?.walletTransactions) ? window.demo.walletTransactions : [];
    txs.forEach(tx => {
        if (!tx || tx.type !== 'topup') return; // Chỉ tính tiền nạp, không tính tiền ứng
        const month = getMonthKeyFromDate(tx.date);
        if (!month) return;
        const amount = Number(tx.amount) || 0;
        map.set(month, (map.get(month) || 0) + amount);
    });
    return map;
}

function aggregateTutorCostByMonth() {
    const map = new Map();
    const payroll = Array.isArray(window.demo?.payroll) ? window.demo.payroll : [];
    payroll.forEach(entry => {
        const month = entry?.month;
        if (!month) return;
        const amount = Number(entry.totalPay) || 0;
        map.set(month, (map.get(month) || 0) + amount);
    });
    return map;
}

function aggregateOtherCostByMonth() {
    const map = new Map();
    const costs = Array.isArray(window.demo?.costs) ? window.demo.costs : [];
    costs.forEach(cost => {
        const month = cost?.month || getMonthKeyFromDate(cost?.date);
        if (!month) return;
        const amount = Number(cost.amount) || 0;
        map.set(month, (map.get(month) || 0) + amount);
    });
    return map;
}

function buildMonthlyFinanceEntries() {
    const revenueMap = aggregateWalletRevenueByMonth();
    const tutorMap = aggregateTutorCostByMonth();
    const otherMap = aggregateOtherCostByMonth();
    const months = new Set([
        ...revenueMap.keys(),
        ...tutorMap.keys(),
        ...otherMap.keys()
    ]);
    const entries = Array.from(months).map(month => {
        const revenue = revenueMap.get(month) || 0;
        const tutorCost = tutorMap.get(month) || 0;
        const otherCost = otherMap.get(month) || 0;
        const profit = revenue - (tutorCost + otherCost);
        return { month, revenue, profit };
    });
    return { entries, revenueMap };
}

function collectYearFromString(set, value) {
    if (!value || typeof value !== 'string') return;
    const match = value.match(/^(\d{4})/);
    if (match) {
        set.add(match[1]);
    }
}

function getAvailableYearsForQuickView(sources = {}) {
    const years = new Set();
    const currentYear = new Date().getFullYear().toString();
    years.add(currentYear);

    (sources.walletTransactions || []).forEach(tx => collectYearFromString(years, tx.date));
    (sources.payroll || []).forEach(item => collectYearFromString(years, item.month));
    (sources.costs || []).forEach(item => collectYearFromString(years, item.month || item.date));
    (sources.sessions || []).forEach(item => collectYearFromString(years, item.date));
    (sources.studentClasses || []).forEach(item => collectYearFromString(years, item.startDate));

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

function buildAnnualQuickViewData(year, sources = {}) {
    const yearStr = String(year);
    const walletTx = (sources.walletTransactions || []).filter(tx => (tx.date || '').startsWith(yearStr));
    // Chỉ tính tiền nạp, không tính tiền ứng
    const revenueYear = walletTx
        .filter(tx => tx.type === 'topup')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const advanceCount = walletTx.filter(tx => tx.type === 'advance' || tx.type === 'loan').length;

    const payrollYear = (sources.payroll || []).filter(item => (item.month || '').startsWith(yearStr));
    const tutorCostYear = payrollYear.reduce((sum, entry) => sum + (Number(entry.totalPay) || 0), 0);

    const costsYear = (sources.costs || []).filter(item => {
        const marker = item.month || item.date || '';
        return marker && marker.startsWith(yearStr);
    });
    const otherCostYear = costsYear.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

    const netProfitYear = revenueYear - (tutorCostYear + otherCostYear);

    const sessionsYear = (sources.sessions || []).filter(session => (session.date || '').startsWith(yearStr));
    const classesOpened = new Set();
    const teachersInvolved = new Set();
    sessionsYear.forEach(session => {
        if (session.classId) classesOpened.add(session.classId);
        if (session.teacherId) teachersInvolved.add(session.teacherId);
    });

    const studentRegistrations = (sources.studentClasses || []).filter(record => (record.startDate || '').startsWith(yearStr));
    const avgSessionsPerStudent = studentRegistrations.length > 0
        ? (sessionsYear.length / studentRegistrations.length)
        : 0;

    return {
        finance: [
            { label: 'Tổng doanh thu', value: formatCurrencyVND(revenueYear), hint: `Năm ${yearStr}` },
            { label: 'Chi phí gia sư', value: formatCurrencyVND(tutorCostYear), hint: 'Payroll theo năm' },
            { label: 'Chi phí khác', value: formatCurrencyVND(otherCostYear), hint: 'Marketing, vận hành...' },
            { label: 'Lợi nhuận ròng', value: formatCurrencyVND(netProfitYear), hint: 'Doanh thu - Chi phí' }
        ],
        operations: [
            { label: 'Lớp đã mở', value: formatNumber(classesOpened.size), hint: `${formatNumber(sessionsYear.length)} buổi` },
            { label: 'Buổi đã dạy', value: formatNumber(sessionsYear.length), hint: `${formatNumber(teachersInvolved.size)} giáo viên` },
            { label: 'Giáo viên tham gia', value: formatNumber(teachersInvolved.size), hint: 'Có buổi trong năm' }
        ],
        students: [
            { label: 'Học sinh đăng ký', value: formatNumber(studentRegistrations.length), hint: `Năm ${yearStr}` },
            { label: 'Buổi học trung bình', value: avgSessionsPerStudent.toFixed(1), hint: 'Buổi/học sinh' },
            { label: 'Số lần ứng tiền', value: formatNumber(advanceCount), hint: 'Giao dịch ứng tiền' }
        ]
    };
}

function getDefaultPeriodValue(type) {
    const now = new Date();
    const year = now.getFullYear();
    const monthValue = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (type === 'year') return `${year}`;
    if (type === 'quarter') {
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        return `${year}-Q${quarter}`;
    }
    return monthValue;
}

function getDefaultDashboardState() {
    return {
        filterType: 'month',
        filterValues: {
            month: getDefaultPeriodValue('month'),
            quarter: getDefaultPeriodValue('quarter'),
            year: getDefaultPeriodValue('year')
        },
        quickView: 'finance',
        quickViewYear: new Date().getFullYear().toString(),
        chartPanelOpen: false
    };
}

function hydrateDashboardState(raw) {
    const defaults = getDefaultDashboardState();
    if (!raw || typeof raw !== 'object') {
        return defaults;
    }
    return {
        ...defaults,
        ...raw,
        filterValues: {
            ...defaults.filterValues,
            ...(raw.filterValues || {})
        },
        quickView: raw.quickView || defaults.quickView,
        quickViewYear: raw.quickViewYear || defaults.quickViewYear
    };
}

function loadStoredDashboardState() {
    try {
        const stored = localStorage.getItem(DASHBOARD_STATE_KEY);
        if (!stored) return getDefaultDashboardState();
        const parsed = JSON.parse(stored);
        return hydrateDashboardState(parsed);
    } catch (error) {
        console.warn('Failed to load dashboard state:', error);
        return getDefaultDashboardState();
    }
}

function persistDashboardState(state) {
    try {
        const payload = {
            filterType: state.filterType,
            filterValues: state.filterValues,
            quickView: state.quickView,
            quickViewYear: state.quickViewYear,
            chartPanelOpen: !!state.chartPanelOpen
        };
        localStorage.setItem(DASHBOARD_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to persist dashboard state:', error);
    }
}

function getDashboardState() {
    if (!window.__dashboardState) {
        window.__dashboardState = loadStoredDashboardState();
    }
    return window.__dashboardState;
}

function setDashboardState(patch = {}) {
    const current = getDashboardState();
    const next = {
        ...current,
        ...patch,
        filterValues: {
            ...current.filterValues,
            ...(patch.filterValues || {})
        },
        quickViewYear: patch.quickViewYear !== undefined ? patch.quickViewYear : current.quickViewYear,
        chartPanelOpen: typeof patch.chartPanelOpen === 'boolean'
            ? patch.chartPanelOpen
            : current.chartPanelOpen
    };
    window.__dashboardState = next;
    persistDashboardState(next);
    return next;
}

function getActiveFilterValue(state) {
    const current = state || getDashboardState();
    const type = current.filterType || 'month';
    const value = current.filterValues?.[type];
    return value || getDefaultPeriodValue(type);
}

function normalizeFilterValue(type, rawValue) {
    if (!rawValue) return getDefaultPeriodValue(type);
    if (type === 'month') {
        const matches = rawValue.match(/^(\d{4})-(\d{2})$/);
        if (matches) return rawValue;
        const date = new Date(rawValue);
        if (!Number.isNaN(date.getTime())) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        return getDefaultPeriodValue('month');
    }
    if (type === 'quarter') {
        const matches = rawValue.match(/^(\d{4})-Q([1-4])$/);
        if (matches) return rawValue;
        return getDefaultPeriodValue('quarter');
    }
    const year = String(rawValue).match(/^\d{4}$/) ? rawValue : getDefaultPeriodValue('year');
    return year;
}

function getFilterRange(state) {
    const current = state || getDashboardState();
    const type = current.filterType || 'month';
    const value = getActiveFilterValue(current);

    const buildRange = (start, end, label, shortLabel) => ({
        type,
        value,
        start,
        end,
        label,
        shortLabel
    });

    if (type === 'quarter') {
        const matches = value.match(/^(\d{4})-Q([1-4])$/);
        const year = matches ? Number(matches[1]) : new Date().getFullYear();
        const quarter = matches ? Number(matches[2]) : 1;
        const monthIndex = (quarter - 1) * 3;
        const start = new Date(year, monthIndex, 1);
        const end = new Date(year, monthIndex + 3, 0, 23, 59, 59, 999);
        return buildRange(start, end, `Quý ${quarter} • ${year}`, `Q${quarter}/${String(year).slice(-2)}`);
    }

    if (type === 'year') {
        const year = Number(value) || new Date().getFullYear();
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31, 23, 59, 59, 999);
        return buildRange(start, end, `Năm ${year}`, `${year}`);
    }

    const matches = value.match(/^(\d{4})-(\d{2})$/);
    const year = matches ? Number(matches[1]) : new Date().getFullYear();
    const month = matches ? Number(matches[2]) - 1 : new Date().getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return buildRange(
        start,
        end,
        `Tháng ${String(month + 1).padStart(2, '0')} • ${year}`,
        `T${String(month + 1).padStart(2, '0')}/${String(year).slice(-2)}`
    );
}

function isWithinRange(dateStr, range) {
    if (!dateStr || !range) return false;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    return date >= range.start && date <= range.end;
}

function generateQuarterOptions() {
    const now = new Date();
    const options = [];
    for (let year = now.getFullYear(); year >= now.getFullYear() - 2; year -= 1) {
        for (let quarter = 4; quarter >= 1; quarter -= 1) {
            options.push({
                value: `${year}-Q${quarter}`,
                label: `Quý ${quarter} • ${year}`
            });
        }
    }
    return options;
}

function generateYearOptions() {
    const now = new Date();
    const options = [];
    for (let year = now.getFullYear(); year >= now.getFullYear() - 5; year -= 1) {
        options.push({
            value: `${year}`,
            label: `Năm ${year}`
        });
    }
    return options;
}

function computeDashboardData(range) {
    const classes = Array.isArray(window.demo?.classes) ? window.demo.classes : [];
    const students = Array.isArray(window.demo?.students) ? window.demo.students : [];
    const teachers = Array.isArray(window.demo?.teachers) ? window.demo.teachers : [];
    const payments = Array.isArray(window.demo?.payments) ? window.demo.payments : [];
    const studentClasses = Array.isArray(window.demo?.studentClasses) ? window.demo.studentClasses : [];
    const sessions = Array.isArray(window.demo?.sessions) ? window.demo.sessions : [];
    const costs = Array.isArray(window.demo?.costs) ? window.demo.costs : [];
    const payroll = Array.isArray(window.demo?.payroll) ? window.demo.payroll : [];
    const walletTransactions = Array.isArray(window.demo?.walletTransactions) ? window.demo.walletTransactions : [];
    const lessonOutputs = Array.isArray(window.demo?.lessonOutputs) ? window.demo.lessonOutputs : [];
    const bonuses = Array.isArray(window.demo?.bonuses) ? window.demo.bonuses : [];

    const studentMap = new Map(students.map(student => [student.id, student]));
    const classMap = new Map(classes.map(cls => [cls.id, cls]));

    // Chờ thanh toán trợ cấp - Gia sư: Tổng số tiền trong các buổi dạy chưa thanh toán
    const pendingTeacherSessions = sessions
        .filter(session => (session.paymentStatus || 'unpaid') !== 'paid')
        .map(session => {
            const allowance = session.allowanceAmount ?? window.UniData?.computeSessionAllowance?.(session) ?? 0;
            return { ...session, allowance: Number(allowance) || 0 };
        });
    const pendingTeacherAllowance = pendingTeacherSessions.reduce((sum, session) => sum + session.allowance, 0);

    // Chờ thanh toán trợ cấp - Giáo án: Tổng số tiền trong các bài đã làm chưa thanh toán trợ cấp
    // Giả định mỗi lesson output có giá trị trợ cấp cố định (50,000 VND) hoặc có thể được lưu trong output.amount
    const DEFAULT_LESSON_OUTPUT_ALLOWANCE = 50000; // 50,000 VND mỗi bài
    const pendingLessonOutputs = lessonOutputs.filter(output => (output.status || 'unpaid') !== 'paid');
    const pendingLessonPlanAllowance = pendingLessonOutputs.reduce((sum, output) => {
        const amount = Number(output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
        return sum + amount;
    }, 0);

    // Chờ thanh toán trợ cấp - SALE&CSKH: Tổng số tiền chăm sóc học sinh chưa được thanh toán
    // Tính tổng lợi nhuận của các học sinh có trạng thái "Chờ thanh toán" cho tất cả CSKH staff
    // Sử dụng tháng/năm từ range được chọn
    const rangeMonth = range.start.getMonth() + 1;
    const rangeYear = range.start.getFullYear();
    let pendingCskhAllowance = 0;
    
    // Get all CSKH staff
    const cskhStaff = teachers.filter(t => {
        const roles = t.roles || [];
        return roles.includes('cskh_sale');
    });
    
    // Calculate unpaid profit for each CSKH staff
    cskhStaff.forEach(staff => {
        // Use the same logic as calculateCskhStats but only for unpaid
        const assignedStudents = students.filter(s => {
            if (s.cskhStaffId !== staff.id) return false;
            const studentClassRecords = studentClasses.filter(sc => sc.studentId === s.id);
            if (studentClassRecords.length === 0) return false;
            return true; // Simplified check - in production should use wasStudentAssignedInMonth
        });
        
        const defaultProfitPercent = parseFloat(localStorage.getItem(`cskh_default_profit_${staff.id}`) || '10');
        
        assignedStudents.forEach(student => {
            const monthStart = new Date(rangeYear, rangeMonth - 1, 1);
            const monthEnd = new Date(rangeYear, rangeMonth, 0, 23, 59, 59);
            
            const monthTopups = walletTransactions.filter(tx => {
                if (tx.studentId !== student.id) return false;
                if (tx.type !== 'topup') return false;
                if (!tx.date) return false;
                const txDate = new Date(tx.date);
                return txDate >= monthStart && txDate <= monthEnd;
            });
            
            const totalPaid = monthTopups.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
            const profitPercent = defaultProfitPercent; // Could be enhanced
            const profit = totalPaid * (profitPercent / 100);
            
            // Get payment status from localStorage
            const paymentStatusKey = `cskh_payment_${staff.id}_${student.id}_${rangeYear}-${String(rangeMonth).padStart(2, '0')}`;
            const paymentStatus = localStorage.getItem(paymentStatusKey) || 'unpaid';
            
            if (paymentStatus === 'unpaid') {
                pendingCskhAllowance += profit;
            }
        });
    });
    
    // Chờ thanh toán trợ cấp - Thưởng: Tổng số tiền thưởng chưa thanh toán
    const pendingBonusAllowance = bonuses
        .filter(bonus => (bonus.status || 'unpaid') === 'unpaid')
        .reduce((sum, bonus) => sum + (Number(bonus.amount) || 0), 0);
    
    // Tổng chờ thanh toán trợ cấp
    const totalPendingAllowance = pendingTeacherAllowance + pendingLessonPlanAllowance + pendingCskhAllowance + pendingBonusAllowance;

    // Doanh thu: Tổng số tiền học sinh nạp vào tài khoản trong tháng (không tính tiền ứng)
    const totalRevenue = walletTransactions
        .filter(tx => tx.type === 'topup' && isWithinRange(tx.date, range))
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Chưa thu: Tổng số nợ học phí hiện tại của các học sinh
    // Logic đơn giản: Tổng loanBalance của tất cả học sinh đang tồn tại trong hệ thống
    // - Không cần quan tâm active/inactive, chỉ cần học sinh tồn tại
    // - loanBalance: Số tiền nợ hiện tại của học sinh
    const outstandingTuition = students.reduce((sum, student) => {
        const loanBalance = Math.max(0, Number(student.loanBalance || 0));
        return sum + loanBalance;
    }, 0);

    const uncollected = outstandingTuition;

    // Chi phí Nhân sự: Tổng tháng của tất cả nhân sự
    // = Tổng số tiền trợ cấp trong tháng cho tất cả nhân sự (không phân biệt đã thanh toán hay chưa)
    
    // - Gia sư: Tổng số tiền của tất cả các buổi dạy trong tháng
    const sessionsInRange = sessions.filter(session => {
        return isWithinRange(session.date, range);
    });
    const tutorCost = sessionsInRange.reduce((sum, session) => {
        const allowance = session.allowanceAmount ?? window.UniData?.computeSessionAllowance?.(session) ?? 0;
        return sum + (Number(allowance) || 0);
    }, 0);
    
    // - Giáo án: Tổng số tiền của tất cả các bài đã làm trong tháng
    const lessonOutputsInRange = lessonOutputs.filter(output => {
        // Check if output date is within range
        if (output.date) {
            return isWithinRange(output.date, range);
        }
        // If no date, include it (legacy data) - but only if we're looking at current month
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const rangeMonthKey = `${rangeYear}-${String(rangeMonth).padStart(2, '0')}`;
        return currentMonthKey === rangeMonthKey;
    });
    const lessonPlanCost = lessonOutputsInRange.reduce((sum, output) => {
        const amount = Number(output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
        return sum + amount;
    }, 0);
    
    // - SALE&CSKH: Tổng lợi nhuận của tất cả học sinh trong tháng (không phân biệt trạng thái thanh toán)
    let cskhCost = 0;
    cskhStaff.forEach(staff => {
        const assignedStudents = students.filter(s => {
            if (s.cskhStaffId !== staff.id) return false;
            const studentClassRecords = studentClasses.filter(sc => sc.studentId === s.id);
            if (studentClassRecords.length === 0) return false;
            return true;
        });
        
        const defaultProfitPercent = parseFloat(localStorage.getItem(`cskh_default_profit_${staff.id}`) || '10');
        
        assignedStudents.forEach(student => {
            const monthStart = new Date(rangeYear, rangeMonth - 1, 1);
            const monthEnd = new Date(rangeYear, rangeMonth, 0, 23, 59, 59);
            
            const monthTopups = walletTransactions.filter(tx => {
                if (tx.studentId !== student.id) return false;
                if (tx.type !== 'topup') return false;
                if (!tx.date) return false;
                const txDate = new Date(tx.date);
                return txDate >= monthStart && txDate <= monthEnd;
            });
            
            const totalPaid = monthTopups.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
            const profitPercent = defaultProfitPercent;
            const profit = totalPaid * (profitPercent / 100);
            
            // Tính tổng lợi nhuận trong tháng, không phân biệt trạng thái thanh toán
            cskhCost += profit;
        });
    });
    
    // - Thưởng: Tổng số tiền thưởng trong tháng (tất cả thưởng có createdAt trong range)
    const bonusesInRange = bonuses.filter(bonus => {
        if (!bonus.createdAt) return false;
        return isWithinRange(bonus.createdAt, range);
    });
    const bonusCost = bonusesInRange.reduce((sum, bonus) => sum + (Number(bonus.amount) || 0), 0);
    
    // Tổng chi phí nhân sự = Tổng tháng của tất cả nhân sự
    const totalStaffCost = tutorCost + lessonPlanCost + cskhCost + bonusCost;

    // Chi phí Khác: Tổng chi phí khác bên trang Chi phí
    const otherCosts = costs
        .filter(cost => {
            const reference = cost.date || (cost.month ? `${cost.month}-01` : null);
            return isWithinRange(reference, range);
        })
        .reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);

    // Lợi nhuận ròng: Doanh Thu - (Chi phí Nhân sự + Chi phí Khác)
    const netProfit = totalRevenue - (totalStaffCost + otherCosts);

    const summary = {
        totalClasses: classes.length,
        activeClasses: classes.filter(cls => cls.status === 'running').length,
        totalStudents: students.length,
        activeStudents: students.filter(student => (student.status || 'active') === 'active').length,
        totalTeachers: teachers.length,
        revenue: totalRevenue,
        uncollected
    };

    const { entries: monthlyFinanceEntries } = buildMonthlyFinanceEntries();
    const monthlyFinance = buildLast12MonthSeries(monthlyFinanceEntries);
    const charts = {
        revenueProfitLine: monthlyFinance
    };

    const costCategories = costs
        .filter(cost => {
            const reference = cost.date || (cost.month ? `${cost.month}-01` : null);
            return isWithinRange(reference, range);
        })
        .map(cost => cost.category || 'Khác');
    const uniqueCategories = Array.from(new Set(costCategories)).slice(0, 3).join(', ');

    const financeReport = {
        rows: [
            {
                key: 'revenue',
                label: 'Doanh Thu',
                amount: totalRevenue,
                note: 'Tổng doanh thu đã thu'
            },
            {
                key: 'pending',
                label: 'Chưa Thu',
                amount: uncollected,
                note: 'Tổng số tiền học phí chưa thu'
            },
            {
                key: 'pendingAllowances',
                label: 'Chờ Thanh Toán Trợ Cấp',
                amount: totalPendingAllowance,
                breakdown: {
                    teacher: pendingTeacherAllowance,
                    lessonPlan: pendingLessonPlanAllowance,
                    cskh: pendingCskhAllowance,
                    bonus: pendingBonusAllowance
                }
            },
            {
                key: 'staffCost',
                label: 'Chi phí Nhân Sự',
                amount: totalStaffCost,
                note: 'Tổng tháng của tất cả nhân sự',
                breakdown: {
                    teacher: tutorCost,
                    lessonPlan: lessonPlanCost,
                    cskh: cskhCost,
                    bonus: bonusCost
                }
            },
            {
                key: 'otherCost',
                label: 'Chi phí Khác',
                amount: otherCosts,
                note: uniqueCategories || 'Chưa phát sinh'
            },
            {
                key: 'netProfit',
                label: 'Lợi nhuận ròng',
                amount: netProfit,
                note: 'Doanh Thu - (Chi phí Nhân sự + Chi phí Khác)'
            }
        ]
    };

    const expiringStudents = studentClasses
        .filter(record => (record.status || 'active') !== 'inactive')
        .filter(record => (record.remainingSessions || 0) <= 0)
        .map(record => ({
            id: record.id,
            studentId: record.studentId,
            studentName: studentMap.get(record.studentId)?.fullName || studentMap.get(record.studentId)?.name || record.studentId,
            className: classMap.get(record.classId)?.name || record.classId,
            remaining: record.remainingSessions || 0
        }));

    // Chờ thanh toán trợ cấp - Tổng hợp tất cả nhân sự
    const pendingStaffPayouts = [];
    
    // 1. Gia sư chờ thanh toán
    const pendingTeacherMap = new Map();
    pendingTeacherSessions.forEach(session => {
        const teacherId = session.teacherId || (classMap.get(session.classId)?.teacherIds || [])[0] || null;
        const teacher = teacherId ? teachers.find(t => t.id === teacherId) : null;
        const key = teacherId || session.classId || session.id;
        if (!pendingTeacherMap.has(key)) {
            pendingTeacherMap.set(key, {
                staffId: teacherId,
                staffName: teacher?.fullName || teacher?.name || 'Chưa xác định',
                workType: 'Gia sư',
                totalAllowance: 0,
                sessions: [],
                classNames: new Set()
            });
        }
        const entry = pendingTeacherMap.get(key);
        entry.totalAllowance += session.allowance;
        entry.sessions.push(session);
        const clsName = classMap.get(session.classId)?.name || session.classId || 'Lớp chưa rõ';
        entry.classNames.add(clsName);
    });
    Array.from(pendingTeacherMap.values()).forEach(item => {
        if (item.totalAllowance > 0) {
            pendingStaffPayouts.push({
                staffId: item.staffId,
                staffName: item.staffName,
                workType: 'Gia sư',
                totalAllowance: item.totalAllowance,
                detail: `${item.sessions.length} buổi dạy`
            });
        }
    });
    
    // 2. Giáo án chờ thanh toán
    const pendingLessonPlanMap = new Map();
    pendingLessonOutputs.forEach(output => {
        const staffId = output.staffId || output.teacherId || null;
        const staff = staffId ? teachers.find(t => t.id === staffId) : null;
        const key = staffId || output.id;
        if (!pendingLessonPlanMap.has(key)) {
            pendingLessonPlanMap.set(key, {
                staffId: staffId,
                staffName: staff?.fullName || staff?.name || 'Chưa xác định',
                workType: 'Giáo án',
                totalAllowance: 0,
                outputCount: 0
            });
        }
        const entry = pendingLessonPlanMap.get(key);
        const amount = Number(output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
        entry.totalAllowance += amount;
        entry.outputCount += 1;
    });
    Array.from(pendingLessonPlanMap.values()).forEach(item => {
        if (item.totalAllowance > 0) {
            pendingStaffPayouts.push({
                staffId: item.staffId,
                staffName: item.staffName,
                workType: 'Giáo án',
                totalAllowance: item.totalAllowance,
                detail: `${item.outputCount} bài đã làm`
            });
        }
    });
    
    // 3. SALE&CSKH chờ thanh toán
    cskhStaff.forEach(staff => {
        let staffPendingAmount = 0;
        const assignedStudents = students.filter(s => {
            if (s.cskhStaffId !== staff.id) return false;
            const studentClassRecords = studentClasses.filter(sc => sc.studentId === s.id);
            if (studentClassRecords.length === 0) return false;
            return true;
        });
        
        const defaultProfitPercent = parseFloat(localStorage.getItem(`cskh_default_profit_${staff.id}`) || '10');
        
        assignedStudents.forEach(student => {
            const monthStart = new Date(rangeYear, rangeMonth - 1, 1);
            const monthEnd = new Date(rangeYear, rangeMonth, 0, 23, 59, 59);
            
            const monthTopups = walletTransactions.filter(tx => {
                if (tx.studentId !== student.id) return false;
                if (tx.type !== 'topup') return false;
                if (!tx.date) return false;
                const txDate = new Date(tx.date);
                return txDate >= monthStart && txDate <= monthEnd;
            });
            
            const totalPaid = monthTopups.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
            const profitPercent = defaultProfitPercent;
            const profit = totalPaid * (profitPercent / 100);
            
            const paymentStatusKey = `cskh_payment_${staff.id}_${student.id}_${rangeYear}-${String(rangeMonth).padStart(2, '0')}`;
            const paymentStatus = localStorage.getItem(paymentStatusKey) || 'unpaid';
            
            if (paymentStatus === 'unpaid') {
                staffPendingAmount += profit;
            }
        });
        
        if (staffPendingAmount > 0) {
            pendingStaffPayouts.push({
                staffId: staff.id,
                staffName: staff.fullName || staff.name || 'Chưa xác định',
                workType: 'SALE&CSKH',
                totalAllowance: staffPendingAmount,
                detail: `${assignedStudents.length} học sinh`
            });
        }
    });
    
    // 4. Thưởng chờ thanh toán
    const pendingBonusMap = new Map();
    bonuses
        .filter(bonus => (bonus.status || 'unpaid') === 'unpaid')
        .forEach(bonus => {
            const staffId = bonus.staffId;
            const staff = staffId ? teachers.find(t => t.id === staffId) : null;
            const key = staffId || bonus.id;
            if (!pendingBonusMap.has(key)) {
                pendingBonusMap.set(key, {
                    staffId: staffId,
                    staffName: staff?.fullName || staff?.name || 'Chưa xác định',
                    workType: 'Thưởng',
                    totalAllowance: 0,
                    bonusCount: 0
                });
            }
            const entry = pendingBonusMap.get(key);
            entry.totalAllowance += Number(bonus.amount || 0);
            entry.bonusCount += 1;
        });
    Array.from(pendingBonusMap.values()).forEach(item => {
        if (item.totalAllowance > 0) {
            pendingStaffPayouts.push({
                staffId: item.staffId,
                staffName: item.staffName,
                workType: 'Thưởng',
                totalAllowance: item.totalAllowance,
                detail: `${item.bonusCount} thưởng`
            });
        }
    });
    
    // Sắp xếp theo số tiền giảm dần
    pendingStaffPayouts.sort((a, b) => b.totalAllowance - a.totalAllowance);

    const classesWithoutTeacher = classes
        .filter(cls => {
            const ids = Array.isArray(cls.teacherIds) ? cls.teacherIds.filter(Boolean) : [];
            return ids.length === 0;
        }).map(cls => ({
            id: cls.id,
            name: cls.name || cls.id
        }));

    const sessionsPendingPayment = sessions
        .filter(session => (session.paymentStatus || 'unpaid') !== 'paid')
        .map(session => {
            const allowance = session.allowanceAmount ?? window.UniData?.computeSessionAllowance?.(session) ?? 0;
            return {
                id: session.id,
                className: classMap.get(session.classId)?.name || session.classId,
                date: session.date,
                status: session.paymentStatus || 'unpaid',
                allowance
            };
        });

    const loanRequests = students
        .filter(student => Number(student.loanBalance || 0) > 0)
        .map(student => ({
            name: student.fullName || student.name || student.id,
            amount: Number(student.loanBalance || 0)
        }));

    const refundRequests = payments.filter(payment => payment.status === 'refund');

    const alerts = {
        studentsNeedRenewal: expiringStudents,
        pendingStaffPayouts: pendingStaffPayouts,
        classesWithoutTeacher,
        financeRequests: {
            loans: loanRequests,
            refunds: refundRequests
        }
    };

    const exportRows = [
        { Metric: 'Tổng lớp học', Value: summary.totalClasses, 'Ghi chú': `${summary.activeClasses} đang hoạt động` },
        { Metric: 'Học sinh', Value: summary.totalStudents, 'Ghi chú': `${summary.activeStudents} đang học` },
        { Metric: 'Giáo viên', Value: summary.totalTeachers, 'Ghi chú': 'Đã liên kết tài khoản' },
        { Metric: `Doanh thu (${range.label})`, Value: formatCurrencyVND(totalRevenue), 'Ghi chú': 'Tổng doanh thu đã thu' },
        { Metric: 'Chưa thu', Value: formatCurrencyVND(uncollected), 'Ghi chú': 'Tổng số tiền học phí chưa thu' },
        { Metric: 'Chờ thanh toán trợ cấp - Gia sư', Value: formatCurrencyVND(pendingTeacherAllowance), 'Ghi chú': 'Tổng số tiền trong các buổi dạy chưa thanh toán' },
        { Metric: 'Chờ thanh toán trợ cấp - Giáo án', Value: formatCurrencyVND(pendingLessonPlanAllowance), 'Ghi chú': 'Tổng số tiền trong các bài đã làm chưa thanh toán trợ cấp' },
        { Metric: 'Chờ thanh toán trợ cấp - SALE&CSKH', Value: formatCurrencyVND(pendingCskhAllowance), 'Ghi chú': 'Tổng số tiền chăm sóc học sinh chưa được thanh toán' },
        { Metric: 'Chờ thanh toán trợ cấp - Thưởng', Value: formatCurrencyVND(pendingBonusAllowance), 'Ghi chú': 'Tổng số tiền thưởng chưa thanh toán' },
        { Metric: 'Chi phí Nhân sự', Value: formatCurrencyVND(totalStaffCost), 'Ghi chú': `Gia sư: ${formatCurrencyVND(tutorCost)} • Giáo án: ${formatCurrencyVND(lessonPlanCost)} • SALE&CSKH: ${formatCurrencyVND(cskhCost)} • Thưởng: ${formatCurrencyVND(bonusCost)}` },
        { Metric: 'Chi phí Khác', Value: formatCurrencyVND(otherCosts), 'Ghi chú': uniqueCategories || 'Chưa phát sinh' },
        { Metric: 'Lợi nhuận ròng', Value: formatCurrencyVND(netProfit), 'Ghi chú': 'Doanh Thu - (Chi phí Nhân sự + Chi phí Khác)' }
    ];

    return {
        summary,
        charts,
        financeReport,
        alerts,
        exportRows,
        annualSources: {
            walletTransactions,
            payroll,
            costs,
            sessions,
            studentClasses,
            classes,
            students
        }
    };
}

function renderFilterValueControl(state) {
    const type = state.filterType || 'month';
    const value = getActiveFilterValue(state);
    if (type === 'quarter') {
        const options = generateQuarterOptions();
        return `
            <label for="dashboardFilterValue">Chọn quý</label>
            <select id="dashboardFilterValue" class="form-control">
                ${options.map(opt => `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
        `;
    }
    if (type === 'year') {
        const options = generateYearOptions();
        return `
            <label for="dashboardFilterValue">Chọn năm</label>
            <select id="dashboardFilterValue" class="form-control">
                ${options.map(opt => `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`).join('')}
            </select>
        `;
    }
    return `
        <label for="dashboardFilterValue">Chọn tháng</label>
        <input type="month" id="dashboardFilterValue" class="form-control" value="${value}" max="${getDefaultPeriodValue('month')}">
    `;
}

function renderFilterBar(state, range) {
    return `
        <div class="card dashboard-filter-bar">
            <div class="filter-group">
                <label for="dashboardFilterType">Bộ lọc theo thời gian</label>
                <select id="dashboardFilterType" class="form-control">
                    <option value="month" ${state.filterType === 'month' ? 'selected' : ''}>Theo tháng</option>
                    <option value="quarter" ${state.filterType === 'quarter' ? 'selected' : ''}>Theo quý</option>
                    <option value="year" ${state.filterType === 'year' ? 'selected' : ''}>Theo năm</option>
                </select>
            </div>
            <div class="filter-group" id="dashboardFilterValueContainer">
                ${renderFilterValueControl(state)}
            </div>
            <div class="filter-actions">
                <button class="btn btn-outline" data-export="pdf">Xuất PDF</button>
                <button class="btn btn-primary" data-export="excel">Xuất Excel</button>
            </div>
        </div>
        <div class="text-muted text-sm">Đang xem: ${range.label}</div>
    `;
}

function renderSummaryCards(summary, range, isLoading = false) {
    const isGlobalLoading = isLoading && isDataLoading();
    const showClassesLoading = shouldShowLoading(summary.totalClasses, isGlobalLoading);
    const showStudentsLoading = shouldShowLoading(summary.totalStudents, isGlobalLoading);
    const showTeachersLoading = shouldShowLoading(summary.totalTeachers, isGlobalLoading);
    const showRevenueLoading = shouldShowLoading(summary.revenue, isGlobalLoading);
    const showUncollectedLoading = shouldShowLoading(summary.uncollected, isGlobalLoading);
    
    return `
        <div class="dashboard-stats">
            <div class="stat-card">
                <h3>Lớp học</h3>
                <div class="value">
                    ${showClassesLoading ? renderSkeletonValue('60px') : formatNumber(summary.totalClasses)}
                    ${showClassesLoading ? renderLoadingSpinner('14px') : ''}
                </div>
                <div class="text-muted text-sm">
                    ${showClassesLoading ? renderSkeletonValue('100px') : `${summary.activeClasses} đang hoạt động`}
                </div>
            </div>
            <div class="stat-card">
                <h3>Học sinh</h3>
                <div class="value">
                    ${showStudentsLoading ? renderSkeletonValue('60px') : formatNumber(summary.totalStudents)}
                    ${showStudentsLoading ? renderLoadingSpinner('14px') : ''}
                </div>
                <div class="text-muted text-sm">
                    ${showStudentsLoading ? renderSkeletonValue('100px') : `${summary.activeStudents} đang học`}
                </div>
            </div>
            <div class="stat-card">
                <h3>Giáo viên</h3>
                <div class="value">
                    ${showTeachersLoading ? renderSkeletonValue('60px') : formatNumber(summary.totalTeachers)}
                    ${showTeachersLoading ? renderLoadingSpinner('14px') : ''}
                </div>
                <div class="text-muted text-sm">
                    ${showTeachersLoading ? renderSkeletonValue('100px') : 'Đang hợp tác'}
                </div>
            </div>
            <div class="stat-card">
                <h3>Doanh thu (${range.shortLabel})</h3>
                <div class="value">
                    ${showRevenueLoading ? renderSkeletonValue('120px') : formatCurrencyVND(summary.revenue)}
                    ${showRevenueLoading ? renderLoadingSpinner('14px') : ''}
                </div>
                <div class="text-muted text-sm">
                    ${showRevenueLoading ? renderSkeletonValue('200px') : 'Tổng tiền học sinh nạp vào tài khoản trong tháng'}
                </div>
            </div>
            <div class="stat-card">
                <h3>Chưa thu</h3>
                <div class="value">
                    ${showUncollectedLoading ? renderSkeletonValue('120px') : formatCurrencyVND(summary.uncollected)}
                    ${showUncollectedLoading ? renderLoadingSpinner('14px') : ''}
                </div>
                <div class="text-muted text-sm">
                    ${showUncollectedLoading ? renderSkeletonValue('200px') : 'Tổng số tiền đang nợ hiện tại của học sinh'}
                </div>
            </div>
        </div>
    `;
}

function renderChartPanelSection(state, charts) {
    if (!charts?.revenueProfitLine?.length) {
        return '';
    }
    const isOpen = !!state.chartPanelOpen;
    return `
        <div class="dashboard-chart-toggle">
            <button class="btn btn-outline" data-chart-panel-toggle>
                ${isOpen ? 'Ẩn biểu đồ' : 'Xem biểu đồ'}
            </button>
        </div>
        <div class="chart-panel-overlay ${isOpen ? 'visible' : ''}" data-chart-panel-overlay></div>
        <aside class="chart-panel ${isOpen ? 'open' : ''}" data-chart-panel>
            <div class="chart-panel-header">
                <h4>Doanh thu & Lợi nhuận theo tháng</h4>
                <button class="btn btn-icon btn-panel-close" data-chart-panel-close aria-label="Đóng popup">
                    ✕
                </button>
            </div>
            <div class="chart-panel-body">
                ${renderDualLineChart(charts.revenueProfitLine)}
            </div>
        </aside>
    `;
}

function renderFinanceReportSection(financeReport, range, isLoading = false) {
    const isGlobalLoading = isLoading && isDataLoading();
    
    // Chỉ hiển thị skeleton table khi không có data VÀ đang loading
    if (isGlobalLoading && (!financeReport || !financeReport.rows || !financeReport.rows.length)) {
        return `
        <div class="card dashboard-finance" style="margin-bottom: var(--spacing-4);">
            <div class="dashboard-section-title" style="font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--spacing-4); padding-bottom: var(--spacing-2); border-bottom: 2px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>
                </svg>
                <span>Báo cáo tài chính (${range.label})</span>
                ${renderLoadingSpinner('16px')}
            </div>
            <div class="table-container" style="overflow-x: auto;">
                <table class="finance-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);">
                            <th style="padding: var(--spacing-3); text-align: left; font-weight: 600; border-bottom: 2px solid var(--border);">Danh mục</th>
                            <th style="padding: var(--spacing-3); text-align: right; font-weight: 600; border-bottom: 2px solid var(--border);">Giá trị</th>
                            <th style="padding: var(--spacing-3); text-align: left; font-weight: 600; border-bottom: 2px solid var(--border);">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from({ length: 6 }).map(() => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: var(--spacing-3);">
                                <div class="skeleton-loading" style="height: 16px; width: 150px; border-radius: 4px;"></div>
                            </td>
                            <td style="padding: var(--spacing-3); text-align: right;">
                                <div class="skeleton-loading" style="height: 16px; width: 100px; margin-left: auto; border-radius: 4px;"></div>
                            </td>
                            <td style="padding: var(--spacing-3);">
                                <div class="skeleton-loading" style="height: 16px; width: 200px; border-radius: 4px;"></div>
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    }
    
    if (!financeReport || !financeReport.rows || !financeReport.rows.length) {
        return '';
    }
    
    return `
        <div class="card dashboard-finance" style="margin-bottom: var(--spacing-4);">
            <div class="dashboard-section-title" style="font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--spacing-4); padding-bottom: var(--spacing-2); border-bottom: 2px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"></path>
                </svg>
                <span>Báo cáo tài chính (${range.label})</span>
            </div>
            <div class="table-container" style="overflow-x: auto;">
                <table class="finance-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);">
                            <th style="padding: var(--spacing-3); text-align: left; font-weight: 600; border-bottom: 2px solid var(--border);">Danh mục</th>
                            <th style="padding: var(--spacing-3); text-align: right; font-weight: 600; border-bottom: 2px solid var(--border);">Giá trị</th>
                            <th style="padding: var(--spacing-3); text-align: left; font-weight: 600; border-bottom: 2px solid var(--border);">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                    ${financeReport.rows.map((row, index) => {
                        const isHeader = row.key === 'pendingAllowances' || row.key === 'staffCost';
                        const rowStyle = isHeader ? 'background: var(--bg-secondary); font-weight: 600;' : '';
                        const cellStyle = isHeader ? 'padding: var(--spacing-3) var(--spacing-4);' : 'padding: var(--spacing-3);';
                        
                        // Kiểm tra từng giá trị cụ thể xem có cần loading không
                        const showRowLoading = shouldShowLoading(row.amount, isGlobalLoading);
                        
                        let breakdownHtml = '';
                        if (row.breakdown) {
                            const breakdownItems = [];
                            if (row.breakdown.teacher !== undefined) {
                                const showTeacherLoading = shouldShowLoading(row.breakdown.teacher, isGlobalLoading);
                                breakdownItems.push(`<span>Gia sư: <strong style="color: var(--text);">${showTeacherLoading ? renderSkeletonValue('80px') : formatCurrencyVND(row.breakdown.teacher || 0)}</strong>${showTeacherLoading ? renderLoadingSpinner('12px') : ''}</span>`);
                            }
                            if (row.breakdown.lessonPlan !== undefined) {
                                const showLessonPlanLoading = shouldShowLoading(row.breakdown.lessonPlan, isGlobalLoading);
                                breakdownItems.push(`<span>Giáo án: <strong style="color: var(--text);">${showLessonPlanLoading ? renderSkeletonValue('80px') : formatCurrencyVND(row.breakdown.lessonPlan || 0)}</strong>${showLessonPlanLoading ? renderLoadingSpinner('12px') : ''}</span>`);
                            }
                            if (row.breakdown.cskh !== undefined) {
                                const showCskhLoading = shouldShowLoading(row.breakdown.cskh, isGlobalLoading);
                                breakdownItems.push(`<span>SALE&CSKH: <strong style="color: var(--text);">${showCskhLoading ? renderSkeletonValue('80px') : formatCurrencyVND(row.breakdown.cskh || 0)}</strong>${showCskhLoading ? renderLoadingSpinner('12px') : ''}</span>`);
                            }
                            if (row.breakdown.bonus !== undefined) {
                                const showBonusLoading = shouldShowLoading(row.breakdown.bonus, isGlobalLoading);
                                breakdownItems.push(`<span>Thưởng: <strong style="color: var(--text);">${showBonusLoading ? renderSkeletonValue('80px') : formatCurrencyVND(row.breakdown.bonus || 0)}</strong>${showBonusLoading ? renderLoadingSpinner('12px') : ''}</span>`);
                            }
                            
                            breakdownHtml = `
                                <div style="margin-top: var(--spacing-2); font-size: var(--font-size-sm); color: var(--text-muted);">
                                    <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-3); align-items: center;">
                                        ${breakdownItems.map((item, idx) => idx > 0 ? `<span style="color: var(--text-muted);">•</span> ${item}` : item).join('')}
                                    </div>
                                </div>
                            `;
                        }
                        
                        // Chỉ hiển thị breakdown, không hiển thị note nếu có breakdown
                        const noteText = row.breakdown ? '' : (row.note || '');
                        
                        return `
                        <tr style="${rowStyle} ${index < financeReport.rows.length - 1 ? 'border-bottom: 1px solid var(--border);' : ''}">
                            <td style="${cellStyle} vertical-align: top;">
                                <div style="font-weight: ${isHeader ? '600' : '500'}; color: var(--text);">${row.label}</div>
                            </td>
                            <td style="${cellStyle} text-align: right; vertical-align: top;">
                                <div style="font-weight: ${isHeader ? '600' : '500'}; color: var(--text); display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                                    ${showRowLoading ? renderSkeletonValue('120px') : formatCurrencyVND(row.amount)}
                                    ${showRowLoading ? renderLoadingSpinner('14px') : ''}
                                </div>
                            </td>
                            <td style="${cellStyle} vertical-align: top;">
                                ${noteText ? `<div style="color: var(--text-muted); font-size: var(--font-size-sm); line-height: 1.5;">${noteText}</div>` : ''}
                                ${breakdownHtml}
                            </td>
                        </tr>
                    `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderAlertsSection(alerts) {
    if (!alerts) return '';
    const {
        studentsNeedRenewal = [],
        pendingStaffPayouts = [],
        classesWithoutTeacher = [],
        financeRequests = { loans: [], refunds: [] }
    } = alerts;

    const studentList = studentsNeedRenewal.length
        ? studentsNeedRenewal.map(item => `
            <li style="padding: var(--spacing-2); border-bottom: 1px solid var(--border); transition: background 0.2s ease;">
                <button class="alert-link" data-action="open-student" data-id="${item.studentId}" style="background: none; border: none; color: var(--primary); cursor: pointer; font-weight: 500; text-align: left; padding: 0; margin: 0;">
                    ${item.studentName}
                </button>
                <span class="alert-meta" style="display: block; margin-top: var(--spacing-1); color: var(--text-muted); font-size: var(--font-size-sm);">• ${item.className}</span>
            </li>
        `).join('')
        : '<li class="text-muted" style="padding: var(--spacing-3); text-align: center;">Không có học sinh cần gia hạn</li>';

    const staffList = pendingStaffPayouts.length
        ? pendingStaffPayouts.map(item => `
            <li style="padding: var(--spacing-2); border-bottom: 1px solid var(--border); transition: background 0.2s ease;">
                <button class="alert-link" data-action="open-staff" data-id="${item.staffId || ''}" style="background: none; border: none; color: var(--primary); cursor: pointer; font-weight: 500; text-align: left; padding: 0; margin: 0; font-size: 12px; line-height: 1.4;">
                    ${item.staffName}
                </button>
                <div class="alert-meta" style="display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                    <span class="badge" style="background: rgba(168, 85, 247, 0.1); color: #6b21a8; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 10px; padding: 1px 6px; border-radius: var(--radius);">${item.workType}</span>
                    <span style="color: var(--text-muted); font-size: 11px; line-height: 1.3;">${item.detail}</span>
                    <span style="color: var(--danger); font-weight: 600; font-size: 11px; line-height: 1.3;">${formatCurrencyVND(item.totalAllowance)}</span>
                </div>
            </li>
        `).join('')
        : '<li class="text-muted" style="padding: var(--spacing-2); text-align: center; font-size: 12px;">Không có trợ cấp nào đang chờ thanh toán</li>';

    const classList = classesWithoutTeacher.length
        ? classesWithoutTeacher.map(cls => `
            <li style="padding: var(--spacing-2); border-bottom: 1px solid var(--border); transition: background 0.2s ease;">
                <button class="alert-link" data-action="open-class" data-id="${cls.id}" style="background: none; border: none; color: var(--primary); cursor: pointer; font-weight: 500; text-align: left; padding: 0; margin: 0; font-size: 12px; line-height: 1.4;">
                    ${cls.name}
                </button>
            </li>
        `).join('')
        : '<li class="text-muted" style="padding: var(--spacing-2); text-align: center; font-size: 12px;">Không có lớp nào</li>';

    const financeList = (() => {
        const loanItems = (financeRequests.loans || []).map(entry => `
            <li style="padding: var(--spacing-2); border-bottom: 1px solid var(--border); font-size: 12px; line-height: 1.4;">Ứng tiền • ${entry.name} – ${formatCurrencyVND(entry.amount)}</li>
        `);
        const refundItems = (financeRequests.refunds || []).map(entry => `
            <li style="padding: var(--spacing-2); border-bottom: 1px solid var(--border); font-size: 12px; line-height: 1.4;">Hoàn tiền • ${(entry.studentId || entry.id)} – ${formatCurrencyVND(entry.amount || 0)}</li>
        `);
        const all = [...loanItems, ...refundItems];
        return all.length ? all.join('') : '<li class="text-muted" style="padding: var(--spacing-2); text-align: center; font-size: 12px;">Chưa có yêu cầu mới</li>';
    })();

    return `
        <div class="card dashboard-alerts-card" style="margin-bottom: var(--spacing-4);">
            <div class="dashboard-section-title" style="font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--spacing-4); padding-bottom: var(--spacing-2); border-bottom: 2px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Cảnh báo & hành động</span>
            </div>
            <div class="dashboard-alerts" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-3); overflow-x: auto;">
                <div class="alert-widget" data-widget="students" style="border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; background: var(--bg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); min-width: 0;">
                    <div class="alert-header" style="display: flex; align-items: center; padding: var(--spacing-2) var(--spacing-3); background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%); border-bottom: 2px solid rgba(251, 191, 36, 0.3); gap: var(--spacing-2); min-height: 48px; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius); background: rgba(251, 191, 36, 0.2); flex-shrink: 0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #f59e0b;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                            <span style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Học sinh cần gia hạn</span>
                            <span class="badge badge-warning" style="font-size: 9px; padding: 1px 5px; border-radius: var(--radius-full); width: fit-content; background: rgba(251, 191, 36, 0.2); color: #92400e;">${studentsNeedRenewal.length} mục</span>
                        </div>
                    </div>
                    <div class="alert-body" style="flex: 1; overflow-y: auto; background: var(--bg); min-height: 0;">
                        <ul class="alert-list" style="list-style: none; margin: 0; padding: 0;">${studentList}</ul>
                    </div>
                </div>

                <div class="alert-widget" data-widget="staff" style="border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; background: var(--bg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); min-width: 0;">
                    <div class="alert-header" style="display: flex; align-items: center; padding: var(--spacing-2) var(--spacing-3); background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%); border-bottom: 2px solid rgba(168, 85, 247, 0.3); gap: var(--spacing-2); min-height: 48px; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius); background: rgba(168, 85, 247, 0.2); flex-shrink: 0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #6b21a8;">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 6v6l4 2"></path>
                            </svg>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                            <span style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Chờ thanh toán trợ cấp</span>
                            <span class="badge badge-purple" style="font-size: 9px; padding: 1px 5px; border-radius: var(--radius-full); width: fit-content; background: rgba(168, 85, 247, 0.2); color: #6b21a8;">${pendingStaffPayouts.length} mục</span>
                        </div>
                    </div>
                    <div class="alert-body" style="flex: 1; overflow-y: auto; background: var(--bg); min-height: 0;">
                        <ul class="alert-list" style="list-style: none; margin: 0; padding: 0;">${staffList}</ul>
                    </div>
                </div>

                <div class="alert-widget" data-widget="classes" style="border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; background: var(--bg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); min-width: 0;">
                    <div class="alert-header" style="display: flex; align-items: center; padding: var(--spacing-2) var(--spacing-3); background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%); border-bottom: 2px solid rgba(239, 68, 68, 0.3); gap: var(--spacing-2); min-height: 48px; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius); background: rgba(239, 68, 68, 0.2); flex-shrink: 0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #dc2626;">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                            <span style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Lớp chưa có giáo viên</span>
                            <span class="badge badge-danger" style="font-size: 9px; padding: 1px 5px; border-radius: var(--radius-full); width: fit-content; background: rgba(239, 68, 68, 0.2); color: #991b1b;">${classesWithoutTeacher.length} mục</span>
                        </div>
                    </div>
                    <div class="alert-body" style="flex: 1; overflow-y: auto; background: var(--bg); min-height: 0;">
                        <ul class="alert-list" style="list-style: none; margin: 0; padding: 0;">${classList}</ul>
                    </div>
                </div>
                
                <div class="alert-widget" data-widget="finance" style="border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column; background: var(--bg); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); min-width: 0;">
                    <div class="alert-header" style="display: flex; align-items: center; padding: var(--spacing-2) var(--spacing-3); background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.05) 100%); border-bottom: 2px solid rgba(251, 191, 36, 0.3); gap: var(--spacing-2); min-height: 48px; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--radius); background: rgba(251, 191, 36, 0.2); flex-shrink: 0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #f59e0b;">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                            <span style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Yêu cầu tài chính</span>
                            <span class="badge badge-warning" style="font-size: 9px; padding: 1px 5px; border-radius: var(--radius-full); width: fit-content; background: rgba(251, 191, 36, 0.2); color: #92400e;">${(financeRequests.loans?.length || 0) + (financeRequests.refunds?.length || 0)} mục</span>
                        </div>
                    </div>
                    <div class="alert-body" style="flex: 1; overflow-y: auto; background: var(--bg); min-height: 0;">
                        <p class="alert-note" style="padding: var(--spacing-2) var(--spacing-3); margin: 0; color: var(--text-muted); font-size: 11px; border-bottom: 1px solid var(--border); background: rgba(251, 191, 36, 0.05); line-height: 1.4;">⚠️ Chức năng tạm thời không khả dụng. Sẽ phát triển trong phiên bản sau.</p>
                        <ul class="alert-list" style="list-style: none; margin: 0; padding: 0;">${financeList}</ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderQuickViewContent(view, quickViewData) {
    const items = quickViewData?.[view] || [];
    if (!items.length) {
        return '<p class="text-muted">Chưa có dữ liệu cho chế độ này.</p>';
    }
    return `
        <div class="quickview-grid">
            ${items.map(item => `
                <div class="quickview-card">
                    <div class="label">${item.label}</div>
                    <div class="value">${item.value}</div>
                    ${item.hint ? `<div class="hint">${item.hint}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderQuickViewSection(state, quickViewData, yearOptions) {
    if (!quickViewData) return '';
    const quickViewTabs = QUICK_VIEW_TABS.map(tab => `
        <button type="button" class="${tab.id === state.quickView ? 'active' : ''}" data-quick-view="${tab.id}">
            ${tab.label}
        </button>
    `).join('');

    const options = yearOptions.map(year => `
        <option value="${year}" ${String(year) === String(state.quickViewYear) ? 'selected' : ''}>${year}</option>
    `).join('');

    return `
        <div class="card dashboard-quickview">
            <div class="quickview-header">
                <div class="dashboard-section-title">Chế độ xem nhanh theo phân hệ</div>
                <label class="quickview-year-selector">
                    <span>Năm</span>
                    <select id="quickViewYear">${options}</select>
                </label>
            </div>
            <div class="quickview-tabs">${quickViewTabs}</div>
            ${renderQuickViewContent(state.quickView, quickViewData)}
        </div>
    `;
}

function renderDualLineChart(series = []) {
    const data = Array.isArray(series) ? series : [];
    if (!data.length) return '<div class="chart-empty">Chưa có dữ liệu</div>';

    const VIEWBOX_WIDTH = 500;
    const VIEWBOX_HEIGHT = 220;
    const xPadding = 50;
    const yPaddingTop = 20;
    const yPaddingBottom = 50;
    const chartWidth = VIEWBOX_WIDTH - xPadding * 2;
    const chartHeight = VIEWBOX_HEIGHT - yPaddingTop - yPaddingBottom;

    const maxValue = Math.max(...data.map(item => Math.max(item.revenue || 0, item.profit || 0))) || 1;
    const resolveX = (index) => {
        if (data.length <= 1) {
            return xPadding + chartWidth / 2;
        }
        return xPadding + (index / (data.length - 1)) * chartWidth;
    };
    const toPoint = (item, index, key) => {
        const x = resolveX(index);
        const value = Number(item[key] || 0);
        const y = VIEWBOX_HEIGHT - yPaddingBottom - (maxValue > 0 ? (value / maxValue) * chartHeight : 0);
        return `${x},${y}`;
    };
    const buildPath = (key) => data.map((item, index) => toPoint(item, index, key)).join(' ');
    const buildDots = (key, className, label) => data.map((item, index) => {
        const x = resolveX(index);
        const value = Number(item[key] || 0);
        const y = VIEWBOX_HEIGHT - yPaddingBottom - (maxValue > 0 ? (value / maxValue) * chartHeight : 0);
        return `<circle class="chart-dot ${className}" cx="${x}" cy="${y}" r="4" data-label="${item.displayLabel || item.label || ''}" data-series="${label}" data-value="${value}"></circle>`;
    }).join('');
    const labels = data.map((item, index) => {
        const shouldShow = data.length <= 6 || index % 2 === 0;
        if (!shouldShow) return '';
        const x = resolveX(index);
        const labelY = VIEWBOX_HEIGHT - yPaddingBottom + 22;
        return `<text x="${x}" y="${labelY}" text-anchor="middle" class="chart-x-label">${item.displayLabel || item.label || ''}</text>`;
    }).join('');
    const yTicks = [];
    const divisions = 4;
    for (let i = 0; i <= divisions; i += 1) {
        const value = (maxValue / divisions) * i;
        const y = VIEWBOX_HEIGHT - yPaddingBottom - ((value / (maxValue || 1)) * chartHeight);
        yTicks.push({ value, y });
    }
    const legend = `
        <div class="chart-inline-legend">
            <span><span class="legend-dot legend-revenue"></span> Doanh thu</span>
            <span><span class="legend-dot legend-profit"></span> Lợi nhuận</span>
        </div>
    `;
    return `
        <div class="dual-line-chart">
            <div class="chart-scroll-wrapper">
                <svg viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" class="chart" preserveAspectRatio="none">
                    ${yTicks.map(tick => `
                        <text x="${xPadding - 8}" y="${tick.y + 5}" class="chart-y-label">${formatShortCurrency(tick.value)}</text>
                    `).join('')}
                    <polyline class="chart-line chart-line-revenue" fill="none" stroke-width="3" points="${buildPath('revenue')}"></polyline>
                    <polyline class="chart-line chart-line-profit" fill="none" stroke-width="3" points="${buildPath('profit')}"></polyline>
                    ${buildDots('revenue', 'chart-dot-revenue', 'Doanh thu')}
                    ${buildDots('profit', 'chart-dot-profit', 'Lợi nhuận')}
                    ${labels}
                </svg>
            </div>
            <div class="chart-tooltip" role="tooltip"></div>
            ${legend}
        </div>
    `;
}

function initDualLineChartTooltips(root) {
    const charts = root.querySelectorAll('.dual-line-chart');
    charts.forEach(chart => {
        const tooltip = chart.querySelector('.chart-tooltip');
        if (!tooltip) return;
        chart.querySelectorAll('.chart-dot').forEach(dot => {
            dot.addEventListener('mouseenter', (event) => {
                const value = Number(dot.dataset.value || 0);
                tooltip.innerHTML = `
                    <div class="tooltip-title">${dot.dataset.series || ''}</div>
                    <div class="tooltip-value">${formatCurrencyVND(value)}</div>
                    <div class="tooltip-label">${dot.dataset.label || ''}</div>
                `;
                const chartRect = chart.getBoundingClientRect();
                const dotRect = event.target.getBoundingClientRect();
                const left = dotRect.left - chartRect.left;
                const top = dotRect.top - chartRect.top - 8;
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                tooltip.classList.add('visible');
            });
        });
        chart.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
}

function exportDashboard(format, data, range) {
    const rows = data.exportRows || [];
    if (!rows.length) {
        window.UniUI?.toast?.('Không có dữ liệu để xuất', 'warning');
        return;
    }
    if (format === 'excel') {
        const headers = ['Metric', 'Value', 'Ghi chú'];
        const payload = rows.map(row => ({
            Metric: row.Metric || row.metric,
            Value: row.Value || row.value,
            'Ghi chú': row['Ghi chú'] || row.note || ''
        }));
        window.UniData?.exportToCSV?.(`dashboard-${range.value}.csv`, headers, payload);
        window.UniUI?.toast?.('Đã xuất báo cáo CSV', 'success');
        return;
    }
    if (format === 'pdf') {
        const printable = rows.map(row => `${row.Metric}: ${row.Value} (${row['Ghi chú'] || row.note || ''})`).join('\n');
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`<pre><strong>${range.label}</strong>\n\n${printable}</pre>`);
            win.document.close();
            win.focus();
            win.print();
        }
        window.UniUI?.toast?.('Đã mở bản in báo cáo', 'info');
    }
}

function attachDashboardEvents(root, state, data, range) {
    // Remove existing event listeners để tránh duplicate
    const oldClickHandler = root._alertToggleHandler;
    if (oldClickHandler) {
        root.removeEventListener('click', oldClickHandler);
    }
    
    root.querySelector('#dashboardFilterType')?.addEventListener('change', event => {
        const type = event.target.value;
        const value = state.filterValues?.[type] || getDefaultPeriodValue(type);
        setDashboardState({ filterType: type, filterValues: { [type]: value } });
        renderDashboard();
    });

    root.querySelector('#dashboardFilterValue')?.addEventListener('change', event => {
        const value = normalizeFilterValue(state.filterType, event.target.value);
        setDashboardState({ filterValues: { [state.filterType]: value } });
        renderDashboard();
    });

    root.querySelectorAll('[data-export]').forEach(button => {
        button.addEventListener('click', () => {
            exportDashboard(button.dataset.export, data, range);
        });
    });

    root.querySelectorAll('[data-quick-view]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.dataset.quickView === state.quickView) return;
            setDashboardState({ quickView: button.dataset.quickView });
            renderDashboard();
        });
    });

    root.querySelector('#quickViewYear')?.addEventListener('change', event => {
        setDashboardState({ quickViewYear: event.target.value });
        renderDashboard();
    });

    root.querySelectorAll('[data-dashboard-action="goto"]').forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.target;
            if (target && window.UniUI && typeof window.UniUI.loadPage === 'function') {
                window.UniUI.loadPage(target);
            }
        });
    });

    initDualLineChartTooltips(root);

    const toggleBtn = root.querySelector('[data-chart-panel-toggle]');
    const overlay = root.querySelector('[data-chart-panel-overlay]');
    const closeBtn = root.querySelector('[data-chart-panel-close]');

    const setPanelState = (open) => {
        setDashboardState({ chartPanelOpen: !!open });
        renderDashboard();
    };

    toggleBtn?.addEventListener('click', () => setPanelState(!state.chartPanelOpen));
    overlay?.addEventListener('click', () => setPanelState(false));
    closeBtn?.addEventListener('click', () => setPanelState(false));

    root.querySelectorAll('[data-action="open-student"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) {
                window.UniUI?.loadPage?.(`student-detail:${id}`);
            }
        });
    });

    root.querySelectorAll('[data-action="open-staff"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) {
                window.UniUI?.loadPage?.(`staff-detail:${id}`);
            } else {
                window.UniUI?.loadPage?.('staff');
            }
        });
    });

    root.querySelectorAll('[data-action="open-teacher"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) {
                window.UniUI?.loadPage?.(`staff-detail:${id}`);
            } else {
                window.UniUI?.loadPage?.('teachers');
            }
        });
    });

    root.querySelectorAll('[data-action="open-class"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            if (id) {
                window.UniUI?.loadPage?.(`class-detail:${id}`);
            }
        });
    });

    // Đã xóa logic ẩn/hiện - nội dung luôn hiển thị
}

// Helper function to load data from cache for optimistic rendering
// Use window.UniData.loadPageDataFromCache for consistency with other pages
async function loadDashboardDataFromCache() {
    if (window.demo && Object.keys(window.demo).length > 0) {
        return true; // Already has data
    }
    
    // Use the same cache loading mechanism as other pages
    if (window.UniData && typeof window.UniData.loadPageDataFromCache === 'function') {
        return await window.UniData.loadPageDataFromCache();
    }
    
    return false;
}

// Data snapshot for comparison to prevent unnecessary re-renders
let dashboardDataSnapshot = null;

function snapshotDashboardData() {
    const requiredKeys = [
        'walletTransactions', 'costs', 'payroll', 'bonuses',
        'sessions', 'students', 'classes', 'teachers',
        'studentClasses', 'payments', 'lessonOutputs'
    ];
    const snapshot = {};
    requiredKeys.forEach(key => {
        const data = window.demo?.[key];
        if (Array.isArray(data)) {
            snapshot[key] = data.length;
        }
    });
    return JSON.stringify(snapshot);
}

function hasDashboardDataChanged() {
    const current = snapshotDashboardData();
    if (!dashboardDataSnapshot) {
        dashboardDataSnapshot = current;
        return true; // First render
    }
    if (current !== dashboardDataSnapshot) {
        dashboardDataSnapshot = current;
        return true; // Data changed
    }
    return false; // No change
}

// Prevent duplicate renders
let isRendering = false;

function renderDashboard() {
    // Prevent duplicate renders
    if (isRendering) {
        console.log(`[renderDashboard] Already rendering, skipping duplicate call`);
        return;
    }
    isRendering = true;
    
    // Initialize listeners on first render
    initDashboardListeners();
    
    // Initialize page listeners for financial data (similar to costs, lesson-plans pages)
    if (!window.__dashboardPageListenersInitialized) {
        window.UniData?.initPageListeners?.('dashboard', renderDashboard, [
            'walletTransactions', 'costs', 'payroll', 'bonuses', 
            'sessions', 'payments', 'lessonOutputs'
        ]);
        window.__dashboardPageListenersInitialized = true;
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) {
        console.error('main-content element not found');
        return;
    }
    
    // Optimistic loading: try to load from cache immediately
    // Check if window.demo is empty OR if critical financial data arrays are missing
    const hasWindowDemo = window.demo && Object.keys(window.demo).length > 0;
    const hasWalletTransactions = Array.isArray(window.demo?.walletTransactions);
    const hasCosts = Array.isArray(window.demo?.costs);
    const hasPayroll = Array.isArray(window.demo?.payroll);
    const hasBonuses = Array.isArray(window.demo?.bonuses);
    const hasSessions = Array.isArray(window.demo?.sessions);
    const hasPayments = Array.isArray(window.demo?.payments);
    const hasLessonOutputs = Array.isArray(window.demo?.lessonOutputs);
    
    // Count data for logging
    const walletTransactionsCount = hasWalletTransactions ? window.demo.walletTransactions.length : 0;
    const costsCount = hasCosts ? window.demo.costs.length : 0;
    const payrollCount = hasPayroll ? window.demo.payroll.length : 0;
    const bonusesCount = hasBonuses ? window.demo.bonuses.length : 0;
    const sessionsCount = hasSessions ? window.demo.sessions.length : 0;
    const paymentsCount = hasPayments ? window.demo.payments.length : 0;
    const lessonOutputsCount = hasLessonOutputs ? window.demo.lessonOutputs.length : 0;
    
    // For dashboard, we need the arrays to exist (even if empty) to render
    // We'll render with empty data and show "No data" instead of waiting for Supabase
    // Only require essential arrays: walletTransactions, costs, sessions (others can be optional)
    const hasEssentialArrays = hasWalletTransactions && hasCosts && hasSessions;
    const needsCacheLoad = !hasWindowDemo || !hasEssentialArrays;
    
    // Debug: Check if we need to load cache for financial data specifically
    // Check both existence and count - if arrays exist but are empty, we might need to load from cache
    const hasFinancialDataInCache = (hasWalletTransactions && walletTransactionsCount > 0) || 
                                    (hasLessonOutputs && lessonOutputsCount > 0) || 
                                    (hasBonuses && bonusesCount > 0);
    // If essential arrays exist but financial data is missing/empty, try loading from cache
    const needsFinancialDataLoad = hasEssentialArrays && !hasFinancialDataInCache;
    
    // If we have essential arrays but no financial data, try to load from cache
    if (needsFinancialDataLoad) {
        loadDashboardDataFromCache().then(loaded => {
            if (loaded) {
                if (window.UniData && typeof window.UniData.hideSpinnerIfLoaded === 'function') {
                    window.UniData.hideSpinnerIfLoaded();
                }
                setTimeout(() => {
                    isRendering = false; // Reset flag before re-render
                    renderDashboard();
                }, 10);
            }
        }).catch(err => {
            console.warn(`[renderDashboard:Cache] Failed to load financial data from cache:`, err);
        });
        // Continue rendering with empty data while cache loads
    }
    
    if (needsCacheLoad) {
        loadDashboardDataFromCache().then(loaded => {
            isRendering = false; // Reset flag before re-render
            if (loaded) {
                // Hide spinner immediately when cache loads
                if (window.UniData && typeof window.UniData.hideSpinnerIfLoaded === 'function') {
                    window.UniData.hideSpinnerIfLoaded();
                }
                // Data loaded from cache, render immediately
                setTimeout(() => renderDashboard(), 10);
            } else {
                // No cache available, show loading and wait
        mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
                setTimeout(() => {
                    isRendering = false; // Reset flag before re-render
                    renderDashboard();
                }, 120);
            }
        });
        return;
    }

    const user = window.UniAuth?.getCurrentUser?.() || null;
    const role = user?.role || 'guest';

    if (!user) {
        mainContent.innerHTML = `
            <div class="card">
                <h2>Chào mừng tới Unicorns Edu</h2>
                <p class="text-muted">Vui lòng đăng nhập để truy cập bảng điều khiển.</p>
                <button class="btn btn-primary" onclick="window.UniUI.loadPage('home')">Đăng nhập / Đăng ký</button>
            </div>
        `;
        isRendering = false; // Reset flag on early return
        return;
    }

    if (role === 'teacher') {
        const teachers = window.demo?.teachers || [];
        const teacherRecord = teachers.find(t => t.userId === user.id) || teachers.find(t => t.id === user.linkId) || null;
        mainContent.innerHTML = `
            <div class="card">
                <h3>Dashboard giáo viên tạm ẩn</h3>
                <p class="text-muted">Vui lòng sử dụng trang Gia sư hoặc Lớp học để xem thông tin giảng dạy.</p>
                ${teacherRecord ? `
                    <button class="btn btn-primary" onclick="window.UniUI.loadPage('staff-detail:${teacherRecord.id}')">
                        Xem hồ sơ giáo viên
                    </button>` : ''}
            </div>
        `;
        isRendering = false; // Reset flag on early return
        return;
    }

    if (role === 'student') {
        const students = window.demo?.students || [];
        const studentRecord = students.find(s => s.id === user.linkId) || students.find(s => s.userId === user.id) || null;
        if (studentRecord && typeof window.renderStudentDetail === 'function') {
            isRendering = false; // Reset flag before calling another render function
            window.renderStudentDetail(studentRecord.id);
            return;
        }
        mainContent.innerHTML = `
            <div class="card">
                <h3>Không tìm thấy hồ sơ học sinh</h3>
                <p class="text-muted">Tài khoản chưa được liên kết với hồ sơ học sinh. Vui lòng liên hệ quản trị viên.</p>
                <button class="btn mt-2" onclick="window.UniUI.loadPage('students')">Đi tới danh sách học sinh</button>
            </div>
        `;
        isRendering = false; // Reset flag on early return
        return;
    }

    const state = getDashboardState();
    const range = getFilterRange(state);
    
    const isLoading = isDataLoading();
    const data = computeDashboardData(range);
    const annualSources = data.annualSources || {};
    const yearOptions = getAvailableYearsForQuickView(annualSources);
    const resolvedQuickViewYear = yearOptions.length
        ? (yearOptions.includes(String(state.quickViewYear)) ? String(state.quickViewYear) : yearOptions[0])
        : String(new Date().getFullYear());
    if (resolvedQuickViewYear !== String(state.quickViewYear)) {
        setDashboardState({ quickViewYear: resolvedQuickViewYear });
        return;
    }
    const quickViewData = buildAnnualQuickViewData(resolvedQuickViewYear, annualSources);
    const normalizedYearOptions = yearOptions.length ? yearOptions : [resolvedQuickViewYear];
    state.quickViewYear = resolvedQuickViewYear;

    mainContent.innerHTML = `
        <div class="dashboard-page">
            ${renderFilterBar(state, range)}
            ${renderChartPanelSection(state, data.charts)}
            ${renderSummaryCards(data.summary, range, isLoading)}
            ${renderFinanceReportSection(data.financeReport, range, isLoading)}
            ${renderAlertsSection(data.alerts)}
            ${renderQuickViewSection(state, quickViewData, normalizedYearOptions)}
        </div>
    `;

    attachDashboardEvents(mainContent, state, data, range);
    
    // Update snapshot after rendering
    hasDashboardDataChanged(); // This will update the snapshot
    
    // Reset rendering flag after a short delay to allow async operations
    setTimeout(() => {
        isRendering = false;
    }, 50);
}

// Handle data updates - only refresh if data actually changed
// NOTE: This is now handled by initPageListeners, so this function is kept for backward compatibility
// but should not trigger duplicate renders
function handleDashboardDataUpdate(event) {
    // Skip if initPageListeners is handling it (to avoid duplicate renders)
    if (window.__dashboardPageListenersInitialized) {
        return; // initPageListeners will handle the update
    }
    
    const source = event?.detail?.source || '';
    
    // Only refresh when we get full dataset from Supabase (for financial reports)
    // Essential data (UniData:ready) is enough for initial render, but full data ensures accuracy
    if (source === 'supabase-full') {
        // Check if data actually changed
        if (hasDashboardDataChanged()) {
            // Debounce to avoid multiple rapid renders
            if (window.__dashboardRefreshTimeout) {
                clearTimeout(window.__dashboardRefreshTimeout);
            }
            window.__dashboardRefreshTimeout = setTimeout(() => {
                const currentPage = window.UniUI?.getCurrentPageName?.() || '';
                if (currentPage === 'dashboard') {
                    renderDashboard();
                }
                window.__dashboardRefreshTimeout = null;
            }, 100);
        }
    }
}

// Cleanup function to remove event listeners
function cleanupDashboardListeners() {
    if (window.__dashboardDataHandler) {
        window.removeEventListener('UniData:updated', window.__dashboardDataHandler);
        window.removeEventListener('UniData:dataset-applied', window.__dashboardDataHandler);
        window.__dashboardDataHandler = null;
    }
}

// Initialize event listeners (called automatically on first render)
function initDashboardListeners() {
    if (window.__dashboardListenersInitialized) {
        return; // Already initialized
    }
    
    // Add event listeners for data updates
    window.__dashboardDataHandler = handleDashboardDataUpdate;
    window.addEventListener('UniData:updated', handleDashboardDataUpdate);
    window.addEventListener('UniData:dataset-applied', handleDashboardDataUpdate);
    
    window.__dashboardListenersInitialized = true;
}

// Initialize dashboard with event listeners
function initDashboard() {
    // Cleanup old listeners if any
    cleanupDashboardListeners();
    window.__dashboardListenersInitialized = false;
    initDashboardListeners();
    renderDashboard();
}

// Export functions
window.renderDashboard = renderDashboard;
window.initDashboard = initDashboard;