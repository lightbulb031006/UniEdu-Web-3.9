/**
 * lesson-plans.js - Lesson Plans management page
 * UI/UX: Tối giản, hiện đại, đồng bộ với hệ thống
 */

function formatCurrency(value) {
    return window.UniData?.formatCurrency ? window.UniData.formatCurrency(value || 0) : `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function formatDate(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleDateString('vi-VN');
    } catch {
        return value;
    }
}

// Helper function to map old level values to new ones
function mapOldLevelToNew(level) {
    if (!level) return null;
    const mapping = {
        'Basic': 'Level 1',
        'Intermediate': 'Level 3',
        'Advanced': 'Level 5'
    };
    return mapping[level] || level;
}

// Helper function to normalize level (map old to new if needed, otherwise return as is)
function normalizeLevel(level) {
    if (!level) return null;
    // If it's already in new format (Level 0-5), return as is
    if (/^Level [0-5]$/.test(level)) {
        return level;
    }
    // Otherwise, map old format to new
    return mapOldLevelToNew(level);
}

// Helper function to get display level (for showing in UI)
function getDisplayLevel(level) {
    const normalized = normalizeLevel(level);
    return normalized || '-';
}

// Helper function to format number with thousand separators
function formatNumberWithDots(value) {
    const num = parseInt(value.toString().replace(/\./g, ''), 10) || 0;
    return num.toLocaleString('vi-VN');
}

// Helper function to convert number to Vietnamese words
const VIETNAMESE_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readTriple(number, full) {
    const hundred = Math.floor(number / 100);
    const ten = Math.floor((number % 100) / 10);
    const unit = number % 10;
    let words = '';

    if (hundred > 0 || full) {
        words += `${hundred > 0 ? VIETNAMESE_DIGITS[hundred] : 'không'} trăm`;
    }

    if (ten > 1) {
        words += `${words ? ' ' : ''}${VIETNAMESE_DIGITS[ten]} mươi`;
        if (unit === 1) {
            words += ' mốt';
        } else if (unit === 4) {
            words += ' tư';
        } else if (unit === 5) {
            words += ' lăm';
        } else if (unit > 0) {
            words += ` ${VIETNAMESE_DIGITS[unit]}`;
        }
    } else if (ten === 1) {
        words += `${words ? ' ' : ''}mười`;
        if (unit === 5) {
            words += ' lăm';
        } else if (unit > 0) {
            words += ` ${VIETNAMESE_DIGITS[unit]}`;
        }
    } else if (unit > 0) {
        if (words) {
            words += ' lẻ';
        }
        words += `${words ? ' ' : ''}${unit === 5 && words ? 'năm' : VIETNAMESE_DIGITS[unit]}`;
    }

    return words.trim();
}

function numberToVietnameseWords(value) {
    const amount = Math.max(0, parseInt(value.toString().replace(/\./g, ''), 10) || 0);
    if (amount === 0) return 'Không đồng';

    const units = ['', ' nghìn', ' triệu', ' tỷ', ' nghìn tỷ', ' triệu tỷ'];
    let remaining = amount;
    let index = 0;
    let words = '';

    while (remaining > 0 && index < units.length) {
        const chunk = remaining % 1000;
        if (chunk > 0) {
            const chunkWords = readTriple(chunk, index > 0 && chunk < 100);
            words = `${chunkWords}${units[index]}${words ? ' ' + words : ''}`.trim();
        }
        remaining = Math.floor(remaining / 1000);
        index += 1;
    }

    const result = words.trim();
    if (!result) return 'Không đồng';
    return `${result.charAt(0).toUpperCase()}${result.slice(1)} đồng`;
}

// Find prefix matches for lesson titles (checks if input is a prefix of existing titles)
function findPrefixMatches(input, field, excludeId = null) {
    if (!input || !field) return [];
    
    const normalizedInput = input.trim().toLowerCase();
    if (!normalizedInput) return [];
    
    const allOutputs = window.demo.lessonOutputs || [];
    const matches = [];
    
    allOutputs.forEach(output => {
        // Skip the current output if editing
        if (excludeId && output.id === excludeId) return;
        
        let isMatch = false;
        
        if (field === 'title') {
            // Check if input is a prefix of lesson name
            if (output.lessonName) {
                const normalizedName = output.lessonName.trim().toLowerCase();
                if (normalizedName.startsWith(normalizedInput)) {
                    isMatch = true;
                }
            }
            // Also check if input is a prefix of original title
            if (output.originalTitle) {
                const normalizedOriginal = output.originalTitle.trim().toLowerCase();
                if (normalizedOriginal.startsWith(normalizedInput)) {
                    isMatch = true;
                }
            }
        } else if (field === 'originalTitle') {
            // Check if input is a prefix of original title
            if (output.originalTitle) {
                const normalizedOriginal = output.originalTitle.trim().toLowerCase();
                if (normalizedOriginal.startsWith(normalizedInput)) {
                    isMatch = true;
                }
            }
            // Also check if input is a prefix of lesson name
            if (output.lessonName) {
                const normalizedName = output.lessonName.trim().toLowerCase();
                if (normalizedName.startsWith(normalizedInput)) {
                    isMatch = true;
                }
            }
        }
        
        if (isMatch) {
            matches.push({
                title: output.lessonName || '-',
                originalTitle: output.originalTitle || '-',
                level: getDisplayLevel(output.level),
                tag: output.tag || '-',
                createdAt: output.createdAt || output.date || '-'
            });
        }
    });
    
    return matches;
}

// Render prefix match warning and summary
function renderPrefixMatchWarning(matches) {
    if (!matches || matches.length === 0) {
        return '';
    }
    
    const warningText = '⚠️ Có bài trùng tiền tố tên bài hoặc tên gốc';
    
    const matchesHtml = matches.map(match => `
        <div style="border: 1px solid #fcd34d; background-color: #fef9c3; padding: var(--spacing-2); border-radius: var(--radius); margin-top: var(--spacing-2); font-size: 0.875rem; color: #374151;">
            <div style="display: flex; align-items: start; gap: var(--spacing-2);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; margin-top: 2px; color: #f59e0b;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div style="flex: 1;">
                    <div style="font-weight: 500; margin-bottom: var(--spacing-1);">${match.title}</div>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: var(--spacing-1) var(--spacing-2); font-size: 0.8125rem;">
                        <span style="color: #6b7280;">Tên gốc:</span>
                        <span>${match.originalTitle}</span>
                        <span style="color: #6b7280;">Level:</span>
                        <span>${match.level}</span>
                        <span style="color: #6b7280;">Tag:</span>
                        <span>${match.tag}</span>
                        <span style="color: #6b7280;">Ngày tạo:</span>
                        <span>${formatDate(match.createdAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    return `
        <div style="margin-top: var(--spacing-2);">
            <div style="color: #d97706; font-size: 0.875rem; font-weight: 500; margin-bottom: var(--spacing-1);">
                ${warningText}
            </div>
            ${matchesHtml}
        </div>
    `;
}

// Setup prefix match checking for title inputs
function setupDuplicateCheck(excludeId = null) {
    const titleInput = document.querySelector('#outputLessonName');
    const originalTitleInput = document.querySelector('#outputOriginalTitle');
    const titleWarning = document.querySelector('#duplicateTitleWarning');
    const originalTitleWarning = document.querySelector('#duplicateOriginalTitleWarning');
    
    if (!titleInput || !originalTitleInput) return;
    
    const checkPrefixMatches = () => {
        const title = titleInput.value.trim();
        const originalTitle = originalTitleInput.value.trim();
        
        // Check title prefix matches
        if (title) {
            const titleMatches = findPrefixMatches(title, 'title', excludeId);
            if (titleMatches.length > 0 && titleWarning) {
                titleWarning.innerHTML = renderPrefixMatchWarning(titleMatches);
                titleWarning.style.display = 'block';
            } else if (titleWarning) {
                titleWarning.style.display = 'none';
            }
        } else if (titleWarning) {
            titleWarning.style.display = 'none';
        }
        
        // Check original title prefix matches
        if (originalTitle) {
            const originalMatches = findPrefixMatches(originalTitle, 'originalTitle', excludeId);
            if (originalMatches.length > 0 && originalTitleWarning) {
                originalTitleWarning.innerHTML = renderPrefixMatchWarning(originalMatches);
                originalTitleWarning.style.display = 'block';
            } else if (originalTitleWarning) {
                originalTitleWarning.style.display = 'none';
            }
        } else if (originalTitleWarning) {
            originalTitleWarning.style.display = 'none';
        }
    };
    
    titleInput.addEventListener('input', checkPrefixMatches);
    titleInput.addEventListener('blur', checkPrefixMatches);
    originalTitleInput.addEventListener('input', checkPrefixMatches);
    originalTitleInput.addEventListener('blur', checkPrefixMatches);
}

// Setup cost input with auto formatting and preview
function setupCostInput(input, preview) {
    if (!input || !preview) return;

    // Format input value on input/change
    const formatInput = (e) => {
        const value = e.target.value.replace(/[^\d]/g, '');
        if (value) {
            const formatted = formatNumberWithDots(value);
            e.target.value = formatted;
        } else {
            e.target.value = '';
        }
        updatePreview();
    };

    // Update preview display
    const updatePreview = () => {
        const numericValue = parseInt(input.value.replace(/\./g, ''), 10) || 0;
        const formatted = formatCurrency(numericValue);
        const words = numberToVietnameseWords(numericValue);
        preview.innerHTML = `
            <div style="margin-top: var(--spacing-1); font-size: 0.875rem;">
                <div style="font-weight: 500; color: var(--text);">${formatted}</div>
                <div style="color: var(--muted); margin-top: 2px;">${words}</div>
            </div>
        `;
    };

    input.addEventListener('input', formatInput);
    input.addEventListener('change', formatInput);
    input.addEventListener('blur', () => {
        const value = input.value.replace(/\./g, '');
        if (value) {
            input.value = formatNumberWithDots(value);
        }
    });

    // Initial preview
    updatePreview();
}

function copyToClipboard(text, successMessage = 'Đã sao chép') {
    if (!text) return;
    const fallbackCopy = () => {
        const tempInput = document.createElement('textarea');
        tempInput.value = text;
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.focus();
        tempInput.select();
        try {
            document.execCommand('copy');
            window.UniUI?.toast?.(successMessage, 'success');
        } catch (err) {
            console.error('Copy failed', err);
            window.UniUI?.toast?.('Không thể sao chép', 'error');
        }
        document.body.removeChild(tempInput);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => window.UniUI?.toast?.(successMessage, 'success'))
            .catch(() => fallbackCopy());
    } else {
        fallbackCopy();
    }
}

// Helper function to save tab to localStorage
function saveLessonPlansTab(tab) {
    try {
        localStorage.setItem('lessonPlansActiveTab', tab);
    } catch (e) {
        console.warn('Failed to save tab to localStorage:', e);
    }
}

// Helper function to get saved tab from localStorage
function getSavedLessonPlansTab() {
    try {
        const saved = localStorage.getItem('lessonPlansActiveTab');
        if (saved === 'overview' || saved === 'tasks' || saved === 'exercises') {
            return saved;
        }
    } catch (e) {
        console.warn('Failed to read tab from localStorage:', e);
    }
    return 'overview';
}

// Helper function to get current active tab
function getCurrentLessonPlansTab() {
    const main = document.querySelector('#main-content');
    if (!main) {
        // If DOM not ready, try to get from localStorage
        return getSavedLessonPlansTab();
    }
    
    const activeTab = main.querySelector('.lesson-plan-tab.active');
    if (activeTab) {
        const tab = activeTab.dataset.tab || 'overview';
        // Save to localStorage when found
        saveLessonPlansTab(tab);
        return tab;
    }
    
    // Fallback: check which panel is visible
    const overviewPanel = main.querySelector('#tab-overview');
    const tasksPanel = main.querySelector('#tab-tasks');
    if (tasksPanel && tasksPanel.style.display !== 'none') {
        saveLessonPlansTab('tasks');
        return 'tasks';
    }
    
    // If nothing found, try localStorage
    return getSavedLessonPlansTab();
}

async function renderLessonPlans(activeTab = null) {
    const main = document.querySelector('#main-content');
    if (!main) return;

    // Initialize listeners and try optimistic loading
    if (!window.__lessonPlansListenersInitialized) {
        window.UniData?.initPageListeners?.('lesson-plans', renderLessonPlans, ['lessonResources', 'lessonTasks', 'lessonOutputs', 'lessonTopics', 'lessonTopicLinks']);
        window.__lessonPlansListenersInitialized = true;
    }

    // Optimistic loading: try to load from cache immediately
    // Check if window.demo is empty OR if critical data is missing (lessonResources, lessonTasks, lessonOutputs, lessonTopics, lessonTopicLinks)
    const hasWindowDemo = window.demo && Object.keys(window.demo).length > 0;
    const hasLessonResources = Array.isArray(window.demo?.lessonResources);
    const hasLessonTasks = Array.isArray(window.demo?.lessonTasks);
    const hasLessonOutputs = Array.isArray(window.demo?.lessonOutputs);
    const hasLessonTopics = Array.isArray(window.demo?.lessonTopics);
    const hasLessonTopicLinks = Array.isArray(window.demo?.lessonTopicLinks);
    const needsCacheLoad = !hasWindowDemo || !hasLessonResources || !hasLessonTasks || !hasLessonOutputs || !hasLessonTopics || !hasLessonTopicLinks;
    
    // Reduced logging for performance - only log if cache load is needed
    if (needsCacheLoad) {
        console.log(`[renderLessonPlans:Cache] Cache check - needs load:`, {
            timestamp: Date.now(),
            hasWindowDemo,
            hasLessonResources,
            hasLessonTasks,
            hasLessonOutputs,
            hasLessonTopics,
            hasLessonTopicLinks,
            lessonResourcesCount: Array.isArray(window.demo?.lessonResources) ? window.demo.lessonResources.length : 0,
            lessonTasksCount: Array.isArray(window.demo?.lessonTasks) ? window.demo.lessonTasks.length : 0,
            lessonOutputsCount: Array.isArray(window.demo?.lessonOutputs) ? window.demo.lessonOutputs.length : 0,
            lessonTopicsCount: Array.isArray(window.demo?.lessonTopics) ? window.demo.lessonTopics.length : 0,
            lessonTopicLinksCount: Array.isArray(window.demo?.lessonTopicLinks) ? window.demo.lessonTopicLinks.length : 0
        });
        
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            // Hide spinner immediately when cache loads
            if (window.UniData && typeof window.UniData.hideSpinnerIfLoaded === 'function') {
                window.UniData.hideSpinnerIfLoaded();
            }
            setTimeout(() => renderLessonPlans(activeTab), 10);
            return;
        } else {
            main.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            setTimeout(() => renderLessonPlans(activeTab), 120);
            return;
        }
    }
    // Cache check passed - no logging needed for performance

    // If activeTab is not provided, try to get from localStorage first, then current tab, or default to 'overview'
    if (activeTab === null) {
        // Try localStorage first (for page refresh)
        activeTab = getSavedLessonPlansTab();
        // If still null, try to get from current DOM
        if (!activeTab || activeTab === 'overview') {
            activeTab = getCurrentLessonPlansTab();
        }
    }
    
    // Ensure valid tab value
    if (activeTab !== 'overview' && activeTab !== 'tasks' && activeTab !== 'exercises') {
        activeTab = 'overview';
    }
    
    // Save to localStorage
    saveLessonPlansTab(activeTab);

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    const isAssistant = currentUser?.role === 'assistant';
    const assistantId = isAssistant ? currentUser.linkId : null;
    const hasAccountantRole = window.UniUI?.userHasStaffRole ? window.UniUI.userHasStaffRole('accountant') : false;
    const hasLessonPlanRole = window.UniUI?.userHasStaffRole ? window.UniUI.userHasStaffRole('lesson_plan') : false;
    
    // Get staff record for lesson_plan role to get their ID
    let lessonPlanStaffId = null;
    if (hasLessonPlanRole && currentUser) {
        // Find staff record in teachers array
        const teachers = window.demo?.teachers || [];
        let staffRecord = null;
        if (currentUser.linkId) {
            staffRecord = teachers.find(t => t.id === currentUser.linkId);
        }
        if (!staffRecord && currentUser.id) {
            staffRecord = teachers.find(t => t.userId === currentUser.id);
        }
        if (!staffRecord && currentUser.email) {
            staffRecord = teachers.find(t => t.gmail === currentUser.email);
        }
        if (staffRecord && staffRecord.id) {
            lessonPlanStaffId = staffRecord.id;
        }
    }

    // Ensure data exists
    if (!window.demo.lessonResources) window.demo.lessonResources = [];
    if (!window.demo.lessonTasks) window.demo.lessonTasks = [];
    if (!window.demo.lessonOutputs) window.demo.lessonOutputs = [];

    main.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Giáo Án</h2>
        </div>

        <div class="card" style="padding: 0; overflow: hidden;">
            <div class="lesson-plans-tabs">
                <button class="lesson-plan-tab ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview" aria-label="Tổng quan">
                    <div class="lesson-plan-tab-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            <path d="M8 7h8"></path>
                            <path d="M8 11h8"></path>
                            <path d="M8 15h4"></path>
                        </svg>
                    </div>
                    <span class="lesson-plan-tab-text">Tổng quan</span>
                </button>
                <button class="lesson-plan-tab ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks" aria-label="Công việc">
                    <div class="lesson-plan-tab-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                    </div>
                    <span class="lesson-plan-tab-text">Công việc</span>
                </button>
                <button class="lesson-plan-tab ${activeTab === 'exercises' ? 'active' : ''}" data-tab="exercises" aria-label="Bài Tập">
                    <div class="lesson-plan-tab-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <circle cx="12" cy="10" r="1.5"></circle>
                        </svg>
                    </div>
                    <span class="lesson-plan-tab-text">Bài Tập</span>
                </button>
                <div class="lesson-plan-tab-indicator" style="left: ${activeTab === 'overview' ? '0' : activeTab === 'tasks' ? '33.33%' : '66.66%'};"></div>
            </div>

            <section id="tab-overview" class="tab-panel ${activeTab === 'overview' ? 'active' : ''}" style="${activeTab === 'overview' ? '' : 'display: none;'}">
                ${renderOverviewTab(isAdmin, isAssistant, assistantId, hasLessonPlanRole)}
            </section>

            <section id="tab-tasks" class="tab-panel ${activeTab === 'tasks' ? 'active' : ''}" style="${activeTab === 'tasks' ? '' : 'display: none;'}">
                ${renderTasksTab(isAdmin, isAssistant, assistantId, hasAccountantRole, hasLessonPlanRole, lessonPlanStaffId)}
            </section>

            <section id="tab-exercises" class="tab-panel ${activeTab === 'exercises' ? 'active' : ''}" style="${activeTab === 'exercises' ? '' : 'display: none;'}">
                ${renderExercisesTab(isAdmin, isAssistant, assistantId)}
            </section>
        </div>
    `;

    // Tab switching with smooth indicator animation
    main.querySelectorAll('.lesson-plan-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            const tabsContainer = main.querySelector('.lesson-plans-tabs');
            const indicator = tabsContainer?.querySelector('.lesson-plan-tab-indicator');
            
            // Save tab to localStorage
            saveLessonPlansTab(tab);
            
            // Update active state
            main.querySelectorAll('.lesson-plan-tab').forEach(b => b.classList.remove('active'));
            main.querySelectorAll('.tab-panel').forEach(p => {
                p.classList.remove('active');
                p.style.display = 'none';
            });
            btn.classList.add('active');
            
            // Animate indicator
            if (indicator) {
                const tabIndex = Array.from(main.querySelectorAll('.lesson-plan-tab')).indexOf(btn);
                indicator.style.left = `${tabIndex * 33.33}%`;
            }
            
            // Show panel
            const panel = main.querySelector(`#tab-${tab}`);
            if (panel) {
                panel.classList.add('active');
                panel.style.display = '';
                panel.style.opacity = '0';
                panel.style.transition = 'opacity 0.2s ease-in-out';
                setTimeout(() => {
                    panel.style.opacity = '1';
                }, 10);
                
                // Re-initialize exercises tab if needed
                if (tab === 'exercises') {
                    attachExercisesListeners(isAdmin, isAssistant, assistantId);
                }
            }
        });
    });

    // Attach event listeners
    attachOverviewListeners(isAdmin, isAssistant, assistantId, hasLessonPlanRole);
    attachTasksListeners(isAdmin, isAssistant, assistantId, hasAccountantRole, hasLessonPlanRole, lessonPlanStaffId);
    
    // Attach exercises listeners if exercises tab is active
    if (activeTab === 'exercises') {
        attachExercisesListeners(isAdmin, isAssistant, assistantId);
    }
}

function renderOverviewTab(isAdmin, isAssistant, assistantId, hasLessonPlanRole = false) {
    // Get selected month from state or default to current month
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    window.LessonPlansMonthFilter = window.LessonPlansMonthFilter || {};
    const selectedMonth = window.LessonPlansMonthFilter.selectedMonth || currentMonth;
    const [selectedYear, selectedMonthNum] = selectedMonth.split('-');
    
    // Check loading states - similar to teacher list and bonuses
    const hasResources = Array.isArray(window.demo?.lessonResources);
    const hasTasks = Array.isArray(window.demo?.lessonTasks);
    const hasOutputs = Array.isArray(window.demo?.lessonOutputs);
    
    const resourcesCount = hasResources ? window.demo.lessonResources.length : 0;
    const tasksCount = hasTasks ? window.demo.lessonTasks.length : 0;
    const outputsCount = hasOutputs ? window.demo.lessonOutputs.length : 0;
    
    // Only show loading if we're actively loading from Supabase AND don't have cache data
    const hasResourcesCache = hasResources && resourcesCount > 0;
    const hasTasksCache = hasTasks && tasksCount > 0;
    const hasOutputsCache = hasOutputs && outputsCount > 0;
    
    const isActivelyLoading = window.__pendingDataChange;
    const isResourcesLoading = !hasResources && isActivelyLoading && !hasResourcesCache;
    const isTasksLoading = !hasTasks && isActivelyLoading && !hasTasksCache;
    const isOutputsLoading = !hasOutputs && isActivelyLoading && !hasOutputsCache;
    
    // Reduced logging for performance - only log if loading
    // if (isResourcesLoading || isTasksLoading || isOutputsLoading) {
    //     console.log(`[renderOverviewTab] Loading states:`, {...});
    // }
    
    const resources = isResourcesLoading ? [] : (window.demo.lessonResources || []);
    const allTasks = isTasksLoading ? [] : (window.demo.lessonTasks || []);
    const allOutputs = isOutputsLoading ? [] : (window.demo.lessonOutputs || []);
    
    // Filter tasks and outputs by month
    const filterByMonth = (item, monthKey) => {
        if (!item.createdAt && !item.date) return true; // Show items without date
        const itemDate = item.createdAt || item.date;
        if (!itemDate) return true;
        const itemMonth = itemDate.toString().slice(0, 7); // YYYY-MM format
        return itemMonth === monthKey;
    };
    
    const tasks = allTasks.filter(t => filterByMonth(t, selectedMonth));
    const outputs = allOutputs.filter(o => filterByMonth(o, selectedMonth));
    
    // Get staff with lesson_plan role instead of assistants
    const lessonPlanStaff = (window.demo.teachers || []).filter(t => {
        const roles = t.roles || [];
        return roles.includes('lesson_plan');
    });

    // Filter tasks and outputs for assistants
    const visibleTasks = isAssistant && assistantId 
        ? tasks.filter(t => t.assistantId === assistantId)
        : tasks;
    const visibleOutputs = isAssistant && assistantId
        ? outputs.filter(o => o.assistantId === assistantId)
        : outputs;

    return `
        <div class="overview-tab-content" style="display: flex; flex-direction: column; gap: var(--spacing-6);">
            <!-- Tài nguyên giáo án -->
            <div class="overview-section-card">
                <div class="overview-section-header">
                    <div class="overview-section-title">
                        <div class="overview-section-icon" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--text);">Tài nguyên giáo án</h3>
                            <p style="margin: 0; font-size: var(--font-size-xs); color: var(--muted); margin-top: 2px;">${resources.length} tài nguyên</p>
                        </div>
                    </div>
                    ${(isAdmin || hasLessonPlanRole) ? `
                        <button class="btn btn-primary btn-add-icon" id="addResourceBtn" title="Thêm tài nguyên">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <div class="table-container" style="margin-top: var(--spacing-4);">
                    <table class="table-striped overview-table">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Tiêu đề</th>
                                <th style="width: 10%;">Link</th>
                                <th style="width: 55%;">Tags</th>
                            </tr>
                        </thead>
                        <tbody id="resourcesTableBody">
                            ${isResourcesLoading ? `
                                ${Array(3).fill('').map(() => `
                                    <tr>
                                        <td><div class="skeleton-line" style="width: 80%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 60%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 70%;"></div></td>
                                    </tr>
                                `).join('')}
                            ` : resources.length > 0 ? resources.map(resource => `
                                <tr data-resource-id="${resource.id}" class="overview-table-row">
                                    <td>
                                        <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                            <strong style="color: var(--text); font-weight: 500;">${resource.title || '-'}</strong>
                                        </div>
                                    </td>
                                    <td>
                                        ${resource.resourceLink ? `
                                            <a href="${resource.resourceLink}" target="_blank" class="link-icon" rel="noopener noreferrer" title="${resource.resourceLink}" onclick="event.stopPropagation();">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);">
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                    <polyline points="15 3 21 3 21 9"></polyline>
                                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                                </svg>
                                            </a>
                                        ` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
                                    </td>
                                    <td style="position: relative;">
                                        <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-1); align-items: center;">
                                            ${Array.isArray(resource.tags) && resource.tags.length > 0 
                                                ? resource.tags.map(t => `<span class="badge badge-info" style="font-size: var(--font-size-xs); padding: 4px 8px;">${t}</span>`).join('') 
                                                : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
                                        </div>
                                        ${(isAdmin || hasLessonPlanRole) ? `
                                            <div class="row-delete-icon">
                                                <button class="btn-delete-icon" onclick="event.stopPropagation(); deleteResource('${resource.id}');" title="Xóa">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="3" class="overview-empty-state">
                                        <div style="padding: var(--spacing-8); text-align: center;">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; color: var(--muted); margin-bottom: var(--spacing-2);">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                            </svg>
                                            <p style="margin: 0; color: var(--muted); font-size: var(--font-size-sm);">Chưa có tài nguyên nào</p>
                                        </div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Phân công task -->
            <div class="overview-section-card">
                <div class="overview-section-header">
                    <div class="overview-section-title">
                        <div class="overview-section-icon" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: rgb(16, 185, 129);">
                                <path d="M9 11l3 3L22 4"></path>
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                            </svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--text);">Phân công task cho nhân sự</h3>
                            <p style="margin: 0; font-size: var(--font-size-xs); color: var(--muted); margin-top: 2px;">${visibleTasks.length} task</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                        <div class="session-month-nav" style="position: relative;">
                            <button type="button" class="session-month-btn" id="lessonPlansMonthPrev" title="Tháng trước">◀</button>
                            <button type="button" class="session-month-label-btn" id="lessonPlansMonthLabelBtn" title="Chọn tháng/năm">
                                <span class="session-month-label" id="lessonPlansMonthLabel">Tháng ${selectedMonthNum}/${selectedYear}</span>
                            </button>
                            <button type="button" class="session-month-btn" id="lessonPlansMonthNext" title="Tháng sau">▶</button>
                            <div id="lessonPlansMonthPopup" class="session-month-popup" style="display:none;">
                                <div class="session-month-popup-header">
                                    <button type="button" class="session-month-year-btn" id="lessonPlansYearPrev">‹</button>
                                    <span class="session-month-year-label" id="lessonPlansYearLabel">${selectedYear}</span>
                                    <button type="button" class="session-month-year-btn" id="lessonPlansYearNext">›</button>
                                </div>
                                <div class="session-month-grid">
                                    ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((label, idx) => {
                                        const val = String(idx + 1).padStart(2, '0');
                                        const isActive = val === selectedMonthNum;
                                        return `<button type="button" class="session-month-cell${isActive ? ' active' : ''}" data-month="${val}">${label}</button>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                        ${(isAdmin || hasLessonPlanRole) ? `
                        <button class="btn btn-primary btn-add-icon" id="addTaskBtn" title="Thêm task">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    ` : ''}
                    </div>
                </div>
                <div class="table-container" style="margin-top: var(--spacing-4);">
                    <table class="table-striped overview-table">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Tên bài</th>
                                <th style="width: 25%;">Người phụ trách</th>
                                <th style="width: 15%;">Deadline</th>
                                <th style="width: 25%;">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody id="tasksTableBody">
                            ${isTasksLoading ? `
                                ${Array(3).fill('').map(() => `
                                    <tr>
                                        <td><div class="skeleton-line" style="width: 80%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 60%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 50%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 40%;"></div></td>
                                    </tr>
                                `).join('')}
                            ` : visibleTasks.length > 0 ? visibleTasks.map(task => {
                                const staffMember = lessonPlanStaff.find(s => s.id === task.assistantId);
                                return `
                                    <tr data-task-id="${task.id}" class="overview-table-row">
                                        <td>
                                            <strong style="color: var(--text); font-weight: 500;">${task.title || '-'}</strong>
                                        </td>
                                        <td>
                                            ${staffMember ? `
                                                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="12" cy="7" r="4"></circle>
                                                    </svg>
                                                    <span style="font-size: var(--font-size-sm);">${staffMember.fullName || staffMember.name}</span>
                                                </div>
                                            ` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
                                        </td>
                                        <td>
                                            ${task.dueDate ? `
                                                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                    <span style="font-size: var(--font-size-sm);">${formatDate(task.dueDate)}</span>
                                                </div>
                                            ` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
                                        </td>
                                        <td style="position: relative;">
                                            <span class="badge ${
                                                task.status === 'completed' ? 'badge-success' : 
                                                task.status === 'in_progress' ? 'badge-info' : 
                                                task.status === 'cancelled' ? 'badge-muted' : 
                                                'badge-warning'
                                            }" style="font-size: var(--font-size-xs); padding: 4px 10px;">
                                                ${task.status === 'completed' ? 'Hoàn thành' : 
                                                  task.status === 'in_progress' ? 'Đang làm' : 
                                                  task.status === 'cancelled' ? 'Đã hủy' : 
                                                  'Chờ xử lý'}
                                            </span>
                                            ${isAdmin ? `
                                                <div class="row-delete-icon">
                                                    <button class="btn-delete-icon" onclick="event.stopPropagation(); deleteTask('${task.id}');" title="Xóa">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `;
                            }).join('') : `
                                <tr>
                                    <td colspan="4" class="overview-empty-state">
                                        <div style="padding: var(--spacing-8); text-align: center;">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; color: var(--muted); margin-bottom: var(--spacing-2);">
                                                <path d="M9 11l3 3L22 4"></path>
                                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                            </svg>
                                            <p style="margin: 0; color: var(--muted); font-size: var(--font-size-sm);">Chưa có task nào</p>
                                        </div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Danh sách bài đã hoàn thành -->
            <div class="overview-section-card">
                <div class="overview-section-header">
                    <div class="overview-section-title">
                        <div class="overview-section-icon" style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: rgb(139, 92, 246);">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--text);">Danh sách bài giáo án đã hoàn thành</h3>
                            <p style="margin: 0; font-size: var(--font-size-xs); color: var(--muted); margin-top: 2px;">${visibleOutputs.length} bài đã hoàn thành</p>
                        </div>
                    </div>
                </div>
                <div class="table-container" style="margin-top: var(--spacing-4);">
                    <table class="table-striped overview-table">
                        <thead>
                            <tr>
                                <th style="width: 40%;">Tên bài</th>
                                <th style="width: 30%;">Tag</th>
                                <th style="width: 30%;">Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${isOutputsLoading ? `
                                ${Array(5).fill('').map(() => `
                                    <tr>
                                        <td><div class="skeleton-line" style="width: 80%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 60%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 50%;"></div></td>
                                    </tr>
                                `).join('')}
                            ` : visibleOutputs.length > 0 ? visibleOutputs
                                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                                .slice(0, 10)
                                .map(output => `
                                <tr class="overview-table-row">
                                    <td>
                                        <strong style="color: var(--text); font-weight: 500;">${output.lessonName || '-'}</strong>
                                    </td>
                                    <td>
                                        ${output.tag ? `<span class="badge badge-info" style="font-size: var(--font-size-xs); padding: 4px 8px;">${output.tag}</span>` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
                                    </td>
                                    <td>
                                        <span class="badge" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.2); font-size: var(--font-size-xs); padding: 4px 10px; font-weight: 500;">
                                            ${getDisplayLevel(output.level)}
                                        </span>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="3" class="overview-empty-state">
                                        <div style="padding: var(--spacing-8); text-align: center;">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; color: var(--muted); margin-bottom: var(--spacing-2);">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                            <p style="margin: 0; color: var(--muted); font-size: var(--font-size-sm);">Chưa có bài nào</p>
                                        </div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderTasksTab(isAdmin, isAssistant, assistantId, hasAccountantRole = false, hasLessonPlanRole = false, lessonPlanStaffId = null) {
    // Check loading state - similar to teacher list and bonuses
    const hasOutputs = Array.isArray(window.demo?.lessonOutputs);
    const outputsCount = hasOutputs ? window.demo.lessonOutputs.length : 0;
    const hasOutputsCache = hasOutputs && outputsCount > 0;
    const isActivelyLoading = window.__pendingDataChange && !hasOutputsCache;
    const isOutputsLoading = !hasOutputs && isActivelyLoading;
    
    // Reduced logging for performance - only log if loading
    // if (isOutputsLoading) {
    //     console.log(`[renderTasksTab] Outputs loading state:`, {...});
    // }
    
    const allOutputs = isOutputsLoading ? [] : (window.demo.lessonOutputs || []);
    
    // Filter outputs for assistants
    const outputs = isAssistant && assistantId
        ? allOutputs.filter(o => o.assistantId === assistantId)
        : allOutputs;

    // Get unique tags
    const uniqueTags = [...new Set(outputs.map(o => o.tag).filter(Boolean))];

    return `
        <div>
            ${renderFilterControls(uniqueTags)}
            ${(isAdmin || isAssistant || hasLessonPlanRole) ? renderAddOutputForm() : ''}
            
            <!-- Table -->
            <div class="card">
                <div class="flex justify-between items-center mb-4" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-4);">
                    <h3 class="text-lg font-semibold" style="margin: 0; font-size: var(--font-size-lg); font-weight: 600;">Bài giáo án đã làm</h3>
                    <div class="session-month-nav" style="position: relative;">
                        <button type="button" class="session-month-btn" id="tasksMonthPrev" title="Tháng trước">◀</button>
                        <button type="button" class="session-month-label-btn" id="tasksMonthLabelBtn" title="Chọn tháng/năm">
                            <span class="session-month-label" id="tasksMonthLabel">Tháng ${(() => {
                                const currentDate = new Date();
                                const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                                window.TasksMonthFilter = window.TasksMonthFilter || {};
                                const selectedMonth = window.TasksMonthFilter.selectedMonth || currentMonth;
                                const [year, monthNum] = selectedMonth.split('-');
                                return `${monthNum}/${year}`;
                            })()}</span>
                        </button>
                        <button type="button" class="session-month-btn" id="tasksMonthNext" title="Tháng sau">▶</button>
                        <div id="tasksMonthPopup" class="session-month-popup" style="display:none;">
                            <div class="session-month-popup-header">
                                <button type="button" class="session-month-year-btn" id="tasksYearPrev">‹</button>
                                <span class="session-month-year-label" id="tasksYearLabel">${(() => {
                                    const currentDate = new Date();
                                    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                                    window.TasksMonthFilter = window.TasksMonthFilter || {};
                                    const selectedMonth = window.TasksMonthFilter.selectedMonth || currentMonth;
                                    return selectedMonth.split('-')[0];
                                })()}</span>
                                <button type="button" class="session-month-year-btn" id="tasksYearNext">›</button>
                            </div>
                            <div class="session-month-grid">
                                ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((label, idx) => {
                                    const val = String(idx + 1).padStart(2, '0');
                                    const currentDate = new Date();
                                    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                                    window.TasksMonthFilter = window.TasksMonthFilter || {};
                                    const selectedMonth = window.TasksMonthFilter.selectedMonth || currentMonth;
                                    const isActive = val === selectedMonth.split('-')[1];
                                    return `<button type="button" class="session-month-cell${isActive ? ' active' : ''}" data-month="${val}">${label}</button>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                    ${(isAdmin || isAssistant || hasAccountantRole) ? `
                        <div class="bulk-actions" id="bulkActions" style="display: none; align-items: center; gap: var(--spacing-2);">
                            <span class="selected-count" id="selectedCount" style="font-size: var(--font-size-sm); color: var(--muted); font-weight: 500;"></span>
                            <button type="button" class="btn btn-sm btn-primary" id="bulkUpdateStatusBtn" style="padding: 6px 12px; font-size: var(--font-size-sm);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                                Chuyển trạng thái thanh toán
                            </button>
                            <button type="button" class="btn btn-sm btn-outline" id="clearSelectionBtn" style="padding: 6px 12px; font-size: var(--font-size-sm);">
                                Bỏ chọn tất cả
                            </button>
                        </div>
                    ` : ''}
                </div>

                <div class="table-container" style="overflow-x: auto;">
                    <table class="table-striped" id="outputsTable" style="table-layout: fixed; width: 100%; min-width: 1000px;">
                        <thead>
                            <tr>
                                ${(isAdmin || isAssistant || hasAccountantRole) ? `
                                    <th style="width: 50px; min-width: 50px; padding: var(--spacing-2); text-align: center;">
                                        <input type="checkbox" id="selectAllCheckbox" class="table-checkbox" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--primary);">
                                    </th>
                                ` : ''}
                                <th style="width: 180px; min-width: 180px;">Tag</th>
                                <th style="width: 120px; min-width: 120px;">Level</th>
                                <th style="width: auto; min-width: 250px;">Tên bài</th>
                                <th style="width: 150px; min-width: 150px;">Trạng thái</th>
                                <th style="width: 200px; min-width: 200px;">Contest</th>
                                <th style="width: 120px; min-width: 120px;">Link</th>
                                ${(isAdmin || isAssistant || hasLessonPlanRole) ? '<th style="width: 50px; min-width: 50px; text-align: center;"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody id="outputsTableBody">
                            ${isOutputsLoading ? `
                                ${Array(5).fill('').map(() => `
                                    <tr>
                                        ${(isAdmin || isAssistant || hasAccountantRole) ? '<td><div class="skeleton-line" style="width: 20px; height: 20px; margin: 0 auto;"></div></td>' : ''}
                                        <td><div class="skeleton-line" style="width: 60%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 40%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 80%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 50%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 70%;"></div></td>
                                        <td><div class="skeleton-line" style="width: 60%;"></div></td>
                                        ${(isAdmin || isAssistant || hasLessonPlanRole) ? '<td><div class="skeleton-line" style="width: 30px; height: 30px; margin: 0 auto;"></div></td>' : ''}
                                    </tr>
                                `).join('')}
                            ` : renderOutputsTable(outputs, isAdmin, isAssistant, hasAccountantRole, hasLessonPlanRole)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// Initialize default topics if not exists
// Optimized: Use flag to avoid re-initializing if already done
function initializeDefaultTopics() {
    if (!window.demo.lessonTopics) window.demo.lessonTopics = [];
    
    // Check if all default topics already exist - early return for performance
    const defaultTopicIds = ['all', 'level-0', 'level-1', 'level-2', 'level-3', 'level-4', 'level-5'];
    const existingTopicIds = new Set(window.demo.lessonTopics.map(t => t.id));
    const allDefaultsExist = defaultTopicIds.every(id => existingTopicIds.has(id));
    
    if (allDefaultsExist) {
        // All default topics already exist, skip initialization
        return;
    }
    
    const defaultTopics = [
        { id: 'all', name: 'Tất cả', isDefault: true, level: null },
        { id: 'level-0', name: 'Level 0', isDefault: true, level: 0 },
        { id: 'level-1', name: 'Level 1', isDefault: true, level: 1 },
        { id: 'level-2', name: 'Level 2', isDefault: true, level: 2 },
        { id: 'level-3', name: 'Level 3', isDefault: true, level: 3 },
        { id: 'level-4', name: 'Level 4', isDefault: true, level: 4 },
        { id: 'level-5', name: 'Level 5', isDefault: true, level: 5 }
    ];
    
    let addedCount = 0;
    defaultTopics.forEach(topic => {
        if (!existingTopicIds.has(topic.id)) {
            window.demo.lessonTopics.push({
                ...topic,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            addedCount++;
        }
    });
}

// Clean up invalid lessonTopicLinks (orphaned links)
function cleanupInvalidTopicLinks() {
    const allLinks = window.demo.lessonTopicLinks || [];
    const allTopics = window.demo.lessonTopics || [];
    const allOutputs = window.demo.lessonOutputs || [];
    
    const invalidLinks = allLinks.filter(link => {
        const topicExists = allTopics.find(t => t.id === link.topicId);
        const outputExists = allOutputs.find(o => o.id === link.lessonOutputId);
        return !topicExists || !outputExists;
    });
    
    if (invalidLinks.length > 0) {
        console.log(`Cleaning up ${invalidLinks.length} invalid lessonTopicLinks`);
        
        // Get IDs of invalid links for database deletion
        const invalidLinkIds = invalidLinks.map(link => link.id).filter(Boolean);
        
        // Remove from local data
        const validLinks = allLinks.filter(link => {
            const topicExists = allTopics.find(t => t.id === link.topicId);
            const outputExists = allOutputs.find(o => o.id === link.lessonOutputId);
            return topicExists && outputExists;
        });
        window.demo.lessonTopicLinks = validLinks;
        
        // Sync deletion to database
        if (invalidLinkIds.length > 0 && window.UniData && window.UniData.save) {
            window.UniData.save({
                supabaseDeletes: {
                    lessonTopicLinks: invalidLinkIds
                }
            });
        }
    }
}

function renderExercisesTab(isAdmin, isAssistant, assistantId) {
    // Check loading states - similar to other sections
    const hasTopics = Array.isArray(window.demo?.lessonTopics);
    const hasTopicLinks = Array.isArray(window.demo?.lessonTopicLinks);
    const hasOutputs = Array.isArray(window.demo?.lessonOutputs);
    
    const topicsCount = hasTopics ? window.demo.lessonTopics.length : 0;
    const topicLinksCount = hasTopicLinks ? window.demo.lessonTopicLinks.length : 0;
    const outputsCount = hasOutputs ? window.demo.lessonOutputs.length : 0;
    
    // Only show loading if we're actively loading from Supabase AND don't have cache data
    const hasTopicsCache = hasTopics && topicsCount > 0;
    const hasTopicLinksCache = hasTopicLinks && topicLinksCount > 0;
    const hasOutputsCache = hasOutputs && outputsCount > 0;
    
    const isActivelyLoading = window.__pendingDataChange;
    const isTopicsLoading = !hasTopics && isActivelyLoading && !hasTopicsCache;
    const isTopicLinksLoading = !hasTopicLinks && isActivelyLoading && !hasTopicLinksCache;
    const isOutputsLoading = !hasOutputs && isActivelyLoading && !hasOutputsCache;
    
    // Reduced logging for performance - only log if loading or debugging needed
    // Uncomment for debugging:
    // console.log(`[renderExercisesTab] Loading states:`, {
    //     timestamp: Date.now(),
    //     hasTopics, topicsCount, hasTopicsCache, isTopicsLoading,
    //     hasTopicLinks, topicLinksCount, hasTopicLinksCache, isTopicLinksLoading,
    //     hasOutputs, outputsCount, hasOutputsCache, isOutputsLoading,
    //     pendingDataChange: window.__pendingDataChange
    // });
    
    // Initialize data
    if (!window.demo.lessonTopics) window.demo.lessonTopics = [];
    if (!window.demo.lessonTopicLinks) window.demo.lessonTopicLinks = [];
    if (!window.demo.lessonOutputs) window.demo.lessonOutputs = [];
    
    // Initialize default topics (optimized: early return if already initialized)
    initializeDefaultTopics();
    
    // Clean up invalid links (only if we have links to check)
    if (window.demo.lessonTopicLinks.length > 0 || window.demo.lessonOutputs.length > 0) {
    cleanupInvalidTopicLinks();
    }
    
    const allTopics = isTopicsLoading ? [] : (window.demo.lessonTopics || []);
    const allLinks = isTopicLinksLoading ? [] : (window.demo.lessonTopicLinks || []);
    const allOutputs = isOutputsLoading ? [] : (window.demo.lessonOutputs || []);
    
    // Get default topics and custom topics
    const defaultTopics = allTopics.filter(t => t.isDefault).sort((a, b) => {
        if (a.id === 'all') return -1;
        if (b.id === 'all') return 1;
        return (a.level || 0) - (b.level || 0);
    });
    const customTopics = allTopics.filter(t => !t.isDefault).sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
    );
    
    return `
        <div class="exercises-container" style="display: flex; gap: var(--spacing-4); height: calc(100vh - 300px); min-height: 500px;">
            <!-- Sidebar chuyên đề -->
            <div class="exercises-sidebar" style="width: 260px; flex-shrink: 0; background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); padding: var(--spacing-4); overflow-y: auto;">
                <div class="topic-list" id="topicList">
                    ${defaultTopics.map(topic => `
                        <div class="topic-item ${topic.id === 'all' ? 'active' : ''}" data-topic-id="${topic.id}" style="padding: var(--spacing-3) var(--spacing-3); margin-bottom: var(--spacing-1); border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; font-size: var(--font-size-sm); ${topic.id === 'all' ? 'background: linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%); color: var(--primary); font-weight: 600; border: 1px solid rgba(59, 130, 246, 0.2);' : 'color: var(--text); border: 1px solid transparent;'}">
                            ${topic.name}
                        </div>
                    `).join('')}
                    ${isTopicsLoading ? `
                        <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border);">
                            <div style="font-size: var(--font-size-xs); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--spacing-2); font-weight: 600;">Chuyên đề tùy chỉnh</div>
                            ${Array(3).fill('').map(() => `
                                <div class="skeleton-loading" style="padding: var(--spacing-3); margin-bottom: var(--spacing-1); border-radius: var(--radius);">
                                    <div class="skeleton-line" style="width: 70%; height: 16px;"></div>
                                </div>
                            `).join('')}
                        </div>
                    ` : customTopics.length > 0 ? `
                        <div style="margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border);">
                            <div style="font-size: var(--font-size-xs); color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--spacing-2); font-weight: 600;">Chuyên đề tùy chỉnh</div>
                            ${customTopics.map(topic => `
                                <div class="topic-item custom-topic" data-topic-id="${topic.id}" style="padding: var(--spacing-3) var(--spacing-3); margin-bottom: var(--spacing-1); border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: space-between; color: var(--text); border: 1px solid transparent;">
                                    <span style="flex: 1;">${topic.name}</span>
                                    ${isAdmin ? `
                                        <div class="topic-actions" style="display: flex; gap: var(--spacing-1); opacity: 0; transition: opacity 0.2s;">
                                            <button class="btn-icon edit-topic-btn" data-topic-id="${topic.id}" title="Sửa" style="width: 24px; height: 24px; padding: 0; cursor: pointer;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                            <button class="btn-icon delete-topic-btn" data-topic-id="${topic.id}" title="Xóa" style="width: 24px; height: 24px; padding: 0; color: var(--danger); cursor: pointer;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Danh sách bài -->
            <div class="exercises-content" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                ${(() => {
                    const allOutputs = window.demo.lessonOutputs || [];
                    const uniqueTags = [...new Set(allOutputs.map(o => o.tag).filter(Boolean))];
                    return renderFilterControls(uniqueTags);
                })()}
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-4); padding-bottom: var(--spacing-3); border-bottom: 1px solid var(--border);">
                    <h3 style="margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--text); display: flex; align-items: center; gap: var(--spacing-2);">
                        ${isAdmin ? `
                            <button class="btn-icon" id="addTopicBtn" title="Thêm chuyên đề" style="width: 32px; height: 32px; padding: 0; color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius); background: transparent; transition: all 0.2s ease;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                        ` : ''}
                        <span>Các bài đã làm</span>
                    </h3>
                </div>
                <div id="exercisesList" class="exercises-list" style="flex: 1; overflow-y: auto;">
                    <!-- Content will be loaded dynamically -->
                </div>
            </div>
        </div>
    `;
}

function renderFilterControls(uniqueTags) {
    const searchIcon = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
    `;

    return `
        <div class="card mb-4" style="padding: var(--spacing-4);">
            <div class="flex justify-between items-center" id="toggleFiltersBtn" style="cursor: pointer; user-select: none;">
                <h3 class="text-lg font-semibold" style="margin: 0;">Bộ lọc nhanh</h3>
                <span class="flex items-center gap-2 filter-toggle-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="filtersChevron" style="transition: transform 0.2s ease;">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                    <span class="filter-toggle-text">Mở bộ lọc</span>
                </span>
            </div>
            <div id="filtersContent" style="display: none; margin-top: var(--spacing-3);">
                <div class="filter-grid" style="display: flex; flex-wrap: wrap; gap: var(--spacing-3);">
                    <div class="filter-item" style="flex: 1 1 220px;">
                        <label class="text-sm text-muted mb-1 block">Tìm kiếm</label>
                        <div style="position: relative;">
                            <span style="position: absolute; top: 50%; left: 12px; transform: translateY(-50%); color: var(--muted);">
                                ${searchIcon}
                            </span>
                            <input type="text" id="searchInput" class="form-control" placeholder="Tìm theo tên hoặc tag" style="padding-left: 36px;">
                        </div>
                    </div>
                    <div class="filter-item" style="flex: 1 1 280px;">
                        <label class="text-sm text-muted mb-1 block">Tag</label>
                        <div class="tag-select-container" style="position: relative;">
                            <div class="tag-input-wrapper" id="filterTagInputWrapper" style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-1); padding: var(--spacing-2) var(--spacing-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-height: 42px; cursor: text;">
                                <div class="selected-tags-container" id="filterSelectedTagsContainer" style="display: flex; flex-wrap: wrap; gap: var(--spacing-1); flex: 1;"></div>
                                <input type="text" id="tagFilter" class="tag-search-input" placeholder="Tìm kiếm và chọn tag..." autocomplete="off" style="flex: 1; min-width: 120px; border: none; outline: none; background: transparent; padding: 0; font-size: var(--font-size-sm);">
                            </div>
                            <div class="tag-dropdown" id="filterTagDropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 1000; max-height: 250px; overflow-y: auto; margin-top: 4px;">
                                <div class="tag-dropdown-list" id="filterTagDropdownList"></div>
                            </div>
                            <input type="hidden" id="filterSelectedTagsInput" value="[]">
                        </div>
                    </div>
                    <div class="filter-item" style="flex: 1 1 180px;">
                        <label class="text-sm text-muted mb-1 block">Trạng thái</label>
                        <select id="statusFilter" class="form-control">
                            <option value="">Tất cả</option>
                            <option value="paid">Đã thanh toán</option>
                            <option value="pending">Chưa thanh toán</option>
                            <option value="deposit">Cọc</option>
                        </select>
                    </div>
                    <div class="filter-item" style="flex: 1 1 200px;">
                        <label class="text-sm text-muted mb-1 block">Nhân sự</label>
                        <select id="staffFilter" class="form-control">
                            <option value="">Tất cả nhân sự</option>
                            ${(() => {
                                const lessonPlanStaff = (window.demo.teachers || []).filter(t => {
                                    const roles = t.roles || [];
                                    return roles.includes('lesson_plan');
                                });
                                return lessonPlanStaff.map(s => `<option value="${s.id}">${s.fullName || s.name}</option>`).join('');
                            })()}
                        </select>
                    </div>
                    <div class="filter-item" style="flex: 1 1 240px;">
                        <label class="text-sm text-muted mb-1 block">Khoảng ngày</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-2);">
                            <input type="date" id="dateFromFilter" class="form-control" placeholder="Từ ngày">
                            <input type="date" id="dateToFilter" class="form-control" placeholder="Đến ngày">
                        </div>
                    </div>
                    <div class="filter-item" style="flex: 0 0 140px;">
                        <label class="text-sm text-muted mb-1 block">&nbsp;</label>
                        <button class="btn btn-outline w-full" id="clearFiltersBtn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            Xóa lọc
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Predefined tags from learning roadmap
const PREDEFINED_TAGS = [
    // Level 0
    'Nhập/Xuất', 'Input/Output', 'I/O',
    'Câu lệnh rẽ nhánh', 'Conditional Statement', 'If Statement',
    'if-else', 'If-Else',
    'Vòng lặp', 'Loop', 'Iteration',
    'for', 'For Loop',
    'while', 'While Loop',
    'do-while', 'Do-While Loop',
    'Mảng', 'Array',
    'Mảng hai chiều', '2D Array', 'Two Dimensional Array',
    'Chuỗi ký tự', 'String', 'Character String',
    'Xâu', 'String',
    'Struct', 'Structure',
    'Hàm void', 'Void Function',
    'Hàm trả về kết quả', 'Return Function', 'Function with Return',
    'Truy vấn', 'Query',
    'Queries',
    
    // Level 1
    'Lý thuyết độ phức tạp', 'Time Complexity', 'Complexity Theory',
    'Đệ quy', 'Recursion', 'Recursive',
    'Brute Force', 'Vét cạn', 'Exhaustive Search',
    'Quay lui', 'Backtracking',
    'Nhánh - cận', 'Branch and Bound',
    'Greedy', 'Greedy Algorithm',
    'Phép toán bit', 'Bit Manipulation', 'Bitwise Operation',
    'Sortings', 'Sorting', 'Sort Algorithm',
    'Đếm phân phối', 'Counting Sort', 'Distribution Counting',
    'Countings', 'Counting',
    'Prefixsum', 'Prefix Sum', 'Cumulative Sum',
    'Difference Array', 'Mảng hiệu',
    'Toán học', 'Mathematics', 'Math',
    'Ước', 'Divisor', 'Factor',
    'GCD', 'Greatest Common Divisor', 'Ước chung lớn nhất',
    'LCM', 'Least Common Multiple', 'Bội chung nhỏ nhất',
    'Nguyên tố', 'Prime Number', 'Prime',
    
    // Level 2
    'Tìm kiếm nhị phân', 'Binary Search',
    'Binary search',
    'Binary search answer', 'Binary Search on Answer',
    'Hai con trỏ', 'Two Pointers', 'Two Pointer Technique',
    'Vector', 'Vector',
    'Pair', 'Pair',
    'Set', 'Set',
    'Map', 'Map', 'Dictionary',
    'Chia đôi tập', 'Divide Set', 'Set Division',
    'Rời rạc hóa', 'Discretization', 'Coordinate Compression',
    'Kỹ thuật nén số', 'Number Compression', 'Coordinate Compression',
    'Lũy thừa nhị phân', 'Binary Exponentiation', 'Fast Exponentiation',
    'Thuật toán Euclid', "Euclid's Algorithm", 'Euclidean Algorithm',
    'Phương trình Diophantine', 'Diophantine Equation',
    'CRT', 'Chinese Remainder Theorem', 'Định lý số dư Trung Hoa',
    
    // Level 3
    'Nghịch đảo modulo', 'Modular Inverse', 'Modular Multiplicative Inverse',
    'Tổ hợp', 'Combination', 'C(n,k)',
    'Chỉnh hợp', 'Permutation', 'Arrangement',
    'Xác suất', 'Probability',
    'Bao hàm loại trừ', 'Inclusion-Exclusion Principle',
    'Phi hàm Euler', "Euler's Totient Function", 'Phi Function',
    'Stack', 'Stack',
    'Queue', 'Queue',
    'Deque', 'Deque', 'Double Ended Queue',
    'Priority queue', 'Priority Queue', 'Heap',
    'Monotonic stack', 'Monotonic Stack',
    'Đồ thị', 'Graph',
    'DFS', 'Depth First Search', 'Duyệt theo chiều sâu',
    'BFS', 'Breadth First Search', 'Duyệt theo chiều rộng',
    'Check chu trình', 'Cycle Detection', 'Detect Cycle',
    'Topo Sort', 'Topological Sort', 'Topological Sorting',
    'Loang', 'Flood Fill', 'BFS Flood',
    'Cây', 'Tree',
    'Small to large', 'Small to Large', 'DSU Small to Large',
    'Gộp set', 'Union Set', 'Set Union',
    'RMQ', 'Range Minimum Query', 'Range Maximum Query',
    'Segment Tree', 'Segment Tree', 'Cây phân đoạn',
    'Fenwick Tree', 'Fenwick Tree', 'Binary Indexed Tree', 'BIT',
    'Quy hoạch động', 'Dynamic Programming', 'DP',
    'DP Lis', 'Longest Increasing Subsequence', 'LIS',
    'DP Lcs', 'Longest Common Subsequence', 'LCS',
    'DP Knapsack', 'Knapsack Problem', '0-1 Knapsack',
    'Hashing', 'Hash', 'Hash Function',
    'Trie', 'Trie', 'Prefix Tree',
    'Manacher', "Manacher's Algorithm",
    'KMP', 'Knuth-Morris-Pratt', 'KMP Algorithm',
    'Z-function', 'Z Algorithm', 'Z-Array',
    'Bignum', 'Big Integer', 'Large Number',
    'Chia căn', 'Square Root Decomposition', 'Sqrt Decomposition',
    'Chia block', 'Block Decomposition',
    'Chia theo tổng số dương', 'Divide by Positive Sum',
    'Chia để trị', 'Divide and Conquer', 'D&C',
    'Kỹ thuật sinh test', 'Test Generation', 'Test Case Generation',
    'Viết trình chấm', 'Checker', 'Solution Checker',
    
    // Level 4
    'Heavy - light', 'Heavy Light Decomposition', 'HLD',
    "MO's", "Mo's Algorithm", 'Mo Algorithm',
    'Bitset', 'Bit Set', 'Bitset',
    'Tìm kiếm nhị phân song song', 'Parallel Binary Search',
    'Segment Tree Walk', 'Segment Tree Walk',
    'Segment Tree 2D', '2D Segment Tree',
    'Fenwick 2D', '2D Fenwick Tree', '2D BIT',
    'RMQ2D', '2D RMQ', '2D Range Query',
    'Dijkstra', "Dijkstra's Algorithm", 'Shortest Path',
    'Floyd', "Floyd-Warshall", 'All Pairs Shortest Path',
    'Ford-Bellman', 'Bellman-Ford', 'Bellman Ford Algorithm',
    'SPFA', 'Shortest Path Faster Algorithm',
    'DSU', 'Disjoint Set Union', 'Union Find',
    'Cây khung nhỏ nhất', 'Minimum Spanning Tree', 'MST',
    'MST',
    'Euler Tour', 'Euler Tour', 'Eulerian Tour',
    'LCA', 'Lowest Common Ancestor', 'LCA',
    'Khớp cầu', 'Articulation Point', 'Cut Vertex',
    'Thành phần liên thông mạnh', 'Strongly Connected Component', 'SCC',
    'Thành phần song liên thông', 'Biconnected Component',
    'Chu trình Euler', 'Eulerian Cycle', 'Euler Circuit',
    'Đường đi Euler', 'Eulerian Path', 'Euler Path',
    'DSU rollback', 'Rollback DSU', 'Persistent DSU',
    'DP Bitmask', 'Bitmask DP', 'DP with Bitmask',
    'DP digit', 'Digit DP', 'DP on Digits',
    'DP D&C', 'DP Divide and Conquer',
    'DP on tree', 'Tree DP', 'Dynamic Programming on Tree',
    'DP DAG', 'DP on DAG', 'Dynamic Programming on DAG',
    'Lý thuyết trò chơi', 'Game Theory',
    
    // Level 5
    'Sweep Line', 'Sweep Line Algorithm', 'Plane Sweep',
    'Khử gauss', 'Gaussian Elimination', 'Gauss Elimination',
    'Persistent Segment Tree', 'Persistent Segment Tree',
    'Rollback Segment Tree', 'Rollback Segment Tree',
    'Segmentree Beat', 'Segment Tree Beats',
    'DSU on tree', 'DSU on Tree', 'Small to Large on Tree',
    'Re - rooting', 'Rerooting', 'Tree Rerooting',
    '2 - SAT', '2-SAT', '2 Satisfiability',
    'HLD', 'Heavy Light Decomposition',
    'Centroid', 'Centroid Decomposition', 'Centroid Tree',
    'Clique', 'Clique', 'Maximal Clique',
    'Cặp ghép', 'Matching', 'Bipartite Matching',
    'Luồng', 'Flow', 'Network Flow', 'Max Flow',
    'DP SOS', 'Sum over Subsets', 'SOS DP',
    'QHĐ thứ tự từ điển', 'Lexicographic DP', 'DP Lexicographic Order',
    'Convex Hull Trick', 'Convex Hull Trick', 'CHT',
    'Li Chao Tree', 'Li Chao Tree', 'Line Segment Tree',
    'Convex Hull', 'Convex Hull', 'Graham Scan',
    'Nhân ma trận', 'Matrix Multiplication', 'Matrix Expo'
];

function renderAddOutputForm() {
    const addIcon = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
    `;

    return `
        <div class="card" style="padding: var(--spacing-5); margin-bottom: var(--spacing-4); border: 2px dashed var(--border);">
            <div id="toggleOutputForm" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-4); cursor: pointer; user-select: none;">
                <h3 style="margin: 0; font-size: var(--font-size-lg); display: flex; align-items: center; gap: var(--spacing-2); pointer-events: none;">
                    ${addIcon}
                    Thêm bài mới
                </h3>
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="toggleOutputIcon">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            <form id="outputForm" style="display: none;">
                <div class="form-group" style="margin-bottom: var(--spacing-3);">
                    <label for="outputLessonName" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Tên bài <span class="text-danger">*</span></label>
                    <input type="text" id="outputLessonName" name="lessonName" class="form-control" required placeholder="Tên bài giáo án">
                    <div id="duplicateTitleWarning" style="display: none; margin-top: var(--spacing-2);"></div>
                </div>
                <div class="form-group" style="margin-bottom: var(--spacing-3);">
                    <label for="outputOriginalTitle" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Tên gốc</label>
                    <input type="text" id="outputOriginalTitle" name="originalTitle" class="form-control" placeholder="VD: Light - VNOI, DOSI - Sưu tầm, DOIDAU - Unicorns">
                    <small class="text-muted" style="display: block; margin-top: var(--spacing-1); font-size: 0.875rem;">Quy tắc ghi tên gốc: Tên bài gốc + nguồn</small>
                    <div id="duplicateOriginalTitleWarning" style="display: none; margin-top: var(--spacing-2);"></div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: var(--spacing-3);">
                    <div class="form-group">
                        <label for="outputTag" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Tag</label>
                        <div class="tag-select-container" style="position: relative;">
                            <div class="tag-input-wrapper" style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-1); padding: var(--spacing-2) var(--spacing-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-height: 42px; cursor: text;">
                                <div class="selected-tags-container" id="selectedTagsContainer" style="display: flex; flex-wrap: wrap; gap: var(--spacing-1); flex: 1;"></div>
                                <input type="text" id="outputTag" name="tag" class="tag-search-input" placeholder="Tìm kiếm và chọn tag..." autocomplete="off" style="flex: 1; min-width: 120px; border: none; outline: none; background: transparent; padding: 0; font-size: var(--font-size-sm);">
                            </div>
                            <div class="tag-dropdown" id="tagDropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 1000; max-height: 250px; overflow-y: auto; margin-top: 4px;">
                                <div class="tag-dropdown-list" id="tagDropdownList"></div>
                            </div>
                            <input type="hidden" id="selectedTagsInput" name="selectedTags" value="[]">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="outputLevel" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Level</label>
                        <select id="outputLevel" name="level" class="form-control">
                            <option value="">-- Chọn level --</option>
                            <option value="Level 0">Level 0</option>
                            <option value="Level 1">Level 1</option>
                            <option value="Level 2">Level 2</option>
                            <option value="Level 3">Level 3</option>
                            <option value="Level 4">Level 4</option>
                            <option value="Level 5">Level 5</option>
                        </select>
                    </div>
                </div>
                <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: var(--spacing-3);">
                    <div class="form-group">
                        <label for="outputDate" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Ngày <span class="text-danger">*</span></label>
                        <input type="date" id="outputDate" name="date" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="outputCost" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Chi phí</label>
                        <input type="text" id="outputCost" name="cost" class="form-control" value="0" inputmode="numeric" placeholder="Nhập chi phí (VD: 30000)">
                        <small class="cost-preview text-muted" id="outputCostPreview" style="display: block;"></small>
                    </div>
                </div>
                <div class="form-group" style="margin-bottom: var(--spacing-3);">
                    <label for="outputStatus" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Trạng thái</label>
                    <select id="outputStatus" name="status" class="form-control">
                        <option value="pending">Chưa thanh toán</option>
                        <option value="paid">Đã thanh toán</option>
                        <option value="deposit">Cọc</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: var(--spacing-3);">
                    <label for="outputContestUploaded" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Contest</label>
                    <textarea id="outputContestUploaded" name="contestUploaded" class="form-control" rows="3" placeholder="VD: Bài này đã được đưa vào contest ABC ngày 12/11..."></textarea>
                </div>
                <div class="form-group" style="margin-bottom: var(--spacing-3);">
                    <label for="outputLink" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Link</label>
                    <input type="url" id="outputLink" name="link" class="form-control" placeholder="https://example.com/lesson">
                </div>
                ${(() => {
                    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
                    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
                    if (isAdmin) {
                        const lessonPlanStaff = (window.demo.teachers || []).filter(t => {
                            const roles = t.roles || [];
                            return roles.includes('lesson_plan');
                        });
                        return `
                            <div class="form-group" style="margin-bottom: var(--spacing-3);">
                                <label for="outputAssistantId" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Người phụ trách</label>
                                <select id="outputAssistantId" name="assistantId" class="form-control">
                                    <option value="">-- Chọn người phụ trách --</option>
                                    ${lessonPlanStaff.map(s => `
                                        <option value="${s.id}">
                                            ${s.fullName || s.name}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        `;
                    }
                    return '';
                })()}
                <div style="display: flex; gap: var(--spacing-2); justify-content: flex-end;">
                    <button type="button" class="btn" id="cancelOutputBtn">Hủy</button>
                    <button type="submit" class="btn btn-primary">Thêm bài</button>
                </div>
            </form>
        </div>
    `;
}

function renderOutputsTable(outputs, isAdmin, isAssistant, hasAccountantRole = false, hasLessonPlanRole = false) {
    const showSelectionColumn = Boolean(isAdmin || isAssistant || hasAccountantRole);
    const showActionColumn = Boolean(isAdmin || isAssistant || hasLessonPlanRole);
    const baseColumns = 6;
    const colCount = baseColumns + (showSelectionColumn ? 1 : 0) + (showActionColumn ? 1 : 0);
    if (outputs.length === 0) {
        return `<tr><td colspan="${colCount}" class="text-center text-muted py-4" style="padding: var(--spacing-8); text-align: center; color: var(--muted);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-2);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; color: var(--muted);">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <p style="margin: 0; font-size: var(--font-size-sm);">Chưa có bài nào</p>
            </div>
        </td></tr>`;
    }

    return outputs.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(output => {
        const status = output.status || 'pending';
        const statusText = status === 'paid' ? 'Đã thanh toán' : status === 'deposit' ? 'Cọc' : 'Chưa thanh toán';
        const statusClass = status === 'paid' ? 'badge-success' : status === 'deposit' ? 'badge-warning' : 'badge-danger';
        
        return `
        <tr data-output-id="${output.id}" style="cursor: pointer; transition: all 0.2s ease;">
            ${showSelectionColumn ? `
                <td style="padding: var(--spacing-2); text-align: center; width: 50px; min-width: 50px;" onclick="event.stopPropagation();">
                    <input type="checkbox" class="output-checkbox table-checkbox" data-output-id="${output.id}" style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--primary);">
                </td>
            ` : ''}
            <td style="padding: var(--spacing-3); width: 180px; min-width: 180px;">
                ${output.tag ? `
                    <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-1);">
                        ${(output.tag || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 2).map(tag => `
                            <span class="badge badge-info" style="font-size: var(--font-size-xs); padding: 4px 8px;">${tag}</span>
                        `).join('')}
                        ${(output.tag || '').split(',').filter(Boolean).length > 2 ? `<span class="badge badge-info" style="font-size: var(--font-size-xs); padding: 4px 8px;">+${(output.tag || '').split(',').filter(Boolean).length - 2}</span>` : ''}
                    </div>
                ` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
            </td>
            <td style="padding: var(--spacing-3); width: 120px; min-width: 120px;">
                <span class="badge" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.2); font-size: var(--font-size-xs); padding: 4px 10px; font-weight: 500;">
                    ${getDisplayLevel(output.level)}
                </span>
            </td>
            <td style="padding: var(--spacing-3); width: auto; min-width: 250px;">
                <strong style="color: var(--text); font-weight: 500; word-break: break-word;">${output.lessonName || '-'}</strong>
            </td>
            <td style="padding: var(--spacing-3); width: 150px; min-width: 150px;">
                <span class="badge ${statusClass}" style="font-size: var(--font-size-xs); padding: 4px 10px; font-weight: 500;">
                    ${statusText}
                </span>
            </td>
            <td style="padding: var(--spacing-3); width: 200px; min-width: 200px;">
                ${output.contestUploaded ? `
                    <span style="font-size: var(--font-size-sm); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; max-width: 100%;" title="${output.contestUploaded}">
                        ${output.contestUploaded}
                    </span>
                ` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
            </td>
            <td style="padding: var(--spacing-3);">
                ${output.link ? `
                    <div style="display: flex; align-items: center; gap: var(--spacing-1);">
                        <button class="btn-icon" onclick="event.stopPropagation(); copyToClipboard('${output.link}', 'Đã sao chép link');" title="Sao chép link" style="width: 28px; height: 28px; padding: 0; transition: all 0.2s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
                            </svg>
                        </button>
                        <a href="${output.link}" target="_blank" rel="noopener noreferrer" class="btn-icon" title="Mở link" onclick="event.stopPropagation();" style="width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                ` : '<span class="text-muted" style="font-size: var(--font-size-sm);">-</span>'}
            </td>
            ${showActionColumn ? `
                <td style="padding: var(--spacing-2); text-align: center;">
                    <button class="btn-delete-icon" onclick="event.stopPropagation(); deleteOutput('${output.id}');" title="Xóa" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--danger); cursor: pointer; transition: all 0.2s ease; border-radius: var(--radius);">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; height: 18px;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            ` : ''}
        </tr>
        `;
    }).join('');
}

function attachOverviewListeners(isAdmin, isAssistant, assistantId, hasLessonPlanRole = false) {
    const main = document.querySelector('#main-content');
    if (!main) return;

    // Month selector event listeners
    const monthPrevBtn = main.querySelector('#lessonPlansMonthPrev');
    const monthNextBtn = main.querySelector('#lessonPlansMonthNext');
    const monthLabelBtn = main.querySelector('#lessonPlansMonthLabelBtn');
    const monthPopup = main.querySelector('#lessonPlansMonthPopup');
    const yearLabel = main.querySelector('#lessonPlansYearLabel');
    const yearPrevBtn = main.querySelector('#lessonPlansYearPrev');
    const yearNextBtn = main.querySelector('#lessonPlansYearNext');
    const monthCells = main.querySelectorAll('#lessonPlansMonthPopup .session-month-cell');

    function updateMonthFilter(deltaMonth = 0, deltaYear = 0) {
        window.LessonPlansMonthFilter = window.LessonPlansMonthFilter || {};
        const currentMonth = window.LessonPlansMonthFilter.selectedMonth || new Date().toISOString().slice(0, 7);
        const [year, month] = currentMonth.split('-').map(Number);
        
        let newMonth = month + deltaMonth;
        let newYear = year + deltaYear;
        
        if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        } else if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        }
        
        window.LessonPlansMonthFilter.selectedMonth = `${newYear}-${String(newMonth).padStart(2, '0')}`;
        renderLessonPlans('overview');
    }

    if (monthPrevBtn) {
        monthPrevBtn.addEventListener('click', () => updateMonthFilter(-1, 0));
    }
    if (monthNextBtn) {
        monthNextBtn.addEventListener('click', () => updateMonthFilter(1, 0));
    }
    if (monthLabelBtn && monthPopup) {
        monthLabelBtn.addEventListener('click', () => {
            const isHidden = monthPopup.style.display === 'none' || monthPopup.style.display === '';
            monthPopup.style.display = isHidden ? 'block' : 'none';
        });
    }
    if (yearPrevBtn && yearLabel) {
        yearPrevBtn.addEventListener('click', () => {
            const currentYear = parseInt(yearLabel.textContent);
            yearLabel.textContent = currentYear - 1;
        });
    }
    if (yearNextBtn && yearLabel) {
        yearNextBtn.addEventListener('click', () => {
            const currentYear = parseInt(yearLabel.textContent);
            yearLabel.textContent = currentYear + 1;
        });
    }
    monthCells.forEach(cell => {
        cell.addEventListener('click', () => {
            const m = cell.getAttribute('data-month');
            if (!m) return;
            const currentYear = parseInt(yearLabel?.textContent || new Date().getFullYear());
            window.LessonPlansMonthFilter = window.LessonPlansMonthFilter || {};
            window.LessonPlansMonthFilter.selectedMonth = `${currentYear}-${m}`;
            if (monthPopup) monthPopup.style.display = 'none';
            renderLessonPlans('overview');
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

    // Resource table row click handlers
    const resourceRows = main.querySelectorAll('#resourcesTableBody tr[data-resource-id]');
    resourceRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking button or link
            if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a')) return;
            
            const resourceId = row.dataset.resourceId;
            if ((isAdmin || hasLessonPlanRole) && resourceId) {
                openResourceModal(resourceId);
            }
        });
    });

    // Task table row click handlers
    const taskRows = main.querySelectorAll('#tasksTableBody tr[data-task-id]');
    taskRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't trigger if clicking button
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            
            const taskId = row.dataset.taskId;
            if ((isAdmin || hasLessonPlanRole) && taskId) {
                openLessonTaskModal(taskId);
            }
        });
    });

    if (!isAdmin && !hasLessonPlanRole) return;

    const addResourceBtn = main?.querySelector('#addResourceBtn');
    const addTaskBtn = main?.querySelector('#addTaskBtn');

    if (addResourceBtn) {
        addResourceBtn.addEventListener('click', () => openResourceModal(null));
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => openLessonTaskModal(null));
    }
}

// Store event handlers to prevent duplicate listeners
let exercisesListenersAttached = false;
let exercisesEventHandlers = {
    edit: null,
    delete: null
};

function attachExercisesListeners(isAdmin, isAssistant, assistantId) {
    const main = document.querySelector('#main-content');
    if (!main) return;
    
    const currentTab = getCurrentLessonPlansTab();
    if (currentTab !== 'exercises') {
        // Reset flag if not on exercises tab
        exercisesListenersAttached = false;
        return;
    }
    
    // Initialize data
    if (!window.demo.lessonTopics) window.demo.lessonTopics = [];
    if (!window.demo.lessonTopicLinks) window.demo.lessonTopicLinks = [];
    
    // Setup filter controls for exercises tab (similar to tasks tab)
    const searchInput = main.querySelector('#searchInput');
    const tagFilter = main.querySelector('#tagFilter');
    const statusFilter = main.querySelector('#statusFilter');
    const staffFilter = main.querySelector('#staffFilter');
    const dateFromFilter = main.querySelector('#dateFromFilter');
    const dateToFilter = main.querySelector('#dateToFilter');
    const clearFiltersBtn = main.querySelector('#clearFiltersBtn');
    const toggleFiltersBtn = main.querySelector('#toggleFiltersBtn');
    const filtersContent = main.querySelector('#filtersContent');
    const filtersChevron = main.querySelector('#filtersChevron');
    const filterToggleText = main.querySelector('.filter-toggle-text');
    
    // Toggle filters - make entire header clickable (for exercises tab)
    if (toggleFiltersBtn && filtersContent) {
        // Clone element to remove all old listeners
        const newToggleBtn = toggleFiltersBtn.cloneNode(true);
        toggleFiltersBtn.parentNode.replaceChild(newToggleBtn, toggleFiltersBtn);
        
        // Re-query after clone
        const currentToggleBtn = document.querySelector('#toggleFiltersBtn');
        const currentFiltersContent = document.querySelector('#filtersContent');
        const currentFiltersChevron = document.querySelector('#filtersChevron');
        const currentFilterToggleText = document.querySelector('.filter-toggle-text');
        
        if (currentToggleBtn && currentFiltersContent) {
            // Ensure all child elements don't block clicks
            const headerElements = currentToggleBtn.querySelectorAll('*');
            headerElements.forEach(el => {
                el.style.pointerEvents = 'none';
            });
            
            // Make sure the button itself is clickable
            currentToggleBtn.style.cursor = 'pointer';
            currentToggleBtn.style.userSelect = 'none';
            
            // Add fresh event listener
            currentToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const isHidden = currentFiltersContent.style.display === 'none' || currentFiltersContent.style.display === '';
                currentFiltersContent.style.display = isHidden ? 'block' : 'none';
                if (currentFiltersChevron) {
                    currentFiltersChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
                if (currentFilterToggleText) {
                    currentFilterToggleText.textContent = isHidden ? 'Thu gọn' : 'Mở bộ lọc';
                }
            });
        }
    }
    
    function applyExercisesFilters() {
        const allOutputs = window.demo.lessonOutputs || [];
        const allLinks = window.demo.lessonTopicLinks || [];
        const allTopics = window.demo.lessonTopics || [];
        const activeTopic = main.querySelector('.topic-item.active')?.dataset.topicId || 'all';
        const topic = allTopics.find(t => t.id === activeTopic);
        
        let exercises = [];
        
        if (activeTopic === 'all') {
            exercises = allOutputs;
        } else if (topic?.level !== null && topic?.level !== undefined) {
            exercises = allOutputs.filter(o => {
                const level = normalizeLevel(o.level);
                if (topic.level === 0) return level === 'Level 0' || !level;
                return level === `Level ${topic.level}`;
            });
        } else {
            const linkIds = allLinks
                .filter(l => l.topicId === activeTopic)
                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                .map(l => l.lessonOutputId);
            exercises = allOutputs.filter(o => linkIds.includes(o.id));
            exercises.sort((a, b) => {
                const orderA = allLinks.find(l => l.topicId === activeTopic && l.lessonOutputId === a.id)?.orderIndex || 0;
                const orderB = allLinks.find(l => l.topicId === activeTopic && l.lessonOutputId === b.id)?.orderIndex || 0;
                return orderA - orderB;
            });
        }
        
        // Apply filters
        const search = (searchInput?.value || '').toLowerCase();
        const filterSelectedTagsInput = main.querySelector('#filterSelectedTagsInput');
        const selectedTags = filterSelectedTagsInput ? JSON.parse(filterSelectedTagsInput.value || '[]') : [];
        const status = statusFilter?.value || '';
        const staffId = staffFilter?.value || '';
        const dateFrom = dateFromFilter?.value || '';
        const dateTo = dateToFilter?.value || '';
        
        exercises = exercises.filter(exercise => {
            if (search && !(
                (exercise.lessonName || '').toLowerCase().includes(search) ||
                (exercise.tag || '').toLowerCase().includes(search)
            )) return false;
            
            if (selectedTags.length > 0) {
                const exerciseTags = (exercise.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                const hasMatchingTag = selectedTags.some(selectedTag => 
                    exerciseTags.some(exerciseTag => 
                        exerciseTag.toLowerCase() === selectedTag.toLowerCase()
                    )
                );
                if (!hasMatchingTag) return false;
            }
            if (status && exercise.status !== status) return false;
            if (staffId && exercise.assistantId !== staffId) return false;
            if (dateFrom && exercise.date && exercise.date < dateFrom) return false;
            if (dateTo && exercise.date && exercise.date > dateTo) return false;
            return true;
        });
        
        // Render filtered exercises
        const exercisesList = main.querySelector('#exercisesList');
        if (exercisesList) {
            const isCustomTopic = topic && !topic.isDefault && topic.level === null;
            const canDragDrop = isCustomTopic && isAdmin;
            
            exercisesList.innerHTML = `
                <div class="table-container" style="background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden;">
                    <table class="table-striped exercises-table" style="width: 100%; margin: 0;">
                        <thead>
                            <tr style="background: var(--bg); border-bottom: 2px solid var(--border);">
                                <th style="width: 15%; padding: var(--spacing-3); font-weight: 600; color: var(--text);">Tag</th>
                                <th style="width: 50%; padding: var(--spacing-3); font-weight: 600; color: var(--text);">Tên Bài</th>
                                <th style="width: 35%; padding: var(--spacing-3); font-weight: 600; color: var(--text);">Link</th>
                            </tr>
                        </thead>
                        <tbody id="exercisesTableBody" ${canDragDrop ? 'class="sortable-list"' : ''}>
                            ${exercises.length > 0 ? exercises.map((output, index) => `
                                <tr data-output-id="${output.id}" data-order="${index}" class="exercise-row ${canDragDrop ? 'draggable-row' : ''}" style="cursor: ${canDragDrop ? 'grab' : 'pointer'}; transition: all 0.2s ease; ${canDragDrop ? 'position: relative;' : ''}">
                                    <td style="padding: var(--spacing-3);">${output.tag ? `<span class="badge badge-info">${output.tag}</span>` : '<span class="text-muted">-</span>'}</td>
                                    <td style="padding: var(--spacing-3);"><strong style="color: var(--text);">${output.lessonName || '-'}</strong></td>
                                    <td style="padding: var(--spacing-3);">
                                        <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                            ${output.link ? `
                                                <div class="link-actions" style="display: flex; align-items: center; gap: var(--spacing-2);">
                                                    <button type="button" class="btn-icon copy-link-btn" data-link="${output.link}" title="Sao chép link" onclick="event.stopPropagation(); copyToClipboard(this.dataset.link, 'Đã sao chép link');" style="width: 28px; height: 28px; padding: 0;">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                                            <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
                                                        </svg>
                                                    </button>
                                                    <a href="${output.link}" target="_blank" class="link-icon" rel="noopener noreferrer" title="${output.link}" onclick="event.stopPropagation();" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                            <polyline points="15 3 21 3 21 9"></polyline>
                                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                                        </svg>
                                                    </a>
                                                </div>
                                            ` : '<span class="text-muted">-</span>'}
                                            ${isAdmin ? `
                                                <button class="btn-icon add-to-topic-btn" data-output-id="${output.id}" title="Thêm vào chuyên đề" onclick="event.stopPropagation(); openAddToTopicModal('${output.id}');" style="width: 28px; height: 28px; padding: 0; opacity: 0; transition: opacity 0.2s; color: var(--primary);">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="3" class="text-center text-muted py-8" style="padding: var(--spacing-8);">
                                        <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-2);">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                            </svg>
                                            <span>Chưa có bài nào trong chuyên đề này</span>
                                        </div>
                                    </td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Setup drag and drop for custom topics
            if (canDragDrop) {
                setupDragAndDrop(activeTopic);
            }
            
            // Setup hover to show add-to-topic button
            if (isAdmin) {
                const rows = exercisesList.querySelectorAll('tr[data-output-id]');
                rows.forEach(row => {
                    const addBtn = row.querySelector('.add-to-topic-btn');
                    if (addBtn) {
                        row.addEventListener('mouseenter', () => {
                            addBtn.style.opacity = '1';
                        });
                        row.addEventListener('mouseleave', () => {
                            addBtn.style.opacity = '0';
                        });
                    }
                });
            }
            
            // Setup click handlers for exercise rows
            const exerciseRows = exercisesList.querySelectorAll('tr[data-output-id]');
            exerciseRows.forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.link-actions')) {
                        return;
                    }
                    const outputId = row.dataset.outputId;
                    if (outputId) {
                        openExerciseDetailModal(outputId);
                    }
                });
            });
        }
    }
    
    // Filter event listeners
    if (searchInput) searchInput.addEventListener('input', applyExercisesFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyExercisesFilters);
    if (staffFilter) staffFilter.addEventListener('change', applyExercisesFilters);
    if (dateFromFilter) dateFromFilter.addEventListener('change', applyExercisesFilters);
    if (dateToFilter) dateToFilter.addEventListener('change', applyExercisesFilters);
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            const filterSelectedTagsInput = main.querySelector('#filterSelectedTagsInput');
            const filterSelectedTagsContainer = main.querySelector('#filterSelectedTagsContainer');
            if (filterSelectedTagsInput) filterSelectedTagsInput.value = '[]';
            if (filterSelectedTagsContainer) filterSelectedTagsContainer.innerHTML = '';
            if (statusFilter) statusFilter.value = '';
            if (staffFilter) staffFilter.value = '';
            if (dateFromFilter) dateFromFilter.value = '';
            if (dateToFilter) dateToFilter.value = '';
            applyExercisesFilters();
        });
    }
    
    // Setup tag multi-select for filter (similar to tasks tab)
    const filterTagInput = main.querySelector('#tagFilter.tag-search-input');
    const filterTagInputWrapper = main.querySelector('#filterTagInputWrapper');
    const filterTagDropdown = main.querySelector('#filterTagDropdown');
    const filterTagDropdownList = main.querySelector('#filterTagDropdownList');
    const filterSelectedTagsContainer = main.querySelector('#filterSelectedTagsContainer');
    const filterSelectedTagsInput = main.querySelector('#filterSelectedTagsInput');
    
    if (filterTagInput && filterTagDropdown && filterTagDropdownList && filterSelectedTagsContainer && filterSelectedTagsInput) {
        let filterSelectedTags = JSON.parse(filterSelectedTagsInput.value || '[]');
        
        function renderFilterSelectedTags() {
            if (!filterSelectedTagsContainer) return;
            filterSelectedTagsContainer.innerHTML = '';
            
            if (filterSelectedTags.length > 0) {
                const countBadge = document.createElement('span');
                countBadge.className = 'tag-count-badge';
                countBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: var(--font-size-xs); background: var(--bg); color: var(--muted); border-radius: var(--radius-sm); font-weight: 500; margin-right: var(--spacing-1);';
                countBadge.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    ${filterSelectedTags.length}
                `;
                filterSelectedTagsContainer.appendChild(countBadge);
            }
            
            filterSelectedTags.forEach(tag => {
                const badge = document.createElement('span');
                badge.className = 'tag-badge-selected';
                badge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: var(--font-size-xs); background: var(--primary); color: white; border-radius: var(--radius-sm); font-weight: 500;';
                badge.innerHTML = `
                    ${tag}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="cursor: pointer;" class="remove-tag-btn">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                const removeBtn = badge.querySelector('.remove-tag-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        filterSelectedTags = filterSelectedTags.filter(t => t !== tag);
                        filterSelectedTagsInput.value = JSON.stringify(filterSelectedTags);
                        renderFilterSelectedTags();
                        applyExercisesFilters();
                    });
                }
                filterSelectedTagsContainer.appendChild(badge);
            });
        }
        
        function renderTagDropdown(searchTerm = '') {
            if (!filterTagDropdownList) return;
            
            const allOutputs = window.demo.lessonOutputs || [];
            const allTags = [...new Set(allOutputs.map(o => o.tag).filter(Boolean))];
            const uniqueTags = [...new Set(allTags.flatMap(tag => tag.split(',').map(t => t.trim()).filter(Boolean)))];
            
            const filteredTags = uniqueTags.filter(tag => {
                if (!searchTerm) return true;
                return tag.toLowerCase().includes(searchTerm.toLowerCase()) && !filterSelectedTags.includes(tag);
            }).filter(tag => !filterSelectedTags.includes(tag));
            
            if (filteredTags.length === 0) {
                filterTagDropdownList.innerHTML = '<div style="padding: var(--spacing-3); text-align: center; color: var(--muted); font-size: var(--font-size-sm);">Không tìm thấy tag</div>';
                return;
            }
            
            filterTagDropdownList.innerHTML = filteredTags.slice(0, 20).map(tag => `
                <div class="tag-dropdown-item" style="padding: var(--spacing-2) var(--spacing-3); cursor: pointer; transition: background 0.2s; font-size: var(--font-size-sm);" data-tag="${tag}">
                    ${tag}
                </div>
            `).join('');
            
            filterTagDropdownList.querySelectorAll('.tag-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    if (!filterSelectedTags.includes(item.dataset.tag)) {
                        filterSelectedTags.push(item.dataset.tag);
                        filterSelectedTagsInput.value = JSON.stringify(filterSelectedTags);
                        renderFilterSelectedTags();
                        filterTagInput.value = '';
                        filterTagDropdown.style.display = 'none';
                        applyExercisesFilters();
                    }
                });
            });
        }
        
        renderFilterSelectedTags();
        
        if (filterTagInput) {
            let searchTimeout = null;
            filterTagInput.addEventListener('input', (e) => {
                const value = e.target.value;
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (value.trim()) {
                        renderTagDropdown(value);
                    } else {
                        renderTagDropdown('');
                    }
                }, 150);
            });
            
            filterTagInput.addEventListener('focus', () => {
                if (filterTagInput.value.trim()) {
                    renderTagDropdown(filterTagInput.value);
                } else {
                    renderTagDropdown('');
                }
            });
        }
        
        document.addEventListener('click', (e) => {
            const tagContainer = filterTagInput?.closest('.tag-select-container');
            if (tagContainer && !tagContainer.contains(e.target)) {
                if (filterTagDropdown) filterTagDropdown.style.display = 'none';
            }
        });
    }
    
    // Load exercises for default topic (Tất cả)
    loadExercisesForTopic('all', isAdmin);
    
    // Remove old listeners if already attached
    if (exercisesListenersAttached) {
        // Remove old event listeners
        if (exercisesEventHandlers.edit) {
            main.removeEventListener('click', exercisesEventHandlers.edit);
        }
        if (exercisesEventHandlers.delete) {
            main.removeEventListener('click', exercisesEventHandlers.delete);
        }
        // Remove old sidebar listeners by cloning
        const sidebar = main.querySelector('.exercises-sidebar');
        if (sidebar) {
            const newSidebar = sidebar.cloneNode(true);
            sidebar.parentNode.replaceChild(newSidebar, sidebar);
        }
        exercisesListenersAttached = false;
    }
    
    // Topic click handlers - use event delegation on sidebar
    const sidebar = main.querySelector('.exercises-sidebar');
    if (sidebar) {
        // Use a named function so we can remove it later if needed
        const sidebarClickHandler = (e) => {
            const topicItem = e.target.closest('.topic-item');
            if (!topicItem) return;
            
            // Don't trigger if clicking on action buttons
            if (e.target.closest('.btn-icon') || e.target.closest('.topic-actions')) {
                return;
            }
            
            const topicId = topicItem.dataset.topicId;
            if (!topicId) return;
            
            // Update active state
            const allTopicItems = sidebar.querySelectorAll('.topic-item');
            allTopicItems.forEach(t => {
                t.classList.remove('active');
                t.style.background = '';
                t.style.color = '';
                t.style.fontWeight = '';
                t.style.borderColor = '';
            });
            topicItem.classList.add('active');
            if (topicId === 'all') {
                topicItem.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)';
                topicItem.style.color = 'var(--primary)';
                topicItem.style.fontWeight = '600';
                topicItem.style.borderColor = 'rgba(59, 130, 246, 0.2)';
            } else {
                topicItem.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)';
                topicItem.style.color = 'var(--primary)';
                topicItem.style.borderColor = 'rgba(59, 130, 246, 0.2)';
            }
            
            // Load exercises (will apply month and staff filters)
            loadExercisesForTopic(topicId, isAdmin);
        };
        
        sidebar.addEventListener('click', sidebarClickHandler);
        
        // Show edit/delete buttons on hover for custom topics
        const sidebarHoverEnter = (e) => {
            const topicItem = e.target.closest('.topic-item');
            if (!topicItem) return;
            
            const topicId = topicItem.dataset.topicId;
            if (topicId && !topicId.startsWith('level-') && topicId !== 'all') {
                const buttons = topicItem.querySelector('.topic-actions');
                if (buttons) {
                    buttons.style.opacity = '1';
                }
            }
        };
        
        const sidebarHoverLeave = (e) => {
            const topicItem = e.target.closest('.topic-item');
            if (!topicItem) return;
            
            const topicId = topicItem.dataset.topicId;
            if (topicId && !topicId.startsWith('level-') && topicId !== 'all') {
                const buttons = topicItem.querySelector('.topic-actions');
                if (buttons) {
                    buttons.style.opacity = '0';
                }
            }
        };
        
        sidebar.addEventListener('mouseenter', sidebarHoverEnter, true);
        sidebar.addEventListener('mouseleave', sidebarHoverLeave, true);
    }
    
    // Edit topic button - use event delegation
    const handleEditClick = (e) => {
        const editBtn = e.target.closest('.edit-topic-btn');
        if (editBtn) {
            e.stopPropagation();
            e.preventDefault();
            const topicId = editBtn.dataset.topicId;
            if (topicId) {
                openTopicModal(topicId);
            }
        }
    };
    
    // Delete topic button - use event delegation
    const handleDeleteClick = (e) => {
        const deleteBtn = e.target.closest('.delete-topic-btn');
        if (deleteBtn) {
            e.stopPropagation();
            e.preventDefault();
            const topicId = deleteBtn.dataset.topicId;
            if (topicId) {
                deleteTopic(topicId);
            }
        }
    };
    
    // Store handlers for cleanup
    exercisesEventHandlers.edit = handleEditClick;
    exercisesEventHandlers.delete = handleDeleteClick;
    
    // Add new listeners
    main.addEventListener('click', handleEditClick);
    main.addEventListener('click', handleDeleteClick);
    
    // Add topic button
    const addTopicBtn = main.querySelector('#addTopicBtn');
    if (addTopicBtn && isAdmin) {
        // Remove old listener
        const newAddBtn = addTopicBtn.cloneNode(true);
        addTopicBtn.parentNode.replaceChild(newAddBtn, addTopicBtn);
        
        newAddBtn.addEventListener('click', () => {
            openTopicModal(null);
        });
    }
    
    exercisesListenersAttached = true;
}

function loadExercisesForTopic(topicId, isAdmin) {
    const exercisesList = document.querySelector('#exercisesList');
    if (!exercisesList) return;
    
    const allOutputs = window.demo.lessonOutputs || [];
    const allLinks = window.demo.lessonTopicLinks || [];
    const allTopics = window.demo.lessonTopics || [];
    const topic = allTopics.find(t => t.id === topicId);
    
    let exercises = [];
    
    if (topicId === 'all') {
        // Show all exercises
        exercises = allOutputs;
    } else if (topic?.level !== null && topic?.level !== undefined) {
        // Filter by level for default level topics
        exercises = allOutputs.filter(o => {
            const level = normalizeLevel(o.level);
            if (topic.level === 0) return level === 'Level 0' || !level;
            return level === `Level ${topic.level}`;
        });
    } else {
        // Filter by topic links for custom topics
        const linkIds = allLinks
            .filter(l => l.topicId === topicId)
            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
            .map(l => l.lessonOutputId);
        exercises = allOutputs.filter(o => linkIds.includes(o.id));
        // Sort by order
        exercises.sort((a, b) => {
            const orderA = allLinks.find(l => l.topicId === topicId && l.lessonOutputId === a.id)?.orderIndex || 0;
            const orderB = allLinks.find(l => l.topicId === topicId && l.lessonOutputId === b.id)?.orderIndex || 0;
            return orderA - orderB;
        });
    }
    
    const isCustomTopic = topic && !topic.isDefault && topic.level === null;
    const canDragDrop = isCustomTopic && isAdmin;
    
    exercisesList.innerHTML = `
        <div class="table-container" style="background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); overflow: hidden;">
            <table class="table-striped exercises-table" style="width: 100%; margin: 0;">
                <thead>
                    <tr style="background: var(--bg); border-bottom: 2px solid var(--border);">
                        <th style="width: 15%; padding: var(--spacing-3); font-weight: 600; color: var(--text);">Tag</th>
                        <th style="width: 50%; padding: var(--spacing-3); font-weight: 600; color: var(--text);">Tên Bài</th>
                        <th style="width: 35%; padding: var(--spacing-3); font-weight: 600; color: var(--text);">Link</th>
                    </tr>
                </thead>
                <tbody id="exercisesTableBody" ${canDragDrop ? 'class="sortable-list"' : ''}>
                    ${exercises.length > 0 ? exercises.map((output, index) => `
                        <tr data-output-id="${output.id}" data-order="${index}" class="exercise-row ${canDragDrop ? 'draggable-row' : ''}" style="cursor: ${canDragDrop ? 'grab' : 'pointer'}; transition: all 0.2s ease; ${canDragDrop ? 'position: relative;' : ''}">
                            <td style="padding: var(--spacing-3);">${output.tag ? `<span class="badge badge-info">${output.tag}</span>` : '<span class="text-muted">-</span>'}</td>
                            <td style="padding: var(--spacing-3);"><strong style="color: var(--text);">${output.lessonName || '-'}</strong></td>
                            <td style="padding: var(--spacing-3);">
                                <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                                    ${output.link ? `
                                        <div class="link-actions" style="display: flex; align-items: center; gap: var(--spacing-2);">
                                            <button type="button" class="btn-icon copy-link-btn" data-link="${output.link}" title="Sao chép link" onclick="event.stopPropagation(); copyToClipboard(this.dataset.link, 'Đã sao chép link');" style="width: 28px; height: 28px; padding: 0;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                                    <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
                                                </svg>
                                            </button>
                                            <a href="${output.link}" target="_blank" class="link-icon" rel="noopener noreferrer" title="${output.link}" onclick="event.stopPropagation();" style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                    <polyline points="15 3 21 3 21 9"></polyline>
                                                    <line x1="10" y1="14" x2="21" y2="3"></line>
                                                </svg>
                                            </a>
                                        </div>
                                    ` : '<span class="text-muted">-</span>'}
                                    ${isAdmin ? `
                                        <button class="btn-icon add-to-topic-btn" data-output-id="${output.id}" title="Thêm vào chuyên đề" onclick="event.stopPropagation(); openAddToTopicModal('${output.id}');" style="width: 28px; height: 28px; padding: 0; opacity: 0; transition: opacity 0.2s; color: var(--primary);">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                            </svg>
                                        </button>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                    `).join('') : `
                        <tr>
                            <td colspan="3" class="text-center text-muted py-8" style="padding: var(--spacing-8);">
                                <div style="display: flex; flex-direction: column; align-items: center; gap: var(--spacing-2);">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3;">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                    </svg>
                                    <span>Chưa có bài nào trong chuyên đề này</span>
                                </div>
                            </td>
                        </tr>
                    `}
                </tbody>
            </table>
        </div>
    `;
    
    // Setup drag and drop for custom topics
    if (canDragDrop) {
        setupDragAndDrop(topicId);
    }
    
    // Setup hover to show add-to-topic button
    if (isAdmin) {
        const rows = exercisesList.querySelectorAll('tr[data-output-id]');
        rows.forEach(row => {
            const addBtn = row.querySelector('.add-to-topic-btn');
            if (addBtn) {
                row.addEventListener('mouseenter', () => {
                    addBtn.style.opacity = '1';
                });
                row.addEventListener('mouseleave', () => {
                    addBtn.style.opacity = '0';
                });
            }
        });
    }
    
    // Setup click handlers for exercise rows to show detail popup
    const exerciseRows = exercisesList.querySelectorAll('tr[data-output-id]');
    exerciseRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Don't open popup if clicking on buttons or links
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.link-actions')) {
                return;
            }
            const outputId = row.dataset.outputId;
            if (outputId) {
                openExerciseDetailModal(outputId);
            }
        });
    });
}

function setupDragAndDrop(topicId) {
    const tbody = document.querySelector('#exercisesTableBody');
    if (!tbody) return;
    
    let longPressTimer = null;
    let isDragging = false;
    let draggedElement = null;
    let startY = 0;
    let currentY = 0;
    
    tbody.querySelectorAll('tr[data-output-id]').forEach(row => {
        // Long press detection
        const handleTouchStart = (e) => {
            if (e.target.closest('button') || e.target.closest('a')) return;
            
            longPressTimer = setTimeout(() => {
                isDragging = true;
                draggedElement = row;
                startY = e.touches ? e.touches[0].clientY : e.clientY;
                
                row.classList.add('dragging');
                row.style.opacity = '0.6';
                row.style.transform = 'scale(1.02)';
                row.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                row.style.zIndex = '1000';
                row.style.cursor = 'grabbing';
                
                // Add visual feedback
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                
                // Prevent default to avoid scrolling
                e.preventDefault();
            }, 500); // 500ms long press
        };
        
        const handleMouseDown = (e) => {
            if (e.target.closest('button') || e.target.closest('a')) return;
            handleTouchStart(e);
        };
        
        const handleMove = (e) => {
            if (!isDragging || !draggedElement) return;
            
            currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;
            
            // Move the element visually
            draggedElement.style.transform = `translateY(${deltaY}px) scale(1.02)`;
            
            // Find the element to insert before
            const afterElement = getDragAfterElement(tbody, currentY);
            if (afterElement && afterElement !== draggedElement) {
                if (afterElement.nextSibling === draggedElement) {
                    tbody.insertBefore(draggedElement, afterElement);
                } else {
                    tbody.insertBefore(draggedElement, afterElement.nextSibling);
                }
            } else if (!afterElement && draggedElement.nextSibling) {
                tbody.appendChild(draggedElement);
            }
        };
        
        const handleEnd = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (isDragging && draggedElement) {
                isDragging = false;
                
                draggedElement.classList.remove('dragging');
                draggedElement.style.opacity = '1';
                draggedElement.style.transform = '';
                draggedElement.style.boxShadow = '';
                draggedElement.style.zIndex = '';
                draggedElement.style.cursor = 'grab';
                
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Update order in database
                updateTopicOrder(topicId);
                
                draggedElement = null;
            }
        };
        
        // Touch events
        row.addEventListener('touchstart', handleTouchStart, { passive: false });
        row.addEventListener('touchmove', handleMove, { passive: false });
        row.addEventListener('touchend', handleEnd);
        row.addEventListener('touchcancel', handleEnd);
        
        // Mouse events
        row.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
        
        // Visual feedback for draggable
        row.style.cursor = 'grab';
        row.style.userSelect = 'none';
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('tr[data-output-id]:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function updateTopicOrder(topicId) {
    const tbody = document.querySelector('#exercisesTableBody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr[data-output-id]'));
    const allLinks = window.demo.lessonTopicLinks || [];
    const allOutputs = window.demo.lessonOutputs || [];
    
    // Validate all output IDs exist
    const invalidOutputs = rows.filter(row => {
        const outputId = row.dataset.outputId;
        return !allOutputs.find(o => o.id === outputId);
    });
    
    if (invalidOutputs.length > 0) {
        console.warn('Some output IDs are invalid:', invalidOutputs.map(r => r.dataset.outputId));
        window.UniUI?.toast?.('Một số bài không tồn tại, đã bỏ qua', 'warning');
        return;
    }
    
    rows.forEach((row, index) => {
        const outputId = row.dataset.outputId;
        if (!outputId) return;
        
        let link = allLinks.find(l => l.topicId === topicId && l.lessonOutputId === outputId);
        
        if (link) {
            link.orderIndex = index;
        } else {
            // Create new link if doesn't exist (only if output exists)
            const outputExists = allOutputs.find(o => o.id === outputId);
            if (outputExists) {
                link = {
                    id: window.UniData.generateId ? window.UniData.generateId('lessonTopicLink') : ('LTL' + Math.random().toString(36).slice(2, 9).toUpperCase()),
                    topicId: topicId,
                    lessonOutputId: outputId,
                    orderIndex: index,
                    createdAt: new Date().toISOString()
                };
                allLinks.push(link);
            }
        }
    });
    
    window.demo.lessonTopicLinks = allLinks;
    
    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            const updatedLinks = [];
            const newLinks = [];
            
            // Update all links
            rows.forEach((row, index) => {
                const outputId = row.dataset.outputId;
                if (!outputId) return;
                
                const link = allLinks.find(l => l.topicId === topicId && l.lessonOutputId === outputId);
                if (link && link.id) {
                    const updated = window.UniLogic.updateEntity('lessonTopicLink', link.id, { orderIndex: index });
                    updatedLinks.push(updated);
                } else if (link && !link.id) {
                    // New link that was just created
                    newLinks.push(link);
                }
            });
            
            const supabaseEntities = {};
            if (updatedLinks.length > 0) {
                supabaseEntities.lessonTopicLinks = updatedLinks;
            }
            if (newLinks.length > 0) {
                supabaseEntities.lessonTopicLinks = [...(supabaseEntities.lessonTopicLinks || []), ...newLinks];
            }
            
            return { supabaseEntities };
        },
        {
            onSuccess: () => {
                window.UniUI?.toast?.('Đã cập nhật thứ tự', 'success');
            },
            onError: (error) => {
                console.error('Error updating order:', error);
                window.UniUI?.toast?.('Không thể cập nhật thứ tự', 'error');
            },
            onRollback: () => {
                // Re-render to show original order
                const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
                const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
                const isAssistant = currentUser?.role === 'assistant';
                const assistantId = isAssistant ? currentUser.linkId : null;
                const exercisesTab = document.querySelector('#tab-exercises');
                if (exercisesTab) {
                    exercisesTab.innerHTML = renderExercisesTab(isAdmin, isAssistant, assistantId);
                    attachExercisesListeners(isAdmin, isAssistant, assistantId);
                    loadExercisesForTopic(topicId, isAdmin);
                }
            }
        }
    );
}

function openTopicModal(topicId = null) {
    const topic = topicId ? (window.demo.lessonTopics || []).find(t => t.id === topicId) : null;
    const isEdit = !!topic;
    
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label>Tên chuyên đề <span class="text-danger">*</span></label>
            <input type="text" name="name" class="form-control" value="${topic?.name || ''}" required placeholder="Nhập tên chuyên đề">
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm'}</button>
        </div>
    `;
    
    window.UniUI.openModal(isEdit ? 'Sửa chuyên đề' : 'Thêm chuyên đề mới', form);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const name = formData.get('name')?.trim();
        
        if (!name) {
            window.UniUI.toast('Vui lòng nhập tên chuyên đề', 'error');
            return;
        }
        
        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                if (isEdit) {
                    // Update topic
                    const data = { name: name };
                    const updated = window.UniLogic.updateEntity('lessonTopic', topicId, data);
                    return {
                        supabaseEntities: {
                            lessonTopics: [updated]
                        }
                    };
                } else {
                    // Create topic
                    const newTopic = {
                        id: window.UniData.generateId ? window.UniData.generateId('lessonTopic') : ('LT' + Math.random().toString(36).slice(2, 9).toUpperCase()),
                        name: name,
                        isDefault: false,
                        level: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    window.UniLogic.createEntity('lessonTopic', newTopic);
                    return {
                        supabaseEntities: {
                            lessonTopics: [newTopic]
                        }
                    };
                }
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    window.UniUI.toast(isEdit ? 'Đã cập nhật chuyên đề' : 'Đã thêm chuyên đề mới', 'success');
                    
                    // Re-render only the exercises tab without full page reload
                    const main = document.querySelector('#main-content');
                    if (main) {
                        const exercisesTab = main.querySelector('#tab-exercises');
                        if (exercisesTab && exercisesTab.classList.contains('active')) {
                            const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
                            const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
                            const isAssistant = currentUser?.role === 'assistant';
                            const assistantId = isAssistant ? currentUser.linkId : null;
                            
                            // Re-render exercises tab content
                            exercisesTab.innerHTML = renderExercisesTab(isAdmin, isAssistant, assistantId);
                            // Re-attach listeners
                            attachExercisesListeners(isAdmin, isAssistant, assistantId);
                        } else {
                            // If not on exercises tab, do full reload
                            const currentTab = getCurrentLessonPlansTab();
                            renderLessonPlans(currentTab);
                        }
                    }
                },
            onError: (error) => {
                console.error('Error saving topic:', error);
                window.UniUI.closeModal();
                window.UniUI.toast('Có lỗi xảy ra', 'error');
                const currentTab = getCurrentLessonPlansTab();
                renderLessonPlans(currentTab);
            },
            onRollback: () => {
                window.UniUI.closeModal();
                const currentTab = getCurrentLessonPlansTab();
                renderLessonPlans(currentTab);
            }
        }
        );
    });
}

async function deleteTopic(topicId) {
    if (!confirm('Bạn có chắc chắn muốn xóa chuyên đề này? Tất cả liên kết bài sẽ bị xóa.')) return;
    
    const topic = (window.demo.lessonTopics || []).find(t => t.id === topicId);
    if (!topic) return;

    // Collect all links to delete
    const allLinks = window.demo.lessonTopicLinks || [];
    const linksToDelete = allLinks.filter(l => l.topicId === topicId);
    const linkIds = linksToDelete.map(l => l.id).filter(Boolean);

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Remove from local data first
            window.demo.lessonTopicLinks = allLinks.filter(l => l.topicId !== topicId);
            const deletedTopic = (window.demo.lessonTopics || []).find(t => t.id === topicId);
            window.demo.lessonTopics = (window.demo.lessonTopics || []).filter(t => t.id !== topicId);
            // Log action for history (like staff page)
            if (deletedTopic && window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'lessonTopic',
                    entityId: topicId,
                    actionType: 'delete',
                    beforeValue: deletedTopic,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa chủ đề: ${deletedTopic.name || topicId}`
                });
            }
            
            // Prepare supabaseDeletes for batch deletion
            const supabaseDeletes = {};
            if (linkIds.length > 0) {
                supabaseDeletes.lessonTopicLinks = linkIds;
            }
            if (topicId) {
                supabaseDeletes.lessonTopics = [topicId];
            }
            
            return { supabaseDeletes };
        },
        {
            onSuccess: () => {
                        // Re-render only the exercises tab without full page reload
                const main = document.querySelector('#main-content');
                if (main) {
                    const exercisesTab = main.querySelector('#tab-exercises');
                    if (exercisesTab && exercisesTab.classList.contains('active')) {
                        const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
                        const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
                        const isAssistant = currentUser?.role === 'assistant';
                        const assistantId = isAssistant ? currentUser.linkId : null;
                        
                        // Re-render exercises tab content
                        exercisesTab.innerHTML = renderExercisesTab(isAdmin, isAssistant, assistantId);
                        // Re-attach listeners
                        attachExercisesListeners(isAdmin, isAssistant, assistantId);
                        // Load "Tất cả" topic after deletion
                        loadExercisesForTopic('all', isAdmin);
                    } else {
                        // If not on exercises tab, do full reload
                        const currentTab = getCurrentLessonPlansTab();
                        renderLessonPlans(currentTab);
                    }
                }
            },
            onError: (error) => {
                console.error('Error deleting topic:', error);
                window.UniUI.toast('Có lỗi xảy ra', 'error');
            },
            onRollback: () => {
                const currentTab = getCurrentLessonPlansTab();
                renderLessonPlans(currentTab);
            }
        }
    );
}

function openAddToTopicModal(outputId) {
    const allTopics = window.demo.lessonTopics || [];
    const allLinks = window.demo.lessonTopicLinks || [];
    const output = (window.demo.lessonOutputs || []).find(o => o.id === outputId);
    
    if (!output) {
        window.UniUI.toast('Không tìm thấy bài', 'error');
        return;
    }
    
    // Get topics that this output is NOT already in
    const linkedTopicIds = allLinks.filter(l => l.lessonOutputId === outputId).map(l => l.topicId);
    const availableTopics = allTopics.filter(t => !t.isDefault && !linkedTopicIds.includes(t.id));
    
    if (availableTopics.length === 0) {
        window.UniUI.toast('Bài đã có trong tất cả các chuyên đề tùy chỉnh', 'info');
        return;
    }
    
    const form = document.createElement('form');
    form.className = 'add-to-topic-form';
    form.innerHTML = `
        <div class="form-group" style="margin-bottom: var(--spacing-4);">
            <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-3);">
                <div style="width: 40px; height: 40px; border-radius: var(--radius-lg); background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-size: var(--font-size-base); font-weight: 600; color: var(--text); margin-bottom: var(--spacing-1);">
                        Chọn chuyên đề để thêm bài
                    </label>
                    <p style="margin: 0; font-size: var(--font-size-sm); color: var(--muted); line-height: 1.5;">
                        <strong style="color: var(--primary);">"${output.lessonName || '-'}"</strong>
                    </p>
                </div>
            </div>
            <div class="topic-selection-list" style="max-height: 320px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-2); background: var(--bg);">
                ${availableTopics.length > 0 ? availableTopics.map(topic => `
                    <label class="topic-option-item" style="display: flex; align-items: center; padding: var(--spacing-3); margin-bottom: var(--spacing-2); cursor: pointer; border-radius: var(--radius); transition: all 0.2s ease; border: 2px solid transparent; background: var(--surface); position: relative;">
                        <input type="checkbox" name="topics" value="${topic.id}" class="topic-checkbox" style="position: absolute; opacity: 0; width: 0; height: 0;">
                        <div class="custom-checkbox" style="width: 20px; height: 20px; border: 2px solid var(--border); border-radius: var(--radius-sm); margin-right: var(--spacing-3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease; background: var(--surface);">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <div style="flex: 1; display: flex; align-items: center; gap: var(--spacing-2);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted); flex-shrink: 0;">
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                            </svg>
                            <span style="font-size: var(--font-size-sm); font-weight: 500; color: var(--text);">${topic.name}</span>
                        </div>
                    </label>
                `).join('') : `
                    <div style="padding: var(--spacing-6); text-align: center; color: var(--muted);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: var(--spacing-2);">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                        <p style="margin: 0; font-size: var(--font-size-sm);">Không còn chuyên đề nào để thêm</p>
                    </div>
                `}
            </div>
        </div>
        <div class="form-actions" style="display: flex; gap: var(--spacing-2); justify-content: flex-end; margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--border);">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()" style="min-width: 100px;">Hủy</button>
            <button type="submit" class="btn btn-primary" style="min-width: 160px; display: flex; align-items: center; justify-content: center; gap: var(--spacing-2);">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Thêm vào chuyên đề
            </button>
        </div>
    `;
    
    window.UniUI.openModal('Thêm bài vào chuyên đề', form);
    
    // Setup custom checkbox interactions
    setTimeout(() => {
        const checkboxes = form.querySelectorAll('.topic-checkbox');
        const customCheckboxes = form.querySelectorAll('.custom-checkbox');
        
        checkboxes.forEach((checkbox, index) => {
            if (index >= customCheckboxes.length) return;
            
            const customCheckbox = customCheckboxes[index];
            const optionItem = checkbox.closest('.topic-option-item');
            if (!optionItem) return;
            
            // Update custom checkbox when real checkbox changes
            const updateCheckbox = () => {
                if (checkbox.checked) {
                    customCheckbox.style.background = 'var(--primary)';
                    customCheckbox.style.borderColor = 'var(--primary)';
                    const checkIcon = customCheckbox.querySelector('svg');
                    if (checkIcon) checkIcon.style.display = 'block';
                    optionItem.style.borderColor = 'var(--primary)';
                    optionItem.style.background = 'rgba(59, 130, 246, 0.05)';
                } else {
                    customCheckbox.style.background = 'var(--surface)';
                    customCheckbox.style.borderColor = 'var(--border)';
                    const checkIcon = customCheckbox.querySelector('svg');
                    if (checkIcon) checkIcon.style.display = 'none';
                    optionItem.style.borderColor = 'transparent';
                    optionItem.style.background = 'var(--surface)';
                }
            };
            
            checkbox.addEventListener('change', updateCheckbox);
            
            // Click on label toggles checkbox
            optionItem.addEventListener('click', (e) => {
                if (e.target !== checkbox && !e.target.closest('.custom-checkbox')) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        });
    }, 100);
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const selectedTopics = formData.getAll('topics');
        
        if (selectedTopics.length === 0) {
            window.UniUI.toast('Vui lòng chọn ít nhất một chuyên đề', 'error');
            return;
        }
        
        try {
            // Validate that output exists
            const allOutputs = window.demo.lessonOutputs || [];
            if (!allOutputs.find(o => o.id === outputId)) {
                window.UniUI.toast('Bài không tồn tại', 'error');
                return;
            }
            
            // Validate that topics exist
            const allTopics = window.demo.lessonTopics || [];
            const invalidTopics = selectedTopics.filter(tId => !allTopics.find(t => t.id === tId));
            if (invalidTopics.length > 0) {
                window.UniUI.toast('Một số chuyên đề không tồn tại', 'error');
                return;
            }
            
            const allLinks = window.demo.lessonTopicLinks || [];
            const maxOrder = Math.max(0, ...allLinks.filter(l => selectedTopics.includes(l.topicId)).map(l => l.orderIndex || 0));
            
            selectedTopics.forEach((topicId, index) => {
                // Check if link already exists
                const existingLink = allLinks.find(l => l.topicId === topicId && l.lessonOutputId === outputId);
                if (existingLink) {
                    // Link already exists, skip
                    return;
                }
                
                const newLink = {
                    id: window.UniData.generateId ? window.UniData.generateId('lessonTopicLink') : ('LTL' + Math.random().toString(36).slice(2, 9).toUpperCase()),
                    topicId: topicId,
                    lessonOutputId: outputId,
                    orderIndex: maxOrder + index + 1,
                    createdAt: new Date().toISOString()
                };
                
                if (window.UniLogic && window.UniLogic.createEntity) {
                    window.UniLogic.createEntity('lessonTopicLink', newLink);
                } else {
                    allLinks.push(newLink);
                }
            });
            
            if (!window.UniLogic || !window.UniLogic.createEntity) {
                window.demo.lessonTopicLinks = allLinks;
                window.UniData.save && window.UniData.save();
            }
            
            window.UniUI.toast('Đã thêm bài vào chuyên đề', 'success');
            window.UniUI.closeModal();
            
            // Reload current topic if needed
            const activeTopic = document.querySelector('.topic-item.active');
            if (activeTopic) {
                const topicId = activeTopic.dataset.topicId;
                const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
                loadExercisesForTopic(topicId, isAdmin);
            }
        } catch (error) {
            console.error('Error adding to topic:', error);
            window.UniUI.toast('Có lỗi xảy ra', 'error');
        }
    });
}

function openExerciseDetailModal(outputId) {
    const output = (window.demo.lessonOutputs || []).find(o => o.id === outputId);
    if (!output) {
        window.UniUI.toast('Không tìm thấy bài tập', 'error');
        return;
    }
    
    // Get staff with lesson_plan role instead of assistants
    const lessonPlanStaff = (window.demo.teachers || []).filter(t => {
        const roles = t.roles || [];
        return roles.includes('lesson_plan');
    });
    const staffMember = output.assistantId ? lessonPlanStaff.find(s => s.id === output.assistantId) : null;
    
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };
    
    const detailContent = document.createElement('div');
    detailContent.className = 'exercise-detail-modal';
    detailContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--spacing-5);">
            <!-- Header Section -->
            <div style="display: flex; align-items: flex-start; gap: var(--spacing-4); padding-bottom: var(--spacing-4); border-bottom: 2px solid var(--border);">
                <div style="width: 56px; height: 56px; border-radius: var(--radius-lg); background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--primary);">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 var(--spacing-2) 0; font-size: var(--font-size-xl); font-weight: 700; color: var(--text); line-height: 1.3;">
                        ${output.lessonName || '-'}
                    </h3>
                    ${output.originalTitle ? `
                        <p style="margin: 0; font-size: var(--font-size-sm); color: var(--muted); font-style: italic;">
                            <strong>Tên gốc:</strong> ${output.originalTitle}
                        </p>
                    ` : ''}
                </div>
            </div>
            
            <!-- Info Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-4);">
                <!-- Tag -->
                <div class="detail-info-item">
                    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                        <label style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Tag</label>
                    </div>
                    <div style="font-size: var(--font-size-base); font-weight: 500; color: var(--text);">
                        ${output.tag ? `<span class="badge badge-info" style="font-size: var(--font-size-sm); padding: 6px 12px;">${output.tag}</span>` : '<span class="text-muted">-</span>'}
                    </div>
                </div>
                
                <!-- Level -->
                <div class="detail-info-item">
                    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <label style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Level</label>
                    </div>
                    <div style="font-size: var(--font-size-base); font-weight: 500; color: var(--text);">
                        <span class="badge" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%); color: var(--primary); border: 1px solid rgba(59, 130, 246, 0.2); font-size: var(--font-size-sm); padding: 6px 12px; font-weight: 500;">
                            ${getDisplayLevel(output.level)}
                        </span>
                    </div>
                </div>
                
                <!-- Người làm -->
                <div class="detail-info-item">
                    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <label style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Người làm</label>
                    </div>
                    <div style="font-size: var(--font-size-base); font-weight: 500; color: var(--text);">
                        ${staffMember ? (staffMember.fullName || staffMember.name || '-') : '<span class="text-muted">-</span>'}
                    </div>
                </div>
                
                <!-- Ngày -->
                <div class="detail-info-item">
                    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <label style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Ngày</label>
                    </div>
                    <div style="font-size: var(--font-size-base); font-weight: 500; color: var(--text);">
                        ${formatDate(output.date)}
                    </div>
                </div>
            </div>
            
            <!-- Contest Section -->
            ${output.contestUploaded ? `
                <div class="detail-section">
                    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-3);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        </svg>
                        <label style="font-size: var(--font-size-sm); font-weight: 600; color: var(--text);">Contest</label>
                    </div>
                    <div style="padding: var(--spacing-3); background: var(--bg); border-radius: var(--radius); border: 1px solid var(--border); font-size: var(--font-size-sm); color: var(--text); line-height: 1.6; white-space: pre-wrap;">
                        ${output.contestUploaded}
                    </div>
                </div>
            ` : ''}
            
            <!-- Link Section -->
            ${output.link ? `
                <div class="detail-section">
                    <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-3);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary);">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        <label style="font-size: var(--font-size-sm); font-weight: 600; color: var(--text);">Link</label>
                    </div>
                    <div style="display: flex; align-items: center; gap: var(--spacing-2);">
                        <a href="${output.link}" target="_blank" rel="noopener noreferrer" style="flex: 1; padding: var(--spacing-2) var(--spacing-3); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); font-size: var(--font-size-sm); color: var(--primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${output.link}">
                            ${output.link}
                        </a>
                        <button type="button" class="btn btn-icon" onclick="copyToClipboard('${output.link}', 'Đã sao chép link');" title="Sao chép link" style="width: 36px; height: 36px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                                <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    window.UniUI.openModal('Chi tiết bài tập', detailContent);
}

function attachTasksListeners(isAdmin, isAssistant, assistantId, hasAccountantRole = false, hasLessonPlanRole = false, lessonPlanStaffId = null) {
    const main = document.querySelector('#main-content');
    if (!main) return;

    const searchInput = main.querySelector('#searchInput');
    const tagFilter = main.querySelector('#tagFilter');
    const statusFilter = main.querySelector('#statusFilter');
    const staffFilter = main.querySelector('#staffFilter');
    const dateFromFilter = main.querySelector('#dateFromFilter');
    const dateToFilter = main.querySelector('#dateToFilter');
    const clearFiltersBtn = main.querySelector('#clearFiltersBtn');
    const toggleFiltersBtn = main.querySelector('#toggleFiltersBtn');
    const filtersContent = main.querySelector('#filtersContent');
    const filtersChevron = main.querySelector('#filtersChevron');
    const filterToggleText = main.querySelector('.filter-toggle-text');
    
    // Month selector event listeners for tasks tab
    const tasksMonthPrevBtn = main.querySelector('#tasksMonthPrev');
    const tasksMonthNextBtn = main.querySelector('#tasksMonthNext');
    const tasksMonthLabelBtn = main.querySelector('#tasksMonthLabelBtn');
    const tasksMonthPopup = main.querySelector('#tasksMonthPopup');
    const tasksYearLabel = main.querySelector('#tasksYearLabel');
    const tasksYearPrevBtn = main.querySelector('#tasksYearPrev');
    const tasksYearNextBtn = main.querySelector('#tasksYearNext');
    const tasksMonthCells = main.querySelectorAll('#tasksMonthPopup .session-month-cell');
    
    function updateTasksMonthFilter(deltaMonth = 0, deltaYear = 0) {
        window.TasksMonthFilter = window.TasksMonthFilter || {};
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthStr = window.TasksMonthFilter.selectedMonth || currentMonth;
        const [year, month] = currentMonthStr.split('-').map(Number);
        
        let newMonth = month + deltaMonth;
        let newYear = year + deltaYear;
        
        if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        } else if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        }
        
        window.TasksMonthFilter.selectedMonth = `${newYear}-${String(newMonth).padStart(2, '0')}`;
        
        // Update UI
        if (tasksYearLabel) tasksYearLabel.textContent = newYear;
        const monthLabel = main.querySelector('#tasksMonthLabel');
        if (monthLabel) monthLabel.textContent = `Tháng ${String(newMonth).padStart(2, '0')}/${newYear}`;
        tasksMonthCells.forEach(cell => {
            const m = cell.getAttribute('data-month');
            cell.classList.toggle('active', m === String(newMonth).padStart(2, '0'));
        });
        
        // Apply filters to reload table
        applyFilters();
    }
    
    if (tasksMonthPrevBtn) {
        tasksMonthPrevBtn.addEventListener('click', () => updateTasksMonthFilter(-1, 0));
    }
    if (tasksMonthNextBtn) {
        tasksMonthNextBtn.addEventListener('click', () => updateTasksMonthFilter(1, 0));
    }
    if (tasksMonthLabelBtn && tasksMonthPopup) {
        tasksMonthLabelBtn.addEventListener('click', () => {
            const isHidden = tasksMonthPopup.style.display === 'none' || tasksMonthPopup.style.display === '';
            tasksMonthPopup.style.display = isHidden ? 'block' : 'none';
        });
    }
    if (tasksYearPrevBtn && tasksYearLabel) {
        tasksYearPrevBtn.addEventListener('click', () => {
            const currentYear = parseInt(tasksYearLabel.textContent);
            tasksYearLabel.textContent = currentYear - 1;
            updateTasksMonthFilter(0, -1);
        });
    }
    if (tasksYearNextBtn && tasksYearLabel) {
        tasksYearNextBtn.addEventListener('click', () => {
            const currentYear = parseInt(tasksYearLabel.textContent);
            tasksYearLabel.textContent = currentYear + 1;
            updateTasksMonthFilter(0, 1);
        });
    }
    tasksMonthCells.forEach(cell => {
        cell.addEventListener('click', () => {
            const m = cell.getAttribute('data-month');
            if (!m) return;
            const currentYear = parseInt(tasksYearLabel?.textContent || new Date().getFullYear());
            window.TasksMonthFilter = window.TasksMonthFilter || {};
            window.TasksMonthFilter.selectedMonth = `${currentYear}-${m}`;
            if (tasksMonthPopup) tasksMonthPopup.style.display = 'none';
            // Update UI
            const monthLabel = main.querySelector('#tasksMonthLabel');
            if (monthLabel) {
                const monthNum = parseInt(m);
                monthLabel.textContent = `Tháng ${monthNum}/${currentYear}`;
            }
            tasksMonthCells.forEach(c => {
                c.classList.toggle('active', c.getAttribute('data-month') === m);
            });
            // Apply filters to reload table
            applyFilters();
        });
    });
    
    // Close popup when clicking outside
    if (tasksMonthPopup && tasksMonthLabelBtn) {
        document.addEventListener('click', (e) => {
            if (!tasksMonthPopup.contains(e.target) && !tasksMonthLabelBtn.contains(e.target)) {
                tasksMonthPopup.style.display = 'none';
            }
        });
    }
    
    // Setup bulk actions
    const canBulkUpdate = Boolean(isAdmin || isAssistant || hasAccountantRole);
    let selectAllCheckbox = null;
    let bulkActions = null;
    let selectedCount = null;
    let bulkUpdateStatusBtn = null;
    let clearSelectionBtn = null;
    let outputCheckboxes = [];
    
    if (canBulkUpdate) {
        selectAllCheckbox = main.querySelector('#selectAllCheckbox');
        bulkActions = main.querySelector('#bulkActions');
        selectedCount = main.querySelector('#selectedCount');
        bulkUpdateStatusBtn = main.querySelector('#bulkUpdateStatusBtn');
        clearSelectionBtn = main.querySelector('#clearSelectionBtn');
        outputCheckboxes = Array.from(main.querySelectorAll('.output-checkbox'));
    }
    
    function updateBulkActions() {
        if (!canBulkUpdate) return;
        const checked = main.querySelectorAll('.output-checkbox:checked');
        const count = checked.length;
        
        if (bulkActions) {
            bulkActions.style.display = count > 0 ? 'flex' : 'none';
        }
        
        if (selectedCount) {
            selectedCount.textContent = count > 0 ? `Đã chọn: ${count} bài` : '';
        }
        
        if (selectAllCheckbox) {
            const allChecked = outputCheckboxes.length > 0 && checked.length === outputCheckboxes.length;
            const someChecked = checked.length > 0 && checked.length < outputCheckboxes.length;
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked;
        }
    }
    
    if (canBulkUpdate && selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            outputCheckboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
            });
            updateBulkActions();
        });
    }
    
    if (canBulkUpdate) {
        outputCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                updateBulkActions();
            });
        });
    }
    
    if (canBulkUpdate && clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => {
            outputCheckboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            if (selectAllCheckbox) selectAllCheckbox.checked = false;
            updateBulkActions();
        });
    }
    
    if (canBulkUpdate && bulkUpdateStatusBtn) {
        bulkUpdateStatusBtn.addEventListener('click', async () => {
            const checked = Array.from(main.querySelectorAll('.output-checkbox:checked'));
            if (checked.length === 0) {
                window.UniUI.toast('Vui lòng chọn ít nhất một bài', 'warning');
                return;
            }
            
            const outputIds = checked.map(cb => cb.dataset.outputId).filter(Boolean);
            
            const statusModal = document.createElement('div');
            statusModal.innerHTML = `
                <div style="padding: var(--spacing-4);">
                    <p style="margin: 0 0 var(--spacing-4) 0; font-size: var(--font-size-base); color: var(--text);">
                        Chọn trạng thái thanh toán cho <strong>${outputIds.length}</strong> bài đã chọn:
                    </p>
                    <div style="display: flex; flex-direction: column; gap: var(--spacing-2);">
                        <button type="button" class="btn btn-block" data-status="paid" style="justify-content: flex-start; padding: var(--spacing-3); background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #047857;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--spacing-2);">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            Đã thanh toán
                        </button>
                        <button type="button" class="btn btn-block" data-status="deposit" style="justify-content: flex-start; padding: var(--spacing-3); background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); color: #92400e;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--spacing-2);">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            Cọc
                        </button>
                        <button type="button" class="btn btn-block" data-status="pending" style="justify-content: flex-start; padding: var(--spacing-3); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #991b1b;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: var(--spacing-2);">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            Chưa thanh toán
                        </button>
                    </div>
                </div>
            `;
            
            window.UniUI.openModal('Chuyển trạng thái thanh toán', statusModal);
            
            statusModal.querySelectorAll('button[data-status]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const newStatus = btn.dataset.status;
                    
                    try {
                        let updatedCount = 0;
                        for (const outputId of outputIds) {
                            const output = (window.demo.lessonOutputs || []).find(o => o.id === outputId);
                            if (output) {
                                const data = { status: newStatus };
                                const oldOutput = { ...output };
                                
                                if (window.UniLogic && window.UniLogic.updateEntity) {
                                    await window.UniLogic.updateEntity('lessonOutput', outputId, data);
                                    
                                    // Log action for history (like staff page)
                                    if (window.ActionHistoryService) {
                                        const updatedOutput = window.demo.lessonOutputs.find(o => o.id === outputId);
                                        if (updatedOutput) {
                                            const changedFields = window.ActionHistoryService.getChangedFields(oldOutput, updatedOutput);
                                            window.ActionHistoryService.recordAction({
                                                entityType: 'lessonOutput',
                                                entityId: outputId,
                                                actionType: 'update',
                                                beforeValue: oldOutput,
                                                afterValue: updatedOutput,
                                                changedFields: changedFields,
                                                description: `Cập nhật bài đã làm: ${updatedOutput.lessonName || updatedOutput.originalTitle || outputId}`
                                            });
                                        }
                                    }
                                } else {
                                    const index = window.demo.lessonOutputs.findIndex(o => o.id === outputId);
                                    if (index >= 0) {
                                        window.demo.lessonOutputs[index] = {
                                            ...window.demo.lessonOutputs[index],
                                            ...data,
                                            updatedAt: new Date().toISOString()
                                        };
                                        
                                        // Log action for history (like staff page)
                                        if (window.ActionHistoryService) {
                                            const changedFields = window.ActionHistoryService.getChangedFields(oldOutput, window.demo.lessonOutputs[index]);
                                            window.ActionHistoryService.recordAction({
                                                entityType: 'lessonOutput',
                                                entityId: outputId,
                                                actionType: 'update',
                                                beforeValue: oldOutput,
                                                afterValue: window.demo.lessonOutputs[index],
                                                changedFields: changedFields,
                                                description: `Cập nhật bài đã làm: ${window.demo.lessonOutputs[index].lessonName || window.demo.lessonOutputs[index].originalTitle || outputId}`
                                            });
                                        }
                                    }
                                    window.UniData.save && window.UniData.save();
                                }
                                updatedCount++;
                            }
                        }
                        
                        window.UniUI.closeModal();
                        window.UniUI.toast(`Đã cập nhật trạng thái cho ${updatedCount} bài`, 'success');
                        
                        // Clear selection
                        outputCheckboxes.forEach(checkbox => {
                            checkbox.checked = false;
                        });
                        if (selectAllCheckbox) selectAllCheckbox.checked = false;
                        updateBulkActions();
                        
                        // Refresh table
                        renderLessonPlans('tasks');
                    } catch (error) {
                        console.error('Error updating status:', error);
                        window.UniUI.toast('Có lỗi xảy ra khi cập nhật', 'error');
                    }
                });
            });
        });
    }
    
    // Output table row click handlers
    const outputRows = main.querySelectorAll('#outputsTableBody tr[data-output-id]');
    outputRows.forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a') || e.target.closest('input[type="checkbox"]')) return;
            
            const outputId = row.dataset.outputId;
            if ((isAdmin || isAssistant || hasAccountantRole) && outputId) {
                openOutputModal(outputId);
            }
        });
    });

    // Form toggle and handlers
    const toggleOutputForm = main.querySelector('#toggleOutputForm');
    const outputForm = main.querySelector('#outputForm');
    const cancelOutputBtn = main.querySelector('#cancelOutputBtn');
    const toggleOutputIcon = main.querySelector('#toggleOutputIcon');
    
    // Setup cost input with preview
    if (outputForm) {
        const outputCostInput = outputForm.querySelector('#outputCost');
        const outputCostPreview = outputForm.querySelector('#outputCostPreview');
        if (outputCostInput && outputCostPreview) {
            setupCostInput(outputCostInput, outputCostPreview);
        }
        
        // Setup duplicate checking
        setupDuplicateCheck();
    }
    
    // Setup tag multi-select functionality for add form
    if ((isAdmin || isAssistant || hasLessonPlanRole) && outputForm) {
        const tagInput = outputForm.querySelector('#outputTag');
        const tagDropdown = outputForm.querySelector('#tagDropdown');
        const tagDropdownList = outputForm.querySelector('#tagDropdownList');
        const selectedTagsContainer = outputForm.querySelector('#selectedTagsContainer');
        
        // Create hidden input to store selected tags
        let selectedTagsInput = outputForm.querySelector('#selectedTagsInput');
        if (!selectedTagsInput) {
            selectedTagsInput = document.createElement('input');
            selectedTagsInput.type = 'hidden';
            selectedTagsInput.id = 'selectedTagsInput';
            selectedTagsInput.name = 'selectedTags';
            selectedTagsInput.value = '[]';
            outputForm.appendChild(selectedTagsInput);
        }
        
        let selectedTags = JSON.parse(selectedTagsInput.value || '[]');
        
        // Function to render selected tags with animation
        function renderSelectedTags() {
            if (!selectedTagsContainer) return;
            
            // Add count badge if tags exist
            const existingCount = selectedTagsContainer.querySelector('.tag-count-badge');
            if (existingCount) existingCount.remove();
            
            if (selectedTags.length > 0) {
                const countBadge = document.createElement('span');
                countBadge.className = 'tag-count-badge';
                countBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: var(--font-size-xs); background: var(--bg); color: var(--muted); border-radius: var(--radius-sm); font-weight: 500; margin-right: var(--spacing-1);';
                countBadge.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    </svg>
                    ${selectedTags.length}
                `;
                selectedTagsContainer.insertBefore(countBadge, selectedTagsContainer.firstChild);
            }
            
            // Remove old badges (keep count badge)
            const oldBadges = selectedTagsContainer.querySelectorAll('.tag-badge-selected');
            oldBadges.forEach(badge => badge.remove());
            
            // Add new badges with animation
            selectedTags.forEach((tag, index) => {
                const tagBadge = document.createElement('span');
                tagBadge.className = 'tag-badge-selected';
                tagBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: var(--font-size-xs); background: var(--primary); color: white; border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; font-weight: 500; user-select: none; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); opacity: 0; transform: scale(0.8);';
                tagBadge.innerHTML = `
                    <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tag}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="cursor: pointer; flex-shrink: 0; opacity: 0.9;">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                
                // Animate in
                setTimeout(() => {
                    tagBadge.style.opacity = '1';
                    tagBadge.style.transform = 'scale(1)';
                }, index * 30);
                
                tagBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Animate out
                    tagBadge.style.opacity = '0';
                    tagBadge.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        selectedTags = selectedTags.filter((_, i) => i !== index);
                        selectedTagsInput.value = JSON.stringify(selectedTags);
                        renderSelectedTags();
                        if (tagInput) {
                            renderTagDropdown(tagInput.value);
                            tagInput.focus();
                        }
                    }, 200);
                });
                tagBadge.addEventListener('mouseenter', () => {
                    tagBadge.style.background = 'var(--danger)';
                    tagBadge.style.transform = 'scale(1.05)';
                    tagBadge.style.boxShadow = '0 2px 6px rgba(244, 63, 94, 0.3)';
                });
                tagBadge.addEventListener('mouseleave', () => {
                    tagBadge.style.background = 'var(--primary)';
                    tagBadge.style.transform = 'scale(1)';
                    tagBadge.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                });
                selectedTagsContainer.appendChild(tagBadge);
            });
        }
        
        // Function to get tag level (for grouping)
        function getTagLevel(tag) {
            const tagLower = tag.toLowerCase();
            // Level 0
            if (['nhập/xuất', 'input/output', 'i/o', 'câu lệnh rẽ nhánh', 'conditional', 'if-else', 'vòng lặp', 'loop', 'iteration', 'mảng', 'array', 'chuỗi', 'string', 'struct', 'hàm', 'function', 'truy vấn', 'query'].some(t => tagLower.includes(t))) {
                return 0;
            }
            // Level 1
            if (['đệ quy', 'recursion', 'brute force', 'vét cạn', 'greedy', 'sorting', 'prefixsum', 'gcd', 'lcm', 'nguyên tố', 'prime'].some(t => tagLower.includes(t))) {
                return 1;
            }
            // Level 2
            if (['binary search', 'tìm kiếm nhị phân', 'hai con trỏ', 'two pointer', 'vector', 'pair', 'set', 'map', 'euclid'].some(t => tagLower.includes(t))) {
                return 2;
            }
            // Level 3
            if (['modular', 'tổ hợp', 'combination', 'stack', 'queue', 'graph', 'dfs', 'bfs', 'segment tree', 'fenwick', 'dp', 'dynamic programming', 'hashing', 'trie', 'kmp'].some(t => tagLower.includes(t))) {
                return 3;
            }
            // Level 4
            if (['dijkstra', 'floyd', 'dsu', 'mst', 'euler', 'lca', 'bitmask', 'game theory'].some(t => tagLower.includes(t))) {
                return 4;
            }
            // Level 5
            if (['sweep line', 'gauss', 'persistent', 'rollback', '2-sat', 'hld', 'centroid', 'flow', 'convex hull'].some(t => tagLower.includes(t))) {
                return 5;
            }
            return -1;
        }
        
        // Function to render dropdown options with prefix matching and grouping
        function renderTagDropdown(searchTerm = '') {
            if (!tagDropdown || !tagDropdownList) return;
            
            const searchLower = searchTerm.toLowerCase().trim();
            
            // Filter tags that start with search term (prefix match) or contain it
            const filteredTags = PREDEFINED_TAGS
                .filter(tag => !selectedTags.includes(tag))
                .map(tag => {
                    const tagLower = tag.toLowerCase();
                    const startsWith = tagLower.startsWith(searchLower);
                    const contains = tagLower.includes(searchLower);
                    return {
                        tag,
                        level: getTagLevel(tag),
                        startsWith,
                        contains,
                        index: startsWith ? tagLower.indexOf(searchLower) : (contains ? tagLower.indexOf(searchLower) : -1)
                    };
                })
                .filter(item => item.contains)
                .sort((a, b) => {
                    // Sort: starts with first, then by level, then by index position
                    if (a.startsWith && !b.startsWith) return -1;
                    if (!a.startsWith && b.startsWith) return 1;
                    if (a.level !== b.level) return a.level - b.level;
                    return a.index - b.index;
                });
            
            if (filteredTags.length === 0) {
                if (searchLower) {
                    tagDropdownList.innerHTML = `
                        <div class="tag-dropdown-empty" style="padding: var(--spacing-5); text-align: center; color: var(--muted);">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin: 0 auto var(--spacing-3); display: block;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <p style="margin: 0; font-size: var(--font-size-sm); font-weight: 500;">Không tìm thấy tag nào</p>
                            <p style="margin: var(--spacing-2) 0 0 0; font-size: var(--font-size-xs); opacity: 0.7;">Thử tìm kiếm với từ khóa khác</p>
                        </div>
                    `;
                } else {
                    // Show popular tags when empty
                    const popularTags = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
                    const availablePopular = popularTags.filter(t => !selectedTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
                    
                    tagDropdownList.innerHTML = `
                        <div style="padding: var(--spacing-3); border-bottom: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                                </svg>
                                <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Tags phổ biến</span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-1);">
                                ${availablePopular.map(tag => `
                                    <span class="tag-suggestion-chip" data-tag="${tag}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: var(--font-size-xs); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; color: var(--text);">
                                        ${tag}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                        <div style="padding: var(--spacing-3); text-align: center; color: var(--muted); font-size: var(--font-size-xs);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5; margin-right: 4px; vertical-align: middle;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            Gõ để tìm kiếm tag...
                        </div>
                    `;
                    
                    // Add click handlers for popular tags
                    tagDropdownList.querySelectorAll('.tag-suggestion-chip').forEach(chip => {
                        chip.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const tag = chip.dataset.tag;
                            if (!selectedTags.includes(tag)) {
                                selectedTags.push(tag);
                                selectedTagsInput.value = JSON.stringify(selectedTags);
                                renderSelectedTags();
                                if (tagInput) {
                                    tagInput.value = '';
                                    tagDropdown.style.display = 'none';
                                    tagInput.focus();
                                }
                            }
                        });
                        chip.addEventListener('mouseenter', () => {
                            chip.style.background = 'var(--primary)';
                            chip.style.color = 'white';
                            chip.style.borderColor = 'var(--primary)';
                            chip.style.transform = 'scale(1.05)';
                        });
                        chip.addEventListener('mouseleave', () => {
                            chip.style.background = 'var(--bg)';
                            chip.style.color = 'var(--text)';
                            chip.style.borderColor = 'var(--border)';
                            chip.style.transform = 'scale(1)';
                        });
                    });
                }
                tagDropdown.style.display = 'block';
                return;
            }
            
            // Group by level if no search term
            const levelGroups = {};
            filteredTags.forEach(item => {
                const level = item.level >= 0 ? item.level : 'other';
                if (!levelGroups[level]) levelGroups[level] = [];
                levelGroups[level].push(item);
            });
            
            const levelNames = {
                0: 'Level 0: Nền tảng',
                1: 'Level 1: Thuật toán cơ bản',
                2: 'Level 2: Tìm kiếm & Toán',
                3: 'Level 3: Thuật toán quan trọng',
                4: 'Level 4: Nâng cao',
                5: 'Level 5: Chuyên sâu',
                other: 'Khác'
            };
            
            const levelColors = {
                0: 'rgba(59, 130, 246, 0.1)',
                1: 'rgba(34, 197, 94, 0.1)',
                2: 'rgba(251, 191, 36, 0.1)',
                3: 'rgba(168, 85, 247, 0.1)',
                4: 'rgba(239, 68, 68, 0.1)',
                5: 'rgba(236, 72, 153, 0.1)',
                other: 'rgba(107, 114, 128, 0.1)'
            };
            
            // Render grouped or flat list
            if (!searchLower && Object.keys(levelGroups).length > 1) {
                // Grouped view
                tagDropdownList.innerHTML = Object.keys(levelGroups).sort((a, b) => {
                    if (a === 'other') return 1;
                    if (b === 'other') return -1;
                    return Number(a) - Number(b);
                }).map(level => {
                    const tags = levelGroups[level].slice(0, 8);
                    return `
                        <div class="tag-level-group" data-level="${level}">
                            <div class="tag-level-header" style="padding: var(--spacing-2) var(--spacing-3); background: ${levelColors[level]}; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);">
                                <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">${levelNames[level]}</span>
                                <span style="font-size: var(--font-size-xs); color: var(--muted); opacity: 0.7;">(${tags.length})</span>
                            </div>
                            ${tags.map(item => {
                                const tag = item.tag;
                                let displayTag = tag;
                                if (searchLower) {
                                    const tagLower = tag.toLowerCase();
                                    const matchIndex = tagLower.indexOf(searchLower);
                                    if (matchIndex !== -1) {
                                        const before = tag.substring(0, matchIndex);
                                        const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                        const after = tag.substring(matchIndex + searchLower.length);
                                        displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                                    }
                                }
                                return `
                                    <div class="tag-dropdown-item" style="padding: var(--spacing-2) var(--spacing-3); cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);" data-tag="${tag}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0; opacity: 0.6;">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                        </svg>
                                        <span style="font-size: var(--font-size-sm); color: var(--text); flex: 1;">${displayTag}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('');
            } else {
                // Flat list view (when searching)
                tagDropdownList.innerHTML = `
                    <div style="padding: var(--spacing-2) var(--spacing-3); border-bottom: 1px solid var(--border); background: var(--bg); display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted);">
                            ${filteredTags.length} kết quả
                        </span>
                        ${filteredTags.length > 15 ? `<span style="font-size: var(--font-size-xs); color: var(--muted); opacity: 0.7;">Hiển thị 15 đầu tiên</span>` : ''}
                    </div>
                    ${filteredTags.slice(0, 15).map(item => {
                        const tag = item.tag;
                        let displayTag = tag;
                        if (searchLower) {
                            const tagLower = tag.toLowerCase();
                            const matchIndex = tagLower.indexOf(searchLower);
                            if (matchIndex !== -1) {
                                const before = tag.substring(0, matchIndex);
                                const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                const after = tag.substring(matchIndex + searchLower.length);
                                displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                            }
                        }
                        return `
                            <div class="tag-dropdown-item" style="padding: var(--spacing-3); cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);" data-tag="${tag}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0;">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                <span style="font-size: var(--font-size-sm); color: var(--text); flex: 1;">${displayTag}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted); opacity: 0.5;">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </div>
                        `;
                    }).join('')}
                `;
            }
            
            // Add click handlers
            tagDropdownList.querySelectorAll('.tag-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tag = item.dataset.tag;
                    if (!selectedTags.includes(tag)) {
                        selectedTags.push(tag);
                        selectedTagsInput.value = JSON.stringify(selectedTags);
                        renderSelectedTags();
                        if (tagInput) {
                            tagInput.value = '';
                            tagDropdown.style.display = 'none';
                            tagInput.focus();
                        }
                    }
                });
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--bg)';
                    item.style.transform = 'translateX(2px)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                    item.style.transform = 'translateX(0)';
                });
            });
            
            tagDropdown.style.display = 'block';
        }
        
        // Input event for search with debounce
        let searchTimeout = null;
        if (tagInput) {
            tagInput.addEventListener('input', (e) => {
                const value = e.target.value;
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (value.trim()) {
                        renderTagDropdown(value);
                    } else {
                        renderTagDropdown(''); // Show all available tags when empty
                    }
                }, 150);
            });
            
            tagInput.addEventListener('focus', () => {
                if (tagInput.value.trim()) {
                    renderTagDropdown(tagInput.value);
                } else {
                    renderTagDropdown(''); // Show suggestions when focused
                }
            });
            
            tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const firstItem = tagDropdownList?.querySelector('.tag-dropdown-item');
                    if (firstItem) {
                        firstItem.click();
                    }
                } else if (e.key === 'Escape') {
                    if (tagDropdown) tagDropdown.style.display = 'none';
                    tagInput.blur();
                } else if (e.key === 'Backspace' && tagInput.value === '' && selectedTags.length > 0) {
                    // Remove last tag when backspace on empty input
                    selectedTags.pop();
                    selectedTagsInput.value = JSON.stringify(selectedTags);
                    renderSelectedTags();
                    renderTagDropdown('');
                }
            });
            
            // Click on wrapper to focus input
            const tagWrapper = tagInput.closest('.tag-input-wrapper');
            if (tagWrapper) {
                tagWrapper.addEventListener('click', (e) => {
                    if (e.target !== tagInput && !e.target.closest('.tag-badge-selected')) {
                        tagInput.focus();
                    }
                });
            }
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const tagContainer = tagInput?.closest('.tag-select-container');
            if (tagContainer && !tagContainer.contains(e.target)) {
                if (tagDropdown) tagDropdown.style.display = 'none';
            }
        });
        
        // Initialize
        renderSelectedTags();
    }

    function applyFilters() {
        const allOutputs = window.demo.lessonOutputs || [];
        const outputs = isAssistant && assistantId
            ? allOutputs.filter(o => o.assistantId === assistantId)
            : allOutputs;
        
        const search = (searchInput?.value || '').toLowerCase();
        // Get selected tags from hidden input (JSON array)
        const filterSelectedTagsInput = main.querySelector('#filterSelectedTagsInput');
        const selectedTags = filterSelectedTagsInput 
            ? JSON.parse(filterSelectedTagsInput.value || '[]')
            : [];
        const status = statusFilter?.value || '';
        const staffId = staffFilter?.value || '';
        const dateFrom = dateFromFilter?.value || '';
        const dateTo = dateToFilter?.value || '';
        
        // Get month filter
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        window.TasksMonthFilter = window.TasksMonthFilter || {};
        const selectedMonth = window.TasksMonthFilter.selectedMonth || currentMonth;

        const filtered = outputs.filter(output => {
            if (search && !(
                (output.lessonName || '').toLowerCase().includes(search) ||
                (output.tag || '').toLowerCase().includes(search)
            )) return false;

            // Check if output has any of the selected tags (comma-separated or array)
            if (selectedTags.length > 0) {
                const outputTags = (output.tag || '').split(',').map(t => t.trim()).filter(Boolean);
                const hasMatchingTag = selectedTags.some(selectedTag => 
                    outputTags.some(outputTag => 
                        outputTag.toLowerCase() === selectedTag.toLowerCase()
                    )
                );
                if (!hasMatchingTag) return false;
            }
            if (status && output.status !== status) return false;
            if (staffId && output.assistantId !== staffId) return false;
            if (dateFrom && output.date && output.date < dateFrom) return false;
            if (dateTo && output.date && output.date > dateTo) return false;
            
            // Filter by month (only filter if output has a date)
            if (output.createdAt || output.date) {
                const itemDate = output.createdAt || output.date;
                if (itemDate) {
                    const itemMonth = itemDate.toString().slice(0, 7); // YYYY-MM format
                    if (itemMonth !== selectedMonth) return false;
                }
            } else {
                // If output has no date, don't show it when filtering by month
                // (to avoid showing old data without dates)
                return false;
            }

            return true;
        });

        const tbody = main.querySelector('#outputsTableBody');
        if (tbody) {
            // Get hasLessonPlanRole from current context
            const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
            const hasLessonPlanRole = window.UniUI?.userHasStaffRole ? window.UniUI.userHasStaffRole('lesson_plan') : false;
            tbody.innerHTML = renderOutputsTable(filtered, isAdmin, isAssistant, hasAccountantRole, hasLessonPlanRole);
            
            // Re-attach checkbox handlers
            const newCheckboxes = main.querySelectorAll('.output-checkbox');
            const selectAllCheckbox = main.querySelector('#selectAllCheckbox');
            const bulkActions = main.querySelector('#bulkActions');
            const selectedCount = main.querySelector('#selectedCount');
            
            // Helper function to update bulk actions
            const updateBulkActionsLocal = () => {
                const checked = main.querySelectorAll('.output-checkbox:checked');
                const count = checked.length;
                
                if (bulkActions) {
                    bulkActions.style.display = count > 0 ? 'flex' : 'none';
                }
                
                if (selectedCount) {
                    selectedCount.textContent = count > 0 ? `Đã chọn: ${count} bài` : '';
                }
                
                if (selectAllCheckbox) {
                    const allChecked = newCheckboxes.length > 0 && count === newCheckboxes.length;
                    const someChecked = count > 0 && count < newCheckboxes.length;
                    selectAllCheckbox.checked = allChecked;
                    selectAllCheckbox.indeterminate = someChecked;
                }
            };
            
            newCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    updateBulkActionsLocal();
                });
            });
            
            if (selectAllCheckbox) {
                // Remove old listener if exists
                const newSelectAll = selectAllCheckbox.cloneNode(true);
                selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);
                
                newSelectAll.addEventListener('change', (e) => {
                    newCheckboxes.forEach(checkbox => {
                        checkbox.checked = e.target.checked;
                    });
                    updateBulkActionsLocal();
                });
            }
            
            // Re-attach row click handlers after filtering
            const newOutputRows = main.querySelectorAll('#outputsTableBody tr[data-output-id]');
            newOutputRows.forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a') || e.target.closest('input[type="checkbox"]')) return;
                    const outputId = row.dataset.outputId;
                    if ((isAdmin || isAssistant || hasLessonPlanRole) && outputId) {
                        openOutputModal(outputId);
                    }
                });
            });
            
            // Reset bulk actions
            updateBulkActionsLocal();
        }
    }

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (staffFilter) staffFilter.addEventListener('change', applyFilters);
    if (dateFromFilter) dateFromFilter.addEventListener('change', applyFilters);
    if (dateToFilter) dateToFilter.addEventListener('change', applyFilters);
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            const filterSelectedTagsInput = main.querySelector('#filterSelectedTagsInput');
            const filterSelectedTagsContainer = main.querySelector('#filterSelectedTagsContainer');
            if (filterSelectedTagsInput) filterSelectedTagsInput.value = '[]';
            if (filterSelectedTagsContainer) filterSelectedTagsContainer.innerHTML = '';
            if (statusFilter) statusFilter.value = '';
            if (staffFilter) staffFilter.value = '';
            if (dateFromFilter) dateFromFilter.value = '';
            if (dateToFilter) dateToFilter.value = '';
            // Reset month filter to current month
            const currentDate = new Date();
            const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            window.TasksMonthFilter = window.TasksMonthFilter || {};
            window.TasksMonthFilter.selectedMonth = currentMonth;
            // Update month selector UI
            if (tasksYearLabel) tasksYearLabel.textContent = currentDate.getFullYear();
            const monthLabel = main.querySelector('#tasksMonthLabel');
            if (monthLabel) monthLabel.textContent = `Tháng ${String(currentDate.getMonth() + 1).padStart(2, '0')}/${currentDate.getFullYear()}`;
            tasksMonthCells.forEach(cell => {
                const m = cell.getAttribute('data-month');
                cell.classList.toggle('active', m === String(currentDate.getMonth() + 1).padStart(2, '0'));
            });
            applyFilters();
        });
    }
    
    // Setup tag multi-select for filter
    const filterTagInput = main.querySelector('#tagFilter.tag-search-input');
    const filterTagInputWrapper = main.querySelector('#filterTagInputWrapper');
    const filterTagDropdown = main.querySelector('#filterTagDropdown');
    const filterTagDropdownList = main.querySelector('#filterTagDropdownList');
    const filterSelectedTagsContainer = main.querySelector('#filterSelectedTagsContainer');
    const filterSelectedTagsInput = main.querySelector('#filterSelectedTagsInput');
    
    if (filterTagInput && filterTagDropdown && filterTagDropdownList && filterSelectedTagsContainer && filterSelectedTagsInput) {
        let filterSelectedTags = JSON.parse(filterSelectedTagsInput.value || '[]');
        
        // Function to render selected tags for filter
        function renderFilterSelectedTags() {
            if (!filterSelectedTagsContainer) return;
            filterSelectedTagsContainer.innerHTML = '';
            
            if (filterSelectedTags.length > 0) {
                const countBadge = document.createElement('span');
                countBadge.className = 'tag-count-badge';
                countBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: var(--font-size-xs); background: var(--bg); color: var(--muted); border-radius: var(--radius-sm); font-weight: 500; margin-right: var(--spacing-1);';
                countBadge.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                    </svg>
                    ${filterSelectedTags.length}
                `;
                filterSelectedTagsContainer.appendChild(countBadge);
            }
            
            filterSelectedTags.forEach((tag, index) => {
                const tagBadge = document.createElement('span');
                tagBadge.className = 'tag-badge-selected';
                tagBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: var(--font-size-xs); background: var(--primary); color: white; border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; font-weight: 500; user-select: none; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);';
                tagBadge.innerHTML = `
                    <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tag}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="cursor: pointer; flex-shrink: 0; opacity: 0.9;">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                `;
                
                tagBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    filterSelectedTags = filterSelectedTags.filter((_, i) => i !== index);
                    filterSelectedTagsInput.value = JSON.stringify(filterSelectedTags);
                    renderFilterSelectedTags();
                    renderFilterTagDropdown(filterTagInput.value);
                    applyFilters();
                });
                
                tagBadge.addEventListener('mouseenter', () => {
                    tagBadge.style.background = 'var(--danger)';
                    tagBadge.style.transform = 'scale(1.05)';
                });
                
                tagBadge.addEventListener('mouseleave', () => {
                    tagBadge.style.background = 'var(--primary)';
                    tagBadge.style.transform = 'scale(1)';
                });
                
                filterSelectedTagsContainer.appendChild(tagBadge);
            });
        }
        
        // Function to get tag level (reuse from add form)
        function getTagLevel(tag) {
            const tagLower = tag.toLowerCase();
            if (['nhập/xuất', 'input/output', 'i/o', 'câu lệnh rẽ nhánh', 'conditional', 'if-else', 'vòng lặp', 'loop', 'iteration', 'mảng', 'array', 'chuỗi', 'string', 'struct', 'hàm', 'function', 'truy vấn', 'query'].some(t => tagLower.includes(t))) return 0;
            if (['đệ quy', 'recursion', 'brute force', 'vét cạn', 'greedy', 'sorting', 'prefixsum', 'gcd', 'lcm', 'nguyên tố', 'prime'].some(t => tagLower.includes(t))) return 1;
            if (['binary search', 'tìm kiếm nhị phân', 'hai con trỏ', 'two pointer', 'vector', 'pair', 'set', 'map', 'euclid'].some(t => tagLower.includes(t))) return 2;
            if (['modular', 'tổ hợp', 'combination', 'stack', 'queue', 'graph', 'dfs', 'bfs', 'segment tree', 'fenwick', 'dp', 'dynamic programming', 'hashing', 'trie', 'kmp'].some(t => tagLower.includes(t))) return 3;
            if (['dijkstra', 'floyd', 'dsu', 'mst', 'euler', 'lca', 'bitmask', 'game theory'].some(t => tagLower.includes(t))) return 4;
            if (['sweep line', 'gauss', 'persistent', 'rollback', '2-sat', 'hld', 'centroid', 'flow', 'convex hull'].some(t => tagLower.includes(t))) return 5;
            return -1;
        }
        
        // Function to render dropdown for filter (reuse logic from add form)
        function renderFilterTagDropdown(searchTerm = '') {
            if (!filterTagDropdown || !filterTagDropdownList) return;
            
            const searchLower = searchTerm.toLowerCase().trim();
            
            const filteredTags = PREDEFINED_TAGS
                .filter(tag => !filterSelectedTags.includes(tag))
                .map(tag => {
                    const tagLower = tag.toLowerCase();
                    const startsWith = tagLower.startsWith(searchLower);
                    const contains = tagLower.includes(searchLower);
                    return {
                        tag,
                        level: getTagLevel(tag),
                        startsWith,
                        contains,
                        index: startsWith ? tagLower.indexOf(searchLower) : (contains ? tagLower.indexOf(searchLower) : -1)
                    };
                })
                .filter(item => item.contains)
                .sort((a, b) => {
                    if (a.startsWith && !b.startsWith) return -1;
                    if (!a.startsWith && b.startsWith) return 1;
                    if (a.level !== b.level) return a.level - b.level;
                    return a.index - b.index;
                });
            
            if (filteredTags.length === 0) {
                if (searchLower) {
                    filterTagDropdownList.innerHTML = `
                        <div class="tag-dropdown-empty" style="padding: var(--spacing-5); text-align: center; color: var(--muted);">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin: 0 auto var(--spacing-3); display: block;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <p style="margin: 0; font-size: var(--font-size-sm); font-weight: 500;">Không tìm thấy tag nào</p>
                            <p style="margin: var(--spacing-2) 0 0 0; font-size: var(--font-size-xs); opacity: 0.7;">Thử tìm kiếm với từ khóa khác</p>
                        </div>
                    `;
                } else {
                    const popularTags = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
                    const availablePopular = popularTags.filter(t => !filterSelectedTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
                    
                    filterTagDropdownList.innerHTML = `
                        <div style="padding: var(--spacing-3); border-bottom: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                                </svg>
                                <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Tags phổ biến</span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-1);">
                                ${availablePopular.map(tag => `
                                    <span class="tag-suggestion-chip" data-tag="${tag}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: var(--font-size-xs); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; color: var(--text);">
                                        ${tag}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                        <div style="padding: var(--spacing-3); text-align: center; color: var(--muted); font-size: var(--font-size-xs);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5; margin-right: 4px; vertical-align: middle;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            Gõ để tìm kiếm tag...
                        </div>
                    `;
                    
                    filterTagDropdownList.querySelectorAll('.tag-suggestion-chip').forEach(chip => {
                        chip.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const tag = chip.dataset.tag;
                            if (!filterSelectedTags.includes(tag)) {
                                filterSelectedTags.push(tag);
                                filterSelectedTagsInput.value = JSON.stringify(filterSelectedTags);
                                renderFilterSelectedTags();
                                renderFilterTagDropdown('');
                                applyFilters();
                                if (filterTagInput) {
                                    filterTagInput.value = '';
                                    filterTagDropdown.style.display = 'none';
                                    filterTagInput.focus();
                                }
                            }
                        });
                        chip.addEventListener('mouseenter', () => {
                            chip.style.background = 'var(--primary)';
                            chip.style.color = 'white';
                            chip.style.borderColor = 'var(--primary)';
                            chip.style.transform = 'scale(1.05)';
                        });
                        chip.addEventListener('mouseleave', () => {
                            chip.style.background = 'var(--bg)';
                            chip.style.color = 'var(--text)';
                            chip.style.borderColor = 'var(--border)';
                            chip.style.transform = 'scale(1)';
                        });
                    });
                }
                filterTagDropdown.style.display = 'block';
                return;
            }
            
            // Group by level if no search term
            const levelGroups = {};
            filteredTags.forEach(item => {
                const level = item.level >= 0 ? item.level : 'other';
                if (!levelGroups[level]) levelGroups[level] = [];
                levelGroups[level].push(item);
            });
            
            const levelNames = {
                0: 'Level 0: Nền tảng',
                1: 'Level 1: Thuật toán cơ bản',
                2: 'Level 2: Tìm kiếm & Toán',
                3: 'Level 3: Thuật toán quan trọng',
                4: 'Level 4: Nâng cao',
                5: 'Level 5: Chuyên sâu',
                other: 'Khác'
            };
            
            const levelColors = {
                0: 'rgba(59, 130, 246, 0.1)',
                1: 'rgba(34, 197, 94, 0.1)',
                2: 'rgba(251, 191, 36, 0.1)',
                3: 'rgba(168, 85, 247, 0.1)',
                4: 'rgba(239, 68, 68, 0.1)',
                5: 'rgba(236, 72, 153, 0.1)',
                other: 'rgba(107, 114, 128, 0.1)'
            };
            
            if (!searchLower && Object.keys(levelGroups).length > 1) {
                filterTagDropdownList.innerHTML = Object.keys(levelGroups).sort((a, b) => {
                    if (a === 'other') return 1;
                    if (b === 'other') return -1;
                    return Number(a) - Number(b);
                }).map(level => {
                    const tags = levelGroups[level].slice(0, 8);
                    return `
                        <div class="tag-level-group" data-level="${level}">
                            <div class="tag-level-header" style="padding: var(--spacing-2) var(--spacing-3); background: ${levelColors[level]}; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);">
                                <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">${levelNames[level]}</span>
                                <span style="font-size: var(--font-size-xs); color: var(--muted); opacity: 0.7;">(${tags.length})</span>
                            </div>
                            ${tags.map(item => {
                                const tag = item.tag;
                                let displayTag = tag;
                                if (searchLower) {
                                    const tagLower = tag.toLowerCase();
                                    const matchIndex = tagLower.indexOf(searchLower);
                                    if (matchIndex !== -1) {
                                        const before = tag.substring(0, matchIndex);
                                        const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                        const after = tag.substring(matchIndex + searchLower.length);
                                        displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                                    }
                                }
                                return `
                                    <div class="tag-dropdown-item" style="padding: var(--spacing-2) var(--spacing-3); cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);" data-tag="${tag}">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0; opacity: 0.6;">
                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                        </svg>
                                        <span style="font-size: var(--font-size-sm); color: var(--text); flex: 1;">${displayTag}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                }).join('');
            } else {
                filterTagDropdownList.innerHTML = `
                    <div style="padding: var(--spacing-2) var(--spacing-3); border-bottom: 1px solid var(--border); background: var(--bg); display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted);">
                            ${filteredTags.length} kết quả
                        </span>
                        ${filteredTags.length > 15 ? `<span style="font-size: var(--font-size-xs); color: var(--muted); opacity: 0.7;">Hiển thị 15 đầu tiên</span>` : ''}
                    </div>
                    ${filteredTags.slice(0, 15).map(item => {
                        const tag = item.tag;
                        let displayTag = tag;
                        if (searchLower) {
                            const tagLower = tag.toLowerCase();
                            const matchIndex = tagLower.indexOf(searchLower);
                            if (matchIndex !== -1) {
                                const before = tag.substring(0, matchIndex);
                                const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                const after = tag.substring(matchIndex + searchLower.length);
                                displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                            }
                        }
                        return `
                            <div class="tag-dropdown-item" style="padding: var(--spacing-3); cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);" data-tag="${tag}">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0;">
                                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                </svg>
                                <span style="font-size: var(--font-size-sm); color: var(--text); flex: 1;">${displayTag}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted); opacity: 0.5;">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </div>
                        `;
                    }).join('')}
                `;
            }
            
            filterTagDropdownList.querySelectorAll('.tag-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tag = item.dataset.tag;
                    if (!filterSelectedTags.includes(tag)) {
                        filterSelectedTags.push(tag);
                        filterSelectedTagsInput.value = JSON.stringify(filterSelectedTags);
                        renderFilterSelectedTags();
                        renderFilterTagDropdown('');
                        applyFilters();
                        if (filterTagInput) {
                            filterTagInput.value = '';
                            filterTagDropdown.style.display = 'none';
                            filterTagInput.focus();
                        }
                    }
                });
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--bg)';
                    item.style.transform = 'translateX(2px)';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                    item.style.transform = 'translateX(0)';
                });
            });
            
            filterTagDropdown.style.display = 'block';
        }
        
        // Input event for search with debounce
        let filterSearchTimeout = null;
        filterTagInput.addEventListener('input', (e) => {
            const value = e.target.value;
            clearTimeout(filterSearchTimeout);
            filterSearchTimeout = setTimeout(() => {
                if (value.trim()) {
                    renderFilterTagDropdown(value);
                } else {
                    renderFilterTagDropdown('');
                }
            }, 150);
        });
        
        filterTagInput.addEventListener('focus', () => {
            if (filterTagInput.value.trim()) {
                renderFilterTagDropdown(filterTagInput.value);
            } else {
                renderFilterTagDropdown('');
            }
        });
        
        filterTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const firstItem = filterTagDropdownList?.querySelector('.tag-dropdown-item, .tag-suggestion-chip');
                if (firstItem) {
                    firstItem.click();
                }
            } else if (e.key === 'Escape') {
                if (filterTagDropdown) filterTagDropdown.style.display = 'none';
                filterTagInput.blur();
            } else if (e.key === 'Backspace' && filterTagInput.value === '' && filterSelectedTags.length > 0) {
                filterSelectedTags.pop();
                filterSelectedTagsInput.value = JSON.stringify(filterSelectedTags);
                renderFilterSelectedTags();
                renderFilterTagDropdown('');
                applyFilters();
            }
        });
        
        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            if (!filterTagInputWrapper?.contains(e.target) && !filterTagDropdown?.contains(e.target)) {
                if (filterTagDropdown) filterTagDropdown.style.display = 'none';
            }
        });
        
        // Initial render
        renderFilterSelectedTags();
    }

    // Toggle filters - make entire header clickable (for tasks tab)
    if (toggleFiltersBtn && filtersContent) {
        // Clone element to remove all old listeners
        const newToggleBtn = toggleFiltersBtn.cloneNode(true);
        toggleFiltersBtn.parentNode.replaceChild(newToggleBtn, toggleFiltersBtn);
        
        // Re-query after clone
        const currentToggleBtn = document.querySelector('#toggleFiltersBtn');
        const currentFiltersContent = document.querySelector('#filtersContent');
        const currentFiltersChevron = document.querySelector('#filtersChevron');
        const currentFilterToggleText = document.querySelector('.filter-toggle-text');
        
        if (currentToggleBtn && currentFiltersContent) {
            // Ensure all child elements don't block clicks
            const headerElements = currentToggleBtn.querySelectorAll('*');
            headerElements.forEach(el => {
                el.style.pointerEvents = 'none';
            });
            
            // Make sure the button itself is clickable
            currentToggleBtn.style.cursor = 'pointer';
            currentToggleBtn.style.userSelect = 'none';
            
            // Add fresh event listener
            currentToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const isHidden = currentFiltersContent.style.display === 'none' || currentFiltersContent.style.display === '';
                currentFiltersContent.style.display = isHidden ? 'block' : 'none';
                if (currentFiltersChevron) {
                    currentFiltersChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            }
                if (currentFilterToggleText) {
                    currentFilterToggleText.textContent = isHidden ? 'Thu gọn' : 'Mở bộ lọc';
            }
        });
            
        // Mặc định thu gọn bộ lọc
            currentFiltersContent.style.display = 'none';
            if (currentFiltersChevron) {
                currentFiltersChevron.style.transform = 'rotate(0deg)';
        }
            if (currentFilterToggleText) {
                currentFilterToggleText.textContent = 'Mở bộ lọc';
            }
        }
    }

    // Form toggle
    if ((isAdmin || isAssistant || hasLessonPlanRole) && toggleOutputForm && outputForm) {
        toggleOutputForm.addEventListener('click', () => {
            const isVisible = outputForm.style.display !== 'none';
            outputForm.style.display = isVisible ? 'none' : 'block';
            // Rotate icon
            if (toggleOutputIcon) {
                toggleOutputIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                toggleOutputIcon.style.transition = 'transform 0.2s ease';
            }
            if (!isVisible) {
                outputForm.querySelector('#outputLessonName')?.focus();
            }
        });
    }

    // Cancel button
    if ((isAdmin || isAssistant || hasLessonPlanRole) && cancelOutputBtn && outputForm) {
        cancelOutputBtn.addEventListener('click', () => {
            outputForm.style.display = 'none';
            outputForm.reset();
            // Reset cost input and preview
            const outputCostInput = outputForm.querySelector('#outputCost');
            const outputCostPreview = outputForm.querySelector('#outputCostPreview');
            if (outputCostInput) {
                outputCostInput.value = '0';
            }
            if (outputCostPreview && outputCostInput) {
                setupCostInput(outputCostInput, outputCostPreview);
            }
            // Reset duplicate warnings
            const titleWarning = outputForm.querySelector('#duplicateTitleWarning');
            const originalTitleWarning = outputForm.querySelector('#duplicateOriginalTitleWarning');
            if (titleWarning) titleWarning.style.display = 'none';
            if (originalTitleWarning) originalTitleWarning.style.display = 'none';
            // Reset icon rotation
            if (toggleOutputIcon) {
                toggleOutputIcon.style.transform = 'rotate(0deg)';
            }
        });
    }

    // Form submission
    if ((isAdmin || isAssistant || hasLessonPlanRole) && outputForm) {
        outputForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(outputForm);
            const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
            
            const costValue = formData.get('cost') || '0';
            const costNumeric = parseInt(costValue.toString().replace(/\./g, ''), 10) || 0;
            
            const selectedTagsInput = outputForm.querySelector('#selectedTagsInput');
            const selectedTags = selectedTagsInput ? JSON.parse(selectedTagsInput.value || '[]') : [];
            const tagValue = selectedTags.length > 0 ? selectedTags.join(', ') : null;

            let createdOutput = null;
            const now = new Date().toISOString();

            await window.UniData.withOptimisticUpdate(
                () => {
                    createdOutput = {
                        id: window.UniData.generateId ? window.UniData.generateId('lessonOutput') : ('LO' + Math.random().toString(36).slice(2, 7).toUpperCase()),
                        lessonName: formData.get('lessonName'),
                        originalTitle: formData.get('originalTitle') || null,
                        tag: tagValue || '',
                        tags: selectedTags.length > 0 ? selectedTags : null,
                        level: normalizeLevel(formData.get('level')) || null,
                        date: formData.get('date') || now.slice(0, 10),
                        cost: costNumeric,
                        status: formData.get('status') || 'pending',
                        contestUploaded: formData.get('contestUploaded') || null,
                        link: formData.get('link') || null,
                        assistantId: isAdmin ? (formData.get('assistantId') || null) : (hasLessonPlanRole ? lessonPlanStaffId : assistantId),
                        completedBy: currentUser?.name || currentUser?.email || '',
                        createdAt: now,
                        updatedAt: now
                    };

                    window.demo.lessonOutputs = window.demo.lessonOutputs || [];
                    window.demo.lessonOutputs.push(createdOutput);
                    // Log action for history (like staff page)
                    if (window.ActionHistoryService) {
                        window.ActionHistoryService.recordAction({
                            entityType: 'lessonOutput',
                            entityId: createdOutput.id,
                            actionType: 'create',
                            beforeValue: null,
                            afterValue: createdOutput,
                            changedFields: null,
                            description: `Tạo bài đã làm mới: ${createdOutput.lessonName || createdOutput.originalTitle || createdOutput.id}`
                        });
                    }

                    const supabasePayload = { ...createdOutput };
                    if ('tags' in supabasePayload) {
                        delete supabasePayload.tags;
                    }
                    return {
                        supabaseEntities: {
                            lessonOutputs: [supabasePayload]
                        }
                    };
                },
                {
                    onSuccess: () => {
                        window.UniUI.toast('Đã thêm bài mới', 'success');
                        outputForm.reset();
                        const outputCostInput = outputForm.querySelector('#outputCost');
                        const outputCostPreview = outputForm.querySelector('#outputCostPreview');
                        if (outputCostInput) {
                            outputCostInput.value = '0';
                        }
                        if (outputCostPreview && outputCostInput) {
                            setupCostInput(outputCostInput, outputCostPreview);
                        }
                        const tagContainer = outputForm.querySelector('#selectedTagsContainer');
                        const tagInput = outputForm.querySelector('#outputTag');
                        const tagDropdown = outputForm.querySelector('#tagDropdown');
                        if (selectedTagsInput) {
                            selectedTagsInput.value = '[]';
                        }
                        if (tagContainer) {
                            tagContainer.innerHTML = '';
                        }
                        if (tagInput) {
                            tagInput.value = '';
                        }
                        if (tagDropdown) {
                            tagDropdown.style.display = 'none';
                        }
                        outputForm.style.display = 'none';
                        if (toggleOutputIcon) {
                            toggleOutputIcon.style.transform = 'rotate(0deg)';
                        }
                        renderLessonPlans('tasks');
                    },
                    onError: (error) => {
                        console.error('Error saving output:', error);
                        window.UniUI.toast('Không thể lưu bài giáo án', 'error');
                    }
                }
            );
        });
    }
}

// Delete functions
async function deleteResource(resourceId) {
    if (!confirm('Bạn có chắc chắn muốn xóa tài nguyên này?')) return;

    const resource = (window.demo.lessonResources || []).find(r => r.id === resourceId);
    if (!resource) return;

    const currentTab = getCurrentLessonPlansTab();

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Remove from local data
            const deletedResource = (window.demo.lessonResources || []).find(r => r.id === resourceId);
            window.demo.lessonResources = (window.demo.lessonResources || []).filter(r => r.id !== resourceId);
            // Log action for history (like staff page)
            if (deletedResource && window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'lessonResource',
                    entityId: resourceId,
                    actionType: 'delete',
                    beforeValue: deletedResource,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa tài nguyên: ${deletedResource.title || resourceId}`
                });
            }
            
            return {
                supabaseDeletes: {
                    lessonResources: [resourceId]
                }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa tài nguyên', 'success');
                renderLessonPlans(currentTab);
            },
            onError: (error) => {
                console.error('Error deleting resource:', error);
                window.UniUI.toast('Lỗi khi xóa tài nguyên', 'error');
            },
            onRollback: () => {
                renderLessonPlans(currentTab);
            }
        }
    );
}

async function deleteTask(taskId) {
    if (!confirm('Bạn có chắc chắn muốn xóa task này?')) return;

    const task = (window.demo.lessonTasks || []).find(t => t.id !== taskId);
    if (!task) return;

    const currentTab = getCurrentLessonPlansTab();

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Remove from local data
            const deletedTask = (window.demo.lessonTasks || []).find(t => t.id === taskId);
            window.demo.lessonTasks = (window.demo.lessonTasks || []).filter(t => t.id !== taskId);
            // Log action for history (like staff page)
            if (deletedTask && window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'lessonTask',
                    entityId: taskId,
                    actionType: 'delete',
                    beforeValue: deletedTask,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa task: ${deletedTask.title || taskId}`
                });
            }
            
            return {
                supabaseDeletes: {
                    lessonTasks: [taskId]
                }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa task', 'success');
                renderLessonPlans(currentTab);
            },
            onError: (error) => {
                console.error('Error deleting task:', error);
                window.UniUI.toast('Lỗi khi xóa task', 'error');
            },
            onRollback: () => {
                renderLessonPlans(currentTab);
            }
        }
    );
}

async function deleteOutput(outputId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài đã làm này?')) return;

    const output = (window.demo.lessonOutputs || []).find(o => o.id === outputId);
    if (!output) return;

    // Find and collect related links to delete
    const allLinks = window.demo.lessonTopicLinks || [];
    const linksToDelete = allLinks.filter(l => l.lessonOutputId === outputId);
    const linkIds = linksToDelete.map(l => l.id).filter(Boolean);

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            // Remove from local data
            const deletedOutput = (window.demo.lessonOutputs || []).find(o => o.id === outputId);
            window.demo.lessonOutputs = (window.demo.lessonOutputs || []).filter(o => o.id !== outputId);
            // Log action for history (like staff page)
            if (deletedOutput && window.ActionHistoryService) {
                window.ActionHistoryService.recordAction({
                    entityType: 'lessonOutput',
                    entityId: outputId,
                    actionType: 'delete',
                    beforeValue: deletedOutput,
                    afterValue: null,
                    changedFields: null,
                    description: `Xóa bài đã làm: ${deletedOutput.lessonName || deletedOutput.originalTitle || outputId}`
                });
            }
            window.demo.lessonTopicLinks = allLinks.filter(l => l.lessonOutputId !== outputId);
            
            const supabaseDeletes = {
                lessonOutputs: [outputId]
            };
            
            // Add related links to deletion if any
            if (linkIds.length > 0) {
                supabaseDeletes.lessonTopicLinks = linkIds;
            }
            
            return { supabaseDeletes };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa bài đã làm', 'success');
                renderLessonPlans('tasks');
            },
            onError: (error) => {
                console.error('Error deleting output:', error);
                window.UniUI.toast('Lỗi khi xóa bài đã làm', 'error');
            },
            onRollback: () => {
                renderLessonPlans('tasks');
            }
        }
    );
}

// Modal functions
function openResourceModal(resourceId = null) {
    const resource = resourceId ? (window.demo.lessonResources || []).find(r => r.id === resourceId) : null;
    const isEdit = !!resource;
    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;

    const form = document.createElement('form');
    form.id = 'resourceForm';
    form.innerHTML = `
        <div class="form-group">
            <label>Link tài nguyên <span class="text-danger">*</span></label>
            <input type="url" name="resourceLink" class="form-control" value="${resource?.resourceLink || ''}" required placeholder="https://example.com/resource">
        </div>
        <div class="form-group">
            <label>Tiêu đề</label>
            <input type="text" name="title" class="form-control" value="${resource?.title || ''}" placeholder="Tên tài nguyên">
        </div>
        <div class="form-group">
            <label>Mô tả</label>
            <textarea name="description" class="form-control" rows="3" placeholder="Mô tả về tài nguyên">${resource?.description || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Tags (phân cách bằng dấu phẩy)</label>
            <input type="text" name="tags" class="form-control" value="${Array.isArray(resource?.tags) ? resource.tags.join(', ') : ''}" placeholder="C++, Thuật toán, Cơ bản">
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Tạo mới'}</button>
        </div>
    `;

    window.UniUI.openModal(isEdit ? 'Sửa tài nguyên' : 'Thêm tài nguyên mới', form);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const tags = (formData.get('tags') || '').split(',').map(t => t.trim()).filter(Boolean);

        const data = {
            resourceLink: formData.get('resourceLink'),
            title: formData.get('title') || '',
            description: formData.get('description') || '',
            tags: tags,
            createdBy: currentUser?.id || null
        };

        const currentTab = getCurrentLessonPlansTab();

        // Use optimistic update pattern
        const oldResource = isEdit ? window.demo.lessonResources?.find(r => r.id === resourceId) : null;
        
        await window.UniData.withOptimisticUpdate(
            () => {
                if (isEdit) {
                    const updated = window.UniLogic.updateEntity('lessonResource', resourceId, data);
                    
                    // Log action for history (like staff page)
                    if (window.ActionHistoryService && oldResource) {
                        const changedFields = window.ActionHistoryService.getChangedFields(oldResource, updated);
                        window.ActionHistoryService.recordAction({
                            entityType: 'lessonResource',
                            entityId: resourceId,
                            actionType: 'update',
                            beforeValue: oldResource,
                            afterValue: updated,
                            changedFields: changedFields,
                            description: `Cập nhật tài nguyên: ${updated.title || resourceId}`
                        });
                    }
                    
                    return {
                        supabaseEntities: {
                            lessonResources: [updated]
                        }
                    };
                } else {
                    const newResource = window.UniLogic.createEntity('lessonResource', data);
                    
                    // Log action for history (like staff page)
                    if (window.ActionHistoryService) {
                        window.ActionHistoryService.recordAction({
                            entityType: 'lessonResource',
                            entityId: newResource.id,
                            actionType: 'create',
                            beforeValue: null,
                            afterValue: newResource,
                            changedFields: null,
                            description: `Tạo tài nguyên mới: ${newResource.title || newResource.id}`
                        });
                    }
                    
                    return {
                        supabaseEntities: {
                            lessonResources: [newResource]
                        }
                    };
                }
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderLessonPlans(currentTab);
                    window.UniUI.toast(isEdit ? 'Đã cập nhật tài nguyên' : 'Đã thêm tài nguyên mới', 'success');
                },
                onError: (error) => {
                    console.error('Error saving resource:', error);
                    window.UniUI.closeModal();
                    window.UniUI.toast('Có lỗi xảy ra', 'error');
                    renderLessonPlans(currentTab);
                },
                onRollback: () => {
                    window.UniUI.closeModal();
                    renderLessonPlans(currentTab);
                }
            }
        );
    });
}

function openLessonTaskModal(taskId = null) {
    const task = taskId ? (window.demo.lessonTasks || []).find(t => t.id === taskId) : null;
    const isEdit = !!task;
    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    // Get staff with lesson_plan role instead of assistants
    const lessonPlanStaff = (window.demo.teachers || []).filter(t => {
        const roles = t.roles || [];
        return roles.includes('lesson_plan');
    });

    const form = document.createElement('form');
    form.id = 'taskForm';
    form.innerHTML = `
        <div class="form-group">
            <label>Tiêu đề <span class="text-danger">*</span></label>
            <input type="text" name="title" class="form-control" value="${task?.title || ''}" required>
        </div>
        <div class="form-group">
            <label>Mô tả</label>
            <textarea name="description" class="form-control" rows="3" placeholder="Mô tả chi tiết về task">${task?.description || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Người phụ trách</label>
            <select name="assistantId" class="form-control">
                <option value="">-- Chọn người phụ trách --</option>
                ${lessonPlanStaff.map(s => `
                    <option value="${s.id}" ${task?.assistantId === s.id ? 'selected' : ''}>
                        ${s.fullName || s.name}
                    </option>
                `).join('')}
            </select>
        </div>
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
                <label>Trạng thái</label>
                <select name="status" class="form-control">
                    <option value="pending" ${task?.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
                    <option value="in_progress" ${task?.status === 'in_progress' ? 'selected' : ''}>Đang làm</option>
                    <option value="completed" ${task?.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                    <option value="cancelled" ${task?.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
                </select>
            </div>
            <div class="form-group">
                <label>Ưu tiên</label>
                <select name="priority" class="form-control">
                    <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Thấp</option>
                    <option value="medium" ${task?.priority === 'medium' ? 'selected' : ''}>Trung bình</option>
                    <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>Cao</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Hạn chót</label>
            <input type="date" name="dueDate" class="form-control" value="${task?.dueDate || ''}">
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Tạo mới'}</button>
        </div>
    `;

    window.UniUI.openModal(isEdit ? 'Sửa task' : 'Thêm task mới', form);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            assistantId: formData.get('assistantId') || null,
            status: formData.get('status') || 'pending',
            priority: formData.get('priority') || 'medium',
            dueDate: formData.get('dueDate') || null,
            createdBy: currentUser?.id || null
        };

        const currentTab = getCurrentLessonPlansTab();
        
        const oldTask = isEdit ? window.demo.lessonTasks?.find(t => t.id === taskId) : null;

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                if (isEdit) {
                    const updated = window.UniLogic.updateEntity('lessonTask', taskId, data);
                    
                    // Log action for history (like staff page)
                    if (window.ActionHistoryService && oldTask) {
                        const changedFields = window.ActionHistoryService.getChangedFields(oldTask, updated);
                        window.ActionHistoryService.recordAction({
                            entityType: 'lessonTask',
                            entityId: taskId,
                            actionType: 'update',
                            beforeValue: oldTask,
                            afterValue: updated,
                            changedFields: changedFields,
                            description: `Cập nhật task: ${updated.title || taskId}`
                        });
                    }
                    
                    return {
                        supabaseEntities: {
                            lessonTasks: [updated]
                        }
                    };
                } else {
                    const newTask = window.UniLogic.createEntity('lessonTask', data);
                    
                    // Log action for history (like staff page)
                    if (window.ActionHistoryService) {
                        window.ActionHistoryService.recordAction({
                            entityType: 'lessonTask',
                            entityId: newTask.id,
                            actionType: 'create',
                            beforeValue: null,
                            afterValue: newTask,
                            changedFields: null,
                            description: `Tạo task mới: ${newTask.title || newTask.id}`
                        });
                    }
                    
                    return {
                        supabaseEntities: {
                            lessonTasks: [newTask]
                        }
                    };
                }
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    renderLessonPlans(currentTab);
                    window.UniUI.toast(isEdit ? 'Đã cập nhật task' : 'Đã thêm task mới', 'success');
                },
                onError: (error) => {
                    console.error('Error saving task:', error);
                    window.UniUI.closeModal();
                    window.UniUI.toast('Có lỗi xảy ra', 'error');
                    renderLessonPlans(currentTab);
                },
                onRollback: () => {
                    window.UniUI.closeModal();
                    renderLessonPlans(currentTab);
                }
        }
    );
    });
}

function openOutputModal(outputId = null) {
    // Only for editing existing outputs
    if (!outputId) return;
    
    const output = (window.demo.lessonOutputs || []).find(o => o.id === outputId);
    if (!output) {
        window.UniUI.toast('Không tìm thấy bài đã làm', 'error');
        return;
    }
    
    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;
    const isAssistant = currentUser?.role === 'assistant';
    const assistantId = isAssistant ? currentUser.linkId : null;
    const hasAccountantRole = window.UniUI?.userHasStaffRole ? window.UniUI.userHasStaffRole('accountant') : false;
    const canEditAllFields = isAdmin || isAssistant;
    const statusOnlyMode = !canEditAllFields && hasAccountantRole;
    // Get staff with lesson_plan role instead of assistants
    const lessonPlanStaff = (window.demo.teachers || []).filter(t => {
        const roles = t.roles || [];
        return roles.includes('lesson_plan');
    });

    const form = document.createElement('form');
    form.id = 'editOutputForm';
    form.innerHTML = `
        <div class="form-group">
            <label>Tên bài <span class="text-danger">*</span></label>
            <input type="text" name="lessonName" class="form-control" value="${output.lessonName || ''}" required placeholder="Tên bài giáo án">
        </div>
        <div class="form-group">
            <label>Tên gốc</label>
            <input type="text" name="originalTitle" class="form-control" value="${output.originalTitle || ''}" placeholder="VD: Light - VNOI, DOSI - Sưu tầm, DOIDAU - Unicorns">
            <small class="text-muted" style="display: block; margin-top: var(--spacing-1); font-size: 0.875rem;">Quy tắc ghi tên gốc: Tên bài gốc + nguồn</small>
        </div>
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
                <label>Tag</label>
                <div class="tag-select-container" style="position: relative;">
                    <div class="tag-input-wrapper" style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-1); padding: var(--spacing-2) var(--spacing-3); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); min-height: 42px; cursor: text;">
                        <div class="selected-tags-container" id="editSelectedTagsContainer" style="display: flex; flex-wrap: wrap; gap: var(--spacing-1); flex: 1;"></div>
                        <input type="text" name="tag" class="tag-search-input" placeholder="Tìm kiếm và chọn tag..." autocomplete="off" style="flex: 1; min-width: 120px; border: none; outline: none; background: transparent; padding: 0; font-size: var(--font-size-sm);">
                    </div>
                    <div class="tag-dropdown" id="editTagDropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 1000; max-height: 250px; overflow-y: auto; margin-top: 4px;">
                        <div class="tag-dropdown-list" id="editTagDropdownList"></div>
                    </div>
                    <input type="hidden" id="editSelectedTagsInput" name="editSelectedTags" value="[]">
                </div>
            </div>
            <div class="form-group">
                <label>Level</label>
                <select name="level" class="form-control">
                    <option value="">-- Chọn level --</option>
                    <option value="Level 0" ${normalizeLevel(output.level) === 'Level 0' ? 'selected' : ''}>Level 0</option>
                    <option value="Level 1" ${normalizeLevel(output.level) === 'Level 1' ? 'selected' : ''}>Level 1</option>
                    <option value="Level 2" ${normalizeLevel(output.level) === 'Level 2' ? 'selected' : ''}>Level 2</option>
                    <option value="Level 3" ${normalizeLevel(output.level) === 'Level 3' ? 'selected' : ''}>Level 3</option>
                    <option value="Level 4" ${normalizeLevel(output.level) === 'Level 4' ? 'selected' : ''}>Level 4</option>
                    <option value="Level 5" ${normalizeLevel(output.level) === 'Level 5' ? 'selected' : ''}>Level 5</option>
                </select>
            </div>
        </div>
        <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
                <label>Ngày <span class="text-danger">*</span></label>
                <input type="date" name="date" class="form-control" value="${output.date || ''}" required>
            </div>
            <div class="form-group">
                <label>Chi phí</label>
                <input type="text" name="cost" class="form-control" value="${output.cost ? formatNumberWithDots(output.cost) : '0'}" inputmode="numeric" placeholder="Nhập chi phí (VD: 30000)">
                <small class="cost-preview text-muted" data-cost-preview style="display: block;"></small>
            </div>
        </div>
        <div class="form-group">
            <label>Trạng thái</label>
            <select name="status" class="form-control">
                <option value="pending" ${output.status === 'pending' ? 'selected' : ''}>Chưa thanh toán</option>
                <option value="paid" ${output.status === 'paid' ? 'selected' : ''}>Đã thanh toán</option>
                <option value="deposit" ${output.status === 'deposit' ? 'selected' : ''}>Cọc</option>
            </select>
        </div>
        <div class="form-group">
            <label>Contest</label>
            <textarea name="contestUploaded" class="form-control" rows="3" placeholder="VD: Bài này đã được đưa vào contest ABC ngày 12/11...">${output.contestUploaded || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Link</label>
            <input type="url" name="link" class="form-control" value="${output.link || ''}" placeholder="https://example.com/lesson">
        </div>
        ${isAdmin ? `
            <div class="form-group">
                <label>Người phụ trách</label>
                <select name="assistantId" class="form-control">
                    <option value="">-- Chọn người phụ trách --</option>
                    ${lessonPlanStaff.map(s => `
                        <option value="${s.id}" ${output.assistantId === s.id ? 'selected' : ''}>
                            ${s.fullName || s.name}
                        </option>
                    `).join('')}
                </select>
            </div>
        ` : ''}
        <div class="form-actions mt-4">
            <button type="button" class="btn btn-outline" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Cập nhật</button>
        </div>
    `;

    window.UniUI.openModal('Sửa bài đã làm', form);
    
    if (statusOnlyMode) {
        const statusField = form.querySelector('select[name="status"]');
        form.querySelectorAll('input, textarea, select').forEach(element => {
            if (element === statusField) {
                element.disabled = false;
            } else {
                element.disabled = true;
            }
        });
    }

    // Setup cost input with preview
    const editCostInput = form.querySelector('input[name="cost"]');
    const editCostPreview = form.querySelector('[data-cost-preview]');
    if (editCostInput && editCostPreview) {
        setupCostInput(editCostInput, editCostPreview);
    }
    
    // Setup duplicate checking for edit form (exclude current output)
    // Note: Edit form doesn't have the warning divs, so we'll add them dynamically
    const editTitleInput = form.querySelector('input[name="lessonName"]');
    const editOriginalTitleInput = form.querySelector('input[name="originalTitle"]');
    if (editTitleInput && editOriginalTitleInput) {
        // Add warning divs after inputs
        const titleWarningDiv = document.createElement('div');
        titleWarningDiv.id = 'editDuplicateTitleWarning';
        titleWarningDiv.style.display = 'none';
        editTitleInput.parentNode.appendChild(titleWarningDiv);
        
        const originalTitleWarningDiv = document.createElement('div');
        originalTitleWarningDiv.id = 'editDuplicateOriginalTitleWarning';
        originalTitleWarningDiv.style.display = 'none';
        editOriginalTitleInput.parentNode.appendChild(originalTitleWarningDiv);
        
        // Setup prefix match check with excludeId
        const checkPrefixMatches = () => {
            const title = editTitleInput.value.trim();
            const originalTitle = editOriginalTitleInput.value.trim();
            
            if (title) {
                const titleMatches = findPrefixMatches(title, 'title', outputId);
                if (titleMatches.length > 0) {
                    titleWarningDiv.innerHTML = renderPrefixMatchWarning(titleMatches);
                    titleWarningDiv.style.display = 'block';
                } else {
                    titleWarningDiv.style.display = 'none';
                }
            } else {
                titleWarningDiv.style.display = 'none';
            }
            
            if (originalTitle) {
                const originalMatches = findPrefixMatches(originalTitle, 'originalTitle', outputId);
                if (originalMatches.length > 0) {
                    originalTitleWarningDiv.innerHTML = renderPrefixMatchWarning(originalMatches);
                    originalTitleWarningDiv.style.display = 'block';
                } else {
                    originalTitleWarningDiv.style.display = 'none';
                }
            } else {
                originalTitleWarningDiv.style.display = 'none';
            }
        };
        
        editTitleInput.addEventListener('input', checkPrefixMatches);
        editTitleInput.addEventListener('blur', checkPrefixMatches);
        editOriginalTitleInput.addEventListener('input', checkPrefixMatches);
        editOriginalTitleInput.addEventListener('blur', checkPrefixMatches);
    }

    // Setup tag multi-select for edit form
    const editTagInput = form.querySelector('input[name="tag"].tag-search-input');
    const editTagDropdown = form.querySelector('#editTagDropdown');
    const editTagDropdownList = form.querySelector('#editTagDropdownList');
    const editSelectedTagsContainer = form.querySelector('#editSelectedTagsContainer');
    const editSelectedTagsInput = form.querySelector('#editSelectedTagsInput');
    
    // Parse existing tags from output.tag (comma-separated string)
    let editSelectedTags = [];
    if (output.tag) {
        editSelectedTags = output.tag.split(',').map(t => t.trim()).filter(Boolean);
    }
    if (editSelectedTagsInput) {
        editSelectedTagsInput.value = JSON.stringify(editSelectedTags);
    }
    
    // Function to render selected tags for edit form
    function renderEditSelectedTags() {
        if (!editSelectedTagsContainer) return;
        
        // Add count badge if tags exist
        const existingCount = editSelectedTagsContainer.querySelector('.tag-count-badge');
        if (existingCount) existingCount.remove();
        
        if (editSelectedTags.length > 0) {
            const countBadge = document.createElement('span');
            countBadge.className = 'tag-count-badge';
            countBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; font-size: var(--font-size-xs); background: var(--bg); color: var(--muted); border-radius: var(--radius-sm); font-weight: 500; margin-right: var(--spacing-1);';
            countBadge.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                </svg>
                ${editSelectedTags.length}
            `;
            editSelectedTagsContainer.insertBefore(countBadge, editSelectedTagsContainer.firstChild);
        }
        
        // Remove old badges (keep count badge)
        const oldBadges = editSelectedTagsContainer.querySelectorAll('.tag-badge-selected');
        oldBadges.forEach(badge => badge.remove());
        
        // Add new badges with animation
        editSelectedTags.forEach((tag, index) => {
            const tagBadge = document.createElement('span');
            tagBadge.className = 'tag-badge-selected';
            tagBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: var(--font-size-xs); background: var(--primary); color: white; border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; font-weight: 500; user-select: none; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); opacity: 0; transform: scale(0.8);';
            tagBadge.innerHTML = `
                <span style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tag}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="cursor: pointer; flex-shrink: 0; opacity: 0.9;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            `;
            
            // Animate in
            setTimeout(() => {
                tagBadge.style.opacity = '1';
                tagBadge.style.transform = 'scale(1)';
            }, index * 30);
            
            tagBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                // Animate out
                tagBadge.style.opacity = '0';
                tagBadge.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    editSelectedTags = editSelectedTags.filter((_, i) => i !== index);
                    if (editSelectedTagsInput) editSelectedTagsInput.value = JSON.stringify(editSelectedTags);
                    renderEditSelectedTags();
                    if (editTagInput) {
                        renderEditTagDropdown(editTagInput.value);
                        editTagInput.focus();
                    }
                }, 200);
            });
            
            tagBadge.addEventListener('mouseenter', () => {
                tagBadge.style.background = 'var(--danger)';
                tagBadge.style.transform = 'scale(1.05)';
                tagBadge.style.boxShadow = '0 2px 6px rgba(244, 63, 94, 0.3)';
            });
            
            tagBadge.addEventListener('mouseleave', () => {
                tagBadge.style.background = 'var(--primary)';
                tagBadge.style.transform = 'scale(1)';
                tagBadge.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            });
            
            editSelectedTagsContainer.appendChild(tagBadge);
        });
    }
    
    // Function to get tag level (for grouping)
    function getEditTagLevel(tag) {
        const tagLower = tag.toLowerCase();
        if (['nhập/xuất', 'input/output', 'i/o', 'câu lệnh rẽ nhánh', 'conditional', 'if-else', 'vòng lặp', 'loop', 'iteration', 'mảng', 'array', 'chuỗi', 'string', 'struct', 'hàm', 'function', 'truy vấn', 'query'].some(t => tagLower.includes(t))) return 0;
        if (['đệ quy', 'recursion', 'brute force', 'vét cạn', 'greedy', 'sorting', 'prefixsum', 'gcd', 'lcm', 'nguyên tố', 'prime'].some(t => tagLower.includes(t))) return 1;
        if (['binary search', 'tìm kiếm nhị phân', 'hai con trỏ', 'two pointer', 'vector', 'pair', 'set', 'map', 'euclid'].some(t => tagLower.includes(t))) return 2;
        if (['modular', 'tổ hợp', 'combination', 'stack', 'queue', 'graph', 'dfs', 'bfs', 'segment tree', 'fenwick', 'dp', 'dynamic programming', 'hashing', 'trie', 'kmp'].some(t => tagLower.includes(t))) return 3;
        if (['dijkstra', 'floyd', 'dsu', 'mst', 'euler', 'lca', 'bitmask', 'game theory'].some(t => tagLower.includes(t))) return 4;
        if (['sweep line', 'gauss', 'persistent', 'rollback', '2-sat', 'hld', 'centroid', 'flow', 'convex hull'].some(t => tagLower.includes(t))) return 5;
        return -1;
    }
    
    // Function to render dropdown options for edit form with prefix matching and grouping
    function renderEditTagDropdown(searchTerm = '') {
        if (!editTagDropdown || !editTagDropdownList) return;
        
        const searchLower = searchTerm.toLowerCase().trim();
        
        const filteredTags = PREDEFINED_TAGS
            .filter(tag => !editSelectedTags.includes(tag))
            .map(tag => {
                const tagLower = tag.toLowerCase();
                const startsWith = tagLower.startsWith(searchLower);
                const contains = tagLower.includes(searchLower);
                return {
                    tag,
                    level: getEditTagLevel(tag),
                    startsWith,
                    contains,
                    index: startsWith ? tagLower.indexOf(searchLower) : (contains ? tagLower.indexOf(searchLower) : -1)
                };
            })
            .filter(item => item.contains)
            .sort((a, b) => {
                if (a.startsWith && !b.startsWith) return -1;
                if (!a.startsWith && b.startsWith) return 1;
                if (a.level !== b.level) return a.level - b.level;
                return a.index - b.index;
            });
        
        if (filteredTags.length === 0) {
            if (searchLower) {
                editTagDropdownList.innerHTML = `
                    <div class="tag-dropdown-empty" style="padding: var(--spacing-5); text-align: center; color: var(--muted);">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin: 0 auto var(--spacing-3); display: block;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <p style="margin: 0; font-size: var(--font-size-sm); font-weight: 500;">Không tìm thấy tag nào</p>
                        <p style="margin: var(--spacing-2) 0 0 0; font-size: var(--font-size-xs); opacity: 0.7;">Thử tìm kiếm với từ khóa khác</p>
                    </div>
                `;
            } else {
                const popularTags = ['DFS', 'BFS', 'DP', 'Segment Tree', 'Greedy', 'Binary Search', 'Graph', 'Tree'];
                const availablePopular = popularTags.filter(t => !editSelectedTags.includes(t) && PREDEFINED_TAGS.includes(t)).slice(0, 6);
                
                editTagDropdownList.innerHTML = `
                    <div style="padding: var(--spacing-3); border-bottom: 1px solid var(--border);">
                        <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted);">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                            </svg>
                            <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Tags phổ biến</span>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: var(--spacing-1);">
                            ${availablePopular.map(tag => `
                                <span class="tag-suggestion-chip" data-tag="${tag}" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: var(--font-size-xs); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; transition: all 0.2s ease; color: var(--text);">
                                    ${tag}
                                </span>
                            `).join('')}
                        </div>
                    </div>
                    <div style="padding: var(--spacing-3); text-align: center; color: var(--muted); font-size: var(--font-size-xs);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5; margin-right: 4px; vertical-align: middle;">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        Gõ để tìm kiếm tag...
                    </div>
                `;
                
                editTagDropdownList.querySelectorAll('.tag-suggestion-chip').forEach(chip => {
                    chip.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const tag = chip.dataset.tag;
                        if (!editSelectedTags.includes(tag)) {
                            editSelectedTags.push(tag);
                            if (editSelectedTagsInput) editSelectedTagsInput.value = JSON.stringify(editSelectedTags);
                            renderEditSelectedTags();
                            if (editTagInput) {
                                editTagInput.value = '';
                                editTagDropdown.style.display = 'none';
                                editTagInput.focus();
                            }
                        }
                    });
                    chip.addEventListener('mouseenter', () => {
                        chip.style.background = 'var(--primary)';
                        chip.style.color = 'white';
                        chip.style.borderColor = 'var(--primary)';
                        chip.style.transform = 'scale(1.05)';
                    });
                    chip.addEventListener('mouseleave', () => {
                        chip.style.background = 'var(--bg)';
                        chip.style.color = 'var(--text)';
                        chip.style.borderColor = 'var(--border)';
                        chip.style.transform = 'scale(1)';
                    });
                });
            }
            editTagDropdown.style.display = 'block';
            return;
        }
        
        // Group by level if no search term
        const levelGroups = {};
        filteredTags.forEach(item => {
            const level = item.level >= 0 ? item.level : 'other';
            if (!levelGroups[level]) levelGroups[level] = [];
            levelGroups[level].push(item);
        });
        
        const levelNames = {
            0: 'Level 0: Nền tảng',
            1: 'Level 1: Thuật toán cơ bản',
            2: 'Level 2: Tìm kiếm & Toán',
            3: 'Level 3: Thuật toán quan trọng',
            4: 'Level 4: Nâng cao',
            5: 'Level 5: Chuyên sâu',
            other: 'Khác'
        };
        
        const levelColors = {
            0: 'rgba(59, 130, 246, 0.1)',
            1: 'rgba(34, 197, 94, 0.1)',
            2: 'rgba(251, 191, 36, 0.1)',
            3: 'rgba(168, 85, 247, 0.1)',
            4: 'rgba(239, 68, 68, 0.1)',
            5: 'rgba(236, 72, 153, 0.1)',
            other: 'rgba(107, 114, 128, 0.1)'
        };
        
        if (!searchLower && Object.keys(levelGroups).length > 1) {
            editTagDropdownList.innerHTML = Object.keys(levelGroups).sort((a, b) => {
                if (a === 'other') return 1;
                if (b === 'other') return -1;
                return Number(a) - Number(b);
            }).map(level => {
                const tags = levelGroups[level].slice(0, 8);
                return `
                    <div class="tag-level-group" data-level="${level}">
                        <div class="tag-level-header" style="padding: var(--spacing-2) var(--spacing-3); background: ${levelColors[level]}; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);">
                            <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">${levelNames[level]}</span>
                            <span style="font-size: var(--font-size-xs); color: var(--muted); opacity: 0.7;">(${tags.length})</span>
                        </div>
                        ${tags.map(item => {
                            const tag = item.tag;
                            let displayTag = tag;
                            if (searchLower) {
                                const tagLower = tag.toLowerCase();
                                const matchIndex = tagLower.indexOf(searchLower);
                                if (matchIndex !== -1) {
                                    const before = tag.substring(0, matchIndex);
                                    const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                                    const after = tag.substring(matchIndex + searchLower.length);
                                    displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                                }
                            }
                            return `
                                <div class="tag-dropdown-item" style="padding: var(--spacing-2) var(--spacing-3); cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);" data-tag="${tag}">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0; opacity: 0.6;">
                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                        <line x1="7" y1="7" x2="7.01" y2="7"></line>
                                    </svg>
                                    <span style="font-size: var(--font-size-sm); color: var(--text); flex: 1;">${displayTag}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }).join('');
        } else {
            editTagDropdownList.innerHTML = `
                <div style="padding: var(--spacing-2) var(--spacing-3); border-bottom: 1px solid var(--border); background: var(--bg); display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--muted);">
                        ${filteredTags.length} kết quả
                    </span>
                    ${filteredTags.length > 15 ? `<span style="font-size: var(--font-size-xs); color: var(--muted); opacity: 0.7;">Hiển thị 15 đầu tiên</span>` : ''}
                </div>
                ${filteredTags.slice(0, 15).map(item => {
                    const tag = item.tag;
                    let displayTag = tag;
                    if (searchLower) {
                        const tagLower = tag.toLowerCase();
                        const matchIndex = tagLower.indexOf(searchLower);
                        if (matchIndex !== -1) {
                            const before = tag.substring(0, matchIndex);
                            const match = tag.substring(matchIndex, matchIndex + searchLower.length);
                            const after = tag.substring(matchIndex + searchLower.length);
                            displayTag = `${before}<strong style="color: var(--primary); font-weight: 600;">${match}</strong>${after}`;
                        }
                    }
                    return `
                        <div class="tag-dropdown-item" style="padding: var(--spacing-3); cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: var(--spacing-2);" data-tag="${tag}">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--primary); flex-shrink: 0;">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                                <line x1="7" y1="7" x2="7.01" y2="7"></line>
                            </svg>
                            <span style="font-size: var(--font-size-sm); color: var(--text); flex: 1;">${displayTag}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--muted); opacity: 0.5;">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </div>
                    `;
                }).join('')}
            `;
        }
        
        editTagDropdownList.querySelectorAll('.tag-dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = item.dataset.tag;
                if (!editSelectedTags.includes(tag)) {
                    editSelectedTags.push(tag);
                    if (editSelectedTagsInput) editSelectedTagsInput.value = JSON.stringify(editSelectedTags);
                    renderEditSelectedTags();
                    if (editTagInput) {
                        editTagInput.value = '';
                        editTagDropdown.style.display = 'none';
                        editTagInput.focus();
                    }
                }
            });
            item.addEventListener('mouseenter', () => {
                item.style.background = 'var(--bg)';
                item.style.transform = 'translateX(2px)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = '';
                item.style.transform = 'translateX(0)';
            });
        });
        
        editTagDropdown.style.display = 'block';
    }
    
    // Setup edit tag input handlers with debounce
    let editSearchTimeout = null;
    if (editTagInput) {
        editTagInput.addEventListener('input', (e) => {
            const value = e.target.value;
            clearTimeout(editSearchTimeout);
            editSearchTimeout = setTimeout(() => {
                if (value.trim()) {
                    renderEditTagDropdown(value);
                } else {
                    renderEditTagDropdown(''); // Show all available tags when empty
                }
            }, 150);
        });
        
        editTagInput.addEventListener('focus', () => {
            if (editTagInput.value.trim()) {
                renderEditTagDropdown(editTagInput.value);
            } else {
                renderEditTagDropdown(''); // Show suggestions when focused
            }
        });
        
        editTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const firstItem = editTagDropdownList?.querySelector('.tag-dropdown-item');
                if (firstItem) {
                    firstItem.click();
                }
            } else if (e.key === 'Escape') {
                if (editTagDropdown) editTagDropdown.style.display = 'none';
                editTagInput.blur();
            } else if (e.key === 'Backspace' && editTagInput.value === '' && editSelectedTags.length > 0) {
                // Remove last tag when backspace on empty input
                editSelectedTags.pop();
                if (editSelectedTagsInput) editSelectedTagsInput.value = JSON.stringify(editSelectedTags);
                renderEditSelectedTags();
                renderEditTagDropdown('');
            }
        });
        
        // Click on wrapper to focus input
        const editTagWrapper = editTagInput.closest('.tag-input-wrapper');
        if (editTagWrapper) {
            editTagWrapper.addEventListener('click', (e) => {
                if (e.target !== editTagInput && !e.target.closest('.tag-badge-selected')) {
                    editTagInput.focus();
                }
            });
        }
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const editTagContainer = editTagInput?.closest('.tag-select-container');
        if (editTagContainer && !editTagContainer.contains(e.target)) {
            if (editTagDropdown) editTagDropdown.style.display = 'none';
        }
    });
    
    // Initialize edit form tags
    renderEditSelectedTags();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const costValue = formData.get('cost') || '0';
        const costNumeric = parseInt(costValue.toString().replace(/\./g, ''), 10) || 0;
        
        // Get selected tags from hidden input
        const selectedTags = editSelectedTagsInput ? JSON.parse(editSelectedTagsInput.value || '[]') : [];
        const tagValue = selectedTags.length > 0 ? selectedTags.join(', ') : null;
        
        const data = statusOnlyMode
            ? {
                status: formData.get('status') || output.status || 'pending'
            }
            : {
                lessonName: formData.get('lessonName'),
                originalTitle: formData.get('originalTitle') || null,
                tag: tagValue,
                tags: selectedTags.length > 0 ? selectedTags : null,
                level: normalizeLevel(formData.get('level')) || null,
                date: formData.get('date'),
                cost: costNumeric,
                status: formData.get('status') || 'pending',
                contestUploaded: formData.get('contestUploaded') || null,
                link: formData.get('link') || null,
                assistantId: isAdmin ? (formData.get('assistantId') || null) : assistantId
            };

        // Use optimistic update pattern
        const oldOutput = output ? { ...output } : null;
        
        await window.UniData.withOptimisticUpdate(
            () => {
                const updated = window.UniLogic.updateEntity('lessonOutput', outputId, data);
                
                // Log action for history (like staff page)
                if (window.ActionHistoryService && oldOutput) {
                    const changedFields = window.ActionHistoryService.getChangedFields(oldOutput, updated);
                    window.ActionHistoryService.recordAction({
                        entityType: 'lessonOutput',
                        entityId: outputId,
                        actionType: 'update',
                        beforeValue: oldOutput,
                        afterValue: updated,
                        changedFields: changedFields,
                        description: `Cập nhật bài đã làm: ${updated.lessonName || updated.originalTitle || outputId}`
                    });
                }
                
                return {
                    supabaseEntities: {
                        lessonOutputs: [updated]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.toast('Đã cập nhật bài đã làm', 'success');
                    window.UniUI.closeModal();
                    renderLessonPlans('tasks');
                },
                onError: (error) => {
                    console.error('Error saving output:', error);
                    window.UniUI.closeModal();
                    window.UniUI.toast('Có lỗi xảy ra', 'error');
                    renderLessonPlans('tasks');
                },
                onRollback: () => {
                    window.UniUI.closeModal();
                    renderLessonPlans('tasks');
                }
            }
        );
    });
}

// Global functions for onclick handlers
window.editResource = function(resourceId) {
    openResourceModal(resourceId);
};

window.editTask = function(taskId) {
    openLessonTaskModal(taskId);
};

window.editOutput = function(outputId) {
    openOutputModal(outputId);
};

window.deleteResource = deleteResource;
window.deleteTask = deleteTask;
window.deleteOutput = deleteOutput;

// Export for use in ui.js - wrap with optimistic page render for fast cache loading
const originalRenderLessonPlans = renderLessonPlans;
window.renderLessonPlans = window.UniData?.withOptimisticPageRender 
    ? window.UniData.withOptimisticPageRender(originalRenderLessonPlans, 'lesson-plans', [
        'lessonResources', 
        'lessonTasks', 
        'lessonOutputs', 
        'lessonTopics'
    ])
    : originalRenderLessonPlans;
