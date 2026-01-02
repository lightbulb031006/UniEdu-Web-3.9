/**
 * categories.js - Manage class categories (types)
 */

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function(ch) {
        switch (ch) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return ch;
        }
    });
}

async function renderCategories() {
    // Initialize listeners and try optimistic loading
    if (!window.__categoriesListenersInitialized) {
        window.UniData?.initPageListeners?.('categories', renderCategories, ['categories']);
        window.__categoriesListenersInitialized = true;
    }
    
    // Optimistic loading: try to load from cache immediately
    if (!window.demo || Object.keys(window.demo).length === 0) {
        const loaded = await window.UniData?.loadPageDataFromCache?.();
        if (loaded) {
            setTimeout(() => renderCategories(), 10);
            return;
        } else {
            const main = document.querySelector('#main-content');
            if (main) {
                main.innerHTML = '<div class="card"><p class="text-muted">Đang tải dữ liệu...</p></div>';
            }
            setTimeout(() => renderCategories(), 120);
            return;
        }
    }
    
    const main = document.querySelector('#main-content');
    if (!main) return;
    const categories = window.AppStore?.store.getState().categories || window.UniData.getCategories();
    main.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h2>Phân loại lớp</h2>
            <div class="flex gap-2">
                <input id="newCat" class="form-control" placeholder="Tên phân loại">
                <button class="btn" id="addCatBtn">Thêm</button>
            </div>
        </div>
        <div class="card">
            <div class="table-container">
                <table class="table-striped">
                    <thead><tr><th>Tên</th><th></th></tr></thead>
                    <tbody id="catBody">${categories.map((c, idx)=>{
                        const name = c && typeof c === 'object' ? c.name || '' : String(c || '');
                        const id = c && typeof c === 'object' ? (c.id ?? '') : '';
                        return `<tr data-index="${idx}" data-id="${id}">
                            <td><input class="form-control" value="${escapeHtml(name)}" data-index="${idx}"></td>
                            <td>
                                <button class="btn" data-action="save" data-index="${idx}">Lưu</button>
                                <button class="btn btn-danger" data-action="delete" data-index="${idx}">Xóa</button>
                            </td>
                        </tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
        </div>
    `;

    function refresh() { renderCategories(); }

    document.getElementById('addCatBtn')?.addEventListener('click', () => {
        const input = document.getElementById('newCat');
        const v = input?.value.trim();
        if (!v) return;
        window.AppStore?.store.dispatch({ type: window.AppStore.actions.ADD_CATEGORY, payload: { name: v } });
        input.value = '';
        refresh();
    });

    main.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const act = btn.getAttribute('data-action');
        const idx = Number(btn.getAttribute('data-index'));
        const currentCategories = window.AppStore?.store.getState().categories || window.UniData.getCategories();
        const target = currentCategories[idx];
        if (!target) return;
        if (act === 'delete') {
            window.AppStore?.store.dispatch({ type: window.AppStore.actions.DELETE_CATEGORY, payload: { id: target.id ?? null, name: target.name } });
            refresh();
        } else if (act === 'save') {
            const input = main.querySelector(`input[data-index="${idx}"]`);
            const nv = input?.value.trim();
            if (!nv) return;
            window.AppStore?.store.dispatch({
                type: window.AppStore.actions.UPDATE_CATEGORY,
                payload: { id: target.id ?? null, oldName: target.name, newName: nv }
            });
            refresh();
        }
    });
    
    // Update snapshot after rendering
    window.UniData?.hasPageDataChanged?.('categories', ['categories']);
}

window.CategoriesPage = { render: renderCategories };


