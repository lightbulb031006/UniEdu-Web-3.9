/**
 * classes.js - Classes page renderer and CRUD operations
 */

// Class validation rules (price removed, type becomes category)
const classValidation = {
    name: { required: true, label: 'Name' },
    type: { required: true, label: 'Category' },
    status: { required: true, label: 'Status' }
};

// Filter state for classes
let classFilterState = {
    search: '',
    type: 'all',
    status: 'all'
};

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch] || ch));
}

/**
 * Filter classes list by search, type, and status
 */
function getFilteredClasses(list) {
    if (!Array.isArray(list)) return [];
    let filtered = [...list];
    
    // Search filter
    if (classFilterState.search) {
        const searchLower = classFilterState.search.toLowerCase();
        filtered = filtered.filter(c => 
            (c.name || '').toLowerCase().includes(searchLower) ||
            (c.type || '').toLowerCase().includes(searchLower) ||
            (() => {
                // Search in teacher names
                const teacherIds = c.teacherIds || (c.teacherId ? [c.teacherId] : []);
                const teachers = teacherIds.map(tId => (window.demo.teachers || []).find(t => t.id === tId)).filter(Boolean);
                return teachers.some(t => (t.fullName || '').toLowerCase().includes(searchLower));
            })()
        );
    }
    
    // Type filter
    if (classFilterState.type !== 'all') {
        filtered = filtered.filter(c => (c.type || '') === classFilterState.type);
    }
    
    // Status filter
    if (classFilterState.status !== 'all') {
        filtered = filtered.filter(c => {
            const classStatus = c.status || 'running';
            return classStatus === classFilterState.status;
        });
    }
    
    return filtered;
}

/**
 * Render classes list page
 */
async function renderClasses() {
    // Initialize listeners and try optimistic loading
    if (!window.__classesListenersInitialized) {
        window.UniData?.initPageListeners?.('classes', renderClasses, ['classes', 'teachers', 'students']);
        window.__classesListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderClasses(), 10);
            return;
        } else {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderClasses(), 120);
            return;
        }
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;

    const canCreate = window.UniUI.hasRole('admin');
    
    // Get all classes (apply role-based filtering first)
    const user = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    let allClasses = (window.demo.classes || []).slice();
    if (user?.role === 'teacher' && user.linkId) {
        allClasses = allClasses.filter(cls => {
            const teacherIds = Array.isArray(cls.teacherIds) ? cls.teacherIds : (cls.teacherId ? [cls.teacherId] : []);
            return teacherIds.includes(user.linkId);
        });
    } else if (user?.role === 'student' && user.linkId) {
        const enrolledIds = new Set(
            (window.demo.studentClasses || [])
                .filter(record => record.studentId === user.linkId && record.status !== 'inactive')
                .map(record => record.classId)
        );
        allClasses = allClasses.filter(cls => enrolledIds.has(cls.id));
    }
    
    // Apply filters
    const filteredClasses = getFilteredClasses(allClasses);
    
    // Get unique values for filters
    const allTypes = [...new Set(allClasses.map(c => c.type).filter(Boolean))].sort();
    
    mainContent.innerHTML = `
        <div class="students-page-header">
            <div class="students-page-title-row">
            <h2>Lớp học</h2>
                <div class="students-count-badge">
                    <span class="students-count-number">${filteredClasses.length}</span>
                    <span class="students-count-label">lớp</span>
                </div>
            </div>
            ${canCreate ? `
                <button onclick="openClassModal()" class="btn btn-primary btn-add-icon" title="Thêm lớp mới">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            ` : ''}
        </div>

        <!-- Filters and Search -->
        <div class="students-filters-card card">
            <div class="students-search-bar">
                <div class="search-input-wrapper">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input
                        type="text"
                        id="classSearchInput"
                        class="search-input"
                        placeholder="Tìm kiếm theo tên lớp, phân loại, giáo viên..."
                        value="${classFilterState.search}"
                        autocomplete="off"
                    />
                    ${classFilterState.search ? `
                        <button class="search-clear-btn" onclick="clearClassSearch()" title="Xóa tìm kiếm">
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
                    <label class="filter-label">Phân loại</label>
                    <select id="classTypeFilter" class="filter-select">
                        <option value="all">Tất cả phân loại</option>
                        ${allTypes.map(t => `
                            <option value="${t}" ${classFilterState.type === t ? 'selected' : ''}>${escapeHtml(t)}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Trạng thái</label>
                    <select id="classStatusFilter" class="filter-select">
                        <option value="all">Tất cả</option>
                        <option value="running" ${classFilterState.status === 'running' ? 'selected' : ''}>Đang hoạt động</option>
                        <option value="stopped" ${classFilterState.status === 'stopped' ? 'selected' : ''}>Đã dừng</option>
                    </select>
                </div>

                <div class="filter-actions">
                    <button class="btn btn-secondary" onclick="resetClassFilters()" title="Đặt lại bộ lọc">
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
            <div class="table-container">
                <table id="classesTable" class="table-striped">
                    <thead>
                        <tr>
                            <th>Tên lớp</th>
                            <th>Phân loại</th>
                            <th>Giáo viên</th>
                            <th>Trạng thái</th>
                            ${window.UniUI.hasRole('admin') ? '<th style="width: 80px;"></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>${renderClassRows(filteredClasses)}</tbody>
                </table>
            </div>
        </div>
    `;

    // Attach filter listeners
    attachClassFilterListeners();

    // Attach click handlers to rows
    attachClassRowClickHandlers();
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('classes', ['classes', 'teachers', 'students']);
}

/**
 * Render table rows for classes
 */
function renderClassRows(sourceClasses = null) {
    const pager = window.AppStore?.store.getState().pager.classes || { page:1, pageSize:10 };
    const start = (pager.page - 1) * pager.pageSize;
    const canEdit = window.UniUI.hasRole('admin');
    
    // Use provided filtered classes, or filter from all classes
    let source = sourceClasses;
    if (!source) {
    const user = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
        source = (window.demo.classes || []).slice();
    if (user?.role === 'teacher' && user.linkId) {
        source = source.filter(cls => {
            const teacherIds = Array.isArray(cls.teacherIds) ? cls.teacherIds : (cls.teacherId ? [cls.teacherId] : []);
            return teacherIds.includes(user.linkId);
        });
    } else if (user?.role === 'student' && user.linkId) {
        const enrolledIds = new Set(
            (window.demo.studentClasses || [])
                .filter(record => record.studentId === user.linkId && record.status !== 'inactive')
                .map(record => record.classId)
        );
        source = source.filter(cls => enrolledIds.has(cls.id));
        }
        // Apply filters if not already filtered
        source = getFilteredClasses(source);
    }

    const pagedClasses = source.slice(start, start + pager.pageSize);
    const rows = pagedClasses.map(cls => {
        const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
        const teachers = teacherIds.map(tId => (window.demo.teachers || []).find(t => t.id === tId)).filter(Boolean);
        const teacherNames = teachers.length > 0 ? teachers.map(t => t.fullName).join(', ') : '-';
        return `
            <tr data-id="${cls.id}" data-class-id="${cls.id}">
                <td>${cls.name}</td>
                <td>${cls.type}</td>
                <td>${teacherNames}</td>
                <td>
                    <span class="badge ${cls.status === 'running' ? 'badge-success' : 'badge-muted'}">
                        ${cls.status}
                    </span>
                </td>
                ${canEdit ? `
                    <td>
                        <div class="crud-actions">
                            <button class="btn-edit-icon" onclick="event.stopPropagation(); openClassModal('${cls.id}');" title="Chỉnh sửa lớp">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                            <button class="btn-delete-icon" onclick="event.stopPropagation(); if(confirm('Bạn có chắc muốn xóa lớp này?')) { window.ClassPage.delete('${cls.id}'); } return false;" title="Xóa lớp">
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
    const total = source ? source.length : 0;
    const totalPages = Math.max(1, Math.ceil(total / pager.pageSize));
    const colspan = window.UniUI.hasRole('admin') ? 5 : 4;
    if (!rows) {
        return `
            <tr>
                <td colspan="${colspan}" class="text-center text-muted">Không có lớp phù hợp.</td>
            </tr>
        `;
    }
    const pagerHtml = `
        <tr>
            <td colspan="${colspan}">
                <div class="pagination-container">
                    <button 
                        class="pagination-btn pagination-btn-prev" 
                        ${pager.page<=1?'disabled':''} 
                        onclick="(function(){ window.AppStore.store.dispatch({type: window.AppStore.actions.SET_PAGE, payload:{key:'classes', page: Math.max(1, ${pager.page}-1)}}); renderClasses(); })()"
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
                        onclick="(function(){ window.AppStore.store.dispatch({type: window.AppStore.actions.SET_PAGE, payload:{key:'classes', page: Math.min(${totalPages}, ${pager.page}+1)}}); renderClasses(); })()"
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
 * Attach click handlers to class rows
 */
function attachClassRowClickHandlers() {
    const rows = document.querySelectorAll('#classesTable tbody tr[data-class-id]');
    rows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking pagination buttons or edit icon
            if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.row-edit-icon')) return;
            
            const classId = row.dataset.classId;
            // Navigate to class detail page
            window.UniUI.loadPage(`class-detail:${classId}`);
        });
    });
}

/**
 * Attach filter listeners for classes
 */
function attachClassFilterListeners() {
    // Search input - debounced
    const searchInput = document.getElementById('classSearchInput');
    if (searchInput) {
        let searchTimeout;
        let isUpdating = false;
        
        const handleInput = (e) => {
            classFilterState.search = e.target.value;
            
            // Update clear button visibility
            const wrapper = searchInput.closest('.search-input-wrapper');
            if (wrapper) {
                const clearBtn = wrapper.querySelector('.search-clear-btn');
                if (e.target.value) {
                    if (!clearBtn) {
                        const btn = document.createElement('button');
                        btn.className = 'search-clear-btn';
                        btn.onclick = clearClassSearch;
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
            if (isUpdating) return;
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (window.AppStore?.store) {
                    window.AppStore.store.dispatch({
                        type: window.AppStore.actions.SET_PAGE,
                        payload: { key: 'classes', page: 1 }
                    });
                }
                renderClasses();
            }, 300);
        };
        
        searchInput.removeEventListener('input', handleInput);
        searchInput.addEventListener('input', handleInput);
    }
    
    // Type filter
    const typeFilter = document.getElementById('classTypeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', (e) => {
            classFilterState.type = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'classes', page: 1 }
                });
            }
            renderClasses();
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('classStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            classFilterState.status = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'classes', page: 1 }
                });
            }
            renderClasses();
        });
    }
}

/**
 * Clear class search
 */
function clearClassSearch() {
    classFilterState.search = '';
    if (window.AppStore?.store) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'classes', page: 1 }
        });
    }
    renderClasses();
}

/**
 * Reset all class filters
 */
function resetClassFilters() {
    classFilterState = {
        search: '',
        type: 'all',
        status: 'all'
    };
    if (window.AppStore?.store) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'classes', page: 1 }
        });
    }
    renderClasses();
}

// Export functions to global scope
window.clearClassSearch = clearClassSearch;
window.resetClassFilters = resetClassFilters;

/**
 * Render class detail page
 */
async function renderClassDetail(classId) {
    // Initialize listeners and try optimistic loading
    const pageKey = `class-detail-${classId}`;
    if (!window[`__classDetailListenersInitialized_${classId}`]) {
        window.UniData?.initPageListeners?.(pageKey, () => renderClassDetail(classId), [
            'classes', 'teachers', 'students', 'sessions', 'studentClasses', 'attendance'
        ]);
        window[`__classDetailListenersInitialized_${classId}`] = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    // Check if window.demo is empty OR if current class is missing teacherIds (even if classTeachers exists)
    const hasWindowDemo = window.demo && Object.keys(window.demo).length > 0;
    const hasClassTeachers = Array.isArray(window.demo?.classTeachers) && window.demo.classTeachers.length > 0;
    const currentClass = window.demo?.classes?.find(c => c.id === classId);
    const hasTeacherIds = currentClass && Array.isArray(currentClass.teacherIds) && currentClass.teacherIds.length > 0;
    
    // CRITICAL: If we have classTeachers but current class doesn't have teacherIds, 
    // we need to convert classTeachers → teacherIds (either from cache or by converting)
    const needsCacheLoad = !hasWindowDemo || (!hasClassTeachers && !hasTeacherIds);
    const needsConversion = hasClassTeachers && !hasTeacherIds && currentClass;
    
    if (needsCacheLoad) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            // Hide spinner immediately when cache loads
            if (window.UniData && typeof window.UniData.hideSpinnerIfLoaded === 'function') {
                window.UniData.hideSpinnerIfLoaded();
            }
            setTimeout(() => renderClassDetail(classId), 10);
            return;
        } else {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderClassDetail(classId), 120);
            return;
        }
    } else if (needsConversion) {
        // We have classTeachers but current class doesn't have teacherIds - convert immediately
        // Check if conversion was already done by applyDataSnapshot to avoid duplicate work
        const conversionFlagKey = `__teacherIdsConverted_${classId}`;
        if (!window[conversionFlagKey]) {
            const classTeachers = window.demo.classTeachers;
            const teacherIds = classTeachers
                .filter(ct => ct.class_id === classId || ct.classId === classId)
                .map(ct => ct.teacher_id || ct.teacherId)
                .filter(Boolean);
            
            // Build customTeacherAllowances
            const customTeacherAllowances = {};
            classTeachers
                .filter(ct => (ct.class_id === classId || ct.classId === classId) && (ct.custom_allowance || ct.customAllowance))
                .forEach(ct => {
                    const teacherId = ct.teacher_id || ct.teacherId;
                    if (teacherId) {
                        const allowance = ct.custom_allowance || ct.customAllowance;
                        if (allowance !== null && allowance !== undefined) {
                            customTeacherAllowances[teacherId] = allowance;
                        }
                    }
                });
            
            // Merge with existing
            if (currentClass.customTeacherAllowances && typeof currentClass.customTeacherAllowances === 'object') {
                Object.keys(currentClass.customTeacherAllowances).forEach(teacherId => {
                    if (currentClass.customTeacherAllowances[teacherId] !== null && 
                        currentClass.customTeacherAllowances[teacherId] !== undefined) {
                        if (!customTeacherAllowances.hasOwnProperty(teacherId)) {
                            customTeacherAllowances[teacherId] = currentClass.customTeacherAllowances[teacherId];
                        }
                    }
                });
            }
            
            // Update in-place
            currentClass.teacherIds = teacherIds.length > 0 ? teacherIds : (currentClass.teacherId ? [currentClass.teacherId] : []);
            currentClass.customTeacherAllowances = customTeacherAllowances;
            
            // Mark as converted to avoid duplicate conversions
            window[conversionFlagKey] = true;
        }
        // Continue to render with converted data (no early return to avoid extra render)
    }
    
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;

    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) {
        mainContent.innerHTML = '<div class="card"><p>Lớp không tồn tại</p></div>';
        return;
    }
    
    // Check if data is still loading to show skeleton
    const isDataLoading = !window.demo.classes || !Array.isArray(window.demo.teachers) || 
                         !Array.isArray(window.demo.students) || !Array.isArray(window.demo.classTeachers);
    const isLoadingStudents = !Array.isArray(window.demo.students) || window.demo.students.length === 0;
    const isLoadingSessions = !Array.isArray(window.demo.sessions);

    // Đảm bảo sessions được load từ DB trước khi render
    if (!Array.isArray(window.demo.sessions)) {
        window.demo.sessions = [];
    }
    
    // Nếu sessions chưa có dữ liệu, thử load từ DB
    if (window.demo.sessions.length === 0 && window.DatabaseAdapter && window.DatabaseAdapter.load) {
        // Load sessions từ DB nếu chưa có
        window.DatabaseAdapter.load({ 
            preferLocal: false, 
            skipLocal: false, 
            tables: ['sessions'] 
        }).then(data => {
            if (data && Array.isArray(data.sessions)) {
                window.demo.sessions = data.sessions;
                // Refresh UI sau khi load xong
                const container = mainContent.querySelector('#sessions-content');
                if (container) {
                    container.innerHTML = renderSessionsList(classId);
                    // Re-wire controls
                    setTimeout(() => {
                        const monthPrevBtn = mainContent.querySelector('#sessionMonthPrev');
                        const monthNextBtn = mainContent.querySelector('#sessionMonthNext');
                        if (monthPrevBtn && monthNextBtn) {
                            // Controls đã được wire trong setTimeout ở dưới
                        }
                    }, 100);
                }
            }
        }).catch(err => {
            console.warn('[Classes] Failed to load sessions from DB:', err);
            // Fallback to localStorage
            try {
                const stored = localStorage.getItem('unicorns.data');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed.sessions)) {
                        window.demo.sessions = parsed.sessions;
                    }
                }
            } catch (e) {
                console.warn('[Classes] Failed to load sessions from localStorage:', e);
            }
        });
    }

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    if (!currentUser) {
        mainContent.innerHTML = `
            <div class="card">
                <h3>Yêu cầu đăng nhập</h3>
                <p class="text-muted">Vui lòng đăng nhập để xem thông tin lớp học.</p>
                <button class="btn btn-primary mt-2" onclick="window.UniUI.loadPage('home')">Đến trang đăng nhập</button>
            </div>
        `;
        return;
    }

    if (currentUser.role === 'teacher') {
        const teacherIds = Array.isArray(cls.teacherIds)
            ? cls.teacherIds.filter(Boolean)
            : (cls.teacherId ? [cls.teacherId] : []);
        if (!currentUser.linkId || !teacherIds.includes(currentUser.linkId)) {
            mainContent.innerHTML = `
                <div class="card">
                    <h3>Không có quyền truy cập</h3>
                    <p class="text-muted">Bạn không phụ trách lớp <strong>${cls.name}</strong>.</p>
                </div>
            `;
            return;
        }
    }

    if (currentUser.role === 'student') {
        const enrolled = (window.demo.studentClasses || []).some(record => record.studentId === currentUser.linkId && record.classId === classId && record.status !== 'inactive');
        if (!enrolled) {
            mainContent.innerHTML = `
                <div class="card">
                    <h3>Không có quyền truy cập</h3>
                    <p class="text-muted">Lớp <strong>${cls.name}</strong> không thuộc danh sách bạn đang tham gia.</p>
                </div>
            `;
            return;
        }
    }

    // Get students list - this should reflect the current state of window.demo.studentClasses
    // Force a fresh read - don't use cached results
    const allStudentClasses = (window.demo.studentClasses || []).filter(sc => 
        sc.classId === classId && sc.status !== 'inactive'
    );
    
    // Get unique student IDs from studentClasses records
    const studentIds = [...new Set(allStudentClasses.map(sc => sc.studentId))];
    
    // Map to actual student objects, filtering out any null/undefined
    const students = studentIds
        .map(studentId => (window.demo.students || []).find(s => s.id === studentId))
        .filter(Boolean);
    
    // Log for debugging
    // Students data processed
    
    // Additional verification: if we found studentClass records but no students, log a warning
    if (allStudentClasses.length > 0 && students.length === 0) {
        console.warn(`[renderClassDetail] WARNING: Found ${allStudentClasses.length} studentClass records but 0 students. Student IDs:`, studentIds);
    }
    
    const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
    const teachers = teacherIds.map(tId => (window.demo.teachers || []).find(t => t.id === tId)).filter(Boolean);
    
    // [DEBUG] Log teacher data state
    const teacherDataState = {
        timestamp: Date.now(),
        classId: classId,
        teacherIds: teacherIds,
        teacherIdsCount: teacherIds.length,
        teachersArrayExists: Array.isArray(window.demo.teachers),
        teachersArrayLength: Array.isArray(window.demo.teachers) ? window.demo.teachers.length : 0,
        teachersFound: teachers.length,
        classTeachersExists: Array.isArray(window.demo.classTeachers),
        classTeachersLength: Array.isArray(window.demo.classTeachers) ? window.demo.classTeachers.length : 0,
        pendingDataChange: window.__pendingDataChange,
        windowDemoKeys: Object.keys(window.demo || {})
    };
    // Teacher data state checked
    
    // Check if teachers data is still loading
    // Loading when:
    // 1. teachers array doesn't exist yet AND we're actively loading from Supabase
    // 2. We have teacherIds but can't find teachers AND we're actively loading from Supabase AND classTeachers doesn't exist
    // IMPORTANT: Don't show loading if we have cache data - show it immediately even if incomplete
    // Only show loading if we're actively waiting for Supabase AND don't have cache data
    const hasCacheData = Array.isArray(window.demo.teachers) && window.demo.teachers.length > 0;
    const isActivelyLoading = window.__pendingDataChange && !hasCacheData;
    const isTeachersLoading = (!Array.isArray(window.demo.teachers) && isActivelyLoading) || 
        (teacherIds.length > 0 && teachers.length === 0 && isActivelyLoading && !window.demo.classTeachers);
    
    // Loading state determined
    const isAdmin = window.UniUI.hasRole('admin');
    const isTeacherViewer = currentUser.role === 'teacher';
    const isStudentViewer = currentUser.role === 'student';
    const showClassFinancialDetails = !isTeacherViewer && !isStudentViewer;
    const canManage = isAdmin || window.UniUI.isOwnerTeacherOfClass(classId);
    const canManageTeacherList = isAdmin;
    const canManageStudents = isAdmin;
    const cskhPrivileges = window.UniUI.userHasStaffRole?.('cskh_sale');
    const canSelectSessions = canManage || cskhPrivileges;
    const showTeacherFinancial = isAdmin;
    
    const defaultSalary = cls.tuitionPerSession || 0;
    const scaleAmount = cls.scaleAmount || 0;
    const defaultPackageTotal = cls.tuitionPackageTotal || 0;
    const defaultPackageSessions = cls.tuitionPackageSessions || 0;
    const defaultStudentUnit = cls.studentTuitionPerSession || (defaultPackageTotal > 0 && defaultPackageSessions > 0 ? defaultPackageTotal / defaultPackageSessions : 0);
    const customAllowances = cls.customTeacherAllowances || {};
    const classSessions = (window.demo.sessions || []).filter(s => s.classId === classId);

    const formatAllowance = (amount) => window.UniData.formatCurrency ? window.UniData.formatCurrency(amount || 0) : `${(amount || 0).toLocaleString('vi-VN')} đ`;

    const teacherNameClass = isTeacherViewer ? 'teacher-col-name' : 'teacher-col-name teacher-name-link';
    const teacherNameAttrs = isTeacherViewer ? '' : ' role="button" tabindex="0"';

    const teacherStats = teachers.map(teacher => {
        const allowance = customAllowances[teacher.id] ?? defaultSalary;
        const totalReceived = classSessions
            .filter(session => session.teacherId === teacher.id)
            .reduce((sum, session) => {
                const allowanceAmount = typeof session.allowanceAmount === 'number'
                    ? session.allowanceAmount
                    : window.UniData.computeSessionAllowance ? window.UniData.computeSessionAllowance(session) : 0;
                return sum + allowanceAmount;
            }, 0);
        return { teacher, allowance, totalReceived };
    });

    const breadcrumb = window.UniComponents?.breadcrumb([
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Lớp học', page: 'classes' },
        { label: cls.name, page: `class-detail:${classId}` }
    ]) || '';

    const canEdit = window.UniUI.hasRole('admin');
    const statusLabel = cls.status === 'running' ? 'Đang hoạt động' : 'Tạm dừng';
    const statusClass = cls.status === 'running' ? 'running' : 'inactive';
    
    mainContent.className = 'class-detail-page';
    mainContent.innerHTML = `
        ${breadcrumb}
        <div class="class-detail-header">
            <div class="class-detail-header-content">
                <div class="class-detail-title-row">
                    <h1 class="class-detail-title">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                        ${cls.name}
                    </h1>
                    ${canEdit ? `
                        <button class="btn-icon class-edit-icon" onclick="openClassModal('${classId}')" title="Chỉnh sửa lớp">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <div class="class-detail-meta">
                    <div class="class-detail-meta-item">
                        <span class="class-detail-status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="class-detail-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                        <span>${cls.type || 'Lớp học'}</span>
                    </div>
                    ${showClassFinancialDetails ? `
                        ${defaultSalary > 0 ? `
                            <div class="class-detail-meta-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                                <span>Trợ cấp: ${formatAllowance(defaultSalary)}/hệ số</span>
                            </div>
                        ` : ''}
                        ${defaultStudentUnit > 0 ? `
                            <div class="class-detail-meta-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 6v6l4 2"></path>
                                </svg>
                                <span>Học phí: ${formatAllowance(defaultStudentUnit)}/buổi</span>
                            </div>
                        ` : ''}
                        ${(defaultPackageTotal > 0 && defaultPackageSessions > 0) ? `
                            <div class="class-detail-meta-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="9" y1="3" x2="9" y2="21"></line>
                                </svg>
                                <span>Gói: ${formatAllowance(defaultPackageTotal)} / ${defaultPackageSessions} buổi</span>
                            </div>
                        ` : ''}
                        ${scaleAmount > 0 ? `
                            <div class="class-detail-meta-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                </svg>
                                <span>Scale: ${formatAllowance(scaleAmount)}</span>
                            </div>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
            <div class="class-detail-header-actions">
                <button class="btn btn-outline" onclick="window.UniUI.loadPage('classes')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    Quay lại
                </button>
            </div>
        </div>

        <div class="class-detail-cards-grid">
            <div class="class-detail-card teacher-card">
                <div class="class-detail-card-header">
                    <h3 class="class-detail-card-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Gia sư phụ trách
                    </h3>
                    ${canManageTeacherList ? `
                        <button class="btn btn-sm" id="editTeacherBtn" title="Chỉnh sửa danh sách gia sư">Chỉnh sửa</button>
                    ` : ''}
                </div>
                ${scaleAmount > 0 && showTeacherFinancial ? `
                    <div class="class-detail-stat-item" style="margin-bottom: var(--spacing-3);">
                        <div class="class-detail-stat-label">Tiền scale</div>
                        <div class="class-detail-stat-value">${window.UniData.formatCurrency(scaleAmount)}</div>
                    </div>
                ` : ''}
                ${(() => {
                    // [DEBUG] Log render decision
                    const renderDecision = {
                        timestamp: Date.now(),
                        isTeachersLoading,
                        teacherStatsLength: teacherStats.length,
                        willShowLoading: isTeachersLoading,
                        willShowList: !isTeachersLoading && teacherStats.length > 0,
                        willShowEmpty: !isTeachersLoading && teacherStats.length === 0
                    };
                    // Render decision made
                    return '';
                })()}
                ${isTeachersLoading || (isDataLoading && !teacherStats.length) ? `
                    <div class="class-detail-skeleton">
                        <div class="skeleton-item skeleton-line" style="height: 24px; width: 60%; margin-bottom: 16px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 80%; margin-bottom: 12px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 70%;"></div>
                    </div>
                ` : teacherStats.length > 0 ? `
                    <div class="teacher-list ${showTeacherFinancial ? '' : 'teacher-list-basic'}">
                        ${showTeacherFinancial ? `
                            <div class="teacher-row teacher-row-header">
                                <span class="teacher-col-name text-muted">Tên gia sư</span>
                                <span class="teacher-col-allowance text-muted">Trợ cấp</span>
                                <span class="teacher-col-total text-muted">Tổng nhận</span>
                            </div>
                        ` : ''}
                        ${teacherStats.map(({ teacher, allowance, totalReceived }) => {
                            const contacts = [teacher.phone, teacher.gmail].filter(Boolean).join(' • ');
                            if (showTeacherFinancial) {
                return `
                                    <div class="teacher-row${isTeacherViewer ? '' : ' teacher-row-clickable'}" data-teacher-id="${teacher.id}">
                                        <span class="${teacherNameClass}"${teacherNameAttrs}>${teacher.fullName}</span>
                                        <span class="teacher-col-allowance">
                                            ${canManageTeacherList ? `
                                                <button type="button" class="teacher-allowance" data-teacher-id="${teacher.id}" title="Chỉnh sửa trợ cấp">
                                                    ${formatAllowance(allowance)}
                                                </button>
                                            ` : `
                                                <span>${formatAllowance(allowance)}</span>
                                            `}
                            </span>
                                        <span class="teacher-col-total">${window.UniData.formatCurrency(totalReceived)}</span>
                                    </div>
                                `;
                            }
                            return `
                                <div class="teacher-row teacher-row-compact${isTeacherViewer ? '' : ' teacher-row-clickable'}" data-teacher-id="${teacher.id}">
                                    <span class="${teacherNameClass}"${teacherNameAttrs}>${teacher.fullName}</span>
                                    ${contacts ? `<div class="teacher-col-info text-muted">${contacts}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <div class="class-detail-empty-state">
                        <div class="class-detail-empty-state-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <p>Chưa có gia sư</p>
                    </div>
                `}
            </div>

            <div class="class-detail-card schedule-card">
                <div class="class-detail-card-header">
                    <h3 class="class-detail-card-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Lịch học
                    </h3>
                    ${canManage ? `
                        <button class="btn btn-sm schedule-edit-btn" id="editScheduleBtn" style="opacity: 0; transition: opacity 0.2s ease-in-out;" title="Chỉnh sửa lịch học">Chỉnh sửa</button>
                    ` : ''}
                </div>
                ${isDataLoading ? `
                    <div class="class-detail-skeleton">
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 100%; margin-bottom: 12px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 90%; margin-bottom: 12px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 85%;"></div>
                    </div>
                ` : (cls.schedule||[]).length ? `
                    <ul class="class-detail-schedule-list">
                        ${cls.schedule.map(s => `
                            <li class="class-detail-schedule-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span><strong>${s.day}</strong> • ${s.time}</span>
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <div class="class-detail-empty-state">
                        <div class="class-detail-empty-state-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <p>Chưa có lịch học</p>
                    </div>
                `}
            </div>
        </div>

        <div class="class-detail-section">
            <div class="class-detail-section-header collapsible-section">
                <div class="section-header">
                    <div class="section-header-main section-collapse-trigger" data-target="students">
                        <h3 class="class-detail-section-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                            Học sinh trong lớp (${students.length}${cls.maxStudents ? `/${cls.maxStudents}` : ''})
                        </h3>
                        <span class="toggle-icon" id="students-toggle-icon">▼</span>
                    </div>
                </div>
            </div>
            <div class="class-detail-section-content section-content" id="students-content">
                ${isLoadingStudents ? `
                    <div class="class-detail-skeleton">
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 40%; margin-bottom: 16px;"></div>
                        <div class="skeleton-item skeleton-table">
                            <div class="skeleton-table-header">
                                <div class="skeleton-line" style="height: 16px; width: 100%;"></div>
                            </div>
                            ${[1, 2, 3, 4, 5].map(() => `
                                <div class="skeleton-table-row">
                                    <div class="skeleton-line" style="height: 16px; width: 25%;"></div>
                                    <div class="skeleton-line" style="height: 16px; width: 20%;"></div>
                                    <div class="skeleton-line" style="height: 16px; width: 20%;"></div>
                                    <div class="skeleton-line" style="height: 16px; width: 15%;"></div>
                                    <div class="skeleton-line" style="height: 16px; width: 15%;"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="flex justify-between items-center mb-4">
                        <span class="text-muted text-sm">Tổng số học sinh: ${students.length}</span>
                        ${canManageStudents ? `
                            <div class="flex gap-2">
                                <button class="session-icon-btn session-icon-btn-primary" id="addExistingStudentBtn" title="Thêm học sinh có sẵn">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 5v14"></path>
                                        <path d="M19 12H5"></path>
                                </svg>
                            </button>
                            </div>
                        ` : ''}
                    </div>
                    ${students.length ? `
                        <div class="table-container" style="border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border);">
                    <table class="table-striped">
                        <thead>
                            <tr style="background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);">
                                <th style="min-width: 180px;">Tên</th>
                                <th style="min-width: 100px;">Năm sinh</th>
                                <th style="min-width: 120px;">Tỉnh</th>
                                <th style="min-width: 120px;">Còn lại</th>
                                <th style="min-width: 120px;">Trạng thái</th>
                                ${canManageStudents ? '<th style="width: 120px; text-align: center;">Thao tác</th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="studentsTableBody">
                    ${students.map(s => {
                                const record = window.UniData?.ensureStudentClassRecord
                                    ? window.UniData.ensureStudentClassRecord(s.id, classId)
                                    : (window.demo.studentClasses || []).find(sc => sc.studentId === s.id && sc.classId === classId);
                                const finance = window.UniData?.describeStudentClassFinancial
                                    ? window.UniData.describeStudentClassFinancial(record)
                                    : null;
                                const remainingSummary = finance
                                    ? `${finance.remaining || 0} buổi`
                                    : '-';
                                const nameCell = canManageStudents
                                    ? `<button class="btn btn-link student-inline-edit" data-student-id="${s.id}">${s.fullName}</button>`
                                    : `<span class="student-name-text">${s.fullName}</span>`;
                                return `
                                    <tr data-student-id="${s.id}" style="transition: all 0.2s ease;">
                                        <td>
                                            <div style="font-weight: 600; color: var(--text);">${nameCell}</div>
                                        </td>
                                        <td>
                                            <span style="color: var(--muted);">${s.birthYear || '-'}</span>
                                        </td>
                                        <td>
                                            <span style="color: var(--muted);">${s.province || '-'}</span>
                                        </td>
                                        <td>
                                            <div style="display: flex; align-items: center; gap: var(--spacing-1);">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <polyline points="12 6 12 12 16 14"></polyline>
                                                </svg>
                                                <span style="font-weight: 500;">${remainingSummary}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-muted'}">
                                                ${s.status === 'active' ? '✓ ' : ''}${s.status === 'active' ? 'Đang học' : 'Tạm dừng'}
                                            </span>
                                        </td>
                                        ${canManageStudents ? `
                                            <td style="text-align: center;">
                                                <div class="flex gap-2" style="justify-content: center;">
                                                    <button class="btn-edit-icon" onclick="openStudentInClass('${s.id}', '${classId}')" title="Sửa thông tin">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                                                    <button class="btn-transfer-icon" onclick="moveStudentToClass('${s.id}', '${classId}')" title="Chuyển học sinh sang lớp khác">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M8 3L4 7l4 4"></path>
                                    <path d="M4 7h16"></path>
                                    <path d="M16 21l4-4-4-4"></path>
                                    <path d="M20 17H4"></path>
                                </svg>
                            </button>
                                                    <button class="btn-delete-icon" onclick="deleteStudentFromClass('${s.id}', '${classId}')" title="Xóa khỏi lớp">
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
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            ` : `
                    <div class="class-detail-empty-state">
                        <div class="class-detail-empty-state-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <p>Chưa có học sinh trong lớp này.</p>
                        ${canManageStudents ? `
                            <button class="btn btn-primary mt-3" onclick="openStudentInClass(null, '${classId}')">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Thêm học sinh đầu tiên
                            </button>
                        ` : ''}
                    </div>
                `}
                `}
            </div>
        </div>

        <div class="class-detail-section">
            <div class="class-detail-section-header collapsible-section">
                <div class="section-header">
                    <div class="section-header-main section-collapse-trigger" data-target="sessions">
                        <h3 class="class-detail-section-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                <path d="M8 7h8"></path>
                                <path d="M8 11h8"></path>
                                <path d="M8 15h4"></path>
                            </svg>
                            Lịch sử buổi học
                        </h3>
                        <span class="toggle-icon" id="sessions-toggle-icon">▼</span>
                    </div>
                </div>
            </div>
            <div class="class-detail-section-content section-content" id="sessions-content">
                ${isLoadingSessions ? `
                    <div class="class-detail-skeleton">
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 30%; margin-bottom: 16px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 16px; width: 100%; margin-bottom: 12px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 16px; width: 95%; margin-bottom: 12px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 16px; width: 90%; margin-bottom: 12px;"></div>
                        <div class="skeleton-item skeleton-line" style="height: 16px; width: 85%;"></div>
                    </div>
                ` : (() => {
                    // Đảm bảo filter được khởi tạo trước khi render
                    window.ClassSessionFilters = window.ClassSessionFilters || {};
                    if (!window.ClassSessionFilters[classId]) {
                        const now = new Date();
                        window.ClassSessionFilters[classId] = {
                            year: String(now.getFullYear()),
                            month: String(now.getMonth() + 1).padStart(2, '0')
                        };
                    }
                    return renderSessionsList(classId);
                })()}
            </div>
        </div>
    `;

    // Wire edit teacher button
    const editTeacherBtn = mainContent.querySelector('#editTeacherBtn');
    if (canManageTeacherList && editTeacherBtn) {
        editTeacherBtn.addEventListener('click', () => openEditTeacherModal(classId));
    }

    // Wire edit schedule button
    const editScheduleBtn = mainContent.querySelector('#editScheduleBtn');
    if (editScheduleBtn) {
        editScheduleBtn.addEventListener('click', () => openEditScheduleModal(classId));
    }

    // Wire teacher rows (disable navigation for teacher-role viewers)
    if (!isTeacherViewer) {
        const teacherRows = mainContent.querySelectorAll('.teacher-row');
        teacherRows.forEach(row => {
            const teacherId = row.dataset.teacherId;
            row.addEventListener('click', () => navigateToTeacherDetail(teacherId));
        });
    }

    if (showTeacherFinancial && canManageTeacherList) {
        const allowanceButtons = mainContent.querySelectorAll('.teacher-allowance');
        allowanceButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const teacherId = button.dataset.teacherId;
                openTeacherAllowanceModal(classId, teacherId, () => renderClassDetail(classId));
            });
        });
    }

    // Student row navigation
    if (!isTeacherViewer && !isStudentViewer) {
        const studentRows = mainContent.querySelectorAll('#studentsTableBody tr[data-student-id]');
        studentRows.forEach(row => {
            const studentId = row.dataset.studentId;
            row.addEventListener('click', () => {
                if (!studentId) return;
                window.UniUI.loadPage(`student-detail:${studentId}`);
            });
        });
    }

    // Inline edit button in name column (open modal)
    if (canManageStudents) {
        const studentInlineButtons = mainContent.querySelectorAll('#studentsTableBody .student-inline-edit');
        studentInlineButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const studentId = button.dataset.studentId;
                if (studentId && typeof window.StudentPage?.openStudentModal === 'function') {
                    window.StudentPage.openStudentModal(studentId, true, classId, () => renderClassDetail(classId));
                } else {
                    openStudentModal(studentId, true, classId, () => renderClassDetail(classId));
                }
            });
        });

        // Prevent other action buttons/links from triggering row navigation
        const studentActionButtons = mainContent.querySelectorAll('#studentsTableBody .btn-edit-icon, #studentsTableBody .btn-transfer-icon, #studentsTableBody .btn-delete-icon, #studentsTableBody button:not(.student-inline-edit)');
        studentActionButtons.forEach(button => {
            button.addEventListener('click', (event) => event.stopPropagation());
        });
    }

    // Wire add student button
    const addBtn = mainContent.querySelector('#addStudentBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openStudentInClass(null, classId);
        });
    }

    // Wire add existing student button
    const addExistingBtn = mainContent.querySelector('#addExistingStudentBtn');
    if (canManageStudents && addExistingBtn) {
        addExistingBtn.addEventListener('click', () => {
            openAddExistingStudentModal(classId);
        });
    }

    // Wire add session button
    const addSessionBtn = mainContent.querySelector('#addSessionBtn');
    if (addSessionBtn) {
        addSessionBtn.addEventListener('click', () => {
            openSessionModal(classId);
        });
    }
    const canOpenBulkStatusModal = window.UniUI.hasRole('admin', 'accountant') || window.UniUI.userHasStaffRole?.('cskh_sale');
    const bulkStatusBtn = canOpenBulkStatusModal ? mainContent.querySelector('#bulkSessionStatusBtn') : null;
    if (bulkStatusBtn) {
        bulkStatusBtn.addEventListener('click', () => {
            openBulkSessionStatusModal(classId);
        });
    }
    
    // Khởi tạo filter ngay khi render để đảm bảo dữ liệu được load đúng
    window.ClassSessionFilters = window.ClassSessionFilters || {};
    if (!window.ClassSessionFilters[classId]) {
        const now = new Date();
        window.ClassSessionFilters[classId] = {
            year: String(now.getFullYear()),
            month: String(now.getMonth() + 1).padStart(2, '0')
        };
    }
    
    // Attach event listeners cho bảng buổi học & thanh chuyển tháng
    setTimeout(() => {
        function wireMonthControls() {
            const monthPrevBtn = mainContent.querySelector('#sessionMonthPrev');
            const monthNextBtn = mainContent.querySelector('#sessionMonthNext');
            const monthLabelBtn = mainContent.querySelector('#sessionMonthLabelBtn');
            const monthPopup = mainContent.querySelector('#sessionMonthPopup');
            const yearLabel = mainContent.querySelector('#sessionYearLabel');
            const yearPrevBtn = mainContent.querySelector('#sessionYearPrev');
            const yearNextBtn = mainContent.querySelector('#sessionYearNext');
            const monthCells = mainContent.querySelectorAll('.session-month-cell');

            if (monthPrevBtn) {
                monthPrevBtn.onclick = () => rerenderMonth(-1);
            }
            if (monthNextBtn) {
                monthNextBtn.onclick = () => rerenderMonth(1);
            }

            if (monthLabelBtn && monthPopup) {
                monthLabelBtn.onclick = () => {
                    const isHidden = monthPopup.style.display === 'none' || monthPopup.style.display === '';
                    monthPopup.style.display = isHidden ? 'block' : 'none';
                };
            }

            if (yearPrevBtn && yearLabel) {
                yearPrevBtn.onclick = () => changeYear(-1);
            }
            if (yearNextBtn && yearLabel) {
                yearNextBtn.onclick = () => changeYear(1);
            }

            monthCells.forEach(cell => {
                cell.onclick = () => {
                    const m = cell.getAttribute('data-month');
                    if (!m) return;
                    const current = window.ClassSessionFilters?.[classId] || {};
                    const y = current.year || String(new Date().getFullYear());
                    window.ClassSessionFilters = window.ClassSessionFilters || {};
                    window.ClassSessionFilters[classId] = {
                        year: String(y),
                        month: String(m).toString().padStart(2, '0')
                    };
                    rerenderMonth(0);
                };
            });

    if (canSelectSessions || canManage) {
        attachSessionsTableListeners(classId);
    }
        }

        function rerenderMonth(delta) {
            window.ClassSessionFilters = window.ClassSessionFilters || {};
            const current = window.ClassSessionFilters[classId] || {};
            let year = parseInt(current.year || String(new Date().getFullYear()), 10);
            let month = parseInt(current.month || String(new Date().getMonth() + 1).padStart(2, '0'), 10);

            if (!Number.isFinite(year) || !Number.isFinite(month)) {
                const now = new Date();
                year = now.getFullYear();
                month = now.getMonth() + 1;
            }

            month += delta;
            if (month < 1) {
                month = 12;
                year -= 1;
            } else if (month > 12) {
                month = 1;
                year += 1;
            }

            window.ClassSessionFilters[classId] = {
                year: String(year),
                month: String(month).toString().padStart(2, '0')
            };

            const container = mainContent.querySelector('#sessions-content');
            if (!container) return;
            container.innerHTML = renderSessionsList(classId);
            wireMonthControls();
        }

        function changeYear(delta) {
            window.ClassSessionFilters = window.ClassSessionFilters || {};
            const current = window.ClassSessionFilters[classId] || {};
            let year = parseInt(current.year || String(new Date().getFullYear()), 10);
            let month = current.month || String(new Date().getMonth() + 1).padStart(2, '0');

            if (!Number.isFinite(year)) {
                year = new Date().getFullYear();
            }

            year += delta;

            window.ClassSessionFilters[classId] = {
                year: String(year),
                month: String(month).toString().padStart(2, '0')
            };

            const container = mainContent.querySelector('#sessions-content');
            if (!container) return;
            container.innerHTML = renderSessionsList(classId);
            wireMonthControls();
        }

        // Lần đầu vào, gắn listener cho tháng + bảng
        wireMonthControls();
        
        // Lắng nghe sự kiện cập nhật dữ liệu từ DB để tự động refresh UI
        function handleDataUpdate(event) {
            const detail = event.detail || {};
            const source = detail.source || '';
            
            // Nếu có update từ Supabase (sessions, classes, hoặc full dataset)
            if (source.includes('supabase') || source.includes('dataset')) {
                const container = mainContent.querySelector('#sessions-content');
                if (container) {
                    // Refresh sessions list để đồng bộ với DB
                    container.innerHTML = renderSessionsList(classId);
                    wireMonthControls();
                }
            }
        }
        
        // Đăng ký listener
        window.addEventListener('UniData:updated', handleDataUpdate);
        window.addEventListener('UniData:dataset-applied', handleDataUpdate);
        
        // Cleanup khi rời khỏi trang
        const cleanup = () => {
            window.removeEventListener('UniData:updated', handleDataUpdate);
            window.removeEventListener('UniData:dataset-applied', handleDataUpdate);
        };
        
        // Lưu cleanup function để có thể gọi sau
        if (!window._classDetailCleanups) {
            window._classDetailCleanups = new Map();
        }
        const previousCleanup = window._classDetailCleanups.get(classId);
        if (previousCleanup) {
            previousCleanup();
        }
        window._classDetailCleanups.set(classId, cleanup);
    }, 100);
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.(pageKey, [
        'classes', 'teachers', 'students', 'sessions', 'studentClasses', 'attendance'
    ]);
}

/**
 * Open edit teacher modal
 */
// Helper function to refresh teacher detail pages
function refreshTeacherDetailPages(teacherIds) {
    if (!teacherIds || teacherIds.size === 0) return;
    
    // Get current page from URL hash
    const currentPage = window.UniUI?.getCurrentPageName ? window.UniUI.getCurrentPageName() : 
                       (window.location.hash ? window.location.hash.slice(1) : '');
    
    teacherIds.forEach(teacherId => {
        // Check if we're currently viewing this teacher's detail page
        const isTeacherDetailPage = currentPage && (
            currentPage.startsWith(`teacher-detail:${teacherId}`) || 
            currentPage.startsWith(`staff-detail:${teacherId}`)
        );
        
        if (isTeacherDetailPage) {
            // Refresh the staff detail page
            if (typeof renderStaffDetail === 'function') {
                renderStaffDetail(teacherId);
            }
        }
    });
}

function openEditTeacherModal(classId) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return;

    const currentTeacherIds = new Set(cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []));
    const teachers = (window.demo.teachers || []).filter(t => {
        const roles = Array.isArray(t.roles) ? t.roles : [];
        return roles.includes('teacher') || roles.length === 0;
    });

    const form = document.createElement('div');
    form.className = 'grid gap-4';
    form.innerHTML = `
        <div>
            <h4 class="mb-2">Gia sư đang dạy lớp</h4>
            <div id="classTeacherList" class="stacked-list">
                ${teachers.filter(t => currentTeacherIds.has(t.id)).map(t => `
                    <div class="stacked-list-item" data-teacher-id="${t.id}">
                        <span>${t.fullName}</span>
                        <button class="btn-delete-icon btn-delete-teacher" data-teacher-id="${t.id}" title="Gỡ khỏi lớp">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `).join('') || '<p class="text-muted text-sm">Chưa có gia sư nào trong lớp.</p>'}
            </div>
        </div>
        <div>
            <h4 class="mb-2">Thêm gia sư mới</h4>
            <div class="form-group">
                <label for="teacherSearch">Tìm gia sư</label>
                <input type="search" id="teacherSearch" class="form-control" placeholder="Nhập tên gia sư ...">
                <div id="teacherSearchResults" class="search-dropdown"></div>
            </div>
        </div>
        <div class="form-actions mt-2">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Đóng</button>
        </div>
    `;

    function syncTeachers(updatedIds) {
        const updatedArray = Array.from(updatedIds);
        // Save previous teacher IDs before updating
        const previousIds = new Set(cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []));
        const currentAllowances = { ...(cls.customTeacherAllowances || {}) };
        
        // Build updated allowances: keep existing + add new teachers with default value
        const updatedAllowances = {};
        const defaultAllowance = cls.tuitionPerSession || 0;
        
        updatedArray.forEach(teacherId => {
            // If teacher already has an allowance entry, keep it
            if (currentAllowances.hasOwnProperty(teacherId) && 
                currentAllowances[teacherId] !== null && 
                currentAllowances[teacherId] !== undefined) {
                updatedAllowances[teacherId] = currentAllowances[teacherId];
            } else {
                // New teacher: add with default allowance
                updatedAllowances[teacherId] = defaultAllowance;
                console.log(`[syncTeachers] ✅ Added new teacher ${teacherId} to customTeacherAllowances with default: ${defaultAllowance}`);
            }
        });
        
        // IMPORTANT: Also keep allowances for removed teachers (for history tracking)
        // This ensures classes still show as "Dừng" even after teacher is removed
        Object.keys(currentAllowances).forEach(teacherId => {
            // If teacher was removed but has an allowance entry, keep it for history
            if (!updatedArray.includes(teacherId) && 
                currentAllowances[teacherId] !== null && 
                currentAllowances[teacherId] !== undefined) {
                updatedAllowances[teacherId] = currentAllowances[teacherId];
                console.log(`[syncTeachers] ✅ Kept allowance entry for removed teacher ${teacherId} (for history tracking)`);
            }
        });

        console.log(`[syncTeachers] Updating class ${classId}:`, {
            teacherIds: updatedArray,
            customTeacherAllowances: updatedAllowances,
            newTeachers: updatedArray.filter(id => !previousIds.has(id)),
            removedTeachers: Array.from(previousIds).filter(id => !updatedIds.has(id))
        });

        window.UniLogic.updateEntity('class', classId, {
            teacherIds: updatedArray,
            customTeacherAllowances: updatedAllowances
        });

        renderClassDetail(classId);
        
        // Refresh teacher detail pages for affected teachers
        // Include both previous and new teacher IDs
        const affectedTeacherIds = new Set([...previousIds, ...updatedIds]);
        
        // Get current page from URL hash
        const currentPage = window.UniUI?.getCurrentPageName ? window.UniUI.getCurrentPageName() : 
                           (window.location.hash ? window.location.hash.slice(1) : '');
        
        affectedTeacherIds.forEach(teacherId => {
            // Check if we're currently viewing this teacher's detail page
            const isTeacherDetailPage = currentPage && (
                currentPage.startsWith(`teacher-detail:${teacherId}`) || 
                currentPage.startsWith(`staff-detail:${teacherId}`)
            );
            
            if (isTeacherDetailPage) {
                // Refresh the staff detail page
                if (typeof renderStaffDetail === 'function') {
                    renderStaffDetail(teacherId);
                }
            }
        });
    }

    function renderTeacherList() {
        const list = form.querySelector('#classTeacherList');
        const items = teachers.filter(t => currentTeacherIds.has(t.id));
        list.innerHTML = items.length
            ? items.map(t => `
                <div class="stacked-list-item" data-teacher-id="${t.id}">
                    <span>${t.fullName}</span>
                    <button class="btn-delete-icon btn-delete-teacher" data-teacher-id="${t.id}" title="Gỡ khỏi lớp">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `).join('')
            : '<p class="text-muted text-sm">Chưa có gia sư nào trong lớp.</p>';
    }

    function renderSearchResults(query = '') {
        const resultsContainer = form.querySelector('#teacherSearchResults');
        const normalized = query.trim().toLowerCase();
        const availableTeachers = teachers.filter(t => !currentTeacherIds.has(t.id));
        const source = normalized
            ? availableTeachers.filter(t => t.fullName.toLowerCase().includes(normalized))
            : availableTeachers.slice(0, 6);

        if (!source.length) {
            resultsContainer.innerHTML = '<div class="search-empty text-muted">Không tìm thấy gia sư phù hợp.</div>';
            resultsContainer.classList.add('visible');
            return;
        }

        resultsContainer.innerHTML = source.map(t => `
            <button type="button" class="search-item" data-teacher-id="${t.id}">${t.fullName}</button>
        `).join('');
        resultsContainer.classList.add('visible');
    }

    form.addEventListener('click', (event) => {
        const deleteBtn = event.target.closest('.btn-delete-teacher');
        if (deleteBtn) {
            const teacherId = deleteBtn.dataset.teacherId;
            if (teacherId && currentTeacherIds.has(teacherId)) {
                currentTeacherIds.delete(teacherId);
                syncTeachers(currentTeacherIds);
                renderTeacherList();
                renderSearchResults(form.querySelector('#teacherSearch').value);
                window.UniUI.toast('Đã gỡ gia sư khỏi lớp', 'success');
            }
        }
        const searchItem = event.target.closest('.search-item');
        if (searchItem) {
            const teacherId = searchItem.dataset.teacherId;
            if (teacherId) {
                currentTeacherIds.add(teacherId);
                syncTeachers(currentTeacherIds);
                renderTeacherList();
                form.querySelector('#teacherSearch').value = '';
                renderSearchResults('');
                window.UniUI.toast('Đã thêm gia sư vào lớp', 'success');
            }
        }
    });

    const teacherSearchInput = form.querySelector('#teacherSearch');
    teacherSearchInput.addEventListener('input', (event) => {
        renderSearchResults(event.target.value);
    });
    teacherSearchInput.addEventListener('focus', () => renderSearchResults(teacherSearchInput.value));

    document.addEventListener('click', function handleOutside(event) {
        if (!form.contains(event.target)) {
            const resultsContainer = form.querySelector('#teacherSearchResults');
            if (resultsContainer) {
                resultsContainer.classList.remove('visible');
            }
            document.removeEventListener('click', handleOutside);
        }
    });

    renderTeacherList();
    window.UniUI.openModal('Quản lý gia sư lớp học', form);
}

/**
 * Open edit schedule modal
 */
function openEditScheduleModal(classId) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return;

    const currentSchedule = cls.schedule || [];
    
    const availableTeachers = (window.demo.teachers || []).filter(t => {
        const roles = Array.isArray(t.roles) ? t.roles : [];
        return roles.includes('teacher') || roles.length === 0;
    });

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label>Lịch học hiện tại</label>
            <div id="scheduleList" class="mt-2 space-y-2">
                ${currentSchedule.length > 0 ? currentSchedule.map((s, idx) => `
                    <div class="flex gap-2 items-center" data-schedule-index="${idx}">
                        <select name="day_${idx}" class="form-control" style="flex: 1;" required>
                            <option value="Thứ Hai" ${s.day === 'Thứ Hai' ? 'selected' : ''}>Thứ Hai</option>
                            <option value="Thứ Ba" ${s.day === 'Thứ Ba' ? 'selected' : ''}>Thứ Ba</option>
                            <option value="Thứ Tư" ${s.day === 'Thứ Tư' ? 'selected' : ''}>Thứ Tư</option>
                            <option value="Thứ Năm" ${s.day === 'Thứ Năm' ? 'selected' : ''}>Thứ Năm</option>
                            <option value="Thứ Sáu" ${s.day === 'Thứ Sáu' ? 'selected' : ''}>Thứ Sáu</option>
                            <option value="Thứ Bảy" ${s.day === 'Thứ Bảy' ? 'selected' : ''}>Thứ Bảy</option>
                            <option value="Chủ Nhật" ${s.day === 'Chủ Nhật' ? 'selected' : ''}>Chủ Nhật</option>
                        </select>
                        <input type="time" name="startTime_${idx}" class="form-control" value="${s.time ? s.time.split('-')[0] : ''}" required style="width: 120px;">
                        <span>-</span>
                        <input type="time" name="endTime_${idx}" class="form-control" value="${s.time ? s.time.split('-')[1] : ''}" required style="width: 120px;">
                        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('[data-schedule-index]').remove()">Xóa</button>
                    </div>
                `).join('') : '<p class="text-muted text-sm">Chưa có lịch học</p>'}
            </div>
            <button type="button" class="btn btn-sm mt-2" id="addScheduleItem">+ Thêm lịch học</button>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </div>
    `;

    // Add schedule item
    let scheduleIndex = currentSchedule.length;
    form.querySelector('#addScheduleItem')?.addEventListener('click', () => {
        const scheduleList = form.querySelector('#scheduleList');
        if (scheduleList.querySelector('p.text-muted')) {
            scheduleList.innerHTML = '';
        }
        const newItem = document.createElement('div');
        newItem.className = 'flex gap-2 items-center';
        newItem.setAttribute('data-schedule-index', scheduleIndex);
        newItem.innerHTML = `
            <select name="day_${scheduleIndex}" class="form-control" style="flex: 1;" required>
                <option value="Thứ Hai">Thứ Hai</option>
                <option value="Thứ Ba">Thứ Ba</option>
                <option value="Thứ Tư">Thứ Tư</option>
                <option value="Thứ Năm">Thứ Năm</option>
                <option value="Thứ Sáu">Thứ Sáu</option>
                <option value="Thứ Bảy">Thứ Bảy</option>
                <option value="Chủ Nhật">Chủ Nhật</option>
            </select>
            <input type="time" name="startTime_${scheduleIndex}" class="form-control" required style="width: 120px;">
            <span>-</span>
            <input type="time" name="endTime_${scheduleIndex}" class="form-control" required style="width: 120px;">
            <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('[data-schedule-index]').remove()">Xóa</button>
        `;
        scheduleList.appendChild(newItem);
        scheduleIndex++;
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        
        const schedule = [];
        const scheduleItems = form.querySelectorAll('[data-schedule-index]');
        
        scheduleItems.forEach(item => {
            const day = formData.get(`day_${item.dataset.scheduleIndex}`);
            const startTime = formData.get(`startTime_${item.dataset.scheduleIndex}`);
            const endTime = formData.get(`endTime_${item.dataset.scheduleIndex}`);
            
            if (day && startTime && endTime) {
                schedule.push({
                    day: day,
                    time: `${startTime}-${endTime}`
                });
            }
        });
        
        // Lấy dữ liệu cũ trước khi update
        const cls = window.demo.classes.find(c => c.id === classId);
        const oldSchedule = cls ? (cls.schedule || []) : [];
        
        window.UniLogic.updateEntity('class', classId, { schedule });
        
        // Ghi lại hành động chỉnh sửa lịch học
        if (window.ActionHistoryService && cls) {
            const updatedClass = window.demo.classes.find(c => c.id === classId);
            window.ActionHistoryService.recordAction({
                entityType: 'class',
                entityId: classId,
                actionType: 'update',
                beforeValue: { ...cls, schedule: oldSchedule },
                afterValue: updatedClass,
                changedFields: { schedule: { before: oldSchedule, after: schedule } },
                description: `Cập nhật lịch học lớp: ${cls.name || classId}`
            });
        }
        
        window.UniUI.closeModal();
        renderClassDetail(classId);
        window.UniUI.toast('Đã cập nhật lịch học', 'success');
    });

    window.UniUI.openModal('Chỉnh sửa lịch học', form);
}

/**
 * Open teacher allowance modal
 */
function openTeacherAllowanceModal(classId, teacherId, onSaved) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return;

    const teacher = (window.demo.teachers || []).find(t => t.id === teacherId);
    if (!teacher) return;

    const defaultSalary = cls.tuitionPerSession || 0;
    const customAllowances = cls.customTeacherAllowances || {};
    const currentSalary = customAllowances[teacherId] ?? defaultSalary;

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="salaryInput">Trợ cấp / hệ số (đ) - ${teacher.fullName}</label>
            <input 
                type="text" 
                inputmode="numeric"
                id="salaryInput" 
                name="salary" 
                class="form-control" 
                value="${currentSalary}"
                placeholder="Nhập trợ cấp"
                required
            >
            <div class="text-muted text-sm mt-1">Trợ cấp mặc định: ${window.UniData.formatCurrency(defaultSalary).replace('₫','đ')}</div>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </div>
    `;

    const salaryInput = form.querySelector('#salaryInput');
    if (salaryInput) {
        window.UniUI.attachCurrencyInput(salaryInput, { required: true });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const salaryValue = window.UniUI.getCurrencyValue(salaryInput);
        if (salaryValue <= 0) {
            window.UniUI.toast('Vui lòng nhập trợ cấp hợp lệ', 'error');
            return;
        }

        const allowances = { ...(cls.customTeacherAllowances || {}) };

        if (salaryValue === defaultSalary) {
            delete allowances[teacherId];
        } else {
            allowances[teacherId] = salaryValue;
        }

        const payload = { customTeacherAllowances: Object.keys(allowances).length ? allowances : null };
        window.UniLogic.updateEntity('class', classId, payload);
        window.UniUI.closeModal();
        if (typeof onSaved === 'function') {
            onSaved();
        } else {
            renderClassDetail(classId);
        }
        window.UniUI.toast('Đã cập nhật trợ cấp', 'success');
    });

    window.UniUI.openModal('Chỉnh sửa trợ cấp gia sư', form);
}

function navigateToTeacherDetail(teacherId) {
    if (!teacherId) return;
    window.UniUI.loadPage(`staff-detail:${teacherId}`);
}

/**
 * Open student modal for add/edit in class context
 */
function openStudentInClass(studentId, classId) {
    window.StudentPage.openStudentModal(studentId, true, classId, () => {
        renderClassDetail(classId);
    });
}

/**
 * Delete student from class (remove from class, not delete completely)
 */
function handleStudentClassRemoval(studentId, classId, options = {}) {
    const { reason, updatePrimaryClass = true } = options;
    const result = {
        removedRecord: null,
        supabaseEntities: {},
        supabaseDeletes: null,
        refundAmount: 0
    };
    
    // Ensure studentClasses array exists
    if (!window.demo.studentClasses) {
        window.demo.studentClasses = [];
    }
    
    const records = window.demo.studentClasses;
    const recordIndex = records.findIndex(sc => sc.studentId === studentId && sc.classId === classId);
    if (recordIndex === -1) {
        console.warn(`[handleStudentClassRemoval] No studentClass record found for student ${studentId} in class ${classId}`);
        return result;
    }

    const record = records[recordIndex];
    const cls = (window.demo.classes || []).find(c => c.id === classId) || null;
    const remainingSessions = Math.max(0, Number(record.remainingSessions || 0));
    let targetStudent = (window.demo.students || []).find(s => s.id === studentId) || null;
    let studentModified = false;

    let refundAmount = 0;
    if (remainingSessions > 0) {
        const unitPrice = window.UniData.getStudentFeePerSession
            ? window.UniData.getStudentFeePerSession(record)
            : 0;
        if (unitPrice > 0) {
            refundAmount = Math.round(unitPrice * remainingSessions);
            const adjustedStudent = window.UniData.adjustStudentWallet(studentId, refundAmount);
            if (adjustedStudent) {
                targetStudent = adjustedStudent;
                studentModified = true;
                window.demo.payments = window.demo.payments || [];
                const paymentRecord = {
                    id: window.UniData.generateId ? window.UniData.generateId('payment') : ('P' + Math.random().toString(36).slice(2, 8).toUpperCase()),
                    studentId,
                    classId,
                    amount: refundAmount,
                    status: 'refund',
                    date: new Date().toISOString().slice(0, 10),
                    note: reason || `Hoàn trả do rời lớp ${cls ? cls.name : classId}`
                };
                window.demo.payments.push(paymentRecord);
                result.paymentRecord = paymentRecord;
            }
        }
    }

    // Remove the record from studentClasses array IMMEDIATELY
    // This mutates window.demo.studentClasses directly since records is a reference
    const removedRecord = records.splice(recordIndex, 1)[0];
    result.removedRecord = removedRecord;

    // Verify removal (for debugging)
    const stillExists = records.findIndex(sc => sc.studentId === studentId && sc.classId === classId) !== -1;
    if (stillExists) {
        console.error(`[handleStudentClassRemoval] ERROR: Record still exists after removal! This should not happen.`);
    } else {
        console.log(`[handleStudentClassRemoval] Successfully removed studentClass record ${removedRecord?.id} for student ${studentId} from class ${classId}`);
    }

    // Update student's classId to sync with all active classes
    if (targetStudent && updatePrimaryClass) {
        // Sync classId with all remaining active classes
        if (window.UniData && typeof window.UniData.syncStudentClassId === 'function') {
            const syncedClassId = window.UniData.syncStudentClassId(studentId);
            if (syncedClassId !== targetStudent.classId) {
            studentModified = true;
            }
        } else {
            // Fallback: Get all remaining active classes
            const remainingClasses = (window.demo.studentClasses || []).filter(sc => 
                sc.studentId === studentId && sc.status !== 'inactive'
            );
            const classIds = remainingClasses.map(sc => sc.classId).filter(Boolean);
            const newClassId = classIds.length > 0 ? classIds : null;
            
            // Update if changed
            const currentClassId = targetStudent.classId;
            const currentClassIdArray = Array.isArray(currentClassId) 
                ? currentClassId 
                : (currentClassId ? [currentClassId] : []);
            
            const currentSet = new Set(currentClassIdArray);
            const newSet = new Set(classIds);
            
            if (currentSet.size !== newSet.size || !classIds.every(id => currentSet.has(id))) {
                console.log(`[handleStudentClassRemoval] Updating student ${studentId} classId from [${currentClassIdArray.join(', ')}] to [${classIds.join(', ')}]`);
                targetStudent.classId = newClassId;
                studentModified = true;
            }
        }
    }

    if (studentModified && targetStudent) {
        // IMPORTANT: Do NOT save classId to database (it's memory-only, synced from studentClasses)
        // classId will be synced automatically when loading from DB
        // Only save student if there are other changes (like wallet balance)
        const studentToSave = { ...targetStudent };
        delete studentToSave.classId; // Remove classId to avoid foreign key constraint issues
        result.supabaseEntities.students = [studentToSave];
    }
    if (result.paymentRecord) {
        result.supabaseEntities.payments = [
            ...(result.supabaseEntities.payments || []),
            result.paymentRecord
        ];
    }
    if (result.removedRecord && result.removedRecord.id) {
        result.supabaseDeletes = { studentClasses: [result.removedRecord.id] };
    }
    result.refundAmount = refundAmount;
    return result;
}

async function deleteStudentFromClass(studentId, classId) {
    if (confirm('Xóa học sinh này khỏi lớp? (Học sinh sẽ không bị xóa hoàn toàn, chỉ được gỡ khỏi lớp này)')) {
        try {
            const cls = (window.demo.classes || []).find(c => c.id === classId) || null;
            const student = (window.demo.students || []).find(s => s.id === studentId);
            
            let removalResult = null;
            
            // Use optimistic update pattern
            await window.UniData.withOptimisticUpdate(
                () => {
                    // 1. Update local data immediately (optimistic)
                    removalResult = handleStudentClassRemoval(studentId, classId, {
                reason: `Hoàn trả do xóa khỏi lớp ${cls ? cls.name : classId}`,
                updatePrimaryClass: true
            });

                    if (!removalResult.removedRecord) {
                        throw new Error('Không tìm thấy lớp để xóa');
                    }

                    // 2. Verify removal completed before refreshing UI
                    // Ensure the record is actually removed from window.demo.studentClasses
                    const verifyRemoved = () => {
                        const remainingRecords = (window.demo.studentClasses || []).filter(
                            sc => sc.studentId === studentId && sc.classId === classId
                        );
                        return remainingRecords.length === 0;
                    };
                    
                    if (!verifyRemoved()) {
                        console.error('[deleteStudentFromClass] Verification failed: Record still exists after removal');
                        // Force removal again
                        const records = window.demo.studentClasses || [];
                        const remainingIndex = records.findIndex(sc => sc.studentId === studentId && sc.classId === classId);
                        if (remainingIndex !== -1) {
                            records.splice(remainingIndex, 1);
                            console.log('[deleteStudentFromClass] Force removed remaining record');
                        }
                    } else {
                        console.log('[deleteStudentFromClass] Verified: Record successfully removed from studentClasses');
                    }
                    
                    // 3. Force a fresh read of students for this class to ensure we have the latest data
                    const verifyStudentsAfterRemoval = () => {
                        const studentClassRecords = (window.demo.studentClasses || []).filter(
                            sc => sc.classId === classId && sc.status !== 'inactive'
                        );
                        const studentIds = studentClassRecords.map(sc => sc.studentId);
                        console.log(`[deleteStudentFromClass] After removal, class ${classId} has ${studentIds.length} students:`, studentIds);
                        
                        // Double-check that removed student is not in the list
                        if (studentIds.includes(studentId)) {
                            console.error(`[deleteStudentFromClass] ERROR: Removed student ${studentId} still appears in student list!`);
                            return false;
                        }
                        return true;
                    };
                    
                    const removalVerified = verifyStudentsAfterRemoval();
                    
                    // 4. Refresh UI immediately after local data update (optimistic UI)
                    // Use requestAnimationFrame to ensure DOM updates happen after data mutation completes
                    requestAnimationFrame(() => {
                        // Double-check data is correct before rendering
                        if (!verifyStudentsAfterRemoval()) {
                            console.warn('[deleteStudentFromClass] Data verification failed before render, waiting...');
                            setTimeout(() => {
                                if (verifyStudentsAfterRemoval()) {
                                    renderClassDetail(classId);
                                } else {
                                    console.error('[deleteStudentFromClass] Data still incorrect, forcing re-sync from DB');
                                    // Force reload from DB if data is still incorrect
                                    if (window.DatabaseAdapter && window.DatabaseAdapter.load) {
                                        window.DatabaseAdapter.load({ 
                                            preferLocal: false, 
                                            tables: ['studentClasses'] 
                                        }).then(data => {
                                            if (data && Array.isArray(data.studentClasses)) {
                                                window.demo.studentClasses = data.studentClasses;
                                                renderClassDetail(classId);
                                            }
                                        });
                                    } else {
                                        renderClassDetail(classId);
                                    }
                                }
                            }, 100);
                        } else {
                            renderClassDetail(classId);
            }

                        // Check if student detail page is currently open and refresh it
                        const currentPage = window.location.hash.replace('#', '');
                        if (currentPage.startsWith('student-detail:')) {
                            const currentStudentId = currentPage.split(':')[1];
                            if (currentStudentId === studentId && typeof renderStudentDetail === 'function') {
                                renderStudentDetail(studentId);
                            }
                        }
                        
                        // Also refresh students list page if it's currently open
                        if (currentPage === 'students' && typeof renderStudents === 'function') {
                            renderStudents();
                        }
                    });

                    // 3. Ghi lại hành động xóa học sinh khỏi lớp
                    if (window.ActionHistoryService && removalResult.removedRecord && student && cls) {
                window.ActionHistoryService.recordAction({
                    entityType: 'studentClass',
                            entityId: removalResult.removedRecord.id,
                    actionType: 'delete',
                            beforeValue: removalResult.removedRecord,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa học sinh "${student.fullName || studentId}" khỏi lớp "${cls.name || classId}"`
                });
            }

                    // 4. Return save options for database sync
                    return {
                        supabaseEntities: Object.keys(removalResult.supabaseEntities).length ? removalResult.supabaseEntities : {},
                        supabaseDeletes: removalResult.supabaseDeletes
                    };
                },
                {
                    onSuccess: () => {
                        // Database sync successful - UI already updated optimistically
                        // Verify data one more time before final render
                        const finalVerify = () => {
                            const remainingRecords = (window.demo.studentClasses || []).filter(
                                sc => sc.studentId === studentId && sc.classId === classId
                            );
                            if (remainingRecords.length > 0) {
                                console.warn(`[deleteStudentFromClass] onSuccess: Still found ${remainingRecords.length} records after sync, removing...`);
                                remainingRecords.forEach(record => {
                                    const index = (window.demo.studentClasses || []).findIndex(
                                        sc => sc.id === record.id
                                    );
                                    if (index !== -1) {
                                        window.demo.studentClasses.splice(index, 1);
                                    }
                                });
                            }
                            return remainingRecords.length === 0;
                        };
                        
                        if (!finalVerify()) {
                            // Force remove any remaining records
                            const records = window.demo.studentClasses || [];
                            let foundAny = true;
                            while (foundAny) {
                                const index = records.findIndex(
                                    sc => sc.studentId === studentId && sc.classId === classId
                                );
                                if (index !== -1) {
                                    records.splice(index, 1);
                                } else {
                                    foundAny = false;
                                }
                            }
                        }
                        
                        // Re-render to ensure consistency with DB data (in case DB changed something)
                        requestAnimationFrame(() => {
            renderClassDetail(classId);
                            
                            const currentPage = window.location.hash.replace('#', '');
                            if (currentPage.startsWith('student-detail:')) {
                                const currentStudentId = currentPage.split(':')[1];
                                if (currentStudentId === studentId && typeof renderStudentDetail === 'function') {
                                    renderStudentDetail(studentId);
                                }
                            }
                        });
                        
                        const refundMessage = removalResult && removalResult.refundAmount > 0
                            ? ` Đã hoàn trả ${window.UniData.formatCurrency(removalResult.refundAmount)} vào tài khoản học sinh.`
                : '';
            window.UniUI.toast(`Đã xóa học sinh khỏi lớp.${refundMessage}`, 'success');
                    },
                    onError: (error) => {
                        console.error('Error deleting student from class:', error);
                        window.UniUI.toast('Không thể xóa học sinh khỏi lớp: ' + (error.message || error), 'error');
                        // Rollback UI (withOptimisticUpdate will restore data, we just need to refresh)
                        renderClassDetail(classId);
                        const currentPage = window.location.hash.replace('#', '');
                        if (currentPage.startsWith('student-detail:')) {
                            const currentStudentId = currentPage.split(':')[1];
                            if (currentStudentId === studentId && typeof renderStudentDetail === 'function') {
                                renderStudentDetail(studentId);
                            }
                        }
                    },
                    onRollback: () => {
                        // Data already rolled back by withOptimisticUpdate, just refresh UI
                        renderClassDetail(classId);
                        const currentPage = window.location.hash.replace('#', '');
                        if (currentPage.startsWith('student-detail:')) {
                            const currentStudentId = currentPage.split(':')[1];
                            if (currentStudentId === studentId && typeof renderStudentDetail === 'function') {
                                renderStudentDetail(studentId);
                            }
                        }
                    }
                }
            );
        } catch (e) {
            console.error('Error in deleteStudentFromClass:', e);
            window.UniUI.toast('Không thể xóa: ' + (e.message || e), 'error');
        }
    }
}

/**
 * Open modal to add existing student to class
 */
function openAddExistingStudentModal(classId) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return;

    const existingStudentIds = new Set(
        (window.demo.studentClasses || [])
            .filter(sc => sc.classId === classId && sc.status !== 'inactive')
            .map(sc => sc.studentId)
            .filter(Boolean)
    );

    const studentsNotInClass = (window.demo.students || []).filter(student => !existingStudentIds.has(student.id));

    if (studentsNotInClass.length === 0) {
        window.UniUI.openModal('Thông báo', '<p class="text-muted">Không còn học sinh nào chưa tham gia lớp này.</p>');
        return;
    }

    // Check max students
    const currentCount = window.UniLogic.getRelated('class', classId, 'students').length;
    if (cls.maxStudents && currentCount >= cls.maxStudents) {
        window.UniUI.openModal('Thông báo', `<p class="text-muted">Lớp đã đạt số lượng tối đa (${cls.maxStudents} học sinh).</p>`);
        return;
    }

    const form = document.createElement('div');
    form.className = 'grid gap-3';
    form.innerHTML = `
        <div>
            <div class="text-muted text-sm mb-2">
                ${cls.maxStudents ? `Lớp hiện có ${currentCount}/${cls.maxStudents} học sinh` : `Lớp hiện có ${currentCount} học sinh`}
            </div>
            <div class="form-group">
                <label for="studentSearchInput">Tìm học sinh theo tên</label>
                <input type="search" id="studentSearchInput" class="form-control" placeholder="Tìm học sinh theo tên..." autocomplete="off">
                <div id="studentSearchResults" class="search-dropdown"></div>
            </div>
        </div>
        <div class="form-actions mt-2">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Đóng</button>
        </div>
    `;

    const normalized = (text) => window.UniData?.normalizeText
        ? window.UniData.normalizeText(text || '')
        : (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const availableStudents = studentsNotInClass.map(student => ({
        ...student,
        normalizedName: normalized(student.fullName)
    }));

    function renderStudentResults(query = '') {
        const resultsContainer = form.querySelector('#studentSearchResults');
        const normalizedQuery = normalized(query);
        const matches = normalizedQuery
            ? availableStudents.filter(student => student.normalizedName.includes(normalizedQuery))
            : availableStudents.slice(0, 8);

        if (!matches.length) {
            resultsContainer.innerHTML = '<div class="search-empty text-muted">Không tìm thấy học sinh phù hợp.</div>';
            resultsContainer.classList.add('visible');
            return;
        }

        resultsContainer.innerHTML = matches.map(student => {
            const enrolledRecords = window.UniData?.getStudentClassesForStudent
                ? window.UniData.getStudentClassesForStudent(student.id)
                : (window.demo.studentClasses || []).filter(record => record.studentId === student.id);
            const otherClasses = (enrolledRecords || [])
                .filter(record => record.classId && record.classId !== classId && record.status !== 'inactive')
                .map(record => {
                    const cls = (window.demo.classes || []).find(c => c.id === record.classId);
                    return cls ? cls.name : record.classId;
                });
            const metaLabel = otherClasses.length
                ? `Đang học: ${otherClasses.join(', ')}`
                : 'Chưa tham gia lớp nào khác';
            return `
                <button type="button" class="search-item student-search-item" data-student-id="${student.id}">
                    <div class="search-item-title">${student.fullName}</div>
                    <div class="search-item-sub text-muted text-xs">
                        ${student.birthYear ? `Năm sinh: ${student.birthYear} • ` : ''}
                        ${metaLabel}
                    </div>
                </button>
                `;
            }).join('');
        resultsContainer.classList.add('visible');
    }

    form.addEventListener('click', (event) => {
        const item = event.target.closest('.student-search-item');
        if (!item) return;

        const studentId = item.dataset.studentId;
        if (!studentId) return;

        const currentCount = window.UniLogic.getRelated('class', classId, 'students').length;
        if (cls.maxStudents && currentCount >= cls.maxStudents) {
            window.UniUI.toast(`Lớp đã đạt số lượng tối đa (${cls.maxStudents} học sinh)`, 'warning');
            return;
        }

        try {
            const student = (window.demo.students || []).find(s => s.id === studentId);
            const cls = window.demo.classes.find(c => c.id === classId);
            const studentClassRecord = window.UniData.ensureStudentClassRecord(studentId, classId, { status: 'active' });
            const payload = {
                supabaseEntities: {
                    studentClasses: [studentClassRecord]
                }
            };

            // Sync student.classId with all active classes (memory-only, not saved to DB)
            if (student) {
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
                // IMPORTANT: Do NOT save classId to database (it's memory-only, synced from studentClasses)
                // Only save studentClass record, not student.classId
                // payload.supabaseEntities.students = [student]; // Removed - don't save student when adding to class
            }

            // Ghi lại hành động thêm học sinh vào lớp
            if (window.ActionHistoryService && student && cls) {
                window.ActionHistoryService.recordAction({
                    entityType: 'studentClass',
                    entityId: studentClassRecord.id,
                    actionType: 'create',
                    beforeValue: null,
                    afterValue: studentClassRecord,
                    changedFields: null,
                    description: `Thêm học sinh "${student.fullName || studentId}" vào lớp "${cls.name || classId}"`
                });
            }

            window.UniData.save(payload);
            window.UniUI.toast('Đã thêm học sinh vào lớp', 'success');

            const searchInput = form.querySelector('#studentSearchInput');
            if (searchInput) searchInput.value = '';
            renderStudentResults('');

            setTimeout(() => {
                renderClassDetail(classId);
            }, 100);
        } catch (error) {
            window.UniUI.toast(`Không thể thêm học sinh: ${error.message}`, 'error');
        }
    });

    const searchInput = form.querySelector('#studentSearchInput');
    searchInput.addEventListener('input', (event) => {
        renderStudentResults(event.target.value);
    });
    searchInput.addEventListener('focus', () => renderStudentResults(searchInput.value));

    document.addEventListener('click', function handleOutside(event) {
        if (!form.contains(event.target)) {
            const resultsContainer = form.querySelector('#studentSearchResults');
            if (resultsContainer) {
                resultsContainer.classList.remove('visible');
            }
            document.removeEventListener('click', handleOutside);
        }
    });

    window.UniUI.openModal('Thêm học sinh vào lớp', form);
}

/**
 * Move student to another class
 */
function moveStudentToClass(studentId, currentClassId) {
    const student = window.demo.students.find(s => s.id === studentId);
    if (!student) return;

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label>Học sinh: <strong>${student.fullName}</strong></label>
        </div>
        <div class="form-group">
            <label for="newClassSelect">Chuyển sang lớp</label>
            <select id="newClassSelect" name="newClassId" class="form-control" required>
                <option value="">-- Chọn lớp --</option>
                ${window.demo.classes.filter(c => c.id !== currentClassId).map(c => `
                    <option value="${c.id}">${c.name} (${c.type})</option>
                `).join('')}
                <option value="__REMOVE__">-- Gỡ khỏi lớp --</option>
            </select>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Chuyển lớp</button>
        </div>
    `;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const newClassId = formData.get('newClassId');
        const currentClass = (window.demo.classes || []).find(c => c.id === currentClassId) || null;
        const removalReason = currentClass ? `Hoàn trả do chuyển khỏi lớp ${currentClass.name}` : 'Hoàn trả khi chuyển lớp';
        try {
            if (!newClassId || newClassId === '__REMOVE__') {
                const removal = handleStudentClassRemoval(studentId, currentClassId, {
                    reason: removalReason,
                    updatePrimaryClass: true
                });
                if (!removal.removedRecord) {
                    window.UniUI.toast('Không tìm thấy dữ liệu lớp để xóa', 'error');
                    return;
                }

                window.UniData.save({
                    supabaseEntities: Object.keys(removal.supabaseEntities).length ? removal.supabaseEntities : {},
                    supabaseDeletes: removal.supabaseDeletes
                });

                window.UniUI.closeModal();
                renderClassDetail(currentClassId);
                const refundMsg = removal.refundAmount > 0
                    ? ` Đã hoàn trả ${window.UniData.formatCurrency(removal.refundAmount)}.`
                    : '';
                window.UniUI.toast(`Đã gỡ học sinh khỏi lớp.${refundMsg}`, 'success');
                return;
            }

            const removal = handleStudentClassRemoval(studentId, currentClassId, {
                reason: removalReason,
                updatePrimaryClass: false
            });
            if (!removal.removedRecord) {
                window.UniUI.toast('Không tìm thấy dữ liệu lớp hiện tại', 'error');
                return;
            }

            window.UniData.save({
                supabaseEntities: Object.keys(removal.supabaseEntities).length ? removal.supabaseEntities : {},
                supabaseDeletes: removal.supabaseDeletes
            });

            const updatedStudent = window.UniLogic.updateEntity('student', studentId, { classId: newClassId });
            const studentClass = (window.demo.studentClasses || []).find(sc => sc.studentId === studentId && sc.classId === newClassId);

            window.UniUI.closeModal();
            renderClassDetail(currentClassId);
            const refundMsg = removal.refundAmount > 0
                ? ` Đã hoàn trả ${window.UniData.formatCurrency(removal.refundAmount)} khi chuyển lớp.`
                : '';
            window.UniUI.toast(`Đã chuyển học sinh sang lớp mới.${refundMsg}`, 'success');
            
            if (window.SupabaseAdapter) {
                if (window.SupabaseAdapter.saveEntities && updatedStudent) {
                    const payload = { students: [updatedStudent] };
                    if (studentClass) {
                        payload.studentClasses = [studentClass];
                    }
                    window.SupabaseAdapter.saveEntities(payload).catch(err => console.error('Partial save student transfer failed:', err));
                }
            }
        } catch (e) {
            alert('Không thể chuyển lớp: ' + e.message);
        }
    });

    window.UniUI.openModal('Chuyển học sinh sang lớp khác', form);
}

/**
 * Open class modal for create/edit
 * @param {string} [classId] - Class ID for edit mode
 */
async function openClassModal(classId = null) {
    if (!window.UniUI.hasRole('admin')) { alert('Only admin can manage classes'); return; }
    const isEdit = Boolean(classId);
    const cls = isEdit ? window.demo.classes.find(c => c.id === classId) : null;
    const categoriesList = window.AppStore?.store.getState().categories || window.UniData.getCategories();
    const defaultCategoryName = categoriesList.length ? (categoriesList[0]?.name || '') : 'Basic';
    const baseData = cls ? { ...cls } : { type: defaultCategoryName || 'Basic', status: 'running' };

    const baseTeacherAllowance = Number(baseData.tuitionPerSession || 0);
    const baseMaxAllowance = Number(baseData.maxAllowancePerSession || 0);
    const basePackageTotal = Number(baseData.tuitionPackageTotal || 0);
    const basePackageSessions = Number(baseData.tuitionPackageSessions || 0);
    const baseStudentUnit = Number(
        baseData.studentTuitionPerSession ||
        (basePackageTotal > 0 && basePackageSessions > 0 ? basePackageTotal / basePackageSessions : 0)
    );
    const baseScaleAmount = Number(baseData.scaleAmount || 0);
    const allowanceExampleText = (() => {
        const format = (value) => window.UniData?.formatCurrency ? window.UniData.formatCurrency(value || 0) : `${Number(value || 0).toLocaleString('vi-VN')} đ`;
        return `${format(baseTeacherAllowance)} × 1.2 = ${format(baseTeacherAllowance * 1.2)}`;
    })();
    const maxAllowanceText = (() => {
        const value = baseMaxAllowance > 0 ? baseMaxAllowance : 0;
        if (!value) return 'Không giới hạn, sẽ tính theo công thức trợ cấp × hệ số × số học sinh.';
        const toWords = window.UniData?.numberToVietnameseText;
        const inWords = typeof toWords === 'function' ? toWords(value) : '';
        const formatted = window.UniData?.formatCurrency ? window.UniData.formatCurrency(value) : `${value.toLocaleString('vi-VN')} đ`;
        return `${formatted}${inWords ? ` • ${inWords}` : ''}`;
    })();
    const feeExampleText = (() => {
        const format = (value) => window.UniData?.formatCurrency ? window.UniData.formatCurrency(value || 0) : `${Number(value || 0).toLocaleString('vi-VN')} đ`;
        if (baseStudentUnit > 0 && basePackageSessions > 0) {
            return `Hiện tại: ${format(baseStudentUnit)} / buổi • Tổng ${format(baseStudentUnit * basePackageSessions)} cho ${basePackageSessions} buổi.`;
        }
        if (basePackageTotal > 0 && basePackageSessions > 0) {
            return `Hiện tại: ${format(basePackageTotal / basePackageSessions)} / buổi • Tổng ${format(basePackageTotal)} cho ${basePackageSessions} buổi.`;
        }
        if (baseStudentUnit > 0) {
            return `Hiện tại: ${format(baseStudentUnit)} / buổi`;
        }
        return 'Tự động = Tổng tiền / Số buổi.';
    })();

    const availableTeachers = (window.demo.teachers || []).filter(t => {
        const roles = Array.isArray(t.roles) ? t.roles : [];
        return roles.includes('teacher') || roles.length === 0;
    });

    const form = document.createElement('form');
    form.className = 'class-form';
    form.innerHTML = `
        <div class="form-group">
            <label for="className">Name*</label>
            <input 
                type="text" 
                id="className" 
                name="name" 
                value="${baseData.name || ''}" 
                required
            >
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="classType">Category*</label>
                <select id="classType" name="type" required>
                    ${(window.AppStore?.store.getState().categories || window.UniData.getCategories()).map(cat => {
                        const name = cat && typeof cat === 'object' ? cat.name || '' : String(cat || '');
                        const safeName = escapeHtml(name);
                        return `
                        <option value="${safeName}" ${baseData.type === name ? 'selected' : ''}>${safeName}</option>
                    `;
                    }).join('') }
                </select>
            </div>
            
            <div class="form-group">
                <label for="classTeachers">Gia sư* (có thể chọn nhiều)</label>
                <select id="classTeachers" name="teacherIds" multiple size="6" required>
        ${(availableTeachers || []).map(t => {
                        const currentTeacherIds = baseData?.teacherIds || (baseData?.teacherId ? [baseData.teacherId] : []);
                        return `
                        <option 
                            value="${t.id}" 
                            ${currentTeacherIds.includes(t.id) ? 'selected' : ''}
                        >
                            ${t.fullName}
                        </option>
                    `;
                    }).join('')}
                </select>
                <div class="text-muted text-sm mt-1">Giữ Ctrl (Windows) hoặc Cmd (Mac) để chọn nhiều gia sư</div>
            </div>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="classStatus">Status*</label>
                <select id="classStatus" name="status" required>
                    <option value="running" ${baseData.status === 'running' ? 'selected' : ''}>Running</option>
                    <option value="paused" ${baseData.status === 'paused' ? 'selected' : ''}>Paused</option>
                </select>
            </div>
        </div>

        <div class="card form-section tuition-card">
            <h4 class="mb-2">Trợ cấp giáo viên</h4>
            <div class="form-group">
                <label for="classAllowance" title="Số tiền giáo viên nhận cho mỗi buổi theo hệ số">Trợ cấp / Hệ số*</label>
                <input 
                    type="text" 
                    inputmode="numeric"
                    id="classAllowance" 
                    name="tuitionPerSession" 
                    value="${baseTeacherAllowance}"
                    placeholder="Ví dụ 150000"
                    required
                >
            <div class="text-muted text-sm mt-1" id="classAllowancePreview"></div>
            </div>
            <div class="form-group">
                <label for="classScaleAmount" title="Tiền scale cộng thêm cho mỗi buổi">Tiền scale (đ)</label>
                <input
                    type="text"
                    inputmode="numeric"
                    id="classScaleAmount"
                    name="scaleAmount"
                    value="${baseScaleAmount}"
                    placeholder="Ví dụ 50000"
                >
            </div>
            <div class="form-group">
                <label for="classMaxAllowance" title="Mức trần trợ cấp cho mỗi buổi học">Trợ cấp tối đa (đ)</label>
                <input
                    type="text"
                    inputmode="numeric"
                    id="classMaxAllowance"
                    name="maxAllowancePerSession"
                    value="${baseMaxAllowance > 0 ? baseMaxAllowance : ''}"
                    placeholder="Bỏ trống nếu không giới hạn"
                >
                <div class="text-muted text-sm mt-1" id="classMaxAllowancePreview">${maxAllowanceText}</div>
            </div>
            </div>
            
        <div class="card form-section tuition-card">
            <h4 class="mb-2">Học phí học sinh</h4>
            <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
            <div class="form-group">
                    <label for="classFeeTotal" title="Tổng học phí mặc định cho gói buổi học">Tổng tiền học phí (đ)</label>
                    <input 
                        type="text"
                        inputmode="numeric"
                        id="classFeeTotal"
                        name="tuitionPackageTotal"
                        value="${basePackageTotal}"
                        placeholder="Ví dụ 2.000.000"
                    >
            </div>
                <div class="form-group">
                    <label for="classFeeSessions" title="Số buổi trong gói học phí">Số buổi</label>
                    <input 
                        type="number"
                        id="classFeeSessions"
                        name="tuitionPackageSessions"
                        value="${basePackageSessions}"
                        min="0"
                        step="1"
                        placeholder="Ví dụ 10"
                    >
                </div>
                <div class="form-group">
                    <label for="classFeeUnit" title="Học phí mỗi buổi">Học phí mỗi buổi (đ)</label>
                    <input 
                        type="text"
                        inputmode="numeric"
                        id="classFeeUnit"
                        name="studentTuitionPerSession"
                        value="${baseStudentUnit}"
                        placeholder="Tự động từ tổng tiền / số buổi"
                    >
                    <div class="text-muted text-sm mt-1" id="classFeePreview">${feeExampleText}</div>
                </div>
            </div>
        </div>

        <div class="mt-4">
            <details>
                <summary class="cursor-pointer">Manage Categories</summary>
                <div class="mt-2">
                    <div id="categoryList" class="grid gap-2" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));"></div>
                    <div class="flex gap-2 mt-2">
                        <input id="newCategoryName" class="form-control" placeholder="New category name">
                        <button type="button" class="btn" id="addCategoryBtn">Add</button>
            </div>
                </div>
            </details>
        </div>

        <div class="form-actions">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'}</button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const teacherSelect = form.querySelector('#classTeachers');
        const teacherIds = Array.from(teacherSelect.selectedOptions).map(opt => opt.value);
        
        if (teacherIds.length === 0) {
            alert('Vui lòng chọn ít nhất một gia sư');
            return;
        }
        
        const rawAllowance = window.UniUI.getCurrencyValue(allowanceInput);
        const scaleAmountRaw = window.UniUI.getCurrencyValue(scaleInput);
        const scaleAmount = scaleAmountRaw > 0 ? Math.round(scaleAmountRaw) : 0;
        const maxAllowanceInput = form.querySelector('#classMaxAllowance');
        const rawMaxAllowance = maxAllowanceInput ? window.UniUI.getCurrencyValue(maxAllowanceInput) : 0;
        let packageTotal = window.UniUI.getCurrencyValue(feeTotalInput);
        let packageSessions = Number(formData.get('tuitionPackageSessions')) || 0;
        let unitFromInput = window.UniUI.getCurrencyValue(feeUnitInput);

        if (!Number.isFinite(packageSessions) || packageSessions < 0) {
            packageSessions = 0;
        } else {
            packageSessions = Math.round(packageSessions);
        }

        const allowanceValid = window.UniUI.validateCurrencyInput(allowanceInput);
        const scaleValid = window.UniUI.validateCurrencyInput(scaleInput);
        const maxAllowanceValid = maxAllowanceInput ? window.UniUI.validateCurrencyInput(maxAllowanceInput) : true;
        const totalValid = window.UniUI.validateCurrencyInput(feeTotalInput);
        const unitValid = window.UniUI.validateCurrencyInput(feeUnitInput);
        if (!allowanceValid || !scaleValid || !maxAllowanceValid || !totalValid || !unitValid) {
            window.UniUI.toast('Vui lòng kiểm tra lại các trường tiền tệ', 'error');
            return;
        }

        if (packageTotal > 0 && packageSessions <= 0) {
            alert('Số buổi phải lớn hơn 0 khi nhập tổng học phí.');
            return;
        }

        if (packageSessions > 0 && packageTotal > 0) {
            unitFromInput = packageTotal / packageSessions;
        } else if (packageSessions > 0 && unitFromInput > 0) {
            packageTotal = unitFromInput * packageSessions;
        } else if (packageTotal > 0 && unitFromInput > 0 && packageSessions <= 0) {
            packageSessions = packageTotal / unitFromInput;
        }

        packageTotal = packageTotal > 0 ? Math.round(packageTotal) : 0;
        unitFromInput = unitFromInput > 0 ? Math.round(unitFromInput) : 0;
        if (packageSessions > 0) {
            packageSessions = Math.round(packageSessions);
        }

        const resolvedUnit = unitFromInput > 0 ? unitFromInput : 0;
        const maxAllowancePerSession = rawMaxAllowance > 0 ? Math.round(rawMaxAllowance) : 0;

        const data = {
            name: formData.get('name'),
            type: formData.get('type'),
            teacherIds: teacherIds,
            status: formData.get('status'),
            tuitionPerSession: rawAllowance,
            scaleAmount: scaleAmount,
            maxAllowancePerSession: maxAllowancePerSession,
            tuitionPackageTotal: packageTotal,
            tuitionPackageSessions: packageSessions,
            studentTuitionPerSession: resolvedUnit
        };

        const validation = window.UniLogic.validateForm(data, classValidation);
        if (!validation.isValid) {
            alert(Object.values(validation.errors).join('\n'));
            return;
        }

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
            if (isEdit) {
                    // Save previous teacher IDs before updating
                    const previousTeacherIds = new Set(cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []));
                    const newTeacherIds = new Set(data.teacherIds || []);
                    
                    // Lấy dữ liệu cũ trước khi update
                    const oldClass = { ...cls };
                    const updatedClass = window.UniLogic.updateEntity('class', classId, data);
                    
                    // Ghi lại hành động chỉnh sửa
                    if (window.ActionHistoryService) {
                        const changedFields = window.ActionHistoryService.getChangedFields(oldClass, updatedClass);
                        window.ActionHistoryService.recordAction({
                            entityType: 'class',
                            entityId: classId,
                            actionType: 'update',
                            beforeValue: oldClass,
                            afterValue: updatedClass,
                            changedFields: changedFields,
                            description: `Cập nhật lớp học: ${updatedClass.name || classId}`
                        });
                    }
                    
                    // Build classTeachers relations
                    const classRelations = [];
                    if (data.teacherIds && Array.isArray(data.teacherIds)) {
                        data.teacherIds.forEach(teacherId => {
                            const existing = (window.demo.classTeachers || []).find(
                                ct => ct.classId === classId && ct.teacherId === teacherId
                            );
                            if (!existing) {
                                classRelations.push({
                                    id: 'CT' + Math.random().toString(36).slice(2, 8).toUpperCase(),
                                    classId: classId,
                                    teacherId: teacherId
                                });
                            }
                        });
                    }
                    
                    const supabaseEntities = { classes: [updatedClass] };
                    if (classRelations.length > 0) {
                        supabaseEntities.classTeachers = classRelations;
                    }
                    
                    return { supabaseEntities };
            } else {
                    const newClass = window.UniLogic.createEntity('class', data);
                    
                    // Ghi lại hành động tạo mới
                    if (window.ActionHistoryService) {
                        window.ActionHistoryService.recordAction({
                            entityType: 'class',
                            entityId: newClass.id,
                            actionType: 'create',
                            beforeValue: null,
                            afterValue: newClass,
                            changedFields: null,
                            description: `Tạo lớp học mới: ${newClass.name || newClass.id}`
                        });
                    }
                    
                    // Get classTeachers from createEntity result
                    const supabaseEntities = { classes: [newClass] };
                    // Note: createEntity already handles classTeachers, but we need to get them
                    const classRelations = (window.demo.classTeachers || []).filter(
                        ct => ct.classId === newClass.id
                    );
                    if (classRelations.length > 0) {
                        supabaseEntities.classTeachers = classRelations;
                    }
                    return { supabaseEntities };
                }
            },
            {
                onSuccess: () => {
            window.UniUI.closeModal();
                    // If we're on class detail page, refresh it; otherwise refresh list
                    const currentPage = window.location.hash.slice(1);
                    if (isEdit) {
                        if (currentPage && currentPage.startsWith('class-detail:')) {
                            renderClassDetail(classId);
                        } else {
            renderClasses();
                        }
                        
                        // Refresh teacher detail pages for affected teachers
                        const previousTeacherIds = new Set(cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []));
                        const newTeacherIds = new Set(data.teacherIds || []);
                        const affectedTeacherIds = new Set([...previousTeacherIds, ...newTeacherIds]);
                        refreshTeacherDetailPages(affectedTeacherIds);
                    } else {
                        renderClasses();
                    }
                    window.UniUI.toast(isEdit ? 'Đã cập nhật lớp học' : 'Đã tạo lớp học mới', 'success');
                },
                onError: (error) => {
                    console.error('Failed to save class:', error);
                    window.UniUI.toast('Không thể lưu lớp học: ' + (error.message || 'Lỗi không xác định'), 'error');
                    // Keep modal open on error so user can fix and retry
                },
                onRollback: () => {
                    window.UniUI.closeModal();
                    const currentPage = window.location.hash.slice(1);
                    if (currentPage && currentPage.startsWith('class-detail:')) {
                        renderClassDetail(classId);
                    } else {
                        renderClasses();
                    }
                }
            }
        );
    });

    window.UniUI.openModal(
        isEdit ? 'Edit Class' : 'New Class',
        form
    );

    const allowanceInput = form.querySelector('#classAllowance');
    const allowancePreview = form.querySelector('#classAllowancePreview');
    const scaleInput = form.querySelector('#classScaleAmount');
    const maxAllowanceInput = form.querySelector('#classMaxAllowance');
    const maxAllowancePreview = form.querySelector('#classMaxAllowancePreview');
    const feeTotalInput = form.querySelector('#classFeeTotal');
    const feeSessionsInput = form.querySelector('#classFeeSessions');
    const feeUnitInput = form.querySelector('#classFeeUnit');
    const feePreview = form.querySelector('#classFeePreview');

    const formatCurrency = (value) => {
        const numeric = Number(value || 0);
        const formatted = Number.isFinite(numeric) ? numeric.toLocaleString('vi-VN') : '0';
        return `${formatted} đ`;
    };

    let isSyncingFeeFields = false;

    const updatePreviews = () => {
        if (allowancePreview) {
            allowancePreview.textContent = '';
        }
        if (feePreview && feeTotalInput && feeSessionsInput && feeUnitInput) {
            const total = window.UniUI.getCurrencyValue(feeTotalInput);
            const sessions = Number(feeSessionsInput.value || 0);
            const unit = window.UniUI.getCurrencyValue(feeUnitInput);
            const sessionLabel = sessions > 0 ? `${sessions} buổi` : 'chưa rõ số buổi';
            feePreview.textContent = `Hiện tại: ${formatCurrency(unit)} / buổi • Tổng ${formatCurrency(total)} cho ${sessionLabel}.`;
        }
    };

    const recomputeTuition = (source) => {
        if (!feeTotalInput || !feeSessionsInput || !feeUnitInput) return;
        if (isSyncingFeeFields) return;
        isSyncingFeeFields = true;

        let total = window.UniUI.getCurrencyValue(feeTotalInput);
        let unit = window.UniUI.getCurrencyValue(feeUnitInput);
        const sessionsRaw = Number(feeSessionsInput.value || 0);
        const sessions = Number.isFinite(sessionsRaw) && sessionsRaw > 0 ? Math.round(sessionsRaw) : 0;

        if (source === 'sessions') {
            if (sessionsRaw !== sessions) {
                feeSessionsInput.value = sessions > 0 ? sessions : '';
            }
        }

        if (source === 'total') {
            if (total > 0 && sessions > 0) {
                unit = Math.round(total / sessions);
                window.UniUI.setCurrencyValue(feeUnitInput, unit, { silent: true });
            } else if (total <= 0) {
                window.UniUI.setCurrencyValue(feeUnitInput, '', { silent: true });
            }
        } else if (source === 'unit') {
            if (unit > 0 && sessions > 0) {
                total = unit * sessions;
                window.UniUI.setCurrencyValue(feeTotalInput, total, { silent: true });
            } else if (unit <= 0) {
                window.UniUI.setCurrencyValue(feeTotalInput, '', { silent: true });
            }
        } else if (source === 'sessions') {
            if (total > 0 && sessions > 0) {
                unit = Math.round(total / sessions);
                window.UniUI.setCurrencyValue(feeUnitInput, unit, { silent: true });
            } else if (unit > 0 && sessions > 0) {
                total = unit * sessions;
                window.UniUI.setCurrencyValue(feeTotalInput, total, { silent: true });
            } else {
                window.UniUI.setCurrencyValue(feeUnitInput, '', { silent: true });
                window.UniUI.setCurrencyValue(feeTotalInput, '', { silent: true });
            }
        }

        updatePreviews();
        isSyncingFeeFields = false;
    };

    if (allowanceInput) window.UniUI.attachCurrencyInput(allowanceInput, {
        required: true,
        onChange: () => updatePreviews()
    });
    if (scaleInput) window.UniUI.attachCurrencyInput(scaleInput, {
        required: false
    });
    if (maxAllowanceInput) window.UniUI.attachCurrencyInput(maxAllowanceInput, {
        required: false,
        onChange: () => {
            const value = window.UniUI.getCurrencyValue(maxAllowanceInput);
            const toWords = window.UniData?.numberToVietnameseText;
            const formatted = window.UniData?.formatCurrency
                ? window.UniData.formatCurrency(value || 0)
                : `${Number(value || 0).toLocaleString('vi-VN')} đ`;
            const inWords = (typeof toWords === 'function' && value > 0)
                ? toWords(value)
                : (value > 0 ? '' : 'Không giới hạn, sẽ tính theo công thức trợ cấp × hệ số × số học sinh.');
            if (maxAllowancePreview) {
                maxAllowancePreview.textContent = value > 0
                    ? `${formatted}${inWords ? ` • ${inWords}` : ''}`
                    : 'Không giới hạn, sẽ tính theo công thức trợ cấp × hệ số × số học sinh.';
            }
        }
    });
    if (feeTotalInput) window.UniUI.attachCurrencyInput(feeTotalInput, {
        onChange: () => recomputeTuition('total')
    });
    if (feeUnitInput) window.UniUI.attachCurrencyInput(feeUnitInput, {
        onChange: () => recomputeTuition('unit')
    });

    feeSessionsInput?.addEventListener('input', () => recomputeTuition('sessions'));

    updatePreviews();
    recomputeTuition('total');

    // Category CRUD wiring
    function renderCategoryManager() {
        const container = form.querySelector('#categoryList');
        if (!container) return;
        const categories = window.AppStore?.store.getState().categories || window.UniData.getCategories();
        container.innerHTML = categories.map((cat, idx) => {
            const name = cat && typeof cat === 'object' ? cat.name || '' : String(cat || '');
            const safeName = escapeHtml(name);
            return `
            <div class="flex items-center gap-2" data-index="${idx}">
                <input class="form-control" value="${safeName}" data-index="${idx}">
                <button type="button" class="btn" data-action="save" data-index="${idx}">Save</button>
                <button type="button" class="btn btn-danger" data-action="delete" data-index="${idx}">Delete</button>
            </div>
        `;
        }).join('');
    }

    renderCategoryManager();

    // Subscribe to store changes
    const unsubscribe = window.AppStore?.store.subscribe(renderCategoryManager);
    form.addEventListener('remove', () => unsubscribe && unsubscribe());

    // Add category
    form.querySelector('#addCategoryBtn')?.addEventListener('click', () => {
        const input = form.querySelector('#newCategoryName');
        const name = (input?.value || '').trim();
        if (!name) return;
        window.AppStore?.store.dispatch({ type: window.AppStore.actions.ADD_CATEGORY, payload: name });
        input.value = '';
        renderCategoryManager();
    });

    // Save/Delete category
    form.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const idx = Number(btn.getAttribute('data-index'));
        const currentCats = window.AppStore?.store.getState().categories || window.UniData.getCategories();
        const target = currentCats[idx];
        if (!target) return;
        if (action === 'delete') {
            window.AppStore?.store.dispatch({ type: window.AppStore.actions.DELETE_CATEGORY, payload: { id: target.id ?? null, name: target.name } });
            renderCategoryManager();
        } else if (action === 'save') {
            const input = form.querySelector(`input[data-index="${idx}"]`);
            const newName = (input?.value || '').trim();
            if (!newName) return;
            window.AppStore?.store.dispatch({ type: window.AppStore.actions.UPDATE_CATEGORY, payload: { id: target.id ?? null, oldName: target.name, newName } });
            renderCategoryManager();
        }
    });
}

/**
 * Delete class after confirmation
 * @param {string} classId - Class ID to delete
 */
async function deleteClass(classId) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return;

    const students = window.UniLogic.getRelated('class', classId, 'students');
    const hasStudents = students.length > 0;

    if (hasStudents) {
        alert(`Cannot delete class "${cls.name}". ${students.length} students are enrolled.`);
        return;
    }

    if (!confirm(`Are you sure you want to delete class "${cls.name}"?`)) {
        return;
    }

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Ghi lại hành động xóa trước khi xóa
            if (window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'class',
                    entityId: classId,
                    actionType: 'delete',
                    beforeValue: cls,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa lớp học: ${cls.name || classId}`
                });
            }
            
            window.UniLogic.deleteEntity('class', classId);
            return {
                supabaseDeletes: { classes: [classId] }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa lớp học', 'success');
                renderClasses();
            },
            onError: (error) => {
                console.error('Failed to delete class:', error);
                window.UniUI.toast('Không thể xóa lớp học', 'error');
            },
            onRollback: () => {
        renderClasses();
    }
        }
    );
}


/**
 * Render sessions list for a class (có thanh chuyển tháng, mặc định = tháng hiện tại)
 */
function renderSessionsList(classId) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return '<p class="text-muted">Lớp không tồn tại</p>';

    const allSessions = window.UniData.getSessionsByClass(classId)
        .slice()
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Trạng thái tháng/năm hiện tại cho từng lớp
    window.ClassSessionFilters = window.ClassSessionFilters || {};
    if (!window.ClassSessionFilters[classId]) {
        const now = new Date();
        window.ClassSessionFilters[classId] = {
            year: String(now.getFullYear()),
            month: String(now.getMonth() + 1).toString().padStart(2, '0')
        };
    }
    const { year, month } = window.ClassSessionFilters[classId];

    const displaySessions = allSessions.filter(session => {
        if (!session.date) return false;
        const [y, m] = session.date.split('-');
        return y === year && m === month;
    });

    const canManage = window.UniUI.hasRole('admin') || window.UniUI.isOwnerTeacherOfClass(classId);
    const hasCskhPrivileges = window.UniUI.userHasStaffRole?.('cskh_sale');
    // Gia sư không được phép xóa lịch sử buổi học
    const isTutor = window.UniUI.userHasStaffRole?.('teacher');
    const canShowDelete = canManage && !isTutor;
    const canSelectSessions = canManage || hasCskhPrivileges;
    const canBulkUpdateStatus = window.UniUI.hasRole('admin', 'accountant') || hasCskhPrivileges;
    const showSessionToolbarActions = canManage || canBulkUpdateStatus;
    const basePrice = cls.tuitionPerSession || 0;
    const customAllowances = cls.customTeacherAllowances || {};

    const monthNumber = parseInt(month, 10) || 1;
    const monthLabel = `Tháng ${monthNumber}/${year}`;

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let html = `
        <div class="session-toolbar">
            <div class="text-muted text-sm">Tổng số buổi: ${displaySessions.length}</div>
            <div class="session-month-nav">
                <button type="button" class="session-month-btn" id="sessionMonthPrev" title="Tháng trước">◀</button>
                <button type="button" class="session-month-label-btn" id="sessionMonthLabelBtn" title="Chọn tháng/năm">
                    <span class="session-month-label" id="sessionMonthLabel">${monthLabel}</span>
                </button>
                <button type="button" class="session-month-btn" id="sessionMonthNext" title="Tháng sau">▶</button>
                <div id="sessionMonthPopup" class="session-month-popup" style="display:none;">
                    <div class="session-month-popup-header">
                        <button type="button" class="session-month-year-btn" id="sessionYearPrev">‹</button>
                        <span class="session-month-year-label" id="sessionYearLabel">${year}</span>
                        <button type="button" class="session-month-year-btn" id="sessionYearNext">›</button>
                    </div>
                    <div class="session-month-grid">
                        ${monthNames.map((label, idx) => {
                            const val = String(idx + 1).padStart(2, '0');
                            const isActive = val === month;
                            return `<button type="button" class="session-month-cell${isActive ? ' active' : ''}" data-month="${val}">${label}</button>`;
                        }).join('')}
                    </div>
                </div>
            </div>
            ${showSessionToolbarActions ? `
                <div class="session-toolbar-actions">
                    ${canManage ? `
                    <button class="btn btn-primary btn-add-icon" id="addSessionBtn" title="Thêm buổi học">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>` : ''}
                </div>
            ` : ''}
        </div>
    `;

    if (canBulkUpdateStatus) {
        html += `
            <div class="bulk-actions" id="sessionBulkActions" style="display: none; margin-bottom: var(--spacing-4);">
                <span class="selected-count" id="sessionSelectedCount"></span>
                <button type="button" class="btn btn-sm btn-primary" id="bulkSessionStatusBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Chuyển trạng thái thanh toán
                </button>
                <button type="button" class="btn btn-sm btn-outline" id="sessionClearSelectionBtn">
                    Bỏ chọn tất cả
                </button>
            </div>
        `;
    }

    if (allSessions.length === 0) {
        html += window.UniUI?.renderEmptyState?.({
            icon: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
            title: 'Chưa có buổi học nào',
            description: 'Bắt đầu bằng cách thêm buổi học đầu tiên cho lớp này.',
            action: canManage ? `<button class="btn btn-primary" id="addSessionBtnEmpty" onclick="openSessionModal('${classId}')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Thêm buổi học đầu tiên
            </button>` : null
        }) || '<p class="text-muted">Chưa có buổi học nào</p>';
        return html;
    }

    if (displaySessions.length === 0) {
        html += window.UniUI?.renderEmptyState?.({
            icon: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
            title: 'Chưa có buổi học trong tháng này',
            description: `Tháng ${monthNumber}/${year} chưa có buổi học nào. Hãy chọn tháng khác hoặc thêm buổi học mới.`,
            action: canManage ? `<button class="btn btn-primary" id="addSessionBtnEmpty" onclick="openSessionModal('${classId}')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Thêm buổi học
            </button>` : null
        }) || '<p class="text-muted">Chưa có buổi học nào trong tháng này.</p>';
        return html;
    }

    let totalAllowance = 0;
    html += `
        <div class="table-container" style="border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border);">
            <table class="table-striped sessions-table" id="sessionsTable">
                <thead>
                    <tr style="background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);">
                        ${canSelectSessions ? `
                            <th style="width: 50px; text-align: center;">
                                <input type="checkbox" id="selectAllSessions" class="table-checkbox" title="Chọn tất cả">
                            </th>
                        ` : '<th style="width: 50px; text-align: center;">#</th>'}
                        <th class="session-time-header" style="min-width: 160px;" title="Thời gian buổi học">Thời gian</th>
                        <th class="session-notes-header" style="min-width: 300px;">Nhận xét</th>
                        <th class="session-info-header" style="min-width: 200px;" title="Thông tin buổi học">Thông tin</th>
                        ${canShowDelete ? '<th class="session-actions-header" style="width: 60px; text-align: center;"></th>' : ''}
                    </tr>
                </thead>
                <tbody>
    `;
    
    displaySessions.forEach((session, index) => {
        const teacher = session.teacherId ? window.demo.teachers.find(t => t.id === session.teacherId) : null;
        const coefficient = session.coefficient || 1;
        const paidCount = session.studentPaidCount || 0;
        const allowance = typeof session.allowanceAmount === 'number'
            ? session.allowanceAmount
            : window.UniData.computeSessionAllowance
                ? window.UniData.computeSessionAllowance(session)
                : 0;
        totalAllowance += allowance;
        const timeRange = session.startTime && session.endTime 
            ? `${session.startTime} - ${session.endTime}` 
            : session.duration ? `${session.duration}h` : '-';
        
        const metaIcons = `
            <div style="display: inline-flex; align-items: center; gap: var(--spacing-2);">
                <span class="session-meta-icon" title="Hệ số ${coefficient}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 4H8l6 8-6 8h8"></path>
                    </svg>
                    <span>${coefficient}</span>
                </span>
                <span class="session-meta-icon" title="${paidCount} học sinh đã gia hạn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"></path>
                        <path d="M21 21v-1a3 3 0 0 0-2.4-2.9"></path>
                        <path d="M16 3a3 3 0 0 1 2.4 2.9"></path>
                    </svg>
                    <span>${paidCount}</span>
                </span>
            </div>
        `;
        
        const paymentStatus = session.paymentStatus || 'unpaid';
        const paymentStatusLabels = {
            paid: 'Đã thanh toán',
            unpaid: 'Chưa thanh toán',
            deposit: 'Cọc'
        };
        const paymentStatusClasses = {
            paid: 'badge-success',
            unpaid: 'badge-danger',
            deposit: 'badge-warning'
        };
        
        // Format ngày: "Thứ X : DD/MM/YYYY"
        const formatDateWithWeekday = (dateStr) => {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr + 'T00:00:00');
                const weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                const weekday = weekdays[date.getDay()];
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${weekday} : ${day}/${month}/${year}`;
            } catch (e) {
                return dateStr;
            }
        };
        
        // Format thời gian: "HH:mm → HH:mm"
        const formatTimeRange = (startTime, endTime) => {
            if (!startTime || !endTime) return '-';
            return `${startTime} → ${endTime}`;
        };
        
        const rowClickAttr = canManage
            ? `onclick="if(!event.target.closest('.session-checkbox, .btn-delete-icon, button')) { openSessionModal('${classId}', '${session.id}'); }"`
            : '';
        const rowCursorStyle = canManage ? 'cursor: pointer;' : '';
        
        const dateFormatted = formatDateWithWeekday(session.date);
        const timeFormatted = formatTimeRange(session.startTime, session.endTime);
        
        html += `
            <tr class="session-row${canManage ? ' session-row-clickable' : ''}" 
                data-session-id="${session.id}" 
                data-payment-status="${paymentStatus}"
                ${rowClickAttr}
                style="${rowCursorStyle}">
                ${canSelectSessions ? `
                    <td onclick="event.stopPropagation();" style="text-align: center;">
                        <input type="checkbox" class="session-checkbox table-checkbox" data-session-id="${session.id}" title="Chọn dòng này">
                    </td>
                ` : `<td style="text-align: center; color: var(--muted); font-weight: 600;">${index + 1}</td>`}
                <td class="session-time-cell" title="Thời gian buổi học">
                    <div style="font-size: var(--font-size-sm); color: var(--text); line-height: 1.5; text-align: center;">
                        <div style="font-weight: 500; margin-bottom: var(--spacing-1);">${dateFormatted}</div>
                        <div style="color: var(--muted); font-size: var(--font-size-xs);">${timeFormatted}</div>
                    </div>
                </td>
                <td class="session-notes-cell">
                    ${session.notes ? `
                        <div style="font-size: var(--font-size-sm); color: var(--text); line-height: 1.6; white-space: pre-wrap; word-wrap: break-word;">
                            ${session.notes}
                        </div>
                    ` : '<span class="text-muted" style="font-style: italic; font-size: var(--font-size-sm);">Không có ghi chú</span>'}
                </td>
                <td class="session-info-cell" title="Thông tin buổi học">
                    <div style="font-size: var(--font-size-sm); color: var(--text); line-height: 1.6; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-1);">
                        <div style="font-weight: 500; display: flex; align-items: center; justify-content: center; gap: var(--spacing-1);">
                    ${teacher ? `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0;">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                                <span>${teacher.fullName}</span>
                    ` : '<span class="text-muted">-</span>'}
                        </div>
                        <div>
                            <span class="status-badge ${paymentStatusClasses[paymentStatus] || 'badge-muted'}" style="font-size: var(--font-size-xs);" aria-label="Trạng thái: ${paymentStatusLabels[paymentStatus] || 'Không xác định'}">
                        ${paymentStatus === 'paid' ? '✓ ' : paymentStatus === 'deposit' ? '● ' : ''}
                        ${paymentStatusLabels[paymentStatus] || 'Không xác định'}
                    </span>
                        </div>
                        <div style="display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-2); font-size: var(--font-size-xs); color: var(--muted);">
                            ${metaIcons}
                        </div>
                    </div>
                </td>
                ${canShowDelete ? `
                    <td class="session-actions" onclick="event.stopPropagation();" style="text-align: center;">
                        <button class="btn-delete-icon" onclick="deleteSession('${classId}', '${session.id}'); return false;" title="Xóa buổi học">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                ` : ''}
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="class-detail-stats-grid" style="margin-top: var(--spacing-4);">
            <div class="class-detail-stat-item">
                <div class="class-detail-stat-label">Tổng số buổi</div>
                <div class="class-detail-stat-value">${displaySessions.length}</div>
            </div>
            <div class="class-detail-stat-item">
                <div class="class-detail-stat-label">Tổng trợ cấp</div>
                <div class="class-detail-stat-value" style="color: var(--primary);">${window.UniData.formatCurrency(totalAllowance)}</div>
            </div>
        </div>
        ${canManage ? `
            <div class="mt-4 p-3" style="background: var(--bg); border-radius: var(--radius); border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: var(--spacing-2); color: var(--muted); font-size: var(--font-size-sm);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                    </svg>
                    <span>Chọn một buổi để xem chi tiết hoặc chỉnh sửa trong popup.</span>
                </div>
            </div>
        ` : ''}
    `;

    return html;
}

/**
 * Open session modal for create/edit
 */
function openSessionModal(classId, sessionId = null) {
    const cls = window.demo.classes.find(c => c.id === classId);
    if (!cls) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI.hasRole('admin');
    const isTeacherUser = currentUser?.role === 'teacher';
    const hasCskhPrivileges = window.UniUI.userHasStaffRole?.('cskh_sale');
    const canManagePaymentStatus = window.UniUI.hasRole('admin', 'accountant') || hasCskhPrivileges;

    const isEdit = Boolean(sessionId);
    const session = isEdit ? window.demo.sessions.find(s => s.id === sessionId) : null;
    const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
    const teacherOptions = window.demo.teachers.filter(t => teacherIds.includes(t.id));

    const selfTeacherRecord = isTeacherUser
        ? window.demo.teachers.find(t => {
            if (t.userId && currentUser.id) return t.userId === currentUser.id;
            if (currentUser.linkId) return t.id === currentUser.linkId;
            return false;
        })
        : null;
    
    // Get students in class
    const students = window.UniLogic.getRelated('class', classId, 'students');
    
    // Get existing attendance if editing
    const existingAttendance = isEdit && session 
        ? (window.demo.attendance || []).filter(a => a.sessionId === sessionId)
        : [];

    const studentClassRecords = (window.demo.studentClasses || []).filter(sc => sc.classId === classId && sc.status !== 'inactive');
    const estimatedPaidCount = (() => {
        // Nếu đã có dữ liệu buổi học cũ thì dùng đúng số đã lưu
        if (session && typeof session.studentPaidCount === 'number') return session.studentPaidCount;
        // Với buổi mới: chỉ tính những học sinh thật sự còn buổi (đã gia hạn)
        if (studentClassRecords.length > 0) {
            const renewed = studentClassRecords.filter(sc => (sc.remainingSessions || 0) > 0);
            return renewed.length;
        }
        // Nếu lớp chưa có thông tin gia hạn → coi như 0 học sinh đã gia hạn
        return 0;
    })();

    const initialTeacherId = (() => {
        if (session?.teacherId) return session.teacherId;
        if (isTeacherUser && selfTeacherRecord && teacherIds.includes(selfTeacherRecord.id)) return selfTeacherRecord.id;
        if (teacherIds.length) return teacherIds[0];
        return '';
    })();
    // Xử lý đúng trường hợp coefficient = 0 (không dùng || vì 0 là falsy)
    const initialCoefficient = session && typeof session.coefficient === 'number' 
        ? session.coefficient 
        : 1;

    const computeAllowancePreview = (teacherIdValue, coefficientValue, paidCountValue) => {
        if (!teacherIdValue) return 0;
        // Nếu hệ số = 0 thì số tiền = 0 luôn, không tính theo công thức
        if (coefficientValue === 0) return 0;
        const customAllowances = cls.customTeacherAllowances || {};
        const baseAllowanceSource = (customAllowances[teacherIdValue] ?? cls.tuitionPerSession);
        const baseAllowance = Number(baseAllowanceSource || 0) || 0;
        const scaleAmount = Number(cls.scaleAmount || 0) || 0;
        const maxPerSession = Number(cls.maxAllowancePerSession || 0) || 0;
        let allowance = baseAllowance * coefficientValue * paidCountValue + scaleAmount;
        if (maxPerSession > 0 && allowance > maxPerSession) {
            allowance = maxPerSession;
        }
        return Math.round(allowance > 0 ? allowance : 0);
    };

    const initialAllowance = (() => {
        if (session) {
            if (typeof session.allowanceAmount === 'number' && session.allowanceAmount > 0) {
                return session.allowanceAmount;
            }
            return typeof session.allowanceAmount === 'number'
                ? session.allowanceAmount
                : computeAllowancePreview(session.teacherId, session.coefficient || 1, session.studentPaidCount || estimatedPaidCount);
        }
        return initialTeacherId ? computeAllowancePreview(initialTeacherId, initialCoefficient, estimatedPaidCount) : 0;
    })();

    const paymentStatusLabels = {
        paid: 'Thanh Toán',
        unpaid: 'Chưa Thanh Toán',
        deposit: 'Cọc'
    };

    const initialPaymentStatus = session?.paymentStatus || 'unpaid';
    const paymentStatusField = canManagePaymentStatus
        ? `
        <div class="form-group">
            <label for="sessionPaymentStatus">Trạng thái thanh toán*</label>
            <select id="sessionPaymentStatus" name="paymentStatus" class="form-control" required ${!canManagePaymentStatus ? 'disabled' : ''}>
                <option value="unpaid" ${initialPaymentStatus === 'unpaid' ? 'selected' : ''}>Chưa Thanh Toán</option>
                <option value="paid" ${initialPaymentStatus === 'paid' ? 'selected' : ''}>Thanh Toán</option>
                <option value="deposit" ${initialPaymentStatus === 'deposit' ? 'selected' : ''}>Cọc</option>
            </select>
            <div class="text-muted text-sm mt-1">Chọn trạng thái thanh toán cho buổi dạy này</div>
            </div>
    ` : `
        <div class="form-group">
            <label>Trạng thái thanh toán</label>
            <input type="hidden" name="paymentStatus" value="${initialPaymentStatus}">
            <div class="form-control" style="background: var(--surface); cursor: not-allowed;" aria-disabled="true">
                ${paymentStatusLabels[initialPaymentStatus] || paymentStatusLabels.unpaid}
        </div>
            <div class="text-muted text-sm mt-1">Chỉ quản trị viên hoặc kế toán có thể cập nhật trạng thái thanh toán.</div>
        </div>
    `;

    const form = document.createElement('form');
    const teacherField = `
        <div class="form-group">
            <label for="sessionTeacher">Gia sư dạy*</label>
            <select id="sessionTeacher" name="teacherId" class="form-control" required ${isTeacherUser ? 'disabled' : ''}>
                <option value="">-- Chọn gia sư --</option>
                ${teacherOptions
                    .map((t) => `
                        <option value="${t.id}" ${initialTeacherId === t.id ? 'selected' : ''}>
                            ${t.fullName}
                        </option>
                    `).join('')}
            </select>
            ${isTeacherUser ? '<div class="text-muted text-sm mt-1">Bạn chỉ có thể tạo buổi học cho chính mình.</div>' : ''}
        </div>
    `;

    form.innerHTML = `
        <div class="form-group">
            <label for="sessionDate">Ngày*</label>
            <input 
                type="date" 
                id="sessionDate" 
                name="date" 
                class="form-control"
                value="${session?.date || ''}" 
                required
            >
            </div>
        <div class="form-group">
            <label>Thời gian*</label>
            <div class="session-time-row">
                <div class="session-time-field">
                    <span class="session-time-label">Bắt đầu</span>
                    <input 
                        type="time"
                        id="sessionStartTime" 
                        name="startTime" 
                        class="form-control"
                        value="${session?.startTime || ''}" 
                        required
                    >
                </div>
                <span class="session-time-separator" aria-hidden="true">→</span>
                <div class="session-time-field">
                    <span class="session-time-label">Kết thúc</span>
                    <input 
                        type="time"
                        id="sessionEndTime" 
                        name="endTime" 
                        class="form-control"
                        value="${session?.endTime || ''}" 
                        required
                    >
                </div>
            </div>
            <div class="text-muted text-xs mt-1" id="sessionDurationLabel"></div>
        </div>
        <div class="form-group">
            <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-3);">
                <div>
                    <label for="sessionTeacher">Gia sư*</label>
                    <select id="sessionTeacher" name="teacherId" class="form-control" required ${isTeacherUser ? 'disabled' : ''}>
                        <option value="">-- Chọn gia sư --</option>
                        ${teacherOptions
                            .map((t) => `
                                <option value="${t.id}" ${initialTeacherId === t.id ? 'selected' : ''}>
                                    ${t.fullName}
                                </option>
                            `).join('')}
                    </select>
                    ${isTeacherUser ? '<div class="text-muted text-sm mt-1">Bạn chỉ có thể tạo buổi học cho chính mình.</div>' : ''}
                </div>
                <div>
            <label for="sessionCoefficient">Hệ số (0-10)*</label>
            <input 
                type="number" 
                id="sessionCoefficient" 
                name="coefficient" 
                class="form-control"
                value="${session && typeof session.coefficient === 'number' ? session.coefficient : 1}" 
                min="0" 
                max="10" 
                step="0.1"
                required
            >
            <div class="text-muted text-sm mt-1">Hệ số từ 0 đến 10</div>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label>Trợ cấp giáo viên</label>
            <div 
                class="session-allowance-preview ${isEdit && session && typeof session.allowanceAmount === 'number' && session.allowanceAmount >= 0 && isAdmin ? 'session-allowance-editable' : ''}" 
                id="sessionAllowancePreview"
                ${isEdit && session && typeof session.allowanceAmount === 'number' && session.allowanceAmount >= 0 && isAdmin ? `data-session-id="${session.id}" data-class-id="${classId}" data-editable="true" title="Click để chỉnh sửa trợ cấp giáo viên"` : ''}
            >${
                initialAllowance > 0
                    ? (window.UniData.formatCurrency ? window.UniData.formatCurrency(initialAllowance) : `${initialAllowance.toLocaleString('vi-VN')} đ`)
                    : '<span class="text-muted">Tự động tính sau khi lưu buổi học</span>'
            }</div>
            <div class="text-muted text-xs" id="sessionAllowanceMeta">${
                session
                    ? `Đã gia hạn: ${session.studentPaidCount || 0} học sinh • Hệ số ${session && typeof session.coefficient === 'number' ? session.coefficient : 1}`
                    : (initialTeacherId ? `Ước tính dựa trên ${estimatedPaidCount} học sinh hiện còn buổi` : 'Chọn gia sư và điểm danh để xem trợ cấp dự kiến')
            }</div>
        </div>
        ${paymentStatusField}
        <div class="form-group" style="width: 100%;">
            <label for="sessionNotes">Nhận xét*</label>
            <textarea 
                id="sessionNotes" 
                name="notes" 
                class="form-control"
                rows="5"
                placeholder="Nhận xét về buổi học, tiến độ học sinh..."
                required
                style="width: 100%; white-space: pre-wrap; font-size: var(--font-size-sm); line-height: 1.6; padding: var(--spacing-3);"
            >${session?.notes || ''}</textarea>
            <div class="text-muted text-sm mt-1">Vui lòng nhập nhận xét cho buổi học</div>
            <div class="form-error" id="sessionNotesError" style="display: none; margin-top: var(--spacing-1); color: var(--danger); font-size: var(--font-size-sm);">
                Vui lòng nhập nhận xét cho buổi học
            </div>
        </div>

        ${students.length > 0 ? `
            <div class="form-group">
                <label>Điểm danh học sinh*</label>
                <div class="card" style="margin-top: var(--spacing-2); max-height: 300px; overflow-y: auto;">
            <div class="table-container">
                        <table style="font-size: var(--font-size-sm); width: 100%;">
                    <thead>
                        <tr>
                                    <th style="width: 60px; text-align: center;">Trạng thái</th>
                                    <th>Tên học sinh</th>
                                    <th>Ghi chú</th>
                        </tr>
                    </thead>
                            <tbody id="attendanceTableBody">
                                ${students.map(student => {
                                    const existingAtt = existingAttendance.find(a => a.studentId === student.id);
                                    // Nếu đang sửa buổi cũ → theo đúng trạng thái đã lưu
                                    // Nếu là buổi mới → chỉ tự tick cho học sinh đã gia hạn (còn buổi > 0)
                                    let isPresent = true;
                                    if (existingAtt) {
                                        isPresent = existingAtt.present;
                                    } else {
                                        const scRecord = studentClassRecords.find(sc => sc.studentId === student.id);
                                        isPresent = !!(scRecord && (scRecord.remainingSessions || 0) > 0);
                                    }
                                    const remark = existingAtt ? existingAtt.remark || '' : '';
                                    return `
                                        <tr>
                                            <td style="text-align: center; vertical-align: middle;">
                                                <button 
                                                    type="button"
                                                    class="attendance-icon-btn ${isPresent ? 'present' : 'absent'}" 
                                                    data-student-id="${student.id}"
                                                    title="${isPresent ? 'Có mặt' : 'Vắng mặt'}"
                                                    style="background: none; border: none; cursor: pointer; padding: var(--spacing-1); border-radius: var(--radius); transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px;"
                                                >
                                                    ${isPresent ? `
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--success);">
                                                            <path d="M20 6L9 17l-5-5"></path>
                                                        </svg>
                                                    ` : `
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--danger);">
                                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                                        </svg>
                                                    `}
                                                </button>
                                                    <input 
                                                    type="hidden" 
                                                        name="attendance_${student.id}" 
                                                        data-student-id="${student.id}"
                                                    value="${isPresent ? '1' : '0'}"
                                                    >
                                </td>
                                            <td style="vertical-align: middle;">${student.fullName}</td>
                                            <td style="vertical-align: middle;">
                                                <input 
                                                    type="text" 
                                                    name="remark_${student.id}" 
                                                    class="form-control" 
                                                    placeholder="Ghi chú (nếu vắng)"
                                                    value="${remark}"
                                                    style="font-size: var(--font-size-xs); padding: var(--spacing-1) var(--spacing-2);"
                                                >
                                </td>
                            </tr>
                                    `;
                                }).join('')}
                    </tbody>
                </table>
            </div>
                </div>
                <div class="text-muted text-sm mt-2" id="attendanceSummary">
                    Tổng: <span id="presentCount">0</span> có mặt, <span id="absentCount">${students.length}</span> vắng mặt
                </div>
            </div>
        ` : '<div class="text-muted text-sm">Lớp chưa có học sinh</div>'}
        
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm buổi'}</button>
        </div>
    `;
    
    const sessionDateInput = form.querySelector('#sessionDate');
    const startTimeInput = form.querySelector('#sessionStartTime');
    const endTimeInput = form.querySelector('#sessionEndTime');
    const durationLabelEl = form.querySelector('#sessionDurationLabel');
    const teacherSelect = form.querySelector('#sessionTeacher');
    const coefficientInput = form.querySelector('#sessionCoefficient');
    const allowancePreviewEl = form.querySelector('#sessionAllowancePreview');
    const allowanceMetaEl = form.querySelector('#sessionAllowanceMeta');
    const attendanceCheckboxes = form.querySelectorAll('input[type="checkbox"][name^="attendance_"]');
    
    // Hàm helper để mở picker cho date/time input
    const openPicker = (input) => {
        if (!input) return;
        
        // Focus vào input trước
        input.focus();
        
        // Thử dùng showPicker() API nếu browser hỗ trợ (Chrome 99+, Edge 99+)
        if (input.showPicker && typeof input.showPicker === 'function') {
            try {
                input.showPicker();
                return;
            } catch (err) {
                // Fallback nếu showPicker() không hoạt động (có thể do không user-initiated)
                console.debug('[SessionForm] showPicker() failed, using fallback:', err);
            }
        }
        
        // Fallback: trigger click event để mở native picker
        // Sử dụng setTimeout để đảm bảo focus đã hoàn tất
        setTimeout(() => {
            input.click();
        }, 10);
    };
    
    // Làm cho toàn bộ ô input date có thể click để mở picker
    if (sessionDateInput) {
        const dateInputContainer = sessionDateInput.closest('.form-group');
        
        // Thêm class để styling
        sessionDateInput.classList.add('date-picker-clickable');
        if (dateInputContainer) {
            dateInputContainer.classList.add('date-picker-container');
        }
        
        // Event listener cho container (label, padding area)
        if (dateInputContainer) {
            dateInputContainer.addEventListener('click', (e) => {
                // Chỉ trigger nếu không click trực tiếp vào input
                if (e.target !== sessionDateInput && !sessionDateInput.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    openPicker(sessionDateInput);
                }
            });
        }
        
        // Event listener trực tiếp cho input (đảm bảo click vào input cũng mở picker)
        // Với input type="date", browser mặc định chỉ mở picker khi click vào icon
        // Chúng ta cần đảm bảo click vào bất kỳ đâu trong input cũng mở picker
        sessionDateInput.addEventListener('mousedown', (e) => {
            // Nếu click vào input (không phải icon), mở picker
            const rect = sessionDateInput.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            const iconWidth = 30; // Approximate width of calendar icon
            
            // Nếu click không phải ở vùng icon (bên phải), mở picker
            if (clickX < rect.width - iconWidth) {
                e.preventDefault();
                openPicker(sessionDateInput);
            }
        });
        
        // Fallback: click event cho mobile/touch devices
        sessionDateInput.addEventListener('click', (e) => {
            // Với touch devices, luôn mở picker
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                e.preventDefault();
                openPicker(sessionDateInput);
            }
        });
        
        // Đảm bảo input có cursor pointer
        sessionDateInput.style.cursor = 'pointer';
    }
    
    // Làm cho toàn bộ ô time input có thể click để mở picker
    [startTimeInput, endTimeInput].forEach((timeInput, index) => {
        if (!timeInput) return;
        const timeFieldContainer = timeInput.closest('.session-time-field');
        
        // Thêm class để styling
        timeInput.classList.add('time-picker-clickable');
        if (timeFieldContainer) {
            timeFieldContainer.classList.add('time-picker-container');
        }
        
        // Event listener cho container (label, padding area)
        if (timeFieldContainer) {
            timeFieldContainer.addEventListener('click', (e) => {
                // Chỉ trigger nếu không click trực tiếp vào input
                if (e.target !== timeInput && !timeInput.contains(e.target)) {
                    e.preventDefault();
                    e.stopPropagation();
                    openPicker(timeInput);
                }
            });
        }
        
        // Event listener trực tiếp cho input
        // Với input type="time", browser mặc định chỉ mở picker khi click vào icon
        // Chúng ta cần đảm bảo click vào bất kỳ đâu trong input cũng mở picker
        timeInput.addEventListener('mousedown', (e) => {
            // Nếu click vào input (không phải icon), mở picker
            const rect = timeInput.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const iconWidth = 30; // Approximate width of clock icon
            
            // Nếu click không phải ở vùng icon (bên phải), mở picker
            if (clickX < rect.width - iconWidth) {
                e.preventDefault();
                openPicker(timeInput);
            }
        });
        
        // Fallback: click event cho mobile/touch devices
        timeInput.addEventListener('click', (e) => {
            // Với touch devices, luôn mở picker
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                e.preventDefault();
                openPicker(timeInput);
            }
        });
        
        // Đảm bảo input có cursor pointer
        timeInput.style.cursor = 'pointer';
    });

    const formatCurrency = (value) => {
        if (window.UniData && typeof window.UniData.formatCurrency === 'function') {
            return window.UniData.formatCurrency(value || 0);
        }
        return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
    };

    const lockedAllowance = isEdit && session && typeof session.allowanceAmount === 'number' && session.allowanceAmount >= 0;

    const parseTimeToMinutes = (value) => {
        if (typeof value !== 'string' || !value.includes(':')) return NaN;
        const [hours, minutes] = value.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return NaN;
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
        return hours * 60 + minutes;
    };

    const updateDurationLabel = () => {
        if (!durationLabelEl || !startTimeInput || !endTimeInput) return;
        const startValue = startTimeInput.value;
        const endValue = endTimeInput.value;
        if (!startValue || !endValue) {
            durationLabelEl.textContent = '';
            durationLabelEl.classList.remove('text-danger');
            return;
        }
        const start = parseTimeToMinutes(startValue);
        const end = parseTimeToMinutes(endValue);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            const diff = end - start;
            const hours = Math.floor(diff / 60);
            const minutes = diff % 60;
            const parts = [];
            if (hours > 0) parts.push(`${hours} giờ`);
            if (minutes > 0) parts.push(`${minutes} phút`);
            durationLabelEl.textContent = parts.length ? `Thời lượng: ${parts.join(' ')}` : 'Thời lượng: < 1 phút';
            durationLabelEl.classList.remove('text-danger');
        } else if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
            durationLabelEl.textContent = '⚠️ Giờ kết thúc phải lớn hơn giờ bắt đầu';
            durationLabelEl.classList.add('text-danger');
        } else {
            durationLabelEl.textContent = '';
            durationLabelEl.classList.remove('text-danger');
        }
    };

    const getCurrentPaidCount = () => {
        // Số học sinh đã gia hạn luôn dựa trên remainingSessions > 0,
        // không phụ thuộc vào trạng thái có mặt/vắng mặt
        return estimatedPaidCount;
    };

    const updateAllowanceDisplay = () => {
        if (!allowancePreviewEl) return;
        const teacherIdValue = teacherSelect?.value || '';
        // Lấy giá trị từ input, xử lý đúng trường hợp coefficient = 0 (không dùng || vì 0 là falsy)
        const inputValue = coefficientInput?.value;
        let coefficientValue;
        if (inputValue !== null && inputValue !== undefined && inputValue !== '') {
            const parsed = parseFloat(inputValue);
            coefficientValue = isNaN(parsed) ? (initialCoefficient != null ? initialCoefficient : 1) : parsed;
        } else {
            coefficientValue = initialCoefficient != null ? initialCoefficient : 1;
        }
        const paidCountValue = session && typeof session.studentPaidCount === 'number'
            ? session.studentPaidCount
            : getCurrentPaidCount();

        if (!teacherIdValue) {
            allowancePreviewEl.innerHTML = '<span class="text-muted">Chọn gia sư để tính trợ cấp</span>';
            if (allowanceMetaEl) allowanceMetaEl.textContent = '';
            return;
        }

        const allowanceValue = lockedAllowance
            ? session.allowanceAmount || 0
            : computeAllowancePreview(teacherIdValue, coefficientValue, paidCountValue);

        allowancePreviewEl.textContent = formatCurrency(allowanceValue);
        if (allowanceMetaEl) {
            if (lockedAllowance) {
                // Khi locked, lấy hệ số từ session hoặc từ input hiện tại
                const displayedCoefficient = session && typeof session.coefficient === 'number' 
                    ? session.coefficient 
                    : (coefficientValue != null ? coefficientValue : 1);
                const label = session && typeof session.studentPaidCount === 'number'
                    ? `Đã gia hạn: ${paidCountValue} học sinh • Hệ số ${displayedCoefficient}`
                    : '';
                allowanceMetaEl.textContent = `${label}${label ? ' • ' : ''}Trợ cấp cố định khi tạo buổi học`;
            } else {
                const label = session && typeof session.studentPaidCount === 'number'
                    ? `Đã gia hạn: ${paidCountValue} học sinh đã gia hạn`
                    : `Ước tính: ${paidCountValue} học sinh đã gia hạn`;
                allowanceMetaEl.textContent = `${label} • Hệ số ${coefficientValue}`;
            }
        }
    };

    startTimeInput?.addEventListener('input', updateDurationLabel);
    endTimeInput?.addEventListener('input', updateDurationLabel);
    if (!lockedAllowance) {
        teacherSelect?.addEventListener('change', updateAllowanceDisplay);
        coefficientInput?.addEventListener('input', updateAllowanceDisplay);
        // Trạng thái attendance không ảnh hưởng đến số học sinh đã gia hạn
        // Chỉ cập nhật summary, không cập nhật allowance
        attendanceCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                updateAttendanceSummary(form, students.length);
                // Không gọi updateAllowanceDisplay() vì attendance không ảnh hưởng đến paidCount
            });
        });
    }
    updateDurationLabel();
    updateAllowanceDisplay();

    // Handle inline editing of allowance (admin only)
    if (isAdmin && lockedAllowance && allowancePreviewEl && allowancePreviewEl.dataset.editable === 'true') {
        // Add CSS styling for editable allowance
        if (!document.getElementById('allowance-editable-style')) {
            const style = document.createElement('style');
            style.id = 'allowance-editable-style';
            style.textContent = `
                .session-allowance-editable {
                    cursor: pointer;
                    position: relative;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                }
                .session-allowance-editable:hover {
                    background-color: rgba(0, 123, 255, 0.1);
                }
                .session-allowance-editable[data-editing="true"] {
                    cursor: default;
                }
            `;
            document.head.appendChild(style);
        }
        
        allowancePreviewEl.style.cursor = 'pointer';
        allowancePreviewEl.style.position = 'relative';
        
        // Add edit icon on hover
        let editIcon = null;
        allowancePreviewEl.addEventListener('mouseenter', () => {
            if (!editIcon && allowancePreviewEl.dataset.editing !== 'true') {
                editIcon = document.createElement('span');
                editIcon.innerHTML = ' ✏️';
                editIcon.style.fontSize = '0.9em';
                editIcon.style.opacity = '0.7';
                allowancePreviewEl.appendChild(editIcon);
            }
        });
        
        allowancePreviewEl.addEventListener('mouseleave', () => {
            if (editIcon && allowancePreviewEl.dataset.editing !== 'true') {
                editIcon.remove();
                editIcon = null;
            }
        });
        
        // Handle click to switch to input
        allowancePreviewEl.addEventListener('click', (e) => {
            if (allowancePreviewEl.dataset.editing === 'true') return;
            
            e.stopPropagation();
            const currentAmount = session.allowanceAmount || 0;
            const currentText = allowancePreviewEl.textContent.trim();
            
            // Remove edit icon
            if (editIcon) {
                editIcon.remove();
                editIcon = null;
            }
            
            // Create input element
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control';
            input.style.width = '100%';
            input.style.fontSize = allowancePreviewEl.style.fontSize || 'inherit';
            input.style.fontWeight = allowancePreviewEl.style.fontWeight || 'inherit';
            input.value = String(currentAmount);
            
            // Attach currency input handler
            if (window.UniUI && window.UniUI.attachCurrencyInput) {
                window.UniUI.attachCurrencyInput(input, {
                    allowNegative: true,
                    showVietnameseWords: false
                });
            }
            
            // Store original content
            const originalContent = allowancePreviewEl.innerHTML;
            const originalText = currentText;
            
            // Replace preview with input
            allowancePreviewEl.innerHTML = '';
            allowancePreviewEl.appendChild(input);
            allowancePreviewEl.dataset.editing = 'true';
            input.focus();
            input.select();
            
            // Handle blur to save
            const handleBlur = async () => {
                if (allowancePreviewEl.dataset.editing !== 'true') return;
                
                const newValue = input.value.trim();
                const parsedAmount = window.UniUI && window.UniUI.parseCurrencyString 
                    ? window.UniUI.parseCurrencyString(newValue)
                    : parseInt(newValue.replace(/[^\d-]/g, ''), 10);
                
                if (isNaN(parsedAmount)) {
                    // Invalid input, revert
                    allowancePreviewEl.innerHTML = originalContent;
                    allowancePreviewEl.dataset.editing = 'false';
                    return;
                }
                
                if (parsedAmount === currentAmount) {
                    // No change, just revert
                    allowancePreviewEl.innerHTML = originalContent;
                    allowancePreviewEl.dataset.editing = 'false';
                    return;
                }
                
                // Show loading state
                allowancePreviewEl.innerHTML = '<span class="text-muted">Đang cập nhật...</span>';
                
                try {
                    await updateSessionAllowance(classId, sessionId, parsedAmount);
                    // Update session object in memory
                    session.allowanceAmount = parsedAmount;
                    // Refresh display
                    const formatCurrency = (value) => {
                        if (window.UniData && typeof window.UniData.formatCurrency === 'function') {
                            return window.UniData.formatCurrency(value || 0);
                        }
                        return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
                    };
                    allowancePreviewEl.innerHTML = formatCurrency(parsedAmount);
                    allowancePreviewEl.dataset.editing = 'false';
                    // Refresh the form to reflect updated values
                    setTimeout(() => {
                        if (allowanceMetaEl) {
                            const displayedCoefficient = session && typeof session.coefficient === 'number' 
                                ? session.coefficient 
                                : 1;
                            const label = session && typeof session.studentPaidCount === 'number'
                                ? `Đã gia hạn: ${session.studentPaidCount || 0} học sinh • Hệ số ${displayedCoefficient}`
                                : '';
                            allowanceMetaEl.textContent = `${label}${label ? ' • ' : ''}Trợ cấp cố định khi tạo buổi học`;
                        }
                    }, 100);
                } catch (error) {
                    console.error('Failed to update allowance:', error);
                    window.UniUI.toast('Không thể cập nhật trợ cấp giáo viên', 'error');
                    allowancePreviewEl.innerHTML = originalContent;
                    allowancePreviewEl.dataset.editing = 'false';
                }
            };
            
            // Handle Enter key
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    input.blur();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    allowancePreviewEl.innerHTML = originalContent;
                    allowancePreviewEl.dataset.editing = 'false';
                    input.removeEventListener('blur', handleBlur);
                    input.removeEventListener('keydown', handleKeyDown);
                }
            };
            
            input.addEventListener('blur', handleBlur);
            input.addEventListener('keydown', handleKeyDown);
        });
    }

    // Add event listeners for attendance checkboxes
    if (students.length > 0) {
        attendanceCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const studentId = this.dataset.studentId;
                const statusSpan = form.querySelector(`.attendance-status[data-student-id="${studentId}"]`);
                if (statusSpan) {
                    statusSpan.textContent = this.checked ? '✅ Có mặt' : '❌ Vắng mặt';
                }
                updateAttendanceSummary(form, students.length);
            });
        });
        
        // Initialize summary
        updateAttendanceSummary(form, students.length);
    }

    // Validation cho notes (required)
    const notesInput = form.querySelector('#sessionNotes');
    const notesErrorEl = form.querySelector('#sessionNotesError');
    if (notesInput) {
        notesInput.addEventListener('blur', () => {
            if (!notesInput.value || notesInput.value.trim() === '') {
                notesInput.classList.add('error');
                if (notesErrorEl) notesErrorEl.style.display = 'block';
            } else {
                notesInput.classList.remove('error');
                if (notesErrorEl) notesErrorEl.style.display = 'none';
            }
        });
        
        notesInput.addEventListener('input', () => {
            if (notesInput.value && notesInput.value.trim() !== '') {
                notesInput.classList.remove('error');
                if (notesErrorEl) notesErrorEl.style.display = 'none';
            }
        });
    }
    
    // Xử lý icon điểm danh
    const attendanceIconButtons = form.querySelectorAll('.attendance-icon-btn');
    attendanceIconButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const studentId = btn.dataset.studentId;
            const hiddenInput = form.querySelector(`input[type="hidden"][name="attendance_${studentId}"]`);
            if (!hiddenInput) return;
            
            const isCurrentlyPresent = hiddenInput.value === '1';
            const newValue = isCurrentlyPresent ? '0' : '1';
            hiddenInput.value = newValue;
            
            // Cập nhật icon và class
            if (newValue === '1') {
                btn.classList.remove('absent');
                btn.classList.add('present');
                btn.title = 'Có mặt';
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--success);">
                        <path d="M20 6L9 17l-5-5"></path>
                    </svg>
                `;
            } else {
                btn.classList.remove('present');
                btn.classList.add('absent');
                btn.title = 'Vắng mặt';
                btn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--danger);">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
            }
            
            updateAttendanceSummary(form, students.length);
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Validate notes
        if (!notesInput || !notesInput.value || notesInput.value.trim() === '') {
            notesInput.classList.add('error');
            if (notesErrorEl) notesErrorEl.style.display = 'block';
            notesInput.focus();
            window.UniUI?.toast?.('Vui lòng nhập nhận xét cho buổi học', 'error');
            return;
        }
        
        const formData = new FormData(form);
        
        const date = formData.get('date');
        const startTime = formData.get('startTime');
        const endTime = formData.get('endTime');
        let teacherId = formData.get('teacherId');
        if (!isAdmin) {
            if (isTeacherUser && selfTeacherRecord) {
                teacherId = selfTeacherRecord.id;
            }
        }
        const coefficient = Number(formData.get('coefficient'));
        const paymentStatus = canManagePaymentStatus
            ? (formData.get('paymentStatus') || 'unpaid')
            : initialPaymentStatus;
        const notes = formData.get('notes');

        const startMinutes = parseTimeToMinutes(startTime);
        const endMinutes = parseTimeToMinutes(endTime);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
            window.UniUI.toast('Vui lòng nhập thời gian hợp lệ (hh:mm)', 'error');
            return;
        }
        if (endMinutes <= startMinutes) {
            window.UniUI.toast('Giờ kết thúc phải lớn hơn giờ bắt đầu', 'error');
            return;
        }

        if (coefficient < 0 || coefficient > 10) {
            alert('Hệ số phải từ 0 đến 10');
            return;
        }

        // Use optimistic update pattern
        (async () => {
            try {
                await window.UniData.withOptimisticUpdate(
                    () => {
                        let latestSession = null;
                        let latestAttendanceRecords = [];
                        let attendanceDeletes = [];
                        let studentClassUpdates = [];
                        const supabaseEntities = {};
                        
                        const durationHours = (endMinutes - startMinutes) / 60;
                        const normalizedDuration = Number.isFinite(durationHours) ? Number(durationHours.toFixed(2)) : 0;
                        
                        if (isEdit) {
                            const sessionIndex = window.demo.sessions.findIndex(s => s.id === sessionId);
                            if (sessionIndex === -1) {
                                throw new Error('Không tìm thấy buổi học cần chỉnh sửa.');
                            }
                            const oldSession = { ...window.demo.sessions[sessionIndex] };
                            const updatedSession = {
                                ...oldSession,
                                date,
                                startTime,
                                endTime,
                                teacherId,
                                coefficient,
                                paymentStatus,
                                notes,
                                duration: normalizedDuration
                            };
                            window.demo.sessions[sessionIndex] = updatedSession;
                            latestSession = updatedSession;
                            
                            // Ghi lại hành động chỉnh sửa buổi học
                            if (window.ActionHistoryService) {
                                const changedFields = window.ActionHistoryService.getChangedFields(oldSession, updatedSession);
                                window.ActionHistoryService.recordAction({
                                    entityType: 'session',
                                    entityId: sessionId,
                                    actionType: 'update',
                                    beforeValue: oldSession,
                                    afterValue: updatedSession,
                                    changedFields: changedFields,
                                    description: `Cập nhật buổi học ngày ${date} của lớp ${cls.name || classId}`
                                });
                            }
                            
                            try { window.UniData.logAction('update', 'session', sessionId, { classId, date, teacherId }); } catch (logError) {
                                console.warn('Failed to log session update:', logError);
                            }
                        } else {
                            const newSession = {
                                id: 'SE' + Math.random().toString(36).slice(2, 7).toUpperCase(),
                                classId,
                                date,
                                startTime,
                                endTime,
                                teacherId,
                                coefficient,
                                paymentStatus,
                                notes,
                                duration: normalizedDuration
                            };
                            window.demo.sessions = window.demo.sessions || [];
                            window.demo.sessions.unshift(newSession);
                            latestSession = newSession;
                            
                            // Ghi lại hành động tạo buổi học mới
                            if (window.ActionHistoryService) {
                                window.ActionHistoryService.recordAction({
                                    entityType: 'session',
                                    entityId: newSession.id,
                                    actionType: 'create',
                                    beforeValue: null,
                                    afterValue: newSession,
                                    changedFields: null,
                                    description: `Tạo buổi học mới ngày ${date} cho lớp ${cls.name || classId}`
                                });
                            }
                            
                            // Apply session to students (updates remainingSessions)
                            if (typeof window.UniData.applySessionToStudents === 'function') {
                                const result = window.UniData.applySessionToStudents(newSession) || {};
                                studentClassUpdates = Array.isArray(result.affected) ? result.affected : [];
                            }
                            
                            try { window.UniData.logAction('create', 'session', newSession.id, { classId, date, teacherId }); } catch (logError) {
                                console.warn('Failed to log session creation:', logError);
                            }
                        }
                        
                        window.demo.attendance = window.demo.attendance || [];
                        if (isEdit && sessionId) {
                            const previousAttendance = window.demo.attendance.filter(a => a.sessionId === sessionId);
                            attendanceDeletes = previousAttendance.map(a => a.id);
                            window.demo.attendance = window.demo.attendance.filter(a => a.sessionId !== sessionId);
                        }
                        
                        if (students.length > 0 && latestSession) {
                            students.forEach(student => {
                                const checkbox = form.querySelector(`input[name="attendance_${student.id}"]`);
                                const remarkInput = form.querySelector(`input[name="remark_${student.id}"]`);
                                const isPresent = checkbox ? checkbox.checked : true;
                                const remark = remarkInput ? remarkInput.value.trim() : '';
                                latestAttendanceRecords.push({
                                    id: 'A' + Math.random().toString(36).slice(2, 7).toUpperCase(),
                                    sessionId: latestSession.id,
                                    studentId: student.id,
                                    present: isPresent,
                                    remark
                                });
                            });
                            if (latestAttendanceRecords.length > 0) {
                                window.demo.attendance.push(...latestAttendanceRecords);
                            }
                        }
                        
                        if (latestSession) {
                            supabaseEntities.sessions = [latestSession];
                        }
                        if (latestAttendanceRecords.length > 0) {
                            supabaseEntities.attendance = latestAttendanceRecords;
                        }
                        if (studentClassUpdates.length > 0) {
                            supabaseEntities.studentClasses = studentClassUpdates;
                        }
                        
                        const supabaseDeletes = attendanceDeletes.length > 0
                            ? { attendance: attendanceDeletes }
                            : undefined;
                        
                        return {
                            supabaseEntities,
                            supabaseDeletes
                        };
                    },
                    {
                        onSuccess: () => {
                            window.UniUI.closeModal();
                            renderClassDetail(classId);
                            window.UniUI.toast(isEdit ? 'Đã cập nhật buổi học' : 'Đã tạo buổi học mới', 'success');
                        },
                        onError: (error) => {
                            console.error('Failed to save session:', error);
                            window.UniUI.toast('Không thể lưu buổi học', 'error');
                        },
                        onRollback: () => {
                            renderClassDetail(classId);
                        }
                    }
                );
            } catch (error) {
                console.error('Error in session form submit:', error);
                window.UniUI.toast('Lỗi: ' + (error.message || 'Không xác định'), 'error');
            }
        })();
    });

    window.UniUI.openModal(isEdit ? 'Chỉnh sửa buổi học' : 'Thêm buổi học mới', form);
}

/**
 * Update attendance summary in form
 */
function updateAttendanceSummary(form, totalStudents) {
    const checkboxes = form.querySelectorAll('input[type="checkbox"][name^="attendance_"]');
    let presentCount = 0;
    checkboxes.forEach(cb => {
        if (cb.checked) presentCount++;
    });
    const absentCount = totalStudents - presentCount;
    
    const presentSpan = form.querySelector('#presentCount');
    const absentSpan = form.querySelector('#absentCount');
    if (presentSpan) presentSpan.textContent = presentCount;
    if (absentSpan) absentSpan.textContent = absentCount;
}

/**
 * Delete session
 */
async function deleteSession(classId, sessionId) {
    if (!confirm('Bạn có chắc chắn muốn xóa buổi học này?')) return;

    const session = window.demo.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const cls = window.demo.classes.find(c => c.id === classId);

    // Get attendance records to delete
    const attendanceRecords = (window.demo.attendance || []).filter(a => a.sessionId === sessionId);
    const attendanceIds = attendanceRecords.map(a => a.id);

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Ghi lại hành động xóa buổi học
            if (window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'session',
                    entityId: sessionId,
                    actionType: 'delete',
                    beforeValue: session,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa buổi học ngày ${session.date || ''} của lớp ${cls ? cls.name : classId}`
                });
            }
            
            // Remove session
            window.demo.sessions = window.demo.sessions.filter(s => s.id !== sessionId);
            
            // Remove attendance records for this session
            if (window.demo.attendance) {
                window.demo.attendance = window.demo.attendance.filter(a => a.sessionId !== sessionId);
            }
            
            return {
                supabaseDeletes: {
                    sessions: [sessionId],
                    attendance: attendanceIds
                }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa buổi học', 'success');
                renderClassDetail(classId);
            },
            onError: (error) => {
                console.error('Failed to delete session:', error);
                window.UniUI.toast('Không thể xóa buổi học', 'error');
            },
            onRollback: () => {
                renderClassDetail(classId);
            }
        }
    );
}

/**
 * Update session payment status quickly
 */
async function updateSessionStatus(classId, sessionId, newStatus) {
    const session = window.demo.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const oldStatus = session.paymentStatus || 'unpaid';
    if (oldStatus === newStatus) {
        // Already the same status, nothing to update
        return;
    }
    
    const cls = window.demo.classes.find(c => c.id === classId);
    const paymentStatusLabels = {
        paid: 'Đã thanh toán',
        unpaid: 'Chưa thanh toán',
        deposit: 'Cọc'
    };
    
    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            const oldSession = { ...session };
            session.paymentStatus = newStatus;
            updateSessionStatusUI(sessionId, newStatus);
            
            // Ghi lại hành động cập nhật trạng thái thanh toán
            if (window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'session',
                    entityId: sessionId,
                    actionType: 'update',
                    beforeValue: oldSession,
                    afterValue: { ...session },
                    changedFields: { paymentStatus: { before: oldStatus, after: newStatus } },
                    description: `Cập nhật trạng thái thanh toán buổi học ngày ${session.date || ''} của lớp ${cls ? cls.name : classId}: ${paymentStatusLabels[oldStatus] || oldStatus} → ${paymentStatusLabels[newStatus] || newStatus}`
                });
            }
            return {
                supabaseEntities: {
                    sessions: [session]
                }
            };
        },
        {
            onSuccess: () => {
                const paymentStatusLabels = {
                    paid: 'Đã thanh toán',
                    unpaid: 'Chưa thanh toán',
                    deposit: 'Cọc'
                };
                window.UniUI.toast(`Đã chuyển sang: ${paymentStatusLabels[newStatus] || newStatus}`, 'success');
            },
            onError: (error) => {
                console.error('Failed to update session status:', error);
                session.paymentStatus = oldStatus;
                updateSessionStatusUI(sessionId, oldStatus);
                window.UniUI.toast('Không thể cập nhật trạng thái', 'error');
            },
            onRollback: () => {
                renderClassDetail(classId);
            }
        }
    );
}

/**
 * Update session status UI
 */
function updateSessionStatusUI(sessionId, newStatus) {
    const row = document.querySelector(`tr[data-session-id="${sessionId}"]`);
    if (!row) return;
    
    const statusBadge = row.querySelector('.status-badge');
    const paymentStatusLabels = {
        'paid': '✅ Thanh Toán',
        'unpaid': '❌ Chưa Thanh Toán',
        'deposit': '💜 Cọc'
    };
    const paymentStatusColors = {
        'paid': 'badge-success',
        'unpaid': 'badge-danger',
        'deposit': 'badge-purple'
    };
    
    if (statusBadge) {
        statusBadge.className = `status-badge ${paymentStatusColors[newStatus]}`;
        statusBadge.textContent = paymentStatusLabels[newStatus];
    }
    
    row.dataset.paymentStatus = newStatus;
}

/**
 * Update session allowance amount (admin only)
 */
async function updateSessionAllowance(classId, sessionId, newAllowance) {
    const session = window.demo.sessions.find(s => s.id === sessionId);
    if (!session) {
        throw new Error('Không tìm thấy buổi học');
    }
    
    const oldAllowance = session.allowanceAmount || 0;
    if (oldAllowance === newAllowance) {
        // No change, return early
        return;
    }
    
    const cls = window.demo.classes.find(c => c.id === classId);
    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    
    // Check admin permission
    if (!window.UniUI.hasRole('admin')) {
        throw new Error('Chỉ admin mới được phép chỉnh sửa trợ cấp');
    }
    
    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            const oldSession = { ...session };
            
            // Store original subsidy if this is the first edit
            if (!session.subsidyOriginal && oldAllowance > 0) {
                session.subsidyOriginal = oldAllowance;
            }
            
            // Update allowance
            session.allowanceAmount = newAllowance;
            
            // Store audit info
            session.subsidyModifiedBy = currentUser?.id || currentUser?.email || 'unknown';
            session.subsidyModifiedAt = new Date().toISOString();
            
            // Record action in ActionHistoryService
            if (window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'session',
                    entityId: sessionId,
                    actionType: 'update',
                    beforeValue: oldSession,
                    afterValue: { ...session },
                    changedFields: {
                        allowanceAmount: {
                            before: oldAllowance,
                            after: newAllowance
                        },
                        subsidyOriginal: {
                            before: session.subsidyOriginal || null,
                            after: session.subsidyOriginal || oldAllowance
                        },
                        subsidyModifiedBy: {
                            before: null,
                            after: session.subsidyModifiedBy
                        },
                        subsidyModifiedAt: {
                            before: null,
                            after: session.subsidyModifiedAt
                        }
                    },
                    description: `Cập nhật trợ cấp giáo viên buổi học ngày ${session.date || ''} của lớp ${cls ? cls.name : classId}: ${oldAllowance.toLocaleString('vi-VN')} đ → ${newAllowance.toLocaleString('vi-VN')} đ`
                });
            }
            
            // Create a clean session object for DB save
            // NOTE: Temporarily only send allowance_amount to avoid errors before migration
            // Audit fields (subsidy_original, subsidy_modified_by, subsidy_modified_at) 
            // are stored in memory and ActionHistoryService for now
            // After running migration, these fields will be automatically included in DB saves
            const sessionToSave = {
                id: session.id,
                classId: session.classId,
                teacherId: session.teacherId,
                date: session.date,
                startTime: session.startTime,
                endTime: session.endTime,
                duration: session.duration,
                coefficient: session.coefficient,
                notes: session.notes,
                paymentStatus: session.paymentStatus,
                allowanceAmount: newAllowance
                // TODO: After migration is run, uncomment these lines:
                // subsidyOriginal: session.subsidyOriginal,
                // subsidyModifiedBy: session.subsidyModifiedBy,
                // subsidyModifiedAt: session.subsidyModifiedAt
            };
            
            return {
                supabaseEntities: {
                    sessions: [sessionToSave]
                }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã cập nhật trợ cấp giáo viên', 'success');
            },
            onError: (error) => {
                console.error('Failed to update session allowance:', error);
                session.allowanceAmount = oldAllowance;
                if (session.subsidyOriginal === oldAllowance) {
                    delete session.subsidyOriginal;
                }
                delete session.subsidyModifiedBy;
                delete session.subsidyModifiedAt;
                window.UniUI.toast('Không thể cập nhật trợ cấp giáo viên', 'error');
            },
            onRollback: () => {
                // Refresh class detail to show correct allowance
                renderClassDetail(classId);
            }
        }
    );
}

function getSelectedSessionIds() {
    return Array.from(document.querySelectorAll('.session-checkbox:checked')).map(cb => cb.dataset.sessionId);
}

function openBulkSessionStatusModal(classId) {
    const selectedIds = getSelectedSessionIds();
    if (!selectedIds.length) {
        window.UniUI.toast('Vui lòng chọn ít nhất một buổi học để cập nhật trạng thái.', 'warning');
        return;
    }

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="bulkSessionStatus">Trạng thái thanh toán</label>
            <select id="bulkSessionStatus" name="status" class="form-control" required>
                <option value="paid">Thanh Toán</option>
                <option value="unpaid">Chưa Thanh Toán</option>
                <option value="deposit">Cọc</option>
            </select>
            <div class="text-muted text-sm mt-1">Áp dụng cho ${selectedIds.length} buổi đã chọn.</div>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Cập nhật</button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusSelect = form.querySelector('#bulkSessionStatus');
        const newStatus = statusSelect ? statusSelect.value : 'unpaid';
        const sessions = window.demo.sessions || [];
        const updatedSessions = [];
        const oldStatuses = new Map();

        const cls = window.demo.classes.find(c => c.id === classId);
        const paymentStatusLabels = {
            paid: 'Đã thanh toán',
            unpaid: 'Chưa thanh toán',
            deposit: 'Cọc'
        };
        
        selectedIds.forEach(id => {
            const session = sessions.find(s => s.id === id);
            if (session && session.paymentStatus !== newStatus) {
                oldStatuses.set(session.id, session.paymentStatus || 'unpaid');
                session.paymentStatus = newStatus;
                updatedSessions.push(session);
            }
        });

        if (!updatedSessions.length) {
            window.UniUI.toast('Các buổi đã ở đúng trạng thái.', 'info');
            window.UniUI.closeModal();
            return;
        }

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                // Ghi lại hành động cập nhật trạng thái hàng loạt
                if (window.ActionHistoryService) {
                    updatedSessions.forEach(session => {
                        const oldStatus = oldStatuses.get(session.id) || 'unpaid';
                        window.ActionHistoryService.recordAction({
                            entityType: 'session',
                            entityId: session.id,
                            actionType: 'update',
                            beforeValue: { ...session, paymentStatus: oldStatus },
                            afterValue: { ...session },
                            changedFields: { paymentStatus: { before: oldStatus, after: newStatus } },
                            description: `Cập nhật trạng thái thanh toán hàng loạt buổi học ngày ${session.date || ''} của lớp ${cls ? cls.name : classId}: ${paymentStatusLabels[oldStatus] || oldStatus} → ${paymentStatusLabels[newStatus] || newStatus}`
                        });
                    });
                }
                
                // Update UI immediately for all selected sessions
                updatedSessions.forEach(session => {
                    updateSessionStatusUI(session.id, newStatus);
                });
                
                return {
                    supabaseEntities: {
                        sessions: updatedSessions
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    window.UniUI.toast('Đã cập nhật trạng thái buổi học', 'success');
                    renderClassDetail(classId);
                },
                onError: (error) => {
                    console.error('Failed to update bulk session status:', error);
                    // Revert all sessions to old status
                    updatedSessions.forEach(session => {
                        const oldStatus = oldStatuses.get(session.id) || 'unpaid';
                        session.paymentStatus = oldStatus;
                        updateSessionStatusUI(session.id, oldStatus);
                    });
                    window.UniUI.toast('Không thể cập nhật trạng thái buổi học', 'error');
                },
                onRollback: () => {
                    // Revert UI
                    updatedSessions.forEach(session => {
                        const oldStatus = oldStatuses.get(session.id) || 'unpaid';
                        updateSessionStatusUI(session.id, oldStatus);
                    });
                    renderClassDetail(classId);
                }
            }
        );
    });

    window.UniUI.openModal('Cập nhật trạng thái buổi học', form);
}

/**
 * Attach event listeners for sessions table
 */
function attachSessionsTableListeners(classId) {
    // Row selection (Excel-like)
    let startRow = null;
    let selectedRows = new Set();
    
    const selectAllCheckbox = document.getElementById('selectAllSessions');
    const sessionCheckboxes = document.querySelectorAll('.session-checkbox');
    if (!selectAllCheckbox && !sessionCheckboxes.length) {
        return;
    }
    const bulkActionsContainer = document.getElementById('sessionBulkActions');
    const selectedCountLabel = document.getElementById('sessionSelectedCount');
    const clearSelectionBtn = document.getElementById('sessionClearSelectionBtn');

    function updateSessionBulkActions() {
        if (bulkActionsContainer) {
            const count = selectedRows.size;
            bulkActionsContainer.style.display = count > 0 ? 'flex' : 'none';
            if (selectedCountLabel) {
                selectedCountLabel.textContent = count > 0 ? `Đã chọn: ${count} buổi` : '';
            }
        }
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = selectedRows.size > 0 && selectedRows.size === sessionCheckboxes.length;
            selectAllCheckbox.indeterminate = selectedRows.size > 0 && selectedRows.size < sessionCheckboxes.length;
        }
    }
    // Select all checkbox
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            sessionCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const row = cb.closest('tr');
                if (e.target.checked) {
                    selectedRows.add(cb.dataset.sessionId);
                    row?.classList.add('row-selected');
                } else {
                    selectedRows.delete(cb.dataset.sessionId);
                    row?.classList.remove('row-selected');
                }
            });
            updateSessionBulkActions();
        });
        updateSessionBulkActions();
    }
    
    // Individual checkbox
    sessionCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const sessionId = checkbox.dataset.sessionId;
            const row = checkbox.closest('tr');
            
            if (checkbox.checked) {
                selectedRows.add(sessionId);
                row?.classList.add('row-selected');
            } else {
                selectedRows.delete(sessionId);
                row?.classList.remove('row-selected');
            }
            
            updateSessionBulkActions();
        });
        
        // Excel-like drag selection
        const row = checkbox.closest('tr');
        if (row) {
            row.addEventListener('mousedown', (e) => {
                if (e.shiftKey && startRow) {
                    // Shift+Click: select range
                    e.preventDefault();
                    const rows = Array.from(document.querySelectorAll('.session-row'));
                    const startIndex = rows.indexOf(startRow);
                    const endIndex = rows.indexOf(row);
                    const minIndex = Math.min(startIndex, endIndex);
                    const maxIndex = Math.max(startIndex, endIndex);
                    
                    for (let i = minIndex; i <= maxIndex; i++) {
                        const cb = rows[i]?.querySelector('.session-checkbox');
                        if (cb) {
                            cb.checked = true;
                            cb.dispatchEvent(new Event('change'));
                        }
                    }
                } else if (e.ctrlKey || e.metaKey) {
                    // Ctrl+Click: toggle selection
                    e.preventDefault();
                    const cb = row.querySelector('.session-checkbox');
                    if (cb) {
                        cb.checked = !cb.checked;
                        cb.dispatchEvent(new Event('change'));
                    }
                } else {
                    // Regular click: set start row for range selection
                    startRow = row;
                }
            });
        }
    });
    
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            selectedRows.clear();
            sessionCheckboxes.forEach(cb => {
                cb.checked = false;
                cb.closest('tr')?.classList.remove('row-selected');
            });
            updateSessionBulkActions();
        });
    }

    // Make selectedRows available globally for bulk update
    window.selectedRows = selectedRows;
    updateSessionBulkActions();
}

/**
 * Toggle section visibility
 */
function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-toggle-icon`);
    
    if (!content || !icon) return;
    
    const isCollapsed = content.style.maxHeight === '0px' || content.style.maxHeight === '';
    
    if (isCollapsed) {
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.opacity = '1';
        icon.textContent = '▼';
    } else {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        icon.textContent = '▶';
    }
}

// Export class page functions
window.ClassPage = {
    render: renderClasses,
    openModal: openClassModal,
    delete: deleteClass,
    renderDetail: renderClassDetail
};

// Expose functions globally for inline onclick handlers
window.renderClasses = renderClasses;
window.openClassModal = openClassModal;
window.openStudentInClass = openStudentInClass;
window.deleteStudentFromClass = deleteStudentFromClass;
window.renderClassDetail = renderClassDetail;
window.openEditTeacherModal = openEditTeacherModal;
window.openTeacherAllowanceModal = openTeacherAllowanceModal;
window.openEditScheduleModal = openEditScheduleModal;
window.openAddExistingStudentModal = openAddExistingStudentModal;
window.moveStudentToClass = moveStudentToClass;
window.renderSessionsList = renderSessionsList;
window.openSessionModal = openSessionModal;
window.deleteSession = deleteSession;
window.toggleSection = toggleSection;
window.addEventListener('click', (event) => {
    const trigger = event.target.closest('.section-collapse-trigger');
    if (trigger) {
        const target = trigger.dataset.target;
        if (target) {
            toggleSection(target);
        }
    }
});
window.updateSessionStatus = updateSessionStatus;
window.updateSessionAllowance = updateSessionAllowance;