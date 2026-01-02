/**
 * action-history.js - Trang Lịch sử hành động chỉnh sửa
 * Hiển thị timeline các hành động và cho phép undo
 */

(function() {
    'use strict';

    let currentFilters = {
        entityType: null,
        userId: null,
        actionType: null,
        startDate: null,
        endDate: null
    };

    /**
     * Render trang lịch sử
     */
    async function renderActionHistory() {
        const main = document.querySelector('#main-content');
        if (!main) return;

        const user = window.UniAuth?.getCurrentUser();
        const isAdmin = user?.role === 'admin';

        // Hiển thị skeleton loading
        main.innerHTML = `
            <div class="action-history-page">
                <div class="page-header" style="margin-bottom: var(--spacing-6);">
                    <h1 style="display: flex; align-items: center; gap: var(--spacing-3);">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        Lịch sử chỉnh sửa
                    </h1>
                    <p class="text-muted">Theo dõi và quản lý các hành động chỉnh sửa dữ liệu</p>
                </div>

                <div class="action-history-filters" style="margin-bottom: var(--spacing-4);">
                    ${renderFilters(isAdmin)}
                </div>

                <div class="action-history-timeline" id="actionHistoryTimeline">
                    ${renderSkeletonLoading()}
                </div>
            </div>
        `;

        // Load data
        await loadAndRenderHistory();
    }

    /**
     * Render filters
     */
    function renderFilters(isAdmin) {
        const entityTypes = [
            { value: '', label: 'Tất cả' },
            { value: 'student', label: 'Học sinh' },
            { value: 'teacher', label: 'Nhân sự' },
            { value: 'class', label: 'Lớp học' },
            { value: 'payment', label: 'Thanh toán' }
        ];

        const actionTypes = [
            { value: '', label: 'Tất cả' },
            { value: 'create', label: 'Tạo mới' },
            { value: 'update', label: 'Cập nhật' },
            { value: 'delete', label: 'Xóa' },
            { value: 'undo', label: 'Hoàn tác' }
        ];

        // Lấy danh sách users nếu là admin
        let usersOptions = '';
        if (isAdmin && window.demo?.users) {
            const users = window.demo.users.filter(u => u.role !== 'visitor');
            usersOptions = users.map(u => `
                <option value="${u.id}">${u.name || u.email || u.id}</option>
            `).join('');
        }

        return `
            <div class="filter-card" style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-4);">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-3);">
                    <div class="form-group-enhanced">
                        <label class="form-label" style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--spacing-1);">Loại đối tượng</label>
                        <select id="filterEntityType" class="form-control-enhanced" style="width: 100%;">
                            ${entityTypes.map(opt => `
                                <option value="${opt.value}" ${currentFilters.entityType === opt.value ? 'selected' : ''}>
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group-enhanced">
                        <label class="form-label" style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--spacing-1);">Loại hành động</label>
                        <select id="filterActionType" class="form-control-enhanced" style="width: 100%;">
                            ${actionTypes.map(opt => `
                                <option value="${opt.value}" ${currentFilters.actionType === opt.value ? 'selected' : ''}>
                                    ${opt.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    ${isAdmin ? `
                        <div class="form-group-enhanced">
                            <label class="form-label" style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--spacing-1);">Người thực hiện</label>
                            <select id="filterUserId" class="form-control-enhanced" style="width: 100%;">
                                <option value="">Tất cả</option>
                                ${usersOptions}
                            </select>
                        </div>
                    ` : ''}

                    <div class="form-group-enhanced">
                        <label class="form-label" style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--spacing-1);">Từ ngày</label>
                        <input type="date" id="filterStartDate" class="form-control-enhanced" style="width: 100%;" value="${currentFilters.startDate || (() => {
                            const date = new Date();
                            date.setDate(date.getDate() - 30);
                            return date.toISOString().split('T')[0];
                        })()}">
                        <small style="font-size: var(--font-size-xs); color: var(--muted); margin-top: 4px; display: block;">
                            Chỉ hiển thị lịch sử trong 30 ngày gần nhất
                        </small>
                    </div>

                    <div class="form-group-enhanced">
                        <label class="form-label" style="font-size: var(--font-size-sm); font-weight: 500; margin-bottom: var(--spacing-1);">Đến ngày</label>
                        <input type="date" id="filterEndDate" class="form-control-enhanced" style="width: 100%;" value="${currentFilters.endDate || new Date().toISOString().split('T')[0]}">
                    </div>

                    <div class="form-group-enhanced" style="display: flex; align-items: flex-end;">
                        <button id="applyFiltersBtn" class="btn btn-primary" style="width: 100%;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="M21 21l-4.35-4.35"></path>
                            </svg>
                            Áp dụng
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render skeleton loading
     */
    function renderSkeletonLoading() {
        return `
            <div class="skeleton-container">
                ${Array.from({ length: 5 }).map(() => `
                    <div class="skeleton-card" style="margin-bottom: var(--spacing-3);">
                        <div class="skeleton-line skeleton-title"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line skeleton-short"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Load và render lịch sử
     */
    async function loadAndRenderHistory() {
        const timeline = document.getElementById('actionHistoryTimeline');
        if (!timeline) return;

        try {
            // Chỉ lấy lịch sử trong 30 ngày gần nhất
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const filters = {
                ...currentFilters,
                limit: 100
            };
            
            // Nếu chưa có startDate filter, tự động set 30 ngày trước
            if (!filters.startDate) {
                filters.startDate = thirtyDaysAgo.toISOString().split('T')[0];
            }
            
            const history = await window.ActionHistoryService.getActionHistory(filters);

            if (history.length === 0) {
                timeline.innerHTML = `
                    <div style="text-align: center; padding: var(--spacing-8); color: var(--muted);">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto var(--spacing-3); opacity: 0.3;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <p style="font-size: var(--font-size-lg); margin-bottom: var(--spacing-2);">Chưa có lịch sử</p>
                        <p style="font-size: var(--font-size-sm);">Các hành động chỉnh sửa sẽ được hiển thị ở đây</p>
                    </div>
                `;
                return;
            }

            timeline.innerHTML = renderTimeline(history);
            attachEventListeners();
        } catch (e) {
            console.error('[ActionHistory] Failed to load history:', e);
            timeline.innerHTML = `
                <div class="card" style="background: var(--danger); color: white; padding: var(--spacing-4);">
                    <p>Lỗi khi tải lịch sử: ${e.message}</p>
                </div>
            `;
        }
    }

    /**
     * Render timeline
     */
    function renderTimeline(history) {
        const user = window.UniAuth?.getCurrentUser();
        const isAdmin = user?.role === 'admin';

        const actionLabels = {
            'create': 'Tạo mới',
            'update': 'Cập nhật',
            'delete': 'Xóa',
            'undo': 'Hoàn tác'
        };

        const actionColors = {
            'create': 'success',
            'update': 'primary',
            'delete': 'danger',
            'undo': 'warning'
        };

        const entityTypeLabels = {
            'student': 'Học sinh',
            'teacher': 'Nhân sự',
            'class': 'Lớp học',
            'payment': 'Thanh toán'
        };

        return `
            <div class="timeline-container">
                ${history.map((action, index) => {
                    const date = new Date(action.created_at);
                    const timeStr = date.toLocaleString('vi-VN');
                    const dateStr = date.toLocaleDateString('vi-VN');
                    const timeOnly = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    
                    const actionLabel = actionLabels[action.action_type] || action.action_type;
                    const actionColor = actionColors[action.action_type] || 'default';
                    const entityLabel = entityTypeLabels[action.entity_type] || action.entity_type;
                    
                    const canUndo = isAdmin && 
                                   action.action_type !== 'undo' && 
                                   action.before_value !== null &&
                                   action.before_value !== undefined;

                    // Lấy tên entity từ after_value hoặc before_value
                    let entityName = action.entity_id;
                    if (action.after_value) {
                        entityName = action.after_value.fullName || 
                                   action.after_value.name || 
                                   action.entity_id;
                    } else if (action.before_value) {
                        entityName = action.before_value.fullName || 
                                   action.before_value.name || 
                                   action.entity_id;
                    }

                    return `
                        <div class="timeline-item" data-action-id="${action.id}" style="position: relative; padding-left: var(--spacing-6); margin-bottom: var(--spacing-4);">
                            <div class="timeline-marker" style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; border-radius: 50%; background: var(--primary); border: 2px solid var(--surface);"></div>
                            ${index < history.length - 1 ? `
                                <div class="timeline-line" style="position: absolute; left: 5px; top: 12px; width: 2px; height: calc(100% + var(--spacing-4)); background: var(--border);"></div>
                            ` : ''}
                            
                            <div class="timeline-content" style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--spacing-4); transition: all 0.2s ease;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--spacing-3); margin-bottom: var(--spacing-2);">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="display: flex; align-items: center; gap: var(--spacing-2); margin-bottom: var(--spacing-2); flex-wrap: wrap;">
                                            <span class="badge badge-${actionColor}" style="font-size: var(--font-size-xs);">
                                                ${actionLabel}
                                            </span>
                                            <span style="font-size: var(--font-size-sm); font-weight: 600; color: var(--text);">
                                                ${entityLabel}: ${entityName}
                                            </span>
                                        </div>
                                        ${action.description ? `
                                            <p style="font-size: var(--font-size-sm); color: var(--text); margin: 0 0 var(--spacing-1) 0;">
                                                ${action.description}
                                            </p>
                                        ` : ''}
                                        <div style="display: flex; align-items: center; gap: var(--spacing-3); flex-wrap: wrap; margin-top: var(--spacing-2);">
                                            <span style="font-size: var(--font-size-xs); color: var(--muted); display: flex; align-items: center; gap: 4px;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <polyline points="12 6 12 12 16 14"></polyline>
                                                </svg>
                                                ${dateStr} ${timeOnly}
                                            </span>
                                            ${action.user_email ? `
                                                <span style="font-size: var(--font-size-xs); color: var(--muted);">
                                                    bởi ${action.user_email}
                                                </span>
                                            ` : ''}
                                        </div>
                                        ${action.changed_fields && Object.keys(action.changed_fields).length > 0 ? `
                                            <div style="margin-top: var(--spacing-2); padding-top: var(--spacing-2); border-top: 1px solid var(--border);">
                                                <details style="font-size: var(--font-size-xs);">
                                                    <summary style="cursor: pointer; color: var(--primary); font-weight: 500;">
                                                        Xem các field đã thay đổi (${Object.keys(action.changed_fields).length})
                                                    </summary>
                                                    <div style="margin-top: var(--spacing-2); padding: var(--spacing-2); background: var(--bg); border-radius: var(--radius);">
                                                        ${Object.entries(action.changed_fields).map(([field, change]) => `
                                                            <div style="margin-bottom: var(--spacing-1);">
                                                                <strong>${field}:</strong>
                                                                <span style="color: var(--danger);">${JSON.stringify(change.old)}</span>
                                                                →
                                                                <span style="color: var(--success);">${JSON.stringify(change.new)}</span>
                                                            </div>
                                                        `).join('')}
                                                    </div>
                                                </details>
                                            </div>
                                        ` : ''}
                                    </div>
                                    ${canUndo ? `
                                        <button 
                                            class="btn btn-sm btn-outline undo-action-btn" 
                                            data-action-id="${action.id}"
                                            style="font-size: var(--font-size-xs); padding: 6px 12px; white-space: nowrap;"
                                            title="Khôi phục về trạng thái trước đó"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;">
                                                <path d="M3 7v6h6"></path>
                                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                                            </svg>
                                            Undo
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        // Filter buttons
        const applyBtn = document.getElementById('applyFiltersBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                currentFilters = {
                    entityType: document.getElementById('filterEntityType')?.value || null,
                    userId: document.getElementById('filterUserId')?.value || null,
                    actionType: document.getElementById('filterActionType')?.value || null,
                    startDate: document.getElementById('filterStartDate')?.value || null,
                    endDate: document.getElementById('filterEndDate')?.value || null
                };

                // Clear empty strings
                Object.keys(currentFilters).forEach(key => {
                    if (currentFilters[key] === '') {
                        currentFilters[key] = null;
                    }
                });

                const timeline = document.getElementById('actionHistoryTimeline');
                if (timeline) {
                    timeline.innerHTML = renderSkeletonLoading();
                }
                await loadAndRenderHistory();
            });
        }

        // Undo buttons
        document.querySelectorAll('.undo-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const actionId = btn.dataset.actionId;
                if (!actionId) return;

                if (!confirm('Bạn có chắc muốn khôi phục hành động này? Dữ liệu hiện tại sẽ bị thay thế.')) {
                    return;
                }

                btn.disabled = true;
                btn.innerHTML = '<span>Đang khôi phục...</span>';

                try {
                    const result = await window.ActionHistoryService.undoAction(actionId);
                    if (result.success) {
                        window.UniUI?.toast?.(result.message, 'success');
                        // Reload history
                        await loadAndRenderHistory();
                    } else {
                        window.UniUI?.toast?.(result.message, 'error');
                        btn.disabled = false;
                        btn.innerHTML = `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;">
                                <path d="M3 7v6h6"></path>
                                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                            </svg>
                            Undo
                        `;
                    }
                } catch (e) {
                    console.error('[ActionHistory] Undo failed:', e);
                    window.UniUI?.toast?.('Lỗi khi khôi phục: ' + e.message, 'error');
                    btn.disabled = false;
                    btn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;">
                            <path d="M3 7v6h6"></path>
                            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
                        </svg>
                        Undo
                    `;
                }
            });
        });
    }

    // Export
    window.renderActionHistory = renderActionHistory;
})();

