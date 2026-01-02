/**
 * reports.js - Reports page renderer with charts
 */

async function renderReports() {
    // Initialize listeners and try optimistic loading
    if (!window.__reportsListenersInitialized) {
        window.UniData?.initPageListeners?.('reports', renderReports, [
            'classes', 'students', 'teachers', 'payments'
        ]);
        window.__reportsListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderReports(), 10);
            return;
        } else {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderReports(), 120);
            return;
        }
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;

    // Calculate statistics
    const stats = calculateStats();

    mainContent.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Reports</h2>
            <div class="flex gap-2">
                <select id="reportPeriod" class="form-control">
                    <option value="all">All Time</option>
                    <option value="year">This Year</option>
                    <option value="month">This Month</option>
                </select>
                <button onclick="exportReportData()" class="btn">Export CSV</button>
            </div>
        </div>

        <!-- Overview Cards -->
        <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
            <div class="card">
                <h3>Classes Overview</h3>
                <div class="text-xl font-bold">${stats.totalClasses}</div>
                <div class="text-muted text-sm">
                    ${stats.activeClasses} active classes
                </div>
                <div class="chart-container mt-4">
                    ${renderPieChart([
                        { label: 'Active', value: stats.activeClasses },
                        { label: 'Inactive', value: stats.totalClasses - stats.activeClasses }
                    ])}
                </div>
            </div>

            <div class="card">
                <h3>Students Overview</h3>
                <div class="text-xl font-bold">${stats.totalStudents}</div>
                <div class="text-muted text-sm">
                    ${stats.activeStudents} active students
                </div>
                <div class="chart-container mt-4">
                    ${renderPieChart([
                        { label: 'Active', value: stats.activeStudents },
                        { label: 'Inactive', value: stats.totalStudents - stats.activeStudents }
                    ])}
                </div>
            </div>

            <div class="card">
                <h3>Revenue Overview</h3>
                <div class="text-xl font-bold">
                    ${window.UniData.formatCurrency(stats.totalRevenue)}
                </div>
                <div class="text-muted text-sm">
                    ${stats.pendingPayments} pending payments
                </div>
                <div class="chart-container mt-4">
                    ${renderPieChart([
                        { label: 'Paid', value: stats.paidRevenue },
                        { label: 'Pending', value: stats.pendingRevenue }
                    ])}
                </div>
            </div>
        </div>

        <!-- Revenue by Class -->
        <div class="card mt-4">
            <h3>Revenue by Class</h3>
            <div class="chart-container">
                ${renderBarChart(stats.revenueByClass)}
            </div>
            <div class="table-container mt-4">
                <table class="table-striped">
                    <thead>
                        <tr>
                            <th>Class</th>
                            <th>Students</th>
                            <th>Revenue</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.revenueByClass.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.students}</td>
                                <td>${window.UniData.formatCurrency(item.value)}</td>
                                <td>
                                    <span class="badge ${item.status === 'running' ? 'badge-success' : 'badge-muted'}">
                                        ${item.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Teacher Performance -->
        <div class="card mt-4">
            <h3>Teacher Performance</h3>
            <div class="table-container">
                <table class="table-striped">
                    <thead>
                        <tr>
                            <th>Teacher</th>
                            <th>Classes</th>
                            <th>Students</th>
                            <th>Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.teacherStats.map(t => `
                            <tr>
                                <td>${t.name}</td>
                                <td>${t.classes}</td>
                                <td>${t.students}</td>
                                <td>${window.UniData.formatCurrency(t.revenue)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Add event listeners
    attachReportEventListeners();
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('reports', ['classes', 'students', 'teachers', 'payments']);
}

/**
 * Calculate statistics for reports
 * @returns {Object} Statistics object
 */
function calculateStats() {
    const stats = {
        totalClasses: window.demo.classes.length,
        activeClasses: window.demo.classes.filter(c => c.status === 'running').length,
        totalStudents: window.demo.students.length,
        activeStudents: window.demo.students.filter(s => s.status === 'active').length,
        totalRevenue: window.demo.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
        paidRevenue: window.demo.payments.filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + (p.amount || 0), 0),
        pendingRevenue: window.demo.payments.filter(p => p.status === 'pending')
            .reduce((sum, p) => sum + (p.amount || 0), 0),
        pendingPayments: window.demo.payments.filter(p => p.status === 'pending').length
    };

    // Revenue by class
    stats.revenueByClass = window.demo.classes.map(cls => {
        const students = window.demo.students.filter(s => s.classId === cls.id).length;
        const revenue = window.demo.payments
            .filter(p => p.classId === cls.id)
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            name: cls.name,
            value: revenue,
            students,
            status: cls.status
        };
    }).sort((a, b) => b.value - a.value);

    // Teacher statistics
    stats.teacherStats = window.demo.teachers.map(teacher => {
        const classes = window.demo.classes.filter(c => c.teacherId === teacher.id);
        const students = window.demo.students.filter(s => 
            classes.some(c => c.id === s.classId)
        );
        const revenue = window.demo.payments
            .filter(p => classes.some(c => c.id === p.classId))
            .reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            name: teacher.fullName,
            classes: classes.length,
            students: students.length,
            revenue
        };
    }).sort((a, b) => b.revenue - a.revenue);

    return stats;
}

/**
 * Render simple pie chart using SVG
 * @param {Array} data - Array of {label, value} objects
 * @returns {string} SVG markup
 */
function renderPieChart(data) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (!total) return '<div class="text-muted">No data</div>';

    let startAngle = 0;
    const paths = data.map((item, index) => {
        const percentage = item.value / total;
        const endAngle = startAngle + percentage * 2 * Math.PI;
        
        const x1 = 50 + 40 * Math.cos(startAngle);
        const y1 = 50 + 40 * Math.sin(startAngle);
        const x2 = 50 + 40 * Math.cos(endAngle);
        const y2 = 50 + 40 * Math.sin(endAngle);
        
        const largeArc = percentage > 0.5 ? 1 : 0;
        
        const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
        
        startAngle = endAngle;
        return `
            <path d="${path}" fill="var(${index ? '--muted' : '--primary'})" opacity="${index ? '0.5' : '1'}">
                <title>${item.label}: ${Math.round(percentage * 100)}%</title>
            </path>
        `;
    });

    return `
        <svg viewBox="0 0 100 100" class="chart">
            ${paths.join('')}
        </svg>
    `;
}

/**
 * Render simple bar chart using SVG
 * @param {Array} data - Array of {name, value} objects
 * @returns {string} SVG markup
 */
function renderBarChart(data) {
    if (!data.length) return '<div class="text-muted">No data</div>';

    const maxValue = Math.max(...data.map(item => item.value));
    const bars = data.map((item, index) => {
        const height = (item.value / maxValue) * 80;
        const x = index * 60 + 40;
        return `
            <g transform="translate(${x}, 0)">
                <rect 
                    x="-20" 
                    y="${100 - height}" 
                    width="40" 
                    height="${height}"
                    fill="var(--primary)"
                    opacity="${1 - index * 0.1}"
                >
                    <title>${item.name}: ${window.UniData.formatCurrency(item.value)}</title>
                </rect>
                <text 
                    x="0" 
                    y="110" 
                    text-anchor="middle" 
                    class="chart-label"
                    transform="rotate(-45 0,110)"
                >
                    ${item.name}
                </text>
            </g>
        `;
    });

    return `
        <svg viewBox="0 0 ${Math.max(400, data.length * 60 + 20)} 140" class="chart">
            <style>
                .chart-label { 
                    font: 8px sans-serif; 
                    fill: var(--muted);
                }
            </style>
            ${bars.join('')}
        </svg>
    `;
}

/**
 * Attach event listeners for reports page
 */
function attachReportEventListeners() {
    const periodFilter = document.getElementById('reportPeriod');
    
    if (periodFilter) {
        periodFilter.addEventListener('change', () => {
            // In a real app, we would filter data by period
            // For demo, just re-render with same data
            renderReports();
        });
    }
}

/**
 * Export report data as CSV
 */
function exportReportData() {
    const stats = calculateStats();
    
    const headers = ['Category', 'Metric', 'Value'];
    const data = [
        ['Classes', 'Total', stats.totalClasses],
        ['Classes', 'Active', stats.activeClasses],
        ['Students', 'Total', stats.totalStudents],
        ['Students', 'Active', stats.activeStudents],
        ['Revenue', 'Total', stats.totalRevenue],
        ['Revenue', 'Paid', stats.paidRevenue],
        ['Revenue', 'Pending', stats.pendingRevenue],
        ['Payments', 'Pending Count', stats.pendingPayments],
        ...stats.revenueByClass.map(c => ['Class Revenue', c.name, c.value]),
        ...stats.teacherStats.map(t => ['Teacher Stats', t.name, t.revenue])
    ];

    window.UniData.exportToCSV('reports.csv', headers, data);
}

// Export reports page functions
window.ReportPage = {
    render: renderReports,
    exportReport: exportReportData
};