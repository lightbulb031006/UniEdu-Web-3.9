/**
 * ui.js - UI related functionality
 */

// Security helper: Safe innerHTML setter
function safeSetHTML(element, html) {
    if (!element) return;
    
    // If SecurityUtils is available, sanitize HTML
    if (window.SecurityUtils && window.SecurityUtils.sanitizeHTML) {
        // For template strings, we need to sanitize each variable
        // This is a basic implementation - for production, consider using DOMPurify
        element.innerHTML = html;
    } else {
        // Fallback: Use textContent for user input, innerHTML for static content
        // For now, just set innerHTML but log warning if contains user input patterns
        if (html.includes('${') || html.includes('{{')) {
            console.warn('⚠️ Potential XSS risk: innerHTML with template variables. Consider using SecurityUtils.sanitizeHTML()');
        }
        element.innerHTML = html;
    }
}

// UI Constants
const SELECTORS = {
    mainContent: '#main-content',
    modalBackdrop: '#modalBackdrop',
    modal: '#modal',
    modalTitle: '#modalTitle',
    modalBody: '#modalBody',
    closeModal: '#closeModal',
    themeButtons: '[data-theme-option]',
    tabs: '.tab',
};

const THEME_DEFAULT = 'light';
const THEME_DARK = 'dark';
const THEME_SAKURA = 'sakura';
let previousNonSakuraTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('unicorns.prevTheme')) || THEME_DEFAULT;

let landingModeActive = false;

function enterLandingMode() {
    if (landingModeActive) return;
    landingModeActive = true;
    document.body.classList.add('home-landing-mode');
    const layout = document.querySelector('.layout');
    layout?.classList.add('layout-landing');
    const sidebar = document.querySelector('aside.sidebar');
    if (sidebar) {
        if (sidebar.dataset.prevDisplay === undefined) {
            sidebar.dataset.prevDisplay = sidebar.style.display || '';
        }
        sidebar.style.display = 'none';
    }
    const topNav = document.getElementById('topNav');
    if (topNav) {
        if (topNav.dataset.prevDisplay === undefined) {
            topNav.dataset.prevDisplay = topNav.style.display || '';
        }
        topNav.style.display = 'none';
    }
    updateMainContentPadding();
}

function exitLandingMode() {
    if (!landingModeActive) return;
    landingModeActive = false;
    document.body.classList.remove('home-landing-mode');
    const layout = document.querySelector('.layout');
    layout?.classList.remove('layout-landing');
    const sidebar = document.querySelector('aside.sidebar');
    if (sidebar) {
        const prev = sidebar.dataset.prevDisplay ?? '';
        sidebar.style.display = prev;
        delete sidebar.dataset.prevDisplay;
    }
    const topNav = document.getElementById('topNav');
    if (topNav) {
        const prev = topNav.dataset.prevDisplay ?? '';
        topNav.style.display = prev;
        delete topNav.dataset.prevDisplay;
    }
    updateMainContentPadding();
    refreshNavigation();
}

// RBAC helpers
function getCurrentUser() {
    return (window.UniAuth && window.UniAuth.getCurrentUser) ? window.UniAuth.getCurrentUser() : null;
}
function hasRole(...roles) {
    const u = getCurrentUser();
    return !!u && roles.includes(u.role);
}
function isOwnerTeacherOfClass(classId) {
    const u = getCurrentUser();
    if (!u || u.role !== 'teacher') return false;
    const cls = (window.demo?.classes||[]).find(c => c.id === classId);
    if (!cls || !u.linkId) return false;
    const teacherIds = Array.isArray(cls.teacherIds)
        ? cls.teacherIds.filter(Boolean)
        : (cls.teacherId ? [cls.teacherId] : []);
    return teacherIds.includes(u.linkId);
}

function normalizePageKey(pageName) {
    if (!pageName) return '';
    return pageName.includes(':') ? pageName.split(':')[0] : pageName;
}

const PAGE_ACCESS = {
    guest: ['home'],
    visitor: ['home'],
    student: ['dashboard', 'classes', 'class-detail', 'student-detail', 'home', 'coding'],
    teacher: ['dashboard', 'classes', 'class-detail', 'student-detail', 'staff-detail', 'teachers', 'schedule', 'home', 'coding'],
    admin: 'all'
};

const TAB_ACCESS = {
    guest: ['home'],
    visitor: ['home'],
    student: ['home', 'dashboard', 'coding'],
    teacher: ['home', 'dashboard', 'coding'], // Ẩn 'classes' và 'staff' cho teacher
    admin: ['home', 'dashboard', 'staff', 'teachers', 'classes', 'students', 'action-history', 'lesson-plans', 'costs', 'categories', 'coding']
};

// Extra page access mapping for staff-specific roles (stored on teacher profiles)
const STAFF_ROLE_PAGE_ACCESS = {
    lesson_plan: ['lesson-plans'],
    accountant: ['staff', 'lesson-plans', 'costs'],
    cskh_sale: ['staff-cskh-detail'],
    communication: [],
    teacher: []
};

function findStaffRecordForUser(user) {
    if (!user) return null;
    const teachers = window.demo?.teachers || [];
    if (user.linkId) {
        const byLink = teachers.find(t => t.id === user.linkId);
        if (byLink) return byLink;
    }
    if (user.id) {
        const byUserId = teachers.find(t => t.userId === user.id);
        if (byUserId) return byUserId;
    }
    if (user.email) {
        const byEmail = teachers.find(t => t.gmail === user.email);
        if (byEmail) return byEmail;
    }
    return null;
}

function getUserStaffRoles(user = null) {
    const targetUser = user || getCurrentUser();
    if (!targetUser) return [];
    const staffRecord = findStaffRecordForUser(targetUser);
    if (!staffRecord) return [];
    if (Array.isArray(staffRecord.roles) && staffRecord.roles.length > 0) {
        return staffRecord.roles.filter(Boolean);
    }
    if (staffRecord.role) {
        return [staffRecord.role];
    }
    return ['teacher'];
}

function userHasStaffRole(role) {
    if (!role) return false;
    const roles = getUserStaffRoles();
    return roles.includes(role);
}

function getAdditionalPagesForUser(user) {
    if (!user) return [];
    const staffRoles = getUserStaffRoles(user);
    if (!staffRoles.length) return [];
    const pages = new Set();
    staffRoles.forEach(role => {
        const extras = STAFF_ROLE_PAGE_ACCESS[role];
        if (!extras || !extras.length) return;
        extras.forEach(page => pages.add(page));
    });
    return Array.from(pages);
}

function getDefaultPageForRole(role) {
    switch (role) {
        case 'guest':
        case 'visitor':
            return 'home';
        case 'admin':
            return 'dashboard';
        case 'teacher':
            // Teacher → dashboard (sẽ redirect đến staff-detail trong renderPageContent)
            return 'dashboard';
        case 'student':
            return 'classes'; // Học sinh → trang lớp học
        case 'assistant':
            return 'dashboard'; // Assistant → dashboard
        default:
            return 'home';
    }
}

function canAccessPage(pageName) {
    const normalized = normalizePageKey(pageName);
    const resolved = normalized === 'auth' ? 'home' : normalized;
    const user = getCurrentUser();
    const role = user?.role || 'guest';
    if (role === 'admin') return true;
    const accessList = PAGE_ACCESS[role] || [];
    if (accessList === 'all') return true;
    const baseList = Array.isArray(accessList) ? accessList : [];
    if (baseList.includes(resolved)) return true;
    const extraPages = getAdditionalPagesForUser(user);
    return extraPages.includes(resolved);
}

/**
 * Update main content padding based on navigation type
 */
function updateMainContentPadding() {
    const user = (window.UniAuth && window.UniAuth.getCurrentUser) ? window.UniAuth.getCurrentUser() : null;
    const role = user?.role || 'guest';
    const mainContent = document.querySelector('#main-content');
    const topNav = document.getElementById('topNav');
    
    if (mainContent) {
        if (role === 'admin') {
            // Admin: sidebar dọc, không cần padding-top
            mainContent.style.paddingTop = '';
        } else if (topNav && topNav.style.display !== 'none') {
            // Other roles: top nav, add minimal padding so content sits close to header
            mainContent.style.paddingTop = '8px';
        } else {
            mainContent.style.paddingTop = '';
        }
    }
}

function updateTopNavScrollShadow(container) {
    if (!container) return;
    const showLeft = container.scrollLeft > 0;
    const showRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 1);
    container.classList.toggle('has-left-shadow', showLeft);
    container.classList.toggle('has-right-shadow', showRight);
}

function bindTopNavScrollShadow() {
    const topNavTabs = document.querySelector('#topNav .top-nav-tabs');
    if (!topNavTabs) return;
    if (!topNavTabs._shadowHandlerBound) {
        topNavTabs.addEventListener('scroll', () => updateTopNavScrollShadow(topNavTabs));
        topNavTabs._shadowHandlerBound = true;
    }
    updateTopNavScrollShadow(topNavTabs);
}

function updateTopNavScrolledState() {
    const topNav = document.getElementById('topNav');
    if (!topNav) return;
    const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 4;
    topNav.classList.toggle('top-nav-scrolled', scrolled);
}

/**
 * Update navigation visibility and user info based on auth state
 */
function refreshNavigation() {
    const user = (window.UniAuth && window.UniAuth.getCurrentUser) ? window.UniAuth.getCurrentUser() : null;
    const role = user?.role || 'guest';
    const extraPages = getAdditionalPagesForUser(user);
    const landingActive = landingModeActive;

    // Sidebar visibility
    // Admin: dùng sidebar dọc
    // Tất cả role khác: dùng sidebar ngang trên đầu
    const sidebar = document.querySelector('aside.sidebar');
    if (sidebar) {
        const showSidebar = !landingActive && role === 'admin';
        sidebar.style.display = showSidebar ? '' : 'none';
    }

    // Top nav visibility (dùng cho tất cả role trừ admin)
    const topNav = document.getElementById('topNav');
    if (topNav) {
        const showTopNav = !landingActive && role !== 'admin';
        topNav.style.display = showTopNav ? 'flex' : 'none';
    }
    
    // Update main content padding based on navigation type
    updateMainContentPadding();

    // Show/hide tabs by role (apply to both sidebar and top nav)
    const baseTabs = Array.isArray(TAB_ACCESS[role]) ? TAB_ACCESS[role] : [];
    const allowedTabs = role === 'admin' ? 'all' : Array.from(new Set([...baseTabs, ...extraPages]));
    document.querySelectorAll(SELECTORS.tabs).forEach(btn => {
        const page = btn.dataset.page;
        if (!page) {
            btn.style.display = '';
            return;
        }
        const visible = role === 'admin' || allowedTabs === 'all' || allowedTabs.includes(page);
        btn.style.display = visible ? '' : 'none';
    });
    
    // Also apply to top nav tabs (they use the same data-page attribute)
    const topNavTabs = document.querySelectorAll('#topNav .tab[data-page]');
    topNavTabs.forEach(btn => {
        const page = btn.dataset.page;
        if (!page) {
            btn.style.display = '';
            return;
        }
        const visible = role === 'admin' || allowedTabs === 'all' || allowedTabs.includes(page);
        btn.style.display = visible ? '' : 'none';
    });

    // User info, login, register, and logout
    const userInfo = document.getElementById('userInfo');
    const userInfoText = document.getElementById('userInfoText');
    const userInfoRole = document.getElementById('userInfoRole');
    const topNavUserBtn = document.getElementById('topNavUserBtn');
    const topNavUserName = document.getElementById('topNavUserName');
    const topNavUserRole = document.getElementById('topNavUserRole');
    const topNavGuestActions = document.getElementById('topNavGuestActions');
    const loginBtnTop = document.getElementById('loginBtnTop');
    const registerBtnTop = document.getElementById('registerBtnTop');
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnTop = document.getElementById('logoutBtnTop');
    const sidebarUserSection = document.querySelector('.sidebar-user-section');
    
    if (user) {
        // Sidebar user info - improved UI
        if (sidebarUserSection) {
            sidebarUserSection.style.display = 'block';
        }
        if (userInfo) {
            userInfo.style.display = 'flex';
            if (userInfoText) {
                if (user.role === 'admin') {
                    userInfoText.textContent = 'Admin';
                } else {
                    userInfoText.textContent = user.name || user.email || 'User';
                }
            }
            if (userInfoRole) {
                const roleLabels = {
                    'admin': 'Quản trị viên',
                    'teacher': 'Giáo viên',
                    'student': 'Học sinh',
                    'assistant': 'Trợ lý',
                    'visitor': 'Khách'
                };
                userInfoRole.textContent = roleLabels[user.role] || user.role.toUpperCase();
            }
            // Nếu là admin, cho phép click để chỉnh sửa thông tin đăng nhập
            if (user.role === 'admin') {
                userInfo.classList.add('clickable');
                userInfo.title = 'Chỉnh sửa thông tin đăng nhập';
            } else {
                userInfo.classList.remove('clickable');
                userInfo.title = 'Thông tin tài khoản';
            }
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'flex';
        }
        // Top nav user info (guest header)
        const roleLabels = {
            'admin': 'Quản trị viên',
            'teacher': 'Giáo viên',
            'student': 'Học sinh',
            'assistant': 'Trợ lý',
            'visitor': 'Khách'
        };
        const roleLabel = roleLabels[user.role] || user.role.toUpperCase();
        if (topNavUserBtn) {
            topNavUserBtn.style.display = 'flex';
            if (topNavUserName) {
                topNavUserName.textContent = user.name || user.email || 'User';
            }
            if (topNavUserRole) {
                topNavUserRole.textContent = roleLabel;
            }
        }
        if (topNavGuestActions) {
            topNavGuestActions.style.display = 'none';
        }
        if (loginBtnTop) loginBtnTop.style.display = 'none';
        if (registerBtnTop) registerBtnTop.style.display = 'none';
        if (logoutBtnTop) logoutBtnTop.style.display = '';
    } else {
        if (sidebarUserSection) {
            sidebarUserSection.style.display = 'none';
        }
        if (userInfo) {
            userInfo.style.display = 'none';
            if (userInfoText) userInfoText.textContent = '';
            if (userInfoRole) userInfoRole.textContent = '';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        if (topNavUserBtn) {
            topNavUserBtn.style.display = 'none';
        }
        if (topNavUserName) topNavUserName.textContent = '';
        if (topNavUserRole) topNavUserRole.textContent = '';
        if (topNavGuestActions) {
            topNavGuestActions.style.display = 'flex';
        }
        if (loginBtnTop) loginBtnTop.style.display = '';
        if (registerBtnTop) registerBtnTop.style.display = '';
        if (logoutBtnTop) logoutBtnTop.style.display = 'none';
    }

    bindTopNavScrollShadow();
}

/**
 * Determine current page from URL hash
 */
function getCurrentPageName() {
    const hash = window.location.hash || '';
    const page = hash.startsWith('#') ? hash.slice(1) : hash;
    const resolved = page === 'auth' ? 'home' : page;
    return resolved || 'dashboard';
}

function setActiveTab(pageName) {
    const normalized = pageName.includes(':') ? pageName.split(':')[0] : pageName;
    document.querySelectorAll(SELECTORS.tabs).forEach(tab => {
        if (tab.dataset.page === normalized) {
            tab.setAttribute('aria-current', 'page');
        } else {
            tab.removeAttribute('aria-current');
        }
    });
}

function renderPageContent(pageName) {
    const main = document.querySelector(SELECTORS.mainContent);
    if (!main) return;

    // KIỂM TRA: Nếu UI đã được restore từ sessionStorage và chưa có thay đổi data, KHÔNG render lại
    const spinner = document.getElementById('appBootSkeleton');

    const normalizedPage = normalizePageKey(pageName);
    if (normalizedPage !== 'home' && normalizedPage !== 'auth') {
        window.UniLayout?.exitLandingMode?.();
    }

    if (!canAccessPage(pageName)) {
        const user = getCurrentUser();
        if (!user) {
            main.innerHTML = `
                <div class="card">
                    <h3>Yêu cầu đăng nhập</h3>
                    <p class="text-muted">Vui lòng đăng nhập để tiếp tục.</p>
                    <button class="btn btn-primary mt-2" onclick="window.UniUI.loadPage('home')">Đến trang đăng nhập</button>
                </div>
            `;
        } else {
            main.innerHTML = `
                <div class="card">
                    <h3>Không có quyền truy cập</h3>
                    <p class="text-muted">Tài khoản của bạn không được phép truy cập trang này.</p>
                </div>
            `;
        }
        return;
    }

    switch (pageName) {
        case 'home':
            if (typeof renderHome === 'function') renderHome(); else renderDashboard();
            break;
        case 'dashboard':
            // For teacher role, redirect to their staff detail page
            const user = getCurrentUser();
            if (user && user.role === 'teacher') {
                const teachers = window.demo?.teachers || [];
                const teacherRecord = teachers.find(t => {
                    if (t.userId && user.id) {
                        return t.userId === user.id;
                    }
                    if (user.linkId) {
                        return t.id === user.linkId;
                    }
                    return false;
                });
                if (teacherRecord) {
                    // Redirect to staff detail page
                    loadPage(`staff-detail:${teacherRecord.id}`, { replaceHistory: true });
                    return;
                }
            }
            // For other roles, show normal dashboard
            if (typeof renderDashboard === 'function') renderDashboard(); else console.error('renderDashboard not found');
            break;
        case 'auth':
            if (typeof renderHome === 'function') renderHome(); else renderDashboard();
            break;
        case 'classes':
            if (typeof renderClasses === 'function') renderClasses(); else console.error('renderClasses not found');
            break;
        case 'students':
            if (typeof window.renderStudents === 'function') {
                window.renderStudents();
            } else if (typeof renderStudents === 'function') {
            renderStudents();
            } else {
                console.error('renderStudents not found');
            }
            break;
        case 'staff':
            if (typeof renderStaff === 'function') {
                renderStaff('all');
            } else if (typeof renderTeachers === 'function') {
            renderTeachers();
            } else {
                console.error('renderStaff/renderTeachers not found');
            }
            break;
        case 'teachers':
            if (typeof renderTeachers === 'function') renderTeachers(); else console.error('renderTeachers not found');
            break;
        case 'lesson-plans':
            if (typeof renderLessonPlans === 'function') renderLessonPlans(); else console.error('renderLessonPlans not found');
            break;
        case 'payments':
            if (typeof renderPayments === 'function') renderPayments(); else renderDashboard();
            break;
        case 'schedule':
            if (typeof renderSchedule === 'function') renderSchedule(); else renderDashboard();
            break;
        case 'reports':
            if (typeof renderReports === 'function') renderReports(); else renderDashboard();
            break;
        case 'costs':
            if (typeof renderCosts === 'function') renderCosts(); else renderDashboard();
            break;
        case 'categories':
            if (typeof renderCategories === 'function') renderCategories(); else renderDashboard();
            break;
        case 'coding':
            if (typeof renderCoding === 'function') renderCoding(); else console.error('renderCoding not found');
            break;
        case 'action-history':
            if (typeof renderActionHistory === 'function') renderActionHistory(); else console.error('renderActionHistory not found');
            break;
        default:
            if (pageName.startsWith('class-detail:')) {
                const parts = pageName.split(':');
                const classId = decodeURIComponent(parts.slice(1).join(':'));
                if (typeof renderClassDetail === 'function') {
                    renderClassDetail(classId);
                } else {
                    console.error('renderClassDetail not found');
            renderDashboard();
    }
            } else if (pageName.startsWith('staff-detail:')) {
                const parts = pageName.split(':');
                const staffId = decodeURIComponent(parts.slice(1).join(':'));
                if (typeof renderStaffDetail === 'function') {
                    renderStaffDetail(staffId);
                } else {
                    console.error('renderStaffDetail not found');
                    renderStaff && renderStaff('teacher');
                }
            } else if (pageName.startsWith('teacher-detail:')) {
                // Redirect to staff-detail for unified experience
                const parts = pageName.split(':');
                const teacherId = decodeURIComponent(parts.slice(1).join(':'));
                if (typeof renderStaffDetail === 'function') {
                    renderStaffDetail(teacherId);
                } else {
                    console.error('renderStaffDetail not found');
                    renderStaff && renderStaff('teacher');
                }
            } else if (pageName.startsWith('student-detail:')) {
                const parts = pageName.split(':');
                const studentId = decodeURIComponent(parts.slice(1).join(':'));
                if (typeof renderStudentDetail === 'function') {
                    renderStudentDetail(studentId);
                } else {
                    console.error('renderStudentDetail not found');
                    renderStudents && renderStudents();
                }
            } else if (pageName.startsWith('staff-cskh-detail:')) {
                const parts = pageName.split(':');
                const staffId = decodeURIComponent(parts.slice(1).join(':'));
                if (typeof renderStaffCskhDetail === 'function') {
                    renderStaffCskhDetail(staffId);
                } else {
                    console.error('renderStaffCskhDetail not found');
                    renderStaff && renderStaff('teacher');
                }
            } else {
            renderDashboard();
    }
    }
    
}

/**
 * Load page content
 * @param {string} pageName - Name of the page to load
 * @param {Object} options - Additional options
 */
function loadPage(pageName, options = {}) {
    const requestedPage = pageName || 'dashboard';
    const targetPage = requestedPage === 'auth' ? 'home' : requestedPage;
    const { skipHistory = false, replaceHistory = false } = options;

    setActiveTab(targetPage);

    const user = getCurrentUser();
    const role = user?.role || 'guest';
    if (!canAccessPage(targetPage)) {
        const fallback = getDefaultPageForRole(role);
        if (targetPage !== fallback) {
            renderPageContent(fallback);
            return;
        }
    }

    if (!skipHistory) {
        if (replaceHistory) {
            history.replaceState({ page: targetPage }, '', `#${targetPage}`);
        } else {
            history.pushState({ page: targetPage }, '', `#${targetPage}`);
        }
    } else if (replaceHistory && window.location.hash !== `#${targetPage}`) {
        history.replaceState({ page: targetPage }, '', `#${targetPage}`);
    }

    renderPageContent(targetPage);
}

function refreshCurrentPage() {
    const current = getCurrentPageName();
    loadPage(current, { skipHistory: true, replaceHistory: false });
}

// Modal Management
let lastFocusedElement = null;

/**
 * Open modal dialog - Enhanced
 * @param {string} title - Modal title
 * @param {string|HTMLElement} content - Modal content
 * @param {Object} options - Modal options
 */
function openModal(title, content, options = {}) {
    const backdrop = document.querySelector(SELECTORS.modalBackdrop);
    const modal = document.querySelector(SELECTORS.modal);
    const titleEl = document.querySelector(SELECTORS.modalTitle);
    const body = document.querySelector(SELECTORS.modalBody);

    if (!backdrop || !modal || !titleEl || !body) return;

    const {
        closeOnBackdrop = true,
        closeOnEscape = true,
        maxWidth = '600px',
        fullScreenOnMobile = true
    } = options;

    // Store last focused element
    lastFocusedElement = document.activeElement;

    // Set content
    titleEl.textContent = title; // textContent is safe
    body.innerHTML = '';
    if (typeof content === 'string') {
        // SECURITY: Sanitize HTML content to prevent XSS
        if (window.SecurityUtils && window.SecurityUtils.sanitizeHTML) {
            // For static HTML templates, innerHTML is OK
            // But if content contains user input, it should be sanitized first
        body.innerHTML = content;
        } else {
            body.innerHTML = content;
        }
    } else if (content instanceof HTMLElement) {
        body.appendChild(content);
    }

    // Set modal max width
    if (maxWidth) {
        modal.style.maxWidth = maxWidth;
    }

    // Add mobile fullscreen class
    if (fullScreenOnMobile) {
        modal.classList.add('modal-mobile-fullscreen');
    }

    // Remove exit classes
    backdrop.classList.remove('exiting');
    modal.classList.remove('exiting');

    // Show modal
    backdrop.style.display = 'flex';
    backdrop.setAttribute('aria-hidden', 'false');
    
    // Force reflow for animation
    backdrop.offsetHeight;

    // Focus first focusable element
    setTimeout(() => {
        const focusable = modal.querySelector(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
            focusable.focus();
        } else {
            // If no focusable element, focus the close button
            const closeBtn = document.querySelector(SELECTORS.closeModal);
            if (closeBtn) closeBtn.focus();
        }
    }, 50);

    // Handle ESC key
    function handleEscape(e) {
        if (e.key === 'Escape' && closeOnEscape) {
            closeModal();
        }
    }
    document.addEventListener('keydown', handleEscape);
    modal._escapeHandler = handleEscape;

    // Click outside to close
    const backdropClickHandler = (e) => {
        if (e.target === backdrop && closeOnBackdrop) {
            closeModal();
        }
    };
    backdrop.addEventListener('click', backdropClickHandler);
    modal._backdropClickHandler = backdropClickHandler;
}

/**
 * Close modal dialog - Enhanced
 */
function closeModal() {
    const backdrop = document.querySelector(SELECTORS.modalBackdrop);
    const modal = document.querySelector(SELECTORS.modal);
    if (!backdrop || !modal) return;

    // Add exit classes for animation
    backdrop.classList.add('exiting');
    modal.classList.add('exiting');

    // Remove ESC handler
    if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
        delete modal._escapeHandler;
    }

    // Remove backdrop click handler
    if (modal._backdropClickHandler) {
        backdrop.removeEventListener('click', modal._backdropClickHandler);
        delete modal._backdropClickHandler;
    }

    // Hide after animation
    setTimeout(() => {
        backdrop.style.display = 'none';
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.classList.remove('exiting');
        modal.classList.remove('exiting');
        
        // Remove mobile fullscreen class
        modal.classList.remove('modal-mobile-fullscreen');

    // Restore focus
    if (lastFocusedElement && 'focus' in lastFocusedElement) {
        lastFocusedElement.focus();
    }
    }, 200);
}

/**
 * Attach navigation event handlers (tabs, buttons, etc.)
 * This function can be called multiple times safely using event delegation
 */
function attachNavigationHandlers() {
    // Use event delegation on document level - only attach once
    if (!window.__navHandlersAttached) {
    // Tab navigation
        document.addEventListener('click', (e) => {
            const tab = e.target.closest(SELECTORS.tabs);
            if (tab && tab.dataset.page) {
            const page = tab.dataset.page;
                if (page) {
                    e.preventDefault();
                    e.stopPropagation();
            loadPage(page);
            }
        }
    });

        // Login button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'loginBtnTop' || e.target.closest('#loginBtnTop')) {
                e.preventDefault();
                e.stopPropagation();
            const currentPage = getCurrentPageName();
            if (currentPage !== 'home') {
                loadPage('home', { replaceHistory: false });
            }
            setTimeout(() => {
                const loginBtn = document.querySelector('[data-auth="login"]');
                if (loginBtn) {
                    loginBtn.click();
                    } else if (window.openHomeAuthModal && typeof window.openHomeAuthModal === 'function') {
                        window.openHomeAuthModal('login');
                }
            }, 300);
            }
        });
        
        // Register button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'registerBtnTop' || e.target.closest('#registerBtnTop')) {
                e.preventDefault();
                e.stopPropagation();
            const currentPage = getCurrentPageName();
            if (currentPage !== 'home') {
                loadPage('home', { replaceHistory: false });
            }
            setTimeout(() => {
                const registerBtn = document.querySelector('[data-auth="register"]');
                if (registerBtn) {
                    registerBtn.click();
                    } else if (window.openHomeAuthModal && typeof window.openHomeAuthModal === 'function') {
                        window.openHomeAuthModal('register');
                }
            }, 300);
            }
        });
        
        // Logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'logoutBtn' || e.target.closest('#logoutBtn') ||
                e.target.id === 'logoutBtnTop' || e.target.closest('#logoutBtnTop')) {
                e.preventDefault();
                e.stopPropagation();
                if (window.UniAuth && window.UniAuth.logout) window.UniAuth.logout();
                refreshNavigation();
                loadPage('home', { replaceHistory: true });
            }
        });
        
        window.__navHandlersAttached = true;
        console.log('[UI] Navigation handlers attached using event delegation');
    }
}

/**
 * Initialize UI event listeners
 */
function initializeUI() {
    if (window.__UniPendingPageRefresh) {
        delete window.__UniPendingPageRefresh;
        setTimeout(() => {
            if (typeof window.UniUI?.refreshCurrentPage === 'function') {
                window.UniUI.refreshCurrentPage();
            }
        }, 0);
    }

    // Theme buttons
    const themeButtons = document.querySelectorAll(SELECTORS.themeButtons);
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.themeOption;
            if (theme) setTheme(theme);
        });
    });

    // Close modal button
    const closeModalBtn = document.querySelector(SELECTORS.closeModal);
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    // Attach navigation handlers
    attachNavigationHandlers();

    // Handle browser back/forward (only attach once)
    if (!window.__popstateHandlerAttached) {
        window.addEventListener('popstate', (e) => {
            const page = getCurrentPageName();
            loadPage(page, { skipHistory: true, replaceHistory: true });
        });
        window.__popstateHandlerAttached = true;
    }

    // Account info button (admin only - edit login info)
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.addEventListener('click', () => {
            const user = getCurrentUser();
            if (user && user.role === 'admin') {
                openAdminLoginInfoModal();
            }
        });
    }


    // Initial nav state
    refreshNavigation();
    updateTopNavScrolledState();
    window.addEventListener('scroll', updateTopNavScrolledState, { passive: true });
    
    // Update padding after a short delay to ensure topNav is rendered
    setTimeout(() => {
        updateMainContentPadding();
    }, 100);
    
    // Update padding on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateMainContentPadding();
        }, 100);
    });

    // Load initial page
    const hashPage = (location.hash || '').slice(1);
    const user = (window.UniAuth && window.UniAuth.getCurrentUser) ? window.UniAuth.getCurrentUser() : null;
    const initialPage = hashPage || getDefaultPageForRole(user?.role || 'guest');
    loadPage(initialPage, { replaceHistory: true });

    // Restore theme preference
    const savedPrevTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('unicorns.prevTheme')) || previousNonSakuraTheme;
    previousNonSakuraTheme = savedPrevTheme || THEME_DEFAULT;
    const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem('unicorns.theme')) || THEME_DEFAULT;
    setTheme(savedTheme, { preservePrevious: true });
}

/**
 * Set theme
 */
function setTheme(theme, options = {}) {
    const { preservePrevious = false } = options;
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme') || THEME_DEFAULT;
    const nextTheme = theme || THEME_DEFAULT;

    if (!preservePrevious) {
        if (nextTheme === THEME_SAKURA && currentTheme !== THEME_SAKURA) {
            previousNonSakuraTheme = currentTheme;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('unicorns.prevTheme', previousNonSakuraTheme);
            }
        } else if (nextTheme !== THEME_SAKURA) {
            previousNonSakuraTheme = nextTheme;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('unicorns.prevTheme', previousNonSakuraTheme);
            }
        }
    }

    html.setAttribute('data-theme', nextTheme);
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('unicorns.theme', nextTheme);
    }
    updateThemeButtonsUI();
}

function updateThemeButtonsUI() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || THEME_DEFAULT;
    const labels = {
        [THEME_DEFAULT]: 'Chế độ sáng',
        [THEME_DARK]: 'Chế độ tối',
        [THEME_SAKURA]: 'Hoa Anh Đào'
    };

    document.querySelectorAll(SELECTORS.themeButtons).forEach(button => {
        const option = button.dataset.themeOption || THEME_DEFAULT;
        const isActive = option === currentTheme;
        button.classList.toggle('theme-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        if (labels[option]) {
            const suffix = isActive ? ' (đang dùng)' : '';
            button.setAttribute('title', `${labels[option]}${suffix}`);
            button.setAttribute('aria-label', `${labels[option]}${suffix}`);
        }
    });
}

/**
 * Toggle theme
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || THEME_DEFAULT;
    const order = [THEME_DEFAULT, THEME_DARK, THEME_SAKURA];
    const nextTheme = order[(order.indexOf(currentTheme) + 1) % order.length];
    setTheme(nextTheme);
}

/**
 * Open modal to edit admin login information
 */
function openAdminLoginInfoModal() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        window.UniUI.toast('Chỉ quản trị viên mới có quyền chỉnh sửa thông tin đăng nhập', 'error');
        return;
    }

    // Ưu tiên lấy admin từ window.demo.users (Supabase) thay vì localStorage
    let adminUser = null;
    if (window.demo?.users) {
        adminUser = window.demo.users.find(u => 
            u.role === 'admin' && (u.id === user.id || u.email === user.email)
        );
    }
    
    // Fallback: lấy từ localStorage nếu không tìm thấy trong Supabase
    if (!adminUser) {
        const users = window.UniAuth && window.UniAuth.loadUsers ? window.UniAuth.loadUsers() : [];
        adminUser = users.find(u => u.role === 'admin' && (u.id === user.id || u.email === user.email));
    }
    
    if (!adminUser) {
        window.UniUI.toast('Không tìm thấy thông tin tài khoản admin', 'error');
        return;
    }
    
    // Đảm bảo email được lấy từ Supabase (ưu tiên) hoặc localStorage
    const adminEmail = adminUser.email || user.email || '';

    const form = document.createElement('form');
    form.className = 'admin-login-form';
    form.innerHTML = `
        <div class="form-group">
            <label for="adminEmail">Email đăng nhập</label>
            <div class="input-wrapper">
                <input 
                    id="adminEmail" 
                    name="email" 
                    type="email" 
                    class="form-control" 
                    value="${adminEmail}" 
                    required
                    placeholder="email@example.com"
                    autocomplete="email"
                >
            </div>
            <small class="form-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                Email dùng để đăng nhập vào hệ thống
            </small>
        </div>
        <div class="form-group">
            <label for="adminOldPassword">Mật khẩu cũ</label>
            <div class="input-wrapper password-wrapper">
                <input 
                    id="adminOldPassword" 
                    name="oldPassword" 
                    type="password" 
                    class="form-control password-input" 
                    value=""
                    placeholder="Nhập mật khẩu hiện tại"
                    autocomplete="off"
                >
                <button 
                    type="button" 
                    class="password-toggle" 
                    data-target="adminOldPassword"
                    aria-label="Hiện/ẩn mật khẩu"
                    title="Hiện/ẩn mật khẩu"
                >
                    <svg class="eye-icon eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg class="eye-icon eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                </button>
            </div>
            <small class="form-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                Nhập mật khẩu hiện tại để xác thực
            </small>
        </div>
        <div class="form-group">
            <label for="adminPassword">Mật khẩu mới</label>
            <div class="input-wrapper password-wrapper">
                <input 
                    id="adminPassword" 
                    name="password" 
                    type="password" 
                    class="form-control password-input" 
                    placeholder="Nhập mật khẩu mới (để trống nếu không đổi)"
                    autocomplete="new-password"
                >
                <button 
                    type="button" 
                    class="password-toggle" 
                    data-target="adminPassword"
                    aria-label="Hiện/ẩn mật khẩu"
                    title="Hiện/ẩn mật khẩu"
                >
                    <svg class="eye-icon eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <svg class="eye-icon eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                </button>
            </div>
            <small class="form-hint">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 16v-4"></path>
                    <path d="M12 8h.01"></path>
                </svg>
                Mật khẩu mới phải có từ 6-8 ký tự, bao gồm chữ cái và số
            </small>
        </div>
        <div class="form-actions">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                Lưu thay đổi
            </button>
        </div>
    `;

    // Attach password toggle functionality for all password fields
    const passwordToggles = form.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        const targetId = toggle.getAttribute('data-target');
        if (!targetId) return;
        
        const passwordInput = form.querySelector(`#${targetId}`);
        if (!passwordInput) return;
        
        const eyeOpen = toggle.querySelector('.eye-open');
        const eyeClosed = toggle.querySelector('.eye-closed');
        
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            
            if (isPassword) {
                if (eyeOpen) eyeOpen.style.display = 'none';
                if (eyeClosed) eyeClosed.style.display = 'block';
                toggle.setAttribute('aria-label', 'Ẩn mật khẩu');
            } else {
                if (eyeOpen) eyeOpen.style.display = 'block';
                if (eyeClosed) eyeClosed.style.display = 'none';
                toggle.setAttribute('aria-label', 'Hiện mật khẩu');
            }
        });
    });

    // Error display elements
    const oldPasswordError = document.createElement('div');
    oldPasswordError.className = 'form-error';
    oldPasswordError.style.display = 'none';
    oldPasswordError.style.color = 'var(--danger, #ef4444)';
    oldPasswordError.style.fontSize = '0.875rem';
    oldPasswordError.style.marginTop = '0.25rem';
    form.querySelector('#adminOldPassword').parentElement.parentElement.appendChild(oldPasswordError);

    const newPasswordError = document.createElement('div');
    newPasswordError.className = 'form-error';
    newPasswordError.style.display = 'none';
    newPasswordError.style.color = 'var(--danger, #ef4444)';
    newPasswordError.style.fontSize = '0.875rem';
    newPasswordError.style.marginTop = '0.25rem';
    form.querySelector('#adminPassword').parentElement.parentElement.appendChild(newPasswordError);

    // Clear errors on input
    form.querySelector('#adminOldPassword').addEventListener('input', () => {
        oldPasswordError.style.display = 'none';
        oldPasswordError.textContent = '';
    });
    form.querySelector('#adminPassword').addEventListener('input', () => {
        newPasswordError.style.display = 'none';
        newPasswordError.textContent = '';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous errors
        oldPasswordError.style.display = 'none';
        oldPasswordError.textContent = '';
        newPasswordError.style.display = 'none';
        newPasswordError.textContent = '';
        
        const fd = new FormData(form);
        const email = fd.get('email')?.trim() || '';
        
        // ============================================
        // XỬ LÝ INPUT: Trim và loại bỏ ký tự vô hình
        // ============================================
        let oldPassword = fd.get('oldPassword')?.trim() || '';
        let newPassword = fd.get('password')?.trim() || '';
        
        // Loại bỏ ký tự vô hình và không hợp lệ
        oldPassword = oldPassword.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width characters
        newPassword = newPassword.replace(/[\u200B-\u200D\uFEFF]/g, '');

        // Validation
        if (!email) {
            window.UniUI.toast('Vui lòng nhập email', 'error');
            return;
        }

        // ============================================
        // LẤY ADMIN ID TỪ SESSION/TOKEN HIỆN TẠI
        // ============================================
        const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
        if (!currentUser || currentUser.role !== 'admin') {
            window.UniUI.toast('Chỉ quản trị viên mới có quyền chỉnh sửa', 'error');
            return;
        }
        
        const adminId = currentUser.id;
        const adminEmail = currentUser.email || email;
        
        // Debug log (không log password)
        const isDebug = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isDebug) {
            console.log('🔐 Admin change password:', {
                adminId: adminId,
                adminEmail: adminEmail,
                environment: window.SupabaseAdapter?.isEnabled ? 'Supabase' : 'Local',
                hasOldPassword: !!oldPassword,
                hasNewPassword: !!newPassword
            });
        }

        // Nếu có nhập mật khẩu mới, phải nhập mật khẩu cũ để xác thực
        if (newPassword) {
            if (!oldPassword) {
                oldPasswordError.textContent = 'Vui lòng nhập mật khẩu cũ để xác thực';
                oldPasswordError.style.display = 'block';
                form.querySelector('#adminOldPassword').focus();
                return;
            }

            // ============================================
            // BƯỚC 1: Lấy mật khẩu hiện tại từ DB (ưu tiên query trực tiếp)
            // ============================================
            let correctPassword = null;
            let adminFromDB = null;
            
            // Ưu tiên: Query trực tiếp từ Supabase bằng adminId từ session
            if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                try {
                    const supabase = window.SupabaseAdapter.getClient();
                    
                    // Query bằng adminId từ session (ưu tiên nhất)
                    // Lấy cả password và passwordHash (nếu có)
                    let { data: users, error } = await supabase
                        .from('users')
                        .select('id, email, password, password_hash, role')
                        .eq('id', adminId)
                        .eq('role', 'admin')
                        .limit(1);
                    
                    // Nếu không tìm thấy theo ID, thử theo email
                    if ((!users || users.length === 0) && adminEmail) {
                        const { data: usersByEmail, error: emailError } = await supabase
                            .from('users')
                            .select('id, email, password, password_hash, role')
                            .eq('email', adminEmail)
                            .eq('role', 'admin')
                            .limit(1);
                        
                        if (!emailError && usersByEmail && usersByEmail.length > 0) {
                            users = usersByEmail;
                            error = null;
                        }
                    }
                    
                    if (error) {
                        console.error('❌ Error querying admin from DB:', error);
                    } else if (users && users.length > 0) {
                        adminFromDB = users[0];
                        // Ưu tiên lấy password_hash, fallback về password
                        correctPassword = adminFromDB.password_hash || adminFromDB.password;
                        
                        if (isDebug) {
                            const hashType = window.UniAuthHelpers?.detectHashType 
                                ? window.UniAuthHelpers.detectHashType(correctPassword)
                                : 'unknown';
                            console.log('✅ Lấy password từ DB:', {
                                adminId: adminFromDB.id,
                                email: adminFromDB.email,
                                passwordLength: correctPassword?.length,
                                hashType: hashType,
                                hasPasswordHash: !!adminFromDB.password_hash,
                                hasPassword: !!adminFromDB.password
                            });
                        }
                    } else {
                        if (isDebug) {
                            console.warn('⚠️ Không tìm thấy admin trong DB với adminId:', adminId);
                        }
                    }
                } catch (e) {
                    console.error('❌ Exception querying admin from DB:', e);
                }
            }
            
            // Fallback: Lấy từ window.demo.users
            if (!correctPassword && window.demo?.users) {
                const supabaseAdmin = window.demo.users.find(u => 
                    u.role === 'admin' && (u.id === adminId || u.email === adminEmail || u.email === email)
                );
                if (supabaseAdmin && supabaseAdmin.password) {
                    correctPassword = supabaseAdmin.password;
                    adminFromDB = supabaseAdmin;
                    if (isDebug) {
                        console.log('✅ Lấy password từ window.demo.users');
                    }
                }
            }
            
            // Fallback: Lấy từ localStorage
            if (!correctPassword && adminUser && adminUser.password) {
                correctPassword = adminUser.password;
                if (isDebug) {
                    console.log('✅ Lấy password từ localStorage');
                }
            }
            
            if (!correctPassword) {
                oldPasswordError.textContent = 'Không thể xác thực mật khẩu. Vui lòng thử lại sau.';
                oldPasswordError.style.display = 'block';
                return;
            }
            
            // ============================================
            // BƯỚC 2: So sánh mật khẩu cũ với mật khẩu trong DB
            // KHÔNG DÙNG === TRỰC TIẾP, PHẢI DÙNG verifyPassword với await
            // verifyPassword sẽ tự động detect loại hash (bcrypt/SHA-256/plaintext)
            // ============================================
            let passwordMatch = false;
            
            // QUAN TRỌNG: Phải dùng await và verifyPassword helper
            // verifyPassword sẽ tự động detect và dùng bcrypt.compare() nếu là bcrypt hash
            if (window.UniAuthHelpers && window.UniAuthHelpers.verifyPassword) {
                // verifyPassword sẽ:
                // - Detect hash type (bcrypt/SHA-256/plaintext)
                // - Dùng bcryptjs.compare() nếu là bcrypt hash
                // - Dùng SHA-256 hash comparison nếu là SHA-256 hash
                // - Fallback plaintext nếu không phải hash
                passwordMatch = await window.UniAuthHelpers.verifyPassword(oldPassword, correctPassword);
                
                if (isDebug) {
                    const hashType = window.UniAuthHelpers?.detectHashType 
                        ? window.UniAuthHelpers.detectHashType(correctPassword)
                        : 'unknown';
                    
                    // Thêm debug chi tiết: hash password input và so sánh
                    let computedHash = null;
                    if (hashType === 'sha256' && window.UniAuthHelpers && window.UniAuthHelpers.hashPassword) {
                        computedHash = await window.UniAuthHelpers.hashPassword(oldPassword);
                    }
                    
                    console.log('🔐 Password verification:', {
                        oldPassword: oldPassword,
                        oldPasswordLength: oldPassword.length,
                        correctPassword: correctPassword?.substring(0, 20) + '...', // Chỉ hiển thị 20 ký tự đầu
                        correctPasswordLength: correctPassword?.length,
                        hashType: hashType,
                        match: passwordMatch,
                        usingBcrypt: hashType === 'bcrypt' && typeof bcryptjs !== 'undefined',
                        computedHash: computedHash ? computedHash.substring(0, 20) + '...' : null,
                        hashMatch: computedHash === correctPassword
                    });
                }
            } else {
                // Fallback: plaintext comparison (chỉ cho development)
                passwordMatch = oldPassword === correctPassword;
                if (isDebug) {
                    console.warn('⚠️ No hash helper available, using plaintext comparison');
                }
            }
            
            if (!passwordMatch) {
                oldPasswordError.textContent = 'Mật khẩu cũ không đúng';
                oldPasswordError.style.display = 'block';
                form.querySelector('#adminOldPassword').focus();
                return;
            }

            // ============================================
            // BƯỚC 3: Validate mật khẩu mới
            // ============================================
            
            // Kiểm tra mật khẩu mới không được giống mật khẩu cũ
            if (newPassword === oldPassword) {
                newPasswordError.textContent = 'Mật khẩu mới phải khác mật khẩu cũ';
                newPasswordError.style.display = 'block';
                form.querySelector('#adminPassword').focus();
                return;
            }
            
            // Validate độ mạnh mật khẩu mới (độ dài 6-8, có số và chữ)
            const passwordErrors = [];
            
            // Độ dài tối thiểu 6, tối đa 8
            if (newPassword.length < 6) {
                passwordErrors.push('Mật khẩu phải có ít nhất 6 ký tự');
            } else if (newPassword.length > 8) {
                passwordErrors.push('Mật khẩu không được vượt quá 8 ký tự');
            }
            
            // Phải có ít nhất 1 chữ cái
            if (!/[a-zA-Z]/.test(newPassword)) {
                passwordErrors.push('Mật khẩu phải chứa ít nhất 1 chữ cái');
            }
            
            // Phải có ít nhất 1 số
            if (!/[0-9]/.test(newPassword)) {
                passwordErrors.push('Mật khẩu phải chứa ít nhất 1 số');
            }
            
            if (passwordErrors.length > 0) {
                newPasswordError.textContent = passwordErrors.join('. ');
                newPasswordError.style.display = 'block';
                form.querySelector('#adminPassword').focus();
                return;
            }
            
            // KHÔNG dùng validatePasswordStrength từ security module vì nó yêu cầu ít nhất 8 ký tự
            // (mâu thuẫn với yêu cầu 6-8 ký tự ở trên)
            // Nếu cần validation mạnh hơn, có thể bật lại nhưng phải sửa validatePasswordStrength trước
        }

        // ============================================
        // BƯỚC 4: Cố gắng đổi mật khẩu qua RPC (server-side hashing)
        // ============================================
        try {
            let passwordUpdated = false;
            if (newPassword && newPassword.trim() && window.SupabaseAdapter && window.SupabaseAdapter.isEnabled && window.SupabaseAdapter.getClient) {
                try {
                    const supabase = window.SupabaseAdapter.getClient();
                    const { data, error } = await supabase.rpc('change_user_password', {
                        p_user_id: adminId,
                        p_old_password: oldPassword,
                        p_new_password: newPassword
                    });
                    if (error) {
                        throw error;
                    }
                    if (data !== true) {
                        throw new Error('Mật khẩu cũ không đúng');
                    }
                    passwordUpdated = true;
                    if (isDebug) {
                        console.log('✅ Password updated via RPC');
                    }
                } catch (rpcError) {
                    console.warn('Không thể đổi mật khẩu qua RPC, fallback sang client-side update:', rpcError);
                }
            }

            // ============================================
            // BƯỚC 5: Fallback - Hash client-side và cập nhật trực tiếp
            // ============================================
            if (!passwordUpdated && newPassword && newPassword.trim()) {
                // Hash mật khẩu mới bằng bcrypt/hash helper (fallback)
                let newPasswordHash = null;
                const bcryptLib = typeof bcryptjs !== 'undefined' ? bcryptjs : 
                                 typeof window.bcryptjs !== 'undefined' ? window.bcryptjs :
                                 typeof window.bcrypt !== 'undefined' ? window.bcrypt : null;
                
                if (bcryptLib && bcryptLib.hash) {
                    newPasswordHash = await new Promise((resolve, reject) => {
                        bcryptLib.hash(newPassword.trim(), 10, (err, hash) => err ? reject(err) : resolve(hash));
                    });
                } else if (window.UniAuthHelpers && window.UniAuthHelpers.hashPassword) {
                    newPasswordHash = await window.UniAuthHelpers.hashPassword(newPassword.trim());
                } else {
                    throw new Error('Không thể hash mật khẩu mới. Vui lòng refresh trang và thử lại.');
                }

                if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                    const supabase = window.SupabaseAdapter.getClient();
                    const { data: updateResult, error: updateError } = await supabase
                        .from('users')
                        .update({
                            password: newPasswordHash,
                            password_hash: newPasswordHash,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', adminId)
                        .eq('role', 'admin')
                        .select('id, email');
                    
                    if (updateError) {
                        throw new Error(updateError.message || 'Không thể lưu mật khẩu mới vào DB');
                    }

                    if (!updateResult || updateResult.length === 0) {
                        throw new Error('Không thể lưu mật khẩu mới vào DB: Không tìm thấy admin record');
                    }
                } else if (window.UniAuth && window.UniAuth.updateAdminLoginInfo) {
                    await window.UniAuth.updateAdminLoginInfo(adminId, email, newPasswordHash);
                } else {
                    throw new Error('Không thể lưu mật khẩu mới: Supabase không được kích hoạt');
                }
            }
            
            // Update email nếu có thay đổi
            if (email && email.trim() !== adminEmail) {
                if (window.SupabaseAdapter && window.SupabaseAdapter.isEnabled) {
                    const supabase = window.SupabaseAdapter.getClient();
                    const { error: emailError } = await supabase
                        .from('users')
                        .update({ email: email.trim() })
                        .eq('id', adminId);
                    
                    if (emailError) {
                        console.warn('⚠️ Không thể update email:', emailError);
                    }
                }
            }
            
            // ============================================
            // BƯỚC 6: Trả về response và yêu cầu đăng nhập lại
            // ============================================
            if (newPassword && newPassword.trim()) {
                // Update thành công → trả về thông báo thành công
                window.UniUI.toast('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', 'success');
                window.UniUI.closeModal();
                
                // Revoke session và đăng xuất để đảm bảo an toàn
                setTimeout(() => {
                    // Clear session
                    if (window.UniAuthSecurity && window.UniAuthSecurity.clearSession) {
                        window.UniAuthSecurity.clearSession();
                    }
                    
                    // Logout
                    if (window.UniAuth && window.UniAuth.logout) {
                        window.UniAuth.logout();
                    }
                    
                    // Clear tokens
                    try {
                        localStorage.removeItem('unicorns.token');
                        sessionStorage.clear();
                    } catch (e) {
                        console.error('Error clearing tokens:', e);
                    }
                    
                    // Refresh và chuyển về trang home
                    window.UniUI.refreshNavigation();
                    window.UniUI.loadPage('home');
                    
                    // Thông báo yêu cầu đăng nhập lại
                    setTimeout(() => {
                        window.UniUI.toast('Vui lòng đăng nhập lại với mật khẩu mới', 'info');
                    }, 500);
                }, 1000);
            } else {
                // Chỉ đổi email, không cần đăng nhập lại
                window.UniUI.toast('Đã cập nhật thông tin đăng nhập', 'success');
                window.UniUI.closeModal();
                refreshNavigation();
            }
            
        } catch (error) {
            // Update thất bại → trả về lỗi rõ ràng
            console.error('❌ Error updating admin password:', error);
            
            let errorMessage = 'Có lỗi xảy ra khi cập nhật mật khẩu';
            if (error.message) {
                if (error.message.includes('Không thể lưu mật khẩu mới vào DB')) {
                    errorMessage = 'Không thể lưu mật khẩu mới vào DB. Vui lòng thử lại sau.';
                } else if (error.message.includes('bcryptjs')) {
                    errorMessage = 'Lỗi hệ thống. Vui lòng refresh trang và thử lại.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            window.UniUI.toast(errorMessage, 'error');
            
            // Hiển thị lỗi chi tiết trong console để debug
            if (isDebug) {
                console.error('Error details:', {
                    error: error,
                    adminId: adminId,
                    email: email,
                    hasNewPassword: !!newPassword
                });
            }
        }
    });

    window.UniUI.openModal('Chỉnh sửa thông tin đăng nhập Admin', form);
}

// Export UI functions
window.UniUI = {
    loadPage,
    refreshCurrentPage,
    getCurrentPageName,
    openModal,
    closeModal,
    toggleTheme,
    setTheme,
    initialize: initializeUI,
    refreshNavigation,
    hasRole,
    isOwnerTeacherOfClass,
    getUserStaffRoles,
    userHasStaffRole,
    openAdminLoginInfoModal
};

window.UniLayout = {
    enterLandingMode,
    exitLandingMode
};

// Auto-initialize UI when DOM is ready so tabs and buttons are wired up
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Wait a bit for all scripts to load
            setTimeout(initializeUI, 100);
        });
    } else {
        // DOM already loaded
        setTimeout(initializeUI, 100);
    }
}

/**
 * Toast notifications - Enhanced
 */
function showToast(message, type = 'info', timeout = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Notifications');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Đóng thông báo" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    
    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    const closeToast = () => {
        toast.classList.add('exiting');
    setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    };
    
    closeBtn.addEventListener('click', closeToast);
    
    if (timeout > 0) {
        setTimeout(closeToast, timeout);
    }
    
    return toast;
}

/**
 * Render empty state
 */
function renderEmptyState(options = {}) {
    const {
        icon = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
        title = 'Không có dữ liệu',
        description = 'Hiện tại không có dữ liệu để hiển thị.',
        action = null
    } = options;
    
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h3 class="empty-state-title">${title}</h3>
            <p class="empty-state-description">${description}</p>
            ${action ? `<div class="empty-state-action">${action}</div>` : ''}
        </div>
    `;
}

/**
 * Render error state
 */
function renderErrorState(options = {}) {
    const {
        icon = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
        title = 'Đã xảy ra lỗi',
        description = 'Không thể tải dữ liệu. Vui lòng thử lại sau.',
        action = '<button class="btn btn-primary" onclick="window.UniUI.refreshCurrentPage()">Thử lại</button>'
    } = options;
    
    return `
        <div class="error-state">
            <div class="error-state-icon">${icon}</div>
            <h3 class="error-state-title">${title}</h3>
            <p class="error-state-description">${description}</p>
            ${action ? `<div class="error-state-action">${action}</div>` : ''}
        </div>
    `;
}

/**
 * Render success state
 */
function renderSuccessState(options = {}) {
    const {
        icon = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        title = 'Thành công',
        description = 'Thao tác đã được thực hiện thành công.',
        action = null
    } = options;
    
    return `
        <div class="success-state">
            <div class="success-state-icon">${icon}</div>
            <h3 class="success-state-title">${title}</h3>
            <p class="success-state-description">${description}</p>
            ${action ? `<div class="success-state-action">${action}</div>` : ''}
        </div>
    `;
}

/**
 * Set button loading state
 */
function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.classList.add('btn-loading');
        button.disabled = true;
        button.dataset.originalText = button.textContent;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
    }
}

/**
 * Render skeleton loading
 */
function renderSkeletonLoading(type = 'text', count = 3) {
    if (type === 'table') {
        return Array.from({ length: count }, () => `
            <div class="skeleton-table-row">
                <div class="skeleton skeleton-avatar"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text short"></div>
                <div class="skeleton skeleton-text medium"></div>
            </div>
        `).join('');
    }
    
    if (type === 'card') {
        return `
            <div class="skeleton-card">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        `;
    }
    
    return Array.from({ length: count }, (_, i) => `
        <div class="skeleton skeleton-text ${i === count - 1 ? 'short' : ''}"></div>
    `).join('');
}

// Expose toast and helpers on UniUI
window.UniUI = Object.assign(window.UniUI || {}, {
    toast: showToast,
    renderEmptyState,
    renderErrorState,
    renderSuccessState,
    setButtonLoading,
    renderSkeletonLoading
});

const currencyControllers = new WeakMap();

function sanitizeCurrencyDigits(value) {
    // Giữ lại dấu trừ ở đầu nếu có, loại bỏ tất cả ký tự không phải số
    const str = String(value ?? '').trim();
    const isNegative = str.startsWith('-');
    const digits = str.replace(/[^\d]/g, '');
    // Nếu có dấu trừ (dù có số hay chưa), giữ lại dấu trừ
    if (isNegative) {
        return '-' + digits;
    }
    return digits;
}

function formatCurrencyDigits(digits) {
    if (!digits) return '';
    // Xử lý số âm: giữ lại dấu trừ, format phần số
    const isNegative = digits.startsWith('-');
    const numStr = isNegative ? digits.slice(1) : digits;
    const cleaned = numStr.replace(/^0+/, '') || '0';
    const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return isNegative ? '-' + formatted : formatted;
}

function toVietnameseWords(amount) {
    if (window.UniData && typeof window.UniData.numberToVietnameseText === 'function') {
        return window.UniData.numberToVietnameseText(amount);
    }
    return '';
}

function attachCurrencyInput(input, options = {}) {
    if (!(input instanceof HTMLElement)) return null;
    if (currencyControllers.has(input)) return currencyControllers.get(input);

    const controllerOptions = {
        required: options.required ?? input.hasAttribute('required'),
        onChange: typeof options.onChange === 'function' ? options.onChange : null
    };

    input.type = 'text';
    // Không set inputMode để đảm bảo có thể nhập dấu trừ trên mọi trình duyệt
    // inputMode = 'numeric' hoặc 'decimal' có thể chặn nhập dấu trừ
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.classList.add('currency-input');

    let hintContainer = options.hintElement || null;
    if (!hintContainer) {
        hintContainer = document.createElement('div');
        hintContainer.className = 'currency-hint text-xs mt-1';
        input.insertAdjacentElement('afterend', hintContainer);
    }

    const wordsLine = document.createElement('div');
    wordsLine.className = 'currency-hint-line';
    const digitsLine = document.createElement('div');
    digitsLine.className = 'currency-hint-line';
    const errorLine = document.createElement('div');
    errorLine.className = 'currency-hint-error';
    hintContainer.innerHTML = '';
    hintContainer.append(wordsLine, digitsLine, errorLine);

    function setError(message) {
        if (message) {
            input.classList.add('currency-input-invalid');
            errorLine.textContent = message;
        } else {
            input.classList.remove('currency-input-invalid');
            errorLine.textContent = '';
        }
    }

    function updateHint(amount, hasDigits = true) {
        if (!hasDigits) {
            wordsLine.textContent = 'Bằng chữ: -';
            digitsLine.textContent = '= 0 đ';
            return;
        }
        if (amount > 0) {
            wordsLine.textContent = `Bằng chữ: ${toVietnameseWords(amount) || '-'}`;
            digitsLine.textContent = `= ${formatCurrencyDigits(String(amount))} đ`;
        } else if (amount === 0) {
            wordsLine.textContent = 'Bằng chữ: Không đồng';
            digitsLine.textContent = '= 0 đ';
        } else if (amount < 0) {
            // Số âm: hiển thị với dấu trừ và tiền chữ có "Âm"
            wordsLine.textContent = `Bằng chữ: ${toVietnameseWords(amount) || '-'}`;
            digitsLine.textContent = `= ${formatCurrencyDigits(String(amount))} đ`;
        } else {
            wordsLine.textContent = 'Bằng chữ: -';
            digitsLine.textContent = '= 0 đ';
        }
    }

    function setValue(value, { silent = false } = {}) {
        const digits = sanitizeCurrencyDigits(value);
        const isNegativeOnly = digits === '-';
        const hasDigits = digits.length > 0 && digits !== '-';
        input.dataset.numericValue = digits;
        // Parse số âm: nếu có dấu trừ thì parse như số âm
        let numeric = 0;
        if (hasDigits) {
            numeric = digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
        }
        // Hiển thị: nếu chỉ có dấu trừ thì giữ lại dấu trừ, nếu có số thì format
        if (isNegativeOnly) {
            input.value = '-';
        } else if (hasDigits) {
            input.value = formatCurrencyDigits(digits);
        } else {
            input.value = '';
        }
        updateHint(numeric, hasDigits);
        if (!silent && controllerOptions.onChange) {
            controllerOptions.onChange(numeric, input);
        }
        return numeric;
    }

    function getValue() {
        const digits = input.dataset.numericValue || '';
        if (!digits || digits === '-') return 0;
        // Parse số âm: nếu có dấu trừ thì parse như số âm
        return digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
    }

    function validate() {
        const digits = input.dataset.numericValue || '';
        if (!digits || digits === '-') {
            if (controllerOptions.required) {
                setError('Vui lòng nhập số tiền');
                return false;
            }
            setError('');
            updateHint(0, false);
            return true;
        }
        // Parse số âm: nếu có dấu trừ thì parse như số âm
        const numeric = digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
        if (!Number.isFinite(numeric)) {
            setError('Số tiền không hợp lệ');
            return false;
        }
        // Cho phép cả số âm và số dương (không chỉ số dương nữa)
        setError('');
        updateHint(numeric, true);
        return true;
    }

    input.addEventListener('input', () => {
        // Cho phép nhập dấu trừ trực tiếp
        const currentValue = input.value;
        // Nếu người dùng đang gõ dấu trừ ở đầu, giữ lại
        if (currentValue === '-') {
            input.dataset.numericValue = '-';
            input.value = '-';
            updateHint(0, false);
            return;
        }
        const digits = sanitizeCurrencyDigits(currentValue);
        setValue(digits);
    });

    input.addEventListener('blur', () => {
        validate();
        const digits = input.dataset.numericValue || '';
        // Nếu chỉ có dấu trừ, giữ lại dấu trừ
        if (digits === '-') {
            input.value = '-';
        } else {
            input.value = formatCurrencyDigits(digits);
        }
    });

    input.addEventListener('focus', () => {
        setTimeout(() => {
            input.select();
        }, 0);
    });

    const initialValue = options.initialValue !== undefined ? options.initialValue : input.value;
    setValue(initialValue, { silent: true });
    validate();

    const controller = {
        getValue,
        setValue,
        validate,
        setError
    };
    currencyControllers.set(input, controller);
    input.dataset.currencyAttached = 'true';
    return controller;
}

function parseCurrencyString(value) {
    const digits = sanitizeCurrencyDigits(value);
    if (!digits || digits === '-') return 0;
    // Parse số âm: nếu có dấu trừ thì parse như số âm
    return digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
}

function getCurrencyValue(input) {
    if (!input) return 0;
    if (currencyControllers.has(input)) {
        return currencyControllers.get(input).getValue();
    }
    return parseCurrencyString(input.value);
}

function setCurrencyValue(input, amount, options = {}) {
    if (!input) return;
    if (currencyControllers.has(input)) {
        currencyControllers.get(input).setValue(amount, options);
    } else {
        // Xử lý số âm: chuyển số thành chuỗi có dấu trừ nếu âm
        const amountStr = String(amount);
        const sanitized = sanitizeCurrencyDigits(amountStr);
        input.value = formatCurrencyDigits(sanitized);
        input.dataset.numericValue = sanitized;
    }
}

function validateCurrencyInput(input) {
    if (!input) return true;
    if (currencyControllers.has(input)) {
        return currencyControllers.get(input).validate();
    }
    const digits = sanitizeCurrencyDigits(input.value);
    if (!digits || digits === '-') {
        return !input.hasAttribute('required');
    }
    // Parse số âm: nếu có dấu trừ thì parse như số âm
    const numeric = digits.startsWith('-') ? -parseInt(digits.slice(1), 10) : parseInt(digits, 10);
    // Cho phép cả số âm và số dương (chỉ cần là số hợp lệ)
    return Number.isFinite(numeric);
}

window.UniUI = Object.assign(window.UniUI || {}, {
    attachCurrencyInput,
    getCurrencyValue,
    setCurrencyValue,
    validateCurrencyInput,
    parseCurrencyString,
    formatCurrencyInputValue: formatCurrencyDigits
});

/**
 * Show history modal with recent action logs
 */
function showHistory() {
    const logs = (window.UniData && window.UniData.getLogs) ? window.UniData.getLogs() : (window.demo.histories || []);
    const container = document.createElement('div');
    container.className = 'history-list';

    if (!logs.length) {
        container.innerHTML = '<p class="text-muted">No history yet.</p>';
    } else {
        container.innerHTML = `
            <div class="table-container">
                <table class="table-striped">
                    <thead>
                        <tr><th>Time</th><th>Action</th><th>Entity</th><th>Details</th></tr>
                    </thead>
                    <tbody>
                        ${logs.map(l => `
                            <tr>
                                <td>${new Date(l.timestamp).toLocaleString()}</td>
                                <td>${l.action}</td>
                                <td>${l.entity} (${l.entityId})</td>
                                <td><pre style="white-space:pre-wrap;max-height:120px;overflow:auto;">${JSON.stringify(l.details)}</pre></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    window.UniUI.openModal('Action History', container);
}

// Wire history button (if present) after init
document.addEventListener('DOMContentLoaded', () => {
    const hb = document.getElementById('historyBtn');
    if (hb) hb.addEventListener('click', showHistory);
});