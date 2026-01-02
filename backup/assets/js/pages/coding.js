/**
 * coding.js - Lập trình page renderer (Hướng dẫn & Tài liệu)
 */

function renderCoding(activeTab = null) {
    const mainContent = document.querySelector('#main-content');
    if (!mainContent) return;

    const currentUser = window.UniAuth?.getCurrentUser ? window.UniAuth.getCurrentUser() : null;
    const isAdmin = window.UniUI?.hasRole ? window.UniUI.hasRole('admin') : false;

    // Get current active tab before re-rendering
    if (activeTab === null) {
        const currentActiveBtn = mainContent.querySelector('.tab-switch.active');
        activeTab = currentActiveBtn ? currentActiveBtn.dataset.tab : 'guide';
    }

    // Ensure documents array exists
    if (!window.demo.documents) {
        window.demo.documents = [];
    }

    function formatDate(value) {
        if (!value) return '';
        try {
            return new Date(value).toLocaleDateString('vi-VN');
        } catch {
            return '';
        }
    }

    function renderDocument(doc) {
        const date = formatDate(doc.createdAt);
        const tags = Array.isArray(doc.tags) ? doc.tags : [];
        const fileIcon = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
        `;
        const deleteIcon = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
        `;
        const editIcon = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
        `;

        return `
            <article class="doc-card" style="padding: var(--spacing-4); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: var(--spacing-4); background: var(--surface); transition: all 0.2s;" onmouseover="this.style.boxShadow='var(--shadow-sm)'" onmouseout="this.style.boxShadow='none'">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-3);">
                    <div style="display: flex; gap: var(--spacing-3); flex: 1;">
                        <div style="color: var(--primary); flex-shrink: 0; margin-top: 2px;">
                            ${fileIcon}
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 var(--spacing-1) 0; font-size: var(--font-size-lg); color: var(--text);">${doc.title || 'Không có tiêu đề'}</h3>
                            ${date ? `<p class="text-muted text-sm" style="margin: 0 0 var(--spacing-2) 0;">${date}</p>` : ''}
                            ${doc.description ? `<p style="margin: 0; color: var(--text); line-height: 1.6; font-size: var(--font-size-sm);">${doc.description}</p>` : ''}
                        </div>
                    </div>
                    ${isAdmin ? `
                        <div style="display: flex; gap: var(--spacing-1); flex-shrink: 0;">
                            <button class="btn btn-icon" onclick="editDocument('${doc.id}')" title="Chỉnh sửa" style="width: 32px; height: 32px; padding: 0; color: var(--muted);">
                                ${editIcon}
                            </button>
                            <button class="btn btn-icon" onclick="deleteDocument('${doc.id}')" title="Xóa" style="width: 32px; height: 32px; padding: 0; color: var(--danger, #ef4444);">
                                ${deleteIcon}
                            </button>
                        </div>
                    ` : ''}
                </div>
                ${tags.length > 0 ? `
                    <div style="display: flex; gap: var(--spacing-1); flex-wrap: wrap; margin-bottom: var(--spacing-3);">
                        ${tags.map(tag => `
                            <span class="badge" style="background: var(--bg); color: var(--text); border: 1px solid var(--border); font-size: var(--font-size-xs);">${tag}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div style="display: flex; gap: var(--spacing-2);">
                    <a href="${doc.fileUrl || '#'}" target="_blank" rel="noopener" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: var(--spacing-1);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Tải xuống
                    </a>
                </div>
            </article>
        `;
    }

    function renderUploadForm() {
        if (!isAdmin) return '';
        
        const uploadIcon = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
        `;

        return `
            <div class="card" style="padding: var(--spacing-5); margin-bottom: var(--spacing-4); border: 2px dashed var(--border);">
                <div id="toggleUploadForm" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-4); cursor: pointer; user-select: none;">
                    <h3 style="margin: 0; font-size: var(--font-size-lg); display: flex; align-items: center; gap: var(--spacing-2); pointer-events: none;">
                        ${uploadIcon}
                        Thêm tài liệu mới
                    </h3>
                    <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="toggleIcon">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </div>
                </div>
                <form id="documentUploadForm" style="display: none;">
                    <div class="form-group" style="margin-bottom: var(--spacing-3);">
                        <label for="docTitle" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Tiêu đề *</label>
                        <input type="text" id="docTitle" name="title" class="form-control" required placeholder="VD: Tài liệu C++ cơ bản">
                    </div>
                    <div class="form-group" style="margin-bottom: var(--spacing-3);">
                        <label for="docDescription" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Mô tả</label>
                        <textarea id="docDescription" name="description" class="form-control" rows="3" placeholder="Mô tả ngắn về tài liệu..."></textarea>
                    </div>
                    <div class="form-group" style="margin-bottom: var(--spacing-3);">
                        <label for="docFileUrl" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Link tài liệu *</label>
                        <input type="url" id="docFileUrl" name="fileUrl" class="form-control" required placeholder="https://example.com/document.pdf">
                        <p class="text-muted text-sm" style="margin: var(--spacing-1) 0 0 0;">Nhập link đến file PDF, DOCX hoặc link Google Drive</p>
                    </div>
                    <div class="form-group" style="margin-bottom: var(--spacing-3);">
                        <label for="docTags" style="display: block; margin-bottom: var(--spacing-1); font-weight: 500;">Nhãn chủ đề</label>
                        <input type="text" id="docTags" name="tags" class="form-control" placeholder="VD: C++, Python, Thuật toán (phân cách bằng dấu phẩy)">
                        <p class="text-muted text-sm" style="margin: var(--spacing-1) 0 0 0;">Nhập các nhãn, phân cách bằng dấu phẩy</p>
                    </div>
                    <div style="display: flex; gap: var(--spacing-2); justify-content: flex-end;">
                        <button type="button" class="btn" id="cancelUploadBtn">Hủy</button>
                        <button type="submit" class="btn btn-primary">Thêm tài liệu</button>
                    </div>
                </form>
            </div>
        `;
    }

    const documents = window.demo.documents || [];

    mainContent.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto;">
            <div style="background: var(--primary); color: white; padding: var(--spacing-6); border-radius: var(--radius-lg); margin-bottom: var(--spacing-6);">
                <div style="margin-bottom: var(--spacing-4);">
                    <span class="badge" style="background: rgba(255,255,255,0.2); color: white; margin-bottom: var(--spacing-2);">Unicorns Edu</span>
                    <h1 style="margin: var(--spacing-2) 0; font-size: 2rem; font-weight: 700;">Lập trình</h1>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                    <a class="btn" href="https://unicornsedu.contest.codeforces.com/" target="_blank" rel="noopener"
                        style="background: white; color: var(--primary); border: none;">
                        Mở Codeforces Group
                    </a>
                </div>
            </div>

            <div style="display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-4); border-bottom: 1px solid var(--border);">
                <button class="tab-switch ${activeTab === 'guide' ? 'active' : ''}" data-tab="guide" style="padding: var(--spacing-2) var(--spacing-4); border: none; background: transparent; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s;">
                    Hướng dẫn
                </button>
                <button class="tab-switch ${activeTab === 'docs' ? 'active' : ''}" data-tab="docs" style="padding: var(--spacing-2) var(--spacing-4); border: none; background: transparent; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.2s;">
                    Tài liệu
                </button>
            </div>

            <section id="tab-guide" class="tab-panel ${activeTab === 'guide' ? 'active' : ''}" style="${activeTab === 'guide' ? '' : 'display: none;'}">
                <div class="card" style="padding: var(--spacing-5);">
                    <h2 style="margin: 0 0 var(--spacing-4) 0; font-size: var(--font-size-xl);">Quy trình thao tác</h2>
                    <ol style="margin: 0; padding-left: var(--spacing-5); line-height: 1.8;">
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Truy cập vào link:</strong> 
                            <a href="http://unicornsedu.contest.codeforces.com" target="_blank" rel="noopener" style="color: var(--primary); text-decoration: underline;">http://unicornsedu.contest.codeforces.com</a>
                        </li>
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Sử dụng tài khoản đã cấp trong Gmail để đăng nhập</strong> (không cần tạo tài khoản mới).
                        </li>
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Sau khi đăng nhập, chọn contest → chọn bài → mở đề bài</strong> để làm.
                        </li>
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Để nộp bài:</strong> Bấm <strong>"Submit Code"</strong> → chọn ngôn ngữ <code style="background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--primary);">GNU G++23</code>.
                        </li>
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Để xem lịch sử bài làm:</strong> Chọn <strong>"My Submissions"</strong>.
                        </li>
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Để xem lại bài đã nộp:</strong> Trong <strong>"My Submissions"</strong>, bấm vào dòng chữ màu xanh ở cột đầu tiên → kéo xuống để xem các test sai.
                        </li>
                        <li style="margin-bottom: var(--spacing-3);">
                            <strong>Để xem bảng xếp hạng:</strong> Chọn <strong>"Standings"</strong> → nếu chưa hiển thị, tick vào ô <strong>"Show unofficial"</strong> ở góc trên bên phải.
                        </li>
                    </ol>
                </div>
            </section>

            <section id="tab-docs" class="tab-panel ${activeTab === 'docs' ? 'active' : ''}" style="${activeTab === 'docs' ? '' : 'display: none;'}">
                ${renderUploadForm()}
                <div id="documentsList">
                    ${documents.length ? documents.map(renderDocument).join('') : '<p class="text-muted" style="text-align: center; padding: var(--spacing-6);">Hiện chưa có tài liệu nào.</p>'}
                </div>
            </section>
        </div>
    `;

    // Tab switching logic
    const tabButtons = mainContent.querySelectorAll('.tab-switch');
    const panels = mainContent.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => {
                b.classList.remove('active');
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--muted)';
            });
            panels.forEach(panel => {
                panel.classList.remove('active');
                panel.style.display = 'none';
            });
            btn.classList.add('active');
            btn.style.borderBottomColor = 'var(--primary)';
            btn.style.color = 'var(--text)';
            const targetPanel = mainContent.querySelector(`#tab-${btn.dataset.tab}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
                targetPanel.style.display = 'block';
            }
        });
    });

    // Set initial active tab styles
    const activeBtn = mainContent.querySelector('.tab-switch.active');
    if (activeBtn) {
        activeBtn.style.borderBottomColor = 'var(--primary)';
        activeBtn.style.color = 'var(--text)';
    }

    // Upload form toggle (admin only)
    if (isAdmin) {
        const toggleBtn = mainContent.querySelector('#toggleUploadForm');
        const uploadForm = mainContent.querySelector('#documentUploadForm');
        const cancelBtn = mainContent.querySelector('#cancelUploadBtn');
        const toggleIcon = mainContent.querySelector('#toggleIcon');
        
        if (toggleBtn && uploadForm) {
            toggleBtn.addEventListener('click', () => {
                const isVisible = uploadForm.style.display !== 'none';
                uploadForm.style.display = isVisible ? 'none' : 'block';
                // Rotate icon
                if (toggleIcon) {
                    toggleIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                    toggleIcon.style.transition = 'transform 0.2s ease';
                }
                if (!isVisible) {
                    uploadForm.querySelector('#docTitle')?.focus();
                }
            });
        }

        if (cancelBtn && uploadForm) {
            cancelBtn.addEventListener('click', () => {
                uploadForm.style.display = 'none';
                uploadForm.reset();
                // Reset icon rotation
                if (toggleIcon) {
                    toggleIcon.style.transform = 'rotate(0deg)';
                }
            });
        }

        // Handle form submission
        if (uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(uploadForm);
                const title = formData.get('title')?.trim() || '';
                const description = formData.get('description')?.trim() || '';
                const fileUrl = formData.get('fileUrl')?.trim() || '';
                const tagsInput = formData.get('tags')?.trim() || '';
                
                if (!title || !fileUrl) {
                    window.UniUI.toast('Vui lòng nhập đầy đủ tiêu đề và link tài liệu', 'error');
                    return;
                }

                const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
                
                const newDoc = {
                    id: 'DOC' + Math.random().toString(36).slice(2, 8).toUpperCase(),
                    title,
                    description,
                    fileUrl,
                    tags,
                    uploadedBy: currentUser?.id || 'U_ADMIN',
                    createdAt: new Date().toISOString()
                };

                // Use optimistic update pattern
                await window.UniData.withOptimisticUpdate(
                    () => {
                        window.demo.documents = window.demo.documents || [];
                        window.demo.documents.unshift(newDoc);
                        
                        return {
                            supabaseEntities: {
                                documents: [newDoc]
                            }
                        };
                    },
                    {
                        onSuccess: () => {
                            window.UniUI.toast('Đã thêm tài liệu mới', 'success');
                            uploadForm.reset();
                            uploadForm.style.display = 'none';
                            renderCoding('docs');
                        },
                        onError: (error) => {
                            console.error('Error saving document:', error);
                            window.UniUI.toast('Không thể thêm tài liệu', 'error');
                        },
                        onRollback: () => {
                            renderCoding('docs');
                        }
                    }
                );
            });
        }
    }
}

async function editDocument(docId) {
    const doc = (window.demo.documents || []).find(d => d.id === docId);
    if (!doc) {
        window.UniUI.toast('Không tìm thấy tài liệu', 'error');
        return;
    }

    const title = prompt('Tiêu đề:', doc.title);
    if (title === null) return;

    const description = prompt('Mô tả:', doc.description || '');
    if (description === null) return;

    const fileUrl = prompt('Link tài liệu:', doc.fileUrl);
    if (fileUrl === null) return;

    const tagsInput = prompt('Nhãn (phân cách bằng dấu phẩy):', Array.isArray(doc.tags) ? doc.tags.join(', ') : '');
    if (tagsInput === null) return;

    doc.title = title.trim();
    doc.description = description.trim();
    doc.fileUrl = fileUrl.trim();
    doc.tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Use optimistic update pattern
    await window.UniData.withOptimisticUpdate(
        () => {
            return {
                supabaseEntities: {
                    documents: [doc]
                }
            };
        },
        {
            onSuccess: () => {
                window.UniUI.toast('Đã cập nhật tài liệu', 'success');
                renderCoding('docs');
            },
            onError: (error) => {
                console.error('Error updating document:', error);
                window.UniUI.toast('Không thể cập nhật tài liệu', 'error');
            },
            onRollback: () => {
                renderCoding('docs');
            }
        }
    );
}

async function deleteDocument(docId) {
    const doc = (window.demo.documents || []).find(d => d.id === docId);
    if (!doc) {
        window.UniUI.toast('Không tìm thấy tài liệu', 'error');
        return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${doc.title}"?`)) {
        return;
    }

    const index = window.demo.documents.findIndex(d => d.id === docId);
    if (index !== -1) {
        // Use optimistic update pattern
        await window.UniData.withOptimisticUpdate(
            () => {
                window.demo.documents.splice(index, 1);
                
                return {
                    supabaseDeletes: {
                        documents: [docId]
                    }
                };
            },
            {
                onSuccess: () => {
                    window.UniUI.toast('Đã xóa tài liệu', 'success');
                    renderCoding('docs');
                },
                onError: (error) => {
                    console.error('Error deleting document:', error);
                    window.UniUI.toast('Không thể xóa tài liệu', 'error');
                },
                onRollback: () => {
                    renderCoding('docs');
                }
            }
        );
    }
}

// Export
window.CodingPage = {
    render: renderCoding
};

// Expose functions globally
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
