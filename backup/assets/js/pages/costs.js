const COST_STATUS_META = {
    paid: {
        label: 'Thanh toán',
        tooltip: 'Đã thanh toán',
        badge: 'badge-success'
    },
    pending: {
        label: 'Chưa thanh toán',
        tooltip: 'Chưa thanh toán',
        badge: 'badge-warning'
    }
};

function getCostsState() {
    if (!window.CostsPageState) {
        const now = new Date();
        window.CostsPageState = {
            selectedMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        };
    }
    return window.CostsPageState;
}

function getAvailableCostMonths(costs) {
    const months = new Set();
    costs.forEach(cost => {
        const month = cost.month || (cost.date ? cost.date.slice(0, 7) : null);
        if (month) months.add(month);
    });
    if (months.size === 0) {
        const now = new Date();
        months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
}

function formatMonthLabel(month) {
    if (!month) return '-';
    const [year, monthPart] = month.split('-');
    return `${monthPart}/${year}`;
}

function formatDateLabel(date) {
    if (!date) return '-';
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
        return date;
    }
    return parsed.toLocaleDateString('vi-VN');
}

async function renderCosts() {
    // Initialize listeners and try optimistic loading
    if (!window.__costsListenersInitialized) {
        window.UniData?.initPageListeners?.('costs', renderCosts, ['costs']);
        window.__costsListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    // Check if window.demo is empty OR if critical data is missing (costs)
    const hasWindowDemo = window.demo && Object.keys(window.demo).length > 0;
    const hasCosts = Array.isArray(window.demo?.costs);
    const needsCacheLoad = !hasWindowDemo || !hasCosts;
    
    if (needsCacheLoad) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            // Hide spinner immediately when cache loads
            if (window.UniData && typeof window.UniData.hideSpinnerIfLoaded === 'function') {
                window.UniData.hideSpinnerIfLoaded();
            }
            setTimeout(() => renderCosts(), 10);
            return;
        } else {
            const main = document.querySelector('#main-content');
            if (main) {
                main.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderCosts(), 120);
            return;
        }
    }
    
    const main = document.querySelector('#main-content');
    if (!main) return;

    const state = getCostsState();
    const allCosts = (window.demo.costs || []).map(cost => ({
        ...cost,
        month: cost.month || (cost.date ? cost.date.slice(0, 7) : '')
    }));

    const months = getAvailableCostMonths(allCosts);
    if (!months.includes(state.selectedMonth)) {
        state.selectedMonth = months[0] || state.selectedMonth;
    }

    const filteredCosts = allCosts
        .filter(cost => (cost.month || '') === state.selectedMonth)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const monthTotal = filteredCosts.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0);

    const monthLabel = formatMonthLabel(state.selectedMonth);
    const currentMonthValue = state.selectedMonth || '';

    main.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Chi phí</h2>
            <div class="flex items-center gap-2">
                <input type="month" id="costsMonthFilter" class="form-control" value="${currentMonthValue}">
                <button class="session-icon-btn session-icon-btn-primary" id="addCostBtn" title="Thêm chi phí">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14"></path>
                        <path d="M19 12H5"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="card">
            <div class="table-container">
                <table class="table-striped costs-table">
                    <thead>
                        <tr>
                            <th>Ngày</th>
                            <th>Hạng mục</th>
                            <th>Số tiền</th>
                            <th>Trạng thái</th>
                            <th style="width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="costsTableBody">
                        ${filteredCosts.length ? filteredCosts.map(cost => {
                            const statusMeta = COST_STATUS_META[cost.status] || COST_STATUS_META.pending;
                            return `
                                <tr data-cost-id="${cost.id}">
                                    <td>${formatDateLabel(cost.date)}</td>
                                    <td>${cost.category || '-'}</td>
                                    <td>${window.UniData.formatCurrency(cost.amount || 0)}</td>
                                    <td>
                                        <span class="badge ${statusMeta.badge}" title="${statusMeta.tooltip}">
                                            ${statusMeta.label}
                                        </span>
                                    </td>
                                    <td>
                                        <button class="btn-delete-icon" data-action="delete-cost" data-cost-id="${cost.id}" title="Xóa chi phí">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="5" class="text-muted text-center">Chưa có chi phí nào trong tháng này.</td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>
            <div class="mt-3 flex justify-between items-center">
                <div class="text-muted text-sm">Tổng chi phí tháng ${monthLabel}</div>
                <div class="font-semibold">${window.UniData.formatCurrency(monthTotal)}</div>
            </div>
        </div>
    `;

    attachCostsEventHandlers(state);
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('costs', ['costs']);
}

function attachCostsEventHandlers(state) {
    const main = document.querySelector('#main-content');
    if (!main) return;

    const monthFilter = main.querySelector('#costsMonthFilter');
    if (monthFilter) {
        if (typeof monthFilter.showPicker === 'function') {
            const openPicker = () => {
                try {
                    monthFilter.showPicker();
                } catch (error) {
                    /* ignore */
                }
            };
            monthFilter.addEventListener('click', openPicker);
            monthFilter.addEventListener('focus', openPicker);
        }
        monthFilter.addEventListener('change', (event) => {
            const value = event.target.value;
            if (value && /^\d{4}-\d{2}$/.test(value)) {
                state.selectedMonth = value;
                renderCosts();
            }
        });
    }

    const addBtn = main.querySelector('#addCostBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => openCostForm());
    }

    const tableBody = main.querySelector('#costsTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const deleteBtn = event.target.closest('[data-action="delete-cost"]');
            if (deleteBtn) {
                event.stopPropagation();
                const costId = deleteBtn.getAttribute('data-cost-id');
                if (costId) deleteCost(costId);
                return;
            }

            const row = event.target.closest('tr[data-cost-id]');
            if (row) {
                const costId = row.getAttribute('data-cost-id');
                if (costId) openCostForm(costId);
            }
        });
    }
}

function openCostForm(costId = null) {
    const isEdit = Boolean(costId);
    const state = getCostsState();
    const cost = isEdit ? (window.demo.costs || []).find(c => c.id === costId) : null;
    const defaultDate = cost?.date || `${state.selectedMonth || ''}-01`;
    const defaultCategory = cost?.category || '';
    const defaultAmount = cost?.amount || 0;
    const defaultStatus = cost?.status || 'paid';

    const form = document.createElement('form');
    form.innerHTML = `
        <div class="form-group">
            <label for="costDate">Ngày chi phí*</label>
            <input type="date" id="costDate" name="date" class="form-control" value="${defaultDate}" required>
        </div>
        <div class="form-group">
            <label for="costCategory">Hạng mục*</label>
            <input type="text" id="costCategory" name="category" class="form-control" maxlength="30" value="${defaultCategory}" placeholder="Ví dụ: Thuê phòng" required>
        </div>
        <div class="form-group">
            <label for="costAmount">Số tiền*</label>
            <input type="text" inputmode="numeric" id="costAmount" name="amount" class="form-control" value="${defaultAmount}" required>
            <div class="currency-hint text-xs mt-1" id="costAmountHint"></div>
        </div>
        <div class="form-group">
            <label for="costStatus">Trạng thái*</label>
            <select id="costStatus" name="status" class="form-control" required>
                ${Object.entries(COST_STATUS_META).map(([value, meta]) => `
                    <option value="${value}" ${value === defaultStatus ? 'selected' : ''}>${meta.label}</option>
                `).join('')}
            </select>
        </div>
        <div class="form-actions mt-4">
            <button type="button" class="btn" onclick="window.UniUI.closeModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Thêm mới'}</button>
        </div>
    `;

    const amountInput = form.querySelector('#costAmount');
    window.UniUI.attachCurrencyInput(amountInput, {
        required: true,
        hintElement: form.querySelector('#costAmountHint')
    });

    const dateInput = form.querySelector('#costDate');
    if (dateInput && typeof dateInput.showPicker === 'function') {
        const openPicker = () => {
            try {
                dateInput.showPicker();
            } catch (error) {
                /* ignore */
            }
        };
        dateInput.addEventListener('click', openPicker);
        dateInput.addEventListener('focus', openPicker);
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const dateValue = form.costDate.value;
        const categoryValue = form.costCategory.value.trim();
        const amountValue = window.UniUI.getCurrencyValue(amountInput);
        const statusValue = form.costStatus.value;

        if (!dateValue || Number.isNaN(new Date(`${dateValue}T00:00:00`).getTime())) {
            window.UniUI.toast('Vui lòng chọn ngày hợp lệ', 'error');
            return;
        }
        if (!categoryValue) {
            window.UniUI.toast('Hạng mục không được để trống', 'error');
            return;
        }
        if (!Number.isFinite(amountValue)) {
            window.UniUI.toast('Số tiền không hợp lệ', 'error');
            return;
        }
        if (!COST_STATUS_META[statusValue]) {
            window.UniUI.toast('Trạng thái không hợp lệ', 'error');
            return;
        }

        const monthValue = dateValue.slice(0, 7);
        const payload = {
            date: dateValue,
            month: monthValue,
            category: categoryValue,
            amount: Math.round(amountValue),
            status: statusValue
        };

        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                if (isEdit && cost) {
                    Object.assign(cost, payload);
                    return {
                        supabaseEntities: {
                            costs: [cost]
                        }
                    };
                } else {
                    const newCost = {
                        id: window.UniData.generateId ? window.UniData.generateId('cost') : generateId('cost'),
                        ...payload
                    };
                    window.demo.costs = window.demo.costs || [];
                    window.demo.costs.push(newCost);
                    return {
                        supabaseEntities: {
                            costs: [newCost]
                        }
                    };
                }
            },
            {
                onSuccess: () => {
                    window.UniUI.closeModal();
                    const state = getCostsState();
                    state.selectedMonth = payload.month;
                    renderCosts();
                    window.UniUI.toast(isEdit ? 'Đã cập nhật chi phí' : 'Đã thêm chi phí mới', 'success');
                },
                onError: (error) => {
                    console.error('Failed to save cost:', error);
                    window.UniUI.toast('Không thể lưu chi phí: ' + (error.message || 'Lỗi không xác định'), 'error');
                    // Keep modal open on error so user can fix and retry
                },
                onRollback: () => {
                    window.UniUI.closeModal();
                    const state = getCostsState();
                    renderCosts();
                }
            }
        );
    });

    window.UniUI.openModal(isEdit ? 'Chỉnh sửa chi phí' : 'Thêm chi phí mới', form);
}

async function deleteCost(costId) {
    if (!costId) return;
    if (!confirm('Xóa chi phí này?')) return;

    const costs = window.demo.costs || [];
    const index = costs.findIndex(cost => cost.id === costId);
    if (index === -1) {
        window.UniUI.toast('Không tìm thấy chi phí để xóa', 'error');
        return;
    }

    const cost = costs[index];

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            costs.splice(index, 1);
            return {
                supabaseDeletes: { costs: [costId] }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã xóa chi phí', 'success');
                renderCosts();
            },
            onError: (error) => {
                console.error('Failed to delete cost:', error);
                window.UniUI.toast('Không thể xóa chi phí', 'error');
            },
            onRollback: () => {
                renderCosts();
            }
        }
    );
}

window.CostsPage = {
    render: renderCosts,
    openForm: openCostForm
};

