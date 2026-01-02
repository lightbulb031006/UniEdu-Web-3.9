/**
 * staff.js - Nhân sự page with tabs: Gia sư, Giáo án, Kế toán, CSKH&SALE, Truyền thông
 */

// Staff roles constants
const STAFF_ROLES = {
    TEACHER: 'teacher',
    LESSON_PLAN: 'lesson_plan',
    ACCOUNTANT: 'accountant',
    CSKH_SALE: 'cskh_sale',
    COMMUNICATION: 'communication'
};

const STAFF_ROLE_LABELS = {
    [STAFF_ROLES.TEACHER]: 'Gia sư',
    [STAFF_ROLES.LESSON_PLAN]: 'Giáo án',
    [STAFF_ROLES.ACCOUNTANT]: 'Kế toán',
    [STAFF_ROLES.CSKH_SALE]: 'CSKH & SALE',
    [STAFF_ROLES.COMMUNICATION]: 'Truyền thông'
};

const STAFF_LIST_DEFAULT_PAGER = { page: 1, pageSize: 10 };

const staffDataCache = {
    lastLoaded: 0,
    loadingPromise: null
};

const staffListRuntimeState = {
    activeTab: 'all',
    isLoading: false,
    items: [],
    total: 0,
    lastFetchKey: null,
    error: null,
    lastErrorToastAt: 0
};

// Filter state for staff page
let staffFilterState = {
    search: '',
    role: 'all',
    province: 'all',
    status: 'all'
};

/**
 * Filter staff list by search, province, and status
 */
function getFilteredStaff(list) {
    if (!Array.isArray(list)) return [];
    let filtered = [...list];
    
    // Search filter
    if (staffFilterState.search) {
        const searchLower = staffFilterState.search.toLowerCase();
        filtered = filtered.filter(s => 
            (s.fullName || '').toLowerCase().includes(searchLower) ||
            (s.email || '').toLowerCase().includes(searchLower) ||
            (s.province || '').toLowerCase().includes(searchLower)
        );
    }
    
    // Province filter
    if (staffFilterState.province !== 'all') {
        filtered = filtered.filter(s => s.province === staffFilterState.province);
    }
    
    // Status filter
    if (staffFilterState.status !== 'all') {
        filtered = filtered.filter(s => {
            const staffStatus = s.status || 'active';
            return staffStatus === staffFilterState.status;
        });
    }
    
    return filtered;
}

function getStaffPagerState() {
    const storePager = window.AppStore?.store?.getState()?.pager?.staff;
    if (storePager && typeof storePager.page === 'number') {
        return {
            page: Math.max(1, storePager.page || 1),
            pageSize: Math.max(1, storePager.pageSize || STAFF_LIST_DEFAULT_PAGER.pageSize)
        };
    }
    if (!staffListRuntimeState.page) {
        staffListRuntimeState.page = STAFF_LIST_DEFAULT_PAGER.page;
        staffListRuntimeState.pageSize = STAFF_LIST_DEFAULT_PAGER.pageSize;
    }
    return {
        page: staffListRuntimeState.page,
        pageSize: staffListRuntimeState.pageSize
    };
}

function updateStaffPagerState(page, pageSize) {
    const safePage = Math.max(1, page || 1);
    const safePageSize = Math.max(1, pageSize || STAFF_LIST_DEFAULT_PAGER.pageSize);
    if (window.AppStore?.store && window.AppStore.actions?.SET_PAGE) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'staff', page: safePage, pageSize: safePageSize }
        });
    } else {
        staffListRuntimeState.page = safePage;
        staffListRuntimeState.pageSize = safePageSize;
    }
}

function sortByVietnameseName(list, key = 'fullName') {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
        const aName = (a?.[key] || '').toString();
        const bName = (b?.[key] || '').toString();
        return aName.localeCompare(bName, 'vi', { sensitivity: 'base', ignorePunctuation: true });
    });
}

function getRoleKeyForTab(tab) {
    switch (tab) {
        case 'teacher':
            return STAFF_ROLES.TEACHER;
        case 'lesson_plan':
            return STAFF_ROLES.LESSON_PLAN;
        case 'accountant':
            return STAFF_ROLES.ACCOUNTANT;
        case 'cskh_sale':
            return STAFF_ROLES.CSKH_SALE;
        case 'communication':
            return STAFF_ROLES.COMMUNICATION;
        default:
            return null;
    }
}

function filterStaffCollectionByTab(collection, activeTab) {
    if (!Array.isArray(collection)) return [];
    if (activeTab === 'all') return collection;
    if (activeTab === 'teacher') {
        return collection.filter(staff => {
            const roles = staff.roles || [];
            return roles.length === 0 || roles.includes(STAFF_ROLES.TEACHER);
        });
    }
    const roleKey = getRoleKeyForTab(activeTab);
    if (!roleKey) return collection;
    return collection.filter(staff => {
        const roles = staff.roles || [];
        return roles.includes(roleKey);
    });
}

function renderStaffLoadingShell(activeTab) {
    return `
        <div class="flex justify-between items-center mb-4">
            <h2>Nhân sự</h2>
            <div class="skeleton skeleton-btn" style="width: 40px; height: 40px; border-radius: var(--radius);"></div>
        </div>
        <div class="card mb-4">
            <div class="staff-tabs">
                ${Object.entries({
                    all: 'Tất cả',
                    teacher: STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER],
                    lesson_plan: STAFF_ROLE_LABELS[STAFF_ROLES.LESSON_PLAN],
                    accountant: STAFF_ROLE_LABELS[STAFF_ROLES.ACCOUNTANT],
                    cskh_sale: STAFF_ROLE_LABELS[STAFF_ROLES.CSKH_SALE],
                    communication: STAFF_ROLE_LABELS[STAFF_ROLES.COMMUNICATION]
                }).map(([tab, label]) => `
                    <button class="staff-tab ${tab === activeTab ? 'active' : ''}" data-tab="${tab}">
                        ${label}
                    </button>
                `).join('')}
            </div>
        </div>
        <div class="card">
            <div class="loading-container" style="padding: var(--spacing-8);">
                <div class="spinner"></div>
                <p class="text-muted mt-3">Đang tải danh sách nhân sự...</p>
            </div>
        </div>
    `;
}

function buildStaffPaginationControls({ page, pageSize, total }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentCount = Math.min(page * pageSize, total);
    return `
        <div class="pagination-container staff-pagination" role="navigation" aria-label="Phân trang nhân sự">
            <button 
                class="pagination-btn pagination-btn-prev" 
                data-staff-page-action="prev"
                ${page <= 1 ? 'disabled' : ''}
                title="Trang trước"
                aria-label="Trang trước"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            <span class="pagination-page-info">
                <span class="pagination-current">${currentCount}</span>
                <span class="pagination-separator">/</span>
                <span class="pagination-total">${total}</span>
            </span>
            <button 
                class="pagination-btn pagination-btn-next" 
                data-staff-page-action="next"
                ${page >= totalPages ? 'disabled' : ''}
                title="Trang sau"
                aria-label="Trang sau"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        </div>
    `;
}

function attachStaffListEventHandlers(main, activeTab) {
    main.querySelectorAll('.staff-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (tabName) {
                updateStaffPagerState(1, getStaffPagerState().pageSize);
                // Hiển thị dữ liệu local ngay, fetch từ DB ở background
                renderStaff(tabName, { forceFetch: false, skipLoadingState: true });
            }
        });
    });

    const newStaffBtn = document.getElementById('newStaffBtn');
    if (newStaffBtn) {
        newStaffBtn.addEventListener('click', () => openStaffModal());
    }

    const refreshBtn = document.getElementById('refreshStaffBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.disabled = true;
            refreshBtn.classList.add('is-loading');
            renderStaff(activeTab, { forceFetch: true }).finally(() => {
                refreshBtn.disabled = false;
                refreshBtn.classList.remove('is-loading');
            });
        });
    }

    main.querySelectorAll('.staff-row-clickable').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('.crud-actions') || e.target.closest('.btn-edit-icon') || e.target.closest('.btn-delete-icon')) {
                return;
            }
            const staffId = row.getAttribute('data-id') || row.dataset.id;
            if (staffId) {
                e.preventDefault();
                e.stopPropagation();
                window.UniUI.loadPage(`staff-detail:${staffId}`);
            }
        });
    });

    main.querySelectorAll('[data-staff-page-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.staffPageAction;
            const pager = getStaffPagerState();
            const totalPages = Math.max(1, Math.ceil(staffListRuntimeState.total / pager.pageSize));
            if (action === 'prev' && pager.page > 1) {
                updateStaffPagerState(pager.page - 1, pager.pageSize);
                // Hiển thị dữ liệu local ngay, không cần loading state
                renderStaff(activeTab, { forceFetch: false, skipLoadingState: true });
            } else if (action === 'next' && pager.page < totalPages) {
                updateStaffPagerState(pager.page + 1, pager.pageSize);
                // Hiển thị dữ liệu local ngay, không cần loading state
                renderStaff(activeTab, { forceFetch: false, skipLoadingState: true });
            }
        });
    });

}

function getLocalStaffPaginated(activeTab, page, pageSize) {
    const allStaff = window.demo?.teachers || [];
    const filtered = filterStaffCollectionByTab(allStaff, activeTab);
    const sorted = sortByVietnameseName(filtered);
    const start = (page - 1) * pageSize;
    return {
        items: sorted.slice(start, start + pageSize),
        total: filtered.length,
        source: 'local'
    };
}

async function fetchAllStaffFromSupabase() {
    if (!window.SupabaseAdapter?.isEnabled) return null;
    if (!window.SupabaseAdapter.supabase) {
        const initialized = await window.SupabaseAdapter.init?.();
        if (!initialized) {
            return null;
        }
    }
    const supabase = window.SupabaseAdapter.supabase;
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('full_name', { ascending: true, nullsLast: true })
        .order('id', { ascending: true });

    if (error) {
        throw error;
    }

    const normalized = (data || []).map(row => window.SupabaseAdapter.normalizeRow?.('teachers', row) || row);
    return normalized;
}

async function ensureStaffDataLoaded({ force = false } = {}) {
    const hasLocalData = Array.isArray(window.demo?.teachers) && window.demo.teachers.length > 0;
    if (!force && hasLocalData) {
        return true;
    }

    if (!window.SupabaseAdapter?.isEnabled) {
        return hasLocalData;
    }

    if (staffDataCache.loadingPromise && !force) {
        await staffDataCache.loadingPromise;
        return true;
    }

    const loadPromise = (async () => {
        try {
            const list = await fetchAllStaffFromSupabase();
            if (Array.isArray(list)) {
                window.demo = window.demo || {};
                window.demo.teachers = list;
                staffDataCache.lastLoaded = Date.now();
                return true;
            }
            return false;
        } catch (error) {
            console.error('[Staff] Failed to load staff dataset from Supabase:', error);
            const now = Date.now();
            if (window.UniUI?.toast && (now - staffListRuntimeState.lastErrorToastAt > 3000)) {
                window.UniUI.toast('Không thể tải danh sách nhân sự từ máy chủ. Đang dùng dữ liệu tạm thời.', 'error');
                staffListRuntimeState.lastErrorToastAt = now;
            }
            return false;
        } finally {
            staffDataCache.loadingPromise = null;
        }
    })();

    if (!force) {
        staffDataCache.loadingPromise = loadPromise;
    }

    await loadPromise;
    return true;
}

async function loadStaffDataset(activeTab, page, pageSize, { force = false } = {}) {
    if (force) {
        await ensureStaffDataLoaded({ force: true });
    }
    await ensureStaffDataLoaded();

    const fetchKey = `${activeTab}-${page}-${pageSize}`;
    const localResult = getLocalStaffPaginated(activeTab, page, pageSize);

    staffListRuntimeState.items = localResult.items;
    staffListRuntimeState.total = localResult.total;
    staffListRuntimeState.lastFetchKey = fetchKey;
    staffListRuntimeState.source = 'local-cache';
    return localResult;
}

function refreshStaffListAfterMutation({ forceFetch = false } = {}) {
    const activeTab = staffListRuntimeState.activeTab || 'all';
    renderStaff(activeTab, { forceFetch, skipLoadingState: true });
}

function currentUserCanManageStaffBonuses(staffId) {
    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    if (!currentUser) return false;
    const hasAdminAccess = window.UniUI?.hasRole?.('admin') || window.UniUI?.userHasStaffRole?.('accountant');
    if (hasAdminAccess) return true;
    if (!staffId) return false;
    if (currentUser.linkId && currentUser.linkId === staffId && currentUser.role === 'teacher') {
        return true;
    }
    const staff = (window.demo?.teachers || []).find(t => t.id === staffId);
    if (staff?.userId && currentUser.id && staff.userId === currentUser.id) {
        return true;
    }
    return false;
}

const STAFF_USER_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateStaffUuid() {
    if (window.UniData?.generateUuid && typeof window.UniData.generateUuid === 'function') {
        return window.UniData.generateUuid();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    let timestamp = Date.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = (timestamp + Math.random() * 16) % 16 | 0;
        timestamp = Math.floor(timestamp / 16);
        if (char === 'x') {
            return random.toString(16);
        }
        return ((random & 0x3) | 0x8).toString(16);
    });
}

function normalizeUserRecord(user) {
    if (!user || typeof user !== 'object') return null;
    const normalized = { ...user };
    if (normalized.linkId === undefined && normalized.link_id !== undefined) {
        normalized.linkId = normalized.link_id;
    }
    if (normalized.accountHandle === undefined && normalized.account_handle !== undefined) {
        normalized.accountHandle = normalized.account_handle;
    }
    if (normalized.accountPassword === undefined && normalized.account_password !== undefined) {
        normalized.accountPassword = normalized.account_password;
    }
    if (!normalized.accountPassword && normalized.password) {
        normalized.accountPassword = normalized.password;
    }
    if (!normalized.password && normalized.accountPassword) {
        normalized.password = normalized.accountPassword;
    }
    if (normalized.assistantType === undefined && normalized.assistant_type !== undefined) {
        normalized.assistantType = normalized.assistant_type;
    }
    normalized.role = (normalized.role || '').toLowerCase();
    const currentId = typeof normalized.id === 'string' ? normalized.id : '';
    if (!STAFF_USER_UUID_PATTERN.test(currentId)) {
        normalized.id = generateStaffUuid();
    }
    delete normalized.link_id;
    delete normalized.account_handle;
    delete normalized.account_password;
    delete normalized.assistant_type;
    return normalized;
}

function ensureDemoUsersNormalized() {
    if (!Array.isArray(window.demo?.users)) {
        window.demo.users = [];
        return window.demo.users;
    }
    window.demo.users = window.demo.users
        .map(user => normalizeUserRecord(user))
        .filter(Boolean);
    return window.demo.users;
}

function findStaffUserRecord(staffId) {
    if (!staffId) return null;
    const users = ensureDemoUsersNormalized();
    return users.find(user => user.linkId === staffId && user.role === 'teacher') || null;
}

/**
 * Load staff login info from database
 * @param {string} staffId - Staff ID
 * @returns {Promise<Object|null>} Login info object with accountHandle, email, hasPassword, or null if not found
 */
async function loadStaffLoginInfoFromDB(staffId) {
    if (!staffId) {
        console.warn('[loadStaffLoginInfoFromDB] No staffId provided');
        return null;
    }
    
    // Đảm bảo Supabase đã được khởi tạo
    if (!window.SupabaseAdapter?.supabase) {
        console.warn('[loadStaffLoginInfoFromDB] Supabase not initialized, trying to init...');
        try {
            await window.SupabaseAdapter?.init?.();
            if (!window.SupabaseAdapter?.supabase) {
                console.error('[loadStaffLoginInfoFromDB] Failed to initialize Supabase');
                return null;
            }
        } catch (e) {
            console.error('[loadStaffLoginInfoFromDB] Error initializing Supabase:', e);
            return null;
        }
    }
    
    try {
        console.log('[loadStaffLoginInfoFromDB] Querying DB for staffId:', staffId);
        
        // Query users table with link_id matching staffId and role = 'teacher'
        const { data: users, error } = await window.SupabaseAdapter.supabase
            .from('users')
            .select('id, account_handle, email, role, link_id, password')
            .eq('link_id', staffId)
            .eq('role', 'teacher');
        
        if (error) {
            console.error('[loadStaffLoginInfoFromDB] Supabase query error:', error);
            // Retry without role filter
            const { data: retryUsers, error: retryError } = await window.SupabaseAdapter.supabase
                .from('users')
                .select('id, account_handle, email, role, link_id, password')
                .eq('link_id', staffId);
            
            if (retryError) {
                console.error('[loadStaffLoginInfoFromDB] Retry query also failed:', retryError);
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
                    password: user.password || null // Trả về password để prefill (đã hash)
                };
            }
            
            return null;
        }
        
        if (users && users.length > 0) {
            const user = users[0];
            const hasPassword = !!(user.password && user.password.trim().length > 0);
            // Security: Don't log sensitive user data in production
            if (window.APP_MODE === 'dev' || window.location?.hostname === 'localhost') {
                console.log('[loadStaffLoginInfoFromDB] Found user:', { accountHandle: user.account_handle, hasPassword });
            }
            
            return {
                id: user.id,
                accountHandle: user.account_handle || null,
                email: user.email || null,
                role: user.role || null,
                linkId: user.link_id || null,
                hasPassword,
                password: user.password || null // Trả về password để prefill (đã hash)
            };
        }
        
        // Security: Only log in development mode
        if (window.APP_MODE === 'dev' || window.location?.hostname === 'localhost') {
            console.log('[loadStaffLoginInfoFromDB] No user found for staffId:', staffId);
        }
        return null;
    } catch (e) {
        console.error('[loadStaffLoginInfoFromDB] Exception:', e);
        return null;
    }
}

function formatMonthLabel(month) {
    if (!month || typeof month !== 'string') return '';
    const [year, monthPart] = month.split('-');
    if (!year || !monthPart) return month;
    return `${monthPart.padStart(2, '0')}/${year}`;
}

/**
 * Attach event listeners for staff filters and search
 */
function attachStaffFilterListeners(activeTab) {
    // Search input - debounced
    const searchInput = document.getElementById('staffSearchInput');
    if (searchInput) {
        let searchTimeout;
        let isUpdating = false;
        
        const handleInput = (e) => {
            staffFilterState.search = e.target.value;
            
            // Update clear button visibility
            const wrapper = searchInput.closest('.search-input-wrapper');
            if (wrapper) {
                const clearBtn = wrapper.querySelector('.search-clear-btn');
                if (e.target.value) {
                    if (!clearBtn) {
                        const btn = document.createElement('button');
                        btn.className = 'search-clear-btn';
                        btn.onclick = clearStaffSearch;
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
                    if (window.AppStore?.store) {
                        window.AppStore.store.dispatch({
                            type: window.AppStore.actions.SET_PAGE,
                            payload: { key: 'staff', page: 1 }
                        });
                    }
                    renderStaff(activeTab);
                    isUpdating = false;
                }
            }, 300);
        };
        
        searchInput.addEventListener('input', handleInput);
    }
    
    // Province filter
    const provinceFilter = document.getElementById('staffProvinceFilter');
    if (provinceFilter) {
        provinceFilter.addEventListener('change', (e) => {
            staffFilterState.province = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'staff', page: 1 }
                });
            }
            renderStaff(activeTab);
        });
    }
    
    // Status filter
    const statusFilter = document.getElementById('staffStatusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            staffFilterState.status = e.target.value;
            if (window.AppStore?.store) {
                window.AppStore.store.dispatch({
                    type: window.AppStore.actions.SET_PAGE,
                    payload: { key: 'staff', page: 1 }
                });
            }
            renderStaff(activeTab);
        });
    }
}

/**
 * Clear staff search
 */
function clearStaffSearch() {
    staffFilterState.search = '';
    const activeTab = window.staffListRuntimeState?.activeTab || 'all';
    if (window.AppStore?.store) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'staff', page: 1 }
        });
    }
    renderStaff(activeTab);
}

/**
 * Reset all staff filters
 */
function resetStaffFilters() {
    staffFilterState = {
        search: '',
        role: 'all',
        province: 'all',
        status: 'all'
    };
    const activeTab = window.staffListRuntimeState?.activeTab || 'all';
    if (window.AppStore?.store) {
        window.AppStore.store.dispatch({
            type: window.AppStore.actions.SET_PAGE,
            payload: { key: 'staff', page: 1 }
        });
    }
    renderStaff(activeTab);
}

// Export to window for onclick handlers
window.clearStaffSearch = clearStaffSearch;
window.resetStaffFilters = resetStaffFilters;

async function renderStaff(activeTab = 'all', options = {}) {
    const main = document.querySelector('#main-content');
    if (!main) return;

    // Store activeTab in runtime state for filter functions
    window.staffListRuntimeState = window.staffListRuntimeState || {};
    window.staffListRuntimeState.activeTab = activeTab;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const currentUserStaffRoles = window.UniUI?.getUserStaffRoles ? window.UniUI.getUserStaffRoles(currentUser) : [];
    const teacherHasOnlyTeacherRole = currentUser?.role === 'teacher' &&
        (!currentUserStaffRoles.length || currentUserStaffRoles.every(role => role === STAFF_ROLES.TEACHER));
    if (teacherHasOnlyTeacherRole) {
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
            renderStaffDetail(teacherRecord.id);
            return;
        }
        main.innerHTML = `
            <div class="card">
                <h3>Không tìm thấy hồ sơ giáo viên</h3>
                <p class="text-muted">Tài khoản giáo viên này chưa được liên kết với hồ sơ trong hệ thống. Vui lòng liên hệ quản trị viên.</p>
            </div>
        `;
        return;
    }

    if (activeTab === 'staff') activeTab = 'all';

    const pagerState = getStaffPagerState();
    const requestedPage = Math.max(1, options.page || pagerState.page || 1);
    const requestedPageSize = Math.max(1, options.pageSize || pagerState.pageSize || STAFF_LIST_DEFAULT_PAGER.pageSize);
    updateStaffPagerState(requestedPage, requestedPageSize);

    const hasAccountantPrivileges = window.UniUI.hasRole('admin') || window.UniUI.userHasStaffRole?.('accountant');
    const canCreate = hasAccountantPrivileges;
    const canManage = hasAccountantPrivileges;

    // Kiểm tra xem có dữ liệu local không
    const hasLocalData = Array.isArray(window.demo?.teachers) && window.demo.teachers.length > 0;
    
    // Chỉ hiển thị loading shell nếu:
    // 1. Không có dữ liệu local VÀ không skip loading state
    // 2. Hoặc force fetch và không skip loading state
    const shouldShowLoading = !options.skipLoadingState && (!hasLocalData || !!options.forceFetch);
    
    // Hiển thị dữ liệu local ngay nếu có (không cần đợi DB)
    let dataset;
    if (hasLocalData && !options.forceFetch) {
        // Có dữ liệu local và không force fetch -> dùng local ngay, không cần loading
        dataset = getLocalStaffPaginated(activeTab, requestedPage, requestedPageSize);
        
        // Fetch từ DB ở background để cập nhật sau (nếu cần)
        loadStaffDataset(activeTab, requestedPage, requestedPageSize, { force: false })
            .then(updatedDataset => {
                // Chỉ cập nhật nếu dữ liệu thay đổi (so sánh theo ID)
                const currentIds = new Set((dataset.items || []).map(s => s.id).sort());
                const updatedIds = new Set((updatedDataset.items || []).map(s => s.id).sort());
                if (currentIds.size !== updatedIds.size || 
                    Array.from(currentIds).some(id => !updatedIds.has(id))) {
                    renderStaff(activeTab, { forceFetch: false, skipLoadingState: true });
                }
            })
            .catch(err => {
                console.warn('[Staff] Background fetch failed, using local data:', err);
            });
    } else {
        // Không có dữ liệu local hoặc force fetch -> hiển thị loading và fetch từ DB
        if (shouldShowLoading) {
            main.innerHTML = renderStaffLoadingShell(activeTab);
            attachStaffListEventHandlers(main, activeTab);
        }
        
        try {
            dataset = await loadStaffDataset(activeTab, requestedPage, requestedPageSize, { force: !!options.forceFetch });
        } catch (error) {
            console.error('[Staff] Unable to load dataset:', error);
            dataset = getLocalStaffPaginated(activeTab, requestedPage, requestedPageSize);
            if (window.UniUI?.toast) {
                window.UniUI.toast('Không thể tải danh sách nhân sự. Đang hiển thị dữ liệu gần nhất.', 'error');
            }
        }
    }

    // Get ALL staff (not paginated) - we need to filter first, then paginate
    // Always get all staff from demo.teachers, not from paginated dataset
    const allStaff = window.demo?.teachers || [];
    let allStaffFromDataset = filterStaffCollectionByTab(allStaff, activeTab);
    
    // Apply additional filters (search, province, status) BEFORE calculating stats
    const filteredStaff = getFilteredStaff(allStaffFromDataset);
    const totalFiltered = filteredStaff.length;
    
    // Calculate stats for filtered staff
    const staffWithStats = filteredStaff.map(staff => {
        const roles = staff.roles || [];
        const isTeacher = roles.includes(STAFF_ROLES.TEACHER) || roles.length === 0;

        let totalReceived = 0;
        let classCount = 0;

        if (isTeacher) {
            const classes = window.UniData.getTeacherClasses ? window.UniData.getTeacherClasses(staff.id) : [];
            const sessions = (window.demo.sessions || []).filter(s => s.teacherId === staff.id);
            classCount = classes.length;

            sessions.forEach(session => {
                const cls = window.demo.classes.find(c => c.id === session.classId);
                if (cls) {
                    const allowances = cls.customTeacherAllowances || {};
                    const baseAllowance = allowances[staff.id] ?? (cls.tuitionPerSession || 0);
                    const coefficient = session.coefficient != null ? Number(session.coefficient) : 1;
                    // Nếu hệ số = 0 thì số tiền = 0 luôn
                    if (coefficient === 0) {
                        totalReceived += 0;
                    } else {
                        totalReceived += baseAllowance * coefficient;
                    }
                }
            });
        }

        const birthYear = staff.birthDate ? new Date(staff.birthDate).getFullYear() : null;

        let unpaidAmount = 0;
        if (isTeacher) {
            const sessions = (window.demo.sessions || []).filter(s => s.teacherId === staff.id);
            unpaidAmount = sessions
                .filter(s => (s.paymentStatus || 'unpaid') === 'unpaid')
                .reduce((sum, session) => {
                    const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                    return sum + allowanceAmount;
                }, 0);
        }

        [STAFF_ROLES.LESSON_PLAN, STAFF_ROLES.ACCOUNTANT, STAFF_ROLES.CSKH_SALE, STAFF_ROLES.COMMUNICATION].forEach(role => {
            if (roles.includes(role)) {
                const tasks = getStaffTasksByRole(staff.id, role);
                const unpaidTasks = tasks.filter(t => (t.paymentStatus || 'unpaid') === 'unpaid');
                unpaidAmount += unpaidTasks.reduce((sum, t) => sum + (t.amount || t.paymentAmount || 0), 0);
            }
        });

        return {
            ...staff,
            totalReceived,
            birthYear,
            classCount,
            unpaidAmount,
            roles: roles.length > 0 ? roles : [STAFF_ROLES.TEACHER]
        };
    });

    staffListRuntimeState.activeTab = activeTab;
    
    // Sort filtered staff with stats
    const sortedStaffWithStats = sortByVietnameseName(staffWithStats);
    
    // Now paginate the filtered and sorted staff
    const start = (requestedPage - 1) * requestedPageSize;
    const paginatedFilteredStaff = sortedStaffWithStats.slice(start, start + requestedPageSize);
    const totalPages = Math.max(1, Math.ceil(totalFiltered / requestedPageSize));
    staffListRuntimeState.total = totalFiltered;

    main.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div class="flex items-center gap-2">
                <h2>Nhân sự</h2>
                <button class="btn btn-icon btn-refresh" id="refreshStaffBtn" title="Tải lại danh sách nhân sự" aria-label="Tải lại danh sách nhân sự">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.37 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
            </div>
            ${canCreate ? `
                <button class="btn btn-primary btn-add-icon" id="newStaffBtn" title="Thêm nhân sự mới">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            ` : ''}
        </div>
        <div class="card mb-4">
            <div class="staff-tabs" style="display: flex; gap: var(--spacing-2); border-bottom: 1px solid var(--border);">
                <button class="staff-tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all">Tất cả</button>
                <button class="staff-tab ${activeTab === 'teacher' ? 'active' : ''}" data-tab="teacher">${STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER]}</button>
                <button class="staff-tab ${activeTab === 'lesson_plan' ? 'active' : ''}" data-tab="lesson_plan">${STAFF_ROLE_LABELS[STAFF_ROLES.LESSON_PLAN]}</button>
                <button class="staff-tab ${activeTab === 'accountant' ? 'active' : ''}" data-tab="accountant">${STAFF_ROLE_LABELS[STAFF_ROLES.ACCOUNTANT]}</button>
                <button class="staff-tab ${activeTab === 'cskh_sale' ? 'active' : ''}" data-tab="cskh_sale">${STAFF_ROLE_LABELS[STAFF_ROLES.CSKH_SALE]}</button>
                <button class="staff-tab ${activeTab === 'communication' ? 'active' : ''}" data-tab="communication">${STAFF_ROLE_LABELS[STAFF_ROLES.COMMUNICATION]}</button>
            </div>
        </div>

        <!-- Filters and Search -->
        <div class="students-filters-card card mb-4">
            <div class="students-search-bar">
                <div class="search-input-wrapper">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input 
                        type="text" 
                        id="staffSearchInput" 
                        class="search-input" 
                        placeholder="Tìm kiếm theo tên, email, tỉnh..."
                        value="${staffFilterState.search}"
                        autocomplete="off"
                    />
                    ${staffFilterState.search ? `
                        <button class="search-clear-btn" onclick="clearStaffSearch()" title="Xóa tìm kiếm">
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
                    <label class="filter-label">Tỉnh/Thành</label>
                    <select id="staffProvinceFilter" class="filter-select">
                        <option value="all">Tất cả tỉnh</option>
                        ${(() => {
                            const provinces = [...new Set((window.demo?.teachers || []).map(t => t.province).filter(Boolean))].sort();
                            return provinces.map(p => `
                                <option value="${p}" ${staffFilterState.province === p ? 'selected' : ''}>${p}</option>
                            `).join('');
                        })()}
                    </select>
                </div>
                
                <div class="filter-group">
                    <label class="filter-label">Trạng thái</label>
                    <select id="staffStatusFilter" class="filter-select">
                        <option value="all">Tất cả</option>
                        <option value="active" ${staffFilterState.status === 'active' ? 'selected' : ''}>Hoạt động</option>
                        <option value="inactive" ${staffFilterState.status === 'inactive' ? 'selected' : ''}>Ngừng hoạt động</option>
                    </select>
                </div>
                
                <div class="filter-actions">
                    <button class="btn btn-secondary" onclick="resetStaffFilters()" title="Đặt lại bộ lọc">
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
                <table class="table-striped" id="staffTable">
                    <thead>
                        <tr>
                            <th>Tên</th>
                            ${activeTab === 'all' ? '<th>Role</th>' : '<th>Chức vụ</th>'}
                            <th>Năm sinh</th>
                            <th>Tỉnh</th>
                            ${activeTab === 'all' ? '<th>Chưa Thanh Toán</th>' : activeTab === 'teacher' ? '<th>Tổng nhận</th>' : ''}
                            ${canManage ? '<th style="width: 80px;"></th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${(() => {
                            const colCount = activeTab === 'all'
                                ? (canManage ? 6 : 5)
                                : activeTab === 'teacher'
                                ? (canManage ? 6 : 5)
                                : (canManage ? 5 : 4);

                            if (!totalFiltered || !paginatedFilteredStaff.length) {
                                return `
                                    <tr>
                                        <td colspan="${colCount}" class="text-center text-muted" style="padding: var(--spacing-8);">
                                            ${totalFiltered === 0 ? 'Chưa có nhân sự nào phù hợp với bộ lọc' : 'Không có dữ liệu để hiển thị'}
                                        </td>
                                    </tr>
                                `;
                            }

                            return paginatedFilteredStaff.map(s => {
                                const roles = s.roles || [];
                                const roleBadges = roles.length > 0
                                    ? roles.map(role => `<span class="role-badge" style="display: inline-block; padding: 2px 8px; background: var(--primary); color: white; border-radius: 12px; font-size: 0.75rem; margin-right: 4px;">${STAFF_ROLE_LABELS[role] || role}</span>`).join('')
                                    : `<span class="role-badge" style="display: inline-block; padding: 2px 8px; background: var(--primary); color: white; border-radius: 12px; font-size: 0.75rem;">${STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER]}</span>`;

                                const roleDisplay = activeTab === 'all'
                                    ? (roles.length > 0 ? roles.map(role => STAFF_ROLE_LABELS[role] || role).join(', ') : STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER])
                                    : roleBadges;

                                const valueColumn = activeTab === 'all'
                                    ? `<td>${window.UniData.formatCurrency(s.unpaidAmount || 0)}</td>`
                                    : activeTab === 'teacher'
                                    ? `<td>${window.UniData.formatCurrency(s.totalReceived)}</td>`
                                    : '';

                                return `
                                    <tr data-id="${s.id}" class="staff-row-clickable">
                                        <td>
                                            <a href="#" class="teacher-name-link" onclick="event.preventDefault(); event.stopPropagation(); window.UniUI.loadPage('staff-detail:${s.id}');">${s.fullName}</a>
                                            ${s.classCount > 0 && activeTab === 'teacher' ? `<div class="text-muted text-sm">${s.classCount} lớp</div>` : ''}
                                        </td>
                                        <td>${roleDisplay}</td>
                                        <td>${s.birthYear || '-'}</td>
                                        <td>${s.province || '-'}</td>
                                        ${valueColumn}
                                        ${canManage ? `
                                            <td>
                                                <div class="crud-actions">
                                                    <button class="btn-edit-icon" onclick="event.stopPropagation(); openStaffModal('${s.id}'); return false;" title="Sửa">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button class="btn-delete-icon" onclick="event.stopPropagation(); if(confirm('Bạn có chắc muốn xóa nhân sự này?')) { window.StaffPage.delete('${s.id}'); } return false;" title="Xóa">
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
                        })()}
                        ${paginatedFilteredStaff.length ? `
                            <tr>
                                <td colspan="${activeTab === 'all'
                                    ? (canManage ? 6 : 5)
                                    : activeTab === 'teacher'
                                    ? (canManage ? 6 : 5)
                                    : (canManage ? 5 : 4)}">
                                    ${buildStaffPaginationControls({
                                        page: requestedPage,
                                        pageSize: requestedPageSize,
                                        total: totalFiltered
                                    })}
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    attachStaffListEventHandlers(main, activeTab);
    
    // Attach filter listeners
    attachStaffFilterListeners(activeTab);
}

// Alias for backward compatibility
function renderTeachers() {
    renderStaff('teacher');
}

// Open staff modal (create/edit)
async function openStaffModal(staffId = null) {
    const isEdit = Boolean(staffId);
    const staff = isEdit ? window.demo.teachers.find(t => t.id === staffId) : {};
    
    // Load login info từ DB nếu đang edit
    let loginInfo = null;
    if (isEdit) {
        loginInfo = await loadStaffLoginInfoFromDB(staffId);
        console.log('[openStaffModal] Loaded login info:', loginInfo);
    }
    
    const existingUserRecord = isEdit ? findStaffUserRecord(staffId) : null;
    const canManageStaff = window.UniUI.hasRole('admin') || window.UniUI.userHasStaffRole?.('accountant');
    const canManageBonuses = currentUserCanManageStaffBonuses(staffId);
    const requiredAttr = canManageStaff ? '' : 'required';
    const currentRoles = staff?.roles || [];
    
    // Load specialization từ DB nếu đang edit
    let specializationFromDB = null;
    if (isEdit && window.SupabaseAdapter?.isEnabled && window.SupabaseAdapter?.supabase) {
        try {
            const { data, error } = await window.SupabaseAdapter.supabase
                .from('teachers')
                .select('specialization')
                .eq('id', staffId)
                .single();
            
            if (!error && data) {
                specializationFromDB = data.specialization || null;
            }
        } catch (err) {
            console.warn('[openStaffModal] Failed to load specialization from DB:', err);
        }
    }
    
    // Sử dụng specialization từ DB nếu có, nếu không thì dùng từ local
    const displaySpecialization = specializationFromDB !== null ? specializationFromDB : (staff?.specialization || '');

    const toWords = (amount) => {
        if (!window.UniData || typeof window.UniData.numberToVietnameseText !== 'function') return '';
        return window.UniData.numberToVietnameseText(amount);
    };

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
                <div class="form-group-enhanced">
                    <label for="sFullName" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Họ tên${canManageStaff ? '' : '*'}
                    </label>
                    <input id="sFullName" name="fullName" class="form-control-enhanced" value="${staff?.fullName || ''}" ${requiredAttr} placeholder="Nhập họ và tên đầy đủ">
                </div>
                <div class="form-group-enhanced">
                    <label for="sBirthDate" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Ngày tháng năm sinh${canManageStaff ? '' : '*'}
                    </label>
                    <input id="sBirthDate" name="birthDate" type="date" class="form-control-enhanced date-input" value="${staff?.birthDate || ''}" ${requiredAttr}>
                </div>
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="sUniversity" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            Đại học
                        </label>
                        <input id="sUniversity" name="university" class="form-control-enhanced" value="${staff?.university || ''}" placeholder="Tên trường đại học (tùy chọn)">
                    </div>
                    <div class="form-group-enhanced">
                        <label for="sHighSchool" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            Trường THPT${canManageStaff ? '' : '*'}
                        </label>
                        <input id="sHighSchool" name="highSchool" class="form-control-enhanced" value="${staff?.highSchool || ''}" ${requiredAttr} placeholder="Tên trường THPT">
                    </div>
                </div>
                <div class="form-group-enhanced">
                    <label for="sProvince" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        Tỉnh thành${canManageStaff ? '' : '*'}
                    </label>
                    <input id="sProvince" name="province" class="form-control-enhanced" value="${staff?.province || ''}" ${requiredAttr} placeholder="Tỉnh/Thành phố">
                </div>
                <div class="form-group-enhanced">
                    <label for="sQrPaymentLink" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="5" height="5"></rect>
                            <rect x="16" y="3" width="5" height="5"></rect>
                            <rect x="3" y="16" width="5" height="5"></rect>
                            <rect x="16" y="16" width="5" height="5"></rect>
                            <path d="M11 3h2v18h-2z"></path>
                            <path d="M3 11h18v2H3z"></path>
                        </svg>
                        Link QR thanh toán
                    </label>
                    <input 
                        id="sQrPaymentLink" 
                        name="qrPaymentLink" 
                        type="url" 
                        class="form-control-enhanced" 
                        value="${staff?.qr_payment_link || staff?.qrPaymentLink || ''}" 
                        placeholder="https://drive.google.com/... hoặc link ảnh QR"
                    >
                    <small class="form-hint">Thêm link ảnh QR thanh toán (để trống nếu muốn xóa).</small>
                </div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <h3>Liên hệ</h3>
            </div>
            <div class="form-section-content">
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="sGmail" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            Email${canManageStaff ? '' : '*'}
                        </label>
                        <input id="sGmail" name="gmail" type="email" class="form-control-enhanced" value="${staff?.gmail || ''}" ${requiredAttr} placeholder="email@example.com">
                    </div>
                    <div class="form-group-enhanced">
                        <label for="sPhone" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            Số điện thoại${canManageStaff ? '' : '*'}
                        </label>
                        <input id="sPhone" name="phone" class="form-control-enhanced" value="${staff?.phone || ''}" ${requiredAttr} placeholder="0912345678">
                    </div>
                </div>
                <div class="form-group-enhanced">
                    <label for="sSpecialization" class="form-label-with-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Mô tả chuyên môn
                    </label>
                    <textarea id="sSpecialization" name="specialization" class="form-control-enhanced" rows="4" placeholder="Mô tả chi tiết về chuyên môn, kinh nghiệm...">${displaySpecialization}</textarea>
                </div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <h3>Thông tin đăng nhập</h3>
            </div>
            <div class="form-section-content">
                <div class="form-row-enhanced">
                    <div class="form-group-enhanced">
                        <label for="sAccountHandle" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            Handle đăng nhập
                        </label>
                        <input id="sAccountHandle" name="accountHandle" class="form-control-enhanced" value="${loginInfo?.accountHandle || staff?.accountHandle || ''}" placeholder="Tên đăng nhập (ví dụ: nguyenvana)">
                        <small class="form-hint">Dùng để đăng nhập thay cho email</small>
                    </div>
                    <div class="form-group-enhanced">
                        <label for="sAccountPassword" class="form-label-with-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            Mật khẩu${isEdit ? ' (để trống nếu không đổi)' : ''}
                        </label>
                        <div class="password-input-wrapper">
                            <input 
                                id="sAccountPassword" 
                                name="accountPassword" 
                                type="password" 
                                class="form-control-enhanced" 
                                value="${isEdit && loginInfo?.hasPassword && loginInfo?.password ? loginInfo.password : ''}"
                                placeholder="${isEdit ? (loginInfo?.hasPassword ? 'Mật khẩu hiện tại (ẩn), nhập mới để thay đổi' : 'Nhập mật khẩu mới (nếu muốn đổi)') : 'Nhập mật khẩu'}" 
                                ${isEdit ? '' : 'required'}
                                data-has-password="${isEdit && loginInfo?.hasPassword ? 'true' : 'false'}"
                                data-original-password="${isEdit && loginInfo?.password ? loginInfo.password : ''}"
                                data-is-prefilled="${isEdit && loginInfo?.hasPassword && loginInfo?.password ? 'true' : 'false'}"
                            >
                            <button type="button" class="password-toggle-btn-enhanced" onclick="togglePasswordVisibility('sAccountPassword', this)" aria-label="Hiện/ẩn mật khẩu">
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
                        ${isEdit ? `<small class="form-hint">${loginInfo?.hasPassword ? 'Mật khẩu đã được khai báo. Để trống nếu không muốn thay đổi, hoặc nhập mật khẩu mới.' : 'Chưa có mật khẩu. Nhập mật khẩu mới nếu muốn thiết lập.'}</small>` : ''}
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
                <h3>Chức vụ</h3>
            </div>
            <div class="form-section-content">
                <div class="staff-roles-checkboxes-enhanced">
                    <label class="role-checkbox-label">
                        <input type="checkbox" name="roles" value="${STAFF_ROLES.TEACHER}" ${currentRoles.includes(STAFF_ROLES.TEACHER) || currentRoles.length === 0 ? 'checked' : ''}>
                        <span class="role-checkbox-custom"></span>
                        <span class="role-checkbox-text">${STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER]}</span>
                    </label>
                    <label class="role-checkbox-label">
                        <input type="checkbox" name="roles" value="${STAFF_ROLES.LESSON_PLAN}" ${currentRoles.includes(STAFF_ROLES.LESSON_PLAN) ? 'checked' : ''}>
                        <span class="role-checkbox-custom"></span>
                        <span class="role-checkbox-text">${STAFF_ROLE_LABELS[STAFF_ROLES.LESSON_PLAN]}</span>
                    </label>
                    <label class="role-checkbox-label">
                        <input type="checkbox" name="roles" value="${STAFF_ROLES.ACCOUNTANT}" ${currentRoles.includes(STAFF_ROLES.ACCOUNTANT) ? 'checked' : ''}>
                        <span class="role-checkbox-custom"></span>
                        <span class="role-checkbox-text">${STAFF_ROLE_LABELS[STAFF_ROLES.ACCOUNTANT]}</span>
                    </label>
                    <label class="role-checkbox-label">
                        <input type="checkbox" name="roles" value="${STAFF_ROLES.CSKH_SALE}" ${currentRoles.includes(STAFF_ROLES.CSKH_SALE) ? 'checked' : ''}>
                        <span class="role-checkbox-custom"></span>
                        <span class="role-checkbox-text">${STAFF_ROLE_LABELS[STAFF_ROLES.CSKH_SALE]}</span>
                    </label>
                    <label class="role-checkbox-label">
                        <input type="checkbox" name="roles" value="${STAFF_ROLES.COMMUNICATION}" ${currentRoles.includes(STAFF_ROLES.COMMUNICATION) ? 'checked' : ''}>
                        <span class="role-checkbox-custom"></span>
                        <span class="role-checkbox-text">${STAFF_ROLE_LABELS[STAFF_ROLES.COMMUNICATION]}</span>
                    </label>
                </div>
                <small class="form-hint">Một nhân sự có thể đảm nhận nhiều chức vụ</small>
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
            <button type="submit" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                ${isEdit ? 'Cập nhật' : 'Tạo mới'}
            </button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const canSkipRequired = window.UniUI.hasRole('admin') || window.UniUI.userHasStaffRole?.('accountant');
        
        const fullName = fd.get('fullName')?.trim() || '';
        const birthDate = fd.get('birthDate')?.trim() || '';
        const university = fd.get('university')?.trim() || '';
        const highSchool = fd.get('highSchool')?.trim() || '';
        const province = fd.get('province')?.trim() || '';
        const gmail = fd.get('gmail')?.trim() || '';
        const phone = fd.get('phone')?.trim() || '';
        const specialization = fd.get('specialization')?.trim() || '';
        const qrPaymentLink = fd.get('qrPaymentLink')?.trim() || '';
        const accountHandle = fd.get('accountHandle')?.trim() || '';
        const accountPasswordInput = fd.get('accountPassword')?.trim() || '';
        
        // Xử lý password: nếu đang edit và để trống hoặc giống với password cũ, giữ nguyên password cũ
        let effectivePassword = '';
        if (isEdit) {
            const passwordInput = form.querySelector('#sAccountPassword');
            const hasPassword = passwordInput?.dataset.hasPassword === 'true';
            const originalPassword = passwordInput?.dataset.originalPassword || '';
            const isPrefilled = passwordInput?.dataset.isPrefilled === 'true';
            
            // Nếu user không nhập gì hoặc nhập giống với password cũ (hash), giữ nguyên
            if (!accountPasswordInput || accountPasswordInput.trim() === '') {
                // Để trống -> giữ nguyên password cũ
                if (hasPassword && originalPassword) {
                    effectivePassword = originalPassword;
                }
            } else if (isPrefilled && accountPasswordInput === originalPassword) {
                // User không thay đổi (vẫn là hash cũ), giữ nguyên password cũ
                effectivePassword = originalPassword;
            } else {
                // User nhập password mới (khác với hash cũ), dùng password mới
                effectivePassword = accountPasswordInput;
            }
        } else {
            // Tạo mới: bắt buộc phải có password
            effectivePassword = accountPasswordInput || '';
        }
        
        // Get selected roles
        const selectedRoles = fd.getAll('roles');
        const roles = selectedRoles.length > 0 ? selectedRoles : [STAFF_ROLES.TEACHER]; // Default to teacher

        // Validation
        if (!canSkipRequired) {
            if (!fullName || !birthDate || !highSchool || !province || !gmail || !phone) {
                alert('Vui lòng điền đầy đủ tất cả các trường bắt buộc');
                return;
            }
        }

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

        if (qrPaymentLink && !/^https?:\/\/.+/i.test(qrPaymentLink)) {
            alert('Link QR thanh toán không hợp lệ. Vui lòng nhập link bắt đầu bằng http hoặc https.');
            return;
        }

        // Check email uniqueness
        if (gmail) {
            if (!isEdit) {
                const existing = window.demo.teachers.find(t => t.gmail === gmail);
                if (existing) {
                    alert('Email này đã được sử dụng bởi nhân sự khác');
                    return;
                }
            } else {
                const existing = window.demo.teachers.find(t => t.gmail === gmail && t.id !== staffId);
                if (existing) {
                    alert('Email này đã được sử dụng bởi nhân sự khác');
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
            qrPaymentLink: qrPaymentLink || null,
            qr_payment_link: qrPaymentLink || null,
            roles,
            status: staff?.status || 'active'
        };
        
        // Add account handle and password if provided
        if (accountHandle) {
            data.accountHandle = accountHandle;
        } else if (isEdit && loginInfo?.accountHandle) {
            // Giữ nguyên handle từ DB nếu không thay đổi
            data.accountHandle = loginInfo.accountHandle;
        } else if (isEdit && staff?.accountHandle) {
            data.accountHandle = staff.accountHandle;
        }
        
        // Chỉ thêm password nếu có giá trị (không thêm nếu để trống khi edit)
        if (effectivePassword) {
            data.accountPassword = effectivePassword;
        } else if (!isEdit) {
            // Tạo mới mà không có password -> báo lỗi
            alert('Vui lòng nhập mật khẩu');
            return;
        }

        try {
            // Use optimistic update pattern
            await window.UniData.withOptimisticUpdate(
                () => {
                    let updatedStaff;
                    if (isEdit) {
                        // Lấy dữ liệu cũ trước khi update
                        const oldStaff = window.demo.teachers.find(t => t.id === staffId);
                        updatedStaff = window.UniLogic.updateEntity('teacher', staffId, data);
                        
                        // Ghi lại hành động chỉnh sửa
                        if (window.ActionHistoryService && oldStaff) {
                            const changedFields = window.ActionHistoryService.getChangedFields(oldStaff, updatedStaff);
                            window.ActionHistoryService.recordAction({
                                entityType: 'teacher',
                                entityId: staffId,
                                actionType: 'update',
                                beforeValue: oldStaff,
                                afterValue: updatedStaff,
                                changedFields: changedFields,
                                description: `Cập nhật nhân sự: ${updatedStaff.fullName || staffId}`
                            });
                        }
                    } else {
                        updatedStaff = window.UniLogic.createEntity('teacher', data);
                        
                        // Ghi lại hành động tạo mới
                        if (window.ActionHistoryService) {
                            window.ActionHistoryService.recordAction({
                                entityType: 'teacher',
                                entityId: updatedStaff.id,
                                actionType: 'create',
                                beforeValue: null,
                                afterValue: updatedStaff,
                                changedFields: null,
                                description: `Tạo nhân sự mới: ${updatedStaff.fullName || updatedStaff.id}`
                            });
                        }
                    }
                    
                    // Prepare supabase entities - users will be auto-extracted by toSupabaseFormat
                    // if accountHandle and accountPassword are present
                    const supabaseEntities = { teachers: [updatedStaff] };

                    const loginHandle = (updatedStaff.accountHandle || '').trim();
                    const passwordForUser = effectivePassword;
                    const shouldSyncUser = Boolean(loginHandle && passwordForUser);

                    if (shouldSyncUser) {
                        const normalizedUsers = ensureDemoUsersNormalized();
                        window.demo.users = normalizedUsers.filter(
                            user => !(user.linkId === updatedStaff.id && user.role === 'teacher')
                        );

                        const newUserRecord = {
                            accountHandle: loginHandle,
                            email: updatedStaff.gmail || updatedStaff.email || loginHandle,
                            password: passwordForUser,
                            name: updatedStaff.fullName || existingUserRecord?.name || '',
                            role: existingUserRecord?.role || 'teacher',
                            linkId: updatedStaff.id,
                            province: updatedStaff.province || null,
                            status: updatedStaff.status || 'active'
                        };

                        if (existingUserRecord?.id) {
                            newUserRecord.id = existingUserRecord.id;
                        }

                        window.demo.users.push(normalizeUserRecord(newUserRecord));
                    }
                    
                    // Note: User record will still be extracted to Supabase via extractUsersFromEntities.
                    
                    return { 
                        supabaseEntities,
                        supabaseDeletes: null
                    };
                },
                {
                    onSuccess: async () => {
                        window.UniUI.closeModal();
                        refreshStaffListAfterMutation();
                        
                        // Reload staff detail page nếu đang xem trang detail
                        if (isEdit) {
                            const currentPage = window.location.hash.replace('#', '');
                            if (currentPage === `staff-detail:${staffId}`) {
                                // Reload trang detail để hiển thị dữ liệu mới từ DB
                                setTimeout(async () => {
                                    await renderStaffDetail(staffId);
                                }, 300);
                            }
                        }
                        
                        window.UniUI.toast(isEdit ? 'Đã cập nhật thông tin nhân sự' : 'Đã tạo nhân sự mới', 'success');
                    },
                    onError: (error) => {
                        console.error('Failed to save staff:', error);
                        window.UniUI.toast('Không thể lưu dữ liệu: ' + (error.message || 'Lỗi không xác định'), 'error');
                        // Keep modal open on error so user can fix and retry
                    },
                    onRollback: () => {
                        window.UniUI.closeModal();
                        refreshStaffListAfterMutation();
                    }
                }
            );
        } catch(err) {
            alert('Lỗi: ' + err.message);
        }
    });

    window.UniUI.openModal(isEdit ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự mới', form);

    // Date picker handling
    const dateInput = form.querySelector('#sBirthDate');
    if (dateInput) {
        dateInput.style.cursor = 'pointer';
        const safeShowPicker = (input) => {
            try {
                if (typeof input.showPicker === 'function') {
                    input.showPicker();
                }
            } catch (err) {
                console.warn('Date picker requires direct user interaction:', err);
            }
        };
        dateInput.addEventListener('click', function() {
            this.focus();
            safeShowPicker(this);
        });
        dateInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.focus();
                safeShowPicker(this);
            }
        });
    }
}

// Delete staff
async function deleteStaff(staffId) {
    const staff = window.demo.teachers.find(t => t.id === staffId);
    if (!staff) {
        window.UniUI?.toast?.('Không tìm thấy nhân sự', 'error');
        return;
    }

    // Không cho phép xóa nếu nhân sự còn đang được phân công lớp
    const hasClasses = (window.demo.classes || []).some(cls => {
        if (Array.isArray(cls.teacherIds) && cls.teacherIds.includes(staffId)) {
            return true;
        }
        return cls.teacherId === staffId;
    });
    if (hasClasses) {
        alert(`Không thể xóa nhân sự "${staff.fullName || staffId}". Nhân sự này đang được phân công vào lớp học.`);
        return;
    }

    if (!confirm(`Bạn có chắc muốn xóa nhân sự "${staff.fullName || staffId}"?`)) return;
    
    try {
        await window.UniData.withOptimisticUpdate(
            () => {
                // Ghi lại hành động xóa trước khi xóa
                if (window.ActionHistoryService) {
                    window.ActionHistoryService.recordAction({
                        entityType: 'teacher',
                        entityId: staffId,
                        actionType: 'delete',
                        beforeValue: staff,
                        afterValue: null,
                        changedFields: null,
                        description: `Xóa nhân sự: ${staff.fullName || staffId}`
                    });
                }
                window.UniLogic.deleteEntity('teacher', staffId);
                return {
                    supabaseDeletes: { teachers: [staffId] }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.toast('Đã xóa nhân sự', 'success');
                    // Render lại từ dữ liệu local để UI phản hồi ngay lập tức
                    refreshStaffListAfterMutation({ forceFetch: false });
                },
                onError: (error) => {
                    console.error('Failed to delete staff:', error);
                    window.UniUI.toast('Không thể xóa nhân sự', 'error');
                    refreshStaffListAfterMutation({ forceFetch: false });
                },
                onRollback: () => {
                    refreshStaffListAfterMutation({ forceFetch: false });
                }
            }
        );
    } catch (error) {
        alert('Lỗi khi xóa nhân sự: ' + error.message);
    }
}

// Get staff tasks by role
function getStaffTasksByRole(staffId, role) {
    // Staff tasks are now managed through lessonTasks and other task systems
    // Note: assistantTasks has been removed, use lessonTasks or other task systems instead
    const allTasks = window.demo?.lessonTasks || [];
    return allTasks.filter(task => {
        const taskStaffId = task.staffId || task.teacherId;
        const taskRole = task.role;
        return taskStaffId === staffId && taskRole === role;
    });
}

// Calculate task statistics
function calculateTaskStats(tasks) {
    const paid = tasks.filter(t => (t.paymentStatus || 'unpaid') === 'paid');
    const unpaid = tasks.filter(t => (t.paymentStatus || 'unpaid') === 'unpaid');
    
    const totalPaid = paid.reduce((sum, t) => sum + (t.amount || t.paymentAmount || 0), 0);
    const totalUnpaid = unpaid.reduce((sum, t) => sum + (t.amount || t.paymentAmount || 0), 0);
    const totalReceived = totalPaid + totalUnpaid;
    
    return { totalPaid, totalUnpaid, totalReceived, paidCount: paid.length, unpaidCount: unpaid.length };
}

/**
 * Calculate CSKH & SALE statistics based on students' payment status
 * Tổng số tiền chưa thanh toán = tổng lợi nhuận của học sinh có trạng thái "Chờ thanh toán"
 * Tổng Tháng = tổng lợi nhuận của học sinh có trạng thái "Đã thanh toán"
 */
function calculateCskhStats(staffId, month = null, year = null) {
    // Use current month/year if not provided
    const currentDate = new Date();
    const selectedMonth = month || (currentDate.getMonth() + 1);
    const selectedYear = year || currentDate.getFullYear();
    
    // Get all students assigned to this CSKH staff
    const allStudents = window.demo.students || [];
    
    // Check if student was assigned in this month (similar logic to staff-cskh-detail.js)
    function wasStudentAssignedInMonth(student, staffId, month, year) {
        if (student.cskhStaffId !== staffId) return false;
        
        const studentClasses = (window.demo.studentClasses || []).filter(sc => sc.studentId === student.id);
        if (studentClasses.length === 0) return false;
        
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);
        
        const studentClassIds = studentClasses.map(sc => sc.classId);
        const monthSessions = (window.demo.sessions || []).filter(session => {
            if (!studentClassIds.includes(session.classId)) return false;
            if (!session.date) return false;
            const sessionDate = new Date(session.date);
            return sessionDate >= monthStart && sessionDate <= monthEnd;
        });
        
        const monthAttendance = (window.demo.attendance || []).filter(att => {
            if (!monthSessions.find(s => s.id === att.sessionId)) return false;
            return att.studentId === student.id;
        });
        
        const assignedDate = student.cskhAssignedDate ? new Date(student.cskhAssignedDate) : null;
        if (assignedDate && assignedDate <= monthEnd) {
            const unassignedDate = student.cskhUnassignedDate ? new Date(student.cskhUnassignedDate) : null;
            if (!unassignedDate || unassignedDate > monthEnd) {
                return true;
            }
        }
        
        return monthSessions.length > 0 || monthAttendance.length > 0;
    }
    
    const assignedStudents = allStudents.filter(s => wasStudentAssignedInMonth(s, staffId, selectedMonth, selectedYear));
    
    // Default profit percentage
    const defaultProfitPercent = parseFloat(localStorage.getItem(`cskh_default_profit_${staffId}`) || '10');
    
    // Calculate profit for each student
    const studentStats = assignedStudents.map(student => {
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
        
        // Get profit percentage (from in-memory or default)
        // Note: We need to access the same storage as staff-cskh-detail.js
        // For now, use default, but in production this should be stored in database
        const profitPercent = defaultProfitPercent; // Could be enhanced to check localStorage or database
        const profit = totalPaid * (profitPercent / 100);
        
        // Get payment status from localStorage (same key format as staff-cskh-detail.js)
        const paymentStatusKey = `cskh_payment_${staffId}_${student.id}_${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
        const paymentStatus = localStorage.getItem(paymentStatusKey) || 'unpaid';
        
        return {
            student,
            profit,
            paymentStatus
        };
    });
    
    // Tổng số tiền chưa thanh toán = tổng lợi nhuận của học sinh có trạng thái "Chờ thanh toán"
    const totalUnpaid = studentStats
        .filter(s => s.paymentStatus === 'unpaid')
        .reduce((sum, s) => sum + s.profit, 0);
    
    // Tổng Tháng = tổng lợi nhuận của học sinh có trạng thái "Đã thanh toán"
    const totalPaid = studentStats
        .filter(s => s.paymentStatus === 'paid')
        .reduce((sum, s) => sum + s.profit, 0);
    
    // Total received = paid + unpaid (for compatibility)
    const totalReceived = totalPaid + totalUnpaid;
    
    return { 
        totalPaid, 
        totalUnpaid, 
        totalReceived, 
        paidCount: studentStats.filter(s => s.paymentStatus === 'paid').length,
        unpaidCount: studentStats.filter(s => s.paymentStatus === 'unpaid').length
    };

}

// Get role-specific work items (for display in work list)
function getRoleWorkItems(role, staffId, month = null) {
    const workItems = [];
    
    switch(role) {
        case STAFF_ROLES.LESSON_PLAN:
            // Calculate lesson plan stats from lessonOutputs
            // IMPORTANT: Filter by staffId to ensure each staff member only sees their own outputs
            const DEFAULT_LESSON_OUTPUT_ALLOWANCE = 50000; // 50,000 VND mỗi bài
            const allLessonOutputs = window.demo.lessonOutputs || [];
            
            // Filter outputs assigned to THIS SPECIFIC staff member only
            // This ensures data is separated by staff member, not grouped together
            const staffOutputs = allLessonOutputs.filter(output => {
                // Only include outputs where assistantId matches this staffId
                return output.assistantId === staffId;
            });
            
            if (staffOutputs.length > 0 || true) { // Always show for now
                // Get current month if not provided
                const currentMonth = month || new Date().toISOString().slice(0, 7);
                
                // Chưa thanh toán: Tổng tiền các bài có status = 'unpaid' hoặc 'pending'
                // Filter by THIS staff member's outputs only
                const unpaidOutputs = staffOutputs.filter(output => {
                    const status = output.status || 'pending';
                    return status === 'unpaid' || status === 'pending';
                });
                const totalUnpaid = unpaidOutputs.reduce((sum, output) => {
                    // Use cost field from lessonOutput, fallback to amount/paymentAmount, then default
                    // Each output is counted separately for this staff member
                    const amount = Number(output.cost || output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
                    return sum + amount;
                }, 0);
                
                // Đã thanh toán: Tổng tiền các bài có status = 'paid'
                // Filter by THIS staff member's outputs only
                const paidOutputs = staffOutputs.filter(output => {
                    const status = output.status || 'pending';
                    return status === 'paid';
                });
                const totalPaid = paidOutputs.reduce((sum, output) => {
                    // Use cost field from lessonOutput, fallback to amount/paymentAmount, then default
                    // Each output is counted separately for this staff member
                    const amount = Number(output.cost || output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
                    return sum + amount;
                }, 0);
                
                // Tổng tháng: Tổng tiền các bài trong tháng (dựa trên createdAt hoặc updatedAt hoặc date)
                // Filter by THIS staff member's outputs in the specified month only
                const monthOutputs = staffOutputs.filter(output => {
                    const outputDate = output.createdAt || output.updatedAt || output.date;
                    if (!outputDate) return false;
                    const outputMonth = new Date(outputDate).toISOString().slice(0, 7);
                    return outputMonth === currentMonth;
                });
                const totalMonth = monthOutputs.reduce((sum, output) => {
                    // Use cost field from lessonOutput, fallback to amount/paymentAmount, then default
                    // Each output is counted separately for this staff member
                    const amount = Number(output.cost || output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
                    return sum + amount;
                }, 0);
                
                workItems.push({
                    name: 'Giáo án',
                    type: 'lesson_plan',
                    unpaid: totalUnpaid,
                    paid: totalPaid,
                    total: totalMonth,
                    pageUrl: 'lesson-plans'
                });
            }
            break;
        case STAFF_ROLES.ACCOUNTANT:
            workItems.push({
                name: 'Kế toán',
                type: 'accountant',
                unpaid: 0,
                paid: 0,
                total: 0,
                pageUrl: 'costs'
            });
            break;
        case STAFF_ROLES.CSKH_SALE:
            // Calculate CSKH stats based on students' payment status
            const cskhStats = calculateCskhStats(staffId);
            workItems.push({
                name: 'CSKH & SALE',
                type: 'cskh_sale',
                unpaid: cskhStats.totalUnpaid,
                paid: cskhStats.totalPaid,
                total: cskhStats.totalReceived,
                pageUrl: `staff-cskh-detail:${staffId}`
            });
            break;
        case STAFF_ROLES.COMMUNICATION:
            workItems.push({
                name: 'Truyền thông',
                type: 'communication',
                unpaid: 0,
                paid: 0,
                total: 0,
                clickAction: null // No specific page yet
            });
            break;
    }
    
    // Calculate stats from tasks (skip for CSKH_SALE and LESSON_PLAN as they're already calculated)
    if (role !== STAFF_ROLES.CSKH_SALE && role !== STAFF_ROLES.LESSON_PLAN) {
        const tasks = getStaffTasksByRole(staffId, role);
        const stats = calculateTaskStats(tasks);
        
        workItems.forEach(item => {
            item.unpaid = stats.totalUnpaid;
            item.paid = stats.totalPaid;
            item.total = stats.totalReceived;
        });
    }
    
    return workItems;
}

// Get bonuses for a staff member in a specific month
function getStaffBonuses(staffId, month) {
    if (!window.demo.bonuses) {
        window.demo.bonuses = [];
    }
    
    return window.demo.bonuses.filter(b => {
        if (b.staffId !== staffId) return false;
        const bonusMonth = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 7) : (b.month || '');
        return bonusMonth === month;
    });
}

// Render bonuses section
function renderBonusesSection(staffId, month, canManage = false) {
    // Check if bonuses data is still loading
    // Similar to teacher list - check if bonuses array exists and has data
    const hasBonuses = Array.isArray(window.demo?.bonuses);
    const bonusesCount = hasBonuses ? window.demo.bonuses.length : 0;
    // Only show loading if we're actively loading from Supabase AND don't have cache data
    // Show cache data immediately even if incomplete
    const hasCacheData = hasBonuses && bonusesCount > 0;
    const isActivelyLoading = window.__pendingDataChange && !hasCacheData;
    // IMPORTANT: Only show loading if bonuses array doesn't exist, not if it's empty
    // Empty array means Supabase data arrived but is empty (or cache was preserved)
    const isBonusesLoading = !hasBonuses && isActivelyLoading;
    
    // Reduced logging for performance
    
    const bonuses = isBonusesLoading ? [] : getStaffBonuses(staffId, month);
    
    // Render decision made
    
    return `
        <div class="staff-detail-section">
            <div class="staff-detail-section-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="staff-detail-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                    Thưởng tháng
                </h3>
                ${canManage ? `
                    <button class="btn btn-sm btn-primary" id="addBonusBtn" data-staff-id="${staffId}" data-month="${month}" style="display: flex; align-items: center; gap: var(--spacing-1);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Thêm thưởng
                    </button>
                ` : ''}
            </div>
            <div class="staff-detail-section-content" style="max-height: 600px; overflow-y: auto;">
                ${isBonusesLoading ? `
                    <div class="class-detail-skeleton">
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 40%; margin-bottom: 16px;"></div>
                        <div class="skeleton-item skeleton-table">
                            <div class="skeleton-table-header">
                                <div class="skeleton-line" style="height: 16px; width: 100%;"></div>
                            </div>
                            ${[1, 2, 3].map(() => `
                                <div class="skeleton-table-row">
                                    <div class="skeleton-line" style="height: 16px; width: 35%;"></div>
                                    <div class="skeleton-line" style="height: 16px; width: 30%;"></div>
                                    <div class="skeleton-line" style="height: 16px; width: 30%;"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : bonuses.length > 0 ? `
                    <div class="table-container" style="border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border);">
                        <table class="table-striped">
                            <thead>
                                <tr style="background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);">
                                    <th style="min-width: 180px;">Công việc</th>
                                    <th style="min-width: 140px;">Trạng thái</th>
                                    <th style="min-width: 140px;">Số tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bonuses.map(bonus => {
                                    const status = bonus.status || 'unpaid';
                                    const statusText = status === 'paid' ? 'Đã thanh toán' : status === 'deposit' ? 'Cọc' : 'Chờ thanh toán';
                                    const statusClass = status === 'paid' ? 'badge-success' : status === 'deposit' ? 'badge-warning' : 'badge-danger';
                                    
                                    return `
                                    <tr data-bonus-id="${bonus.id}" class="bonus-row" style="transition: all 0.2s ease; ${canManage ? 'cursor: pointer;' : ''}" ${canManage ? 'title="Click để chỉnh sửa"' : ''}>
                                        <td>
                                            <div style="font-weight: 500; color: var(--text);">${bonus.workType || 'Khác'}</div>
                                        </td>
                                        <td>
                                            <span class="badge ${statusClass}" style="font-size: var(--font-size-xs); padding: 4px 10px; font-weight: 500;" title="${statusText}">
                                                ${statusText}
                                            </span>
                                        </td>
                                        <td>
                                            <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-2);">
                                                <div style="font-weight: 600; color: var(--text);" title="${window.UniData.formatCurrency(bonus.amount)}">
                                                    ${window.UniData.formatCurrency(bonus.amount)}
                                                </div>
                                                ${canManage ? `
                                                    <button class="btn-icon-delete" data-bonus-id="${bonus.id}" title="Xóa" style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 4px; border-radius: var(--radius); transition: all 0.2s ease; flex-shrink: 0;" onclick="event.stopPropagation();">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                ` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="staff-detail-empty-state">
                        <div class="staff-detail-empty-state-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                            </svg>
                        </div>
                        <p>Chưa có thưởng nào trong tháng này.</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// Render staff detail page
// Helper function to load data from cache for optimistic rendering
async function loadStaffDetailDataFromCache() {
    if (window.demo && Object.keys(window.demo).length > 0) {
        return true; // Already has data
    }
    
    try {
        // Try DatabaseAdapter first (IndexedDB/Supabase cache)
        if (window.DatabaseAdapter && typeof window.DatabaseAdapter.load === 'function') {
            const cached = await window.DatabaseAdapter.load({ preferLocal: true, skipLocal: false });
            if (cached && typeof cached === 'object') {
                // Apply cached data
                if (!window.demo) window.demo = {};
                Object.keys(cached).forEach(key => {
                    if (Array.isArray(cached[key])) {
                        window.demo[key] = cached[key];
                    } else if (cached[key] !== null && cached[key] !== undefined) {
                        window.demo[key] = cached[key];
                    }
                });
                return true;
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('unicorns.data');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
                if (!window.demo) window.demo = {};
                Object.keys(parsed).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        window.demo[key] = parsed[key];
                    } else if (parsed[key] !== null && parsed[key] !== undefined) {
                        window.demo[key] = parsed[key];
                    }
                });
                return true;
            }
        }
    } catch (error) {
        console.warn('[StaffDetail] Failed to load from cache:', error);
    }
    
    return false;
}

// Data snapshot for comparison to prevent unnecessary re-renders
const staffDetailDataSnapshots = new Map();

function snapshotStaffDetailData(staffId) {
    const requiredKeys = [
        'teachers', 'sessions', 'classes', 'studentClasses',
        'lessonOutputs', 'walletTransactions', 'payroll', 'bonuses'
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

function hasStaffDetailDataChanged(staffId) {
    const current = snapshotStaffDetailData(staffId);
    const previous = staffDetailDataSnapshots.get(staffId);
    if (!previous) {
        staffDetailDataSnapshots.set(staffId, current);
        return true; // First render
    }
    if (current !== previous) {
        staffDetailDataSnapshots.set(staffId, current);
        return true; // Data changed
    }
    return false; // No change
}

// Initialize event listeners (called automatically on first render)
function initStaffDetailListeners(staffId) {
    const listenerKey = `staff-${staffId}`;
    if (window[`__staffDetailListenersInitialized_${listenerKey}`]) {
        return; // Already initialized for this staff
    }
    
    const handler = (event) => handleStaffDetailDataUpdate(event, staffId);
    
    window.addEventListener('UniData:updated', handler);
    window.addEventListener('UniData:dataset-applied', handler);
    
    // Store handler for cleanup
    window[`__staffDetailDataHandler_${listenerKey}`] = handler;
    window[`__staffDetailListenersInitialized_${listenerKey}`] = true;
}

// Cleanup function to remove event listeners
function cleanupStaffDetailListeners(staffId) {
    const listenerKey = `staff-${staffId}`;
    const handler = window[`__staffDetailDataHandler_${listenerKey}`];
    if (handler) {
        window.removeEventListener('UniData:updated', handler);
        window.removeEventListener('UniData:dataset-applied', handler);
        window[`__staffDetailDataHandler_${listenerKey}`] = null;
    }
    window[`__staffDetailListenersInitialized_${listenerKey}`] = false;
}

// Handle data updates - only refresh if data actually changed
function handleStaffDetailDataUpdate(event, staffId) {
    const source = event?.detail?.source || '';
    
    // Only refresh when we get full dataset from Supabase
    if (source === 'supabase-full' || source === 'supabase-initial') {
        // Check if data actually changed
        if (hasStaffDetailDataChanged(staffId)) {
            // Debounce to avoid multiple rapid renders
            const timeoutKey = `__staffDetailRefreshTimeout_${staffId}`;
            if (window[timeoutKey]) {
                clearTimeout(window[timeoutKey]);
            }
            window[timeoutKey] = setTimeout(() => {
                const currentPage = window.UniUI?.getCurrentPageName?.() || '';
                if (currentPage === `staff-detail:${staffId}`) {
                    // Get current month from DOM or default
                    const monthSelect = document.querySelector('#staffMonthSelect');
                    const selectedMonth = monthSelect ? monthSelect.value : null;
                    renderStaffDetail(staffId, selectedMonth);
                }
                window[timeoutKey] = null;
            }, 100);
        }
    }
}

async function renderStaffDetail(staffId, selectedMonth = null) {
    // Initialize listeners and try optimistic loading
    const pageKey = `staff-detail-${staffId}`;
    if (!window[`__staffDetailListenersInitialized_${staffId}`]) {
        initStaffDetailListeners(staffId);
    }
    
    // Optimistic loading: try to load from cache immediately
    // Check if window.demo is empty OR if critical data is missing (classTeachers, teacherIds, bonuses)
    const hasWindowDemo = window.demo && Object.keys(window.demo).length > 0;
    const hasClassTeachers = Array.isArray(window.demo?.classTeachers) && window.demo.classTeachers.length > 0;
    const allClassesHaveTeacherIds = Array.isArray(window.demo?.classes) && 
        window.demo.classes.length > 0 &&
        window.demo.classes.every(cls => cls.teacherIds && Array.isArray(cls.teacherIds));
    const hasBonuses = Array.isArray(window.demo?.bonuses);
    // Load bonuses from cache if missing (similar to teacher list fix)
    // Don't wait for Supabase - load from cache immediately when F5
    const needsBonusesFromCache = !hasBonuses;
    const needsCacheLoad = !hasWindowDemo || (!hasClassTeachers && !allClassesHaveTeacherIds) || needsBonusesFromCache;
    
    if (needsCacheLoad) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            // Hide spinner immediately when cache loads
            if (window.UniData && typeof window.UniData.hideSpinnerIfLoaded === 'function') {
                window.UniData.hideSpinnerIfLoaded();
            }
            setTimeout(() => renderStaffDetail(staffId, selectedMonth), 10);
            return;
        } else {
            const mainContent = document.querySelector('#main-content');
            if (mainContent) {
                mainContent.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderStaffDetail(staffId, selectedMonth), 120);
            return;
        }
    } else if (hasClassTeachers && !allClassesHaveTeacherIds) {
        // We have classTeachers but some classes don't have teacherIds - convert immediately
        const classTeachers = window.demo.classTeachers;
        let hasChanges = false;
        
        window.demo.classes.forEach(cls => {
            if (!cls.teacherIds || cls.teacherIds.length === 0) {
                const teacherIds = classTeachers
                    .filter(ct => ct.class_id === cls.id || ct.classId === cls.id)
                    .map(ct => ct.teacher_id || ct.teacherId)
                    .filter(Boolean);
                
                // Build customTeacherAllowances
                const customTeacherAllowances = {};
                classTeachers
                    .filter(ct => (ct.class_id === cls.id || ct.classId === cls.id) && (ct.custom_allowance || ct.customAllowance))
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
                if (cls.customTeacherAllowances && typeof cls.customTeacherAllowances === 'object') {
                    Object.keys(cls.customTeacherAllowances).forEach(teacherId => {
                        if (cls.customTeacherAllowances[teacherId] !== null && 
                            cls.customTeacherAllowances[teacherId] !== undefined) {
                            if (!customTeacherAllowances.hasOwnProperty(teacherId)) {
                                customTeacherAllowances[teacherId] = cls.customTeacherAllowances[teacherId];
                            }
                        }
                    });
                }
                
                // Update in-place
                cls.teacherIds = teacherIds.length > 0 ? teacherIds : (cls.teacherId ? [cls.teacherId] : []);
                cls.customTeacherAllowances = customTeacherAllowances;
                hasChanges = true;
            }
        });
        
        // Continue to render with converted data
    }
    
    const main = document.querySelector('#main-content');
    if (!main) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    if (!currentUser) {
        main.innerHTML = `
            <div class="card">
                <h3>Yêu cầu đăng nhập</h3>
                <p class="text-muted">Vui lòng đăng nhập để xem thông tin nhân sự.</p>
                <button class="btn btn-primary mt-2" onclick="window.UniUI.loadPage('home')">Đến trang đăng nhập</button>
            </div>
        `;
        return;
    }

    const allStaff = window.demo?.teachers || [];
    const staff = allStaff.find(t => t.id === staffId);
    
    if (!staff) {
        main.innerHTML = '<div class="card"><p>Nhân sự không tồn tại.</p><button class="btn mt-2" onclick="window.UniUI.loadPage(\'staff\')">← Quay lại danh sách</button></div>';
        return;
    }

    // Load specialization từ DB
    let specializationFromDB = null;
    try {
        if (window.SupabaseAdapter?.isEnabled && window.SupabaseAdapter?.supabase) {
            const { data, error } = await window.SupabaseAdapter.supabase
                .from('teachers')
                .select('specialization')
                .eq('id', staffId)
                .single();
            
            if (!error && data) {
                specializationFromDB = data.specialization || null;
                // Specialization loaded from DB
            } else if (error) {
                console.warn('[renderStaffDetail] Error loading specialization from DB:', error);
            }
        }
    } catch (err) {
        console.warn('[renderStaffDetail] Failed to load specialization from DB:', err);
    }
    
    // Sử dụng specialization từ DB nếu có, nếu không thì dùng từ local
    const displaySpecialization = specializationFromDB !== null ? specializationFromDB : (staff.specialization || null);

    const roles = staff.roles || [];
    // Only consider as teacher if explicitly has TEACHER role (not default)
    const isTeacher = roles.includes(STAFF_ROLES.TEACHER);
    const canManageStaff = window.UniUI.hasRole('admin') || window.UniUI.userHasStaffRole?.('accountant');
    const canManageBonuses = currentUserCanManageStaffBonuses(staffId);
    const showNavigation = currentUser.role !== 'teacher';
    const qrPaymentLink = staff.qr_payment_link || staff.qrPaymentLink || staff.bankQRLink || null;
    const hasQrPaymentLink = Boolean(qrPaymentLink);
    const safeQrLinkAttr = hasQrPaymentLink ? (qrPaymentLink || '').replace(/"/g, '&quot;') : '';

    // Always use renderStaffDetail to show all roles information
    // No redirect to renderTeacherDetail - show unified staff detail page with all roles
    const nonTeacherRoles = roles.filter(r => r !== STAFF_ROLES.TEACHER);

    // For staff with multiple roles or non-teacher roles, render custom detail page
    const currentMonth = new Date().toISOString().slice(0, 7);
    const month = selectedMonth || currentMonth;
    
    // Get teacher classes if has teacher role
    let teacherClasses = [];
    let teacherClassStats = [];
    if (isTeacher) {
        // Get all classes that this teacher has ever been associated with
        // This includes:
        // 1. Classes where teacher is currently in teacherIds (active) - hiển thị "Dạy"
        // 2. Classes where teacher has sessions but is not currently assigned (inactive) - hiển thị "Dừng"
        // 3. Classes where teacher was previously assigned but has no sessions yet - vẫn hiển thị "Dừng"
        
        const allClassesList = window.demo?.classes || [];
        const sessions = (window.demo.sessions || []).filter(s => s.teacherId === staffId);
        const classIdsFromSessions = new Set(sessions.map(s => s.classId).filter(Boolean));
        
        // Get classes where teacher is currently assigned (active) - "Dạy"
        const activeClasses = allClassesList.filter(cls => {
            const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
            return teacherIds.includes(staffId);
        });
        
        // Get ALL classes that have sessions with this teacher (regardless of current assignment)
        // This ensures classes remain visible even after teacher is removed from teacherIds
        const allClassesWithSessions = allClassesList.filter(cls => {
            return classIdsFromSessions.has(cls.id);
        });
        
        // Get classes where teacher has sessions but is not currently assigned (inactive) - "Dừng"
        const inactiveClassesFromSessions = allClassesWithSessions.filter(cls => {
            const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
            return !teacherIds.includes(staffId);
        });
        
        // IMPORTANT: Also get classes that were previously assigned to this teacher
        // Even if they have no sessions, we should still show them as "Dừng" if they were once assigned
        // We track this by checking customTeacherAllowances - if it has an entry for this teacher,
        // it means the teacher was previously assigned to this class
        const inactiveClassesFromAllowances = allClassesList.filter(cls => {
            const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
            const isCurrentlyAssigned = teacherIds.includes(staffId);
            const hasSessions = classIdsFromSessions.has(cls.id);
            
            // Check if class has customTeacherAllowances entry for this teacher
            const hasAllowanceEntry = cls.customTeacherAllowances && 
                                     typeof cls.customTeacherAllowances === 'object' &&
                                     cls.customTeacherAllowances.hasOwnProperty(staffId) &&
                                     cls.customTeacherAllowances[staffId] !== null &&
                                     cls.customTeacherAllowances[staffId] !== undefined;
            
            // Include if: not currently assigned AND has allowance entry
            // Note: We include classes with sessions too if they have allowance entry
            // This ensures classes are shown even if sessions exist but teacher was removed
            return !isCurrentlyAssigned && hasAllowanceEntry;
        });
        
        // Combine all classes: active + inactive (from sessions) + inactive (from allowances)
        // Use Set to avoid duplicates
        // Priority: active classes first, then inactive from sessions, then inactive from allowances
        const allClassIdsSet = new Set();
        activeClasses.forEach(c => allClassIdsSet.add(c.id));
        inactiveClassesFromSessions.forEach(c => allClassIdsSet.add(c.id));
        inactiveClassesFromAllowances.forEach(c => allClassIdsSet.add(c.id));
        
        const allClasses = allClassesList.filter(c => allClassIdsSet.has(c.id));
        
        // DEBUG: Log để kiểm tra
        // Classes and sessions data processed
        
        // Debug: Check specific class's customTeacherAllowances
        allClassesList.forEach(cls => {
            if (cls.customTeacherAllowances && typeof cls.customTeacherAllowances === 'object') {
                if (cls.customTeacherAllowances.hasOwnProperty(staffId)) {
                    // Class has allowance entry
                }
            }
        });
        
        // Mark status: active if teacher is in teacherIds, inactive otherwise
        const classesWithStatus = allClasses.map(cls => {
            const teacherIds = cls.teacherIds || (cls.teacherId ? [cls.teacherId] : []);
            const isActive = teacherIds.includes(staffId);
            return { ...cls, isActive };
        });
        
        teacherClasses = classesWithStatus.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return 0;
        });
        
        teacherClassStats = teacherClasses.map(cls => {
            const allowances = cls.customTeacherAllowances || {};
            const baseAllowance = allowances[staffId] ?? (cls.tuitionPerSession || 0);
            const classSessions = sessions.filter(s => s.classId === cls.id);
            const monthSessions = classSessions.filter(session => (session.date || '').slice(0, 7) === month);
            
            const totalMonth = monthSessions.reduce((sum, session) => {
                const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                return sum + allowanceAmount;
            }, 0);
            
            const totalPaid = monthSessions
                .filter(s => (s.paymentStatus || 'unpaid') === 'paid')
                .reduce((sum, session) => {
                    const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                    return sum + allowanceAmount;
                }, 0);
            
            const totalUnpaid = classSessions
                .filter(s => (s.paymentStatus || 'unpaid') === 'unpaid')
                .reduce((sum, session) => {
                    const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                    return sum + allowanceAmount;
                }, 0);
            
            return {
                class: cls,
                totalMonth,
                totalPaid,
                totalUnpaid,
                monthSessionsCount: monthSessions.length,
                isActive: cls.isActive
            };
        });
    }

    // Get tasks for each role
    const roleTasks = {};
    const roleStats = {};
    
    [STAFF_ROLES.LESSON_PLAN, STAFF_ROLES.ACCOUNTANT, STAFF_ROLES.CSKH_SALE, STAFF_ROLES.COMMUNICATION].forEach(role => {
        if (roles.includes(role)) {
            const tasks = getStaffTasksByRole(staffId, role);
            roleTasks[role] = tasks;
            roleStats[role] = calculateTaskStats(tasks);
        }
    });

    const breadcrumb = showNavigation ? (window.UniComponents?.breadcrumb([
        { label: 'Dashboard', page: 'dashboard' },
        { label: 'Nhân sự', page: 'staff' },
        { label: staff.fullName, page: `staff-detail:${staffId}` }
    ]) || '') : '';

    const roleBadges = roles.map(role => 
        `<span class="role-badge" style="display: inline-block; padding: 2px 8px; background: var(--primary); color: white; border-radius: 12px; font-size: 0.75rem; margin-right: 4px;">${STAFF_ROLE_LABELS[role] || role}</span>`
    ).join('');

    // Calculate income statistics (for teacher role + other roles)
    let totalMonthAllClasses = 0;
    let totalPaidByStatus = 0;
    let totalUnpaidByStatus = 0;
    let totalPaidAllTime = 0;
    let totalDepositAllTime = 0; // Total deposit from all time
    
    if (isTeacher) {
        if (teacherClassStats.length > 0) {
            totalMonthAllClasses = teacherClassStats.reduce((sum, stat) => sum + stat.totalMonth, 0);
            totalPaidByStatus = teacherClassStats.reduce((sum, stat) => sum + stat.totalPaid, 0);
            totalUnpaidByStatus = teacherClassStats.reduce((sum, stat) => sum + stat.totalUnpaid, 0);
        }
        
        // Total paid all time from sessions
        const allSessions = (window.demo.sessions || []).filter(s => s.teacherId === staffId);
        totalPaidAllTime = allSessions
            .filter(s => (s.paymentStatus || 'unpaid') === 'paid')
            .reduce((sum, session) => {
                const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                return sum + allowanceAmount;
            }, 0);
        
        // Total deposit all time from sessions
        totalDepositAllTime = allSessions
            .filter(s => (s.paymentStatus || 'unpaid') === 'deposit')
            .reduce((sum, session) => {
                const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
                return sum + allowanceAmount;
            }, 0);
    }
    
    // Add income from other roles (non-teacher)
    nonTeacherRoles.forEach(role => {
        const workItems = getRoleWorkItems(role, staffId, month);
        workItems.forEach(item => {
            totalMonthAllClasses += item.total;
            totalPaidByStatus += item.paid;
            totalUnpaidByStatus += item.unpaid;
            totalPaidAllTime += item.paid; // Add to total paid all time
        });
        
        // Add deposit from tasks for this role (skip for LESSON_PLAN as it's calculated from outputs)
        if (role !== STAFF_ROLES.LESSON_PLAN) {
            const tasks = getStaffTasksByRole(staffId, role);
            const depositTasks = tasks.filter(t => (t.paymentStatus || 'unpaid') === 'deposit');
            const depositAmount = depositTasks.reduce((sum, t) => sum + (t.amount || t.paymentAmount || 0), 0);
            totalDepositAllTime += depositAmount;
        } else {
            // For LESSON_PLAN, calculate deposit from lessonOutputs
            // IMPORTANT: Filter by staffId to ensure each staff member only sees their own outputs
            const DEFAULT_LESSON_OUTPUT_ALLOWANCE = 50000;
            const allLessonOutputs = window.demo.lessonOutputs || [];
            // Filter outputs assigned to THIS SPECIFIC staff member only
            const staffOutputs = allLessonOutputs.filter(output => {
                // Only include outputs where assistantId matches this staffId
                return output.assistantId === staffId;
            });
            // Filter deposit outputs for THIS staff member only
            const depositOutputs = staffOutputs.filter(output => {
                const status = output.status || 'pending';
                return status === 'deposit';
            });
            const depositAmount = depositOutputs.reduce((sum, output) => {
                // Use cost field from lessonOutput, fallback to amount/paymentAmount, then default
                // Each output is counted separately for this staff member
                const amount = Number(output.cost || output.amount || output.paymentAmount || DEFAULT_LESSON_OUTPUT_ALLOWANCE) || DEFAULT_LESSON_OUTPUT_ALLOWANCE;
                return sum + amount;
            }, 0);
            totalDepositAllTime += depositAmount;
        }
    });

    // Add bonuses to income statistics
    const bonuses = getStaffBonuses(staffId, month);
    
    bonuses.forEach(bonus => {
        totalMonthAllClasses += bonus.amount;
        if (bonus.status === 'paid') {
            totalPaidByStatus += bonus.amount;
            totalPaidAllTime += bonus.amount;
        } else if (bonus.status === 'unpaid') {
            totalUnpaidByStatus += bonus.amount;
        } else if (bonus.status === 'deposit') {
            totalDepositAllTime += bonus.amount;
        }
    });

    main.className = 'staff-detail-page';
    main.innerHTML = `
        ${breadcrumb}
        <div class="staff-detail-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-6); padding: var(--spacing-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: var(--spacing-3); margin-bottom: var(--spacing-3);">
                    <button 
                        class="staff-account-icon-btn" 
                        id="staffAccountBtn"
                        data-staff-id="${staffId}"
                        title="Xem thông tin cá nhân"
                        style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: 2px solid rgba(59, 130, 246, 0.3); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </button>
                    <div style="flex: 1; min-width: 0;">
                        <h2 style="margin: 0; font-size: 1.75rem; font-weight: 700; color: var(--text); line-height: 1.2;">${staff.fullName}</h2>
                        <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-top: var(--spacing-1); flex-wrap: wrap;">
                            ${roleBadges || '<span style="font-size: 0.875rem; color: var(--muted);">Chưa phân chức vụ</span>'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: var(--spacing-4); flex-wrap: wrap; margin-top: var(--spacing-2);">
                    ${staff.phone ? `
                        <div style="display: flex; align-items: center; gap: var(--spacing-1); color: var(--muted); font-size: 0.875rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            <span>${staff.phone}</span>
                        </div>
                    ` : ''}
                    ${staff.gmail ? `
                        <div style="display: flex; align-items: center; gap: var(--spacing-1); color: var(--muted); font-size: 0.875rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            <span>${staff.gmail}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: var(--spacing-2); flex-shrink: 0;">
                ${showNavigation ? `
                    <button class="btn btn-outline" onclick="window.UniUI.loadPage('staff')" style="display: flex; align-items: center; gap: var(--spacing-1);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Quay lại
                    </button>
                ` : ''}
            </div>
        </div>

        <!-- Staff Info Card -->
        <div class="staff-detail-card mb-4">
            <div class="staff-detail-card-header">
                <h3 class="staff-detail-card-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Thông tin nhân sự
                </h3>
                ${canManageStaff ? `
                    <button class="btn btn-sm" id="editStaffBtn" data-staff-id="${staffId}">Chỉnh sửa</button>
                ` : ''}
            </div>
            <div class="staff-detail-info-grid staff-detail-info-grid--summary">
                <div class="staff-qr-card ${hasQrPaymentLink ? 'has-qr' : 'no-qr'}" data-qr-link="${safeQrLinkAttr}" title="${hasQrPaymentLink ? 'Click để mở link QR thanh toán' : 'Chưa có link QR thanh toán'}">
                    <button type="button" class="staff-qr-edit-btn" data-staff-id="${staffId}" title="Chỉnh sửa link QR thanh toán">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                    </button>
                    <div class="staff-qr-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                            <rect x="3" y="3" width="5" height="5"></rect>
                            <rect x="16" y="3" width="5" height="5"></rect>
                            <rect x="3" y="16" width="5" height="5"></rect>
                            <rect x="16" y="16" width="5" height="5"></rect>
                            <path d="M11 3h2v18h-2z"></path>
                            <path d="M3 11h18v2H3z"></path>
                        </svg>
                    </div>
                    <div class="staff-qr-status">${hasQrPaymentLink ? 'Đã có QR thanh toán' : 'Chưa có link QR'}</div>
                    <div class="staff-qr-link-hint">${hasQrPaymentLink ? 'Nhấn để mở link' : 'Chưa có link QR thanh toán'}</div>
                </div>
                <div class="staff-detail-info-item">
                    <div class="staff-detail-info-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        Tỉnh thành
                    </div>
                    <div class="staff-detail-info-value">${staff.province || '<span style="color: var(--muted); font-style: italic;">Chưa cập nhật</span>'}</div>
                </div>
                <div class="staff-detail-info-item">
                    <div class="staff-detail-info-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Ngày sinh
                    </div>
                    <div class="staff-detail-info-value">${staff.birthDate ? new Date(staff.birthDate).toLocaleDateString('vi-VN') : '<span style="color: var(--muted); font-style: italic;">Chưa cập nhật</span>'}</div>
                </div>
                <div class="staff-detail-info-item">
                    <div class="staff-detail-info-label">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Số điện thoại
                    </div>
                    <div class="staff-detail-info-value">${staff.phone || '<span style="color: var(--muted); font-style: italic;">Chưa cập nhật</span>'}</div>
                </div>
            </div>
            
            <!-- Mô tả chuyên môn - riêng một section -->
            <div class="staff-detail-specialization-section" style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border);">
                <div class="staff-detail-info-label" style="margin-bottom: var(--spacing-2);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    Mô tả chuyên môn
                </div>
                <div class="staff-detail-info-value" id="staffSpecializationValue" style="white-space: pre-wrap; line-height: 1.6; color: var(--text); min-height: 40px; padding: var(--spacing-2);">
                    ${displaySpecialization && displaySpecialization.trim() ? displaySpecialization : '<span style="color: var(--muted); font-style: italic;">Chưa khai báo</span>'}
                </div>
            </div>
        </div>

        <!-- Income Statistics (if has teacher role or other roles) -->
        ${isTeacher || nonTeacherRoles.length > 0 ? `
        <div class="staff-detail-cards-grid mb-4">
            <div class="staff-detail-card">
                <div class="staff-detail-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="staff-detail-card-title" style="margin: 0;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                        Thống kê thu nhập
                    </h3>
                    <div class="session-month-nav" style="position: relative; margin-left: auto;">
                        <button type="button" class="session-month-btn" id="staffMonthPrev" title="Tháng trước">◀</button>
                        <button type="button" class="session-month-label-btn" id="staffMonthLabelBtn" title="Chọn tháng/năm">
                            <span class="session-month-label" id="staffMonthLabel">Tháng ${formatMonthLabel(month)}</span>
                        </button>
                        <button type="button" class="session-month-btn" id="staffMonthNext" title="Tháng sau">▶</button>
                        <div id="staffMonthPopup" class="session-month-popup" style="display:none;">
                            <div class="session-month-popup-header">
                                <button type="button" class="session-month-year-btn" id="staffYearPrev">‹</button>
                                <span class="session-month-year-label" id="staffYearLabel">${month.split('-')[0]}</span>
                                <button type="button" class="session-month-year-btn" id="staffYearNext">›</button>
                            </div>
                            <div class="session-month-grid">
                                ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((label, idx) => {
                                    const val = String(idx + 1).padStart(2, '0');
                                    const isActive = val === month.split('-')[1];
                                    return `<button type="button" class="session-month-cell${isActive ? ' active' : ''}" data-month="${val}">${label}</button>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="staff-detail-stats-grid">
                    <div class="staff-detail-stat-item">
                        <div class="staff-detail-stat-label">Tổng trợ cấp tháng</div>
                        <div class="staff-detail-stat-value" style="color: var(--primary);">${window.UniData.formatCurrency(totalMonthAllClasses)}</div>
                    </div>
                    <div class="staff-detail-stat-item">
                        <div class="staff-detail-stat-label">
                            <span class="badge badge-success" style="margin-right: 8px;">✓</span>
                            Đã thanh toán
                        </div>
                        <div class="staff-detail-stat-value" style="color: #059669;">${window.UniData.formatCurrency(totalPaidByStatus)}</div>
                    </div>
                    <div class="staff-detail-stat-item">
                        <div class="staff-detail-stat-label">
                            <span class="badge badge-danger" style="margin-right: 8px;">✗</span>
                            Chưa thanh toán
                        </div>
                        <div class="staff-detail-stat-value" style="color: #dc2626;">${window.UniData.formatCurrency(totalUnpaidByStatus)}</div>
                    </div>
                    <div class="staff-detail-stat-item">
                        <div class="staff-detail-stat-label">Tổng nhận (từ trước)</div>
                        <div class="staff-detail-stat-value" style="color: var(--primary);">${window.UniData.formatCurrency(totalPaidAllTime)}</div>
                    </div>
                    <div class="staff-detail-stat-item" id="depositStatItem" style="cursor: pointer; transition: all 0.2s ease;" title="Click để xem chi tiết">
                        <div class="staff-detail-stat-label">
                            <span class="badge badge-purple" style="margin-right: 8px;">●</span>
                            Cọc
                        </div>
                        <div class="staff-detail-stat-value" style="color: #9333ea;">${window.UniData.formatCurrency(totalDepositAllTime)}</div>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Two Column Layout: Left (Classes + Work) | Right (Bonuses) -->
        <div class="staff-detail-two-column-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); margin-bottom: var(--spacing-4);">
            <!-- Left Column: Classes + Work -->
            <div class="staff-detail-left-column" style="display: flex; flex-direction: column; gap: var(--spacing-4);">
                <!-- Teacher Classes (only if has teacher role) -->
                ${isTeacher ? `
                <div class="staff-detail-section">
            <div class="staff-detail-section-header">
                <h3 class="staff-detail-section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    Các lớp đang dạy
                </h3>
            </div>
            <div class="staff-detail-section-content">
                ${(() => {
                    // Check if data is still loading
                    const isDataLoading = !Array.isArray(window.demo?.classes) || !Array.isArray(window.demo?.classTeachers);
                    const isLoadingClasses = isDataLoading || (hasClassTeachers && !allClassesHaveTeacherIds);
                    return isLoadingClasses;
                })() ? `
                    <div class="class-detail-skeleton">
                        <div class="skeleton-item skeleton-line" style="height: 20px; width: 40%; margin-bottom: 16px;"></div>
                        <div class="skeleton-item skeleton-table">
                            <div class="skeleton-table-header">
                                <div class="skeleton-line" style="height: 16px; width: 100%;"></div>
                            </div>
                            ${[1, 2, 3].map(() => `
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
                ` : teacherClasses.length > 0 ? `
                <div class="table-container" style="border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border);">
                    <table class="table-striped">
                        <thead>
                            <tr style="background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);">
                                <th style="min-width: 180px;">Tên lớp</th>
                                <th style="min-width: 120px;">Số buổi trong tháng</th>
                                <th style="min-width: 120px;">Tổng tháng</th>
                                <th style="min-width: 120px;">Đã nhận</th>
                                <th style="min-width: 120px;">Chưa nhận</th>
                                ${canManageStaff ? '<th style="min-width: 60px; width: 60px;"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${teacherClassStats.map(stat => {
                                const isActive = stat.isActive;
                                const statusLabel = isActive ? 'Dạy' : 'Dừng';
                                const statusColor = isActive ? '#059669' : '#dc2626';
                                const statusTooltip = isActive ? 'Lớp đang dạy' : 'Lớp đã dừng, không còn phụ trách';
                                const rowCursor = isActive ? 'pointer' : 'not-allowed';
                                const rowOpacity = isActive ? '1' : '0.7';
                                const rowPointerEvents = isActive ? 'auto' : 'none'; // Vô hiệu hóa click cho lớp "Dừng"
                                
                                return `
                                <tr class="teacher-class-row ${isActive ? 'class-active' : 'class-inactive'}" 
                                    data-class-id="${stat.class.id}" 
                                    data-is-active="${isActive}"
                                    style="cursor: ${rowCursor}; transition: all 0.2s ease; opacity: ${rowOpacity}; pointer-events: ${rowPointerEvents};">
                                    <td>
                                        <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                            </svg>
                                            <div style="display: flex; align-items: center; gap: var(--spacing-1);">
                                                <div style="font-weight: 600; color: var(--text);">${stat.class.name}</div>
                                                <span style="font-size: 0.75rem; font-weight: 500; color: ${statusColor}; padding: 2px 6px; border-radius: 4px; background: ${statusColor}15; white-space: nowrap;" title="${statusTooltip}">${statusLabel}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 500; color: var(--text);">${stat.monthSessionsCount}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 600; color: var(--text);">${window.UniData.formatCurrency(stat.totalMonth)}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 500; color: #059669;">${window.UniData.formatCurrency(stat.totalPaid)}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 500; color: #dc2626;">${window.UniData.formatCurrency(stat.totalUnpaid)}</div>
                                    </td>
                                    ${canManageStaff ? `
                                    <td style="text-align: center;">
                                        <button class="btn-delete-class" 
                                            data-class-id="${stat.class.id}" 
                                            data-staff-id="${staffId}"
                                            onclick="event.stopPropagation(); removeStaffFromClass('${staffId}', '${stat.class.id}');"
                                            style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--danger); border-radius: var(--radius); color: var(--danger); cursor: pointer; transition: all 0.2s ease;"
                                            title="Xóa lớp khỏi danh sách">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                    <div class="staff-detail-empty-state">
                        <div class="staff-detail-empty-state-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </div>
                        <p>Chưa có lớp nào được phân công.</p>
                    </div>
                `}
            </div>
        </div>
        ` : ''}

        <!-- Combined Tasks Table (for all non-teacher roles) -->
        ${nonTeacherRoles.length > 0 ? (() => {
            // Collect all work items from all non-teacher roles
            const allWorkItems = [];
            nonTeacherRoles.forEach(role => {
                const workItems = getRoleWorkItems(role, staffId, month);
                allWorkItems.push(...workItems);
            });
            
            // If no work items, don't show the table
            if (allWorkItems.length === 0) return '';
            
            // Calculate grand totals
            let grandTotalUnpaid = 0;
            let grandTotalPaid = 0;
            let grandTotalMonth = 0;
            
            allWorkItems.forEach(item => {
                grandTotalUnpaid += item.unpaid || 0;
                grandTotalPaid += item.paid || 0;
                grandTotalMonth += item.total || 0;
            });
            
            return `
            <div class="staff-detail-section mb-4">
                <div class="staff-detail-section-header">
                    <h3 class="staff-detail-section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Công việc
                    </h3>
                    <span class="text-muted text-sm">Tháng ${formatMonthLabel(month)}</span>
                </div>
                <div class="staff-detail-section-content">
                    <div class="table-container" style="border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border);">
                        <table class="table-striped">
                            <thead>
                                <tr style="background: linear-gradient(180deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.03) 100%);">
                                    <th style="min-width: 200px;">Tên công việc</th>
                                    <th style="min-width: 140px;">Tổng tháng</th>
                                    <th style="min-width: 140px;">Đã nhận</th>
                                    <th style="min-width: 140px;">Chưa nhận</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allWorkItems.map((item, index) => {
                                    const hasAction = item.pageUrl || item.clickAction;
                                    const clickStyle = hasAction ? 'cursor: pointer;' : '';
                                    const rowClass = hasAction ? 'work-item-row' : '';
                                    const pageUrl = item.pageUrl || '';
                                    const rowData = hasAction ? `data-page-url="${pageUrl}" data-work-item-index="${index}"` : '';
                                    
                                    return `
                                    <tr class="${rowClass}" ${rowData} style="${clickStyle} transition: all 0.2s ease;">
                                        <td>
                                            <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                    <polyline points="14 2 14 8 20 8"></polyline>
                                                </svg>
                                                <span style="font-weight: 500; ${hasAction ? 'color: var(--primary);' : ''}">${item.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 600; color: var(--text);">
                                                ${window.UniData.formatCurrency(item.total || 0)}
                                            </div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 500; color: #059669;">
                                                ${window.UniData.formatCurrency(item.paid || 0)}
                                            </div>
                                        </td>
                                        <td>
                                            <div style="font-weight: 500; color: #dc2626;">
                                                ${window.UniData.formatCurrency(item.unpaid || 0)}
                                            </div>
                                        </td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            `;
        })() : ''}
            </div>
            
            <!-- Right Column: Bonuses -->
            <div class="staff-detail-right-column" style="display: flex; flex-direction: column;">
                ${renderBonusesSection(staffId, month, canManageBonuses)}
            </div>
        </div>
    `;

    const staffAccountBtn = main.querySelector('#staffAccountBtn');
    if (staffAccountBtn) {
        staffAccountBtn.addEventListener('click', () => {
            // Open staff info panel (sidebar) when clicking account icon
            openStaffInfoPanel(staffId);
        });
        staffAccountBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        staffAccountBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = 'none';
        });
    }

    // QR card interactions
    const qrCardEl = main.querySelector('.staff-qr-card');
    if (qrCardEl) {
        const qrLink = qrCardEl.dataset.qrLink;
        if (qrLink) {
            qrCardEl.addEventListener('click', () => {
                window.open(qrLink, '_blank');
            });
        } else {
            qrCardEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }
    }

    const qrEditBtn = main.querySelector('.staff-qr-edit-btn');
    if (qrEditBtn) {
        qrEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openStaffQrPaymentModal(staffId);
        });
    }

    // Handle edit staff button click
    main.querySelector('#editStaffBtn')?.addEventListener('click', () => {
        const btnStaffId = main.querySelector('#editStaffBtn')?.getAttribute('data-staff-id');
        if (btnStaffId) {
            openStaffModal(btnStaffId);
        } else {
            openStaffModal(staffId);
        }
    });

    // Handle class row clicks - REMOVED: Now handled below with isActive check
    // This prevents inactive classes from being clickable
    
    // Handle work item row clicks (CSKH, Lesson Plan, etc.)
    main.querySelectorAll('.work-item-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const pageUrl = row.dataset.pageUrl;
            if (pageUrl) {
                window.UniUI.loadPage(pageUrl);
            } else {
                // Fallback: use index-based approach for clickAction functions
                const workItemIndex = parseInt(row.dataset.workItemIndex || '0', 10);
                const nonTeacherRoles = (staff.roles || []).filter(r => r !== STAFF_ROLES.TEACHER);
                const allWorkItems = [];
                nonTeacherRoles.forEach(role => {
                    const workItems = getRoleWorkItems(role, staffId, month);
                    allWorkItems.push(...workItems);
                });
                
                if (allWorkItems[workItemIndex] && allWorkItems[workItemIndex].clickAction) {
                    allWorkItems[workItemIndex].clickAction();
                }
            }
        });
    });

    // Handle month selector (synchronized with session history style)
    const monthPrevBtn = main.querySelector('#staffMonthPrev');
    const monthNextBtn = main.querySelector('#staffMonthNext');
    const monthLabelBtn = main.querySelector('#staffMonthLabelBtn');
    const monthPopup = main.querySelector('#staffMonthPopup');
    const yearLabel = main.querySelector('#staffYearLabel');
    const yearPrevBtn = main.querySelector('#staffYearPrev');
    const yearNextBtn = main.querySelector('#staffYearNext');
    const monthCells = main.querySelectorAll('#staffMonthPopup .session-month-cell');

    function rerenderMonth(delta) {
        const [year, monthPart] = month.split('-');
        let newMonth = parseInt(monthPart) + delta;
        let newYear = parseInt(year);
        if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        } else if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        }
        const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`;
        renderStaffDetail(staffId, newMonthStr);
    }

    function changeYear(delta) {
        const [year, monthPart] = month.split('-');
        const newYear = parseInt(year) + delta;
        const newMonthStr = `${newYear}-${monthPart}`;
        renderStaffDetail(staffId, newMonthStr);
    }

    if (monthPrevBtn) {
        monthPrevBtn.addEventListener('click', () => rerenderMonth(-1));
    }
    if (monthNextBtn) {
        monthNextBtn.addEventListener('click', () => rerenderMonth(1));
    }
    if (monthLabelBtn && monthPopup) {
        monthLabelBtn.addEventListener('click', () => {
            const isHidden = monthPopup.style.display === 'none' || monthPopup.style.display === '';
            monthPopup.style.display = isHidden ? 'block' : 'none';
        });
    }
    if (yearPrevBtn && yearLabel) {
        yearPrevBtn.addEventListener('click', () => changeYear(-1));
    }
    if (yearNextBtn && yearLabel) {
        yearNextBtn.addEventListener('click', () => changeYear(1));
    }
    monthCells.forEach(cell => {
        cell.addEventListener('click', () => {
            const m = cell.getAttribute('data-month');
            if (!m) return;
            const y = yearLabel?.textContent || month.split('-')[0];
            const newMonthStr = `${y}-${m}`;
            monthPopup.style.display = 'none';
            renderStaffDetail(staffId, newMonthStr);
        });
    });

    // Close popup when clicking outside
    if (monthPopup && monthLabelBtn) {
        document.addEventListener('click', (e) => {
            if (!monthPopup.contains(e.target) && !monthLabelBtn.contains(e.target)) {
                monthPopup.style.display = 'none';
            }
        });
    }

    // Handle bonuses section
    const addBonusBtn = main.querySelector('#addBonusBtn');
    if (addBonusBtn) {
        addBonusBtn.addEventListener('click', () => {
            openBonusModal(staffId, month, null);
        });
    }

    // Handle bonus row click - open edit modal
    main.querySelectorAll('.bonus-row[data-bonus-id]').forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking on delete button
            if (e.target.closest('.btn-icon-delete')) {
                return;
            }
            if (!currentUserCanManageStaffBonuses(staffId)) {
                window.UniUI?.toast?.('Bạn không có quyền chỉnh sửa thưởng', 'warning');
                return;
            }
            const bonusId = row.dataset.bonusId;
            if (bonusId) {
                openBonusModal(staffId, month, bonusId);
            }
        });
    });

    main.querySelectorAll('.btn-icon-delete[data-bonus-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bonusId = btn.dataset.bonusId;
            deleteBonus(staffId, bonusId, month);
        });
    });
    
    // Handle deposit stat click - show deposit details popup
    const depositStatItem = main.querySelector('#depositStatItem');
    if (depositStatItem) {
        depositStatItem.addEventListener('click', () => {
            openDepositDetailsModal(staffId);
        });
        depositStatItem.addEventListener('mouseenter', () => {
            depositStatItem.style.transform = 'translateY(-2px)';
            depositStatItem.style.boxShadow = 'var(--shadow-md)';
        });
        depositStatItem.addEventListener('mouseleave', () => {
            depositStatItem.style.transform = 'translateY(0)';
            depositStatItem.style.boxShadow = 'none';
        });
    }
    
    // Handle class row click - only navigate if class is active
    main.querySelectorAll('.teacher-class-row').forEach(row => {
        const isActive = row.dataset.isActive === 'true';
        
        // Only add hover effects and click handler for active classes
        if (isActive) {
            row.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(59, 130, 246, 0.05)';
                this.style.transform = 'translateX(4px)';
            });
            row.addEventListener('mouseleave', function() {
                this.style.background = '';
                this.style.transform = 'translateX(0)';
            });
            
            // Navigate to class detail on click (only for active classes)
            row.addEventListener('click', (e) => {
                // Don't navigate if clicking on delete button
                if (e.target.closest('.btn-delete-class')) {
                    return;
                }
                const classId = row.dataset.classId;
                if (classId) {
                    window.UniUI.loadPage(`class-detail:${classId}`);
                }
            });
        } else {
            // For inactive classes: no click, no hover effects
            // pointer-events: none is already set in the row style
            // This ensures the row is completely non-interactive
        }
    });
    
    // Add hover effects to work item rows
    main.querySelectorAll('.work-item-row').forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.background = 'rgba(59, 130, 246, 0.05)';
            this.style.transform = 'translateX(4px)';
        });
        row.addEventListener('mouseleave', function() {
            this.style.background = '';
            this.style.transform = 'translateX(0)';
        });
    });
    
    // Update snapshot after rendering
    hasStaffDetailDataChanged(staffId); // This will update the snapshot
}

// Open deposit details modal
function openDepositDetailsModal(staffId) {
    const staff = (window.demo?.teachers || []).find(t => t.id === staffId);
    if (!staff) return;
    
    const roles = staff.roles || [];
    const isTeacher = roles.includes(STAFF_ROLES.TEACHER) || roles.length === 0;
    
    // Get all deposit sessions (if teacher)
    const depositSessions = [];
    if (isTeacher) {
        const allSessions = (window.demo.sessions || []).filter(s => s.teacherId === staffId);
        const depositSessionsData = allSessions.filter(s => (s.paymentStatus || 'unpaid') === 'deposit');
        
        depositSessionsData.forEach(session => {
            const cls = (window.demo.classes || []).find(c => c.id === session.classId);
            const allowanceAmount = session.allowanceAmount ?? window.UniData.computeSessionAllowance?.(session) ?? 0;
            const date = session.date ? new Date(session.date).toLocaleDateString('vi-VN') : '-';
            
            depositSessions.push({
                type: 'session',
                id: session.id,
                className: cls?.name || 'Không xác định',
                date: date,
                amount: allowanceAmount,
                notes: session.notes || ''
            });
        });
    }
    
    // Get all deposit tasks (for all roles)
    const depositTasks = [];
    [STAFF_ROLES.LESSON_PLAN, STAFF_ROLES.ACCOUNTANT, STAFF_ROLES.CSKH_SALE, STAFF_ROLES.COMMUNICATION].forEach(role => {
        if (roles.includes(role)) {
            const tasks = getStaffTasksByRole(staffId, role);
            const roleDepositTasks = tasks.filter(t => (t.paymentStatus || 'unpaid') === 'deposit');
            
            roleDepositTasks.forEach(task => {
                const roleLabel = STAFF_ROLE_LABELS[role] || role;
                const date = task.date ? new Date(task.date).toLocaleDateString('vi-VN') : '-';
                const amount = task.amount || task.paymentAmount || 0;
                
                depositTasks.push({
                    type: 'task',
                    id: task.id,
                    role: roleLabel,
                    taskName: task.name || task.title || 'Công việc',
                    date: date,
                    amount: amount,
                    notes: task.notes || task.description || ''
                });
            });
        }
    });
    
    // Sort by date (newest first)
    const allDeposits = [...depositSessions, ...depositTasks].sort((a, b) => {
        const dateA = a.date ? new Date(a.date.split('/').reverse().join('-')) : new Date(0);
        const dateB = b.date ? new Date(b.date.split('/').reverse().join('-')) : new Date(0);
        return dateB - dateA;
    });
    
    const totalDeposit = allDeposits.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    const modalContent = `
        <div style="max-width: 800px;">
            <div class="mb-3">
                <h3 style="margin: 0;">Chi tiết tiền cọc</h3>
                <p class="text-muted text-sm">Tổng cộng: <strong>${window.UniData.formatCurrency(totalDeposit)}</strong></p>
            </div>
            
            ${allDeposits.length === 0 ? `
                <div class="text-center text-muted" style="padding: var(--spacing-8);">
                    Chưa có tiền cọc nào
                </div>
            ` : `
                <div class="table-container" style="max-height: 500px; overflow-y: auto;">
                    <table class="table-striped">
                        <thead>
                            <tr>
                                <th>Loại</th>
                                <th>Thông tin</th>
                                <th>Ngày</th>
                                <th>Số tiền</th>
                                <th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allDeposits.map(item => `
                                <tr>
                                    <td>
                                        ${item.type === 'session' ? 
                                            '<span class="badge badge-primary">Buổi dạy</span>' : 
                                            '<span class="badge badge-info">Công việc</span>'
                                        }
                                    </td>
                                    <td>
                                        ${item.type === 'session' ? 
                                            `<strong>${item.className}</strong>` : 
                                            `<strong>${item.role}</strong><br><small class="text-muted">${item.taskName}</small>`
                                        }
                                    </td>
                                    <td>${item.date}</td>
                                    <td><strong>${window.UniData.formatCurrency(item.amount)}</strong></td>
                                    <td><small class="text-muted">${item.notes || '-'}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;
    
    window.UniUI.openModal('Chi tiết tiền cọc', modalContent);
}

/**
 * Open modal to add/update QR payment link for staff
 */
function openStaffQrPaymentModal(staffId) {
    const staff = window.demo?.teachers?.find(t => t.id === staffId);
    if (!staff) return;

    const currentLink = staff.qr_payment_link || staff.qrPaymentLink || staff.bankQRLink || '';
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="staffQrPaymentInput">Link QR thanh toán</label>
            <input 
                id="staffQrPaymentInput" 
                name="qrPaymentLink" 
                type="url" 
                class="form-control" 
                placeholder="https://drive.google.com/... hoặc link ảnh QR"
                value="${currentLink}"
            />
            <div class="text-muted text-sm mt-1">
                Dán link ảnh QR thanh toán (Google Drive hoặc nguồn khác). Để trống để xóa.
            </div>
        </div>
        <div class="form-actions" style="display: flex; justify-content: flex-end; gap: var(--spacing-2); margin-top: var(--spacing-3);">
            <button type="button" class="btn btn-outline" data-action="cancel">Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu</button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const link = (form.querySelector('#staffQrPaymentInput')?.value || '').trim();

        if (link && !/^https?:\/\/.+/i.test(link)) {
            window.UniUI.toast?.('Link QR thanh toán không hợp lệ. Vui lòng nhập link bắt đầu bằng http hoặc https.', 'error');
            return;
        }

        const normalizedLink = link || null;

        try {
            await window.UniData.withOptimisticUpdate(
                () => {
                    const updatedStaff = window.UniLogic.updateEntity('teacher', staffId, {
                        qrPaymentLink: normalizedLink,
                        qr_payment_link: normalizedLink
                    });

                    return {
                        supabaseEntities: { teachers: [updatedStaff] },
                        supabaseDeletes: null
                    };
                },
                {
                    onSuccess: () => {
                        window.UniUI.closeModal();
                        window.UniUI.toast(normalizedLink ? 'Đã cập nhật link QR thanh toán' : 'Đã xóa link QR thanh toán', 'success');
                        renderStaffDetail(staffId);
                    },
                    onError: (error) => {
                        console.error('Failed to save QR payment link:', error);
                        window.UniUI.toast('Không thể lưu link QR thanh toán', 'error');
                    },
                    onRollback: () => {
                        window.UniUI.closeModal();
                    }
                }
            );
        } catch (err) {
            window.UniUI.toast?.(err.message || 'Không thể lưu link QR thanh toán', 'error');
        }
    });

    form.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        window.UniUI.closeModal();
    });

    window.UniUI.openModal('Chỉnh sửa link QR thanh toán', form);
}

// Toggle password visibility - Enhanced
function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const isPassword = input.type === 'password';
    const isPrefilled = input.dataset.isPrefilled === 'true';
    const originalPassword = input.dataset.originalPassword || '';
    
    // Nếu đang chuyển từ password sang text và có password đã prefill
    if (isPassword && isPrefilled && originalPassword) {
        // Đảm bảo value là original password (có thể đã bị thay đổi)
        if (input.value === '' || input.value === '••••••••') {
            input.value = originalPassword;
        }
    }
    
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

// Open staff info panel (sidebar)
function openStaffInfoPanel(staffId) {
    const staff = window.demo.teachers.find(t => t.id === staffId);
    if (!staff) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    const canManageStaff = isAdmin || window.UniUI.userHasStaffRole?.('accountant');
    const canEdit = canManageStaff;

    const panel = document.createElement('div');
    panel.className = 'teacher-info-panel staff-info-panel';
    panel.id = 'staffInfoPanel';
    panel.innerHTML = `
        <div class="teacher-info-header">
            <h3>Thông tin cá nhân</h3>
            <button class="btn-icon-close" id="closeStaffInfoPanel" aria-label="Đóng">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="teacher-info-content">
            <div class="teacher-info-view" id="staffInfoView">
                <div class="info-item">
                    <label>Họ tên</label>
                    <div class="info-value">${staff.fullName || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Ngày sinh</label>
                    <div class="info-value">${staff.birthDate ? new Date(staff.birthDate + 'T00:00:00').toLocaleDateString('vi-VN') : '-'}</div>
                </div>
                <div class="info-item">
                    <label>Email</label>
                    <div class="info-value">${staff.gmail || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Số điện thoại</label>
                    <div class="info-value">${staff.phone || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Đại học</label>
                    <div class="info-value">${staff.university || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Trường THPT</label>
                    <div class="info-value">${staff.highSchool || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Tỉnh thành</label>
                    <div class="info-value">${staff.province || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Mô tả chuyên môn</label>
                    <div class="info-value">${staff.specialization || '-'}</div>
                </div>
                <div class="info-item">
                    <label>Chức vụ</label>
                    <div class="info-value">
                        ${(staff.roles || []).length > 0 
                            ? (staff.roles || []).map(role => STAFF_ROLE_LABELS[role] || role).join(', ')
                            : STAFF_ROLE_LABELS[STAFF_ROLES.TEACHER] || 'Gia sư'
                        }
                    </div>
                </div>
                ${canEdit ? `
                    <div class="info-actions">
                        <button class="btn btn-primary" id="editStaffInfoBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: var(--spacing-2);">
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
    backdrop.className = 'teacher-info-backdrop staff-info-backdrop';
    backdrop.id = 'staffInfoBackdrop';

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
    panel.querySelector('#closeStaffInfoPanel')?.addEventListener('click', closePanel);

    if (canEdit) {
        // Open edit modal when clicking edit button
        panel.querySelector('#editStaffInfoBtn')?.addEventListener('click', () => {
            closePanel();
            // Open staff edit modal
            if (typeof openStaffModal === 'function') {
                openStaffModal(staffId);
            }
        });
    }
}

// Export
window.renderStaff = renderStaff;
window.renderTeachers = renderTeachers;
window.renderStaffDetail = renderStaffDetail;
window.openStaffModal = openStaffModal;
window.openStaffInfoPanel = openStaffInfoPanel;
window.togglePasswordVisibility = togglePasswordVisibility;
// Open bonus modal for add/edit
function openBonusModal(staffId, month, bonusId = null) {
    const isEdit = Boolean(bonusId);
    const bonus = isEdit ? (window.demo.bonuses || []).find(b => b.id === bonusId) : null;
    const canManage = currentUserCanManageStaffBonuses(staffId);
    
    if (!canManage) {
        window.UniUI?.toast?.('Bạn không có quyền quản lý thưởng', 'error');
        return;
    }

    // Get work types from staff roles
    const staff = window.demo.teachers.find(t => t.id === staffId);
    const roles = staff?.roles || [];
    const workTypes = [];
    if (roles.includes(STAFF_ROLES.TEACHER)) workTypes.push('Gia sư');
    if (roles.includes(STAFF_ROLES.LESSON_PLAN)) workTypes.push('Giáo án');
    if (roles.includes(STAFF_ROLES.ACCOUNTANT)) workTypes.push('Kế toán');
    if (roles.includes(STAFF_ROLES.CSKH_SALE)) workTypes.push('CSKH & SALE');
    if (roles.includes(STAFF_ROLES.COMMUNICATION)) workTypes.push('Truyền thông');
    if (workTypes.length === 0) workTypes.push('Khác');

    const formatCurrencyInput = (value) => {
        // Giữ lại dấu trừ nếu có
        const str = String(value || '').trim();
        const isNegative = str.startsWith('-');
        const numeric = str.replace(/[^\d]/g, '');
        // Nếu chỉ có dấu trừ, giữ lại dấu trừ
        if (isNegative && !numeric) return '-';
        if (!numeric) return '';
        const formatted = numeric.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return isNegative ? '-' + formatted : formatted;
    };

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="bonusWorkType">Công việc <span class="text-danger">*</span></label>
            <select id="bonusWorkType" name="workType" class="form-control" required>
                <option value="">-- Chọn công việc --</option>
                ${workTypes.map(type => `
                    <option value="${type}" ${bonus?.workType === type ? 'selected' : ''}>${type}</option>
                `).join('')}
            </select>
        </div>
        <div class="form-group">
            <label for="bonusAmount">Số tiền <span class="text-danger">*</span></label>
            <div class="currency-input-wrapper">
                <input type="text" id="bonusAmount" name="amount" class="form-control currency-input" value="${bonus ? formatCurrencyInput(bonus.amount) : ''}" required placeholder="Ví dụ: 1.500.000" inputmode="numeric" autocomplete="off" data-raw-value="${bonus ? bonus.amount : ''}">
                <span class="currency-suffix">đ</span>
            </div>
            <small id="bonusAmountText" class="text-muted"></small>
        </div>
        <div class="form-group">
            <label for="bonusStatus">Trạng thái <span class="text-danger">*</span></label>
            <select id="bonusStatus" name="status" class="form-control" required>
                <option value="unpaid" ${bonus?.status === 'unpaid' ? 'selected' : ''}>Chờ thanh toán</option>
                <option value="paid" ${bonus?.status === 'paid' ? 'selected' : ''}>Đã thanh toán</option>
                <option value="deposit" ${bonus?.status === 'deposit' ? 'selected' : ''}>Cọc</option>
            </select>
        </div>
        <div class="form-group">
            <label for="bonusNote">Ghi chú</label>
            <textarea id="bonusNote" name="note" class="form-control" rows="3" placeholder="Ghi chú về thưởng này...">${bonus?.note || ''}</textarea>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
        </div>
    `;

    window.UniUI.openModal(isEdit ? 'Chỉnh sửa thưởng' : 'Thêm thưởng mới', form);

    const amountInput = form.querySelector('#bonusAmount');
    const amountText = form.querySelector('#bonusAmountText');

    const toWords = (amount) => {
        if (!window.UniData || typeof window.UniData.numberToVietnameseText !== 'function') return '';
        return window.UniData.numberToVietnameseText(amount);
    };

    const updateAmountDisplay = () => {
        if (!amountInput || !amountText) return;
        const str = amountInput.value;
        // Cho phép chỉ có dấu trừ
        if (str === '-') {
            amountText.textContent = '';
            return;
        }
        const isNegative = str.startsWith('-');
        const raw = str.replace(/[^\d]/g, '');
        const formatted = formatCurrencyInput(isNegative ? '-' + raw : raw);
        amountInput.value = formatted;
        if (raw) {
            const numericValue = isNegative ? -parseInt(raw, 10) : parseInt(raw, 10);
            const words = toWords(numericValue);
            amountText.textContent = words || '';
        } else {
            amountText.textContent = '';
        }
    };

    if (amountInput) {
        amountInput.addEventListener('input', () => {
            // Cho phép nhập dấu trừ trực tiếp
            const currentValue = amountInput.value;
            if (currentValue === '-') {
                amountText.textContent = '';
                return;
            }
            updateAmountDisplay();
        });
        amountInput.addEventListener('blur', updateAmountDisplay);
        amountInput.addEventListener('focus', () => {
            const str = amountInput.value;
            const isNegative = str.startsWith('-');
            const raw = str.replace(/[^\d]/g, '');
            if (raw) {
                const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                amountInput.value = isNegative ? '-' + formatted : formatted;
            } else if (isNegative) {
                amountInput.value = '-';
            } else {
                amountInput.value = '';
            }
        });
        // Initialize display for edit mode
        updateAmountDisplay();
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const workType = formData.get('workType');
        const amountStr = amountInput ? amountInput.value : formData.get('amount').toString();
        const isNegative = amountStr.startsWith('-');
        const amountValue = amountStr.replace(/[^\d]/g, '');
        const amount = amountValue ? (isNegative ? -parseInt(amountValue, 10) : parseInt(amountValue, 10)) : 0;
        const status = formData.get('status') || 'unpaid';
        const note = formData.get('note') || '';

        if (!workType) {
            window.UniUI.toast('Vui lòng chọn công việc', 'error');
            return;
        }

        if (!Number.isFinite(amount)) {
            window.UniUI.toast('Vui lòng nhập số tiền hợp lệ', 'error');
            return;
        }

        const bonusData = {
            staffId,
            workType,
            amount,
            status,
            note: note || null,
            month,
            createdAt: isEdit ? (bonus.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await window.UniData.withOptimisticUpdate(
            () => {
                if (!window.demo.bonuses) window.demo.bonuses = [];
                
                if (isEdit) {
                    const index = window.demo.bonuses.findIndex(b => b.id === bonusId);
                    if (index >= 0) {
                        window.demo.bonuses[index] = { ...bonus, ...bonusData, id: bonusId };
                        return {
                            supabaseEntities: {
                                bonuses: [window.demo.bonuses[index]]
                            }
                        };
                    }
                } else {
                    const newBonus = {
                        id: window.UniData.generateId ? window.UniData.generateId('bonus') : ('B' + Math.random().toString(36).slice(2, 9).toUpperCase()),
                        ...bonusData
                    };
                    window.demo.bonuses.push(newBonus);
                    return {
                        supabaseEntities: {
                            bonuses: [newBonus]
                        }
                    };
                }
                return {};
            },
            {
                onSuccess: () => {
                    window.UniUI.toast(isEdit ? 'Đã cập nhật thưởng' : 'Đã thêm thưởng mới', 'success');
                    window.UniUI.closeModal();
                    renderStaffDetail(staffId, month);
                },
                onError: (error) => {
                    console.error('Error saving bonus:', error);
                    window.UniUI.toast('Không thể lưu thưởng', 'error');
                }
            }
        );
    });
}

// Delete bonus
async function deleteBonus(staffId, bonusId, month) {
    const canManage = currentUserCanManageStaffBonuses(staffId);
    
    if (!canManage) {
        window.UniUI?.toast?.('Bạn không có quyền xóa thưởng', 'error');
        return;
    }

    if (!confirm('Bạn có chắc chắn muốn xóa thưởng này?')) return;

    await window.UniData.withOptimisticUpdate(
        () => {
            if (!window.demo.bonuses) window.demo.bonuses = [];
            const index = window.demo.bonuses.findIndex(b => b.id === bonusId);
            if (index >= 0) {
                window.demo.bonuses.splice(index, 1);
                return {
                    supabaseDeletes: {
                        bonuses: [bonusId]
                    }
                };
            }
            return {};
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa thưởng', 'success');
                renderStaffDetail(staffId, month);
            },
            onError: (error) => {
                console.error('Error deleting bonus:', error);
                window.UniUI.toast('Không thể xóa thưởng', 'error');
            }
        }
    );
}

// Remove staff (teacher) from class
// This will change the class status from "Dạy" to "Dừng" but keep it in the list
async function removeStaffFromClass(staffId, classId) {
    const isAdmin = window.UniUI?.hasRole?.('admin');
    if (!isAdmin) {
        window.UniUI?.toast?.('Bạn không có quyền gỡ gia sư khỏi lớp', 'error');
        return;
    }

    const cls = (window.demo?.classes || []).find(c => c.id === classId);
    if (!cls) {
        window.UniUI?.toast?.('Không tìm thấy lớp', 'error');
        return;
    }

    const className = cls.name || 'lớp này';
    const staff = (window.demo?.teachers || []).find(t => t.id === staffId);
    const staffName = staff?.fullName || 'gia sư này';
    
    if (!confirm(`Bạn có chắc chắn muốn gỡ "${staffName}" khỏi lớp "${className}"?\n\nLớp sẽ chuyển sang trạng thái "Dừng" nhưng vẫn hiển thị trong danh sách để giữ dữ liệu thống kê.`)) {
        return;
    }

    // Get current teacherIds
    const currentTeacherIds = Array.isArray(cls.teacherIds) 
        ? cls.teacherIds.filter(Boolean) 
        : (cls.teacherId ? [cls.teacherId] : []);
    
    // Check if teacher is actually in the class
    if (!currentTeacherIds.includes(staffId)) {
        window.UniUI?.toast?.('Gia sư này không có trong lớp', 'warning');
        return;
    }
    
    // Remove staffId from teacherIds
    const updatedTeacherIds = currentTeacherIds.filter(id => id !== staffId);
    
    // IMPORTANT: Ensure customTeacherAllowances entry exists for this teacher
    // This allows us to track that the teacher was previously assigned to this class
    // So the class will still show as "Dừng" even if there are no sessions
    // We keep or create the allowance entry - it serves as history tracking
    const currentAllowances = { ...(cls.customTeacherAllowances || {}) };
    
    console.log(`[removeStaffFromClass] BEFORE update - Class ${classId} customTeacherAllowances:`, JSON.stringify(currentAllowances));
    
    // If allowance entry doesn't exist, create it with the default tuitionPerSession
    // This ensures the class will still be visible after teacher removal
    if (!currentAllowances.hasOwnProperty(staffId) || currentAllowances[staffId] === null || currentAllowances[staffId] === undefined) {
        const defaultAllowance = cls.tuitionPerSession || 0;
        currentAllowances[staffId] = defaultAllowance;
        console.log(`[removeStaffFromClass] ✅ Created allowance entry for staff ${staffId} in class ${classId}: ${defaultAllowance}`);
    } else {
        console.log(`[removeStaffFromClass] ✅ Keeping existing allowance entry for staff ${staffId} in class ${classId}: ${currentAllowances[staffId]}`);
    }
    
    console.log(`[removeStaffFromClass] AFTER ensuring entry - Class ${classId} customTeacherAllowances:`, JSON.stringify(currentAllowances));

    try {
        // Update class with new teacherIds
        // Keep or create customTeacherAllowances entry to track history
        // This will make the class appear as "Dừng" (inactive) in the staff detail page
        console.log(`[removeStaffFromClass] 🔄 Updating class ${classId}:`, {
            teacherIds: updatedTeacherIds,
            customTeacherAllowances: currentAllowances,
            staffIdInAllowances: currentAllowances.hasOwnProperty(staffId),
            allowanceValue: currentAllowances[staffId]
        });
        
        // Get the class object BEFORE update to verify
        const classBeforeUpdate = window.demo.classes.find(c => c.id === classId);
        console.log(`[removeStaffFromClass] Class BEFORE updateEntity:`, {
            id: classBeforeUpdate?.id,
            name: classBeforeUpdate?.name,
            teacherIds: classBeforeUpdate?.teacherIds,
            customTeacherAllowances: classBeforeUpdate?.customTeacherAllowances
        });
        
        const result = window.UniLogic.updateEntity('class', classId, {
            teacherIds: updatedTeacherIds,
            customTeacherAllowances: currentAllowances
        });
        
        // Get the class object AFTER update to verify
        const classAfterUpdate = window.demo.classes.find(c => c.id === classId);
        console.log(`[removeStaffFromClass] Class AFTER updateEntity:`, {
            id: classAfterUpdate?.id,
            name: classAfterUpdate?.name,
            teacherIds: classAfterUpdate?.teacherIds,
            customTeacherAllowances: classAfterUpdate?.customTeacherAllowances,
            staffIdInAllowances: classAfterUpdate?.customTeacherAllowances?.hasOwnProperty(staffId),
            allowanceValue: classAfterUpdate?.customTeacherAllowances?.[staffId]
        });
        
        console.log('[removeStaffFromClass] Update result:', result);
        
        // Force save to DB immediately
        console.log('[removeStaffFromClass] 💾 Triggering save to DB...');
        await window.UniData.save({
            supabaseEntities: {
                classes: [classAfterUpdate]
            }
        });
        console.log('[removeStaffFromClass] ✅ Save to DB completed');

        // Get current month from DOM or default
        const monthSelect = document.querySelector('#staffMonthSelect');
        const selectedMonth = monthSelect ? monthSelect.value : null;

        // Wait a bit for data to sync, then refresh staff detail page
        // The class will now show as "Dừng" instead of "Dạy"
        setTimeout(() => {
            renderStaffDetail(staffId, selectedMonth);
        }, 300);
        
        window.UniUI?.toast?.('Đã gỡ gia sư khỏi lớp. Lớp chuyển sang trạng thái "Dừng"', 'success');
    } catch (error) {
        console.error('Error removing staff from class:', error);
        window.UniUI?.toast?.('Không thể gỡ gia sư khỏi lớp', 'error');
    }
}

// Export to window for onclick handlers
window.removeStaffFromClass = removeStaffFromClass;

window.StaffPage = { 
    render: renderStaff,
    delete: deleteStaff,
    renderDetail: renderStaffDetail
};

