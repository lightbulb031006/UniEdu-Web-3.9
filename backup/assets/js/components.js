/**
 * components.js - Reusable UI components (breadcrumb, loading, etc.)
 */

/**
 * Render breadcrumb navigation
 * @param {Array} items - Array of {label, page} objects
 */
function renderBreadcrumb(items) {
    if (!items || !items.length) return '';
    const role = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser()?.role : null;
    if (role === 'student' || role === 'teacher') {
        return '';
    }
    return `
        <nav class="breadcrumb" aria-label="Breadcrumb">
            ${items.map((item, index) => {
                const isLast = index === items.length - 1;
                return `
                    <span class="breadcrumb-item">
                        ${isLast ? 
                            `<span class="breadcrumb-current">${item.label}</span>` :
                            `<a href="#" onclick="window.UniUI.loadPage('${item.page}'); return false;">${item.label}</a>`
                        }
                    </span>
                    ${!isLast ? '<span class="breadcrumb-separator">/</span>' : ''}
                `;
            }).join('')}
        </nav>
    `;
}

/**
 * Show loading spinner - Enhanced
 * @param {HTMLElement} container - Container to show loading in
 * @param {Object} options - Loading options
 */
function showLoading(container, options = {}) {
    if (!container) return;
    
    const {
        type = 'spinner', // 'spinner' | 'skeleton' | 'skeleton-table' | 'skeleton-card'
        message = 'Đang tải...',
        skeletonCount = 3
    } = options;
    
    if (type === 'skeleton' || type === 'skeleton-table' || type === 'skeleton-card') {
        container.innerHTML = window.UniUI?.renderSkeletonLoading?.(type.replace('skeleton-', ''), skeletonCount) || `
            <div class="loading-container">
                <div class="spinner"></div>
                <p class="text-muted">${message}</p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p class="text-muted">${message}</p>
            </div>
        `;
    }
}

/**
 * Render form field with inline error - Enhanced
 * @param {string} id - Field ID
 * @param {string} label - Field label
 * @param {string} type - Input type
 * @param {string} value - Current value
 * @param {Object} attrs - Additional attributes
 * @param {string} error - Error message
 * @param {string} success - Success message
 * @param {string} hint - Hint message
 */
function renderFormField(id, label, type = 'text', value = '', attrs = {}, error = '', success = '', hint = '') {
    const required = attrs.required ? 'required' : '';
    const placeholder = attrs.placeholder || '';
    const options = attrs.options || [];
    const disabled = attrs.disabled ? 'disabled' : '';
    const readonly = attrs.readonly ? 'readonly' : '';
    
    let input = '';
    const errorClass = error ? 'error' : '';
    const successClass = success ? 'success' : '';
    const controlClass = `form-control ${errorClass} ${successClass}`.trim();
    
    if (type === 'select') {
        input = `
            <select id="${id}" name="${id}" class="${controlClass}" ${required} ${disabled}>
                ${options.map(opt => `
                    <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
            </select>
        `;
    } else if (type === 'textarea') {
        input = `
            <textarea id="${id}" name="${id}" class="${controlClass}" ${required} ${disabled} ${readonly} placeholder="${placeholder}">${value}</textarea>
        `;
    } else {
        input = `
            <input type="${type}" id="${id}" name="${id}" class="${controlClass}" value="${value}" ${required} ${disabled} ${readonly} placeholder="${placeholder}">
        `;
    }
    
    let feedback = '';
    if (error) {
        feedback = `<div class="form-error">${error}</div>`;
    } else if (success) {
        feedback = `<div class="form-success">${success}</div>`;
    } else if (hint) {
        feedback = `<div class="form-hint">${hint}</div>`;
    }
    
    return `
        <div class="form-group">
            <label for="${id}">${label}${attrs.required ? ' *' : ''}</label>
            ${input}
            ${feedback}
        </div>
    `;
}

/**
 * Debounce function for search
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Highlight search term in text
 * @param {string} text - Text to highlight
 * @param {string} term - Search term
 */
function highlightText(text, term) {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return String(text).replace(regex, '<mark>$1</mark>');
}

// Export components
window.UniComponents = {
    breadcrumb: renderBreadcrumb,
    loading: showLoading,
    formField: renderFormField,
    debounce,
    highlight: highlightText
};

