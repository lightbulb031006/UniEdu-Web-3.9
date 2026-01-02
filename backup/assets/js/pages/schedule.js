/**
 * schedule.js - Schedule page renderer
 */

async function renderSchedule() {
    // Initialize listeners and try optimistic loading
    if (!window.__scheduleListenersInitialized) {
        window.UniData?.initPageListeners?.('schedule', renderSchedule, ['classes', 'teachers', 'sessions']);
        window.__scheduleListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderSchedule(), 10);
            return;
        } else {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderSchedule(), 120);
            return;
        }
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;

    // Get current week dates
    const today = new Date();
    const dates = getWeekDates(today);

    mainContent.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Schedule</h2>
            <div class="flex gap-2">
                <select id="scheduleClassFilter" class="form-control">
                    <option value="">All Classes</option>
                    ${window.demo.classes.map(c => `
                        <option value="${c.id}">${c.name}</option>
                    `).join('')}
                </select>
                <select id="scheduleTeacherFilter" class="form-control">
                    <option value="">All Teachers</option>
                    ${window.demo.teachers.map(t => `
                        <option value="${t.id}">${t.fullName}</option>
                    `).join('')}
                </select>
            </div>
        </div>

        <div class="schedule-grid">
            ${dates.map((date, index) => `
                <div class="schedule-day ${isToday(date) ? 'current-day' : ''}">
                    <div class="day-header">
                        <div class="text-muted text-sm">
                            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]}
                        </div>
                        <div class="font-bold">
                            ${date.getDate()}
                        </div>
                    </div>
                    <div class="schedule-items">
                        ${generateSampleSchedule(date)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Add event listeners
    attachScheduleEventListeners();
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('schedule', ['classes', 'teachers', 'sessions']);
}

/**
 * Get array of dates for current week
 * @param {Date} date - Current date
 * @returns {Date[]} Array of dates
 */
function getWeekDates(date) {
    const dates = [];
    const current = new Date(date);
    const weekStart = current.getDate() - current.getDay();
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(current);
        day.setDate(weekStart + i);
        dates.push(day);
    }
    
    return dates;
}

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean}
 */
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
}

/**
 * Generate sample schedule items for a date
 * @param {Date} date - Date to generate schedule for
 * @returns {string} HTML string
 */
function generateSampleSchedule(date) {
    // In a real app, we would fetch actual schedule data
    // For demo, we'll generate some sample items
    const dayOfWeek = date.getDay();
    const classes = window.demo.classes;
    
    if (dayOfWeek === 0) return '<div class="text-muted text-sm">No classes</div>';
    
    const items = classes
        .filter((_, index) => index % 7 === dayOfWeek) // Spread classes across week
        .map(cls => {
            const teacher = window.demo.teachers.find(t => t.id === cls.teacherId);
            const status = Math.random() > 0.8 ? 'cancelled' : 
                Math.random() > 0.6 ? 'makeup' : 'scheduled';
            
            return `
                <div class="schedule-item">
                    <div class="flex justify-between items-center">
                        <div>${cls.name}</div>
                        <span class="badge ${
                            status === 'scheduled' ? 'badge-success' : 
                            status === 'makeup' ? 'badge-warning' : 
                            'badge-danger'
                        }">${status}</span>
                    </div>
                    <div class="text-muted text-sm">
                        ${teacher ? teacher.fullName : 'No teacher'}
                    </div>
                    <div class="text-muted text-sm">
                        ${Math.floor(Math.random() * 12 + 7)}:00 - 
                        ${Math.floor(Math.random() * 12 + 13)}:00
                    </div>
                </div>
            `;
        });

    return items.length ? items.join('') : '<div class="text-muted text-sm">No classes</div>';
}

/**
 * Attach event listeners for schedule page
 */
function attachScheduleEventListeners() {
    const classFilter = document.getElementById('scheduleClassFilter');
    const teacherFilter = document.getElementById('scheduleTeacherFilter');

    function applyFilters() {
        const classId = classFilter?.value || '';
        const teacherId = teacherFilter?.value || '';

        // In a real app, we would filter actual schedule data
        // For demo, we'll just show/hide some elements
        document.querySelectorAll('.schedule-item').forEach(item => {
            const random = Math.random();
            item.style.display = 
                (!classId || random > 0.5) && 
                (!teacherId || random > 0.5) ? 
                'block' : 'none';
        });
    }

    classFilter?.addEventListener('change', applyFilters);
    teacherFilter?.addEventListener('change', applyFilters);
}

// Export schedule page functions
window.SchedulePage = {
    render: renderSchedule
};