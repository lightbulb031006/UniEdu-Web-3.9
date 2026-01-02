/**
 * store.js - Minimal Redux store for categories and basic app state
 */

(function(){
    const initialState = {
        categories: (window.UniData && window.UniData.getCategories) ? window.UniData.getCategories() : [{ id: null, name: '1-1' }, { id: null, name: 'Basic' }, { id: null, name: 'Advance' }, { id: null, name: 'Hardcore' }],
        pager: {
            classes: { page: 1, pageSize: 10 },
            students: { page: 1, pageSize: 10 },
            teachers: { page: 1, pageSize: 10 }
        }
    };

    function normalizeCategoryPayload(payload) {
        if (window.UniData && window.UniData.normalizeCategory) {
            return window.UniData.normalizeCategory(payload);
        }
        if (payload === null || payload === undefined) return null;
        if (typeof payload === 'string') {
            const name = payload.trim();
            return name ? { id: null, name } : null;
        }
        if (typeof payload === 'object') {
            const name = (payload.name ?? payload.value ?? payload.label ?? '').trim();
            if (!name) return null;
            return { id: payload.id ?? payload.ID ?? null, name };
        }
        const name = String(payload).trim();
        return name ? { id: null, name } : null;
    }

    function dedupeCategories(list) {
        const seen = new Set();
        const result = [];
        list.forEach(cat => {
            if (!cat) return;
            const key = (cat.name || '').toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            result.push({ id: cat.id ?? null, name: cat.name });
        });
        return result;
    }

    const ACTIONS = {
        SET_CATEGORIES: 'SET_CATEGORIES',
        ADD_CATEGORY: 'ADD_CATEGORY',
        UPDATE_CATEGORY: 'UPDATE_CATEGORY',
        DELETE_CATEGORY: 'DELETE_CATEGORY',
        SET_PAGE: 'SET_PAGE'
    };

    function reducer(state = initialState, action) {
        switch(action.type) {
            case ACTIONS.SET_CATEGORIES: {
                const payload = Array.isArray(action.payload) ? action.payload : [];
                const normalized = dedupeCategories(payload.map(normalizeCategoryPayload).filter(Boolean));
                return { ...state, categories: normalized };
            }
            case ACTIONS.ADD_CATEGORY: {
                const normalized = normalizeCategoryPayload(action.payload);
                if (!normalized) return state;
                const exists = state.categories.some(cat => (cat.name || '').toLowerCase() === normalized.name.toLowerCase());
                if (exists) return state;
                return { ...state, categories: [...state.categories, { id: normalized.id ?? null, name: normalized.name }] };
            }
            case ACTIONS.UPDATE_CATEGORY: {
                const { id, newName, oldName } = action.payload || {};
                const updated = normalizeCategoryPayload({ id: id ?? (action.payload?.id ?? null), name: typeof newName === 'string' ? newName : (newName && newName.name ? newName.name : newName ?? '') });
                if (!updated || !updated.name) return state;
                const next = state.categories.map(cat => {
                    const matchById = id !== undefined && id !== null && cat.id === id;
                    const matchByName = !matchById && oldName ? cat.name === oldName : false;
                    if (!matchById && !matchByName) return cat;
                    return { id: cat.id ?? updated.id ?? id ?? null, name: updated.name };
                });
                return { ...state, categories: dedupeCategories(next) };
            }
            case ACTIONS.DELETE_CATEGORY: {
                const payload = normalizeCategoryPayload(action.payload);
                const id = action.payload && typeof action.payload === 'object' && action.payload.id !== undefined ? action.payload.id : payload?.id ?? null;
                const name = payload ? payload.name : (typeof action.payload === 'string' ? action.payload : null);
                const filtered = state.categories.filter(cat => {
                    if (id !== null && id !== undefined) {
                        return cat.id !== id;
                    }
                    if (name) {
                        return cat.name !== name;
                    }
                    return true;
                });
                return { ...state, categories: filtered };
            }
            case ACTIONS.SET_PAGE: {
                const { key, page } = action.payload;
                return {
                    ...state,
                    pager: {
                        ...state.pager,
                        [key]: { ...state.pager[key], page }
                    }
                };
            }
            default:
                return state;
        }
    }

    const store = window.Redux ? window.Redux.createStore(reducer) : { getState: () => initialState, subscribe: () => () => {}, dispatch: () => {} };

    let suppressCategorySync = false;

    // Persist categories to UniData when changes
    let previousCategoriesRef = (typeof store.getState === 'function' ? store.getState() : initialState).categories;
    store.subscribe(() => {
        const state = typeof store.getState === 'function' ? store.getState() : initialState;
        if (previousCategoriesRef === state.categories) {
            return;
        }
        previousCategoriesRef = state.categories;
        if (suppressCategorySync) return;
        const categories = state?.categories || [];
        if (window.UniData && window.UniData.setCategories) {
            window.UniData.setCategories(categories);
        }
    });

    function setCategoriesSilently(categories) {
        const next = Array.isArray(categories) ? categories : [];
        if (!store || typeof store.dispatch !== 'function') {
            if (window.demo) {
                const normalized = dedupeCategories(next.map(normalizeCategoryPayload).filter(Boolean));
                window.demo.categories = normalized;
            }
            return;
        }
        suppressCategorySync = true;
        try {
            const normalized = dedupeCategories(next.map(normalizeCategoryPayload).filter(Boolean));
            store.dispatch({ type: ACTIONS.SET_CATEGORIES, payload: normalized });
        } finally {
            suppressCategorySync = false;
        }
    }

    // Expose actions and store
    window.AppStore = {
        store,
        actions: ACTIONS,
        setCategoriesSilently
    };
})();


