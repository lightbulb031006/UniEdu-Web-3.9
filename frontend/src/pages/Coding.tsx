import React, { useState, useCallback } from 'react';
import { useDataLoading } from '../hooks/useDataLoading';
import { useAuthStore } from '../store/authStore';
import { fetchDocuments, createDocument, updateDocument, deleteDocument, Document, DocumentFormData } from '../services/documentsService';
import { formatDate } from '../utils/formatters';
import { toast } from '../utils/toast';
import Modal from '../components/Modal';

/**
 * Coding Page Component - Lập trình (Hướng dẫn & Tài liệu)
 * Migrated from backup/assets/js/pages/coding.js
 */

function Coding() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('guide');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    description: '',
    file_url: '',
    tags: [],
  });

  const fetchDocumentsFn = useCallback(() => fetchDocuments({ search: search || undefined }), [search]);

  const { data: documentsData, isLoading, error, refetch } = useDataLoading(fetchDocumentsFn, [search], {
    cacheKey: `documents-${search}`,
    staleTime: 2 * 60 * 1000,
  });

  // Ensure documents is always an array
  const documents = Array.isArray(documentsData) ? documentsData : [];

  const handleOpenModal = (doc?: Document) => {
    if (doc) {
      setEditingDocument(doc);
      setFormData({
        title: doc.title || '',
        description: doc.description || '',
        file_url: doc.file_url || '',
        tags: doc.tags || [],
      });
    } else {
      setEditingDocument(null);
      setFormData({
        title: '',
        description: '',
        file_url: '',
        tags: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDocument(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Tiêu đề không được để trống');
      return;
    }

    if (!formData.file_url.trim()) {
      toast.error('File URL không được để trống');
      return;
    }

    try {
      if (editingDocument) {
        await updateDocument(editingDocument.id, formData);
        toast.success('Đã cập nhật tài liệu');
      } else {
        await createDocument(formData);
        toast.success('Đã thêm tài liệu mới');
        setUploadFormOpen(false);
        setFormData({ title: '', description: '', file_url: '', tags: [] });
      }
      handleCloseModal();
      refetch();
    } catch (error: any) {
      toast.error('Không thể lưu tài liệu: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Xóa tài liệu này?')) return;

    try {
      await deleteDocument(docId);
      toast.success('Đã xóa tài liệu');
      refetch();
    } catch (error: any) {
      toast.error('Không thể xóa tài liệu: ' + (error.message || 'Lỗi không xác định'));
    }
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.currentTarget;
      const tag = input.value.trim();
      if (tag && !formData.tags?.includes(tag)) {
        setFormData({ ...formData, tags: [...(formData.tags || []), tag] });
        input.value = '';
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags?.filter((t) => t !== tagToRemove) || [] });
  };

  const [uploadFormOpen, setUploadFormOpen] = useState(false);

  return (
    <div className="page-container" style={{ padding: 'var(--spacing-6)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header với background primary */}
        <div
          style={{
            background: 'var(--primary)',
            color: 'white',
            padding: 'var(--spacing-6)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-6)',
          }}
        >
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <span
              className="badge"
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                marginBottom: 'var(--spacing-2)',
                display: 'inline-block',
              }}
            >
              Unicorns Edu
            </span>
            <h1 style={{ margin: 'var(--spacing-2) 0', fontSize: '2rem', fontWeight: '700' }}>Lập trình</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              className="btn"
              href="https://unicornsedu.contest.codeforces.com/"
              target="_blank"
              rel="noopener"
              style={{
                background: 'white',
                color: 'var(--primary)',
                border: 'none',
                textDecoration: 'none',
              }}
            >
              Mở Codeforces Group
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--border)' }}>
          <button
            className={`tab-switch ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => setActiveTab('guide')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'guide' ? 'var(--text)' : 'var(--muted)',
              cursor: 'pointer',
              borderBottom: activeTab === 'guide' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.2s',
            }}
          >
            Hướng dẫn
          </button>
          <button
            className={`tab-switch ${activeTab === 'docs' ? 'active' : ''}`}
            onClick={() => setActiveTab('docs')}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'docs' ? 'var(--text)' : 'var(--muted)',
              cursor: 'pointer',
              borderBottom: activeTab === 'docs' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.2s',
            }}
          >
            Tài liệu
          </button>
        </div>

        {/* Content */}
        {activeTab === 'guide' && (
          <div className="card" style={{ padding: 'var(--spacing-5)' }}>
            <h2 style={{ margin: '0 0 var(--spacing-4) 0', fontSize: 'var(--font-size-xl)' }}>Quy trình thao tác</h2>
            <ol style={{ margin: 0, paddingLeft: 'var(--spacing-5)', lineHeight: 1.8 }}>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Truy cập vào link:</strong>{' '}
                <a
                  href="http://unicornsedu.contest.codeforces.com"
                  target="_blank"
                  rel="noopener"
                  style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                >
                  http://unicornsedu.contest.codeforces.com
                </a>
              </li>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Sử dụng tài khoản đã cấp trong Gmail để đăng nhập</strong> (không cần tạo tài khoản mới).
              </li>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Sau khi đăng nhập, chọn contest → chọn bài → mở đề bài</strong> để làm.
              </li>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Để nộp bài:</strong> Bấm <strong>"Submit Code"</strong> → chọn ngôn ngữ{' '}
                <code
                  style={{
                    background: 'var(--bg)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    color: 'var(--primary)',
                  }}
                >
                  GNU G++23
                </code>
                .
              </li>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Để xem lịch sử bài làm:</strong> Chọn <strong>"My Submissions"</strong>.
              </li>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Để xem lại bài đã nộp:</strong> Trong <strong>"My Submissions"</strong>, bấm vào dòng chữ màu xanh ở cột đầu tiên → kéo xuống để xem các test sai.
              </li>
              <li style={{ marginBottom: 'var(--spacing-3)' }}>
                <strong>Để xem bảng xếp hạng:</strong> Chọn <strong>"Standings"</strong> → nếu chưa hiển thị, tick vào ô <strong>"Show unofficial"</strong> ở góc trên bên phải.
              </li>
            </ol>
          </div>
        )}

        {activeTab === 'docs' && (
          <>
            {/* Upload Form (Collapsible) */}
            {isAdmin && (
              <div
                className="card"
                style={{
                  padding: 'var(--spacing-5)',
                  marginBottom: 'var(--spacing-4)',
                  border: '2px dashed var(--border)',
                }}
              >
                <div
                  onClick={() => setUploadFormOpen(!uploadFormOpen)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: uploadFormOpen ? 'var(--spacing-4)' : 0,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 'var(--font-size-lg)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-2)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Thêm tài liệu mới
                  </h3>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: uploadFormOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                {uploadFormOpen && (
                  <form
                    onSubmit={handleSubmit}
                    style={{ display: 'block' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                      <label htmlFor="docTitle" style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                        Tiêu đề *
                      </label>
                      <input
                        id="docTitle"
                        type="text"
                        className="form-control"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        placeholder="VD: Tài liệu C++ cơ bản"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                      <label htmlFor="docDescription" style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                        Mô tả
                      </label>
                      <textarea
                        id="docDescription"
                        className="form-control"
                        rows={3}
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Mô tả ngắn về tài liệu..."
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                      <label htmlFor="docFileUrl" style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                        Link tài liệu *
                      </label>
                      <input
                        id="docFileUrl"
                        type="url"
                        className="form-control"
                        value={formData.file_url}
                        onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                        required
                        placeholder="https://example.com/document.pdf"
                      />
                      <p className="text-muted text-sm" style={{ margin: 'var(--spacing-1) 0 0 0' }}>
                        Nhập link đến file PDF, DOCX hoặc link Google Drive
                      </p>
                    </div>
                    <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                      <label htmlFor="docTags" style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontWeight: '500' }}>
                        Nhãn chủ đề
                      </label>
                      <input
                        id="docTags"
                        type="text"
                        className="form-control"
                        placeholder="VD: C++, Python, Thuật toán (phân cách bằng dấu phẩy)"
                        onKeyPress={handleTagInput}
                      />
                      <p className="text-muted text-sm" style={{ margin: 'var(--spacing-1) 0 0 0' }}>
                        Nhập các nhãn, phân cách bằng dấu phẩy
                      </p>
                      {formData.tags && formData.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', marginTop: 'var(--spacing-2)' }}>
                          {formData.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="badge"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-1)',
                                padding: '4px 8px',
                                fontSize: 'var(--font-size-xs)',
                              }}
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  marginLeft: '4px',
                                  color: 'inherit',
                                }}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setUploadFormOpen(false);
                          setFormData({ title: '', description: '', file_url: '', tags: [] });
                          setEditingDocument(null);
                        }}
                      >
                        Hủy
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Thêm tài liệu
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Documents List */}
            <div id="documentsList">
              {isLoading ? (
                <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                  <div className="spinner" />
                  <p className="text-muted" style={{ marginTop: 'var(--spacing-3)' }}>Đang tải tài liệu...</p>
                </div>
              ) : error ? (
                <div className="card" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                  <p style={{ color: 'var(--danger)' }}>Lỗi: {error.message}</p>
                </div>
              ) : documents.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                  Hiện chưa có tài liệu nào.
                </p>
              ) : (
                documents.map((doc) => (
                  <article
                    key={doc.id}
                    className="doc-card"
                    style={{
                      padding: 'var(--spacing-4)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      marginBottom: 'var(--spacing-4)',
                      background: 'var(--surface)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-3)' }}>
                      <div style={{ display: 'flex', gap: 'var(--spacing-3)', flex: 1 }}>
                        <div style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 var(--spacing-1) 0', fontSize: 'var(--font-size-lg)', color: 'var(--text)' }}>
                            {doc.title || 'Không có tiêu đề'}
                          </h3>
                          {doc.created_at && (
                            <p className="text-muted text-sm" style={{ margin: '0 0 var(--spacing-2) 0' }}>
                              {formatDate(doc.created_at)}
                            </p>
                          )}
                          {doc.description && (
                            <p style={{ margin: 0, color: 'var(--text)', lineHeight: 1.6, fontSize: 'var(--font-size-sm)' }}>
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexShrink: 0 }}>
                          <button
                            className="btn btn-icon"
                            onClick={() => handleOpenModal(doc)}
                            title="Chỉnh sửa"
                            style={{ width: '32px', height: '32px', padding: 0, color: 'var(--muted)' }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="btn btn-icon"
                            onClick={() => handleDelete(doc.id)}
                            title="Xóa"
                            style={{ width: '32px', height: '32px', padding: 0, color: 'var(--danger, #ef4444)' }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {doc.tags && doc.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap', marginBottom: 'var(--spacing-3)' }}>
                        {doc.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="badge"
                            style={{
                              background: 'var(--bg)',
                              color: 'var(--text)',
                              border: '1px solid var(--border)',
                              fontSize: 'var(--font-size-xs)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      <a
                        href={doc.file_url || '#'}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-1)', textDecoration: 'none' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Tải xuống
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Document Edit Modal (chỉ khi edit) */}
      {isAdmin && editingDocument && (
        <Modal
          title="Chỉnh sửa tài liệu"
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          size="lg"
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label htmlFor="editDocTitle" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Tiêu đề *
              </label>
              <input
                id="editDocTitle"
                type="text"
                className="form-control"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label htmlFor="editDocDescription" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Mô tả
              </label>
              <textarea
                id="editDocDescription"
                className="form-control"
                rows={4}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label htmlFor="editDocFileUrl" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                File URL *
              </label>
              <input
                id="editDocFileUrl"
                type="url"
                className="form-control"
                value={formData.file_url}
                onChange={(e) => setFormData({ ...formData, file_url: e.target.value })}
                placeholder="https://..."
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--spacing-4)' }}>
              <label htmlFor="editDocTags" style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>
                Tags (Nhấn Enter để thêm)
              </label>
              <input
                id="editDocTags"
                type="text"
                className="form-control"
                placeholder="Nhập tag và nhấn Enter"
                onKeyPress={handleTagInput}
              />
              {formData.tags && formData.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', marginTop: 'var(--spacing-2)' }}>
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="badge"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-1)',
                        padding: '4px 8px',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          marginLeft: '4px',
                          color: 'inherit',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginTop: 'var(--spacing-6)' }}>
              <button type="button" className="btn" onClick={handleCloseModal}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary">
                Cập nhật
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Coding;
