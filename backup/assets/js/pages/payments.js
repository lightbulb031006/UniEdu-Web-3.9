/**
 * payments.js - Payments page renderer
 */

async function renderPayments() {
    // Initialize listeners and try optimistic loading
    if (!window.__paymentsListenersInitialized) {
        window.UniData?.initPageListeners?.('payments', renderPayments, ['payments', 'classes', 'students']);
        window.__paymentsListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderPayments(), 10);
            return;
        } else {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderPayments(), 120);
            return;
        }
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;

    // Calculate payment statistics
    const stats = {
        total: window.demo.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
        paid: window.demo.payments
            .filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + (p.amount || 0), 0),
        pending: window.demo.payments
            .filter(p => p.status === 'pending')
            .reduce((sum, p) => sum + (p.amount || 0), 0)
    };

    mainContent.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Payments</h2>
            <div class="flex gap-2">
                <button onclick="exportPaymentReport()" class="btn">Export CSV</button>
            </div>
        </div>

        <div class="payment-summary">
            <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div>
                    <div class="text-muted">Total Revenue</div>
                    <div class="text-xl font-bold">${window.UniData.formatCurrency(stats.total)}</div>
                </div>
                <div>
                    <div class="text-muted">Paid</div>
                    <div class="text-xl font-bold">${window.UniData.formatCurrency(stats.paid)}</div>
                </div>
                <div>
                    <div class="text-muted">Pending</div>
                    <div class="text-xl font-bold">${window.UniData.formatCurrency(stats.pending)}</div>
                </div>
            </div>
        </div>

        <div class="payment-filters">
            <select id="paymentStatusFilter" class="form-control">
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
            </select>
            
            <select id="paymentClassFilter" class="form-control">
                <option value="">All Classes</option>
                ${window.demo.classes.map(c => `
                    <option value="${c.id}">${c.name}</option>
                `).join('')}
            </select>
            
            <select id="paymentStudentFilter" class="form-control">
                <option value="">All Students</option>
                ${window.demo.students.map(s => `
                    <option value="${s.id}">${s.fullName}</option>
                `).join('')}
            </select>
        </div>

        <div class="card">
            <div class="table-container">
                <table id="paymentsTable" class="table-striped">
                    <thead>
                        <tr>
                            <th data-sort="date">Date</th>
                            <th data-sort="studentId">Student</th>
                            <th data-sort="classId">Class</th>
                            <th data-sort="amount">Amount</th>
                            <th data-sort="status">Status</th>
                        </tr>
                    </thead>
                    <tbody>${renderPaymentRows()}</tbody>
                </table>
            </div>
        </div>
    `;

    // Add event listeners
    attachPaymentEventListeners();
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('payments', ['payments', 'classes', 'students']);
}

/**
 * Render table rows for payments
 */
function renderPaymentRows(payments = window.demo.payments) {
    return payments.map(payment => {
        const student = window.demo.students.find(s => s.id === payment.studentId);
        const cls = window.demo.classes.find(c => c.id === payment.classId);
        
        return `
            <tr>
                <td>${payment.date}</td>
                <td>${student ? student.fullName : '-'}</td>
                <td>${cls ? cls.name : '-'}</td>
                <td>${window.UniData.formatCurrency(payment.amount)}</td>
                <td>
                    <span class="badge ${payment.status === 'paid' ? 'badge-success' : 'badge-warning'}">
                        ${payment.status}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Attach event listeners for payment page
 */
function attachPaymentEventListeners() {
    // Sorting
    document.querySelectorAll('#paymentsTable th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            const direction = th.dataset.direction === 'asc' ? 'desc' : 'asc';
            
            // Update sort direction
            document.querySelectorAll('#paymentsTable th[data-sort]')
                .forEach(el => el.removeAttribute('data-direction'));
            th.dataset.direction = direction;
            
            // Sort data
            window.demo.payments = window.UniLogic.sortData(
                window.demo.payments,
                field,
                direction
            );
            
            // Re-render table body
            const tbody = document.querySelector('#paymentsTable tbody');
            if (tbody) tbody.innerHTML = renderPaymentRows();
        });
    });

    // Filtering
    const statusFilter = document.getElementById('paymentStatusFilter');
    const classFilter = document.getElementById('paymentClassFilter');
    const studentFilter = document.getElementById('paymentStudentFilter');

    function applyFilters() {
        const status = statusFilter?.value || '';
        const classId = classFilter?.value || '';
        const studentId = studentFilter?.value || '';

        const filtered = window.demo.payments.filter(payment => {
            const matchStatus = !status || payment.status === status;
            const matchClass = !classId || payment.classId === classId;
            const matchStudent = !studentId || payment.studentId === studentId;
            return matchStatus && matchClass && matchStudent;
        });

        const tbody = document.querySelector('#paymentsTable tbody');
        if (tbody) tbody.innerHTML = renderPaymentRows(filtered);
    }

    statusFilter?.addEventListener('change', applyFilters);
    classFilter?.addEventListener('change', applyFilters);
    studentFilter?.addEventListener('change', applyFilters);
}

/**
 * Export payment report as CSV
 */
function exportPaymentReport() {
    const headers = ['Date', 'Student', 'Class', 'Amount', 'Status'];
    const data = window.demo.payments.map(payment => {
        const student = window.demo.students.find(s => s.id === payment.studentId);
        const cls = window.demo.classes.find(c => c.id === payment.classId);
        
        return [
            payment.date,
            student ? student.fullName : '-',
            cls ? cls.name : '-',
            payment.amount,
            payment.status
        ];
    });

    window.UniData.exportToCSV('payments-report.csv', headers, data);
}

// Export payment page functions
window.PaymentPage = {
    render: renderPayments,
    exportReport: exportPaymentReport
};